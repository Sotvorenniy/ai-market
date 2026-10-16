# Run state files

Both files live in `.claude/plans/<slug>/` and are written only by the main session.

## `state.json`

```json
{
  "slug": "pr-filters",
  "created_at": "2026-10-14T10:00:00Z",
  "updated_at": "2026-10-14T11:20:00Z",
  "stage": "review",
  "stage_status": "running",
  "plan": { "path": ".claude/plans/pr-filters.md", "sha256": "…", "mode": "multi-agent", "phases_done": [1, 2] },
  "base_sha": "f6bde8df618cca5c63aced15199b2648ad270ee2",
  "spec": { "path": "specs/2026-10-10-pr-filters.md", "id": "SPEC-07" },
  "options": { "with_tests": false, "max_review_rounds": 3 },
  "gates": { "G1": [], "G2": null },
  "verify": { "code_rounds": 1, "code_verdict": "COMPLETE", "final_verdict": null },
  "review": { "round": 2, "open_critical_high": [3, 1] },
  "reports": ["reports/implementation-p1.md", "reports/verify-code-r1.md"]
}
```

- `stage`: `intake | build | verify | review | reverify | tests | insights | pr | done | stopped`.
- `base_sha`: `HEAD` at intake (after the spec and plan commits). Every review diff in the run is taken against it.
- `stage_status`: `running | blocked | waiting_user | done`.
- `review.open_critical_high`: count per round. The loop compares the last two values for the
  "growing count" escalation.
- `gates.G1`: one entry per escalation, `{ "round": 3, "answer": "one more round", "at": "…" }`.

## `review-r<N>/findings.json`

Cumulative: each round copies the previous file and updates it.

```json
[
  {
    "id": "A-3",
    "sources": ["architecture-reviewer"],
    "severity": "HIGH",
    "confidence": "high",
    "rule": "onion-architecture: routes call services only",
    "file": "src/modules/orders/routes.ts",
    "symbol": "ordersRoutes",
    "line": 42,
    "summary": "routes.ts imports repository.ts directly",
    "status": "open",
    "route": "implementer",
    "decision_reason": null,
    "first_round": 1,
    "fixed_round": null,
    "reopened": 0
  }
]
```

- Field names `severity`, `file`, `line`, `rule`, `summary` match the reviewer's Findings JSON.
- `status`: `open | fixed | accepted | deferred | logged | rejected`.
- `route`: `main | implementer | user`.
- `decision_reason`: required for `accepted`, `deferred` and `rejected`.
- The match key is `sources[0] + rule + file + symbol`; `line` is informational only.
