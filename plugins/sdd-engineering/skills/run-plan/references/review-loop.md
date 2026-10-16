# R3 — Review and fix loop

Goal: leave R3 with no open CRITICAL or HIGH finding and a recorded decision for every MEDIUM,
in at most `max_review_rounds` rounds (default 3).

```
round = 1
loop:
  hand-off → review (architecture) → merge findings → triage → fix → checks
  exit if clean · escalate if a stop condition hits · else round++
```

This release has one reviewer, `architecture-review:architecture-reviewer`. A security reviewer
plugin can be added later; it would run in parallel with the architecture reviewer on the same
hand-off, with its own ID prefix (`S-<n>`).

## 1. Build the hand-off

The reviewer is read-only and cannot run `git`, so the orchestrator prepares its input
(`base_sha` from `state.json`):

```bash
P=.claude/plans/<slug>
mkdir -p $P/review-r<N>
git diff --stat <base_sha>                                     # show it in the round summary
git diff --name-only <base_sha> > $P/review-r<N>/changed-files.txt
git ls-files --others --exclude-standard >> $P/review-r<N>/changed-files.txt   # new, untracked files
git diff <base_sha> -- <paths> > $P/review-r<N>/diff.patch
```

`<paths>` are the changed source paths; leave out the run folder itself, lock files and
generated files the project's docs name. `git diff` does not include untracked files; tell the
reviewer which entries of `changed-files.txt` are new so it reads them in full.

If the project has a dependency-rule tool (for example the onion gate `check.sh` from
`engineering-paved-path:onion-architecture`), run it and save its output to
`review-r<N>/gate.txt`. Without it, tell the reviewer "gate not run".

Round 2+: list the files touched since the previous round in `review-r<N>/touched-files.txt`:
the files changed by the fixes of round N-1 (from the fix brief and the implementer's report, or
`git diff --name-only` against a commit or stash taken at the end of round N-1).

## 2. Review

Run `architecture-review:architecture-reviewer` with: the plan path, the spec path,
`review-r<N>/changed-files.txt`, `review-r<N>/diff.patch`, the gate output (or "gate not run"),
and on round 2+ `touched-files.txt` plus the open finding IDs with `path:line` and rule.

- Ask for: the findings table, a "confirmed fixed: <ids>" line, a "still open: <ids>" line and
  the Findings JSON block. Passing areas collapse to one line ("checked and clean: …").
- Round 2+: "Review only the files in `touched-files.txt` and confirm the open findings. Do not
  re-review untouched files." Skip the round's review when no finding is open and the touched
  files hold nothing architectural.

The reviewer runs on `sonnet`. If a round looks shallow (a risky area in the diff marked
"checked and clean" with no evidence), re-run it once with `model: "opus"` on the Agent call;
do not change the default.

## 3. Merge into `findings.json`

Save the reviewer's "Findings JSON" block to `review-r<N>/reviews.json`. Then update the
cumulative `review-r<N>/findings.json` (copy of the previous round's file; schema in
[`state-schema.md`](state-schema.md)).

A finding's **match key** is `agent + rule + file + symbol` (the nearest function, component or
export; `line` is left out because it shifts after edits).

- New key: new ID (`A-<n>` architecture), `status: open`, `first_round: N`.
- Known key, reviewer says fixed (or the finding is absent while its file was re-reviewed): `status: fixed`, `fixed_round: N`.
- Known key with `status: fixed`, reported again: `status: open`, `reopened + 1`. This is **oscillation**.
- When more than one reviewer runs (a later release): the same defect from two reviewers is one entry with both agents in `sources`.

## 4. Triage

| Severity | Action |
|---|---|
| CRITICAL, HIGH | Must fix. No user question unless the fix contradicts the plan or spec (see 5). |
| MEDIUM | Ask the user **every round** with `AskUserQuestion`, max 4 findings per call. Options: **Fix now**, **Accept** (one-line reason), **Defer** (listed in the final summary as follow-up). Accepted and deferred findings are not asked again unless reopened. |
| LOW | `status: logged`. No fix, no question. |

A CRITICAL with confidence `medium`: read the cited lines yourself before routing. If the failure
scenario does not hold, set `status: rejected` with the reason and tell the reviewer next round.

## 5. Route each fix

| Condition | Route |
|---|---|
| Fix changes behaviour or scope (contradicts the spec) | Stop the loop. Ask the user; the spec is revised by hand with `sdd-engineering:spec-creator`. |
| Fix contradicts a plan step (wrong layer, wrong contract) | Stop the loop. Ask the user; the plan is amended by hand with `sdd-engineering:implementation-planner`, then `/sdd-engineering:run-plan <slug> --from review`. |
| One-line or mechanical (rename, move a constant, `import type`, a guard) | Main session fixes directly. |
| Code change within plan scope | `sdd-engineering:implementer` with `review-r<N>/fix-brief.md` (single-agent mode: the main session). |
| Fix needs a test change | With `--with-tests`: the main session updates the tests after the code fix. Without: the writer keeps existing tests green only; note the gap in the summary. |

`fix-brief.md` lists for each finding: ID, severity, `path:line`, rule, the reviewer's evidence,
the expected outcome and the plan step or AC it belongs to. The implementer treats it as the
phase to execute and must not widen scope beyond it.

## 6. Checks

Run the plan's §5 verification commands (typecheck, related tests, lint) for the touched
packages, exactly as the plan lists them. A failure goes back to the same writer before the next
review round; it does not count as a round.

## 7. Exit and escalation

Exit R3 when no finding is `open` with severity CRITICAL or HIGH, and every MEDIUM is `fixed`,
`accepted` or `deferred`.

**Gate G1** — stop and ask the user when any of these holds:

- `round > max_review_rounds` with an open CRITICAL or HIGH;
- a finding has `reopened >= 1` (two fixes undo each other);
- the open CRITICAL + HIGH count is higher than in the previous round;
- (with more than one reviewer) reviewers ask for contradictory fixes on the same lines.

G1 options: **One more round**, **Accept and continue** (each open finding gets a reason),
**Stop for re-planning** (the user re-runs `implementation-planner`), **Stop the run**.
