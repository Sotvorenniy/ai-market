# ai-market: stable channel

This branch holds only a catalog, `ai-market-stable`. Each entry points at a released, verified version
of a plugin from the `main` branch, pinned by its `<plugin>--v<version>` tag. Nothing here changes
until a maintainer promotes a release.

| Plugin | Stable version |
|---|---|
| `architecture-review` | 1.0.0 |
| `engineering-paved-path` | 1.0.0 |
| `research-tools` | 1.0.0 |
| `sdd-engineering` | 1.0.0 |

## Use it

```
/plugin marketplace add Sotvorenniy/ai-market#stable
/plugin install sdd-engineering@ai-market-stable
```

To go back to stable from the latest channel (`ai-market`), remove that marketplace first. Removing it
uninstalls its plugins, so the two copies of a plugin never load side by side:

```
/plugin marketplace remove ai-market
/plugin marketplace add Sotvorenniy/ai-market#stable
/plugin install sdd-engineering@ai-market-stable
```

Then restart Claude Code or run `/reload-plugins`.

## Promote a release (maintainers)

1. The release is tagged on `main` and its evals passed with 3 runs per case.
2. On this branch, change the entry's `ref` to the new tag and the table above, then run
   `claude plugin validate . --strict`.
3. Open a pull request to `stable`. Users get the new version with `/plugin marketplace update
   ai-market-stable` followed by `/plugin update <plugin>@ai-market-stable`.

The release process is described in `docs/release-and-rollback.md` on `main`.
