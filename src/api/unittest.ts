import * as t from "io-ts"
import { validateParseResult } from ".."
import { AdtHTTP } from "../AdtHTTP"
import { fullParse, xmlArray, xmlFlatArray, xmlNodeAttr } from "../utilities"
import { parseUri, uriParts } from "./urlparser"

export interface UnitTestStackEntry {
  "adtcore:uri": string
  "adtcore:type": string
  "adtcore:name": string
  "adtcore:description": string
}

export enum UnitTestAlertKind {
  exception = "exception",
  failedAssertion = "failedAssertion",
  warning = "warning"
}
export enum UnitTestSeverity {
  critical = "critical",
  fatal = "fatal",
  tolerable = "tolerable",
  tolerant = "tolerant"
}
export interface UnitTestAlert {
  kind: UnitTestAlertKind
  severity: UnitTestSeverity
  details: string[]
  stack: UnitTestStackEntry[]
  title: string
}
export interface UnitTestMethod {
  "adtcore:uri": string
  "adtcore:type": string
  "adtcore:name": string
  executionTime: number
  uriType: string
  navigationUri?: string
  unit: string
  alerts: UnitTestAlert[]
}

export interface UnitTestClass {
  "adtcore:uri": string
  "adtcore:type": string
  "adtcore:name": string
  uriType: string
  navigationUri?: string
  durationCategory: string
  riskLevel: string
  testmethods: UnitTestMethod[]
  alerts: UnitTestAlert[]
}

const markerCodec = t.type({
  kind: t.string,
  keepsResult: t.boolean,
  location: uriParts
})

export type UnitTestOccurrenceMarker = t.TypeOf<typeof markerCodec>

const parseDetail = (alert: any) =>
  xmlArray(alert, "details", "detail").reduce((result: string[], d: any) => {
    const main = (d && d["@_text"]) || ""
    const children = xmlArray(d, "details", "detail")
      .map((dd: any) => (dd && `\n\t${dd["@_text"]}`) || "")
      .join("")
    return main ? [...result, main + children] : result
  }, [])
const parseStack = (alert: any) =>
  xmlArray(alert, "stack", "stackEntry").map(x => {
    const entry = xmlNodeAttr(x)
    entry["adtcore:description"] = entry["adtcore:description"]
    return entry
  })
const parseAlert = (alert: any) => ({
  ...xmlNodeAttr(alert),
  details: parseDetail(alert),
  stack: parseStack(alert),
  title: alert?.title || ""
})
const parseMethod = (method: any): UnitTestMethod => ({
  ...xmlNodeAttr(method),
  alerts: xmlArray(method, "alerts", "alert").map(parseAlert)
})

export interface UnitTestRunFlags {
  harmless: boolean
  dangerous: boolean
  critical: boolean
  short: boolean
  medium: boolean
  long: boolean
}

export const DefaultUnitTestRunFlags: UnitTestRunFlags = {
  harmless: true,
  dangerous: false,
  critical: false,
  short: true,
  medium: false,
  long: false
}

export async function runUnitTest(
  h: AdtHTTP,
  url: string,
  flags: UnitTestRunFlags = DefaultUnitTestRunFlags
) {
  const headers = { "Content-Type": "application/*", Accept: "application/*" }
  const body = `<?xml version="1.0" encoding="UTF-8"?>
  <aunit:runConfiguration xmlns:aunit="http://www.sap.com/adt/aunit">
  <external>
    <coverage active="false"/>
  </external>
  <options>
    <uriType value="semantic"/>
    <testDeterminationStrategy sameProgram="true" assignedTests="false"/>
    <testRiskLevels harmless="${flags.harmless}" dangerous="${flags.dangerous}" critical="${flags.critical}"/>
    <testDurations short="${flags.short}" medium="${flags.medium}" long="${flags.long}"/>
    <withNavigationUri enabled="true"/>    
  </options>
  <adtcore:objectSets xmlns:adtcore="http://www.sap.com/adt/core">
    <objectSet kind="inclusive">
      <adtcore:objectReferences>
        <adtcore:objectReference adtcore:uri="${url}"/>
      </adtcore:objectReferences>
    </objectSet>
  </adtcore:objectSets>
</aunit:runConfiguration>`
  const response = await h.request("/sap/bc/adt/abapunit/testruns", {
    method: "POST",
    headers,
    body
  })
  const raw = fullParse(response.body)

  const classes: UnitTestClass[] = xmlFlatArray(
    raw,
    "aunit:runResult",
    "program",
    "testClasses",
    "testClass"
  ).map(c => {
    return {
      ...xmlNodeAttr(c),
      alerts: xmlArray(c, "alerts", "alert").map(parseAlert),
      testmethods: xmlFlatArray(c, "testMethods", "testMethod").map(parseMethod)
    }
  })
  return classes
}

export async function unitTestEvaluation(
  h: AdtHTTP,
  clas: UnitTestClass,
  flags: UnitTestRunFlags = DefaultUnitTestRunFlags
) {
  const headers = { "Content-Type": "application/*l", Accept: "application/*" }
  const references = clas.testmethods
    .map(m => `<adtcore:objectReference adtcore:uri="${m["adtcore:uri"]}" />`)
    .join("\n")
  const body = `<?xml version="1.0" encoding="UTF-8"?>
  <aunit:runConfiguration xmlns:aunit="http://www.sap.com/adt/aunit">
      <options>
          <uriType value="${clas.uriType}"></uriType>
          <testDeterminationStrategy sameProgram="true" assignedTests="false"></testDeterminationStrategy>
          <testRiskLevels harmless="${flags.harmless}" dangerous="${flags.dangerous}" critical="${flags.critical}"/>
          <testDurations short="${flags.short}" medium="${flags.medium}" long="${flags.long}"/>      
          <withNavigationUri enabled="true"></withNavigationUri>
      </options>
      <adtcore:objectSets xmlns:adtcore="http://www.sap.com/adt/core">
          <objectSet kind="inclusive">
              <adtcore:objectReferences>
              ${references}
              </adtcore:objectReferences>
          </objectSet>
      </adtcore:objectSets>
  </aunit:runConfiguration>`
  const response = await h.request("/sap/bc/adt/abapunit/testruns/evaluation", {
    method: "POST",
    headers,
    body
  })

  const raw = fullParse(response.body)
  return xmlArray(
    raw,
    "aunit:runResult",
    "program",
    "testClasses",
    "testClass",
    "testMethods",
    "testMethod"
  ).map(parseMethod)
}

export async function unitTestOccurrenceMarkers(
  h: AdtHTTP,
  uri: string,
  source: string
): Promise<UnitTestOccurrenceMarker[]> {
  const headers = { "Content-Type": "text/plain", Accept: "application/*" }
  const response = await h.request("/sap/bc/adt/abapsource/occurencemarkers", {
    method: "POST",
    headers,
    body: source,
    qs: { uri }
  })
  const raw = fullParse(response.body, { removeNSPrefix: true })
  const markers = xmlArray(
    raw,
    "occurrenceInfo",
    "occurrences",
    "occurrence"
  ).map(o => {
    const { kind, keepsResult } = xmlNodeAttr(o)
    const { uri } = xmlNodeAttr((o as any)?.objectReference)
    return { kind, keepsResult, location: parseUri(uri) }
  })

  return validateParseResult(t.array(markerCodec).decode(markers))
}
