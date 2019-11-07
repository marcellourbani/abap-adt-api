import { AdtHTTP } from "../AdtHTTP"
import { fullParse, xmlArray, xmlNode, boolFromAbap } from "../utilities"

export interface GitRepo {
  key: string
  sapPackage: string
  url: string
  branch_name: string
  created_by: string
  created_at: Date
  link: string
}

export interface GitExternalInfo {
  access_mode: "PUBLIC" | "PRIVATE"
  branches: Array<{
    sha1: string
    name: string
    type: string
    is_head: boolean
    display_name: string
  }>
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

export async function externalRepoInfo(h: AdtHTTP, repourl: string) {
  const headers = {
    "Content-Type": "application/abapgit.adt.repo.info.ext.request.v1+xml",
    Accept: "application/abapgit.adt.repo.info.ext.response.v1+xml"
  }
  const response = await h.request(`/sap/bc/adt/abapgit/externalrepoinfo`, {
    method: "POST", // encodeEntity?
    body: `<?xml version="1.0" ?>
          <repository_ext>
            <url>${repourl}</url>
          </repository_ext>`,
    headers
  })
  const raw = fullParse(response.body)
  // tslint:disable-next-line: variable-name
  const access_mode = xmlNode(raw, "repository_external", "access_mode")
  const branches = xmlArray(
    raw,
    "repository_external",
    "branches",
    "branch"
  ).map((branch: any) => ({
    ...branch,
    is_head: boolFromAbap(branch && branch.is_head)
  }))
  return { access_mode, branches } as GitExternalInfo
}
