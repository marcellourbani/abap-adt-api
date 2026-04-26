import { AdtHTTP } from "../AdtHTTP"
import { adtException } from "../AdtException"

export interface TextElement {
  id: string
  text: string
  maxLength?: number
  ddicReference?: string
}

export interface TextElementsResult {
  textElements: TextElement[]
  programName: string
}

export type TextElementCategory = "symbols" | "selections" | "headings"

/**
 * Builds the text elements base URL for an object.
 *
 * @param objectType  ADT type string, e.g. "PROG/P", "CLAS/OC", "FUGR/F"
 * @param objectName  Object name.  Names containing "/" (namespace objects) are URL-encoded.
 */
export function textElementsUrl(
  objectType: string,
  objectName: string
): string {
  const lower = objectName.toLowerCase()
  const encoded = lower.includes("/") ? encodeURIComponent(lower) : lower

  const upperType = objectType.toUpperCase()
  if (upperType.startsWith("CLAS"))
    return `/sap/bc/adt/textelements/classes/${encoded}`
  if (upperType.startsWith("FUGR"))
    return `/sap/bc/adt/textelements/functiongroups/${encoded}`
  return `/sap/bc/adt/textelements/programs/${encoded}`
}

export function parseTextElements(body: string): TextElement[] {
  const elements: TextElement[] = []
  let currentMaxLength: number | undefined
  let currentDdicReference: string | undefined
  for (const raw of body.split("\n")) {
    const line = raw.trim()
    if (line.startsWith("@MaxLength:")) {
      const n = parseInt(line.slice("@MaxLength:".length), 10)
      currentMaxLength = isNaN(n) ? undefined : n
    } else if (line.startsWith("@DDICReference:")) {
      currentDdicReference = line.slice("@DDICReference:".length)
    } else if (line.includes("=")) {
      const eq = line.indexOf("=")
      const id = line.slice(0, eq).trim()
      const text = line.slice(eq + 1)
      if (id) {
        elements.push({
          id,
          text,
          maxLength: currentMaxLength,
          ddicReference: currentDdicReference
        })
        currentMaxLength = undefined
        currentDdicReference = undefined
      }
    }
  }
  return elements
}

const VALID_HEADINGS = new Set([
  "LISTHEADER",
  "COLUMNHEADER_1",
  "COLUMNHEADER_2",
  "COLUMNHEADER_3",
  "COLUMNHEADER_4"
])

function validateTextElements(
  elements: TextElement[],
  category: TextElementCategory
): void {
  for (const el of elements) {
    const id = el.id.toUpperCase()
    if (category === "symbols") {
      if (id.length !== 3)
        throw adtException(`Symbol key "${el.id}" must be exactly 3 characters`)
      if (/\s/.test(id))
        throw adtException(`Symbol key "${el.id}" must not contain blanks`)
      if (el.maxLength && el.text.length > el.maxLength)
        throw adtException(
          `Symbol "${el.id}" text exceeds maxLength ${el.maxLength}`
        )
    } else if (category === "headings") {
      if (!VALID_HEADINGS.has(id))
        throw adtException(
          `Invalid heading key "${el.id}". Allowed: ${[...VALID_HEADINGS].join(", ")}`
        )
      const limit = id === "LISTHEADER" ? 71 : 255
      if (el.text.length > limit)
        throw adtException(
          `Heading "${el.id}" text exceeds maximum length of ${limit}`
        )
    } else if (category === "selections") {
      if (el.text.length > 30)
        throw adtException(
          `Selection "${el.id}" text exceeds maximum length of 30`
        )
    }
  }
}

export function formatTextElements(
  elements: TextElement[],
  category: TextElementCategory
): string {
  validateTextElements(elements, category)
  const lines: string[] = []
  for (const el of elements) {
    if (el.maxLength && el.maxLength > 0 && category === "symbols")
      lines.push(`@MaxLength:${el.maxLength}`)
    if (category === "selections" && el.ddicReference)
      lines.push(`@DDICReference:${el.ddicReference}`)
    lines.push(`${el.id.toUpperCase()}=${el.text}`)
    if (category !== "headings") lines.push("")
  }
  return lines.join("\n")
}

/**
 * Retrieves text elements (selection texts) for an ABAP object.
 *
 * @param h   HTTP client
 * @param url Text elements base URL, e.g. from {@link textElementsUrl}
 */
export async function getTextElements(
  h: AdtHTTP,
  url: string,
  category: TextElementCategory = "symbols"
): Promise<TextElementsResult> {
  const programName = url.split("/").pop() || url
  const accept = `application/vnd.sap.adt.textelements.${category}.v1`
  try {
    const response = await h.request(`${url}/source/${category}`, {
      headers: { Accept: accept }
    })
    return {
      textElements: parseTextElements(response.body),
      programName: decodeURIComponent(programName)
    }
  } catch (e: any) {
    if (e?.response?.status === 404 || e?.status === 404)
      return {
        textElements: [],
        programName: decodeURIComponent(programName)
      }
    throw e
  }
}

/**
 * Writes text elements for an ABAP object.
 * The caller is responsible for locking (via the generic `lock()`) before
 * and unlocking (via `unLock()` then activating) after.
 *
 * @param h          HTTP client
 * @param url        Text elements base URL, e.g. from {@link textElementsUrl}
 * @param elements   Array of text elements to write
 * @param lockHandle Lock handle obtained from `lock()`
 * @param transport  Optional transport/correction number
 */
export async function setTextElements(
  h: AdtHTTP,
  url: string,
  category: TextElementCategory,
  elements: TextElement[],
  lockHandle: string,
  transport?: string
): Promise<void> {
  const qs: Record<string, string> = { lockHandle }
  if (transport) qs.corrNr = transport
  const mediaType = `application/vnd.sap.adt.textelements.${category}.v1`
  const body = formatTextElements(elements, category)
  const headers = {
    "Content-Type": `${mediaType}; charset=UTF-8`,
    Accept: mediaType
  }
  const u = `${url}/source/${category}`
  await h.request(u, { method: "PUT", headers, qs, body })
}
