# Changelog

All notable changes to `sdd-engineering` are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Release with `npm run release -- sdd-engineering <version>` from the repository root; the script moves the Unreleased notes into a dated section and tags `sdd-engineering--v<version>`.

## [Unreleased]

## [1.1.0] - 2026-10-17

### Added

- `spec-check` skill: `/sdd-engineering:spec-check <spec>` runs the spec-writing self-check on one spec and answers `READY for planning` or `NOT READY` with each blocking finding and its line. Read-only.
- Evals for `spec-check`: blocks an approved spec with gaps, and does not block a spec that passes.

## [1.0.0] - 2026-10-16

### Added

- Agents: `spec-creator`, `implementation-planner`, `implementer`, `plan-verifier`.
- Skills: `run-plan`, `workflow-retro`, `spec-writing`, `engineering-insights`, `mermaid-diagram`.
- Guard hooks that limit where each agent writes and which commands it runs.
- Evals that check the agents and skills resolve through their plugin namespaces.

### Changed

- First stable release. From 1.0.0 on, removing or renaming a component needs a major version.

### Fixed

- The plugin loads after install: its `^1.0.0` dependency ranges now match the 1.0.0 releases of the plugins it depends on.
