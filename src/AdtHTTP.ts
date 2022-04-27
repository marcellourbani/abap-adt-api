import axios, { Axios, AxiosRequestConfig, AxiosResponse, AxiosError, AxiosBasicCredentials, Method, AxiosInstance, AxiosRequestHeaders } from "axios"
import { fromException, isCsrfError } from "./AdtException"
import https from 'https'
import { adtException, LogCallback } from "."
import { logError, logResponse } from "./requestLogger"

const FETCH_CSRF_TOKEN = "fetch"
const CSRF_TOKEN_HEADER = "x-csrf-token"
const SESSION_HEADER = "X-sap-adt-sessiontype"
const runningInNode = typeof process !== "undefined" && process.versions != null && process.versions.node != null
let lastClientId = 0
export enum session_types {
  stateful = "stateful",
  stateless = "stateless",
  keep = ""
}

export interface HttpResponse {
  body: string
}

export interface ClientOptions {
  headers?: Record<string, string>
  httpsAgent?: https.Agent
  baseURL?: string
  debugCallback?: LogCallback
  timeout?: number
  auth?: AxiosBasicCredentials
  keepAlive?: boolean
}

export interface RequestOptions extends ClientOptions {
  method?: Method
  headers?: Record<string, string>
  httpsAgent?: https.Agent
  qs?: Record<string, any>
  baseURL?: string,
  timeout?: number
  auth?: AxiosBasicCredentials
  body?: string
}

const toAxiosConfig = (options: RequestOptions): AxiosRequestConfig => {
  const config: AxiosRequestConfig = {
    method: options.method || "GET",
    headers: options.headers || {},
    params: options.qs,
    httpsAgent: options.httpsAgent,
    timeout: options.timeout,
    baseURL: options.baseURL,
    auth: options.auth,
    data: options.body
  }
  return config
}

export type BearerFetcher = () => Promise<string>
let adtRequestNumber = 0
export class AdtHTTP {
  private loginPromise?: Promise<any>
  private getToken?: BearerFetcher
  private userName?: string
  private axios: AxiosInstance
  private cookie = new Map<string, string>()
  private bearer?: string
  readonly id = ++lastClientId
  readonly password?: string
  debugCallback?: LogCallback
  keepAlive: NodeJS.Timeout | undefined
  didcall: boolean = false
  public get isStateful() {
    return (
      this.stateful === session_types.stateful ||
      (this.stateful === session_types.keep &&
        this.currentSession === session_types.stateful)
    )
  }
  private currentSession = session_types.stateless
  private get commonHeaders(): AxiosRequestHeaders {
    return this.axios.defaults.headers.common
  }
  public _stateful: session_types = session_types.stateless
  public get stateful() {
    return this._stateful
  }
  public set stateful(value: session_types) {
    this._stateful = value
    if (value !== session_types.keep)
      this.currentSession = value
  }
  public csrfToken: string = FETCH_CSRF_TOKEN

  private get options() {
    return this.axios.defaults
  }

  public get loggedin() {
    return this.csrfToken !== FETCH_CSRF_TOKEN
  }
  public get baseURL() {
    return this.axios.defaults.baseURL!
  }
  public get username() {
    return this.userName || (this.axios.defaults.auth?.username) || ""
  }

  /**
   * Creates an instance of AdtHTTP.
   * @param {string} baseURL  Base url, i.e. http://vhcalnplci.local:8000
   * @param {string} username SAP logon user
   * @param {string} password Password
   * @param {string} client   login client
   * @param {string} language login language
   * @param {string} [sslOptions] Custom certificate authority
   * @memberof AdtHTTP
   */
  constructor(
    baseURL: string,
    username: string,
    password: string | BearerFetcher,
    readonly client: string,
    readonly language: string,
    config: ClientOptions = {}
  ) {
    config = { keepAlive: true, ...config }
    if (config.keepAlive) this.keepAlive = setInterval(() => this.keep_session(), 120000)
    const headers: any = {
      ...config.headers,
      Accept: "*/*",
      "Cache-Control": "no-cache",
      "x-csrf-token": FETCH_CSRF_TOKEN,
    }
    headers[SESSION_HEADER] = session_types.stateless
    const options: ClientOptions = {
      ...config,
      baseURL,
      headers,
    }
    this.userName = username
    if (typeof password === "string") {
      this.password = password
      if (!(baseURL && username && password))
        throw adtException("Invalid ADTClient configuration: url, login and password are required")
    } else
      this.getToken = password

    this.axios = axios.create(toAxiosConfig(options))
    this.debugCallback = config.debugCallback
    this._initializeRequestInterceptor()
    this._initializeResponseInterceptor();

  }
  keep_session(): void {
    if (this.isStateful && this.loggedin && !this.didcall)
      this._request("/sap/bc/adt/compatibility/graph", {}).then(() => this.didcall = false)
    else this.didcall = false
  }

  private _initializeResponseInterceptor = () => {
    this.axios.interceptors.response.use(
      this._handleResponse,
      this._handleError,
    );
  };

  private _initializeRequestInterceptor = () => {
    this.axios.interceptors.request.use(
      this._handleRequest
    );
  };


  private _handleRequest = async (config: AxiosRequestConfig) => {
    const headers = config.headers || {}
    headers[CSRF_TOKEN_HEADER] = this.csrfToken
    headers[SESSION_HEADER] = this.stateful
    if (this.getToken && !this.bearer)
      this.bearer = await this.getToken()

    if (this.bearer) headers.Authorization = `bearer ${this.bearer}`

    if (headers && !headers['Cookie'] && runningInNode)
      headers['Cookie'] = this.ascookies()


    adtRequestNumber++
    return { ...config, headers, adtRequestNumber, adtStartTime: new Date() };
  };

  private _handleResponse = (response: AxiosResponse) => {
    logResponse(this.id, response, this.debugCallback)
    if (runningInNode) {
      const cookies = response.headers["set-cookie"] || []
      cookies.forEach(cookie => {
        const cleaned = cookie.replace(/path=\/,/g, '').replace(/path=\//g, '').split(";")[0]
        const [key] = cookie.split('=', 1)
        this.cookie.set(key, cleaned)
      })
    }
    return response;
  }

  protected _handleError = async (error: any) => {
    logError(this.id, error, this.debugCallback)
    return error
  }
  /**
   * Logs on an ADT server. parameters provided on creation
   */
  public async login() {
    if (this.loginPromise) return this.loginPromise
    this.cookie.clear()
    // oauth
    if (this.getToken && !this.bearer) {
      await this.getToken().then(bearer => (this.bearer = bearer))
    } else this.options.auth = { username: this.userName || "", password: this.password || "" }
    const qs: Record<string, string> = {}
    if (this.client) qs["sap-client"] = this.client
    if (this.language) qs["sap-language"] = this.language
    this.csrfToken = FETCH_CSRF_TOKEN
    try {
      this.loginPromise = this._request("/sap/bc/adt/compatibility/graph", { qs })
      await this.loginPromise
    } finally {
      this.loginPromise = undefined
    }
  }

  public ascookies(): string {
    return [...this.cookie.values()].join('; ')
  }

  public async logout() {
    this.stateful = session_types.stateless
    await this._request("/sap/public/bc/icf/logoff", {})
    // prevent autologin
    this.options.auth = undefined
    this.bearer = undefined
    // new cookie jar
    this.cookie.clear()
    // clear token
    this.csrfToken = FETCH_CSRF_TOKEN
  }

  public async dropSession() {
    this.stateful = session_types.stateless
    await this._request("/sap/bc/adt/compatibility/graph", {})
  }

  /**
   * HTTP request using default values, and updating cookies/token
   * will login automatically if needed, and try refresh the login (once) if:
   * - expired
   * - stateless (for stateful sessions the client needs to do some cleanup)
   *
   * @param url URL suffix
   * @param config request options
   */
  public async request(url: string, config?: RequestOptions): Promise<HttpResponse> {
    let autologin = false
    try {
      if (!this.loggedin) {
        autologin = true
        await this.login()
      }
      return await this._request(url, config || {})
    } catch (e) {
      const adtErr = fromException(e)
      // if the logon ticket expired try to logon again, unless in stateful mode
      // or already tried a login
      if (isCsrfError(adtErr) && !autologin && !this.isStateful) {
        try {
          this.csrfToken = FETCH_CSRF_TOKEN
          await this.login()
          return await this._request(url, config || {})
        } catch (e2) {
          throw fromException(e2)
        }
      } else throw adtErr
    }
  }

  /**
   * HTTP request without automated login / retry
   *
   * @param url URL suffix
   * @param options request options
   */
  private _request(url: string, options: RequestOptions): Promise<HttpResponse> {
    return new Promise<HttpResponse>(async (resolve, reject) => {
      this.didcall = true
      try {
        const response = await this.axios.request({ url, ...toAxiosConfig(options) });
        if (response.status < 400) {
          if (this.csrfToken === FETCH_CSRF_TOKEN) {
            const newtoken = response.headers[CSRF_TOKEN_HEADER]
            if (typeof newtoken === "string") this.csrfToken = newtoken
            this.commonHeaders!["x-csrf-token"] = this.csrfToken
          }
          const httpResponse: HttpResponse = { ...response, body: "" + response.data }
          resolve(httpResponse)
        }
        else {
          reject(response)
        }
      } catch (error) {
        reject(error)
      }
    })
  }
}
