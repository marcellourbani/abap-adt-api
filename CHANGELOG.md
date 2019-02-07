# Change Log

All notable changes to the "vscode-abap-remote-fs" extension will be documented in this file.

Format based on [Keep a Changelog](http://keepachangelog.com/)

## Unreleased

### Fixed

- search object by type
- max results in object search
- no exception on validation for info messages

### Changed

- validation results format
- raise exception when validation fails

## 0.4.13 2019-02-07

### Added

- transport in delete
- alternate format for create object

### Fixed

- bug in main link for CDS
- lock tables and CDS
- create interface

## 0.4.12 2019-02-06

### Fixed

- better handling of SSL options
- transport assignment on save

## 0.4.11 2019-02-05

### Added

- activate multiple objects at once

## 0.4.10 2019-02-05

### Added

- easier SSL support

## 0.4.9 2019-02-05

### Fixed

- relative paths
- optional package in transport detail

## 0.4.8 2019-02-04

### Fixed

- node details
- date parsing
- empty links in metadata

## 0.4.7 2019-02-03

### Changed

- date format in node metadata

### Fixed

- node details
- more types exported

## 0.4.6 2019-02-03

### Fixed

- exports
- minor API changes

## 0.4.5 2019-02-01

### Added

- stateless clone
- object type label
- object URL from name
- exported more object types

## 0.4.4 2019-02-01

### Added

- label in creatable object types

## 0.4.3 2019-01-31

### Fixed

- cookies/session handling
- self-signed certificates support

## 0.4.2 2019-01-29

### Fixed

- exports

## 0.4.1 2019-01-29

### Fixed

- exports

## 0.4.0 2019-01-29

### Changed

- nodecontents API signature

## 0.3.3 2019-01-28

### Fixed

- cookie jar support

## 0.3.2 0.3.3 2019-01-27

### Fixed

- message text in activation
- added .npmignore

## 0.3.1 2019-01-26

### Fixed

- deployment (took a few iterations)
- build on publish

## 0.2.8 2019-01-26

### Changed

- renamed a couple of API methods

## 0.2.8 2019-01-26

### Added

- search
- get object path
- validation
- creation
- deletion

### Fixed

- session handling
- code writing

## 0.2.7 2019-01-25

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
