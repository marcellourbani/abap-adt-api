import * as t from "io-ts"
import {
  extractXmlArray,
  fullParse,
  mixed,
  typedNodeAttr,
  xmlArrayType
} from "../utilities"
import {
  parseTraceDbAccess,
  parseTraceHitList,
  parseTraceResults
} from "./tracetypes"
import { validateParseResult } from ".."

test("parse trace results", () => {
  const sample = `<?xml version="1.0" encoding="utf-8"?> <atom:feed xmlns:atom="http://www.w3.org/2005/Atom"> <atom:author> <atom:name>SAP AG</atom:name> </atom:author> <atom:contributor> <atom:name>ACD</atom:name> </atom:contributor> <atom:title>ABAP Traces in ACD</atom:title> <atom:updated>2023-11-03T00:14:08Z</atom:updated> <atom:entry xml:lang="EN"> <atom:author> <atom:name>MURBANI</atom:name> <atom:uri> http://intranet.sap.com/~form/handler?_APP=00200682500000001086&amp;_EVENT=DISPLAY&amp;00200682500000002188=MURBANI</atom:uri> </atom:author> <atom:content type="application/vnd.sap.adt.runtime.traces.abaptraces.hitlist+xml" src="/sap/bc/adt/runtime/traces/abaptraces/bti1033_acd_00%2cAT000000.DAT/hitlist" /> <atom:id>/sap/bc/adt/runtime/traces/abaptraces/bti1033_acd_00%2cAT000000.DAT</atom:id> <atom:link href="/sap/bc/adt/runtime/traces/abaptraces/bti1033_acd_00%2cAT000000.DAT" rel="self" type="application/atom+xml;type=entry" title="Trace File Self Link" /> <atom:link href="/sap/bc/adt/runtime/traces/abaptraces/bti1033_acd_00%2cAT000000.DAT" rel="alternate" type="application/vnd.sap.sapgui.adt.runtime.traces.abaptraces.satclassic" title="SAT (SAP GUI)" /> <atom:link href="/sap/bc/adt/runtime/traces/abaptraces/bti1033_acd_00%2cAT000000.DAT" rel="related" type="application/vnd.sap.sapgui.adt.runtime.traces.abaptraces.filedisplay" title="Display Original Trace File (SAP GUI)" /> <atom:link href="/sap/bc/adt/runtime/traces/abaptraces/bti1033_acd_00%2cAT000000.DAT" rel="http://www.sap.com/adt/relations/delete" type="text/plain" title="Delete Trace File" /> <atom:link href="/sap/bc/adt/runtime/traces/abaptraces/bti1033_acd_00%2cAT000000.DAT/hitlist" rel="alternate" type="application/vnd.sap.adt.runtime.traces.abaptraces.hitlist+xml" title="Display Hitlist" /> <atom:link href="/sap/bc/adt/runtime/traces/abaptraces/bti1033_acd_00%2cAT000000.DAT/attributes?title=$value" rel="edit" type="text/plain" title="Change Trace Description" /> <atom:link href="/sap/bc/adt/runtime/traces/abaptraces/bti1033_acd_00%2cAT000000.DAT/attributes?expiration=$value" rel="edit" type="text/plain" title="Change Trace Expiry Date" /> <atom:link href="/sap/bc/adt/runtime/traces/abaptraces/bti1033_acd_00%2cAT000000.DAT/dbAccesses" rel="alternate" type="application/vnd.sap.adt.runtime.traces.abaptraces.dbaccesses+xml" title="Show DB Accesses" /> <atom:published>2023-10-27T14:25:43Z</atom:published> <atom:title>DEFAULT</atom:title> <atom:updated>2023-10-27T14:25:43Z</atom:updated> <trc:extendedData xmlns:trc="http://www.sap.com/adt/runtime/traces/abaptraces"> <trc:host>BTI1033</trc:host> <trc:size>21</trc:size> <trc:runtime>5531427</trc:runtime> <trc:runtimeABAP>5524781</trc:runtimeABAP> <trc:runtimeSystem>1643</trc:runtimeSystem> <trc:runtimeDatabase>5003</trc:runtimeDatabase> <trc:expiration>2023-11-24T14:25:43Z</trc:expiration> <trc:system>ACD</trc:system> <trc:client>100</trc:client> <trc:isAggregated>true</trc:isAggregated> <trc:aggregationKind>byCallPosition</trc:aggregationKind> <trc:objectName>YMUHIERTABPERFTEST</trc:objectName> <trc:state value="R" text="Finished" /> </trc:extendedData> </atom:entry> </atom:feed>`
  const results = parseTraceResults(sample)
  expect(results.runs.length).toBe(1)
  expect(results.runs[0].id).toBe(
    "/sap/bc/adt/runtime/traces/abaptraces/bti1033_acd_00%2cAT000000.DAT"
  )
  expect(results.runs[0].links[0].href).toBeDefined()
})

test("parse trace results", () => {
  const sample = `<?xml version="1.0" encoding="utf-8"?> <trc:hitlist xmlns:trc="http://www.sap.com/adt/runtime/traces/abaptraces"> <atom:link rel="parent" href="/sap/bc/adt/runtime/traces/abaptraces/bti1033_acd_00%2cAT000020.DAT" xmlns:atom="http://www.w3.org/2005/Atom" /> <trc:entry topDownIndex="1" index="19" hitCount="1" stackCount="1" recursionDepth="0" description="DB: Exec Static " proceduralEntryAnchor="3" dbAccessAnchor="3"> <trc:callingProgram adtcore:context="CL_HTTP_SECURITY_SESSION_ICF==CP" byteCodeOffset="624" adtcore:uri="/sap/bc/adt/oo/classes/cl_http_security_session_icf/source/main#start=502" adtcore:type="CLAS/OC" adtcore:name="CL_HTTP_SECURITY_SESSION_ICF" adtcore:packageName="SHTTP_SECURITY_SESSIONS" xmlns:adtcore="http://www.sap.com/adt/core" /> <trc:calledProgram adtcore:context="" xmlns:adtcore="http://www.sap.com/adt/core" /> <trc:grossTime time="1812" percentage="35.9881" /> <trc:traceEventNetTime time="1812" percentage="35.9881" /> <trc:proceduralNetTime time="-1" percentage="0.0" /> </trc:entry> <trc:entry topDownIndex="2" index="2" hitCount="1" stackCount="1" recursionDepth="0" description="Runtime Analysis On "> <trc:callingProgram adtcore:context="CL_HTTP_SERVER_NET============CP" byteCodeOffset="28249" objectReferenceQuery="/sap/bc/adt/runtime/traces/abaptraces/objectReferences?context=CL_HTTP_SERVER_NET%3d%3d%3d%3d%3d%3d%3d%3d%3d%3d%3d%3dCP&amp;byteCodeOffset=28249" xmlns:adtcore="http://www.sap.com/adt/core" /> <trc:calledProgram adtcore:context="" xmlns:adtcore="http://www.sap.com/adt/core" /> <trc:grossTime time="4822" percentage="95.7696" /> <trc:traceEventNetTime time="708" percentage="14.0616" /> <trc:proceduralNetTime time="708" percentage="14.0616" /> </trc:entry> </trc:hitlist>`
  const results = parseTraceHitList(sample)
  expect(results.entries.length).toBe(2)
  expect(results.entries[0].calledProgram).toBe("")
  expect(results.entries[0].callingProgram?.name).toBe(
    "CL_HTTP_SECURITY_SESSION_ICF"
  )
})

// const callingProgram = mixed(
//   {
//     "@_context": t.string,
//     "@_byteCodeOffset": t.number
//   },
//   {
//     "@_uri": t.string,
//     "@_type": t.string,
//     "@_name": t.string,
//     "@_packageName": t.string,
//     "@_objectReferenceQuery": t.string
//   }
// )
// const baseLink = t.type({
//   "@_rel": t.string,
//   "@_href": t.string
// })

// ///

// // export enum Type {
// //     Empty = "",
// //     ExecSQL = "EXEC SQL",
// //     OpenSQL = "OpenSQL",
// // }

test("parse trace db accesses", () => {
  const sample = `<?xml version="1.0" encoding="utf-8"?><trc:dbAccesses totalDbTime="0" xmlns:trc="http://www.sap.com/adt/runtime/traces/abaptraces"><atom:link rel="parent" href="/sap/bc/adt/runtime/traces/abaptraces/bti1033_acd_00%2cAT000020.DAT" xmlns:atom="http://www.w3.org/2005/Atom"/><trc:dbAccess index="1" tableName="&lt;DB Access from Kernel&gt;" statement="" type="" totalCount="6" bufferedCount="0"><trc:accessTime total="210" applicationServer="0" database="210" ratioOfTraceTotal="4.2"/></trc:dbAccess><trc:dbAccess index="2" tableName="SECURITY_CONTEXT" statement="insert" type="OpenSQL" totalCount="1" bufferedCount="0"><trc:accessTime total="432" applicationServer="0" database="432" ratioOfTraceTotal="8.6"/><trc:callingProgram adtcore:context="CL_HTTP_SECURITY_SESSION_ICF==CP" byteCodeOffset="538" adtcore:uri="/sap/bc/adt/oo/classes/cl_http_security_session_icf/source/main#start=456" adtcore:type="CLAS/OC" adtcore:name="CL_HTTP_SECURITY_SESSION_ICF" adtcore:packageName="SHTTP_SECURITY_SESSIONS" xmlns:adtcore="http://www.sap.com/adt/core"/></trc:dbAccess><trc:dbAccess index="3" tableName="&lt;unspecified&gt;" statement="commit" type="EXEC SQL" totalCount="1" bufferedCount="0"><trc:accessTime total="2014" applicationServer="0" database="2014" ratioOfTraceTotal="40.0"/><trc:callingProgram adtcore:context="CL_HTTP_SECURITY_SESSION_ICF==CP" byteCodeOffset="624" adtcore:uri="/sap/bc/adt/oo/classes/cl_http_security_session_icf/source/main#start=502" adtcore:type="CLAS/OC" adtcore:name="CL_HTTP_SECURITY_SESSION_ICF" adtcore:packageName="SHTTP_SECURITY_SESSIONS" xmlns:adtcore="http://www.sap.com/adt/core"/></trc:dbAccess><trc:dbAccess index="4" tableName="SEPP__REGISTRY" statement="select single" type="OpenSQL" totalCount="1" bufferedCount="1"><trc:accessTime total="24" applicationServer="0" database="24" ratioOfTraceTotal="0.5"/><trc:callingProgram adtcore:context="CL_EPP_REGISTRY===============CP" byteCodeOffset="51" adtcore:uri="/sap/bc/adt/oo/classes/cl_epp_registry/source/main#start=154" adtcore:type="CLAS/OC" adtcore:name="CL_EPP_REGISTRY" adtcore:packageName="SEPP" xmlns:adtcore="http://www.sap.com/adt/core"/></trc:dbAccess><trc:dbAccess index="5" tableName="SOTR_HEAD" statement="select single" type="OpenSQL" totalCount="1" bufferedCount="1"><trc:accessTime total="19" applicationServer="0" database="19" ratioOfTraceTotal="0.4"/><trc:callingProgram adtcore:context="SAPLSOTR_DB_READ" byteCodeOffset="813" adtcore:uri="/sap/bc/adt/functions/groups/sotr_db_read/fmodules/sotr_get_text_key/source/main#start=52" adtcore:type="FUGR/I" adtcore:name="LSOTR_DB_READU11" xmlns:adtcore="http://www.sap.com/adt/core"/></trc:dbAccess><trc:dbAccess index="6" tableName="SOTR_TEXT" statement="select" type="OpenSQL" totalCount="1" bufferedCount="1"><trc:accessTime total="21" applicationServer="0" database="21" ratioOfTraceTotal="0.4"/><trc:callingProgram adtcore:context="SAPLSOTR_DB_READ" byteCodeOffset="977" adtcore:uri="/sap/bc/adt/functions/groups/sotr_db_read/fmodules/sotr_get_text_key/source/main#start=146" adtcore:type="FUGR/I" adtcore:name="LSOTR_DB_READU11" xmlns:adtcore="http://www.sap.com/adt/core"/></trc:dbAccess><trc:dbAccess index="7" tableName="ICFATTRIB" statement="select" type="OpenSQL" totalCount="1" bufferedCount="1"><trc:accessTime total="21" applicationServer="0" database="21" ratioOfTraceTotal="0.4"/><trc:callingProgram adtcore:context="SAPLHTTP_RUNTIME" byteCodeOffset="6332" adtcore:uri="/sap/bc/adt/functions/groups/http_runtime/fmodules/http_read_debug/source/main#start=78" adtcore:type="FUGR/I" adtcore:name="LHTTP_RUNTIMEU21" xmlns:adtcore="http://www.sap.com/adt/core"/></trc:dbAccess><trc:dbAccess index="8" tableName="ICFATTRIB" statement="select single" type="OpenSQL" totalCount="1" bufferedCount="1"><trc:accessTime total="8" applicationServer="0" database="8" ratioOfTraceTotal="0.2"/><trc:callingProgram adtcore:context="SAPLHTTP_RUNTIME" byteCodeOffset="6345" adtcore:uri="/sap/bc/adt/functions/groups/http_runtime/fmodules/http_read_debug/source/main#start=99" adtcore:type="FUGR/I" adtcore:name="LHTTP_RUNTIMEU21" xmlns:adtcore="http://www.sap.com/adt/core"/></trc:dbAccess><trc:dbAccess index="9" tableName="/BTI/WP_WS_HANDL" statement="select single" type="OpenSQL" totalCount="1" bufferedCount="1"><trc:accessTime total="21" applicationServer="0" database="21" ratioOfTraceTotal="0.4"/><trc:callingProgram adtcore:context="/BTI/WP_WS_HANDLER============CP" byteCodeOffset="113" adtcore:uri="/sap/bc/adt/oo/classes/%2fbti%2fwp_ws_handler/source/main#start=21" adtcore:type="CLAS/OC" adtcore:name="/BTI/WP_WS_HANDLER" adtcore:packageName="/BTI/WP" xmlns:adtcore="http://www.sap.com/adt/core"/></trc:dbAccess><trc:dbAccess index="10" tableName="SECURITY_CONTEXT" statement="select" type="OpenSQL" totalCount="1" bufferedCount="0"><trc:accessTime total="440" applicationServer="0" database="440" ratioOfTraceTotal="8.7"/><trc:callingProgram adtcore:context="CL_HTTP_SECURITY_SESSION_ADMINCP" byteCodeOffset="26" adtcore:uri="/sap/bc/adt/oo/classes/cl_http_security_session_admin/source/main#start=363" adtcore:type="CLAS/OC" adtcore:name="CL_HTTP_SECURITY_SESSION_ADMIN" adtcore:packageName="SHTTP_SECURITY_SESSIONS" xmlns:adtcore="http://www.sap.com/adt/core"/></trc:dbAccess><trc:dbAccess index="11" tableName="&lt;DB Time of System Events&gt;" statement="" type="" totalCount="0" bufferedCount="0"><trc:accessTime total="0" applicationServer="0" database="0" ratioOfTraceTotal="0.0"/></trc:dbAccess><trc:tables><trc:table name="SECURITY_CONTEXT" type="TRANSP" description="HTTP Security Context (Cross-Server Attributes)" bufferMode="Single Entries buffered" storageType="" adtcore:package="SHTTP_SECURITY_SESSIONS" xmlns:adtcore="http://www.sap.com/adt/core"/><trc:table name="SEPP__REGISTRY" type="TRANSP" description="Registry for Application Data in EPP" bufferMode="Entirely buffered" storageType="" adtcore:package="SEPP" xmlns:adtcore="http://www.sap.com/adt/core"/><trc:table name="SOTR_HEAD" type="TRANSP" description="Header Table for OTR Texts" bufferMode="Single Entries buffered" storageType="" adtcore:package="SOTR" xmlns:adtcore="http://www.sap.com/adt/core"/><trc:table name="SOTR_TEXT" type="TRANSP" description="Text Table in the OTR" bufferMode="Generically buffered" storageType="" adtcore:package="SOTR" xmlns:adtcore="http://www.sap.com/adt/core"/><trc:table name="ICFATTRIB" type="TRANSP" description="Description of ICF Attributes (Trace/Debugging)" bufferMode="Entirely buffered" storageType="" adtcore:package="SHTTP" xmlns:adtcore="http://www.sap.com/adt/core"/><trc:table name="/BTI/WP_WS_HANDL" type="TRANSP" description="Web Platform: HTTP Handlers" bufferMode="Entirely buffered" storageType="" adtcore:package="/BTI/WP" xmlns:adtcore="http://www.sap.com/adt/core"/></trc:tables></trc:dbAccesses>`
  const results = parseTraceDbAccess(sample)
  expect(results.parentLink).toBeDefined()
  expect(results.tables.length).toBeTruthy()
  expect(results.dbaccesses.length).toBeTruthy()
})
