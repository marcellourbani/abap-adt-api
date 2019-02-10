import { AxiosRequestConfig } from "axios"
import { Agent } from "https"
import { isString } from "util"
import { adtException } from "./AdtException"
import { AdtHTTP, session_types } from "./AdtHTTP"
import {
  AbapClassStructure,
  AbapObjectStructure,
  activate,
  ActivationResult,
  adtCompatibilityGraph,
  adtCoreDiscovery,
  adtDiscovery,
  classIncludes,
  CreatableTypeIds,
  createObject,
  createTransport,
  deleteObject,
  findObjectPath,
  getObjectSource,
  InactiveObject,
  isClassStructure,
  isCreatableTypeId,
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
  syntaxCheck,
  transportInfo,
  unLock,
  validateNewObject,
  ValidateOptions
} from "./api"

const followUrl = (base: string, extra: string) => {
  if (extra.match(/^\.\//)) {
    base = base.replace(/[^\/]*$/, "")
    extra = extra.replace(/^\.\//, "")
  } else extra = extra.replace(/^\//, "")
  base = base.replace(/\/$/, "")
  return base + "/" + extra
}
export function createSSLConfig(
  allowUnauthorized: boolean,
  ca?: string
): AxiosRequestConfig {
  const httpsAgent = new Agent({ ca, rejectUnauthorized: !allowUnauthorized })
  return { httpsAgent }
}
export class ADTClient {
  public static mainInclude(object: AbapObjectStructure): string {
    if (isClassStructure(object)) {
      const mainInclude = object.includes.find(
        x => x["class:includeType"] === "main"
      )
      const mainLink =
        mainInclude &&
        (mainInclude.links.find(x => x.type === "text/plain") ||
          mainInclude.links.find(x => !x.type)) // CDS have no type for the plain text link...
      if (mainLink) return followUrl(object.objectUrl, mainLink.href)
    } else {
      const mainLink = object.links.find(x => x.type === "text/plain")
      if (mainLink) return followUrl(object.objectUrl, mainLink.href)
    }
    return followUrl(object.objectUrl, "/source/main")
  }

  public static classIncludes(clas: AbapClassStructure) {
    const includes = new Map<classIncludes, string>()
    for (const i of clas.includes) {
      const mainLink = i.links.find(x => x.type === "text/plain")
      includes.set(
        i["class:includeType"] as classIncludes,
        followUrl(clas.objectUrl, mainLink!.href)
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

    if (baseUrl.match(/^http:/i)) {
      // ignore httpsAgent if no SSL
      const { httpAgent, ...rest } = config
      this.config = config = rest
    }
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
  public login() {
    return this.h.login()
  }
  /**
   * Logs out current user, clearing cookies
   * NOTE: you won't be able to login again with this client
   *
   * @memberof ADTClient
   */
  public logout() {
    return this.h.logout()
  }
  public dropSession() {
    return this.h.dropSession()
  }

  public nodeContents(
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

  public transportInfo(objSourceUrl: string, devClass?: string) {
    return transportInfo(this.h, objSourceUrl, devClass)
  }

  public createTransport(
    objSourceUrl: string,
    REQUEST_TEXT: string,
    DEVCLASS: string
  ) {
    return createTransport(this.h, objSourceUrl, REQUEST_TEXT, DEVCLASS)
  }

  public objectStructure(objectUrl: string): Promise<AbapObjectStructure> {
    return objectStructure(this.h, objectUrl)
  }
  public activate(
    object: InactiveObject | InactiveObject[]
  ): Promise<ActivationResult>
  public activate(
    objectName: string,
    objectUrl: string,
    mainInclude?: string
  ): Promise<ActivationResult>
  public activate(
    objectName: string | InactiveObject | InactiveObject[],
    objectUrl?: string,
    mainInclude?: string
  ) {
    if (isString(objectName))
      return activate(this.h, objectName, objectUrl!, mainInclude)
    else return activate(this.h, objectName)
  }

  public mainPrograms(includeUrl: string) {
    return mainPrograms(this.h, includeUrl)
  }

  public lock(objectUrl: string, accessMode: string = "MODIFY") {
    return lock(this.h, objectUrl, accessMode)
  }
  public unLock(objectUrl: string, lockHandle: string) {
    return unLock(this.h, objectUrl, lockHandle)
  }

  public getObjectSource(objectSourceUrl: string) {
    return getObjectSource(this.h, objectSourceUrl)
  }

  public setObjectSource(
    objectSourceUrl: string,
    source: string,
    lockHandle: string,
    transport?: string
  ) {
    return setObjectSource(
      this.h,
      objectSourceUrl,
      source,
      lockHandle,
      transport
    )
  }

  /**
   * Search object by name pattern
   *
   * @param {string} query     case sensitive in older systems, no wildcard added
   * @param {string} [objType] if passed, only the first part is used i.e. PROG rather than PROG/P
   * @param {number} [max=100] max number of results
   * @returns
   * @memberof ADTClient
   */
  public searchObject(query: string, objType?: string, max: number = 100) {
    return searchObject(this.h, query, objType, max)
  }

  public findObjectPath(objectUrl: string) {
    return findObjectPath(this.h, objectUrl)
  }

  public validateNewObject(options: ValidateOptions) {
    return validateNewObject(this.h, options)
  }

  public createObject(
    objtype: CreatableTypeIds,
    name: string,
    parentName: string,
    description: string,
    parentPath: string,
    responsible?: string,
    transport?: string
  ): Promise<void>
  public createObject(options: NewObjectOptions): Promise<void>
  public createObject(
    optionsOrType: NewObjectOptions | CreatableTypeIds,
    name?: string,
    parentName?: string,
    description?: string,
    parentPath?: string,
    responsible: string = "",
    transport: string = ""
  ) {
    if (isCreatableTypeId(optionsOrType)) {
      if (!name || !parentName || !parentPath || !description)
        throw adtException("")
      return createObject(this.h, {
        description,
        name,
        objtype: optionsOrType as CreatableTypeIds,
        parentName,
        parentPath,
        responsible,
        transport
      })
    } else return createObject(this.h, optionsOrType)
  }

  public objectRegistrationInfo(objectUrl: string) {
    return objectRegistrationInfo(this.h, objectUrl)
  }

  public deleteObject(
    objectUrl: string,
    lockHandle: string,
    transport?: string
  ) {
    return deleteObject(this.h, objectUrl, lockHandle, transport)
  }

  public loadTypes() {
    return loadTypes(this.h)
  }

  public adtDiscovery() {
    return adtDiscovery(this.h)
  }
  public adtCoreDiscovery() {
    return adtCoreDiscovery(this.h)
  }
  public adtCompatibiliyGraph() {
    return adtCompatibilityGraph(this.h)
  }

  public syntaxCheck(
    inclUrl: string,
    mainUrl: string,
    content: string,
    version: string = "active"
  ) {
    return syntaxCheck(this.h, inclUrl, mainUrl, content, version)
  }
}
