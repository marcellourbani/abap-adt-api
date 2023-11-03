import * as t from "io-ts"
import { extractXmlArray, fullParse, orUndefined, typedNodeAttr, xmlArrayType, xmlNode } from "../utilities"
import { validateParseResult } from "../AdtException"

const contributorClass = t.type({ name: t.string })
const link = t.type({
    "@_href": t.string,
    "@_rel": t.string,
    "@_type": t.string,
    "@_title": t.string,
})
const state = t.type({ "@_value": t.string, "@_text": t.string })

const extendedData = t.type({
    host: t.string,
    size: t.number,
    runtime: t.number,
    runtimeABAP: t.number,
    runtimeSystem: t.number,
    runtimeDatabase: t.number,
    expiration: t.string,
    system: t.string,
    client: t.number,
    isAggregated: t.boolean,
    aggregationKind: orUndefined(t.string),
    objectName: t.string,
    state: state,
})

const entryAuthor = t.type({ name: t.string, uri: t.string })
const entry = t.type({
    author: entryAuthor,
    content: t.type({
        "@_type": t.string,
        "@_src": t.string
    }),
    id: t.string,
    link: xmlArrayType(link),
    published: t.string,
    title: t.string,
    updated: t.string,
    extendedData: extendedData,
    "@_lang": t.string
})


const feed = t.type({
    author: contributorClass,
    contributor: contributorClass,
    title: t.string,
    updated: t.string,
    entry: xmlArrayType(entry),
})
const traceResults = t.type({ feed: feed })

export interface TraceResults {
    author: string;
    contributor: string;
    title: string;
    updated: Date;
    runs: TraceRun[];
}

export interface TraceRun {
    id: string;
    author: string;
    title: string;
    published: Date;
    updated: Date;
    authorUri: string;
    type: string;
    src: string;
    lang: string;
    extendedData: ExtendedTraceData;
    links: TraceLink[];
}

export interface ExtendedTraceData {
    host: string;
    size: number;
    runtime: number;
    runtimeABAP: number;
    runtimeSystem: number;
    runtimeDatabase: number;
    expiration: Date;
    system: string;
    client: number;
    isAggregated: boolean;
    aggregationKind?: string;
    objectName: string;
    state: State;
}

export interface State {
    value: string;
    text: string;
}

export interface TraceLink {
    href: string;
    rel: string;
    type: string;
    title: string;
}


const parseRawTrace = (x: unknown) => validateParseResult(traceResults.decode(x)).feed

export const parseTraceResults = (xml: string): TraceResults => {
    const raw = parseRawTrace(fullParse(xml, { removeNSPrefix: true }))
    const runs = extractXmlArray(raw.entry).map(l => {
        const links = extractXmlArray(l.link).map(typedNodeAttr)
        const { id, author: { name: author, uri: authorUri }, content: { "@_type": type, "@_src": src }, "@_lang": lang, title } = l
        const published = new Date(l.published)
        const updated = new Date(l.updated)
        const extendedData = { ...l.extendedData, expiration: new Date(l.extendedData.expiration), state: typedNodeAttr(l.extendedData.state) }
        // @ts-ignore
        delete extendedData["#text"]
        return { id, author, title, published, updated, authorUri, type, src, lang, extendedData, links }
    })
    const { author: { name: author }, contributor: { name: contributor }, title } = raw
    const updated = new Date(xmlNode(raw, "updated"))
    return { author, contributor, title, updated, runs }
}
