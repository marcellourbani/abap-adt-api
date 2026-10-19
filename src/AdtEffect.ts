/**
 * Effect native surface of the library
 *
 * the promise based ADTClient stays the primary API, this module exposes the same
 * operations as effects with typed errors, an ADT client service and layers
 */
import { Context, Data, Effect, Layer } from "effect"
import { HttpClient as EffectHttp } from "effect/http"
import { ADTClient } from "./AdtClient"
import {
  AdtErrorException,
  AdtException,
  AdtSessionFailure,
  fromError,
  isAdtError,
  isAdtException,
  isAdtSessionFailure,
  isHttpError
} from "./AdtException"
import {
  BearerFetcher,
  ClientOptions,
  HttpClientResponse,
  RequestOptions
} from "./AdtHTTP"
import { nodeHttpClientLayer } from "./EffectHttpClient"

/** The server answered with an ADT error document, or the library rejected the call */
export class AdtServerError extends Data.TaggedError("AdtServerError")<{
  readonly message: string
  readonly cause: AdtErrorException
}> {}

/** The CSRF token or the session expired and could not be renewed */
export class AdtCsrfError extends Data.TaggedError("AdtCsrfError")<{
  readonly message: string
  readonly cause: AdtException
}> {}

/** Transport level failure, i.e. connection refused, timeout or an unparsable HTTP error */
export class AdtHttpError extends Data.TaggedError("AdtHttpError")<{
  readonly message: string
  readonly status: number
  readonly cause: AdtException
}> {}

/** The session could not be (re)established, see AdtSessionFailure */
export class AdtSessionError extends Data.TaggedError("AdtSessionError")<{
  readonly message: string
  readonly cause: AdtSessionFailure
}> {}

export type AdtError = AdtServerError | AdtCsrfError | AdtHttpError | AdtSessionError

/** Maps anything the promise API throws to a tagged error, the original exception is the cause */
export const toAdtError = (error: unknown): AdtError => {
  const e: AdtException = isAdtException(error) ? error : fromError(error)
  if (isAdtSessionFailure(e)) return new AdtSessionError({ message: e.message, cause: e })
  if (isAdtError(e)) return new AdtServerError({ message: e.message, cause: e })
  if (isHttpError(e))
    return new AdtHttpError({ message: e.message, status: e.status, cause: e })
  return new AdtCsrfError({ message: e.message, cause: e })
}

/** Lifts a promise returning call of this library to an effect */
export const fromPromise = <T>(f: () => Promise<T>): Effect.Effect<T, AdtError> =>
  Effect.tryPromise({ try: async () => f(), catch: toAdtError })

type AsyncMethodKeys<C> = {
  [K in keyof C]: C[K] extends (...args: any[]) => Promise<any> ? K : never
}[keyof C]

/**
 * The promise returning methods of a client as effect returning functions
 *
 * for overloaded methods the last overload is used
 */
export type Effectified<C> = {
  readonly [K in AsyncMethodKeys<C>]: C[K] extends (...args: infer A) => Promise<infer T>
    ? (...args: A) => Effect.Effect<T, AdtError>
    : never
}

/** Every ADTClient operation as an effect, plus the underlying client and raw requests */
export type AdtEffectClient = Effectified<ADTClient> & {
  /** the wrapped promise based client, for getters and synchronous helpers */
  readonly client: ADTClient
  /** Raw ADT request with session, CSRF and extension handling */
  readonly request: (
    url: string,
    options?: RequestOptions
  ) => Effect.Effect<HttpClientResponse, AdtError>
}

/** Wraps an existing client, the effects call it when they run */
export const effectify = (client: ADTClient): AdtEffectClient => {
  const request = (url: string, options?: RequestOptions) =>
    fromPromise(() => client.httpClient.request(url, options))
  return new Proxy({} as AdtEffectClient, {
    get(_, key) {
      if (key === "client") return client
      if (key === "request") return request
      const member = (client as any)[key]
      if (typeof member !== "function") return undefined
      return (...args: unknown[]) => fromPromise(() => member.apply(client, args))
    }
  })
}

/** Connection parameters, the same as the ADTClient constructor takes */
export interface AdtClientConfig {
  readonly url: string
  readonly username: string
  readonly password: string | BearerFetcher
  readonly client?: string
  readonly language?: string
  readonly options?: ClientOptions
}

/** The ADT client as an effect service */
export class AdtClientService extends Context.Service<
  AdtClientService,
  AdtEffectClient
>()("abap-adt-api/AdtClient") {}

/** Provides an existing client, its lifecycle stays with the caller */
export const fromClient = (client: ADTClient): Layer.Layer<AdtClientService> =>
  Layer.succeed(AdtClientService, effectify(client))

/**
 * Creates a client on top of the effect HTTP client in the context
 * (i.e. FetchHttpClient.layer) and logs it out when the layer is released
 */
export const layer = (
  config: AdtClientConfig
): Layer.Layer<AdtClientService, never, EffectHttp.HttpClient> =>
  Layer.effect(
    AdtClientService,
    Effect.gen(function* () {
      const effectHttpClient = yield* EffectHttp.HttpClient
      const client = yield* Effect.acquireRelease(
        Effect.sync(
          () =>
            new ADTClient(
              config.url,
              config.username,
              config.password,
              config.client,
              config.language,
              { ...config.options, effectHttpClient }
            )
        ),
        client =>
          client.loggedin ? Effect.ignore(fromPromise(() => client.logout())) : Effect.void
      )
      return effectify(client)
    })
  )

/** `layer` on the default node:http(s) client, honouring `options.httpsAgent` */
export const layerNode = (config: AdtClientConfig): Layer.Layer<AdtClientService> =>
  layer(config).pipe(Layer.provide(nodeHttpClientLayer(config.options)))
