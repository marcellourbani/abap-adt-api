import { AdtHTTP } from "../AdtHTTP"
import { Clean, decodeEntity, encodeEntity, fullParse, orUndefined, toInt, xmlArray, xmlNode, xmlNodeAttr } from "../utilities"
import * as t from "io-ts";
import { adtException, isErrorMessageType, validateParseResult } from "..";
import { parseUri, uriParts } from "./urlparser";


const proposalFinding = t.type({
    uri: t.string,
    type: t.string,
    name: t.string,
    location: t.string,
    processor: t.string,
    lastChangedBy: t.string,
    priority: t.number,
    checkId: t.string,
    checkTitle: t.string,
    messageId: t.string,
    messageTitle: t.string,
    exemptionApproval: t.string,
    exemptionKind: t.string,
    checksum: t.number,
    quickfixInfo: t.string,
})

const restriction = t.type({
    enabled: t.boolean,
    text: t.string,
    rangeOfFindings: t.type({
        enabled: t.boolean,
        restrictByObject: t.type({
            object: t.boolean,
            package: t.boolean,
            subobject: t.boolean,
            text: t.string
        }),
        restrictByCheck: t.type({
            check: t.boolean,
            message: t.boolean,
            text: t.string
        })
    })
})

const atcProposal = t.type({
    finding: proposalFinding,
    package: t.string,
    subObject: t.string,
    subObjectType: t.string,
    subObjectTypeDescr: t.string,
    objectTypeDescr: t.string,
    approver: t.string,
    reason: t.string,
    justification: t.string,
    notify: t.string,
    restriction: restriction
})

const atcProposalMessage = t.type({
    type: t.string,
    message: t.string
})
export interface RestrictByObject {
    object: boolean;
    package: boolean;
    subobject: boolean;
    text: string;
}

const atcRunResultInfo = t.type({
    type: t.string,
    description: t.string
})

const atcRunResult = t.type({
    id: t.string,
    timestamp: t.number,
    infos: t.array(atcRunResultInfo)
})

const atcExcemption = t.type({
    id: t.string,
    justificationMandatory: t.boolean,
    title: t.string
})

const atcProperty = t.type({
    name: t.string,
    value: t.union([t.boolean, t.string])
})

const atcCustomizingi = t.type({
    properties: t.array(atcProperty),
    excemptions: t.array(atcExcemption)
})

const objectSet = t.type({
    name: t.string,
    title: t.string,
    kind: t.string
})



const link = t.type({
    href: t.string,
    rel: t.string,
    type: t.string
})

const finding = t.type({
    uri: t.string,
    location: uriParts,
    priority: t.number,
    checkId: t.string,
    checkTitle: t.string,
    messageId: t.string,
    messageTitle: t.string,
    exemptionApproval: t.string,
    exemptionKind: t.string,
    quickfixInfo: orUndefined(t.string),
    link: link,
})
const object = t.type({
    uri: t.string,
    type: t.string,
    name: t.string,
    packageName: t.string,
    author: t.string,
    objectTypeId: t.string,
    findings: t.array(finding),
})
const atcWorklist = t.type({
    id: t.string,
    timestamp: t.number,
    usedObjectSet: t.string,
    objectSetIsComplete: t.boolean,
    objectSets: t.array(objectSet),
    objects: t.array(object)
})

const atcUser = t.type({
    id: t.string,
    title: t.string
})


export type AtcRunResult = Clean<t.TypeOf<typeof atcRunResult>>
export type AtcCustomizing = Clean<t.TypeOf<typeof atcCustomizingi>>
export type AtcWorkList = Clean<t.TypeOf<typeof atcWorklist>>
export type AtcUser = Clean<t.TypeOf<typeof atcUser>>
export type AtcProposal = Clean<t.TypeOf<typeof atcProposal>>
export type AtcProposalMessage = Clean<t.TypeOf<typeof atcProposalMessage>>

export const isProposalMessage = atcProposalMessage.is

export async function atcCustomizing(h: AdtHTTP): Promise<AtcCustomizing> {
    const headers = { Accept: "application/xml, application/vnd.sap.atc.customizing-v1+xml" }
    const response = await h.request("/sap/bc/adt/atc/customizing", { headers })
    const raw = fullParse(response.body, { ignoreNameSpace: true, parseNodeValue: false })
    const properties = xmlArray(raw, "customizing", "properties", "property").map(xmlNodeAttr)
    const excemptions = xmlArray(raw, "customizing", "exemption", "reasons", "reason").map(xmlNodeAttr)
    const retval = { properties, excemptions }
    return validateParseResult(atcCustomizingi.decode(retval))
}

export async function atcCheckVariant(h: AdtHTTP, variant: string): Promise<string> {
    const headers = { Accept: "text/plain" }
    const response = await h.request(`/sap/bc/adt/atc/worklists?checkVariant=${variant}`, { method: "POST", headers })
    return response.body
}

export async function createAtcRun(h: AdtHTTP, variant: string, mainUrl: string, maxResults = 100): Promise<AtcRunResult> {
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
    const headers = { Accept: "application/xml", "Content-Type": "application/xml" }
    const response = await h.request(`/sap/bc/adt/atc/runs?worklistId=${variant}`, { method: "POST", headers, body })
    const raw = fullParse(response.body, { ignoreNameSpace: true, parseNodeValue: false })
    const id = xmlNode(raw, "worklistRun", "worklistId")
    const ts = xmlNode(raw, "worklistRun", "worklistTimestamp")
    const infos = xmlArray(raw, "worklistRun", "infos", "info")
    const retval = { id, timestamp: new Date(ts).getTime() / 1000, infos }
    return validateParseResult(atcRunResult.decode(retval))
}

export async function atcWorklists(h: AdtHTTP, runResultId: string, timestamp?: number, usedObjectSet?: string, includeExemptedFindings = false): Promise<AtcWorkList> {
    const headers = { Accept: "application/atc.worklist.v1+xml" }
    const qs = { timestamp, usedObjectSet, includeExemptedFindings }
    const response = await h.request(`/sap/bc/adt/atc/worklists/${runResultId}`, { headers, qs })
    const raw = fullParse(response.body, { ignoreNameSpace: true, parseNodeValue: false, parseTrueNumberOnly: true })
    const root = xmlNode(raw, "worklist")
    const attrs = xmlNodeAttr(root)
    const objectSets = xmlArray(root, "objectSets", "objectSet").map(xmlNodeAttr)
    const objects = xmlArray(root, "objects", "object").map(o => {
        const oa = xmlNodeAttr(o)
        const findings = xmlArray(o, "findings", "finding").map(f => {
            const fa = xmlNodeAttr(f)
            const link = xmlNodeAttr(xmlNode(f, "link"))
            const location = parseUri(fa.location)
            return { ...fa, location, messageId: `${fa.messageId}`, link }
        })
        return { ...oa, findings }
    })
    const ts = new Date(attrs.timestamp).getTime() / 1000
    const result = { ...attrs, timestamp: ts, objectSets, objects }
    return validateParseResult(atcWorklist.decode(result))
}

export async function atcUsers(h: AdtHTTP): Promise<AtcUser[]> {
    const headers = { Accept: "application/atom+xml;type=feed" }
    const response = await h.request(`/sap/bc/adt/system/users`, { headers })
    const raw = fullParse(response.body, { ignoreNameSpace: true, parseNodeValue: false, parseAttributeValue: false })
    const users = xmlArray(raw, "feed", "entry")
    return validateParseResult(t.array(atcUser).decode(users))
}

export async function atcExemptProposal(h: AdtHTTP, markerId: string): Promise<AtcProposal | AtcProposalMessage> {
    const headers = { Accept: "application/atc.xmpt.v1+xml, application/atc.xmptapp.v1+xml" }
    const qs = { markerId }
    const response = await h.request(`/sap/bc/adt/atc/exemptions/apply`, { headers, qs })
    const raw = fullParse(response.body, { ignoreNameSpace: true, parseNodeValue: false, parseAttributeValue: false })
    const root = xmlNode(raw, "exemptionApply", "exemptionProposal")
    const { message, type } = xmlNode(raw, "exemptionApply", "status") || {}
    if (isErrorMessageType(type)) throw adtException(message)
    if (message && type) return validateParseResult(atcProposalMessage.decode({ message, type }))
    const finding = xmlNodeAttr(xmlNode(root, "finding"))
    finding.priority = toInt(finding.priority)
    finding.checksum = toInt(finding.checksum)
    const { package: pa, subObject, subObjectType, subObjectTypeDescr, objectTypeDescr, approver, reason, justification, notify } = root
    const { thisFinding, rangeOfFindings } = xmlNode(root, "restriction")
    const { restrictByObject, restrictByCheck } = rangeOfFindings
    const result = {
        finding,
        package: pa, subObject, subObjectType, subObjectTypeDescr, objectTypeDescr, approver, reason, justification: decodeEntity(justification), notify,
        restriction: {
            enabled: thisFinding["@_enabled"] === "true",
            text: decodeEntity(thisFinding["#text"]),
            rangeOfFindings: {
                enabled: rangeOfFindings["@_enabled"] === "true",
                restrictByObject: {
                    object: restrictByObject["@_object"] === "true",
                    package: restrictByObject["@_package"] === "true",
                    subobject: restrictByObject["@_subobject"] === "true",
                    text: decodeEntity(restrictByObject["#text"]),
                },
                restrictByCheck: {
                    check: restrictByCheck["@_check"] === "true",
                    message: restrictByCheck["@_message"] === "true",
                    text: decodeEntity(restrictByCheck["#text"]),
                }
            }
        }
    }
    return validateParseResult(atcProposal.decode(result))
}

export async function atcRequestExemption(h: AdtHTTP, proposal: AtcProposal): Promise<AtcProposal | AtcProposalMessage> {
    const headers = { "Content-Type": "application/atc.xmptprop.v1+xml", Accept: "application/atc.xmpt.v1+xml, application/atc.xmptprop.v1+xml" }
    const qs = { markerId: proposal.finding.quickfixInfo }
    const { finding, restriction: { rangeOfFindings: { restrictByCheck, restrictByObject } }, restriction } = proposal
    const body = `<?xml version="1.0" encoding="ASCII"?>
    <atcexmpt:exemptionProposal xmlns:adtcore="http://www.sap.com/adt/core" xmlns:atcexmpt="http://www.sap.com/adt/atc/exemption" xmlns:atcfinding="http://www.sap.com/adt/atc/finding">
      <atcfinding:finding adtcore:name="${finding.name}" adtcore:type="${finding.type}" adtcore:uri="${finding.uri}" 
        atcfinding:checkId="${finding.checkId}" atcfinding:checksum="${finding.checksum}" atcfinding:checkTitle="${finding.checkTitle}" 
        atcfinding:exemptionApproval="${finding.exemptionApproval}" atcfinding:exemptionKind="${finding.exemptionKind}" 
        atcfinding:lastChangedBy="${finding.lastChangedBy}" 
        atcfinding:location="${finding.location}" atcfinding:messageId="${finding.messageId}" atcfinding:messageTitle="${finding.messageTitle}" 
        atcfinding:priority="${finding.priority}" atcfinding:processor="${finding.processor}" atcfinding:quickfixInfo="${finding.quickfixInfo}"/>
      <atcexmpt:package>${proposal.package}</atcexmpt:package>
      <atcexmpt:subObject>${proposal.subObject}</atcexmpt:subObject>
      <atcexmpt:subObjectType>${proposal.subObjectType}</atcexmpt:subObjectType>
      <atcexmpt:subObjectTypeDescr>${proposal.subObjectTypeDescr}</atcexmpt:subObjectTypeDescr>
      <atcexmpt:objectTypeDescr>${proposal.objectTypeDescr}</atcexmpt:objectTypeDescr>
      <atcexmpt:restriction>
        <atcexmpt:thisFinding enabled="${restriction.enabled}">${encodeEntity(restriction.text)}</atcexmpt:thisFinding>
        <atcexmpt:rangeOfFindings enabled="${restriction.rangeOfFindings.enabled}">
          <atcexmpt:restrictByObject object="${restrictByObject.object}" package="${restrictByObject.package}" subobject="${restrictByObject.subobject}">
          ${encodeEntity(restrictByObject.text)}</atcexmpt:restrictByObject>
          <atcexmpt:restrictByCheck check="${restrictByCheck.check}" message="${restrictByCheck.message}">${encodeEntity(restrictByCheck.text)}</atcexmpt:restrictByCheck>
        </atcexmpt:rangeOfFindings>
      </atcexmpt:restriction>
      <atcexmpt:approver>${proposal.approver}</atcexmpt:approver>
      <atcexmpt:reason>${proposal.reason}</atcexmpt:reason>
      <atcexmpt:justification>${encodeEntity(proposal.justification)}</atcexmpt:justification>
      <atcexmpt:notify>${proposal.notify}</atcexmpt:notify>
    </atcexmpt:exemptionProposal>`
    const response = await h.request(`/sap/bc/adt/atc/exemptions/apply`, { headers, body, qs, method: "POST" })
    const raw = fullParse(response.body, { ignoreNameSpace: true, parseNodeValue: false, parseAttributeValue: false })
    const result = validateParseResult(atcProposalMessage.decode(raw?.status))
    if (isErrorMessageType(result.type)) throw adtException(result.message)
    return validateParseResult(atcProposalMessage.decode(result))
}