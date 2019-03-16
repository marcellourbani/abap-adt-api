import { AdtHTTP } from "../AdtHTTP"
import {
  decodeEntity,
  fullParse,
  xmlArray,
  xmlFlatArray,
  xmlNodeAttr
} from "../utilities"

export interface UnitTestStackEntry {
  "adtcore:uri": string
  "adtcore:type": string
  "adtcore:name": string
  "adtcore:description": string
}
export type UnitTestAlertKind = "exception" | "failedAssertion" | "warning"
export type UnitTestSeverity = "critical" | "fatal" | "tolerable" | "tolerant"
export interface UnitTestAlert {
  kind: UnitTestAlertKind
  severity: UnitTestSeverity
  details: string[]
  stack: UnitTestStackEntry[]
}
export interface UnitTestMethod {
  "adtcore:uri": string
  "adtcore:type": string
  "adtcore:name": string
  executionTime: number
  uriType: string
  navigationUri: string
  unit: string
  alerts: UnitTestAlert[]
}

export interface UnitTestClass {
  "adtcore:uri": string
  "adtcore:type": string
  "adtcore:name": string
  uriType: string
  navigationUri: string
  durationCategory: string
  riskLevel: string
  testmethods: UnitTestMethod[]
}
export async function runUnitTest(h: AdtHTTP, url: string) {
  const headers = { "Content-Type": "application/*", Accept: "application/*" }
  const body = `<?xml version="1.0" encoding="UTF-8"?>
  <aunit:runConfiguration xmlns:aunit="http://www.sap.com/adt/aunit">
  <external>
    <coverage active="false"/>
  </external>
  <options>
    <uriType value="semantic"/>
    <testDeterminationStrategy sameProgram="true" assignedTests="false"/>
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
  const parseDetail = (alert: any) =>
    xmlArray(alert, "details", "detail").map((d: any) =>
      decodeEntity((d && d["@_text"]) || "")
    )
  const parseStack = (alert: any) =>
    xmlArray(alert, "stack", "stackEntry")
      .map(xmlNodeAttr)
      .map(x => {
        const entry = xmlNodeAttr(x)
        x["adtcore:description"] = decodeEntity(x["adtcore:description"])
      })
  const parseAlert = (alert: any) => ({
    ...xmlNodeAttr(alert),
    details: parseDetail(alert),
    stack: parseStack(alert)
  })
  const parseMethod = (method: any) => ({
    ...xmlNodeAttr(method),
    alerts: xmlArray(method, "alerts", "alert").map(parseAlert)
  })

  const classes: UnitTestClass[] = xmlFlatArray(
    raw,
    "aunit:runResult",
    "program",
    "testClasses",
    "testClass"
  ).map(c => {
    return {
      ...xmlNodeAttr(c),
      testmethods: xmlFlatArray(c, "testMethods", "testMethod").map(parseMethod)
    }
  })

  return classes
}
