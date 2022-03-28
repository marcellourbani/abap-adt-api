import { AdtHTTP } from "../AdtHTTP"
import { Clean, fullParse, xmlArray, xmlNode, xmlNodeAttr } from "../utilities"
import * as t from "io-ts";
import { validateParseResult } from "..";
import { parseUri, uriParts } from "./urlparser";

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
    quickfixInfo: t.string,
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


export type AtcRunResult = Clean<t.TypeOf<typeof atcRunResult>>
export type AtcCustomizing = Clean<t.TypeOf<typeof atcCustomizingi>>
export type AtcWorkList = Clean<t.TypeOf<typeof atcWorklist>>

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

export async function atcWorklists(h: AdtHTTP, runResultId: string, timestamp?: number, usedObjectSet?: string): Promise<AtcWorkList> {
    const headers = { Accept: "application/atc.worklist.v1+xml" }
    const qs = { timestamp, usedObjectSet, includeExemptedFindings: !!usedObjectSet }
    const response = await h.request(`/sap/bc/adt/atc/worklists/${runResultId}?includeExemptedFindings=false`, { headers, qs })
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