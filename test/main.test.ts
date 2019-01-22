// these tests call a real system.
// will only work if there's one connected and the environment variables are set
import { ADTClient, isClassStructure } from "../src"
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

test("objectStructure", async () => {
  const c = create()
  await c.login()
  let structure = await c.objectStructure(
    "/sap/bc/adt/programs/programs/zabapgit"
  )
  expect(structure.links).toBeDefined()
  expect(structure.links!.length).toBeGreaterThan(0)
  expect(c.mainInclude(structure)).toBe(
    "/sap/bc/adt/programs/programs/zabapgit/source/main"
  )
  structure = await c.objectStructure(
    "/sap/bc/adt/functions/groups/zabapgit_parallel"
  )
  expect(structure.links).toBeDefined()
  expect(structure.links!.length).toBeGreaterThan(0)
  expect(c.mainInclude(structure)).toBe(
    "/sap/bc/adt/functions/groups/zabapgit_parallel/source/main"
  )
  structure = await c.objectStructure(
    "/sap/bc/adt/oo/classes/zcl_abapgit_dot_abapgit"
  )
  if (!isClassStructure(structure)) throw new Error("ss")
  expect(structure.includes.length).toBeGreaterThan(0)
  expect(c.mainInclude(structure)).toBe(
    "/sap/bc/adt/oo/classes/zcl_abapgit_dot_abapgit/source/main"
  )
  expect(c.classIncludes(structure).get("definitions")).toBe(
    "/sap/bc/adt/oo/classes/zcl_abapgit_dot_abapgit/includes/definitions"
  )
})
