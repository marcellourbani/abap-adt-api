import { parse } from "fast-xml-parser"
import { ValidateObjectUrl } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import { JSON2AbapXML, xmlArray, xmlNode } from "../utilities"

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
  NAMESPACE: string
  RESULT: string
  RECORDING: string
  EXISTING_REQ_ONLY: string
  TRANSPORTS: TransportHeader[]
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
  objPath: string,
  devClass: string
): Promise<TransportInfo> {
  ValidateObjectUrl(objPath)
  const response = await h.request("/sap/bc/adt/cts/transportchecks", {
    data: JSON2AbapXML({
      DEVCLASS: devClass,
      URI: objPath
    }),
    method: "POST"
  })
  // return parsePackageResponse(response.data)
  const { REQUESTS, LOCKS, ...header } = parse(response.data)["asx:abap"][
    "asx:values"
  ].DATA
  const TRANSPORTS = extractTransports(REQUESTS)
  return { ...header, LOCKS: extractLocks(LOCKS), TRANSPORTS }
}
export async function createTransport(
  h: AdtHTTP,
  objPath: string,
  REQUEST_TEXT: string,
  DEVCLASS: string
): Promise<string> {
  ValidateObjectUrl(objPath)
  const data = JSON2AbapXML({ DEVCLASS, REQUEST_TEXT, REF: objPath })
  const response = await h.request("/sap/bc/adt/cts/transports", {
    data,
    method: "POST"
  })
  const transport = response.data.split("/").pop()
  return transport
}
