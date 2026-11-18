import { AdtHTTP } from "../AdtHTTP"
import { transportsByConfig, userTransports } from "../api/transports"

// offline tests: the HTTP layer is stubbed with synthetic ADT responses
const NS = 'xmlns:tm="http://www.sap.com/cts/adt/tm"'

const request = (number: string, desc: string, task: string) => `
  <tm:request tm:number="${number}" tm:owner="DEVELOPER" tm:desc="${desc}" tm:status="D" tm:uri="/sap/bc/adt/cts/transportrequests/${number}">
    <tm:task tm:number="${task}" tm:owner="DEVELOPER" tm:desc="${desc}" tm:status="D" tm:uri="/sap/bc/adt/cts/transportrequests/${task}">
      <tm:abap_object tm:pgmid="R3TR" tm:type="PROG" tm:name="ZTEST_PROG" tm:obj_info="Program" tm:dummy_uri=""/>
    </tm:task>
  </tm:request>`

const root = (workbench: string, customizing = "") =>
  `<?xml version="1.0" encoding="UTF-8"?>
<tm:root ${NS}>
  <tm:workbench>${workbench}</tm:workbench>
  <tm:customizing>${customizing}</tm:customizing>
</tm:root>`

const direct = root(`
  <tm:target tm:name="DEV" tm:desc="Development system">
    <tm:modifiable>${request("DEVK900001", "Direct modifiable", "DEVK900002")}</tm:modifiable>
    <tm:released>${request("DEVK900003", "Direct released", "DEVK900004")}</tm:released>
  </tm:target>`)

const nested = root(
  `
  <tm:target tm:name="/ZLOC/" tm:desc="Local transport group">
    <tm:project tm:projectId="_____" tm:name="ZPROJ01">
      <tm:modifiable>${request("DEVK900011", "Nested modifiable", "DEVK900012")}</tm:modifiable>
      <tm:released>${request("DEVK900013", "Nested released", "DEVK900014")}</tm:released>
    </tm:project>
    <tm:project tm:projectId="_____" tm:name="ZPROJ02">
      <tm:modifiable>
        ${request("DEVK900015", "Second project A", "DEVK900016")}
        ${request("DEVK900017", "Second project B", "DEVK900018")}
      </tm:modifiable>
    </tm:project>
  </tm:target>`,
  `
  <tm:target tm:name="/ZLOC/" tm:desc="Local transport group">
    <tm:project tm:projectId="_____" tm:name="ZPROJ03">
      <tm:released>${request("DEVK900019", "Customizing nested", "DEVK900020")}</tm:released>
    </tm:project>
  </tm:target>`
)

const mixed = root(`
  <tm:target tm:name="DEV" tm:desc="Development system">
    <tm:modifiable>${request("DEVK900001", "Direct modifiable", "DEVK900002")}</tm:modifiable>
    <tm:project tm:projectId="_____" tm:name="ZPROJ01">
      <tm:modifiable>${request("DEVK900011", "Nested modifiable", "DEVK900012")}</tm:modifiable>
      <tm:released>${request("DEVK900013", "Nested released", "DEVK900014")}</tm:released>
    </tm:project>
  </tm:target>`)

const stub = (body: string) =>
  ({ request: async () => ({ body }) }) as unknown as AdtHTTP

const numbers = (rs: { "tm:number": string }[]) => rs.map(r => r["tm:number"])

test("user transports - requests directly under the target", async () => {
  const { workbench, customizing } = await userTransports(stub(direct), "DEVELOPER")
  expect(customizing).toEqual([])
  expect(workbench).toHaveLength(1)
  const [target] = workbench
  expect(target["tm:name"]).toBe("DEV")
  expect(target["tm:desc"]).toBe("Development system")
  expect(numbers(target.modifiable)).toEqual(["DEVK900001"])
  expect(numbers(target.released)).toEqual(["DEVK900003"])
  const req = target.modifiable[0]
  expect(req["tm:desc"]).toBe("Direct modifiable")
  expect(req["tm:owner"]).toBe("DEVELOPER")
  expect(req["tm:status"]).toBe("D")
  expect(req.tasks.map(t => t["tm:number"])).toEqual(["DEVK900002"])
  expect(req.tasks[0].objects[0]["tm:name"]).toBe("ZTEST_PROG")
})

test("user transports - requests nested under tm:project", async () => {
  const { workbench, customizing } = await userTransports(stub(nested), "DEVELOPER")
  expect(workbench).toHaveLength(1)
  const [target] = workbench
  expect(target["tm:name"]).toBe("/ZLOC/")
  expect(numbers(target.modifiable)).toEqual([
    "DEVK900011",
    "DEVK900015",
    "DEVK900017"
  ])
  expect(numbers(target.released)).toEqual(["DEVK900013"])
  expect(target.modifiable[0].tasks[0]["tm:number"]).toBe("DEVK900012")
  expect(target.modifiable[0].tasks[0].objects[0]["tm:name"]).toBe("ZTEST_PROG")
  expect(target.modifiable[1]["tm:desc"]).toBe("Second project A")
  expect(customizing).toHaveLength(1)
  expect(numbers(customizing[0].released)).toEqual(["DEVK900019"])
  expect(customizing[0].modifiable).toEqual([])
})

test("user transports - direct and nested requests in the same target", async () => {
  const { workbench } = await userTransports(stub(mixed), "DEVELOPER")
  const [target] = workbench
  expect(numbers(target.modifiable)).toEqual(["DEVK900001", "DEVK900011"])
  expect(numbers(target.released)).toEqual(["DEVK900013"])
})

test("transports by config - requests nested under tm:project", async () => {
  const { workbench } = await transportsByConfig(stub(mixed), "/some/config/uri")
  expect(numbers(workbench[0].modifiable)).toEqual(["DEVK900001", "DEVK900011"])
  expect(numbers(workbench[0].released)).toEqual(["DEVK900013"])
})
