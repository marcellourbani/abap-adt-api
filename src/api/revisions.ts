import { ValidateObjectUrl } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import { fullParse, xmlArray, xmlNode, xmlNodeAttr } from "../utilities"

export interface Revision {
  uri: string
  date: string
  author: string
  version: string
  versionTitle: string
}

export async function revisions(h: AdtHTTP, objectUrl: string) {
  ValidateObjectUrl(objectUrl)
  const headers = { Accept: "application/*" }

  const response = await h.request(`${objectUrl}/versions`, {
    method: "GET",
    headers
  })

  const raw = fullParse(response.body)
  const versions = xmlArray(raw, "atom:feed", "atom:entry").map(
    (entry: any) => {
      const uri = xmlNode(entry, "atom:content", "@_src") || ""
      const version = xmlNode(entry, "atom:link", "@_adtcore:name") || ""
      const versionTitle = xmlNode(entry, "atom:title") || ""
      const date = xmlNode(entry, "atom:updated") || ""
      const author = xmlNode(entry, "atom:author", "atom:name")
      const r: Revision = { uri, version, versionTitle, date, author }
      return r
    }
  )
  return versions
}
