import { AdtHTTP } from "../AdtHTTP"
import { fullParse, xmlArray, xmlNode } from "../utilities"

export type DebuggingMode = "user" | "terminal"
export interface DebugMessage {
    text: string;
    lang: string;
}

export interface DebugListenerError {
    namespace: string;
    type: string;
    message: DebugMessage;
    localizedMessage: DebugMessage;
    conflictText: string;
    ideUser: string;
    "com.sap.adt.communicationFramework.subType": string;
    "T100KEY-ID": string;
    "T100KEY-NO": number;
}

export interface Debuggee {
    CLIENT: number;
    DEBUGGEE_ID: string;
    TERMINAL_ID: string;
    IDE_ID: string;
    DEBUGGEE_USER: string;
    PRG_CURR: string;
    INCL_CURR: string;
    LINE_CURR: number;
    RFCDEST: string;
    APPLSERVER: string;
    SYSID: string;
    SYSNR: number;
    DBGKEY: string;
    TSTMP: number;
    DBGEE_KIND: string;
    DUMPID: string;
    DUMPDATE: string;
    DUMPTIME: string;
    DUMPHOST: string;
    DUMPMODNO: number;
    LISTENER_CTX_ID: string;
    IS_ATTACH_IMPOSSIBLE: boolean;
    APPSERVER: string;
    IS_SAME_SERVER: boolean;
    CAN_ADT_CROSS_SERVER: boolean;
    INSTANCE_NAME: string;
    HOST: string;
    DUMP_ID: string;
    DUMP_DATE: string;
    DUMP_TIME: string;
    DUMP_HOST: string;
    DUMP_UNAME: string;
    DUMP_MODNO: number;
    DUMP_CLIENT: string;
    DUMP_URI: string;
    URI: string;
    TYPE: string;
    NAME: string;
    PARENT_URI: string;
    PACKAGE_NAME: string;
    DESCRIPTION: string;
}


const parseDebugListeners = (body: string): DebugListenerError | Debuggee | undefined => {
    if (!body) return
    const raw = fullParse(body, { ignoreNameSpace: true })
    if (raw.exception) {
        const { namespace: { "@_id": namespace }, type: { "@_id": type }, localizedMessage, message } = raw.exception
        const parseMessage = (m: any) => ({ text: m["#text"], lang: m["@_lang"] })
        const entries: any = {}
        for (const ex of xmlArray(raw.exception, "properties", "entry") as any[])
            entries[ex["@_key"]] = ex["#text"]
        return { ...entries, namespace, type, message: parseMessage(message), localizedMessage: parseMessage(localizedMessage) }
    }
    return xmlNode(raw, "abap", "values", "DATA", "STPDA_DEBUGGEE")
}

export async function listenDebugger(h: AdtHTTP, debuggingMode: DebuggingMode, terminalId: string, ideId: string, requestUser?: string) {
    const qs = { debuggingMode, requestUser, terminalId, ideId, checkConflict: true, isNotifiedOnConflict: true }
    const response = await h.request("/sap/bc/adt/debugger/listeners", { method: "POST", qs })
    return parseDebugListeners(response.body)
}