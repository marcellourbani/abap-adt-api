import {
  AdtSessionFailure,
  fromException,
  isAuthenticationFailure,
  isCsrfError
} from "./AdtException"
import https from "https"
import {
  AdtException,
  adtException,
  isAdtException,
  isLoginError,
  LogCallback
} from "."
import { logError, logResponse, redactSensitiveHeaders } from "./requestLogger"
import { isString } from "./utilities"
import { EffectHttpClient } from "./EffectHttpClient"
import type { HttpClient as EffectHttp } from "effect/http"
import {
  AdtExtension,
  AdtRequest,
  assertUniqueExtensionIds,
  composeExtensions,
  createAdtRequest,
  withRequest
} from "./AdtExtensions"
import {
  AdtSession,
  AdtSessionFailureReason,
  AdtSessionProvider,
  CookieJar
} from "./AdtSession"

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
const GRAPH_URL = "/sap/bc/adt/compatibility/graph"
const READ_METHODS = ["GET", "HEAD", "OPTIONS"]
export const runningInNode =
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
  /** Supplies and renews cookies from outside the library, instead of Basic or bearer credentials */
  session?: AdtSessionProvider
  /** Ordered request/response middleware */
  extensions?: readonly AdtExtension[]
  /**
   * Effect HTTP client used when the client is created from a base url,
   * i.e. FetchHttpClient in a browser. Defaults to the node:http(s) client
   */
  effectHttpClient?: EffectHttp.HttpClient
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
export interface HttpClientCapabilities {
  readonly headers: boolean
  readonly cookies: boolean
  readonly statusCodes: boolean
}

/**
 * Abstract HTTP client
 * cookies, authentication and CSRF tokens usually handled by higher level intercacve
 */
export interface HttpClient {
  /** Missing capabilities are assumed to be supported */
  readonly capabilities?: HttpClientCapabilities
  /**
   * HTTP request
   * @param options url, headers,...
   * @returns the result of the HTTP call
   *
   * expected to throw only AdtException errors
   */
  request: (options: Readonly<HttpClientOptions>) => Promise<HttpClientResponse>
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
  private provider?: AdtSessionProvider
  private extensions: readonly AdtExtension[]
  private renewPromise?: Promise<boolean>
  // successful renewals, lets a late failing request know somebody already renewed
  private renewals = 0
  private jar = new CookieJar(() => {
    this.csrfToken = FETCH_CSRF_TOKEN
  })
  get session(): AdtSession {
    return this.jar
  }
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
      !(
        baseURLOrClient &&
        username &&
        (password || config?.session || !isString(baseURLOrClient))
      )
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
      ? new EffectHttpClient(baseURLOrClient, config, config?.effectHttpClient)
      : baseURLOrClient
    this.debugCallback = config?.debugCallback
    this.provider = config?.session
    this.extensions = config?.extensions || []
    assertUniqueExtensionIds(this.extensions)
    if (this.provider) this._assertCookieSupport()
    if (config?.keepAlive)
      this.keepAlive = setInterval(() => this.keep_session(), 120000)
  }

  private _assertCookieSupport() {
    if (this.httpclient.capabilities?.cookies === false)
      throw adtException(
        "The HTTP client doesn't support cookies, which external sessions require"
      )
  }

  login(): Promise<any> {
    return this._withLoginLock(() =>
      this.provider ? this._externalLogin() : this._internalLogin()
    )
  }

  private _withLoginLock(f: () => Promise<HttpClientResponse>) {
    if (!this.loginPromise)
      this.loginPromise = f().finally(() => (this.loginPromise = undefined))
    return this.loginPromise
  }

  private async _internalLogin() {
    this.jar.clearCookies()
    // oauth
    if (this.getToken && !this.bearer) {
      await this.getToken().then(bearer => (this.bearer = bearer))
    } else
      this.auth = {
        username: this.username || "",
        password: this.password || ""
      }
    this.csrfToken = FETCH_CSRF_TOKEN
    return this._loginRequest()
  }

  private async _externalLogin() {
    this._dropContextId()
    if (!this.jar.cookieHeader()) await this._renewOrFail("initial-login")
    this.csrfToken = FETCH_CSRF_TOKEN
    try {
      const response = await this._loginRequest()
      if (!this.loggedin) throw new AdtSessionFailure("expired", true)
      return response
    } catch (error) {
      if (!isAuthenticationFailure(error)) throw error
      await this._renewOrFail("expired", error)
      this._dropContextId()
      this.csrfToken = FETCH_CSRF_TOKEN
      const response = await this._loginRequest()
      if (!this.loggedin) throw new AdtSessionFailure("expired", true)
      return response
    }
  }

  // returns the response so handlers can stringify a real value
  private _loginRequest() {
    const qs: Record<string, string> = {}
    if (this.client) qs["sap-client"] = this.client
    if (this.language) qs["sap-language"] = this.language
    return this._request(GRAPH_URL, { qs }, 1, true)
  }

  private async _renewOrFail(reason: AdtSessionFailureReason, error?: unknown) {
    if (await this.renewSession(reason, error)) return
    const parent = isAdtException(error) ? error : undefined
    throw new AdtSessionFailure(reason, reason !== "initial-login", parent)
  }

  /**
   * Asks the session provider for new credentials, concurrent calls share one renewal
   * @returns true if the session can be used again
   */
  renewSession(
    reason: AdtSessionFailureReason = "manual",
    error?: unknown
  ): Promise<boolean> {
    if (!this.provider) return Promise.resolve(false)
    if (!this.renewPromise)
      this.renewPromise = this._renew(this.provider, reason, error).finally(
        () => (this.renewPromise = undefined)
      )
    return this.renewPromise
  }

  private async _renew(
    provider: AdtSessionProvider,
    reason: AdtSessionFailureReason,
    error?: unknown
  ) {
    const before = this.jar.cookieHeader()
    const cookies = await provider.renew({ client: this, reason, error })
    if (cookies) {
      this.jar.importCookies(cookies)
      this._dropContextId()
      const after = this.jar.cookieHeader()
      if (cookies.replace || after !== before)
        this.stateful = session_types.stateless
      if (after !== before) await provider.onCookiesChanged?.(after)
    }
    // without new cookies only a CSRF problem can be fixed
    const usable = cookies
      ? cookies.verified === true ||
        reason === "csrf" ||
        reason === "manual" ||
        this.jar.cookieHeader() !== before
      : reason === "csrf"
    if (usable) {
      this.jar.resetCsrfToken()
      this.renewals++
    }
    return usable
  }

  ascookies(): string {
    return this.jar.cookieHeader()
  }

  private _dropContextId() {
    const cookieHeader = this.jar.cookieHeader()
    const cookies = cookieHeader
      .split(";")
      .map(cookie => cookie.trim())
      .filter(
        cookie =>
          cookie.length > 0 &&
          cookie.slice(0, cookie.indexOf("=")).toLowerCase() !==
          "sap-contextid"
      )
    if (cookies.length !== (cookieHeader ? cookieHeader.split(";").length : 0))
      this.jar.importCookies({ cookieHeader: cookies.join("; "), replace: true })
  }

  /**
   * Tests an external cookie header using an isolated login context and this client's transport.
   * The active session's cookies, CSRF token and stateful context are not modified.
   */
  async probeCookieHeader(cookieHeader: string): Promise<string | undefined> {
    const probe = new AdtHTTP(
      this.httpclient,
      this.username,
      this.password || "",
      this.client,
      this.language,
      {
        headers: this.commonHeaders,
        debugCallback: this.debugCallback,
        extensions: this.extensions,
        session: {
          id: `cookie-probe:${this.id}`,
          logoutMode: "local-only",
          renew: async () => undefined
        }
      }
    )
    probe.session.importCookies({ cookieHeader, replace: true })
    probe._dropContextId()
    try {
      await probe.login()
      return probe.session.cookieHeader() || undefined
    } finally {
      await probe.logout()
    }
  }

  async logout(): Promise<void> {
    this.stateful = session_types.stateless
    if (this.provider?.logoutMode !== "local-only")
      await this._request("/sap/public/bc/icf/logoff", {})
    // prevent autologin
    this.auth = undefined
    this.bearer = undefined
    // new cookie jar
    this.jar.clearCookies()
    // clear token
    this.csrfToken = FETCH_CSRF_TOKEN
  }
  async dropSession(): Promise<void> {
    this.stateful = session_types.stateless
    await this._request("/sap/bc/adt/compatibility/graph", {})
  }
  request(url: string, config?: RequestOptions): Promise<HttpClientResponse> {
    return this.provider
      ? this._providerRequest(url, config || {})
      : this._legacyRequest(url, config)
  }

  private async _legacyRequest(
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

  private async _providerRequest(
    url: string,
    options: RequestOptions
  ): Promise<HttpClientResponse> {
    if (!this.loggedin) await this.login()
    const epoch = this.renewals
    try {
      return await this._request(url, options)
    } catch (e) {
      const error = fromException(e, options)
      if (!isLoginError(error)) throw error
      return this._recover(url, options, error, epoch)
    }
  }

  private async _recover(
    url: string,
    options: RequestOptions,
    error: AdtException,
    epoch: number
  ) {
    const reason = isCsrfError(error) ? "csrf" : "expired"
    if (!this._mayReplay(url, options, error))
      throw new AdtSessionFailure(reason, true, error)
    if (!(await this._refreshSession(reason, error, epoch)))
      throw new AdtSessionFailure(reason, true, error)
    return this._replay(url, options, reason)
  }

  // stateful calls and writes may have side effects, so they are never replayed on their own
  private _mayReplay(url: string, options: RequestOptions, error: unknown) {
    if (this.isStateful) return false
    const method = `${options.method || "GET"}`.toUpperCase()
    const verdict = this.provider?.canRetry?.(
      {
        client: this,
        request: this._buildRequest(url, options, adtRequestNumber),
        attempt: 1,
        isLogin: false,
        isStateful: false
      },
      error
    )
    return READ_METHODS.includes(method) ? verdict !== false : verdict === true
  }

  private async _refreshSession(
    reason: AdtSessionFailureReason,
    error: AdtException,
    epoch: number
  ) {
    try {
      // somebody else renewed while this request was failing
      if (this.renewals === epoch && !(await this.renewSession(reason, error)))
        return false
      if (!this.loggedin || this.loginPromise)
        await this._withLoginLock(() => this._loginRequest())
      return true
    } catch (e) {
      if (!isAuthenticationFailure(e)) throw e
      throw new AdtSessionFailure(reason, true, fromException(e))
    }
  }

  private async _replay(
    url: string,
    options: RequestOptions,
    reason: AdtSessionFailureReason
  ) {
    try {
      return await this._request(url, options, 2)
    } catch (e) {
      const error = fromException(e, options)
      throw isLoginError(error)
        ? new AdtSessionFailure(reason, true, error)
        : error
    }
  }

  private keep_session = async () => {
    if (this.needKeepalive && this.loggedin)
      await this._request(GRAPH_URL, {}).catch(() => {})
    this.needKeepalive = true
  }

  private async _storeCookies(response: HttpClientResponse) {
    if (runningInNode || this.provider) {
      const before = this.jar.cookieHeader()
      this.jar.applyResponseCookies(response.headers["set-cookie"])
      const after = this.jar.cookieHeader()
      if (after !== before) await this.provider?.onCookiesChanged?.(after)
    }
  }

  private logResponse(
    exceptionOrResponse: AdtException | HttpClientResponse,
    options: HttpClientOptions
  ) {
    if (!this.debugCallback) return
    if (isAdtException(exceptionOrResponse))
      logError(
        this.id,
        exceptionOrResponse,
        this.debugCallback,
        this._safeOptions(options)
      )
    else
      logResponse(
        this.id,
        this._safeResponse(exceptionOrResponse),
        this._safeOptions(options),
        this.debugCallback
      )
  }

  // session cookies are credentials: keep them out of logs and exceptions
  private _safeOptions(options: HttpClientOptions): HttpClientOptions {
    if (!this.provider) return options
    return { ...options, headers: redactSensitiveHeaders(options.headers) }
  }

  private _safeResponse(response: HttpClientResponse): HttpClientResponse {
    if (!this.provider) return response
    return { ...response, headers: redactSensitiveHeaders(response.headers) }
  }

  private _safeError(error: unknown) {
    if (!this.provider || !isHttpClientException(error)) return error
    return new HttpClientException(
      error.message,
      error.code,
      error.status,
      undefined,
      this._safeOptions(error.request),
      error.response && this._safeResponse(error.response)
    )
  }

  private _buildRequest(
    url: string,
    options: RequestOptions,
    requestNumber: number
  ): AdtRequest {
    const request = createAdtRequest({
      url,
      method: options.method || "GET",
      headers: this.commonHeaders,
      query: options.qs,
      body: options.body,
      timeout: options.timeout,
      session: this.stateful,
      requestNumber
    })
    return withRequest(request, {
      headers: { ...options.headers, [SESSION_HEADER]: this.stateful }
    })
  }

  // credentials and cookies are added last, so extensions never see them
  private _toClientOptions(
    request: AdtRequest,
    options: RequestOptions
  ): HttpClientOptions {
    const hasCookie = Object.keys(request.headers).some(
      k => k.toLowerCase() === "cookie"
    )
    const cookie = this.jar.cookieHeader()
    const { headers } = withRequest(request, {
      headers: {
        ...(this.bearer ? { Authorization: `bearer ${this.bearer}` } : {}),
        ...(!hasCookie && cookie && (runningInNode || this.provider)
          ? { Cookie: cookie }
          : {})
      }
    })
    return {
      ...options,
      method: request.method,
      url: request.url,
      qs: request.query && { ...request.query },
      headers: { ...headers },
      body: request.body,
      timeout: request.timeout,
      auth: this.auth,
      adtStartTime: request.startedAt,
      adtRequestNumber: request.requestNumber
    }
  }

  private async _send(
    request: AdtRequest,
    options: RequestOptions,
    sent: { config?: HttpClientOptions }
  ) {
    if (this.getToken && !this.bearer) this.bearer = await this.getToken()
    sent.config = this._toClientOptions(request, options)
    return this.httpclient.request(sent.config)
  }

  /**
   * HTTP request without automated login / retry
   *
   * @param url URL suffix
   * @param options request options
   */
  private async _request(
    url: string,
    options: RequestOptions,
    attempt = 1,
    isLogin = false
  ): Promise<HttpClientResponse> {
    this.needKeepalive = false
    const request = this._buildRequest(url, options, ++adtRequestNumber)
    const sent: { config?: HttpClientOptions } = {}
    try {
      const response = await composeExtensions(this.extensions, r =>
        this._send(r, options, sent)
      )({
        client: this,
        request,
        attempt,
        isLogin,
        isStateful: this.isStateful
      })
      return await this._handleResponse(
        response,
        sent.config || this._toClientOptions(request, options)
      )
    } catch (error) {
      if (isHttpClientException(error) && error.response?.headers)
        await this._storeCookies(error.response)
      const config = sent.config || this._toClientOptions(request, options)
      const exc = fromException(this._safeError(error), config)
      this.logResponse(exc, config)
      throw exc
    }
  }

  private async _handleResponse(
    response: HttpClientResponse,
    config: HttpClientOptions
  ) {
    await this._storeCookies(response)
    if (response.status >= 400)
      throw fromException(this._safeResponse(response), config)
    if (
      this.csrfToken === FETCH_CSRF_TOKEN &&
      isString(response.headers[CSRF_TOKEN_HEADER])
    )
      this.csrfToken = response.headers[CSRF_TOKEN_HEADER]
    this.logResponse(response, config)
    return response
  }
}
