import { ValidateObjectUrl, ValidateStateful } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import { fullParse, xmlNodeAttr } from "../utilities"

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
  const raw = fullParse(response.body)["reg:objectRegistrationResponse"]
  return {
    developer: xmlNodeAttr(raw["reg:developer"]),
    object: xmlNodeAttr(raw["reg:object"]),
    ...xmlNodeAttr(raw)
  } as RegistrationInfo
}

export async function deleteObject(
  h: AdtHTTP,
  objectUrl: string,
  lockHandle: string,
  transport?: string
) {
  ValidateObjectUrl(objectUrl)
  ValidateStateful(h)
  const params: any = { lockHandle }
  if (transport) params.corrNr = transport
  const method = "DELETE"
  // no return value, will throw on failure
  await h.request(objectUrl, { method, params })
}
