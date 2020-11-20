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

export const parseServiceBinding = (xml: string) => {
    const s = fullParse(xml, { ignoreNameSpace: true, parseAttributeValue: false })
    const attrs = xmlNodeAttr(s.serviceBinding)
    for (const key of ["releaseSupported", "published", "repair", "bindingCreated"])
        attrs[key] = !`${attrs[key]}`.match(/false/i)
    const packageRef = xmlNodeAttr(s.serviceBinding.packageRef)
    const links = s.serviceBinding.link.map(xmlNodeAttr)
    const parseService = (service: any) => {
        const { "@_name": name, content: { "@_version": version, "@_releaseState": releaseState } } = service
        const serviceDefinition = xmlNodeAttr(service.content.serviceDefinition)
        return { name, version, releaseState, serviceDefinition }
    }
    const services = xmlArray(s, "serviceBinding", "services").map(parseService)
    const parseBinding = (b: any) => ({ ...xmlNodeAttr(b), implementation: { ...xmlNodeAttr(b.implementation) } })
    const binding = parseBinding(s.serviceBinding.binding)

    return { ...attrs, packageRef, links, services, binding } as ServiceBinding
}

export const extractBindingUrls = (binding: ServiceBinding) => {
    const base = binding.links.find(l => l.rel === "http://www.sap.com/categories/odatav2")
    if (!base) return []
    return binding.services.map(service => {
        const { name, version, serviceDefinition: { name: sdname } } = service
        const url = `${base.href}?servicename=${name}&serviceversion=${version}&srvdname=${sdname}`
        return { service, url }
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


export async function tablecontents(
    h: AdtHTTP,
    ddicEntityName: string,
    rowNumber: number = 100,
    decode = true
) {
    const qs = { rowNumber, ddicEntityName }
    const response = await h.request(
        `/sap/bc/adt/datapreview/ddic`,
        { qs, headers: { Accept: "application/*" }, method: "POST" }
    )
    const queryResult = parseQueryResponse(response.body)
    if (decode) return decodeQueryResult(queryResult)
    return queryResult
}

// /sap/bc/adt/datapreview/freestyle?rowNumber=100