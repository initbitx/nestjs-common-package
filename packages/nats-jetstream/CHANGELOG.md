# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2025-07-31

### Added
- Multiple server connections for improved reliability
- Logger integration with NestJS application logger
- Improved event reliability with automatic reconnection

### Changed
- Marked legacy registration options as deprecated. These options will be removed in the next major release:
  - `streamName` (use `stream.name` instead)
  - `durableName` (use `consumerOptions.name` instead)
  - `deliverPolicy` (use `consumerOptions.deliver_policy` instead)
  - `ackPolicy` (use `consumerOptions.ack_policy` instead)
  - `ackWait` (use `consumerOptions.ack_wait` instead)
  - `filterSubject` (use `consumerOptions.filter_subject` instead)
  - `filterSubjects` (use `consumerOptions.filter_subjects` instead)
- Updated README.md to document the deprecated options and provide migration guidance

## [1.1.0] - 2023-11-15

### Added
- Updated transport architecture
- Advanced features for JetStream integration
- Improved error handling and logging

### Changed
- Updated license and prepared repository for open-source contribution

### Fixed
- Fixed failing tests in the nats-jetstream package

## [1.0.2] - 2023-09-20

### Fixed
- Fixed incorrect publish file path

## [1.0.1] - 2023-08-10

### Changed
- Renamed token constants for improved clarity

## [1.0.0] - 2023-07-01

### Added
- Initial release of the nats-jetstream NestJS library
- Basic JetStream integration with NestJS
- Support for event patterns and message patterns
- Setup of nx workspace
