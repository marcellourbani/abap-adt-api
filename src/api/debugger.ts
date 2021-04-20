import { adtException } from ".."
import { AdtHTTP } from "../AdtHTTP"
import { decodeEntity, encodeEntity, fullParse, isString, toInt, xmlArray, xmlNode, xmlNodeAttr } from "../utilities"
import { parseUri, UriParts } from "./urlparser"

export type DebuggingMode = "user" | "terminal"
export interface DebugMessage {
    text: string
    lang: string
}

export interface DebugListenerError {
    namespace: string
    type: string
    message: DebugMessage
    localizedMessage: DebugMessage
    conflictText: string
    ideUser: string
    "com.sap.adt.communicationFramework.subType": string
    "T100KEY-ID": string
    "T100KEY-NO": number
}

export interface Debuggee {
    CLIENT: number
    DEBUGGEE_ID: string
    TERMINAL_ID: string
    IDE_ID: string
    DEBUGGEE_USER: string
    PRG_CURR: string
    INCL_CURR: string
    LINE_CURR: number
    RFCDEST: string
    APPLSERVER: string
    SYSID: string
    SYSNR: number
    DBGKEY: string
    TSTMP: number
    DBGEE_KIND: string
    DUMPID: string
    DUMPDATE: string
    DUMPTIME: string
    DUMPHOST: string
    DUMPMODNO: number
    LISTENER_CTX_ID: string
    IS_ATTACH_IMPOSSIBLE: boolean
    APPSERVER: string
    IS_SAME_SERVER: boolean
    CAN_ADT_CROSS_SERVER: boolean
    INSTANCE_NAME: string
    HOST: string
    DUMP_ID: string
    DUMP_DATE: string
    DUMP_TIME: string
    DUMP_HOST: string
    DUMP_UNAME: string
    DUMP_MODNO: number
    DUMP_CLIENT: string
    DUMP_URI: string
    URI: UriParts
    TYPE: string
    NAME: string
    PARENT_URI: string
    PACKAGE_NAME: string
    DESCRIPTION: string
}

export interface DebugBreakpoint {
    kind: string
    clientId: string
    id: string
    nonAbapFlavour: string
    uri: UriParts
    type: string
    name: string
}
export interface DebugBreakpointError {
    kind: string;
    clientId: string;
    errorMessage: string;
    nonAbapFlavour: string;
}


export interface DebugState {
    isRfc: boolean
    isSameSystem: boolean
    serverName: string
    debugSessionId: string
    processId: number
    isPostMortem: boolean
    isUserAuthorizedForChanges: boolean
    debuggeeSessionId: string
    abapTraceState: string
    canAdvancedTableFeatures: boolean
    isNonExclusive: boolean
    isNonExclusiveToggled: boolean
    guiEditorGuid: string
    sessionTitle: string
    isSteppingPossible?: boolean
    isTerminationPossible: boolean
    actions: DebugAction[]
}

export interface DebugAttach extends DebugState {
    reachedBreakpoints: DebugReachedBreakpoint[]
}

export interface DebugStep extends DebugState {
    isDebuggeeChanged: boolean;
    settings: DebugSettings;
    reachedBreakpoints?: DebugReachedBreakpoint[]
}

export interface DebugAction {
    name: string
    style: string
    group: string
    title: string
    link: string
    value: boolean | string
    disabled: boolean
}

export interface DebugReachedBreakpoint {
    id: string
    kind: string
    unresolvableCondition: string
    unresolvableConditionErrorOffset: string
}
export interface DebugSettings {
    systemDebugging: boolean
    createExceptionObject: boolean
    backgroundRFC: boolean
    sharedObjectDebugging: boolean
    showDataAging: boolean
    updateDebugging: boolean
}

export type DebugStackType = "ABAP" | "DYNP" | "ENHANCEMENT"
export type DebugStackSourceType = "ABAP" | "DYNP" | "ST"
export interface DebugStackAbap {
    stackPosition: number
    stackType: DebugStackType
    stackUri: string
    programName: string
    includeName: number | string
    line: number
    eventType: string
    eventName: number | string
    sourceType: DebugStackSourceType
    systemProgram: boolean
    isVit: false
    uri: UriParts
}
export interface DebugStackSimple {
    programName: string;
    includeName: string;
    line: number;
    eventType: string;
    eventName: string;
    stackPosition: number;
    systemProgram: boolean;
    uri: UriParts;
}

export interface DebugStackVit {
    stackPosition: number
    stackType: DebugStackType
    stackUri: string
    programName: string
    includeName: number | string
    line: number
    eventType: string
    eventName: number | string
    sourceType: DebugStackSourceType
    systemProgram: boolean
    isVit: true
    uri: UriParts
    canVitOpen: boolean
    canVitBreakpoints: boolean
    canVitBreakpointCondition: boolean
    canVitJumpToLine: boolean
    canVitRunToLine: boolean
    type: string
    name: string
}

export type DebugStack = DebugStackAbap | DebugStackVit | DebugStackSimple
export interface DebugStackInfo {
    isRfc: boolean
    debugCursorStackIndex?: number
    isSameSystem: boolean
    serverName: string
    stack: DebugStack[]
}

export interface DebugChildVariablesInfo {
    hierarchies: DebugChildVariablesHierarchy[];
    variables: DebugVariable[];
}

export interface DebugChildVariablesHierarchy {
    PARENT_ID: string;
    CHILD_ID: string;
    CHILD_NAME: string;
}

export type DebugMetaTypeSimple = "simple" | "string" | "boxedcomp" | "anonymcomp" | "unknown"
export type DebugMetaTypeComplex = "structure" | "table" | "dataref" | "objectref" | "class" | "object" | "boxref"

export type DebugMetaType = DebugMetaTypeSimple | DebugMetaTypeComplex
export interface DebugVariable {
    ID: string;
    NAME: string;
    DECLARED_TYPE_NAME: string;
    ACTUAL_TYPE_NAME: string;
    KIND: string;
    INSTANTIATION_KIND: string;
    ACCESS_KIND: string;
    META_TYPE: DebugMetaType;
    PARAMETER_KIND: string;
    VALUE: string;
    HEX_VALUE: string;
    READ_ONLY: string;
    TECHNICAL_TYPE: string;
    LENGTH: number;
    TABLE_BODY: string;
    TABLE_LINES: number;
    IS_VALUE_INCOMPLETE: string;
    IS_EXCEPTION: string;
    INHERITANCE_LEVEL: number;
    INHERITANCE_CLASS: string;
}
interface DebugError extends Error {
    extra?: DebugListenerError
}
export type DebugStepType = "stepInto" | "stepOver" | "stepReturn" | "stepContinue" | "stepRunToLine" | "stepJumpToLine" | "terminateDebuggee"

export const debugMetaIsComplex = (m: DebugMetaType): m is DebugMetaTypeComplex =>
    !["simple", "string", "boxedcomp", "anonymcomp", "unknown"].find(e => e === m)

const parseStep = (body: string): DebugStep => {
    const raw = fullParse(body, { ignoreNameSpace: true })
    checkException(raw)
    const attrs = xmlNodeAttr(raw.step)
    const settings = xmlNodeAttr(raw?.step?.settings)
    const actions = xmlArray(raw, "step", "actions", "action").map(xmlNodeAttr)
    return { ...attrs, actions, settings }
}

const convertVariable = (v: any) => ({
    ...v, TABLE_LINES: toInt(v.TABLE_LINES),
    LENGTH: toInt(v.LENGTH),
    INHERITANCE_LEVEL: toInt(v.INHERITANCE_LEVEL),
    VALUE: decodeEntity(v.VALUE),
    ID: decodeEntity(v.ID),
    NAME: decodeEntity(v.NAME)
})

const parseVariables = (body: string): DebugVariable[] => {
    const raw = fullParse(body, { ignoreNameSpace: true, parseNodeValue: false, parseTrueNumberOnly: true })
    const variables = xmlArray(raw, "abap", "values", "DATA", "STPDA_ADT_VARIABLE")
        .map(convertVariable)
    return variables as DebugVariable[]
}

const parseChildVariables = (body: string): DebugChildVariablesInfo => {
    const raw = fullParse(body, { ignoreNameSpace: true, parseNodeValue: false, parseTrueNumberOnly: true })
    const hierarchies = xmlArray(raw, "abap", "values", "DATA", "HIERARCHIES", "STPDA_ADT_VARIABLE_HIERARCHY")
    const variables = xmlArray(raw, "abap", "values", "DATA", "VARIABLES", "STPDA_ADT_VARIABLE")
        .map(convertVariable)
    return { hierarchies, variables } as DebugChildVariablesInfo
}

const parseStack = (body: string): DebugStackInfo => {
    const raw = fullParse(body, { ignoreNameSpace: true })
    const stack = xmlArray(raw, "stack", "stackEntry")
        .map(xmlNodeAttr)
        .map(x => ({ ...x, uri: parseUri(x.uri) }))
    const attrs = xmlNodeAttr(raw.stack)
    return { ...attrs, stack }
}

const parseDebugSettings = (body: string): DebugSettings => {
    const raw = fullParse(body, { ignoreNameSpace: true })
    return xmlNodeAttr(raw.settings)
}

const parseAttach = (body: string): DebugAttach => {
    const raw = fullParse(body, { ignoreNameSpace: true })
    const attrs = xmlNodeAttr(raw.attach)
    const reachedBreakpoints = xmlArray(
        raw,
        "attach",
        "reachedBreakpoints",
        "breakpoint"
    ).map(xmlNodeAttr)
    const actions = xmlArray(raw, "attach", "actions", "action").map(xmlNodeAttr)
    return { ...attrs, actions, reachedBreakpoints }
}

const parseBreakpoints = (body: string): (DebugBreakpoint | DebugBreakpointError)[] => {
    const raw = fullParse(body, { ignoreNameSpace: true })
    return xmlArray(raw, "breakpoints", "breakpoint")
        .map(xmlNodeAttr)
        .map(x => {
            if (x.uri) return { ...x, uri: parseUri(x.uri) }
            return x
        })
}

const parseDebugError = (raw: any): DebugListenerError | undefined => {
    if (raw.exception) {
        const {
            namespace: { "@_id": namespace },
            type: { "@_id": type },
            localizedMessage,
            message
        } = raw.exception
        const parseMessage = (m: any) => ({ text: m["#text"], lang: m["@_lang"] })
        const entries: any = {}
        for (const ex of xmlArray(raw.exception, "properties", "entry") as any[])
            entries[ex["@_key"]] = ex["#text"]
        return {
            ...entries,
            namespace,
            type,
            message: parseMessage(message),
            localizedMessage: parseMessage(localizedMessage)
        }
    }
}

const checkException = (raw: any) => {
    const e = parseDebugError(raw)
    if (e) {
        const err: DebugError = new Error(e.message.text);
        err.extra = e
        throw err
    }
}

export const isDebugListenerError = (e: any): e is DebugListenerError =>
    !!e && "conflictText" in e && "com.sap.adt.communicationFramework.subType" in e

export const isDebuggee = (d: any): d is Debuggee =>
    !!d && !["CLIENT", "DEBUGGEE_ID", "TERMINAL_ID", "IDE_ID", "DEBUGGEE_USER"].find(f => !(f in d))

const parseDebugListeners = (
    body: string
): DebugListenerError | Debuggee | undefined => {
    if (!body) return
    const raw = fullParse(body, { ignoreNameSpace: true })
    const err = parseDebugError(raw)
    if (err) return err
    const debug = xmlNode(raw, "abap", "values", "DATA", "STPDA_DEBUGGEE")
    return { ...debug, URI: parseUri(debug.URI) }
}

export async function debuggerListeners(
    h: AdtHTTP,
    debuggingMode: DebuggingMode,
    terminalId: string,
    ideId: string,
    requestUser?: string,
    checkConflict = true
) {
    const qs = {
        debuggingMode,
        requestUser,
        terminalId,
        ideId,
        checkConflict
    }
    const response = await h.request("/sap/bc/adt/debugger/listeners", { qs })
    if (!response.body) return
    const raw = fullParse(response.body, { ignoreNameSpace: true })
    return parseDebugError(raw)
}
export async function debuggerListen(
    h: AdtHTTP,
    debuggingMode: DebuggingMode,
    terminalId: string,
    ideId: string,
    requestUser?: string,
    checkConflict = true,
    isNotifiedOnConflict = true
) {
    const qs = {
        debuggingMode,
        requestUser,
        terminalId,
        ideId,
        checkConflict,
        isNotifiedOnConflict
    }
    const response = await h.request("/sap/bc/adt/debugger/listeners", {
        method: "POST",
        timeout: 360000000, // 100 hours
        qs
    })
    return parseDebugListeners(response.body)
}

export async function debuggerDeleteListener(
    h: AdtHTTP,
    debuggingMode: DebuggingMode,
    terminalId: string,
    ideId: string,
    requestUser?: string
) {
    const qs = {
        debuggingMode,
        requestUser,
        terminalId,
        ideId,
        checkConflict: false,
        notifyConflict: true
    }
    await h.request("/sap/bc/adt/debugger/listeners", { method: "DELETE", qs })
}

const formatBreakpoint = (clientId: string) => (b: DebugBreakpoint | string) => {
    if (isString(b))
        return `<breakpoint xmlns:adtcore="http://www.sap.com/adt/core" kind="line" clientId="${clientId}" skipCount="0" adtcore:uri="${b}"/>`
    return `<breakpoint xmlns:adtcore="http://www.sap.com/adt/core" kind="${b.kind}" clientId="${b.clientId}" skipCount="0" adtcore:uri="${b.uri.uri}#start=${b.uri.range.start.line}"/>`
}

export const isDebuggerBreakpoint = (x: DebugBreakpointError | DebugBreakpoint): x is DebugBreakpoint => "uri" in x

export async function debuggerSetBreakpoints(
    h: AdtHTTP,
    debuggingMode: DebuggingMode,
    terminalId: string,
    ideId: string,
    clientId: string,
    breakpoints: (DebugBreakpoint | string)[],
    requestUser?: string,
    systemDebugging = false,
    deactivated = false
) {
    const body = `<?xml version="1.0" encoding="UTF-8"?>
    <dbg:breakpoints scope="external" debuggingMode="${debuggingMode}" requestUser="${requestUser}" 
        terminalId="${terminalId}" ideId="${ideId}" systemDebugging="${systemDebugging}" deactivated="${deactivated}"
        xmlns:dbg="http://www.sap.com/adt/debugger">
        <syncScope mode="full"></syncScope>
        ${breakpoints.map(formatBreakpoint(clientId)).join("")}
    </dbg:breakpoints>`
    const headers = {
        "Content-Type": "application/xml",
        Accept: "application/xml"
    }
    const response = await h.request("/sap/bc/adt/debugger/breakpoints", {
        method: "POST",
        headers,
        body
    })
    return parseBreakpoints(response.body)
}

export async function debuggerDeleteBreakpoints(
    h: AdtHTTP,
    breakpoint: DebugBreakpoint,
    debuggingMode: DebuggingMode,
    terminalId: string,
    ideId: string,
    requestUser?: string
) {
    const headers = { Accept: "application/xml" }
    const qs = { "scope": "external", debuggingMode, requestUser, terminalId, ideId }
    await h.request(`/sap/bc/adt/debugger/breakpoints/${breakpoint.id}`, {
        method: "DELETE",
        headers,
        qs
    })
}



export async function debuggerAttach(
    h: AdtHTTP,
    debuggingMode: DebuggingMode,
    debuggeeId: string,
    requestUser = "",
    dynproDebugging = true
) {
    const headers = {
        Accept: "application/xml"
    }
    const qs = {
        method: "attach",
        debuggeeId,
        dynproDebugging,
        debuggingMode,
        requestUser
    }
    const response = await h.request("/sap/bc/adt/debugger", {
        method: "POST",
        headers,
        qs
    })
    return parseAttach(response.body)
}

export async function debuggerSaveSettings(
    h: AdtHTTP,
    settings: Partial<DebugSettings>
) {
    const headers = {
        "Content-Type": "application/xml",
        Accept: "application/xml"
    }
    const {
        systemDebugging = false,
        createExceptionObject = false,
        backgroundRFC = false,
        sharedObjectDebugging = false,
        showDataAging = true,
        updateDebugging = false
    } = settings
    const body = `<?xml version="1.0" encoding="UTF-8"?>
    <dbg:settings xmlns:dbg="http://www.sap.com/adt/debugger" 
    systemDebugging="${systemDebugging}" createExceptionObject="${createExceptionObject}" 
    backgroundRFC="${backgroundRFC}" sharedObjectDebugging="${sharedObjectDebugging}" 
    showDataAging="${showDataAging}" updateDebugging="${updateDebugging}">
    </dbg:settings>`
    const qs = { method: "setDebuggerSettings" }
    const response = await h.request("/sap/bc/adt/debugger", {
        method: "POST",
        headers,
        body,
        qs
    })
    return parseDebugSettings(response.body)
}

export async function debuggerStack(h: AdtHTTP, semanticURIs = true) {
    const headers = { Accept: "application/xml" }
    const qs = { method: "getStack", emode: "_", semanticURIs }
    const response = await h.request("/sap/bc/adt/debugger/stack", {
        headers,
        qs
    })
    return parseStack(response.body)
}

export async function simpleDebuggerStack(h: AdtHTTP, semanticURIs = true) {
    const headers = { Accept: "application/xml" }
    const qs = { method: "getStack", emode: "_", semanticURIs }
    const response = await h.request("/sap/bc/adt/debugger", { headers, method: "POST", qs })
    return parseStack(response.body)
}

export async function debuggerChildVariables(h: AdtHTTP, parents = ["@ROOT", "@DATAAGING"]) {
    const headers = {
        Accept:
            "application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.debugger.ChildVariables",
        "Content-Type":
            "application/vnd.sap.as+xml; charset=UTF-8; dataname=com.sap.adt.debugger.ChildVariables"
    }
    const hierarchies = parents.map(p => `<STPDA_ADT_VARIABLE_HIERARCHY><PARENT_ID>${encodeEntity(p)}</PARENT_ID></STPDA_ADT_VARIABLE_HIERARCHY>`)
    const body = `<?xml version="1.0" encoding="UTF-8" ?><asx:abap version="1.0" xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA>
    <HIERARCHIES>${hierarchies.join("")}</HIERARCHIES>
    </DATA></asx:values></asx:abap>`
    const qs = { method: "getChildVariables" }
    const response = await h.request("/sap/bc/adt/debugger", { method: "POST", headers, qs, body })
    return parseChildVariables(response.body)
}


export async function debuggerVariables(h: AdtHTTP, parents: string[]) {
    const headers = {
        Accept:
            "application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.debugger.Variables",
        "Content-Type":
            "application/vnd.sap.as+xml; charset=UTF-8; dataname=com.sap.adt.debugger.Variables"
    }
    const mainBody = parents.map(p => `<STPDA_ADT_VARIABLE><ID>${encodeEntity(p)}</ID></STPDA_ADT_VARIABLE>`).join("")
    const body = `<?xml version="1.0" encoding="UTF-8" ?><asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0"><asx:values>
    <DATA>${mainBody}</DATA></asx:values></asx:abap>`
    const qs = { method: "getVariables" }
    const response = await h.request("/sap/bc/adt/debugger", { method: "POST", headers, qs, body })
    return parseVariables(response.body)
}

export async function debuggerStep(h: AdtHTTP, method: DebugStepType, url?: string) {
    const headers = { Accept: "application/xml" }
    const response = await h.request("/sap/bc/adt/debugger", { method: "POST", headers, qs: { method } })
    return parseStep(response.body)
}

export async function debuggerGoToStack(h: AdtHTTP, stackUri: string) {
    if (!stackUri.match(/^\/sap\/bc\/adt\/debugger\/stack\/type\/[\w]+\/position\/\d+$/))
        throw adtException(`Invalid stack URL: ${stackUri}`)
    await h.request(stackUri, { method: "PUT" })
}

export async function debuggerGoToStackOld(h: AdtHTTP, position: number) {
    const qs = { method: "setStackPosition", position }
    await h.request(`/sap/bc/adt/debugger?method=setStackPosition&position=10`, { method: "POST", qs })
}