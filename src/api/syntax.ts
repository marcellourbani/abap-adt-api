import { parse } from "fast-xml-parser"
import { adtException, ValidateObjectUrl } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import {
  btoa,
  decodeEntity,
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
export async function syntaxCheckTypes(h: AdtHTTP) {
  const response = await h.request("/sap/bc/adt/checkruns/reporters")
  const raw = fullParse(response.body)
  const reporters = xmlArray(
    raw,
    "chkrun:checkReporters",
    "chkrun:reporter"
  ).reduce((acc: Map<string, string[]>, cur: any) => {
    acc.set(cur["@_chkrun:name"], xmlArray(cur, "chkrun:supportedType"))
    return acc
  }, new Map<string, string[]>())
  return reporters
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
    ? `${sourceUrl}?context=${encodeURIComponent(mainProgram)}`
    : sourceUrl
  const body = `<?xml version="1.0" encoding="UTF-8"?>
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
    { method: "POST", headers, body }
  )
  const raw = fullParse(response.body)
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
  KIND: number
  IDENTIFIER: string
  ICON: number
  SUBICON: number
  BOLD: number
  COLOR: number
  QUICKINFO_EVENT: number
  INSERT_EVENT: number
  IS_META: number
  PREFIXLENGTH: number
  ROLE: number
  LOCATION: number
  GRADE: number
  VISIBILITY: number
  IS_INHERITED: number
  PROP1: number
  PROP2: number
  PROP3: number
  SYNTCNTXT: number
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
  body: string,
  line: number,
  offset: number
) {
  const uri = `${url}#start=${line},${offset}`
  const qs = { uri, signalCompleteness: true }
  const headers = { "Content-Type": "application/*" }
  const response = await h.request(
    "/sap/bc/adt/abapsource/codecompletion/proposal",
    { method: "POST", qs, headers, body }
  )
  const raw = parse(response.body)
  const proposals = xmlArray(
    raw,
    "asx:abap",
    "asx:values",
    "DATA",
    "SCC_COMPLETION"
  )
    .filter((p: any) => p.IDENTIFIER && p.IDENTIFIER !== "@end")
    .map((p: any) => ({
      ...p,
      IDENTIFIER: decodeEntity(p.IDENTIFIER)
    })) as CompletionProposal[]
  return proposals
}

export async function codeCompletionFull(
  h: AdtHTTP,
  url: string,
  body: string,
  line: number,
  offset: number,
  patternKey: string
) {
  const uri = `${url}#start=${line},${offset}`
  const qs = { uri, patternKey }
  const headers = { "Content-Type": "application/*" }
  const response = await h.request(
    "/sap/bc/adt/abapsource/codecompletion/insertion",
    { method: "POST", qs, headers, body }
  )
  return response.body
}

function extractDocLink(raw: any): string {
  const link =
    xmlNode(raw, "abapsource:elementInfo", "atom:link", "@_href") || ""
  return decodeEntity(link.replace(/\w+:\/\/[^\/]*/, ""))
}

export async function codeCompletionElement(
  h: AdtHTTP,
  url: string,
  body: string,
  line: number,
  offset: number
): Promise<CompletionElementInfo | string> {
  const qs = { uri: `${url}#start=${line},${offset}` }
  const headers = { "Content-Type": "application/*", Accept: "application/*" }

  const response = await h.request(
    "/sap/bc/adt/abapsource/codecompletion/elementinfo",
    { method: "POST", qs, headers, body }
  )
  const raw = fullParse(response.body)
  if (!xmlNode(raw, "abapsource:elementInfo")) return response.body
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
  body: string,
  line: number,
  firstof: number,
  lastof: number,
  implementation: boolean,
  mainProgram?: string
) {
  const ctx = mainProgram ? `?context=${encodeURIComponent(mainProgram)}` : ""
  const qs: any = {
    uri: `${url}${ctx}#start=${line},${firstof};end=${line},${lastof}`,
    filter: implementation ? "implementation" : "definition"
  }
  const headers = { "Content-Type": "text/plain", Accept: "application/*" }
  const response = await h.request("/sap/bc/adt/navigation/target", {
    method: "POST",
    qs,
    headers,
    body
  })
  const raw = fullParse(response.body)
  const rawLink = xmlNode(raw, "adtcore:objectReference", "@_adtcore:uri") || ""
  const match = rawLink.match(/([^#]+)#start=(\d+),(\d+)/)
  return {
    url: (match && match[1]) || rawLink,
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
  const qs = { uri }
  const body = `<?xml version="1.0" encoding="ASCII"?>
  <usagereferences:usageReferenceRequest xmlns:usagereferences="http://www.sap.com/adt/ris/usageReferences">
    <usagereferences:affectedObjects/>
  </usagereferences:usageReferenceRequest>`
  const response = await h.request(
    "/sap/bc/adt/repository/informationsystem/usageReferences",
    {
      method: "POST",
      qs,
      headers,
      body
    }
  )
  const raw = fullParse(response.body)
  const rawreferences = xmlArray(
    raw,
    "usageReferences:usageReferenceResult",
    "usageReferences:referencedObjects",
    "usageReferences:referencedObject"
  )
  const references = rawreferences.map((r: any) => {
    const reference = {
      ...xmlNodeAttr(r),
      ...xmlNodeAttr(xmlNode(r, "usageReferences:adtObject") || {}),
      packageRef: xmlNodeAttr(
        xmlNode(r, "usageReferences:adtObject", "adtcore:packageRef") || {}
      ),
      objectIdentifier: r.objectIdentifier || ""
    } as UsageReference

    // older systems hide the type in the URI
    if (!reference["adtcore:type"]) {
      const uriParts = splitReferenceUri(reference.uri, "")
      reference["adtcore:type"] = uriParts.type
    }

    return reference
  })
  return references
}
export interface Location {
  line: number
  column: number
}
export interface ReferenceUri {
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

function splitReferenceUri(url: string, matches: string) {
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
        if (line) uparts[name] = { line: toInt(line), column: toInt(column) }
      } else if (name === "type" || name === "name")
        uparts[name] = decodeURIComponent(value)
    })
  }
  const [start, end] = parts(matches, /(\d+)-(\d+)/)
  if (!uparts.start) uparts.start = { line: 0, column: toInt(start) }
  if (!uparts.start.column) uparts.start.column = toInt(start)
  if (!uparts.end)
    uparts.end = {
      line: uparts.start.line,
      column: toInt(end) || uparts.start.column
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
  const body = `<?xml version="1.0" encoding="UTF-8"?>
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
      body
    }
  )
  const raw = fullParse(response.body)
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

      const uri = splitReferenceUri(parms.uri, parms.matches)

      return {
        uri,
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
  constant?: boolean
  level?: string
  readOnly?: boolean
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
  const qs = { version: "active", withShortDescriptions: true }
  const headers = { "Content-Type": "application/*" }
  const response = await h.request(uri, { qs, headers })
  const raw = fullParse(response.body)
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
  const qs = { uri: `${url}#type=${type};name=${name}` }
  const headers = { "Content-Type": "application/*" }
  const response = await h.request("/sap/bc/adt/urifragmentmappings", {
    qs,
    headers
  })
  const [sourceUrl, line, column] = parts(
    response.body,
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

export type PrettyPrinterStyle =
  | "toLower"
  | "toUpper"
  | "keywordUpper"
  | "keywordLower"
  | "keywordAuto"
  | "none"
export interface PrettyPrinterSettings {
  "abapformatter:indentation": boolean
  "abapformatter:style": PrettyPrinterStyle
}

export async function prettyPrinterSetting(h: AdtHTTP) {
  const response = await h.request(
    "/sap/bc/adt/abapsource/prettyprinter/settings"
  )
  const raw = fullParse(response.body)
  const settings = xmlNodeAttr(raw["abapformatter:PrettyPrinterSettings"])
  return settings as PrettyPrinterSettings
}

export async function setPrettyPrinterSetting(
  h: AdtHTTP,
  indent: boolean,
  style: PrettyPrinterStyle
) {
  const headers = { "Content-Type": "application/*" }
  const body = `<?xml version="1.0" encoding="UTF-8"?><prettyprintersettings:PrettyPrinterSettings
xmlns:prettyprintersettings="http://www.sap.com/adt/prettyprintersettings"
prettyprintersettings:indentation="${indent}" prettyprintersettings:style="${style}"/>`
  const response = await h.request(
    "/sap/bc/adt/abapsource/prettyprinter/settings",
    { method: "PUT", headers, body }
  )
  return response.body || ""
}

export async function prettyPrinter(h: AdtHTTP, body: string) {
  const headers = { "Content-Type": "text/plain", Accept: "text/plain" }
  const response = await h.request("/sap/bc/adt/abapsource/prettyprinter", {
    method: "POST",
    headers,
    body
  })

  return (response.body || body).toString()
}

export interface HierarchyNode {
  hasDefOrImpl: boolean
  uri: string
  line: number
  character: number
  type: string
  name: string
  parentUri: string
  description: string
}

export async function typeHierarchy(
  h: AdtHTTP,
  url: string,
  body: string,
  line: number,
  offset: number,
  superTypes = false
) {
  const qs = {
    uri: `${url}#start=${line},${offset}`,
    type: superTypes ? "superTypes" : "subTypes"
  }
  const headers = { "Content-Type": "text/plain", Accept: "application/*" }
  const response = await h.request("/sap/bc/adt/abapsource/typehierarchy", {
    method: "POST",
    qs,
    headers,
    body
  })

  const raw = fullParse(response.body)
  const hierarchy = xmlArray(raw, "hierarchy:info", "entries", "entry").map(
    he => {
      const rawh = xmlNodeAttr(he)
      const [uri, srcline, character] = parts(
        rawh["adtcore:uri"],
        /([^#]+)(?:#start=(\d+)(?:,(\d+))?)?/
      )
      const node: HierarchyNode = {
        hasDefOrImpl: rawh.hasDefOrImpl,
        uri,
        line: toInt(srcline),
        character: toInt(character),
        type: rawh["adtcore:type"] || "",
        name: rawh["adtcore:name"] || "",
        parentUri: rawh["adtcore:parentUri"] || "",
        description: rawh["adtcore:description"] || ""
      }
      return node
    }
  )
  return hierarchy
}
