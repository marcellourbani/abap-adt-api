import { adtException } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import {
  decodeEntity,
  encodeEntity,
  fullParse,
  xmlArray,
  xmlNode,
  xmlNodeAttr
} from "../utilities"
import { parseUri, Range } from "./urlparser"

export interface FixProposal {
  "adtcore:uri": string
  "adtcore:type": string
  "adtcore:name": string
  "adtcore:description": string
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
      "adtcore:name": decodeEntity(x["adtcore:name"]),
      "adtcore:description": x["adtcore:description"],
      uri,
      line,
      column
    })) as FixProposal[]
}
export interface Delta {
  uri: string
  range: Range
  name: string
  type: string
  content: string
}
export async function fixEdits(
  h: AdtHTTP,
  proposal: FixProposal,
  source: string
) {
  if (!proposal["adtcore:uri"].match(/\/sap\/bc\/adt\/quickfixes/))
    throw adtException("Invalid fix proposal")
  const body = `<?xml version="1.0" encoding="UTF-8"?>
  <quickfixes:proposalRequest xmlns:quickfixes="http://www.sap.com/adt/quickfixes"
     xmlns:adtcore="http://www.sap.com/adt/core">
    <input>
      <content>${encodeEntity(source)}</content>
      <adtcore:objectReference adtcore:uri="${proposal.uri}#start=${
    proposal.line
  },${proposal.column}"/>
    </input>
  </quickfixes:proposalRequest>`
  const headers = { "Content-Type": "application/*", Accept: "application/*" }
  const response = await h.request(proposal["adtcore:uri"], {
    method: "POST",
    headers,
    body
  })
  const raw = fullParse(response.body)
  const parseDelta = (d: any): Delta => {
    const attr = xmlNodeAttr(xmlNode(d, "adtcore:objectReference"))
    const content = decodeEntity(d.content)
    const { uri, range } = parseUri(attr["adtcore:uri"])

    return {
      uri,
      range,
      name: attr["adtcore:name"],
      type: attr["adtcore:type"],
      content
    }
  }
  const deltas = xmlArray(raw, "qf:proposalResult", "deltas", "unit").map(
    parseDelta
  )
  return deltas
}
