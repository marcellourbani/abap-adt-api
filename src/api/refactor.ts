import { rangeToString, UriParts } from "."
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
interface TextReplaceDelta {
  rangeFragment: Range,
  contentOld: string,
  contentNew: string
}
interface AffectedObjects {
  uri: string,
  type: string,
  name: string,
  parentUri: string,
  userContent: string,
  textReplaceDeltas: TextReplaceDelta[]

}

export interface RenameRefactoringProposal {
  oldName: string
  newName: string
  transport?: string
  title?: string,
  rootUserContent?: string,
  ignoreSyntaxErrorsAllowed: string
  ignoreSyntaxErrors: string
  adtObjectUri: UriParts,
  affectedObjects: AffectedObjects[]
  userContent: string
}
export interface RenameRefactoring extends RenameRefactoringProposal {
  transport: string
}

export async function fixProposals(
  h: AdtHTTP,
  uri: string,
  body: string,
  line: number,
  column: number
) {
  const params = { uri: `${uri}#start=${line},${column}` }
  const headers = { "Content-Type": "application/*", Accept: "application/*" }
  const data = body
  const response = await h.request("/sap/bc/adt/quickfixes/evaluation", {
    method: "POST",
    params,
    headers,
    data
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
  })
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
  const data = `<?xml version="1.0" encoding="UTF-8"?>
  <quickfixes:proposalRequest xmlns:quickfixes="http://www.sap.com/adt/quickfixes"
     xmlns:adtcore="http://www.sap.com/adt/core">
    <input>
      <content>${encodeEntity(source)}</content>
      <adtcore:objectReference adtcore:uri="${proposal.uri}#start=${proposal.line
    },${proposal.column}"/>
    </input>
    <userContent>${encodeEntity(proposal.userContent)}</userContent>
  </quickfixes:proposalRequest>`
  const headers = { "Content-Type": "application/*", Accept: "application/*" }
  const response = await h.request(proposal["adtcore:uri"], {
    method: "POST",
    headers,
    data
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

function parseRenameRefactoring(body: string): RenameRefactoringProposal {
  const raw = fullParse(body, { ignoreNameSpace: true })
  const root = xmlNode(raw, "renameRefactoring")
  const generic = xmlNode(root || raw, "genericRefactoring") // depending on the caller the generic refactoring might be wrapped or not
  const affectedObjects = xmlArray(generic, "affectedObjects", "affectedObject")
  const userContent = decodeEntity(xmlNode(generic, "userContent") || "")
  const adtObjectUri = parseUri(decodeEntity(xmlNode(generic, "adtObjectUri") || ""))

  return {
    oldName: decodeEntity(xmlNode(root, "oldName") || ""),
    newName: decodeEntity(xmlNode(root, "newName") || ""),
    adtObjectUri,
    ignoreSyntaxErrorsAllowed: generic["ignoreSyntaxErrorsAllowed"],
    ignoreSyntaxErrors: generic["ignoreSyntaxErrors"],
    transport: "",
    affectedObjects: affectedObjects.map(y => {
      const replacedelta = xmlArray(y, "textReplaceDeltas", "textReplaceDelta")
      const affectedObject = xmlNodeAttr(y)
      return {
        uri: decodeEntity(xmlNode(affectedObject, "uri")),
        type: decodeEntity(xmlNode(affectedObject, "type")),
        name: decodeEntity(xmlNode(affectedObject, "name")),
        parentUri: decodeEntity(xmlNode(affectedObject, "parentUri")),
        textReplaceDeltas: replacedelta.map(z => {
          return {
            rangeFragment: parseUri(decodeEntity(xmlNode(z, "rangeFragment"))).range,
            contentOld: decodeEntity(xmlNode(z, "contentOld")),
            contentNew: decodeEntity(xmlNode(z, "contentNew"))
          }
        }),
        userContent: decodeEntity(xmlNode(y, "affectedObject", "userContent") || ""),
      }
    }),
    userContent: userContent
  }
}

export async function renameEvaluate(
  h: AdtHTTP,
  uri: string,
  line: number,
  startColumn: number,
  endColumn: number
): Promise<RenameRefactoringProposal> {
  const params = {
    step: `evaluate`,
    rel: `http://www.sap.com/adt/relations/refactoring/rename`,
    uri: `${uri}#start=${line},${startColumn};end=${line},${endColumn}`
  }
  const headers = { "Content-Type": "application/*", Accept: "application/*" }

  const response = await h.request("/sap/bc/adt/refactorings", {
    method: "POST",
    params: params,
    headers: headers,
  })

  return parseRenameRefactoring(response.body)
}

const srializeRefactoring = (renameRefactoring: RenameRefactoringProposal, wrapped: boolean, transport: string = "") => {
  const start = wrapped ? `<rename:renameRefactoring xmlns:adtcore="http://www.sap.com/adt/core" xmlns:generic="http://www.sap.com/adt/refactoring/genericrefactoring" 
  xmlns:rename="http://www.sap.com/adt/refactoring/renamerefactoring">
  <rename:oldName>${renameRefactoring.oldName}</rename:oldName>
  <rename:newName>${renameRefactoring.newName}</rename:newName>`
    : ""
  const end = wrapped ? `<rename:userContent/></rename:renameRefactoring>` : ""
  const genns = wrapped ? "" : ` xmlns:generic="http://www.sap.com/adt/refactoring/genericrefactoring" xmlns:adtcore="http://www.sap.com/adt/core"`

  const addAffectedObjects = (affectedObject: AffectedObjects[]) =>
    affectedObject.map(z => {
      const pu = z.parentUri ? `adtcore:parentUri="${z.parentUri}"` : ""
      return `<generic:affectedObject adtcore:name="${z.name}" ${pu} adtcore:type="${z.type}" adtcore:uri="${z.uri}">
        <generic:textReplaceDeltas>
          ${z.textReplaceDeltas.map(y => {
        return `<generic:textReplaceDelta>
            <generic:rangeFragment>${rangeToString(y.rangeFragment)}</generic:rangeFragment>
            <generic:contentOld>${y.contentOld}</generic:contentOld>
            <generic:contentNew>${y.contentNew}</generic:contentNew>
          </generic:textReplaceDelta>`
      }).join('')}
          </generic:textReplaceDeltas>
        <generic:userContent>${z.userContent}</generic:userContent>
      </generic:affectedObject>`
    })
  const bodyXml = `<?xml version="1.0" encoding="ASCII"?>
  ${start}
    <generic:genericRefactoring ${genns}>
      <generic:title>Rename Field</generic:title>
      <generic:adtObjectUri>${renameRefactoring.adtObjectUri.uri}${rangeToString(renameRefactoring.adtObjectUri.range)}</generic:adtObjectUri>
      <generic:affectedObjects>
        ${addAffectedObjects(renameRefactoring.affectedObjects).join('')}
      </generic:affectedObjects>
      <generic:transport>${renameRefactoring.transport || transport}</generic:transport>
      <generic:ignoreSyntaxErrorsAllowed>${renameRefactoring.ignoreSyntaxErrorsAllowed}</generic:ignoreSyntaxErrorsAllowed>
      <generic:ignoreSyntaxErrors>${renameRefactoring.ignoreSyntaxErrors}</generic:ignoreSyntaxErrors>
      <generic:userContent/>
    </generic:genericRefactoring>
    ${end}`
  return bodyXml
}

export async function renamePreview(
  h: AdtHTTP,
  renameRefactoring: RenameRefactoringProposal,
  transport: string
): Promise<RenameRefactoring> {
  const params = {
    step: `preview`,
    rel: `http://www.sap.com/adt/relations/refactoring/rename`,
  }
  const bodyXml = srializeRefactoring(renameRefactoring, true, transport)
  const headers = { "Content-Type": "application/*", Accept: "application/*" }

  const response = await h.request("/sap/bc/adt/refactorings", {
    method: "POST",
    params: params,
    data: bodyXml,
    headers: headers,
  })
  const parsed = parseRenameRefactoring(response.body)
  return { ...parsed, transport: parsed.transport || transport }
}

export async function renameExecute(
  h: AdtHTTP,
  rename: RenameRefactoring
): Promise<RenameRefactoring> {
  const params = {

    step: `execute`
  }

  const headers = { "Content-Type": "application/*", Accept: "application/*" }
  const data = srializeRefactoring(rename, false)

  const response = await h.request("/sap/bc/adt/refactorings", {
    method: "POST",
    params: params,
    data,
    headers: headers,
  })

  const result = parseRenameRefactoring(response.body)
  return { ...result, transport: result.transport || rename.transport }
}
