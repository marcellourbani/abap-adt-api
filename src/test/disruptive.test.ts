// DISRUPTIVE TESTS!
// these tests call a real system.
// will only work if there's one connected and the environment variables are set
// will actually change the data on the server, run at your own risk
import { session_types } from "../"
import { NewObjectOptions } from "../"
import { AdtLock } from "../"
import { ADTClient } from "./../AdtClient"
import { isGroupType } from "./../api/objectcreator"
import { create } from "./login"

function enableWrite(time1: Date) {
  // will always return false. Switch in debug to run tests
  const time2 = new Date()
  const diff = time2.getTime() - time1.getTime()
  return diff > 1000 || process.env.ADT_ENABLE_ALL === "YES"
}
test("createTransport", async () => {
  if (!enableWrite(new Date())) return
  const c = create()
  const transp = await c.createTransport(
    "/sap/bc/adt/oo/classes/zapidummytestcreation/source/main",
    "creation test",
    "ZAPIDUMMY"
  )
  expect(transp).toMatch(new RegExp(`${process.env.ADT_SYSTEMID}K9[\d]*`))
})

test("Create and delete", async () => {
  if (!enableWrite(new Date())) return
  const c = create()
  // first create, then delete
  const options: NewObjectOptions = {
    description: "test object for ADT API",
    name: "Y_ADTNPM_FOOBAR",
    objtype: "FUGR/F",
    parentName: "$TMP",
    parentPath: "/sap/bc/adt/packages/$TMP"
  }
  const newobject = "/sap/bc/adt/functions/groups/y_adtnpm_foobar"
  await c.createObject(options)
  // group created, let's create a function module now
  await c.createObject({
    description: "test FM",
    name: "Y_ADTNPM_FOOBARFM",
    objtype: "FUGR/FF",
    parentName: "Y_ADTNPM_FOOBAR",
    parentPath: newobject
  })
  // create successful, will try a deletion. Need to lock first
  // locks only work in stateful sessions
  try {
    c.stateful = session_types.stateful
    const handle = await c.lock(newobject)
    expect(handle.LOCK_HANDLE).not.toBe("")
    await c.deleteObject(newobject, handle.LOCK_HANDLE)
  } catch (e) {
    fail("Deletion error")
  } finally {
    await c.dropSession()
  }
})

test("write_program", async () => {
  if (!enableWrite(new Date())) return
  const c = create()
  const name = "zadttest_temporary"
  const path = "/sap/bc/adt/programs/programs/" + name
  const main = path + "/source/main"
  // const source = new TextEncoder().encode(
  const source = `Report ${name}.\nwrite:/ 'Hello,World!'.`
  // )
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
    c.dropSession()
  }
})
test("save with transport", async () => {
  if (!enableWrite(new Date())) return
  const c = create()
  const path = "/sap/bc/adt/oo/classes/zapidummyfoobar/includes/implementations"
  const contents = ""
  try {
    c.stateful = session_types.stateful
    const handle = await c.lock("/sap/bc/adt/oo/classes/zapidummyfoobar")
    await c.setObjectSource(
      path,
      contents,
      handle.LOCK_HANDLE,
      process.env.ADT_TRANS
    )
    await c.unLock("/sap/bc/adt/oo/classes/zapidummyfoobar", handle.LOCK_HANDLE)
  } catch (e) {
    throw e
  } finally {
    c.dropSession()
  }
})

test("Create and delete interface", async () => {
  if (!enableWrite(new Date())) return
  const c = create()
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
  } finally {
    await c.dropSession()
  }
})

test("Create inactive and try to activate", async () => {
  if (!enableWrite(new Date())) return
  const c = create()
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
  } finally {
    await c.dropSession()
  }
})

test("pretty printer settings", async () => {
  if (!enableWrite(new Date())) return
  const c = create()
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

async function deleteObj(object: string, c: ADTClient) {
  let result
  try {
    c.stateful = session_types.stateful
    const handle = await c.lock(object)
    result = await c.deleteObject(object, handle.LOCK_HANDLE)
  } catch (e) {
    // most probably doesn't exist
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
  const vresult = await c.validateNewObject({
    objtype: options.objtype,
    objname: options.name,
    packagename: options.parentName,
    description: options.description
  })
  expect(vresult).toBeDefined()
  expect(vresult.success).toBeTruthy()
  // use a stateless clone as regular calls leave the backend in a weird state
  await c.statelessClone.createObject(options)
  return await c.objectStructure(newobject)
}

test("Create CDS objects", async () => {
  if (!enableWrite(new Date())) return
  const c = create()
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
  } catch (e) {
    throw e
  } finally {
    await c.dropSession()
    await deleteObj(acconobj, c)
    await deleteObj(metaobj, c)
    await deleteObj(ddefobj, c)
  }
})
