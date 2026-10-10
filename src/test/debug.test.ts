import { randomUUID } from "crypto"
import { ADTClient } from "../AdtClient"
import { SAPRC } from "../AdtException"
import { session_types } from "../AdtHTTP"
import {
  DebugExceptionBreakpoint,
  DebugLineBreakpoint,
  DebugMessageBreakpoint,
  DebugStatementBreakpoint,
  isDebuggee,
  isDebuggerBreakpoint,
  isDebugListenerError
} from "../api/debugger"
import { UriParts } from "../api/urlparser"
import { create, runTest } from "./login"

const CLASS_URI = "/sap/bc/adt/oo/classes/zapiadt_testcase_class1/source/main"
const CLASS_NAME = "ZAPIADT_TESTCASE_CLASS1"

const lineUri = (line: number): UriParts => ({
  uri: CLASS_URI,
  query: undefined,
  hashparms: undefined,
  range: { start: { line, column: 0 }, end: { line, column: 0 } }
})

// find the 1-based line number of a statement in the (possibly shared/mutable) test class
const findLine = (source: string, statement: RegExp) => {
  const lines = source.split("\n")
  const found = lines.findIndex(l => statement.test(l))
  if (found < 0) throw new Error(`Statement ${statement} not found in source`)
  return found + 1
}

const DEBUG_TIMEOUT = 120000

const _ignoreDebuggeeEnded = (e: any) => {
  const subType = e?.properties?.["com.sap.adt.communicationFramework.subType"]
  if (subType !== "debuggeeEnded") throw e
}

const waitFor = async <T>(promise: Promise<T>, description: string) => {
  let timer: NodeJS.Timeout
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(new Error(`${description} timed out after ${DEBUG_TIMEOUT}ms`)),
      DEBUG_TIMEOUT
    )
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer!)
  }
}

test(
  "full debugger session",
  runTest(async (c: ADTClient) => {
    const trigger = create()
    const thread = create()
    if (!trigger || !thread) return
    let second: ADTClient | undefined
    const debuggingMode = "user" as const
    const terminalId = randomUUID()
    const ideId = randomUUID()
    const clientId = randomUUID()
    const user = process.env.ADT_USER!.toUpperCase()
    let terminalId2 = ""
    let ideId2 = ""
    let externalBreakpoint: DebugLineBreakpoint | undefined

    try {
      const source = await c.getObjectSource(CLASS_URI)
      const lineNo = findLine(source, /^\s*y = x\.\s*$/i)
      const conditionalLineNo = findLine(
        source,
        /^\s*translate y to upper case\.\s*$/i
      )

      // the line where `y = x.` currently is, the only breakpoint active while
      // starting the debugger, to guarantee a deterministic first hit
      const lineBreakpoint: DebugLineBreakpoint = {
        clientId,
        id: "",
        nonAbapFlavour: "",
        uri: lineUri(lineNo),
        type: "line",
        name: CLASS_NAME
      }

      const listener = c.statelessClone
      const setup = await listener.debuggerSetBreakpoints(
        debuggingMode,
        terminalId,
        ideId,
        clientId,
        [lineBreakpoint],
        user
      )
      expect(setup.length).toBe(1)
      expect(isDebuggerBreakpoint(setup[0])).toBe(true)
      if (!isDebuggerBreakpoint(setup[0])) return
      lineBreakpoint.id = setup[0].id
      externalBreakpoint = lineBreakpoint

      // start the debugger, won't return until it hits the first breakpoint
      // The listener is a long poll. It must use a separate HTTP session from
      // both the request that triggers the test and the stateful debug session.
      const firstListen = listener.debuggerListen(
        debuggingMode,
        terminalId,
        ideId,
        user
      )
      // Trigger execution only after the listener has been submitted. This
      // request remains pending while the debuggee is stopped.
      const unitRun = trigger.unitTestRun(CLASS_URI)

      let hit: Awaited<typeof firstListen>
      try {
        hit = await waitFor(firstListen, "debugger listener")
      } catch (error) {
        await c.debuggerDeleteListener(debuggingMode, terminalId, ideId, user)
        await Promise.race([
          unitRun.catch(() => undefined),
          new Promise(r => setTimeout(r, 5000))
        ])
        throw error
      }
      expect(hit).toBeDefined()
      if (isDebugListenerError(hit)) throw new Error(hit.message.text)
      expect(isDebuggee(hit)).toBe(true)
      if (!isDebuggee(hit)) return

      thread.stateful = session_types.stateful
      const attach = await thread.debuggerAttach(
        debuggingMode,
        hit.DEBUGGEE_ID,
        user
      )
      expect(attach.debugSessionId).toBeTruthy()
      expect(attach.actions).toBeDefined()

      // the line where `translate y to upper case.` currently is
      const conditionalBreakpoint: DebugLineBreakpoint = {
        clientId,
        id: "",
        nonAbapFlavour: "",
        uri: lineUri(conditionalLineNo),
        type: "line",
        name: CLASS_NAME,
        condition: "X = 'FOOBAR'"
      }
      const exceptionBreakpoint: DebugExceptionBreakpoint = {
        id: "",
        clientId,
        exceptionClass: "CX_ROOT"
      }
      const messageBreakpoint: DebugMessageBreakpoint = {
        id: "",
        clientId,
        msgId: "00",
        msgNo: "001",
        msgTy: SAPRC.Error
      }
      const statements = await thread.debuggerStatements()
      expect(statements.length).toBeGreaterThan(0)
      const statementBreakpoint: DebugStatementBreakpoint = {
        id: "",
        clientId,
        statement:
          statements.find(s => s.name === "BREAK-POINT")?.name ||
          statements[0].name
      }

      // create one of each remaining breakpoint kind now that we're attached,
      // so no early/unrelated hits can happen while we're still starting up
      const created = await thread.debuggerSetBreakpoints(
        debuggingMode,
        terminalId,
        ideId,
        clientId,
        [
          lineBreakpoint,
          conditionalBreakpoint,
          exceptionBreakpoint,
          messageBreakpoint,
          statementBreakpoint
        ],
        user,
        "debugger"
      )
      expect(created.length).toBe(5)
      for (const bp of created)
        expect(isDebuggerBreakpoint(bp) || "errorMessage" in bp).toBe(true)

      const watchpoints = await thread.debuggerCreateWatchpoint(
        "SY-SUBRC",
        "",
        true
      )
      expect(watchpoints.length).toBeGreaterThan(0)
      expect(watchpoints[0].id).toBeTruthy()

      // second listener simulates another IDE instance watching the same user,
      // uses its own session/identity so it doesn't block the attached one
      second = create()!
      terminalId2 = randomUUID()
      ideId2 = randomUUID()
      const secondListen = second.debuggerListen(
        debuggingMode,
        terminalId2,
        ideId2,
        user
      )

      const stack = await thread.debuggerStackTrace()
      expect(stack.stack.length).toBeGreaterThan(0)
      const variables = await thread.debuggerChildVariables()
      expect(variables.variables).toBeDefined()

      for (const bp of created)
        if (isDebuggerBreakpoint(bp))
          await thread.debuggerDeleteBreakpoints(
            bp,
            debuggingMode,
            terminalId,
            ideId,
            user,
            "debugger"
          )
      for (const wp of watchpoints) await thread.debuggerDeleteWatchpoint(wp.id)
      // with no breakpoints left the debuggee runs to completion, which the
      // server reports as a debuggeeEnded error rather than a step result
      await thread.debuggerStep("stepContinue").catch(_ignoreDebuggeeEnded)

      const unitResult = await waitFor(unitRun, "unit test execution")
      expect(unitResult).toBeDefined()

      // no more breakpoints will be hit, terminate the pending listener
      await c.debuggerDeleteListener(debuggingMode, terminalId2, ideId2, user)
      await waitFor(secondListen, "secondary debugger listener")
      await second.logout()
      second = undefined
    } finally {
      // A missed breakpoint must not leave the 100-hour listener or the
      // trigger request alive after Jest has reported the failure.
      await c
        .debuggerDeleteListener(debuggingMode, terminalId, ideId, user)
        .catch(() => undefined)
      if (externalBreakpoint)
        await c.statelessClone
          .debuggerDeleteBreakpoints(
            externalBreakpoint,
            debuggingMode,
            terminalId,
            ideId,
            user
          )
          .catch(() => undefined)
      if (second)
        await second
          .debuggerDeleteListener(debuggingMode, terminalId2, ideId2, user)
          .catch(() => undefined)
      await Promise.allSettled([
        thread.logout().catch(() => undefined),
        trigger.logout().catch(() => undefined),
        second?.logout().catch(() => undefined)
      ])
    }
  }),
  DEBUG_TIMEOUT + 30000
)

test(
  "logpoints",
  runTest(async (c: ADTClient) => {
    const source = await c.getObjectSource(CLASS_URI)
    const lineNo = findLine(source, /^\s*y = x\.\s*$/i)
    const definition = c.createLogPointDefinition({
      type: "UserDefined",
      subKey: "SY-SUBRC",
      fields: "SY-SUBRC"
    })
    const reference = {
      uri: `${CLASS_URI}#start=${lineNo}`,
      type: "CLAS/OC",
      name: CLASS_NAME
    }

    const location = await c.createLogpoint({
      location: {
        includePosition: reference,
        mainProgram: reference
      },
      definition,
      activation: {
        state: "A",
        users: [process.env.ADT_USER!.toUpperCase()]
      }
    })
    expect(location).toBeTruthy()
    if (!location) return

    try {
      await c.unitTestRun(CLASS_URI)
      await c.getLogServers()
      const logpoints = await c.logpoints(c.username)
      expect(logpoints).toBeTruthy()
      const keys = await c.getLogKeys(location)
      expect(keys.length).toBeGreaterThan(0)

      const logs = await c.getLogPointLogs(location, keys[0])
      expect(logs.fields.length).toBeGreaterThan(0)
      expect(logs.fields[0].values.length).toBeGreaterThan(0)
    } finally {
      await c.deleteLogpoint(location)
    }
  })
)
