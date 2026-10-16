# UI state matrix

Walk every row for each surface (page, panel, dialog, popover) and each async action
(import, export, save, sync). A state the design does not show is a gap.

| State | Question to answer | Typical expected behaviour |
|---|---|---|
| Empty — first use | What does the user see before any data exists? | an empty state with one sentence and the primary action |
| Empty — filtered | What if a filter or search matches nothing? | say the filter matched nothing; offer "clear filters" |
| Loading — first load | What shows while data loads? | a skeleton in the final layout shape; no layout jump |
| Loading — refresh | What shows when data reloads in the background? | keep old data visible; a small, non-blocking indicator |
| In progress — long action | Imports, exports, generation, sync: what shows while it runs? | progress or a live log, a way to leave and come back, no double start |
| Success | How does the user know it worked? | visible result or toast; focus moves to the result if the view changed |
| Error — recoverable | Network error, 5xx, timeout | an error state or inline error with what happened and a retry |
| Error — validation | Bad input | message next to the field, linked to it; input kept |
| Rate-limited (429) | Which actions are rate-limited, and at what limits? | say it is a limit, show when to retry, disable the action until then |
| Dependency down | Third-party API, model provider or database unavailable | degraded result with the reason, or an error that names the dependency |
| No API key / not configured | Feature needs a secret or setting the user has not set | explain and link to the settings section; no stack trace |
| Partial data | Some items or sub-requests failed | show what succeeded and list what failed |
| Not found | Deleted item; stale link | a not-found page with a way back |
| Long content | Long titles, paths, descriptions, model output | truncation with full text available (tooltip or expand); no overflow or clipping |
| Many items | hundreds or thousands of rows | paging or virtualisation, sorting, filter; stated limit |
| Stale data | Data changed in another system or another tab | show the last update time or refresh on focus; resolve conflicts on save |
| Concurrency | Double click, two tabs, run while a run is active | one effect only; the second attempt is disabled or told why |
| Destructive action | Delete an item, revoke access | a confirm dialog naming the object; undo when possible |
| Unsaved changes | Leaving an editor with edits | warn before losing input |
| Narrow viewport | Small window or zoom 200% | content reflows; nothing hidden behind horizontal scroll |

## Per async action, always state
- the trigger and who may start it;
- what is disabled while it runs;
- the success signal;
- each failure signal (validation, 4xx, 429, 5xx, timeout, dependency down);
- whether it is safe to retry, and what a retry does.
