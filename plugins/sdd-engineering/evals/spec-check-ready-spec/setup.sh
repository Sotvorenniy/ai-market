#!/bin/bash
# A small repository with one approved spec that passes the blocking self-check items.
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
### Non-goals
- NG1 Scheduled or emailed exports.

## User stories
- US1. As a store manager, I want to download orders as CSV, so that I can reconcile them in a spreadsheet.

## Acceptance criteria (EARS)
- AC1 (US1). WHEN a store manager requests the order export, the system shall respond with a CSV file that has one row per order and the columns id, total, createdAt. _(observable: HTTP 200, Content-Type text/csv, row count equals order count)_
- AC2 (US1). WHEN there are no orders, the system shall respond with a CSV file that holds only the header row. _(observable: HTTP 200, body is the header line only)_
- AC3 (US1). IF the requester is not a store manager, THEN the system shall reject the export. _(observable: HTTP 403, no CSV body)_

## Edge cases
- EC1. No orders — covered by AC2.
- EC2. A value contains a comma or a quote — covered by NFR2.

## Non-functional requirements
- NFR1. Performance — an export of 10,000 orders completes in under 2 s at p95 on the dev stack — verify: integration test with seeded data.
- NFR2. Security — every CSV field is quoted and a leading =, +, - or @ is escaped — verify: unit test with a formula-like value.

## Inputs and provenance
| Input | Source | Trusted? | Used in |
|---|---|---|---|
| Order fields | DB | No | CSV body |

## Untrusted inputs
- Order fields — reach the CSV file — threat: CSV formula injection — the system shall escape formula-like values — covered by: NFR2

## Traceability
| AC | Story | Goal | Covers | Verify by |
|---|---|---|---|---|
| AC1 | US1 | G1 | NFR1 | integration |
| AC2 | US1 | G1 | EC1 | integration |
| AC3 | US1 | G1 | — | integration |

## Decisions
- P1 — accepted — CSV only, no XLSX — landed in: NG1

## Open questions
None

## Changelog
- 2026-10-17 — draft created
- 2026-10-17 — approved by the store team
SPEC
