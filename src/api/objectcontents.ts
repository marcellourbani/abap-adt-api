import { ValidateObjectUrl, ValidateStateful } from "../AdtException"
import { AdtHTTP, RequestOptions } from "../AdtHTTP"
import { xmlArray, btoa, parse, encodeEntity } from "../utilities"
import { ObjectVersion } from "./objectstructure"

export interface AdtLock {
  LOCK_HANDLE: string
  CORRNR: string
  CORRUSER: string
  CORRTEXT: string
  IS_LOCAL: string
  IS_LINK_UP: string
  MODIFICATION_SUPPORT: string
}
export interface ObjectSourceOptions {
  version?: ObjectVersion
  gitUser?: string
  gitPassword?: string
}
export async function getObjectSource(
  h: AdtHTTP,
  objectSourceUrl: string,
  options?: ObjectSourceOptions
) {
  ValidateObjectUrl(objectSourceUrl)
  const config: RequestOptions = {}
  const { gitPassword, gitUser, version } = options || {}
  if (gitUser || gitPassword) {
    config.headers = {}
    if (gitUser) config.headers.Username = gitUser
    if (gitPassword) config.headers.Password = btoa(gitPassword)
  }
  if (version) config.qs = { version }
  const response = await h.request(objectSourceUrl, config)
  return response.body as string
}

export async function setObjectSource(
  h: AdtHTTP,
  objectSourceUrl: string,
  source: string,
  lockHandle: string,
  transport?: string
) {
  ValidateObjectUrl(objectSourceUrl)
  ValidateStateful(h)
  const qs: any = { lockHandle }
  const ctype = source.match(/^<\?xml\s/i)
    ? "application/*"
    : "text/plain; charset=utf-8"
  if (transport) qs.corrNr = transport
  await h.request(objectSourceUrl, {
    body: source,
    headers: { "content-type": ctype },
    method: "PUT",
    qs
  })
}

export async function lock(
  h: AdtHTTP,
  objectUrl: string,
  accessMode: string = "MODIFY"
) {
  ValidateObjectUrl(objectUrl)
  ValidateStateful(h)
  const qs = { _action: "LOCK", accessMode }
  const response = await h.request(objectUrl, {
    headers: {
      Accept:
        "application/*,application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result"
    },
    method: "POST",
    qs
  })
  const raw = parse(response.body)
  const locks = xmlArray(raw, "asx:abap", "asx:values", "DATA")
  return locks[0] as AdtLock
}

export async function unLock(
  h: AdtHTTP,
  objectUrl: string,
  lockHandle: string
) {
  ValidateObjectUrl(objectUrl)
  const qs = {
    _action: "UNLOCK",
    lockHandle: encodeURIComponent(lockHandle)
  }
  const response = await h.request(objectUrl, {
    method: "POST",
    qs
  })
  return response.body
}

// DDIC Domain Properties
export interface DomainTypeInformation {
  datatype: string  // CHAR, NUMC, DEC, etc.
  length: number
  decimals: number
}

export interface DomainOutputInformation {
  length: number
  style?: string
  conversionExit?: string
  signExists: boolean
  lowercase: boolean
  ampmFormat: boolean
}

export interface DomainFixValue {
  low: string
  high?: string
  text?: string
}

export interface DomainValueInformation {
  valueTableRef: string
  appendExists: boolean
  fixValues?: DomainFixValue[]
}

export interface DomainProperties {
  typeInformation: DomainTypeInformation
  outputInformation: DomainOutputInformation
  valueInformation?: DomainValueInformation
}

export interface DomainMetaData {
  name: string
  description: string
  language: string
  masterLanguage: string
  masterSystem: string
  responsible: string
  packageName: string
  packageDescription?: string
  packageUri?: string
}

/**
 * Set DDIC domain properties via PUT request
 * @param h - AdtHTTP instance
 * @param domainUrl - Domain object URL (e.g., /sap/bc/adt/ddic/domains/zdomain_name)
 * @param properties - Domain properties to set
 * @param metaData - Domain metadata
 * @param lockHandle - Lock handle from lock operation
 * @param transport - Optional transport request number
 */
export async function setDomainProperties(
  h: AdtHTTP,
  domainUrl: string,
  properties: DomainProperties,
  metaData: DomainMetaData,
  lockHandle: string,
  transport?: string
) {
  ValidateObjectUrl(domainUrl)
  ValidateStateful(h)

  const { typeInformation, outputInformation, valueInformation } = properties
  const {
    name,
    description,
    language,
    masterLanguage,
    masterSystem,
    responsible,
    packageName,
    packageDescription = packageName === "$TMP" ? "Temporary Objects (never transported!)" : "",
    packageUri = packageName ? `/sap/bc/adt/packages/${encodeURIComponent(packageName.toLowerCase())}` : ""
  } = metaData

  const now = new Date().toISOString()

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<doma:domain xmlns:doma="http://www.sap.com/dictionary/domain"
  xmlns:adtcore="http://www.sap.com/adt/core"
  xmlns:atom="http://www.w3.org/2005/Atom"
  adtcore:description="${encodeEntity(description)}"
  adtcore:language="${language}"
  adtcore:name="${name}"
  adtcore:type="DOMA/DD"
  adtcore:version="new"
  adtcore:masterLanguage="${masterLanguage}"
  adtcore:masterSystem="${masterSystem}"
  adtcore:responsible="${responsible}"
  adtcore:changedAt="${now}"
  adtcore:changedBy="${responsible}"
  adtcore:createdAt="${now}"
  adtcore:createdBy="${responsible}">
  <atom:link href="/sap/bc/adt/vit/wb/object_type/domadd/object_name/${name}"
    rel="self"
    title="Representation in SAP Gui"
    type="application/vnd.sap.sapgui"/>
  <atom:link href="/sap/bc/adt/vit/docu/object_type/do/object_name/${name.toLowerCase()}?masterLanguage=1&amp;mode=edit"
    rel="http://www.sap.com/adt/relations/documentation"
    title="Documentation"
    type="application/vnd.sap.sapgui"/>
  <adtcore:packageRef
    adtcore:name="${packageName}"
    adtcore:type="DEVC/K"
    ${packageDescription ? `adtcore:description="${encodeEntity(packageDescription)}"` : ""}
    ${packageUri ? `adtcore:uri="${packageUri}"` : ""}/>
  <doma:content>
    <doma:typeInformation>
      <doma:datatype>${typeInformation.datatype}</doma:datatype>
      <doma:length>${typeInformation.length}</doma:length>
      <doma:decimals>${typeInformation.decimals}</doma:decimals>
    </doma:typeInformation>
    <doma:outputInformation>
      <doma:length>${outputInformation.length}</doma:length>
      <doma:style>${outputInformation.style || ""}</doma:style>
      <doma:conversionExit>${outputInformation.conversionExit || ""}</doma:conversionExit>
      <doma:signExists>${outputInformation.signExists}</doma:signExists>
      <doma:lowercase>${outputInformation.lowercase}</doma:lowercase>
      <doma:ampmFormat>${outputInformation.ampmFormat}</doma:ampmFormat>
    </doma:outputInformation>
    ${valueInformation ? `
    <doma:valueInformation>
      <doma:valueTableRef adtcore:name="${valueInformation.valueTableRef || ""}"/>
      <doma:appendExists>${valueInformation.appendExists || false}</doma:appendExists>
      ${valueInformation.fixValues && valueInformation.fixValues.length > 0 ? `
      <doma:fixValues>
        ${valueInformation.fixValues.map(fv => `<doma:fixValue>
          <doma:low>${encodeEntity(fv.low)}</doma:low>
          ${fv.high ? `<doma:high>${encodeEntity(fv.high)}</doma:high>` : ""}
          ${fv.text ? `<doma:text>${encodeEntity(fv.text)}</doma:text>` : ""}
        </doma:fixValue>`).join("\n        ")}
      </doma:fixValues>` : ""}
    </doma:valueInformation>` : ""}
  </doma:content>
</doma:domain>`

  const qs: any = { lockHandle }
  if (transport) qs.corrNr = transport

  await h.request(domainUrl, {
    body,
    headers: { "content-type": "application/*" },
    method: "PUT",
    qs
  })
}

// DDIC Data Element Properties
export interface DataElementFieldLabels {
  shortFieldLabel: string
  shortFieldLength?: number
  mediumFieldLabel: string
  mediumFieldLength?: number
  longFieldLabel: string
  longFieldLength?: number
  headingFieldLabel: string
  headingFieldLength?: number
}

export interface DataElementProperties {
  typeKind: "domain" | "datatype"  // 使用域还是直接类型
  typeName: string                  // 域名或类型名
  dataType: string                  // 数据类型 (CHAR, NUMC, etc.)
  dataTypeLength: number            // 长度
  dataTypeDecimals?: number         // 小数位
  fieldLabels: DataElementFieldLabels
  searchHelp?: string               // 搜索帮助
  searchHelpParameter?: string      // 搜索帮助参数
  setGetParameter?: string          // SET/GET 参数
  defaultComponentName?: string     // 默认组件名
  deactivateInputHistory?: boolean
  changeDocument?: boolean
  leftToRightDirection?: boolean
  deactivateBIDIFiltering?: boolean
}

export interface DataElementMetaData {
  name: string
  description: string
  language: string
  masterLanguage: string
  masterSystem: string
  responsible: string
  packageName: string
  packageDescription?: string
  packageUri?: string
}

/**
 * Set DDIC data element properties via PUT request
 * @param h - AdtHTTP instance
 * @param dataElementUrl - Data element object URL (e.g., /sap/bc/adt/ddic/dataelements/zdata_element)
 * @param properties - Data element properties to set
 * @param metaData - Data element metadata
 * @param lockHandle - Lock handle from lock operation
 * @param transport - Optional transport request number
 */
export async function setDataElementProperties(
  h: AdtHTTP,
  dataElementUrl: string,
  properties: DataElementProperties,
  metaData: DataElementMetaData,
  lockHandle: string,
  transport?: string
) {
  ValidateObjectUrl(dataElementUrl)
  ValidateStateful(h)

  const {
    typeKind,
    typeName,
    dataType,
    dataTypeLength,
    dataTypeDecimals = 0,
    fieldLabels,
    searchHelp = "",
    searchHelpParameter = "",
    setGetParameter = "",
    defaultComponentName = "",
    deactivateInputHistory = false,
    changeDocument = false,
    leftToRightDirection = false,
    deactivateBIDIFiltering = false
  } = properties

  const {
    name,
    description,
    language,
    masterLanguage,
    masterSystem,
    responsible,
    packageName,
    packageDescription = packageName === "$TMP" ? "Temporary Objects (never transported!)" : "",
    packageUri = packageName ? `/sap/bc/adt/packages/${encodeURIComponent(packageName.toLowerCase())}` : ""
  } = metaData

  const now = new Date().toISOString()

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<blue:wbobj xmlns:adtcore="http://www.sap.com/adt/core"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:blue="http://www.sap.com/wbobj/dictionary/dtel"
  xmlns:dtel="http://www.sap.com/adt/dictionary/dataelements"
  adtcore:changedAt="${now}"
  adtcore:changedBy="${responsible}"
  adtcore:createdAt="${now}"
  adtcore:createdBy="${responsible}"
  adtcore:description="${encodeEntity(description)}"
  adtcore:language="${language}"
  adtcore:name="${name}"
  adtcore:type="DTEL/DE"
  adtcore:version="new"
  adtcore:masterLanguage="${masterLanguage}"
  adtcore:masterSystem="${masterSystem}"
  adtcore:responsible="${responsible}">
  <atom:link href="/sap/bc/adt/vit/wb/object_type/dtelde/object_name/${name}"
    rel="self"
    title="Representation in SAP Gui"
    type="application/vnd.sap.sapgui"/>
  <atom:link href="/sap/bc/adt/vit/docu/object_type/de/object_name/${name.toLowerCase()}?masterLanguage=1&amp;mode=edit"
    rel="http://www.sap.com/adt/relations/documentation"
    title="Documentation"
    type="application/vnd.sap.sapgui"/>
  <adtcore:packageRef
    adtcore:name="${packageName}"
    adtcore:type="DEVC/K"
    ${packageDescription ? `adtcore:description="${encodeEntity(packageDescription)}"` : ""}
    ${packageUri ? `adtcore:uri="${packageUri}"` : ""}/>
  <dtel:dataElement>
    <dtel:typeKind>${typeKind}</dtel:typeKind>
    <dtel:typeName>${typeName}</dtel:typeName>
    <dtel:dataType>${dataType}</dtel:dataType>
    <dtel:dataTypeLength>${dataTypeLength}</dtel:dataTypeLength>
    <dtel:dataTypeDecimals>${dataTypeDecimals}</dtel:dataTypeDecimals>
    <dtel:shortFieldLabel>${encodeEntity(fieldLabels.shortFieldLabel)}</dtel:shortFieldLabel>
    <dtel:shortFieldLength>${fieldLabels.shortFieldLength || 10}</dtel:shortFieldLength>
    <dtel:shortFieldMaxLength>10</dtel:shortFieldMaxLength>
    <dtel:mediumFieldLabel>${encodeEntity(fieldLabels.mediumFieldLabel)}</dtel:mediumFieldLabel>
    <dtel:mediumFieldLength>${fieldLabels.mediumFieldLength || 20}</dtel:mediumFieldLength>
    <dtel:mediumFieldMaxLength>20</dtel:mediumFieldMaxLength>
    <dtel:longFieldLabel>${encodeEntity(fieldLabels.longFieldLabel)}</dtel:longFieldLabel>
    <dtel:longFieldLength>${fieldLabels.longFieldLength || 40}</dtel:longFieldLength>
    <dtel:longFieldMaxLength>40</dtel:longFieldMaxLength>
    <dtel:headingFieldLabel>${encodeEntity(fieldLabels.headingFieldLabel)}</dtel:headingFieldLabel>
    <dtel:headingFieldLength>${fieldLabels.headingFieldLength || 55}</dtel:headingFieldLength>
    <dtel:headingFieldMaxLength>55</dtel:headingFieldMaxLength>
    <dtel:searchHelp>${searchHelp}</dtel:searchHelp>
    <dtel:searchHelpParameter>${searchHelpParameter}</dtel:searchHelpParameter>
    <dtel:setGetParameter>${setGetParameter}</dtel:setGetParameter>
    <dtel:defaultComponentName>${defaultComponentName}</dtel:defaultComponentName>
    <dtel:deactivateInputHistory>${deactivateInputHistory}</dtel:deactivateInputHistory>
    <dtel:changeDocument>${changeDocument}</dtel:changeDocument>
    <dtel:leftToRightDirection>${leftToRightDirection}</dtel:leftToRightDirection>
    <dtel:deactivateBIDIFiltering>${deactivateBIDIFiltering}</dtel:deactivateBIDIFiltering>
  </dtel:dataElement>
</blue:wbobj>`

  const qs: any = { lockHandle }
  if (transport) qs.corrNr = transport

  await h.request(dataElementUrl, {
    body,
    headers: { "content-type": "application/*" },
    method: "PUT",
    qs
  })
}
