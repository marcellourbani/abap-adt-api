import { Schema } from "effect"
import { orUndefined, parts, toInt } from "../utilities"
import { Location } from "./syntax"

const location = Schema.Struct({
  line: Schema.Number,
  column: Schema.Number
})

const range = Schema.Struct({
  start: location,
  end: location
})

export const uriParts = Schema.Struct({
  uri: Schema.String,
  query: orUndefined(Schema.Record(Schema.String, Schema.String)),
  range: range,
  hashparms: orUndefined(Schema.Record(Schema.String, Schema.String))
})

export interface Range {
  start: Location
  end: Location
}
export interface UriParts {
  uri: string
  query: Record<string, string> | undefined
  range: Range
  hashparms: Record<string, string> | undefined
}

export const rangeToString = (range: Range) =>
  `#start=${range.start.line},${range.start.column};end=${range.end.line},${range.end.column}`

const serializeKv = (r?: Record<string, string>) => {
  const rec = r || {}
  return Object.keys(rec).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(rec[k])}`)
}
const isNullRange = (r: Range) =>
  r.start.line === 0 && r.start.column === 0 && r.end.line === 0 && r.end.column === 0

export const uriPartsToString = (parts: UriParts) => {
  const range = isNullRange(parts.range) ? "" : rangeToString(parts.range)
  const parms = serializeKv(parts.hashparms).join(";")
  const query = serializeKv(parts.query).join("&")
  const hash = `${range ? range : ""}${parms ? `${range ? ";" : "#"}${parms}` : ``}`
  return `${parts.uri}${query ? `?${query}` : ``}${hash}`
}

export function parseUri(sourceuri: string): UriParts {
  const [uri, qs, hash] = parts(sourceuri, /([^\?#]*)(?:\?([^#]*))?(?:#(.*))?/)
  //
  const query = (qs || "").split(/&/).reduce((acc: any, cur) => {
    const [key, val] = cur.split("=")
    if (key) acc[decodeURIComponent(key)] = decodeURIComponent(val)
    return acc
  }, {})

  const { start, end, ...hashparms } = (hash || "")
    .split(/;/)
    .reduce((acc: any, cur) => {
      const [key, val] = cur.split("=")
      if (key) acc[decodeURIComponent(key)] = decodeURIComponent(val)
      return acc
    }, {})

  const parsePos = (x: string): Location => {
    const [line, column] = x ? x.split(",").map(toInt) : [0, 0]
    return { line: line || 0, column: column || 0 }
  }
  const st = parsePos(start)
  const range: Range = {
    start: st,
    end: end ? parsePos(end) : st
  }

  return { range, uri, query, hashparms }
}


