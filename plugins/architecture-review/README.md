# architecture-review

A read-only `architecture-reviewer` agent that checks a change set against architectural boundaries:
backend layering, frontend code placement, shared contract drift, package boundaries and migrations.
The rules come from [`engineering-paved-path`](../engineering-paved-path), which is installed with it.

```
/plugin marketplace add Sotvorenniy/ai-market
/plugin install architecture-review@ai-market
```

## Use it

Give it the changed files and the diff (a file path is cheapest):

```
git diff --stat main > /tmp/changes.txt
git diff main > /tmp/changes.patch
```

```
Use the architecture-review:architecture-reviewer agent on the change in /tmp/changes.patch (file list in /tmp/changes.txt).
```

Optionally add the output of the onion gate from
`engineering-paved-path:onion-architecture` (`scripts/check.sh`) or your own dependency-rule tool;
without it the report says "gate not run".

Inside the SDD workflow, `sdd-engineering:run-plan` prepares the diff and calls the reviewer for you.

## What it checks

| Area | Rules from |
|---|---|
| Backend layering: dependency direction, ports and adapters, no container in services | `engineering-paved-path:onion-architecture` |
| Frontend placement: decision tree, route-local components, data flow through hooks | `engineering-paved-path:frontend-ui-architecture`, `react-best-practices` |
| Contracts: every copy of a shared contract changes together; nullability conventions | project docs, `engineering-paved-path:zod` |
| Packages and migrations: purity of packages the project declares pure, generated migrations, applied migrations untouched | project `AGENTS.md` / `CLAUDE.md` |

Only added or changed lines count. Every finding has `path:line`, the rule, quoted evidence and a
confidence; CRITICAL needs a failure scenario.

## Output

An Architecture Review Report: verdict (PASS, PASS WITH FINDINGS, BLOCKED), findings table, gate
results, what was checked and clean, what was not verified, hand-off, and a findings JSON block the
orchestrator merges across review rounds.

Tools: `Read`, `Grep`, `Glob`, `Skill`. It cannot edit files or run commands.

## Versions

See [CHANGELOG.md](CHANGELOG.md). Releases are tagged `architecture-review--v<version>`.
