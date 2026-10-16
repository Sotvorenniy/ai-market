# engineering-paved-path

The team's "paved path": engineering standards packaged as Claude Code skills. Agents and people
load them by name when a task touches their area. Other plugins in this marketplace depend on it
instead of copying the rules.

```
/plugin marketplace add Sotvorenniy/ai-market
/plugin install engineering-paved-path@ai-market
```

## Skills

| Skill | Area | Use it for |
|---|---|---|
| `react-best-practices` | Frontend | React anti-patterns, state management, hooks rules, accessibility basics |
| `frontend-ui-architecture` | Frontend | Where new files, folders, hooks and constants go; feature boundaries; business logic placement |
| `react-testing-library` | Frontend tests | Behaviour-first component tests with React Testing Library and Vitest |
| `ux-review` | UX | UI state matrix, usability heuristics, WCAG 2.2 AA checklist, wording; outputs proposals, not code |
| `fastify-best-practices` | Backend | Fastify routes, plugins, JSON-schema validation, error handling, performance, deployment |
| `onion-architecture` | Backend | Onion layering, the dependency rule, ports and adapters, testing per layer, a dependency-rule gate script |
| `drizzle-orm-patterns` | Data | Drizzle schema, queries, relations, transactions, migrations |
| `postgresql-table-design` | Data | PostgreSQL data types, indexing, constraints, table design |
| `zod` | Full stack | Zod schemas, parsing, error handling, type inference, performance |
| `security` | Full stack | OWASP Top 10:2025, agentic AI security, auth, injection, uploads, secrets |

## Use them

- **Automatically:** Claude loads a skill when your request matches its description.
- **By name:** `/engineering-paved-path:onion-architecture`, or ask "use the
  engineering-paved-path:security skill to review this endpoint".
- **From agents:** agents with the `Skill` tool load them by namespaced name, for example
  `sdd-engineering:implementation-planner` routes each plan step to the skills it needs and
  `architecture-review:architecture-reviewer` checks changes against the two architecture skills.

The skills are generic. Each project maps them onto its own layout in its `AGENTS.md` or `CLAUDE.md`
(for example, which folder holds the domain layer); project rules win over generic advice.

## Scripts

`onion-architecture` ships a dependency-rule gate in `scripts/check.sh`; the skill explains its
arguments and how to wire it into CI.

## Third-party content

`drizzle-orm-patterns`, `fastify-best-practices`, `postgresql-table-design` and `zod` are adapted
from MIT-licensed upstream skills. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Versions

See [CHANGELOG.md](CHANGELOG.md). Releases are tagged `engineering-paved-path--v<version>`. Plugins
that depend on this one pin `^1.0.0`, so breaking changes to a skill's rules need a major version.
