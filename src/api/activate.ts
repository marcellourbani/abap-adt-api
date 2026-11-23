import { adtException, ValidateObjectUrl } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import {
  encodeEntity,
  fullParse,
  isArray,
  isString,
  xmlArray,
  xmlNode,
  xmlNodeAttr
} from "../utilities"

export interface InactiveObject {
  "adtcore:uri": string
  "adtcore:type": string
  "adtcore:name": string
  "adtcore:parentUri": string
}
export interface InactiveObjectElement extends InactiveObject {
  user: string
  deleted: boolean
  "adtcore:description"?: string
}
export interface InactiveObjectRecord {
  object?: InactiveObjectElement
  transport?: InactiveObjectElement
}

export interface ActivationResultMessage {
  objDescr: string
  type: string
  line: number
  href: string
  forceSupported: boolean
  shortText: string
}
export interface ActivationResult {
  success: boolean
  messages: ActivationResultMessage[]
  inactive: InactiveObjectRecord[]
}

export interface MainInclude {
  "adtcore:uri": string
  "adtcore:type": string
  "adtcore:name": string
}

function toElement(source: any) {
  if (!source || !source["ioc:ref"]) return undefined
  return {
    deleted: source["@_ioc:deleted"],
    user: source["@_ioc:user"],
    ...xmlNodeAttr(source["ioc:ref"])
  } as InactiveObjectElement
}

/** Empty attributes are left out: SAP doesn't expect an empty parentUri */
function objectReference(attributes: Record<string, string | undefined>) {
  const values = Object.entries(attributes)
    .filter(([, value]) => value)
    .map(([key, value]) => `adtcore:${key}="${encodeEntity(`${value}`)}"`)
  return `<adtcore:objectReference ${values.join(" ")}/>`
}

const textOf = (value: any): string => {
  if (isString(value) || typeof value === "number") return `${value}`
  if (isArray(value)) return value.map(textOf).filter(Boolean).join(" ")
  return value ? textOf(value.txt ?? value["#text"]) : ""
}

/** Attributes can come with or without the chkl namespace prefix */
function activationMessage(m: any): ActivationResultMessage {
  const attributes = xmlNodeAttr(m) || {}
  const get = (name: string) => attributes[name] ?? attributes[`chkl:${name}`]
  return {
    ...attributes,
    objDescr: `${get("objDescr") ?? ""}`,
    type: `${get("type") ?? ""}`,
    line: Number(get("line")) || 0,
    href: `${get("href") ?? ""}`,
    forceSupported: `${get("forceSupported")}` === "true",
    shortText:
      textOf(m.shortText) || `${get("shortText") ?? ""}` || "Syntax error"
  }
}

/** Some systems list inactive objects as plain adtcore:objectReferences */
function referenceElement(reference: any): InactiveObjectElement | undefined {
  const attributes = xmlNodeAttr(reference) || {}
  const [uri, type, name] = ["uri", "type", "name"].map(
    key => attributes[`adtcore:${key}`]
  )
  if (!uri || !type || !name) return undefined
  const parentUri = attributes["adtcore:parentUri"]
  return {
    "adtcore:uri": `${uri}`,
    "adtcore:type": `${type}`,
    "adtcore:name": `${name}`,
    "adtcore:parentUri": parentUri ? `${parentUri}` : "",
    user: "",
    deleted: false
  }
}

function parseInactive(raw: any): InactiveObjectRecord[] {
  if (raw?.["adtcore:objectReferences"])
    return xmlArray(raw, "adtcore:objectReferences", "adtcore:objectReference")
      .map(referenceElement)
      .filter(object => !!object)
      .map(object => ({ object }))
  return xmlArray(raw, "ioc:inactiveObjects", "ioc:entry").map((obj: any) => {
    return {
      object: toElement(xmlNode(obj, "ioc:object")),
      transport: toElement(xmlNode(obj, "ioc:transport"))
    }
  })
}

export async function activate(
  h: AdtHTTP,
  object: InactiveObject | InactiveObject[],
  preauditRequested?: boolean
): Promise<ActivationResult>
export async function activate(
  h: AdtHTTP,
  objectName: string,
  objectUrl: string,
  mainInclude?: string,
  preauditRequested?: boolean
): Promise<ActivationResult>
export async function activate(
  h: AdtHTTP,
  objectNameOrObjects: string | InactiveObject | InactiveObject[],
  objectUrlOrPreauditReq: string | boolean = true,
  mainInclude?: string,
  preauditRequested = true
) {
  let objects: string[] = []
  let incl = ""
  if (isString(objectNameOrObjects)) {
    if (!isString(objectUrlOrPreauditReq))
      throw adtException("Invalid parameters, objectUrl should be  a string")
    ValidateObjectUrl(objectUrlOrPreauditReq || "")

    if (mainInclude) incl = `?context=${encodeURIComponent(mainInclude)}`
    objects.push(
      objectReference({
        uri: `${objectUrlOrPreauditReq}${incl}`,
        name: objectNameOrObjects
      })
    )
  } else {
    let inactives: InactiveObject[]
    if (isString(objectUrlOrPreauditReq))
      throw adtException(
        "Invalid parameters, preauditRequested should be a boolean"
      )
    preauditRequested = objectUrlOrPreauditReq
    if (isArray(objectNameOrObjects)) {
      inactives = objectNameOrObjects
    } else inactives = [objectNameOrObjects]
    inactives.forEach(i => ValidateObjectUrl(i["adtcore:uri"]))
    objects = inactives.map(i =>
      objectReference({
        uri: i["adtcore:uri"],
        type: i["adtcore:type"],
        parentUri: i["adtcore:parentUri"],
        name: i["adtcore:name"]
      })
    )
  }
  const qs = { method: "activate", preauditRequested }

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">` +
    objects.join(`\n`) +
    `</adtcore:objectReferences>`
  const response = await h.request("/sap/bc/adt/activation", {
    body,
    method: "POST",
    qs
  })
  let messages: ActivationResultMessage[] = []
  let success = true
  let inactive: InactiveObjectRecord[] = []
  if (response.body) {
    const raw = fullParse(response.body)
    inactive = parseInactive(raw)
    messages = xmlArray(raw, "chkl:messages", "msg").map(activationMessage)
    if (inactive.length > 0) success = false
    else success = !messages.some(m => /[EAX]/.test(m.type))
  }
  return { messages, success, inactive } as ActivationResult
}

export async function mainPrograms(h: AdtHTTP, IncludeUrl: string) {
  ValidateObjectUrl(IncludeUrl)
  const response = await h.request(`${IncludeUrl}/mainprograms`)
  const parsed = fullParse(response.body)
  const includes = xmlArray(
    parsed["adtcore:objectReferences"],
    "adtcore:objectReference"
  ).map(xmlNodeAttr)
  return includes as MainInclude[]
}

export function inactiveObjectsInResults(
  results: ActivationResult
): InactiveObject[] {
  const obj = results.inactive.filter(x => x.object).map(x => x.object)
  return obj.map(o => {
    const { user, deleted, ...rest } = o!
    return rest
  })
}

export async function inactiveObjects(h: AdtHTTP, Accept?: string) {
  Accept =
    Accept ||
    "application/vnd.sap.adt.inactivectsobjects.v1+xml, application/xml;q=0.8"
  const headers = { Accept }

  const response = await h.request("/sap/bc/adt/activation/inactiveobjects", {
    headers
  })

  return parseInactive(fullParse(response.body))
}
