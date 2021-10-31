import { Link } from "."
import { AdtHTTP } from "../AdtHTTP"
import { fullParse, xmlArray, xmlNodeAttr, xmlNode, parseJsonDate, decodeEntity } from "../utilities"

export interface Feed {
    author: string;
    href: string;
    published: Date;
    summary: string;
    title: string;
    updated: Date;
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

export interface DumpsFeed {
    href: string;
    title: string;
    updated: Date;
    dumps: Dump[];
}

export interface Dump {
    categories: DumpCategory[];
    links: Link[];
    id: string;
    author?: string;
    text: string;
    type: string;
}

export interface DumpCategory {
    term: string;
    label: "ABAP runtime error" | "Terminated ABAP program"
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
            author, href, published: parseJsonDate(published), summary, title, updated: parseJsonDate(updated), accept, refresh, paging,
            operators, dataTypes, attributes,
            queryIsObligatory, queryDepth, queryVariants
        }
    })
    return feeds
}


const parseDumps = (body: string): DumpsFeed => {
    const raw = fullParse(body, { ignoreNameSpace: true })?.feed
    const { href } = xmlNodeAttr(raw?.link)
    const { title, updated } = raw
    const dumps = xmlArray(raw, "entry").map((e: any) => {
        const { category, id, author: { name: author }, summary: { "#text": text, "@_type": type } } = e
        const links = xmlArray(e, "link").map(xmlNodeAttr)
        return { categories: category.map(xmlNodeAttr), links, id, author, text: decodeEntity(text), type }
    })
    return { href, title, updated: parseJsonDate(updated), dumps }
}


export async function feeds(h: AdtHTTP) {
    const headers = { Accept: "application/atom+xml;type=feed" }
    const response = await h.request("/sap/bc/adt/feeds", { method: "GET", headers })
    return parseFeeds(response.body)
}

export async function dumps(h: AdtHTTP, query: string = "") {
    const headers = { Accept: "application/atom+xml;type=feed" }
    const params: any = {}
    if (query) params["$query"] = query
    const response = await h.request("/sap/bc/adt/runtime/dumps", { method: "GET", params, headers })

    return parseDumps(response.body)
}