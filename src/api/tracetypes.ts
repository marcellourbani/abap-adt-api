import { Schema } from "effect"
import type { DeepMutable } from "effect/Types"
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

const contributorClass = Schema.Struct({ name: Schema.String })
const link = Schema.Struct({
  "@_href": Schema.String,
  "@_rel": Schema.String,
  "@_type": Schema.String,
  "@_title": Schema.String
})

// A	Active
// R	Read Only
// E	Error
// S	SizeLim
// T	TimeLim
// C	Close Error

const state = Schema.Struct({ "@_value": Schema.String, "@_text": Schema.String })

const extendedData = Schema.Struct({
  host: Schema.String,
  size: Schema.Number,
  runtime: Schema.Number,
  runtimeABAP: Schema.Number,
  runtimeSystem: Schema.Number,
  runtimeDatabase: Schema.Number,
  expiration: Schema.String,
  system: Schema.String,
  client: Schema.Number,
  isAggregated: Schema.Boolean,
  aggregationKind: orUndefined(Schema.String),
  objectName: Schema.String,
  state: state
})

const entryAuthor = Schema.Struct({ name: Schema.String, uri: Schema.String })
const entry = Schema.Struct({
  author: entryAuthor,
  content: Schema.Struct({
    "@_type": Schema.String,
    "@_src": Schema.String
  }),
  id: Schema.String,
  link: xmlArrayType(link),
  published: Schema.String,
  title: Schema.String,
  updated: Schema.String,
  extendedData: extendedData,
  "@_lang": Schema.String
})

const feed = Schema.Struct({
  author: contributorClass,
  contributor: contributorClass,
  title: Schema.String,
  updated: Schema.String,
  entry: xmlArrayType(entry)
})
const traceResults = Schema.Struct({ feed: feed })

const time = Schema.Struct({
  "@_time": Schema.Number,
  "@_percentage": Schema.Number
})

const baseLink = Schema.Struct({
  "@_rel": Schema.String,
  "@_href": Schema.String
})

const calledProgram = Schema.Struct({ "@_context": Schema.String })

const callingProgram = mixed(
  {
    "@_context": Schema.String,
    "@_byteCodeOffset": Schema.Number
  },
  {
    "@_uri": Schema.String,
    "@_type": Schema.String,
    "@_name": Schema.String,
    "@_packageName": Schema.String,
    "@_objectReferenceQuery": Schema.String
  }
)

const hlentry = mixed(
  {
    calledProgram: calledProgram,
    grossTime: time,
    traceEventNetTime: time,
    proceduralNetTime: time,
    "@_topDownIndex": Schema.Number,
    "@_index": Schema.Number,
    "@_hitCount": Schema.Number,
    "@_recursionDepth": Schema.Number,
    "@_description": Schema.String
  },
  {
    callingProgram: callingProgram,
    "@_stackCount": Schema.Number,
    "@_proceduralEntryAnchor": Schema.Number,
    "@_dbAccessAnchor": Schema.Number
  }
)

const Hitlist = Schema.Struct({
  link: baseLink,
  entry: xmlArrayType(hlentry)
})

const HitListResponse = Schema.Struct({ hitlist: Hitlist })
///

const accessTime = Schema.Struct({
  "@_total": Schema.Number,
  "@_applicationServer": Schema.Number,
  "@_database": Schema.Number,
  "@_ratioOfTraceTotal": Schema.Number
})

const dBAccess = mixed(
  {
    accessTime: accessTime,
    "@_index": Schema.Number,
    "@_tableName": Schema.String,
    "@_statement": Schema.String,
    "@_type": Schema.Literals(["EXEC SQL", "OpenSQL", ""]),
    "@_totalCount": Schema.Number,
    "@_bufferedCount": Schema.Number
  },
  {
    callingProgram: callingProgram
  }
)

const dBAccesses = Schema.Struct({
  link: baseLink,
  dbAccess: xmlArrayType(dBAccess),
  tables: Schema.Union([
    Schema.Struct({
      table: xmlArrayType(
        Schema.Struct({
          "@_name": Schema.String,
          "@_type": Schema.String,
          "@_description": Schema.String,
          "@_bufferMode": Schema.String,
          "@_storageType": Schema.String,
          "@_package": Schema.String
        })
      )
    }),
    Schema.Literal("")
  ]),
  "@_totalDbTime": Schema.Number
})

const traceDBAccesResponse = Schema.Struct({ dbAccesses: dBAccesses })
///
const statement = mixed(
  {
    callingProgram: callingProgram,
    grossTime: time,
    traceEventNetTime: time,
    proceduralNetTime: time,
    "@_index": Schema.Number,
    "@_id": Schema.Number,
    "@_description": Schema.String,
    "@_hitCount": Schema.Number,
    "@_hasDetailSubnodes": Schema.Boolean,
    "@_hasProcedureLikeSubnodes": Schema.Boolean,
    "@_callerId": Schema.Number,
    "@_callLevel": Schema.Number,
    "@_subnodeCount": Schema.Number,
    "@_directSubnodeCount": Schema.Number,
    "@_directSubnodeCountProcedureLike": Schema.Number,
    "@_hitlistAnchor": Schema.Number
  },
  {
    "@_isProcedureLike": Schema.Boolean,
    "@_isProceduralUnit": Schema.Boolean,
    "@_isAutoDrillDowned": Schema.Boolean,
    "@_calltreeAnchor": Schema.Number,
    "@_moduleHitlistAnchor": Schema.Number
  }
)

const traceStatementResponse = Schema.Struct({
  statements: Schema.Struct({
    link: baseLink,
    statement: xmlArrayType(statement),
    "@_withDetails": Schema.Boolean,
    "@_withSysEvents": Schema.Boolean,
    "@_count": Schema.Union([Schema.Number, Schema.String])
  })
})

///

const author = Schema.Struct({
  name: Schema.String,
  uri: Schema.String,
  "@_role": Schema.String
})

const client = mixed(
  {},
  {
    "#text": Schema.Number,
    "@_role": Schema.String
  }
)

const executions = Schema.Struct({
  "@_maximal": Schema.Number,
  "@_completed": Schema.Number
})

const rawProcessTypes = Schema.Literals([
  "/sap/bc/adt/runtime/traces/abaptraces/processtypes/any",
  "/sap/bc/adt/runtime/traces/abaptraces/processtypes/http",
  "/sap/bc/adt/runtime/traces/abaptraces/processtypes/dialog",
  "/sap/bc/adt/runtime/traces/abaptraces/processtypes/batch",
  "/sap/bc/adt/runtime/traces/abaptraces/processtypes/rfc",
  "/sap/bc/adt/runtime/traces/abaptraces/processtypes/sharedobjectsarea"
])

const rawObjectTypes = Schema.Literals([
  "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/any",
  "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/url",
  "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/transaction",
  "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/report",
  "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/functionmodule",
  "/sap/bc/adt/runtime/traces/abaptraces/objecttypes/sharedobjectarea"
])
type RawObjectTypes = typeof rawObjectTypes.Type
type RawProcessTypes = typeof rawProcessTypes.Type
const traceListextendedData = Schema.Struct({
  host: Schema.String,
  requestIndex: Schema.Number,
  client: xmlArrayType(client),
  description: Schema.String,
  isAggregated: Schema.Boolean,
  expires: Schema.String,
  processType: Schema.Struct({ "@_processTypeId": rawProcessTypes }),
  object: Schema.Struct({ "@_objectTypeId": rawObjectTypes }),
  executions: executions
})

const traceListEntry = mixed(
  {
    id: Schema.String,
    author: xmlArrayType(author),
    content: Schema.Struct({
      "@_type": Schema.String,
      "@_src": Schema.String
    }),
    published: Schema.String,
    title: Schema.String,
    updated: Schema.String,
    extendedData: traceListextendedData,
    "@_lang": Schema.String
  },
  {
    link: xmlArrayType(link)
  }
)
const tlFeed = Schema.Struct({
  contributor: Schema.Struct({
    name: Schema.String,
    "@_role": Schema.String
  }),
  title: Schema.String,
  updated: Schema.String,
  entry: xmlArrayType(traceListEntry)
})
const tracesListRequest = Schema.Struct({ feed: tlFeed })

/** validates a parsed response, typed as the mutable shape io-ts used to infer */
const validate = <S extends Schema.Top>(schema: S, x: unknown) =>
  validateParseResult(schema, x) as DeepMutable<S["Type"]>

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
  calltreeAnchor?: number
  moduleHitlistAnchor?: number
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

const parseRawTrace = (x: unknown) => validate(traceResults, x).feed

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
  const raw = validate(
    HitListResponse,
    fullParse(xml, { removeNSPrefix: true })
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
  const toParse = fullParse(xml, { removeNSPrefix: true })
  const raw = validate(traceDBAccesResponse, toParse).dbAccesses
  const parentLink = raw.link["@_href"]
  const dbaccesses = extractXmlArray(raw.dbAccess).map(a => {
    const callingProgram = a.callingProgram && typedNodeAttr(a.callingProgram)
    const accessTime = typedNodeAttr(a.accessTime)
    return { ...typedNodeAttr(a), accessTime, callingProgram }
  })
  const tables =
    raw.tables === ""
      ? []
      : extractXmlArray(raw.tables.table).map(typedNodeAttr)
  return { parentLink, dbaccesses, tables }
}

const parseCount = (count: string | number) => {
  if (isNumber(count)) return count
  const [base, exp] = count.split("E").map(toInt)
  if (exp) return base * 10 ** exp
  return base
}

export const parseTraceStatements = (xml: string) => {
  const raw = validate(
    traceStatementResponse,
    fullParse(xml, { removeNSPrefix: true })
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
  const parsed = validate(
    tracesListRequest,
    fullParse(xml, { removeNSPrefix: true })
  ).feed
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
