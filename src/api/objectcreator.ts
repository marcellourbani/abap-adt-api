import { sprintf } from "sprintf-js"
import { adtException } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import { fullParse, xmlArray, xmlNodeAttr } from "../utilities"
interface CreatableType {
  validationPath: string
  creationPath: string
  rootName: string
  nameSpace: string
  label: string
}
type GroupTypeIds = "FUGR/FF" | "FUGR/I"
export type NonGroupTypeIds =
  | "CLAS/OC"
  | "FUGR/F"
  | "INTF/OI"
  | "PROG/I"
  | "PROG/P"
export type CreatableTypeIds = GroupTypeIds | NonGroupTypeIds

export const CreatableTypes: Map<CreatableTypeIds, CreatableType> = new Map([
  [
    "PROG/P",
    {
      creationPath: "programs/programs",
      label: "Program",
      nameSpace: 'xmlns:program="http://www.sap.com/adt/programs/programs"',
      rootName: "program:abapProgram",
      validationPath: "programs/validation"
    }
  ],
  [
    "CLAS/OC",
    {
      creationPath: "oo/classes",
      label: "Class",
      nameSpace: 'xmlns:class="http://www.sap.com/adt/oo/classes"',
      rootName: "class:abapClass",
      validationPath: "oo/validation/objectname"
    }
  ],
  [
    "INTF/OI",
    {
      creationPath: "oo/interfaces",
      label: "Interface",
      nameSpace: 'xmlns:intf="http://www.sap.com/adt/oo/interfaces',
      rootName: "intf:abapInterface",
      validationPath: "oo/validation/objectname"
    }
  ],
  [
    "PROG/I",
    {
      creationPath: "programs/includes",
      label: "Include",
      nameSpace: 'xmlns:include="http://www.sap.com/adt/programs/includes"',
      rootName: "include:abapInclude",
      validationPath: "includes/validation"
    }
  ],
  [
    "FUGR/F",
    {
      creationPath: "functions/groups",
      label: "Function Group",
      nameSpace: 'xmlns:group="http://www.sap.com/adt/functions/groups"',
      rootName: "group:abapFunctionGroup",
      validationPath: "functions/validation"
    }
  ],
  [
    "FUGR/FF",
    {
      creationPath: "functions/groups/%s/fmodules",
      label: "Function module",
      nameSpace: 'xmlns:fmodule="http://www.sap.com/adt/functions/fmodules"',
      rootName: "fmodule:abapFunctionModule",
      validationPath: "functions/validation"
    }
  ],
  [
    "FUGR/I",
    {
      creationPath: "functions/groups/%s/includes",
      label: "Function group include",
      nameSpace: 'xmlns:finclude="http://www.sap.com/adt/functions/fincludes"',
      rootName: "finclude:abapFunctionGroupInclude",
      validationPath: "functions/validation"
    }
  ]
]) as Map<CreatableTypeIds, CreatableType>

interface ObjectValidateOptions {
  objtype: NonGroupTypeIds
  objname: string
  packagename: string
  description: string
}
interface GroupValidateOptions {
  objtype: GroupTypeIds
  objname: string
  fugrname: string
  description: string
}
export type ValidateOptions = ObjectValidateOptions | GroupValidateOptions
export interface NewObjectOptions {
  objtype: CreatableTypeIds
  name: string
  parentName: string
  description: string
  // devclass: string
  parentPath: string
  responsible?: string
  transport?: string
}
export interface ObjectType {
  CAPABILITIES: string
  CATEGORY: string
  CATEGORY_LABEL: string
  OBJECT_TYPE: string
  OBJECT_TYPE_LABEL: string
  OBJNAME_MAXLENGTH: number
  PARENT_OBJECT_TYPE: string
  URI_TEMPLATE: string
}
function createBody(options: NewObjectOptions, type: CreatableType) {
  const responsible = options.responsible
    ? `adtcore:responsible="${options.responsible}"`
    : ""
  if (options.objtype === "FUGR/FF" || options.objtype === "FUGR/I") {
    return `<?xml version="1.0" encoding="UTF-8"?>
    <${type.rootName} ${type.nameSpace}
       xmlns:adtcore="http://www.sap.com/adt/core"
       adtcore:description="${options.description}"
       adtcore:name="${options.name}" adtcore:type="${options.objtype}"
       ${responsible}>
         <adtcore:containerRef adtcore:name="${options.parentName}"
           adtcore:type="FUGR/F"
           adtcore:uri="${options.parentPath}"/>
    </${type.rootName}>`
  } else {
    return `<?xml version="1.0" encoding="UTF-8"?>
    <${type.rootName} ${type.nameSpace}
      xmlns:adtcore="http://www.sap.com/adt/core"
      adtcore:description="${options.description}"
      adtcore:name="${options.name}" adtcore:type="${options.objtype}"
      ${responsible}>
      <adtcore:packageRef adtcore:name="${options.parentName}"/>
    </${type.rootName}>`
  }
}

export async function loadTypes(h: AdtHTTP) {
  const response = await h.request("/sap/bc/adt/repository/typestructure", {
    method: "POST"
  })
  const raw = fullParse(response.data)
  return xmlArray(
    raw,
    "asx:abap",
    "asx:values",
    "DATA",
    "SEU_ADT_OBJECT_TYPE_DESCRIPTOR"
  ) as ObjectType[]
}

export async function validateNewObject(h: AdtHTTP, options: ValidateOptions) {
  const ot = CreatableTypes.get(options.objtype)
  if (!ot) throw adtException("Unsupported object type")
  const response = await h.request("/sap/bc/adt/" + ot.validationPath, {
    method: "POST",
    params: options
  })
  const raw = fullParse(response.data)
  const record = xmlArray(raw, "asx:abap", "asx:values", "DATA") as any[]
  return !!(record[0] && record[0].CHECK_RESULT === "X")
}

export async function createObject(h: AdtHTTP, options: NewObjectOptions) {
  const ot = CreatableTypes.get(options.objtype)
  if (!ot) throw adtException("Unsupported object type")
  const url = "/sap/bc/adt/" + sprintf(ot.creationPath, options.parentName)
  const data = createBody(options, ot)
  const params: any = {}
  if (options.transport) params.corrNr = options.transport

  // will raise exceptions on failure
  await h.request(url, {
    data,
    headers: { "Content-Type": "application/*" },
    method: "POST",
    params
  })
}
