import { AxiosError, AxiosHeaders, RawAxiosRequestHeaders } from "axios"
import { fromError, isHttpError } from ".."

test("detect login error", () => {
  const badlogin = new AxiosError(
    "Request failed with status code 401",
    "ERR_BAD_REQUEST",
    undefined,
    undefined,
    {
      status: 401,
      statusText: "Unauthorized",
      config: { headers: new AxiosHeaders() },
      headers: {},
      data: "<html></html>"
    }
  )
  const ex = fromError(badlogin)
  expect(isHttpError(ex)).toBe(true)
  expect(isHttpError(ex) && ex.code).toBe(401)
})
