import { parts, toInt } from "../utilities"
import { Location } from "./syntax"

export interface Range {
  start: Location
  end: Location
}

export interface UriParts {
  uri: string
  query: any
  range: Range
  hashparms?: any
}

export const rangeToString = (range: Range) =>
  `#start=${range.start.line},${range.start.column};end=${range.end.line},${range.end.column}`

export function parseUri(sourceuri: string): UriParts {
  const [uri, qs, hash] = parts(sourceuri, /([^\?#]*)(?:\?([^#]*))?(?:#(.*))?/)
  //
  const query = (qs || "").split(/&/).reduce((acc: any, cur) => {
    const [key, val] = cur.split("=")
    if (key) acc[key] = val
    return acc
  }, {})

  const { start, end, ...hashparms } = (hash || "")
    .split(/;/)
    .reduce((acc: any, cur) => {
      const [key, val] = cur.split("=")
      if (key) acc[key] = val
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
