---
name: ux-review
version: 1.0.0
description: "UX and accessibility review of a feature's design or behaviour for web applications: the UI state matrix (empty, loading, error, partial, rate-limited, dependency down, long text, many items, first use, stale), Nielsen's usability heuristics, a WCAG 2.2 AA checklist and wording / i18n rules. Produces gaps and improvement proposals as observable requirements, not code. Use this skill whenever you analyse a design source (text, Figma export, screenshots) or an existing screen for missing states, friction, unclear wording or accessibility problems; when writing UX or accessibility NFRs for a spec; or when the user says 'check the UX', 'what states are missing?', 'is this accessible?', 'review this screen' or 'improve this flow'. Does NOT cover where components live (use engineering-paved-path:frontend-ui-architecture), React or hook correctness (use engineering-paved-path:react-best-practices) or visual design taste."
---

# UX review

Find what a design does not say, and turn each finding into a behaviour someone can test.
Output is proposals and requirements, never components or CSS.

Useful when analysing a design while writing a spec (UX proposals, accessibility and i18n
NFRs), and to anyone reviewing a UI diff for missing states.

Project-specific mapping: read the project's AGENTS.md or CLAUDE.md for where routes, shared
UI primitives and translation files live.

Read the reference for the task at hand:

| Task | Read |
|---|---|
| Which states must this screen or action handle? | [references/states.md](references/states.md) |
| Is the flow usable? Friction, feedback, consistency, wording | [references/heuristics.md](references/heuristics.md) |
| Is it accessible? Keyboard, focus, labels, contrast, status messages | [references/wcag.md](references/wcag.md) |

## Method
1. **List the surfaces.** Every page, panel, dialog, popover and async action the feature
   adds or changes. Cite the existing ones as `path:line` (route files, shared components).
2. **Walk the state matrix** for each surface and action (`states.md`). Mark each state as
   shown by the design, covered by existing code, or missing.
3. **Apply the heuristics** to the main flow (`heuristics.md`). Note only concrete problems
   with evidence.
4. **Run the WCAG checklist** on every new interactive element (`wcag.md`).
5. **Check wording and i18n.** If the project is localized, every new user-facing string has
   a key in the project's translation files, following its key convention; nothing inline in
   JSX. Error text says what happened and what the user can do next.
6. **Write findings** in the format below. Rank by impact: blocks the task > causes errors
   > slows the user > cosmetic.

## Finding format
```
P<n>. <surface> — <state / heuristic / WCAG id> — evidence: <design source or `path:line`>
      — proposed behaviour: <one observable sentence, EARS-ready>
```
Example:
```
P3. Report detail, Export button — rate-limited state (states.md) — evidence: no 429 state in
    the design; exports are rate-limited on the server (`src/routes/exports.ts:42`)
    — proposed behaviour: IF the export request returns 429, THEN the page shows the rate-limit
    message with the retry time and keeps the button disabled until then.
```

## Rules
- Reuse before inventing: find the project's existing primitives for empty, error, loading
  and progress states, toasts and confirm dialogs, and cite them. Propose consistency with
  them; do not specify new widgets.
- A finding without evidence is a question, not a proposal.
- Never decide for the user: every finding is a proposal until accepted.
- Model output and user- or third-party-supplied content shown in the UI are untrusted: flag
  rendering of them as a security item (see `engineering-paved-path:security`), not as UX.
