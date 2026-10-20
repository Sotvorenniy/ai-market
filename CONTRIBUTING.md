# Contributing to ai-market

Thanks for helping. This guide covers how to change the catalog safely: every merged change can end up
on many people's machines, so a few rules matter more here than in a normal codebase.

Writing a plugin? [docs/PLUGIN-GUIDELINES.md](docs/PLUGIN-GUIDELINES.md) has naming, the required
structure and the manifest fields in one place.

## Before you start

You need Node 20+, `jq` and the Claude Code CLI (`claude`). There are no npm dependencies to install.

If you are not sure whether something belongs in the marketplace, open an issue first and describe the
problem it solves.

## Rules

- **English only.** Docs, code, comments and data. CI rejects Cyrillic text.
- **Names are forever.** Plugin and component names are `kebab-case`. After publication a plugin's
  `name` is effectively immutable: renaming breaks existing installs.
- **No secrets, no absolute paths.** No credentials, tokens, `/Users/...` or `/home/...` in plugins.
  Use `${CLAUDE_PLUGIN_ROOT}` to point at files inside the plugin.
- **Stay inside the plugin folder.** No `../` references: on install the plugin is copied into a cache
  and files outside its folder are not copied.
- **Stay project-independent.** Plugins must not mention a specific product, repository or person.
  See [docs/specs/plugins.md](docs/specs/plugins.md).
- **Use namespaces for dependencies.** Refer to a component from another plugin with its plugin name,
  for example `research-tools:researcher`, not bare `researcher`.
- **Do not bump versions by hand.** Versions change only through `npm run release`.

## Change an existing plugin

1. Branch from `main`.
2. Make the change in `plugins/<name>/`.
3. Describe it for users under `## [Unreleased]` in `plugins/<name>/CHANGELOG.md`.
4. Run the [local checks](#local-checks) and open a pull request to `main`.

You do not need to edit `.claude-plugin/marketplace.json` unless the plugin's description, category or
tags change.

After the merge, a maintainer releases the plugin. Users get your change only after that release,
because Claude Code updates a plugin only when its version changes. See
[docs/release-and-rollback.md](docs/release-and-rollback.md).

## Add a new plugin

1. Create the folder:

   ```
   plugins/<name>/
   ├── .claude-plugin/plugin.json   manifest
   ├── agents/  skills/  hooks/     whatever the plugin ships
   ├── README.md                    what it does, how to install and use it
   └── CHANGELOG.md                 starts with a ## [Unreleased] section
   ```

   See [docs/PLUGIN-GUIDELINES.md](docs/PLUGIN-GUIDELINES.md) for the full layout, including `evals/`
   and `COMPATIBILITY.md`.

2. Fill in `plugin.json`: `name`, `version` (`0.1.0`), `description`, `author`, `homepage`
   (`https://sotvorenniy.github.io/ai-market/#/plugin/<name>`), `repository` (a string URL) and
   `keywords`. Declare other plugins it needs under `dependencies`.
3. Add an entry to `.claude-plugin/marketplace.json` with `name`, `source`, `description`, `category`
   and `tags`. No `version` here: it lives only in `plugin.json`.
4. Add an owner line to [.github/CODEOWNERS](.github/CODEOWNERS): `/plugins/<name>/ @your-handle`.
5. Add the plugin to the "Which plugin do I need?" table in [README.md](README.md).

Write the plugin README for a person who has never seen it: what problem it solves, the install
commands, one or two real examples of using it, and its requirements.

## Local checks

Run these before opening a pull request. CI runs the same checks and blocks the merge if one fails.

```bash
claude plugin validate . --strict                 # the catalog
claude plugin validate plugins/<name> --strict    # each plugin you changed
bash tests/sdd-guards.test.sh                     # guard hooks
npm test                                          # catalog website
npm run install-check                             # every plugin installs and its dependencies resolve
npm run install-check -- Sotvorenniy/ai-market#stable   # the same from GitHub (needs full history and tags)
```

To try a plugin before it is merged, add your local checkout as a marketplace:

```
/plugin marketplace add ./path/to/ai-market
/plugin install <name>@ai-market
```

To see how it looks in the catalog website, run `npm run dev` and open http://localhost:4173.

## Evals

Every plugin has an eval suite in `plugins/<name>/evals/` (`claude plugin eval` format). A change to an
agent, skill or description needs its evals green; a new behaviour needs a new case. Evals run real
Claude sessions and cost tokens, so CI does not run them: run them yourself and put the result in the
pull request.

```bash
npm run eval -- <name> --runs 1 --max-cost-usd 2 --scaffold --trust-plugin   # quick check
npm run eval -- <name> --scaffold --trust-plugin                             # 3 runs per case, before a release
```

Use `npm run eval`, not `claude plugin eval plugins/<name>`: the latter loads only the plugin's own
folder, so a plugin with dependencies does not load and its cases pass or fail for the wrong reason.
Each case lists the plugins it needs in `plugins:` (the plugin itself is `../..`).

A suite has three kinds of cases:

- **Behaviour**: the agent or skill does its job on a small fixture (a diff in the prompt, or files
  written by a `setup.sh` scaffold). Grade the result with an `llm` grader and check that the plugin's
  own agent ran with `tool_used` + `arm: both`, so an answer from the bare model does not pass.
- **Negative** (`tags: [negative]`): the plugin stays out of unrelated tasks (`tool_used`, `max: 0`)
  and does not invent findings or answers it has no evidence for.
- **Trigger** (`tags: [trigger]`): a skill loads on its own for a task in its area when the prompt
  does not name it. These guard skill descriptions; rerun them whenever you change one.

## Pull requests

- Keep one plugin or one topic per pull request.
- In the description, say what changes for users and how you tested it.
- The plugin's owner from [.github/CODEOWNERS](.github/CODEOWNERS) reviews it. Adding a new plugin to
  the catalog is approved by the repository maintainer.
