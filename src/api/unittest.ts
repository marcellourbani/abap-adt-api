import { AdtHTTP } from "../AdtHTTP"
import { fullParse, xmlFlatArray, xmlNodeAttr } from "../utilities"

export interface UnitTestMethod {
  "adtcore:uri": string
  "adtcore:type": string
  "adtcore:name": string
  executionTime: number
  uriType: string
  navigationUri: string
  unit: string
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
  const data = `<?xml version="1.0" encoding="UTF-8"?>
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
    data
  })
  const raw = fullParse(response.data)

  const classes: UnitTestClass[] = xmlFlatArray(
    raw,
    "aunit:runResult",
    "program",
    "testClasses",
    "testClass"
  ).map(c => {
    return {
      ...xmlNodeAttr(c),
      testmethods: xmlFlatArray(c, "testMethods", "testMethod").map(xmlNodeAttr)
    }
  })

  return classes
}
