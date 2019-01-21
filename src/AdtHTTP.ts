import Axios, { AxiosInstance, AxiosRequestConfig } from "axios"
const FETCH_CSRF_TOKEN = "fetch"
const CSRF_TOKEN_HEADER = "x-csrf-token"
const SESSION_HEADER = "X-sap-adt-sessiontype"

export class AdtHTTP {
  public get stateful() {
    return this.axios.defaults.headers[SESSION_HEADER] === "stateful"
  }
  public set stateful(stateful: boolean) {
    this.axios.defaults.headers[SESSION_HEADER] = stateful ? "stateful" : ""
  }
  public get csrfToken() {
    return this.axios.defaults.headers[CSRF_TOKEN_HEADER]
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
    private baseUrl: string,
    private username: string,
    private password: string
  ) {
    if (!(baseUrl && username && password))
      throw new Error(
        "Invalid ADTClient configuration: url, login and password are required"
      )
    this.axios = Axios.create({
      baseURL: this.baseUrl,
      auth: { username: this.username, password: this.password },
      headers: {
        "x-csrf-token": FETCH_CSRF_TOKEN,
        SESSION_HEADER: "",
        "Cache-Control": "no-cache",
        withCredentials: true,
        Accept: "*/*"
      }
    })
  }
  /**
   * HTTP request using default values, and updating cookies/token
   *
   * @param url URL suffix
   * @param config request options
   */
  public async request(url: string, config?: AxiosRequestConfig) {
    try {
      const response = await this.axios(url, config)
      this.axios.defaults.headers.Cookie = response.headers["set-cookie"]
      const newtoken = response.headers[CSRF_TOKEN_HEADER]
      if (typeof newtoken === "string" && this.csrfToken === FETCH_CSRF_TOKEN) {
        this.axios.defaults.headers[CSRF_TOKEN_HEADER] = newtoken
      }
      return response
    } catch (e) {
      throw e
    }
  }
}
