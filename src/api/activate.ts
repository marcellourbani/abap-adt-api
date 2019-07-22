import { isArray, isString } from "util"
import { ValidateObjectUrl } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import { fullParse, xmlArray, xmlNodeAttr } from "../utilities"
import { MainInclude } from "./activate"

export interface InactiveObject {
  "adtcore:uri": string
  "adtcore:type": string
  "adtcore:name": string
  "adtcore:parentUri": string
}
export interface InactiveObjectElement extends InactiveObject {
  user: string
  deleted: boolean
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

export async function activate(
  h: AdtHTTP,
  object: InactiveObject | InactiveObject[]
): Promise<ActivationResult>
export async function activate(
  h: AdtHTTP,
  objectName: string,
  objectUrl: string,
  mainInclude?: string
): Promise<ActivationResult>
export async function activate(
  h: AdtHTTP,
  objectName: string | InactiveObject | InactiveObject[],
  objectUrl?: string,
  mainInclude?: string
) {
  let objects: string[] = []
  let incl = ""
  if (isString(objectName)) {
    ValidateObjectUrl(objectUrl || "")
    if (mainInclude) incl = `?context=${encodeURIComponent(mainInclude)}`
    objects.push(
      `<adtcore:objectReference adtcore:uri="${objectUrl}${incl}" adtcore:name="${objectName}"/>`
    )
  } else {
    let inactives: InactiveObject[]
    if (isArray(objectName)) {
      inactives = objectName
    } else inactives = [objectName]
    inactives.forEach(i => ValidateObjectUrl(i["adtcore:uri"]))
    objects = inactives.map(
      i =>
        `<adtcore:objectReference adtcore:uri="${
          i["adtcore:uri"]
        }" adtcore:type="${i["adtcore:type"]}" adtcore:parentUri="${
          i["adtcore:parentUri"]
        }" adtcore:name="${i["adtcore:name"]}"/>`
    )
  }
  const qs = { method: "activate", preauditRequested: true }

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
    inactive = xmlArray(raw, "ioc:inactiveObjects", "ioc:entry").map(
      (obj: any) => {
        return {
          object: toElement(obj["ioc:object"]),
          transport: toElement(obj["ioc:transport"])
        }
      }
    )
    messages = xmlArray(raw, "chkl:messages", "msg").map((m: any) => {
      const message = xmlNodeAttr(m)
      message.shortText = (m.shortText && m.shortText.txt) || "Syntax error"
      return message
    }) as ActivationResultMessage[]
    if (inactive.length > 0) success = false
    else
      messages.some(m => {
        if (m.type.match(/[EAX]/)) success = false
        return !success
      })
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
