import { sprintf } from "sprintf-js"
import { adtException } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import { fullParse, xmlArray, xmlNodeAttr } from "../utilities"
interface CreatableType {
  validationPath: string
  creationPath: string
  rootName: string
  nameSpace: string
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
      nameSpace: 'xmlns:program="http://www.sap.com/adt/programs/programs"',
      rootName: "program:abapProgram",
      validationPath: "programs/validation"
    }
  ],
  [
    "CLAS/OC",
    {
      creationPath: "oo/classes",
      nameSpace: 'xmlns:class="http://www.sap.com/adt/oo/classes"',
      rootName: "class:abapClass",
      validationPath: "oo/validation/objectname"
    }
  ],
  [
    "INTF/OI",
    {
      creationPath: "oo/interfaces",
      nameSpace: 'xmlns:intf="http://www.sap.com/adt/oo/interfaces',
      rootName: "intf:abapInterface",
      validationPath: "oo/validation/objectname"
    }
  ],
  [
    "PROG/I",
    {
      creationPath: "programs/includes",
      nameSpace: 'xmlns:include="http://www.sap.com/adt/programs/includes"',
      rootName: "include:abapInclude",
      validationPath: "includes/validation"
    }
  ],
  [
    "FUGR/F",
    {
      creationPath: "/sap/bc/adt/functions/groups",
      nameSpace: 'xmlns:group="http://www.sap.com/adt/functions/groups"',
      rootName: "group:abapFunctionGroup",
      validationPath: "functions/validation"
    }
  ],
  [
    "FUGR/FF",
    {
      creationPath: "functions/groups/%s/fmodules",
      nameSpace: 'xmlns:fmodule="http://www.sap.com/adt/functions/fmodules"',
      rootName: "fmodule:abapFunctionModule",
      validationPath: "functions/validation"
    }
  ],
  [
    "FUGR/I",
    {
      creationPath: "functions/groups/%s/includes",
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
  devclass: string
  parentPath: string
  responsible?: string
  transport?: string
}

function createBody(options: NewObjectOptions, type: CreatableType) {
  if (options.objtype === "FUGR/FF" || options.objtype === "FUGR/I") {
    return `<?xml version="1.0" encoding="UTF-8"?>
    <${type.rootName} ${type.nameSpace}
       xmlns:adtcore="http://www.sap.com/adt/core"
       adtcore:description="${options.description}"
       adtcore:name="${options.name}" adtcore:type="${options.objtype}"
       adtcore:responsible="${options.responsible}">
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
      adtcore:responsible="${options.responsible}">
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
  ).map(xmlNodeAttr)
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
  const url = "/sap/bc/adt/" + sprintf("/sap/bc/adt/", options.parentName)
  const data = createBody(options, ot)
  const params: any = {}
  if (options.transport) params.corrNr = options.transport

  const response = await h.request(url, {
    data,
    method: "POST",
    params
  })
  const raw = fullParse(response.data)
  // const record = xmlArray(raw, "asx:abap", "asx:values", "DATA") as any[]
  // return !!(record[0] && record[0].CHECK_RESULT === "X")
  return raw
}
