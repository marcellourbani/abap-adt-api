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

export interface Logpoint {
  location: LogpointLocation
  summary: LogpointSummary
  definition: LogpointDefinition
  activation: LogpointActivation
  links: LogpointLink[]
}

export interface LogpointCreateDefinition {
  description?: string
  subKey?: string
  fields?: string
  condition?: string
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

const logpointBody = (logpoint: LogpointCreate) => {
  const { location, definition, activation } = logpoint
  return `<?xml version="1.0" encoding="ASCII"?>
<logpoints:logpoint xmlns:adtcore="http://www.sap.com/adt/core" xmlns:logpoints="http://www.sap.com/adt/categories/dynamiclogpoints">
  <location>
    ${logpointReferenceXml("includePosition", location.includePosition)}
    ${logpointReferenceXml("mainProgram", location.mainProgram)}
  </location>
  <definition${xmlAttributes(definition)} />
  <activation${xmlAttributes({
    state: activation.state,
    activatedBy: activation.activatedBy,
    activeSince: activation.activeSince,
    activeUntil: activation.activeUntil
  })}>
    <users>${activationEntriesXml("user", activation.users)}</users>
    <servers>${activationEntriesXml("server", activation.servers)}</servers>
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

export async function logpoints(h: AdtHTTP, user: string): Promise<Logpoint[]> {
  const response = await h.request("/sap/bc/adt/dlp/logpoints", {
    headers: {
      Accept: "application/vnd.sap.adt.dlp.logpointlistfull+xml"
    },
    qs: { user }
  })
  return parseLogpoints(response.body)
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
  return Array.isArray(location) ? location[0] : location?.toString()
}

export async function deleteLogpoint(h: AdtHTTP, location: string) {
  await h.request(location, {
    method: "DELETE",
    headers: {
      Accept: "application/xml"
      // SAP-specific value: application/vnd.sap.adt.dlp.logpoint+xml
    }
  })
}
