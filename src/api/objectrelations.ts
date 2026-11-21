import { AdtHTTP } from "../AdtHTTP"
import { encodeEntity, fullParse } from "../utilities"

/**
 * Object relations (the Relation Explorer of ADT):
 * related objects, components, source references and relations between object sets
 */

const NETWORK_PATH = "/sap/bc/adt/objectrelations/network"
const COMPONENTS_PATH = "/sap/bc/adt/objectrelations/components"
const REFERENCES_PATH = "/sap/bc/adt/objectrelations/references"
const RELATION_SETS_PATH = "/sap/bc/adt/objectrelations"
const REQUEST_TYPE = "application/vnd.sap.adt.objectrelations.request.v1+xml"
const NETWORK_TYPE =
  "application/vnd.sap.adt.objectrelations.response.network.v1+xml"
const COMPONENTS_TYPE =
  "application/vnd.sap.adt.objectrelations.response.components.v2+xml"
const REFERENCES_REQUEST_TYPE =
  "application/vnd.sap.adt.objectrelations.request.references.v1+xml"
const REFERENCES_TYPE =
  "application/vnd.sap.adt.objectrelations.response.references.v1+xml"
const SETS_REQUEST_TYPE =
  "application/vnd.sap.adt.objectrelations.request.sets.v1+xml"
const SETS_TYPE =
  "application/vnd.sap.adt.objectrelations.request.relations.v1+xml"
const ORO_NS = "http://www.sap.com/adt/objectrelations"
const ORO_REF_NS = "http://www.sap.com/adt/objectrelations/references"
const REL_NS = "http://www.sap.com/adt/objectrelations/relations"
const ADTCORE_NS = "http://www.sap.com/adt/core"
const OSL_NS = "http://www.sap.com/api/osl"
const XSI_NS = "http://www.w3.org/2001/XMLSchema-instance"

/** Context ids: ENV lists the objects used, WUL the objects using the given one */
export const ObjectRelationContexts = { used: "ENV", using: "WUL" } as const

/** An object to read relations for */
export interface ObjectRelationReference {
  uri: string
  type: string
  name: string
  parentUri?: string
}

export interface ObjectRelationProperty {
  name: string
  value: string
}

export interface ObjectRelationLink {
  href: string
  rel: string
  type?: string
  title?: string
}

export interface ObjectRelationObject extends ObjectRelationReference {
  id: string
  displayName: string
  description?: string
  version?: string
  exists?: boolean
  canHaveComponents?: boolean
  properties: ObjectRelationProperty[]
  links: ObjectRelationLink[]
}

export interface ObjectRelation {
  id: string
  from: string
  to: string
  type: string
  state?: string
  direction?: string
  roleFrom?: string
  roleTo?: string
  properties: ObjectRelationProperty[]
}

export interface ObjectRelationContext {
  id: string
  description: string
  supportsComponents: boolean
  supportsGrouping: boolean
  supportsReferences: boolean
  isDefault: boolean
  relevance: number
}

export interface ObjectRelationNetwork {
  activeContext: string
  contexts: ObjectRelationContext[]
  objects: ObjectRelationObject[]
  relations: ObjectRelation[]
}

export interface ObjectRelationComponent extends ObjectRelationObject {
  parentId?: string
}

export interface ObjectRelationAnchor {
  uri: string
  program?: string
  include?: string
  matches?: string
  snippet?: string
}

export interface ObjectRelationReferences {
  numberOfResults: number
  from?: ObjectRelationObject
  to?: ObjectRelationObject
  anchors: ObjectRelationAnchor[]
}

export interface ObjectRelationSetResult {
  leftTitle?: string
  rightTitle?: string
  header?: string
  relations: ObjectRelation[]
}

type AnyRecord = Record<string, any>

// namespace prefixes are dropped, attributes keep a leading @
const parse = (body: string) =>
  fullParse(body, {
    attributeNamePrefix: "@",
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false
  })

const asArray = <T>(value: T | T[] | undefined | null): T[] =>
  value == null ? [] : Array.isArray(value) ? value : [value]

const text = (value: any): string => {
  if (value == null) return ""
  if (typeof value !== "object") return `${value}`
  return text(value["#text"] ?? value.value)
}

const attribute = (value: AnyRecord | undefined, name: string) =>
  text(value?.[`@${name}`]).trim()

const optional = (value: AnyRecord | undefined, name: string) =>
  attribute(value, name) || undefined

const flag = (value: AnyRecord | undefined, name: string) => {
  const raw = attribute(value, name)
  return raw ? raw === "true" || raw === "1" || raw === "X" : undefined
}

const numeric = (raw: string) => {
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

const parseProperties = (parent: AnyRecord): ObjectRelationProperty[] =>
  asArray(parent?.property).map(property => ({
    name: text(property?.name).trim(),
    value: text(property?.value).trim()
  }))

const parseLinks = (parent: AnyRecord): ObjectRelationLink[] =>
  asArray(parent?.link).map(link => ({
    href: attribute(link, "href"),
    rel: attribute(link, "rel"),
    type: optional(link, "type"),
    title: optional(link, "title")
  }))

const parseObject = (value: AnyRecord, index: number): ObjectRelationObject => {
  const uri = attribute(value, "uri")
  const name = attribute(value, "name") || text(value?.name).trim()
  const type = attribute(value, "type")
  return {
    id: uri || `${type}:${name}:${index}`,
    name,
    type,
    uri,
    parentUri: optional(value, "parentUri"),
    displayName: attribute(value, "displayName") || name,
    description: optional(value, "description"),
    version: optional(value, "version"),
    exists: flag(value, "exists"),
    canHaveComponents: flag(value, "canHaveComponents"),
    properties: parseProperties(value),
    links: parseLinks(value)
  }
}

/** relations name their ends by uri, name or display name */
const objectId = (value: string, objects: ObjectRelationObject[]) => {
  const key = value.trim()
  const found = objects.find(
    o => o.id === key || o.name === key || o.displayName === key
  )
  return found?.id || key
}

const parseRelation = (
  relation: AnyRecord,
  index: number,
  objects: ObjectRelationObject[]
): ObjectRelation => {
  const from = objectId(text(relation.object1), objects)
  const to = objectId(text(relation.object2), objects)
  return {
    id: `${from}->${to}:${index}`,
    from,
    to,
    type: attribute(relation, "relationType") || "relation",
    state: optional(relation, "state"),
    roleFrom: optional(relation.role1, "singular"),
    roleTo: optional(relation.role2, "singular"),
    properties: parseProperties(relation)
  }
}

const parseContext = (context: AnyRecord): ObjectRelationContext => ({
  id: attribute(context, "id"),
  description: attribute(context, "displayName") || "Unnamed context",
  supportsComponents: flag(context, "supportsComponents") ?? false,
  supportsGrouping: flag(context, "supportsGrouping") ?? false,
  supportsReferences: flag(context, "supportsReferences") ?? false,
  isDefault: flag(context, "isDefault") ?? false,
  relevance: numeric(attribute(context, "relevance"))
})

const parseNetwork = (body: string): ObjectRelationNetwork => {
  const root = parse(body)?.networkResponse || {}
  const objects = asArray(root.objectReference).map(parseObject)
  const relations = asArray(root.relation).map((relation, index) =>
    parseRelation(relation, index, objects)
  )
  const contexts = asArray(root.context).map(parseContext)
  return { activeContext: text(root.activeContext).trim(), contexts, objects, relations }
}

const parseComponents = (body: string): ObjectRelationComponent[] => {
  const root = parse(body)?.componentsResponse || {}
  return asArray(root.component).map((component, index) => {
    const object = parseObject(component, index)
    return {
      ...object,
      id: attribute(component, "id") || object.id,
      parentId: optional(component, "parent")
    }
  })
}

const parseAnchor = (anchor: AnyRecord): ObjectRelationAnchor => ({
  uri: attribute(anchor, "uri"),
  program: optional(anchor, "program"),
  include: optional(anchor, "include"),
  matches: optional(anchor, "matches"),
  snippet: optional(anchor, "snippet")
})

const parseReferences = (body: string): ObjectRelationReferences => {
  const root = parse(body)?.result || {}
  const numberOfResults = numeric(attribute(root, "numberOfResults"))
  const reference = asArray(root.reference)[0]
  if (!reference) return { numberOfResults, anchors: [] }
  return {
    numberOfResults,
    from: parseObject(reference.from, 0),
    to: parseObject(reference.to, 0),
    anchors: asArray(reference.anchor).map(parseAnchor)
  }
}

const parseRelationSet = (body: string): ObjectRelationSetResult => {
  const root = parse(body)?.RelationSetResult || {}
  const relations = asArray(root.relation).map((relation, index) => {
    const left = parseObject(relation.left, index)
    const right = parseObject(relation.right, index)
    return {
      id: `${left.id}->${right.id}:${index}`,
      from: left.id,
      to: right.id,
      type: "set relation",
      direction:
        attribute(relation.direction, "direction") ||
        text(relation.direction).trim(),
      properties: []
    }
  })
  return {
    leftTitle: optional(root, "leftTitle"),
    rightTitle: optional(root, "rightTitle"),
    header: optional(root, "header"),
    relations
  }
}

const escape = (value: string) => encodeEntity(value.trim())

const referenceAttributes = (object: ObjectRelationReference) =>
  (
    [
      ["adtcore:uri", object.uri],
      ["adtcore:type", object.type],
      ["adtcore:name", object.name],
      ["adtcore:parentUri", object.parentUri]
    ] as const
  )
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}="${escape(value!)}"`)
    .join(" ")

const networkBody = (
  object: ObjectRelationReference,
  preferredContext: string,
  desiredContexts: string[]
) => {
  const preferred = preferredContext
    ? `<oro:preferredContext>${escape(preferredContext)}</oro:preferredContext>`
    : ""
  const ids = desiredContexts.map(id => `<oro:contextId>${escape(id)}</oro:contextId>`)
  const desired = ids.length
    ? `<oro:desiredContexts>${ids.join("")}</oro:desiredContexts>`
    : ""
  return `<?xml version="1.0" encoding="UTF-8"?><oro:request xmlns:oro="${ORO_NS}" xmlns:adtcore="${ADTCORE_NS}"><oro:reference ${referenceAttributes(object)} />${preferred}${desired}</oro:request>`
}

const referencesBody = (
  from: ObjectRelationReference,
  to: ObjectRelationReference,
  context: string
) =>
  `<?xml version="1.0" encoding="UTF-8"?><oroRef:refRelation xmlns:oroRef="${ORO_REF_NS}" xmlns:adtcore="${ADTCORE_NS}" context="${escape(context)}"><oroRef:from ${referenceAttributes(from)} /><oroRef:to ${referenceAttributes(to)} /></oroRef:refRelation>`

// object sets use the transport type (PROG for PROG/P)
const flatObjectSet = (object: ObjectRelationReference) =>
  `<osl:objectSet xmlns:osl="${OSL_NS}" xmlns:xsi="${XSI_NS}" xsi:type="flatObjectSet"><osl:object name="${escape(object.name)}" type="${escape(object.type.split("/", 1)[0])}" /></osl:objectSet>`

const relationSetBody = (
  left: ObjectRelationReference,
  right: ObjectRelationReference
) =>
  `<?xml version="1.0" encoding="UTF-8"?><rel:RelationSetRequest xmlns:rel="${REL_NS}"><rel:left>${flatObjectSet(left)}</rel:left><rel:right>${flatObjectSet(right)}</rel:right></rel:RelationSetRequest>`

const post = async (
  h: AdtHTTP,
  path: string,
  body: string,
  contentType: string,
  accept: string
) => {
  const headers = { "Content-Type": contentType, Accept: accept }
  const response = await h.request(path, { method: "POST", headers, body })
  return `${response.body}`
}

/**
 * Objects related to the given one, and their relations
 * @param context preferred context, see ObjectRelationContexts
 * @param desiredContexts contexts SAP should report as available
 */
export async function objectRelationNetwork(
  h: AdtHTTP,
  object: ObjectRelationReference,
  context: string = ObjectRelationContexts.used,
  desiredContexts: string[] = [
    ObjectRelationContexts.used,
    ObjectRelationContexts.using
  ]
): Promise<ObjectRelationNetwork> {
  const body = networkBody(object, context, desiredContexts)
  const response = await post(h, NETWORK_PATH, body, REQUEST_TYPE, NETWORK_TYPE)
  return parseNetwork(response)
}

/** Components of the given object, for contexts that support them */
export async function objectRelationComponents(
  h: AdtHTTP,
  object: ObjectRelationReference,
  context: string = ObjectRelationContexts.used
): Promise<ObjectRelationComponent[]> {
  const body = networkBody(object, context, [])
  const response = await post(h, COMPONENTS_PATH, body, REQUEST_TYPE, COMPONENTS_TYPE)
  return parseComponents(response)
}

/** Source locations where one object refers to the other */
export async function objectRelationReferences(
  h: AdtHTTP,
  from: ObjectRelationReference,
  to: ObjectRelationReference,
  context: string = ObjectRelationContexts.used
): Promise<ObjectRelationReferences> {
  const body = referencesBody(from, to, context)
  const response = await post(
    h,
    REFERENCES_PATH,
    body,
    REFERENCES_REQUEST_TYPE,
    REFERENCES_TYPE
  )
  return parseReferences(response)
}

/** Relations between two objects, compared as object sets */
export async function objectRelationSets(
  h: AdtHTTP,
  left: ObjectRelationReference,
  right: ObjectRelationReference
): Promise<ObjectRelationSetResult> {
  const body = relationSetBody(left, right)
  const response = await post(h, RELATION_SETS_PATH, body, SETS_REQUEST_TYPE, SETS_TYPE)
  return parseRelationSet(response)
}
