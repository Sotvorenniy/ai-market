# ai-market catalog

The public catalog site for the `ai-market` Claude Code marketplace, published at
https://github.com/Sotvorenniy/ai-market

This folder is a self-contained project. It reads the marketplace from the repository root
(`.claude-plugin/marketplace.json` and `plugins/`) and never changes it.

## Commands

Run inside `catalog/`, or from the repository root with the same names (`npm test`, `npm run dev`, `npm run build`). Node 20 or newer, no dependencies to install:

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on http://localhost:4173. Catalog data is rebuilt from the repository on every request, so new plugins appear after a reload. `-- --port 5000` changes the port. |
| `npm run build` | Writes the site to `dist/`: `src/` plus `data/catalog.json`, `data/releases.json` and `feed.xml`. |
| `npm test` | Unit tests for the build, search, router and rendering helpers. |

## Deployment

`.github/workflows/pages.yml` tests, builds and publishes `dist/` to GitHub Pages on every push to `main`
and on every release tag (`<plugin>--v<version>`).

One-time setup in the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Layout

| Path | Contents |
|---|---|
| `src/` | The static site: HTML, CSS and ES modules served as-is |
| `scripts/` | `build.mjs` (repository → `dist/`), `serve.mjs` (dev server) |
| `test/` | `node:test` suites and test-only fixtures |
| `design/` | `Catalog.dc.html` (design source of truth) and the early prototype |
| `docs/spec.md` | Specification |

The site only ever shows real plugins from this repository. Sample data exists only in `test/fixtures/`.
