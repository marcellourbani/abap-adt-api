// these tests call a real system.
// will only work if there's one connected and the environment variables are set
import { isArray, isString } from "util"
import {
  ADTClient,
  isAdtError,
  isClassStructure,
  isHttpError,
  objectPath,
  UnitTestAlertKind
} from "../"
import { session_types } from "../AdtHTTP"
import { classIncludes } from "../api"
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

test("logout http", async () => {
  const c = createHttp()
  expect(c).toBeDefined()
  await c.login()
  expect(c.csrfToken).not.toEqual("fetch")
  await c.logout()
  try {
    // we want to prevent autologins
    await c.login()
    fail("still logged in")
  } catch (error) {
    // ignore
  }
})

test("badToken", async () => {
  const c = createHttp("DE")
  await c.login()
  expect(c.csrfToken).not.toEqual("fetch")
  c.csrfToken = "bad" // will trigger a bad login
  const response = await c.request("/sap/bc/adt/repository/nodestructure", {
    method: "POST",
    qs: { parent_name: "$ABAPGIT", parent_type: "DEVC/K" }
  })
  expect(c.csrfToken).not.toEqual("bad") // will be reset by the new login
  expect(response.body).toBeDefined()
})

test("logout client", async () => {
  const c = create()
  expect(c).toBeDefined()
  await c.login()
  expect(c.csrfToken).not.toEqual("fetch")
  await c.logout()
  await c.login()
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

test("getNodeContents $TMP", async () => {
  const c = create()
  const resp = await c.nodeContents("DEVC/K", "$TMP")
  expect(resp).toBeDefined()
  expect(resp.nodes).toBeDefined()
  const known = resp.nodes.find(x => x.OBJECT_NAME === "ZADTTESTINCLUDE1")
  expect(known).toBeDefined()
})

test("emptyNodeContents", async () => {
  const c = create()
  const resp = await c.nodeContents("DEVC/K", "/FOO/BARFOOFOOTERTQWERWER")
  expect(resp.nodes.length).toBe(0)
})

test("NodeContents prog", async () => {
  const c = create()
  const resp = await c.nodeContents("PROG/P", "ZABAPGIT")
  let fragment = await c.fragmentMappings(
    "/sap/bc/adt/programs/programs/zabapgit/source/main",
    "PROG/PD",
    "1001"
  )
  expect(fragment).toBeDefined()
  expect(fragment.line).toBeGreaterThan(20)
  fragment = await c.fragmentMappings(
    "/sap/bc/adt/programs/programs/zabapgit/source/main",
    "PROG/PE",
    "AT ... ON EXIT-COMMAND"
  )
  expect(fragment).toBeDefined()
  expect(fragment.line).toBe(66)
  expect(resp.nodes.length).toBeGreaterThan(5) // 19?
})
// will fail in older systems
test("NodeContents include", async () => {
  const c = create()
  // really a PROG/I, but only works if we lie...
  const resp = await c.nodeContents("PROG/PI", "ZABAPGIT_PASSWORD_DIALOG")
  let fragment = await c.fragmentMappings(
    "/sap/bc/adt/programs/programs/zabapgit_password_dialog/source/main",
    "PROG/PLA",
    "LCL_PASSWORD_DIALOG           GV_CONFIRM"
  )
  expect(fragment).toBeDefined()
  expect(fragment.line).toBe(47)
  fragment = await c.fragmentMappings(
    "/sap/bc/adt/programs/programs/zabapgit_password_dialog/source/main",
    "PROG/PD",
    "P_URL"
  )
  expect(fragment).toBeDefined()
  expect(fragment.line).toBe(9)
  expect(resp.nodes.length).toBeGreaterThan(5) // 19?
})

test("getReentranceTicket", async () => {
  const c = create()

  try {
    const ticket = await c.reentranceTicket()
    expect(ticket).toBeDefined()
    expect(ticket.match(/^[\w+/\!]+=*$/)).toBeDefined()
  } catch (e) {
    // ignore system not configured for SSO tickets
    if (
      !(
        isAdtError(e) &&
        e.type === "ExceptionSecurityTicketFailure" &&
        e.message === "This system rejects all logons using SSO tickets"
      )
    )
      throw e
  }
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
    `FUNCTION-POOL zapidummyfoobar.\n raise exception type cx_root.\n  DATA foo`
  )
  expect(messages).toBeDefined()
  expect(messages.length).toBe(2)
  expect(messages[1].offset).toBe(2)
  expect(messages[1].line).toBe(3)
  expect(messages[0].severity).toBe("E")
  const quoteFound = messages[0].text.includes("&quot;")
  expect(quoteFound).toBeFalsy()
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
  expect(proposals.length).toBeGreaterThan(0)
  const dataprop = proposals.find(p => p.IDENTIFIER.toUpperCase() === "DATA")
  expect(dataprop).toBeDefined()
})

test("code completion field-symbol", async () => {
  const c = create()
  const source = `FUNCTION-POOL zapidummyfoobar.\ndata:foo.field-symbols:<foo> type any.\nassign foo to     `
  const proposals = await c.codeCompletion(
    "/sap/bc/adt/functions/groups/zapidummyfoobar/includes/lzapidummyfoobartop/source/main",
    source,
    3,
    14
  )
  expect(proposals).toBeDefined()
  expect(proposals.length).toBeGreaterThan(0)
  const dataprop = proposals.find(p => p.IDENTIFIER.toUpperCase() === "<FOO>")
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

// not supported in older releases
test("code completion elements", async () => {
  const c = create()
  const source = `FUNCTION-POOL zapidummyfoobar.\ndata:foo type ref to cl_salv_table`
  const include =
    "/sap/bc/adt/functions/groups/zapidummyfoobar/includes/lzapidummyfoobartop/source/main"
  const info = await c.codeCompletionElement(include, source, 2, 34)
  if (isString(info)) expect(info.length).toBeGreaterThan(2)
  else {
    expect(info).toBeDefined()
    expect(info.components!.length).toBeGreaterThan(1)
  }
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
  expect(references2[1].objectIdentifier.length).toBeGreaterThan(0)

  const snippets = await c.usageReferenceSnippets(references)
  expect(snippets).toBeDefined()

  snippets.forEach(o => {
    {
      const ref = references.find(
        r => r.objectIdentifier === o.objectIdentifier
      )
      expect(ref).toBeDefined()
      expect(ref && ref["adtcore:type"]).toBeTruthy()
      o.snippets.forEach(s =>
        expect(s.uri.start && s.uri.start.line).toBeDefined()
      )
    }
  })
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
  const edits = await c.fixEdits(fixProposals[0], source)
  expect(edits.length).toBeGreaterThan(0)
  const edit = edits[0]
  expect(edit && edit.content.match(/method\s+bar\./)).toBeTruthy()
  expect(edit && edit.range.start.line).toBe(7)
  expect(edit && edit.range.start.column).toBe(0)
})

test("fix proposals reverse", async () => {
  const c = create()

  const source = `CLASS z_adt_testcase_class1 DEFINITION PUBLIC CREATE PUBLIC .ENDCLASS.
CLASS z_adt_testcase_class1 IMPLEMENTATION.
  METHOD foo.
  ENDMETHOD.
ENDCLASS.`
  const uri = "/sap/bc/adt/oo/classes/z_adt_testcase_class1/source/main"

  const fixProposals = await c.fixProposals(uri, source, 3, 10)
  expect(fixProposals).toBeDefined()
  expect(fixProposals.length).toBeGreaterThan(0)
  expect(fixProposals[0]["adtcore:type"]).toBe("create_method_def")
  const edits = await c.fixEdits(fixProposals[0], source)
  expect(edits.length).toBeGreaterThan(0)
  const edit = edits[0]
  expect(edit && edit.content.match(/methods\s+foo\./gi)).toBeTruthy()
  expect(edit && edit.range.start.line).toBe(1)
  expect(edit && edit.range.start.column).toBe(61)
})
const findBy = <T, K extends keyof T>(
  array: T[],
  fname: K,
  value: T[K],
  cs = false
): T | undefined => {
  if (!isArray(array) || !isString(value)) return
  return cs
    ? array.find(e => e[fname] === value)
    : array.find(e => {
        const cur = e[fname]
        return isString(cur) && cur.toUpperCase() === value.toUpperCase()
      })
}

test("unit test", async () => {
  const c = create()
  const testResults = await c.runUnitTest(
    "/sap/bc/adt/programs/programs/zadtunitcases"
  )
  expect(testResults).toBeDefined()
  expect(testResults.length).toBe(2)
  // expect some test methods to be ok, some to fail
  const class1 = findBy(testResults, "adtcore:name", "LCL_TEST1")
  expect(class1).toBeDefined()
  if (class1) {
    const testok = findBy(class1.testmethods, "adtcore:name", "TEST_OK")
    expect(testok).toBeDefined()
    expect(testok!.alerts.length).toBe(0)
    const testfail = findBy(class1.testmethods, "adtcore:name", "TEST_FAILURE")
    expect(testfail).toBeDefined()
    expect(testfail!.alerts.length).toBe(2)
    const failure = findBy(
      testfail!.alerts,
      "kind",
      UnitTestAlertKind.failedAssertion
    )
    expect(failure).toBeDefined()
    expect(failure!.stack[0]).toBeDefined()
  }
})

test("class components", async () => {
  const c = create()
  const structure = await c.classComponents(
    "/sap/bc/adt/oo/classes/zcl_abapgit_git_pack"
  )
  expect(structure).toBeDefined()
  expect(structure["adtcore:name"]).toBe("ZCL_ABAPGIT_GIT_PACK")
  const met = structure.components.find(
    co =>
      !!co["adtcore:type"].match(/CLAS\/OO|M/) &&
      co["adtcore:name"] === "ENCODE_TAG"
  )
  expect(met).toBeDefined()
  expect(met && met.links && met.links.length).toBeGreaterThan(0)
})

test("source fragments", async () => {
  const c = create()
  const fragment = await c.fragmentMappings(
    "/sap/bc/adt/functions/groups/zapidummyfoobar/includes/lzapidummyfoobartop/source/main",
    "FUGR/PD",
    "FOO"
  )
  expect(fragment).toBeDefined()
  expect(fragment.line).toBe(4)
})

test("syntax ckeck bis", async () => {
  const c = create()
  const messages = await c.syntaxCheck(
    "/sap/bc/adt/programs/includes/zadttestincludeinc",
    "/sap/bc/adt/programs/includes/zadttestincludeinc/source/main",
    `form foo.\nendform.\naaa`,
    "/sap/bc/adt/programs/programs/zadttestinclude1"
  )
  expect(messages).toBeDefined()
  expect(messages.length).toBe(1)
  expect(messages[0].severity).toBe("E")
})

test("FM definition", async () => {
  const c = create()
  const source =
    "*&---------------------------------------------------------------------*\n" +
    "*& Report ZADTTESTINCLUDE1\n" +
    "*&---------------------------------------------------------------------*\n" +
    "*&\n" +
    "*&---------------------------------------------------------------------*\n" +
    "REPORT ZADTTESTINCLUDE1.\n" +
    "include ZADTTESTINCLUDEINC.\n" +
    "START-OF-SELECTION.\n" +
    "PERFORM foo.\n" +
    "call FUNCTION 'ZBARFM'."
  const include = "/sap/bc/adt/programs/programs/zadttestinclude1/source/main"
  const definitionLocation = await c.findDefinition(include, source, 10, 15, 21)
  expect(definitionLocation).toBeDefined()
  expect(definitionLocation.url.length).toBeGreaterThan(1)
})

test("Object types", async () => {
  const c = create()
  const types = await c.objectTypes()
  const type = types.find(x => x.type === "PROG/P")
  expect(type && type.name).toBe("REPO")
})

test("check types", async () => {
  const c = create()
  const types = await c.syntaxCheckTypes()
  expect(types).toBeDefined()
  const type = types.get("abapCheckRun")
  expect(type && type.find(x => !!x.match("PROG"))).toBeDefined()
})

test("transport selection for older boxes", async () => {
  const c = create()
  const info = await c.transportInfo(
    "/sap/bc/adt/programs/programs/ztestmu2/source/main",
    "",
    ""
  )
  expect(info).toBeDefined()
  if (process.env.ADT_OLDSYSTEM)
    expect(info.TRANSPORTS.length).toBeGreaterThan(1)
})

test("pretty printer", async () => {
  const c = create()
  const unformatted = "REPORT hello.write:/, 'Hello,world'."
  const formatted = await c.prettyPrinter(unformatted)
  expect(formatted).toBeDefined()
  expect(formatted).toMatch(/report/)
})

test("code references2", async () => {
  const c = create()
  const src = `REPORT zstatetest.
  DATA:foo TYPE TABLE OF string.
  FIELD-SYMBOLS:<fs> LIKE LINE OF foo.
  LOOP AT foo ASSIGNING <fs>.
    cl_http_utility=>escape_html( '' ).
    cl_http_utility=>if_http_utility~escape_html( '' ).
  ENDLOOP.`
  const incl = "/sap/bc/adt/programs/programs/zstatetest/source/main"
  const definitionLocation = await c.findDefinition(incl, src, 5, 21, 32, true)
  expect(definitionLocation).toBeDefined()
  expect(definitionLocation.url).toBe(
    "/sap/bc/adt/oo/classes/cl_http_utility/source/main"
  )
  expect(definitionLocation.line).toBe(460)
  expect(definitionLocation.column).toBe(7)
})

test("type hierarchy children", async () => {
  const c = create()
  const source = `INTERFACE z_adt_testcase_intf1 PUBLIC .
  METHODS dosomething IMPORTING x TYPE string RETURNING VALUE(y) TYPE string.
ENDINTERFACE.`
  const descendents = await c.typeHierarchy(
    "/sap/bc/adt/oo/interfaces/z_adt_testcase_intf1/source/main",
    source,
    1,
    11
  )
  expect(descendents).toBeDefined()
  expect(
    descendents.find(n => n.name.toUpperCase() === "Z_ADT_TESTCASE_CLASS1")
  ).toBeDefined()
})

test("type hierarchy parents", async () => {
  const c = create()
  const source = `CLASS z_adt_testcase_class1 DEFINITION PUBLIC CREATE PUBLIC .
  PUBLIC SECTION.
    INTERFACES z_adt_testcase_intf1 .
    DATA lastx TYPE string .
ENDCLASS.
CLASS z_adt_testcase_class1 IMPLEMENTATION.
  METHOD z_adt_testcase_intf1~dosomething.
    y = x.
    TRANSLATE y TO UPPER CASE.
    lastx = x.
  ENDMETHOD.
ENDCLASS.`
  const ascendents = await c.typeHierarchy(
    "/sap/bc/adt/oo/classes/z_adt_testcase_class1/source/main",
    source,
    1,
    11,
    true
  )
  expect(ascendents).toBeDefined()
  expect(
    ascendents.find(n => n.name.toLowerCase() === "z_adt_testcase_intf1")
  ).toBeDefined()
})

test("user transports", async () => {
  const c = create()
  const transports = await c.userTransports(process.env.ADT_USER!)
  expect(transports.workbench.length).toBeGreaterThan(0)
  let hit: any
  for (const s of transports.workbench)
    for (const t of s.modifiable)
      if (t["tm:number"] === process.env.ADT_TRANS) hit = t
  expect(hit).toBeDefined()
  expect(hit!.tasks[0].objects[0]["tm:name"]).toBeDefined()
})

test("System users", async () => {
  const c = create()
  const users = await c.systemUsers()
  expect(users.length).toBeGreaterThan(0)
  expect(
    users.find(u => u.id.toUpperCase() === process.env.ADT_USER!.toUpperCase())
  ).toBeDefined()
})

test("Transportable object", async () => {
  const c = create()
  const reference = await c.transportReference(
    "R3TR",
    "CLAS",
    "ZCL_ABAPGIT_AUTH"
  )

  expect(reference).toBe("/sap/bc/adt/oo/classes/zcl_abapgit_auth")
})

test("stateless clone", async () => {
  const c = create()
  const obj = "/sap/bc/adt/programs/programs/zabapgit"
  c.stateful = session_types.stateful
  try {
    const clone = c.statelessClone
    expect(clone.statelessClone).toBe(clone)
    try {
      clone.stateful = session_types.stateful
      fail("Stateless clone must stay stateless")
    } catch (e) {
      // ignore
    }
    const lock = await c.lock(obj)
    await clone.objectStructure(obj)
    try {
      const lock2 = await c.lock(obj)
      fail("lock didn't survive read on stateless clone")
    } catch (e) {
      // ignore
    }
    expect(clone.stateful).toBe(session_types.stateless)
    const result = await clone.objectRegistrationInfo(obj)
    expect(result).toBeDefined()
  } finally {
    c.dropSession()
  }
})

test("revisions of func by URL", async () => {
  const c = create()
  const obj =
    "/sap/bc/adt/functions/groups/ztestrevision1/fmodules/ztestrevisionfm2"
  const revisions = await c.revisions(obj)
  expect(revisions).toBeTruthy()
  expect(revisions[0]).toBeTruthy()
  expect(revisions[0].version.match(/[a-zA-Z]\w\wK\d+/)).toBeTruthy()
})

test("revisions of func by structure", async () => {
  const c = create()
  const obj =
    "/sap/bc/adt/functions/groups/ztestrevision1/fmodules/ztestrevisionfm2"
  const str = await c.objectStructure(obj)
  const revisions = await c.revisions(str)
  expect(revisions).toBeTruthy()
  expect(revisions[0]).toBeTruthy()
  expect(revisions[0].version.match(/[a-zA-Z]\w\wK\d+/)).toBeTruthy()
})

test("revisions of class includes", async () => {
  const c = create()
  const obj = "/sap/bc/adt/oo/classes/z_adt_testcase_class1"
  const v = async (include?: classIncludes) => {
    const revisions = await c.revisions(obj, include)
    expect(revisions).toBeTruthy()
    expect(revisions[0]).toBeTruthy()
    expect(revisions[0].version.match(/[a-zA-Z]\w\wK\d+/)).toBeTruthy()
  }
  await v()
  await v("main")
  await v("testclasses")
  await v("definitions")
})

test("code references in include", async () => {
  const c = create()
  const s = `data:foo type REF TO cl_salv_table.`
  const i = "/sap/bc/adt/programs/includes/z_adt_testcase_include1/source/main"
  const m = "/sap/bc/adt/programs/programs/z_adt_testcase_program1"
  const definitionLocation = await c.findDefinition(i, s, 1, 22, 34, false, m)
  expect(definitionLocation).toBeDefined()
  expect(definitionLocation.url).toBe(
    "/sap/bc/adt/oo/classes/cl_salv_table/source/main"
  )
})

test("code references in include with namespace", async () => {
  const c = create()
  const s = `form foo./ui5/cl_ui5_app_index_log=>get_instance( ).endform.`
  const i =
    "/sap/bc/adt/programs/includes/%2fui5%2f_index_calculate_f01/source/main"
  const m = "/sap/bc/adt/programs/programs/%2fui5%2fapp_index_calculate"
  const definitionLocation = await c.findDefinition(i, s, 1, 15, 48, false, m)
  expect(definitionLocation).toBeDefined()
  expect(definitionLocation.url).toBe(
    "/sap/bc/adt/oo/classes/%2fui5%2fcl_ui5_app_index_log/source/main"
  )
})

test("abapGit", async () => {
  const c = create()
  const git = await c.featureDetails("abapGit Repositories")
  if (git) {
    const repos = await c.gitRepos()
    expect(repos).toBeDefined()
    expect(repos.length).toBeGreaterThan(0)
    expect(repos[0].sapPackage).toBeDefined()
  }
})

test("ABAP documentation", async () => {
  const c = create()
  const source = `INTERFACE z_adt_testcase_intf1 PUBLIC .
  METHODS dosomething IMPORTING x TYPE string RETURNING VALUE(y) TYPE string.
ENDINTERFACE.`
  const docu = await c.abapDocumentation(
    "/sap/bc/adt/oo/interfaces/z_adt_testcase_intf1/source/main",
    source,
    1,
    3
  )
  expect(docu).toBeDefined()
  expect(docu.match(/interface/i)).toBeDefined()
})

test("Console application/IF_OO_ADT_CLASSRUN", async () => {
  const c = create()
  const result = await c.runClass("z_adt_testcase_console")
  expect(result).toBe("Hello world!\n\n")
})
