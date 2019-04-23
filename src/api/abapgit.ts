import { AdtHTTP } from "../AdtHTTP"
import { fullParse, xmlArray } from "../utilities"

export interface GitRepo {
  key: string
  sapPackage: string
  url: string
  branch_name: string
  created_by: string
  created_at: Date
  link: string
}

export async function gitRepos(h: AdtHTTP) {
  const response = await h.request(`/sap/bc/adt/abapgit/repos`)
  const raw = fullParse(response.body)
  return xmlArray(raw, "repositories", "repository").map((x: any) => {
    const {
      key,
      package: sapPackage,
      url,
      branch_name,
      created_by,
      created_at,
      "atom:link": l
    } = x

    const repo: GitRepo = {
      key,
      sapPackage,
      url,
      branch_name,
      created_by,
      created_at: new Date(created_at),
      link: l["@_href"]
    }
    return repo
  })
}
