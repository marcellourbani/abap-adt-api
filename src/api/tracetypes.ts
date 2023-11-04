import * as t from "io-ts"
import {
  extractXmlArray,
  fullParse,
  mixed,
  orUndefined,
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
  grossTime: Time
  traceEventNetTime: Time
  proceduralNetTime: Time
}

export interface Time {
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
