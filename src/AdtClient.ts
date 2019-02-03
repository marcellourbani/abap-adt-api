import { AdtException, adtException } from "./AdtException"
import { AdtHTTP, session_types } from "./AdtHTTP"
import {
  AbapClassStructure,
  AbapObjectStructure,
  activate,
  classIncludes,
  createObject,
  createTransport,
  deleteObject,
  findObjectPath,
  getObjectSource,
  isClassStructure,
  loadTypes,
  lock,
  mainPrograms,
  NewObjectOptions,
  nodeContents,
  NodeParents,
  NodeStructure,
  objectRegistrationInfo,
  objectStructure,
  searchObject,
  setObjectSource,
  transportInfo,
  unLock,
  validateNewObject,
  ValidateOptions
} from "./api"
import { AxiosRequestConfig } from "axios"

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
  private pClone?: ADTClient
  private pIsClone?: boolean

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
    language: string = "",
    private config: AxiosRequestConfig = {}
  ) {
    if (!(baseUrl && username && password))
      throw new Error(
        "Invalid ADTClient configuration: url, login and password are required"
      )
    this.h = new AdtHTTP(baseUrl, username, password, client, language, config)
  }
  public get statelessClone() {
    if (this.pIsClone) return this
    if (!this.pClone) {
      this.pClone = new ADTClient(
        this.baseUrl,
        this.username,
        this.password,
        this.client,
        this.language,
        this.config
      )
      this.pClone.pIsClone = true
    }
    return this.pClone
  }
  public get stateful() {
    return this.h.stateful
  }
  public set stateful(stateful: session_types) {
    if (this.pIsClone)
      throw adtException("Stateful sessions not allowed in stateless clones")
    this.h.stateful = stateful
  }

  public get isStateful() {
    return this.h.isStateful
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
  private get password() {
    return this.h.password
  }

  /**
   * Logs on an ADT server. parameters provided on creation
   */
  public async login() {
    await this.h.login()
  }
  /**
   * Logs out current user, clearing cookies
   * NOTE: you won't be able to login again with this client
   *
   * @memberof ADTClient
   */
  public async logout() {
    await this.h.logout()
  }
  public async dropSession() {
    await this.h.dropSession()
  }

  public async nodeContents(
    // tslint:disable: variable-name
    parent_type: NodeParents,
    parent_name?: string,
    user_name?: string,
    parent_tech_name?: string
  ): Promise<NodeStructure> {
    return nodeContents(
      this.h,
      parent_type,
      parent_name,
      user_name,
      parent_tech_name
    )
  }

  public async reentranceTicket(): Promise<string> {
    const response = await this.h.request(
      "/sap/bc/adt/security/reentranceticket"
    )
    return response.data
  }

  public async transportInfo(objSourceUrl: string, devClass: string) {
    return transportInfo(this.h, objSourceUrl, devClass)
  }

  public async createTransport(
    objSourceUrl: string,
    REQUEST_TEXT: string,
    DEVCLASS: string
  ) {
    return createTransport(this.h, objSourceUrl, REQUEST_TEXT, DEVCLASS)
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

  public async mainPrograms(includeUrl: string) {
    return mainPrograms(this.h, includeUrl)
  }

  public async lock(objectUrl: string, accessMode: string = "MODIFY") {
    return await lock(this.h, objectUrl, accessMode)
  }
  public async unLock(objectUrl: string, lockHandle: string) {
    return await unLock(this.h, objectUrl, lockHandle)
  }

  public async getObjectSource(objectSourceUrl: string) {
    return getObjectSource(this.h, objectSourceUrl)
  }

  public async setObjectSource(
    objectSourceUrl: string,
    source: string,
    lockHandle: string,
    transport?: string
  ) {
    return await setObjectSource(
      this.h,
      objectSourceUrl,
      source,
      lockHandle,
      transport
    )
  }

  public async searchObject(query: string, objType?: string) {
    return await searchObject(this.h, query, objType)
  }

  public async findObjectPath(objectUrl: string) {
    return findObjectPath(this.h, objectUrl)
  }

  public async validateNewObject(options: ValidateOptions) {
    return validateNewObject(this.h, options)
  }

  public async createObject(options: NewObjectOptions) {
    return await createObject(this.h, options)
  }

  public async objectRegistrationInfo(objectUrl: string) {
    return await objectRegistrationInfo(this.h, objectUrl)
  }

  public async deleteObject(objectUrl: string, lockHandle: string) {
    return await deleteObject(this.h, objectUrl, lockHandle)
  }

  public async loadTypes() {
    return await loadTypes(this.h)
  }
}
