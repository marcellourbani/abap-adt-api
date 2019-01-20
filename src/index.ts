import Axios, { AxiosRequestConfig, AxiosInstance } from "axios"
//const CSRF_EXPIRED = "CSRF_EXPIRED"
const FETCH_CSRF_TOKEN = "fetch"
const CSRF_TOKEN_HEADER = "x-csrf-token"

export class ADTClient {
  public stateful: boolean = false
  axios: AxiosInstance
  public get csrfToken() {
    return this.axios.defaults.headers[CSRF_TOKEN_HEADER]
  }

  constructor(
    private baseUrl: string,
    private username: string,
    private password: string,
    readonly client: string = "",
    readonly language: string = ""
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
        "X-sap-adt-sessiontype": this.stateful ? "stateful" : "",
        "Cache-Control": "no-cache",
        Accept: "*/*"
      }
    })
  }

  public async login() {
    let sep = "?"
    let extra = ""
    if (this.client) {
      extra = `?sap-client=${this.client}`
      sep = "&"
    }
    if (this.language) extra = extra + sep + `sap-language=${this.language}`
    const response = await this.axios(`/sap/bc/adt/compatibility/graph${extra}`)
    const newtoken = response.headers[CSRF_TOKEN_HEADER]
    if (typeof newtoken === "string") {
      this.axios.defaults.headers[CSRF_TOKEN_HEADER] = newtoken
    }
    // TODO: raise exception on no token
  }
}
