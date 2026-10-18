# Changelog

All notable changes to `architecture-review` are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Release with `npm run release -- architecture-review <version>` from the repository root; the script moves the Unreleased notes into a dated section and tags `architecture-review--v<version>`.

## [Unreleased]

### Changed

- `architecture-reviewer` applies the backend layering and frontend placement rules from the `onion-architecture` and `frontend-ui-architecture` skills instead of its own summary of them, so the two cannot drift apart. Contract, package and migration checks are unchanged.

## [1.0.0] - 2026-10-16

### Added

- `architecture-reviewer` agent: read-only review of backend layering, frontend placement, contracts, packages and migrations, using the engineering-paved-path architecture skills.

### Changed

- First stable release. From 1.0.0 on, removing or renaming a component needs a major version.

### Fixed

- The plugin loads after install: its `^1.0.0` dependency ranges now match the 1.0.0 releases of the plugins it depends on.
