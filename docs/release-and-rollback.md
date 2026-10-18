# Release and rollback

Claude Code only updates an installed plugin when its version string changes. A commit without a
version bump never reaches users, so every plugin release goes through `scripts/release.mjs`.

## Version policy

- Each plugin is versioned on its own with semver (`X.Y.Z`).
- The version lives only in `plugins/<name>/.claude-plugin/plugin.json`. The marketplace entry has no `version`.
- Every plugin has a `CHANGELOG.md` with a `## [Unreleased]` section at the top.
- Tags are `<plugin>--v<version>`, for example `code-review--v1.2.0`.

## Release

1. Merge the change to `main` with notes under `## [Unreleased]` in the plugin's `CHANGELOG.md`.
2. Preview: `npm run release -- code-review minor --dry-run`
3. Release: `npm run release -- code-review minor --push`

The script refuses to run with uncommitted changes or outside `main`, bumps `plugin.json`, moves the
Unreleased notes into a dated section, runs `claude plugin validate --strict` on the plugin and the
marketplace, commits `release(code-review): v1.3.0` and creates the tag. If validation fails, nothing is committed.

Validation does not resolve dependency ranges. After releasing, run `npm run install-check`: it installs
every plugin into a throwaway Claude Code config and fails if one does not load, for example when a
`dependencies` range such as `^1.0.0` matches no released version. Release a dependency before the
plugins that depend on it.

Bump rules: `patch` for fixes and wording, `minor` for new skills, agents or commands, `major` for
removed or renamed components and changed `userConfig` keys.

## Rollback

```bash
npm run rollback -- code-review --dry-run          # back to the release before the latest one
npm run rollback -- code-review --to 1.1.0 --push  # back to a specific release
```

Rollback rolls forward: the plugin folder is restored from the target tag and shipped as a new patch
version (for example 1.3.0 is broken, the contents of 1.1.0 ship as 1.3.1). Users with the broken
version cached update normally, and the changelog keeps the full history with a "Rolled back" entry.
Files added after the target release are removed.

Rollback covers the plugin folder only. If the marketplace entry (description, tags, category) changed
since the target release, revert it by hand.

Drilled on 2026-10-18 in a throwaway worktree, nothing pushed: `rollback research-tools --to 0.1.1`
committed and tagged 1.0.1 with the 0.1.1 folder, validation passed, and a user installed at 1.0.0 got
1.0.1 from `plugin update` (not from `marketplace update`); the CLI asked for a restart to apply it.
0.1.1 and 1.0.0 differ only in version and changelog, so the drill proves the mechanism, not a content
revert. Repeat the drill when `scripts/rollback.mjs` or the Claude Code version in CI changes.

## Channels

| Channel | Marketplace | Branch | Gets a release |
|---|---|---|---|
| Latest | `ai-market` | `main` | as soon as it is tagged |
| Stable | `ai-market-stable` | `stable` | when a maintainer promotes it |

The `stable` branch holds only `.claude-plugin/marketplace.json` and a README. Each entry is a
`git-subdir` source pinned with `ref` to a `<plugin>--v<version>` tag and `sha` to that tag's commit
(`git rev-list -n 1 <tag>`). The `sha` is what gets installed: a tag can be moved, a commit cannot, so a
moved or re-created tag does not change what stable users receive. The `ref` stays for people reading
the file. To promote a release, change the entry's `ref` and `sha` on `stable` in a pull request, after
the release passed its evals with 3 runs per case. Check that the two match before merging.

Rolling users back through the channel (instead of a roll-forward release) is the fastest option for
people who choose it: they switch to stable (see the README), and the latest channel stays as it is.

Two things to know:

- A dependency that is not installed yet resolves by its version range against the release tags, not
  through the stable entry. Users therefore install dependencies first; the stable README lists the order.
- Verified on 2026-10-17: installing from `ai-market` at 1.0.0, `marketplace update` left the plugins at
  1.0.0, `plugin update sdd-engineering@ai-market` moved only that plugin to 1.1.0, and switching to
  stable installed 1.0.0 of all four; the `sdd-engineering` smoke evals passed 4/4 on the stable copies.

## Emergency removal

When a plugin must stop being installed at once, remove its entry from `.claude-plugin/marketplace.json`
and add `"renames": { "<plugin>": null }`. With `forceRemoveDeletedPlugins: true` at the top level,
Claude Code uninstalls it from users' machines.

Drilled on 2026-10-18 on a local copy of the catalog: `marketplace update` alone left the plugin
installed and enabled; it was uninstalled when the next Claude Code session started. Sessions already
open keep it until they restart, so tell users to restart.

What the uninstall does not clean up:

- In the drill the plugin's folders stayed in the plugin cache (`~/.claude/plugins/cache/ai-market/<plugin>/`)
  after the uninstall. They are no longer loaded, but their files are still on disk.
- Files the plugin wrote into projects stay. For `sdd-engineering` that is `.claude/cache/retro/`, the
  insights ledger, specs and plans. If the plugin is removed because of what it wrote, say which files
  to delete in the announcement.
- No plugin ships an MCP server, a daemon or stored credentials today. A plugin that adds one must
  document its own cleanup steps here before it is accepted.

## Options

| Option | Effect |
|---|---|
| `--dry-run` | Print the plan without touching files, commits or tags |
| `--push` | Push the commit and the tag to `origin` |
| `--allow-branch` | Allow running outside `main` |
| `--skip-validate` | Skip `claude plugin validate` (only when the CLI is unavailable) |
