import { ADTClient, createSSLConfig } from "../"
import { AdtHTTP } from "../AdtHTTP"
export function create() {
  return new ADTClient(
    process.env.ADT_URL!,
    process.env.ADT_USER!,
    process.env.ADT_PASS!,
    "",
    "",
    createSSLConfig(!process.env.ADT_URL!.match(/^http:/i))
  )
}
export function createHttp(language: string = "") {
  return new AdtHTTP(
    process.env.ADT_URL!,
    process.env.ADT_USER!,
    process.env.ADT_PASS!,
    "",
    language,
    createSSLConfig(!process.env.ADT_URL!.match(/^http:/i))
  )
}
export async function hasAbapGit(c: ADTClient) {
  return !!(await c.featureDetails("abapGit Repositories"))
}

export const runTest = (f: (c: ADTClient) => Promise<void>) => {
  const c = create()
  return async () => {
    try {
      await f(c)
    } finally {
      jest.setTimeout(5000) // restore the default 5000
      if (c.statelessClone.loggedin) c.statelessClone.logout()
      if (c.loggedin) c.logout()
    }
  }
}
