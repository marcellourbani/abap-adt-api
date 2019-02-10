import { AdtHTTP } from "../AdtHTTP"
import { fullParse, xmlArray } from "../utilities"
import { SyntaxCheckResult } from "./syntax"

export interface SyntaxCheckResult {
  uri: string
  line: number
  offset: number
  severity: string
  text: string
}
// function atob(s: string) {
//   return Buffer.from(s, "base64").toString()
// }
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
        line: Number.parseInt(line, 10),
        offset: Number.parseInt(offset, 10),
        severity: m["@_chkrun:type"],
        text: m["@_chkrun:shortText"]
      })
    }
  })

  return messages
}
