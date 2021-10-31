import { AdtHTTP, session_types } from "./AdtHTTP"
import { fullParse, xmlArray } from "./utilities"
import { types } from "util";
import axios, { AxiosResponse } from "axios";

const ADTEXTYPEID = Symbol()
const CSRFEXTYPEID = Symbol()
const HTTPEXTYPEID = Symbol()

export enum SAPRC {
  Success = "S",
  Info = "I",
  Warning = "W",
  Error = "E",
  CriticalError = "A",
  Exception = "X"
}
export interface ExceptionProperties {
  conflictText: string;
  ideUser: string;
  "com.sap.adt.communicationFramework.subType": string;
  "T100KEY-ID": string;
  "T100KEY-NO": string;
}


const isResponse = (r: any): r is AxiosResponse => !!r.status

class AdtErrorException extends Error {
  get typeID(): symbol {
    return ADTEXTYPEID
  }

  public static create(resp: AxiosResponse, properties: ExceptionProperties | Record<string, string>): AdtErrorException
  public static create(
    err: number,
    properties: ExceptionProperties | Record<string, string>,
    type: string,
    message: string,
    parent?: Error,
    namespace?: string,
    localizedMessage?: string,
    response?: AxiosResponse
  ): AdtErrorException
  public static create(
    errOrResponse: number | AxiosResponse,
    properties: ExceptionProperties | Record<string, string>,
    type?: string,
    message?: string,
    parent?: Error,
    namespace?: string,
    localizedMessage?: string,
    response?: AxiosResponse
  ): AdtErrorException {
    if (isResponse(errOrResponse)) {
      return this.create(
        errOrResponse.status,
        properties,
        "",
        errOrResponse.statusText || "Unknown error in adt client",
        undefined,
        undefined,
        undefined,
        errOrResponse
      )
    } else {
      return new AdtErrorException(
        errOrResponse,
        properties,
        type!,
        message!,
        parent,
        namespace,
        localizedMessage,
        response
      )
    }
  }

  constructor(
    public readonly err: number,
    public readonly properties: ExceptionProperties | Record<string, string>,
    public readonly type: string,
    public readonly message: string,
    public readonly parent?: Error,
    public readonly namespace?: string,
    public readonly localizedMessage?: string,
    public readonly response?: AxiosResponse
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

export function fromException(errOrResp: unknown): AdtException {
  if (!isResponse(errOrResp) && !types.isNativeError(errOrResp))
    return AdtErrorException.create(500, {}, "Unknown error", `${errOrResp}`) // hopefully will never happen
  if (isAdtException(errOrResp)) return errOrResp
  try {
    if (!axios.isAxiosError(errOrResp)) {
      const response: AxiosResponse = errOrResp as AxiosResponse
      if (!(response && response.data))
        return adtException(
          `Error ${response.status}:${response.statusText}`
        )
      if (
        response.status === 403 &&
        response.headers["x-csrf-token"] === "Required"
      )
        return new AdtCsrfException(response.data as string)

      const raw = fullParse(response.data as string)
      const root = raw["exc:exception"]
      const getf = (base: any, idx: string) => (base ? base[idx] : "")
      const properties: Record<string, string> = {}
      xmlArray(root, "properties", "entry").forEach((p: any) => {
        properties[p["@_key"]] = `${p["#text"]}`.replace(/^\s+/, "").replace(/\s+$/, "")
      })
      return new AdtErrorException(
        response.status,
        properties,
        root.type["@_id"],
        root.message["#text"],
        undefined,
        getf(root.namespace, "@_id"),
        getf(root.localizedMessage, "#text")
      )
    } else {
      const error = new AdtHttpException({ name: errOrResp.name, message: `${errOrResp.message} : ${(errOrResp.response) ? errOrResp.response.data : ''}`, stack: errOrResp.stack })

      return error
    }
  } catch (e) {
    return isResponse(errOrResp)
      ? AdtErrorException.create(errOrResp, {})
      : new AdtHttpException(errOrResp)
  }
}

export function adtException(message: string) {
  return new AdtErrorException(0, {}, "", message)
}

export function ValidateObjectUrl(url: string) {
  if (url.match(/^\/sap\/bc\/adt\/[a-z]+\/[a-zA-Z%\$]?[\w%]+/)) return // valid
  throw new AdtErrorException(0, {}, "BADOBJECTURL", "Invalid Object URL:" + url)
}

export function ValidateStateful(h: AdtHTTP) {
  if (h.isStateful) return
  throw new AdtErrorException(
    0, {},
    "STATELESS",
    "This operation can only be performed in stateful mode"
  )
}
