import * as t from "io-ts"

import { parseTraceResults } from "./tracetypes";
import { AdtHTTP } from "../AdtHTTP";

export { TraceResults } from "./tracetypes";

export const listTraces = async (h: AdtHTTP, user: string) => {
    const response = await h.request(`/sap/bc/adt/runtime/traces/abaptraces?user=${user.toUpperCase()}`)
    return parseTraceResults(response.body)
}