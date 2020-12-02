import { adtException } from "../AdtException";
import { AdtHTTP } from "../AdtHTTP";
import { fullParse, toInt, xmlArray, xmlNode, xmlNodeAttr } from "../utilities";
import { Link } from "./objectstructure";
export enum TypeKinds {
    ANY = '~',
    CHAR = 'C',
    CLASS = '*',
    CLIKE = '&',
    CSEQUENCE = '?',
    DATA = '#',
    DATE = 'D',
    DECFLOAT = '/',
    DECFLOAT16 = 'a',
    DECFLOAT34 = 'e',
    DREF = 'l',
    FLOAT = 'F',
    HEX = 'X',
    INT = 'I',
    INT1 = 'b',
    INT8 = '8',
    INT2 = 's',
    INTF = '+',
    IREF = 'm',
    NUM = 'N',
    NUMERIC = '%',
    OREF = 'r',
    PACKED = 'P',
    SIMPLE = '$',
    STRING = 'g',
    STRUCT1 = 'u',
    STRUCT2 = 'v',
    TABLE = 'h',
    TIME = 'T',
    W = 'w',
    XSEQUENCE = '!',
    XSTRING = 'y',
    BREF = 'j'
}

export interface QueryResultColumn {
    name: string;
    type: TypeKinds;
    description: string;
    keyAttribute: boolean;
    colType: string;
    isKeyFigure: boolean;
    length: number;
}

export interface QueryResult {
    columns: QueryResultColumn[]
    values: any[]
}
export interface ServiceBinding {
    releaseSupported: boolean;
    published: boolean;
    repair: boolean;
    bindingCreated: boolean;
    responsible: string;
    masterLanguage: string;
    masterSystem: string;
    name: string;
    type: string;
    changedAt: string;
    version: string;
    createdAt: string;
    changedBy: string;
    createdBy: string;
    description: string;
    language: string;
    packageRef: ServiceBindingPackageRef;
    links: Link[];
    services: ServiceBindingService[];
    binding: ServiceBindingBinding;
}

export interface ServiceBindingBinding {
    type: string;
    version: string;
    category: number;
    implementation: {
        name: string;
    }
}

export interface ServiceBindingPackageRef {
    uri: string;
    type: string;
    name: string;
    description?: string;
}

export interface ServiceBindingService {
    name: string;
    version: number;
    releaseState: string;
    serviceDefinition: ServiceBindingPackageRef;
}

export interface BindingServiceResult {
    link: Link;
    services: BindingService[];
}

export interface BindingService {
    repositoryId: string;
    serviceId: string;
    serviceVersion: string;
    serviceUrl: string;
    annotationUrl: string;
    published: string;
    created: string;
    serviceInformation: BindingServiceInformation;
}

export interface BindingServiceInformation {
    name: string;
    version: string;
    url: string;
    collection: BindingServiceCollection[];
}

export interface BindingServiceCollection {
    name: string;
    navigation: BindingServiceNavigation[];
}

export interface BindingServiceNavigation {
    name: string;
    target: string;
}


export const parseServiceBinding = (xml: string) => {
    const s = fullParse(xml, { ignoreNameSpace: true, parseAttributeValue: false })
    const attrs = xmlNodeAttr(s.serviceBinding)
    for (const key of ["releaseSupported", "published", "repair", "bindingCreated"])
        attrs[key] = !`${attrs[key]}`.match(/false/i)
    const packageRef = xmlNodeAttr(s.serviceBinding.packageRef)
    const links = s.serviceBinding.link.map(xmlNodeAttr)
    const parseService = (name: string) => (service: any) => {
        const { "@_version": version, "@_releaseState": releaseState } = service
        const serviceDefinition = xmlNodeAttr(service.serviceDefinition)
        return { name, version, releaseState, serviceDefinition }
    }
    const { "@_name": serviceName } = xmlNode(s, "serviceBinding", "services")
    const services = xmlArray(s, "serviceBinding", "services", "content").map(parseService(serviceName))
    const parseBinding = (b: any) => ({ ...xmlNodeAttr(b), implementation: { ...xmlNodeAttr(b.implementation) } })
    const binding = parseBinding(s.serviceBinding.binding)

    return { ...attrs, packageRef, links, services, binding } as ServiceBinding
}

export const extractBindingLinks = (binding: ServiceBinding) => {
    const url = binding.links.find(l => l.rel === "http://www.sap.com/categories/odatav2")?.href
    if (!url) return []
    return binding.services.map(service => {
        const { name: servicename, version: serviceversion, serviceDefinition: { name: srvdname } } = service
        const query = { servicename, serviceversion, srvdname }
        return { service, query, url }
    })
}

const decodeSapDate = (raw: string) =>
    new Date(`${raw.substr(0, 4)}-${raw.substr(4, 2)}-${raw.substr(6, 2)}`)

const parseValue = (type: TypeKinds | undefined, raw: string) => {
    switch (type) {
        case TypeKinds.DATE:
            return decodeSapDate(raw)
        case TypeKinds.DECFLOAT:
        case TypeKinds.DECFLOAT16:
        case TypeKinds.DECFLOAT34:
        case TypeKinds.FLOAT:
        case TypeKinds.NUM:
        case TypeKinds.NUMERIC:
        case TypeKinds.PACKED:
            return parseFloat(raw)
        case TypeKinds.INT:
        case TypeKinds.INT1:
        case TypeKinds.INT8:
        case TypeKinds.INT2:
            return parseInt(raw, 10)
        case TypeKinds.TIME:
            return raw // converting to date doesn't sound like a great idea
        default:
            return raw
    }
}

export const decodeQueryResult = (original: QueryResult): QueryResult => {
    const { columns } = original
    const types = new Map<string, TypeKinds>()
    for (const c of columns) types.set(c.name, c.type)
    const values = original.values.map(l => {
        const decoded = (k: string) => parseValue(types.get(k), l[k])
        return Object.keys(l).reduce((o: any, k) => { o[k] = decoded(k); return o }, {})
    })
    return { columns, values }
}

const parseColumn = (raw: any) => {
    const { "@_name": name = "",
        "@_type": type = "",
        "@_description": description,
        "@_keyAttribute": keyAttribute = false,
        "@_colType": colType,
        "@_isKeyFigure": isKeyFigure = false,
        "@_length": length = 0,
    } = raw.metadata
    const values = xmlArray(raw, "dataSet", "data")
    const meta: QueryResultColumn = { name, type, description, keyAttribute, colType, isKeyFigure, length }
    return { values, meta }
}
export function parseQueryResponse(body: string) {
    const raw = fullParse(body, { ignoreNameSpace: true, parseNodeValue: false })
    const fields = xmlArray(raw, "tableData", "columns").map(parseColumn)
    const columns = fields.map(c => c.meta)
    const longest = fields.map(f => f.values).reduce((m, l) => l.length > m.length ? l : m, [])
    const row = (_: any, i: number) => fields.reduce((r, f) => {
        return { ...r, [f.meta.name]: f.values[i] }
    }, {} as any)
    const values = longest.map(row)
    return { columns, values }
}

export const parseBindingDetails = (xml: string) => {
    const s = fullParse(xml, { ignoreNameSpace: true, parseAttributeValue: false })
    const link = xmlNodeAttr(s?.serviceList?.link)
    const parseCollection = (c: any) => {
        const name = c["@_name"]
        const navigation = xmlArray(c, "navigation").map(xmlNodeAttr)
        return { name, navigation }
    }
    const parseService = (s: any) => {
        const base = xmlNodeAttr(s)
        const serviceInformation = xmlNodeAttr(s.serviceInformation)
        serviceInformation.collection = xmlArray(s, "serviceInformation", "collection").map(parseCollection)
        return ({ ...base, serviceInformation })
    }
    const services = xmlArray(s, "serviceList", "services").map(parseService)
    return { link, services } as BindingServiceResult
}

export const servicePreviewUrl = (service: BindingService, collectionName: string) => {
    const { serviceId, serviceInformation: { collection, url, name, version } } = service
    const annotation = `${name.substr(0, 28)}_VAN`
    const baseUrl = url.replace(/(https?:\/\/[^\/]+).*/, "$1")
    const cn = collection.find(c => c.name === collectionName)
    if (!cn) return
    const encrypt = (s: string) => s.split("").map(c => String.fromCharCode(c.charCodeAt(0) + 20)).join("")
    const names = cn.navigation.map(n => n.name).join("@@")
    const targets = cn.navigation.map(n => n.target).join("@@")
    const rawparm = [serviceId, cn.name, names, targets, annotation, version].join("##")
    return `${baseUrl}/sap/bc/adt/businessservices/odatav2/feap?feapParams=${encodeURIComponent(encrypt(rawparm))}`
}


export async function tableContents(
    h: AdtHTTP,
    ddicEntityName: string,
    rowNumber: number = 100,
    decode = true,
    sqlQuery = ""
) {
    const qs = { rowNumber, ddicEntityName }
    const response = await h.request(
        `/sap/bc/adt/datapreview/ddic`,
        { qs, headers: { Accept: "application/*" }, method: "POST", body: sqlQuery }
    )
    const queryResult = parseQueryResponse(response.body)
    if (decode) return decodeQueryResult(queryResult)
    return queryResult
}

export async function runQuery(
    h: AdtHTTP,
    sqlQuery: string,
    rowNumber: number = 100,
    decode = true
) {
    const qs = { rowNumber }
    const response = await h.request(
        `/sap/bc/adt/datapreview/freestyle`,
        { qs, headers: { Accept: "application/*" }, method: "POST", body: sqlQuery }
    )
    const queryResult = parseQueryResponse(response.body)
    if (decode) return decodeQueryResult(queryResult)
    return queryResult
}

export async function bindingDetails(
    h: AdtHTTP,
    binding: ServiceBinding,
    index = 0
) {
    const queries = extractBindingLinks(binding)
    const { query: qs, url } = queries[index]
    if (!qs || !url) throw adtException("Binding not found")
    const response = await h.request(
        url,
        { qs, headers: { Accept: "application/*" }, method: "GET" }
    )
    return parseBindingDetails(response.body)
}