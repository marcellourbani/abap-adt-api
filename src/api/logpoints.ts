import { AdtHTTP } from "../AdtHTTP"
import { encodeEntity, fullParse, xmlArray, xmlNodeAttr } from "../utilities"

export interface LogpointCoreReference {
  uri: string
  type: string
  name: string
  parentUri?: string
}

export interface LogpointLocation {
  includePosition: LogpointCoreReference
  mainProgram: LogpointCoreReference
}

export interface LogpointSummary {
  shortInfo: string
  executions: number
  lastCall: string
  eTag: string
}

export interface LogpointDefinition {
  description?: string
  subKey: string
  fields?: string
  condition?: string
  rollareaCounter: number
  usageType: string
  changedBy: string
  createdBy: string
  changedAt: string
  expiresAt: string
}

export interface LogpointActivationUser {
  name: string
}

export interface LogpointActivationServer {
  name: string
}

export interface LogpointActivation {
  state: string
  activatedBy: string
  activeSince: string
  activeUntil: string
  users: LogpointActivationUser[]
  servers: LogpointActivationServer[]
}

export interface LogpointLink {
  href: string
  rel: string
}

export interface LogpointKey {
  value: string
  calls: number
  lastCall: string
  generatedAt: string
  links: LogpointLink[]
}

export interface LogpointLogValue {
  value: string
  links: LogpointLink[]
}

export interface LogpointLogField {
  kind: string
  name: string
  values: LogpointLogValue[]
}

export interface LogpointLogs {
  fields: LogpointLogField[]
}

export interface Logpoint {
  location: LogpointLocation
  summary: LogpointSummary
  definition: LogpointDefinition
  activation: LogpointActivation
  links: LogpointLink[]
}

export interface LogpointCreateDefinition {
  description?: string
  // Simple variable values: activityType "F", subKey contains the variable.
  subKey?: string
  // User-defined fields: provide the field expressions and use activityType "C".
  fields?: string
  condition?: string
  // Stack trace: activityType "T", subKey "STACK_HASH( )", fields "STACK( )".
  // SQL trace: activityType "S", subKey "SYSTEM_INFO( AppServName ) SQL_TRACE( StackOff )".
  // Use "StackOn" to include the call stack.
  // Table-buffer trace: activityType "B", subKey "SYSTEM_INFO( AppServName ) TABLEBUF_TRACE ( StackOff )".
  // Use "StackOn" instead of "StackOff" in TABLEBUF_TRACE to include the call stack.
  // For all servers, leave activation.servers empty.
  rollareaCounter?: number
  usageType?: string
  createdBy?: string
  changedBy?: string
  changedAt?: string
  expiresAt?: string
  activityType?: string
  retentionTimeInDays?: number
  [attribute: string]: string | number | undefined
}

export interface LogpointDefinitionCommon {
  description?: string
  condition?: string
  rollareaCounter?: number
  usageType?: string
  createdBy?: string
  changedBy?: string
  changedAt?: string
  expiresAt?: string
  retentionTimeInDays?: number
}

export type LogpointDefinitionInput = LogpointDefinitionCommon &
  (
    | { type: "SimpleVariable"; subKey: string }
    | { type: "StackTrace" }
    | { type: "SqlTrace"; stack?: "On" | "Off" }
    | { type: "TableBufferTrace"; stack?: "On" | "Off" }
    | { type: "UserDefined"; subKey: string; fields: string }
  )

export const createLogPointDefinition = (
  definition: LogpointDefinitionInput
): LogpointCreateDefinition => {
  const {
    type,
    condition,
    description,
    rollareaCounter,
    usageType,
    createdBy,
    changedBy,
    changedAt,
    expiresAt,
    retentionTimeInDays
  } = definition
  const common = {
    description,
    condition,
    rollareaCounter,
    usageType,
    createdBy,
    changedBy,
    changedAt,
    expiresAt,
    retentionTimeInDays
  }

  switch (type) {
    case "SimpleVariable":
      return { ...common, activityType: "F", subKey: definition.subKey }
    case "StackTrace":
      return {
        ...common,
        activityType: "T",
        subKey: "STACK_HASH( )",
        fields: "STACK( )"
      }
    case "SqlTrace":
      return {
        ...common,
        activityType: "S",
        subKey: `SYSTEM_INFO( AppServName ) SQL_TRACE( Stack${
          definition.stack || "Off"
        } )`,
        fields: ""
      }
    case "TableBufferTrace":
      return {
        ...common,
        activityType: "B",
        subKey: `SYSTEM_INFO( AppServName ) TABLEBUF_TRACE( Stack${
          definition.stack || "Off"
        } )`,
        fields: ""
      }
    case "UserDefined":
      return {
        ...common,
        activityType: "C",
        subKey: definition.subKey,
        fields: definition.fields
      }
  }
}

export interface LogpointCreateActivation {
  state?: string
  activatedBy?: string
  activeSince?: string
  activeUntil?: string
  users?: Array<LogpointActivationUser | string>
  servers?: Array<LogpointActivationServer | string>
}

export interface LogpointCreate {
  location: LogpointLocation
  definition: LogpointCreateDefinition
  activation: LogpointCreateActivation
}

const xmlAttributes = (attributes: Record<string, unknown>) =>
  Object.entries(attributes)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => ` ${name}="${encodeEntity(String(value))}"`)
    .join("")

const logpointReferenceXml = (name: string, reference: LogpointCoreReference) =>
  `<${name}${xmlAttributes({
    "adtcore:name": reference.name,
    "adtcore:parentUri": reference.parentUri,
    "adtcore:type": reference.type,
    "adtcore:uri": reference.uri
  })}/>`

const activationEntriesXml = (
  name: "user" | "server",
  entries: Array<
    LogpointActivationUser | LogpointActivationServer | string
  > = []
) =>
  entries
    .map(entry => {
      const value = typeof entry === "string" ? entry : entry.name
      return `<${name}${xmlAttributes({ name: value })}/>`
    })
    .join("")

// no servers element means all servers; an empty one activates none
const serversXml = (servers: LogpointCreateActivation["servers"] = []) =>
  servers.length
    ? `\n    <servers>${activationEntriesXml("server", servers)}</servers>`
    : ""

const definitionDefaults = {
  rollareaCounter: 100,
  usageType: "D",
  retentionTimeInDays: 7
}

// SAP rejects logpoints without an expiry; default to 24 hours from now
const defaultActiveUntil = () =>
  new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

const withDefinitionDefaults = (definition: LogpointCreateDefinition) => {
  const defined = Object.fromEntries(
    Object.entries(definition).filter(([, value]) => value !== undefined)
  )
  return { ...definitionDefaults, ...defined }
}

const logpointBody = (logpoint: LogpointCreate) => {
  const { location, definition, activation } = logpoint
  return `<?xml version="1.0" encoding="ASCII"?>
<logpoints:logpoint xmlns:adtcore="http://www.sap.com/adt/core" xmlns:logpoints="http://www.sap.com/adt/categories/dynamiclogpoints">
  <location>
    ${logpointReferenceXml("includePosition", location.includePosition)}
    ${logpointReferenceXml("mainProgram", location.mainProgram)}
  </location>
  <definition${xmlAttributes(withDefinitionDefaults(definition))} />
  <activation${xmlAttributes({
    state: activation.state,
    activatedBy: activation.activatedBy,
    activeSince: activation.activeSince,
    activeUntil: activation.activeUntil ?? defaultActiveUntil()
  })}>
    <users>${activationEntriesXml("user", activation.users)}</users>${serversXml(
      activation.servers
    )}
  </activation>
</logpoints:logpoint>`
}

const parseCoreReference = (node: any): LogpointCoreReference =>
  xmlNodeAttr(node)

const parseLogpoint = (node: any): Logpoint => {
  const location = node.location
  const activation = node.activation
  return {
    location: {
      includePosition: parseCoreReference(location.includePosition),
      mainProgram: parseCoreReference(location.mainProgram)
    },
    summary: xmlNodeAttr(node.summary),
    definition: xmlNodeAttr(node.definition),
    activation: {
      ...xmlNodeAttr(activation),
      users: xmlArray(activation, "users", "user").map(xmlNodeAttr),
      servers: xmlArray(activation, "servers", "server").map(xmlNodeAttr)
    },
    links: xmlArray(node, "link").map(xmlNodeAttr)
  }
}

const parseLogpoints = (body: string): Logpoint[] => {
  const raw = fullParse(body, { removeNSPrefix: true })
  return xmlArray(raw, "logpointList", "logpoint").map(parseLogpoint)
}

const logpointsPath = "/sap/bc/adt/dlp/logpoints/"

// SAP ids can contain a literal "%" (e.g. "%_2ZC...") which isn't valid escaping
const safeDecode = (id: string) => {
  try {
    return decodeURIComponent(id)
  } catch {
    return id
  }
}

const normalizeLogpointLocation = (location: string) => {
  const id = location.startsWith(logpointsPath)
    ? location.slice(logpointsPath.length)
    : location
  return safeDecode(id)
}

const encodeLogpointId = (location: string) =>
  normalizeLogpointLocation(location)
    .split("/")
    .map(encodeURIComponent)
    .join("/")

const parseLogpointValues = (field: any): LogpointLogValue[] =>
  xmlArray(field, "value").flatMap((value: any) => {
    if (value.e) return [{ value: xmlNodeAttr(value.e).v, links: [] }]

    return xmlArray(value, "t", "c").map((cell: any) => ({
      value: xmlNodeAttr(cell.e).v,
      links: xmlArray(cell, "link").map(xmlNodeAttr)
    }))
  })

export async function logpoints(h: AdtHTTP, user: string): Promise<Logpoint[]> {
  const response = await h.request("/sap/bc/adt/dlp/logpoints", {
    headers: {
      Accept: "application/vnd.sap.adt.dlp.logpointlistfull+xml"
    },
    qs: { user }
  })
  return parseLogpoints(response.body)
}

export async function getLogServers(h: AdtHTTP): Promise<string[]> {
  const response = await h.request("/sap/bc/adt/dlp/logs/servers", {
    method: "POST",
    headers: {
      Accept: "application/xml"
      // SAP-specific value: application/vnd.sap.adt.dlp.logservers+xml
    }
  })
  const raw = fullParse(response.body, { removeNSPrefix: true })
  return xmlArray(raw, "collectionSummary", "success", "server").map(
    server => xmlNodeAttr(server).name
  )
}

export async function getLogKeys(
  h: AdtHTTP,
  location: string,
  maxCount = 500
): Promise<LogpointKey[]> {
  const response = await h.request(
    `${logpointsPath}${encodeLogpointId(location)}/logs/keys`,
    {
      headers: {
        Accept: "application/xml"
        // SAP-specific value: application/vnd.sap.adt.dlp.logkeys+xml
      },
      qs: { maxCount }
    }
  )
  const raw = fullParse(response.body, { removeNSPrefix: true })
  return xmlArray(raw, "logKeys", "progVersion").flatMap((version: any) =>
    xmlArray(version, "key").map((key: any) => ({
      ...xmlNodeAttr(key),
      generatedAt: xmlNodeAttr(version).generatedAt,
      links: xmlArray(key, "link").map(xmlNodeAttr)
    }))
  )
}

export async function getLogPointLogs(
  h: AdtHTTP,
  location: string,
  key: LogpointKey
): Promise<LogpointLogs> {
  const logFieldsLink = key.links.find(link =>
    link.rel.includes("/dlp/logfields")
  )
  if (!logFieldsLink) throw new Error("Logpoint key has no log fields link")

  const response = await h.request(
    `${logpointsPath}${encodeLogpointId(location)}${logFieldsLink.href}`,
    {
      headers: {
        Accept: "application/xml"
        // SAP-specific value: application/vnd.sap.adt.dlp.logfields+xml
      }
    }
  )
  const raw = fullParse(response.body, { removeNSPrefix: true })
  const fields = xmlArray(raw, "logEntry", "fieldList", "field").map(
    (field: any) => ({
      ...xmlNodeAttr(field),
      values: parseLogpointValues(field)
    })
  )
  return { fields }
}

export async function createLogpoint(
  h: AdtHTTP,
  logpoint: LogpointCreate
): Promise<string | undefined> {
  const response = await h.request("/sap/bc/adt/dlp/logpoints", {
    method: "POST",
    headers: {
      "Content-Type": "application/xml",
      Accept: "application/xml"
      // SAP-specific values: application/vnd.sap.adt.dlp.logpoint+xml
    },
    body: logpointBody(logpoint)
  })
  const location = response.headers.location || response.headers.Location
  const value = Array.isArray(location) ? location[0] : location?.toString()
  return value ? normalizeLogpointLocation(value) : undefined
}

export async function deleteLogpoint(h: AdtHTTP, location: string) {
  await h.request(`${logpointsPath}${encodeLogpointId(location)}`, {
    method: "DELETE",
    headers: {
      Accept: "application/xml"
      // SAP-specific value: application/vnd.sap.adt.dlp.logpoint+xml
    }
  })
}
