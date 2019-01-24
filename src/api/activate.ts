import { parse } from "fast-xml-parser"
import { ValidateObjectUrl } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import { xmlArray, xmlNodeAttr } from "../utilities"

interface ActivationResultMessage {
  objDescr: string
  type: string
  line: number
  href: string
  forceSupported: boolean
}
export interface ActivationResult {
  success: boolean
  messages: ActivationResultMessage[]
}

export interface MainInclude {
  "adtcore:uri": string
  "adtcore:type": string
  "adtcore:name": string
}

export async function activate(
  h: AdtHTTP,
  objectName: string,
  objectUrl: string,
  mainInclude?: string
): Promise<ActivationResult> {
  ValidateObjectUrl(objectUrl)
  const params = { method: "activate", preauditRequested: true }
  const incl = mainInclude ? `?context=${encodeURIComponent(mainInclude)}` : ""
  const data =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">` +
    `<adtcore:objectReference adtcore:uri="${objectUrl}${incl}" adtcore:name="${objectName}"/>` +
    `</adtcore:objectReferences>`
  const response = await h.request("/sap/bc/adt/activation", {
    data,
    method: "POST",
    params
  })
  let messages: ActivationResultMessage[] = []
  let success = true
  if (response.data) {
    const raw = parse(response.data, {
      ignoreAttributes: false,
      parseAttributeValue: true
    })
    messages = xmlArray(raw["chkl:messages"], "msg").map(xmlNodeAttr)
    messages.some(m => {
      if (m.type.match(/[EAX]/)) success = false
      return !success
    })
  }
  return { messages, success }
}

export async function getMainPrograms(h: AdtHTTP, IncludeUrl: string) {
  ValidateObjectUrl(IncludeUrl)
  const response = await h.request(`${IncludeUrl}/mainprograms`)
  const parsed = parse(response.data, {
    ignoreAttributes: false,
    parseAttributeValue: true
  })
  const includes = xmlArray(
    parsed["adtcore:objectReferences"],
    "adtcore:objectReference"
  ).map(xmlNodeAttr)
  return includes as MainInclude[]
}
