import { isString } from "util"
import { ValidateObjectUrl } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import { fullParse, xmlArray, xmlNodeAttr } from "../utilities"

export interface SearchResult {
  "adtcore:description"?: string
  "adtcore:name": string
  "adtcore:packageName"?: string
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
  objType?: string,
  maxResults: number = 100
) {
  const params: any = { operation: "quickSearch", query, maxResults }
  if (objType) params.objectType = objType.replace(/\/.*$/, "")
  const response = await h.request(
    `/sap/bc/adt/repository/informationsystem/search`,
    { params, headers: { Accept: "application/*" } }
  )
  const raw = fullParse(response.data)
  return xmlArray(
    raw,
    "adtcore:objectReferences",
    "adtcore:objectReference"
  ).map((sr: any) => {
    const result = xmlNodeAttr(sr)
    // older systems return things like "ZREPORT (PROGRAM)"...
    const r = result["adtcore:name"].match(/([^\s]*)\s*\((.*)\)/)
    if (r) {
      result["adtcore:name"] = r[1]
      if (!result["adtcore:description"]) result["adtcore:description"] = r[2]
    }
    return result
  }) as SearchResult[]
}

export async function findObjectPath(h: AdtHTTP, objectUrl: string) {
  ValidateObjectUrl(objectUrl)
  const params = { uri: objectUrl }
  const response = await h.request(`/sap/bc/adt/repository/nodepath`, {
    method: "POST",
    params
  })
  const raw = fullParse(response.data)
  return xmlArray(
    raw,
    "projectexplorer:nodepath",
    "projectexplorer:objectLinkReferences",
    "objectLinkReference"
  ).map(xmlNodeAttr) as PathStep[]
}
