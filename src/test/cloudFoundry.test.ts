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
  repopwd = "",
} = JSON.parse(process.env.ADT_CP || "") as { [key: string]: string }

const oauth = new ClientOAuth2({
  authorizationUri: `${uaaUrl}/oauth/authorize`,
  accessTokenUri: `${uaaUrl}/oauth/token`,
  redirectUri: "http://localhost/notfound",
  clientId,
  clientSecret,
})
let oldToken: string = ""

const fetchToken = async () => {
  oldToken =
    oldToken ||
    (await new ClientOAuth2({
      authorizationUri: `${uaaUrl}/oauth/authorize`,
      accessTokenUri: `${uaaUrl}/oauth/token`,
      redirectUri: "http://localhost/notfound",
      clientId,
      clientSecret,
    })
      .createToken(accessToken, refreshToken, tokenType, {})
      .refresh()
      .then((t) => t.accessToken))
  return oldToken
}
test("abapgit repos on CF", async () => {
  jest.setTimeout(10000) // this usually takes longer than the default 5000
  const client = new ADTClient(url, user, fetchToken)
  const repos = await client.gitRepos()
  const repo = repos.find((r) => r.sapPackage === repopkg)
  expect(repo).toBeDefined()
  const staged = await client.stageRepo(repo!, repouser, repopwd)
  expect(staged).toBeDefined()
  await client.checkRepo(repo!, repouser, repopwd)

  const branches = await client.remoteRepoInfo(repo!, repouser, repopwd)

  expect(
    branches.branches.map((b) => b.display_name).find((n) => n === "master")
  ).toBe("master")

  // commented out as would commit at every jest run...
  // staged.comment = "Commit from test"
  // staged.staged = staged.unstaged
  // staged.unstaged = []
  // await client.pushRepo(repo!, staged, repouser, repopwd)
})
