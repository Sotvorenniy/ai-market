#!/bin/bash
# A small repository with a spec that is marked approved but has blocking gaps.
set -euo pipefail
mkdir -p src specs
cat > src/orders.ts <<'EOF'
export type Order = { id: string; total: number; createdAt: string };

export async function listOrders(): Promise<Order[]> {
  return [];
}
EOF
cat > specs/2026-10-17-order-export.md <<'SPEC'
# Spec: Order export
Spec ID: SPEC-01
Status: approved
Supersedes: None
Modules: orders

## Problem and user
Store managers reconcile orders in a spreadsheet. Today orders can only be listed (`src/orders.ts:3`), so they copy rows by hand.

## Goals / Non-goals
### Goals
- G1 A store manager can download all orders as a CSV file.
- G2 Exports never leak orders of another store.
### Non-goals
- NG1 Scheduled or emailed exports.

## User stories
- US1. As a store manager, I want to download orders as CSV, so that I can reconcile them in a spreadsheet.
- US2. As an auditor, I want to filter the export by date, so that I can check one month.

## Acceptance criteria (EARS)
- AC1 (US1). WHEN a store manager requests the order export, the system shall quickly respond with a user-friendly CSV file. _(observable: HTTP 200)_
- AC2 (US1). WHEN there are no orders, the system shall respond with [NEEDS CLARIFICATION: empty file or header row only?].

## Edge cases
- EC1. No orders — covered by AC2.

## Non-functional requirements
- NFR1. Performance — the export is fast — verify: manual.

## Inputs and provenance
| Input | Source | Trusted? | Used in |
|---|---|---|---|
| Order fields | DB | No | CSV body |

## Untrusted inputs
None

## Traceability
| AC | Story | Goal | Covers | Verify by |
|---|---|---|---|---|
| AC1 | US1 | G1 | NFR1 | integration |
| AC2 | US1 | G1 | EC1 | integration |

## Decisions
None

## Open questions
- OQ1. Empty export: empty file or header row only? — category: C3 — owner: user — blocks: AC2 — marker: AC2

## Changelog
- 2026-10-17 — draft created
SPEC
