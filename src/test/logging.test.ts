import { ADTClient, adtException, createSSLConfig, LogData, session_types } from ".."

test("login", async () => {
  if (!process.env.ADT_URL) return
  const requests = new Map<number, LogData>()
  const options = createSSLConfig(!process.env.ADT_URL!.match(/^http:/i))
  options.debugCallback = (data: LogData) => {
    requests.set(data.id, data)
  }
  const c = new ADTClient(
    process.env.ADT_URL!,
    process.env.ADT_USER!,
    process.env.ADT_PASS!,
    "",
    "",
    options
  )
  expect(c).toBeDefined()
  c.stateful = session_types.stateful
  await c.login()
  await c.statelessClone.getObjectSource("/sap/bc/adt/programs/programs/SHOUD_NOT_EXIST_FOOBAR/source/main").catch(x => x)

  expect(requests.size).toBe(3)
  expect(requests.get(1)!.response.statusCode).toBe(200)
  expect(requests.get(1)!.response.statusMessage).toBe("OK")
  expect(requests.get(1)!.id).toBeGreaterThan(0)
  expect(requests.get(1)!.duration).toBeGreaterThan(0)
  expect(requests.get(1)!.stateful).toBe(true)

  expect(requests.get(2)!.response.statusCode).toBe(200)
  expect(requests.get(2)!.response.statusMessage).toBe("OK")
  expect(requests.get(2)!.id).toBeGreaterThan(0)
  expect(requests.get(2)!.duration).toBeGreaterThan(0)
  expect(requests.get(2)!.stateful).toBe(false)

  expect(requests.get(3)!.response.statusCode).toBe(404)
  expect(requests.get(3)!.response.statusMessage).toBe("Not Found")
  expect(requests.get(3)!.id).toBeGreaterThan(0)
  expect(requests.get(3)!.duration).toBeGreaterThan(0)
  expect(requests.get(3)!.stateful).toBe(false)

})
