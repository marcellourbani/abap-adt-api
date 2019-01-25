import { parse } from "fast-xml-parser"
import { adtException } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import { xmlArray, xmlNodeAttr } from "../utilities"
interface CreatableType {
  validationPath: string
}

export type CreatableTypeIds =
  | "PROG/P"
  | "CLAS/OC"
  | "INTF/OI"
  | "FUGR/F"
  | "FUGR/FF"
  | "PROG/I"
  | "FUGR/I"

export const CreatableTypes: Map<CreatableTypeIds, CreatableType> = new Map([
  ["PROG/P", { validationPath: "programs/validation" }],
  ["CLAS/OC", { validationPath: "oo/validation/objectname" }],
  ["INTF/OI", { validationPath: "oo/validation/objectname" }],
  ["FUGR/F", { validationPath: "functions/validation" }],
  ["FUGR/FF", { validationPath: "functions/validation" }],
  ["PROG/I", { validationPath: "includes/validation" }],
  ["FUGR/I", { validationPath: "functions/validation" }]
]) as Map<CreatableTypeIds, CreatableType>

interface ObjectValidateOptions {
  objtype: CreatableTypeIds
  objname: string
  packagename: string
  description: string
}
interface GroupValidateOptions {
  objtype: CreatableTypeIds
  objname: string
  fugrname: string
  description: string
}
export type ValidateOptions = ObjectValidateOptions | GroupValidateOptions

export async function loadTypes(h: AdtHTTP) {
  const response = await h.request("/sap/bc/adt/repository/typestructure", {
    method: "POST"
  })
  const raw = parse(response.data, {
    ignoreAttributes: false,
    parseAttributeValue: true
  })
  return xmlArray(
    raw,
    "asx:abap",
    "asx:values",
    "DATA",
    "SEU_ADT_OBJECT_TYPE_DESCRIPTOR"
  ).map(xmlNodeAttr)
}
export async function validate(h: AdtHTTP, options: ValidateOptions) {
  const ot = CreatableTypes.get(options.objtype)
  if (!ot) throw adtException("Unsupported object type")
  const response = await h.request("/sap/bc/adt/" + ot.validationPath, {
    method: "POST",
    params: options
  })
  const raw = parse(response.data, {
    ignoreAttributes: false,
    parseAttributeValue: true
  })
  const record = xmlArray(raw, "asx:abap", "asx:values", "DATA") as any[]
  return !!(record[0] && record[0].CHECK_RESULT === "X")
}
