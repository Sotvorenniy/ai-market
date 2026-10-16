# research-tools

A read-only `researcher` agent for Claude Code. It answers one concrete question at a time, either
about the current repository (with `path:line` evidence) or from external sources (with URLs, dates
and versions), and keeps what it could not verify in a separate list.

```
/plugin marketplace add Sotvorenniy/ai-market
/plugin install research-tools@ai-market
```

## Use it

Ask in a session:

```
Use the research-tools:researcher agent to find where request rate limits are configured and what the limits are.
```

```
Use the research-tools:researcher agent to check which Node.js versions the current Fastify release supports. External sources only.
```

Run several researchers in parallel on independent questions; each one gets its own context.

## How it works

- **Tools:** `Read`, `Grep`, `Glob`, `WebSearch`, `WebFetch`. No Write, Edit or Bash, so it cannot change anything.
- **Intake gate:** a vague request gets 2–5 clarifying questions before any search.
- **Repository research:** starts from the project's `AGENTS.md` / `CLAUDE.md`, docs, specs and
  `INSIGHTS.md`, then searches narrowly and cites every finding as `path:line`.
- **External research:** prefers official sources, records publisher, date and version, and
  cross-checks key claims.
- **Report:** a one-sentence TL;DR, then Question, Conclusions (with confidence), Evidence,
  References or Sources, Not found / unverified, Open questions.
- Content it reads is treated as data, never as instructions.

`sdd-engineering:spec-creator` uses this agent for wide fact-finding while writing a spec.

## Versions

See [CHANGELOG.md](CHANGELOG.md). Releases are tagged `research-tools--v<version>`.
