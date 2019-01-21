# ADT - Abap Developer Tools client

This library simplifies access to the ADT REST interface

At the moment only have a few methods, others will come soon

```typescript
const client = new ADTClient(
  "http://vhcalnplci.bti.local:8000",
  "developer",
  "mypassword"
)

await client.login()
const nodes = await client.getNodeContents({
  parent_name: "$TMP",
  parent_type: "DEVC/K"
})
```
