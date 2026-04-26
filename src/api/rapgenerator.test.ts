import {
  parseRapGenValidation,
  parseRapGenObjectRefs,
  rapGenBuildQs
} from "./rapgenerator"

test("rapGenBuildQs: builds query string from params", () => {
  const q = rapGenBuildQs({
    referencedObject: "/sap/bc/adt/ddic/tabl/ztable",
    package: "ZPACKAGE"
  })
  expect(q).toBe(
    "?referencedObject=%2Fsap%2Fbc%2Fadt%2Fddic%2Ftabl%2Fztable&package=ZPACKAGE"
  )
})

test("rapGenBuildQs: omits undefined and empty values", () => {
  const q = rapGenBuildQs({
    referencedObject: "/sap/bc/adt/ddic/tabl/ztable",
    package: undefined,
    checks: ""
  })
  expect(q).toBe("?referencedObject=%2Fsap%2Fbc%2Fadt%2Fddic%2Ftabl%2Fztable")
})

test("rapGenBuildQs: returns empty string for all-empty params", () => {
  const q = rapGenBuildQs({ referencedObject: undefined, package: "" })
  expect(q).toBe("")
})

test("parseRapGenValidation: parses error with long text", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<validation>
  <SEVERITY>E</SEVERITY>
  <SHORT_TEXT>Package ZTEST does not exist</SHORT_TEXT>
  <LONG_TEXT>The package ZTEST was not found in the system.</LONG_TEXT>
</validation>`
  const result = parseRapGenValidation(xml)
  expect(result.severity).toBe("e")
  expect(result.shortText).toBe("Package ZTEST does not exist")
  expect(result.longText).toBe("The package ZTEST was not found in the system.")
})

test("parseRapGenValidation: parses success without long text", () => {
  const xml = `<validation><SEVERITY>S</SEVERITY><SHORT_TEXT>OK</SHORT_TEXT></validation>`
  const result = parseRapGenValidation(xml)
  expect(result.severity).toBe("s")
  expect(result.shortText).toBe("OK")
  expect(result.longText).toBeUndefined()
})

test("parseRapGenValidation: returns error for empty body", () => {
  const result = parseRapGenValidation(undefined)
  expect(result.severity).toBe("error")
  expect(result.shortText).toBe("Empty response from server")
})

test("parseRapGenValidation: defaults severity to ok when missing", () => {
  const xml = `<validation><SHORT_TEXT>No severity</SHORT_TEXT></validation>`
  const result = parseRapGenValidation(xml)
  expect(result.severity).toBe("ok")
  expect(result.shortText).toBe("No severity")
})

test("parseRapGenValidation: decodes HTML entities in text", () => {
  const xml = `<validation><SEVERITY>W</SEVERITY><SHORT_TEXT>Object &amp; Transport</SHORT_TEXT></validation>`
  const result = parseRapGenValidation(xml)
  expect(result.shortText).toBe("Object & Transport")
})

test("parseRapGenObjectRefs: parses namespaced objectReference elements", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/oo/classes/zcl_example" adtcore:type="CLAS/OC" adtcore:name="ZCL_EXAMPLE" adtcore:description="Example class"/>
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/ddic/ddlsources/zi_example" adtcore:type="DDLS/DF" adtcore:name="ZI_EXAMPLE" adtcore:description="Example CDS view"/>
</adtcore:objectReferences>`
  const refs = parseRapGenObjectRefs(xml)
  expect(refs).toHaveLength(2)
  expect(refs[0].name).toBe("ZCL_EXAMPLE")
  expect(refs[0].type).toBe("CLAS/OC")
  expect(refs[0].uri).toBe("/sap/bc/adt/oo/classes/zcl_example")
  expect(refs[0].description).toBe("Example class")
  expect(refs[1].name).toBe("ZI_EXAMPLE")
})

test("parseRapGenObjectRefs: parses plain (non-namespaced) objectReference elements", () => {
  const xml = `<objectReferences>
  <objectReference uri="/sap/bc/adt/programs/programs/ztest" type="PROG/P" name="ZTEST" description="Test program"/>
</objectReferences>`
  const refs = parseRapGenObjectRefs(xml)
  expect(refs).toHaveLength(1)
  expect(refs[0].name).toBe("ZTEST")
  expect(refs[0].type).toBe("PROG/P")
  expect(refs[0].uri).toBe("/sap/bc/adt/programs/programs/ztest")
})

test("parseRapGenObjectRefs: returns empty array for empty body", () => {
  expect(parseRapGenObjectRefs(undefined)).toEqual([])
  expect(parseRapGenObjectRefs("")).toEqual([])
})

test("parseRapGenObjectRefs: returns empty array when no objectReference elements", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><root/>`
  expect(parseRapGenObjectRefs(xml)).toEqual([])
})
