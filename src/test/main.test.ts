// these tests call a real system.
// will only work if there's one connected and the environment variables are set
import { execPath } from "process"
import {
  ADTClient,
  isAdtError,
  isClassStructure,
  isHttpError,
  objectPath,
  UnitTestAlertKind
} from "../"
import { session_types } from "../AdtHTTP"
import {
  classIncludes,
  isBindingOptions,
  NewBindingOptions,
  NewObjectOptions,
  parseUri
} from "../api"
import {
  fullParse,
  isArray,
  isString,
  xmlArray,
  xmlNodeAttr
} from "../utilities"
import { createHttp, hasAbapGit, runTest } from "./login"

// tslint:disable: no-console

// for older systems
const eat404 = (e: any) => {
  if (!(isHttpError(e) && e.code === 404)) throw e
}
const eatResourceNotFound = (e: any) => {
  if (!(isAdtError(e) && e.type === "ExceptionResourceNotFound")) throw e
}

test("login", async () => {
  const c = createHttp()
  if (!c) return
  try {
    expect(c).toBeDefined()
    await c.login()
    expect(c.csrfToken).not.toEqual("fetch")
  } finally {
    c.logout()
  }
})

test("logout http", async () => {
  const c = createHttp()
  if (!c) return
  await c.login()
  expect(c.csrfToken).not.toEqual("fetch")
  await c.logout()
  try {
    // we want to prevent autologins
    await c.login()
    fail("still logged in")
  } catch (error) {
    // ignore
  } finally {
    c.logout()
  }
})

test("drop session", async () => {
  const c = createHttp()
  if (!c) return
  await c.login()
  c.stateful = session_types.stateful
  await c.request("/sap/bc/adt/repository/nodestructure", {
    method: "POST",
    qs: { parent_name: "$ABAPGIT", parent_type: "DEVC/K" }
  })
  await c.dropSession()
  await c.request("/sap/bc/adt/repository/nodestructure", {
    method: "POST",
    qs: { parent_name: "$ABAPGIT", parent_type: "DEVC/K" }
  })
  c.csrfToken = "bad" // force relogin
  await c.request("/sap/bc/adt/repository/nodestructure", {
    method: "POST",
    qs: { parent_name: "$ABAPGIT", parent_type: "DEVC/K" }
  })
})

test("badToken", async () => {
  const c = createHttp("DE")
  if (!c) return
  try {
    await c.login()
    expect(c.csrfToken).not.toEqual("fetch")
    c.csrfToken = "bad" // will trigger a bad login
    const response = await c.request("/sap/bc/adt/repository/nodestructure", {
      method: "POST",
      qs: { parent_name: "$ABAPGIT", parent_type: "DEVC/K" }
    })
    expect(c.csrfToken).not.toEqual("bad") // will be reset by the new login
    expect(response.body).toBeDefined()
  } finally {
    c.logout()
  }
})

test(
  "logout client",
  runTest(async (c: ADTClient) => {
    expect(c).toBeDefined()
    await c.login()
    expect(c.csrfToken).not.toEqual("fetch")
    await c.logout()
    await c.login()
  })
)

test(
  "discovery",
  runTest(async (c: ADTClient) => {
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
)

test(
  "getNodeContents",
  runTest(async (c: ADTClient) => {
    const resp = await c.nodeContents("DEVC/K", "BASIS")
    expect(resp).toBeDefined()
    expect(resp.nodes).toBeDefined()
    const known = resp.nodes.find(x => x.OBJECT_NAME === "S_BUPA_API")
    expect(known).toBeDefined()
  })
)

test(
  "getNodeContents ZAPIDUMMY",
  runTest(async (c: ADTClient) => {
    const resp = await c.nodeContents("DEVC/K", "ZAPIDUMMY")
    expect(resp).toBeDefined()
    expect(resp.nodes).toBeDefined()
    const known = resp.nodes.find(x => x.OBJECT_NAME === "ZAPIDUMMYFOOBAR")
    expect(known).toBeDefined()
  })
)

test(
  "emptyNodeContents",
  runTest(async (c: ADTClient) => {
    const resp = await c.nodeContents("DEVC/K", "/FOO/BARFOOFOOTERTQWERWER")
    expect(resp.nodes.length).toBe(0)
  })
)

test(
  "NodeContents prog",
  runTest(async (c: ADTClient) => {
    const resp = await c.nodeContents("PROG/P", "ZAPIDUMMYTESTPROG1")
    let fragment = await c.fragmentMappings(
      "/sap/bc/adt/programs/programs/zapidummytestprog1/source/main",
      "PROG/PD",
      "1001"
    )
    expect(fragment).toBeDefined()
    expect(fragment.line).toBe(10)
    fragment = await c.fragmentMappings(
      "/sap/bc/adt/programs/programs/zapidummytestprog1/source/main",
      "PROG/PE",
      "START-OF-SELECTION"
    )
    expect(fragment).toBeDefined()
    expect(fragment.line).toBe(105)
    expect(resp.nodes.length).toBeGreaterThanOrEqual(60)
  })
)
// will fail in older systems
test(
  "NodeContents include",
  runTest(async (c: ADTClient) => {
    // really a PROG/I, but only works if we lie...
    const resp = await c.nodeContents("PROG/PI", "ZAPIDUMMYTESTPROG1TOP")
    const fragment = await c.fragmentMappings(
      "/sap/bc/adt/programs/programs/zapidummytestprog1top/source/main",
      "PROG/PD",
      "OK_CODE"
    )
    expect(fragment.line).toBe(5)
    if (resp.nodes.length) expect(resp.nodes.length).toBe(2) // in newer systems this is empty for includes
  })
)

test(
  "getReentranceTicket",
  runTest(async (c: ADTClient) => {
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
)

test(
  "getTransportInfo",
  runTest(async (c: ADTClient) => {
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
      "/sap/bc/adt/functions/groups/zapidummyfoobar/fmodules/zapidummyfoofunc",
      "ZAPIDUMMY"
    )
    expect(info).toBeDefined()
    expect(info.LOCKS!.HEADER!.TRKORR).toMatch(trreg)
  })
)

test(
  "objectPath and transport",
  runTest(async (c: ADTClient) => {
    const path = objectPath("CLAS/OC", "zapidummytestcreation", "")
    expect(path).toBe("/sap/bc/adt/oo/classes/zapidummytestcreation")
    const info = await c.transportInfo(path, "ZAPIDUMMY")
    expect(info).toBeDefined()
    expect(info.RECORDING).toEqual("X")
    expect(info.TRANSPORTS.length).toBeGreaterThan(0)
  })
)
test(
  "objectPath and transport for local packages",
  runTest(async (c: ADTClient) => {
    const path = objectPath("DEVC/K", "$APIDUMMYFOOBARTESTPACKAGE", "")
    expect(path).toBe("/sap/bc/adt/packages/%24APIDUMMYFOOBARTESTPACKAGE")
    const info = await c.transportInfo(path, "$TMP")
    expect(info).toBeDefined()
    expect(info.RECORDING).toEqual("")
  })
)

test(
  "objectPath and transport for transportable packages",
  runTest(async (c: ADTClient) => {
    const path = objectPath("DEVC/K", "ZAPIDUMMYFOOBARTESTPACKAGE", "")
    expect(path).toBe("/sap/bc/adt/packages/ZAPIDUMMYFOOBARTESTPACKAGE")
    const info = await c.transportInfo(path, "ZAPIDUMMY")
    expect(info).toBeDefined()
    expect(info.RECORDING).toEqual("X")
    expect(info.TRANSPORTS.length).toBeGreaterThan(0)
  })
)

test(
  "badTransportInfo",
  runTest(async (c: ADTClient) => {
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
)

test(
  "objectStructure",
  runTest(async (c: ADTClient) => {
    let structure = await c.objectStructure(
      "/sap/bc/adt/programs/programs/zapidummytestprog1"
    )
    expect(structure.links).toBeDefined()
    expect(structure.links!.length).toBeGreaterThan(0)
    expect(ADTClient.mainInclude(structure)).toBe(
      "/sap/bc/adt/programs/programs/zapidummytestprog1/source/main"
    )
    structure = await c.objectStructure(
      "/sap/bc/adt/functions/groups/zapidummyfoobar"
    )
    expect(structure.links).toBeDefined()
    expect(structure.links!.length).toBeGreaterThan(0)
    expect(ADTClient.mainInclude(structure)).toBe(
      "/sap/bc/adt/functions/groups/zapidummyfoobar/source/main"
    )
    structure = await c.objectStructure(
      "/sap/bc/adt/oo/classes/zapiadt_testcase_class1"
    )
    if (!isClassStructure(structure)) throw new Error("ss")
    expect(structure.includes.length).toBeGreaterThan(0)
    expect(ADTClient.mainInclude(structure)).toBe(
      "/sap/bc/adt/oo/classes/zapiadt_testcase_class1/source/main"
    )
    expect(ADTClient.classIncludes(structure).get("definitions")).toBe(
      "/sap/bc/adt/oo/classes/zapiadt_testcase_class1/includes/definitions"
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
      structure = await c.objectStructure(
        "/sap/bc/adt/ddic/tables/zapiadtdummytabl"
      )
      expect(structure).toBeDefined()
      expect(ADTClient.mainInclude(structure)).toBe(
        "/sap/bc/adt/ddic/tables/zapiadtdummytabl/source/main"
      )
    } catch (e) {
      eat404(e) // not supported in older systems
    }
  })
)

test(
  "activateProgram",
  runTest(async (c: ADTClient) => {
    const result = await c.activate(
      "ZAPIDUMMYTESTPROG1",
      "/sap/bc/adt/programs/programs/zapidummytestprog1"
    )
    expect(result).toBeDefined()
    expect(result.success).toBe(true)
  })
)

test(
  "list inactive objects",
  runTest(async (c: ADTClient) => {
    const inactive = await c.inactiveObjects()
    expect(inactive).toBeDefined()
    expect(Array.isArray(inactive)).toBe(true)
    if (inactive.length > 0 && inactive[0].object) {
      expect(inactive[0].object?.["adtcore:name"]).toBeDefined()
    }
  })
)
test(
  "getMainPrograms",
  runTest(async (c: ADTClient) => {
    const result = await c.mainPrograms(
      "/sap/bc/adt/programs/includes/zadttestincludeinc"
    )
    expect(result).toBeDefined()
    expect(result.length).toBe(1)
    expect(result[0]["adtcore:name"]).toBe("ZADTTESTINCLUDE1")
  })
)

test(
  "getObjectSource",
  runTest(async (c: ADTClient) => {
    const result = await c.getObjectSource(
      "/sap/bc/adt/programs/programs/ZADTTESTINCLUDE1/source/main"
    )
    expect(result).toBeDefined()
    expect(result).toMatch(/ZADTTESTINCLUDEINC/gim)
  })
)

test(
  "lock_unlock",
  runTest(async (c: ADTClient) => {
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
)

test(
  "searchObject",
  runTest(async (c: ADTClient) => {
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
)

test(
  "searchObject by type",
  runTest(async (c: ADTClient) => {
    const result = await c.searchObject("ZABAP*", "PROG/P")
    expect(result).toBeDefined()
    result.forEach(r =>
      expect(r["adtcore:type"].replace(/\/.*$/, "")).toBe("PROG")
    )
  })
)

test(
  "findObjectPath",
  runTest(async (c: ADTClient) => {
    const result = await c.findObjectPath(
      "/sap/bc/adt/programs/programs/zapidummytestprog1"
    )
    expect(result).toBeDefined()
    const idx = result.length === 3 ? 1 : 0 // in some systems starts at $TMP, in some it doesn't
    expect(result[idx] && result[idx]["adtcore:name"]).toBe("ZAPIDUMMY")
  })
)

test(
  "validateNewFM",
  runTest(async (c: ADTClient) => {
    const result = await c.validateNewObject({
      description: "a fm",
      fugrname: "ZAPIDUMMYFOOBAR",
      objname: "ZFOOBARFEWFWE",
      objtype: "FUGR/FF"
    })
    expect(result.success).toBeTruthy()
  })
)

test(
  "validateClass",
  runTest(async (c: ADTClient) => {
    const result = await c.validateNewObject({
      description: "a class",
      objname: "ZFOOBARFEWFWE",
      objtype: "CLAS/OC",
      packagename: "$TMP"
    })
    expect(result.success).toBeTruthy()
  })
)

test(
  "validateExistingClass",
  runTest(async (c: ADTClient) => {
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
)

test(
  "loadTypes",
  runTest(async (c: ADTClient) => {
    const result = await c.loadTypes()
    expect(result).toBeDefined()
    const groupinc = result.find(t => t.OBJECT_TYPE === "FUGR/I")
    expect(groupinc).toBeDefined()
  })
)

test(
  "objectRegistration",
  runTest(async (c: ADTClient) => {
    const hasregistration = await c.collectionFeatureDetails(
      "/sap/bc/adt/sscr/registration/objects"
    )
    if (hasregistration) {
      // removed in 1909
      const result = await c.objectRegistrationInfo(
        "/sap/bc/adt/programs/programs/zapidummytestprog1"
      )
      expect(result).toBeDefined()
    }
  })
)

// disabled as test case is missing
// test("activate multiple", runTest(async (c: ADTClient) => {
//
//   let result = await c.activate(
//     "ZCL_FOOBAR",
//     "/sap/bc/adt/oo/classes/zcl_foobar"
//   )
//   const inactive = inactiveObjectsInResults(result)
//   result = await c.activate(inactive)
//   expect(result.success).toBeTruthy()
// }))

test(
  "lock table",
  runTest(async (c: ADTClient) => {
    c.stateful = session_types.stateful
    try {
      const handle = await c.lock("/sap/bc/adt/ddic/tables/zapiadtdummytabl")
      await c.unLock(
        "/sap/bc/adt/ddic/tables/zapiadtdummytabl",
        handle.LOCK_HANDLE
      )
    } catch (e) {
      eat404(e) // not found on older systems
    } finally {
      await c.dropSession()
    }
  })
)

test(
  "syntax ckeck",
  runTest(async (c: ADTClient) => {
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
)

test(
  "code completion",
  runTest(async (c: ADTClient) => {
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
)

test(
  "code completion field-symbol",
  runTest(async (c: ADTClient) => {
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
)

test(
  "code completion full",
  runTest(async (c: ADTClient) => {
    const result = await c.codeCompletionFull(
      "/sap/bc/adt/functions/groups/zapidummyfoobar/includes/lzapidummyfoobartop/source/main",
      `FUNCTION-POOL zapidummyfoobar.\ndata:foo type ref to cl_salv_table.\nform x.\ncreate object foo`,
      4,
      17,
      "FOO"
    )
    expect(result).toBeDefined()
    expect(result).toMatch(/foo/gi) // questionable fix...
  })
)

// not supported in older releases
test(
  "code completion elements",
  runTest(async (c: ADTClient) => {
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
)

test(
  "code references",
  runTest(async (c: ADTClient) => {
    const source = `FUNCTION-POOL zapidummyfoobar.\ndata:grid type ref to cl_salv_table.\nif grid is bound.endif.`
    const include =
      "/sap/bc/adt/functions/groups/zapidummyfoobar/includes/lzapidummyfoobartop/source/main"
    const definitionLocation = await c.findDefinition(include, source, 3, 3, 7)
    expect(definitionLocation).toBeDefined()
    expect(definitionLocation.url).toBe(include)
    expect(definitionLocation.line).toBe(2)
    expect(definitionLocation.column).toBe(5)
  })
)

test(
  "Usage references",
  runTest(async (c: ADTClient) => {
    jest.setTimeout(10000) // this usually takes longer than the default 5000
    const include = "/sap/bc/adt/oo/classes/zapidummyfoobar"
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
)

test(
  "fix proposals",
  runTest(async (c: ADTClient) => {
    const source = `FUNCTION-POOL zapidummyfoobar.\nclass fo definition.\npublic section.
  methods bar.\nendclass.\nclass fo implementation.\nendclass."`
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
)

test(
  "fix proposals reverse",
  runTest(async (c: ADTClient) => {
    const source = `CLASS zapiadt_testcase_class1 DEFINITION.ENDCLASS.
CLASS zapiadt_testcase_class1 IMPLEMENTATION.
  METHOD foo.
  ENDMETHOD.
ENDCLASS.`
    const uri = "/sap/bc/adt/oo/classes/zapiadt_testcase_class1/source/main"

    const fixProposals = await c.fixProposals(uri, source, 3, 10)
    expect(fixProposals).toBeDefined()
    expect(fixProposals.length).toBeGreaterThan(0)
    expect(fixProposals[0]["adtcore:type"]).toBe("create_method_def")
    const edits = await c.fixEdits(fixProposals[0], source)
    expect(edits.length).toBeGreaterThan(0)
    const edit = edits[0]
    expect(edit && edit.content.match(/methods\s+foo\./gi)).toBeTruthy()
    expect(edit && edit.range.start.line).toBe(1)
    expect(edit && edit.range.start.column).toBe(41)
  })
)

test("xml parser", () => {
  const xml = `<unit> <content>data: x type string,
          bar type any.</content> </unit>`
  const { content } = fullParse(xml).unit
  expect(content).toMatch(/data: x type string,\n\s*bar type any./)
})
test(
  "fix proposals variable",
  runTest(async (c: ADTClient) => {
    const source = `CLASS zapiadt_testcase_class1 DEFINITION PUBLIC CREATE PUBLIC.public section.methods bar. .ENDCLASS.
    CLASS zapiadt_testcase_class1 IMPLEMENTATION.
      METHOD foo.
         data: x type string.
         bar = 2.
      ENDMETHOD.
    ENDCLASS.`
    const uri = "/sap/bc/adt/oo/classes/zapiadt_testcase_class1/source/main"

    const fixProposals = await c.fixProposals(uri, source, 5, 11)
    expect(fixProposals).toBeDefined()
    expect(fixProposals.length).toBeGreaterThan(0)
    expect(fixProposals[0]["adtcore:type"]).toBe("declare_local_variable")
    const edits = await c.fixEdits(fixProposals[0], source)
    expect(edits.length).toBeGreaterThan(0)
    const edit = edits[0]
    expect(edit && edit.content.match(/\n\s+bar type any\./gi)).toBeTruthy()
    expect(edit && edit.range.start.line).toBe(4)
    expect(edit && edit.range.start.column).toBe(9)
  })
)

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

test(
  "unit test",
  runTest(async (c: ADTClient) => {
    const testResults = await c.unitTestRun(
      "/sap/bc/adt/programs/programs/zapiadtunitcases"
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
      const testfail = findBy(
        class1.testmethods,
        "adtcore:name",
        "TEST_FAILURE"
      )
      expect(testfail).toBeDefined()
      expect(testfail!.alerts.length).toBeGreaterThan(0)
      const failure = findBy(
        testfail!.alerts,
        "kind",
        UnitTestAlertKind.failedAssertion
      )
      expect(failure).toBeDefined()
      expect(failure!.stack[0]).toBeDefined()
      const failuretext = failure?.details.find(f =>
        f.match(/Expected \[FOO\]/)
      )
      expect(failuretext).toBeDefined()
    }
  })
)

test(
  "unit test evaluation",
  runTest(async (c: ADTClient) => {
    const testResults = await c.unitTestRun(
      "/sap/bc/adt/programs/programs/zapiadtunitcases"
    )
    const class1 = findBy(testResults, "adtcore:name", "LCL_TEST1")
    expect(class1).toBeDefined()
    const methods = await c.unitTestEvaluation(class1!)
    expect(methods).toBeDefined()
    expect(methods.length).toBe(class1?.testmethods.length)
  })
)

test(
  "unit test markers",
  runTest(async (c: ADTClient) => {
    const testResults = await c.unitTestRun(
      "/sap/bc/adt/oo/classes/zapiadt_testcase_class1/source/main"
    )
    const class1 = findBy(testResults, "adtcore:name", "UT")
    expect(class1).toBeDefined()
    const source = await c.getObjectSource(
      class1!.navigationUri || class1!["adtcore:uri"]
    )
    const markers = await c.unitTestOccurrenceMarkers(
      class1!.testmethods[0].navigationUri ||
        class1!.testmethods[0]["adtcore:uri"],
      source
    )
    expect(markers[1].location.range.start.line).toBe(13)
  })
)

test(
  "class components",
  runTest(async (c: ADTClient) => {
    const structure = await c.classComponents(
      "/sap/bc/adt/oo/classes/zapiadt_testcase_class1"
    )
    expect(structure).toBeDefined()
    expect(structure["adtcore:name"]).toBe("ZAPIADT_TESTCASE_CLASS1")
    const met = structure.components.find(
      co =>
        !!co["adtcore:type"].match(/CLAS\/OO|M/) &&
        co["adtcore:name"] === "DOSOMETHINGPRIVATE"
    )
    expect(met).toBeDefined()
    expect(met && met.links && met.links.length).toBeGreaterThan(0)
  })
)

test(
  "source fragments",
  runTest(async (c: ADTClient) => {
    const fragment = await c.fragmentMappings(
      "/sap/bc/adt/functions/groups/zapidummyfoobar/includes/lzapidummyfoobartop/source/main",
      "FUGR/PD",
      "FOO"
    )
    expect(fragment).toBeDefined()
    expect(fragment.line).toBe(4)
  })
)

test(
  "syntax ckeck bis",
  runTest(async (c: ADTClient) => {
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
)

test(
  "FM definition",
  runTest(async (c: ADTClient) => {
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
      "call FUNCTION 'ZAPIDUMMYFOOFUNC'."
    const include = "/sap/bc/adt/programs/programs/zadttestinclude1/source/main"
    const definitionLocation = await c.findDefinition(
      include,
      source,
      10,
      15,
      21
    )
    expect(definitionLocation).toBeDefined()
    expect(definitionLocation.url.length).toBeGreaterThan(1)
  })
)

test(
  "Object types",
  runTest(async (c: ADTClient) => {
    const types = await c.objectTypes()
    const type = types.find(x => x.type === "PROG/P")
    expect(type && type.name).toBe("PROG")
  })
)

test(
  "check types",
  runTest(async (c: ADTClient) => {
    const types = await c.syntaxCheckTypes()
    expect(types).toBeDefined()
    const type = types.get("abapCheckRun")
    expect(type && type.find(x => !!x.match("PROG"))).toBeDefined()
  })
)

test(
  "transport selection for older boxes",
  runTest(async (c: ADTClient) => {
    const info = await c.transportInfo(
      "/sap/bc/adt/programs/programs/ztestmu2/source/main",
      "",
      ""
    )
    expect(info).toBeDefined()
    if (process.env.ADT_OLDSYSTEM)
      expect(info.TRANSPORTS.length).toBeGreaterThan(1)
  })
)

test(
  "pretty printer",
  runTest(async (c: ADTClient) => {
    const style = (await c.prettyPrinterSetting())["abapformatter:style"]
    if (style === "none" || style === "keywordAuto") {
      console.log("Pretty printer doesn't change case, tests skipped")
      return
    }
    const uppercase = style === "toUpper" || style === "keywordUpper"
    const unformatted = "RePort hello.write:/, 'Hello,world'."
    const formatted = await c.prettyPrinter(unformatted)
    expect(formatted).toBeDefined()
    expect(formatted).toMatch(uppercase ? /REPORT/ : /report/)
  })
)

test(
  "code references2",
  runTest(async (c: ADTClient) => {
    const src = `REPORT ZADTTESTINCLUDE1.
  DATA:foo TYPE TABLE OF string.
  FIELD-SYMBOLS:<fs> LIKE LINE OF foo.
  LOOP AT foo ASSIGNING <fs>.
    cl_http_utility=>escape_html( '' ).
    cl_http_utility=>if_http_utility~escape_html( '' ).
  ENDLOOP.`
    const incl = "/sap/bc/adt/programs/programs/zadttestinclude1/source/main"
    const definitionLocation = await c.findDefinition(
      incl,
      src,
      5,
      21,
      32,
      true
    )
    expect(definitionLocation).toBeDefined()
    expect(definitionLocation.url).toBe(
      "/sap/bc/adt/oo/classes/cl_http_utility/source/main"
    )
    expect(definitionLocation.line).toBeGreaterThan(1) // real number depends on varsion
  })
)

test(
  "type hierarchy children",
  runTest(async (c: ADTClient) => {
    const source = `INTERFACE zapiadt_testcase_intf1 PUBLIC .
  METHODS dosomething IMPORTING x TYPE string RETURNING VALUE(y) TYPE string.
ENDINTERFACE.`
    const descendents = await c.typeHierarchy(
      "/sap/bc/adt/oo/interfaces/zapiadt_testcase_intf1/source/main",
      source,
      1,
      11
    )
    expect(descendents).toBeDefined()
    expect(
      descendents.find(n => n.name.toUpperCase() === "ZAPIADT_TESTCASE_INTF1")
    ).toBeDefined()
  })
)

test(
  "type hierarchy parents",
  runTest(async (c: ADTClient) => {
    const source = `CLASS zapiadt_testcase_class1 DEFINITION PUBLIC CREATE PUBLIC .
  PUBLIC SECTION.
    INTERFACES zapiadt_testcase_intf1 .
    DATA lastx TYPE string .
ENDCLASS.
CLASS zapiadt_testcase_class1 IMPLEMENTATION.
  METHOD zapiadt_testcase_intf1~dosomething.
    y = x.
    TRANSLATE y TO UPPER CASE.
    lastx = x.
  ENDMETHOD.
ENDCLASS.`
    const ascendents = await c.typeHierarchy(
      "/sap/bc/adt/oo/classes/zapiadt_testcase_class1/source/main",
      source,
      1,
      11,
      true
    )
    expect(ascendents).toBeDefined()
    expect(
      ascendents.find(n => n.name.toLowerCase() === "zapiadt_testcase_intf1")
    ).toBeDefined()
  })
)

test(
  "user transports - older",
  runTest(async (c: ADTClient) => {
    jest.setTimeout(8000) // this usually takes longer than the default 5000
    // in newer systems this is based on a transport configuration
    if (await c.hasTransportConfig()) return
    const transports = await c.userTransports(process.env.ADT_USER!)
    expect(transports.workbench.length).toBeGreaterThan(0)
    let hit: any
    for (const s of transports.workbench)
      for (const t of s.modifiable)
        if (t["tm:number"] === process.env.ADT_TRANS) hit = t
    expect(hit).toBeDefined()
    expect(hit!.tasks[0].objects[0]["tm:name"]).toBeDefined()
  })
)
test(
  "user transports - newer",
  runTest(async (c: ADTClient) => {
    jest.setTimeout(8000) // this usually takes longer than the default 5000
    // in newer systems this is based on a transport configuration
    if (!(await c.hasTransportConfig())) return
    // this requires database changes
    if (process.env.ADT_ENABLE_ALL !== "YES") return
    const configs = await c.transportConfigurations()
    const oldconfig = await c.getTransportConfiguration(configs[0].link)
    // make sure the config is for the current user
    const User = (process.env.ADT_USER || "").toUpperCase()
    await c.setTransportsConfig(configs[0].link, configs[0].etag, {
      ...oldconfig,
      WorkbenchRequests: true,
      User: process.env.ADT_USER!
    })
    // read transports
    const transports = await c.transportsByConfig(configs[0].link)
    //reset old config
    const newconfigs = await c.transportConfigurations()
    await c.setTransportsConfig(
      newconfigs[0].link,
      newconfigs[0].etag,
      oldconfig
    )
    // assert transport results
    expect(transports.workbench.length).toBeGreaterThan(0)
    let hit: any
    for (const s of transports.workbench)
      for (const t of s.modifiable)
        if (t["tm:number"] === process.env.ADT_TRANS) hit = t
    expect(hit).toBeDefined()
    expect(hit!.tasks[0].objects[0]["tm:name"]).toBeDefined()
  })
)
test(
  "read transport configurations",
  runTest(async (c: ADTClient) => {
    const conf = await c.transportConfigurations()
    expect(conf[0]).toBeDefined()
    expect(conf[0].changedBy).toBeDefined()
    expect(
      conf[0].link.startsWith(
        "/sap/bc/adt/cts/transportrequests/searchconfiguration/configurations/"
      )
    ).toBeTruthy()
    expect(conf[0].etag).toMatch(/^\d+$/)
  })
)

test(
  "read transport configuration details",
  runTest(async (c: ADTClient) => {
    const conf = await c.transportConfigurations()
    const cfg = await c.getTransportConfiguration(conf[0].link)
    expect(cfg.User).toBeTruthy()
  })
)

test(
  "System users",
  runTest(async (c: ADTClient) => {
    const users = await c.systemUsers()
    expect(users.length).toBeGreaterThan(0)
    expect(
      users.find(
        u => u.id.toUpperCase() === process.env.ADT_USER!.toUpperCase()
      )
    ).toBeDefined()
  })
)

test(
  "Transportable object",
  runTest(async (c: ADTClient) => {
    const reference = await c.transportReference(
      "R3TR",
      "CLAS",
      "ZAPIADT_TESTCASE_CLASS1"
    )

    expect(reference).toBe("/sap/bc/adt/oo/classes/zapiadt_testcase_class1")
  })
)

test(
  "stateless clone",
  runTest(async (c: ADTClient) => {
    const obj = "/sap/bc/adt/programs/programs/zapidummytestprog1"
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
      const hasregistration = await c.collectionFeatureDetails(
        "/sap/bc/adt/sscr/registration/objects"
      )
      if (hasregistration) {
        // removed in 1909
        const result = await clone.objectRegistrationInfo(obj)
        expect(result).toBeDefined()
      }
    } finally {
      c.dropSession()
    }
  })
)

test(
  "revisions of func by URL",
  runTest(async (c: ADTClient) => {
    jest.setTimeout(8000) // this occasionally takes longer than the default 5000
    const obj =
      "/sap/bc/adt/functions/groups/zapidummyfoobar/fmodules/zapidummyfoofunc"
    const revisions = await c.revisions(obj)
    expect(revisions).toBeTruthy()
    expect(revisions[0]).toBeTruthy()
    expect(revisions[0].version.match(/[a-zA-Z]\w\wK\d+/)).toBeTruthy()
  })
)

test(
  "revisions of func by structure",
  runTest(async (c: ADTClient) => {
    const obj =
      "/sap/bc/adt/functions/groups/zapidummyfoobar/fmodules/zapidummyfoofunc"
    const str = await c.objectStructure(obj)
    const revisions = await c.revisions(str)
    expect(revisions).toBeTruthy()
    expect(revisions[0]).toBeTruthy()
    expect(revisions[0].version.match(/[a-zA-Z]\w\wK\d+/)).toBeTruthy()
  })
)

test(
  "revisions of class includes",
  runTest(async (c: ADTClient) => {
    const obj = "/sap/bc/adt/oo/classes/zapiadt_testcase_class1"
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
)

test(
  "code references in include",
  runTest(async (c: ADTClient) => {
    const s = `data:foo type REF TO cl_salv_table.`
    const i =
      "/sap/bc/adt/programs/includes/zapiadt_testcase_include1/source/main"
    const m = "/sap/bc/adt/programs/programs/zapiadt_testcase_program1"
    const definitionLocation = await c.findDefinition(i, s, 1, 22, 34, false, m)
    expect(definitionLocation).toBeDefined()
    expect(definitionLocation.url).toBe(
      "/sap/bc/adt/oo/classes/cl_salv_table/source/main"
    )
  })
)

test(
  "code references in include with namespace",
  runTest(async (c: ADTClient) => {
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
)

test(
  "abapGitRepos",
  runTest(async (c: ADTClient) => {
    if (await hasAbapGit(c)) {
      const repos = await c.gitRepos()
      expect(repos).toBeDefined()
      expect(repos.length).toBeGreaterThan(0)
      expect(repos[0].sapPackage).toBeDefined()
    } else {
      console.log("ABAPGit backend not installed, relevant tests skipped")
    }
  })
)

test(
  "abapGitxternalRepoInfo",
  runTest(async (c: ADTClient) => {
    jest.setTimeout(8000) // this usually takes longer than the default 5000
    if (await hasAbapGit(c)) {
      const repoinfo = await c.gitExternalRepoInfo(
        "https://github.com/abapGit/abapGit.git"
      )
      expect(repoinfo).toBeDefined()
      expect(repoinfo.access_mode).toBe("PUBLIC")
      expect(repoinfo.branches[0]).toBeDefined()
    }
  })
)

test(
  "abapGitxternalRepoInfo with password",
  runTest(async (c: ADTClient) => {
    jest.setTimeout(20000) // often takes longer than 5s

    if (await hasAbapGit(c)) {
      const { ADT_GIT_REPO, ADT_GIT_USER, ADT_GIT_PASS } = process.env
      if (ADT_GIT_REPO && ADT_GIT_USER && ADT_GIT_PASS) {
        const repoinfopri = await c.gitExternalRepoInfo(ADT_GIT_REPO)
        expect(repoinfopri.access_mode).toBe("PRIVATE")
        expect(repoinfopri.branches[0]).toBeUndefined()
        const repoinfo = await c.gitExternalRepoInfo(
          ADT_GIT_REPO,
          ADT_GIT_USER,
          ADT_GIT_PASS
        )
        expect(repoinfo).toBeDefined()
        expect(repoinfo.access_mode).toBe("PRIVATE")
        expect(repoinfo.branches[0]).toBeDefined()
      } else
        console.log(
          "No password protected ABAPGit repo provided, relevant tests skipped"
        )
    }
  })
)
test(
  "ABAP documentation",
  runTest(async (c: ADTClient) => {
    const source = `INTERFACE zapiadt_testcase_intf1 PUBLIC .
  METHODS dosomething IMPORTING x TYPE string RETURNING VALUE(y) TYPE string.
ENDINTERFACE.`
    const docu = await c.abapDocumentation(
      "/sap/bc/adt/oo/interfaces/zapiadt_testcase_intf1/source/main",
      source,
      1,
      3
    )
    expect(docu).toBeDefined()
    expect(docu.match(/interface/i)).toBeDefined()
  })
)

test(
  "Console application/IF_OO_ADT_CLASSRUN",
  runTest(async (c: ADTClient) => {
    const result = await c.runClass("ZAPIADT_TESTCASE_CONSOLE")
    expect(result).toMatch(/Hello world!\n+/)
  })
)

test(
  "Transport Layer search help",
  runTest(async (c: ADTClient) => {
    const details = await c.featureDetails("Packages")
    const f = await c.collectionFeatureDetails(
      "/sap/bc/adt/packages/valuehelps/transportlayers"
    )
    const tl =
      f ||
      (details &&
        details.collection.find(coll =>
          coll.templateLinks.find(l => l.template.match(/transportlayers/))
        ))
    if (tl) {
      const resp = await c.packageSearchHelp("transportlayers")
      expect(resp).toBeDefined()
      expect(resp.length).toBeGreaterThanOrEqual(1)
      const sap = resp.find(x => x.name === "SAP")
      expect(sap).toBeDefined()
    }
  })
)

test(
  "syntax ckeck CDS",
  runTest(async (c: ADTClient) => {
    const messages = await c.syntaxCheck(
      `/sap/bc/adt/ddic/ddl/sources/zapidummy_datadef`
    )
    expect(messages).toBeDefined()
    expect(messages.length).toBe(2)
    expect(messages[0].offset).toBe(9)
    expect(messages[0].line).toBe(16)
    const msg = messages.find(m => m.severity === "W")
    expect(msg).toBeDefined()
    const quoteFound = messages[0].text.includes("&quot;")
    expect(quoteFound).toBeFalsy()
  })
)
test(
  "syntax ckeck CDS with source",
  runTest(async (c: ADTClient) => {
    const messages = await c.syntaxCheck(
      `/sap/bc/adt/ddic/ddl/sources/zapidummy_datadef`,
      "/sap/bc/adt/ddic/ddl/sources/zapidummy_datadef/source/main",
      `@AbapCatalog.sqlViewName: 'ZAPIDUMMY_DDEFSV'
      @AbapCatalog.compiler.compareFilter: true
      @AbapCatalog.preserveKey: true
      @AccessControl.authorizationCheck: #CHECK
      @EndUserText.label: 'data definition test'
      @Metadata.allowExtensions: true
      define view ZAPIDUMMY_datadef as select from e070 {
          trkorr,
          korrdev,
          as4user,foobar
      }`
    )
    expect(messages).toBeDefined()
    expect(messages.length).toBe(1)
    expect(messages[0].offset).toBe(18)
    expect(messages[0].line).toBe(10)
    expect(messages[0].severity).toBe("E")
  })
)

test(
  "syntax ckeck CDS access",
  runTest(async (c: ADTClient) => {
    let messages = await c.syntaxCheck(
      `/sap/bc/adt/acm/dcl/sources/zapidummy_datadef_ac`
    )
    expect(messages).toBeDefined()
    expect(messages.length).toBe(0)
    messages = await c.syntaxCheck(
      `/sap/bc/adt/acm/dcl/sources/zapidummy_datadef_ac`,
      `/sap/bc/adt/acm/dcl/sources/zapidummy_datadef_ac/source/main`,
      `@EndUserText.label: 'access control'
      @MappingRole: true
      define role Zapidummy_datadef_Ac {
          grant select on ZAPIDUMMY_DATADEF
            where as4user = 'DEVELOPER'
               or as4user = aspect user
      }`
    )
    expect(messages.length).toBe(1)
    expect(messages[0].offset).toBe(6)
    expect(messages[0].line).toBe(7)
    expect(messages[0].severity).toBe("E")
  })
)
test(
  "syntax ckeck CDS metadata",
  runTest(async (c: ADTClient) => {
    let messages = await c.syntaxCheck(
      `/sap/bc/adt/ddic/ddlx/sources/zapidummy_metadata`
    )
    expect(messages).toBeDefined()
    expect(messages.length).toBe(0)
    messages = await c.syntaxCheck(
      `/sap/bc/adt/ddic/ddlx/sources/zapidummy_metadata`,
      `/sap/bc/adt/ddic/ddlx/sources/zapidummy_metadata/source/main`,
      `@Metadata.layer: #CUSTOMER
      annotate view ZAPIDUMMY_datadef with{
      @Consumption.derivation.resultElementHigh: 'trkorr'
          korrdev ;d
      }`
    )
    expect(messages.length).toBe(1)
    expect(messages[0].offset).toBe(6)
    expect(messages[0].line).toBe(5)
    expect(messages[0].severity).toBe("E")
  })
)

test(
  "CDS annotations definitions",
  runTest(async (c: ADTClient) => {
    const definitions = await c.annotationDefinitions()
    expect(definitions).toBeDefined()
    const scopeFound = definitions.includes("@Scope")
    expect(scopeFound).toBeTruthy()
  })
)

test(
  "CDS DDIC definitions",
  runTest(async (c: ADTClient) => {
    const definitions = await c.ddicElement("spfli")
    expect(definitions).toBeDefined()
    expect(definitions.name).toBe("spfli")
    expect(definitions.type).toBe("TABL/DT")
    const carrid = definitions.children.find(x => x.name === "carrid")
    expect(carrid?.properties.elementProps?.ddicIsKey).toBe(true)
    expect(carrid?.properties.elementProps?.ddicDataElement).toBe("s_carr_id")
  })
)

test(
  "CDS DDIC definitions, multiple",
  runTest(async (c: ADTClient) => {
    const definitions = await c.ddicElement([
      "spfli.deptime",
      "scarr.deptime",
      "deptime"
    ])
    expect(definitions).toBeDefined()
    expect(definitions.name).toBe("deptime")
    expect(definitions.type).toBe("TABL/DTF")

    expect(definitions.properties.elementProps?.ddicIsKey).toBe(false)
    expect(definitions.properties.elementProps?.ddicDataElement).toBe(
      "s_dep_time"
    )
  })
)

test(
  "CDS DDIC elements single",
  runTest(async (c: ADTClient) => {
    const elements = await c.ddicRepositoryAccess("sca*")
    expect(elements).toBeDefined()
    expect(elements.length).toBeGreaterThan(10)
    const scarr = elements.find(d => d.name === "scarr")
    expect(scarr?.uri).toBe("/sap/bc/adt/ddic/tables/scarr")
    expect(scarr?.type).toBe("TABL/DT")
  })
)

test(
  "CDS DDIC elements multiple",
  runTest(async (c: ADTClient) => {
    const elements = await c.ddicRepositoryAccess(["scarr.dis", "spfli.dis"])
    expect(elements).toBeDefined()
    expect(elements.length).toBe(2)
    const distance = elements.find(d => d.name === "distance")
    expect(distance?.uri).toBe("not_used")
    expect(distance?.type).toBe("TABL/DTF")
  })
)

test("type validation for service binding options", () => {
  const testdata: NewObjectOptions | NewBindingOptions = {
    description: "f",
    name: "YMU_BFOO",
    objtype: "SRVB/SVB",
    parentName: "YMU_RAP_TRAVEL",
    parentPath: "/sap/bc/adt/packages/YMU_RAP_TRAVEL",
    responsible: "CB0000000083",
    bindingtype: "ODATA",
    category: "0",
    service: "YMU_RAP_UI_TRAVEL"
  }
  expect(isBindingOptions(testdata)).toBe(true)
})

test(
  "feed list",
  runTest(async (c: ADTClient) => {
    const feeds = await c.feeds()
    const dumps = feeds.find(f => f.href === "/sap/bc/adt/runtime/dumps")
    expect(dumps).toBeDefined()
    expect(dumps?.accept).toBe("application/atom+xml")
  })
)

test(
  "dumps",
  runTest(async (c: ADTClient) => {
    const feeds = await c.feeds()
    const dumps = feeds.find(f => f.href === "/sap/bc/adt/runtime/dumps")
    expect(dumps).toBeDefined()
    const query = dumps?.queryVariants.find(v => v.isDefault)
    const dumpsFeed = await c.dumps(query?.queryString)
    expect(dumpsFeed.dumps).toBeDefined()
    if (dumpsFeed.dumps.length) {
      const last = dumpsFeed.dumps[0]
      expect(last.text).toBeDefined()
    }
  })
)

test("parse uri range", () => {
  const { uri, range } = parseUri("#start=4,13;end=4,16")
  expect(uri).toBe("")
  expect(range.start.line).toBe(4)
  expect(range.end.line).toBe(4)
  expect(range.start.column).toBe(13)
  expect(range.end.column).toBe(16)
})
