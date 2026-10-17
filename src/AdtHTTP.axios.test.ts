import http, { IncomingMessage, ServerResponse } from "http"
import { AddressInfo } from "net"
import { AdtHTTP } from "./AdtHTTP"
import { AdtSessionProvider } from "./AdtSession"
import { isAdtError, isAdtSessionFailure } from "./AdtException"

interface Seen {
  url: string
  cookie: string
}

const GRAPH = "/sap/bc/adt/compatibility/graph"
const ADT_ERROR = `<exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework"><type id="Boom"/><message lang="EN">exploded</message></exc:exception>`

let seen: Seen[] = []
let server: http.Server
let baseURL: string

const route = (req: IncomingMessage, res: ServerResponse) => {
  const cookie = req.headers.cookie || ""
  seen.push({ url: req.url || "", cookie })
  const path = (req.url || "").split("?")[0]
  if (path === GRAPH) {
    res.setHeader("x-csrf-token", "tok")
    res.setHeader("set-cookie", ["SAP_SESSIONID=s1; path=/; HttpOnly"])
    return res.writeHead(200).end("graph")
  }
  if (path === "/clear") {
    res.setHeader("set-cookie", ["SAP_SESSIONID=; Max-Age=0; path=/"])
    return res.writeHead(200).end("cleared")
  }
  if (path === "/boom") return res.writeHead(500).end(ADT_ERROR)
  if (!cookie.includes("MYSAPSSO2=new")) return res.writeHead(401).end()
  res.writeHead(200).end("ok")
}

beforeAll(async () => {
  server = http.createServer(route)
  await new Promise<void>(r => server.listen(0, "127.0.0.1", r))
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => new Promise(r => server.close(r)))
beforeEach(() => (seen = []))

const create = (extra: Partial<AdtSessionProvider> = {}) => {
  const renew = jest.fn(async () => ({ cookieHeader: "MYSAPSSO2=new" }))
  const session: AdtSessionProvider = { id: "test", renew, ...extra }
  const client = new AdtHTTP(baseURL, "user", "", "", "", { session })
  return { client, renew }
}
const hits = (url: string) => seen.filter(s => s.url === url)

describe("external cookie session over Axios", () => {
  test("renews an expired session once and replays the read", async () => {
    const { client, renew } = create()
    client.session.importCookies({ cookieHeader: "MYSAPSSO2=old" })
    const response = await client.request("/x")
    expect(response.body).toBe("ok")
    expect(renew).toHaveBeenCalledTimes(1)
    expect(hits("/x")).toHaveLength(2)
    expect(hits(GRAPH)[0].cookie).toBe("MYSAPSSO2=old")
    expect(hits("/x")[1].cookie).toBe("MYSAPSSO2=new; SAP_SESSIONID=s1")
  })

  test("deletes cookies the server expires", async () => {
    const { client } = create()
    client.session.importCookies({ cookieHeader: "MYSAPSSO2=new" })
    await client.request("/clear")
    await client.request("/x")
    expect(hits("/clear")[0].cookie).toContain("SAP_SESSIONID=s1")
    expect(hits("/x")[0].cookie).toBe("MYSAPSSO2=new")
  })

  test("local-only logout makes no request", async () => {
    const { client } = create({ logoutMode: "local-only" })
    client.session.importCookies({ cookieHeader: "MYSAPSSO2=new" })
    await client.login()
    seen = []
    await client.logout()
    expect(seen).toHaveLength(0)
    expect(client.session.cookieHeader()).toBe("")
  })

  test("errors keep status and message", async () => {
    const { client } = create()
    client.session.importCookies({ cookieHeader: "MYSAPSSO2=new" })
    const error = await client.request("/boom").catch(e => e)
    expect(isAdtError(error) && error.err).toBe(500)
    expect(isAdtError(error) && error.message).toBe("exploded")
  })

  test("a rejected renewal is a session failure", async () => {
    const { client } = create({ renew: async () => undefined })
    client.session.importCookies({ cookieHeader: "MYSAPSSO2=old" })
    const error = await client.request("/x").catch(e => e)
    expect(isAdtSessionFailure(error) && error.status).toBe(401)
    expect(hits("/x")).toHaveLength(1)
  })
})
