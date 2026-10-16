# ai-market

**ai-market** is a Claude Code plugin marketplace: a catalog you add to Claude Code once, then install
shared plugins from. The plugins package our engineering standards, review agents and a Spec Driven
Development workflow, so every team gets the same skills and agents instead of copying prompts around.

**Browse the catalog:** https://sotvorenniy.github.io/ai-market/

## Quick start

1. Add the marketplace (once per machine), in a Claude Code session:

   ```
   /plugin marketplace add Sotvorenniy/ai-market
   ```

2. Install the plugin you need:

   ```
   /plugin install sdd-engineering@ai-market
   ```

   `sdd-engineering` is the plugin name, `ai-market` is the catalog name. Plugins that depend on others
   install them for you.

3. Restart Claude Code or run `/reload-plugins`, then check `/plugin` to see what is installed.

## Which plugin do I need?

| I want to… | Install | What you get |
|---|---|---|
| Follow the team's standards for React, Fastify, architecture, testing, security, Zod, Drizzle and PostgreSQL | [`engineering-paved-path`](plugins/engineering-paved-path) | 10 skills that Claude loads automatically when your task touches their area |
| Get a second opinion on whether a change breaks layering, code placement or contracts | [`architecture-review`](plugins/architecture-review) | A read-only `architecture-reviewer` agent |
| Ask questions about a codebase or a library and get answers with evidence | [`research-tools`](plugins/research-tools) | A read-only `researcher` agent that cites `path:line` and URLs |
| Go from an idea to a reviewed PR through spec, plan, implementation and verification | [`sdd-engineering`](plugins/sdd-engineering) | Spec, planner, implementer and verifier agents, the `run-plan` skill and guard hooks |

How they fit together:

```
engineering-paved-path   standards (skills)
        ▲
architecture-review      research-tools      agents
        ▲                       ▲
        └──── sdd-engineering ──┘            workflow
```

Each layer works on its own. `sdd-engineering` installs the other three as dependencies. Every plugin
folder has a README with usage examples and a CHANGELOG.

## Keeping up to date

There are two different updates:

| Command | What it does |
|---|---|
| `/plugin marketplace update ai-market` | Refreshes the **catalog**: the list of plugins and their latest versions |
| `/plugin update <plugin>@ai-market` | Updates an **installed plugin** to its latest version |

Refreshing the catalog does not update installed plugins by itself. A plugin changes for users only when
its version is released, so merged but unreleased changes do not reach anyone yet.

## Something went wrong

| Problem | Try |
|---|---|
| `/plugin install` cannot find the plugin | `/plugin marketplace update ai-market`, then install again |
| Skills or agents do not show up after install | Restart Claude Code or run `/reload-plugins` |
| `sdd-engineering` guard hooks deny every call | Install `jq`: the guards need it |
| A new plugin version is broken | Tell the plugin's owner from [.github/CODEOWNERS](.github/CODEOWNERS); maintainers can roll back, see [docs/release-and-rollback.md](docs/release-and-rollback.md) |

## Contributing

Want to change a plugin or add a new one? Read [CONTRIBUTING.md](CONTRIBUTING.md).

## Repository layout

```
.claude-plugin/marketplace.json   the catalog: one entry per plugin
plugins/<name>/                   each plugin: manifest, agents, skills, hooks, evals, README, CHANGELOG
catalog/                          the catalog website (GitHub Pages), see catalog/README.md
scripts/                          release and rollback helpers
tests/                            guard hook tests for sdd-engineering
docs/                             release process, plugin spec
.github/                          CI workflows, CODEOWNERS
```
