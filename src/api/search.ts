import { parse } from "fast-xml-parser"
import { ValidateObjectUrl } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import { xmlArray, xmlNodeAttr } from "../utilities"

export interface SearchResult {
  "adtcore:description": string
  "adtcore:name": string
  "adtcore:packageName": string
  "adtcore:type": string
  "adtcore:uri": string
}

export interface PathStep {
  "adtcore:name": string
  "adtcore:type": string
  "adtcore:uri": string
  "projectexplorer:category": string
}

export async function searchObject(
  h: AdtHTTP,
  query: string,
  objType?: string
) {
  const params: any = { operation: "quickSearch", query }
  if (objType) params.objType = objType
  const response = await h.request(
    `/sap/bc/adt/repository/informationsystem/search`,
    { params }
  )
  const raw = parse(response.data, {
    ignoreAttributes: false,
    parseAttributeValue: true
  })
  return xmlArray(
    raw,
    "adtcore:objectReferences",
    "adtcore:objectReference"
  ).map(xmlNodeAttr) as SearchResult[]
}

export async function findObjectPath(h: AdtHTTP, objectUrl: string) {
  ValidateObjectUrl(objectUrl)
  const params = { uri: objectUrl }
  const response = await h.request(`/sap/bc/adt/repository/nodepath`, {
    method: "POST",
    params
  })
  const raw = parse(response.data, {
    ignoreAttributes: false,
    parseAttributeValue: true
  })
  return xmlArray(
    raw,
    "projectexplorer:nodepath",
    "projectexplorer:objectLinkReferences",
    "objectLinkReference"
  ).map(xmlNodeAttr) as PathStep[]
}
