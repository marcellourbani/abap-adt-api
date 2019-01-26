import { ValidateObjectUrl } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import { fullParse } from "../utilities"

export async function objectRegistrationInfo(h: AdtHTTP, objectUrl: string) {
  ValidateObjectUrl(objectUrl)
  const response = await h.request("/sap/bc/adt/sscr/registration/objects", {
    params: { uri: objectUrl }
  })
  return fullParse(response.data)
}

export async function deleteObject(
  h: AdtHTTP,
  objectUrl: string,
  lockHandle: string
) {
  ValidateObjectUrl(objectUrl)
  // no return value, will throw on failure
  await h.request("/sap/bc/adt/repository/typestructure", {
    method: "DELETE",
    params: { lockHandle }
  })
}
