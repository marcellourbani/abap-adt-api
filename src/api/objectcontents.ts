import { ValidateObjectUrl, ValidateStateful } from "../AdtException"
import { AdtHTTP, RequestOptions } from "../AdtHTTP"
import { xmlArray, btoa, parse } from "../utilities"
import { ObjectVersion } from "./objectstructure"

export interface AdtLock {
  LOCK_HANDLE: string
  CORRNR: string
  CORRUSER: string
  CORRTEXT: string
  IS_LOCAL: string
  IS_LINK_UP: string
  MODIFICATION_SUPPORT: string
}
export interface ObjectSourceOptions {
  version?: ObjectVersion
  gitUser?: string
  gitPassword?: string
}
export async function getObjectSource(
  h: AdtHTTP,
  objectSourceUrl: string,
  options?: ObjectSourceOptions
) {
  ValidateObjectUrl(objectSourceUrl)
  const config: RequestOptions = {}
  const { gitPassword, gitUser, version } = options || {}
  if (gitUser || gitPassword) {
    config.headers = {}
    if (gitUser) config.headers.Username = gitUser
    if (gitPassword) config.headers.Password = btoa(gitPassword)
  }
  if (version) config.qs = { version }
  const response = await h.request(objectSourceUrl, config)
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
  const ctype = source.match(/^<\?xml\s/i)
    ? "application/*"
    : "text/plain; charset=utf-8"
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
