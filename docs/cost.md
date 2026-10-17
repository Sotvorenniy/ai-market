# Cost baseline and experiments

A plugin costs tokens in two ways:

- **Always-on**: the name and description of every skill and agent are added to every session where
  the plugin is enabled, whether it is used or not. Everyone who installs the plugin pays this.
- **On-invoke**: the full skill or agent body, paid each time it fires.

Measure both with `claude --plugin-dir plugins/<name> plugin details <name>`. The numbers are the CLI's
estimates, rounded. Eval costs below are what `claude plugin eval` reported.

## Baseline (1.0.0, 2026-10-16)

| Plugin | Always-on per session | Largest components (always-on) |
|---|---|---|
| `engineering-paved-path` | ~1,907 | onion-architecture ~380, frontend-ui-architecture ~320, ux-review ~320, fastify-best-practices ~240 |
| `architecture-review` | ~146 | architecture-reviewer ~150 |
| `research-tools` | ~101 | researcher ~100 |
| `sdd-engineering` | ~2,090 | run-plan ~330, spec-writing ~310, implementation-planner ~270, spec-creator ~260 |
| **`sdd-engineering` with its dependencies** | **~4,244** | |

Hooks cost no model context. On-invoke cost is largest for `react-testing-library` (~7.4k),
`spec-creator` (~6.3k), `postgresql-table-design` (~6.2k) and `implementation-planner` (~5.5k).

## Experiment 1: shorter skill descriptions in engineering-paved-path

**Hypothesis.** The five longest descriptions repeat themselves (several trigger phrasings, long
"does not cover" lists). Shortening them cuts always-on cost without changing when the skills load.

**Change.** Rewrote the descriptions of `onion-architecture`, `frontend-ui-architecture`, `ux-review`,
`fastify-best-practices` and `drizzle-orm-patterns`, keeping the area, the typical tasks, the key
trigger phrases and the boundary to neighbouring skills. Skill bodies are unchanged.

**Quality gate**, decided before the variant ran: every case of the suite at 1.0 over 3 runs, and no
case below the baseline.

- 5 trigger cases, one per changed skill: a task in the skill's area whose prompt does not name the
  skill; the skill must load (`tool_used: Skill`).
- 1 negative case: an unrelated task loads no skill.
- 1 behaviour case: `onion-dependency-rule`.

**Result.**

| | Always-on (`engineering-paved-path`) | Gate (7 cases × 3 runs) | Eval cost |
|---|---|---|---|
| Baseline | ~1,907 | 7/7 at 1.0 | $3.09 |
| Shorter descriptions | **~1,232 (−675, −35%)** | 7/7 at 1.0 | $2.69 + $0.3 rerun |

The variant passes the gate. The variant run hit an account spend limit on the negative case: its
3 runs ended on an API error, not a failed check, and were rerun on their own (3/3 pass).

**What this does and does not show.**

- The saving is certain: it is in every session of every user, ~675 tokens.
- The gate shows that clear in-area tasks still load the right skill. It cannot show subtle losses:
  the baseline also scored 1.0, the trigger prompts name their technology (Fastify, Drizzle,
  Next.js), and 3 runs per case is a small sample. Borderline prompts ("where should this go?" with
  no stack named) are not covered.
- The other five skills were not changed and have no trigger cases yet.
- Eval cost per run is not a quality or savings signal: it varies with the answers' length.

**Decision.** Ship in `engineering-paved-path` 1.0.1 (wording only, a patch). Add a borderline
trigger case before shortening further.

## Current (after experiment 1 and sdd-engineering 1.1.0)

| Plugin | Always-on per session |
|---|---|
| `engineering-paved-path` | ~1,232 |
| `architecture-review` | ~146 |
| `research-tools` | ~101 |
| `sdd-engineering` (adds `spec-check`, ~140) | ~2,244 |
| **`sdd-engineering` with its dependencies** | **~3,723 (−521 vs baseline, −12%)** |

## Running an experiment

1. Measure the baseline with `plugin details`, and run the gate on the unchanged code from a separate
   worktree: `npm run eval -- <plugin> --runs 3 --scaffold --trust-plugin`.
2. Write the gate down before running the variant.
3. Make the change, measure, run the same gate.
4. Record the numbers here, including what the gate cannot show, and decide.
