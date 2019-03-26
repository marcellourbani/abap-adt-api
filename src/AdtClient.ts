import { CoreOptions } from "request"
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
  classComponents,
  classIncludes,
  codeCompletion,
  codeCompletionElement,
  codeCompletionFull,
  CreatableTypeIds,
  createObject,
  createTestInclude,
  createTransport,
  deleteObject,
  findDefinition,
  findObjectPath,
  FixProposal,
  fixProposals,
  fragmentMappings,
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
  objectTypes,
  prettyPrinter,
  prettyPrinterSetting,
  PrettyPrinterStyle,
  runUnitTest,
  searchObject,
  setObjectSource,
  setPrettyPrinterSetting,
  syntaxCheck,
  syntaxCheckTypes,
  systemUsers,
  transportAddUser,
  transportDelete,
  transportInfo,
  transportRelease,
  transportSetOwner,
  typeHierarchy,
  unLock,
  UsageReference,
  usageReferences,
  usageReferenceSnippets,
  userTransports,
  validateNewObject,
  ValidateOptions,
  transportReference
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
): CoreOptions {
  return { ca, rejectUnauthorized: !allowUnauthorized }
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
    private config: CoreOptions = {}
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
    return response.body
  }

  public transportInfo(
    objSourceUrl: string,
    devClass?: string,
    operation: string = "I"
  ) {
    return transportInfo(this.h, objSourceUrl, devClass, operation)
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

  public createTestInclude(clas: string, lockHandle: string) {
    return createTestInclude(this.h, clas, lockHandle)
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

  public syntaxCheckTypes() {
    return syntaxCheckTypes(this.h)
  }

  public syntaxCheck(
    inclUrl: string,
    mainUrl: string,
    content: string,
    mainProgram: string = "",
    version: string = "active"
  ) {
    return syntaxCheck(this.h, inclUrl, mainUrl, content, mainProgram, version)
  }

  public codeCompletion(
    sourceUrl: string,
    source: string,
    line: number,
    column: number
  ) {
    return codeCompletion(this.h, sourceUrl, source, line, column)
  }
  public codeCompletionFull(
    sourceUrl: string,
    source: string,
    line: number,
    column: number,
    patternKey: string
  ) {
    return codeCompletionFull(
      this.h,
      sourceUrl,
      source,
      line,
      column,
      patternKey
    )
  }

  /**
   * Read code completion elements
   * Will fail on older systems where this returns HTML fragments rather than XML
   *
   * @param {string} sourceUrl
   * @param {string} source
   * @param {number} line
   * @param {number} column
   * @returns
   * @memberof ADTClient
   */
  public codeCompletionElement(
    sourceUrl: string,
    source: string,
    line: number,
    column: number
  ) {
    return codeCompletionElement(this.h, sourceUrl, source, line, column)
  }

  public findDefinition(
    url: string,
    source: string,
    line: number,
    startCol: number,
    endCol: number,
    implementation = false
  ) {
    return findDefinition(
      this.h,
      url,
      source,
      line,
      startCol,
      endCol,
      implementation
    )
  }

  public usageReferences(url: string, line?: number, column?: number) {
    return usageReferences(this.h, url, line, column)
  }

  public usageReferenceSnippets(references: UsageReference[]) {
    return usageReferenceSnippets(this.h, references)
  }

  public fixProposals(
    url: string,
    source: string,
    line: number,
    column: number
  ) {
    return fixProposals(this.h, url, source, line, column)
  }

  public runUnitTest(url: string) {
    return runUnitTest(this.h, url)
  }

  public classComponents(url: string) {
    return classComponents(this.h, url)
  }

  public fragmentMappings(url: string, type: string, name: string) {
    return fragmentMappings(this.h, url, type, name)
  }

  public objectTypes() {
    return objectTypes(this.h)
  }

  public prettyPrinterSetting() {
    return prettyPrinterSetting(this.h)
  }

  public setPrettyPrinterSetting(indent: boolean, style: PrettyPrinterStyle) {
    return setPrettyPrinterSetting(this.h, indent, style)
  }

  public prettyPrinter(source: string) {
    return prettyPrinter(this.h, source)
  }

  public typeHierarchy(
    url: string,
    body: string,
    line: number,
    offset: number,
    superTypes = false
  ) {
    return typeHierarchy(this.h, url, body, line, offset, superTypes)
  }

  public userTransports(user: string, targets = true) {
    return userTransports(this.h, user, targets)
  }

  public transportDelete(transportNumber: string) {
    return transportDelete(this.h, transportNumber)
  }

  public transportRelease(
    transportNumber: string,
    ignoreLocks = false,
    IgnoreATC = false
  ) {
    return transportRelease(this.h, transportNumber, ignoreLocks, IgnoreATC)
  }

  public transportSetOwner(transportNumber: string, targetuser: string) {
    return transportSetOwner(this.h, transportNumber, targetuser)
  }

  public transportAddUser(transportNumber: string, user: string) {
    return transportAddUser(this.h, transportNumber, user)
  }

  public systemUsers() {
    return systemUsers(this.h)
  }
  public transportReference(
    pgmid: string,
    obj_wbtype: string,
    obj_name: string
  ) {
    return transportReference(this.h, pgmid, obj_wbtype, obj_name)
  }
}
