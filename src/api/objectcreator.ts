import { sprintf } from "sprintf-js"
import { isString } from "util"
import { adtException } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import { fullParse, xmlArray } from "../utilities"

export interface CreatableType {
  validationPath: string
  creationPath: string
  rootName: string
  nameSpace: string
  label: string
  typeId: CreatableTypeIds
}
export type GroupTypeIds = "FUGR/FF" | "FUGR/I"
export type NonGroupTypeIds =
  | "CLAS/OC"
  | "FUGR/F"
  | "INTF/OI"
  | "PROG/I"
  | "PROG/P"
  | "DCLS/DL"
  | "DDLS/DF"
  | "DDLX/EX"
  | "DDLA/ADF"

export type ParentTypeIds = "DEVC/K" | "FUGR/F"

export type CreatableTypeIds = GroupTypeIds | NonGroupTypeIds

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
  CAPABILITIES: string[]
  CATEGORY: string
  CATEGORY_LABEL: string
  OBJECT_TYPE: string
  OBJECT_TYPE_LABEL: string
  OBJNAME_MAXLENGTH: number
  PARENT_OBJECT_TYPE: string
  URI_TEMPLATE: string
}
export interface ValidationResult {
  success: boolean
  SEVERITY?: string
  SHORT_TEXT?: string
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
  const raw = fullParse(response.body)
  return xmlArray(
    raw,
    "asx:abap",
    "asx:values",
    "DATA",
    "SEU_ADT_OBJECT_TYPE_DESCRIPTOR"
  ).map((x: any) => {
    return { ...x, CAPABILITIES: xmlArray(x, "CAPABILITIES", "SEU_ACTION") }
  }) as ObjectType[]
}

export function objectPath(objOptions: NewObjectOptions): string
export function objectPath(typeId: "DEVC/K", name: string): string
export function objectPath(
  typeId: CreatableTypeIds | "DEVC/K",
  name: string,
  parentName: string
): string
export function objectPath(
  typeIdOrObjectOptions: CreatableTypeIds | "DEVC/K" | NewObjectOptions,
  name?: string,
  parentName?: string
): string {
  if (!isString(typeIdOrObjectOptions))
    return objectPath(
      typeIdOrObjectOptions.objtype,
      typeIdOrObjectOptions.name,
      typeIdOrObjectOptions.parentName
    )
  const encodedname = encodeURIComponent(name || "")
  if (typeIdOrObjectOptions === "DEVC/K")
    return `/sap/bc/adt/packages/${encodedname}`
  const ot = CreatableTypes.get(typeIdOrObjectOptions)
  if (!ot) return ""
  return (
    "/sap/bc/adt/" +
    sprintf(ot.creationPath, encodeURIComponent(parentName || "")) +
    "/" +
    encodedname
  )
}

export async function validateNewObject(h: AdtHTTP, options: ValidateOptions) {
  const ot = CreatableTypes.get(options.objtype)
  if (!ot) throw adtException("Unsupported object type")
  const response = await h.request("/sap/bc/adt/" + ot.validationPath, {
    method: "POST",
    qs: options
  })
  const raw = fullParse(response.body)
  const results = xmlArray(raw, "asx:abap", "asx:values", "DATA") as any[]
  const record = (results && results[0]) || {}

  const { SEVERITY, SHORT_TEXT, CHECK_RESULT } = record

  if (SEVERITY === "ERROR") throw adtException(record.SHORT_TEXT)

  return {
    SEVERITY,
    SHORT_TEXT,
    success: !!CHECK_RESULT || !!SEVERITY
  } as ValidationResult
}

export async function createObject(h: AdtHTTP, options: NewObjectOptions) {
  const ot = CreatableTypes.get(options.objtype)
  if (!ot) throw adtException("Unsupported object type")
  const url = "/sap/bc/adt/" + sprintf(ot.creationPath, options.parentName)
  const body = createBody(options, ot)
  const qs: any = {}
  if (options.transport) qs.corrNr = options.transport

  // will raise exceptions on failure
  await h.request(url, {
    body,
    headers: { "Content-Type": "application/*" },
    method: "POST",
    qs
  })
}

export function isGroupType(type: any): type is GroupTypeIds {
  return type === "FUGR/FF" || type === "FUGR/I"
}

export const CreatableTypes: Map<CreatableTypeIds, CreatableType> = new Map()

export function isNonGroupType(type: any): type is NonGroupTypeIds {
  return CreatableTypes.has(type) && !isGroupType(type)
}

export function isCreatableTypeId(type: any): type is CreatableTypeIds {
  return isGroupType(type) || isNonGroupType(type)
}

export function parentTypeId(type: CreatableTypeIds): ParentTypeIds {
  return isGroupType(type) ? "FUGR/F" : "DEVC/K"
}

const ctypes: CreatableType[] = [
  {
    creationPath: "programs/programs",
    label: "Program",
    nameSpace: 'xmlns:program="http://www.sap.com/adt/programs/programs"',
    rootName: "program:abapProgram",
    typeId: "PROG/P",
    validationPath: "programs/validation"
  },
  {
    creationPath: "oo/classes",
    label: "Class",
    nameSpace: 'xmlns:class="http://www.sap.com/adt/oo/classes"',
    rootName: "class:abapClass",
    typeId: "CLAS/OC",
    validationPath: "oo/validation/objectname"
  },
  {
    creationPath: "oo/interfaces",
    label: "Interface",
    nameSpace: 'xmlns:intf="http://www.sap.com/adt/oo/interfaces"',
    rootName: "intf:abapInterface",
    typeId: "INTF/OI",
    validationPath: "oo/validation/objectname"
  },
  {
    creationPath: "programs/includes",
    label: "Include",
    nameSpace: 'xmlns:include="http://www.sap.com/adt/programs/includes"',
    rootName: "include:abapInclude",
    typeId: "PROG/I",
    validationPath: "includes/validation"
  },
  {
    creationPath: "functions/groups",
    label: "Function Group",
    nameSpace: 'xmlns:group="http://www.sap.com/adt/functions/groups"',
    rootName: "group:abapFunctionGroup",
    typeId: "FUGR/F",
    validationPath: "functions/validation"
  },
  {
    creationPath: "functions/groups/%s/fmodules",
    label: "Function module",
    nameSpace: 'xmlns:fmodule="http://www.sap.com/adt/functions/fmodules"',
    rootName: "fmodule:abapFunctionModule",
    typeId: "FUGR/FF",
    validationPath: "functions/validation"
  },
  {
    creationPath: "functions/groups/%s/includes",
    label: "Function group include",
    nameSpace: 'xmlns:finclude="http://www.sap.com/adt/functions/fincludes"',
    rootName: "finclude:abapFunctionGroupInclude",
    typeId: "FUGR/I",
    validationPath: "functions/validation"
  },
  {
    creationPath: "ddic/ddl/sources",
    label: "CDS Data Definitions",
    nameSpace: 'xmlns:ddl="http://www.sap.com/adt/ddic/ddlsources"',
    rootName: "ddl:ddlSource",
    typeId: "DDLS/DF",
    validationPath: "ddic/ddl/validation"
  },
  {
    creationPath: "acm/dcl/sources",
    label: "CDS Access Control",
    nameSpace: 'xmlns:dcl="http://www.sap.com/adt/acm/dclsources"',
    rootName: "dcl:dclSource",
    typeId: "DCLS/DL",
    validationPath: "acm/dcl/validation"
  },
  {
    creationPath: "ddic/ddlx/sources",
    label: "CDS metadata extensions",
    nameSpace: 'xmlns:ddlx="http://www.sap.com/adt/ddic/ddlxsources"',
    rootName: "ddlx:ddlxSource",
    typeId: "DDLX/EX",
    validationPath: "ddic/ddlx/sources/validation"
  },
  {
    creationPath: "ddic/ddla/sources",
    label: "CDS Annotation definitions",
    nameSpace: 'xmlns:ddla="http://www.sap.com/adt/ddic/ddlasources"',
    rootName: "ddla:ddlaSource",
    typeId: "DDLA/ADF",
    validationPath: "ddic/ddla/sources/validation"
  }
]
ctypes.forEach(v => CreatableTypes.set(v.typeId, v))
