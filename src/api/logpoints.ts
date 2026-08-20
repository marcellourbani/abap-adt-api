import { AdtHTTP } from "../AdtHTTP"
import { fullParse, xmlArray, xmlNodeAttr } from "../utilities"

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
