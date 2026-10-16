---
name: onion-architecture
version: 1.0.0
description: "Onion Architecture for TypeScript backends built from feature modules (for example Fastify + Drizzle + Zod with a DI container / composition root). Enforces the dependency rule — every import points inward, from routes to services to ports/domain, with repositories and adapters implementing ports from the outside. Use this skill whenever you create or change a backend module, add a service, repository, route, port, adapter or use case, write a database query, touch the composition root (DI container), move backend code between files, or review a backend diff. Use it even when the user just says 'add an endpoint', 'where should this query go?', 'this route is getting big', 'add a new module' or mentions onion / hexagonal / clean architecture / ports and adapters. Uses dependency-cruiser as the mechanical gate. Does NOT cover Fastify API details (use engineering-paved-path:fastify-best-practices), Drizzle query syntax (engineering-paved-path:drizzle-orm-patterns), schema design (engineering-paved-path:postgresql-table-design) or the React client (engineering-paved-path:frontend-ui-architecture)."
---

# Onion Architecture — backend

The one rule: **source dependencies point inward.** An inner ring never names anything
declared in an outer ring. Frameworks, the database and SDKs sit in the outermost ring and
plug in through interfaces that the core owns.

```
        ┌──────────────────────────────────────────────────────┐
        │ Presentation   routes.ts  (Fastify + Zod parsing)    │
        │  ┌────────────────────────────────────────────────┐  │
        │  │ Application   service.ts, use-case files       │  │
        │  │  ┌──────────────────────────────────────────┐  │  │
        │  │  │ Core   domain.ts · ports.ts · src/ports/ │  │  │
        │  │  └──────────────────────────────────────────┘  │  │
        │  └────────────────────────────────────────────────┘  │
        │ Infrastructure  repository.ts · src/adapters · src/db │
        └──────────────────────────────────────────────────────┘
          Composition root: src/platform/container.ts (sees everything)
```

The file and folder names above are the **reference layout** this skill uses in its rules,
examples and templates: one folder per feature under `src/modules/<m>/`, shared ports in
`src/ports/`, adapters in `src/adapters/`, the database in `src/db/` and a composition root
in `src/platform/container.ts`. If the project names these differently, map the roles, not
the names. Project-specific mapping: read the project's AGENTS.md or CLAUDE.md for where
these layers live.

## Rule block (non-negotiable)

- **Route → service → domain, wired via the container.** `routes.ts` calls a service; the service works against ports; the composition root is the only place concrete classes are built.
- **External integrations (third-party APIs, LLM providers, git, SDKs) live only in adapters at the edge**, behind ports.
- **Dependencies point inward.** Inner rings never import outer ones.
- **A route must never call an adapter, a repository or the db directly** (no `container.db`, `db/schema`, `drizzle-orm`, no `container.<adapter>` in `routes.ts`). **CRITICAL.**

Read the reference that fits the task, not all of them:

| Task | Read |
|---|---|
| What may each file import? Where does this code go? | [references/layers.md](references/layers.md) |
| Fastify routes, Drizzle repositories, transactions, Zod, adapters, the Container | [references/tools.md](references/tools.md) |
| How to test each ring | [references/testing.md](references/testing.md) |
| Sources and rationale | [references/sources.md](references/sources.md) |

BAD/GOOD code pairs: [examples.md](examples.md). New-module skeleton: [templates/module/](templates/module/).
Starter dependency-cruiser config: [templates/dependency-cruiser.cjs.tmpl](templates/dependency-cruiser.cjs.tmpl).

## Default decisions

Adopt these unless the project's AGENTS.md or CLAUDE.md records a different choice:

1. **Ports.** Cross-module ports go in `src/ports/`, module-local ports in
   `modules/<m>/ports.ts`. If the project consumes adapter ports from a shared or vendored
   contracts package, **reuse them by `import type`, never edit the vendored copy** — wrap
   them in a local port when you need more.
2. **Zod in the core.** `domain.ts` / `ports.ts` may `import type` from zod (`z.infer`).
   A runtime zod call there is a violation — parsing happens at the boundary (routes).
3. **Thin modules.** A module that is only `routes.ts` is allowed **as long as it does not
   touch the DB** — no `drizzle-orm`, no `db/schema`, no `container.db`. The moment it needs
   data it gets a `service.ts` + repository port.
4. **Existing violations are baselined** (dependency-cruiser's
   `.dependency-cruiser-known-violations.json`) when the rules are introduced into a codebase
   that already breaks them. They are tolerated, never extended. New code must pass with zero
   new violations.

## The files of a module

| File | Ring | Owns | Must NOT import |
|---|---|---|---|
| `domain.ts` | Core | Entities, value objects, pure rules, domain errors (subclass the app's base error) | fastify, drizzle, postgres, SDKs, `src/adapters`, `src/db`, `container`, runtime zod |
| `ports.ts` | Core | Interfaces the service needs: `<Entity>Repository`, external systems | same as `domain.ts` |
| `service.ts` (+ use-case files) | Application | Orchestration of one use case; transaction boundaries via a port | drizzle, `src/db`, `src/adapters`, `container`, `repository.ts` |
| `repository.ts` / `repository/*.repo.ts` | Infrastructure | Drizzle queries; implements a port; maps rows ↔ domain | `routes.ts`, `service.ts` |
| `routes.ts` | Presentation | Zod schemas, call the service, map to the wire DTO | drizzle, `src/db`, repositories, adapters |
| `helpers.ts` / `constants.ts` | Same ring as their consumer | Pure functions / constants | whatever their consumer's ring forbids |
| `platform/container.ts` | Composition root | The only place `new ConcreteThing()` runs | — |

Add `domain.ts` and `ports.ts` **when the module needs them**. A service with one trivial
repository may declare its port at the top of `ports.ts` with nothing in `domain.ts`.

## Workflow

### Create (new module or new feature in a module)
1. Read the project's AGENTS.md / CLAUDE.md (and any recorded lessons or pitfalls it links)
   and name the entries that apply.
2. Start from the core outward: `domain.ts` → `ports.ts` → `service.ts` → `repository.ts` →
   `routes.ts`. Copy from [templates/module/](templates/module/).
3. The service takes its ports through the constructor — **a narrow deps object, never the
   whole `Container`**.
4. Wire it in the composition root (construct repo + service) and register the routes
   wherever the project registers modules (typically one import + one entry).
5. Run the gate (below). Zero new violations.

### Review (a diff or a file)
1. Run the gate. Every error is a finding with its `path → path`.
2. Then walk the checklist below over the diff — it catches what imports cannot
   (e.g. `container.db` used without importing drizzle, SDK types leaking through a port).
3. Report each finding as `path:line`, the rule it breaks, and the inward-pointing fix.

### Refactor (paying down a baselined violation)
1. Pick one from the baseline file — smallest blast radius first.
2. Extract the query into the module's repository, declare the port, inject it.
3. Run the gate, then **regenerate the baseline** so the fixed violation cannot come back:
   `npx depcruise src --config .dependency-cruiser.cjs --output-type baseline > .dependency-cruiser-known-violations.json`
4. Check the diff of the baseline file: it must only **shrink**. A growing baseline means
   you added a violation — fix it instead.

## The gate

Run from the backend package root (the directory with `node_modules/` and
`.dependency-cruiser.cjs`):

```bash
"${CLAUDE_SKILL_DIR}/scripts/check.sh" [SRC_DIR]   # SRC_DIR defaults to src; wraps both checks
# or directly:
npx depcruise src --config .dependency-cruiser.cjs --ignore-known --output-type err
```

`check.sh` also greps for `container.db` in module files outside repositories, which
dependency-cruiser cannot see. Run it with `--help` for its options (config path, allowlist
of files that already use `container.db`, the pattern to grep for). If the project has no
dependency-cruiser config yet, start from
[templates/dependency-cruiser.cjs.tmpl](templates/dependency-cruiser.cjs.tmpl).

## Checklist (CRITICAL → MEDIUM)

- **CRITICAL** — Does anything in `domain.ts` / `ports.ts` / `service.ts` import Drizzle,
  `src/db`, an SDK, a concrete adapter, or the `Container`?
- **CRITICAL** — Does a `routes.ts` run a query (`container.db…`, `import * as t from db/schema`)?
- **CRITICAL** — Does a port's signature expose an infrastructure type
  (`typeof t.orders.$inferSelect`, `Octokit`, `ChatCompletion`, a Drizzle `tx`)?
- **HIGH** — Does a service `new` its own repository or adapter instead of receiving a port?
- **HIGH** — Does a service re-parse data with zod that routes already parsed?
- **HIGH** — Does module A import module B's `service.ts` / `repository.ts` instead of its
  `ports.ts` / `domain.ts` / `types.ts` or a Container getter?
- **HIGH** — Does a domain/service error know its HTTP status beyond the app's error taxonomy
  (e.g. calling `reply.status` from a service)?
- **MEDIUM** — Does the repository return rows while the service needs domain objects? Map
  in the repository (`toDomain`), not in the route.
- **MEDIUM** — Is a new file in a module named for a role it doesn't play?

## When not to add rings

Palermo is explicit that the pattern pays off for long-lived, behaviour-rich code, not for
trivial CRUD. Do not create empty `domain.ts` files or one-method ports for their own sake.
The *direction* of dependencies is never optional; the number of files is.
