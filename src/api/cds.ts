import { AdtHTTP } from "../AdtHTTP"
import { btoa, fullParse } from "../utilities"
import { parseCheckResults } from "./syntax"

export async function syntaxCheckCDS(
  h: AdtHTTP,
  url: string,
  mainUrl?: string,
  content?: string
) {
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
      body: `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:adtcore="http://www.sap.com/adt/core" xmlns:chkrun="http://www.sap.com/adt/checkrun">
  <chkrun:checkObject adtcore:uri="${url}" chkrun:version="active">${artifacts}</chkrun:checkObject>
</chkrun:checkObjectList>`
    }
  )
  const raw = fullParse(response.body)
  return parseCheckResults(raw)
}
