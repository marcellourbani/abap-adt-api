# abap-adt-api — Agent Instructions

TypeScript client library for SAP's ABAP Developer Tools (ADT) REST API. Primary consumer is the [vscode_abap_remote_fs](https://github.com/marcellourbani/vscode_abap_remote_fs) extension.

## Commands

```bash
npm run build    # tsc → build/
npm run watch    # tsc -w (watch mode)
npm test         # jest (all tests; integration tests skip if ADT_URL unset)
```

No linter config — TypeScript strict mode (`strict: true`) is the code quality gate.

## Architecture

```txt
src/
  index.ts          # Re-exports everything public
  AdtClient.ts      # Thin delegating client (~120 methods)
  AdtHTTP.ts        # HTTP transport: CSRF, OAuth, sessions
  AdtException.ts   # Exception types + type guards
  utilities.ts      # XML helpers, type guards
  api/              # One module per domain (activate, debugger, atc, …)
  test/             # Integration + unit tests
```

**Adding a new API endpoint**: create `src/api/<domain>.ts` with functions taking `AdtHTTP` as first argument, add delegation methods to `AdtClient.ts`, and re-export types from `src/index.ts`.

## Key Conventions

### API function signature

All `src/api/` functions follow:

```typescript
export async function doThing(h: AdtHTTP, param: Type, ...): Promise<Result>
```

`AdtClient` methods simply delegate: `doThing(this.h, ...)`.

### XML parsing

most SAP ADT responses are XML. `fast-xml-parser` maps them to objects with these rules:

- Namespace prefix preserved: `<adtcore:uri>` → key `"adtcore:uri"` (or stripped with `stripNs()`)
- Attributes prefixed with `@_`: `<foo bar="x">` → `{ "@_bar": "x" }`
- Use `xmlArray()` for repeated elements (handles both single-object and array cases)
- Use `xmlNode()` to navigate paths safely

### Runtime validation

Use `io-ts` codecs (`t.type`, `t.union`, etc.) when validating external API responses.

### Type guards / error handling

Use `isAdtError()`, `isHttpError()`, `isLoginError()` for error discrimination. Throw `AdtErrorException` for typed errors.

### Naming

- Interfaces and types: PascalCase, no `I` prefix
- No enums — use `const` objects or union types

## Testing

Integration tests require a live SAP system. Copy `setenv_sample.js` → `setenv.js` and fill in credentials. Tests skip gracefully when `ADT_URL` is unset.

```javascript
// Minimum setenv.js
process.env.ADT_URL = "https://host:44300/"
process.env.ADT_USER = "developer"
process.env.ADT_PASS = "secret"
```

Tests use the `runTest(f)` helper from `src/test/login.ts` — it creates the client and calls `logout()` in a `finally` block.

Unit/mock tests use sample data in `testdata/src/` and don't need a SAP system.

Set `ADT_ENABLE_ALL=YES` to enable destructive tests (create/delete objects, release transports).

## Output

Compiled JS and `.d.ts` files go to `build/` (gitignored). Never edit files in `build/` directly.
