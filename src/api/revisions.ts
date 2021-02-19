import { adtException } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import {
  followUrl,
  fullParse,
  isString,
  xmlArray,
  xmlNode,
  xmlNodeAttr
} from "../utilities"
import {
  AbapObjectStructure,
  classIncludes,
  isClassStructure,
  Link,
  objectStructure
} from "./objectstructure"

export interface Revision {
  uri: string
  date: string
  author: string
  version: string
  versionTitle: string
}

function extractRevisionLink(links: Link[]) {
  return links.find(l => l.rel === "http://www.sap.com/adt/relations/versions")
}

export function getRevisionLink(
  struct: AbapObjectStructure,
  includeName?: classIncludes
) {
  let link
  if (isClassStructure(struct)) {
    const iname = includeName || "main"
    const include = struct.includes.find(i => i["class:includeType"] === iname)
    if (include) link = extractRevisionLink(include.links)
  } else {
    link = extractRevisionLink(struct.links)
  }
  if (link) return followUrl(struct.objectUrl, link.href)
  return ""
}
const extractVersion = (entry: any) => {
  const ADTTYPE = "application/vnd.sap.adt.transportrequests.v1+xml"
  const base = xmlNode(entry, "atom:link")
  if (Array.isArray(base)) {
    const vlink = base.find(l => l["@_type"] === ADTTYPE) || base[0]
    return xmlNode(vlink, "@_adtcore:name") || ""
  }
  else return xmlNode(base, "@_adtcore:name") || ""
}
export async function revisions(
  h: AdtHTTP,
  objectUrl: string | AbapObjectStructure,
  includeName?: classIncludes
) {
  const str = isString(objectUrl)
    ? await objectStructure(h, objectUrl)
    : objectUrl

  const name = str.metaData["adtcore:name"]
  const revisionUrl = getRevisionLink(str, includeName)

  if (!revisionUrl)
    throw adtException(`Revision URL not found for object ${name}`)

  const headers = { Accept: "application/atom+xml;type=feed" }

  const response = await h.request(revisionUrl, {
    method: "GET",
    headers
  })

  const raw = fullParse(response.body)
  const versions = xmlArray(raw, "atom:feed", "atom:entry").map(
    (entry: any) => {
      const uri = xmlNode(entry, "atom:content", "@_src") || ""
      const version = extractVersion(entry)
      const versionTitle = xmlNode(entry, "atom:title") || ""
      const date = xmlNode(entry, "atom:updated") || ""
      const author = xmlNode(entry, "atom:author", "atom:name")
      const r: Revision = { uri, version, versionTitle, date, author }
      return r
    }
  )
  return versions
}
