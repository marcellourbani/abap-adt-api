import { AdtHTTP } from "../AdtHTTP"
import { activate, inactiveObjects } from "./activate"
import { jest } from "@jest/globals"

const setup = (body: string) => {
  const http = new AdtHTTP("https://example.invalid", "u", "p", "", "")
  const request = jest.spyOn(http, "request").mockResolvedValue({
    body,
    headers: {},
    status: 200,
    statusText: "OK"
  })
  const sentBody = () => `${(request.mock.calls[0][1] as any).body}`
  return { http, request, sentBody }
}

const classUri = "/sap/bc/adt/oo/classes/zcl_test"

const iocList = `<?xml version="1.0" encoding="utf-8"?>
<ioc:inactiveObjects xmlns:ioc="http://www.sap.com/abapxml/inactiveCtsObjects" xmlns:adtcore="http://www.sap.com/adt/core">
  <ioc:entry>
    <ioc:object ioc:user="DEVELOPER" ioc:deleted="false">
      <ioc:ref adtcore:uri="${classUri}" adtcore:type="CLAS/OC" adtcore:name="ZCL_TEST" adtcore:parentUri=""/>
    </ioc:object>
    <ioc:transport/>
  </ioc:entry>
</ioc:inactiveObjects>`

const referenceList = `<?xml version="1.0" encoding="utf-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="${classUri}" adtcore:type="CLAS/OC" adtcore:name="ZCL_TEST"/>
  <adtcore:objectReference adtcore:uri="${classUri}/source/main#type=CLAS%2FOM;name=M1" adtcore:type="CLAS/OM/public" adtcore:name="ZCL_TEST                      M1" adtcore:parentUri="${classUri}"/>
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/x" adtcore:name="NOTYPE"/>
</adtcore:objectReferences>`

const messages = (attributes: string) => `<?xml version="1.0" encoding="utf-8"?>
<chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist">
  <msg ${attributes}><shortText><txt>Field "FOO" is unknown.</txt></shortText></msg>
</chkl:messages>`

describe("inactive objects", () => {
  test("ioc format", async () => {
    const { http } = setup(iocList)

    const records = await inactiveObjects(http)

    expect(records).toHaveLength(1)
    expect(records[0].object).toMatchObject({
      "adtcore:uri": classUri,
      "adtcore:type": "CLAS/OC",
      "adtcore:name": "ZCL_TEST",
      user: "DEVELOPER",
      deleted: false
    })
  })

  test("objectReferences format, incomplete references are skipped", async () => {
    const { http } = setup(referenceList)

    const records = await inactiveObjects(http)

    expect(records.map(r => r.object?.["adtcore:type"])).toEqual([
      "CLAS/OC",
      "CLAS/OM/public"
    ])
    expect(records[0].object).toEqual({
      "adtcore:uri": classUri,
      "adtcore:type": "CLAS/OC",
      "adtcore:name": "ZCL_TEST",
      "adtcore:parentUri": "",
      user: "",
      deleted: false
    })
    expect(records[1].object?.["adtcore:parentUri"]).toBe(classUri)
  })
})

describe("activation request", () => {
  test("by name, with main program context", async () => {
    const { http, sentBody } = setup("")

    await activate(
      http,
      "ZTEST_I01",
      "/sap/bc/adt/programs/includes/ztest_i01",
      "/sap/bc/adt/programs/programs/ztest"
    )

    expect(sentBody()).toContain(
      '<adtcore:objectReference adtcore:uri="/sap/bc/adt/programs/includes/ztest_i01?context=%2Fsap%2Fbc%2Fadt%2Fprograms%2Fprograms%2Fztest" adtcore:name="ZTEST_I01"/>'
    )
  })

  test("objects leave out an empty parent and escape attributes", async () => {
    const { http, sentBody } = setup("")

    await activate(http, [
      {
        "adtcore:uri": classUri,
        "adtcore:type": "CLAS/OC",
        "adtcore:name": "ZCL_TEST",
        "adtcore:parentUri": ""
      },
      {
        "adtcore:uri": `${classUri}/source/main#type=CLAS%2FOM;name=M1&x`,
        "adtcore:type": "CLAS/OM/public",
        "adtcore:name": 'ZCL_TEST "M1"',
        "adtcore:parentUri": classUri
      }
    ])

    const body = sentBody()
    expect(body).toContain(
      `<adtcore:objectReference adtcore:uri="${classUri}" adtcore:type="CLAS/OC" adtcore:name="ZCL_TEST"/>`
    )
    expect(body).not.toContain('adtcore:parentUri=""')
    expect(body).toContain(`name=M1&amp;x"`)
    expect(body).toContain(`adtcore:parentUri="${classUri}"`)
    expect(body).toContain('adtcore:name="ZCL_TEST &quot;M1&quot;"')
  })
})

describe("activation response", () => {
  test("no body is a success", async () => {
    const { http } = setup("")

    expect(await activate(http, "ZTEST", "/sap/bc/adt/programs/programs/ztest")).toEqual({
      success: true,
      messages: [],
      inactive: []
    })
  })

  test("errors fail the activation", async () => {
    const { http } = setup(
      messages('objDescr="Program ZTEST" type="E" line="1" href="/x" forceSupported="true"')
    )

    const result = await activate(http, "ZTEST", "/sap/bc/adt/programs/programs/ztest")

    expect(result.success).toBe(false)
    expect(result.messages[0]).toMatchObject({
      objDescr: "Program ZTEST",
      type: "E",
      line: 1,
      href: "/x",
      forceSupported: true,
      shortText: 'Field "FOO" is unknown.'
    })
  })

  test("warnings do not fail the activation", async () => {
    const { http } = setup(messages('type="W" objDescr="Program ZTEST"'))

    const result = await activate(http, "ZTEST", "/sap/bc/adt/programs/programs/ztest")

    expect(result.success).toBe(true)
    expect(result.messages[0].type).toBe("W")
  })

  test("prefixed message attributes", async () => {
    const { http } = setup(messages('chkl:type="E" chkl:objDescr="Program ZTEST" chkl:line="3"'))

    const result = await activate(http, "ZTEST", "/sap/bc/adt/programs/programs/ztest")

    expect(result.success).toBe(false)
    expect(result.messages[0]).toMatchObject({ type: "E", objDescr: "Program ZTEST", line: 3 })
  })

  test("a message without type does not throw", async () => {
    const { http } = setup(messages('objDescr="Program ZTEST"'))

    const result = await activate(http, "ZTEST", "/sap/bc/adt/programs/programs/ztest")

    expect(result.success).toBe(true)
    expect(result.messages[0].type).toBe("")
  })

  test("objects to activate together fail the activation", async () => {
    const { http } = setup(iocList)

    const result = await activate(http, "ZCL_TEST", classUri)

    expect(result.success).toBe(false)
    expect(result.inactive[0].object?.["adtcore:name"]).toBe("ZCL_TEST")
  })
})
