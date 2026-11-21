import { AdtHTTP } from "../AdtHTTP"
import {
  ObjectRelationReference,
  objectRelationComponents,
  objectRelationNetwork,
  objectRelationReferences,
  objectRelationSets
} from "./objectrelations"
import { jest } from "@jest/globals"

const ref = (name: string, type: string, uri: string): ObjectRelationReference => ({
  name,
  type,
  uri
})

const setup = (body: string) => {
  const http = new AdtHTTP("https://example.invalid", "u", "p", "", "")
  const request = jest.spyOn(http, "request").mockResolvedValue({
    body,
    headers: {},
    status: 200,
    statusText: "OK"
  })
  const sent = () => request.mock.calls[0][1] as any
  return { http, request, sent }
}

const networkXml = `<?xml version="1.0"?>
<oro:networkResponse xmlns:oro="http://www.sap.com/adt/objectrelations" xmlns:adtcore="http://www.sap.com/adt/core">
  <oro:activeContext><oro:value>ENV</oro:value></oro:activeContext>
  <oro:context oro:id="ENV" oro:displayName="Used Objects" oro:supportsComponents="true" oro:supportsGrouping="1" oro:supportsReferences="X" oro:isDefault="true" oro:relevance="7" />
  <oro:objectReference adtcore:uri="/root" adtcore:type="PROG/P" adtcore:name="ZROOT" oro:displayName="Root" adtcore:description="Root description" oro:exists="true" oro:canHaveComponents="1" />
  <oro:objectReference adtcore:uri="/child" adtcore:type="CLAS/OC" adtcore:name="ZCHILD" />
  <oro:relation oro:relationType="parentChild" oro:state="A"><oro:object1>ZROOT</oro:object1><oro:object2>/child</oro:object2><oro:role1 oro:singular="parent" /><oro:role2 oro:singular="child" /><oro:property><oro:name>kind</oro:name><oro:value>uses</oro:value></oro:property></oro:relation>
</oro:networkResponse>`

const componentsXml = `<oro:componentsResponse xmlns:oro="http://www.sap.com/adt/objectrelations" xmlns:adtcore="http://www.sap.com/adt/core"><oro:component oro:id="c1" adtcore:uri="/component" adtcore:type="DDLS/K" adtcore:name="Field" oro:parent="p1" oro:displayName="Field label"><oro:property><oro:name>key</oro:name><oro:value>true</oro:value></oro:property><oro:link href="/component" rel="toDefinition" type="text" title="Open" /></oro:component></oro:componentsResponse>`

const referencesXml = `<oroRef:result xmlns:oroRef="http://www.sap.com/adt/objectrelations/references" xmlns:adtcore="http://www.sap.com/adt/core" numberOfResults="1"><oroRef:reference><oroRef:from adtcore:name="ZROOT" adtcore:type="PROG/P" /><oroRef:to adtcore:name="ZCHILD" adtcore:type="CLAS/OC" /><oroRef:anchor uri="/source#start=1" program="ZROOT" include="I01" matches="1-4" snippet="CALL" /></oroRef:reference></oroRef:result>`

const relationSetXml = `<rel:RelationSetResult xmlns:rel="http://www.sap.com/adt/objectrelations/relations" xmlns:adtcore="http://www.sap.com/adt/core" leftTitle="Left" rightTitle="Right" header="Header"><rel:relation><rel:left adtcore:uri="/left" adtcore:type="PROG/P" adtcore:name="ZLEFT" /><rel:right adtcore:uri="/right" adtcore:type="TABL/DT" adtcore:name="ZRIGHT" /><rel:direction direction="left-to-right" /></rel:relation></rel:RelationSetResult>`

describe("object relations", () => {
  test("network request and response", async () => {
    const { http, request, sent } = setup(networkXml)

    const result = await objectRelationNetwork(http, ref("ZROOT", "PROG/P", "/root"))

    expect(request.mock.calls[0][0]).toBe("/sap/bc/adt/objectrelations/network")
    expect(sent()).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/vnd.sap.adt.objectrelations.request.v1+xml",
        Accept: "application/vnd.sap.adt.objectrelations.response.network.v1+xml"
      }
    })
    expect(sent().body).toContain(
      '<oro:reference adtcore:uri="/root" adtcore:type="PROG/P" adtcore:name="ZROOT" />'
    )
    expect(sent().body).toContain("<oro:preferredContext>ENV</oro:preferredContext>")
    expect(sent().body).toContain(
      "<oro:desiredContexts><oro:contextId>ENV</oro:contextId><oro:contextId>WUL</oro:contextId></oro:desiredContexts>"
    )
    expect(result.activeContext).toBe("ENV")
    expect(result.contexts[0]).toEqual({
      id: "ENV",
      description: "Used Objects",
      supportsComponents: true,
      supportsGrouping: true,
      supportsReferences: true,
      isDefault: true,
      relevance: 7
    })
    expect(result.objects[0]).toMatchObject({
      id: "/root",
      name: "ZROOT",
      displayName: "Root",
      description: "Root description",
      exists: true,
      canHaveComponents: true
    })
    expect(result.relations[0]).toMatchObject({
      from: "/root",
      to: "/child",
      type: "parentChild",
      state: "A",
      roleFrom: "parent",
      roleTo: "child",
      properties: [{ name: "kind", value: "uses" }]
    })
  })

  test("network with missing optional values", async () => {
    const { http, sent } = setup(
      `<oro:networkResponse xmlns:oro="http://www.sap.com/adt/objectrelations" xmlns:adtcore="http://www.sap.com/adt/core"><oro:objectReference adtcore:name="ZEMPTY" adtcore:type="PROG/P" /></oro:networkResponse>`
    )

    const result = await objectRelationNetwork(
      http,
      ref("ZEMPTY", "PROG/P", "/empty"),
      "WUL",
      []
    )

    expect(sent().body).toContain("<oro:preferredContext>WUL</oro:preferredContext>")
    expect(sent().body).not.toContain("desiredContexts")
    expect(result.activeContext).toBe("")
    expect(result.objects[0]).toMatchObject({ name: "ZEMPTY", uri: "" })
    expect(result.objects[0].exists).toBeUndefined()
  })

  test("components", async () => {
    const { http, request, sent } = setup(componentsXml)

    const result = await objectRelationComponents(
      http,
      ref("ZROOT", "PROG/P", "/root"),
      "BO"
    )

    expect(request.mock.calls[0][0]).toBe("/sap/bc/adt/objectrelations/components")
    expect(sent().headers.Accept).toBe(
      "application/vnd.sap.adt.objectrelations.response.components.v2+xml"
    )
    expect(sent().body).toContain("<oro:preferredContext>BO</oro:preferredContext>")
    expect(result[0]).toMatchObject({
      id: "c1",
      name: "Field",
      type: "DDLS/K",
      displayName: "Field label",
      parentId: "p1",
      properties: [{ name: "key", value: "true" }],
      links: [{ href: "/component", rel: "toDefinition", type: "text", title: "Open" }]
    })
  })

  test("references and anchors", async () => {
    const { http, sent } = setup(referencesXml)

    const result = await objectRelationReferences(
      http,
      ref("ZROOT", "PROG/P", "/root"),
      ref("ZCHILD", "CLAS/OC", "/child")
    )

    expect(sent().body).toContain('context="ENV"')
    expect(sent().body).toContain('<oroRef:from adtcore:uri="/root"')
    expect(sent().body).toContain('<oroRef:to adtcore:uri="/child"')
    expect(result).toEqual({
      numberOfResults: 1,
      from: expect.objectContaining({ name: "ZROOT", type: "PROG/P" }),
      to: expect.objectContaining({ name: "ZCHILD", type: "CLAS/OC" }),
      anchors: [
        {
          uri: "/source#start=1",
          program: "ZROOT",
          include: "I01",
          matches: "1-4",
          snippet: "CALL"
        }
      ]
    })
  })

  test("references without a relation", async () => {
    const { http } = setup(
      '<oroRef:result xmlns:oroRef="http://www.sap.com/adt/objectrelations/references" numberOfResults="0" />'
    )

    const result = await objectRelationReferences(
      http,
      ref("ZROOT", "PROG/P", "/root"),
      ref("ZCHILD", "CLAS/OC", "/child")
    )

    expect(result).toEqual({ numberOfResults: 0, anchors: [] })
  })

  test("relation sets send flat object sets with transport types", async () => {
    const { http, request, sent } = setup(relationSetXml)

    const result = await objectRelationSets(
      http,
      ref("ZLEFT", "PROG/P", "/left"),
      ref("ZRIGHT", "TABL/DT", "/right")
    )

    expect(request.mock.calls[0][0]).toBe("/sap/bc/adt/objectrelations")
    expect(sent().body).toContain('<osl:objectSet xmlns:osl="http://www.sap.com/api/osl"')
    expect(sent().body).toContain('xsi:type="flatObjectSet"')
    expect(sent().body).not.toContain("<osl:flatObjectSet")
    expect(sent().body).toContain('name="ZLEFT" type="PROG"')
    expect(sent().body).toContain('name="ZRIGHT" type="TABL"')
    expect(result).toMatchObject({
      leftTitle: "Left",
      rightTitle: "Right",
      header: "Header",
      relations: [
        { from: "/left", to: "/right", type: "set relation", direction: "left-to-right" }
      ]
    })
  })

  test("escapes names in requests", async () => {
    const { http, sent } = setup(networkXml)

    await objectRelationNetwork(http, ref('Z"<&>', "PROG/P", "/root?a=1&b=2"))

    expect(sent().body).toContain('adtcore:uri="/root?a=1&amp;b=2"')
    expect(sent().body).toContain('adtcore:name="Z&quot;&lt;&amp;&gt;"')
  })

  test("http errors are passed on", async () => {
    const { http, request } = setup("")
    request.mockRejectedValue(new Error("HTTP 500"))

    await expect(
      objectRelationNetwork(http, ref("ZROOT", "PROG/P", "/root"))
    ).rejects.toThrow("HTTP 500")
  })
})
