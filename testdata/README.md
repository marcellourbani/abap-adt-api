# Test data

## To create a test suite

To test transport related functionality we will need to use a transportable package, and many tests will fail with a local one.

If you start from a fresh ABAP trial system you will need to set up TMS. On a corporate system this will be already sorted

### Set up TMS (required in ABAP trial only)

- run transaction STMS
- go in System overview (shift+F6)
- create a dummy system (Sap System/create/Virtual system) ![image](https://user-images.githubusercontent.com/2453277/69141195-2048e900-0abc-11ea-8b2b-58383bdb3eb0.png)
- go back(F3) and enter the transport routes view (shift-f7)
- go in change mode (F5)
- click transport layers and press the create button (f6) ![image](https://user-images.githubusercontent.com/2453277/69150572-da4a5000-0ad0-11ea-924e-38e7a0a546be.png)
- save
- click on transport routes and hit create (f6) ![image](https://user-images.githubusercontent.com/2453277/69150776-3d3be700-0ad1-11ea-966f-d8c1ca5df2a4.png)
- save
- hit the big save button in the main screen (Ctrl-S)
  ![image](https://user-images.githubusercontent.com/2453277/69160066-d1617a80-0ae0-11ea-87c8-16b831d36723.png)
- hit ok when asked about the description:
  ![image](https://user-images.githubusercontent.com/2453277/69159801-6617a880-0ae0-11ea-80a6-10391e4ba2f5.png)
- click yes for distributing and activating the configuration ![image](https://user-images.githubusercontent.com/2453277/69159900-85aed100-0ae0-11ea-8092-fe40a01e6026.png)

### Import this project in ABAPGit

- in abapgit click on +Online
  - enter ZAPIDUMMY in the package name and hit create package
    ![image](https://user-images.githubusercontent.com/2453277/69139023-a44ca200-0ab7-11ea-84ef-49cde2fddbde.png)
  - enter a description and a transport layer
    ![image](https://user-images.githubusercontent.com/2453277/69160200-11286200-0ae1-11ea-87b8-8622dbad7474.png)
  - press continue
  - create or select a transport and press the green button
    ![image](https://user-images.githubusercontent.com/2453277/69160709-edb1e700-0ae1-11ea-9e13-2c8ddc346dab.png)
- back in the clone dialog, enter the clone URL [https://github.com/marcellourbani/abap-adt-api.git](https://github.com/marcellourbani/abap-adt-api.git)
  ![image](https://user-images.githubusercontent.com/2453277/69160940-42edf880-0ae2-11ea-87fd-0ce6592e3bcc.png)
  - press ok
- in the main abapgit screen hit the pull button
- confirm overwriting the package
- select the transport created previously
- confirm object activation

If all goes right, the test suite will now be available

ABAPGit API tests will also require the installation of the [eclipse abapgit plugin](https://github.com/abapGit/ADT_Backend) too

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
