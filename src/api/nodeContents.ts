import { parse } from "fast-xml-parser"
import { AdtHTTP } from "../AdtHTTP"
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
      // new fields from 7.52
      VISIBILITY?: number
      NODE_ID?: string
      DESCRIPTION?: string
      DESCRIPTION_TYPE?: string
      IS_ABSTRACT?: string
      IS_CONSTANT?: string
      IS_CONSTRUCTOR?: string
      IS_EVENT_HANDLER?: string
      IS_FINAL?: string
      IS_FOR_TESTING?: string
      IS_READ_ONLY?: string
      IS_REDEFINITION?: string
      IS_STATIC?: string
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
const parsePackageResponse = (data: string): NodeStructure => {
  let nodes = []
  let categories = []
  let objectTypes = []
  if (data) {
    const xml = parse(data)
    const root = xml["asx:abap"]["asx:values"].DATA
    nodes =
      (root.TREE_CONTENT && root.TREE_CONTENT.SEU_ADT_REPOSITORY_OBJ_NODE) || []
    categories =
      (root.CATEGORIES && root.CATEGORIES.SEU_ADT_OBJECT_CATEGORY_INFO) || []
    objectTypes =
      (root.OBJECT_TYPES && root.OBJECT_TYPES.SEU_ADT_OBJECT_TYPE_INFO) || []
  }
  return {
    categories,
    nodes,
    objectTypes
  }
}

export async function nodeContents(
  h: AdtHTTP,
  options: NodeRequestOptions
): Promise<NodeStructure> {
  const params = {
    ...options,
    withShortDescriptions: true
  }
  const response = await h.request("/sap/bc/adt/repository/nodestructure", {
    method: "POST",
    params
  })
  return parsePackageResponse(response.data)
}
