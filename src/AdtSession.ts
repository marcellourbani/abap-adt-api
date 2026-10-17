import { adtException } from "./AdtException"
import type { AdtHTTP } from "./AdtHTTP"
import type { AdtRequestContext } from "./AdtExtensions"

export type AdtSessionFailureReason =
  | "initial-login"
  | "expired"
  | "csrf"
  | "manual"

export interface AdtCookieImport {
  /** Cookie pairs from a browser Cookie header, e.g. `MYSAPSSO2=value` */
  readonly cookieHeader: string
  /** Replacing, rather than merging, avoids retaining a dead external identity */
  readonly replace?: boolean
}

export interface AdtSessionProvider {
  readonly id: string
  /**
   * Supplies or renews credentials outside the library; calls are coalesced per client.
   * Returning undefined means "no new credentials", which only a CSRF renewal can survive.
   */
  renew(context: {
    readonly client: AdtHTTP
    readonly reason: AdtSessionFailureReason
    readonly error?: unknown
  }): Promise<AdtCookieImport | undefined>
  /** A browser SSO logout should normally only clear local ADT state. Defaults to remote */
  readonly logoutMode?: "remote" | "local-only"
  /**
   * Unsafe methods are replayed after renewal only if this returns true,
   * reads unless it returns false. Stateful requests are never replayed.
   */
  readonly canRetry?: (context: AdtRequestContext, error: unknown) => boolean
}

export interface AdtSession {
  importCookies(input: AdtCookieImport): void
  clearCookies(): void
  cookieHeader(): string
  resetCsrfToken(): void
  /** Increases whenever the cookies change */
  readonly generation: number
}

const COOKIE_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/
// RFC 6265 cookie-octets, optionally wrapped in double quotes
const COOKIE_VALUE = /^("?)[\x21\x23-\x2b\x2d-\x3a\x3c-\x5b\x5d-\x7e]*\1$/

const _invalidCookie = (position: number) =>
  adtException(`Invalid cookie in position ${position}`)

const _parsePair = (pair: string, position: number): [string, string] => {
  const idx = pair.indexOf("=")
  const name = pair.slice(0, idx)
  const value = pair.slice(idx + 1)
  if (idx < 1 || !COOKIE_NAME.test(name) || !COOKIE_VALUE.test(value))
    throw _invalidCookie(position)
  return [name, value]
}

const _parseCookieHeader = (header: string): [string, string][] =>
  header
    .split(";")
    .map(p => p.trim())
    .filter(p => p)
    .map((pair, i) => _parsePair(pair, i + 1))

const _attribute = (attributes: string[], name: string) => {
  const prefix = `${name}=`
  const found = attributes.find(a => a.trim().toLowerCase().startsWith(prefix))
  return found?.trim().slice(prefix.length)
}

const _isExpired = (attributes: string[]) => {
  const maxAge = _attribute(attributes, "max-age")
  if (maxAge !== undefined && /^-?\d+$/.test(maxAge)) return Number(maxAge) <= 0
  const expires = Date.parse(_attribute(attributes, "expires") ?? "")
  return !isNaN(expires) && expires <= Date.now()
}

export class CookieJar implements AdtSession {
  private _cookies = new Map<string, string>()
  private _generation = 0

  constructor(private readonly _resetCsrf: () => void = () => {}) {}

  get generation() {
    return this._generation
  }

  cookieHeader() {
    return [...this._cookies.values()].join("; ")
  }

  importCookies({ cookieHeader, replace }: AdtCookieImport) {
    const pairs = _parseCookieHeader(cookieHeader) // validated before any change
    if (replace) this._cookies.clear()
    pairs.forEach(([name, value]) =>
      this._cookies.set(name, `${name}=${value}`)
    )
    this._generation++
  }

  clearCookies() {
    this._cookies.clear()
    this._generation++
  }

  resetCsrfToken() {
    this._resetCsrf()
  }

  applyResponseCookies(setCookie: string | string[] | undefined) {
    const headers = typeof setCookie === "string" ? [setCookie] : setCookie
    if (!headers?.length) return
    headers.forEach(h => this._applyResponseCookie(h))
    this._generation++
  }

  private _applyResponseCookie(setCookie: string) {
    const [pair, ...attributes] = setCookie.split(";")
    const idx = pair.indexOf("=")
    if (idx < 1) return
    const name = pair.slice(0, idx).trim()
    if (_isExpired(attributes)) this._cookies.delete(name)
    else this._cookies.set(name, `${name}=${pair.slice(idx + 1).trim()}`)
  }
}
