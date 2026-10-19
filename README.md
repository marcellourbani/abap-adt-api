[![npm](https://img.shields.io/npm/v/abap-adt-api?label=abap-adt-api)](https://www.npmjs.com/package/abap-adt-api)

# ADT - Abap Developer Tools client

This library simplifies access to the ADT REST interface.

Supports a good share of what Eclipse tools can do with a simple JS/TS interface.

Designed for general use, mostly used in [ABAP remote filesystem extension for visual studio code](https://github.com/marcellourbani/vscode_abap_remote_fs)

## Requirements

- Node.js 20.19.5+ or 22.15+. The package is CommonJS and loads Effect, which is ESM only, with `require`. Bundled code (esbuild, Rolldown, webpack) has no such limit
- TypeScript: `moduleResolution` `bundler`, `node16` or `nodenext`. With `node10` (`"node"`) the Effect types can't be resolved, and with `skipLibCheck` the types that use them silently become `any`
- ESM: import the package as usual; deep imports need the extension, i.e. `abap-adt-api/build/utilities.js`

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

## Effect

The library is built on [Effect](https://effect.website) (v4): responses are validated with Effect Schema and requests go through the Effect HTTP client. `ADTClient` keeps its promise API, `AdtEffect` exposes the same operations as effects with tagged errors (`AdtServerError`, `AdtCsrfError`, `AdtHttpError`, `AdtSessionError`, the original exception is the `cause`):

```typescript
import { Effect } from "effect"
import { AdtEffect } from "abap-adt-api"

const program = Effect.gen(function* () {
  const adt = yield* AdtEffect.AdtClientService
  return yield* adt.nodeContents("DEVC/K", "$TMP")
}).pipe(Effect.catchTag("AdtHttpError", e => Effect.die(e.cause)))

const AdtLive = AdtEffect.layerNode({
  url: "http://vhcalnplci.bti.local:8000",
  username: "developer",
  password: "mypassword"
}) // logs out when the layer is released

const nodes = await Effect.runPromise(Effect.provide(program, AdtLive))
```

- `AdtEffect.layer(config)` takes the Effect `HttpClient` from the context, i.e. `FetchHttpClient.layer` in a browser; `layerNode(config)` uses node:http(s) and honours `options.httpsAgent`
- `AdtEffect.fromClient(client)` / `AdtEffect.effectify(client)` wrap an existing `ADTClient`
- `ClientOptions.effectHttpClient` runs the promise API on any Effect `HttpClient`

## Testing

`npm test` runs Jest (with `--experimental-vm-modules`, Effect is ESM only). Unit/mock tests use sample data in `testdata/src/` and don't need a SAP system.

Integration tests require a live SAP system. Jest loads `setenv.js` (gitignored) at startup and aborts with a Validation Error when the file is missing, so copy `setenv_sample.js` → `setenv.js` and fill in credentials:

```javascript
// Minimum setenv.js
process.env.ADT_URL = "https://host:44300/"
process.env.ADT_USER = "developer"
process.env.ADT_PASS = "secret"
```

Tests skip gracefully while `ADT_URL` is unset. The shipped sample points at a placeholder host: copy it verbatim and the integration tests fail on connection errors — comment out its `ADT_URL` line to run only the mock tests. Tests use the `runTest(f)` helper from `src/test/login.ts` — it creates the client and calls `logout()` in a `finally` block. Set `ADT_ENABLE_ALL=YES` to enable destructive tests (create/delete objects, release transports).
