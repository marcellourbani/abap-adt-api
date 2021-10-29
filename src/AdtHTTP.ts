import axios, { Axios, AxiosRequestConfig, AxiosResponse, AxiosError } from "axios"
import { fromException, isCsrfError } from "./AdtException"
const FETCH_CSRF_TOKEN = "fetch"
const CSRF_TOKEN_HEADER = "x-csrf-token"
const SESSION_HEADER = "X-sap-adt-sessiontype"

export enum session_types {
  stateful = "stateful",
  stateless = "stateless",
  keep = ""
}

export interface HttpResponse extends AxiosResponse {
  body: string
}
export interface ClientOptions extends AxiosRequestConfig {
  //   debugCallback?: LogCallback<Request, CoreOptions, RequiredUriUrl>

}
// export interface ClientOptions extends CoreOptions {
//   debugCallback?: LogCallback<Request, CoreOptions, RequiredUriUrl>
// }
export type BearerFetcher = () => Promise<string>
export class AdtHTTP {
  private options: ClientOptions
  private loginPromise?: Promise<any>
  private getToken?: BearerFetcher
  private userName?: string
  axios: any;
  cookie: String | undefined
  public get isStateful() {
    return (
      this.stateful === session_types.stateful ||
      (this.stateful === session_types.keep &&
        this.currentSession === session_types.stateful)
    )
  }
  private currentSession = session_types.stateless
  public get stateful(): session_types {
    const sessionType = this.options.headers![SESSION_HEADER]
    return sessionType as session_types
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
  public get loggedin() {
    return this.csrfToken !== FETCH_CSRF_TOKEN
  }
  public get baseURL() {
    return this.options.baseURL!
  }
  public get username() {
    return (
      this.userName || (this.options.auth && this.options.auth.username) || ""
    )
  }
  public get password() {
    return (this.options.auth && this.options.auth.password) || ""
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

    this.options = {
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
      this.options.auth = { username, password }
    } else {
      this.getToken = password
      this.userName = username
    }

    this.axios = axios.create(this.options)
    // if (config.debugCallback)
    // curlirize(this.axios);



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
    let token = this.getToken
    if (token) {
      config.headers!['Authorization'] = token.toString()
    }
    if (config.headers && !config.headers!['Cookie']) {
      let localCookie: string | undefined = this.cookie as string;
      config.headers!['Cookie'] = localCookie || ""

      console.log(config.headers)
    }
    // console.log(config.headers!['Cookie'])
    // console.log(token?.toString)
    // const cookieString = this.asCookieString()
    // if (cookieString)
    //   config.jar?.setCookieSync(cookieString, config.baseURL!)
    // console.log(config)


    return config;
  };

  private _handleResponse = (response: AxiosResponse) => {
    const cookies = response.headers["set-cookie"]
    if (cookies && !this.cookie) {
      var arr = cookies.map(cookie => cookie.replace(/path=\/,/g, '').replace(/path=\//g, '').split(";")[0])

      this.cookie = arr.join(";")
    }
    // console.log(response.data)
    // console.log(response.status)
    // console.log(response)
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
    const params: any = {}
    if (this.client) params["sap-client"] = this.client
    if (this.language) params["sap-language"] = this.language
    this.csrfToken = FETCH_CSRF_TOKEN
    try {
      this.loginPromise = this._request("/sap/bc/adt/compatibility/graph", {
        params
      })
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
  public async request(url: string, config?: AxiosRequestConfig): Promise<HttpResponse> {
    let autologin = false
    try {
      if (!this.loggedin) {
        autologin = true
        await this.login()
      }
      return await this._request(url, config || {})
    } catch (e) {
      const adtErr = fromException(e as AxiosError)
      // if the logon ticket expired try to logon again, unless in stateful mode
      // or already tried a login
      if (isCsrfError(adtErr) && !autologin && !this.isStateful) {
        try {
          await this.login()
          return await this._request(url, config || {})
        } catch (e2) {
          throw fromException(e2 as AxiosError)
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
  private _request(url: string, options: AxiosRequestConfig) {
    let headers = this.options.headers || {}
    if (options.headers) headers = { ...headers, ...options.headers }
    const axiosUo: AxiosRequestConfig = { ... this.options, ...options, headers, }
    axiosUo.url = url
    axiosUo.data = (options.data) ? options.data.replace(/\r?\n|\r/g, "") : undefined;
    // const uo: OptionsWithUrl = { ...this.options, ...options, headers, url }
    return new Promise<HttpResponse>(async (resolve, reject) => {
      try {
        const response = await this.axios.request(axiosUo);
        if (response.status < 400) {
          if (this.csrfToken === FETCH_CSRF_TOKEN) {
            const newtoken = response.headers[CSRF_TOKEN_HEADER]
            if (typeof newtoken === "string") this.csrfToken = newtoken
            this.options.headers!["x-csrf-token"] = this.csrfToken

          }
          const httpResponse: HttpResponse = { ...response, body: "" + response.data }
          resolve(httpResponse)
        }
        else {
          reject(response as AxiosError)
        }
      } catch (error) {
        reject(error as AxiosError)
      }

      // request(uo, async (error, response) => {
      //   if (error) reject(error)
      //   else if (response.statusCode < 400) {
      //     if (this.csrfToken === FETCH_CSRF_TOKEN) {
      //       const newtoken = response.headers[CSRF_TOKEN_HEADER]
      //       if (typeof newtoken === "string") this.csrfToken = newtoken
      //     }
      //     resolve(response)
      //   } else reject(fromException(response))
      // })
    })
  }
}
