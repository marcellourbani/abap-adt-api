import { AdtHTTP, HttpClientResponse } from "./AdtHTTP"
import { fullParse, isNativeError, isNumber, isObject, isString, xmlArray } from "./utilities"
import axios, { AxiosResponse, AxiosError } from "axios";
import { isLeft } from "fp-ts/lib/These"
import * as t from "io-ts"
import reporter from "io-ts-reporters";

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


const isResponse = (r: any): r is HttpClientResponse => isObject(r) && !!r?.status && isString(r?.statusText)

class AdtErrorException extends Error {
  get typeID(): symbol {
    return ADTEXTYPEID
  }

  public static create(resp: HttpClientResponse, properties: ExceptionProperties | Record<string, string>): AdtErrorException
  public static create(
    err: number,
    properties: ExceptionProperties | Record<string, string>,
    type: string,
    message: string,
    parent?: Error,
    namespace?: string,
    localizedMessage?: string,
    response?: HttpClientResponse
  ): AdtErrorException
  public static create(
    errOrResponse: number | HttpClientResponse,
    properties: ExceptionProperties | Record<string, string>,
    type?: string,
    message?: string,
    parent?: Error,
    namespace?: string,
    localizedMessage?: string,
    response?: HttpClientResponse
  ): AdtErrorException {
    if (!isNumber(errOrResponse)) {
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
    public readonly response?: HttpClientResponse
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

export function isAdtError(e: unknown): e is AdtErrorException {
  return (e as any)?.typeID === ADTEXTYPEID
}
export function isCsrfError(e: unknown): e is AdtCsrfException {
  return (e as any)?.typeID === CSRFEXTYPEID
}
export function isHttpError(e: unknown): e is AdtHttpException {
  return (e as any)?.typeID === HTTPEXTYPEID
}
export function isAdtException(e: unknown): e is AdtException {
  return isAdtError(e) || isCsrfError(e) || isHttpError(e)
}



const simpleError = (response: HttpClientResponse | AxiosResponse) => adtException(`Error ${response.status}:${response.statusText}`, response.status)

const isCsrfException = (r: HttpClientResponse) => (r.status === 403 && r.headers["x-csrf-token"] === "Required")
  || (r.status === 400 && r.statusText === "Session timed out") // hack to get login refresh to work on expired sessions

export const fromResponse = (data: string, response: HttpClientResponse | AxiosResponse) => {
  if (!data) return simpleError(response)
  if (data.match(/CSRF/)) return new AdtCsrfException(data)
  const raw = fullParse(data as string)
  const root = raw["exc:exception"]
  if (!root) return simpleError(response)
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
}

const axiosErrorBody = (e: AxiosError): string => e.response?.data ? `${e.response.data}` : ""

export const fromError = (error: unknown): AdtException => {
  try {
    if (isAdtError(error)) return error

    if (axios.isAxiosError(error) && error.response)
      return fromResponse(axiosErrorBody(error), error.response)

    if (isObject(error) && "message" in error && isString(error?.message)) return new AdtErrorException(500, {}, "", error.message)
  } catch (error) { }
  return AdtErrorException.create(500, {}, "Unknown error", `${error}`) // hopefully will never happen
}

function fromExceptionOrResponse_int(errOrResp: HttpClientResponse | unknown): AdtException {
  try {
    if (isResponse(errOrResp)) return fromResponse(errOrResp.body, errOrResp)
    else return fromError(errOrResp)
  } catch (e) {
    return isResponse(errOrResp)
      ? AdtErrorException.create(errOrResp, {})
      : fromError(e)
  }
}

export function fromException(errOrResp: unknown): AdtException {
  if (isAdtException(errOrResp)) return errOrResp
  if (!isResponse(errOrResp)
    && (!isNativeError(errOrResp)
      || (isNativeError(errOrResp) && !axios.isAxiosError(errOrResp))))
    return AdtErrorException.create(500, {}, "Unknown error", `${errOrResp}`) // hopefully will never happen
  return fromExceptionOrResponse_int(errOrResp)
}

export function adtException(message: string, number = 0) {
  return new AdtErrorException(number, {}, "", message)
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
export const validateParseResult = <T>(parseResult: t.Validation<T>): T => {
  if (isLeft(parseResult)) {
    const messages = reporter.report(parseResult)
    throw adtException(messages.slice(0, 3).join("\n"))
  }
  return parseResult.right
}

export const isErrorMessageType = (x: string | SAPRC | undefined) => !!`${x}`.match(/^[EAX]$/i)