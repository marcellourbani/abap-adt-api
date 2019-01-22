import { isArray, isObject } from "util"

export function JSON2AbapXML(original: any, root: string = "DATA") {
  // only flat objects for now, might extend later...
  let inner = ""
  for (const key of Object.keys(original))
    if (original[key])
      inner = `${inner}\n<${key}>${original[key] || ""}</${key}>`
    else inner = `${inner}\n<${key}/>`

  return `<?xml version="1.0" encoding="UTF-8"?><asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
    <asx:values>
      <${root}>
        ${inner}
      </${root}>
    </asx:values>
  </asx:abap>`
}
export function xmlNode(xml: any, ...path: string[]): any {
  let current = xml

  path.some(key => {
    if (isObject(current)) current = current[key]
    return !current
  })

  return current
}

export function xmlArray<T>(xml: any, ...path: string[]): T[] {
  const node = xmlNode(xml, ...path)
  if (node) {
    if (isArray(node)) return node
    else return [node]
  }

  return []
}

const ok = Object.keys
export const xmlRoot = (o: any) => o[ok(o)[0]]
// extract XML attributes of a node from its JSON representation
export const xmlNodeAttr = (n: any) =>
  ok(n)
    .filter(k => k.match(/^(?!@_xmlns)@_/))
    .reduce((part: any, cur) => {
      part[cur.replace(/^@_/, "")] = n[cur]
      return part
    }, {})
