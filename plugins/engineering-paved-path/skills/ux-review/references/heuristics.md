# Usability heuristics (Nielsen), applied

Report only concrete problems with evidence. Each problem becomes a proposal.

| # | Heuristic | Look for |
|---|---|---|
| 1 | Visibility of system status | Long jobs (imports, exports, generation, sync) take seconds to minutes: is progress shown (log, progress bar)? Does a list show which items have a running or finished job? |
| 2 | Match with the real world | Use the words users know from their domain; avoid internal names (module names, table names, `snake_case` identifiers). |
| 3 | User control and freedom | Can a running job be cancelled or left? Can a destructive action be undone, or is it confirmed? Can the user leave a drawer or dialog with Escape? |
| 4 | Consistency and standards | Same status colours and badges everywhere; same empty, error and loading primitives; same position for primary actions. |
| 5 | Error prevention | Disable an action until its prerequisites (configuration, required input) are met; validate before save; confirm deletes; block double submits. |
| 6 | Recognition rather than recall | Show where a result came from (source, author, time); show context next to an item; keep filters visible. |
| 7 | Flexibility and efficiency | Keyboard shortcuts for frequent actions; deep links to every detail view; remembered filters. |
| 8 | Aesthetic and minimalist design | Primary content first, metadata on demand; no duplicated information; secondary numbers only where they help a decision. |
| 9 | Recognise, diagnose, recover from errors | Error text names the cause (rate limit, missing configuration, third-party service down) and the next step; never a raw stack trace or raw model output. |
| 10 | Help and documentation | First-use hints on empty states; link to settings when configuration is missing; tooltips for scores and other derived values. |

## Wording rules
- Say what happened, then what to do: "Export limit reached. Try again in 40 s."
- Buttons are verbs that name the result: "Export report", "Import file", not "OK".
- Same term for the same thing on every screen (pick one of issue/comment/note and keep it).
- Numbers carry units and enough precision to be true (a cheap run is not "$0.00").
- In a localized app, every string has a key in the project's translation files.
