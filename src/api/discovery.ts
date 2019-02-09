import { AdtHTTP } from "../AdtHTTP"
import { fullParse, xmlArray, xmlNodeAttr } from "../utilities"
import { AdtDiscoveryResult } from "./discovery"

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
  const ret = fullParse(response.data)
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
  const ret = fullParse(response.data)
  const workspaces: any = xmlArray(ret, "app:service", "app:workspace")

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
  const ret = fullParse(response.data)
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
