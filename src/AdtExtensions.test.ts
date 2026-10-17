import { AdtHTTP } from "./AdtHTTP"
import {
  AdtExtension,
  AdtRequest,
  AdtRequestContext,
  AdtResponse,
  composeExtensions,
  createAdtRequest,
  withRequest
} from "./AdtExtensions"

const client = {} as AdtHTTP
const baseRequest = () =>
  createAdtRequest({
    url: "/a",
    method: "GET",
    headers: { Accept: "*/*", "x-csrf-token": "fetch" },
    session: "stateless" as any,
    requestNumber: 1
  })
const context = (request: AdtRequest): AdtRequestContext => ({
  client,
  request,
  attempt: 1,
  isLogin: false,
  isStateful: false
})
const ok = (body = ""): AdtResponse => ({
  body,
  status: 200,
  statusText: "OK",
  headers: {}
})

describe("withRequest", () => {
  test("returns a patched copy and leaves the original untouched", () => {
    const original = baseRequest()
    const patched = withRequest(original, { url: "/b", body: "x" })
    expect(patched.url).toBe("/b")
    expect(patched.body).toBe("x")
    expect(original.url).toBe("/a")
    expect(original.body).toBeUndefined()
  })

  test("requests, headers and query are frozen", () => {
    const request = withRequest(baseRequest(), { query: { a: 1 } })
    expect(() => ((request as any).url = "x")).toThrow(TypeError)
    expect(() => ((request.headers as any).Accept = "x")).toThrow(TypeError)
    expect(() => ((request.query as any).a = 2)).toThrow(TypeError)
  })

  test("headers merge case-insensitively and undefined deletes", () => {
    const request = withRequest(baseRequest(), {
      headers: { accept: "text/plain", "X-CSRF-Token": undefined, "x-new": "1" }
    })
    expect(request.headers).toEqual({ accept: "text/plain", "x-new": "1" })
  })

  test("undefined patch fields keep the current value", () => {
    const request = withRequest(baseRequest(), { url: undefined })
    expect(request.url).toBe("/a")
  })
})

describe("composeExtensions", () => {
  const tag = (id: string, log: string[]): AdtExtension => ({
    id,
    async handle(ctx, next) {
      log.push(`${id}>`)
      const res = await next(
        withRequest(ctx.request, { headers: { [`x-${id}`]: "1" } })
      )
      log.push(`<${id}`)
      return res
    }
  })

  test("first registered sees the request first and the response last", async () => {
    const log: string[] = []
    const seen: AdtRequest[] = []
    const run = composeExtensions([tag("a", log), tag("b", log)], async r => {
      seen.push(r)
      return ok()
    })
    await run(context(baseRequest()))
    expect(log).toEqual(["a>", "b>", "<b", "<a"])
    expect(seen[0].headers).toMatchObject({ "x-a": "1", "x-b": "1" })
  })

  test("next without arguments forwards the current request", async () => {
    const run = composeExtensions(
      [{ id: "p", handle: (_c, next) => next() }],
      async r => ok(r.url)
    )
    expect((await run(context(baseRequest()))).body).toBe("/a")
  })

  test("an extension can retry by calling next twice", async () => {
    let calls = 0
    const retry: AdtExtension = {
      id: "retry",
      async handle(_c, next) {
        const first = await next()
        return first.status === 200 ? first : next()
      }
    }
    const run = composeExtensions([retry], async () =>
      ++calls === 1 ? { ...ok(), status: 503 } : ok()
    )
    expect((await run(context(baseRequest()))).status).toBe(200)
    expect(calls).toBe(2)
  })

  test("extensions can translate errors", async () => {
    const translate: AdtExtension = {
      id: "t",
      handle: async (_c, next) => next().catch(() => ok("recovered"))
    }
    const run = composeExtensions([translate], async () => {
      throw new Error("boom")
    })
    expect((await run(context(baseRequest()))).body).toBe("recovered")
  })

  test("duplicate ids are rejected at construction", () => {
    const e: AdtExtension = { id: "same", handle: (_c, n) => n() }
    expect(() => composeExtensions([e, e], async () => ok())).toThrow(/same/)
  })
})
