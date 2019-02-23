import { AdtHTTP } from "../AdtHTTP"
import { fullParse, xmlArray, xmlNode, xmlNodeAttr } from "../utilities"

export interface FixProposal {
  "adtcore:uri": string
  "adtcore:type": string
  "adtcore:name": string
  uri: string
  line: string
  column: string
}

export async function fixProposals(
  h: AdtHTTP,
  uri: string,
  body: string,
  line: number,
  column: number
) {
  const qs = { uri: `${uri}#start=${line},${column}` }
  const headers = { "Content-Type": "application/*", Accept: "application/*" }

  const response = await h.request("/sap/bc/adt/quickfixes/evaluation", {
    method: "POST",
    qs,
    headers,
    body
  })
  const raw = fullParse(response.body)
  return xmlArray(raw, "qf:evaluationResults", "evaluationResult")
    .map(x => xmlNodeAttr(xmlNode(x, "adtcore:objectReference")))
    .map(x => ({
      ...x,
      uri,
      line,
      column
    })) as FixProposal[]
}
