import { adtException } from "./AdtException"
import type { AdtHTTP, Method, ResponseHeaders, session_types } from "./AdtHTTP"

export interface AdtRequest {
  readonly url: string
  readonly method: Method
  readonly headers: Readonly<Record<string, string>>
  readonly query?: Readonly<Record<string, string | number | boolean>>
  readonly body?: string
  readonly timeout?: number
  readonly session: session_types
  readonly requestNumber: number
  readonly startedAt: Date
}

export interface AdtResponse {
  readonly body: string
  readonly status: number
  readonly statusText: string
  readonly headers: Readonly<ResponseHeaders>
}

export interface AdtRequestContext {
  readonly client: AdtHTTP
  readonly request: AdtRequest
  /** 1 for the first try, 2 for the replay after a session renewal */
  readonly attempt: number
  readonly isLogin: boolean
  readonly isStateful: boolean
}

export type AdtNext = (request?: AdtRequest) => Promise<AdtResponse>

export interface AdtExtension {
  readonly id: string
  handle(context: AdtRequestContext, next: AdtNext): Promise<AdtResponse>
}

export interface AdtClientExtensions {
  readonly extensions?: readonly AdtExtension[]
}

export type AdtRequestPatch = Partial<
  Pick<AdtRequest, "url" | "method" | "query" | "body" | "timeout">
> & {
  /** an undefined value removes the header */
  headers?: Record<string, string | undefined>
}

export type AdtRequestInit = Omit<AdtRequest, "headers" | "startedAt"> & {
  headers?: Record<string, string | undefined>
  startedAt?: Date
}

const _mergeHeaders = (
  base: Readonly<Record<string, string>>,
  patch: Record<string, string | undefined>
) => {
  const merged: Record<string, string> = { ...base }
  for (const [name, value] of Object.entries(patch)) {
    const lower = name.toLowerCase()
    Object.keys(merged)
      .filter(k => k.toLowerCase() === lower)
      .forEach(k => delete merged[k])
    if (value !== undefined) merged[name] = value
  }
  return merged
}

const _definedOnly = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined)
  ) as Partial<T>

const _freezeRequest = (r: AdtRequest): AdtRequest =>
  Object.freeze({
    ...r,
    headers: Object.freeze({ ...r.headers }),
    query: r.query && Object.freeze({ ...r.query })
  })

export function createAdtRequest(init: AdtRequestInit): AdtRequest {
  const { headers, startedAt, ...rest } = init
  return _freezeRequest({
    ...rest,
    headers: _mergeHeaders({}, headers || {}),
    startedAt: startedAt || new Date()
  })
}

export function withRequest(
  request: AdtRequest,
  patch: AdtRequestPatch
): AdtRequest {
  const { headers, ...rest } = patch
  return _freezeRequest({
    ...request,
    ..._definedOnly(rest),
    headers: headers ? _mergeHeaders(request.headers, headers) : request.headers
  })
}

export type AdtTerminal = (request: AdtRequest) => Promise<AdtResponse>

export const assertUniqueExtensionIds = (
  extensions: readonly AdtExtension[]
) => {
  const seen = new Set<string>()
  for (const { id } of extensions) {
    if (seen.has(id)) throw adtException(`Duplicate extension id: ${id}`)
    seen.add(id)
  }
}

export function composeExtensions(
  extensions: readonly AdtExtension[],
  terminal: AdtTerminal
): (context: AdtRequestContext) => Promise<AdtResponse> {
  assertUniqueExtensionIds(extensions)
  const dispatch = (i: number, ctx: AdtRequestContext): Promise<AdtResponse> =>
    i === extensions.length
      ? terminal(ctx.request)
      : extensions[i].handle(ctx, request =>
          dispatch(i + 1, request ? { ...ctx, request } : ctx)
        )
  return ctx => dispatch(0, ctx)
}
