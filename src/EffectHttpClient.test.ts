import http, { Agent, IncomingMessage, ServerResponse } from "http"
import https from "https"
import { AddressInfo } from "net"
import { Effect, Layer } from "effect"
import { FetchHttpClient, HttpBody, HttpClient as EffectHttp } from "effect/http"
import { HttpAgent, makeNodeHttp } from "@effect/platform-node/NodeHttpClient"
import {
  buildUrl,
  EffectHttpClient,
  formatQuery,
  toEffectRequest
} from "./EffectHttpClient"
import { HttpClientException } from "./AdtHTTP"

interface Seen {
  method: string
  url: string
  headers: http.IncomingHttpHeaders
  body: string
}

let seen: Seen[] = []
let server: http.Server
let baseURL: string

const route = (req: IncomingMessage, res: ServerResponse) => {
  let body = ""
  req.on("data", c => (body += c))
  req.on("end", () => {
    seen.push({ method: req.method || "", url: req.url || "", headers: req.headers, body })
    const path = (req.url || "").split("?")[0]
    if (path === "/cookies") {
      res.setHeader("set-cookie", ["A=1; path=/", "B=2; path=/; HttpOnly"])
      return res.writeHead(200).end("ok")
    }
    if (path === "/timedout") return res.writeHead(400, "Session timed out").end("")
    if (path === "/redirect") return res.writeHead(302, { location: "/target" }).end()
    if (path === "/target") return res.writeHead(200).end("arrived")
    if (path === "/slow") return setTimeout(() => res.writeHead(200).end("late"), 500)
    if (path === "/json") return res.writeHead(200).end(`{ "a" :  1 }`)
    res.writeHead(200).end("echo")
  })
}

// a fresh agent without keep alive, so no sockets outlive the tests
const testClient = Effect.runSync(
  Effect.provide(
    Effect.map(makeNodeHttp, EffectHttp.followRedirects(21)),
    Layer.succeed(HttpAgent, { http: new Agent(), https: new https.Agent() })
  )
)
const create = (config = {}) => new EffectHttpClient(baseURL, config, testClient)

beforeAll(async () => {
  server = http.createServer(route)
  await new Promise<void>(r => server.listen(0, "127.0.0.1", r))
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => new Promise(r => server.close(r)))
beforeEach(() => (seen = []))

describe("query strings", () => {
  test("encode like the former axios transport", () => {
    expect(formatQuery({ a: "x y", b: "1:2,$3", c: undefined, d: null, e: ["p", "q"] })).toBe(
      "a=x+y&b=1:2,$3&e%5B%5D=p&e%5B%5D=q"
    )
  })
  test("are appended to urls with an existing query and joined to the base url", () => {
    expect(buildUrl("http://h/", "/p?x=1", { y: 2 })).toBe("http://h/p?x=1&y=2")
    expect(buildUrl("http://h", "https://o/q")).toBe("https://o/q")
  })
})

describe("requests", () => {
  test("default the content type of bodies to form urlencoded", () => {
    const contentType = (body: HttpBody.HttpBody) =>
      body._tag === "Uint8Array" ? body.contentType : undefined
    const post = toEffectRequest("http://h", { url: "/p", method: "POST", body: "x" })
    expect(contentType(post.body)).toBe("application/x-www-form-urlencoded")
    const put = toEffectRequest("http://h", {
      url: "/p",
      method: "PUT",
      body: "x",
      headers: { "Content-Type": "text/plain" }
    })
    expect(contentType(put.body)).toBe("text/plain")
  })

  test("send method, body, basic auth and no tracing headers", async () => {
    const response = await create().request({
      url: "/echo",
      method: "POST",
      body: "<a/>",
      qs: { q: "a b" },
      auth: { username: "usér", password: "päss" },
      headers: { Accept: "*/*" }
    })
    expect(response.status).toBe(200)
    expect(response.body).toBe("echo")
    const [req] = seen
    expect(req.method).toBe("POST")
    expect(req.url).toBe("/echo?q=a+b")
    expect(req.body).toBe("<a/>")
    expect(req.headers["content-type"]).toBe("application/x-www-form-urlencoded")
    expect(req.headers.authorization).toBe(
      `Basic ${Buffer.from("usér:päss", "utf8").toString("base64")}`
    )
    expect(req.headers.traceparent).toBeUndefined()
    expect(req.headers.b3).toBeUndefined()
  })
})

describe("responses", () => {
  test("keep every set-cookie header", async () => {
    const response = await create().request({ url: "/cookies" })
    expect(response.headers["set-cookie"]).toEqual([
      "A=1; path=/",
      "B=2; path=/; HttpOnly"
    ])
  })

  test("fail on error status with the response and the reason phrase the server sent", async () => {
    const error = await create().request({ url: "/timedout" }).catch(e => e)
    expect(error).toBeInstanceOf(HttpClientException)
    expect(error.status).toBe(400)
    expect(error.code).toBe("ERR_BAD_REQUEST")
    expect(error.response.statusText).toBe("Session timed out")
  })

  test("follow redirects", async () => {
    const response = await create().request({ url: "/redirect" })
    expect(response.body).toBe("arrived")
  })

  test("return the body as sent", async () => {
    const response = await create().request({ url: "/json" })
    expect(response.body).toBe(`{ "a" :  1 }`)
  })
})

describe("failures", () => {
  test("time out with ECONNABORTED", async () => {
    const error = await create({ timeout: 50 }).request({ url: "/slow" }).catch(e => e)
    expect(error).toBeInstanceOf(HttpClientException)
    expect(error.code).toBe("ECONNABORTED")
    expect(error.message).toBe("timeout of 50ms exceeded")
    expect(error.status).toBeUndefined()
  })

  test("keep the node error code of connection failures", async () => {
    const closed = http.createServer()
    await new Promise<void>(r => closed.listen(0, "127.0.0.1", r))
    const port = (closed.address() as AddressInfo).port
    await new Promise(r => closed.close(r))
    const client = new EffectHttpClient(`http://127.0.0.1:${port}`, {}, testClient)
    const error = await client.request({ url: "/" }).catch(e => e)
    expect(error).toBeInstanceOf(HttpClientException)
    expect(error.code).toBe("ECONNREFUSED")
    expect(error.status).toBeUndefined()
  })
})

describe("custom effect clients", () => {
  test("run on the fetch client", async () => {
    const fetchClient = Effect.runSync(
      Effect.provide(
        Effect.gen(function* () {
          return yield* EffectHttp.HttpClient
        }),
        FetchHttpClient.layer
      )
    )
    const response = await new EffectHttpClient(baseURL, {}, fetchClient).request({
      url: "/cookies"
    })
    expect(response.status).toBe(200)
    expect(response.headers["set-cookie"]).toEqual([
      "A=1; path=/",
      "B=2; path=/; HttpOnly"
    ])
  })
})
