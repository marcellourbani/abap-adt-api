import { AdtHTTP } from "./AdtHTTP"
import * as api from "./api"
import { createTransport, getTransportInfo } from "./api"

export class ADTClient {
  private h: AdtHTTP

  /**
   * Create an ADT client
   *
   * @argument baseUrl  Base url, i.e. http://vhcalnplci.local:8000
   * @argument username SAP logon user
   * @argument password Password
   * @argument client   Login client (optional)
   * @argument language Language key (optional)
   */
  constructor(
    baseUrl: string,
    username: string,
    password: string,
    readonly client: string = "",
    readonly language: string = ""
  ) {
    if (!(baseUrl && username && password))
      throw new Error(
        "Invalid ADTClient configuration: url, login and password are required"
      )
    this.h = new AdtHTTP(baseUrl, username, password)
  }
  public get stateful() {
    return this.h.stateful
  }
  public set stateful(stateful: boolean) {
    this.h.stateful = stateful
  }

  public get csrfToken() {
    return this.h.csrfToken
  }

  /**
   * Logs on an ADT server. parameters provided on creation
   */
  public async login() {
    let sep = "?"
    let extra = ""
    if (this.client) {
      extra = `?sap-client=${this.client}`
      sep = "&"
    }
    if (this.language) extra = extra + sep + `sap-language=${this.language}`
    await this.h.request(`/sap/bc/adt/compatibility/graph${extra}`)
  }

  public async getNodeContents(
    options: api.NodeRequestOptions
  ): Promise<api.NodeStructure> {
    return api.getNodeContents(this.h, options)
  }

  public async getReentranceTicket(): Promise<string> {
    const response = await this.h.request(
      "/sap/bc/adt/security/reentranceticket"
    )
    return response.data
  }

  public async getTransportInfo(objPath: string, devClass: string) {
    return getTransportInfo(this.h, objPath, devClass)
  }

  public async createTransport(
    objPath: string,
    REQUEST_TEXT: string,
    DEVCLASS: string
  ) {
    return createTransport(this.h, objPath, REQUEST_TEXT, DEVCLASS)
  }
}
