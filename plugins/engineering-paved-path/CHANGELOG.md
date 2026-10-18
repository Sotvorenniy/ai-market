# Changelog

All notable changes to `engineering-paved-path` are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Release with `npm run release -- engineering-paved-path <version>` from the repository root; the script moves the Unreleased notes into a dated section and tags `engineering-paved-path--v<version>`.

## [Unreleased]

## [1.0.1] - 2026-10-17

### Changed

- Shorter descriptions for `onion-architecture`, `frontend-ui-architecture`, `ux-review`, `fastify-best-practices` and `drizzle-orm-patterns`: the plugin adds ~1,232 instead of ~1,907 tokens to every session. Trigger evals show the skills still load for tasks in their area (see docs/COST-BASELINE.md in the repository).
- Trigger evals for `fastify-best-practices` and `drizzle-orm-patterns`.

## [1.0.0] - 2026-10-16

### Added

- Skills: react-best-practices, frontend-ui-architecture, react-testing-library, ux-review, fastify-best-practices, onion-architecture, drizzle-orm-patterns, postgresql-table-design, zod, security.
- Third-party notices for the skills adapted from MIT-licensed upstream repositories.

### Changed

- First stable release. From 1.0.0 on, removing or renaming a component needs a major version.
