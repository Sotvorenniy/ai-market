# EARS acceptance criteria

EARS (Easy Approach to Requirements Syntax) gives every requirement one of five shapes.
Keywords are in capitals; `(shall)` marks a mandatory requirement.

| Pattern | Form | Use when |
|---|---|---|
| Ubiquitous | The system (shall) <response>. | always true, no trigger |
| Event-driven | WHEN <trigger>, the system (shall) <response>. | a user action or an event starts it |
| State-driven | WHILE <state>, the system (shall) <response>. | true for as long as a state holds |
| Unwanted behaviour | IF <unwanted condition>, THEN the system (shall) <response>. | failures, invalid input, limits hit |
| Optional feature | WHERE <feature is enabled>, the system (shall) <response>. | config flags, optional capabilities |

Patterns may combine once: `WHILE <state>, WHEN <trigger>, the system (shall) <response>.`
More than one combination means the AC must be split.

## Line format
```
- AC<n> (US<n>). <EARS sentence> _(observable: <what a test or a person sees>)_
```
The `_(observable: ...)_` hint is mandatory: the test asserts it and `plan-verifier`
checks it.
"the system" may be narrowed to the module that owns the response: "the API", "the order
detail page", "the CLI", "the worker".

## Testability rules
1. **One trigger, one response.** "and" in the response usually means two ACs.
2. **Observable result.** Name what a test can see: HTTP status and body field, a UI state
   or text (by i18n key), a stored value, a log line (level and fields), an order, a count.
3. **Thresholds, not adjectives.** Replace "fast", "large", "many", "normal",
   "user-friendly", "gracefully", "appropriate", "etc." with a number or a concrete rule.
4. **No hidden how.** "Uses a queue", "via a React context", "with a database transaction"
   are implementation. State the effect: "two concurrent requests produce one export job".
5. **Negative space.** Unwanted behaviour ACs say what must *not* happen as well as what
   does: "IF the upstream call fails, THEN the API (shall) return 502 with `error.code`
   `upstream_unavailable` and (shall) store no partial result."
6. **Linked.** Every AC names its user story; every user story has at least one AC.
7. **Unknown stays marked.** When a threshold, wording or behaviour is not settled, keep
   the AC and write `[NEEDS CLARIFICATION: <question>]` where the value belongs, with a
   matching "Open questions" entry. Never replace it with a guessed number.

## Vague → testable

| Vague | Testable |
|---|---|
| "Must work well on large data sets" | WHEN a list holds more than 1,000 items, the API (shall) return it in pages of at most 100 items. |
| "Must not crash if the recommender is down" | IF the recommendation call fails, THEN the product page (shall) show the product without the recommendations block and log the failure reason. |
| "Should suggest what to do first" | The dashboard (shall) order open tasks by due date, earliest first. |
| "Handle rate limits gracefully" | IF the export endpoint returns 429, THEN the export page (shall) show the rate-limit message with the retry time and keep the export button disabled until then. |
| "Show progress" | WHILE an import is in progress, the import page (shall) show each processed row count within 2 s of the server emitting it. |
| "Do not leak secrets" | The API (shall) never include a secret value in a response body or a log line. |

## Common mistakes
- Compound: "WHEN the user clicks Export, the system shall start an export and show a toast
  and disable the button." → three ACs.
- Untestable trigger: "WHEN appropriate" / "WHEN needed".
- Passive with no actor: "The export shall be stored." → who stores it, when, observable how?
- Design restated: "The button shall be blue." → only if the colour is the requirement
  (for example a contrast threshold); otherwise it belongs to the design source.
- Test steps disguised as ACs: "Open page, click X, check Y." → state the behaviour.

## Verify by (test lane)
Each AC gets the lowest lane that can observe its result. When the project's testing docs (or
its `AGENTS.md` / `CLAUDE.md`) define their own lanes or suites, use those names; otherwise
use these generic lanes:

| Lane | Observes |
|---|---|
| `unit` | pure logic, validation, error mapping, component rendering and UI states in isolation; no real DB or network |
| `integration` | DB effects, migrations, routes or modules wired together against real dependencies |
| `e2e` | a full user journey across the deployed parts of the system |
| `manual` | only with a reason (for example the visual quality of a generated answer) |

A lane may be qualified by package when the project has several (for example `unit (api)`).

An AC that only `manual` can verify is a smell: try to rewrite it with an observable result.
