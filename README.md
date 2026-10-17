[![npm](https://img.shields.io/npm/v/abap-adt-api?label=abap-adt-api)](https://www.npmjs.com/package/abap-adt-api)

# ADT - Abap Developer Tools client

This library simplifies access to the ADT REST interface.

Supports a good share of what Eclipse tools can do with a simple JS/TS interface.

Designed for general use, mostly used in [ABAP remote filesystem extension for visual studio code](https://github.com/marcellourbani/vscode_abap_remote_fs)

## Sample usage

```typescript
// create a client object
import { ADTClient } from "abap-adt-api"
const client = new ADTClient(
  "http://vhcalnplci.bti.local:8000",
  "developer",
  "mypassword"
)

const nodes = await client.nodeContents("DEVC/K", "$TMP")
```

## Testing

`npm test` runs Jest. Unit/mock tests use sample data in `testdata/src/` and don't need a SAP system.

Integration tests require a live SAP system. Jest loads `setenv.js` (gitignored) at startup and aborts with a Validation Error when the file is missing, so copy `setenv_sample.js` → `setenv.js` and fill in credentials:

```javascript
// Minimum setenv.js
process.env.ADT_URL = "https://host:44300/"
process.env.ADT_USER = "developer"
process.env.ADT_PASS = "secret"
```

Tests skip gracefully while `ADT_URL` is unset. The shipped sample points at a placeholder host: copy it verbatim and the integration tests fail on connection errors — comment out its `ADT_URL` line to run only the mock tests. Tests use the `runTest(f)` helper from `src/test/login.ts` — it creates the client and calls `logout()` in a `finally` block. Set `ADT_ENABLE_ALL=YES` to enable destructive tests (create/delete objects, release transports).
