import { AdtHTTP } from "../AdtHTTP"
import { fullParse, xmlArray, xmlNodeAttr, xmlNode } from "../utilities"

export interface Feed {
    author: string;
    href: string;
    published: string;
    summary: string;
    title: string;
    updated: string;
    accept: string;
    refresh: FeedRefresh;
    paging?: number;
    operators: FeedOperator[];
    dataTypes: FeedDataType[];
    attributes: FeedAttribute[];
    queryIsObligatory?: boolean;
    queryDepth?: number;
    queryVariants: FeedQueryVariant[];
}

export interface FeedDataType {
    id: string;
    label: string;
    operators: string[];
}

export interface FeedAttribute extends FeedDataType {
    dataType: string;
}

export interface FeedOperator {
    id: string;
    numberOfOperands: number;
    kind: string;
    label: string;
}


export interface FeedQueryVariant {
    queryString: string;
    title: string;
    isDefault: boolean;
}

export interface FeedRefresh {
    value: number;
    unit: string;
}

const parseFeeds = (body: string): Feed[] => {
    const raw = fullParse(body, { ignoreNameSpace: true })
    const parseDt = (dt: any) => {
        const { "@_id": id, label = "" } = dt
        const operators = xmlArray(dt, "operators", "operator")
        return { id, label, operators: operators.map((o: any) => o["@_id"]) }
    }
    const parseAttribute = (at: any) => {
        const dataType = at.dataType?.["@_id"]
        return { ...parseDt(at), dataType }
    }
    const parseOperators = (op: any) => ({ ...xmlNodeAttr(op), label: op.label })

    const feeds = xmlArray(raw, "feed", "entry").map((f: any) => {
        const author = xmlNode(f, "author", "name")
        const { href, type: accept } = xmlNodeAttr(f["link"])
        const { published, summary, title, updated } = f
        const ed = f.extendedData
        const refresh = xmlNodeAttr(ed?.refresh?.interval)
        const paging = ed?.paging?.['@_size']
        const { queryIsObligatory, queryDepth } = ed
        const operators = xmlArray(ed, "operators", "operator").map(parseOperators)
        const dataTypes = xmlArray(ed, "dataTypes", "dataType").map(parseDt)
        const attributes = xmlArray(ed, "attributes", "attribute").map(parseAttribute)
        const queryVariants = xmlArray(ed, "queryVariants", "queryVariant").map(xmlNodeAttr)
        return {
            author, href, published, summary, title, updated, accept, refresh, paging,
            operators, dataTypes, attributes,
            queryIsObligatory, queryDepth, queryVariants
        }
    })
    return feeds
}

export async function feeds(h: AdtHTTP) {
    const headers = { Accept: "application/atom+xml;type=feed" }

    const response = await h.request("/sap/bc/adt/feeds", {
        method: "GET",
        headers
    })

    return parseFeeds(response.body)
}
