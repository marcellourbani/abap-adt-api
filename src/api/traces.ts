
import { parseTraceHitList, parseTraceResults } from "./tracetypes";
import { AdtHTTP } from "../AdtHTTP";

export { TraceResults, HitList } from "./tracetypes";

export const tracesList = async (h: AdtHTTP, user: string) => {
    const response = await h.request(`/sap/bc/adt/runtime/traces/abaptraces?user=${user.toUpperCase()}`)
    return parseTraceResults(response.body)
}

export const tracesHitList = async (h: AdtHTTP, id: string, withSystemEvents = false) => {
    const uri = id.match(/\//) ? `${id}/hitlist` : `/sap/bc/adt/runtime/traces/abaptraces/${id}/hitlist`
    const opts = { qs: { withSystemEvents } }
    const response = await h.request(uri, opts)
    return parseTraceHitList(response.body)
}