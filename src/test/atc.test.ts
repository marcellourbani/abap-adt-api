import { ADTClient } from ".."
import { runTest } from "./login"
import { fullParse, isArray, isString, xmlArray, xmlNode, xmlNodeAttr } from "../utilities"

const readAtcVariant = async (c: ADTClient) => {
    const cust = await c.atcCustomizing()
    const cv = cust.properties.find(x => x.name === "systemCheckVariant")
    return c.atcCheckVariant(`${cv?.value}`)
}

test("ATC customizing and variant",
    runTest(async (c: ADTClient) => {
        const cust = await c.atcCustomizing()

        expect(cust).toBeDefined()
        const cv = cust.properties.find(x => x.name === "systemCheckVariant")
        expect(cv).toBeDefined()
    })
)

test("ATC test variant",
    runTest(async (c: ADTClient) => {
        const variant = await readAtcVariant(c)
        expect(variant).toMatch(/^[0-9A-F]+$/i)
    })
)

test("ATC run",
    runTest(async (c: ADTClient) => {
        const variant = await readAtcVariant(c)
        const run = await c.createAtcRun(variant, "/sap/bc/adt/oo/classes/zapiadt_testcase_console/source/main")

        expect(run).toBeDefined()

        const nofindings = await c.atcWorklists(run.id)
        const objset = nofindings.objectSets.find(s => s.kind === "LAST_RUN")?.name || ""

        const findings = await c.atcWorklists(run.id, run.timestamp, objset)
        expect(findings).toBeDefined()
        expect(findings.objects[0]).toBeDefined()
        expect(findings.objects[0].findings[0]).toBeDefined()
    })
)
