# Change Log

All notable changes to the "vscode-abap-remote-fs" extension will be documented in this file.

Format based on [Keep a Changelog](http://keepachangelog.com/)

## 2.6.0 [2021-03-21]

### Added

- create transport configurations when missing

## 2.5.0 [2021-02-20]

### Added

- transport configurations support

### Fixed

- core discovery for hana 1909
- include components unit test for hana 1909
- skipped sscr test in hana (removed API)
- fixed content type in completion
- fixed test for abap unit in hana 1909
- fixed revisions for hana 1909

## [2.4.0] 2020-12-02

### Added

- SQL interface
- table selection
- service binding parsing
- service binding details
- service binding preview links

## [2.3.3] 2020-11-10

### Fixed

- create service binding
- save xml based objects

## [2.3.0] 2020-11-08

### Added

- create authorization field
- create authorization object
- create data element
- create service binding
- (ub)publish service binding

## [2.2.0] 2020-11-02

### Added

- create tables
- create service definitions

## [2.1.1] 2020-10-23

### Fixed

- Updated Abapgit plugin API (WIP)
- Package creation

## [2.1.0] 2020-07-14

### Added

- maximum creatable object name length

### fixed

- missing details in unit testing

## [2.0.2] 2020-06-30

### fixed

- class includes as an array even when single

## [2.0.1] 2020-05-26

### fixed

- no strip in some xml parsing

## [2.0.0] 2020-05-11

### Added

- inactive object list

### Fixed

- optional types in object metadata
- some minor typing issue

## [1.3.0] 2020-04-05

### Added

- exposed http client (for documentation navigation)

## [1.2.1] 2020-04-05

### Fixed

- deprecated duplicated API
- better module exports

## [1.2.0] 2020-04-05

### Added

- git repo remote info
- git repo switch/create branch

## [1.1.0] 2020-04-02

### Added

- create transport by transpot layer

### Fixed

- ABAP help in older systems
- better type definition exports

## [1.0.0] 2020-03-30

### Added

- AbapGit stage
- AbapGit push
- Abapgit versioned source

### Changed

- links in git repositories
- adopted semantyc versioning

## [0.5.37] 2020-03-23

### Added

- Login with bearer token

## [0.5.36] 2020-02-02

### Added

- feature check
- syntax check for CDS views
- CDS annotations definition(raw)
- DDIC components (required for CDS completions)
- DDIC elements

## [0.5.35] 2019-12-12

### Fixed

- special characters in object descriptions
- special characters in transport descriptions

## [0.5.34] 2019-12-08

### Added

- support for password protected external git repos

## [0.5.33] 2019-12-05

### Fixed

- fixed path for packages
- added relevant tests

## [0.5.32] 2019-12-03

### Added

- sample test data
- ABAPGIT repo CRUD
- Package creation and deletion
- logout from tests
- longer timeouts for some slow test
- transport layer/software component/application component/translation relevances search help

### Changed

- unit tests don't depend on abapgit anymore

## [0.5.31] 2019-08-23

### Added

- #8 support for request-debug

## [0.5.26] 2019-07-13

### Added

- Run console application (class implementing IF_OO_ADT_CLASSRUN)

### Fixed

- removed vulnerabilities

## [0.5.25] 2019-07-13

### Fixed

- removed vulnerabilities

## [0.5.24] 2019-06-06

### Fixed

- removed vulnerabilities

## [0.5.23] 2019-06-04

### Fixed

- user content field in quickfix

## [0.5.22] 2019-04-23

### Added

- expose session id (for troubleshooting)
- list abapgit repos

## [0.5.21] 2019-04-22

### Added

- transport in create test include

### Fixed

- added missing exports
- better typing for class metadata
- logout

## [0.5.20] 2019-04-18

### Fixed

- main include in object reference resolution with namespace

## [0.5.19] 2019-04-18

### Fixed

- main include in object reference resolution

## [0.5.18] 2019-04-17

### Fixed

- component encoding in syntax check

## [0.5.17] 2019-04-03

### Fixed

- revision history
- better error reporting

## [0.5.15] 2019-03-30

### Added

- revision history

## [0.5.14] 2019-03-30

### Fixed

- decode code fixes

## [0.5.13] 2019-03-30

### Added

- fix actions

## [0.5.12] 2019-03-27

### Fixed

- create namespaced FMs

## [0.5.11] 2019-03-26

### Added

- transportable object to uri
- raw response in some exceptions

## [0.5.10] 2019-03-23

### Added

- type hierarchy
- user transports
- delete transport / task
- release transport / task
- add user to transport
- system users list
- create test class include

### Fixed

- added test cases for object components
- error creating namespaced objects

## [0.5.9] 2019-03-19

### Added

- create CDS objects

## [0.5.8] 2019-03-17

### Changed

- abap unit results - replaced alternatives with enums

## [0.5.7] 2019-03-16

### Fixed

- abap unit results

## [0.5.6] 2019-03-12

### Added

- Find implementation instead of definition

## [0.5.5] 2019-03-08

### Fixed

- Completion format and HTML entity removal

## [0.5.4] 2019-03-06

### Added

- Pretty print
- Pretty Print Settings

## [0.5.3] 2019-03-05

### Fixed

- parsing of references and reference snippets in older versions
- minor bugs

## [0.5.2] 2019-02-25

### Fixed

- operation in transport selection
- force object name to string in node contents

## [0.5.1] 2019-02-24

### Fixed

- race condition in login

## [0.5.0] 2019-02-23

### Changed

- replaced Axios with request for HTTP client

### Added

- better test for stateless clone
- proper https support
- object types
- check types

## [0.4.22] 2019-02-19

### Fixed

- definition lookup

## [0.4.22] 2019-02-17

### Fixed

- exports

## [0.4.21] 2019-02-17

### Added

- usage list resolution

### Fixed

- object ID in usage list
- completion elements in older systems
- enhanced a few tests
- moved tests to improve debugging

## [0.4.20] 2019-02-16

### Changed

- added main include in object validation

### Fixed

- decode entities in syntax messages

## [0.4.19] 2019-02-13

### Added

- code fragment lookup

## [0.4.18] 2019-02-13

### Added

- syntax check
- code completion
- navigate to definition
- where used list
- code fix proposals
- unit test runs
- class/interface components

## [0.4.17] 2019-02-09

### Fixed

- types list capabilities
- search results type

## [0.4.16] 2019-02-09

### Fixed

- better search results for older systems

## [0.4.15] 2019-02-09

### Added

- discovery functions
- sample environment setter

### Fixed

- activation failed test moved to disruptive tests
- no need for inactive objects in test system
- moved test constants in environment
- several issues with older systems (7.31)

## [0.4.14] 2019-02-08

### Fixed

- search object by type
- max results in object search
- no exception on validation for info messages
- operation in transport checks

### Changed

- validation results format
- raise exception when validation fails

## [0.4.13] 2019-02-07

### Added

- transport in delete
- alternate format for create object

### Fixed

- bug in main link for CDS
- lock tables and CDS
- create interface

## [0.4.12] 2019-02-06

### Fixed

- better handling of SSL options
- transport assignment on save

## [0.4.11] 2019-02-05

### Added

- activate multiple objects at once

## [0.4.10] 2019-02-05

### Added

- easier SSL support

## [0.4.9] 2019-02-05

### Fixed

- relative paths
- optional package in transport detail

## [0.4.8] 2019-02-04

### Fixed

- node details
- date parsing
- empty links in metadata

## [0.4.7] 2019-02-03

### Changed

- date format in node metadata

### Fixed

- node details
- more types exported

## [0.4.6] 2019-02-03

### Fixed

- exports
- minor API changes

## [0.4.5] 2019-02-01

### Added

- stateless clone
- object type label
- object URL from name
- exported more object types

## [0.4.4] 2019-02-01

### Added

- label in creatable object types

## [0.4.3] 2019-01-31

### Fixed

- cookies/session handling
- self-signed certificates support

## [0.4.2] 2019-01-29

### Fixed

- exports

## [0.4.1] 2019-01-29

### Fixed

- exports

## [0.4.0] 2019-01-29

### Changed

- nodecontents API signature

## [0.3.3] 2019-01-28

### Fixed

- cookie jar support

## [0.3.3] 2019-01-27

### Fixed

- message text in activation
- added .npmignore

## [0.3.1] 2019-01-26

### Fixed

- deployment (took a few iterations)
- build on publish

## [0.2.8] 2019-01-26

### Changed

- renamed a couple of API methods

## [0.2.8] 2019-01-26

### Added

- search
- get object path
- validation
- creation
- deletion

### Fixed

- session handling
- code writing

## [0.2.7] 2019-01-25

### Added

- get main program
- validate object URLs
- validate session status
- lock/unlock (broken)
- read/write source (write untested)

### Fixed

-bug in activate

## [0.2.6] - 2019-01-23

### Added

- custom exceptions
- auto login
- repeat login if ticket expired
- activation

## [0.2.5] - 2019-01-22

### Added

- object structure/metadata
- logic to extract links from object definitions

## [0.2.4] - 2019-01-21

### Added

- tslint enabled
- transport selection and creation for an object
- reentrance ticket

## [0.2.3] - 2019-01-20

### Added

- getNodeContents

### Fixed

- exports
- README

## [0.1.0] - 2019-01-20

### Added

- Initial release to npm
