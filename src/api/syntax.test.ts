import { AdtHTTP } from "../AdtHTTP"
import { usageReferenceSnippets, usageReferences } from "./syntax"

const NS = "http://www.sap.com/adt/ris/usageReferences"

const referencesXml = (
  prefix: string
) => `<?xml version="1.0" encoding="utf-8"?>
<${prefix}:usageReferenceResult xmlns:${prefix}="${NS}" xmlns:adtcore="http://www.sap.com/adt/core">
  <${prefix}:referencedObjects>
    <${prefix}:referencedObject uri="/sap/bc/adt/programs/programs/zfoo/source/main#start=3,4" isResult="true">
      <${prefix}:adtObject adtcore:name="ZFOO" adtcore:type="PROG/P">
        <adtcore:packageRef adtcore:name="$TMP" adtcore:uri="/sap/bc/adt/packages/%24tmp"/>
      </${prefix}:adtObject>
      <objectIdentifier>ABC</objectIdentifier>
    </${prefix}:referencedObject>
  </${prefix}:referencedObjects>
</${prefix}:usageReferenceResult>`

const snippetsXml = (prefix: string) => `<?xml version="1.0" encoding="utf-8"?>
<${prefix}:usageSnippetResult xmlns:${prefix}="${NS}">
  <${prefix}:codeSnippetObjects>
    <${prefix}:codeSnippetObject>
      <objectIdentifier>ABC</objectIdentifier>
      <${prefix}:codeSnippets>
        <${prefix}:codeSnippet uri="/sap/bc/adt/programs/programs/zfoo/source/main#start=3,4" matches="4-7">
          <content>WRITE foo.</content>
          <description>desc</description>
        </${prefix}:codeSnippet>
      </${prefix}:codeSnippets>
    </${prefix}:codeSnippetObject>
  </${prefix}:codeSnippetObjects>
</${prefix}:usageSnippetResult>`

const setup = (body: string) => {
  const http = new AdtHTTP("https://example.invalid", "u", "p", "", "")
  jest.spyOn(http, "request").mockResolvedValue({
    body,
    headers: {},
    status: 200,
    statusText: "OK"
  })
  return http
}

describe.each(["usageReferences", "usagereferences", "ris"])(
  "usage references with namespace prefix %s",
  prefix => {
    test("references are parsed", async () => {
      const refs = await usageReferences(setup(referencesXml(prefix)), "/x")
      expect(refs).toHaveLength(1)
      expect(refs[0]["adtcore:name"]).toBe("ZFOO")
      expect(refs[0]["adtcore:type"]).toBe("PROG/P")
      expect(refs[0].packageRef["adtcore:name"]).toBe("$TMP")
      expect(refs[0].objectIdentifier).toBe("ABC")
    })

    test("snippets are parsed", async () => {
      const http = setup(snippetsXml(prefix))
      const snippets = await usageReferenceSnippets(http, [])
      expect(snippets).toHaveLength(1)
      expect(snippets[0].objectIdentifier).toBe("ABC")
      expect(snippets[0].snippets[0].content).toBe("WRITE foo.")
    })
  }
)
