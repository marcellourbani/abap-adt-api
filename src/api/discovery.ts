import { parse } from "fast-xml-parser"
import { AdtHTTP } from "../AdtHTTP"
import { fullParse, xmlArray, xmlNodeAttr } from "../utilities"

export interface AdtDiscoveryResult {
  collection: Array<{
    href: string
    templateLinks: Array<{
      rel: string
      template: string
      title?: string
      type?: string
    }>
    title?: string
  }>
  title: string
}
export interface AdtCoreDiscoveryResult {
  title: string
  collection: { href: string; title: string; category: string }
}

export interface AdtGraphNode {
  nameSpace: string
  name: string
}
export interface AdtCompatibilityGraph {
  nodes: AdtGraphNode[]
  edges: Array<{ sourceNode: AdtGraphNode; targetNode: AdtGraphNode }>
}

export async function adtDiscovery(h: AdtHTTP) {
  const response = await h.request("/sap/bc/adt/discovery")
  const ret = fullParse(response.body)
  const objects = xmlArray(ret, "app:service", "app:workspace").map(
    (o: any) => {
      return {
        collection: xmlArray(o, "app:collection").map((c: any) => {
          return {
            href: c["@_href"],
            templateLinks: xmlArray(
              c,
              "adtcomp:templateLinks",
              "adtcomp:templateLink"
            ).map(xmlNodeAttr),
            title: c["atom:title"]
          }
        }),
        title: o["atom:title"]
      }
    }
  )
  return objects as AdtDiscoveryResult[]
}

export async function adtCoreDiscovery(h: AdtHTTP) {
  const response = await h.request("/sap/bc/adt/core/discovery")
  const ret = fullParse(response.body)
  const workspaces: any = xmlArray(ret, "app:service", "app:workspace").filter((w: any) => w["app:collection"])

  return workspaces.map((w: any) => {
    const collection = w["app:collection"]
    return {
      collection: {
        category: collection["atom:category"]["@_term"],
        href: collection["@_href"],
        title: collection["atom:title"]
      },
      title: w["atom:title"]
    }
  }) as AdtCoreDiscoveryResult[]
}

export async function adtCompatibilityGraph(h: AdtHTTP) {
  const response = await h.request("/sap/bc/adt/compatibility/graph")
  const ret = fullParse(response.body)
  const edges = xmlArray(ret, "compatibility:graph", "edges", "edge").map(
    (e: any) => {
      return {
        sourceNode: xmlNodeAttr(e.sourceNode),
        targetNode: xmlNodeAttr(e.targetNode)
      }
    }
  )
  const nodes = xmlArray(ret, "compatibility:graph", "nodes", "node").map(
    xmlNodeAttr
  )
  return { edges, nodes } as AdtCompatibilityGraph
}

export interface ObjectTypeDescriptor {
  name: string
  description: string
  type: string
  usedBy: string[]
}
export async function objectTypes(h: AdtHTTP): Promise<ObjectTypeDescriptor[]> {
  const qs = { maxItemCount: 999, name: "*", data: "usedByProvider" }
  const response = await h.request(
    "/sap/bc/adt/repository/informationsystem/objecttypes",
    { qs }
  )
  const ret = parse(response.body)
  const types: ObjectTypeDescriptor[] = xmlArray(
    ret,
    "nameditem:namedItemList",
    "nameditem:namedItem"
  )
    .map((n: any) => {
      const data = n["nameditem:data"] || ""
      const fields = data.split(";").reduce((acc: any, cur: string) => {
        const parts = cur.split(":", 2)
        acc[parts[0]] = parts[1] || ""
        return acc
      }, {})
      let o: ObjectTypeDescriptor | undefined
      if (fields.type && fields.usedBy)
        o = {
          name: n["nameditem:name"],
          description: n["nameditem:description"],
          type: fields.type,
          usedBy: fields.usedBy.split(",")
        }
      return o
    })
    .filter(x => x) as ObjectTypeDescriptor[]
  return types
}
