import { ADTClient } from "../AdtClient"
import ClientOAuth2 from "client-oauth2"
const {
  accessToken = "",
  refreshToken = "",
  tokenType = "",
  clientId = "",
  clientSecret = "",
  uaaUrl = "",
  url = "",
  user = "",
  repopkg = "",
  repouser = "",
  repopwd = ""
} = JSON.parse(process.env.ADT_CP || "") as { [key: string]: string }

let oldToken: string = ""

const fetchToken = async () => {
  oldToken =
    oldToken ||
    (await new ClientOAuth2({
      authorizationUri: `${uaaUrl}/oauth/authorize`,
      accessTokenUri: `${uaaUrl}/oauth/token`,
      redirectUri: "http://localhost/notfound",
      clientId,
      clientSecret
    })
      .createToken(accessToken, refreshToken, tokenType, {})
      .refresh()
      .then(t => t.accessToken))
  return oldToken
}
test("abapgit repos on CF", async () => {
  jest.setTimeout(10000) // this usually takes longer than the default 5000
  if (!clientId) return
  const client = new ADTClient(url, user, fetchToken)
  const repos = await client.gitRepos()
  const repo = repos.find(r => r.sapPackage === repopkg)
  expect(repo).toBeDefined()
  const staged = await client.stageRepo(repo!, repouser, repopwd)
  expect(staged).toBeDefined()
  await client.checkRepo(repo!, repouser, repopwd)

  const branches = await client.remoteRepoInfo(repo!, repouser, repopwd)

  expect(
    branches.branches.map(b => b.display_name).find(n => n === "master")
  ).toBe("master")

  // commented out as would commit at every jest run...
  // staged.comment = "Commit from test"
  // staged.staged = staged.unstaged
  // staged.unstaged = []
  // await client.pushRepo(repo!, staged, repouser, repopwd)
})

test("read table", async () => {
  if (!clientId) return
  const client = new ADTClient(url, user, fetchToken)
  const data = await client.tableContents("/DMO/TRAVEL", 2)

  expect(data.values.length).toBe(3)
  expect(data.columns[0].name in data.values[0]).toBeTruthy()

})

test("run SQL", async () => {
  if (!clientId) return
  const client = new ADTClient(url, user, fetchToken)
  const data = await client.runQuery("SELECT TRAVEL_ID,CUSTOMER_ID,STATUS FROM /DMO/TRAVEL", 2)

  expect(data.values.length).toBe(2)
  expect(data.columns.length).toBe(3)
  expect(data.columns[0].name).toBe("TRAVEL_ID")
  expect(data.values[0].TRAVEL_ID).toBeTruthy()

})