import { ADTClient } from "../src"
import { AdtHTTP } from "../src/AdtHTTP"

export function create() {
  return new ADTClient(
    process.env.ADT_URL!,
    process.env.ADT_USER!,
    process.env.ADT_PASS!,
    "",
    "",
    { cert: process.env.ADT_CERT, rejectUnauthorized: false }
  )
}
export function createHttp(language: string = "") {
  return new AdtHTTP(
    process.env.ADT_URL!,
    process.env.ADT_USER!,
    process.env.ADT_PASS!,
    "",
    language,
    { cert: process.env.ADT_CERT, rejectUnauthorized: false }
  )
}
