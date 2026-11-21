import { AdtHTTP } from "../AdtHTTP"
import { atcVariants } from "./atc"
import { jest } from "@jest/globals"

const variantsXml = (items: string) => `<?xml version="1.0" encoding="utf-8"?>
<nameditem:namedItemList xmlns:nameditem="http://www.sap.com/adt/nameditem">${items}</nameditem:namedItemList>`

const item = (name: string, description: string) => `
  <nameditem:namedItem>
    <nameditem:name>${name}</nameditem:name>
    <nameditem:description>${description}</nameditem:description>
    <nameditem:data></nameditem:data>
  </nameditem:namedItem>`

const setup = (body: string) => {
  const http = new AdtHTTP("https://example.invalid", "u", "p", "", "")
  const request = jest.spyOn(http, "request").mockResolvedValue({
    body,
    headers: {},
    status: 200,
    statusText: "OK"
  })
  return { http, request }
}

describe("atcVariants", () => {
  test("requests the named items with query and maximum", async () => {
    const { http, request } = setup(variantsXml(""))

    await atcVariants(http, "Z*", 50)

    expect(request).toHaveBeenCalledWith("/sap/bc/adt/atc/variants", {
      qs: { maxItemCount: 50, name: "Z*" },
      headers: { Accept: "application/vnd.sap.adt.nameditems.v1+xml" }
    })
  })

  test("defaults to all variants, at most 100", async () => {
    const { http, request } = setup(variantsXml(""))

    await atcVariants(http)

    expect(request.mock.calls[0][1]).toMatchObject({
      qs: { maxItemCount: 100, name: "*" }
    })
  })

  test("parses the variants", async () => {
    const body = variantsXml(
      item("DEFAULT", "Default variant") + item("/SDF/B2S_SFIN", "")
    )
    const { http } = setup(body)

    expect(await atcVariants(http)).toEqual([
      { name: "DEFAULT", description: "Default variant" },
      { name: "/SDF/B2S_SFIN", description: "" }
    ])
  })

  test("keeps numeric looking names as text", async () => {
    const { http } = setup(variantsXml(item("0001", "Numbered")))

    expect(await atcVariants(http)).toEqual([
      { name: "0001", description: "Numbered" }
    ])
  })

  test("returns no variants for an empty list", async () => {
    const { http } = setup(variantsXml(""))

    expect(await atcVariants(http)).toEqual([])
  })
})
