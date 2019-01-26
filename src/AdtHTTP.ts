import Axios, { AxiosInstance, AxiosRequestConfig } from "axios"
import { fromException, isCsrfError } from "./AdtException"

const FETCH_CSRF_TOKEN = "fetch"
const CSRF_TOKEN_HEADER = "x-csrf-token"
const SESSION_HEADER = "X-sap-adt-sessiontype"
export enum session_types {
  stateful = "stateful",
  stateless = "steteless",
  keep = ""
}
const parseCookies = (cookies: string[]) =>
  cookies.reduce(
    (acc, cur) => {
      const parts = cur.split("=")
      if (parts && parts[0]) acc[parts[0]] = cur
      return acc
    },
    {} as any
  )

export class AdtHTTP {
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
  private axios: AxiosInstance

  /**
   * Create an ADT HTTP client
   *
   * @argument baseUrl  Base url, i.e. http://vhcalnplci.local:8000
   * @argument username SAP logon user
   * @argument password Password
   */
  constructor(
    readonly baseUrl: string,
    readonly username: string,
    private password: string,
    readonly client: string,
    readonly language: string
  ) {
    if (!(baseUrl && username && password))
      throw new Error(
        "Invalid ADTClient configuration: url, login and password are required"
      )
    const headers: any = {
      Accept: "*/*",
      "Cache-Control": "no-cache",
      withCredentials: true,
      "x-csrf-token": FETCH_CSRF_TOKEN
    }
    headers[SESSION_HEADER] = session_types.stateless
    this.axios = Axios.create({
      auth: { username: this.username, password: this.password },
      baseURL: this.baseUrl,
      headers
    })
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

  public async dropSession() {
    this.stateful = session_types.stateless
    await this._request("/sap/bc/adt/compatibility/graph")
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
      return await this._request(url, config)
    } catch (e) {
      const adtErr = fromException(e)
      // if the logon ticket expired try to logon again, unless in stateful mode
      // or already tried a login
      if (isCsrfError(adtErr) && !autologin && !this.isStateful) {
        try {
          await this.login()
          return await this._request(url, config)
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
   * @param config request options
   */
  private async _request(url: string, config?: AxiosRequestConfig) {
    const response = await this.axios(url, config)
    if (this.stateful !== session_types.keep)
      this.currentSession = this.stateful
    const newtoken = response.headers[CSRF_TOKEN_HEADER]
    if (typeof newtoken === "string" && this.csrfToken === FETCH_CSRF_TOKEN) {
      this.axios.defaults.headers[CSRF_TOKEN_HEADER] = newtoken
    }
    const cookie = response.headers["set-cookie"] as string[] | undefined
    // if (cookie) this.axios.defaults.headers.Cookie = cookie
    if (cookie) {
      const c = {
        ...parseCookies(this.axios.defaults.headers.Cookie || []),
        ...parseCookies(cookie)
      }
      this.axios.defaults.headers.Cookie = Object.values(c)
    }
    return response
  }
}
