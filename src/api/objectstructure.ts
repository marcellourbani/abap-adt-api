import { parse } from "fast-xml-parser"
import { AdtHTTP } from "../AdtHTTP"
import { xmlNodeAttr, xmlRoot } from "../utilities"

interface GenericMetaData {
  "abapsource:activeUnicodeCheck": boolean
  "abapsource:fixPointArithmetic": boolean
  "abapsource:sourceUri": string
  "adtcore:changedAt": Date
  "adtcore:changedBy": string
  "adtcore:createdAt": Date
  "adtcore:description": string
  "adtcore:descriptionTextLimit": number
  "adtcore:language": string
  "adtcore:masterLanguage": string
  "adtcore:masterSystem": string
  "adtcore:name": string
  "adtcore:responsible": string
  "adtcore:type": string
  "adtcore:version": string
}

interface ProgramMetaData extends GenericMetaData {
  "program:lockedByEditor": boolean
  "program:programType": string
}

interface FunctionGroupMetaData extends GenericMetaData {
  "group:lockedByEditor": boolean
}

interface ClassMetaData extends GenericMetaData {
  "abapoo:modeled": boolean
  "class:abstract": boolean
  "class:category": string
  "class:final": boolean
  "class:sharedMemoryEnabled": boolean
  "class:visibility": string
}

interface Link {
  etag?: number
  href: string
  rel: string
  type?: string
}
interface ClassInclude {
  "abapsource:sourceUri": string
  "adtcore:changedAt": string
  "adtcore:changedBy": string
  "adtcore:createdAt": string
  "adtcore:createdBy": string
  "adtcore:name": string
  "adtcore:type": string
  "adtcore:version": string
  "class:includeType": string
  links: Link[]
}
export type AbapMetaData =
  | GenericMetaData
  | ProgramMetaData
  | FunctionGroupMetaData
  | ClassMetaData

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
}
export type AbapObjectStructure = AbapSimpleStructure | AbapClassStructure
export function isClassMetaData(meta: AbapMetaData): meta is ClassMetaData {
  return (meta as ClassMetaData)["class:visibility"] !== undefined
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

export type classIncludes =
  | "definitions"
  | "implementations"
  | "macros"
  | "testclasses"
  | "main"

export async function objectStructure(
  h: AdtHTTP,
  objectUrl: string
): Promise<AbapObjectStructure> {
  const response = await h.request(objectUrl)
  const res = parse(response.data, {
    ignoreAttributes: false,
    parseAttributeValue: true
  })
  // return type depends on object type, but always have a single root
  const root = xmlRoot(res)
  const attr = xmlNodeAttr(root)
  attr["adtcore:changedAt"] = Date.parse(attr["adtcore:changedAt"])
  attr["adtcore:createdAt"] = Date.parse(attr["adtcore:createdAt"])

  const links: Link[] = root["atom:link"].map(xmlNodeAttr)

  const metaData: AbapMetaData = attr
  if (isClassMetaData(metaData)) {
    const includes = root["class:include"].map(convertIncludes)
    return { objectUrl, metaData, includes, links } as AbapClassStructure
  }
  return { objectUrl, metaData, links }
}
