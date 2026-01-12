// DISRUPTIVE TESTS!
// these tests call a real system.
// will only work if there's one connected and the environment variables are set
// will actually change the data on the server, run at your own risk
import { session_types } from "../"
import { NewObjectOptions } from "../"
import { AdtLock } from "../"
import { ADTClient } from "../AdtClient"
import {
  ChangePackageRefactoring,
  hasPackageOptions,
  isGroupType,
  NewPackageOptions,
  RenameRefactoringProposal,
  TraceParameters,
  TracesCreationConfig,
  TransportsOfUser
} from "../api"
import { ObjectValidateOptions } from "./../api"
import { hasAbapGit, runTest } from "./login"
const doRunTest = (f: (c: ADTClient) => Promise<void>) => runTest(f)()
function enableWrite(time1: Date) {
  // will always return false. Switch in debug to run tests
  const time2 = new Date()
  const diff = time2.getTime() - time1.getTime()
  return diff > 1000 || process.env.ADT_ENABLE_ALL === "YES"
}

async function deleteObj(object: string, c: ADTClient, rethrow = false) {
  let result
  try {
    c.stateful = session_types.stateful
    const handle = await c.lock(object)
    result = await c.deleteObject(object, handle.LOCK_HANDLE)
  } catch (e) {
    // most probably doesn't exist
    if (rethrow) throw e
  }
  await c.dropSession()
  return result
}

async function createObj(
  options: NewObjectOptions,
  newobject: string,
  c: ADTClient
) {
  if (isGroupType(options.objtype)) return

  const baseValidateOptions = {
    ...options,
    objname: options.name,
    packagename: options.parentName
  } as ObjectValidateOptions // typescript is not smart enough to rule out grouptypes, so I have to cast
  const validateOptions = hasPackageOptions(options)
    ? {
        ...baseValidateOptions,
        swcomp: options.swcomp,
        transportLayer: options.transportLayer,
        packagetype: options.description
      }
    : baseValidateOptions

  const vresult = await c.validateNewObject(validateOptions)
  expect(vresult).toBeDefined()
  expect(vresult.success).toBeTruthy()
  // use a stateless clone as regular calls leave the backend in a weird state
  await c.statelessClone.createObject(options)
  return await c.objectStructure(newobject)
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const ignore = () => {}
const writeobject = async (
  c: ADTClient,
  path: string,
  source: string,
  transport = process.env.ADT_TRANS || ""
) => {
  const prevstate = c.stateful
  try {
    c.stateful = session_types.stateful
    const handle = await c.lock(path)
    await c.setObjectSource(path, source, handle.LOCK_HANDLE, transport)
    await c.unLock(path, handle.LOCK_HANDLE)
    const baseUrl = path.replace(/\/source|includes\/.*$/, "")
    const objectName = path.replace(/.*\//, "")
    await c.activate(objectName, baseUrl)
  } finally {
    c.stateful = prevstate
  }
}

test("createTransport", async () => {
  if (!enableWrite(new Date())) return
  await doRunTest(async (c: ADTClient) => {
    const transp = await c.createTransport(
      "/sap/bc/adt/oo/classes/zapidummytestcreation/source/main",
      "creation test",
      "ZAPIDUMMY"
    )
    expect(transp).toMatch(new RegExp(`${process.env.ADT_SYSTEMID}K9[\d]*`))
  })
})

test("Create and delete", async () => {
  if (!enableWrite(new Date())) return
  await doRunTest(async (c: ADTClient) => {
    // first create, then delete
    const options: NewObjectOptions = {
      description: "test object for ADT API",
      name: "Y_ADTNPM_FOOBAR",
      objtype: "FUGR/F",
      parentName: "$TMP",
      parentPath: "/sap/bc/adt/packages/$TMP"
    }
    const newobject = "/sap/bc/adt/functions/groups/y_adtnpm_foobar"
    await deleteObj(newobject, c)
    await c.login()
    await c.createObject(options)
    // group created, let's create a function module now
    await c.createObject({
      description: "test FM",
      name: "Y_ADTNPM_FOOBARFM",
      objtype: "FUGR/FF",
      parentName: "Y_ADTNPM_FOOBAR",
      parentPath: newobject
    })
    await deleteObj(newobject, c, true)
  })
})

test("write_program", async () => {
  if (!enableWrite(new Date())) return
  await doRunTest(async (c: ADTClient) => {
    const name = "zadttest_temporary"
    const path = "/sap/bc/adt/programs/programs/" + name
    const main = path + "/source/main"
    const source = `Report ${name}.\nwrite:/ 'Hello,World!'.`
    await deleteObj(path, c).then(ignore)
    try {
      await c.createObject({
        description: "temporary test program",
        name,
        objtype: "PROG/P",
        parentName: "$TMP",
        parentPath: "/sap/bc/adt/packages/$TMP"
      })
      c.stateful = session_types.stateful
      const handle = await c.lock(path)
      // write the program
      await c.setObjectSource(main, source, handle.LOCK_HANDLE)
      // read it
      const newsource = await c.getObjectSource(main)
      expect(newsource).toMatch(/Hello,World!/m)
      // delete
      await c.deleteObject(path, handle.LOCK_HANDLE)
      await c.unLock(path, handle.LOCK_HANDLE)
    } finally {
      await c.dropSession()
    }
  })
})

test("save with transport", async () => {
  if (!enableWrite(new Date())) return
  jest.setTimeout(18000)
  await doRunTest(async (c: ADTClient) => {
    const url =
      "/sap/bc/adt/oo/classes/zapidummyfoobar/includes/implementations"
    await writeobject(c, url, "")
  })
})

test("Create and delete interface", async () => {
  if (!enableWrite(new Date())) return
  await doRunTest(async (c: ADTClient) => {
    // first create, then delete
    const newobject = "/sap/bc/adt/oo/interfaces/YIF_ADTNPM_FOOBAR"
    await c.createObject(
      "INTF/OI",
      "YIF_ADTNPM_FOOBAR",
      "$TMP",
      "test object for ADT API",
      "/sap/bc/adt/packages/$TMP"
    )
    // create successful, will try a deletion. Need to lock first
    // locks only work in stateful sessions
    try {
      c.stateful = session_types.stateful
      const handle = await c.lock(newobject)
      expect(handle.LOCK_HANDLE).not.toBe("")
      await c.deleteObject(newobject, handle.LOCK_HANDLE)
    } catch (e) {
      fail("Deletion error")
    }
  })
})

test("Create inactive and try to activate", async () => {
  if (!enableWrite(new Date())) return
  await doRunTest(async (c: ADTClient) => {
    // first delete just in care there are leftovers
    // then create, and finally delete
    const options: NewObjectOptions = {
      description: "test inactive object for ADT API",
      name: "zadttestinactive",
      objtype: "PROG/P",
      parentName: "$TMP",
      parentPath: "/sap/bc/adt/packages/$TMP"
    }
    const newobject = "/sap/bc/adt/programs/programs/zadttestinactive"
    // 2 syntax errors
    const contents = "REPORT zadttestinactive.\nfsdf.\nWRITE:/ 'Hello, World!'"
    // DELETE:
    let handle: AdtLock | undefined
    try {
      c.stateful = session_types.stateful
      handle = await c.lock(newobject)
      await c.deleteObject(newobject, handle.LOCK_HANDLE)
    } catch (e) {
      // most probably doesn't exist
    }
    await c.dropSession()
    handle = undefined

    try {
      // CREATE
      // use a stateless clone as regular calls leave the backend in a weird state
      await c.statelessClone.createObject(options)
      c.stateful = session_types.stateful
      handle = await c.lock(newobject)
      expect(handle.LOCK_HANDLE).not.toBe("")
      // WRITE CONTENTS
      await c.setObjectSource(
        newobject + "/source/main",
        contents,
        handle.LOCK_HANDLE
      )
      await c.unLock(newobject, handle.LOCK_HANDLE)
      // ACTIVATE
      const result = await c.activate(
        "zadttestinactive",
        "/sap/bc/adt/programs/programs/zadttestinactive"
      )
      expect(result).toBeDefined()
      expect(result.success).toBe(false)
      handle = await c.lock(newobject)
      // DELETE
      await c.deleteObject(newobject, handle.LOCK_HANDLE)
    } catch (e) {
      throw e
    }
  })
})

test("pretty printer settings", async () => {
  if (!enableWrite(new Date())) return
  await doRunTest(async (c: ADTClient) => {
    const settings = await c.prettyPrinterSetting()
    expect(settings).toBeDefined()
    expect(settings["abapformatter:indentation"]).toBe(true)

    const newStyle =
      settings["abapformatter:style"] === "toUpper" ? "toLower" : "toUpper"
    // change
    await c.setPrettyPrinterSetting(
      settings["abapformatter:indentation"],
      newStyle
    )
    const changed = await c.prettyPrinterSetting()
    // restore
    await c.setPrettyPrinterSetting(
      settings["abapformatter:indentation"],
      settings["abapformatter:style"]
    )
    expect(changed).toBeDefined()
    expect(changed["abapformatter:style"]).toBe(newStyle)
  })
})

test("Create CDS objects", async () => {
  if (!enableWrite(new Date())) return
  await doRunTest(async (c: ADTClient) => {
    const options: NewObjectOptions = {
      description: "test CDS AC creation",
      name: "zadttestcdsaccon",
      objtype: "DCLS/DL",
      parentName: "$TMP",
      parentPath: "/sap/bc/adt/packages/$TMP"
    }
    const acconobj = `/sap/bc/adt/acm/dcl/sources/zadttestcdsaccon`
    const metaobj = `/sap/bc/adt/ddic/ddlx/sources/zadttestcdsmeta`
    const ddefobj = `/sap/bc/adt/ddic/ddl/sources/ZADT_TEST_DD`
    // DELETE:
    await deleteObj(acconobj, c)
    await deleteObj(metaobj, c)
    await deleteObj(ddefobj, c)
    try {
      // CREATE
      const result = await createObj(options, acconobj, c)
      expect(result).toBeDefined()
      expect(result!.objectUrl).toBeDefined()

      options.name = "zadttestcdsmeta"
      options.objtype = "DDLX/EX"
      const res2 = await createObj(options, acconobj, c)
      expect(res2).toBeDefined()
      expect(res2!.objectUrl).toBeDefined()

      options.name = "ZADT_TEST_DD"
      options.objtype = "DDLS/DF"
      const res3 = await createObj(options, acconobj, c)
      expect(res3).toBeDefined()
      expect(res3!.objectUrl).toBeDefined()

      await deleteObj(acconobj, c)
      await deleteObj(metaobj, c)
      await deleteObj(ddefobj, c)
    } finally {
      await c.dropSession()
      await deleteObj(acconobj, c)
      await deleteObj(metaobj, c)
      await deleteObj(ddefobj, c)
    }
  })
})

test("Create and delete a package", async () => {
  if (!enableWrite(new Date())) return
  const TMPPACKAGE = "$ADTAPIDUMMYPACKAGE"
  const TMPPACKAGEURL = `/sap/bc/adt/packages/${TMPPACKAGE}`
  await doRunTest(async (c: ADTClient) => {
    const options: NewPackageOptions = {
      description: "test Package creation",
      name: TMPPACKAGE,
      objtype: "DEVC/K",
      parentName: "$TMP",
      parentPath: "/sap/bc/adt/packages/$TMP",
      transportLayer: "",
      swcomp: "LOCAL",
      packagetype: "development"
    }
    // cleanup drom previous runs
    await deleteObj(TMPPACKAGEURL, c)
    try {
      const result = await createObj(options, TMPPACKAGEURL, c)
      expect(result).toBeDefined()
      expect(result!.objectUrl).toBeDefined()
      await deleteObj(TMPPACKAGEURL, c, true)
    } finally {
      await c.dropSession()
      await deleteObj(TMPPACKAGEURL, c)
    }
  })
})

test("Release a transport", async () => {
  if (!enableWrite(new Date())) return
  jest.setTimeout(8000) // this usually takes longer than the default 5000
  await doRunTest(async (c: ADTClient) => {
    const transp = await c.createTransport(
      "/sap/bc/adt/oo/classes/zapidummytestcreation/source/main",
      "release test",
      "ZAPIDUMMY"
    )
    expect(transp).toBeDefined()

    const result = await c.statelessClone.transportRelease(transp)

    expect(result.length).toBeGreaterThan(0)
    // will fail with abortrelapifail if TMS not configured
    expect(result[0]["chkrun:status"]).toBe("released")
  })
})
const findTrans = (transports: TransportsOfUser, target: string) => {
  for (const s of transports.workbench)
    for (const t of s.modifiable) if (t["tm:number"] === target) return t
}

test("Delete a transport", async () => {
  if (!enableWrite(new Date())) return
  await doRunTest(async (c: ADTClient) => {
    const gettrans = async () => {
      const isNew = await c.hasTransportConfig()
      if (isNew) {
        const configs = await c.transportConfigurations()
        const oldconfig = await c.getTransportConfiguration(configs[0].link)
        await c.setTransportsConfig(configs[0].link, configs[0].etag, {
          ...oldconfig,
          WorkbenchRequests: true,
          User: process.env.ADT_USER!
        })
        const transports = await c.transportsByConfig(configs[0].link)
        return transports
      }
      return c.userTransports(process.env.ADT_USER!)
    }
    const transp = await c.createTransport(
      "/sap/bc/adt/oo/classes/zapidummytestcreation/source/main",
      "transport delete test",
      "ZAPIDUMMY"
    )
    expect(transp).toBeDefined()

    let result = await gettrans()

    expect(findTrans(result, transp)).toBeDefined()

    await c.statelessClone.transportDelete(transp)
    result = await gettrans()

    expect(findTrans(result, transp)).toBeUndefined()
  })
})

test("Transport user changes", async () => {
  if (!enableWrite(new Date())) return
  await doRunTest(async (c: ADTClient) => {
    const transp = await c.createTransport(
      "/sap/bc/adt/oo/classes/zapidummytestcreation/source/main",
      "transport user change",
      "ZAPIDUMMY"
    )
    expect(transp).toBeDefined()
    const resp = await c.transportSetOwner(transp, "DDIC")
    expect(resp["tm:targetuser"]).toBe("DDIC")
    // reset user to allow deletion
    try {
      await c.statelessClone.transportDelete(transp)
      fail("Allowed to delete a transport after owner change")
    } catch (e) {
      // nothing to do...
    }
  })
})

test("Create transports", async () => {
  if (!enableWrite(new Date())) return
  await doRunTest(async (c: ADTClient) => {
    const transp = await c.createTransport(
      "/sap/bc/adt/oo/classes/zapidummytestcreation/source/main",
      "transport user add",
      "ZAPIDUMMY"
    )
    expect(transp).toBeDefined()
    try {
      const resp = await c.transportAddUser(transp, "DDIC")
      expect(resp["tm:number"].length).toBe(10)
      expect(resp["tm:targetuser"]).toBe("DDIC")
      expect(resp["tm:number"]).not.toBe(transp)
    } finally {
      // cleanup
      await c.statelessClone.transportDelete(transp)
    }
  })
})

test("Create a test classes", async () => {
  if (!enableWrite(new Date())) return
  await doRunTest(async (c: ADTClient) => {
    const clas = "ZADTFOOBARTESTTCINCL"
    const clasurl = "/sap/bc/adt/oo/classes/" + clas.toLowerCase()
    try {
      // preventive cleanup
      c.stateful = session_types.stateful
      const lock = await c.lock(clasurl)
      await c.deleteObject(clasurl, lock.LOCK_HANDLE)
      await c.dropSession()
    } catch (e) {
      // ignore
    }
    await c.createObject(
      "CLAS/OC",
      clas,
      "$TMP",
      "test with test classes include",
      "/sap/bc/adt/packages/$TMP"
    )
    // I got there => class created
    try {
      c.stateful = session_types.stateful
      const lock = await c.lock(clasurl)
      await c.createTestInclude(clas, lock.LOCK_HANDLE)
      await c.dropSession()
      const source = await c.getObjectSource(clasurl + "/includes/testclasses")
      expect(source).toBeDefined()
    } finally {
      // cleanup
      await c.dropSession()
      c.stateful = session_types.stateful
      const lock = await c.lock(clasurl)
      await c.deleteObject(clasurl, lock.LOCK_HANDLE)
      await c.dropSession()
    }
  })
})

test("create and pull AbapGit Repo", async () => {
  if (!enableWrite(new Date())) return
  const PACKAGEURL =
    "https://github.com/marcellourbani/adt_api_dummy_test_repository.git"
  const PACKAGENAME = "$ADTAPI_TEST_GIT_REPO_DUMMY"
  const OBJECT = "/sap/bc/adt/programs/programs/zadtapi_test_git_program_dummy"
  jest.setTimeout(25000) // 5 seconds are a bit tight
  await doRunTest(async (c: ADTClient) => {
    if (await hasAbapGit(c)) {
      const getRepo = async () => {
        const repos = await c.gitRepos()
        for (const repo of repos.filter(r => r.sapPackage === PACKAGENAME))
          return repo
      }
      const cleanup = async () => {
        await deleteObj(OBJECT, c)
        await deleteObj(`/sap/bc/adt/packages/${PACKAGENAME}`, c)
        const repo = await getRepo()
        if (repo) await c.gitUnlinkRepo(repo.key)
      }

      await cleanup()

      const options: NewPackageOptions = {
        description: "test Package creation",
        name: PACKAGENAME,
        objtype: "DEVC/K",
        parentName: "$TMP",
        parentPath: "/sap/bc/adt/packages/$TMP",
        transportLayer: "",
        swcomp: "LOCAL",
        packagetype: "development"
      }
      try {
        await createObj(options, `/sap/bc/adt/packages/${PACKAGENAME}`, c)
        const objects = await c.gitCreateRepo(PACKAGENAME, PACKAGEURL)
        expect(objects).toBeDefined()
        await deleteObj(OBJECT, c)
        // object deleted, pull it
        const repo = await getRepo()
        if (repo) {
          const pulledObjects = await c.gitPullRepo(repo.key)
          expect(pulledObjects).toBeDefined()
          const source = await c.getObjectSource(`${OBJECT}/source/main`)
          expect(source).toBeDefined()
        } else fail("new repository doesn't exits")
      } finally {
        await cleanup()
      }
    }
  })
})

test(
  "rename",
  runTest(async (c: ADTClient) => {
    jest.setTimeout(8000) // this usually takes longer than the default 5000
    if (!enableWrite(new Date())) return
    const uri = "/sap/bc/adt/oo/classes/zapiadt_testcase_class1/source/main"
    const renameEvaluate = await c.renameEvaluate(uri, 22, 11, 11)
    expect(renameEvaluate).toBeDefined()
    expect(renameEvaluate["oldName"]).toBe("lv_test")
    renameEvaluate["newName"] = "lv_test3"
    const renamePreview: RenameRefactoringProposal = { ...renameEvaluate }
    renamePreview["affectedObjects"].forEach(obj =>
      obj["textReplaceDeltas"].forEach(replaceDelta => {
        replaceDelta["contentNew"] = "lv_test3"
        replaceDelta["contentOld"] = "lv_test"

        return replaceDelta
      })
    )
    const info = await c.transportInfo(
      renameEvaluate.affectedObjects[0].parentUri,
      "ZAPIDUMMY"
    )
    const preview = await c.renamePreview(
      renamePreview,
      info.LOCKS?.HEADER.TRKORR
    )
    expect(preview).toBeDefined()

    if (!enableWrite(new Date())) return
    const prevsource = await c.getObjectSource(uri)
    try {
      const execute = await c.renameExecute(preview)
      expect(execute).toBeDefined()
    } finally {
      await writeobject(c, uri, prevsource).catch(ignore)
    }
  })
)

test(
  "extract method",
  runTest(async (c: ADTClient) => {
    const classname =
      "/sap/bc/adt/oo/classes/zapiadt_testcase_class1/source/main"
    const proposal = await c.extractMethodEvaluate(classname, {
      start: { line: 32, column: 0 },
      end: { line: 33, column: 15 }
    })
    expect(proposal.content).toBeDefined()
    expect(proposal.className).toBe("ZAPIADT_TESTCASE_CLASS1")
    proposal.name = "mymethod"
    const preview = await c.extractMethodPreview(proposal)
    expect(preview).toBeDefined()
    if (!enableWrite(new Date())) return
    preview.transport = process.env.ADT_TRANS ?? ""
    const prevsource = await c.getObjectSource(classname)
    try {
      const done = await c.extractMethodExecute(preview)
      expect(done).toBeDefined()
    } finally {
      await writeobject(c, classname, prevsource).catch(ignore)
    }
  })
)

const readAtcVariant = async (c: ADTClient) => {
  const cust = await c.atcCustomizing()
  const cv = cust.properties.find(x => x.name === "systemCheckVariant")
  return c.atcCheckVariant(`${cv?.value}`)
}

test(
  "change contact",
  runTest(async (c: ADTClient) => {
    const variant = await readAtcVariant(c)
    const run = await c.createAtcRun(
      variant,
      "/sap/bc/adt/oo/classes/zapiadt_testcase_console/source/main"
    )
    const findings = await c.atcWorklists(run.id)
    const contactUri = await c.atcContactUri(
      findings.objects[0].findings[0].uri
    )
    if (!enableWrite(new Date())) return
    await c.atcChangeContact(contactUri, process.env.ADT_USER || "")
  })
)

test(
  "request exemption",
  runTest(async (c: ADTClient) => {
    const variant = await readAtcVariant(c)
    const sourceurl =
      "/sap/bc/adt/oo/classes/zapiadt_testcase_console/source/main"
    const run = await c.createAtcRun(variant, sourceurl)
    const findings = await c.atcWorklists(run.id)
    const firstfinding = findings.objects[0]?.findings[0]
    if (!firstfinding?.quickfixInfo)
      if (!firstfinding.exemptionApproval.match(/^\s*$/)) {
        console.error("skipping exemption request because already exists")
        return
      } else
        fail(
          "no quickfix info, you might have existing findings for this class"
        )
    try {
      const proposal = await c.atcExemptProposal(firstfinding.quickfixInfo)
      if (c.isProposalMessage(proposal)) fail("Exemption proposal expected")
      proposal.justification = "Created by unit test"
      proposal.reason = "FPOS"
      proposal.restriction.enabled = true
      proposal.restriction.singlefinding = true
      proposal.approver = process.env.ADT_ATCAPPROVER || ""
      if (!enableWrite(new Date())) return
      const exemption = await c.atcRequestExemption(proposal)
      if (exemption.type === "E") fail(exemption.message)
    } catch (error) {
      fail(error)
    }
  })
)

test(
  "create/list/delete trace request",
  runTest(async (c: ADTClient) => {
    if (!enableWrite(new Date())) return
    const params: TraceParameters = {
      allMiscAbapStatements: false,
      allProceduralUnits: true,
      allInternalTableEvents: false,
      allDynproEvents: false,
      aggregate: false,
      explicitOnOff: false,
      withRfcTracing: false,
      allSystemKernelEvents: false,
      sqlTrace: false,
      allDbEvents: true,
      maxSizeForTraceFile: 30720,
      maxTimeForTracing: 1800,
      description: "FOOBAR"
    }
    const parametersId = await c.tracesSetParameters(params)
    expect(parametersId).toBeTruthy()
    const config: TracesCreationConfig = {
      description: "FOOBAR__adt_unittest_",
      expires: new Date(new Date().getTime() + 10000),
      maximalExecutions: 1,
      objectType: "URL",
      processType: "HTTP",
      parametersId,
      traceClient: c.client,
      traceUser: c.username
    }
    const resp = await c.tracesCreateConfiguration(config)
    expect(resp).toBeTruthy()
    const requests = await c.tracesListRequests()
    const myreq = requests.requests.find(
      r => r.extendedData.description === config.description
    )
    await c.tracesDeleteConfiguration(resp.requests[0].id)
    expect(myreq).toBeTruthy()
  })
)

test(
  "package refactoring",
  runTest(async (c: ADTClient) => {
    const objurl = "/sap/bc/adt/oo/classes/zapidummy_reassigntarget"
    const path = await c.findObjectPath(objurl)

    const in2 = path.find(p => p["adtcore:name"] === "ZAPIDUMMY_2")
    const from = in2 ? "ZAPIDUMMY_2" : "ZAPIDUMMY"
    const to = in2 ? "ZAPIDUMMY" : "ZAPIDUMMY_2"
    const changePackageInput: ChangePackageRefactoring = {
      oldPackage: from,
      newPackage: to,
      transport: process.env.ADT_TRANS || "",
      title: "",
      rootUserContent: "",
      ignoreSyntaxErrorsAllowed: false,
      ignoreSyntaxErrors: false,
      adtObjectUri: objurl,
      affectedObjects: {
        uri: objurl,
        type: "CLAS/OC",
        name: "zapidummy_reassigntarget",
        oldPackage: from,
        newPackage: to,
        parentUri: ""
      },
      userContent: ""
    }

    const proposal = await c.changePackagePreview(changePackageInput)
    expect(proposal).toBeDefined()
    if (!enableWrite(new Date())) return
    const result = await c.changePackageExecute(proposal)
    expect(result).toBeDefined()
  })
)
