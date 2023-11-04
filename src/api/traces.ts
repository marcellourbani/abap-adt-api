import {
  TraceDBAccessResponse,
  TraceHitList,
  TraceResults,
  parseTraceDbAccess,
  parseTraceHitList,
  parseTraceResults
} from "./tracetypes"
import { AdtHTTP } from "../AdtHTTP"

export { TraceResults, TraceHitList, TraceDBAccessResponse } from "./tracetypes"

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
