import { parse } from "fast-xml-parser"
import { ValidateObjectUrl, ValidateStateful } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import { xmlArray, btoa } from "../utilities"

export interface AdtLock {
  LOCK_HANDLE: string
  CORRNR: string
  CORRUSER: string
  CORRTEXT: string
  IS_LOCAL: string
  IS_LINK_UP: string
  MODIFICATION_SUPPORT: string
}

export async function getObjectSource(
  h: AdtHTTP,
  objectSourceUrl: string,
  gitUser?: string,
  gitPassword?: string
) {
  ValidateObjectUrl(objectSourceUrl)
  const headers: any = {}
  if (gitUser) headers.Username = gitUser
  if (gitPassword) headers.Password = btoa(gitPassword)
  const response = await h.request(objectSourceUrl, { headers })
  return response.body as string
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
  const qs: any = { lockHandle }
  const ctype = source.match(/^<\?xml\s/i) ? "application/*" : "text/plain; charset=utf-8"
  if (transport) qs.corrNr = transport
  await h.request(objectSourceUrl, {
    body: source,
    headers: { "content-type": ctype },
    method: "PUT",
    qs
  })
}

export async function lock(
  h: AdtHTTP,
  objectUrl: string,
  accessMode: string = "MODIFY"
) {
  ValidateObjectUrl(objectUrl)
  ValidateStateful(h)
  const qs = { _action: "LOCK", accessMode }
  const response = await h.request(objectUrl, {
    headers: {
      Accept:
        "application/*,application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result"
    },
    method: "POST",
    qs
  })
  const raw = parse(response.body)
  const locks = xmlArray(raw, "asx:abap", "asx:values", "DATA")
  return locks[0] as AdtLock
}

export async function unLock(
  h: AdtHTTP,
  objectUrl: string,
  lockHandle: string
) {
  ValidateObjectUrl(objectUrl)
  const qs = {
    _action: "UNLOCK",
    lockHandle: encodeURIComponent(lockHandle)
  }
  const response = await h.request(objectUrl, {
    method: "POST",
    qs
  })
  return response.body
}
