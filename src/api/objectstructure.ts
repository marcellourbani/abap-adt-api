import { ValidateObjectUrl } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import {
  fullParse,
  xmlArray,
  xmlNodeAttr,
  xmlRoot,
  xmlNode
} from "../utilities"

export type ObjectVersion = "active" | "inactive" | "workingArea"

export interface GenericMetaData {
  "abapsource:activeUnicodeCheck"?: boolean
  "abapsource:fixPointArithmetic"?: boolean
  "abapsource:sourceUri"?: string
  "adtcore:changedAt": number
  "adtcore:changedBy": string
  "adtcore:createdAt": number
  "adtcore:description"?: string
  "adtcore:descriptionTextLimit"?: number
  "adtcore:language": string
  "adtcore:masterLanguage"?: string
  "adtcore:masterSystem"?: string
  "adtcore:name": string
  "adtcore:responsible": string
  "adtcore:type": string
  "adtcore:version": string
}

export interface ProgramMetaData extends GenericMetaData {
  "program:lockedByEditor": boolean
  "program:programType": string
}

export interface FunctionGroupMetaData extends GenericMetaData {
  "group:lockedByEditor": boolean
}

export interface ClassMetaData extends GenericMetaData {
  "abapoo:modeled": boolean
  "class:abstract": boolean
  "class:category": string
  "class:final": boolean
  "class:sharedMemoryEnabled": boolean
  "class:visibility": string
}

export interface Link {
  etag?: number
  href: string
  rel: string
  type?: string
  title?: string
}
export type classIncludes =
  | "definitions"
  | "implementations"
  | "macros"
  | "testclasses"
  | "main"
export interface ClassInclude {
  "abapsource:sourceUri": string
  "adtcore:changedAt": number
  "adtcore:changedBy": string
  "adtcore:createdAt": number
  "adtcore:createdBy": string
  "adtcore:name": string
  "adtcore:type": string
  "adtcore:version": string
  "class:includeType": classIncludes
  links: Link[]
}
export type AbapMetaData =
  | GenericMetaData
  | ProgramMetaData
  | FunctionGroupMetaData
  | ClassMetaData

export interface StructureElement {
  name: string
  type: string
  description?: string
  visibility?: string
  level?: string
  constant?: boolean
  constructor?: boolean
  testmethod?: boolean
  redefinition?: boolean
  final?: boolean
  links: Link[]
  children: StructureElement[]
}
export interface AbapSimpleStructure {
  objectUrl: string
  metaData: AbapMetaData
  links: Link[]
}
export interface AbapClassStructure {
  objectUrl: string
  metaData: ClassMetaData
  links?: Link[]
  includes: ClassInclude[]
  // Optional enriched outline emitted when callers request structure elements
  structureElements?: StructureElement[]
}
export interface AbapClassStructureWithElements extends AbapClassStructure {
  structureElements: StructureElement[]
}

export type AbapObjectStructure = AbapSimpleStructure | AbapClassStructure
export function isClassMetaData(meta: AbapMetaData): meta is ClassMetaData {
  return (meta as ClassMetaData)["class:visibility"] !== undefined
}
export function hasElements(
  obj: AbapObjectStructure
): obj is AbapClassStructureWithElements {
  return (
    isClassStructure(obj) &&
    !!obj.structureElements &&
    Array.isArray(obj.structureElements)
  )
}

export function isClassStructure(
  struc: AbapObjectStructure
): struc is AbapClassStructure {
  return isClassMetaData(struc.metaData)
}
const convertIncludes = (i: any): ClassInclude => {
  const imeta = xmlNodeAttr(i)
  const links = i["atom:link"].map(xmlNodeAttr)
  return { ...imeta, links }
}

function parseBool(val: unknown): boolean | undefined {
  if (val === true || val === "true") return true
  if (val === false || val === "false") return false
  return undefined
}

function parseStructureElement(el: any): StructureElement {
  const attr = xmlNodeAttr(el)
  const links: Link[] = xmlArray(el, "atom:link").map(xmlNodeAttr)
  const children: StructureElement[] = xmlArray(
    el,
    "abapsource:objectStructureElement"
  ).map(parseStructureElement)
  return {
    name: attr["adtcore:name"] || "",
    type: attr["adtcore:type"] || "",
    description: attr["adtcore:description"],
    visibility: attr.visibility,
    level: attr.level,
    constant: parseBool(attr.constant),
    constructor: parseBool(attr.constructor),
    testmethod: parseBool(attr.testmethod),
    redefinition: parseBool(attr.redefinition),
    final: parseBool(attr.final),
    links,
    children
  }
}

export async function objectStructureElements(
  h: AdtHTTP,
  objectUrl: string,
  version?: ObjectVersion
): Promise<StructureElement[]> {
  ValidateObjectUrl(objectUrl)
  if (!objectUrl.match(/\/oo\/classes\/|\/oo\/interfaces\//i)) return []
  try {
    const qs: any = {
      version: version || "active",
      withShortDescriptions: "true"
    }
    const uri = `${objectUrl}/objectstructure`
    const r = await h.request(uri, { qs: qs })
    const raw = fullParse(r.body)
    const rootEl = xmlNode(raw, "abapsource:objectStructureElement")
    if (!rootEl) return []

    const structureElements = xmlArray(
      rootEl,
      "abapsource:objectStructureElement"
    ).map(parseStructureElement)

    return structureElements
  } catch (e) {
    // Ignore errors fetching /objectstructure (older servers or non-class objects)
  }
  return []
}

export async function objectStructure(
  h: AdtHTTP,
  objectUrl: string,
  version?: ObjectVersion,
  opts?: { withStructureElements?: boolean }
): Promise<AbapObjectStructure> {
  ValidateObjectUrl(objectUrl)
  const qs = version ? { version } : {}
  const response = await h.request(objectUrl, { qs })
  const res = fullParse(response.body)
  // return type depends on object type, but always have a single root
  const root = xmlRoot(res)
  const attr = xmlNodeAttr(root)
  attr["adtcore:changedAt"] = Date.parse(attr["adtcore:changedAt"]) || 0
  attr["adtcore:createdAt"] = Date.parse(attr["adtcore:createdAt"]) || 0

  const links: Link[] = xmlArray(root, "atom:link").map(xmlNodeAttr)

  const metaData: AbapMetaData = attr
  let result: AbapObjectStructure
  if (isClassMetaData(metaData)) {
    const includes = xmlArray(root, "class:include").map(convertIncludes)
    result = { objectUrl, metaData, includes, links } as AbapClassStructure
  } else result = { objectUrl, metaData, links }

  // Optionally fetch the richer `/objectstructure` outline for classes/interfaces
  if (opts?.withStructureElements && isClassStructure(result)) {
    const lower = objectUrl.toLowerCase()
    if (lower.includes("/oo/classes/") || lower.includes("/oo/interfaces/"))
      result.structureElements = await objectStructureElements(
        h,
        objectUrl,
        version
      )
  }

  return result
}
