# Changelog

All notable changes to `sdd-engineering` are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow [Semantic Versioning](https://semver.org/). Release with `npm run release -- sdd-engineering <version>` from the repository root; the script moves the Unreleased notes into a dated section and tags `sdd-engineering--v<version>`.

## [Unreleased]

### Added

- Agents: `spec-creator`, `implementation-planner`, `implementer`, `plan-verifier`.
- Skills: `run-plan`, `workflow-retro`, `spec-writing`, `engineering-insights`, `mermaid-diagram`.
- Guard hooks that limit where each agent writes and which commands it runs.
- Evals that check the agents and skills resolve through their plugin namespaces.
