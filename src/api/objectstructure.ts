import { ValidateObjectUrl } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import { fullParse, xmlArray, xmlNodeAttr, xmlRoot } from "../utilities"

export interface GenericMetaData {
  "abapsource:activeUnicodeCheck": boolean
  "abapsource:fixPointArithmetic": boolean
  "abapsource:sourceUri": string
  "adtcore:changedAt": number
  "adtcore:changedBy": string
  "adtcore:createdAt": number
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

export async function objectStructure(
  h: AdtHTTP,
  objectUrl: string
): Promise<AbapObjectStructure> {
  ValidateObjectUrl(objectUrl)
  const response = await h.request(objectUrl)
  const res = fullParse(response.body)
  // return type depends on object type, but always have a single root
  const root = xmlRoot(res)
  const attr = xmlNodeAttr(root)
  attr["adtcore:changedAt"] = Date.parse(attr["adtcore:changedAt"]) || 0
  attr["adtcore:createdAt"] = Date.parse(attr["adtcore:createdAt"]) || 0

  const links: Link[] = xmlArray(root, "atom:link").map(xmlNodeAttr)

  const metaData: AbapMetaData = attr
  if (isClassMetaData(metaData)) {
    const includes = root["class:include"].map(convertIncludes)
    return { objectUrl, metaData, includes, links } as AbapClassStructure
  }
  return { objectUrl, metaData, links }
}
