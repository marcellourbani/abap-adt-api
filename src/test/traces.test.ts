import { ADTClient } from "../AdtClient"
import { runTest } from "./login"

test(
  "TracesList",
  runTest(async (c: ADTClient) => {
    const resp = await c.tracesList()
    expect(resp).toBeDefined()
    expect(resp.runs).toBeDefined()
    if (resp.runs.length) {
      expect(resp.runs[0].links[0].href).toBeTruthy()
    }
  })
)

test(
  "TraceHitList",
  runTest(async (c: ADTClient) => {
    const resp = await c.tracesList()
    expect(resp).toBeDefined()
    expect(resp.runs).toBeDefined()
    const id = resp.runs[0].id
    if (id) {
      const hitlist = await c.tracesHitList(id)
      expect(hitlist.parentLink).toBeTruthy()
    }
  })
)

test(
  "TraceDbAccess",
  runTest(async (c: ADTClient) => {
    const resp = await c.tracesList()
    expect(resp).toBeDefined()
    expect(resp.runs).toBeDefined()
    const id = resp.runs[0].id
    if (id) {
      const dbaccess = await c.tracesDbAccess(id)
      expect(dbaccess.parentLink).toBeTruthy()
    }
  })
)

test(
  "TraceDbStatements",
  runTest(async (c: ADTClient) => {
    const resp = await c.tracesList()
    expect(resp).toBeDefined()
    expect(resp.runs).toBeDefined()
    const id = resp.runs.find(r =>
      r.links.find(l => l.href.match(/statements/))
    )?.id
    if (id) {
      const dbaccess = await c.tracesStatements(id)
      expect(dbaccess.parentLink).toBeTruthy()
    }
  })
)
