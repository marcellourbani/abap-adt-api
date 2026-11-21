import { AdtHTTP } from "../AdtHTTP"
import { ddicRepositoryAccess } from "./cds"
import { jest } from "@jest/globals"

const ddlReferences = `<?xml version="1.0" encoding="utf-8"?>
<ddl:ddlObjectReferences xmlns:ddl="http://www.sap.com/adt/ddic/ddlsources" xmlns:adtcore="http://www.sap.com/adt/core">
  <ddl:ddlObjectReference adtcore:uri="/sap/bc/adt/ddic/tables/sflight" adtcore:type="TABL/DT" adtcore:name="SFLIGHT" ddl:path="SFLIGHT.CARRID"/>
  <ddl:ddlObjectReference adtcore:uri="not_used" adtcore:type="" adtcore:name="" ddl:path="SFLIGHT.FOO"/>
</ddl:ddlObjectReferences>`

const setup = (body = ddlReferences) => {
  const http = new AdtHTTP("https://example.invalid", "u", "p", "", "")
  const request = jest.spyOn(http, "request").mockResolvedValue({
    body,
    headers: {},
    status: 200,
    statusText: "OK"
  })
  const url = () => `${request.mock.calls[0][0]}`
  return { http, url }
}

const PATH = "/sap/bc/adt/ddic/ddl/ddicrepositoryaccess"

describe("ddicRepositoryAccess", () => {
  test("data source names keep the previous request", async () => {
    const { http, url } = setup()

    await ddicRepositoryAccess(http, "/DMO/I_TRAVEL")

    expect(url()).toBe(`${PATH}?datasource=%2FDMO%2FI_TRAVEL`)
  })

  test("paths keep the previous request", async () => {
    const { http, url } = setup()

    await ddicRepositoryAccess(http, ["SFLIGHT.CARRID", "SFLIGHT.CONNID"])

    expect(url()).toBe(
      `${PATH}?requestScope=all&path=SFLIGHT.CARRID&path=SFLIGHT.CONNID`
    )
  })

  test("exact match and uri resolution are requested on demand", async () => {
    const { http, url } = setup()

    await ddicRepositoryAccess(http, ["SFLIGHT.CARRID"], {
      exactMatch: true,
      uriRequired: true
    })

    expect(url()).toBe(
      `${PATH}?requestScope=all&path=SFLIGHT.CARRID&exactMatch=X&uriRequired=X`
    )
  })

  test("data sources can ask for the uri", async () => {
    const { http, url } = setup()

    await ddicRepositoryAccess(http, "SFLIGHT", { uriRequired: true })

    expect(url()).toBe(`${PATH}?datasource=SFLIGHT&uriRequired=X`)
  })

  test("parses the references", async () => {
    const { http } = setup()

    expect(await ddicRepositoryAccess(http, ["SFLIGHT.CARRID"])).toEqual([
      {
        uri: "/sap/bc/adt/ddic/tables/sflight",
        type: "TABL/DT",
        name: "SFLIGHT",
        path: "SFLIGHT.CARRID"
      },
      { uri: "not_used", type: "", name: "", path: "SFLIGHT.FOO" }
    ])
  })
})
