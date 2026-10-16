# Security

A plugin from this marketplace runs on every machine that installs it, with that user's permissions.
This page says what the plugins can do, how we keep that small, and how to report a problem.

## Reporting a vulnerability

Do not open a public issue. Use **Security → Report a vulnerability** on the GitHub repository, or
contact the repository maintainer from [.github/CODEOWNERS](.github/CODEOWNERS) directly.

Include the plugin and version, what an attacker could do, and steps to reproduce. You get an answer
within 3 working days. A confirmed problem is fixed with a release, or the plugin is rolled back or
removed (see [Response](#response)).

## What the plugins can do

| Plugin | Runs code on your machine | Writes files | Network |
|---|---|---|---|
| `engineering-paved-path` | No | No | No |
| `architecture-review` | No | No (agent tools: Read, Grep, Glob, Skill) | No |
| `research-tools` | No | No (agent tools: Read, Grep, Glob) | Yes: `WebSearch` and `WebFetch` for external research |
| `sdd-engineering` | Yes: guard hooks (bash + `jq`) on every Edit, Write and Bash call, and the `engineering-insights` and `workflow-retro` scripts | Yes: specs, plans and code through its agents; retro reports in `.claude/cache/retro/` and the ledger folder | No |

Notes:

- `sdd-engineering` guard hooks run for every Edit, Write and Bash call but act only for the plugin's
  own agents. Without `jq` they fail closed and deny the call.
- `workflow-retro` reads your Claude Code session transcripts (`~/.claude/projects/`) to measure a
  run. Its reports can quote prompts and tool output, so review a ledger file before you commit it.
- No plugin ships an MCP server, a `userConfig` secret, or a download step.

## Rules for contributions

These are enforced in review and, where possible, in CI ([CONTRIBUTING.md](CONTRIBUTING.md)):

- **Least privilege.** An agent lists only the tools it needs in `tools:`. Read-only agents get no
  Edit, Write or Bash.
- **Hooks and scripts get extra review.** Any change under `hooks/` or `scripts/` of a plugin needs
  the plugin owner's approval and must keep `tests/sdd-guards.test.sh` green. Guards fail closed.
- **No secrets, no absolute paths, no `../`.** CI rejects `/Users/...` and `/home/...` in plugins.
- **No downloads at runtime.** Scripts do not fetch and run code from the network.
- **Third-party content** keeps its license and is listed in the plugin's `THIRD_PARTY_NOTICES.md`.
- **Releases only through `npm run release`**, so every version a user receives has passed
  `claude plugin validate --strict` and has a tag to roll back to.

## Response

| Severity | Action |
|---|---|
| A plugin can run, write or send something the user did not ask for | Remove it from the catalog at once ([emergency removal](docs/release-and-rollback.md#emergency-removal)), then fix |
| A released version is broken or unsafe, an earlier one is fine | [Roll back](docs/release-and-rollback.md#rollback) to the last good release |
| Hardening, defence in depth | Normal pull request and release |

## Supported versions

Only the latest release of each plugin gets fixes. Older versions are not patched: update with
`/plugin update <plugin>@ai-market`.
