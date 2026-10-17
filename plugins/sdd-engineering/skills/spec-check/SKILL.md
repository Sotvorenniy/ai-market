---
name: spec-check
version: 1.0.0
description: "Read-only readiness check of one SDD spec before planning: runs the spec-writing self-check and returns a READY or NOT READY verdict with each blocking finding and its line. Use when the user runs /sdd-engineering:spec-check <spec>, or asks 'is this spec ready for planning?' or 'check my spec'. Does NOT edit the spec or write one (use sdd-engineering:spec-creator)."
argument-hint: "<path to spec .md>"
allowed-tools: Read, Grep, Glob, Skill
---

# Spec check

Tells the user whether a spec can go to `sdd-engineering:implementation-planner` now, and what to
fix first if it cannot. It never edits the spec: findings go back to the author or to
`sdd-engineering:spec-creator`.

## Steps

1. **Find the spec.** Use the path from the arguments. Without one, Glob `**/specs/*.md` (skip
   `README.md`); if there is exactly one spec, use it, otherwise list the candidates and stop.
2. **Load the rules.** Load the `sdd-engineering:spec-writing` skill and read its
   `references/self-check.md` and `references/template.md`. They are the only source of rules: do
   not add your own.
3. **Read the whole spec** with line numbers. Cite every finding as `<file>:<line>`.
4. **Run the 15 self-check items.** Each item is `pass`, `fail` or `n/a` with a one-line reason.
   Judge only what the file shows: item 14 (clarification categories) is `n/a` unless the spec
   records them. For item 8, check that each cited `path:line` exists when the file is in this
   repository; a path that does not exist is a `fail`.
5. **Decide the verdict.** The spec is **NOT READY** when any of these holds; each one is a
   blocking finding:
   - a failed item 1, 2, 3, 5, 8 or 15 (the blocking items in `self-check.md`);
   - a `[NEEDS CLARIFICATION]` marker anywhere in the spec;
   - `Status:` is not `approved`.

   Otherwise it is **READY**. Failures of other items are warnings: they do not block planning.

## Report

The first line is the verdict, exactly one of:

```
Verdict: READY for planning
Verdict: NOT READY (<n> blocking)
```

Then:

```
## Blocking
1. <file>:<line> — <what is wrong> — fix: <what the author changes>

## Warnings
- <file>:<line> — <item #> — <what is wrong>

## Self-check
| # | Result | Reason |
|---|---|---|
| 1 | pass | ... |
```

Write "None" under an empty heading. Keep the report to the findings: do not rewrite the spec,
propose new requirements or comment on the feature itself. End with one line on the next step:
`sdd-engineering:implementation-planner` when READY, the author or `sdd-engineering:spec-creator`
when NOT READY.
