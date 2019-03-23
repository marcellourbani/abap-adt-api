import { parse } from "fast-xml-parser"
import { adtException, ValidateObjectUrl } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import {
  fullParse,
  JSON2AbapXML,
  xmlArray,
  xmlNode,
  xmlNodeAttr
} from "../utilities"
import { Link } from "./objectstructure"

interface TransportHeader {
  TRKORR: string
  TRFUNCTION: string
  TRSTATUS: string
  TARSYSTEM: string
  AS4USER: string
  AS4DATE: string
  AS4TIME: string
  AS4TEXT: string
  CLIENT: string
}
interface TransportLock {
  HEADER: TransportHeader
  TASKS: TransportHeader[]
  OBJECT_KEY: {
    OBJ_NAME: string
    OBJECT: string
    PGMID: string
  }
}
export interface TransportInfo {
  PGMID: string
  OBJECT: string
  OBJECTNAME: string
  OPERATION: string
  DEVCLASS: string
  CTEXT: string
  KORRFLAG: string
  AS4USER: string
  PDEVCLASS: string
  DLVUNIT: string
  MESSAGES?: Array<{
    SEVERITY: string
    SPRSL: string
    ARBGB: string
    MSGNR: number
    VARIABLES: string[]
    TEXT: string
  }>
  NAMESPACE: string
  RESULT: string
  RECORDING: string
  EXISTING_REQ_ONLY: string
  TRANSPORTS: TransportHeader[]
  TADIRDEVC?: string
  URI?: string
  LOCKS?: TransportLock
}

function extractLocks(raw: any): TransportLock | undefined {
  const lock = raw && raw.CTS_OBJECT_LOCK
  if (!lock) return
  try {
    const holder = lock.LOCK_HOLDER
    const TASKS: TransportHeader[] = xmlArray(holder, "TASK_HEADERS").map(
      (x: any) => x.CTS_TASK_HEADER
    )
    return {
      HEADER: holder.REQ_HEADER,
      OBJECT_KEY: xmlNode(lock, "OBJECT_KEY"),
      TASKS
    }
  } catch {
    return
  }
}

function extractTransports(raw: any): TransportHeader[] {
  return xmlArray(raw, "CTS_REQUEST").map((x: any) => x.REQ_HEADER)
}

export async function transportInfo(
  h: AdtHTTP,
  URI: string,
  DEVCLASS: string = "",
  OPERATION: string = "I"
): Promise<TransportInfo> {
  ValidateObjectUrl(URI)
  const body = JSON2AbapXML({
    DEVCLASS,
    OPERATION,
    URI
  })

  const headers = {
    Accept:
      "application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.transport.service.checkData",
    "Content-Type":
      "application/vnd.sap.as+xml; charset=UTF-8; dataname=com.sap.adt.transport.service.checkData"
  }
  const response = await h.request("/sap/bc/adt/cts/transportchecks", {
    body,
    method: "POST",
    headers
  })
  // return parsePackageResponse(response.body)
  // tslint:disable-next-line: prefer-const
  let { REQUESTS, LOCKS, MESSAGES, ...header } = parse(response.body)[
    "asx:abap"
  ]["asx:values"].DATA
  if (MESSAGES) {
    MESSAGES = xmlArray(MESSAGES, "CTS_MESSAGE").map((m: any) => {
      // tslint:disable-next-line: prefer-const
      let { VARIABLES, ...rest } = m
      VARIABLES =
        (VARIABLES && xmlArray(m, "VARIABLES", "CTS_VARIABLE")).map(
          (v: any) => v.VARIABLE
        ) || []
      return { VARIABLES, ...rest }
    })
    MESSAGES.filter((m: any) => m.SEVERITY.match(/[EAX]/)).some((e: any) => {
      throw adtException(e.TEXT)
    })
  }
  const TRANSPORTS = extractTransports(REQUESTS)
  return { ...header, LOCKS: extractLocks(LOCKS), TRANSPORTS }
}

export async function createTransport(
  h: AdtHTTP,
  REF: string,
  REQUEST_TEXT: string,
  DEVCLASS: string,
  OPERATION: string = "I"
): Promise<string> {
  ValidateObjectUrl(REF)
  const body = JSON2AbapXML({ DEVCLASS, REQUEST_TEXT, REF, OPERATION })
  const response = await h.request("/sap/bc/adt/cts/transports", {
    body,
    headers: {
      Accept: "text/plain",
      "Content-Type":
        "application/vnd.sap.as+xml; charset=UTF-8; dataname=com.sap.adt.CreateCorrectionRequest"
    },
    method: "POST"
  })
  const transport = response.body.split("/").pop()
  return transport
}

export interface TransportObject {
  "tm:pgmid": string
  "tm:type": string
  "tm:name": string
  "tm:dummy_uri": string
  "tm:obj_info": string
}
export interface TransportTask {
  "tm:number": string
  "tm:owner": string
  "tm:desc": string
  "tm:status": string
  "tm:uri": string
  links: Link[]
  objects: TransportObject[]
}

export interface TransportRequest extends TransportTask {
  tasks: TransportTask[]
}

export interface TransportTarget {
  "tm:name": string
  "tm:desc": string
  modifiable: TransportRequest[]
  released: TransportRequest[]
}

export interface TransportsOfUser {
  workbench: TransportTarget[]
  customizing: TransportTarget[]
}

export async function userTransports(h: AdtHTTP, user: string, targets = true) {
  const response = await h.request("/sap/bc/adt/cts/transportrequests", {
    qs: { user, targets }
  })
  const parseTask = (t: any) => {
    const task = {
      ...xmlNodeAttr(t),
      links: xmlArray(t, "atom:link").map(xmlNodeAttr),
      objects: xmlArray(t, "tm:abap_object").map(xmlNodeAttr)
    }
    return task as TransportTask
  }
  const parseRequest = (r: any) => {
    const request: TransportRequest = {
      ...parseTask(r),
      tasks: xmlArray(r, "tm:task").map(parseTask)
    }
    return request
  }
  const parseTargets = (s: any) => ({
    ...xmlNodeAttr(s),
    modifiable: xmlArray(s, "tm:modifiable", "tm:request").map(parseRequest),
    released: xmlArray(s, "tm:released", "tm:request").map(parseRequest)
  })

  const raw = fullParse(response.body)
  const workbench = xmlArray(raw, "tm:root", "tm:workbench", "tm:target").map(
    parseTargets
  )
  const customizing = xmlArray(
    raw,
    "tm:root",
    "tm:customizing",
    "tm:target"
  ).map(parseTargets)

  const retval: TransportsOfUser = { workbench, customizing }
  return retval
}
