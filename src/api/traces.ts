import {
  TraceDBAccessResponse,
  TraceHitList,
  TraceParameters,
  TraceResults,
  TraceStatementOptions,
  TraceStatementResponse,
  TracesCreationConfig,
  parseTraceDbAccess,
  parseTraceHitList,
  parseTraceResults,
  parseTraceStatements,
  traceObjectTypeUris,
  traceProcessTypeUris,
  traceProcessObjects,
  parseTraceRequestList,
  TraceRequestList
} from "./tracetypes"
import { AdtHTTP, RequestOptions } from "../AdtHTTP"
import { adtException } from ".."

export {
  TraceResults,
  TraceHitList,
  TraceDBAccessResponse,
  TraceStatementResponse,
  TraceStatementOptions,
  TracesCreationConfig,
  TraceParameters,
  traceProcessObjects,
  TraceRequestList
} from "./tracetypes"

export const tracesList = async (
  h: AdtHTTP,
  user: string
): Promise<TraceResults> => {
  const qs = { user: user.toUpperCase() }
  const response = await h.request(`/sap/bc/adt/runtime/traces/abaptraces`, {
    qs
  })
  return parseTraceResults(response.body)
}

export const tracesListRequests = async (
  h: AdtHTTP,
  user: string
): Promise<TraceRequestList> => {
  const qs = { user: user.toUpperCase() }
  const response = await h.request(
    `/sap/bc/adt/runtime/traces/abaptraces/requests`,
    { qs }
  )
  return parseTraceRequestList(response.body)
}

const traceId = (id: string) =>
  id.startsWith("/sap/bc/adt/runtime/traces/abaptraces/")
    ? id
    : `/sap/bc/adt/runtime/traces/abaptraces/${id}`

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

export const tracesSetParameters = async (
  h: AdtHTTP,
  parameters: TraceParameters
): Promise<string> => {
  const headers = { "Content-Type": "application/xml" }
  const body = `<?xml version="1.0" encoding="UTF-8"?>
  <trc:parameters xmlns:trc="http://www.sap.com/adt/runtime/traces/abaptraces">
      <trc:allMiscAbapStatements value="${parameters.allMiscAbapStatements}"></trc:allMiscAbapStatements>
      <trc:allProceduralUnits value="${parameters.allProceduralUnits}"></trc:allProceduralUnits>
      <trc:allInternalTableEvents value="${parameters.allInternalTableEvents}"></trc:allInternalTableEvents>
      <trc:allDynproEvents value="${parameters.allDynproEvents}"></trc:allDynproEvents>
      <trc:description value="${parameters.description}"></trc:description>
      <trc:aggregate value="${parameters.aggregate}"></trc:aggregate>
      <trc:explicitOnOff value="${parameters.explicitOnOff}"></trc:explicitOnOff>
      <trc:withRfcTracing value="${parameters.withRfcTracing}"></trc:withRfcTracing>
      <trc:allSystemKernelEvents value="${parameters.allSystemKernelEvents}"></trc:allSystemKernelEvents>
      <trc:sqlTrace value="${parameters.sqlTrace}"></trc:sqlTrace>
      <trc:allDbEvents value="${parameters.allDbEvents}"></trc:allDbEvents>
      <trc:maxSizeForTraceFile value="${parameters.maxSizeForTraceFile}"></trc:maxSizeForTraceFile>
      <trc:maxTimeForTracing value="${parameters.maxTimeForTracing}"></trc:maxTimeForTracing>
  </trc:parameters>`
  const opts: RequestOptions = { headers, method: "POST", body }
  const response = await h.request(
    `/sap/bc/adt/runtime/traces/abaptraces/parameters`,
    opts
  )
  const uri = response.headers["location"]
  if (!uri) throw adtException("trace configuration not set")
  return uri
}

export const tracesCreateConfiguration = async (
  h: AdtHTTP,
  config: TracesCreationConfig
) => {
  if (!traceProcessObjects[config.processType].includes(config.objectType))
    throw adtException(
      `Invalid process type ${config.processType} or object type ${config.objectType}`
    )
  const qs = {
    ...config,
    server: config.server || "*",
    processType: traceProcessTypeUris[config.processType],
    objectType: traceObjectTypeUris[config.objectType]
  }
  const opts: RequestOptions = { method: "POST", qs }
  const response = await h.request(
    `/sap/bc/adt/runtime/traces/abaptraces/requests`,
    opts
  )
  return parseTraceRequestList(response.body)
}

export const tracesDeleteConfiguration = async (h: AdtHTTP, id: string) => {
  const prefix = `/sap/bc/adt/runtime/traces/abaptraces/requests`
  const url = id.startsWith(prefix) ? id : `${prefix}/${id}`
  await h.request(url, { method: "DELETE" })
}

export const tracesDelete = async (h: AdtHTTP, id: string) => {
  const prefix = `/sap/bc/adt/runtime/traces/abaptraces/`
  const url = id.startsWith(prefix) ? id : `${prefix}/${id}`
  await h.request(url, { method: "DELETE" })
}
