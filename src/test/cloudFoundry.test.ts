import { ADTClient } from "./../AdtClient"
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
  repopkg = ""
} = JSON.parse(process.env.ADT_CP || "") as { [key: string]: string }

const oauth = new ClientOAuth2({
  authorizationUri: `${uaaUrl}/oauth/authorize`,
  accessTokenUri: `${uaaUrl}/oauth/token`,
  redirectUri: "http://localhost/notfound",
  clientId,
  clientSecret
})
const token = oauth
  .createToken(accessToken, refreshToken, tokenType, {})
  .refresh()
  .then(t => t.accessToken)

test("abapgit repos on CF", async () => {
  const client = new ADTClient(url, user, () => token)
  const repos = await client.gitRepos()
  const repo = repos.find(r => r.sapPackage === repopkg)
  expect(repo).toBeDefined()
  const staged = await client.stageRepo(repo!)
  expect(staged).toBeDefined()
  fail(2)
})
