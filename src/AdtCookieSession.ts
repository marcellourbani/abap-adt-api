import {
  AdtSessionFailure,
  fromException,
  isAuthenticationFailure,
  isCsrfError
} from "./AdtException"
import type { AdtExtension, AdtNext } from "./AdtExtensions"
import type { AdtHTTP, ClientOptions } from "./AdtHTTP"
import type {
  AdtCookieImport,
  AdtSessionFailureReason,
  AdtSessionProvider
} from "./AdtSession"

export interface CookieSessionAcquisitionContext {
  readonly reason: "initial-login" | "expired"
  readonly error?: unknown
  readonly signal?: AbortSignal
}

export type CookieSessionClient = Pick<AdtHTTP, "stateful">

export interface CookieSessionOptions {
  /** Stable id shared by clients that should coalesce cookie acquisition */
  readonly id: string
  /** Load the current cookie header from the host's secure storage */
  readonly loadCookies: () => Promise<string | undefined>
  /** Acquire cookies through a host-owned flow, such as browser capture */
  readonly acquireCookies: (
    context: CookieSessionAcquisitionContext
  ) => Promise<string | undefined>
  /** Persist cookie headers changed by ADT responses or successful probes */
  readonly onCookiesChanged?: (cookieHeader: string) => void | Promise<void>
  /** Handle stateful authentication loss (for example, release SAP locks) */
  readonly onStatefulSessionLost?: (context: {
    readonly client: CookieSessionClient
    readonly reason: AdtSessionFailureReason
    readonly error: unknown
  }) => void | Promise<void>
  /** Override the default retry policy for unsafe methods and reads */
  readonly canRetry?: AdtSessionProvider["canRetry"]
  /** Forward cancellation to host-owned cookie acquisition; a function is evaluated per renewal */
  readonly signal?: AbortSignal | (() => AbortSignal | undefined)
}

const acquisitions = new Map<string, Promise<AdtCookieImport | undefined>>()

const cookieImport = (
  cookieHeader: string | undefined
): AdtCookieImport | undefined =>
  cookieHeader?.trim() ? { cookieHeader, replace: true } : undefined

const waitWithSignal = <T>(promise: Promise<T>, signal?: AbortSignal) => {
  if (!signal) return promise
  signal.throwIfAborted()
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", abort)
    const abort = () => {
      cleanup()
      reject(signal.reason ?? new Error("Cookie acquisition was aborted"))
    }
    signal.addEventListener("abort", abort, { once: true })
    promise.then(
      value => {
        cleanup()
        resolve(value)
      },
      error => {
        cleanup()
        reject(error)
      }
    )
  })
}

/**
 * Build ClientOptions for a reusable external cookie-backed session.
 * Browser UI and cookie storage remain owned by the caller. Reuse an id across
 * clients for one connection to coalesce concurrent credential acquisition.
 */
export function createCookieSessionOptions(
  options: CookieSessionOptions
): Pick<ClientOptions, "session" | "extensions"> {
  const acquire = async (
    reason: CookieSessionAcquisitionContext["reason"],
    error?: unknown
  ) => {
    const signal =
      typeof options.signal === "function" ? options.signal() : options.signal
    signal?.throwIfAborted()
    let pending = acquisitions.get(options.id)
    if (!pending) {
      pending = Promise.resolve()
        .then(() =>
          options.acquireCookies({
            reason,
            ...(error === undefined ? {} : { error }),
            ...(signal ? { signal } : {})
          })
        )
        .then(cookieImport)
      acquisitions.set(options.id, pending)
      void pending
        .finally(() => {
          if (acquisitions.get(options.id) === pending)
            acquisitions.delete(options.id)
        })
        .catch(() => undefined)
    }
    return waitWithSignal(pending, signal)
  }

  const session: AdtSessionProvider = {
    id: options.id,
    logoutMode: "local-only",
    canRetry: options.canRetry,
    onCookiesChanged: options.onCookiesChanged,
    async renew({ client, reason, error }) {
      if (reason === "csrf") return undefined
      if (reason === "initial-login") {
        const saved = cookieImport(await options.loadCookies())
        return saved ?? acquire("initial-login")
      }

      // A rejected initial login has no usable CSRF token; don't probe the same rejected cookie.
      if (!client.loggedin) return acquire("expired", error)

      const saved = cookieImport(await options.loadCookies())
      const candidate = saved?.cookieHeader || client.session.cookieHeader()
      if (candidate) {
        try {
          const verified = await client.probeCookieHeader(candidate)
          if (verified)
            return { cookieHeader: verified, replace: true, verified: true }
        } catch (probeError) {
          if (!isAuthenticationFailure(probeError)) throw probeError
        }
      }
      return acquire("expired", error)
    }
  }

  const statefulSessionLoss: AdtExtension = {
    id: `${options.id}:stateful-session-loss`,
    async handle(context, next: AdtNext) {
      try {
        return await next()
      } catch (error) {
        if (!context.isStateful || !isAuthenticationFailure(error)) throw error
        const exception = fromException(error)
        const reason = isCsrfError(exception) ? "csrf" : "expired"
        await options.onStatefulSessionLost?.({
          client: context.client,
          reason,
          error
        })
        await context.client.renewSession(reason, error)
        throw new AdtSessionFailure(reason, true, exception)
      }
    }
  }

  return { session, extensions: [statefulSessionLoss] }
}
