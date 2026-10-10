import { AdtHTTP } from "../AdtHTTP"
import {
  createObject,
  isCreatableTypeId,
  NewObjectOptions,
  objectPath,
  validateNewObject
} from "./objectcreator"
import { fullParse } from "../utilities"

describe("table type creation", () => {
  const options: NewObjectOptions = {
    objtype: "TTYP/DA",
    name: "YTABLE_TYPE",
    parentName: "$TMP",
    parentPath: "/sap/bc/adt/packages/%24tmp",
    description: 'Example & "table type"'
  }
  const setup = () => {
    const http = new AdtHTTP(
      "https://example.invalid",
      "testuser",
      "unused",
      "001",
      "EN"
    )
    const request = jest.spyOn(http, "request").mockResolvedValue({
      body: "",
      headers: {},
      status: 201,
      statusText: "Created"
    })
    return { http, request }
  }

  test("recognizes the ADT type and resolves namespaced object URLs", () => {
    expect(isCreatableTypeId("TTYP/DA")).toBe(true)
    expect(objectPath("TTYP/DA", "/EXAMPLE/TABLE_TYPE", "$TMP")).toBe(
      "/sap/bc/adt/ddic/tabletypes/%2FEXAMPLE%2FTABLE_TYPE"
    )
  })

  test("validates using the table type endpoint", async () => {
    const { http, request } = setup()
    request.mockResolvedValue({
      body: '<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><CHECK_RESULT>X</CHECK_RESULT></DATA></asx:values></asx:abap>',
      headers: {},
      status: 200,
      statusText: "OK"
    })
    const validation = {
      objtype: options.objtype as "TTYP/DA",
      objname: options.name,
      packagename: options.parentName,
      description: options.description
    }
    expect((await validateNewObject(http, validation)).success).toBe(true)
    expect(request).toHaveBeenCalledWith(
      "/sap/bc/adt/ddic/tabletypes/validation",
      {
        method: "POST",
        qs: validation
      }
    )
  })

  test.each([undefined, "transport-request"])(
    "creates an XML seed with transport %s",
    async transport => {
      const { http, request } = setup()
      await createObject(http, { ...options, transport })
      expect(request).toHaveBeenCalledTimes(1)
      const [url, config] = request.mock.calls[0]
      expect(url).toBe("/sap/bc/adt/ddic/tabletypes")
      expect(config).toMatchObject({
        method: "POST",
        headers: { "Content-Type": "application/*" },
        qs: transport ? { corrNr: transport } : {}
      })
      const root = fullParse(config?.body || "")["ttyp:tableType"]
      expect(root).toMatchObject({
        "@_xmlns:ttyp": "http://www.sap.com/dictionary/tabletype",
        "@_adtcore:type": "TTYP/DA",
        "@_adtcore:name": options.name,
        "@_adtcore:description": options.description,
        "@_adtcore:responsible": "TESTUSER",
        "adtcore:packageRef": { "@_adtcore:name": "$TMP" }
      })
    }
  )

  test("propagates a rejected creation request", async () => {
    const { http, request } = setup()
    const error = new Error("Creation rejected")
    request.mockRejectedValue(error)
    await expect(createObject(http, { ...options })).rejects.toBe(error)
    expect(request).toHaveBeenCalledTimes(1)
  })
})
