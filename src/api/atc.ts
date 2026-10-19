import { Schema } from "effect"
import type { DeepMutable } from "effect/Types"
import { AdtHTTP } from "../AdtHTTP"
import {
  encodeEntity,
  fullParse,
  isString,
  mixed,
  numberParseOptions,
  orUndefined,
  toInt,
  xmlArray,
  xmlNode,
  xmlNodeAttr
} from "../utilities"
import { adtException, isErrorMessageType, validateParseResult } from ".."
import { parseUri, uriParts } from "./urlparser"

// SATC_AC_RSLT_XMPT_KIND Atc based/Inline/none
const exemptionKind = Schema.Union([
  Schema.Literals(["A", "I", ""]),
  Schema.String
])
const proposalFinding = mixed(
  {
    uri: Schema.String,
    type: Schema.String,
    name: Schema.String,
    location: Schema.String,
    processor: Schema.String,
    lastChangedBy: Schema.String,
    priority: Schema.Number,
    checkId: Schema.String,
    checkTitle: Schema.String,
    messageId: Schema.String,
    messageTitle: Schema.String,
    exemptionApproval: Schema.String,
    exemptionKind, // SATC_AC_RSLT_XMPT_KIND Atc based/Inline/none
    checksum: Schema.Number,
    quickfixInfo: Schema.String
  },
  {
    quickfixes: mixed(
      {},
      {
        automatic: Schema.Boolean,
        manual: Schema.Boolean,
        pseudo: Schema.Boolean
      }
    )
  }
)

const restriction = Schema.Struct({
  enabled: Schema.Boolean,
  singlefinding: Schema.Boolean,
  rangeOfFindings: Schema.Struct({
    enabled: Schema.Boolean,
    restrictByObject: Schema.Struct({
      object: Schema.Boolean,
      package: Schema.Boolean,
      subobject: Schema.Boolean,
      target: Schema.Literals(["subobject", "object", "package", ""])
    }),
    restrictByCheck: Schema.Struct({
      check: Schema.Boolean,
      message: Schema.Boolean,
      target: Schema.Literals(["message", "check", ""])
    })
  })
})

const atcProposal = mixed(
  {
    finding: Schema.Union([proposalFinding, Schema.String]),
    package: Schema.String,
    subObject: Schema.String,
    subObjectType: Schema.String,
    subObjectTypeDescr: Schema.String,
    objectTypeDescr: Schema.String,
    approver: Schema.String,
    reason: Schema.Literals(["FPOS", "OTHR", ""]),
    justification: Schema.String,
    notify: Schema.Literals(["never", "on_rejection", "always"]),
    restriction: restriction
  },
  {
    apprIsArea: Schema.String,
    checkClass: Schema.String,
    validUntil: Schema.String
  }
)

const atcProposalMessage = Schema.Struct({
  type: Schema.String,
  message: Schema.String
})
export interface RestrictByObject {
  object: boolean
  package: boolean
  subobject: boolean
  text: string
}

const atcRunResultInfo = Schema.Struct({
  type: Schema.String,
  description: Schema.String
})

const atcRunResult = Schema.Struct({
  id: Schema.String,
  timestamp: Schema.Number,
  infos: Schema.Array(atcRunResultInfo)
})

const atcExcemption = Schema.Struct({
  id: Schema.String,
  justificationMandatory: Schema.Boolean,
  title: Schema.String
})

const atcProperty = Schema.Struct({
  name: Schema.String,
  value: Schema.Union([Schema.Boolean, Schema.String])
})

const atcCustomizingi = Schema.Struct({
  properties: Schema.Array(atcProperty),
  excemptions: Schema.Array(atcExcemption)
})

const objectSet = Schema.Struct({
  name: Schema.String,
  title: Schema.String,
  kind: Schema.String
})

const link = Schema.Struct({
  href: Schema.String,
  rel: Schema.String,
  type: Schema.String
})

const finding = Schema.Struct({
  uri: Schema.String,
  location: uriParts,
  priority: Schema.Number,
  checkId: Schema.String,
  checkTitle: Schema.String,
  messageId: Schema.String,
  messageTitle: Schema.String,
  exemptionApproval: Schema.String,
  exemptionKind,
  quickfixInfo: orUndefined(Schema.String),
  link: link
})
const object = Schema.Struct({
  uri: Schema.String,
  type: Schema.String,
  name: Schema.String,
  packageName: Schema.String,
  author: Schema.String,
  objectTypeId: orUndefined(Schema.String),
  findings: Schema.Array(finding)
})
const atcWorklist = Schema.Struct({
  id: Schema.String,
  timestamp: Schema.Number,
  usedObjectSet: Schema.String,
  objectSetIsComplete: Schema.Boolean,
  objectSets: Schema.Array(objectSet),
  objects: Schema.Array(object)
})

const atcUser = Schema.Struct({
  id: Schema.String,
  title: Schema.String
})

export type AtcRunResult = DeepMutable<typeof atcRunResult.Type>
export type AtcCustomizing = DeepMutable<typeof atcCustomizingi.Type>
export type AtcWorkList = DeepMutable<typeof atcWorklist.Type>
export type AtcUser = DeepMutable<typeof atcUser.Type>
export type AtcProposal = DeepMutable<typeof atcProposal.Type>
export type AtcProposalMessage = DeepMutable<typeof atcProposalMessage.Type>

export const isProposalMessage = (u: unknown): u is AtcProposalMessage =>
  Schema.is(atcProposalMessage)(u)

export async function atcCustomizing(h: AdtHTTP): Promise<AtcCustomizing> {
  const headers = {
    Accept: "application/xml, application/vnd.sap.atc.customizing-v1+xml"
  }
  const response = await h.request("/sap/bc/adt/atc/customizing", { headers })
  const raw = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false
  })
  const properties = xmlArray(raw, "customizing", "properties", "property").map(
    xmlNodeAttr
  )
  const excemptions = xmlArray(
    raw,
    "customizing",
    "exemption",
    "reasons",
    "reason"
  ).map(xmlNodeAttr)
  const retval = { properties, excemptions }
  return validateParseResult(atcCustomizingi, retval)
}

export async function atcCheckVariant(
  h: AdtHTTP,
  variant: string
): Promise<string> {
  const headers = { Accept: "text/plain" }
  const response = await h.request(
    `/sap/bc/adt/atc/worklists?checkVariant=${variant}`,
    { method: "POST", headers }
  )
  return response.body
}

export async function createAtcRun(
  h: AdtHTTP,
  variant: string,
  mainUrl: string,
  maxResults = 100
): Promise<AtcRunResult> {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<atc:run maximumVerdicts="${maxResults}" xmlns:atc="http://www.sap.com/adt/atc">
	<objectSets xmlns:adtcore="http://www.sap.com/adt/core">
		<objectSet kind="inclusive">
			<adtcore:objectReferences>
				<adtcore:objectReference adtcore:uri="${mainUrl}"/>
			</adtcore:objectReferences>
		</objectSet>
	</objectSets>
</atc:run>`
  const headers = {
    Accept: "application/xml",
    "Content-Type": "application/xml"
  }
  const response = await h.request(
    `/sap/bc/adt/atc/runs?worklistId=${variant}`,
    { method: "POST", headers, body }
  )
  const raw = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false
  })
  const id = xmlNode(raw, "worklistRun", "worklistId")
  const ts = xmlNode(raw, "worklistRun", "worklistTimestamp")
  const infos = xmlArray(raw, "worklistRun", "infos", "info")
  const retval = { id, timestamp: new Date(ts).getTime() / 1000, infos }
  return validateParseResult(atcRunResult, retval)
}

export async function atcWorklists(
  h: AdtHTTP,
  runResultId: string,
  timestamp?: number,
  usedObjectSet?: string,
  includeExemptedFindings = false
): Promise<AtcWorkList> {
  const headers = { Accept: "application/atc.worklist.v1+xml" }
  const qs = { timestamp, usedObjectSet, includeExemptedFindings }
  const response = await h.request(`/sap/bc/adt/atc/worklists/${runResultId}`, {
    headers,
    qs
  })
  const raw = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false,
    numberParseOptions
  })
  const root = xmlNode(raw, "worklist")
  const attrs = xmlNodeAttr(root)
  const objectSets = xmlArray(root, "objectSets", "objectSet").map(xmlNodeAttr)
  const objects = xmlArray(root, "objects", "object").map(o => {
    const oa = xmlNodeAttr(o)
    const findings = xmlArray(o, "findings", "finding").map(f => {
      const fa = xmlNodeAttr(f)
      const priority = toInt(fa.priority)
      const link = xmlNodeAttr(xmlNode(f, "link"))
      const location = parseUri(fa.location)
      const messageTitle = fa.messageTitle
      const checkTitle = fa.checkTitle
      return {
        ...fa,
        priority,
        messageTitle,
        checkTitle,
        location,
        messageId: `${fa.messageId}`,
        link
      }
    })
    return { ...oa, findings }
  })
  const ts = new Date(attrs.timestamp).getTime() / 1000
  const result = { ...attrs, timestamp: ts, objectSets, objects }
  return validateParseResult(atcWorklist, result)
}

export async function atcUsers(h: AdtHTTP): Promise<AtcUser[]> {
  const headers = { Accept: "application/atom+xml;type=feed" }
  const response = await h.request(`/sap/bc/adt/system/users`, { headers })
  const raw = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false
  })
  const users = xmlArray(raw, "feed", "entry")
  return validateParseResult(Schema.Array(atcUser), users) as AtcUser[]
}

export async function atcExemptProposal(
  h: AdtHTTP,
  markerId: string
): Promise<AtcProposal | AtcProposalMessage> {
  const headers = {
    Accept: "application/atc.xmpt.v1+xml, application/atc.xmptapp.v1+xml"
  }
  const qs = { markerId }
  const response = await h.request(`/sap/bc/adt/atc/exemptions/apply`, {
    headers,
    qs
  })
  const raw = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false
  })
  const root = xmlNode(raw, "exemptionApply", "exemptionProposal")
  const { message, type } = xmlNode(raw, "exemptionApply", "status") || {}
  if (isErrorMessageType(type)) throw adtException(message)
  if (message && type)
    return validateParseResult(atcProposalMessage, { message, type })
  const finding = isString(root.finding)
    ? root.finding
    : xmlNodeAttr(xmlNode(root, "finding"))
  if (!isString(finding)) {
    finding.priority = toInt(finding.priority)
    finding.checksum = toInt(finding.checksum)
    const qf = xmlNodeAttr(xmlNode(root, "finding", "quickfixes"))
    finding.quickfixes = {
      automatic: qf.automatic === "true",
      manual: qf.manual === "true",
      pseudo: qf.pseudo === "true"
    }
  }
  const {
    package: pa,
    subObject,
    subObjectType,
    subObjectTypeDescr,
    objectTypeDescr,
    approver,
    reason,
    justification,
    notify,
    apprIsArea,
    checkClass,
    validUntil
  } = root
  const { thisFinding, rangeOfFindings } = xmlNode(root, "restriction")
  const { restrictByObject, restrictByCheck } = rangeOfFindings
  const result = {
    finding,
    package: pa,
    subObject,
    subObjectType,
    subObjectTypeDescr,
    objectTypeDescr,
    approver,
    reason,
    justification,
    notify,
    apprIsArea,
    checkClass,
    validUntil,
    restriction: {
      enabled: thisFinding["@_enabled"] === "true",
      singlefinding: thisFinding["#text"] === "true",
      rangeOfFindings: {
        enabled: rangeOfFindings["@_enabled"] === "true",
        restrictByObject: {
          object: restrictByObject["@_object"] === "true",
          package: restrictByObject["@_package"] === "true",
          subobject: restrictByObject["@_subobject"] === "true",
          target: restrictByObject["#text"] || ""
        },
        restrictByCheck: {
          check: restrictByCheck["@_check"] === "true",
          message: restrictByCheck["@_message"] === "true",
          target: restrictByCheck["#text"] || ""
        }
      }
    }
  }
  return validateParseResult(atcProposal, result)
}

export async function atcDocumentation(h: AdtHTTP, docUri: string) {
  const headers = { "Content-Type": "application/vnd.sap.adt.atc.items.v1+xml" }; 
  const response = await h.request(docUri, {
    headers,
    method: "GET"
  })

  return response;
}

export async function atcRequestExemption(
  h: AdtHTTP,
  proposal: AtcProposal
): Promise<AtcProposalMessage> {
  const headers = {
    "Content-Type": "application/atc.xmptprop.v1+xml",
    Accept: "application/atc.xmpt.v1+xml, application/atc.xmptprop.v1+xml"
  }
  const {
    finding,
    restriction: {
      rangeOfFindings: { restrictByCheck, restrictByObject }
    },
    restriction
  } = proposal
  const qs = { markerId: isString(finding) ? finding : finding.quickfixInfo }
  const findingXml = isString(finding)
    ? `<atcexmpt:finding>${finding}</atcexmpt:finding>`
    : `<atcfinding:finding adtcore:name="${finding.name}" adtcore:type="${
        finding.type
      }" adtcore:uri="${finding.uri}" 
    atcfinding:checkId="${finding.checkId}" atcfinding:checksum="${
        finding.checksum
      }" atcfinding:checkTitle="${encodeEntity(finding.checkTitle)}" 
    atcfinding:exemptionApproval="${
      finding.exemptionApproval
    }" atcfinding:exemptionKind="${finding.exemptionKind}" 
    atcfinding:lastChangedBy="${finding.lastChangedBy}" 
    atcfinding:location="${finding.location}" atcfinding:messageId="${
        finding.messageId
      }" atcfinding:messageTitle="${encodeEntity(finding.messageTitle)}" 
    atcfinding:priority="${finding.priority}" atcfinding:processor="${
        finding.processor
      }" atcfinding:quickfixInfo="${finding.quickfixInfo}">
      <atcfinding:quickfixes atcfinding:automatic="false" atcfinding:manual="false" atcfinding:pseudo="false" />
    </atcfinding:finding>`
  const body = `<?xml version="1.0" encoding="ASCII"?>
    <atcexmpt:exemptionProposal xmlns:adtcore="http://www.sap.com/adt/core" xmlns:atcexmpt="http://www.sap.com/adt/atc/exemption" xmlns:atcfinding="http://www.sap.com/adt/atc/finding">
      ${findingXml}
      <atcexmpt:package>${proposal.package}</atcexmpt:package>
      <atcexmpt:subObject>${proposal.subObject}</atcexmpt:subObject>
      <atcexmpt:subObjectType>${proposal.subObjectType}</atcexmpt:subObjectType>
      <atcexmpt:subObjectTypeDescr>${
        proposal.subObjectTypeDescr
      }</atcexmpt:subObjectTypeDescr>
      <atcexmpt:objectTypeDescr>${
        proposal.objectTypeDescr
      }</atcexmpt:objectTypeDescr>
      <atcexmpt:restriction>
        <atcexmpt:thisFinding enabled="${restriction.enabled}">${
    restriction.singlefinding
  }</atcexmpt:thisFinding>
        <atcexmpt:rangeOfFindings enabled="${
          restriction.rangeOfFindings.enabled
        }">
          <atcexmpt:restrictByObject object="${
            restrictByObject.object
          }" package="${restrictByObject.package}" subobject="${
    restrictByObject.subobject
  }">
          ${restrictByObject.target}</atcexmpt:restrictByObject>
          <atcexmpt:restrictByCheck check="${restrictByCheck.check}" message="${
    restrictByCheck.message
  }">
          ${restrictByCheck.target}</atcexmpt:restrictByCheck>
        </atcexmpt:rangeOfFindings>
      </atcexmpt:restriction>
      <atcexmpt:approver>${proposal.approver}</atcexmpt:approver>
      <atcexmpt:reason>${proposal.reason}</atcexmpt:reason>
      <atcexmpt:justification>${encodeEntity(
        proposal.justification
      )}</atcexmpt:justification>
      <atcexmpt:notify>${proposal.notify}</atcexmpt:notify>
      <atcexmpt:apprIsArea>${proposal.apprIsArea || ""}</atcexmpt:apprIsArea>
      <atcexmpt:checkClass>${proposal.checkClass || ""}</atcexmpt:checkClass>
      <atcexmpt:validUntil>${proposal.validUntil || ""}</atcexmpt:validUntil>
      </atcexmpt:exemptionProposal>`
  const response = await h.request(`/sap/bc/adt/atc/exemptions/apply`, {
    headers,
    body,
    qs,
    method: "POST"
  })
  const raw = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false
  })
  const result = validateParseResult(atcProposalMessage, raw?.status)
  if (isErrorMessageType(result.type)) throw adtException(result.message)
  return result
}

export async function atcContactUri(
  h: AdtHTTP,
  findingUri: string
): Promise<string> {
  const headers = {
    "Content-Type": "application/vnd.sap.adt.atc.findingreferences.v1+xml",
    Accept: "application/vnd.sap.adt.atc.items.v1+xml"
  }
  const qs = { step: "proposal" }
  const body = `<?xml version="1.0" encoding="ASCII"?>
    <atcfinding:findingReferences xmlns:adtcore="http://www.sap.com/adt/core" xmlns:atcfinding="http://www.sap.com/adt/atc/finding">
      <atcfinding:findingReference adtcore:uri="${findingUri}"/>
    </atcfinding:findingReferences>`
  const response = await h.request(`/sap/bc/adt/atc/items`, {
    headers,
    body,
    method: "POST",
    qs
  })
  const raw = fullParse(response.body, {
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false
  })
  const { uri } = xmlNodeAttr(xmlNode(raw, "items", "item"))
  return validateParseResult(Schema.String, uri)
}

export async function atcChangeContact(
  h: AdtHTTP,
  itemUri: string,
  userId: string
): Promise<void> {
  const headers = { "Content-Type": "application/vnd.sap.adt.atc.items.v1+xml" }
  const body = `<?xml version="1.0" encoding="ASCII"?>
    <atcfinding:items xmlns:adtcore="http://www.sap.com/adt/core" xmlns:atcfinding="http://www.sap.com/adt/atc/finding">
      <atcfinding:item adtcore:uri="${itemUri}" atcfinding:processor="${userId}" atcfinding:status="2"/>
    </atcfinding:items>`
  await h.request(`/sap/bc/adt/atc/items`, { headers, body, method: "PUT" })
}
