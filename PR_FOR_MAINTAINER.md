Summary

This branch folds the /objectstructure parsing into the existing `objectStructure()` API as an opt-in flag (`opts.withStructureElements`) and removes the previously exported "detailed" types and helpers. Consumers that need the additional `structureElements` should call `objectStructure(..., { withStructureElements: true })` and use the runtime guard `isAbapDetailedStructure(obj)` exported from the API.

Changes

- src/api/objectstructure.ts: add `opts` and attach `structureElements` when requested; export `isAbapDetailedStructure`
- src/api/syntax.ts: remove standalone detailed types and helpers
- src/AdtClient.ts: update `objectStructure` signature
- src/index.ts: adjust public exports
- Consumer (abapfs outlineTool): updated to call `objectStructure(..., { withStructureElements: true })` and to use `isAbapDetailedStructure`

Tests & Local runs

- Ran unit tests locally: most suites passed.
- Full `npm test` reported failures in integration tests that require an ADT backend with abapGit/TMS and a seeded `ZAPIDUMMY` package. Failures are unrelated to the refactor; they stem from missing backend fixtures (empty TRANSPORTS, missing abapGit backend).

Notes for maintainer / CI

- Please run CI or the integration tests on a sandbox that has:
  - `abapGit` backend installed
  - `ZAPIDUMMY` package imported and seeded as in the repo tests
  - TMS/transports configured and accessible
- I did not update `package-lock.json` in this commit. If you prefer to pin lockfile changes in CI (via `npm ci`), I can include the updated lockfile — let me know.

Suggested verification steps

1. Run `npm ci && npm test` in a clean environment.
2. Verify ADT-dependent tests pass on your sandbox.
3. If CI requires a lockfile, either run `npm install` locally and commit the resulting `package-lock.json`, or run `npm ci` on CI with the current lockfile state.

If you'd like, I can also open a short follow-up PR that only updates the lockfile if you prefer that workflow.

Thanks — ping me if you want me to include `package-lock.json` or run any additional checks.