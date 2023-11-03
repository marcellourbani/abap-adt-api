import { ADTClient } from "../AdtClient"
import { runTest } from "./login"

test(
    "getNodeContents",
    runTest(async (c: ADTClient) => {
        const resp = await c.listTraces()
        expect(resp).toBeDefined()
        expect(resp.runs).toBeDefined()
        if (resp.runs.length) {
            expect(resp.runs[0].links[0].href).toBeTruthy()

        }
    })
)