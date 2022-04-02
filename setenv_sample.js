process.env.ADT_URL = "https://vhcalnplci.bti.local:44300/"
process.env.ADT_USER = "developer"
process.env.ADT_PASS = "secret"
process.env.ADT_TRANS = "NPLK900060"
process.env.ADT_SYSTEMID = "NPL"
// Optimal setup for password protected git repos
process.env.ADT_GIT_REPO = "https://github.com/myaccount/myprivateproject.git"
process.env.ADT_GIT_USER = "myuser"
process.env.ADT_ATCAPPROVER = "myapprover"
process.env.ADT_GIT_PASS = "secret"
// uncomment the following line to allow disrupting tests i.e. create and release transports, create and delete objects
// process.env.ADT_ENABLE_ALL = "YES"

// for connecting with cloud instances, like Cloud Platform Trial. Pretty hard to get the right values
process.env.ADT_CP = JSON.stringify({
  accessToken: "Oauth access token",
  refreshToken: "Oauth refresh token",
  tokenType: "bearer",
  clientId: "your client ID",
  clientSecret: "Your client secret",
  uaaUrl: "your UAA Url",
  url: "Abap instance URL",
  user: "Myusername",
  repopkg: "ZGITREPOPKG",
  repouser: "git repo user",
  repopwd: "git repo password"
})
