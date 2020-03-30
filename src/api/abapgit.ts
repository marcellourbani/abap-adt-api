import { AdtHTTP } from "../AdtHTTP"
import {
  boolFromAbap,
  fullParse,
  xmlArray,
  xmlNode,
  xmlNodeAttr,
  stripNs,
  btoa,
  toXmlAttributes,
  decodeEntity,
  encodeEntity
} from "../utilities"

import { parse } from "fast-xml-parser"
import { adtException } from "../AdtException"

export interface GitLink {
  href: string
  rel: string
  type?:
    | "pull_link"
    | "stage_link"
    | "push_link"
    | "check_link"
    | "status_link"
    | "log_link"
    | string
}
export interface GitRepo {
  key: string
  sapPackage: string
  url: string
  branch_name: string
  created_by: string
  created_at: Date
  created_email?: string
  deserialized_by?: string
  deserialized_email?: string
  deserialized_at?: Date
  status?: string
  status_text?: string
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
  comment: string
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
      created_at,
      created_email,
      deserialized_by,
      deserialized_email,
      deserialized_at,
      status,
      status_text
    } = x
    const links = xmlArray(x, "atom:link").map(xmlNodeAttr)
    const repo: GitRepo = {
      key,
      sapPackage,
      url,
      branch_name,
      created_by,
      created_at: new Date(created_at),
      created_email,
      deserialized_by,
      deserialized_email,
      deserialized_at,
      status,
      status_text,
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
const deserializeStaging = (body: string) => {
  const raw = xmlNode(fullParse(body), "abapgitstaging:abapgitstaging")
  const parsefile = (x: any) =>
    ({
      ...stripNs(xmlNodeAttr(x)),
      links: xmlArray(x, "atom:link")
        .map(xmlNodeAttr)
        .map(stripNs)
        .map(l => ({ ...l, href: decodeEntity(l.href) }))
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
  const commentNode = xmlNode(raw, "abapgitstaging:abapgit_comment")
  const extractUser = (p: string) =>
    stripNs(xmlNodeAttr(xmlNode(commentNode, p))) as GitUser
  const comment = commentNode["@_abapgitstaging:comment"] || ""
  const author = extractUser("abapgitstaging:author")
  const committer = extractUser("abapgitstaging:author")
  const result: GitStaging = {
    staged,
    unstaged,
    ignored,
    comment,
    author,
    committer
  }
  return result
}

const serializeStaging = (s: GitStaging) => {
  const formatFile = (f: GitStagingFile) => {
    const { links, ...rest } = f
    return `  <abapgitstaging:abapgitfile ${toXmlAttributes(
      rest,
      "abapgitstaging"
    )}>${links
      .map(l => ({ ...l, href: encodeEntity(l.href) }))
      .map(l => `<atom:link ${toXmlAttributes(l, "")}/>`)
      .join("")}
  </abapgitstaging:abapgitfile>`
  }

  const formatObject = (obj: GitStagingObject) => {
    const { abapGitFiles, wbkey, ...rest } = obj
    return `<abapgitstaging:abapgitobject ${toXmlAttributes(
      rest,
      "adtcore"
    )} abapgitstaging:wbkey="${obj.wbkey}">
    ${obj.abapGitFiles.map(formatFile).join("")}
 </abapgitstaging:abapgitobject>`
  }
  const formatObjects = (objects: GitStagingObject[], root: string) => {
    if (!objects.length) return `<${root}/>`
    return `<${root}>${objects.map(formatObject).join("")}</${root}>`
  }

  const unstaged = formatObjects(s.unstaged, "abapgitstaging:unstaged_objects")
  const staged = formatObjects(s.staged, "abapgitstaging:staged_objects")
  const ignored = formatObjects(s.ignored, "abapgitstaging:ignored_objects")
  const comment = `<abapgitstaging:abapgit_comment abapgitstaging:comment="${s.comment}">
  <abapgitstaging:author abapgitstaging:name="${s.author.name}" abapgitstaging:email="${s.author.email}"/>
  <abapgitstaging:committer abapgitstaging:name="${s.committer.name}" abapgitstaging:email="${s.committer.email}"/>
</abapgitstaging:abapgit_comment>
`

  return `<?xml version="1.0" encoding="UTF-8"?>
  <abapgitstaging:abapgitstaging xmlns:abapgitstaging="http://www.sap.com/adt/abapgit/staging"
         xmlns:adtcore="http://www.sap.com/adt/core"
         xmlns:atom="http://www.w3.org/2005/Atom">
  ${unstaged}
  ${staged}
  ${ignored}
  ${comment}
  </abapgitstaging:abapgitstaging>`
}

export async function checkRepo(
  h: AdtHTTP,
  repo: GitRepo,
  user = "",
  password = ""
) {
  const clink = repo.links.find(l => l.type === "check_link")
  if (!clink?.href) throw adtException("Check link not found")
  const headers: any = {
    Accept: "text/plain"
  }
  if (user) headers.Username = user
  if (password) headers.Password = btoa(password)
  await h.request(clink.href, { method: "POST", headers })
}

export async function pushRepo(
  h: AdtHTTP,
  repo: GitRepo,
  staging: GitStaging,
  user = "",
  password = ""
) {
  const link = repo.links.find(l => l.type === "push_link")
  if (!link?.href) throw adtException("Push link not found")
  const headers: any = {
    Accept: "application/abapgit.adt.repo.stage.v1+xml"
  }
  headers["Content-Type"] = headers.Accept
  if (user) headers.Username = user
  if (password) headers.Password = btoa(password)
  const body = serializeStaging(staging)

  await h.request(link.href, { method: "POST", headers, body })
}

export async function stageRepo(
  h: AdtHTTP,
  repo: GitRepo,
  user = "",
  password = ""
) {
  const link = repo.links.find(l => l.type === "stage_link")
  if (!link?.href) throw adtException("Stage link not found")
  const headers: any = {
    "Content-Type": "application/abapgit.adt.repo.stage.v1+xml"
  }
  if (user) headers.Username = user
  if (password) headers.Password = btoa(password)

  const resp = await h.request(link.href, { headers })
  return deserializeStaging(resp.body)
}
