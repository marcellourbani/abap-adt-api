import {
  AdtHTTP,
  HttpClientException,
  HttpClientResponse,
  isHttpClientException,
  RequestOptions
} from "./AdtHTTP"
import {
  fullParse,
  hasMessage,
  isNativeError,
  isNumber,
  isObject,
  isString,
  xmlArray
} from "./utilities"
import { Result, Schema } from "effect"
import type { AdtSessionFailureReason } from "./AdtSession"
const ADTEXTYPEID = Symbol.for("ADT EXCEPTION")
const CSRFEXTYPEID = Symbol.for("BAD CSRF")
const HTTPEXTYPEID = Symbol.for("HTTP EXCEPTION")
const SESSIONEXTYPEID = Symbol.for("ADT SESSION FAILURE")

export enum SAPRC {
  Success = "S",
  Info = "I",
  Warning = "W",
  Error = "E",
  CriticalError = "A",
  Exception = "X"
}
export interface ExceptionProperties {
  conflictText: string
  ideUser: string
  "com.sap.adt.communicationFramework.subType": string
  "T100KEY-ID": string
  "T100KEY-NO": string
}

const isResponse = (r: any): r is HttpClientResponse =>
  isObject(r) && !!r?.status && isString(r?.statusText)

export class AdtErrorException extends Error {
  get typeID(): symbol {
    return ADTEXTYPEID
  }

  public static create(
    resp: HttpClientResponse,
    properties: ExceptionProperties | Record<string, string>
  ): AdtErrorException
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
  constructor(
    public readonly message: string,
    public readonly parent?: Error
  ) {
    super()
  }
}
// tslint:disable-next-line:max-classes-per-file
class AdtHttpException extends Error {
  get typeID(): symbol {
    return HTTPEXTYPEID
  }
  get status(): number {
    if (isHttpClientException(this.parent)) return this.parent.status || 0
    const p: any = this.parent
    const status = p?.response?.status
    return isNumber(status) ? status : 0
  }
  get code() {
    const p: any = this.parent
    if (isHttpClientException(p)) return p.code
    return undefined
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
  | AdtSessionFailure

// tslint:disable-next-line:max-classes-per-file
/** The session could not be (re)established or the request could not safely be replayed */
export class AdtSessionFailure extends Error {
  get typeID(): symbol {
    return SESSIONEXTYPEID
  }
  get status(): number {
    if (isAdtError(this.parent)) return this.parent.err
    return isHttpError(this.parent) ? this.parent.status : 0
  }
  get response(): HttpClientResponse | undefined {
    return isAdtError(this.parent) ? this.parent.response : undefined
  }
  constructor(
    public readonly reason: AdtSessionFailureReason,
    /** false if the failure happened before anything was sent */
    public readonly requestSent: boolean,
    public readonly parent?: AdtException
  ) {
    super(`Authentication failed (${reason})`)
  }
}

export function isAdtError(e: unknown): e is AdtErrorException {
  return (e as any)?.typeID === ADTEXTYPEID
}
export function isCsrfError(e: unknown): e is AdtCsrfException {
  return (e as any)?.typeID === CSRFEXTYPEID
}
export function isHttpError(e: unknown): e is AdtHttpException {
  return (e as any)?.typeID === HTTPEXTYPEID
}
export function isAdtSessionFailure(e: unknown): e is AdtSessionFailure {
  return (e as any)?.typeID === SESSIONEXTYPEID
}
export function isAdtException(e: unknown): e is AdtException {
  return (
    isAdtError(e) || isCsrfError(e) || isHttpError(e) || isAdtSessionFailure(e)
  )
}
export const isLoginError = (adtErr: AdtException) =>
  (isHttpError(adtErr) && adtErr.status === 401) || isCsrfError(adtErr)

/** Transport independent: true for 401s, CSRF/session expiry and failed renewals */
export function isAuthenticationFailure(e: unknown): boolean {
  if (isAdtSessionFailure(e)) return true
  return isLoginError(fromException(e))
}

const simpleError = (response: HttpClientResponse) =>
  adtException(
    `Error ${response.status}:${response.statusText}`,
    response.status
  )

const isCsrfException = (r: HttpClientResponse) =>
  (r.status === 403 &&
    `${r.headers["x-csrf-token"]}`.toLowerCase() === "required") ||
  // expired-session POSTs come back as 400; the statusText wording varies
  // ("Session timed out", localized variants) — treat any bare 400 whose
  // body is not an ADT exception XML as a session refresh candidate
  (r.status === 400 &&
    // ICM error pages are also bare 400s, but upstream contract preserves
    // the HttpClientException status/code for them; only ICM sets these
    !r.headers["x-sap-icm-err-id"] &&
    !r.headers["sap-err-id"] &&
    !r.body?.match(/exc:exception/) &&
    /\bsession\b/i.test(`${r.body ?? ""} ${r.statusText ?? ""}`))
export const fromResponse = (data: string, response: HttpClientResponse) => {
  // CSRF/session-expired classification must precede the empty-body
  // short-circuit: SAP rejects expired-session POSTs with an empty-ish
  // 403/400 body, which used to fall into simpleError and never reach
  // the request() re-login path
  if (isCsrfException(response))
    return new AdtCsrfException(`Session expired (${response.status})`)
  if (!data) return simpleError(response)
  if (data.match(/CSRF/)) return new AdtCsrfException(data)
  const raw = fullParse(data as string)
  const root = raw["exc:exception"]
  if (!root && response.status === 401) return simpleError(response)
  const getf = (base: any, idx: string) => (base ? base[idx] : "")
  const properties: Record<string, string> = {}
  xmlArray(root, "properties", "entry").forEach((p: any) => {
    properties[p["@_key"]] = `${p["#text"]}`
      .replace(/^\s+/, "")
      .replace(/\s+$/, "")
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

export const fromError = (error: unknown): AdtException => {
  try {
    if (isAdtError(error)) return error

    if (isHttpClientException(error)) {
      if (error.response) {
        if (error.status === 401) return new AdtHttpException(error)
        // expired-session 400s must surface as CSRF exceptions so the
        // request() retry path (isLoginError) re-logins instead of
        // surfacing an opaque error to the caller
        if (isCsrfException(error.response))
          return new AdtCsrfException(
            `Session expired (${error.response.status})`,
            error
          )
        try {
          return fromResponse(error.response.body, error.response)
        } catch (e) {}
      }
      return new AdtHttpException(error)
    }
    if (hasMessage(error))
      return new AdtErrorException(500, {}, "", error.message)
  } catch (error) {}
  return AdtErrorException.create(500, {}, "Unknown error", `${error}`) // hopefully will never happen
}

function fromExceptionOrResponse_int(
  errOrResp: HttpClientResponse | HttpClientException,
  config?: RequestOptions
): AdtException {
  try {
    if (isResponse(errOrResp)) return fromResponse(errOrResp.body, errOrResp)
    else return fromError(errOrResp)
  } catch (e) {
    return isResponse(errOrResp)
      ? AdtErrorException.create(errOrResp, {})
      : fromError(e)
  }
}

export function fromException(
  errOrResp: unknown,
  config?: RequestOptions
): AdtException {
  if (isAdtException(errOrResp)) return errOrResp
  if (
    !isResponse(errOrResp) &&
    (!isNativeError(errOrResp) ||
      (isNativeError(errOrResp) && !isHttpClientException(errOrResp)))
  )
    return AdtErrorException.create(500, {}, "Unknown error", `${errOrResp}`) // hopefully will never happen
  return fromExceptionOrResponse_int(errOrResp, config)
}

export function adtException(message: string, number = 0) {
  return new AdtErrorException(number, {}, "", message)
}

export function ValidateObjectUrl(url: string) {
  if (url.match(/^\/sap\/bc\/adt\/[a-z]+\/[a-zA-Z%\$]?[\w%]+/)) return // valid
  throw new AdtErrorException(
    0,
    {},
    "BADOBJECTURL",
    "Invalid Object URL:" + url
  )
}

export function ValidateStateful(h: AdtHTTP) {
  if (h.isStateful) return
  throw new AdtErrorException(
    0,
    {},
    "STATELESS",
    "This operation can only be performed in stateful mode"
  )
}
/** structural shape of an fp-ts Either / io-ts Validation, kept for existing callers */
export type LegacyValidation<T> =
  | { readonly _tag: "Left"; readonly left: unknown }
  | { readonly _tag: "Right"; readonly right: T }

const legacyMessages = (left: unknown) =>
  (Array.isArray(left) ? left : [left]).map((e: any) => {
    const path = Array.isArray(e?.context)
      ? e.context
          .map((c: any) => c?.key)
          .filter((k: unknown) => k !== undefined && k !== "")
          .join(".")
      : ""
    return e?.message || `Invalid value ${JSON.stringify(e?.value)}${path ? ` at ${path}` : ""}`
  })

/**
 * Checks a parsed response against a schema
 *
 * Returns the input itself, like io-ts did: attributes the schema doesn't know are kept
 * @throws AdtErrorException with the first validation messages
 */
export function validateParseResult<S extends Schema.Top>(
  schema: S,
  input: unknown
): S["Type"]
/** @deprecated pass a schema and the value instead of an io-ts validation */
export function validateParseResult<T>(parseResult: LegacyValidation<T>): T
export function validateParseResult(
  schemaOrValidation: Schema.Top | LegacyValidation<unknown>,
  input?: unknown
): unknown {
  if (!Schema.isSchema(schemaOrValidation)) {
    if (schemaOrValidation._tag === "Right") return schemaOrValidation.right
    throw adtException(
      legacyMessages(schemaOrValidation.left).slice(0, 3).join("\n")
    )
  }
  const result = Schema.decodeUnknownResult(schemaOrValidation as any)(input, {
    errors: "all"
  })
  if (Result.isFailure(result))
    throw adtException(
      `${result.failure.message}`.split("\n").slice(0, 3).join("\n")
    )
  return input
}

export const isErrorMessageType = (x: string | SAPRC | undefined) =>
  !!`${x}`.match(/^[EAX]$/i)
