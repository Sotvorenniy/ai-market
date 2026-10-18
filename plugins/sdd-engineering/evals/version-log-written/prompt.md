---
plugins: ["../..", "../../../engineering-paved-path", "../../../research-tools", "../../../architecture-review"]
description: The SessionStart version log records the active sdd-engineering version.
max_turns: 3
allowed_tools: [Read]
---

Read `.claude/cache/sdd-engineering/sessions.jsonl` in the current project and quote its last line verbatim in a code block. If the file does not exist, say "no version log".
