import { Cause, Duration, Effect, Layer } from "effect"
import {
  Cookies,
  HttpBody,
  HttpClient as EffectHttp,
  HttpClientError,
  HttpClientRequest,
  HttpClientResponse
} from "effect/http"
import { HttpAgent, makeNodeHttp } from "@effect/platform-node/NodeHttpClient"
import http, { STATUS_CODES } from "http"
import https from "https"
import type { ClientOptions } from "./AdtHTTP"
import {
  HttpClient,
  HttpClientCapabilities,
  HttpClientException,
  HttpClientOptions,
  HttpClientResponse as AdtHttpResponse,
  ResponseHeaders
} from "./AdtHTTP"
import { hasMessage, isArray, isUndefined } from "./utilities"

/** Redirects followed, same as the axios default */
const MAX_REDIRECTS = 21
/** Body sent with POST/PUT/PATCH when the caller sets no content type, as axios did */
const DEFAULT_CONTENT_TYPE = "application/x-www-form-urlencoded"
const BODY_METHODS = ["POST", "PUT", "PATCH"]

/** `encodeURIComponent`, then un-escapes the characters axios leaves readable */
const encodeQueryValue = (value: string) =>
  encodeURIComponent(value)
    .replace(/%3A/gi, ":")
    .replace(/%24/g, "$")
    .replace(/%2C/gi, ",")
    .replace(/%20/g, "+")

const queryValue = (value: unknown) =>
  value instanceof Date
    ? value.toISOString()
    : typeof value === "object"
      ? JSON.stringify(value)
      : `${value}`

/**
 * Serializes a query object like axios: nullish values are dropped and arrays
 * become repeated `key[]=` parameters
 */
export const formatQuery = (qs: Record<string, unknown> | undefined) =>
  Object.entries(qs || {})
    .flatMap(([key, value]) =>
      isArray(value)
        ? value
            .filter(v => v !== null && !isUndefined(v))
            .map(v => `${encodeQueryValue(`${key}[]`)}=${encodeQueryValue(queryValue(v))}`)
        : value === null || isUndefined(value)
          ? []
          : [`${encodeQueryValue(key)}=${encodeQueryValue(queryValue(value))}`]
    )
    .join("&")

const joinUrl = (baseURL: string, url: string) => {
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(url)) return url
  if (!baseURL) return url
  return `${baseURL.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`
}

export const buildUrl = (baseURL: string, url: string, qs?: Record<string, unknown>) => {
  const full = joinUrl(baseURL, url)
  const query = formatQuery(qs)
  if (!query) return full
  const hash = full.indexOf("#")
  const noHash = hash < 0 ? full : full.slice(0, hash)
  return `${noHash}${noHash.includes("?") ? "&" : "?"}${query}`
}

const headerKey = (headers: Record<string, string>, name: string) =>
  Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase())

const toBasicAuth = ({ username, password }: { username: string; password: string }) =>
  `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`

/** Translates the library's request options into an effect request */
export const toEffectRequest = (
  baseURL: string,
  options: HttpClientOptions
): HttpClientRequest.HttpClientRequest => {
  const method = `${options.method || "GET"}`.toUpperCase()
  const headers: Record<string, string> = { ...options.headers }
  if (options.auth && !headerKey(headers, "authorization"))
    headers.Authorization = toBasicAuth(options.auth)
  const contentTypeKey = headerKey(headers, "content-type")
  const contentType =
    (contentTypeKey && headers[contentTypeKey]) ||
    (BODY_METHODS.includes(method) ? DEFAULT_CONTENT_TYPE : undefined)
  if (contentTypeKey) delete headers[contentTypeKey]
  const request = HttpClientRequest.make(method as "GET")(
    buildUrl(baseURL, options.url, options.qs),
    { headers }
  )
  if (!isUndefined(options.body) && options.body !== null)
    return HttpClientRequest.setBody(request, HttpBody.text(`${options.body}`, contentType))
  if (BODY_METHODS.includes(method))
    return HttpClientRequest.setBody(request, HttpBody.text("", contentType))
  return request
}

/**
 * The platform response (node IncomingMessage or web Response) behind an effect response
 *
 * effect wraps responses (i.e. to make them interruptible), the original is one or two levels down
 */
const platformSource = (response: HttpClientResponse.HttpClientResponse): any => {
  let current: any = response
  for (let depth = 0; current && depth < 3; depth++) {
    if (current.source) return current.source
    current = current.original
  }
  return undefined
}

/** raw set-cookie values: effect's own header record folds them into one string */
const rawSetCookie = (response: HttpClientResponse.HttpClientResponse): string[] => {
  const headers = platformSource(response)?.headers
  const node = headers?.["set-cookie"]
  if (isArray<string>(node)) return node
  if (typeof node === "string") return [node]
  const web = headers?.getSetCookie?.()
  if (isArray<string>(web)) return web
  // re-serialized from the parsed cookies, values may be re-encoded
  return Cookies.toSetCookieHeaders(response.cookies)
}

/** Headers as a plain record, with `set-cookie` as an array of header values */
export const toResponseHeaders = (
  response: HttpClientResponse.HttpClientResponse
): ResponseHeaders => {
  const headers: ResponseHeaders = { ...response.headers }
  delete headers["set-cookie"]
  const setCookie = rawSetCookie(response)
  if (setCookie.length) headers["set-cookie"] = setCookie
  return headers
}

/**
 * The reason phrase the server sent, i.e. "Session timed out"
 *
 * not part of effect's response model, the standard phrase when unavailable
 */
const statusText = (response: HttpClientResponse.HttpClientResponse): string => {
  const source = platformSource(response)
  const text = source?.statusMessage ?? source?.statusText
  return typeof text === "string" ? text : STATUS_CODES[response.status] || ""
}

/** Reads the whole body and maps the response to the library's response type */
export const toAdtResponse = (
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<AdtHttpResponse, HttpClientError.HttpClientError> =>
  Effect.map(response.text, body => ({
    body,
    status: response.status,
    statusText: statusText(response),
    headers: toResponseHeaders(response)
  }))

const nodeErrorCode = (cause: unknown): string | undefined => {
  let current: any = cause
  for (let depth = 0; current && depth < 5; depth++) {
    if (typeof current.code === "string") return current.code
    current = current.cause
  }
  return undefined
}

const causeMessage = (cause: unknown, fallback: string) => {
  let current: any = cause
  for (let depth = 0; current && depth < 5; depth++) {
    if (hasMessage(current) && current.message) return current.message
    current = current.cause
  }
  return fallback
}

/**
 * Converts an effect HTTP failure to the exception the promise API has always thrown
 *
 * timeouts keep the axios code ECONNABORTED, network failures keep the node error code
 */
export const toHttpClientException = (
  error: unknown,
  options: HttpClientOptions,
  config?: ClientOptions
): HttpClientException => {
  if (error instanceof HttpClientException) return error
  if (Cause.isTimeoutError(error))
    return new HttpClientException(
      `timeout of ${options.timeout}ms exceeded`,
      "ECONNABORTED",
      undefined,
      config,
      options,
      undefined,
      error
    )
  if (HttpClientError.isHttpClientError(error)) {
    const reason = error.reason
    const cause = "cause" in reason ? reason.cause : undefined
    return new HttpClientException(
      causeMessage(cause, reason.description || error.message || reason._tag),
      nodeErrorCode(cause) || reason._tag,
      undefined,
      config,
      options,
      undefined,
      error
    )
  }
  return new HttpClientException(
    hasMessage(error) ? error.message : "Unknown error in HTTP client",
    undefined,
    undefined,
    config,
    options,
    undefined,
    error
  )
}

/**
 * Non 2xx responses fail with the response attached, as axios did by default.
 * The session logic relies on it, i.e. a 401 is a login error and not an ADT error
 */
const failOnStatus = (
  response: AdtHttpResponse,
  options: HttpClientOptions,
  config?: ClientOptions
): Effect.Effect<AdtHttpResponse, HttpClientException> =>
  response.status >= 200 && response.status < 300
    ? Effect.succeed(response)
    : Effect.fail(
        new HttpClientException(
          `Request failed with status code ${response.status}`,
          response.status < 500 ? "ERR_BAD_REQUEST" : "ERR_BAD_RESPONSE",
          response.status,
          config,
          options,
          response
        )
      )

/**
 * Executes one request with an effect HTTP client
 *
 * fails with an HttpClientException on transport errors and non 2xx responses
 */
export const executeRequest = (
  client: EffectHttp.HttpClient,
  baseURL: string,
  options: HttpClientOptions,
  config?: ClientOptions
): Effect.Effect<AdtHttpResponse, HttpClientException> => {
  const timeout = options.timeout ?? config?.timeout
  // no b3/traceparent headers and no client spans, the wire format stays as before
  const run = Effect.flatMap(
    client.execute(toEffectRequest(baseURL, options)),
    toAdtResponse
  ).pipe(
    Effect.provideService(EffectHttp.TracerPropagationEnabled, false),
    Effect.provideService(EffectHttp.TracerDisabledWhen, () => true)
  )
  const limited: Effect.Effect<AdtHttpResponse, unknown> = timeout
    ? Effect.timeout(run, Duration.millis(timeout))
    : run
  return Effect.flatMap(
    Effect.mapError(limited, e =>
      toHttpClientException(e, timeout ? { ...options, timeout } : options, config)
    ),
    response => failOnStatus(response, options, config)
  )
}

// node's global agents unless configured, as axios did
const agentLayer = (config?: ClientOptions) =>
  Layer.succeed(HttpAgent, {
    http: http.globalAgent,
    https: config?.httpsAgent || https.globalAgent
  })

/**
 * The effect HTTP client the library uses by default, node:http(s) based
 *
 * honours `ClientOptions.httpsAgent` (certificates, keep alive) and follows redirects
 */
export const nodeHttpClientLayer = (
  config?: ClientOptions
): Layer.Layer<EffectHttp.HttpClient> =>
  Layer.effect(
    EffectHttp.HttpClient,
    Effect.map(makeNodeHttp, EffectHttp.followRedirects(MAX_REDIRECTS))
  ).pipe(Layer.provide(agentLayer(config)))

/** The default node client as a plain value, for the promise API */
export const makeNodeHttpClient = (config?: ClientOptions) =>
  Effect.runSync(
    Effect.provide(
      Effect.map(makeNodeHttp, EffectHttp.followRedirects(MAX_REDIRECTS)),
      agentLayer(config)
    )
  )

/**
 * `HttpClient` implementation backed by the effect HTTP client
 *
 * this is the default transport, it replaces the former axios based one
 */
export class EffectHttpClient implements HttpClient {
  // Browsers manage cookies themselves, even though scripts cannot set Cookie.
  readonly capabilities: HttpClientCapabilities = {
    headers: true,
    cookies: true,
    statusCodes: true
  }
  readonly client: EffectHttp.HttpClient
  constructor(
    private baseURL: string,
    private config?: ClientOptions,
    client?: EffectHttp.HttpClient
  ) {
    this.client = client || makeNodeHttpClient(config)
  }
  /** rejects with an HttpClientException, like the former axios client */
  request(options: HttpClientOptions): Promise<AdtHttpResponse> {
    return Effect.runPromise(
      executeRequest(this.client, this.baseURL, options, this.config)
    )
  }
}
