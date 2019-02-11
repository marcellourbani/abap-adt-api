import { parse } from "fast-xml-parser"
import { AdtHTTP } from "../AdtHTTP"
import {
  decodeEntity,
  fullParse,
  toInt,
  xmlArray,
  xmlNode,
  xmlNodeAttr
} from "../utilities"
import { SyntaxCheckResult } from "./syntax"

export interface SyntaxCheckResult {
  uri: string
  line: number
  offset: number
  severity: string
  text: string
}

function btoa(s: string) {
  return Buffer.from(s).toString("base64")
}

export async function syntaxCheck(
  h: AdtHTTP,
  inclUrl: string,
  mainUrl: string,
  content: string,
  version: string = "active"
) {
  const data = `<?xml version="1.0" encoding="UTF-8"?>
  <chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="${mainUrl}" chkrun:version="${version}">
    <chkrun:artifacts>
      <chkrun:artifact chkrun:contentType="text/plain; charset=utf-8" chkrun:uri="${inclUrl}">
        <chkrun:content>${btoa(content)}</chkrun:content>
      </chkrun:artifact>
    </chkrun:artifacts>
  </chkrun:checkObject>
</chkrun:checkObjectList>`

  const headers = {
    // Accept: "application/vnd.sap.adt.checkmessages+xml",
    // "Content-Type": "application/vnd.sap.adt.checkobjects+xml"
    "Content-Type": "application/*"
  }
  const response = await h.request(
    "/sap/bc/adt/checkruns?reporters=abapCheckRun",
    { method: "POST", headers, data }
  )
  const raw = fullParse(response.data)
  const messages = [] as SyntaxCheckResult[]
  xmlArray(
    raw,
    "chkrun:checkRunReports",
    "chkrun:checkReport",
    "chkrun:checkMessageList",
    "chkrun:checkMessage"
  ).forEach((m: any) => {
    const rawUri = m["@_chkrun:uri"] || ""
    const matches = rawUri.match(/([^#]+)#start=([\d]+),([\d]+)/)
    if (matches) {
      const [uri, line, offset] = matches.slice(1)
      messages.push({
        uri,
        line: toInt(line),
        offset: toInt(offset),
        severity: m["@_chkrun:type"],
        text: m["@_chkrun:shortText"]
      })
    }
  })

  return messages
}
export interface CompletionProposal {
  KIND: string
  IDENTIFIER: string
  ICON: string
  SUBICON: string
  BOLD: string
  COLOR: string
  QUICKINFO_EVENT: string
  INSERT_EVENT: string
  IS_META: string
  PREFIXLENGTH: string
  ROLE: string
  LOCATION: string
  GRADE: string
  VISIBILITY: string
  IS_INHERITED: string
  PROP1: string
  PROP2: string
  PROP3: string
  SYNTCNTXT: string
}

export interface CompletionElementInfo {
  name: string
  type: string
  href: string
  doc: string
  components: Array<{
    "adtcore:type": string
    "adtcore:name": string
    entries: Array<{ key: string; value: string }>
  }>
}

export interface DefinitionLocation {
  url: string
  line: number
  column: number
}
export async function codeCompletion(
  h: AdtHTTP,
  url: string,
  source: string,
  line: number,
  offset: number
) {
  const uri = `${url}#start=${line},${offset}`
  const params = { uri, signalCompleteness: true }
  const headers = { "Content-Type": "application/*" }
  const response = await h.request(
    "/sap/bc/adt/abapsource/codecompletion/proposal",
    { method: "POST", params, headers, data: source }
  )
  const raw = parse(response.data)
  const proposals = (xmlArray(
    raw,
    "asx:abap",
    "asx:values",
    "DATA",
    "SCC_COMPLETION"
  ) as CompletionProposal[]).filter(
    p => p.IDENTIFIER && p.IDENTIFIER !== "@end"
  )
  return proposals
}
function extractDocLink(raw: any): string {
  return decodeEntity(
    xmlNode(raw, "abapsource:elementInfo", "atom:link", "@_href").replace(
      /\w+:\/\/[^\/]*/,
      ""
    )
  )
}
export async function codeCompletionElement(
  h: AdtHTTP,
  url: string,
  data: string,
  line: number,
  offset: number
) {
  const params = { uri: `${url}#start=${line},${offset}` }
  const headers = { "Content-Type": "application/*", Accept: "application/*" }

  const response = await h.request(
    "/sap/bc/adt/abapsource/codecompletion/elementinfo",
    { method: "POST", params, headers, data }
  )
  const raw = fullParse(response.data)
  const elinfo = xmlNodeAttr(raw["abapsource:elementInfo"])
  const doc = raw["abapsource:elementInfo"]["abapsource:documentation"]["#text"]
  const href = extractDocLink(raw)

  const components = xmlArray(
    raw,
    "abapsource:elementInfo",
    "abapsource:elementInfo"
  ).map((c: any) => {
    return {
      ...xmlNodeAttr(c),
      entries: xmlArray(c, "abapsource:properties", "abapsource:entry").map(
        (e: any) => {
          return {
            value: e["#text"],
            key: e["@_abapsource:key"]
          }
        }
      )
    } as CompletionElementInfo
  })
  return {
    name: elinfo["adtcore:name"],
    type: elinfo["adtcore:type"],
    doc,
    href,
    components
  }
}

export async function findDefinition(
  h: AdtHTTP,
  url: string,
  data: string,
  line: number,
  firstof: number,
  lastof: number
) {
  const params = {
    uri: `${url}#start=${line},${firstof}`,
    end: `${line},${lastof}`,
    filter: "definition"
  }
  const headers = { "Content-Type": "application/*", Accept: "application/*" }
  const response = await h.request("/sap/bc/adt/navigation/target", {
    method: "POST",
    params,
    headers,
    data
  })
  const raw = fullParse(response.data)
  const rawLink = xmlNode(raw, "adtcore:objectReference", "@_adtcore:uri") || ""
  const match = rawLink.match(/([^#]+)#start=(\d+),(\d+)/)
  return {
    url: (match && match[1]) || "",
    line: toInt(match && match[2]),
    column: toInt(match && match[3])
  } as DefinitionLocation
}
// TODO: propose fix
// TODO: shift-enter
// TODO: where used
// TODO: object structures
// /sap/bc/adt/oo/classes/cl_salv_table/objectstructure?version=active&withShortDescriptions=true
