import { AxiosError } from "axios"
import { parse } from "fast-xml-parser"

const ADTEXTYPEID = Symbol()
const CSRFEXTYPEID = Symbol()
const HTTPEXTYPEID = Symbol()

class AdtErrorException extends Error {
  get typeID(): symbol {
    return ADTEXTYPEID
  }
  constructor(
    public readonly err: number,
    public readonly parent: AxiosError,
    public readonly type: string,
    public readonly message: string,
    public readonly namespace?: string,
    public readonly localizedMessage?: string
  ) {
    super()
  }
}

// tslint:disable-next-line:max-classes-per-file
class AdtCsrfException extends Error {
  get typeID(): symbol {
    return CSRFEXTYPEID
  }
  constructor(
    public readonly message: string,
    public readonly parent: AxiosError
  ) {
    super()
  }
}
// tslint:disable-next-line:max-classes-per-file
class AdtHttpException extends Error {
  get typeID(): symbol {
    return HTTPEXTYPEID
  }
  constructor(public readonly parent: AxiosError) {
    super()
  }
}

export type AdtException =
  | AdtErrorException
  | AdtCsrfException
  | AdtHttpException

export function isAdtError(e: Error): e is AdtErrorException {
  return (e as AdtErrorException).typeID === ADTEXTYPEID
}
export function isCsrfError(e: Error): e is AdtErrorException {
  return (e as AdtErrorException).typeID === CSRFEXTYPEID
}
export function isHttpError(e: Error): e is AdtHttpException {
  return (e as AdtErrorException).typeID === HTTPEXTYPEID
}
export function fromException(err: AxiosError): AdtException {
  try {
    if (!(err.response && err.response.data)) return new AdtHttpException(err)
    if (
      err.response.status === 403 &&
      err.response.headers["x-csrf-token"] === "Required"
    )
      return new AdtCsrfException(err.response.data, err)
    const raw = parse(err.response.data, {
      ignoreAttributes: false,
      parseAttributeValue: true
    })
    const root = raw["exc:exception"]
    const getf = (base: any, idx: string) => (base ? base[idx] : "")
    return new AdtErrorException(
      err.response.status,
      err,
      root.type["@_id"],
      root.message["#text"],
      getf(root.namespace, "@_id"),
      getf(root.localizedMessage, "#text")
    )
  } catch (e) {
    return new AdtHttpException(err)
  }
}
