import { XMLParser, strnumOptions, X2jOptions } from "fast-xml-parser"
import * as t from "io-ts"
export { encode as encodeEntity } from "html-entities"
import { encode } from "html-entities"

export const isObject = <T extends Object>(x: unknown): x is T =>
  !!x && typeof x === "object"
export const isArray = <T = unknown>(x: unknown): x is T[] => Array.isArray(x)
export const isString = (x: unknown): x is string => typeof x === "string"
export const isNumber = (x: unknown): x is number => typeof x === "number"
export const isNativeError = (e: unknown): e is Error =>
  !!e && e instanceof Error
export const isUndefined = (x: unknown): x is undefined =>
  typeof x === "undefined"

export function JSON2AbapXML(original: any, root: string = "DATA") {
  // only flat objects for now, might extend later...
  let inner = ""
  for (const key of Object.keys(original))
    if (original[key])
      inner = `${inner}\n<${key}>${encode(original[key]) || ""}</${key}>`
    else inner = `${inner}\n<${key}/>`

  return `<?xml version="1.0" encoding="UTF-8"?><asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
    <asx:values>
      <${root}>
        ${inner}
      </${root}>
    </asx:values>
  </asx:abap>`
}

export const xmlArrayType = <C extends t.Mixed>(x: C) =>
  t.union([t.array(x), x, t.undefined])
export const extractXmlArray = <T>(x: T | T[] | undefined): T[] =>
  x ? (isArray(x) ? x : [x]) : []

export function xmlNode(xml: any, ...path: string[]): any {
  let current = xml

  path.some(key => {
    // @ts-ignore
    if (isObject(current)) current = current[key]
    return !current
  })

  return current
}

export function xmlFlatArray<T>(xml: any, ...path: string[]): T[] {
  if (!xml) return []

  if (path.length === 0) {
    if (isArray(xml)) return xml as any[]
    else return [xml]
  }

  if (isArray(xml))
    return xml.reduce(
      (arr: any[], x: any) => [...arr, ...xmlFlatArray(x, ...path)],
      []
    )

  if (isObject(xml)) {
    const [idx, ...rest] = path
    // @ts-ignore
    return xmlFlatArray(xml[idx], ...rest)
  }

  return []
}

export function xmlArray<T>(xml: any, ...path: string[]): T[] {
  const node = xmlNode(xml, ...path)
  if (node) {
    if (isArray(node)) return node as any[]
    else return [node]
  }

  return []
}

const ok = Object.keys
export const xmlRoot = (o: any) => o[ok(o).filter(k => k !== "?xml")[0]]

export const stripNs = (x: any) =>
  x &&
  ok(x).reduce((obj, key) => {
    const nk = key.split(":").slice(1).join(":") || key
    if (nk in obj) obj[key] = key
    else obj[nk] = x[key]
    return obj
  }, {} as any)

type StripAttrPrefix<T extends string> = T extends `@_${infer B}` ? B : never
const stripAttrPrefix = <
  T extends string,
  R = T extends `@_${infer P}` ? P : T
>(
  x: T
): R => x.replace(/^@_/, "") as R
type attribKeys<T, K = keyof T> = K extends keyof T & `@_${infer _}` ? K : never
type attribValues<T> = { [P in attribKeys<T> as StripAttrPrefix<P>]: T[P] }
type foo = attribValues<{ a: 1; "@_b": 2 }>
// extract XML attributes of a node from its JSON representation
export const xmlNodeAttr = (n: any) =>
  n &&
  ok(n)
    .filter(k => k.match(/^(?!@_xmlns)@_/))
    .reduce((part: any, cur) => {
      part[cur.replace(/^@_/, "")] = n[cur]
      return part
    }, {})

export const typedNodeAttr = <T = unknown>(n: T): attribValues<T> =>
  n &&
  ok(n)
    .filter(k => k.match(/^(?!@_xmlns)@_/))
    .reduce((part: any, cur) => {
      // @ts-ignore
      part[cur.replace(/^@_/, "")] = n[cur]
      return part
    }, {})
export const bar = stripAttrPrefix("@_pip")
export const numberParseOptions: strnumOptions = {
  leadingZeros: false,
  hex: true,
  skipLike: new RegExp("")
}

export const fullParse = (xml: string, options: X2jOptions = {}) =>
  new XMLParser({
    ignoreAttributes: false,
    trimValues: false,
    parseAttributeValue: true,
    ...options
  }).parse(xml)

export const parse = (xml: string, options: X2jOptions = {}) =>
  new XMLParser(options).parse(xml)

export function toInt(x?: string) {
  if (!x) return 0
  if (x.match(/^\s*[+-]?\d*\s*$/)) return Number.parseInt(x, 10)
  return 0
}

export const parseSapDate = (d: string) => {
  const match = d.match(/(\d\d\d\d)(\d\d)(\d\d)/)
  if (!match) return new Date() // wrong but valid
  const [Y, M, D] = match.slice(1)
  return Date.UTC(toInt(Y), toInt(M) - 1, toInt(D))
}

export const toSapDate = (d: Date) =>
  d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
export const parseJsonDate = (d: string) => new Date(Date.parse(d))

export function btoa(s: string) {
  return Buffer.from(s).toString("base64")
}

export function parts(whole: any, pattern: RegExp): string[] {
  if (!isString(whole)) return []
  const match = whole.match(pattern)
  return match ? match.slice(1) : []
}

export const followUrl = (base: string, extra: string) => {
  if (extra.match(/^\.\//)) {
    base = base.replace(/[^\/]*$/, "")
    extra = extra.replace(/^\.\//, "")
  } else extra = extra.replace(/^\//, "")
  base = base.replace(/\/$/, "")
  return base + "/" + extra
}

export const boolFromAbap = (x: any) => x === "X"

export function formatQS(raw: any) {
  const val = (key: string, x: any): string =>
    isArray(x)
      ? x.map(e => val(key, e)).join("&")
      : `${key}=${encodeURIComponent(x)}`
  return Object.getOwnPropertyNames(raw)
    .map(k => val(k, raw[k]))
    .join("&")
}

export const toXmlAttributes = (o: any, prefix: string) => {
  const sep = prefix ? ":" : ""
  return o
    ? Object.getOwnPropertyNames(o)
        .sort()
        .map(k => `${prefix}${sep}${k.replace(/^@_/, "")}="${o[k]}"`)
        .join(" ")
    : ""
}

export type Clean<T> = Pick<T, keyof T>

export const orUndefined = <T extends t.Mixed>(x: T) =>
  t.union([t.undefined, x])

export function mixed<R extends t.Props, O extends t.Props>(
  required: R,
  optional: O
): t.IntersectionC<[t.TypeC<R>, t.PartialC<O>]> {
  return t.intersection([t.type(required), t.partial(optional)])
}
