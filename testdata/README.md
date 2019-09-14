# Test data

To create a test suite:

- make sure you have TMS set up properly (not a given in netweaver developer edition)
- install [ABAPGIT](https://docs.abapgit.org/)
- create a package ZAPIDUMMY
- import ZAPIDUMMY.zip into the package with ABAPGIT
- create a transport with the following objects locked:
  - R3TR CLAS ZAPIDUMMYLOCKED
  - R3TR FUGR ZAPIDUMMYFOOBAR

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
