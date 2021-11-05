import axios, { AxiosResponse } from "axios";
import { session_types } from ".";
import { isNumber, isObject, isString, isUndefined } from "./utilities";

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
}

export interface LogCallback {
    (data: LogData): void;
}

interface LoggingConfig {
    adtRequestNumber: number
    adtStartTime: Date
}

const getLoggingData = (config: any) => {
    const id = isNumber(config?.adtRequestNumber) ? config.adtRequestNumber : -1
    const startTime = config?.adtStartTime instanceof Date ? config.adtStartTime : new Date()
    if (!isObject(config)) return { id: -1, startTime: new Date(), duration: 0 }
    return {
        id,
        startTime,
        duration: new Date().getTime() - startTime.getTime()
    }
}

const createLogData = (request: RequestData, response: ResponseData, config?: unknown, error?: Error): LogData => {
    const { id, duration, startTime } = getLoggingData(config)
    const stateful = request.headers?.["X-sap-adt-sessiontype"] === session_types.stateful
    return { id, request, response, startTime, duration, stateful }
}

const convertRequest = (original?: unknown): RequestData => {
    if (!isObject(original)) return { headers: {}, method: "", uri: "", params: {} }
    const { headers, data, method, uri, params } = original as any
    return {
        method: method || "GET",
        uri: isString(uri) ? uri : "",
        params: isObject(params) ? { ...params } : {},
        headers: isObject(headers) ? { ...headers } : {},
        body: isString(data) || isUndefined(data) ? data : JSON.stringify(data)
    }
}

const convertResponse = (original?: AxiosResponse): ResponseData => {
    if (!original) return { headers: {}, statusCode: 0, statusMessage: "" }
    const { headers, data, status, statusText } = original
    return {
        headers: headers ? { ...headers } : {},
        statusCode: status,
        statusMessage: statusText,
        body: isString(data) ? data : JSON.stringify(data),
    }
}

export const logError = (error: unknown, callback: LogCallback | undefined) => {
    try {
        if (!callback) return
        if (axios.isAxiosError(error)) {
            const request = convertRequest(error.config)
            const response = convertResponse(error.response!)
            callback(createLogData(request, response, error.config, error))
        } else
            callback(createLogData(convertRequest(undefined), convertResponse(undefined), undefined, error as Error))
    } catch (error) { }
}

export const logResponse = (original: AxiosResponse, callback: LogCallback | undefined) => {
    try {
        if (!callback) return
        const request = convertRequest(original.config)
        const response = convertResponse(original)
        callback(createLogData(request, response, original.config))
    } catch (error) { }
}