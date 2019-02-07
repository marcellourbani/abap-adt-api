// DISRUPTIVE TESTS!
// these tests call a real system.
// will only work if there's one connected and the environment variables are set
// will actually change the data on the server, run at your own risk
import { session_types } from "../src/AdtHTTP"
import { NewObjectOptions } from "../src/api/objectcreator"
import { create } from "./login"

function enableWrite(time1: Date) {
  // will always return false. Switch in debug to run tests
  const time2 = new Date()
  const diff = time2.getTime() - time1.getTime()
  return diff > 1000
}
test("createTransport", async () => {
  if (!enableWrite(new Date())) return
  const c = create()
  const transp = await c.createTransport(
    "/sap/bc/adt/oo/classes/zapidummytestcreation/source/main",
    "creation test",
    "ZAPIDUMMY"
  )
  expect(transp).toMatch(/NPLK9[\d]*/)
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
    const wr = await c.setObjectSource(main, source, handle.LOCK_HANDLE)
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
  const path = "/sap/bc/adt/oo/classes/zcl_foobar/includes/implementations"
  const contents = ""
  try {
    c.stateful = session_types.stateful
    const handle = await c.lock("/sap/bc/adt/oo/classes/zcl_foobar")
    const result = await c.setObjectSource(
      path,
      contents,
      handle.LOCK_HANDLE,
      "NPLK900058"
    )
    await c.unLock("/sap/bc/adt/oo/classes/zcl_foobar", handle.LOCK_HANDLE)
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
