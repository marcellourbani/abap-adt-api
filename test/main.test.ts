// these tests call a real system.
// will only work if there's one connected and the environment variables are set
import { ADTClient } from "../src"
import { create } from "./login"

test("login", async () => {
  const c = create()
  expect(c).toBeDefined()
  await c.login()
  expect(c.csrfToken).not.toEqual("fetch")
})

test("getNodeContents", async () => {
  const c = create()
  expect(c).toBeDefined()
  await c.login()
  const resp = await c.getNodeContents({
    parent_name: "$ABAPGIT",
    parent_type: "DEVC/K"
  })
  expect(resp).toBeDefined()
  expect(resp.nodes).toBeDefined()
  const known = resp.nodes.find(x => x.OBJECT_NAME === "ZABAPGIT")
  expect(known).toBeDefined()
})

test("getReentranceTicket", async () => {
  const c = create()
  expect(c).toBeDefined()
  await c.login()
  const ticket = await c.getReentranceTicket()
  expect(ticket).toBeDefined()
  expect(ticket.match(/^[\w+/\!]+=*$/)).toBeDefined()
})
test("getTransportInfo", async () => {
  const c = create()
  expect(c).toBeDefined()
  await c.login()
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
