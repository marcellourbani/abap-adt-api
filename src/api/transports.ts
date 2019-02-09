import { parse } from "fast-xml-parser"
import { adtException, ValidateObjectUrl } from "../AdtException"
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
  const response = await h.request("/sap/bc/adt/cts/transportchecks", {
    data: JSON2AbapXML({
      DEVCLASS,
      OPERATION,
      URI
    }),
    method: "POST"
  })
  // return parsePackageResponse(response.data)
  // tslint:disable-next-line: prefer-const
  let { REQUESTS, LOCKS, MESSAGES, ...header } = parse(response.data)[
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
  const data = JSON2AbapXML({ DEVCLASS, REQUEST_TEXT, REF, OPERATION })
  const response = await h.request("/sap/bc/adt/cts/transports", {
    data,
    headers: {
      Accept: "text/plain",
      "Content-Type":
        "application/vnd.sap.as+xml; charset=UTF-8; dataname=com.sap.adt.CreateCorrectionRequest"
    },
    method: "POST"
  })
  const transport = response.data.split("/").pop()
  return transport
}
