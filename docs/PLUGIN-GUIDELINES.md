# Plugin guidelines

One page for a plugin author: how to name things, which files a plugin must have and what goes into
its manifest. [CONTRIBUTING.md](../CONTRIBUTING.md) covers the process around it (branches, checks,
evals, pull requests); [release-and-rollback.md](release-and-rollback.md) covers versions and releases.

A rule marked **CI** is enforced by the "Marketplace checks" workflow and blocks the merge. The rest is
checked in review.

## Naming

| What | Rule | Example |
|---|---|---|
| Plugin | `kebab-case`, names what it gives you, not who made it. Immutable after the first release: a rename breaks existing installs | `architecture-review`, not `ArchReview` or `team-x-tools` |
| Folder | Same as the plugin name: `plugins/<name>/` | `plugins/research-tools/` |
| Agent | `kebab-case` role noun; file `agents/<name>.md`, frontmatter `name` equal to the file name | `agents/plan-verifier.md` |
| Skill | `kebab-case` topic or verb; folder `skills/<name>/SKILL.md`, frontmatter `name` equal to the folder | `skills/spec-check/SKILL.md` |
| Hook script | `kebab-case` with what it guards and what it does | `scripts/implementer-path-guard.sh` |
| Tag | `<plugin>--v<version>`, created only by `npm run release` | `sdd-engineering--v1.1.1` |
| Reference to another plugin's component | Always namespaced `<plugin>:<component>` | `research-tools:researcher`, `engineering-paved-path:zod` |

Renaming or removing a released agent, skill or command is a breaking change and needs a major version.

## Required structure

```
plugins/<name>/
├── .claude-plugin/plugin.json   required  manifest (see below)
├── README.md                    required  shown on the catalog page
├── CHANGELOG.md                 required  starts with "## [Unreleased]"; input of the release script
├── evals/                       required  claude plugin eval suite (see CONTRIBUTING.md, Evals)
├── agents/<agent>.md            at least one component folder
├── skills/<skill>/SKILL.md
├── hooks/hooks.json             plugin hooks; scripts they call live in scripts/
├── scripts/
├── COMPATIBILITY.md             recommended when the plugin has hooks or dependencies
└── THIRD_PARTY_NOTICES.md       required when the plugin ships third-party content
```

Rules for what is inside:

- **CI** English only: no Cyrillic text anywhere in the repository.
- **CI** No project-specific references and no absolute paths (`/Users/`, `/home/...`) in `plugins/`.
- **CI** No secrets: gitleaks scans the full history, so a secret removed later is still published.
- Everything the plugin uses is inside its folder. No `../`: on install the folder is copied to a
  cache and nothing outside it comes along. Point at own files with `${CLAUDE_PLUGIN_ROOT}` (hooks) or
  `${CLAUDE_SKILL_DIR}` (skills).
- Hooks go in `hooks/hooks.json`. A `hooks:` block in a plugin agent's frontmatter does not run
  ([docs/specs/plugins.md §6](specs/plugins.md)). A hook meant for one agent checks `agent_type` in its
  input and does nothing for everyone else.
- Do not use `${user_config.*}` in agent content: it is not substituted there. Take paths as explicit
  inputs with a default.
- Hook scripts are executable, quote `"${CLAUDE_PLUGIN_ROOT}"`, and fail closed (deny) when a tool they
  need, such as `jq`, is missing. Put their tests in `tests/`.
- An agent lists only the tools it needs in `tools`. A read-only agent gets no `Write`, `Edit` or
  `Bash`; an agent that loads skills gets `Skill`.
- A skill that should run only on request sets `disable-model-invocation: true`.

### README

Written for someone who has never seen the plugin, in this order: what problem it solves, the install
commands, what is inside (a component table), one or two real examples, options and inputs,
requirements (CLI tools, runtimes), and a link to `CHANGELOG.md`. The catalog site renders it as the
plugin page.

### CHANGELOG

[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. Write user-facing notes under
`## [Unreleased]`; the release script turns them into a dated version section. Never edit a released
section except to add release evidence.

### COMPATIBILITY

Which Claude Code versions, dependency versions and external tools each plugin version was tested
with, the Claude Code behaviour it relies on, and known incompatibilities. Update it at every release.
See [plugins/sdd-engineering/COMPATIBILITY.md](../plugins/sdd-engineering/COMPATIBILITY.md) for the
format.

## Manifest: `.claude-plugin/plugin.json`

| Field | Required | Rule |
|---|---|---|
| `name` | yes | The plugin name; equals the folder name |
| `version` | yes | Semver. Start at `0.1.0`; after that only `npm run release` changes it |
| `description` | yes | One sentence: what the plugin gives you, naming its main components. Keep it in sync with the marketplace entry |
| `author` | yes | Object: `{ "name": "<owner>" }` |
| `homepage` | yes | `https://sotvorenniy.github.io/ai-market/#/plugin/<name>` |
| `repository` | yes | A string URL: `https://github.com/Sotvorenniy/ai-market` |
| `keywords` | yes | 3–8 lowercase terms a user would search for |
| `dependencies` | when needed | Array of `{ "name": "<plugin>", "version": "^X.Y.Z" }`. Use a caret range on a released version of a plugin from this marketplace; release the dependency first |

```json
{
  "name": "example-plugin",
  "version": "0.1.0",
  "description": "Read-only example-reviewer agent that checks a diff against the team's example rules.",
  "author": { "name": "your-handle" },
  "homepage": "https://sotvorenniy.github.io/ai-market/#/plugin/example-plugin",
  "repository": "https://github.com/Sotvorenniy/ai-market",
  "keywords": ["review", "agent", "read-only"],
  "dependencies": [{ "name": "engineering-paved-path", "version": "^1.0.0" }]
}
```

**CI** `claude plugin validate plugins/<name> --strict` must pass, and `npm run install-check` must
install the plugin and resolve its dependencies.

## Marketplace entry: `.claude-plugin/marketplace.json`

| Field | Rule |
|---|---|
| `name` | Same as `plugin.json` |
| `source` | `./plugins/<name>` |
| `description` | Same sentence as `plugin.json` |
| `category` | An existing one when it fits: `development`, `productivity` |
| `tags` | 3–6 lowercase terms |

No `version` in the entry: it lives only in `plugin.json`.

## Frontmatter

Agent (`agents/<name>.md`):

```yaml
---
name: example-reviewer
description: Read-only review agent. Use after implementation to ... Never edits files.
model: sonnet          # opus only where a wrong call is expensive
tools: Read, Grep, Glob, Skill
---
```

Skill (`skills/<name>/SKILL.md`):

```yaml
---
name: example-rules
description: "What it covers and when to use it, with the words a user would type. Not for ... (other-skill)."
---
```

The `description` is what Claude matches against a task, so it says when to use the component and,
for neighbouring components, when not to. Changing a description needs its trigger evals rerun.

## Checklist for a new plugin

- [ ] Name is `kebab-case`, free in the catalog, and final.
- [ ] `plugin.json` has every required field; `version` is `0.1.0`.
- [ ] `README.md`, `CHANGELOG.md` with `## [Unreleased]`, and `evals/` with behaviour, negative and trigger cases.
- [ ] Entry in `.claude-plugin/marketplace.json`, owner line in `.github/CODEOWNERS`, row in the
      root README's "Which plugin do I need?" table.
- [ ] `COMPATIBILITY.md` if the plugin has hooks or dependencies.
- [ ] Local checks from [CONTRIBUTING.md](../CONTRIBUTING.md#local-checks) pass.
