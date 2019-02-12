// these tests call a real system.
// will only work if there's one connected and the environment variables are set
import {
  ADTClient,
  isAdtError,
  isClassStructure,
  isHttpError,
  objectPath
} from "../src"
import { session_types } from "../src/AdtHTTP"
import { create, createHttp } from "./login"

// for older systems
const eat404 = (e: any) => {
  if (!(isHttpError(e) && e.code === 404)) throw e
}
const eatResourceNotFound = (e: any) => {
  if (!(isAdtError(e) && e.type === "ExceptionResourceNotFound")) throw e
}

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
  try {
    const corediscovery = await c.adtCoreDiscovery()
    expect(corediscovery).toBeDefined()
  } catch (e) {
    eatResourceNotFound(e) // for older systems
  }
  const graph = await c.adtCompatibiliyGraph()
  expect(graph).toBeDefined()
})

test("getNodeContents", async () => {
  const c = create()
  const resp = await c.nodeContents("DEVC/K", "BASIS")
  expect(resp).toBeDefined()
  expect(resp.nodes).toBeDefined()
  const known = resp.nodes.find(x => x.OBJECT_NAME === "S_BUPA_API")
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
  const trreg = new RegExp(`${process.env.ADT_SYSTEMID}K9[\d]*`)
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
  expect(info.LOCKS!.HEADER!.TRKORR).toMatch(trreg)
  info = await c.transportInfo(
    "/sap/bc/adt/oo/classes/zapidummylocked",
    "ZAPIDUMMY"
  )
  expect(info).toBeDefined()
  expect(info.LOCKS!.HEADER!.TRKORR).toMatch(trreg)

  info = await c.transportInfo(
    "/sap/bc/adt/functions/groups/ZAPIDUMMYFOOBAR/fmodules/ZBARBAR",
    "ZAPIDUMMY"
  )
  expect(info).toBeDefined()
  expect(info.LOCKS!.HEADER!.TRKORR).toMatch(trreg)
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
  try {
    structure = await c.objectStructure(
      "/sap/bc/adt/vit/wb/object_type/trant/object_name/ZABAPGIT"
    )
    expect(structure).toBeDefined()
  } catch (e) {
    eatResourceNotFound(e) // for older systems
  }
  try {
    // table, uses relative paths
    structure = await c.objectStructure("/sap/bc/adt/ddic/tables/zabapgit")
    expect(structure).toBeDefined()
    expect(ADTClient.mainInclude(structure)).toBe(
      "/sap/bc/adt/ddic/tables/zabapgit/source/main"
    )
  } catch (e) {
    eat404(e) // not supported in older systems
  }
})

test("activateProgram", async () => {
  const c = create()
  const result = await c.activate(
    "zabapgit",
    "/sap/bc/adt/programs/programs/zabapgit"
  )
  expect(result).toBeDefined()
  expect(result.success).toBe(true)
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
    "/sap/bc/adt/programs/programs/ZADTTESTINCLUDE1/source/main"
  )
  expect(result).toBeDefined()
  expect(result).toMatch(/ZADTTESTINCLUDEINC/gim)
})

test("lock_unlock", async () => {
  const c = create()
  const target = "/sap/bc/adt/programs/programs/ZADTTESTINCLUDE1"
  try {
    try {
      await c.lock(target)
      fail("lock should be forbidden when client is stateless")
    } catch (e) {
      // ignore
    }
    c.stateful = session_types.stateful
    const handle = await c.lock(target)
    try {
      await c.lock(target)
      fail("lock should be forbidden when object already locked")
    } catch (e) {
      // ignore
    }
    await c.unLock(target, handle.LOCK_HANDLE)
  } catch (e) {
    throw e
  } finally {
    await c.dropSession()
  }
})

test("searchObject", async () => {
  const c = create()
  const result = await c.searchObject("ZABAP*", "")
  expect(result).toBeDefined()
  expect(result[0]["adtcore:description"]).toBeDefined()
  const prog = result.find(
    sr => sr["adtcore:name"] === "ZABAPGIT" && sr["adtcore:type"] === "PROG/P"
  )
  expect(prog).toBeDefined()
  const result2 = await c.searchObject("ZABAP*", "", 4)
  expect(result2).toBeDefined()
  expect(result2.length).toBe(4)
})

test("searchObject by type", async () => {
  const c = create()
  const result = await c.searchObject("ZABAP*", "PROG/P")
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
  const idx = result.length === 3 ? 1 : 0 // in some systems starts at $TMP, in some it doesn't
  expect(result[idx] && result[idx]["adtcore:name"]).toBe("$ABAPGIT")
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
// test("activate multiple", async () => {
//   const c = create()
//   let result = await c.activate(
//     "ZCL_FOOBAR",
//     "/sap/bc/adt/oo/classes/zcl_foobar"
//   )
//   const inactive = inactiveObjectsInResults(result)
//   result = await c.activate(inactive)
//   expect(result.success).toBeTruthy()
// })

test("lock table", async () => {
  const c = create()
  c.stateful = session_types.stateful
  try {
    const handle = await c.lock("/sap/bc/adt/ddic/tables/zabapgit")
    await c.unLock("/sap/bc/adt/ddic/tables/zabapgit", handle.LOCK_HANDLE)
  } catch (e) {
    eat404(e) // not found on older systems
  } finally {
    await c.dropSession()
  }
})

test("syntax ckeck", async () => {
  const c = create()
  const messages = await c.syntaxCheck(
    "/sap/bc/adt/functions/groups/zapidummyfoobar/includes/lzapidummyfoobartop",
    "/sap/bc/adt/functions/groups/zapidummyfoobar/includes/lzapidummyfoobartop/source/main",
    `FUNCTION-POOL zapidummyfoobar.\n  DATA foo`
  )
  expect(messages).toBeDefined()
  expect(messages.length).toBe(1)
  expect(messages[0].offset).toBe(2)
  expect(messages[0].line).toBe(2)
  expect(messages[0].severity).toBe("E")
})

test("code completion", async () => {
  const c = create()
  const proposals = await c.codeCompletion(
    "/sap/bc/adt/functions/groups/zapidummyfoobar/includes/lzapidummyfoobartop/source/main",
    `FUNCTION-POOL zapidummyfoobar.\nDAT\ndata:foo.`,
    2,
    3
  )
  expect(proposals).toBeDefined()
  expect(proposals.length).toBeGreaterThan(1)
  const dataprop = proposals.find(p => p.IDENTIFIER.toUpperCase() === "DATA")
  expect(dataprop).toBeDefined()
})

test("code completion full", async () => {
  const c = create()
  const result = await c.codeCompletionFull(
    "/sap/bc/adt/functions/groups/zapidummyfoobar/includes/lzapidummyfoobartop/source/main",
    `FUNCTION-POOL zapidummyfoobar.\ndata:foo type ref to cl_salv_table.\nform x.\ncreate object foo`,
    4,
    17,
    "FOO"
  )
  expect(result).toBeDefined()
  expect(result).toMatch(/container/gi)
})

test("code completion elements", async () => {
  const c = create()
  const source = `FUNCTION-POOL zapidummyfoobar.\ndata:foo type ref to cl_salv_table`
  const include =
    "/sap/bc/adt/functions/groups/zapidummyfoobar/includes/lzapidummyfoobartop/source/main"
  const info = await c.codeCompletionElement(include, source, 2, 34)
  expect(info).toBeDefined()
  expect(info.components!.length).toBeGreaterThan(1)
})

test("code references", async () => {
  const c = create()
  const source = `FUNCTION-POOL zapidummyfoobar.\ndata:grid type ref to cl_salv_table.\nif grid is bound.endif.`
  const include =
    "/sap/bc/adt/functions/groups/zapidummyfoobar/includes/lzapidummyfoobartop/source/main"
  const definitionLocation = await c.findDefinition(include, source, 3, 3, 7)
  expect(definitionLocation).toBeDefined()
  expect(definitionLocation.url).toBe(include)
  expect(definitionLocation.line).toBe(2)
  expect(definitionLocation.column).toBe(5)
})

test("Usage references", async () => {
  const c = create()
  const include = "/sap/bc/adt/oo/classes/zcl_abapgit_gui"
  const references = await c.usageReferences(include)

  expect(references).toBeDefined()
  expect(references.length).toBeGreaterThan(2)

  const references2 = await c.usageReferences(include, 1, 5)

  expect(references2).toBeDefined()
  expect(references2.length).toBeGreaterThan(2)
})

test("fix proposals", async () => {
  const c = create()
  const source = `FUNCTION-POOL zapidummyfoobar.\nclass fo definition.\npublic section.
  methods bar.\nendclass.\nclass fo implementation.\nendclass."<`
  const include =
    "/sap/bc/adt/functions/groups/zapidummyfoobar/includes/lzapidummyfoobartop/source/main"
  const fixProposals = await c.fixProposals(include, source, 4, 10)
  expect(fixProposals).toBeDefined()
  expect(fixProposals.length).toBeGreaterThan(0)
  expect(fixProposals[0]["adtcore:type"]).toBe("add_unimplemented_method")
})
