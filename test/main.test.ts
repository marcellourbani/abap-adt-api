// these tests call a real system.
// will only work if there's one connected and the environment variables are set
import {
  ADTClient,
  inactiveObjectsInResults,
  isClassStructure,
  objectPath
} from "../src"
import { session_types } from "../src/AdtHTTP"
import { create, createHttp } from "./login"

test("login", async () => {
  const c = createHttp()
  expect(c).toBeDefined()
  await c.login()
  expect(c.csrfToken).not.toEqual("fetch")
})

test("logout", async () => {
  const c = createHttp()
  expect(c).toBeDefined()
  await c.login()
  expect(c.csrfToken).not.toEqual("fetch")
  await c.logout()
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

test("discovery", async () => {
  const c = create()
  const discovery = await c.adtDiscovery()
  expect(discovery).toBeDefined()
  const corediscovery = await c.adtCoreDiscovery()
  expect(corediscovery).toBeDefined()
  const graph = await c.adtCompatibiliyGraph()
  expect(graph).toBeDefined()
})

test("getNodeContents", async () => {
  const c = create()
  const resp = await c.nodeContents("DEVC/K", "$ABAPGIT")
  expect(resp).toBeDefined()
  expect(resp.nodes).toBeDefined()
  const known = resp.nodes.find(x => x.OBJECT_NAME === "ZABAPGIT")
  expect(known).toBeDefined()
})

test("emptyNodeContents", async () => {
  const c = create()
  const resp = await c.nodeContents("DEVC/K", "/FOO/BARFOOFOOTERTQWERWER")
  expect(resp.nodes.length).toBe(0)
})

test("getReentranceTicket", async () => {
  const c = create()
  const ticket = await c.reentranceTicket()
  expect(ticket).toBeDefined()
  expect(ticket.match(/^[\w+/\!]+=*$/)).toBeDefined()
})

test("getTransportInfo", async () => {
  const c = create()
  let info = await c.transportInfo(
    "/sap/bc/adt/oo/classes/zapidummytestcreation/source/main",
    "ZAPIDUMMY"
  )
  expect(info).toBeDefined()
  expect(info.RECORDING).toEqual("X")
  expect(info.TRANSPORTS.length).toBeGreaterThan(0)
  info = await c.transportInfo(
    "/sap/bc/adt/oo/classes/zapidummylocked/source/main",
    "ZAPIDUMMY"
  )
  expect(info).toBeDefined()
  expect(info.RECORDING).toEqual("")
  expect(info.LOCKS!.HEADER!.TRKORR).toMatch(/NPLK9[\d]*/)
  info = await c.transportInfo(
    "/sap/bc/adt/oo/classes/zapidummylocked",
    "ZAPIDUMMY"
  )
  expect(info).toBeDefined()
  expect(info.LOCKS!.HEADER!.TRKORR).toMatch(/NPLK9[\d]*/)

  info = await c.transportInfo(
    "/sap/bc/adt/functions/groups/ZAPIDUMMYFOOBAR/fmodules/ZBARBAR",
    // "/sap/bc/adt/functions/groups/zapidummyfoobar/fmodules/zbarbar",
    "ZAPIDUMMY"
  )
  expect(info).toBeDefined()
  expect(info.LOCKS!.HEADER!.TRKORR).toMatch(/NPLK9[\d]*/)
})

test("objectPath", async () => {
  const c = create()
  const path = objectPath("CLAS/OC", "zapidummytestcreation", "")
  expect(path).toBe("/sap/bc/adt/oo/classes/zapidummytestcreation")
  const info = await c.transportInfo(path, "ZAPIDUMMY")
  expect(info).toBeDefined()
  expect(info.RECORDING).toEqual("X")
  expect(info.TRANSPORTS.length).toBeGreaterThan(0)
})

test("badTransportInfo", async () => {
  const c = create()
  try {
    const info = await c.transportInfo(
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
  structure = await c.objectStructure(
    "/sap/bc/adt/vit/wb/object_type/trant/object_name/ZABAPGIT"
  )
  expect(structure).toBeDefined()
  // table, uses relative paths
  structure = await c.objectStructure("/sap/bc/adt/ddic/tables/zabapgit")
  expect(structure).toBeDefined()
  expect(ADTClient.mainInclude(structure)).toBe(
    "/sap/bc/adt/ddic/tables/zabapgit/source/main"
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
  const result = await c.mainPrograms(
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
    throw e
  } finally {
    await c.dropSession()
  }
})

test("searchObject", async () => {
  const c = create()
  const result = await c.searchObject("zabap*")
  expect(result).toBeDefined()
  const prog = result.find(
    sr => sr["adtcore:name"] === "ZABAPGIT" && sr["adtcore:type"] === "PROG/P"
  )
  expect(prog).toBeDefined()
  const result2 = await c.searchObject("zabap*", "", 4)
  expect(result2).toBeDefined()
  expect(result2.length).toBe(4)
})

test("searchObject by type", async () => {
  const c = create()
  const result = await c.searchObject("zabap*", "PROG/P")
  expect(result).toBeDefined()
  result.forEach(r =>
    expect(r["adtcore:type"].replace(/\/.*$/, "")).toBe("PROG")
  )
})

test("findObjectPath", async () => {
  const c = create()
  const result = await c.findObjectPath(
    "/sap/bc/adt/programs/programs/zabapgit"
  )
  expect(result).toBeDefined()
  expect(result[1] && result[1]["adtcore:name"]).toBe("$ABAPGIT")
})

test("validateNewFM", async () => {
  const c = create()
  const result = await c.validateNewObject({
    description: "a fm",
    fugrname: "ZAPIDUMMYFOOBAR",
    objname: "ZFOOBARFEWFWE",
    objtype: "FUGR/FF"
  })
  expect(result.success).toBeTruthy()
})

test("validateClass", async () => {
  const c = create()
  const result = await c.validateNewObject({
    description: "a class",
    objname: "ZFOOBARFEWFWE",
    objtype: "CLAS/OC",
    packagename: "$TMP"
  })
  expect(result.success).toBeTruthy()
})

test("validateExistingClass", async () => {
  const c = create()
  try {
    await c.validateNewObject({
      description: "a class",
      objname: "ZCL_ABAPGIT_GUI",
      objtype: "CLAS/OC",
      packagename: "$TMP"
    })
    fail("Existing object should fail validation")
  } catch (e) {
    //
  }
})

test("loadTypes", async () => {
  const c = create()
  const result = await c.loadTypes()
  expect(result).toBeDefined()
  const groupinc = result.find(t => t.OBJECT_TYPE === "FUGR/I")
  expect(groupinc).toBeDefined()
})

test("objectRegistration", async () => {
  const c = create()
  const result = await c.objectRegistrationInfo(
    "/sap/bc/adt/programs/programs/zabapgit"
  )
  expect(result).toBeDefined()
})

test("stateless clone", async () => {
  const c = create()
  const clone = c.statelessClone
  expect(clone.statelessClone).toBe(clone)
  try {
    clone.stateful = session_types.stateful
    fail("Stateless clone must stay stateless")
  } catch (e) {
    // ignore
  }
  expect(clone.stateful).toBe(session_types.stateless)
  const result = await clone.objectRegistrationInfo(
    "/sap/bc/adt/programs/programs/zabapgit"
  )
  expect(result).toBeDefined()
})

// disabled as test case is missing
test("activate multiple", async () => {
  return
  const c = create()
  let result = await c.activate(
    "ZCL_FOOBAR",
    "/sap/bc/adt/oo/classes/zcl_foobar"
  )
  const inactive = inactiveObjectsInResults(result)
  result = await c.activate(inactive)
  expect(result.success).toBeTruthy()
})

test("lock table", async () => {
  const c = create()
  c.stateful = session_types.stateful
  try {
    const handle = await c.lock("/sap/bc/adt/ddic/tables/zabapgit")
    await c.unLock("/sap/bc/adt/ddic/tables/zabapgit", handle.LOCK_HANDLE)
  } catch (e) {
    throw e
  } finally {
    await c.dropSession()
  }
})
