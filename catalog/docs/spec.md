# Spec: ai-market catalog site

Status: in progress · Owner: TBD · Design: `catalog/design/Catalog.dc.html` (source of truth for layout and styling;
`catalog/design/early-prototype.html` is the superseded first prototype)

## 1. Summary

A public, static website on GitHub Pages that lets people find and install what the `ai-market`
Claude Code marketplace offers. The core is search that accepts plain-language requests
("I need a skill to review pull requests") and returns matching plugins, skills, agents, commands,
hooks and MCP servers as cards, with facets for type, keyword and author. Around it: a home page with
counts and recent releases, plugin and artifact pages with copy-ready install commands, a release feed
with RSS, a setup guide and a ⌘K quick-jump palette.

The site shows only real data from this repository. There is no sample or demo content in the build.

### Goals

- Someone who has never used the marketplace finds a relevant artifact in under a minute.
- Every artifact page gives a copy-ready install command.
- Content updates require no manual site work: merging to `main` or tagging a release updates the site.

### Non-goals (v1)

- Contribute screen / plugin scaffold generator and the "My stack" settings builder (deferred, see §12).
- Accounts, ratings, comments, usage analytics.
- Server-side or LLM-powered search.
- Running plugin evals as part of the site build.

## 2. Constraints

- GitHub Pages serves static files only. No server code, no secrets at runtime, no databases.
- The site is public. It must never contain secrets, internal URLs that should not leak, or `userConfig` values.
  Only what is already in the repository is published.
- No SPA rewrites on GitHub Pages, so routing uses the URL hash.
- The repository slug is not hard-coded. The build reads it from `GITHUB_REPOSITORY` (Actions env) and
  the marketplace name from `.claude-plugin/marketplace.json` (`ai-market`).
- Browser support: last two versions of Chrome, Edge, Firefox, Safari. Mobile from 360px wide.

## 3. Architecture

The site is a self-contained project in `catalog/`, separate from the marketplace content.

```
.claude-plugin/marketplace.json    # marketplace (read by the build)
plugins/<name>/...                 # marketplace (read by the build)
.github/workflows/pages.yml        # build and deploy the site
catalog/
├── package.json                   # npm run dev | build | test
├── src/                           # static site, served as-is
│   ├── index.html, styles.css
│   ├── app.js                     # loading, routing, header search, theme, clicks
│   ├── home.js, results.js, detail.js, pages.js, palette.js   # screens
│   ├── search.js, search-config.json, router.js, markdown.js, ui.js
├── scripts/
│   ├── build.mjs                  # repo → dist/ (site + data + feed)
│   ├── serve.mjs                  # local dev server
│   └── lib/frontmatter.mjs
├── test/                          # node:test, fixtures (test-only sample data)
├── design/                        # Catalog.dc.html + support.js (design source), early prototype
└── docs/spec.md                   # this file
```

- No frontend framework and no bundler: plain ES modules. Whether to move to React + Vite is an open
  decision (§14).
- Fonts from Google Fonts (IBM Plex Sans, IBM Plex Mono) with system fallbacks. No other third-party requests.
- `npm run build` writes `catalog/dist/`: the contents of `src/`, `data/catalog.json`, `data/releases.json`,
  `feed.xml` and `.nojekyll`.

### Build and deploy (`.github/workflows/pages.yml`)

- Triggers: push to `main`, push of tags matching `*--v*`, manual dispatch.
- Job `build` (in `catalog/`): checkout with full history and tags → `npm test` → `npm run build` →
  upload `catalog/dist` as the Pages artifact. Job `deploy`: `actions/deploy-pages`.
- One-time repository setting: Settings → Pages → Source: GitHub Actions.
- The site is served from `https://sotvorenniy.github.io/ai-market/`. All paths are relative and routing
  uses the URL hash, so the `/ai-market/` base path needs no configuration.
- The build fails (and nothing deploys) if `marketplace.json` cannot be parsed or a relative `source`
  points to a missing folder. Problems inside a single plugin produce warnings in the job summary.

### Local development

`cd catalog && npm run dev` serves `src/` on http://localhost:4173 and rebuilds the data from the
repository on every request, so new or edited plugins appear after a reload.

## 4. Data

### 4.1 `data/catalog.json`

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-10-16T12:00:00Z",
  "commit": "a1b2c3d",
  "marketplace": { "name": "ai-market", "repo": "org/ai-market", "description": "…" },
  "categories": ["Content", "Development"],
  "plugins": [
    {
      "name": "code-review",
      "displayName": "Code review",
      "version": "1.4.0",
      "description": "…",
      "category": "Development",
      "tags": ["review"],
      "owner": "Platform team",
      "license": "MIT",
      "updated": "2026-10-09",
      "hasEvals": true,
      "path": "plugins/code-review",
      "external": false,
      "sourceUrl": null,
      "dependencies": ["security-guard"],
      "items": ["code-review/skill/review-pr"]
    }
  ],
  "items": [
    {
      "id": "code-review/skill/review-pr",
      "type": "skill",
      "name": "review-pr",
      "displayName": "review-pr",
      "plugin": "code-review",
      "description": "…",
      "tags": ["review"],
      "path": "plugins/code-review/skills/review-pr/SKILL.md",
      "body": "markdown without frontmatter, max 4,000 chars",
      "meta": {}
    }
  ]
}
```

Plugins also appear in `items` with `type: "plugin"` and `id` equal to the plugin name, so search
handles one list.

### 4.2 Where each field comes from

| Field | Source (first match wins) |
|---|---|
| plugin `description`, `category`, `tags` | marketplace entry → `plugin.json` (`description`, `keywords`) |
| plugin `version`, `license`, `displayName` | `plugin.json` |
| plugin `owner` | `plugin.json` `author.name` → marketplace `owner.name` |
| plugin `updated` | date of the last commit touching the plugin folder (`git log -1 --format=%cs`) |
| `hasEvals` | an `evals/` folder exists in the plugin |
| skill | `skills/<name>/SKILL.md` frontmatter `name`, `description`; body |
| agent | `agents/*.md` frontmatter `name`, `description`; body |
| command | `commands/*.md` frontmatter `description` (name = file name); body |
| hook | one item per event in `hooks/hooks.json`; `meta.event` = event + matcher; description from the hook's `description` field if present, else "Runs on <event>" |
| MCP server | one item per server in `.mcp.json` / `mcpServers`; `meta.config` = titles of `userConfig` options it references, never values |
| item `tags` | frontmatter `tags` if present, else the plugin tags |
| item `displayName` | frontmatter `displayName` / `display-name` / `title`, else the name; hooks use the event label |
| item `meta.tools` | frontmatter `tools` (agents) or `allowed-tools` (skills) |
| item `meta.model` | agent frontmatter `model` |
| plugin `dependencies` | `plugin.json` `dependencies` (strings or `{ name, marketplace }`), else the entry's |

Components declared through custom paths in `plugin.json` (`skills`, `agents`, `commands`) are read
from those paths. External-source plugins (`github`, `url`, …) are listed with entry data only and
`items: []`, plus `meta.external: true`.

### 4.3 `data/releases.json`

```json
[{ "plugin": "code-review", "version": "1.3.1", "date": "2026-10-07", "kind": "rollback",
   "notes": ["Restored the contents of v1.2.0 …"] }]
```

- One entry per git tag `<plugin>--v<version>`; `date` is the tag date.
- `notes` are the bullet lines of the matching `## [<version>]` section in the plugin's `CHANGELOG.md`
  (max 6, the rest collapsed into "and N more").
- `kind`: `rollback` if the section has a `### Rolled back` heading (written by `scripts/rollback.mjs`),
  `major` if the major number increased, otherwise `release`.
- Sorted newest first. Last 100 entries.

### 4.4 `feed.xml`

Atom feed of the latest 50 releases, linked from What's new ("Subscribe · RSS") and from `<link rel="alternate">`.
Entry links point to the plugin page on the Pages URL.

### 4.5 Size budget

`catalog.json` stays under 1 MB uncompressed. If it grows past that, bodies are trimmed first.

## 5. Search

All logic lives in `site/search.js` as pure functions with unit tests. Configuration in `search-config.json`.

1. **Normalize**: lowercase, replace anything except `a-z 0-9` with spaces, split on spaces and hyphens.
2. **Type words**: `skill(s)`, `agent(s)`, `subagent(s)`, `command(s)`, `hook(s)`, `mcp`, `plugin(s)` are removed
   from the terms and set a type hint.
3. **Stop words** are removed (list in config: "i, need, want, a, the, for, to, help, something, …").
4. **Stemming**: strip a trailing `s` from words longer than 3 letters (not `ss`).
5. **Synonyms**: each term adds related terms from config (`pr → pull, request, review`, `db → database, sql`, …).
6. **Matching** per term against each field's tokens: exact = 1, token starts with term (term ≥ 3 chars) = 0.75,
   term starts with token (token ≥ 4 chars) = 0.6, one typo (both ≥ 5 chars; a swap of neighbouring letters
   counts as one typo) = 0.55. Each distinct token is compared once through a token → items index.
7. **Field weights**: name 5, tags 4, description 2.5, plugin name 1.5, body 1.
8. **Score** = sum over terms of weighted matches + 0.4 × the same for synonyms; multiplied by
   `0.4 + 0.6 × (matched terms / terms)`; × 1.6 when the item type equals the type hint.
   Items scoring below 1 are dropped.
9. **Query with only a type word** (e.g. "skills") lists all items of that type.
10. **Empty query** lists everything, sorted by name.
11. **Highlighting**: matched words in name and description are wrapped in `<mark>`. Text is HTML-escaped first.
12. **Explanation line** under the input: "Searching for review pull request · also related: … · ranking skills first
    because you wrote 'skill'".

Performance: under 30 ms per keystroke for 2,000 items on a mid-range laptop. No debounce below that.
The index (token lists per field) is built once after `catalog.json` loads.

## 6. Routing and URL state

| Route | Screen |
|---|---|
| `#/` | Home |
| `#/search?q=…&kind=skill,agent&kw=react&author=…&sort=updated` | Search |
| `#/plugin/<name>` | Plugin page (`#/item/<name>` redirects here) |
| `#/item/<plugin>/<type>/<name>` | Artifact page |
| `#/whats-new` | What's new |
| `#/get-started` | Get started |

- Typing in the header search (or the home hero input) opens Search; later keystrokes and facet changes
  update the URL with `history.replaceState`, so every search is shareable.
- Unknown routes go to Home. Unknown plugins and artifacts show a "no longer exists" state.
- "Back" on the plugin page returns to the last search (with filters) or Home.

## 7. Screens

`catalog/design/Catalog.dc.html` defines layout, spacing and styling. Copy is English (the design's
Ukrainian copy and demo data are not used).

### 7.1 Header (all screens)

Brand (◆ Catalog + marketplace name badge) → Home; search input; ⌘K button (opens the palette; hidden on
phones); theme toggle; "GitHub ↗" to the repository.

### 7.2 Home

Hero (eyebrow, headline, hero search, top 7 keywords as `#chips` → Search filtered by keyword).
With data: count tiles for plugins, skills, agents, commands, MCP (→ Search filtered by type); What's new
(latest 4 releases, "Full feed →"); Browse by type (all six types with counts).
Without plugins: "The catalog is empty" with "How to start" and "View repository".

### 7.3 Search

- Left column of facets: Type (multi-select), Keywords (top 24 by count plus any selected), Author
  (single select), "Reset". Each facet's counts apply the query and the other facets, not itself.
- Heading "Results for “…”" or "Browse the catalog"; count and the search explanation line; Sort
  (Relevance, Name, Recently updated).
- Card: type chip, version, display name (highlighted), description (2 lines), up to 3 `#keywords`,
  footer with plugin · owner, "Copy install" and "Open".
- No results: "Nothing found", "Reset filters", and "Request this" (prefilled GitHub issue) when there is a query.
- Below 860px the facets move above the results.

### 7.4 Plugin page

Back; icon, display name, version, "External source" and "✓ evals" pills; description; owner · updated ·
license; install bar (`$ /plugin install <name>@ai-market`, Copy install, View on GitHub ↗); Contents
grouped by type with invocation (`/<plugin>:<skill>`, hook event); a note when the plugin contains hooks or
MCP servers; Dependencies (linked when the plugin is in this catalog); README (rendered markdown);
Changelog from `releases.json` with Rollback and Breaking badges.

### 7.5 Artifact page

Breadcrumb Catalog / plugin / name; type chip, display name, invocation; description; Tools / permissions
(`meta.tools`); "Asks for on install" (`meta.config`) for MCP servers; a note for hooks and MCP servers;
install bar for the parent plugin with a link to the source file; Documentation (rendered body).

### 7.6 What's new

All releases (version, date, plugin, notes, Rollback/Breaking badges) linking to the plugin page;
"Subscribe · RSS" → `feed.xml`.

### 7.7 Get started

Three steps with copy buttons: add the marketplace, install a plugin (first plugin in the catalog as the
example), update the marketplace. Note explaining marketplace update vs plugin update and auto-update.

### 7.8 Quick-jump palette

⌘K / Ctrl+K toggles it, Esc closes. Shows the top 8 search results (all items when empty); arrow keys
move, Enter or click opens. Dialog with `aria-modal`, combobox/listbox roles.

## 8. Visual design

- Tokens, type and component styles follow `Catalog.dc.html`: dark first with a blue accent, IBM Plex Sans
  and Mono, per-type colors. Light theme via the header toggle; the choice is stored in `localStorage`.
  The OS preference is not used. The design's alternative accents are not implemented.
- Layout widths: home 1080px, search 1180px (230px facets + grid), plugin 900px, artifact and What's new
  820px, Get started 720px.

## 9. Accessibility

- WCAG 2.1 AA contrast in both themes.
- Every control reachable by keyboard with a visible focus ring. Tabs use `role="tablist"` / `aria-selected`.
- Result count and explanation line are announced (`aria-live="polite"`).
- Copy buttons fall back to selecting the text when the clipboard API is unavailable, and say so.
- Respects `prefers-reduced-motion`.

## 10. Security

- Everything rendered from repository content is HTML-escaped; the markdown renderer supports a fixed subset
  and never passes raw HTML through.
- External links use `rel="noopener"`.
- No third-party scripts, no analytics, no cookies.
- The build never reads `.env` files and never publishes `userConfig` values or anything under `.github/`.

## 11. Testing

- `npm test` (node:test, no dependencies): build script against generated git fixtures, frontmatter parser,
  search scoring and golden queries, router, facets, markdown safety, feed escaping.
- Golden queries (`test/fixtures/search-golden.json`) run against test-only sample data until real plugins
  exist; then a second list runs against the real catalog.
- Manual checklist before launch: both themes, 360px width, keyboard-only pass, copy buttons in Safari.

## 12. Later

- "My stack": pick several plugins and copy a generated `.claude/settings.json`.
- Contribute screen with a plugin scaffold generator.
- Search inside reference files of skills.
- Eval results per plugin once evals run in CI.

## 13. Milestones

1. ✅ Catalog data build with tests.
2. ✅ Search with tests and golden queries.
3. ✅ Screens from the design, local dev server, Pages workflow.
4. Launch: enable Pages, first real plugin, manual checklist.

## 14. Decisions

- Repository: `sotvorenniy/ai-market`. Marketplace name: `ai-market`.
- Site URL: `https://sotvorenniy.github.io/ai-market/` (default GitHub Pages domain, no custom domain).
  All asset and data paths are relative so the `/ai-market/` base path works.
- The site is public.
- The site lives in `catalog/`, separate from the marketplace.
- Open: stay on plain ES modules or move to React + Vite with a CI build step.
