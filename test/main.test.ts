// these tests call a real system.
// will only work if there's one connected and the environment variables are set
import { ADTClient, isClassStructure } from "../src"
import { session_types } from "../src/AdtHTTP"
import { create, createHttp } from "./login"

test("login", async () => {
  const c = createHttp()
  expect(c).toBeDefined()
  await c.login()
  expect(c.csrfToken).not.toEqual("fetch")
})

test("badToken", async () => {
  const c = createHttp("DE")
  await c.login()
  expect(c.csrfToken).not.toEqual("fetch")
  c.csrfToken = "bad" // will trigger a bad login
  const response = await c.request("/sap/bc/adt/repository/nodestructure", {
    method: "POST",
    params: { parent_name: "$ABAPGIT", parent_type: "DEVC/K" }
  })
  expect(c.csrfToken).not.toEqual("bad") // will be reset by the new login
  expect(response.data).toBeDefined()
})

test("getNodeContents", async () => {
  const c = create()
  const resp = await c.getNodeContents({
    parent_name: "$ABAPGIT",
    parent_type: "DEVC/K"
  })
  expect(resp).toBeDefined()
  expect(resp.nodes).toBeDefined()
  const known = resp.nodes.find(x => x.OBJECT_NAME === "ZABAPGIT")
  expect(known).toBeDefined()
})

test("emptyNodeContents", async () => {
  const c = create()
  const resp = await c.getNodeContents({
    parent_name: "/FOO/BARFOOFOOTERTQWERWER",
    parent_type: "DEVC/K"
  })
})

test("getReentranceTicket", async () => {
  const c = create()
  const ticket = await c.getReentranceTicket()
  expect(ticket).toBeDefined()
  expect(ticket.match(/^[\w+/\!]+=*$/)).toBeDefined()
})

test("getTransportInfo", async () => {
  const c = create()
  let info = await c.getTransportInfo(
    "/sap/bc/adt/oo/classes/zapidummytestcreation/source/main",
    "ZAPIDUMMY"
  )
  expect(info).toBeDefined()
  expect(info.RECORDING).toEqual("X")
  expect(info.TRANSPORTS.length).toBeGreaterThan(0)
  info = await c.getTransportInfo(
    "/sap/bc/adt/oo/classes/zapidummylocked/source/main",
    "ZAPIDUMMY"
  )
  expect(info).toBeDefined()
  expect(info.RECORDING).toEqual("")
  expect(info.LOCKS!.HEADER!.TRKORR).toMatch(/NPLK9[\d]*/)
  info = await c.getTransportInfo(
    "/sap/bc/adt/oo/classes/zapidummylocked",
    "ZAPIDUMMY"
  )
  expect(info).toBeDefined()
  expect(info.LOCKS!.HEADER!.TRKORR).toMatch(/NPLK9[\d]*/)
})

test("badTransportInfo", async () => {
  const c = create()
  try {
    const info = await c.getTransportInfo(
      "/sap/bc/adt/oo/classes/zapidummytestcreation/foo/bar",
      "ZAPIDUMMY"
    )
    fail("Exception expected for invalid object URL")
  } catch (e) {
    expect(e).toBeDefined()
  }
})

test("objectStructure", async () => {
  const c = create()
  let structure = await c.objectStructure(
    "/sap/bc/adt/programs/programs/zabapgit"
  )
  expect(structure.links).toBeDefined()
  expect(structure.links!.length).toBeGreaterThan(0)
  expect(ADTClient.mainInclude(structure)).toBe(
    "/sap/bc/adt/programs/programs/zabapgit/source/main"
  )
  structure = await c.objectStructure(
    "/sap/bc/adt/functions/groups/zabapgit_parallel"
  )
  expect(structure.links).toBeDefined()
  expect(structure.links!.length).toBeGreaterThan(0)
  expect(ADTClient.mainInclude(structure)).toBe(
    "/sap/bc/adt/functions/groups/zabapgit_parallel/source/main"
  )
  structure = await c.objectStructure(
    "/sap/bc/adt/oo/classes/zcl_abapgit_dot_abapgit"
  )
  if (!isClassStructure(structure)) throw new Error("ss")
  expect(structure.includes.length).toBeGreaterThan(0)
  expect(ADTClient.mainInclude(structure)).toBe(
    "/sap/bc/adt/oo/classes/zcl_abapgit_dot_abapgit/source/main"
  )
  expect(ADTClient.classIncludes(structure).get("definitions")).toBe(
    "/sap/bc/adt/oo/classes/zcl_abapgit_dot_abapgit/includes/definitions"
  )
})

test("activateProgram", async () => {
  const c = create()
  let result = await c.activate(
    "zabapgit",
    "/sap/bc/adt/programs/programs/zabapgit"
  )
  expect(result).toBeDefined()
  expect(result.success).toBe(true)

  result = await c.activate(
    "zadttestinactive",
    "/sap/bc/adt/programs/programs/zadttestinactive"
  )
  expect(result).toBeDefined()
  expect(result.success).toBe(false)
})

test("getMainPrograms", async () => {
  const c = create()
  const result = await c.getMainPrograms(
    "/sap/bc/adt/programs/includes/zadttestincludeinc"
  )
  expect(result).toBeDefined()
  expect(result.length).toBe(2)
  expect(result[0]["adtcore:name"]).toBe("ZADTTESTINCLUDE1")
})

test("getObjectSource", async () => {
  const c = create()
  const result = await c.getObjectSource(
    "/sap/bc/adt/programs/programs/zadttestinactive/source/main"
  )
  expect(result).toBeDefined()
  expect(result).toMatch(/Hello, World/gm)
})

test("lock_unlock", async () => {
  const c = create()
  try {
    try {
      await c.lock("/sap/bc/adt/programs/programs/zadttestinactive")
      fail("lock should be forbidden when client is stateless")
    } catch (e) {
      // ignore
    }
    c.stateful = session_types.stateful
    const handle = await c.lock(
      "/sap/bc/adt/programs/programs/zadttestinactive"
    )
    try {
      await c.lock("/sap/bc/adt/programs/programs/zadttestinactive")
      fail("lock should be forbidden when object already locked")
    } catch (e) {
      // ignore
    }
    await c.unLock(
      "/sap/bc/adt/programs/programs/zadttestinactive",
      handle.LOCK_HANDLE
    )
  } catch (e) {
    c.stateful = session_types.stateless
    await c.getObjectSource(
      "/sap/bc/adt/programs/programs/zadttestinactive/source/main"
    )
    throw e
  }
  c.stateful = session_types.stateless
  await c.getObjectSource(
    "/sap/bc/adt/programs/programs/zadttestinactive/source/main"
  )
})
