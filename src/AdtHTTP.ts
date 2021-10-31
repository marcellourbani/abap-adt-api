import axios, { Axios, AxiosRequestConfig, AxiosResponse, AxiosError, AxiosBasicCredentials, Method, AxiosInstance } from "axios"
import { fromException, isCsrfError } from "./AdtException"
import https from 'https'

const FETCH_CSRF_TOKEN = "fetch"
const CSRF_TOKEN_HEADER = "x-csrf-token"
const SESSION_HEADER = "X-sap-adt-sessiontype"

// TODO: add support for request logging, lost on axios migration

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
  baseURL?: string,
  timeout?: number
  auth?: AxiosBasicCredentials
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

export class AdtHTTP {
  private loginPromise?: Promise<any>
  private getToken?: BearerFetcher
  private userName?: string
  private axios: AxiosInstance
  private cookie: String | undefined
  public get isStateful() {
    return (
      this.stateful === session_types.stateful ||
      (this.stateful === session_types.keep &&
        this.currentSession === session_types.stateful)
    )
  }
  private currentSession = session_types.stateless
  private get commonHeaders(): Record<string, string> {
    return this.axios.defaults.headers.common
  }
  public stateful: session_types = session_types.stateless
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
    return (
      this.userName || (this.axios.defaults.auth?.username) || ""
    )
  }
  public get password() {
    return (this.axios.defaults.auth?.password) || ""
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
    if (typeof password === "string") {
      // if (config.debugCallback) request_debug(request, config.debugCallback)
      if (!(baseURL && username && password))
        throw new Error(
          "Invalid ADTClient configuration: url, login and password are required"
        )
      options.auth = { username, password }
    } else {
      this.getToken = password
      this.userName = username
    }

    this.axios = axios.create(toAxiosConfig(options))
    this._initializeRequestInterceptor()
    this._initializeResponseInterceptor();

  }

  private _initializeResponseInterceptor = () => {
    this.axios.interceptors.response.use(
      this._handleResponse,
      this._handleError,
    );
  };

  private _initializeRequestInterceptor = () => {
    this.axios.interceptors.request.use(
      this._handleRequest,
      this._handleError,
    );
  };


  private _handleRequest = async (config: AxiosRequestConfig) => {
    const headers = config.headers || {}
    headers[CSRF_TOKEN_HEADER] = this.csrfToken
    let token = this.getToken
    if (token) {
      headers!['Authorization'] = token.toString()
    }
    if (headers && !headers['Cookie']) {
      let localCookie: string | undefined = this.cookie as string;
      headers['Cookie'] = localCookie || ""
    }

    return { ...config, headers };
  };

  private _handleResponse = (response: AxiosResponse) => {
    const cookies = response.headers["set-cookie"]
    if (cookies && !this.cookie) {
      var arr = cookies.map(cookie => cookie.replace(/path=\/,/g, '').replace(/path=\//g, '').split(";")[0])
      this.cookie = arr.join(";")
    }
    return response;
  }

  protected _handleError = (error: any) => Promise.reject(error);
  /**
   * Logs on an ADT server. parameters provided on creation
   */
  public async login() {
    if (this.loginPromise) return this.loginPromise
    // oauth
    if (this.getToken && !this.options.auth) {
      //todo figure out how to use bearer token
      // await this.getToken().then(bearer => (this.options.auth = { bearer }))
    }
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

  public ascookies(): String | undefined {
    return this.cookie
  }

  public async logout() {
    this.stateful = session_types.stateless
    await this._request("/sap/public/bc/icf/logoff", {})
    // prevent autologin
    this.options.auth = undefined
    // new cookie jar
    this.cookie = undefined
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
      // TODO: login and retry if enabled
      // if the logon ticket expired try to logon again, unless in stateful mode
      // or already tried a login
      if (isCsrfError(adtErr) && !autologin && !this.isStateful) {
        try {
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
