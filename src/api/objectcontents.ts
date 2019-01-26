import { parse } from "fast-xml-parser"
import { ValidateObjectUrl, ValidateStateful } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import { xmlArray } from "../utilities"

export interface AdtLock {
  LOCK_HANDLE: string
  CORRNR: string
  CORRUSER: string
  CORRTEXT: string
  IS_LOCAL: string
  IS_LINK_UP: string
  MODIFICATION_SUPPORT: string
}

export async function getObjectSource(h: AdtHTTP, objectSourceUrl: string) {
  ValidateObjectUrl(objectSourceUrl)
  const response = await h.request(objectSourceUrl)
  return response.data
}

export async function setObjectSource(
  h: AdtHTTP,
  objectSourceUrl: string,
  source: string,
  lockHandle: string,
  transport?: string
) {
  ValidateObjectUrl(objectSourceUrl)
  ValidateStateful(h)
  const params: any = { lockHandle }
  // const params: any = { lockHandle: encodeURIComponent(lockHandle) }
  if (transport) params.corrNR = transport
  const response = await h.request(objectSourceUrl, {
    data: source,
    headers: { "content-type": "text/plain; charset=utf-8" },
    method: "PUT",
    params
  })
  return response.data
}

export async function lock(
  h: AdtHTTP,
  objectUrl: string,
  accessMode: string = "MODIFY"
) {
  ValidateObjectUrl(objectUrl)
  ValidateStateful(h)
  const params = { _action: "LOCK", accessMode }
  const response = await h.request(objectUrl, {
    method: "POST",
    params
  })
  const raw = parse(response.data)
  const locks = xmlArray(raw, "asx:abap", "asx:values", "DATA")
  return locks[0] as AdtLock
}

export async function unLock(
  h: AdtHTTP,
  objectUrl: string,
  lockHandle: string
) {
  ValidateObjectUrl(objectUrl)
  const params = {
    _action: "UNLOCK",
    lockHandle: encodeURIComponent(lockHandle)
  }
  const response = await h.request(objectUrl, {
    method: "POST",
    params
  })
  return response.data
}
