import { sprintf } from "sprintf-js"
import { adtException } from "../AdtException"
import { AdtHTTP } from "../AdtHTTP"
import { fullParse, xmlArray, encodeEntity, isString } from "../utilities"

export type PackageTypeId = "DEVC/K"

export type GroupTypeIds = "FUGR/FF" | "FUGR/I"
export type BindingTypeId = "SRVB/SVB"
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
  | "TABL/DT"
  | "SRVD/SRV"
  | "AUTH"
  | "DTEL/DE"
  | "SUSO/B"
  | "MSAG/N"

export type ParentTypeIds = "DEVC/K" | "FUGR/F"

export type CreatableTypeIds = GroupTypeIds | NonGroupTypeIds | PackageTypeId | BindingTypeId
export interface CreatableType {
  validationPath: string
  creationPath: string
  rootName: string
  nameSpace: string
  label: string
  typeId: CreatableTypeIds
  extra?: string
  maxLen: number
}

interface BaseValidateOptions {
  objname: string
  description: string
}
export interface ObjectValidateOptions extends BaseValidateOptions {
  objtype: NonGroupTypeIds
  packagename: string
}
export interface GroupValidateOptions extends BaseValidateOptions {
  objtype: GroupTypeIds
  fugrname: string
}
export type PackageTypes = "development" | "structure" | "main"
export interface PackageSpecificData {
  swcomp: string
  transportLayer: string
  packagetype: PackageTypes
}
export interface PackageValidateOptions
  extends PackageSpecificData,
  BaseValidateOptions {
  objtype: PackageTypeId
  packagename: string
}

export interface BindingValidationOptions extends BaseValidateOptions {
  objtype: BindingTypeId
  serviceBindingVersion: "ODATA\\V2",
  serviceDefinition: string,
  package: string
}

export interface NewObjectOptions {
  objtype: CreatableTypeIds
  name: string
  parentName: string
  description: string
  parentPath: string
  responsible?: string
  transport?: string
}
export interface NewPackageOptions
  extends NewObjectOptions,
  PackageSpecificData {
  objtype: PackageTypeId
}

export type BindingCategory = "0" | "1"
export const BindinTypes = [
  { description: "Odata V2 - Web API", bindingtype: "ODATA", category: "0" },
  { description: "Odata V2 - UI", bindingtype: "ODATA", category: "1" },
]
export interface NewBindingOptions extends NewObjectOptions {
  objtype: BindingTypeId
  service: string
  bindingtype: "ODATA"
  category: BindingCategory
}

export const hasPackageOptions = (o: any): o is PackageSpecificData =>
  !!o?.swcomp

export const isPackageOptions = (o: NewObjectOptions): o is NewPackageOptions =>
  (o as any)?.objtype === "DEVC/K" && hasPackageOptions(o)

export const isBindingOptions = (o: NewObjectOptions): o is NewBindingOptions =>
  (o as any)?.objtype === "SRVB/SVB" && !!(o as any)?.service && !!(o as any)?.bindingtype

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
export type ValidateOptions =
  | ObjectValidateOptions
  | GroupValidateOptions
  | PackageValidateOptions
  | BindingValidationOptions

const xmlEntry = (value: string, key: string) => value ? `<${key}>${encodeEntity(value)}</${key}>}` : `<${key}/>`
const xmlAttribute = (value: string, key: string) => value ? `${key}="${encodeEntity(value)}"` : ``
function createBodyPackage(options: NewPackageOptions) {
  const responsible = `adtcore:responsible="${options.responsible}"`
  const compname = xmlAttribute(options.swcomp, `pak:name`)
  const description = xmlAttribute(options.description, "adtcore:description")
  const superp = xmlAttribute(options.parentName, "adtcore:name")
  const pkgname = xmlAttribute(options.name, "adtcore:name")
  const pkgtype = xmlAttribute(options.packagetype, "pak:packageType")
  return `<?xml version="1.0" encoding="UTF-8"?>
<pak:package xmlns:pak="http://www.sap.com/adt/packages"
xmlns:adtcore="http://www.sap.com/adt/core" ${description}
${pkgname} adtcore:type="DEVC/K" adtcore:version="active" ${responsible}>
<adtcore:packageRef  adtcore:name="YMU_RAP"/>
<pak:attributes ${pkgtype}/>
<pak:superPackage ${superp}/>
<pak:applicationComponent/>
<pak:transport>
 <pak:softwareComponent ${compname}/>
 <pak:transportLayer pak:name="${encodeEntity(options.transportLayer)}"/>
</pak:transport>
<pak:translation/>
<pak:useAccesses/>
<pak:packageInterfaces/>
<pak:subPackages/>
</pak:package>`
}

function createBodyFunc(options: NewObjectOptions, type: CreatableType) {
  const responsible = `adtcore:responsible="${options.responsible}"`
  return `<?xml version="1.0" encoding="UTF-8"?>
        <${type.rootName} ${type.nameSpace}
           xmlns:adtcore="http://www.sap.com/adt/core"
           adtcore:description="${encodeEntity(options.description)}"
           adtcore:name="${options.name}" adtcore:type="${options.objtype}"
           ${responsible}>
             <adtcore:containerRef adtcore:name="${options.parentName}"
               adtcore:type="FUGR/F"
               adtcore:uri="${options.parentPath}"/>
        </${type.rootName}>`
}

function createBodySimple(options: NewObjectOptions, type: CreatableType, body = "") {
  const responsible = `adtcore:responsible="${options.responsible}"`
  body = body || `<adtcore:packageRef adtcore:name="${options.parentName}"/>`
  return `<?xml version="1.0" encoding="UTF-8"?>
        <${type.rootName} ${type.nameSpace}
          xmlns:adtcore="http://www.sap.com/adt/core"
          adtcore:description="${encodeEntity(options.description)}"
          adtcore:name="${options.name}" adtcore:type="${options.objtype}"
          ${responsible} ${type.extra || ""}>
          ${body}
        </${type.rootName}>`
}

function createBodyBinding(options: NewBindingOptions, type: CreatableType) {
  const body = `<adtcore:packageRef adtcore:name="${options.parentName}"/>
      <srvb:services srvb:name="${options.name}">
          <srvb:content srvb:version="0001">
              <srvb:serviceDefinition adtcore:name="${options.service}"/>
          </srvb:content>
      </srvb:services>
      <srvb:binding srvb:category="0" srvb:type="${options.bindingtype}" srvb:version="V2">
          <srvb:implementation adtcore:name=""/>
      </srvb:binding>`
  return createBodySimple(options, type, body)
}

function createBody(options: NewObjectOptions, type: CreatableType) {
  switch (type.typeId) {
    case "DEVC/K":
      if (isPackageOptions(options))
        return createBodyPackage(options)
      throw adtException("Can't create a Package with incomplete data");
    case "FUGR/FF":
    case "FUGR/I":
      return createBodyFunc(options, type)
    case "SRVB/SVB":
      if (isBindingOptions(options))
        return createBodyBinding(options, type)
      throw adtException("Can't create service binding with incomplete data");
    default:
      return createBodySimple(options, type)
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
  typeId: CreatableTypeIds,
  name: string,
  parentName: string
): string
export function objectPath(
  typeIdOrObjectOptions: CreatableTypeIds | NewObjectOptions,
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
  if (!ot.validationPath) throw adtException(`Validation not supported for object ${ot} ${options.objname}`)
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

export async function createObject(
  h: AdtHTTP,
  options: NewObjectOptions | NewPackageOptions
) {
  const ot = CreatableTypes.get(options.objtype)
  if (!ot) throw adtException("Unsupported object type")
  const url =
    "/sap/bc/adt/" +
    sprintf(ot.creationPath, encodeURIComponent(options.parentName))
  options.responsible = (options.responsible || h.username).toUpperCase()
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

export async function createTestInclude(
  h: AdtHTTP,
  clas: string,
  lockHandle: string,
  corrNr: string
) {
  const body = `<?xml version="1.0" encoding="UTF-8"?><class:abapClassInclude
  xmlns:class="http://www.sap.com/adt/oo/classes" xmlns:adtcore="http://www.sap.com/adt/core"
  adtcore:name="dummy" class:includeType="testclasses"/>`
  await h.request(
    `/sap/bc/adt/oo/classes/${encodeURIComponent(clas)}/includes`,
    {
      body,
      headers: { "Content-Type": "application/*" },
      method: "POST",
      qs: { lockHandle, corrNr }
    }
  )
}

export function isGroupType(type: any): type is GroupTypeIds {
  return type === "FUGR/FF" || type === "FUGR/I"
}

export function isPackageType(type: any): type is PackageTypeId {
  return type === "DEVC/K"
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
    validationPath: "programs/validation",
    maxLen: 30
  },
  {
    creationPath: "oo/classes",
    label: "Class",
    nameSpace: 'xmlns:class="http://www.sap.com/adt/oo/classes"',
    rootName: "class:abapClass",
    typeId: "CLAS/OC",
    validationPath: "oo/validation/objectname",
    maxLen: 30
  },
  {
    creationPath: "oo/interfaces",
    label: "Interface",
    nameSpace: 'xmlns:intf="http://www.sap.com/adt/oo/interfaces"',
    rootName: "intf:abapInterface",
    typeId: "INTF/OI",
    validationPath: "oo/validation/objectname",
    maxLen: 30
  },
  {
    creationPath: "programs/includes",
    label: "Include",
    nameSpace: 'xmlns:include="http://www.sap.com/adt/programs/includes"',
    rootName: "include:abapInclude",
    typeId: "PROG/I",
    validationPath: "includes/validation",
    maxLen: 30
  },
  {
    creationPath: "functions/groups",
    label: "Function Group",
    nameSpace: 'xmlns:group="http://www.sap.com/adt/functions/groups"',
    rootName: "group:abapFunctionGroup",
    typeId: "FUGR/F",
    validationPath: "functions/validation",
    maxLen: 26
  },
  {
    creationPath: "functions/groups/%s/fmodules",
    label: "Function module",
    nameSpace: 'xmlns:fmodule="http://www.sap.com/adt/functions/fmodules"',
    rootName: "fmodule:abapFunctionModule",
    typeId: "FUGR/FF",
    validationPath: "functions/validation",
    maxLen: 30
  },
  {
    creationPath: "functions/groups/%s/includes",
    label: "Function group include",
    nameSpace: 'xmlns:finclude="http://www.sap.com/adt/functions/fincludes"',
    rootName: "finclude:abapFunctionGroupInclude",
    typeId: "FUGR/I",
    validationPath: "functions/validation",
    maxLen: 3
  },
  {
    creationPath: "ddic/ddl/sources",
    label: "CDS Data Definitions",
    nameSpace: 'xmlns:ddl="http://www.sap.com/adt/ddic/ddlsources"',
    rootName: "ddl:ddlSource",
    typeId: "DDLS/DF",
    validationPath: "ddic/ddl/validation",
    maxLen: 30
  },
  {
    creationPath: "acm/dcl/sources",
    label: "CDS Access Control",
    nameSpace: 'xmlns:dcl="http://www.sap.com/adt/acm/dclsources"',
    rootName: "dcl:dclSource",
    typeId: "DCLS/DL",
    validationPath: "acm/dcl/validation",
    maxLen: 30
  },
  {
    creationPath: "ddic/ddlx/sources",
    label: "CDS metadata extensions",
    nameSpace: 'xmlns:ddlx="http://www.sap.com/adt/ddic/ddlxsources"',
    rootName: "ddlx:ddlxSource",
    typeId: "DDLX/EX",
    validationPath: "ddic/ddlx/sources/validation",
    maxLen: 30
  },
  {
    creationPath: "ddic/ddla/sources",
    label: "CDS Annotation definitions",
    nameSpace: 'xmlns:ddla="http://www.sap.com/adt/ddic/ddlasources"',
    rootName: "ddla:ddlaSource",
    typeId: "DDLA/ADF",
    validationPath: "ddic/ddla/sources/validation",
    maxLen: 30
  },
  {
    creationPath: "packages",
    label: "Package",
    nameSpace: 'xmlns:pak="http://www.sap.com/adt/packages"',
    rootName: "pak:package",
    typeId: "DEVC/K",
    validationPath: "packages/validation",
    maxLen: 30
  },
  {
    creationPath: "ddic/tables",
    label: "Table",
    nameSpace: 'xmlns:blue="http://www.sap.com/wbobj/blue"',
    rootName: "blue:blueSource",
    typeId: "TABL/DT",
    validationPath: "ddic/tables/validation",
    maxLen: 16
  },
  {
    creationPath: "ddic/srvd/sources",
    label: "Service definition",
    nameSpace: 'xmlns:srvd="http://www.sap.com/adt/ddic/srvdsources"',
    rootName: "srvd:srvdSource",
    typeId: "SRVD/SRV",
    validationPath: "ddic/srvd/sources/validation",
    extra: `srvd:srvdSourceType="S"`,
    maxLen: 30
  },
  {
    creationPath: "aps/iam/auth",
    rootName: "auth:auth",
    nameSpace: 'xmlns:auth="http://www.sap.com/iam/auth"',
    label: "Authorization field",
    typeId: "AUTH",
    validationPath: "aps/iam/auth/validation",
    maxLen: 10
  },
  {
    creationPath: "aps/iam/suso",
    validationPath: "aps/iam/suso/validation",
    rootName: "susob:suso",
    nameSpace: `xmlns:susob="http://www.sap.com/iam/suso"`,
    label: "Authorization object",
    typeId: "SUSO/B",
    maxLen: 10
  },
  {
    creationPath: "ddic/dataelements",
    validationPath: "ddic/dataelements/validation",
    rootName: "blue:wbobj",
    nameSpace: 'xmlns:blue="http://www.sap.com/wbobj/dictionary/dtel"',
    label: "Data Element",
    typeId: "DTEL/DE",
    maxLen: 30
  },
  {
    creationPath: "businessservices/bindings",
    validationPath: "businessservices/bindings/validation",
    rootName: "srvb:serviceBinding",
    nameSpace: 'xmlns:srvb="http://www.sap.com/adt/ddic/ServiceBindings"',
    label: "Service binding",
    typeId: "SRVB/SVB",
    maxLen: 26
  },
  {
    creationPath: "messageclass",
    validationPath: "messageclass/validation",
    rootName: "mc:messageClass",
    nameSpace: `xmlns:mc="http://www.sap.com/adt/MessageClass"`,
    label: "Message class",
    typeId: "MSAG/N",
    maxLen: 20
  }
]
ctypes.forEach(v => CreatableTypes.set(v.typeId, v))
