# Onion Architecture Skill

**Version 1.0.0**

## Changelog

**1.0.0** — Initial release: rules, examples, module templates, a starter dependency-cruiser
config and a gate script that supports a baseline of existing violations.

## Motivation

Many TypeScript backends already have the pieces of an onion — adapter ports, a composition
root, repositories per module — but nothing keeps the direction of dependencies honest.
Routes query the ORM directly, services take the whole `Container`, adapters reach into
modules. The sibling skills (`engineering-paved-path:fastify-best-practices`,
`engineering-paved-path:drizzle-orm-patterns`, `engineering-paved-path:zod`) each cover one
tool and say nothing about how the tools relate.

This skill owns that relationship and makes it mechanical: a dependency-cruiser config
encodes the rings, and a baseline freezes existing debt so only **new** violations fail.

## Decisions

| Question | Default |
|---|---|
| Where do new ports live? | `src/ports/` for shared, `modules/<m>/ports.ts` for local; ports from a vendored contracts package are reused, never edited |
| Zod in the domain? | `import type` only (`z.infer`); no runtime zod in `domain.ts` / `ports.ts` |
| Routes-only modules? | Allowed while they do not touch the DB |
| Existing violations? | Baselined in `.dependency-cruiser-known-violations.json`; shrink it, never grow it |

## Files

| File | Purpose |
|---|---|
| `SKILL.md` | Dependency rule, file roles, workflows (create / review / refactor), checklist |
| `examples.md` | BAD/GOOD pairs |
| `references/layers.md` | Placement decision, ports, service deps, mapping, cross-module access |
| `references/tools.md` | Fastify, Drizzle (+ UnitOfWork), Zod, adapters, Container, dependency-cruiser |
| `references/testing.md` | Test type per ring |
| `references/sources.md` | Articles and docs the rules come from |
| `templates/module/*.tmpl` | New-module skeleton (`__name__`, `__Entity__`, `__table__` placeholders) |
| `templates/dependency-cruiser.cjs.tmpl` | Starter dependency-cruiser config encoding the rings |
| `scripts/check.sh` | The gate: depcruise `--ignore-known` + `container.db` grep. Usable in CI |

## Enforcement outside the skill

In a project that adopts this skill, enforcement lives in the project itself:

- `.dependency-cruiser.cjs` — the rules (start from the template).
- `.dependency-cruiser-known-violations.json` — the baseline, if existing code violates the rules.
- A CI step that runs `scripts/check.sh` (or `depcruise --ignore-known`) on every change.
