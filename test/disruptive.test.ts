// DISRUPTIVE TESTS!
// these tests call a real system.
// will only work if there's one connected and the environment variables are set
// will actually change the data on the server, run at your own risk
import { ADTClient } from "../src"
import { create } from "./login"

function enableWrite() {
  // will always return false. Switch in debug to run tests
  const time1 = new Date()
  const time2 = new Date()
  const diff = time2.getTime() - time1.getTime()
  return diff > 1000
}
test("createTransport", async () => {
  if (!enableWrite()) return
  const c = create()
  await c.login()
  const transp = await c.createTransport(
    "/sap/bc/adt/oo/classes/zapidummytestcreation/source/main",
    "creation test",
    "ZAPIDUMMY"
  )
  expect(transp).toMatch(/NPLK9[\d]*/)
})
// create
// delete
