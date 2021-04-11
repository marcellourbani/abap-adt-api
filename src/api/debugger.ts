import { AdtHTTP } from "../AdtHTTP"
import { fullParse, xmlArray, xmlNode, xmlNodeAttr } from "../utilities"
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

export interface DebugAttach {
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
    isSteppingPossible: boolean
    isTerminationPossible: boolean
    actions: DebugAction[]
    reachedBreakpoints: DebugReachedBreakpoint[]
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
    stackPosition: number;
    stackType: DebugStackType;
    stackUri: string;
    programName: string;
    includeName: number | string;
    line: number;
    eventType: string;
    eventName: number | string;
    sourceType: DebugStackSourceType;
    systemProgram: boolean;
    isVit: false;
    uri: UriParts;
}

export interface DebugStackVit {
    stackPosition: number;
    stackType: DebugStackType;
    stackUri: string;
    programName: string;
    includeName: number | string;
    line: number;
    eventType: string;
    eventName: number | string;
    sourceType: DebugStackSourceType;
    systemProgram: boolean;
    isVit: true;
    uri: UriParts;
    canVitOpen: boolean;
    canVitBreakpoints: boolean;
    canVitBreakpointCondition: boolean;
    canVitJumpToLine: boolean;
    canVitRunToLine: boolean;
    type: string;
    name: string;
}

export type DebugStack = DebugStackAbap | DebugStackVit
export interface DebugStackInfo {
    isRfc: boolean;
    debugCursorStackIndex: number;
    isSameSystem: boolean;
    serverName: string;
    stack: DebugStack[];
}

const parseStack = (body: string): DebugStackInfo => {
    const raw = fullParse(body, { ignoreNameSpace: true })
    const stack = xmlArray(raw, "stack", "stackEntry").map(xmlNodeAttr).map(x => ({ ...x, uri: parseUri(x.uri) }))
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

const parseBreakpoints = (body: string): DebugBreakpoint[] => {
    const raw = fullParse(body, { ignoreNameSpace: true })
    return xmlArray(raw, "breakpoints", "breakpoint")
        .map(xmlNodeAttr)
        .map(x => ({ ...x, uri: parseUri(x.uri) }))
}

const parseDebugListeners = (
    body: string
): DebugListenerError | Debuggee | undefined => {
    if (!body) return
    const raw = fullParse(body, { ignoreNameSpace: true })
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
    const debug = xmlNode(raw, "abap", "values", "DATA", "STPDA_DEBUGGEE")
    return { ...debug, URI: parseUri(debug.URI) }
}

export async function debuggerListen(
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
        checkConflict: true,
        isNotifiedOnConflict: true
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
        checkConflict: true,
        isNotifiedOnConflict: true
    }
    await h.request("/sap/bc/adt/debugger/listeners", { method: "DELETE", qs })
}

export async function debuggerListBreakpoints(
    h: AdtHTTP,
    debuggingMode: DebuggingMode,
    terminalId: string,
    ideId: string,
    requestUser?: string,
    systemDebugging = false,
    deactivated = false
) {
    const body = `<?xml version="1.0" encoding="UTF-8"?>
    <dbg:breakpoints scope="external" debuggingMode="${debuggingMode}" requestUser="${requestUser}" 
        terminalId="${terminalId}" ideId="${ideId}" systemDebugging="${systemDebugging}" deactivated="${deactivated}"
        xmlns:dbg="http://www.sap.com/adt/debugger">
        <syncScope mode="full"></syncScope>
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
        headers, body,
        qs
    })
    return parseDebugSettings(response.body)
}


export async function debuggerStack(h: AdtHTTP, semanticURIs = true) {
    const headers = { Accept: "application/xml" }
    const qs = { emode: "_", semanticURIs }
    const response = await h.request("/sap/bc/adt/debugger/breakpoints", {
        headers,
        qs
    })
    return parseStack(response.body)
}