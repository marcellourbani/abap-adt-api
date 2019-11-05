# Test data

## To create a test suite

- create a transportable package ZAPIDUMMY
- clone this repository in your ABAP server

## Configuration

In order for the tests to run, you'll have to enter your connection details in setenv.js, like:

```javascript
// your SAP server
process.env.ADT_URL = "https://vhcalnplci.bti.local:44300/"
process.env.ADT_USER = "developer"
process.env.ADT_PASS = "secret"
process.env.ADT_TRANS = "NPLK900060"
process.env.ADT_SYSTEMID = "NPL"
// uncomment the following line to allow disrupting tests i.e. create and release transports, create and delete objects
// process.env.ADT_ENABLE_ALL = "YES"
```

## Running tests

```bash
npm run test
```
