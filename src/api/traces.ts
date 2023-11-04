import {
  TraceDBAccessResponse,
  TraceHitList,
  TraceResults,
  TraceStatementOptions,
  TraceStatementResponse,
  parseTraceDbAccess,
  parseTraceHitList,
  parseTraceResults,
  parseTraceStatements
} from "./tracetypes"
import { AdtHTTP } from "../AdtHTTP"

export {
  TraceResults,
  TraceHitList,
  TraceDBAccessResponse,
  TraceStatementResponse,
  TraceStatementOptions
} from "./tracetypes"

export const tracesList = async (
  h: AdtHTTP,
  user: string
): Promise<TraceResults> => {
  const response = await h.request(
    `/sap/bc/adt/runtime/traces/abaptraces?user=${user.toUpperCase()}`
  )
  return parseTraceResults(response.body)
}

const traceId = (id: string) =>
  id.match(/\//) ? id : `/sap/bc/adt/runtime/traces/abaptraces/${id}`

export const tracesHitList = async (
  h: AdtHTTP,
  id: string,
  withSystemEvents = false
): Promise<TraceHitList> => {
  const opts = { qs: { withSystemEvents } }
  const response = await h.request(`${traceId(id)}/hitlist`, opts)
  return parseTraceHitList(response.body)
}

export const tracesDbAccess = async (
  h: AdtHTTP,
  id: string,
  withSystemEvents = false
): Promise<TraceDBAccessResponse> => {
  const opts = { qs: { withSystemEvents } }
  const response = await h.request(`${traceId(id)}/dbAccesses`, opts)
  return parseTraceDbAccess(response.body)
}

export const tracesStatements = async (
  h: AdtHTTP,
  id: string,
  options: TraceStatementOptions = {}
): Promise<TraceStatementResponse> => {
  const headers = {
    Accept:
      "application/vnd.sap.adt.runtime.traces.abaptraces.aggcalltree+xml, application/xml"
  }
  const opts = { qs: options, headers }
  const response = await h.request(`${traceId(id)}/statements`, opts)
  return parseTraceStatements(response.body)
}
