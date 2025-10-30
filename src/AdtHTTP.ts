import { fromException, isCsrfError } from "./AdtException"
import https from "https"
import {
  AdtException,
  adtException,
  isAdtException,
  isLoginError,
  LogCallback
} from "."
import { logError, logResponse } from "./requestLogger"
import { isString } from "./utilities"
import { AxiosHttpClient } from "./AxiosHttpClient"

export type Method =
  | "get"
  | "GET"
  | "delete"
  | "DELETE"
  | "head"
  | "HEAD"
  | "options"
  | "OPTIONS"
  | "post"
  | "POST"
  | "put"
  | "PUT"
  | "patch"
  | "PATCH"
  | "purge"
  | "PURGE"
  | "link"
  | "LINK"
  | "unlink"
  | "UNLINK"

const FETCH_CSRF_TOKEN = "fetch"
const CSRF_TOKEN_HEADER = "x-csrf-token"
const SESSION_HEADER = "X-sap-adt-sessiontype"
const runningInNode =
  typeof process !== "undefined" &&
  process.versions != null &&
  process.versions.node != null
let lastClientId = 0
export enum session_types {
  stateful = "stateful",
  stateless = "stateless",
  keep = ""
}

export interface HttpResponse {
  body: string
}

export interface BasicCredentials {
  username: string
  password: string
}

export interface ClientOptions {
  headers?: Record<string, string>
  httpsAgent?: https.Agent
  baseURL?: string
  debugCallback?: LogCallback
  timeout?: number
  auth?: BasicCredentials
  keepAlive?: boolean
}

export interface RequestOptions extends ClientOptions {
  method?: Method
  headers?: Record<string, string>
  httpsAgent?: https.Agent
  qs?: Record<string, any>
  baseURL?: string
  timeout?: number
  auth?: BasicCredentials
  body?: string
  url?: string
}

export type HeaderValue = string | string[] | number | boolean | null

export const isHeaderValue = (v: any): v is HeaderValue =>
  v === null ||
  typeof v === "string" ||
  typeof v === "number" ||
  typeof v === "boolean" ||
  (Array.isArray(v) && v.every(item => typeof item === "string"))

export type ResponseHeaders = Record<string, HeaderValue> &
  Partial<{ "set-cookie": string[] }>

export type BearerFetcher = () => Promise<string>
let adtRequestNumber = 0
export interface HttpClientResponse {
  body: string
  status: number
  statusText: string
  headers: ResponseHeaders
  request?: any
}

export interface RequestMetadata {
  adtRequestNumber?: number
  adtStartTime?: Date
}

export interface HttpClientOptions extends RequestOptions, RequestMetadata {
  url: string
}
/**
 * Abstract HTTP client
 * cookies, authentication and CSRF tokens usually handled by higher level intercacve
 */
export interface HttpClient {
  /**
   * HTTP request
   * @param options url, headers,...
   * @returns the result of the HTTP call
   *
   * expected to throw only AdtException errors
   */
  request: (options: HttpClientOptions) => Promise<HttpClientResponse>
}

export class HttpClientException extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
    readonly status: number | undefined,
    readonly config: ClientOptions | undefined,
    readonly request: HttpClientOptions,
    readonly response?: HttpClientResponse,
    readonly parent?: unknown
  ) {
    super(message)
  }
}
export const isHttpClientException = (
  error: unknown
): error is HttpClientException => error instanceof HttpClientException

export class AdtHTTP {
  readonly baseURL: string
  readonly id: number
  readonly password?: string
  isClone: boolean = false
  private currentSession = session_types.stateless
  private _stateful: session_types = session_types.stateless
  private needKeepalive = false
  readonly keepAlive?: NodeJS.Timer
  private commonHeaders: Record<string, string>
  private bearer?: string
  private getToken?: BearerFetcher
  private auth?: BasicCredentials
  private httpclient: HttpClient
  private debugCallback?: LogCallback
  private loginPromise?: Promise<HttpClientResponse>
  get isStateful(): boolean {
    return (
      this.stateful === session_types.stateful ||
      (this.stateful === session_types.keep &&
        this.currentSession === session_types.stateful)
    )
  }
  get stateful(): session_types {
    return this._stateful
  }
  set stateful(value: session_types) {
    this._stateful = value
    if (value !== session_types.keep) this.currentSession = value
  }
  get csrfToken() {
    return this.commonHeaders[CSRF_TOKEN_HEADER] || FETCH_CSRF_TOKEN
  }
  set csrfToken(token: string) {
    this.commonHeaders[CSRF_TOKEN_HEADER] = token
  }
  get loggedin(): boolean {
    return this.csrfToken !== FETCH_CSRF_TOKEN
  }
  constructor(
    baseURLOrClient: string | HttpClient,
    readonly username: string,
    password: string | BearerFetcher,
    readonly client: string,
    readonly language: string,
    config?: ClientOptions
  ) {
    if (
      !(baseURLOrClient && username && (password || !isString(baseURLOrClient)))
    )
      throw adtException(
        "Invalid ADTClient configuration: url, login and password are required"
      )
    this.baseURL = isString(baseURLOrClient) ? baseURLOrClient : ""
    this.id = lastClientId++
    if (isString(password)) this.password = password
    else this.getToken = password
    this.commonHeaders = {
      ...config?.headers,
      Accept: "*/*",
      "Cache-Control": "no-cache",
      [CSRF_TOKEN_HEADER]: FETCH_CSRF_TOKEN
    }
    this.httpclient = isString(baseURLOrClient)
      ? new AxiosHttpClient(baseURLOrClient, config)
      : baseURLOrClient
    this.debugCallback = config?.debugCallback
    if (config?.keepAlive)
      this.keepAlive = setInterval(() => this.keep_session(), 120000)
  }

  async login(): Promise<any> {
    if (this.loginPromise) return this.loginPromise
    this.cookie.clear()
    // oauth
    if (this.getToken && !this.bearer) {
      await this.getToken().then(bearer => (this.bearer = bearer))
    } else
      this.auth = {
        username: this.username || "",
        password: this.password || ""
      }
    const qs: Record<string, string> = {}
    if (this.client) qs["sap-client"] = this.client
    if (this.language) qs["sap-language"] = this.language
    this.csrfToken = FETCH_CSRF_TOKEN
    try {
      this.loginPromise = this._request("/sap/bc/adt/compatibility/graph", {
        qs
      })
      await this.loginPromise
    } finally {
      this.loginPromise = undefined
    }
  }
  private cookie = new Map<string, string>()
  ascookies(): string {
    return [...this.cookie.values()].join("; ")
  }
  async logout(): Promise<void> {
    this.stateful = session_types.stateless
    await this._request("/sap/public/bc/icf/logoff", {})
    // prevent autologin
    this.auth = undefined
    this.bearer = undefined
    // new cookie jar
    this.cookie.clear()
    // clear token
    this.csrfToken = FETCH_CSRF_TOKEN
  }
  async dropSession(): Promise<void> {
    this.stateful = session_types.stateless
    await this._request("/sap/bc/adt/compatibility/graph", {})
  }
  async request(
    url: string,
    config?: RequestOptions
  ): Promise<HttpClientResponse> {
    let autologin = false
    try {
      if (!this.loggedin) {
        autologin = true
        await this.login()
      }
      return await this._request(url, config || {})
    } catch (e) {
      const adtErr = fromException(e, config)
      // if the logon ticket expired try to logon again, unless in stateful mode
      // or already tried a login
      if (isLoginError(adtErr) && !autologin && !this.isStateful) {
        try {
          this.csrfToken = FETCH_CSRF_TOKEN
          await this.login()
          return await this._request(url, config || {})
        } catch (e2) {
          throw fromException(e2, config)
        }
      } else throw adtErr
    }
  }
  private keep_session = async () => {
    if (this.needKeepalive && this.loggedin)
      await this._request("/sap/bc/adt/compatibility/graph", {}).catch(() => {})
    this.needKeepalive = true
  }
  private updateCookies(response: HttpClientResponse) {
    if (runningInNode) {
      const cookies = response.headers["set-cookie"] || []
      cookies.forEach(cookie => {
        const cleaned = cookie
          .replace(/path=\/,/g, "")
          .replace(/path=\//g, "")
          .split(";")[0]
        const [key] = cookie.split("=", 1)
        this.cookie.set(key, cleaned)
      })
    }
  }

  private logResponse(
    exceptionOrResponse: AdtException | HttpClientResponse,
    options: HttpClientOptions
  ) {
    if (!this.debugCallback) return
    if (isAdtException(exceptionOrResponse))
      logError(this.id, exceptionOrResponse, this.debugCallback, options)
    else logResponse(this.id, exceptionOrResponse, options, this.debugCallback)
  }

  /**
   * HTTP request without automated login / retry
   *
   * @param url URL suffix
   * @param options request options
   */
  private async _request(
    url: string,
    options: RequestOptions
  ): Promise<HttpClientResponse> {
    this.needKeepalive = false
    const headers = { ...this.commonHeaders, ...options.headers }
    headers[SESSION_HEADER] = this.stateful
    if (!headers["Cookie"] && runningInNode)
      headers["Cookie"] = this.ascookies()

    adtRequestNumber++
    const adtStartTime = new Date()
    const config = {
      ...options,
      auth: this.auth,
      headers,
      adtStartTime,
      adtRequestNumber,
      url
    }
    try {
      if (this.getToken && !this.bearer) this.bearer = await this.getToken()
      if (this.bearer) headers.Authorization = `bearer ${this.bearer}`
      const response = await this.httpclient.request(config)

      this.updateCookies(response)
      if (response.status >= 400) throw fromException(response, config)
      if (
        this.csrfToken === FETCH_CSRF_TOKEN &&
        isString(response.headers[CSRF_TOKEN_HEADER])
      )
        this.csrfToken = response.headers[CSRF_TOKEN_HEADER]
      this.logResponse(response, config)
      return response
    } catch (error) {
      const exc = fromException(error, config)
      this.logResponse(exc, config)
      throw exc
    }
  }
}
