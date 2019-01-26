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
    objtype: "FUGR/FF",
    description: "test FM",
    name: "Y_ADTNPM_FOOBARFM",
    parentName: "Y_ADTNPM_FOOBAR",
    parentPath: newobject
  })
  // create successful, will try a deletion. Need to lock first
  // locks only work in stateful sessions
  c.stateful = session_types.stateful
  const handle = await c.lock(newobject)
  expect(handle.LOCK_HANDLE).not.toBe("")
  try {
    await c.deleteObject(newobject, handle.LOCK_HANDLE)
  } catch (e) {
    fail("Deletion error")
  } finally {
    await c.unLock(newobject, handle.LOCK_HANDLE)
    await c.dropSession()
  }
})
