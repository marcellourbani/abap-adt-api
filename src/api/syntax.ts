import { parse } from "fast-xml-parser"
import { adtException, ValidateObjectUrl } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import {
  btoa,
  decodeEntity,
  encodeEntity,
  fullParse,
  parts,
  toInt,
  xmlArray,
  xmlNode,
  xmlNodeAttr
} from "../utilities"
import { Link } from "./objectstructure"
import { SyntaxCheckResult } from "./syntax"

export interface SyntaxCheckResult {
  uri: string
  line: number
  offset: number
  severity: string
  text: string
}

export interface UsageReference {
  uri: string
  objectIdentifier: string
  parentUri: string
  isResult: boolean
  canHaveChildren: boolean
  usageInformation: string
  "adtcore:responsible": string
  "adtcore:name": string
  "adtcore:type"?: string
  "adtcore:description"?: string
  packageRef: {
    "adtcore:uri": string
    "adtcore:name": string
  }
}

export async function syntaxCheck(
  h: AdtHTTP,
  inclUrl: string,
  sourceUrl: string,
  content: string,
  mainProgram: string = "",
  version: string = "active"
) {
  const source = mainProgram
    ? `${sourceUrl}?context=${encodeEntity(mainProgram)}`
    : sourceUrl
  const data = `<?xml version="1.0" encoding="UTF-8"?>
  <chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="${source}" chkrun:version="${version}">
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
        text: decodeEntity(m["@_chkrun:shortText"])
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
  data: string,
  line: number,
  offset: number
) {
  const uri = `${url}#start=${line},${offset}`
  const params = { uri, signalCompleteness: true }
  const headers = { "Content-Type": "application/*" }
  const response = await h.request(
    "/sap/bc/adt/abapsource/codecompletion/proposal",
    { method: "POST", params, headers, data }
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

export async function codeCompletionFull(
  h: AdtHTTP,
  url: string,
  data: string,
  line: number,
  offset: number,
  patternKey: string
) {
  const uri = `${url}#start=${line},${offset}`
  const params = { uri, patternKey }
  const headers = { "Content-Type": "application/*" }
  const response = await h.request(
    "/sap/bc/adt/abapsource/codecompletion/insertion",
    { method: "POST", params, headers, data }
  )
  return response.data
}

function extractDocLink(raw: any): string {
  const link =
    xmlNode(raw, "abapsource:elementInfo", "atom:link", "@_href") || ""
  return decodeEntity(link.replace(/\w+:\/\/[^\/]*/, ""))
}

export async function codeCompletionElement(
  h: AdtHTTP,
  url: string,
  data: string,
  line: number,
  offset: number
): Promise<CompletionElementInfo | string> {
  const params = { uri: `${url}#start=${line},${offset}` }
  const headers = { "Content-Type": "application/*", Accept: "application/*" }

  const response = await h.request(
    "/sap/bc/adt/abapsource/codecompletion/elementinfo",
    { method: "POST", params, headers, data }
  )
  const raw = fullParse(response.data)
  if (!xmlNode(raw, "abapsource:elementInfo")) return response.data
  const elinfo = xmlNodeAttr(xmlNode(raw, "abapsource:elementInfo"))
  const doc =
    xmlNode(
      raw,
      "abapsource:elementInfo",
      "abapsource:documentation",
      "#text"
    ) || ""
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
    }
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

export async function usageReferences(
  h: AdtHTTP,
  url: string,
  line?: number,
  column?: number
) {
  const headers = { "Content-Type": "application/*", Accept: "application/*" }
  const uri = line && column ? `${url}#start=${line},${column}` : url
  const params = { uri }
  const data = `<?xml version="1.0" encoding="ASCII"?>
  <usagereferences:usageReferenceRequest xmlns:usagereferences="http://www.sap.com/adt/ris/usageReferences">
    <usagereferences:affectedObjects/>
  </usagereferences:usageReferenceRequest>`
  const response = await h.request(
    "/sap/bc/adt/repository/informationsystem/usageReferences",
    {
      method: "POST",
      params,
      headers,
      data
    }
  )
  const raw = fullParse(response.data)
  const rawreferences = xmlArray(
    raw,
    "usageReferences:usageReferenceResult",
    "usageReferences:referencedObjects",
    "usageReferences:referencedObject"
  )
  const references = rawreferences.map((r: any) => {
    return {
      ...xmlNodeAttr(r),
      ...xmlNodeAttr(xmlNode(r, "usageReferences:adtObject") || {}),
      packageRef: xmlNodeAttr(
        xmlNode(r, "usageReferences:adtObject", "adtcore:packageRef") || {}
      ),
      objectIdentifier: r.objectIdentifier || ""
    }
  })
  return references as UsageReference[]
}
interface Location {
  line: number
  column: number
}
interface ReferenceUri {
  uri: string
  context?: string
  start?: Location
  end?: Location
  type?: string
  name?: string
}
export interface UsageReferenceSnippet {
  objectIdentifier: string
  snippets: Array<{
    uri: ReferenceUri
    matches: string
    content: string
    description: string
  }>
}

function splitReferenceUri(url: string) {
  const [uri, context, hash] = parts(
    url,
    /([^#\?]*)(?:\?context=([^#]*))?(?:#(.*))/
  )
  const uparts: ReferenceUri = { uri, context }
  if (hash) {
    hash.split(";").forEach(p => {
      const [name, value] = p.split("=")
      if (name === "start" || name === "end") {
        const [line, column] = value.split(",")
        if (column) uparts[name] = { line: toInt(line), column: toInt(column) }
      } else if (name === "type" || name === "name")
        uparts[name] = decodeURIComponent(value)
    })
  }
  return uparts
}

export async function usageReferenceSnippets(
  h: AdtHTTP,
  references: UsageReference[]
) {
  const headers = { "Content-Type": "application/*", Accept: "application/*" }
  const refNodes = references
    .filter(r => r.objectIdentifier)
    .reduce(
      (last: string, current) =>
        `${last}<usagereferences:objectIdentifier optional="false">${
          current.objectIdentifier
        }</usagereferences:objectIdentifier>`,
      ""
    )
  const data = `<?xml version="1.0" encoding="UTF-8"?>
  <usagereferences:usageSnippetRequest xmlns:usagereferences="http://www.sap.com/adt/ris/usageReferences">
  <usagereferences:objectIdentifiers>
  ${refNodes}
  </usagereferences:objectIdentifiers>
  <usagereferences:affectedObjects/>
</usagereferences:usageSnippetRequest>`
  const response = await h.request(
    "/sap/bc/adt/repository/informationsystem/usageSnippets",
    {
      method: "POST",
      headers,
      data
    }
  )
  const raw = fullParse(response.data)
  const snippetReferences = xmlArray(
    raw,
    "usageReferences:usageSnippetResult",
    "usageReferences:codeSnippetObjects",
    "usageReferences:codeSnippetObject"
  ).map((o: any) => {
    const snippets = xmlArray(
      o,
      "usageReferences:codeSnippets",
      "usageReferences:codeSnippet"
    ).map((s: any) => {
      const parms = xmlNodeAttr(s)

      const uri = splitReferenceUri(parms.uri)

      return {
        uri: splitReferenceUri(parms.uri),
        matches: parms.matches,
        content: s.content,
        description: s.description
      }
    })
    return { objectIdentifier: o.objectIdentifier, snippets }
  })
  return snippetReferences as UsageReferenceSnippet[]
}

export interface ClassComponent {
  "adtcore:name": string
  "adtcore:type": string
  links: Link[]
  visibility: string
  "xml:base": string
  components: ClassComponent[]
}

const parseElement = (e: any): ClassComponent => {
  const attrs = xmlNodeAttr(e)
  const links = xmlArray(e, "atom:link").map(xmlNodeAttr)
  const components = xmlArray(e, "abapsource:objectStructureElement").map(
    parseElement
  )
  return { ...attrs, links, components }
}

export async function classComponents(h: AdtHTTP, url: string) {
  ValidateObjectUrl(url)
  const uri = `${url}/objectstructure`
  const params = { version: "active", withShortDescriptions: true }
  const headers = { "Content-Type": "application/*" }
  const response = await h.request(uri, { params, headers })
  const raw = fullParse(response.data)
  const header = parseElement(xmlNode(raw, "abapsource:objectStructureElement"))
  return header as ClassComponent
}

export interface FragmentLocation {
  uri: string
  line: number
  column: number
}

export async function fragmentMappings(
  h: AdtHTTP,
  url: string,
  type: string,
  name: string
) {
  ValidateObjectUrl(url)
  const params = { uri: `${url}#type=${type};name=${name}` }
  const headers = { "Content-Type": "application/*" }
  const response = await h.request("/sap/bc/adt/urifragmentmappings", {
    params,
    headers
  })
  const [sourceUrl, line, column] = parts(
    response.data,
    /([^#]*)#start=([\d]+),([\d]+)/
  )
  if (!column) throw adtException("Fragment not found")
  const location: FragmentLocation = {
    uri: sourceUrl,
    line: toInt(line),
    column: toInt(column)
  }
  return location
}
