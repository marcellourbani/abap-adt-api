import { inspect } from "util"
import {
  AdtHTTP,
  ClientOptions,
  HttpClient,
  HttpClientException,
  HttpClientOptions,
  HttpClientResponse,
  session_types
} from "./AdtHTTP"
import { AdtExtension } from "./AdtExtensions"
import { AdtSessionProvider, AdtCookieImport } from "./AdtSession"
import {
  fromException,
  isAdtError,
  isCsrfError,
  isAdtSessionFailure,
  isAuthenticationFailure
} from "./AdtException"
import { LogData } from "./requestLogger"

type Handler = (
  options: HttpClientOptions,
  callNumber: number
) => HttpClientResponse | Promise<HttpClientResponse>

const reply = (
  status: number,
  headers: HttpClientResponse["headers"] = {},
  body = ""
): HttpClientResponse => ({
  status,
  statusText: status < 400 ? "OK" : "Error",
  headers,
  body
})

class FakeTransport implements HttpClient {
  calls: HttpClientOptions[] = []
  constructor(
    private handler: Handler,
    readonly capabilities?: HttpClient["capabilities"]
  ) {}
  async request(options: HttpClientOptions) {
    this.calls.push({ ...options, headers: { ...options.headers } })
    const response = await this.handler(options, this.calls.length)
    if (response.status < 400) return response
    throw new HttpClientException(
      `Request failed with status code ${response.status}`,
      undefined,
      response.status,
      undefined,
      options,
      response
    )
  }
  count(path: string) {
    return this.calls.filter(c => c.url === path).length
  }
}

const GRAPH = "/sap/bc/adt/compatibility/graph"
const LOGOFF = "/sap/public/bc/icf/logoff"
const cookieOf = (o: HttpClientOptions) => `${o.headers?.Cookie || ""}`
const ok = (extra: HttpClientResponse["headers"] = {}) =>
  reply(200, { "x-csrf-token": "tok", ...extra })

const provider = (
  cookies: (n: number) => AdtCookieImport | undefined,
  extra: Partial<AdtSessionProvider> = {}
) => {
  let calls = 0
  const renew = jest.fn(async (_ctx: unknown) => cookies(++calls))
  const p: AdtSessionProvider = { id: "test", renew, ...extra }
  return { p, renew }
}

const create = (
  handler: Handler,
  session?: AdtSessionProvider,
  options: ClientOptions = {},
  capabilities?: HttpClient["capabilities"]
) => {
  const transport = new FakeTransport(handler, capabilities)
  const http = new AdtHTTP(transport, "user", "", "", "", {
    ...options,
    session
  })
  return { http, transport }
}

// accepts the graph call whatever the cookie, rejects other calls carrying the old one
const expiring: Handler = o =>
  o.url !== GRAPH && cookieOf(o).includes("old") ? reply(401) : ok()

describe("external cookie login", () => {
  test("imported cookies are sent on login, without Basic auth, and survive it", async () => {
    const { p, renew } = provider(() => undefined)
    const { http, transport } = create(
      () => ok({ "set-cookie": ["SAP_SESSIONID=s1; path=/"] }),
      p
    )
    http.session.importCookies({ cookieHeader: "MYSAPSSO2=abc" })
    await http.login()
    await http.request("/sap/bc/adt/x")
    expect(renew).not.toHaveBeenCalled()
    expect(cookieOf(transport.calls[0])).toBe("MYSAPSSO2=abc")
    expect(transport.calls[0].auth).toBeUndefined()
    expect(transport.calls[0].headers?.Authorization).toBeUndefined()
    expect(cookieOf(transport.calls[1])).toBe("MYSAPSSO2=abc; SAP_SESSIONID=s1")
  })

  test("asks the provider for cookies when there are none", async () => {
    const { p, renew } = provider(() => ({ cookieHeader: "MYSAPSSO2=abc" }))
    const { http, transport } = create(() => ok(), p)
    await http.login()
    expect(renew.mock.calls[0][0]).toMatchObject({ reason: "initial-login" })
    expect(cookieOf(transport.calls[0])).toBe("MYSAPSSO2=abc")
  })

  test("fails before sending anything when the provider has no cookies", async () => {
    const { p } = provider(() => undefined)
    const { http, transport } = create(() => ok(), p)
    const error = await http.login().catch(e => e)
    expect(isAdtSessionFailure(error) && error.reason).toBe("initial-login")
    expect(isAdtSessionFailure(error) && error.requestSent).toBe(false)
    expect(transport.calls).toHaveLength(0)
  })

  test("a rejected login renews once and tries again", async () => {
    const { p, renew } = provider(() => ({ cookieHeader: "s=new" }))
    const { http, transport } = create(
      o => (cookieOf(o).includes("old") ? reply(401) : ok()),
      p
    )
    http.session.importCookies({ cookieHeader: "s=old" })
    await http.login()
    expect(renew).toHaveBeenCalledTimes(1)
    expect(renew.mock.calls[0][0]).toMatchObject({ reason: "expired" })
    expect(transport.count(GRAPH)).toBe(2)
  })

  test("a login without a CSRF token renews once and never reports logged in", async () => {
    const { p, renew } = provider(() => ({ cookieHeader: "s=new" }))
    const { http, transport } = create(() => reply(200), p)
    http.session.importCookies({ cookieHeader: "s=old" })

    const error = await http.login().catch(e => e)

    expect(isAdtSessionFailure(error) && error.reason).toBe("expired")
    expect(http.loggedin).toBe(false)
    expect(renew).toHaveBeenCalledTimes(1)
    expect(transport.count(GRAPH)).toBe(2)
  })

  test("removes an imported sap-contextid before login", async () => {
    const { p } = provider(() => undefined)
    const { http, transport } = create(() => ok(), p)
    http.session.importCookies({
      cookieHeader: "SAP-CONTEXTID=old; MYSAPSSO2=abc"
    })

    await http.login()

    expect(cookieOf(transport.calls[0])).toBe("MYSAPSSO2=abc")
  })
})

describe("logout", () => {
  test("local-only makes no request and clears the session", async () => {
    const { p } = provider(() => undefined, { logoutMode: "local-only" })
    const { http, transport } = create(() => ok(), p)
    http.session.importCookies({ cookieHeader: "a=1" })
    await http.login()
    await http.logout()
    expect(transport.count(LOGOFF)).toBe(0)
    expect(http.session.cookieHeader()).toBe("")
    expect(http.loggedin).toBe(false)
  })

  test("remote (default) calls the logoff service", async () => {
    const { p } = provider(() => undefined)
    const { http, transport } = create(() => ok(), p)
    http.session.importCookies({ cookieHeader: "a=1" })
    await http.login()
    await http.logout()
    expect(transport.count(LOGOFF)).toBe(1)
    expect(http.session.cookieHeader()).toBe("")
  })
})

describe("session renewal", () => {
  const setup = (extra: Partial<AdtSessionProvider> = {}) => {
    const { p, renew } = provider(() => ({ cookieHeader: "s=new" }), extra)
    const created = create(expiring, p)
    created.http.session.importCookies({ cookieHeader: "s=old" })
    return { ...created, renew }
  }

  test("concurrent expired requests renew once and each is replayed once", async () => {
    const { http, transport, renew } = setup()
    const results = await Promise.all([
      http.request("/a"),
      http.request("/b"),
      http.request("/c")
    ])
    expect(results.every(r => r.status === 200)).toBe(true)
    expect(renew).toHaveBeenCalledTimes(1)
    expect(renew.mock.calls[0][0]).toMatchObject({ reason: "expired" })
    for (const path of ["/a", "/b", "/c"]) expect(transport.count(path)).toBe(2)
  })

  test("stateful requests are never replayed", async () => {
    const { http, transport, renew } = setup()
    await http.login()
    http.stateful = session_types.stateful
    const error = await http.request("/a").catch(e => e)
    expect(isAdtSessionFailure(error)).toBe(true)
    expect(isAuthenticationFailure(error)).toBe(true)
    expect(renew).not.toHaveBeenCalled()
    expect(transport.count("/a")).toBe(1)
  })

  test("unsafe methods are not replayed unless canRetry says so", async () => {
    const { http, transport, renew } = setup()
    const error = await http.request("/a", { method: "POST" }).catch(e => e)
    expect(isAdtSessionFailure(error)).toBe(true)
    expect(renew).not.toHaveBeenCalled()
    expect(transport.count("/a")).toBe(1)

    const allowed = setup({ canRetry: () => true })
    const res = await allowed.http.request("/a", { method: "POST" })
    expect(res.status).toBe(200)
    expect(allowed.transport.count("/a")).toBe(2)
  })

  test("canRetry can veto a read", async () => {
    const { http, transport } = setup({ canRetry: () => false })
    const error = await http.request("/a").catch(e => e)
    expect(isAdtSessionFailure(error)).toBe(true)
    expect(transport.count("/a")).toBe(1)
  })

  test("a refused renewal does not loop", async () => {
    const { p, renew } = provider(() => undefined)
    const { http, transport } = create(expiring, p)
    http.session.importCookies({ cookieHeader: "s=old" })
    const error = await http.request("/a").catch(e => e)
    expect(isAdtSessionFailure(error)).toBe(true)
    expect(renew).toHaveBeenCalledTimes(1)
    expect(transport.count("/a")).toBe(1)
  })

  test("an unchanged renewal does not loop", async () => {
    const { p, renew } = provider(() => ({ cookieHeader: "s=old" }))
    const { http, transport } = create(expiring, p)
    http.session.importCookies({ cookieHeader: "s=old" })
    const error = await http.request("/a").catch(e => e)
    expect(isAdtSessionFailure(error)).toBe(true)
    expect(renew).toHaveBeenCalledTimes(1)
    expect(transport.count("/a")).toBe(1)
  })

  test("a replay that fails again is reported, not retried", async () => {
    const { p, renew } = provider(() => ({ cookieHeader: "s=new" }))
    const { http, transport } = create(
      o => (o.url === GRAPH ? ok() : reply(401)),
      p
    )
    http.session.importCookies({ cookieHeader: "s=old" })
    const error = await http.request("/a").catch(e => e)
    expect(isAdtSessionFailure(error)).toBe(true)
    expect(renew).toHaveBeenCalledTimes(1)
    expect(transport.count("/a")).toBe(2)
  })

  test("a CSRF failure resets the token and replays even without new cookies", async () => {
    const { p, renew } = provider(() => undefined)
    let first = true
    const { http, transport } = create(o => {
      if (o.url === "/a" && first) {
        first = false
        return reply(403, { "x-csrf-token": "Required" })
      }
      return ok()
    }, p)
    http.session.importCookies({ cookieHeader: "s=1" })
    const res = await http.request("/a")
    expect(res.status).toBe(200)
    expect(renew.mock.calls[0][0]).toMatchObject({ reason: "csrf" })
    expect(transport.count(GRAPH)).toBe(2)
  })

  test("renewal resets statefulness and drops sap-contextid before the next login", async () => {
    const { p } = provider(() => ({
      cookieHeader: "sap-contextid=old; MYSAPSSO2=new",
      replace: true
    }))
    const { http, transport } = create(() => ok(), p)
    http.session.importCookies({
      cookieHeader: "SAP-CONTEXTID=old; MYSAPSSO2=old"
    })
    http.stateful = session_types.stateful

    await http.renewSession("expired")
    await http.login()

    expect(http.stateful).toBe(session_types.stateless)
    expect(cookieOf(transport.calls[0])).toBe("MYSAPSSO2=new")
  })

  test("a Session timed out status text triggers provider recovery", async () => {
    const { p, renew } = provider(() => ({ cookieHeader: "s=new" }))
    let failed = false
    const { http, transport } = create(o => {
      if (o.url === "/a" && !failed) {
        failed = true
        return { ...reply(400), statusText: "Session timed out" }
      }
      return ok()
    }, p)
    http.session.importCookies({ cookieHeader: "s=old" })

    const response = await http.request("/a")

    expect(response.status).toBe(200)
    expect(renew).toHaveBeenCalledTimes(1)
    expect(transport.count("/a")).toBe(2)
    expect(transport.count(GRAPH)).toBe(2)
  })

  test("an unrelated 400 status text does not trigger provider recovery", async () => {
    const { p, renew } = provider(() => ({ cookieHeader: "s=new" }))
    const { http } = create(
      () => ({ ...reply(400), statusText: "Invalid input" }),
      p
    )
    http.session.importCookies({ cookieHeader: "s=old" })

    const error = await http.request("/a").catch(e => e)

    expect(isAdtError(error) && error.err).toBe(400)
    expect(renew).not.toHaveBeenCalled()
  })
})

describe("external session HTTP errors", () => {
  test.each([400, 401])(
    "stores cookies from a %d response and notifies the provider",
    async status => {
      const onCookiesChanged = jest.fn()
      const { p } = provider(() => undefined, { onCookiesChanged })
      const { http } = create(
        () => reply(status, { "set-cookie": ["SAP_SESSIONID=rotated; path=/"] }),
        p
      )
      http.session.importCookies({ cookieHeader: "MYSAPSSO2=abc" })

      await http.request("/a").catch(() => undefined)

      expect(http.session.cookieHeader()).toBe(
        "MYSAPSSO2=abc; SAP_SESSIONID=rotated"
      )
      expect(onCookiesChanged).toHaveBeenCalledWith(
        "MYSAPSSO2=abc; SAP_SESSIONID=rotated"
      )
    }
  )

  test("removes expired cookies from error responses", async () => {
    const onCookiesChanged = jest.fn()
    const { p } = provider(() => undefined, { onCookiesChanged })
    const { http } = create(
      () =>
        reply(500, {
          "set-cookie": ["SAP_SESSIONID=; Max-Age=0; path=/"]
        }),
      p
    )
    http.session.importCookies({
      cookieHeader: "MYSAPSSO2=abc; SAP_SESSIONID=old"
    })

    await http.request("/a").catch(() => undefined)

    expect(http.session.cookieHeader()).toBe("MYSAPSSO2=abc")
    expect(onCookiesChanged).toHaveBeenCalledWith("MYSAPSSO2=abc")
  })
})

describe("CSRF response classification", () => {
  const responseError = (statusText: string) =>
    new HttpClientException(
      "Request failed",
      undefined,
      400,
      undefined,
      { url: "" },
      { ...reply(400), statusText }
    )

  test("classifies an empty 400 body with a session timeout status text", () => {
    expect(isCsrfError(fromException(responseError("Session timed out")))).toBe(
      true
    )
  })

  test("keeps unrelated empty 400 status text as an HTTP error", () => {
    expect(isCsrfError(fromException(responseError("Invalid input")))).toBe(
      false
    )
  })
})

describe("secrets", () => {
  test.each([401, 500])(
    "cookie values do not reach debug callbacks or thrown errors (%d)",
    async status => {
      const logs: LogData[] = []
      const { p } = provider(() => undefined)
      const { http } = create(
        () =>
          reply(status, { "set-cookie": ["SRV=supersecretserver; path=/"] }),
        p,
        { debugCallback: l => logs.push(l) }
      )
      http.session.importCookies({
        cookieHeader: "MYSAPSSO2=supersecretclient"
      })
      http.csrfToken = "tok"
      const error = await http.request("/a").catch(e => e)
      const dump = inspect([error, logs], { depth: 12 })
      expect(logs.length).toBeGreaterThan(0)
      expect(dump).not.toContain("supersecretclient")
      expect(dump).not.toContain("supersecretserver")
    }
  )
})

describe("transport capabilities", () => {
  const noCookies = { headers: true, cookies: false, statusCodes: true }

  test("external sessions are rejected up front when cookies are unsupported", () => {
    const transport = new FakeTransport(() => ok(), noCookies)
    const { p } = provider(() => undefined)
    expect(
      () => new AdtHTTP(transport, "user", "", "", "", { session: p })
    ).toThrow(/cookie/i)
    expect(transport.calls).toHaveLength(0)
  })

  test("Basic clients are not affected", async () => {
    const { http } = create(() => ok(), undefined, {}, noCookies)
    expect((await http.request("/a")).status).toBe(200)
  })
})

describe("extensions", () => {
  const withClient = (
    extensions: AdtExtension[],
    handler: Handler = () => ok()
  ) => {
    const transport = new FakeTransport(handler)
    const http = new AdtHTTP(transport, "user", "pw", "", "", { extensions })
    return { http, transport }
  }

  test("run in registration order and can add headers", async () => {
    const log: string[] = []
    const ext = (id: string): AdtExtension => ({
      id,
      handle: async (ctx, next) => {
        log.push(id)
        return next({
          ...ctx.request,
          headers: { ...ctx.request.headers, [`x-${id}`]: id }
        })
      }
    })
    const { http, transport } = withClient([ext("a"), ext("b")])
    await http.request("/x")
    expect(log.slice(-2)).toEqual(["a", "b"])
    expect(transport.calls.at(-1)?.headers).toMatchObject({
      "x-a": "a",
      "x-b": "b"
    })
  })

  test("never see credentials or cookies", async () => {
    const seen: Record<string, string>[] = []
    const spy: AdtExtension = {
      id: "spy",
      handle: (ctx, next) => (seen.push({ ...ctx.request.headers }), next())
    }
    const { http, transport } = withClient([spy])
    await http.login()
    http.session.importCookies({ cookieHeader: "a=1" })
    await http.request("/x")
    expect(seen.length).toBeGreaterThan(0)
    seen.forEach(h => {
      expect(Object.keys(h).map(k => k.toLowerCase())).not.toContain("cookie")
      expect(Object.keys(h).map(k => k.toLowerCase())).not.toContain(
        "authorization"
      )
    })
    expect(transport.calls.at(-1)?.auth).toEqual({
      username: "user",
      password: "pw"
    })
    expect(cookieOf(transport.calls.at(-1)!)).toBe("a=1")
  })

  test("are told about attempts and login requests", async () => {
    const contexts: { isLogin: boolean; attempt: number }[] = []
    const spy: AdtExtension = {
      id: "spy",
      handle: (ctx, next) => (
        contexts.push({ isLogin: ctx.isLogin, attempt: ctx.attempt }),
        next()
      )
    }
    const { http } = withClient([spy])
    await http.request("/x")
    expect(contexts).toEqual([
      { isLogin: true, attempt: 1 },
      { isLogin: false, attempt: 1 }
    ])
  })

  test("duplicate ids fail at construction", () => {
    const e: AdtExtension = { id: "dup", handle: (_c, n) => n() }
    expect(() => withClient([e, e])).toThrow(/dup/)
  })
})

describe("compatibility", () => {
  test("Basic clients still replay any method after a 401", async () => {
    let posts = 0
    const transport = new FakeTransport(o =>
      o.method === "POST" && ++posts === 1 ? reply(401) : ok()
    )
    const http = new AdtHTTP(transport, "user", "pw", "", "")
    await http.login()
    const res = await http.request("/a", { method: "POST" })
    expect(res.status).toBe(200)
    expect(transport.count("/a")).toBe(2)
    expect(transport.count(GRAPH)).toBe(2)
  })

  test.each([404, 500])(
    "errors keep the response status %d and body",
    async status => {
      const body = `<exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><type id="Foo"/><message lang="EN">oops</message></exc:exception>`
      const transport = new FakeTransport(o =>
        o.url === GRAPH ? ok() : reply(status, {}, body)
      )
      const http = new AdtHTTP(transport, "user", "pw", "", "")
      const error = await http.request("/a").catch(e => e)
      expect(isAdtError(error) && error.err).toBe(status)
      expect(isAdtError(error) && error.message).toBe("oops")
    }
  )
})
