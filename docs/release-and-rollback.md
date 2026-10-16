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

## Emergency removal

When a plugin must stop being installed at once, remove its entry from `.claude-plugin/marketplace.json`
and add `"renames": { "<plugin>": null }`. With `forceRemoveDeletedPlugins: true` at the top level,
Claude Code uninstalls it from users' machines on their next marketplace update.

## Options

| Option | Effect |
|---|---|
| `--dry-run` | Print the plan without touching files, commits or tags |
| `--push` | Push the commit and the tag to `origin` |
| `--allow-branch` | Allow running outside `main` |
| `--skip-validate` | Skip `claude plugin validate` (only when the CLI is unavailable) |
