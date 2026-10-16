---
name: engineering-insights
description: >-
  Reads and maintains the per-package INSIGHTS.md knowledge files. Use at the
  start of work on any package — before editing, debugging, or answering a
  question about it — to recall what previous sessions learned about that
  module. Use again when a session surfaces something non-obvious (a trap, a
  dead end, a fixed recurring error, a dependency quirk, an architectural
  decision with its reason) and when wrapping up a task, to record it. Also use
  when the user runs /sdd-engineering:engineering-insights.
---

# Engineering insights

A knowledge loop over the `INSIGHTS.md` files. Three phases: **recall** before
work, **capture** during, **flush** at the end.

One invariant governs everything: **an existing insight is never removed.**
Entries may be added and enriched. Nothing already written is deleted, shortened,
reworded or reordered. See *Write safety*.

Paths below are relative to the repository root. Run the scripts from inside the
project; they live in this skill's folder, `${CLAUDE_SKILL_DIR}/scripts/`.

**The convention.** A project keeps one optional `INSIGHTS.md` at the root (for
cross-package knowledge) and one per package (`<pkg>/INSIGHTS.md`), where a
package is whatever the project treats as one: a workspace package, an app, a
service folder. If the project has no `INSIGHTS.md` yet, say so in Phase 0 and
continue; the first flush that records something creates the file with the
seven section headings below. The project's `AGENTS.md` / `CLAUDE.md` may route
to these files; when it does, follow its layout.

---

## Phase 0 — Recall (before work)

Run this before editing, debugging, or answering a question about a package.

1. Identify the package the request touches — or root, if it spans several.
   To see which packages keep insights, run
   `bash "${CLAUDE_SKILL_DIR}/scripts/find-related.sh" --list`.
2. Read that package's `INSIGHTS.md` **and** the root `INSIGHTS.md`, when they
   exist.
3. State in one line which entries bear on the task, or "no recorded insights
   apply". Name them; do not recite the file. Naming is what forces the content
   to be processed rather than skimmed, and it shows the read happened.
4. Treat named entries as high-confidence guidance unless the user says
   otherwise or the code visibly contradicts them.

An entry that turns out to be wrong is itself a finding — supersede it in
Phase 2. Do not silently work around it.

## Phase 1 — Capture (during)

Note a finding the moment it lands, not from memory at the end.

Append candidates to a session buffer in the scratchpad directory, **not** to the
repo. Capturing straight into `INSIGHTS.md` mid-task drops doc edits into
whatever diff the developer is about to commit.

A candidate is worth buffering when it passes the five gates below.

## Phase 2 — Flush (end of task, or on `/sdd-engineering:engineering-insights`)

### Step 1 — depth check

Estimate session depth from concrete signals: several tasks, user corrections,
errors and retries, abandoned approaches. A shallow session — a config tweak, a
rename, a change that went exactly as expected — **stops here and records
nothing**.

The default outcome of a flush is zero entries. Never manufacture an entry to
look productive. Padding is how these files turn into noise nobody reads.

### Step 2 — rank and cap

Order candidates by signal strength:

1. User corrections — the developer saying the agent was wrong
2. Approaches that failed or were abandoned
3. Patterns that repeated across the session
4. Error → fix sequences

**Keep at most five.** The cap is the quality mechanism: forced ranking drops
the marginal ones. The top two categories feed *What Doesn't Work*, which is the
most valuable and most-skipped section.

### Step 3 — dedup (blocking)

Before touching any file, for each surviving candidate:

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/find-related.sh" <pkg-dir|root> "<key terms>"
```

`<pkg-dir>` is the package directory relative to the repository root (for
example `api` or `packages/web`). It searches the package file and the root file
and prints matching headings with line numbers.

| Situation | Action |
|---|---|
| No related entry | Add under the right section |
| Related entry, still correct | Enrich it — append detail, never a near-duplicate |
| Related entry, now wrong | Append a dated correction beneath it |
| Already stated in an `AGENTS.md` or `README.md` | Drop the candidate |
| Overlap is ambiguous | Drop the candidate — the default is silence |

"Drop" always means *discard the new candidate*. It never means remove something
already in the file.

### Step 4 — one approval

Ask once, with a single `AskUserQuestion`, multi-select, listing the surviving
candidates. Each option carries **the exact proposed entry text**, not a title,
so it can be judged by reading the option rather than opening a file.

That multi-select is the approval. Do not re-confirm per entry.

### Step 5 — record, then confirm

Snapshot, append, verify (see *Write safety*), then report one line per
candidate: `added <heading>` · `enriched <heading>` · `skipped, already covered`.

---

## Write safety

An `INSIGHTS.md` holds knowledge that cannot be reconstructed. A bad edit costs
more than every entry this skill will ever add.

**The four permitted operations. Anything else is a bug:**

1. Append a new entry under an existing section.
2. Append lines to an existing entry — more detail, sharper evidence, a better
   `path:line`.
3. Append a dated correction beneath an existing entry.
4. Append a missing section heading from the seven-section schema (and, for a
   file that does not exist yet, create it with the seven headings — the only
   time `Write` is acceptable).

**Forbidden:** deleting an entry, line or section; shortening or rewording
existing text; reordering entries; reflowing or reformatting the file. Enriching
means *adding to*. An entry only ever grows.

**Never use the `Write` tool on an existing `INSIGHTS.md`.** It replaces the file
wholesale and is the likeliest way to lose entries. Use `Edit`, with
append-shaped changes only.

**Every edit must produce zero deleted lines.** Enforce it:

```bash
# before editing
bash "${CLAUDE_SKILL_DIR}/scripts/verify-append-only.sh" snapshot <file>
# after editing
bash "${CLAUDE_SKILL_DIR}/scripts/verify-append-only.sh" check <file>
```

`check` restores the file from the snapshot if any line or heading disappeared,
and reports the violation. It restores from the snapshot rather than from git on
purpose: the developer may have their own uncommitted edits in that file, and a
git revert would destroy those too.

---

## The five quality gates

An entry must be actionable **cold** — read it in a fresh session and know what
to do, with no follow-up. All five must hold:

1. **Non-obvious** — a competent developer reading the code would not conclude
   it in a minute. *If it would be obvious to anyone reading the code, don't
   write it.*
2. **Verified this session** — observed, not inferred. No "might be", no "if not
   already handled".
3. **Actionable cold** — names the symptom, the threshold or number, the file or
   module, and what to do instead.
4. **Evidenced** — at least one `path:line`, command, or exact error string.
5. **Durable** — still true next month. "The build is red right now" is not an
   insight.

Gate 4 is the one that keeps these files honest: a claim without a real
`path:line` or exact output cannot be checked by the next session, so it is not
recorded.

See `examples.md` for calibrated good/bad pairs and two worked dedup cases.

## Which file

| The insight is about | Goes to |
|---|---|
| One package's code, tests or build | `<pkg>/INSIGHTS.md` |
| Two or more packages | `INSIGHTS.md` (root) |
| Copies of a shared contract drifting between packages | `INSIGHTS.md` (root) — it is a contract |
| Local infrastructure (containers, databases, dev scripts), CI | `INSIGHTS.md` (root) |

A project with a single package keeps only the root file.

## Sections

Every `INSIGHTS.md` carries these seven, in this order. Place each entry under
the one that fits:

`What Works` · `What Doesn't Work` · `Codebase Patterns` ·
`Tool & Library Notes` · `Recurring Errors & Fixes` · `Session Notes` ·
`Open Questions`

*What Doesn't Work* is the most-skipped and the most valuable. Never drop it.
*Session Notes* entries are capped at two lines — it is the section most likely
to bloat into a chat replay.

## Entry format

```markdown
### Import validator silently drops rows with an unknown currency code
`2026-09-25` — A row whose `currency` is not in the allow-list is removed
before the totals are computed, so an import shows fewer rows than the file
held, with no warning in the response or the logs. Check the validator before
blaming the parser.
Evidence: `src/imports/validate.ts:41`
```

The H3 is a **claim**, not a topic — never just "Validation". Phase 0 reads the
whole file every session, so headings must be scannable without reading bodies.

Hard-wrap at 80 columns, unless the project's docs use another convention.

## Never record

- Secrets, tokens, `.env` values
- The user's name or email
- Absolute paths from a developer's machine (home directories, temp folders)
- Anything learned from git-ignored runtime data (checkouts, caches, build
  output) — it is not part of the code base
- Speculation, or anything already stated in an `AGENTS.md` or `README.md`
- Learnings about this skill itself — those belong in the skill, not in
  `INSIGHTS.md`

## Maintenance

- **Append-only.** Supersede with a dated correction; never rewrite.
- **Promote** — when an insight hardens into a rule binding every change, copy
  it into that package's `AGENTS.md` under `## Conventions (not obvious from
  code)` as one line, and append a pointer to the original entry. Do not remove
  the entry; promotion without a pointer is a deletion in disguise.
- **Soft cap ~40 entries per file.** Phase 0 reads the whole file every session,
  so length is a running cost. Past the cap, report and list prune-or-split
  candidates — never prune. Deletion is the developer's call, in a normal commit.

## Gotchas

- **Auto-activation is unreliable.** This skill fires from its description,
  which works sometimes. If the loop matters for a session, invoke
  the skill explicitly (`/sdd-engineering:engineering-insights`). A Stop hook makes it dependable; see
  `references.md`.
- **The scratchpad buffer dies with the session.** An uncaptured finding is
  lost. Flush before reporting a task complete, not after.
- **Enriching an entry is still an append.** Add a line beneath it. Do not
  rewrite the original sentence to fold the new detail in — that deletes text
  and trips the append-only check.
- **Empty section headings are not entries.** A file with all seven headings and
  no `###` beneath them is still empty; do not report it as having content.
- **Root vs package is decided by the insight, not by the file you edited.** A
  change made only in one package can still be a root insight if the reason spans
  packages.