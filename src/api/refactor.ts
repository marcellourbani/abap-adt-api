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
import { transportInfo } from "./transports"
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
interface textReplaceDelta {
  "generic:rangeFragment": string,
  "generic:contentOld": string,
  "generic:contentNew": string
}
interface affectedObjects {
  "adtcore:uri": string,
  "adtcore:type": string,
  "adtcore:name": string,
  "adtcore:parentUri": string,
  "generic:userContent": string,
  "generic:textReplaceDeltas": textReplaceDelta[]

}

export interface RenameRefactoring {
  "rename:oldName": string
  "rename:newName": string
  "generic:ignoreSyntaxErrorsAllowed": string
  "generic:ignoreSyntaxErrors": string
  "generic:adtObjectUri": string,
  "generic:affectedObjects": affectedObjects[]
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
  line: number,
  startColumn: number,
  endColumn: number
) {
  const qs = {
    step: `evaluate`,
    rel: `http://www.sap.com/adt/relations/refactoring/rename`,
    uri: `${uri}#start=${line},${startColumn};end=${line},${endColumn}`
  }
  const headers = { "Content-Type": "application/*", Accept: "application/*" }

  const response = await h.request("/sap/bc/adt/refactorings", {
    method: "POST",
    qs: qs,
    headers: headers,
  })

  const raw = fullParse(response.body)
  const rawResults = xmlArray(raw, "rename:renameRefactoring")
  return rawResults.map(x => {
    const topNode = xmlArray(x, "generic:genericRefactoring")[0] as any;
    const affectedObjects = xmlArray(topNode, "generic:affectedObjects");
    const attrs = xmlNodeAttr(xmlNode(affectedObjects[0], "generic:affectedObject"))
    const userContent = decodeEntity(xmlNode(topNode, "generic:userContent") || "")
   
    return {
      ...attrs,
      "rename:oldName": decodeEntity(xmlNode(x, "rename:oldName") || ""),
      "rename:newName": decodeEntity(xmlNode(x, "rename:newName") || ""),
      "generic:adtObjectUri": decodeEntity(xmlNode(topNode, "generic:adtObjectUri") || ""),
      "generic:ignoreSyntaxErrorsAllowed": topNode["generic:ignoreSyntaxErrorsAllowed"],
      "generic:ignoreSyntaxErrors": topNode["generic:ignoreSyntaxErrors"],
      "generic:affectedObjects": affectedObjects.map(y => { 
        const replacedelta = xmlArray(y, "generic:affectedObject", "generic:textReplaceDeltas", "generic:textReplaceDelta")
        const affectedObject = xmlNodeAttr(xmlNode(y, "generic:affectedObject"))
        return {
        "adtcore:uri": decodeEntity(xmlNode(affectedObject, "adtcore:uri")),
        "adtcore:type": decodeEntity(xmlNode(affectedObject, "adtcore:type")),
        "adtcore:name": decodeEntity(xmlNode(affectedObject, "adtcore:name")),
        "adtcore:parentUri": decodeEntity(xmlNode(affectedObject, "adtcore:parentUri")),
        "generic:textReplaceDeltas": replacedelta.map(z => { 
          return {
            "generic:rangeFragment": decodeEntity(xmlNode(z, "generic:rangeFragment")),
            "generic:contentOld": decodeEntity(xmlNode(z, "generic:contentOld")),
            "generic:contentNew": decodeEntity(xmlNode(z, "generic:contentNew"))
          }
        }),
        "generic:userContent": decodeEntity(xmlNode(y, "generic:affectedObject", "generic:userContent") || ""),
       }
      }),
      userContent: userContent
    }
  }) as RenameRefactoring[]


 
}

export async function renamePreview(
  h: AdtHTTP,
  renameRefactoring: RenameRefactoring[]
) {
  const qs = {
    step: `preview`,
    rel: `http://www.sap.com/adt/relations/refactoring/rename`,
  }
  //get the transport
  const info = await transportInfo(h, renameRefactoring[0]["generic:affectedObjects"][0]["adtcore:parentUri"], "ZAPIDUMMY")
  const addAffectedObjects = (affectedObject: affectedObjects[]) => 
   affectedObject.map(z => 
      `<generic:affectedObject adtcore:name="${z["adtcore:name"]}" adtcore:parentUri="${z["adtcore:parentUri"]}" adtcore:type="${z["adtcore:type"]}" adtcore:uri="${z["adtcore:uri"]}">
        <generic:textReplaceDeltas>
          ${z["generic:textReplaceDeltas"].map(y => {
            //${y["generic:contentOld"]}
            //${y["generic:contentNew"]}
            return `<generic:textReplaceDelta>
            <generic:rangeFragment>${y["generic:rangeFragment"]}</generic:rangeFragment>
            <generic:contentOld></generic:contentOld>
            <generic:contentNew></generic:contentNew>
          </generic:textReplaceDelta>`
          }).join('')}
          </generic:textReplaceDeltas>
        <generic:userContent>${z["generic:userContent"]}</generic:userContent>
      </generic:affectedObject>`
   )

  const bodyXml = `<?xml version="1.0" encoding="ASCII"?>
  <rename:renameRefactoring xmlns:adtcore="http://www.sap.com/adt/core" xmlns:generic="http://www.sap.com/adt/refactoring/genericrefactoring" xmlns:rename="http://www.sap.com/adt/refactoring/renamerefactoring">
    <rename:oldName>${renameRefactoring[0]["rename:oldName"]}</rename:oldName>
    <rename:newName>${renameRefactoring[0]["rename:newName"]}</rename:newName>
    <generic:genericRefactoring>
      <generic:title>Rename Field</generic:title>
      <generic:adtObjectUri>${renameRefactoring[0]["generic:adtObjectUri"]}</generic:adtObjectUri>
      <generic:affectedObjects>
        ${addAffectedObjects(renameRefactoring[0]["generic:affectedObjects"]).join('')}
      </generic:affectedObjects>
      <generic:transport>${info.TRANSPORTS.length > 0 ? info.TRANSPORTS[0].TRKORR : process.env.ADT_TRANS}</generic:transport>
      <generic:ignoreSyntaxErrorsAllowed>${renameRefactoring[0]["generic:ignoreSyntaxErrorsAllowed"]}</generic:ignoreSyntaxErrorsAllowed>
      <generic:ignoreSyntaxErrors>${renameRefactoring[0]["generic:ignoreSyntaxErrors"]}</generic:ignoreSyntaxErrors>
      <generic:userContent/>
    </generic:genericRefactoring>
    <rename:userContent/>
  </rename:renameRefactoring>`
  const headers = { "Content-Type": "application/*", Accept: "application/*" }

  const response = await h.request("/sap/bc/adt/refactorings", {
    method: "POST",
    qs: qs,
    body: bodyXml,
    headers: headers,
  })
  
  return response.body as string
}

export async function renameExecute(
  h: AdtHTTP,
  body: string
) {
  const qs = {
    step: `execute`  }
 
  const headers = { "Content-Type": "application/*", Accept: "application/*" }

  const response = await h.request("/sap/bc/adt/refactorings", {
    method: "POST",
    qs: qs,
    body: body,
    headers: headers,
  })
  
  return response.body as string
}
