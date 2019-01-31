import Axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios"
import { CookieJar } from "tough-cookie"
import { fromException, isCsrfError } from "./AdtException"

const FETCH_CSRF_TOKEN = "fetch"
const CSRF_TOKEN_HEADER = "x-csrf-token"
const SESSION_HEADER = "X-sap-adt-sessiontype"
export enum session_types {
  stateful = "stateful",
  stateless = "stateless",
  keep = ""
}

export class AdtHTTP {
  private axios: AxiosInstance
  private jar: CookieJar
  public get isStateful() {
    return (
      this.stateful === session_types.stateful ||
      (this.stateful === session_types.keep &&
        this.currentSession === session_types.stateful)
    )
  }
  private currentSession = session_types.stateless
  public get stateful(): session_types {
    return this.axios.defaults.headers[SESSION_HEADER]
  }
  public set stateful(stateful: session_types) {
    this.axios.defaults.headers[SESSION_HEADER] = stateful
  }
  public get csrfToken() {
    return this.axios.defaults.headers[CSRF_TOKEN_HEADER]
  }
  public set csrfToken(token: string) {
    this.axios.defaults.headers[CSRF_TOKEN_HEADER] = token
  }
  private get loggedin() {
    return this.csrfToken !== FETCH_CSRF_TOKEN
  }
  public get baseUrl() {
    return this.axios.defaults.baseURL!
  }
  public get username() {
    return this.axios.defaults.auth && this.axios.defaults.auth.username
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
    password: string,
    readonly client: string,
    readonly language: string,
    config: AxiosRequestConfig = {}
  ) {
    if (!(baseURL && username && password))
      throw new Error(
        "Invalid ADTClient configuration: url, login and password are required"
      )
    const headers = {
      ...config.headers,
      Accept: "*/*",
      "Cache-Control": "no-cache",
      withCredentials: true,
      "x-csrf-token": FETCH_CSRF_TOKEN
    }
    headers[SESSION_HEADER] = session_types.stateless
    const options: AxiosRequestConfig = {
      ...config,
      auth: { username, password },
      baseURL,
      headers
    }
    this.jar = new CookieJar(undefined, {
      looseMode: true,
      rejectPublicSuffixes: false
    })
    this.axios = Axios.create(options)
  }
  /**
   * Logs on an ADT server. parameters provided on creation
   */
  public async login() {
    const params: any = {}
    if (this.client) params["sap-client"] = this.client
    if (this.language) params["sap-language"] = this.language
    this.csrfToken = FETCH_CSRF_TOKEN
    await this._request("/sap/bc/adt/compatibility/graph", { params })
  }
  public async logout() {
    await this._request("/sap/public/bc/icf/logoff", {})
    // prevent autologin
    this.axios.defaults.auth = undefined
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
  public async request(url: string, config?: AxiosRequestConfig) {
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

  private follow(url: string) {
    if (!url) return this.baseUrl
    const rest = url.replace(/^\.?\//, "")

    if (this.baseUrl.match(/\/$/)) return this.baseUrl + rest
    else return this.baseUrl + "/" + rest
  }

  /**
   * HTTP request without automated login / retry
   *
   * @param url URL suffix
   * @param config request options
   */
  private async _request(url: string, config: AxiosRequestConfig) {
    // config.headers = { Cookie: this.jar.getCookiesSync(this.baseUrl + url) }
    const response = await this.axios(url, config)
    if (this.stateful !== session_types.keep)
      this.currentSession = this.stateful
    const newtoken = response.headers[CSRF_TOKEN_HEADER]
    if (typeof newtoken === "string" && this.csrfToken === FETCH_CSRF_TOKEN) {
      this.csrfToken = newtoken
    }
    const cookie = response.headers["set-cookie"] as string[] | undefined

    if (cookie) {
      cookie.forEach(k => this.jar.setCookieSync(k, this.follow(url)))
      this.axios.defaults.headers.Cookie = this.jar.getCookieStringSync(
        this.follow(url)
      )
    }
    return response
  }
}
