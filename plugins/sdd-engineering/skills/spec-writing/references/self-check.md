# Spec self-check

Run it before handing a spec off (`spec-creator`) and when reviewing a spec as input
(`implementation-planner`). Report each item as pass or fail with the reason.

| # | Check | Fails when |
|---|---|---|
| 1 | Every AC follows an EARS pattern, has one trigger and one observable response with an `_(observable: ...)_` hint; no AC weakens an invariant the project's `AGENTS.md` / `CLAUDE.md` declares | compound response, vague word, no observable hint, a documented invariant weakened |
| 2 | Every user story has at least one AC; every AC names a user story | orphan story or orphan AC |
| 3 | Every goal is covered by at least one AC in "Traceability" | a goal with no row |
| 4 | Every edge case has an AC or an explicit Non-goal | EC with neither |
| 5 | Every untrusted input has a threat class, a guard and a covering AC or NFR | guard missing or untraced |
| 6 | Every NFR is measurable and has a verify hint; every AC has a "Verify by" lane | adjective NFR, empty lane, `manual` without a reason |
| 7 | Every proposal is in "Decisions"; no `PROPOSED` marker is left in the body | open proposal in the text |
| 8 | Every repository fact has a `path:line`; unverified claims are in "Open questions" | uncited path, endpoint, table or limit |
| 9 | No implementation details beyond workflow, communication and contract shapes | file lists, code, library choice, step list |
| 10 | Contracts state nullability per field and cover every copy of a shared contract when it changes | missing nullability, one-sided contract change |
| 11 | Spec ID unique (grep re-run), file name and location correct, index line handed off when the spec folder keeps an index | duplicate ID, wrong folder, missing index line |
| 12 | About 15 ACs at most (or a split proposed); Mermaid diagrams about 20 nodes at most | oversized spec or diagram |
| 13 | All template headings present, in order, "None" where empty; all text in English | missing or reordered heading |
| 14 | All six clarification categories (C1-C6) were asked or marked "None — why settled" | a category skipped silently |
| 15 | No guessed values: every unknown is a `[NEEDS CLARIFICATION]` marker with an "Open questions" entry | a default nobody confirmed; a marker with no OQ |

## For reviewers of a spec (implementation-planner, plan-verifier)
- A failed item 1, 2, 3, 5, 8 or 15 is a blocking finding: send the spec back to `spec-creator`;
  do not fix it in the plan.
- An AC that still holds a `[NEEDS CLARIFICATION]` marker is not planned; list it as blocked.
- A failed item 6 means the implementation-planner picks the lane and lists it as an assumption.
- Never edit the spec yourself.
