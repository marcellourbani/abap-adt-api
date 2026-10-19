import {
  ADTClient,
  type CookieSessionClient,
  createCookieSessionOptions,
  session_types
} from "."
import {
  HttpClientException,
  type HttpClient,
  type HttpClientOptions,
  type HttpClientResponse
} from "./AdtHTTP"

const GRAPH = "/sap/bc/adt/compatibility/graph"

const response = (
  status = 200,
  headers: HttpClientResponse["headers"] = {}
) => ({
  status,
  statusText: status < 400 ? "OK" : "Error",
  headers,
  body: ""
})

type Handler = (
  options: Readonly<HttpClientOptions>,
  callNumber: number
) => HttpClientResponse

class FakeTransport implements HttpClient {
  readonly calls: HttpClientOptions[] = []

  constructor(
    private readonly handler: Handler = options =>
      response(200, options.url === GRAPH ? { "x-csrf-token": "token" } : {})
  ) {}

  async request(options: Readonly<HttpClientOptions>) {
    this.calls.push({ ...options, headers: { ...options.headers } })
    const result = this.handler(options, this.calls.length)
    if (result.status < 400) return result
    throw new HttpClientException(
      `Request failed with status code ${result.status}`,
      undefined,
      result.status,
      undefined,
      options as HttpClientOptions,
      result
    )
  }
}
test("loads saved cookies for the initial external login", async () => {
  const transport = new FakeTransport()
  const acquireCookies = jest.fn(async () => undefined)
  const options = createCookieSessionOptions({
    id: "test",
    loadCookies: async () => "MYSAPSSO2=saved",
    acquireCookies
  })
  const client = new ADTClient(transport, "user", "", "", "", options)

  await client.login()

  expect(transport.calls[0].headers?.Cookie).toBe("MYSAPSSO2=saved")
  expect(acquireCookies).not.toHaveBeenCalled()
})

test("acquires fresh cookies when the saved cookie is rejected at login", async () => {
  const transport = new FakeTransport(options =>
    options.headers?.Cookie === "MYSAPSSO2=saved"
      ? response(401)
      : response(200, { "x-csrf-token": "token" })
  )
  const acquireCookies = jest.fn(async () => "MYSAPSSO2=fresh")
  const options = createCookieSessionOptions({
    id: "test",
    loadCookies: async () => "MYSAPSSO2=saved",
    acquireCookies
  })
  const client = new ADTClient(transport, "user", "", "", "", options)

  await client.login()

  expect(transport.calls.map(call => call.headers?.Cookie)).toEqual([
    "MYSAPSSO2=saved",
    "MYSAPSSO2=fresh"
  ])
  expect(acquireCookies).toHaveBeenCalledWith({
    reason: "expired",
    error: expect.anything()
  })
})

test("probes saved cookies on expiry and persists cookies rotated by the probe", async () => {
  let loginRequests = 0
  let resourceRequests = 0
  const transport = new FakeTransport(options => {
    if (options.url === "/sap/bc/adt/compatibility/graph") {
      loginRequests++
      return response(
        200,
        loginRequests === 2
          ? {
              "x-csrf-token": "token",
              "set-cookie": ["SAP_SESSIONID=rotated; path=/"]
            }
          : { "x-csrf-token": "token" }
      )
    }
    if (
      options.url === "/sap/bc/adt/security/reentranceticket" &&
      resourceRequests++ === 0
    )
      return response(401)
    return response(200)
  })
  const acquireCookies = jest.fn(async () => "MYSAPSSO2=fresh")
  const onCookiesChanged = jest.fn(async () => undefined)
  const options = createCookieSessionOptions({
    id: "test",
    loadCookies: async () => "MYSAPSSO2=saved",
    acquireCookies,
    onCookiesChanged
  })
  const client = new ADTClient(transport, "user", "", "", "", options)

  await client.reentranceTicket()

  expect(acquireCookies).not.toHaveBeenCalled()
  expect(onCookiesChanged).toHaveBeenCalledWith(
    "MYSAPSSO2=saved; SAP_SESSIONID=rotated"
  )
  expect(
    transport.calls.filter(
      call => call.url === "/sap/bc/adt/security/reentranceticket"
    )
  ).toHaveLength(2)
})

test("persists cookies rotated by ordinary ADT responses", async () => {
  const onCookiesChanged = jest.fn(async () => undefined)
  const options = createCookieSessionOptions({
    id: "test",
    loadCookies: async () => "MYSAPSSO2=saved",
    acquireCookies: async () => undefined,
    onCookiesChanged
  })
  const client = new ADTClient(
    new FakeTransport(() =>
      response(200, {
        "x-csrf-token": "token",
        "set-cookie": ["SAP_SESSIONID=rotated; path=/"]
      })
    ),
    "user",
    "",
    "",
    "",
    options
  )

  await client.login()

  expect(onCookiesChanged).toHaveBeenCalledWith(
    "MYSAPSSO2=saved; SAP_SESSIONID=rotated"
  )
})

test("acquires fresh cookies when an expiry probe rejects saved cookies", async () => {
  let loginRequests = 0
  let resourceRequests = 0
  const transport = new FakeTransport(options => {
    if (options.url === "/sap/bc/adt/compatibility/graph") {
      loginRequests++
      return loginRequests === 2
        ? response(401)
        : response(200, { "x-csrf-token": "token" })
    }
    if (
      options.url === "/sap/bc/adt/security/reentranceticket" &&
      resourceRequests++ === 0
    )
      return response(401)
    return response()
  })
  const acquireCookies = jest.fn(async () => "MYSAPSSO2=fresh")
  const client = new ADTClient(
    transport,
    "user",
    "",
    "",
    "",
    createCookieSessionOptions({
      id: "test",
      loadCookies: async () => "MYSAPSSO2=saved",
      acquireCookies
    })
  )

  await client.reentranceTicket()

  expect(acquireCookies).toHaveBeenCalledWith({
    reason: "expired",
    error: expect.anything()
  })
  expect(resourceRequests).toBe(2)
})

test("propagates cookie-acquisition cancellation without sending a request", async () => {
  const cancellation = new Error("capture cancelled")
  const transport = new FakeTransport()
  const client = new ADTClient(
    transport,
    "user",
    "",
    "",
    "",
    createCookieSessionOptions({
      id: "test",
      loadCookies: async () => undefined,
      acquireCookies: async () => {
        throw cancellation
      }
    })
  )

  await expect(client.login()).rejects.toBe(cancellation)
  expect(transport.calls).toHaveLength(0)
})

test("reports stateful session loss without replaying the request", async () => {
  const onStatefulSessionLost = jest.fn(
    async ({ client }: { client: CookieSessionClient }) => {
      client.stateful = session_types.stateless
    }
  )
  const transport = new FakeTransport(options =>
    options.url === "/sap/bc/adt/security/reentranceticket"
      ? response(401)
      : response(200, { "x-csrf-token": "token" })
  )
  const client = new ADTClient(
    transport,
    "user",
    "",
    "",
    "",
    createCookieSessionOptions({
      id: "test",
      loadCookies: async () => "MYSAPSSO2=saved",
      acquireCookies: async () => "MYSAPSSO2=fresh",
      onStatefulSessionLost
    })
  )
  await client.login()
  client.stateful = session_types.stateful

  await expect(client.reentranceTicket()).rejects.toMatchObject({
    reason: "expired",
    requestSent: true
  })

  expect(onStatefulSessionLost).toHaveBeenCalledTimes(1)
  expect(client.isStateful).toBe(false)
  expect(
    transport.calls.filter(
      call => call.url === "/sap/bc/adt/security/reentranceticket"
    )
  ).toHaveLength(1)
})

test("a replacement after stateful loss drops the old context before the next login", async () => {
  const graph = "/sap/bc/adt/compatibility/graph"
  const ticket = "/sap/bc/adt/security/reentranceticket"
  const transport = new FakeTransport(options =>
    options.url === ticket
      ? response(401)
      : response(200, { "x-csrf-token": "token" })
  )
  const client = new ADTClient(
    transport,
    "user",
    "",
    "",
    "",
    createCookieSessionOptions({
      id: "test",
      loadCookies: async () =>
        "sap-contextid=old; MYSAPSSO2=saved",
      acquireCookies: async () => undefined
    })
  )
  await client.login()
  client.stateful = session_types.stateful

  await expect(client.reentranceTicket()).rejects.toMatchObject({
    reason: "expired",
    requestSent: true
  })

  expect(client.isStateful).toBe(false)
  await client.login()

  const loginCalls = transport.calls.filter(call => call.url === graph)
  expect(loginCalls).toHaveLength(3)
  loginCalls.forEach(call =>
    expect(call.headers?.Cookie).toBe("MYSAPSSO2=saved")
  )
})

test("external-cookie logout is local-only", async () => {
  const transport = new FakeTransport()
  const client = new ADTClient(
    transport,
    "user",
    "",
    "",
    "",
    createCookieSessionOptions({
      id: "test",
      loadCookies: async () => "MYSAPSSO2=saved",
      acquireCookies: async () => undefined
    })
  )

  await client.login()
  await client.logout()

  expect(
    transport.calls.some(call => call.url === "/sap/public/bc/icf/logoff")
  ).toBe(false)
  expect(client.session.cookieHeader()).toBe("")
})

test("an aborted acquisition signal is propagated before making requests", async () => {
  const cancellation = new Error("capture cancelled")
  let signal: AbortSignal | undefined
  const transport = new FakeTransport()
  const acquireCookies = jest.fn(async () => undefined)
  const client = new ADTClient(
    transport,
    "user",
    "",
    "",
    "",
    createCookieSessionOptions({
      id: "test",
      loadCookies: async () => undefined,
      acquireCookies,
      signal: () => signal
    })
  )
  const controller = new AbortController()
  controller.abort(cancellation)
  signal = controller.signal

  await expect(client.login()).rejects.toBe(cancellation)
  expect(acquireCookies).not.toHaveBeenCalled()
  expect(transport.calls).toHaveLength(0)
})

test("coalesces acquisition across clients with the same session id", async () => {
  let startAcquisition!: () => void
  let finishAcquisition!: (cookies: string) => void
  const acquisitionStarted = new Promise<void>(
    resolve => (startAcquisition = resolve)
  )
  const acquisition = new Promise<string>(
    resolve => (finishAcquisition = resolve)
  )
  const firstAcquire = jest.fn(async () => {
    startAcquisition()
    return acquisition
  })
  const secondAcquire = jest.fn(async () => "MYSAPSSO2=second")
  const createClient = (acquireCookies: typeof firstAcquire) =>
    new ADTClient(
      new FakeTransport(),
      "user",
      "",
      "",
      "",
      createCookieSessionOptions({
        id: "shared-session",
        loadCookies: async () => undefined,
        acquireCookies
      })
    )
  const first = createClient(firstAcquire)
  const second = createClient(secondAcquire)

  const firstLogin = first.login()
  await acquisitionStarted
  const secondLogin = second.login()
  finishAcquisition("MYSAPSSO2=shared")
  await Promise.all([firstLogin, secondLogin])

  expect(firstAcquire).toHaveBeenCalledTimes(1)
  expect(secondAcquire).not.toHaveBeenCalled()
  expect(first.session.cookieHeader()).toBe("MYSAPSSO2=shared")
  expect(second.session.cookieHeader()).toBe("MYSAPSSO2=shared")
})
