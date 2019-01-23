import { AdtHTTP } from "./AdtHTTP"
import * as api from "./api"
import {
  AbapClassStructure,
  AbapObjectStructure,
  activate,
  classIncludes,
  createTransport,
  getTransportInfo,
  isClassStructure,
  objectStructure
} from "./api"

export class ADTClient {
  public static mainInclude(object: AbapObjectStructure): string {
    if (isClassStructure(object)) {
      const mainInclude = object.includes.find(
        x => x["class:includeType"] === "main"
      )
      const mainLink =
        mainInclude && mainInclude.links.find(x => x.type === "text/plain")
      if (mainLink) return object.objectUrl + "/" + mainLink.href
    } else {
      const mainLink = object.links.find(x => x.type === "text/plain")
      if (mainLink) return object.objectUrl + "/" + mainLink.href
    }
    return object.objectUrl + "/source/main"
  }

  public static classIncludes(clas: AbapClassStructure) {
    const includes = new Map<classIncludes, string>()
    for (const i of clas.includes) {
      const mainLink = i.links.find(x => x.type === "text/plain")
      includes.set(
        i["class:includeType"] as classIncludes,
        clas.objectUrl + "/" + mainLink!.href
      )
    }
    return includes
  }

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
    client: string = "",
    language: string = ""
  ) {
    if (!(baseUrl && username && password))
      throw new Error(
        "Invalid ADTClient configuration: url, login and password are required"
      )
    this.h = new AdtHTTP(baseUrl, username, password, client, language)
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
  public get baseUrl() {
    return this.h.baseUrl
  }
  public get client() {
    return this.h.client
  }
  public get language() {
    return this.h.language
  }
  public get username() {
    return this.h.username
  }

  /**
   * Logs on an ADT server. parameters provided on creation
   */
  public async login() {
    await this.h.login()
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

  public async getTransportInfo(objPartUrl: string, devClass: string) {
    return getTransportInfo(this.h, objPartUrl, devClass)
  }

  public async createTransport(
    objPartUrl: string,
    REQUEST_TEXT: string,
    DEVCLASS: string
  ) {
    return createTransport(this.h, objPartUrl, REQUEST_TEXT, DEVCLASS)
  }

  public async objectStructure(
    objectUrl: string
  ): Promise<AbapObjectStructure> {
    return objectStructure(this.h, objectUrl)
  }

  public async activate(
    objectName: string,
    objectUrl: string,
    mainInclude?: string
  ) {
    return activate(this.h, objectName, objectUrl, mainInclude)
  }
}