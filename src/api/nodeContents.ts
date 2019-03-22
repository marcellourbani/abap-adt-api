import { parse } from "fast-xml-parser"
import { isString } from "util"
import { AdtHTTP } from "../AdtHTTP"
import { xmlArray } from "../utilities"
import { NodeParents } from "./nodeContents"
export type NodeParents = "DEVC/K" | "PROG/P" | "FUGR/F" | "PROG/PI"

export function isNodeParent(t: string): t is NodeParents {
  return t === "DEVC/K" || t === "PROG/P" || t === "FUGR/F" || t === "PROG/PI"
}

interface NodeRequestOptions {
  parent_name?: string
  parent_type: NodeParents
  user_name?: string
  parent_tech_name?: string
  withShortDescriptions: boolean
}
export interface Node {
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
export interface NodeCategory {
  CATEGORY: string
  CATEGORY_LABEL: string
}

export interface NodeObjectType {
  OBJECT_TYPE: string
  CATEGORY_TAG: string
  OBJECT_TYPE_LABEL: string
  NODE_ID: string
}
export interface NodeStructure {
  nodes: Node[]
  categories: NodeCategory[]
  objectTypes: NodeObjectType[]
}
const parsePackageResponse = (data: string): NodeStructure => {
  let nodes: Node[] = []
  let categories: NodeCategory[] = []
  let objectTypes: NodeObjectType[] = []
  if (data) {
    const xml = parse(data)
    const root = xml["asx:abap"]["asx:values"].DATA
    nodes = xmlArray(root, "TREE_CONTENT", "SEU_ADT_REPOSITORY_OBJ_NODE")
    for (const node of nodes)
      if (!isString(node.OBJECT_NAME)) {
        node.OBJECT_NAME = (node.OBJECT_NAME || "").toString()
        node.TECH_NAME = (node.TECH_NAME || "").toString()
      }
    categories = xmlArray(root, "CATEGORIES", "SEU_ADT_OBJECT_CATEGORY_INFO")
    objectTypes = xmlArray(root, "OBJECT_TYPES", "SEU_ADT_OBJECT_TYPE_INFO")
  }
  return {
    categories,
    nodes,
    objectTypes
  } as NodeStructure
}

// tslint:disable: variable-name
export async function nodeContents(
  h: AdtHTTP,
  parent_type: NodeParents,
  parent_name?: string,
  user_name?: string,
  parent_tech_name?: string
): Promise<NodeStructure> {
  const qs: NodeRequestOptions = {
    parent_type,
    withShortDescriptions: true
  }
  if (parent_name) qs.parent_name = parent_name
  if (parent_tech_name) qs.parent_tech_name = parent_tech_name
  if (user_name) qs.user_name = user_name
  const response = await h.request("/sap/bc/adt/repository/nodestructure", {
    method: "POST",
    qs
  })
  return parsePackageResponse(response.body)
}
