import axios, { AxiosResponse } from "axios"
import {
  AdtErrorException,
  AdtException,
  adtException,
  HttpResponse,
  isAdtError,
  isAdtException,
  session_types
} from "."
import { isNumber, isObject, isString, isUndefined } from "./utilities"
import { HttpClientOptions, HttpClientResponse } from "./AdtHTTP"

export interface RequestData {
  method: string
  uri: string
  params: Record<string, string>
  headers: Record<string, string>
  body?: string
}

export interface ResponseData {
  headers: Record<string, string>
  statusCode: number
  statusMessage: string
  body?: string
}

export type LogData = {
  id: number
  request: RequestData
  response: ResponseData
  stateful: boolean
  startTime: Date
  duration: number
  error?: Error
  clientId: number
}

export interface LogCallback {
  (data: LogData): void
}

interface LoggingConfig {
  adtRequestNumber: number
  adtStartTime: Date
}

const getLoggingData = (config: any) => {
  if (!isObject(config)) return { id: -1, startTime: new Date(), duration: 0 }
  const id = isNumber(config?.adtRequestNumber) ? config.adtRequestNumber : -1
  const startTime =
    config?.adtStartTime instanceof Date ? config.adtStartTime : new Date()
  return {
    id,
    startTime,
    duration: new Date().getTime() - startTime.getTime()
  }
}

const createLogData = (
  request: RequestData,
  response: ResponseData,
  clientId: number,
  config?: unknown,
  error?: Error
): LogData => {
  const { id, duration, startTime } = getLoggingData(config)
  const stateful =
    request.headers?.["X-sap-adt-sessiontype"] === session_types.stateful
  return { id, request, response, startTime, duration, stateful, clientId }
}

const convertRequest = (original?: unknown): RequestData => {
  if (!isObject(original))
    return { headers: {}, method: "", uri: "", params: {} }
  const { headers, data, method, uri, params } = original as any
  return {
    method: method || "GET",
    uri: isString(uri) ? uri : "",
    params: isObject(params) ? { ...params } : {},
    headers: isObject(headers) ? { ...headers } : {},
    body: isString(data) || isUndefined(data) ? data : JSON.stringify(data)
  }
}
const convertAxiosResponse = (original?: AxiosResponse): ResponseData => {
  if (!original) return { headers: {}, statusCode: 0, statusMessage: "" }
  const { headers, data, status, statusText } = original
  return {
    headers: headers ? { ...headers } : {},
    statusCode: status,
    statusMessage: statusText,
    body: isString(data) ? data : JSON.stringify(data)
  }
}

const convertResponse = (
  original?: HttpClientResponse | AdtException
): ResponseData => {
  if (!original) return { headers: {}, statusCode: 0, statusMessage: "" }
  if (isAdtException(original)) {
    const resp: ResponseData = {
      headers: {},
      statusCode: isAdtError(original) ? original.err : 501,
      statusMessage: original.message
    }
    return resp
  } else {
    const { headers, body, status, statusText } = original
    return {
      headers: headers ? { ...headers } : {},
      statusCode: status,
      statusMessage: statusText,
      body: isString(body) ? body : JSON.stringify(body)
    }
  }
}

export const logError = (
  clientId: number,
  error: unknown,
  callback: LogCallback | undefined,
  config: HttpClientOptions
) => {
  try {
    if (!callback) return
    if (axios.isAxiosError(error)) {
      const request = convertRequest(error.config)
      const response = convertAxiosResponse(error.response!)
      callback(createLogData(request, response, clientId, error.config, error))
    } else {
      const resp = isAdtException(error)
        ? convertResponse(error)
        : convertResponse(undefined)
      callback(
        createLogData(
          convertRequest(config),
          resp,
          clientId,
          config,
          error as Error
        )
      )
    }
  } catch (error) {}
}

export const logResponse = (
  clientId: number,
  original: HttpClientResponse,
  config: HttpClientOptions,
  callback: LogCallback | undefined
) => {
  try {
    if (!callback) return
    const request = convertRequest(config)
    const response = convertResponse(original)
    callback(createLogData(request, response, clientId, config))
  } catch (error) {}
}
