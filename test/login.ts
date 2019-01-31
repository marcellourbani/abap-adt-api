import { Agent } from "https"
import { ADTClient } from "../src"
import { AdtHTTP } from "../src/AdtHTTP"

export function create() {
  return new ADTClient(
    process.env.ADT_URL!,
    process.env.ADT_USER!,
    process.env.ADT_PASS!,
    "",
    "",
    {
      httpsAgent: new Agent({
        rejectUnauthorized: false // not a good idea for production code, required to trust some self-signed certificate
      })
    }
  )
}
export function createHttp(language: string = "") {
  return new AdtHTTP(
    process.env.ADT_URL!,
    process.env.ADT_USER!,
    process.env.ADT_PASS!,
    "",
    language,
    {
      httpsAgent: new Agent({
        rejectUnauthorized: false // see above
      })
    }
  )
}
