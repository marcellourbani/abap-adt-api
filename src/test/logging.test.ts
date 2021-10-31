import { Axios, AxiosRequestConfig, AxiosResponse } from "axios"
import { ADTClient, createSSLConfig } from ".."

interface Call {
  request: AxiosRequestConfig
  response?: AxiosResponse
}
// TODO: add support for request logging, lost on axios migration
test("login", async () => {
  if (!process.env.ADT_URL) return
  const requests = new Map<number, Call>()
  const options = createSSLConfig(!process.env.ADT_URL!.match(/^http:/i))
  // options.debugCallback = (
  //   type: LogPhase,
  //   data: LogData,
  //   r: RequestAPI<Request, CoreOptions, RequiredUriUrl>
  // ) => {
  //   switch (type) {
  //     case "request":
  //       requests.set(data.debugId, { request: data as RequestData })
  //       break

  //     case "response":
  //       const req = requests.get(data.debugId)
  //       if (!req) throw new Error("Response without a request")
  //       req.response = data as ResponseData
  //       break
  //     default:
  //       throw new Error("Unexpected request type logged")
  //   }
  // }
  const c = new ADTClient(
    process.env.ADT_URL!,
    process.env.ADT_USER!,
    process.env.ADT_PASS!,
    "",
    "",
    options
  )
  expect(c).toBeDefined()
  await c.login()

  // expect(requests.size).toBe(1)
  // requests.forEach(req => {
  //   expect(req.response).toBeDefined()
  //   // expect(req.request.debugId).toEqual(req.response!.debugId)
  // })
})
