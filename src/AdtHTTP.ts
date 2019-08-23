import request, { CoreOptions, OptionsWithUrl, Response } from "request"
import request_debug, { LogCallback, LogData, LogPhase } from "request-debug"
import { fromException, isCsrfError } from "./AdtException"
const FETCH_CSRF_TOKEN = "fetch"
const CSRF_TOKEN_HEADER = "x-csrf-token"
const SESSION_HEADER = "X-sap-adt-sessiontype"
export enum session_types {
  stateful = "stateful",
  stateless = "stateless",
  keep = ""
}
export interface ClientOptions extends CoreOptions {
  debugCallback?: LogCallback
}
export class AdtHTTP {
  private options: ClientOptions
  private loginPromise?: Promise<any>
  public get isStateful() {
    return (
      this.stateful === session_types.stateful ||
      (this.stateful === session_types.keep &&
        this.currentSession === session_types.stateful)
    )
  }
  private currentSession = session_types.stateless
  public get stateful(): session_types {
    return this.options.headers![SESSION_HEADER]
  }
  public set stateful(stateful: session_types) {
    this.options.headers![SESSION_HEADER] = stateful
  }
  public get csrfToken() {
    return this.options.headers![CSRF_TOKEN_HEADER]
  }
  public set csrfToken(token: string) {
    this.options.headers![CSRF_TOKEN_HEADER] = token
  }
  private get loggedin() {
    return this.csrfToken !== FETCH_CSRF_TOKEN
  }
  public get baseUrl() {
    return this.options.baseUrl!
  }
  public get username() {
    return (this.options.auth && this.options.auth.username) || ""
  }
  public get password() {
    return (this.options.auth && this.options.auth.password) || ""
  }

  /**
   * Creates an instance of AdtHTTP.
   * @param {string} baseUrl  Base url, i.e. http://vhcalnplci.local:8000
   * @param {string} username SAP logon user
   * @param {string} password Password
   * @param {string} client   login client
   * @param {string} language login language
   * @param {string} [sslOptions] Custom certificate authority
   * @memberof AdtHTTP
   */
  constructor(
    baseUrl: string,
    username: string,
    password: string,
    readonly client: string,
    readonly language: string,
    config: ClientOptions = {}
  ) {
    if (config.debugCallback) request_debug(request, config.debugCallback)
    if (!(baseUrl && username && password))
      throw new Error(
        "Invalid ADTClient configuration: url, login and password are required"
      )
    const headers: any = {
      ...config.headers,
      Accept: "*/*",
      "Cache-Control": "no-cache",
      withCredentials: true,
      "x-csrf-token": FETCH_CSRF_TOKEN
    }
    headers[SESSION_HEADER] = session_types.stateless
    this.options = {
      ...config,
      auth: { username, password },
      baseUrl,
      headers,
      jar: request.jar()
    }
  }
  /**
   * Logs on an ADT server. parameters provided on creation
   */
  public async login() {
    if (this.loginPromise) return this.loginPromise
    const qs: any = {}
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

  public cookies() {
    const jar = this.options.jar
    if (jar && jar !== true && this.options.baseUrl)
      return jar.getCookies(this.options.baseUrl)
  }

  public async logout() {
    this.stateful = session_types.stateless
    await this._request("/sap/public/bc/icf/logoff", {})
    // prevent autologin
    this.options.auth = undefined
    // new cookie jar
    this.options.jar = request.jar()
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
  public async request(url: string, config?: CoreOptions): Promise<Response> {
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
  private _request(url: string, options: CoreOptions) {
    let headers = this.options.headers || {}
    if (options.headers) headers = { ...headers, ...options.headers }
    const uo: OptionsWithUrl = { ...this.options, ...options, headers, url }
    return new Promise<Response>((resolve, reject) => {
      request(uo, async (error, response) => {
        if (error) reject(error)
        else if (response.statusCode < 400) {
          if (this.csrfToken === FETCH_CSRF_TOKEN) {
            const newtoken = response.headers[CSRF_TOKEN_HEADER]
            if (typeof newtoken === "string") this.csrfToken = newtoken
          }
          resolve(response)
        } else reject(fromException(response))
      })
    })
  }
}
