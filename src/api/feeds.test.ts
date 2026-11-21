import { AdtHTTP } from "../AdtHTTP"
import { feedEntries } from "./feeds"
import { jest } from "@jest/globals"

const atomFeed = (entries: string) => `<?xml version="1.0" encoding="utf-8"?>
<atom:feed xmlns:atom="http://www.w3.org/2005/Atom">
  <atom:title>ATC Verdicts</atom:title>
  <atom:updated>2026-11-20T10:00:00Z</atom:updated>
  ${entries}
</atom:feed>`

const verdict = `<atom:entry>
    <atom:id>0123456789</atom:id>
    <atom:title>Priority 1: ZCL_TEST</atom:title>
    <atom:updated>2026-11-20T09:30:00Z</atom:updated>
    <atom:published>2026-11-20T09:00:00Z</atom:published>
    <atom:author><atom:name>DEVELOPER</atom:name></atom:author>
    <atom:category term="1" label="Priority 1"/>
    <atom:link href="/sap/bc/adt/oo/classes/zcl_test" rel="self" type="text/html"/>
    <atom:summary type="html">&lt;p&gt;Field &amp;quot;FOO&amp;quot; is unused&lt;/p&gt;</atom:summary>
  </atom:entry>`

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

describe("feedEntries", () => {
  test("requests the feed with a query", async () => {
    const { http, request } = setup(atomFeed(""))

    await feedEntries(http, "/sap/bc/adt/atc/feeds/verdicts", "user eq 'DEVELOPER'")

    expect(request).toHaveBeenCalledWith("/sap/bc/adt/atc/feeds/verdicts", {
      method: "GET",
      qs: { $query: "user eq 'DEVELOPER'" },
      headers: { Accept: "application/atom+xml;type=feed" }
    })
  })

  test("sends no query when none is given", async () => {
    const { http, request } = setup(atomFeed(""))

    await feedEntries(http, "/sap/bc/adt/runtime/systemmessages")

    expect((request.mock.calls[0][1] as any).qs).toBeUndefined()
  })

  test("parses the entries", async () => {
    const { http } = setup(atomFeed(verdict))

    const feed = await feedEntries(http, "/sap/bc/adt/atc/feeds/verdicts")

    expect(feed.title).toBe("ATC Verdicts")
    expect(feed.updated?.toISOString()).toBe("2026-11-20T10:00:00.000Z")
    expect(feed.entries).toHaveLength(1)
    const [entry] = feed.entries
    expect(entry).toMatchObject({
      id: "0123456789",
      title: "Priority 1: ZCL_TEST",
      author: "DEVELOPER",
      categories: [{ term: "1", label: "Priority 1" }],
      links: [{ href: "/sap/bc/adt/oo/classes/zcl_test", rel: "self", type: "text/html" }],
      summary: "<p>Field &quot;FOO&quot; is unused</p>",
      summaryType: "html"
    })
    expect(entry.updated?.toISOString()).toBe("2026-11-20T09:30:00.000Z")
    expect(entry.published?.toISOString()).toBe("2026-11-20T09:00:00.000Z")
    expect(entry.content).toBeUndefined()
  })

  test("entries with only an id", async () => {
    const { http } = setup(atomFeed("<atom:entry><atom:id>1</atom:id></atom:entry>"))

    const [entry] = (await feedEntries(http, "/sap/bc/adt/gw/errorlog")).entries

    expect(entry).toEqual({
      id: "1",
      title: "",
      updated: undefined,
      published: undefined,
      author: undefined,
      categories: [],
      links: [],
      summary: "",
      summaryType: "",
      content: undefined
    })
  })

  test("summaries with many entities", async () => {
    const html = "&lt;td&gt;x&lt;/td&gt;".repeat(2000)
    const { http } = setup(
      atomFeed(`<atom:entry><atom:id>1</atom:id><atom:summary type="html">${html}</atom:summary></atom:entry>`)
    )

    const [entry] = (await feedEntries(http, "/sap/bc/adt/runtime/dumps")).entries

    expect(entry.summary).toBe("<td>x</td>".repeat(2000))
  })

  test("an empty feed", async () => {
    const { http } = setup(atomFeed(""))

    expect((await feedEntries(http, "/sap/bc/adt/gw/errorlog")).entries).toEqual([])
  })
})
