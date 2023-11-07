import * as t from "io-ts"
import {
  extractXmlArray,
  fullParse,
  isNumber,
  mixed,
  orUndefined,
  toInt,
  typedNodeAttr,
  xmlArrayType,
  xmlNode
} from "../utilities"
import { validateParseResult } from "../AdtException"

const contributorClass = t.type({ name: t.string })
const link = t.type({
  "@_href": t.string,
  "@_rel": t.string,
  "@_type": t.string,
  "@_title": t.string
})

// A	Active
// R	Read Only
// E	Error
// S	SizeLim
// T	TimeLim
// C	Close Error

const state = t.type({ "@_value": t.string, "@_text": t.string })

const extendedData = t.type({
  host: t.string,
  size: t.number,
  runtime: t.number,
  runtimeABAP: t.number,
  runtimeSystem: t.number,
  runtimeDatabase: t.number,
  expiration: t.string,
  system: t.string,
  client: t.number,
  isAggregated: t.boolean,
  aggregationKind: orUndefined(t.string),
  objectName: t.string,
  state: state
})

const entryAuthor = t.type({ name: t.string, uri: t.string })
const entry = t.type({
  author: entryAuthor,
  content: t.type({
    "@_type": t.string,
    "@_src": t.string
  }),
  id: t.string,
  link: xmlArrayType(link),
  published: t.string,
  title: t.string,
  updated: t.string,
  extendedData: extendedData,
  "@_lang": t.string
})

const feed = t.type({
  author: contributorClass,
  contributor: contributorClass,
  title: t.string,
  updated: t.string,
  entry: xmlArrayType(entry)
})
const traceResults = t.type({ feed: feed })

const time = t.type({
  "@_time": t.number,
  "@_percentage": t.number
})

const baseLink = t.type({
  "@_rel": t.string,
  "@_href": t.string
})

const calledProgram = t.type({ "@_context": t.string })

const callingProgram = mixed(
  {
    "@_context": t.string,
    "@_byteCodeOffset": t.number
  },
  {
    "@_uri": t.string,
    "@_type": t.string,
    "@_name": t.string,
    "@_packageName": t.string,
    "@_objectReferenceQuery": t.string
  }
)

const hlentry = mixed(
  {
    calledProgram: calledProgram,
    grossTime: time,
    traceEventNetTime: time,
    proceduralNetTime: time,
    "@_topDownIndex": t.number,
    "@_index": t.number,
    "@_hitCount": t.number,
    "@_recursionDepth": t.number,
    "@_description": t.string
  },
  {
    callingProgram: callingProgram,
    "@_stackCount": t.number,
    "@_proceduralEntryAnchor": t.number,
    "@_dbAccessAnchor": t.number
  }
)

const Hitlist = t.type({
  link: baseLink,
  entry: xmlArrayType(hlentry)
})

const HitListResponse = t.type({ hitlist: Hitlist })
///

const accessTime = t.type({
  "@_total": t.number,
  "@_applicationServer": t.number,
  "@_database": t.number,
  "@_ratioOfTraceTotal": t.number
})

const dBAccess = mixed(
  {
    accessTime: accessTime,
    "@_index": t.number,
    "@_tableName": t.string,
    "@_statement": t.string,
    "@_type": t.union([
      t.literal("EXEC SQL"),
      t.literal("OpenSQL"),
      t.literal("")
    ]),
    "@_totalCount": t.number,
    "@_bufferedCount": t.number
  },
  {
    callingProgram: callingProgram
  }
)

const dBAccesses = t.type({
  link: baseLink,
  dbAccess: xmlArrayType(dBAccess),
  tables: t.type({
    table: xmlArrayType(
      t.type({
        "@_name": t.string,
        "@_type": t.string,
        "@_description": t.string,
        "@_bufferMode": t.string,
        "@_storageType": t.string,
        "@_package": t.string
      })
    )
  }),
  "@_totalDbTime": t.number
})

const traceDBAccesResponse = t.type({ dbAccesses: dBAccesses })
///
const statement = mixed(
  {
    callingProgram: callingProgram,
    grossTime: time,
    traceEventNetTime: time,
    proceduralNetTime: time,
    "@_index": t.number,
    "@_id": t.number,
    "@_description": t.string,
    "@_hitCount": t.number,
    "@_hasDetailSubnodes": t.boolean,
    "@_hasProcedureLikeSubnodes": t.boolean,
    "@_callerId": t.number,
    "@_callLevel": t.number,
    "@_subnodeCount": t.number,
    "@_directSubnodeCount": t.number,
    "@_directSubnodeCountProcedureLike": t.number,
    "@_hitlistAnchor": t.number
  },
  {
    "@_isProcedureLike": t.boolean,
    "@_isProceduralUnit": t.boolean,
    "@_isAutoDrillDowned": t.boolean
  }
)

const traceStatementResponse = t.type({
  statements: t.type({
    link: baseLink,
    statement: xmlArrayType(statement),
    "@_withDetails": t.boolean,
    "@_withSysEvents": t.boolean,
    "@_count": t.union([t.number, t.string])
  })
})

///

const author = t.type({
  name: t.string,
  uri: t.string,
  "@_role": t.string
})

const client = t.partial({
  "#text": orUndefined(t.number),
  "@_role": t.string
})

const executions = t.type({
  "@_maximal": t.number,
  "@_completed": t.number
})

const rawProcessTypes = t.union([
  t.literal("/sap/bc/adt/runtime/traces/abaptraces/processtypes/any"),
  t.literal("/sap/bc/adt/runtime/traces/abaptraces/processtypes/http"),
  t.literal("/sap/bc/adt/runtime/traces/abaptraces/processtypes/dialog"),
  t.literal("/sap/bc/adt/runtime/traces/abaptraces/processtypes/batch"),
  t.literal("/sap/bc/adt/runtime/traces/abaptraces/processtypes/rfc"),
  t.literal(
    "/sap/bc/adt/runtime/traces/abaptraces/processtypes/sharedobjectsarea"
  )
])

const rawObjectTypes = t.union([
  t.literal("/sap/bc/adt/runtime/traces/abaptraces/objecttypes/any"),
  t.literal("/sap/bc/adt/runtime/traces/abaptraces/objecttypes/url"),
  t.literal("/sap/bc/adt/runtime/traces/abaptraces/objecttypes/transaction"),
  t.literal("/sap/bc/adt/runtime/traces/abaptraces/objecttypes/report"),
  t.literal("/sap/bc/adt/runtime/traces/abaptraces/objecttypes/functionmodule"),
  t.literal(
    "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/sharedobjectarea"
  )
])
type RawObjectTypes = t.TypeOf<typeof rawObjectTypes>
type RawProcessTypes = t.TypeOf<typeof rawProcessTypes>
const traceListextendedData = t.type({
  host: t.string,
  requestIndex: t.number,
  client: xmlArrayType(client),
  description: t.string,
  isAggregated: t.boolean,
  expires: t.string,
  processType: t.type({ "@_processTypeId": rawProcessTypes }),
  object: t.type({ "@_objectTypeId": rawObjectTypes }),
  executions: executions
})

const traceListEntry = mixed(
  {
    id: t.string,
    author: xmlArrayType(author),
    content: t.type({
      "@_type": t.string,
      "@_src": t.string
    }),
    published: t.string,
    title: t.string,
    updated: t.string,
    extendedData: traceListextendedData,
    "@_lang": t.string
  },
  {
    link: xmlArrayType(link)
  }
)
const tlFeed = t.type({
  contributor: t.type({
    name: t.string,
    "@_role": t.string
  }),
  title: t.string,
  updated: t.string,
  entry: xmlArrayType(traceListEntry)
})
const tracesListRequest = t.type({ feed: tlFeed })

export interface TraceResults {
  author: string
  contributor: string
  title: string
  updated: Date
  runs: TraceRun[]
}

export interface TraceRun {
  id: string
  author: string
  title: string
  published: Date
  updated: Date
  authorUri: string
  type: string
  src: string
  lang: string
  extendedData: ExtendedTraceData
  links: TraceLink[]
}

export interface ExtendedTraceData {
  host: string
  size: number
  runtime: number
  runtimeABAP: number
  runtimeSystem: number
  runtimeDatabase: number
  expiration: Date
  system: string
  client: number
  isAggregated: boolean
  aggregationKind?: string
  objectName: string
  state: State
}

export interface State {
  value: string
  text: string
}

export interface TraceLink {
  href: string
  rel: string
  type: string
  title: string
}

export interface TraceHitList {
  parentLink: string
  entries: HitListEntry[]
}

export interface CallingProgram {
  context: string
  byteCodeOffset: number
  uri?: string
  type?: string
  name?: string
  packageName?: string
  objectReferenceQuery?: string
}

export interface HitListEntry {
  topDownIndex: number
  index: number
  hitCount: number
  stackCount?: number
  recursionDepth: number
  description: string
  proceduralEntryAnchor?: number
  dbAccessAnchor?: number
  callingProgram?: CallingProgram
  calledProgram: string
  grossTime: TraceTime
  traceEventNetTime: TraceTime
  proceduralNetTime: TraceTime
}

export interface TraceTime {
  time: number
  percentage: number
}

///

export interface TraceDBAccessResponse {
  parentLink: string
  dbaccesses: Dbaccess[]
  tables: Table[]
}

export interface Dbaccess {
  index: number
  tableName: string
  statement: string
  type: TraceTableType
  totalCount: number
  bufferedCount: number
  accessTime: AccessTime
  callingProgram?: CallingProgram
}

export interface AccessTime {
  total: number
  applicationServer: number
  database: number
  ratioOfTraceTotal: number
}

export type TraceTableType = "" | "EXEC SQL" | "OpenSQL"
export interface Table {
  name: string
  type: string
  description: string
  bufferMode: string
  storageType: string
  package: string
}

///

export interface TraceStatement {
  index: number
  id: number
  description: string
  hitCount: number
  hasDetailSubnodes: boolean
  hasProcedureLikeSubnodes: boolean
  callerId: number
  callLevel: number
  subnodeCount: number
  directSubnodeCount: number
  directSubnodeCountProcedureLike: number
  isAutoDrillDowned?: boolean
  isProceduralUnit?: boolean
  isProcedureLike?: boolean
  hitlistAnchor: number
  callingProgram: CallingProgram
  grossTime: TraceTime
  traceEventNetTime: TraceTime
  proceduralNetTime: TraceTime
}

export interface TraceStatementResponse {
  withDetails: boolean
  withSysEvents: boolean
  count: number
  parentLink: string
  statements: TraceStatement[]
}
///
export type TraceStatementOptions = Partial<{
  id: number
  withDetails: boolean
  autoDrillDownThreshold: number
  withSystemEvents: boolean
}>
///
export interface TraceRequestAuthor {
  name: string
  role: string
  uri: string
}
export interface TraceRequestClient {
  id: number
  role: string
}

export interface TraceRequestExecutions {
  maximal: number
  completed: number
}

export interface TraceRequestExtendedData {
  description: string
  executions: TraceRequestExecutions
  isAggregated: boolean
  host: string
  expires: Date
  processType: TracedProcessType
  objectType: TracedObjectType
  requestIndex: number
  clients: TraceRequestClient[]
}

export interface TraceRequest {
  id: string
  lang: string
  title: string
  published: Date
  updated: Date
  links: TraceLink[]
  authors: TraceRequestAuthor[]
  contentSrc: string
  contentType: string
  extendedData: TraceRequestExtendedData
}

export interface TraceRequestList {
  title: string
  contributorName: string
  contributorRole: string
  requests: TraceRequest[]
}

///
export interface TraceParameters {
  allMiscAbapStatements: boolean
  allProceduralUnits: boolean
  allInternalTableEvents: boolean
  allDynproEvents: boolean
  description: string
  aggregate: boolean
  explicitOnOff: boolean
  withRfcTracing: boolean
  allSystemKernelEvents: boolean
  sqlTrace: boolean
  allDbEvents: boolean
  maxSizeForTraceFile: number
  maxTimeForTracing: number
}
///

export type TracedProcessType =
  | "HTTP"
  | "DIALOG"
  | "RFC"
  | "BATCH"
  | "SHARED_OBJECTS_AREA"
  | "ANY"
export type TracedObjectType =
  | "FUNCTION_MODULE"
  | "URL"
  | "TRANSACTION"
  | "REPORT"
  | "SHARED_OBJECTS_AREA"
  | "ANY"

export const traceProcessTypeUris: Record<TracedProcessType, RawProcessTypes> =
  {
    ANY: "/sap/bc/adt/runtime/traces/abaptraces/processtypes/any",
    HTTP: "/sap/bc/adt/runtime/traces/abaptraces/processtypes/http",
    DIALOG: "/sap/bc/adt/runtime/traces/abaptraces/processtypes/dialog",
    BATCH: "/sap/bc/adt/runtime/traces/abaptraces/processtypes/batch",
    RFC: "/sap/bc/adt/runtime/traces/abaptraces/processtypes/rfc",
    SHARED_OBJECTS_AREA:
      "/sap/bc/adt/runtime/traces/abaptraces/processtypes/sharedobjectsarea"
  }

export const traceObjectTypeUris: Record<TracedObjectType, RawObjectTypes> = {
  ANY: "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/any",
  URL: "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/url",
  TRANSACTION: "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/transaction",
  REPORT: "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/report",
  FUNCTION_MODULE:
    "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/functionmodule",
  SHARED_OBJECTS_AREA:
    "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/sharedobjectarea"
}

const decodeObjectType = (x: RawObjectTypes): TracedObjectType => {
  switch (x) {
    case "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/any":
      return "ANY"
    case "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/url":
      return "URL"
    case "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/transaction":
      return "TRANSACTION"
    case "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/report":
      return "REPORT"
    case "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/functionmodule":
      return "FUNCTION_MODULE"
    case "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/sharedobjectarea":
      return "SHARED_OBJECTS_AREA"
    default:
      return "ANY"
  }
}

const decodeProcessType = (x: RawProcessTypes): TracedProcessType => {
  switch (x) {
    case "/sap/bc/adt/runtime/traces/abaptraces/processtypes/any":
      return "ANY"
    case "/sap/bc/adt/runtime/traces/abaptraces/processtypes/http":
      return "HTTP"
    case "/sap/bc/adt/runtime/traces/abaptraces/processtypes/dialog":
      return "DIALOG"
    case "/sap/bc/adt/runtime/traces/abaptraces/processtypes/batch":
      return "BATCH"
    case "/sap/bc/adt/runtime/traces/abaptraces/processtypes/rfc":
      return "RFC"
    case "/sap/bc/adt/runtime/traces/abaptraces/processtypes/sharedobjectsarea":
      return "SHARED_OBJECTS_AREA"
    default:
      return "ANY"
  }
}

export const traceProcessObjects: Record<
  TracedProcessType,
  TracedObjectType[]
> = {
  ANY: [
    "FUNCTION_MODULE",
    "URL",
    "TRANSACTION",
    "REPORT",
    "SHARED_OBJECTS_AREA",
    "ANY"
  ],
  HTTP: ["URL"],
  DIALOG: ["TRANSACTION", "REPORT"],
  BATCH: ["REPORT"],
  RFC: ["FUNCTION_MODULE"],
  SHARED_OBJECTS_AREA: ["SHARED_OBJECTS_AREA"]
}

export interface TracesCreationConfig {
  /**
   * server name, use * for all servers
   */
  server?: string
  description: string
  traceUser: string
  traceClient: string
  processType: TracedProcessType
  objectType: TracedObjectType
  expires: Date
  maximalExecutions: number
  parametersId: string
}

const parseRawTrace = (x: unknown) =>
  validateParseResult(traceResults.decode(x)).feed

export const parseTraceResults = (xml: string): TraceResults => {
  const raw = parseRawTrace(fullParse(xml, { removeNSPrefix: true }))
  const runs = extractXmlArray(raw.entry).map(l => {
    const links = extractXmlArray(l.link).map(typedNodeAttr)
    const {
      id,
      author: { name: author, uri: authorUri },
      content: { "@_type": type, "@_src": src },
      "@_lang": lang,
      title
    } = l
    const published = new Date(l.published)
    const updated = new Date(l.updated)
    const extendedData = {
      ...l.extendedData,
      expiration: new Date(l.extendedData.expiration),
      state: typedNodeAttr(l.extendedData.state)
    }
    // @ts-ignore
    delete extendedData["#text"]
    return {
      id,
      author,
      title,
      published,
      updated,
      authorUri,
      type,
      src,
      lang,
      extendedData,
      links
    }
  })
  const {
    author: { name: author },
    contributor: { name: contributor },
    title
  } = raw
  const updated = new Date(xmlNode(raw, "updated"))
  return { author, contributor, title, updated, runs }
}

export const parseTraceHitList = (xml: string): TraceHitList => {
  const raw = validateParseResult(
    HitListResponse.decode(fullParse(xml, { removeNSPrefix: true }))
  ).hitlist
  const parentLink = raw.link["@_href"]
  const entries = extractXmlArray(raw.entry).map(e => {
    const callingProgram = e.callingProgram
      ? typedNodeAttr(e.callingProgram)
      : undefined
    const calledProgram = e.calledProgram?.["@_context"]
    const grossTime = typedNodeAttr(e.grossTime)
    const traceEventNetTime = typedNodeAttr(e.traceEventNetTime)
    const proceduralNetTime = typedNodeAttr(e.proceduralNetTime)

    return {
      ...typedNodeAttr(e),
      callingProgram,
      calledProgram,
      grossTime,
      traceEventNetTime,
      proceduralNetTime
    }
  })
  return { parentLink, entries }
}

export const parseTraceDbAccess = (xml: string): TraceDBAccessResponse => {
  const raw = validateParseResult(
    traceDBAccesResponse.decode(fullParse(xml, { removeNSPrefix: true }))
  ).dbAccesses
  const parentLink = raw.link["@_href"]
  const dbaccesses = extractXmlArray(raw.dbAccess).map(a => {
    const callingProgram = a.callingProgram && typedNodeAttr(a.callingProgram)
    const accessTime = typedNodeAttr(a.accessTime)
    return { ...typedNodeAttr(a), accessTime, callingProgram }
  })
  const tables = extractXmlArray(raw.tables.table).map(typedNodeAttr)
  return { parentLink, dbaccesses, tables }
}

const parseCount = (count: string | number) => {
  if (isNumber(count)) return count
  const [base, exp] = count.split("E").map(toInt)
  if (exp) return base * 10 ** exp
  return base
}

export const parseTraceStatements = (xml: string) => {
  const raw = validateParseResult(
    traceStatementResponse.decode(fullParse(xml, { removeNSPrefix: true }))
  ).statements

  const parentLink = raw.link["@_href"]
  const statements = extractXmlArray(raw.statement).map(s => {
    const callingProgram = typedNodeAttr(s.callingProgram)
    const grossTime = typedNodeAttr(s.grossTime)
    const proceduralNetTime = typedNodeAttr(s.proceduralNetTime)
    const traceEventNetTime = typedNodeAttr(s.traceEventNetTime)
    return {
      ...typedNodeAttr(s),
      callingProgram,
      grossTime,
      traceEventNetTime,
      proceduralNetTime
    }
  })
  const count = parseCount(raw["@_count"])

  return { ...typedNodeAttr(raw), count, parentLink, statements }
}

export const parseTraceRequestList = (xml: string): TraceRequestList => {
  const raw = fullParse(xml, { removeNSPrefix: true })
  const parsed = validateParseResult(tracesListRequest.decode(raw)).feed
  const {
    contributor: { name: contributorName, "@_role": contributorRole },
    title
  } = parsed
  const requests = extractXmlArray(parsed.entry).map(e => {
    const { id, "@_lang": lang, title } = e
    const published = new Date(e.published)
    const updated = new Date(e.updated)
    const links = extractXmlArray(e.link).map(typedNodeAttr)
    const authors = extractXmlArray(e.author).map(
      ({ name, uri, "@_role": role }) => ({ name, role, uri })
    )
    const { "@_src": contentSrc, "@_type": contentType } = e.content
    const { description, executions, isAggregated, host, requestIndex } =
      e.extendedData
    const expires = new Date(e.extendedData.expires)
    const processType = decodeProcessType(
      e.extendedData.processType["@_processTypeId"]
    )
    const objectType = decodeObjectType(e.extendedData.object["@_objectTypeId"])
    const clients = extractXmlArray(e.extendedData.client).map(
      ({ "#text": id = 0, "@_role": role = "" }) => ({ id, role })
    )
    const extendedData = {
      description,
      executions: typedNodeAttr(executions),
      isAggregated,
      host,
      expires,
      processType,
      objectType,
      requestIndex,
      clients
    }
    return {
      id,
      lang,
      title,
      published,
      updated,
      links,
      authors,
      contentSrc,
      contentType,
      extendedData
    }
  })
  return { title, contributorName, contributorRole, requests }
}
