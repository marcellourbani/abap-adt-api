import { AdtHTTP } from "../AdtHTTP";
import { fullParse, xmlArray, xmlNode } from "../utilities";

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
    return { values, meta: { name, type, description, keyAttribute, colType, isKeyFigure, length } }
}
export function parseQueryResponse(body: string) {
    const raw = fullParse(body, { ignoreNameSpace: true })
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
    rowNumber: number = 100
) {
    const qs = { rowNumber, ddicEntityName }
    const response = await h.request(
        `/sap/bc/adt/datapreview/ddic`,
        { qs, headers: { Accept: "application/*" }, method: "POST" }
    )
    return parseQueryResponse(response.body)
}

// /sap/bc/adt/datapreview/freestyle?rowNumber=100