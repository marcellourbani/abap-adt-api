#!/usr/bin/env -S node -r "ts-node/register"

import { argv, exit } from "process"
import { Client, RfcConnectionParameters, RfcObject } from "node-rfc"
import { ADTClient, HttpClient } from "abap-adt-api";
import { HttpClientOptions, HttpClientResponse } from "../build/AdtHTTP"

const CSRF_TOKEN_HEADER = "x-csrf-token"
interface RfcHeader extends RfcObject {
    NAME: string
    VALUE: string
}

interface RfcRequest extends RfcObject {
    REQUEST_LINE: {
        METHOD: string
        URI: string
        VERSION: string
    }
    HEADER_FIELDS: RfcHeader[]
    /**
     * the message body in hex format
     */
    MESSAGE_BODY: Buffer
}

interface RfcResponse extends RfcObject {
    STATUS_LINE: {
        VERSION: string
        STATUS_CODE: string
        REASON_PHRASE: string
    },
    HEADER_FIELDS: RfcHeader[]
    MESSAGE_BODY: Buffer
}

const getRfcParameters = (): RfcConnectionParameters | undefined => {
    const [_1, _2, ASHOST, SYSNR, USER, PASSWD] = argv
    if (ASHOST && SYSNR && USER && PASSWD) return { ASHOST, SYSNR, USER, PASSWD }
}

class RfcHttpClient implements HttpClient {
    constructor(private client: Client) { }
    async request(options: HttpClientOptions): Promise<HttpClientResponse> {
        const HEADER_FIELDS = Object.keys(options?.headers || {}).map(NAME => ({ NAME, VALUE: options?.headers?.[NAME] || "" }))
        const qs = options.qs || {}
        const query = Object.keys(qs).map(k => `${k}=${qs[k]}`).join("&")
        const URI = query ? `${options.url}?${query}` : options.url
        const REQUEST: RfcRequest = {
            HEADER_FIELDS,
            MESSAGE_BODY: Buffer.from(""),
            REQUEST_LINE: {
                METHOD: options.method || "GET",
                URI,
                VERSION: ""
            }
        }
        const resp = await this.client.call("SADT_REST_RFC_ENDPOINT", { REQUEST })
        const { STATUS_LINE, HEADER_FIELDS: respfields, MESSAGE_BODY } = resp.RESPONSE as RfcResponse
        const respheaders: Record<string, string> = respfields.reduce((acc, h) => { acc[h.NAME] = h.VALUE; return acc }, {} as Record<string, string>)
        respheaders[CSRF_TOKEN_HEADER] ||= "notneededoverrfc"
        return { body: `${MESSAGE_BODY}`, headers: respheaders, status: parseInt(STATUS_LINE.STATUS_CODE), statusText: STATUS_LINE.REASON_PHRASE }
    }
}

const main = async () => {
    try {
        const params = getRfcParameters()
        if (!params) {
            console.log(`usage: callwithrfc host systemnumber user password\n\nexample:\n   callwithrfc myserver.mydomain.com 00 myuser mypassword`)
            exit(1)
        }
        const client = new Client(params)
        await client.open()

        const rfcClient = new RfcHttpClient(client)
        const adtClient = new ADTClient(rfcClient, params.USER || "", "")

        // Test direct HTTP call
        const resp = await rfcClient.request({ url: "/sap/bc/adt/programs/programs/SAPMCRFC", headers: { Accept: "*/*" } })
        console.log(`Direct HTTP call:\n`, resp)

        // test client
        const struct = await adtClient.objectStructure("/sap/bc/adt/programs/programs/SAPMCRFC")
        console.log(`\nClient API call:\n`, struct)

        const ref = await adtClient.transportReference('LIMU', 'FUNC', 'SADT_REST_RFC_ENDPOINT')
        console.log(`\nClient API call with query parameters:\n`, ref)

        const nodec = await adtClient.nodeContents('FUGR/F', "SADT_REST")
        console.log(`\nClient API call with post:\n`, nodec)

    } catch (error) {
        console.log(error)
    }
}

main()