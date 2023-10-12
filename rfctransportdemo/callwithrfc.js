#!/usr/bin/env -S node -r "ts-node/register"
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const process_1 = require("process");
const node_rfc_1 = require("node-rfc");
const getRfcParameters = () => {
    const [_1, _2, ASHOST, SYSNR, USER, PASSWD] = process_1.argv;
    if (ASHOST && SYSNR && USER && PASSWD)
        return { ASHOST, SYSNR, USER, PASSWD };
};
const createClient = () => {
    const params = getRfcParameters();
    if (params)
        return new node_rfc_1.Client(params);
};
const testRFCCall = async (client) => {
    await client.open();
    // invoke ABAP function module, passing structure and table parameters
    // ABAP structure
    const abap_structure = {
        RFCINT4: 345,
        RFCFLOAT: 1.23456789,
        RFCCHAR4: "ABCD",
        RFCDATE: "20180625", // ABAP date format
        // or RFCDATE: new Date('2018-06-25'), // as JavaScript Date object, with clientOption "date"
    };
    // ABAP table
    let abap_table = [abap_structure];
    const result = await client.call("STFC_STRUCTURE", {
        IMPORTSTRUCT: abap_structure,
        RFCTABLE: abap_table,
    });
    // check the result
    console.log(result);
};
class RfcHttpClient {
}
const client = createClient();
if (!client) {
    console.log(`usage: callwithrfc host systemnumber user password\n\nexample:\n   callwithrfc myserver.mydomain.com 00 myuser mypassword`);
    (0, process_1.exit)(1);
}
testRFCCall(client);
