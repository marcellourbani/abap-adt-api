# Sample code for RFC transport

As this now supports pluggable HTTP clients, we can call the API over RFC as eclipse does.

This is based on [node-rfc](https://www.npmjs.com/package/node-rfc) which requires SAP NW RFC SDK to be installed.
Installation instructions can be found in its home page. I believe you'll need a SAP S-user to obtain it.

## instructions

This only supports logging in a single app server with username and password
The node-rfc documentation covers other cases

To run the sample code install the dependencies by running in this folder:

```bash
npm i
```

If this is successful (requires the SAP NW RFC SDK to be installed) run:

```bash
npx ts-node callwithrfc.ts myappserver 00 myuser mypass
```

Of course you'll need to replace the server details with your own

You will get something like:

```javascript
Direct HTTP call:
 {
  body: '<?xml version="1.0" encoding="utf-8"?><program:abapProgram program:lockedByEditor="false" program:programType="modulePool" abapsource:sourceUri="source/main" abapsource:sourceObjectStatus="system" abapsource:fixPointArithmetic="true" abapsource:activeUnicodeCheck="true" adtcore:responsible="SAP" adtcore:masterLanguage="DE" adtcore:masterSystem="SAP" adtcore:name="SAPMCRFC" adtcore:type="PROG/P" adtcore:changedAt="2015-02-13T19:23:27Z" adtcore:version="active" adtcore:createdAt="2004-10-13T00:00:00Z" adtcore:changedBy="SAP" adtcore:description="Display and Edit RFC Destinations" adtcore:descriptionTextLimit="70" adtcore:language="EN" xmlns:program="http://www.sap.com/adt/programs/programs" xmlns:abapsource="http://www.sap.com/adt/abapsource" xmlns:adtcore="http://www.sap.com/adt/core"><atom:link href="source/main/versions" rel="http://www.sap.com/adt/relations/versions" xmlns:atom="http://www.w3.org/2005/Atom"/><atom:link href="source/main" rel="http://www.sap.com/adt/relations/source" type="text/plain" etag="201502131923270011" xmlns:atom="http://www.w3.org/2005/Atom"/><atom:link href="source/main" rel="http://www.sap.com/adt/relations/source" type="text/html" etag="201502131923270011" xmlns:atom="http://www.w3.org/2005/Atom"/><atom:link href="/sap/bc/adt/vit/wb/object_type/progpx/object_name/SAPMCRFC" rel="http://www.sap.com/adt/relations/sources/textelements" type="application/vnd.sap.sapgui" title="Text Elements" xmlns:atom="http://www.w3.org/2005/Atom"/><adtcore:packageRef adtcore:uri="/sap/bc/adt/vit/wb/object_type/devck/object_name/SRCX" adtcore:type="DEVC/K" adtcore:name="SRCX"/><abapsource:syntaxConfiguration><abapsource:language><abapsource:version>X</abapsource:version><atom:link href="/sap/bc/adt/abapsource/parsers/rnd/grammar" rel="http://www.sap.com/adt/relations/abapsource/parser" type="text/plain" etag="750" xmlns:atom="http://www.w3.org/2005/Atom"/></abapsource:language></abapsource:syntaxConfiguration><program:authorizationGroup program:application="S"/></program:abapProgram>',
  headers: {
    '~server_protocol': 'HTTP/1.1',
    ETag: '201502131923270014',
    'Last-Modified': 'Fri, 13 Feb 2015 19:23:27 GMT',
    'Content-Type': 'application/vnd.sap.adt.programs.programs.v2+xml; charset=utf-8'
  },
  status: 200,
  statusText: 'OK'
}

Client API call:
 {
  objectUrl: '/sap/bc/adt/programs/programs/SAPMCRFC',
  metaData: {
    'program:lockedByEditor': false,
    'program:programType': 'modulePool',
    'abapsource:sourceUri': 'source/main',
    'abapsource:sourceObjectStatus': 'system',
    'abapsource:fixPointArithmetic': true,
    'abapsource:activeUnicodeCheck': true,
    'adtcore:responsible': 'SAP',
    'adtcore:masterLanguage': 'DE',
    'adtcore:masterSystem': 'SAP',
    'adtcore:name': 'SAPMCRFC',
    'adtcore:type': 'PROG/P',
    'adtcore:changedAt': 1423855407000,
    'adtcore:version': 'active',
    'adtcore:createdAt': 1097625600000,
    'adtcore:changedBy': 'SAP',
    'adtcore:description': 'Display and Edit RFC Destinations',
    'adtcore:descriptionTextLimit': 70,
    'adtcore:language': 'EN'
  },
  links: [
    {
      href: 'source/main/versions',
      rel: 'http://www.sap.com/adt/relations/versions'
    },
    {
      href: 'source/main',
      rel: 'http://www.sap.com/adt/relations/source',
      type: 'text/plain',
      etag: '201502131923270011'
    },
    {
      href: 'source/main',
      rel: 'http://www.sap.com/adt/relations/source',
      type: 'text/html',
      etag: '201502131923270011'
    },
    {
      href: '/sap/bc/adt/vit/wb/object_type/progpx/object_name/SAPMCRFC',
      rel: 'http://www.sap.com/adt/relations/sources/textelements',
      type: 'application/vnd.sap.sapgui',
      title: 'Text Elements'
    }
  ]
}
```
