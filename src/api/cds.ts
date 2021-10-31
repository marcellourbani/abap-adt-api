import { AdtHTTP } from "../AdtHTTP"
import {
  btoa,
  formatQS,
  fullParse,
  isArray,
  toInt,
  xmlArray,
  xmlNode,
  xmlNodeAttr
} from "../utilities"
import { parseCheckResults, SyntaxCheckResult } from "./syntax"

export async function syntaxCheckCDS(
  h: AdtHTTP,
  url: string,
  mainUrl?: string,
  content?: string
): Promise<SyntaxCheckResult[]> {
  const artifacts =
    mainUrl && content
      ? `<chkrun:artifacts>
  <chkrun:artifact chkrun:contentType="text/plain; charset=utf-8" chkrun:uri="${mainUrl}">
      <chkrun:content>${btoa(content)}</chkrun:content>
  </chkrun:artifact>
</chkrun:artifacts>`
      : ""
  const response = await h.request(
    "/sap/bc/adt/checkruns?reporters=abapCheckRun",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/vnd.sap.adt.checkobjects+xml",
        Accept: "application/vnd.sap.adt.checkmessages+xml"
      },
      data: `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:adtcore="http://www.sap.com/adt/core" xmlns:chkrun="http://www.sap.com/adt/checkrun">
  <chkrun:checkObject adtcore:uri="${url}" chkrun:version="active">${artifacts}</chkrun:checkObject>
</chkrun:checkObjectList>`
    }
  )
  const raw = fullParse(response.body)
  return parseCheckResults(raw)
}

export async function annotationDefinitions(h: AdtHTTP) {
  const headers = {
    Accept:
      "application/vnd.sap.adt.cds.annotation.definitions.v1+xml, application/vnd.sap.adt.cds.annotation.definitions.v2+xml"
  }
  const response = await h.request(
    "/sap/bc/adt/ddic/cds/annotation/definitions",
    { headers }
  )
  const raw = fullParse(response.body)
  return xmlNode(raw, "cds:annotation", "cds:definitions") as string
}

export interface DdicAnnotation {
  key: string
  value: string
}
export interface DdicProperties {
  elementProps?: {
    ddicIsKey: boolean
    ddicDataElement: string
    ddicDataType: string
    ddicLength: number
    ddicDecimals?: number
    ddicHeading?: string
    ddicLabelShort?: string
    ddicLabelMedium?: string
    ddicLabelLong?: string
    ddicHeadingLength?: number
    ddicLabelShortLength?: number
    ddicLabelMediumLength?: number
    ddicLabelLongLength?: number
    parentName?: string
  }
  annotations: DdicAnnotation[]
}
export interface DdicElement {
  type: string
  name: string
  properties: DdicProperties
  children: DdicElement[]
}

function parseDDICProps(raw: any) {
  const converted = xmlArray(raw, "abapsource:entry").reduce(
    (prev: any, cur: any) => {
      const key = cur["@_abapsource:key"]
      const value = cur["#text"]
      prev[key] = value
      return prev
    },
    {}
  ) as any
  const {
    ddicIsKey,
    ddicDataElement,
    ddicDataType,
    ddicLength,
    ddicDecimals,
    ddicHeading,
    ddicLabelShort,
    ddicLabelMedium,
    ddicLabelLong,
    ddicHeadingLength,
    ddicLabelShortLength,
    ddicLabelMediumLength,
    ddicLabelLongLength,
    parentName,
    ...rawanno
  } = converted
  const elementProps = (ddicDataType || ddicDataType === "") && {
    ddicIsKey: !!ddicIsKey,
    ddicDataElement,
    ddicDataType,
    ddicLength,
    ddicDecimals,
    ddicHeading,
    ddicLabelShort,
    ddicLabelMedium,
    ddicLabelLong,
    ddicHeadingLength,
    ddicLabelShortLength,
    ddicLabelMediumLength,
    ddicLabelLongLength,
    parentName
  }
  const annotations: DdicAnnotation[] = []

  // tslint:disable-next-line: forin
  for (const key in rawanno) {
    const match = key.match(/annotation(Key|Value).([0-9]+)/)
    if (match && match.groups) {
      const mtype = match.groups[1]
      const idx = toInt(match.groups[2])
      const anno = annotations[idx] || { key: "", value: "" }
      if (mtype === "Key") anno.key = rawanno[key]
      else anno.value = rawanno[key]
      annotations[idx] = anno
    }
  }
  return {
    elementProps,
    annotations
  } as DdicProperties
}

function parseDdicElement(raw: any) {
  const type = raw["@_adtcore:type"] as string
  const name = raw["@_adtcore:name"] as string
  const properties = parseDDICProps(raw["abapsource:properties"])
  const children = xmlArray(raw, "abapsource:elementInfo").map(
    parseDdicElement
  ) as DdicElement[]
  return { type, name, properties, children } as DdicElement
}

export async function ddicElement(
  h: AdtHTTP,
  path: string | string[],
  getTargetForAssociation = false,
  getExtensionViews = true,
  getSecondaryObjects = true
) {
  const headers = { Accept: "application/vnd.sap.adt.elementinfo+xml" }
  const params = formatQS({
    getTargetForAssociation,
    getExtensionViews,
    getSecondaryObjects,
    path
  })
  const uri = `/sap/bc/adt/ddic/ddl/elementinfo?${params}`
  const response = await h.request(uri, { headers })
  const raw = fullParse(response.body)
  return parseDdicElement(raw["abapsource:elementInfo"])
}
export interface DdicObjectReference {
  uri: string
  type: string
  name: string
  path: string
}

export async function ddicRepositoryAccess(
  h: AdtHTTP,
  path: string | string[]
) {
  const headers = { Accept: "application/*" }
  const params = isArray(path)
    ? formatQS({ requestScope: "all", path })
    : `datasource=${encodeURIComponent(path)}`
  const url = `/sap/bc/adt/ddic/ddl/ddicrepositoryaccess?${params}`
  const response = await h.request(url, { headers })
  const raw = fullParse(response.body)
  const records = raw["adtcore:objectReferences"]
    ? xmlArray(raw, "adtcore:objectReferences", "adtcore:objectReference")
    : xmlArray(raw, "ddl:ddlObjectReferences", "ddl:ddlObjectReference")
  return records.map(r => {
    const attr = xmlNodeAttr(r)
    return {
      uri: attr["adtcore:uri"] || "",
      type: attr["adtcore:type"] || "",
      name: attr["adtcore:name"] || "",
      path: attr["ddl:path"] || ""
    } as DdicObjectReference
  })
}

async function publishUnpublishServiceBinding(h: AdtHTTP, base: string, name: string, version: string) {
  const headers = { Accept: "application/*" }
  const params = `servicename=${encodeURIComponent(name)}&serviceversion=${version}`
  const url = `/sap/bc/adt/businessservices/odatav2/${base}?${params}`
  const data = `<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:name="${name}"/>
  </adtcore:objectReferences>`
  const response = await h.request(url, { headers, method: "POST", data })
  const raw = fullParse(response.body)
  const resData = xmlNode(raw, "asx:abap/asx:values/DATA")
  const severity: string = xmlNode(resData, "SEVERITY")
  const shortText: string = xmlNode(resData, "SHORT_TEXT")
  const longText: string = xmlNode(resData, "LONG_TEXT")
  return { severity, shortText, longText }
}

export async function publishServiceBinding(h: AdtHTTP, name: string, version: string) {
  return publishUnpublishServiceBinding(h, "publishjobs", name, version)
}
export async function unpublishServiceBinding(h: AdtHTTP, name: string, version: string) {
  return publishUnpublishServiceBinding(h, "unpublishjobs", name, version)
}
