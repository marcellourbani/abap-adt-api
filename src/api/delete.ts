import { ValidateObjectUrl, ValidateStateful } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import { fullParse, xmlNodeAttr } from "../utilities"

// /sap/bc/adt/sscr/registration/objects?uri=%2Fsap%2Fbc%2Fadt%2Ffunctions%2Fgroups%2Fzfoo HTTP/1.1
// <?xml version="1.0" encoding="UTF-8"?><reg:objectRegistrationResponse
// xmlns:reg="http://www.sap.com/adt/registration" reg:release="752" reg:installationNumber="DEMOSYSTEM">
//   <reg:object reg:isRequired="false" reg:accessKey="" reg:transportPGMID="R3TR"
// reg:transportType="FUGR" reg:transportName="ZFOO">
//     <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="https://service.sap.com/sap/bc/bsp/spn/sscr/intro.htm"
// rel="http://www.sap.com/adt/relations/sscr/registration" type="text/html"
// title="Object Registration in SAP Support Portal is required"/>
//   </reg:object>
//   <reg:developer reg:isRequired="false" reg:name="DEVELOPER" reg:accessKey="35408798513176413512">
//     <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="https://service.sap.com/sap/bc/bsp/spn/sscr/intro.htm"
// rel="http://www.sap.com/adt/relations/sscr/registration"
//  type="text/html" title="User Registration in SAP Support Portal is required"/>
//   </reg:developer>
// </reg:objectRegistrationResponse>
export interface RegistrationInfo {
  developer: {
    "reg:isRequired": boolean
    "reg:name": string
    "reg:accessKey": number
  }
  object: {
    "reg:isRequired": boolean
    "reg:accessKey": string
    "reg:transportPGMID": string
    "reg:transportType": string
    "reg:transportName": string
  }
  "reg:release": number
  "reg:installationNumber": string
}
export async function objectRegistrationInfo(h: AdtHTTP, objectUrl: string) {
  ValidateObjectUrl(objectUrl)
  const response = await h.request("/sap/bc/adt/sscr/registration/objects", {
    params: { uri: objectUrl }
  })
  const raw = fullParse(response.data)["reg:objectRegistrationResponse"]
  return {
    developer: xmlNodeAttr(raw["reg:developer"]),
    object: xmlNodeAttr(raw["reg:object"]),
    ...(xmlNodeAttr(raw) as RegistrationInfo)
  }
}

export async function deleteObject(
  h: AdtHTTP,
  objectUrl: string,
  lockHandle: string
) {
  ValidateObjectUrl(objectUrl)
  ValidateStateful(h)
  // no return value, will throw on failure
  await h.request(objectUrl, {
    method: "DELETE",
    params: { lockHandle }
  })
}
