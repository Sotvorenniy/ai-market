# ai-market: stable channel

This branch holds only a catalog, `ai-market-stable`. Each entry points at a released, verified version
of a plugin from the `main` branch, pinned by the commit (`sha`) of its `<plugin>--v<version>` tag; the
`ref` names the tag for readers. Nothing here changes until a maintainer promotes a release.

| Plugin | Stable version |
|---|---|
| `architecture-review` | 1.0.0 |
| `engineering-paved-path` | 1.0.0 |
| `research-tools` | 1.0.0 |
| `sdd-engineering` | 1.0.0 |

## Use it

```
/plugin marketplace add Sotvorenniy/ai-market#stable
/plugin install engineering-paved-path@ai-market-stable
/plugin install research-tools@ai-market-stable
/plugin install architecture-review@ai-market-stable
/plugin install sdd-engineering@ai-market-stable
```

Install the dependencies first, in this order. A dependency that is not installed yet is resolved by
its version range (`^1.0.0`) against the release tags, so `/plugin install sdd-engineering@ai-market-stable`
on its own pulls the newest matching release of each dependency, not the stable one.

To go back to stable from the latest channel (`ai-market`), remove that marketplace first. Removing it
uninstalls its plugins, so the two copies of a plugin never load side by side:

```
/plugin marketplace remove ai-market
```

then run the commands above. Restart Claude Code or run `/reload-plugins`.

## Promote a release (maintainers)

1. The release is tagged on `main` and its evals passed with 3 runs per case.
2. On this branch, change the entry's `ref` to the new tag, its `sha` to `git rev-list -n 1 <tag>`,
   and the table above, then run `claude plugin validate . --strict`. Claude Code installs the `sha`,
   so a `sha` that does not match the tag ships the wrong code.
3. Open a pull request to `stable`. Users get the new version with `/plugin marketplace update
   ai-market-stable` followed by `/plugin update <plugin>@ai-market-stable`, then `/reload-plugins` or
   a restart.

The release process is described in `docs/release-and-rollback.md` on `main`.
