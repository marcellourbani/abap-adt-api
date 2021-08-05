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
  userContent: string
}

export interface RenameRefactoring {
  "rename:oldName": string
  "rename:newName": string
  "generic:ignoreSyntaxErrorsAllowed": string
  "generic:ignoreSyntaxErrors": string
  "generic:affectedObject": []
  uri: string
  line: string
  column: string
  userContent: string
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
  const rawResults = xmlArray(raw, "qf:evaluationResults", "evaluationResult")
  return rawResults.map(x => {
    const attrs = xmlNodeAttr(xmlNode(x, "adtcore:objectReference"))
    const userContent = decodeEntity(xmlNode(x, "userContent") || "")

    return {
      ...attrs,
      "adtcore:name": decodeEntity(attrs["adtcore:name"]),
      "adtcore:description": decodeEntity(attrs["adtcore:description"]),
      uri,
      line,
      column,
      userContent
    }
  }) as FixProposal[]
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
    <userContent>${encodeEntity(proposal.userContent)}</userContent>
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

export async function renameEvaluate(
  h: AdtHTTP,
  uri: string,
  body: string,
  line: number,
  startColumn: number,
  endColumn: number
) {
  const qs = {
    uri: `step=evaluate& 
          rel=http://www.sap.com/adt/relations/refactoring/rename&
          uri=${uri}#start=${line},${startColumn};end=${endColumn}`
  }
  const headers = { "Content-Type": "application/*", Accept: "application/*" }

  const response = await h.request("/sap/bc/adt/refactorings", {
    method: "POST",
    qs,
    headers,
    body
  })

  const raw = fullParse(response.body)
  const rawResults = xmlArray(raw, "rename:renameRefactoring")
  return rawResults.map(x => {
    const attrs = xmlNodeAttr(xmlNode(x, "adtcore:objectReference"))
    const userContent = decodeEntity(xmlNode(x, "userContent") || "")

    return {
      ...attrs,
      "rename:oldName": decodeEntity(attrs["rename:oldName"]),
      "rename:newName": decodeEntity(attrs["rename:newName"]),
      "generic:ignoreSyntaxErrorsAllowed": decodeEntity(
        attrs["generic:ignoreSyntaxErrors"]
      ),
      "generic:ignoreSyntaxErrors": decodeEntity(
        attrs["generic:ignoreSyntaxErrors"]
      ),
      "generic:affectedObject": decodeEntity(attrs["generic:affectedObjects"]),

      userContent: userContent
    }
  }) as RenameRefactoring[]
}
