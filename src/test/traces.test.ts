import { assert } from "console"
import { ADTClient } from "../AdtClient"
import { TraceParameters, TracesCreationConfig } from "../api"
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
    if (resp.runs.length) {
      const id = resp.runs[0].id
      if (id) {
        const hitlist = await c.tracesHitList(id)
        expect(hitlist.parentLink).toBeTruthy()
      }
    }
  })
)

test(
  "TraceDbAccess",
  runTest(async (c: ADTClient) => {
    const resp = await c.tracesList()
    expect(resp).toBeDefined()
    expect(resp.runs).toBeDefined()
    if (resp.runs.length) {
      const id = resp.runs[0].id
      if (id) {
        const dbaccess = await c.tracesDbAccess(id)
        expect(dbaccess.parentLink).toBeTruthy()
      }
    }
  })
)

test(
  "TraceStatements",
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

test(
  "set trace parameters",
  runTest(async (c: ADTClient) => {
    const params: TraceParameters = {
      allMiscAbapStatements: false,
      allProceduralUnits: true,
      allInternalTableEvents: false,
      allDynproEvents: false,
      aggregate: false,
      explicitOnOff: false,
      withRfcTracing: false,
      allSystemKernelEvents: false,
      sqlTrace: false,
      allDbEvents: true,
      maxSizeForTraceFile: 30720,
      maxTimeForTracing: 1800,
      description: "FOOBAR"
    }
    const resp = await c.tracesSetParameters(params)
    expect(resp).toBeTruthy()
  })
)

test(
  "list trace request",
  runTest(async (c: ADTClient) => {
    const requests = await c.tracesListRequests()
    expect(requests.requests.length).toBeDefined()
  })
)
