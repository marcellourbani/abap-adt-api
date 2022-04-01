import { Clean, parts, toInt } from "../utilities"
import { Location } from "./syntax"
import * as t from "io-ts";
import { validateParseResult } from "..";

const location = t.type({
  line: t.number,
  column: t.number
})

const range = t.type({
  start: location,
  end: location
})

export const uriParts = t.type({
  uri: t.string,
  query: t.union([t.undefined, t.record(t.string, t.string)]),
  range: range,
  hashparms: t.union([t.undefined, t.record(t.string, t.string)]),
})

export type Range = Clean<t.TypeOf<typeof range>>
export type UriParts = Clean<t.TypeOf<typeof uriParts>>

export const rangeToString = (range: Range) =>
  `#start=${range.start.line},${range.start.column};end=${range.end.line},${range.end.column}`

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
