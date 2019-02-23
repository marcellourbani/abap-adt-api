import { Response } from "request"
import { AdtHTTP, session_types } from "./AdtHTTP"
import { fullParse } from "./utilities"

const ADTEXTYPEID = Symbol()
const CSRFEXTYPEID = Symbol()
const HTTPEXTYPEID = Symbol()

class AdtErrorException extends Error {
  get typeID(): symbol {
    return ADTEXTYPEID
  }
  constructor(
    public readonly err: number,
    public readonly type: string,
    public readonly message: string,
    public readonly parent?: Error,
    public readonly namespace?: string,
    public readonly localizedMessage?: string
  ) {
    super()
  }
}

// tslint:disable-next-line:max-classes-per-file
class AdtCsrfException extends Error {
  get typeID(): symbol {
    return CSRFEXTYPEID
  }
  constructor(public readonly message: string, public readonly parent?: Error) {
    super()
  }
}
// tslint:disable-next-line:max-classes-per-file
class AdtHttpException extends Error {
  get typeID(): symbol {
    return HTTPEXTYPEID
  }
  get code() {
    const p: any = this.parent
    return (p.response && p.response.status) || 0
  }
  get message() {
    return this.parent.message
  }
  get name() {
    return this.parent.name
  }
  constructor(public readonly parent: Error) {
    super()
  }
}

export type AdtException =
  | AdtErrorException
  | AdtCsrfException
  | AdtHttpException

export function isAdtError(e: any): e is AdtErrorException {
  return (e as AdtErrorException).typeID === ADTEXTYPEID
}
export function isCsrfError(e: any): e is AdtErrorException {
  return (e as AdtErrorException).typeID === CSRFEXTYPEID
}
export function isHttpError(e: any): e is AdtHttpException {
  return (e as AdtErrorException).typeID === HTTPEXTYPEID
}
export function isAdtException(e: any): e is AdtException {
  return isAdtError(e) || isCsrfError(e) || isHttpError(e)
}
const isResponse = (r: any): r is Response => !!r.statusCode

export function fromException(errOrResp: Error | Response): AdtException {
  if (isAdtException(errOrResp)) return errOrResp
  try {
    if (isResponse(errOrResp)) {
      const response: Response = errOrResp
      if (!(response && response.body))
        return adtException(
          `Error ${response.statusCode}:${response.statusMessage}`
        )
      if (
        response.statusCode === 403 &&
        response.headers["x-csrf-token"] === "Required"
      )
        return new AdtCsrfException(response.body)

      const raw = fullParse(response.body)
      const root = raw["exc:exception"]
      const getf = (base: any, idx: string) => (base ? base[idx] : "")
      return new AdtErrorException(
        response.statusCode,
        root.type["@_id"],
        root.message["#text"],
        undefined,
        getf(root.namespace, "@_id"),
        getf(root.localizedMessage, "#text")
      )
    } else return new AdtHttpException(errOrResp)
  } catch (e) {
    return isResponse(errOrResp)
      ? adtException("Unknown error in adt client")
      : new AdtHttpException(errOrResp)
  }
}

export function adtException(message: string) {
  return new AdtErrorException(0, "", message)
}

export function ValidateObjectUrl(url: string) {
  if (url.match(/^\/sap\/bc\/adt\/[a-z]+\/[a-z]+/)) return // valid
  throw new AdtErrorException(0, "BADOBJECTURL", "Invalid Object URL:" + url)
}

export function ValidateStateful(h: AdtHTTP) {
  if (h.isStateful) return
  throw new AdtErrorException(
    0,
    "STATELESS",
    "This operation can only be performed in stateful mode"
  )
}
