import http, { Agent, IncomingMessage, ServerResponse } from "http"
import https from "https"
import { AddressInfo } from "net"
import { Effect, Layer } from "effect"
import { HttpClient as EffectHttp } from "effect/http"
import { HttpAgent, makeNodeHttp } from "@effect/platform-node/NodeHttpClient"
import { ADTClient, AdtEffect, isAdtError } from "."

const GRAPH = "/sap/bc/adt/compatibility/graph"
const ADT_ERROR = `<exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><type id="Boom"/><message lang="EN">exploded</message></exc:exception>`

let seen: string[] = []
let server: http.Server
let baseURL: string

const route = (req: IncomingMessage, res: ServerResponse) => {
  const path = (req.url || "").split("?")[0]
  seen.push(path)
  if (path === GRAPH) {
    res.setHeader("x-csrf-token", "tok")
    res.setHeader("set-cookie", ["SAP_SESSIONID=s1; path=/"])
    return res.writeHead(200).end("graph")
  }
  if (path === "/boom") return res.writeHead(500).end(ADT_ERROR)
  res.writeHead(200).end("ok")
}

// no keep alive, so no sockets outlive the tests
const httpClientLayer = Layer.effect(EffectHttp.HttpClient, makeNodeHttp).pipe(
  Layer.provide(
    Layer.succeed(HttpAgent, { http: new Agent(), https: new https.Agent() })
  )
)

beforeAll(async () => {
  server = http.createServer(route)
  await new Promise<void>(r => server.listen(0, "127.0.0.1", r))
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => new Promise(r => server.close(r)))
beforeEach(() => (seen = []))

const clientLayer = () =>
  AdtEffect.layer({ url: baseURL, username: "user", password: "pass" }).pipe(
    Layer.provide(httpClientLayer)
  )

describe("effect surface", () => {
  test("runs requests through the client service and logs out on release", async () => {
    const program = Effect.gen(function* () {
      const adt = yield* AdtEffect.AdtClientService
      const response = yield* adt.request("/sap/bc/adt/ping")
      return response.body
    })
    const body = await Effect.runPromise(Effect.provide(program, clientLayer()))
    expect(body).toBe("ok")
    expect(seen).toContain("/sap/bc/adt/ping")
    expect(seen[seen.length - 1]).toBe("/sap/public/bc/icf/logoff")
  })

  test("fails with tagged errors that carry the original exception", async () => {
    const program = Effect.gen(function* () {
      const adt = yield* AdtEffect.AdtClientService
      return yield* adt.request("/boom")
    }).pipe(
      Effect.catchTag("AdtServerError", e =>
        Effect.succeed(`${e.message} ${isAdtError(e.cause)}`)
      )
    )
    const result = await Effect.runPromise(Effect.provide(program, clientLayer()))
    expect(result).toBe("exploded true")
  })

  test("maps transport failures to AdtHttpError", async () => {
    const closed = http.createServer()
    await new Promise<void>(r => closed.listen(0, "127.0.0.1", r))
    const port = (closed.address() as AddressInfo).port
    await new Promise(r => closed.close(r))
    const program = Effect.gen(function* () {
      const adt = yield* AdtEffect.AdtClientService
      return yield* adt.request("/")
    }).pipe(Effect.flip)
    const layer = AdtEffect.layer({
      url: `http://127.0.0.1:${port}`,
      username: "user",
      password: "pass"
    }).pipe(Layer.provide(httpClientLayer))
    const error = await Effect.runPromise(Effect.provide(program, layer))
    expect(error._tag).toBe("AdtHttpError")
  })

  test("wraps the promise methods of an existing client", async () => {
    const client = new ADTClient(baseURL, "user", "pass")
    const fake = jest.spyOn(client, "transportDelete").mockResolvedValue(undefined)
    const program = Effect.gen(function* () {
      const adt = yield* AdtEffect.AdtClientService
      yield* adt.transportDelete("K900001")
      return adt.client
    })
    const effect = Effect.provide(program, AdtEffect.fromClient(client))
    expect(fake).not.toHaveBeenCalled()
    expect(await Effect.runPromise(effect)).toBe(client)
    expect(fake).toHaveBeenCalledWith("K900001")
  })

  test("maps rejections of wrapped methods to tagged errors", async () => {
    const client = new ADTClient(baseURL, "user", "pass")
    jest.spyOn(client, "transportDelete").mockRejectedValue(new Error("nope"))
    const error = await Effect.runPromise(
      Effect.flip(AdtEffect.effectify(client).transportDelete("K900001"))
    )
    expect(error).toBeInstanceOf(AdtEffect.AdtServerError)
    expect(error.message).toBe("nope")
  })
})
