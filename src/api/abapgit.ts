import { AdtHTTP } from "../AdtHTTP"
import {
  boolFromAbap,
  fullParse,
  xmlArray,
  xmlNode,
  xmlNodeAttr,
  stripNs
} from "../utilities"

import { parse } from "fast-xml-parser"
import { adtException } from "../AdtException"

export interface GitLink {
  href: string
  rel: string
  type?: string
}
export interface GitRepo {
  key: string
  sapPackage: string
  url: string
  branch_name: string
  created_by: string
  created_at: Date
  links: GitLink[]
}

export interface GitExternalInfo {
  access_mode: "PUBLIC" | "PRIVATE"
  branches: {
    sha1: string
    name: string
    type: string
    is_head: boolean
    display_name: string
  }[]
}

export interface GitObject {
  obj_type: string
  obj_name: string
  package: string
  obj_status: string
  msg_type: string
  msg_text: string
}

export interface GitStagingFile {
  name: string
  path: string
  localState: string
  links: GitLink[]
}
export interface GitStagingObject {
  wbkey: string
  uri: string
  type: string
  name: string
  abapGitFiles: GitStagingFile[]
}

export interface GitUser {
  name: string
  email: string
}

export interface GitStaging {
  staged: GitStagingObject[]
  unstaged: GitStagingObject[]
  ignored: GitStagingObject[]
  author: GitUser
  committer: GitUser
}

export async function gitRepos(h: AdtHTTP) {
  const response = await h.request(`/sap/bc/adt/abapgit/repos`)
  const raw = parse(response.body, {
    ignoreAttributes: false,
    parseAttributeValue: false,
    parseNodeValue: false
  })
  return xmlArray(raw, "repositories", "repository").map((x: any) => {
    const {
      key,
      package: sapPackage,
      url,
      branch_name,
      created_by,
      created_at
    } = x
    const links = xmlArray(x, "atom:link").map(xmlNodeAttr)
    const repo: GitRepo = {
      key,
      sapPackage,
      url,
      branch_name,
      created_by,
      created_at: new Date(created_at),
      links
    }
    return repo
  })
}

export async function externalRepoInfo(
  h: AdtHTTP,
  repourl: string,
  user = "",
  password = ""
) {
  const headers = {
    "Content-Type": "application/abapgit.adt.repo.info.ext.request.v1+xml",
    Accept: "application/abapgit.adt.repo.info.ext.response.v1+xml"
  }
  const response = await h.request(`/sap/bc/adt/abapgit/externalrepoinfo`, {
    method: "POST", // encodeEntity?
    body: `<?xml version="1.0" ?>
          <repository_ext>
            <url>${repourl}</url>
            <user>${user}</user>
            <password>${password}</password>
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

const parseObjects = (body: any) => {
  const raw = fullParse(body)
  return xmlArray(raw, "objects", "object") as GitObject[]
}

export async function createRepo(
  h: AdtHTTP,
  packageName: string,
  repourl: string,
  branch = "refs/heads/master",
  transport = "",
  user = "",
  password = ""
) {
  const headers = {
    "Content-Type": "application/abapgit.adt.repo.v1+xml"
  }
  const body = `<?xml version="1.0" ?>
  <repository>
    <branch>${branch}</branch>
    <transportRequest>${transport}</transportRequest>
    <package>${packageName}</package>
    <url>${repourl}</url>
    <user>${user}</user>
    <password>${password}</password>
  </repository>`
  const response = await h.request(`/sap/bc/adt/abapgit/repos`, {
    method: "POST",
    body,
    headers // encodeEntity?
  })

  return parseObjects(response.body)
}

export async function pullRepo(
  h: AdtHTTP,
  repoId: string,
  branch = "refs/heads/master",
  transport = "",
  user = "",
  password = ""
) {
  const headers = {
    "Content-Type": "application/abapgit.adt.repo.v1+xml"
  }
  branch = `<branch>${branch}</branch>`
  transport = transport
    ? `<transportRequest>${transport}</transportRequest>`
    : ""
  user = user ? `<user>${user}</user>` : ""
  password = password ? `<password>${password}</password>` : ""
  const body = `<?xml version="1.0" ?><repository>${branch}${transport}${user}${password}</repository>`
  const response = await h.request(`/sap/bc/adt/abapgit/repos/${repoId}/pull`, {
    method: "POST",
    body,
    headers
  })

  return parseObjects(response.body)
}

export async function unlinkRepo(h: AdtHTTP, repoId: string) {
  const headers = {
    "Content-Type": "application/abapgit.adt.repo.v1+xml"
  }
  await h.request(`/sap/bc/adt/abapgit/repos/${repoId}`, {
    method: "DELETE",
    headers
  })
}

export async function stageRepo(
  h: AdtHTTP,
  repo: GitRepo,
  user = "",
  password = ""
) {
  const link = repo.links.find(l => l.type === "stage_link")
  if (!link?.href) throw adtException("Stage link not found")
  const headers = {
    "Content-Type": "application/abapgit.adt.repo.stage.v1+xml"
  }

  const resp = await h.request(link.href, { headers })
  const raw = xmlNode(fullParse(resp.body), "abapgitstaging:abapgitstaging")
  const parsefile = (x: any) =>
    ({
      ...stripNs(xmlNodeAttr(x)),
      links: xmlArray(x, "atom:link")
        .map(xmlNodeAttr)
        .map(stripNs)
    } as GitStagingFile)
  const parseObject = (x: any) => {
    const attrs = stripNs(xmlNodeAttr(x))
    const abapGitFiles = xmlArray(x, "abapgitstaging:abapgitfile").map(
      parsefile
    )
    return { ...attrs, abapGitFiles } as GitStagingObject
  }

  const unstaged = xmlArray(
    raw,
    "abapgitstaging:unstaged_objects",
    "abapgitstaging:abapgitobject"
  ).map(parseObject)
  const staged = xmlArray(
    raw,
    "abapgitstaging:staged_objects",
    "abapgitstaging:abapgitobject"
  ).map(parseObject)
  const ignored = xmlArray(
    raw,
    "abapgitstaging:ignored_objects",
    "abapgitstaging:abapgitobject"
  ).map(parseObject)
  const extractUser = (p: string) =>
    stripNs(
      xmlNodeAttr(xmlNode(raw, "abapgitstaging:abapgit_comment", p))
    ) as GitUser
  const author = extractUser("abapgitstaging:author")
  const committer = extractUser("abapgitstaging:author")
  return { staged, unstaged, ignored, author, committer }
}
