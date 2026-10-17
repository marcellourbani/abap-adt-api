import { CookieJar } from "./AdtSession"

const newJar = () => {
  const resetCsrf = jest.fn()
  return { jar: new CookieJar(resetCsrf), resetCsrf }
}

describe("importing cookies", () => {
  test("accepts name=value pairs from a Cookie header", () => {
    const { jar } = newJar()
    jar.importCookies({ cookieHeader: "MYSAPSSO2=abc%3D; sap-usercontext=x=1" })
    expect(jar.cookieHeader()).toBe("MYSAPSSO2=abc%3D; sap-usercontext=x=1")
  })

  test("merges by default and replaces on request", () => {
    const { jar } = newJar()
    jar.importCookies({ cookieHeader: "a=1; b=2" })
    jar.importCookies({ cookieHeader: "b=3" })
    expect(jar.cookieHeader()).toBe("a=1; b=3")
    jar.importCookies({ cookieHeader: "c=4", replace: true })
    expect(jar.cookieHeader()).toBe("c=4")
  })

  test.each([
    ["no equals sign", "abc"],
    ["empty name", "=value"],
    ["control characters", "a=b\r\nX-Evil: 1"],
    ["space in value", "a=b c"],
    ["bad name", "a b=c"]
  ])("rejects %s without leaking or applying anything", (_, header) => {
    const { jar } = newJar()
    jar.importCookies({ cookieHeader: "ok=1" })
    let message = ""
    try {
      jar.importCookies({ cookieHeader: `x=y; ${header}` })
    } catch (e: any) {
      message = e.message
    }
    expect(message).toMatch(/invalid cookie/i)
    expect(message).not.toContain(header)
    expect(jar.cookieHeader()).toBe("ok=1")
  })

  test("increments the generation on every change", () => {
    const { jar } = newJar()
    const g0 = jar.generation
    jar.importCookies({ cookieHeader: "a=1" })
    const g1 = jar.generation
    jar.clearCookies()
    expect(g1).toBeGreaterThan(g0)
    expect(jar.generation).toBeGreaterThan(g1)
  })
})

describe("response cookies", () => {
  test("are stored by name, keeping only the pair", () => {
    const { jar } = newJar()
    jar.applyResponseCookies([
      "SAP_SESSIONID_A4H_001=abc; path=/; HttpOnly",
      "sap-usercontext=sap-client=001; path=/"
    ])
    expect(jar.cookieHeader()).toBe(
      "SAP_SESSIONID_A4H_001=abc; sap-usercontext=sap-client=001"
    )
  })

  test("replace existing cookies", () => {
    const { jar } = newJar()
    jar.importCookies({ cookieHeader: "a=1" })
    jar.applyResponseCookies(["a=2; path=/"])
    expect(jar.cookieHeader()).toBe("a=2")
  })

  test("Max-Age=0 and past Expires delete", () => {
    const { jar } = newJar()
    jar.importCookies({ cookieHeader: "a=1; b=2; c=3" })
    jar.applyResponseCookies([
      "a=; Max-Age=0; path=/",
      "b=x; Expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"
    ])
    expect(jar.cookieHeader()).toBe("c=3")
  })

  test("Max-Age wins over Expires and future Expires keeps", () => {
    const { jar } = newJar()
    jar.applyResponseCookies([
      "a=1; Max-Age=100; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "b=1; Expires=Fri, 01 Jan 2100 00:00:00 GMT"
    ])
    expect(jar.cookieHeader()).toBe("a=1; b=1")
  })

  test("a single string header is accepted, undefined is ignored", () => {
    const { jar } = newJar()
    jar.applyResponseCookies("a=1; path=/")
    jar.applyResponseCookies(undefined)
    expect(jar.cookieHeader()).toBe("a=1")
  })
})

test("clearing empties the jar and resetting asks for a new CSRF token", () => {
  const { jar, resetCsrf } = newJar()
  jar.importCookies({ cookieHeader: "a=1" })
  jar.clearCookies()
  expect(jar.cookieHeader()).toBe("")
  jar.resetCsrfToken()
  expect(resetCsrf).toHaveBeenCalledTimes(1)
})
