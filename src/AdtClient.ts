import { Http2ServerRequest } from "http2"
import { adtException } from "./AdtException"
import { AdtHTTP, ClientOptions, session_types, BearerFetcher } from "./AdtHTTP"

import {
  AbapClassStructure,
  abapDocumentation,
  AbapObjectStructure,
  activate,
  ActivationResult,
  adtCompatibilityGraph,
  AdtCompatibilityGraph,
  adtCoreDiscovery,
  AdtCoreDiscoveryResult,
  adtDiscovery,
  AdtDiscoveryResult,
  AdtLock,
  annotationDefinitions,
  bindingDetails,
  BindingServiceResult,
  checkRepo,
  ClassComponent,
  classComponents,
  classIncludes,
  codeCompletion,
  codeCompletionElement,
  codeCompletionFull,
  CompletionElementInfo,
  CompletionProposal,
  CreatableTypeIds,
  createObject,
  createRepo,
  createTestInclude,
  createTransport,
  createTransportsConfig,
  ddicElement,
  DdicElement,
  DdicObjectReference,
  ddicRepositoryAccess,
  DebugAttach,
  DebugBreakpoint,
  DebugBreakpointError,
  DebugChildVariablesInfo,
  Debuggee,
  debuggerAttach,
  debuggerChildVariables,
  debuggerDeleteBreakpoints,
  debuggerDeleteListener,
  debuggerGoToStack,
  debuggerGoToStackOld,
  debuggerListen,
  debuggerListeners,
  debuggerSaveSettings,
  DebuggerScope,
  debuggerSetBreakpoints,
  debuggerSetVariableValue,
  debuggerStack,
  debuggerStep,
  debuggerVariables,
  DebuggingMode,
  DebugListenerError,
  DebugSettings,
  DebugStackInfo,
  DebugStep,
  DebugStepType,
  DebugVariable,
  DefinitionLocation,
  deleteObject,
  Delta,
  dumps,
  DumpsFeed,
  externalRepoInfo,
  Feed,
  feeds,
  findDefinition,
  findObjectPath,
  fixEdits,
  FixProposal,
  fixProposals,
  FragmentLocation,
  fragmentMappings,
  getObjectSource,
  getTransportConfiguration,
  GitExternalInfo,
  GitObject,
  GitRemoteInfo,
  GitRepo,
  gitRepos,
  GitStaging,
  HierarchyNode,
  InactiveObject,
  InactiveObjectRecord,
  inactiveObjects,
  isClassStructure,
  isCreatableTypeId,
  isPackageType,
  loadTypes,
  lock,
  MainInclude,
  mainPrograms,
  NewObjectOptions,
  nodeContents,
  NodeParents,
  NodeStructure,
  objectRegistrationInfo,
  objectStructure,
  ObjectType,
  ObjectTypeDescriptor,
  objectTypes,
  packageSearchHelp,
  PackageValueHelpResult,
  PackageValueHelpType,
  PathStep,
  prettyPrinter,
  prettyPrinterSetting,
  PrettyPrinterSettings,
  PrettyPrinterStyle,
  publishServiceBinding,
  pullRepo,
  pushRepo,
  QueryResult,
  RegistrationInfo,
  remoteRepoInfo,
  Revision,
  revisions,
  runQuery,
  runUnitTest,
  searchObject,
  SearchResult,
  ServiceBinding,
  setObjectSource,
  setPrettyPrinterSetting,
  setTransportsConfig,
  simpleDebuggerStack,
  stageRepo,
  switchRepoBranch,
  syntaxCheck,
  syntaxCheckCDS,
  SyntaxCheckResult,
  syntaxCheckTypes,
  SystemUser,
  systemUsers,
  tableContents,
  transportAddUser,
  TransportAddUserResponse,
  TransportConfiguration,
  TransportConfigurationEntry,
  transportConfigurations,
  transportDelete,
  transportInfo,
  TransportInfo,
  TransportOwnerResponse,
  transportReference,
  transportRelease,
  TransportReleaseReport,
  transportsByConfig,
  transportSetOwner,
  TransportsOfUser,
  typeHierarchy,
  UnitTestClass,
  unlinkRepo,
  unLock,
  unpublishServiceBinding,
  UsageReference,
  usageReferences,
  UsageReferenceSnippet,
  usageReferenceSnippets,
  userTransports,
  validateNewObject,
  ValidateOptions,
  ValidationResult
} from "./api"
import { followUrl, isString } from "./utilities"
import https from 'https'
import { createCookieAgent } from 'http-cookie-agent';
import { HttpCookieAgent, HttpsCookieAgent } from 'http-cookie-agent'
import { Cookie, CookieJar } from "tough-cookie";


export function createSSLConfig(
  allowUnauthorized: boolean,
  ca?: string
): ClientOptions {
  const jar = new CookieJar();

  const agent = new HttpsCookieAgent({
    jar, 
    keepAlive: true,
    rejectUnauthorized: false, // disable CA checks
  });

  return { httpsAgent : agent }
}
interface HttpOptions {
  baseUrl: string
  username: string
  password: string | BearerFetcher
  client: string
  language: string
  options: ClientOptions
}
export class ADTClient {
  private discovery?: AdtDiscoveryResult[]
  private fetcher?: () => Promise<string>

  public get httpClient() {
    return this.h
  }

  public static mainInclude(
    object: AbapObjectStructure,
    withDefault = true
  ): string {
    // packages don't really have any include
    if (isPackageType(object.metaData["adtcore:type"])) return object.objectUrl
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
      const source = object.metaData["abapsource:sourceUri"]
      if (source) return followUrl(object.objectUrl, source)
      const mainLink = object.links.find(x => x.type === "text/plain")
      if (mainLink) return followUrl(object.objectUrl, mainLink.href)
    }
    return withDefault
      ? followUrl(object.objectUrl, "/source/main")
      : object.objectUrl
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
  private options: HttpOptions

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
    password: string | BearerFetcher,
    client: string = "",
    language: string = "",
    options: ClientOptions = {}
  ) {
    if (!(baseUrl && username && password))
      throw new Error(
        "Invalid ADTClient configuration: url, login and password are required"
      )
    if (typeof password !== "string") password = this.wrapFetcher(password)
    this.options = { baseUrl, username, password, client, language, options }
    this.h = this.createHttp()
  }

  private createHttp() {
    const o = this.options
    return new AdtHTTP(
      o.baseUrl,
      o.username,
      o.password,
      o.client,
      o.language,
      o.options
    )
  }

  private wrapFetcher: (f: BearerFetcher) => BearerFetcher = fetcher => {
    let fetchBearer: Promise<string>
    if (this.fetcher) return this.fetcher
    this.fetcher = () => {
      fetchBearer = fetchBearer || fetcher()
      return fetchBearer
    }
    return this.fetcher
  }

  public get statelessClone(): ADTClient {
    if (this.pIsClone) return this
    if (!this.pClone) {
      const pw = this.fetcher || this.password
      this.pClone = new ADTClient(
        this.baseUrl,
        this.username,
        pw,
        this.client,
        this.language,
        this.options.options
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

  public get loggedin() {
    return this.h.loggedin
  }

  public get isStateful() {
    return this.h.isStateful
  }

  public get csrfToken() {
    return this.h.csrfToken
  }
  public get baseUrl() {
    return this.h.baseURL
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
    // if loggedoff create a new client
    if (!this.h.username) this.h = this.createHttp()
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

  public get sessionID() {
    const cookies = this.h.ascookies() || []
    const sc = cookies.find(c => !!c.key.match(/SAP_SESSIONID/))
    return sc ? sc.value : ""
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
    return "" +response.data || ""
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
    DEVCLASS: string,
    transportLayer?: string
  ) {
    return createTransport(
      this.h,
      objSourceUrl,
      REQUEST_TEXT,
      DEVCLASS,
      "I",
      transportLayer
    )
  }

  public objectStructure(objectUrl: string): Promise<AbapObjectStructure> {
    return objectStructure(this.h, objectUrl)
  }
  public activate(
    object: InactiveObject | InactiveObject[],
    preauditRequested?: boolean
  ): Promise<ActivationResult>
  public activate(
    objectName: string,
    objectUrl: string,
    mainInclude?: string,
    preauditRequested?: boolean
  ): Promise<ActivationResult>
  public activate(
    objectNameOrObjects: string | InactiveObject | InactiveObject[],
    objectUrlOrPreauditReq: string | boolean = true,
    mainInclude?: string,
    preauditRequested = true
  ) {
    if (isString(objectNameOrObjects))
      return activate(
        this.h,
        objectNameOrObjects,
        objectUrlOrPreauditReq as string, // validated downstream
        mainInclude,
        preauditRequested
      )
    else
      return activate(
        this.h,
        objectNameOrObjects,
        objectUrlOrPreauditReq as boolean // validated downstream
      )
  }

  public inactiveObjects() {
    return inactiveObjects(this.h)
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
  /**
   * Retrieves a resource content (i.e. a program's source code)
   *
   * @param objectSourceUrl Resource URL
   * @param gitUser Username, only used for abapGit objects
   * @param gitPassword password, only used for abapGit objects
   */
  public getObjectSource(
    objectSourceUrl: string,
    gitUser?: string,
    gitPassword?: string
  ) {
    return getObjectSource(this.h, objectSourceUrl, gitUser, gitPassword)
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

  public async featureDetails(title: string) {
    if (!this.discovery) this.discovery = await this.adtDiscovery()
    return this.discovery.find(d => d.title === title)
  }

  public async collectionFeatureDetails(url: string) {
    if (!this.discovery) this.discovery = await this.adtDiscovery()
    return this.discovery.find(f =>
      f.collection.find(c => c.templateLinks.find(l => l.template === url))
    )
  }

  public async findCollectionByUrl(url: string) {
    if (!this.discovery) this.discovery = await this.adtDiscovery()
    for (const discoveryResult of this.discovery) {
      const collection = discoveryResult.collection.find(c => c.href === url)
      if (collection) return { discoveryResult, collection }
    }
  }

  public hasTransportConfig = async () => {
    const collection = await this.findCollectionByUrl("/sap/bc/adt/cts/transportrequests/searchconfiguration/configurations")
    return !!collection
  }

  public createTestInclude(clas: string, lockHandle: string, transport = "") {
    return createTestInclude(this.h, clas, lockHandle, transport)
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
  public syntaxCheck(cdsUrl: string): Promise<SyntaxCheckResult[]>
  public syntaxCheck(
    url: string,
    mainUrl: string,
    content: string,
    mainProgram?: string,
    version?: string
  ): Promise<SyntaxCheckResult[]>
  public syntaxCheck(
    url: string,
    mainUrl?: string,
    content?: string,
    mainProgram: string = "",
    version: string = "active"
  ): Promise<SyntaxCheckResult[]> {
    if (url.match(/^\/sap\/bc\/adt\/((ddic\/ddlx?)|(acm\/dcl))\/sources\//))
      return syntaxCheckCDS(this.h, url, mainUrl, content)
    else {
      if (!mainUrl || !content)
        throw new Error("mainUrl and content are required for syntax check")
      return syntaxCheck(this.h, url, mainUrl, content, mainProgram, version)
    }
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

  public async runClass(className: string) {
    const response = await this.h.request(
      "/sap/bc/adt/oo/classrun/" + className.toUpperCase(),
      {
        method: "POST"
      }
    )
    return "" +response.data
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
    implementation = false,
    mainProgram = ""
  ) {
    return findDefinition(
      this.h,
      url,
      source,
      line,
      startCol,
      endCol,
      implementation,
      mainProgram
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
  public fixEdits(proposal: FixProposal, source: string) {
    return fixEdits(this.h, proposal, source)
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
  public transportConfigurations() {
    return transportConfigurations(this.h)
  }

  public getTransportConfiguration(url: string) {
    return getTransportConfiguration(this.h, url)
  }

  public setTransportsConfig(uri: string, etag: string, config: TransportConfiguration) {
    return setTransportsConfig(this.h, uri, etag, config)
  }

  public createTransportsConfig() {
    return createTransportsConfig(this.h)
  }

  public userTransports(user: string, targets = true) {
    return userTransports(this.h, user, targets)
  }

  public transportsByConfig(configUri: string, targets = true) {
    return transportsByConfig(this.h, configUri, targets)
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

  public revisions(
    objectUrl: string | AbapObjectStructure,
    clsInclude?: classIncludes
  ) {
    return revisions(this.h, objectUrl, clsInclude)
  }

  public abapDocumentation(
    objectUri: string,
    body: string,
    line: number,
    column: number,
    language = "EN"
  ) {
    return abapDocumentation(this.h, objectUri, body, line, column, language)
  }
  public packageSearchHelp(type: PackageValueHelpType, name = "*") {
    return packageSearchHelp(this.h, type, name)
  }
  public gitRepos() {
    return gitRepos(this.h)
  }

  public gitExternalRepoInfo(repourl: string, user = "", password = "") {
    return externalRepoInfo(this.h, repourl, user, password)
  }

  public gitCreateRepo(
    packageName: string,
    repourl: string,
    branch = "refs/heads/master",
    transport = "",
    user = "",
    password = ""
  ) {
    return createRepo(
      this.h,
      packageName,
      repourl,
      branch,
      transport,
      user,
      password
    )
  }

  public gitPullRepo(
    repoId: string,
    branch = "refs/heads/master",
    transport = "",
    user = "",
    password = ""
  ) {
    return pullRepo(this.h, repoId, branch, transport, user, password)
  }

  public gitUnlinkRepo(repoId: string) {
    return unlinkRepo(this.h, repoId)
  }

  public stageRepo(repo: GitRepo, user = "", password = "") {
    return stageRepo(this.h, repo, user, password)
  }

  public pushRepo(
    repo: GitRepo,
    staging: GitStaging,
    user = "",
    password = ""
  ) {
    return pushRepo(this.h, repo, staging, user, password)
  }

  public checkRepo(repo: GitRepo, user = "", password = "") {
    return checkRepo(this.h, repo, user, password)
  }

  /**
   * @deprecated since 1.2.1, duplicate of gitExternalRepoInfo
   */
  public remoteRepoInfo(repo: GitRepo, user = "", password = "") {
    return remoteRepoInfo(this.h, repo, user, password)
  }

  public switchRepoBranch(
    repo: GitRepo,
    branch: string,
    create = false,
    user = "",
    password = ""
  ) {
    return switchRepoBranch(this.h, repo, branch, create, user, password)
  }

  public annotationDefinitions() {
    return annotationDefinitions(this.h)
  }

  public ddicElement(
    path: string | string[],
    getTargetForAssociation = false,
    getExtensionViews = true,
    getSecondaryObjects = true
  ) {
    return ddicElement(
      this.h,
      path,
      getTargetForAssociation,
      getExtensionViews,
      getSecondaryObjects
    )
  }

  public ddicRepositoryAccess(path: string | string[]) {
    return ddicRepositoryAccess(this.h, path)
  }

  public publishServiceBinding(name: string, version: string) {
    return publishServiceBinding(this.h, name, version)
  }

  public unPublishServiceBinding(name: string, version: string) {
    return unpublishServiceBinding(this.h, name, version)
  }

  /** Reads table data - usually returns one line more than requested */
  public tableContents(
    ddicEntityName: string,
    rowNumber: number = 100,
    decode = true,
    sqlQuery = ""
  ) {
    return tableContents(this.h, ddicEntityName, rowNumber, decode, sqlQuery)
  }

  /** Runs a given SQL query on the target */
  public runQuery(
    sqlQuery: string,
    rowNumber: number = 100,
    decode = true
  ) {
    return runQuery(this.h, sqlQuery, rowNumber, decode)
  }

  public bindingDetails(binding: ServiceBinding, index = 0) {
    return bindingDetails(this.h, binding, index)
  }

  public feeds() {
    return feeds(this.h)
  }

  public dumps(query?: string) {
    return dumps(this.h, query)
  }

  public debuggerListeners(debuggingMode: "user", terminalId: string, ideId: string, user: string, checkConflict?: boolean): Promise<DebugListenerError | undefined>
  public debuggerListeners(debuggingMode: DebuggingMode, terminalId: string, ideId: string, user?: string, checkConflict?: boolean): Promise<DebugListenerError | undefined>
  public debuggerListeners(debuggingMode: DebuggingMode, terminalId: string, ideId: string, user?: string, checkConflict = true) {
    return debuggerListeners(this.h, debuggingMode, terminalId, ideId, user, checkConflict)
  }

  /** 
   * Listens for debugging events
   * **WARNING** this usually only returns when a breakpoint is hit, a timeout is reached or another client terminated it
   * On timeout/termination it will return undefined, and the client will decide whether to launch it again after prompting the user
   * 
   * @param {string} debuggingMode - break on any user activity or just on the current terminal
   * @param {string} terminalId - the terminal ID - a GUID generated the first time any debugger is ran on the current machine
   *        in Windows is stored in registry key Software\SAP\ABAP Debugging
   *        in other systems in file ~/.SAP/ABAPDebugging/terminalId
   * @param {string} ideId - the IDE ID - UI5 hash of the IDE's workspace root
   * @param {string} user - the user to break for. Mandatory in user mode
   * 
   * @returns either an error, if another client is listening, or the details of the object being debugged. Can take hours to return
   */
  public debuggerListen(debuggingMode: "user", terminalId: string, ideId: string, user: string, checkConflict?: boolean, isNotifiedOnConflict?: boolean): Promise<DebugListenerError | Debuggee | undefined>
  public debuggerListen(debuggingMode: DebuggingMode, terminalId: string, ideId: string, user?: string, checkConflict?: boolean, isNotifiedOnConflict?: boolean): Promise<DebugListenerError | Debuggee | undefined>
  public debuggerListen(debuggingMode: DebuggingMode, terminalId: string, ideId: string, user?: string, checkConflict = true, isNotifiedOnConflict = true) {
    return debuggerListen(this.h, debuggingMode, terminalId, ideId, user, checkConflict, isNotifiedOnConflict)
  }

  /**
   * Stop a debug listener (could be this client or another)
   * @param {string} debuggingMode - break on any user activity or just on the current terminal
   * @param {string} terminalId - the terminal ID - a GUID generated the first time any debugger is ran on the current machine
   *        in Windows is stored in registry key Software\SAP\ABAP Debugging
   *        in other systems in file ~/.SAP/ABAPDebugging/terminalId
   * @param {string} ideId - the IDE ID - UI5 hash of the IDE's workspace root
   * @param {string} user - the user to break for. Mandatory in user mode
   */
  public debuggerDeleteListener(debuggingMode: "user", terminalId: string, ideId: string, user: string): Promise<void>
  public debuggerDeleteListener(debuggingMode: DebuggingMode, terminalId: string, ideId: string, user?: string): Promise<void>
  public debuggerDeleteListener(debuggingMode: DebuggingMode, terminalId: string, ideId: string, user?: string) {
    return debuggerDeleteListener(this.h, debuggingMode, terminalId, ideId, user)
  }

  public debuggerSetBreakpoints(debuggingMode: "user", terminalId: string, ideId: string, clientId: string, breakpoints: (string | DebugBreakpoint)[], user: string, scope?: DebuggerScope, systemDebugging?: boolean, deactivated?: boolean): Promise<(DebugBreakpoint | DebugBreakpointError)[]>
  public debuggerSetBreakpoints(debuggingMode: DebuggingMode, terminalId: string, ideId: string, clientId: string, breakpoints: (string | DebugBreakpoint)[], user?: string, scope?: DebuggerScope, systemDebugging?: boolean, deactivated?: boolean): Promise<(DebugBreakpoint | DebugBreakpointError)[]>
  public debuggerSetBreakpoints(debuggingMode: DebuggingMode, terminalId: string, ideId: string, clientId: string, breakpoints: (string | DebugBreakpoint)[], user?: string, scope: DebuggerScope = "external", systemDebugging = false, deactivated = false) {
    return debuggerSetBreakpoints(this.h, debuggingMode, terminalId, ideId, clientId, breakpoints, user, scope, systemDebugging, deactivated)
  }

  public debuggerDeleteBreakpoints(breakpoint: DebugBreakpoint, debuggingMode: "user", terminalId: string, ideId: string, requestUser: string, scope?: DebuggerScope): Promise<void>
  public debuggerDeleteBreakpoints(breakpoint: DebugBreakpoint, debuggingMode: DebuggingMode, terminalId: string, ideId: string, requestUser?: string,): Promise<void>
  public debuggerDeleteBreakpoints(breakpoint: DebugBreakpoint, debuggingMode: DebuggingMode, terminalId: string, ideId: string, requestUser?: string, scope: DebuggerScope = "external") {
    return debuggerDeleteBreakpoints(this.h, breakpoint, debuggingMode, terminalId, ideId, requestUser, scope)
  }

  public debuggerAttach(debuggingMode: "user", debuggeeId: string, user: string, dynproDebugging?: boolean): Promise<DebugAttach>
  public debuggerAttach(debuggingMode: DebuggingMode, debuggeeId: string, user?: string, dynproDebugging?: boolean): Promise<DebugAttach>
  public debuggerAttach(debuggingMode: DebuggingMode, debuggeeId: string, user?: string, dynproDebugging = false) {
    return debuggerAttach(this.h, debuggingMode, debuggeeId, user, dynproDebugging)
  }

  public debuggerSaveSettings(settings: Partial<DebugSettings>) {
    return debuggerSaveSettings(this.h, settings)
  }

  public async debuggerStackTrace(semanticURIs = true) {
    const stack = await this.collectionFeatureDetails("/sap/bc/adt/debugger/stack")
    if (stack) return debuggerStack(this.h, semanticURIs)
    else return simpleDebuggerStack(this.h, semanticURIs)
  }

  public debuggerVariables(parents: string[]) {
    return debuggerVariables(this.h, parents)
  }

  public debuggerChildVariables(parent: string[] = ["@DATAAGING", "@ROOT"]) {
    return debuggerChildVariables(this.h, parent)
  }

  public debuggerStep(steptype: "stepRunToLine" | "stepJumpToLine", url: string): Promise<DebugStep>
  public debuggerStep(steptype: "stepInto" | "stepOver" | "stepReturn" | "stepContinue" | "terminateDebuggee"): Promise<DebugStep>
  public debuggerStep(steptype: DebugStepType, url?: string) {
    return debuggerStep(this.h, steptype, url)
  }

  /**
   * Go to stack entry
   * 
   * @param urlOrPosition The stack entry stackUri in newer systems, the stack id in older ones that return a DebugStackSimple 
   */
  public debuggerGoToStack(urlOrPosition: number | string) {
    if (isString(urlOrPosition))
      return debuggerGoToStack(this.h, urlOrPosition)
    else return debuggerGoToStackOld(this.h, urlOrPosition)
  }

  public debuggerSetVariableValue(variableName: string, value: string): Promise<string> {
    return debuggerSetVariableValue(this.h, variableName, value)
  }
}
