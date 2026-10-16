# Marketplace Research (temporary)

> Temporary working notes. Delete this folder once the marketplace and its first plugin are in place.
> Compiled 2026-10-16 from the official Claude Code docs and from public marketplace repositories.
> Minimum CLI versions and GitHub issue numbers were collected by research agents; re-check them before relying on them.

## 1. What a marketplace is

A marketplace is a git repository (or directory) with a catalog file at `.claude-plugin/marketplace.json`.
The catalog lists plugins and says where to fetch each one. It is not a hosted store; the repo can be private.

```
ai-market/                         # marketplace root (contains .claude-plugin/)
├── .claude-plugin/marketplace.json
└── plugins/<plugin>/
    ├── .claude-plugin/plugin.json # only plugin.json lives in .claude-plugin/
    ├── skills/<skill>/SKILL.md
    ├── agents/*.md
    ├── commands/*.md              # prefer skills for new work
    ├── hooks/hooks.json           # requires the {"hooks": {...}} wrapper
    ├── .mcp.json
    └── .lsp.json
```

## 2. marketplace.json

Required: `name`, `owner.name`, `plugins[]`. Each plugin entry requires `name` and `source`.

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "ai-market",
  "description": "Plugins for our team",
  "owner": { "name": "Team name", "email": "team@example.com" },
  "plugins": [
    {
      "name": "code-review",
      "source": "./plugins/code-review",
      "description": "Review pull requests against our checklist",
      "category": "development",
      "tags": ["review", "pull-request"]
    }
  ]
}
```

Useful top-level fields:
- `description`, `version` (or `metadata.description`, `metadata.version`).
- `metadata.pluginRoot` – lets `source` be a bare plugin name (v2.1.239+).
- `renames` – `{ "old-name": "new-name" }` or `{ "old-name": null }` for removals. Keep it append-only.
- `forceRemoveDeletedPlugins` – uninstall plugins on users' machines when they disappear from the catalog.
- `allowCrossMarketplaceDependenciesOn` – allow dependencies on plugins from other marketplaces.

Entry fields: `name`, `source`, `description`, `version`, `category`, `tags`, `strict`, `displayName`,
`defaultEnabled`, `dependencies`, `relevance`, `metadata`, `headers`, `headersHelper`, plus display fields
(`author`, `homepage`, `repository`, `license`, `keywords`) and component overrides
(`commands`, `agents`, `skills`, `hooks`, `outputStyles`).

### Source types

| Type | Example | Notes |
|---|---|---|
| Relative path | `"./plugins/formatter"` | Must start with `./`, no `..`, forward slashes only |
| `github` | `{"source":"github","repo":"org/repo","ref":"v2.0.0","sha":"<40 hex>"}` | `ref`/`sha` optional |
| `url` | `{"source":"url","url":"https://host/repo.git"}` | Any git URL |
| `git-subdir` | `{"source":"git-subdir","url":"org/repo","path":"tools/x"}` | Sparse checkout of one folder |
| `npm` | `{"source":"npm","package":"@org/x","version":"^2.0.0"}` | Install scripts do not run |
| `archive` | `{"source":"archive","url":"https://.../x.zip","sha256":"..."}` | HTTPS zip |
| `command` | `{"source":"command","command":"..."}` | Runs a command on the user's machine |

A marketplace added from a URL to `marketplace.json` only downloads that file, so relative-path entries fail there.

### strict mode

- No `plugin.json`: the marketplace entry is the manifest.
- `strict: true` (default) with `plugin.json`: `plugin.json` wins; entry components are appended.
- `strict: false` with `plugin.json` and entry components: load error "conflicting manifests".
- Entry `hooks` given as a file path passes validation but never runs. Use an inline object or put hooks in the plugin.

### Naming

- Characters `[A-Za-z0-9._-]`, start with a letter or digit. Kebab-case recommended.
- Plugin names starting with `claude-`, `anthropic-`, `cc-plugin-` are errors.
- Reserved marketplace names include `claude-plugins-official`, `agent-skills`, `anthropic-plugins`,
  `github`, `npm`, `gh`, `inline`, `builtin`, `skills-dir`, any `claudeai-*`, and non-ASCII names.
- The install id is `<plugin>@<marketplace name>`. The marketplace name comes from `marketplace.json`, not the repo name.
- Keep the entry `name` identical to the `plugin.json` `name`. A mismatch gives `Plugin "<x>" not found in marketplace`.
- Treat plugin names as immutable. Change labels with `displayName`; use `renames` when a rename is unavoidable.

## 3. plugin.json

Only `name` is required.

```json
{
  "name": "code-review",
  "version": "1.2.0",
  "description": "Review pull requests against our checklist",
  "author": { "name": "Team name" },
  "license": "MIT",
  "keywords": ["review"]
}
```

- `commands`, `agents`, `outputStyles`, `workflows` in the manifest replace the default folder scan.
  `skills` adds to it. `hooks`, `mcpServers`, `lspServers` merge with their default files.
- Component paths must start with `./` and stay inside the plugin.
- `CLAUDE.md` at the plugin root is not loaded. Put instructions in skills.
- A top-level `bin/` folder is rejected by claude.ai org sync and Cowork. Use `scripts/`.
- `userConfig` with `sensitive: true` stores secrets in the OS keychain.

Variables:
- `${CLAUDE_PLUGIN_ROOT}` – installed plugin path; changes on every update.
- `${CLAUDE_PLUGIN_DATA}` – persistent data folder, kept across updates.
- `${CLAUDE_PROJECT_DIR}` – project root.
- `${user_config.KEY}` – user-provided options (MCP/LSP config, exec-form hook args, skill content).
- `CLAUDE_PLUGIN_OPTION_<KEY>` – the same options as env vars for shell-form hooks.

Quote paths in shell-form hooks: `"\"${CLAUDE_PLUGIN_ROOT}\"/scripts/format.sh"`.

## 4. Installing and distributing

```bash
claude plugin validate .                       # validate marketplace root
claude plugin validate ./plugins/code-review   # validate a plugin (root validation does not open plugin files)
claude plugin marketplace add your-org/ai-market
claude plugin install code-review@ai-market [--scope user|project|local]
claude plugin marketplace update ai-market
claude plugin update code-review@ai-market
```

In a session: `/plugin marketplace add`, `/plugin install`, `/reload-plugins`.

Team rollout through a committed `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "ai-market": { "source": { "source": "github", "repo": "your-org/ai-market" } }
  },
  "enabledPlugins": { "code-review@ai-market": true }
}
```

- Applies only after the user accepts the folder trust dialog. Ignored in cloud sessions.
- Relative-path plugins load from the marketplace copy; externally sourced plugins still need
  `claude plugin install <name>@ai-market --scope project` on each machine.

Organization-wide rollout uses managed settings: `extraKnownMarketplaces` with `"autoUpdate": true`,
`enabledPlugins`, `strictKnownMarketplaces` (allowlist, include `{"source":"skills-dir"}`),
`blockedMarketplaces`, `disableSideloadFlags`, `pluginTrustMessage`.

### Private repositories

- There is no token field in `marketplace.json`. Claude Code uses the user's own git credentials, non-interactively.
- For `owner/repo` it tries SSH first, then HTTPS. `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` skips the SSH probe.
- Recommended setup: `gh auth login && gh auth setup-git`.
- `GITHUB_TOKEN` in the environment alone does not authenticate background updates; it needs a credential helper.
- In GitHub Actions, a different private repo needs a PAT or app token as `GH_TOKEN` plus `gh auth setup-git`.

### Auto-update

- Off by default for third-party marketplaces. Users enable it in `/plugin` → Marketplaces, or admins set
  `autoUpdate: true` in managed settings.
- Updates are applied after `/reload-plugins` or a restart.

## 5. Versioning and caching

- Installed plugins are copied to `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`.
  Paths such as `../shared` break after the copy.
- Symlinks inside the plugin stay links; symlinks to elsewhere in the marketplace are copied in;
  symlinks outside the marketplace are skipped.
- Version resolution: `plugin.json` `version` → entry `version` → commit SHA (git sources and relative paths in a git-hosted marketplace).
- Users only receive a new copy when the computed version changes. A pinned `version` that is never bumped means nothing ships.
- Pick one strategy: bump semver on every release, or omit `version` everywhere so every commit is a release.
- Never set `version` in both `plugin.json` and the marketplace entry. `plugin.json` wins and validate warns.
- Release channels need two marketplaces with different names pointing at different refs.
- A marketplace added from a local folder loads plugins in place, which hides caching problems.
  Test from the git URL before announcing a release.
- Git LFS files arrive as pointer files. Do not use LFS in plugins.
- Node dependencies are auto-installed only with `package.json` plus an npm or bun lockfile.

## 6. Community best practices

- Many small plugins instead of one large one. Users cannot disable a single skill inside a plugin.
- Skills use progressive disclosure: the frontmatter `description` (max 1024 chars, third person,
  says what and when) is always in context; `SKILL.md` stays under ~500 lines; details live in
  reference files one level deep; deterministic steps live in scripts.
- Every catalog entry has `description`, `category`, `tags`. Keep `plugins[]` sorted alphabetically.
- Pin external plugin sources with `ref` plus a 40-character `sha`; refresh pins with a scheduled PR.
- CI: run `claude plugin validate --strict` on the root and on every changed plugin, with a pinned CLI version;
  lint SKILL.md/agent frontmatter; JSON-parse `hooks.json`, `.mcp.json`, `.lsp.json`; run `claude plugin eval`.
  Anthropic publishes a reusable action: `anthropics/claude-plugins-community/.github/actions/validate-plugins` (pin to a SHA).
- GitHub Actions path filters: `*` does not cross `/`; use `plugins/*/skills/**`.
- Repo hygiene: README with install commands and a trust note, LICENSE, CONTRIBUTING, SECURITY,
  CODEOWNERS on `hooks/`, `scripts/`, `.mcp.json`, `.github/`, a PR template that asks "did you bump the version?",
  a CHANGELOG per plugin.
- Security: hooks, MCP servers and scripts run with the user's privileges. There is no plugin signing.
  Review every hook, keep secrets in `userConfig`, never commit tokens to `.mcp.json`.

## 7. Known Claude Code issues worth tracking

- #14061, #17361 – plugin cache does not always refresh after update.
- #18949 – plugin skills missing from slash-command autocomplete.
- #14920 – no way to disable individual skills in a plugin.
- #15148 – `lspServers` in marketplace entries not processed; declare it in `plugin.json`.
- #16288 – hooks from an external hooks file not loaded; keep `hooks/hooks.json`.
- #29729 – plugin signing (closed as not planned).

## 8. Sources

- https://code.claude.com/docs/en/plugins/create-marketplace
- https://code.claude.com/docs/en/plugins/marketplace-reference
- https://code.claude.com/docs/en/plugins/manifest-reference
- https://code.claude.com/docs/en/plugins/host-marketplace
- https://code.claude.com/docs/en/plugins/loading
- https://code.claude.com/docs/en/plugins/cli-reference
- https://code.claude.com/docs/en/plugins/org
- https://code.claude.com/docs/en/plugin-evals
- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- https://github.com/anthropics/claude-plugins-official
- https://github.com/anthropics/claude-plugins-community
- https://github.com/anthropics/skills
- https://github.com/wshobson/agents
- https://github.com/obra/superpowers
- https://github.com/davila7/claude-code-templates
