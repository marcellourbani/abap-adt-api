import { AdtHTTP } from "../AdtHTTP"
import { isHttpError } from ".."
import { decode } from "html-entities"

// ── Types ─────────────────────────────────────────────────────────────

export interface RapGeneratorMetadata {
  package: string
  masterLanguage?: string
}

export interface RapGeneratorGeneral {
  referenceObjectName?: string
  description: string
}

export interface RapGeneratorDataModelEntity {
  cdsName: string
  entityName?: string
}

export interface RapGeneratorBehavior {
  implementationType: string
  implementationClass: string
  draftTable: string
}

export interface RapGeneratorBusinessObject {
  dataModelEntity: RapGeneratorDataModelEntity
  behavior: RapGeneratorBehavior
}

export interface RapGeneratorServiceProjection {
  name: string
}

export interface RapGeneratorServiceDefinition {
  name: string
}

export interface RapGeneratorServiceBinding {
  name: string
  bindingType: string
}

export interface RapGeneratorBusinessService {
  serviceDefinition: RapGeneratorServiceDefinition
  serviceBinding: RapGeneratorServiceBinding
}

export interface RapGeneratorContent {
  metadata?: RapGeneratorMetadata
  general: RapGeneratorGeneral
  businessObject: RapGeneratorBusinessObject
  serviceProjection: RapGeneratorServiceProjection
  businessService: RapGeneratorBusinessService
}

export interface RapGeneratorValidationResult {
  severity: "ok" | "error" | "warning" | "info"
  shortText: string
  longText?: string
}

export interface RapGeneratorPreviewObject {
  uri: string
  type: string
  name: string
  description: string
}

export type RapGeneratorBindingType =
  | "OData V2 - UI"
  | "OData V2 - Web API"
  | "OData V4 - UI"
  | "OData V4 - Web API"

export const BINDING_TYPES: RapGeneratorBindingType[] = [
  "OData V4 - UI",
  "OData V4 - Web API",
  "OData V2 - UI",
  "OData V2 - Web API"
]

export type RapGeneratorId = "uiservice" | "webapiservice"

// ── Constants ─────────────────────────────────────────────────────────

const BASE = "/sap/bc/adt/businessservices/generators"

const CT_CONTENT =
  "application/vnd.sap.adt.repository.generator.content.v1+json"
const CT_SCHEMA = "application/vnd.sap.adt.repository.generator.schema.v1+json"
const CT_UICONFIG =
  "application/vnd.sap.adt.repository.generator.uiconfig.v1+json"
const CT_PREVIEW = "application/vnd.sap.adt.repository.generator.preview.v1+xml"
const CT_GENERATOR = "application/vnd.sap.adt.repository.generator.v1+json"

// ── Helpers ───────────────────────────────────────────────────────────

function rapGenUrl(genId: RapGeneratorId, suffix?: string): string {
  const base = `${BASE}/${genId}`
  return suffix ? `${base}/${suffix}` : base
}

export function rapGenBuildQs(
  params: Record<string, string | undefined>
): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "")
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
  }
  return parts.length ? `?${parts.join("&")}` : ""
}

export function parseRapGenValidation(
  body: string | undefined
): RapGeneratorValidationResult {
  if (!body)
    return { severity: "error", shortText: "Empty response from server" }
  const sev =
    body
      .match(/<SEVERITY>([\s\S]*?)<\/SEVERITY>/i)?.[1]
      ?.trim()
      .toLowerCase() || "ok"
  const txt = decode(
    body.match(/<SHORT_TEXT>([\s\S]*?)<\/SHORT_TEXT>/i)?.[1]?.trim() || ""
  )
  const lng = decode(
    body.match(/<LONG_TEXT>([\s\S]*?)<\/LONG_TEXT>/i)?.[1]?.trim() || ""
  )
  return {
    severity: sev as RapGeneratorValidationResult["severity"],
    shortText: txt,
    longText: lng || undefined
  }
}

export function parseRapGenObjectRefs(
  body: string | undefined
): RapGeneratorPreviewObject[] {
  if (!body) return []
  const out: RapGeneratorPreviewObject[] = []
  // Attributes may be namespaced (adtcore:uri) or plain (uri)
  const re = /<(?:\w+:)?objectReference\s+([^>]*)\s*\/>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    const attrs = m[1]
    const attr = (n: string) => {
      const match = attrs.match(new RegExp(`(?:\\w+:)?${n}\\s*=\\s*"([^"]*)"`))
      return match?.[1] || ""
    }
    out.push({
      uri: attr("uri"),
      type: attr("type"),
      name: attr("name"),
      description: attr("description")
    })
  }
  return out
}

// ── Public API ────────────────────────────────────────────────────────

/** Initial checks: does the package exist? Is the referenced object valid? */
export async function rapGenValidateInitial(
  h: AdtHTTP,
  genId: RapGeneratorId,
  refObjectUri: string,
  packageName: string,
  checks = ["PACKAGE", "REFERENCEDOBJECT", "AUTHORIZATION"]
): Promise<RapGeneratorValidationResult> {
  const q = rapGenBuildQs({
    referencedObject: refObjectUri,
    package: packageName,
    checks: checks.join(",")
  })
  const resp = await h.request(`${rapGenUrl(genId, "validation")}${q}`)
  return parseRapGenValidation(resp.body)
}

/** JSON schema describing the generator form fields. */
export async function rapGenGetSchema(
  h: AdtHTTP,
  genId: RapGeneratorId,
  refObjectUri: string,
  packageName: string
): Promise<string> {
  const q = rapGenBuildQs({
    referencedObject: refObjectUri,
    package: packageName
  })
  const resp = await h.request(`${rapGenUrl(genId, "schema")}${q}`, {
    headers: { Accept: CT_SCHEMA }
  })
  return resp.body
}

/** Pre-filled default values (auto-generated artifact names). */
export async function rapGenGetContent(
  h: AdtHTTP,
  genId: RapGeneratorId,
  refObjectUri: string,
  packageName: string
): Promise<RapGeneratorContent> {
  const q = rapGenBuildQs({
    referencedObject: refObjectUri,
    package: packageName
  })
  const resp = await h.request(`${rapGenUrl(genId, "content")}${q}`, {
    headers: { Accept: CT_CONTENT }
  })
  return JSON.parse(resp.body)
}

/** Field-level UI config (readonly, hidden, dropdowns). */
export async function rapGenGetUiConfig(
  h: AdtHTTP,
  genId: RapGeneratorId,
  refObjectUri: string,
  packageName: string
): Promise<string> {
  const q = rapGenBuildQs({
    referencedObject: refObjectUri,
    package: packageName
  })
  const resp = await h.request(`${rapGenUrl(genId, "uiconfig")}${q}`, {
    headers: { Accept: CT_UICONFIG }
  })
  return resp.body
}

/** Full validation of user-edited content (name collisions, etc.). */
export async function rapGenValidateContent(
  h: AdtHTTP,
  genId: RapGeneratorId,
  refObjectUri: string,
  content: RapGeneratorContent
): Promise<RapGeneratorValidationResult> {
  const q = rapGenBuildQs({ referencedObject: refObjectUri })
  const resp = await h.request(`${rapGenUrl(genId, "validation")}${q}`, {
    method: "POST",
    headers: { "Content-Type": CT_CONTENT },
    body: JSON.stringify(content)
  })
  return parseRapGenValidation(resp.body)
}

/** Preview: list of objects that would be created (dry run). */
export async function rapGenPreview(
  h: AdtHTTP,
  genId: RapGeneratorId,
  refObjectUri: string,
  content: RapGeneratorContent
): Promise<RapGeneratorPreviewObject[]> {
  const q = rapGenBuildQs({ referencedObject: refObjectUri })
  const resp = await h.request(`${rapGenUrl(genId, "preview")}${q}`, {
    method: "POST",
    headers: { "Content-Type": CT_CONTENT, Accept: CT_PREVIEW },
    body: JSON.stringify(content)
  })
  return parseRapGenObjectRefs(resp.body)
}

/** Execute generation — creates all RAP artifacts on the server. */
export async function rapGenGenerate(
  h: AdtHTTP,
  genId: RapGeneratorId,
  refObjectUri: string,
  transport: string,
  content: RapGeneratorContent
): Promise<RapGeneratorPreviewObject[]> {
  // corrNr must always be present in the query, even if empty (for $TMP)
  const q = `?referencedObject=${encodeURIComponent(refObjectUri)}&corrNr=${encodeURIComponent(transport)}`
  const resp = await h.request(`${rapGenUrl(genId)}${q}`, {
    method: "POST",
    headers: { "Content-Type": CT_CONTENT, Accept: CT_GENERATOR },
    body: JSON.stringify(content)
  })
  return parseRapGenObjectRefs(resp.body)
}

/** Check whether RAP Generator endpoints are available on this system. */
export async function rapGenIsAvailable(
  h: AdtHTTP,
  genId: RapGeneratorId = "uiservice"
): Promise<boolean> {
  try {
    const q = rapGenBuildQs({
      referencedObject: "",
      package: "",
      checks: "PACKAGE"
    })
    await h.request(`${rapGenUrl(genId, "validation")}${q}`)
    return true
  } catch (e: unknown) {
    if (isHttpError(e)) {
      const status = e.status
      if (status === 404 || status === 501 || status === 0) return false
      return true
    }
    return false
  }
}

/** Publish a service binding (make it available for consumption). */
export async function rapGenPublishService(
  h: AdtHTTP,
  srvbName: string
): Promise<RapGeneratorValidationResult> {
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">` +
    `<adtcore:objectReference adtcore:type="SCGR" adtcore:name="${srvbName}"/>` +
    `</adtcore:objectReferences>`
  try {
    const resp = await h.request(
      "/sap/bc/adt/businessservices/odatav4/publishjobs",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/xml",
          Accept:
            "application/xml, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.StatusMessage"
        },
        body
      }
    )
    return parseRapGenValidation(resp.body)
  } catch (e: unknown) {
    const respBody = (isHttpError(e) && (e as any).parent?.response?.body) || ""
    const parsed = parseRapGenValidation(respBody)
    if (parsed.shortText) return parsed
    const msg = e instanceof Error ? e.message : String(e)
    return { severity: "error", shortText: msg }
  }
}
