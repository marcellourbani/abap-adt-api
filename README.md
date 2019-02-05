# ADT - Abap Developer Tools client

This library simplifies access to the ADT REST interface

Supports reading package contents and manipulating ABAP objects

Dedigned for general use, mostly used in [ABAP remote filesystem extension for visual studio code](https://github.com/marcellourbani/vscode_abap_remote_fs)

## Sample usage

```typescript
const client = new ADTClient(
  "http://vhcalnplci.bti.local:8000",
  "developer",
  "mypassword"
)

const nodes = await client.getNodeContents({
  parent_name: "$TMP",
  parent_type: "DEVC/K"
})
```
