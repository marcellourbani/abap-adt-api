import { parse } from "fast-xml-parser"

export type NodeParents = "DEVC/K" | "PROG/P" | "FUGR/F"
export interface NodeRequestOptions {
  parent_name?: string
  parent_type: NodeParents
  user_name?: string
  parent_tech_name?: string
}

export interface NodeStructure {
  nodes: [
    {
      OBJECT_TYPE: string
      OBJECT_NAME: string
      TECH_NAME: string
      OBJECT_URI: string
      OBJECT_VIT_URI: string
      EXPANDABLE: string
    }
  ]
  categories: [
    {
      CATEGORY: string
      CATEGORY_LABEL: string
    }
  ]
  objectTypes: [
    {
      OBJECT_TYPE: string
      CATEGORY_TAG: string
      OBJECT_TYPE_LABEL: string
      NODE_ID: string
    }
  ]
}
export const parsePackageResponse = (data: string): NodeStructure => {
  const xml = parse(data)
  const root = xml["asx:abap"]["asx:values"]["DATA"]
  const nodes =
    (root.TREE_CONTENT && root.TREE_CONTENT.SEU_ADT_REPOSITORY_OBJ_NODE) || []
  const categories =
    (root.CATEGORIES && root.CATEGORIES.SEU_ADT_OBJECT_CATEGORY_INFO) || []
  const objectTypes =
    (root.OBJECT_TYPES && root.OBJECT_TYPES.SEU_ADT_OBJECT_TYPE_INFO) || []
  return {
    nodes,
    categories,
    objectTypes
  }
}

export const defined = (o: any) =>
  Object.keys(o)
    .filter(k => o[k] !== undefined)
    .reduce(
      (cur, k) => {
        cur[k] = o[k]
        return cur
      },
      {} as any
    )
