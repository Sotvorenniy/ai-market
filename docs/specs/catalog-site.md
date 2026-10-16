# Spec: ai-market catalog site

Status: draft · Owner: TBD · Prototype: `docs/design/catalog-prototype.html`

## 1. Summary

A public, static website on GitHub Pages that lets people find and install what the `ai-market`
Claude Code marketplace offers. The core is a search box that accepts plain-language requests
("I need a skill to review pull requests") and returns matching plugins, skills, agents, commands,
hooks and MCP servers as cards. Around it: an artifact page with install instructions, a stack builder
that generates team settings, a release feed and a setup guide.

### Goals

- Someone who has never used the marketplace finds a relevant artifact in under a minute.
- Every artifact page gives a copy-ready install command.
- A team lead can produce a `.claude/settings.json` for a project without reading the docs.
- Content updates require no manual site work: merging to `main` or tagging a release updates the site.

### Non-goals (v1)

- Contribute screen / plugin scaffold generator (deferred, see §12).
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

```
.claude-plugin/marketplace.json
plugins/<name>/...                 # source of truth
scripts/build-catalog.mjs          # repo → site data
site/                              # static source
├── index.html
├── app.js                         # router, views, state (ES modules, no framework)
├── search.js                      # tokenizer, scorer, highlighter (pure functions)
├── styles.css                     # tokens and components from the prototype
└── search-config.json             # stop words, type words, synonyms, field weights
.github/workflows/pages.yml        # build and deploy
```

- No frontend framework and no bundler. Plain ES modules served as-is. The prototype is the reference
  implementation for markup, styles and behaviour.
- Fonts from Google Fonts with system fallbacks. No other third-party requests.
- Build output goes to `dist/`: the contents of `site/` plus `data/catalog.json` and `data/releases.json`.

### Build and deploy (`pages.yml`)

- Triggers: push to `main`, push of tags matching `*--v*`, manual dispatch.
- Steps: checkout with full history and tags (`fetch-depth: 0`) → `node scripts/build-catalog.mjs` →
  upload `dist/` → `actions/deploy-pages`.
- The build fails (and nothing deploys) if `marketplace.json` cannot be parsed or a relative `source`
  points to a missing folder. Problems inside a single plugin (bad frontmatter, missing description)
  produce a warning in the job summary and the item is still published with what is available.
- Plugin validation (`claude plugin validate`) is a separate PR workflow and out of scope here.

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
      "items": ["code-review/skill/review-pr"]
    }
  ],
  "items": [
    {
      "id": "code-review/skill/review-pr",
      "type": "skill",
      "name": "review-pr",
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

### 4.4 Size budget

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
| `#/` | Browse. Query in `#/?q=…&type=skill&category=Development&sort=updated` |
| `#/item/<plugin>` | Plugin page |
| `#/item/<plugin>/<type>/<name>` | Artifact page |
| `#/stack?plugins=a,b&scope=project` | My stack |
| `#/whats-new?plugin=code-review` | What's new |
| `#/get-started` | Get started |

- Browse updates the URL with `history.replaceState` as the user types, so every search is shareable.
- Unknown routes go to Browse. Unknown items show "This item no longer exists" with a link back.
- "Back to results" returns to the last Browse URL, including filters.

## 7. Screens

The prototype defines layout, copy and behaviour. Differences from the prototype are listed here.

### 7.1 Header (all screens)

Brand, navigation (Browse, My stack with a count badge, What's new, Get started), theme toggle.
Remove the "Prototype · sample data" label.

### 7.2 Browse

- Search input, autofocused on load. `/` focuses it from anywhere, `Esc` clears it.
- Example query chips (from config).
- Type tabs with live counts, category select, sort select (Best match, Recently updated, Name A–Z).
- Card: type chip, `plugin · version`, name, description (3 lines), up to 4 tags, updated date,
  "+ Stack" toggle. Clicking anywhere on the card except the toggle opens the artifact page.
- Empty result: message, alternative example chips, "Request this" button opening a prefilled GitHub issue
  (`/issues/new?labels=request&title=Request: <query>`).
- Loading state: 6 skeleton cards. Error state (catalog failed to load): message with a "Try again" button.

### 7.3 Artifact page

- Header: type chip, parent plugin link, version, full name (`plugin:name`), description, stack toggle, tag chips
  (clicking a tag searches for it).
- Install panel with three tabs: In Claude Code, Terminal, Team settings. Each has a copy button.
- How to use: per type (skill `/plugin:skill`, command `/plugin:command`, agent prompt, hook event,
  MCP `/mcp` with the configuration it will ask for).
- Plugin page: "What's inside" list of all components. Other pages: rendered body (headings, lists, code, inline code).
  The markdown renderer escapes all HTML.
- Sidebar: version, updated, category, owner, license, evals (Included / Not set up), links to source,
  changelog and "Report a problem" (prefilled issue with plugin, artifact and version).
- Related: up to 4 items from other plugins sharing a tag.
- Hooks and MCP servers show a note that they run code with the user's permissions.
- External plugins show entry data, the install panel and a link to their source repository.

### 7.4 My stack

- Selected plugins with Remove; suggestion chips for plugins not yet selected.
- Scope: Project (generates `.claude/settings.json` with `extraKnownMarketplaces` and `enabledPlugins`)
  or Just me (generates `claude plugin marketplace add` + `claude plugin install` commands).
- "Copy link to this stack" copies `#/stack?plugins=…` so a lead can send it to the team.
- Opening a stack link replaces the local selection only after the user confirms in an inline banner
  ("Load 3 plugins from this link? Your current selection has 2.").
- Selection is stored in `localStorage`; the page works if storage is unavailable.

### 7.5 What's new

Timeline grouped by month from `releases.json`, plugin filter, badges for Rollback and Breaking (major),
plugin names link to the plugin page, link to GitHub tags.

### 7.6 Get started

Five steps with copy buttons (git access via `gh`, add marketplace, install, enable auto-update,
`/reload-plugins`) and a troubleshooting list (SSH vs HTTPS, "enabled but isn't installed",
"I pushed a fix but nobody gets it", broken update). Content lives in `site/` as static HTML.

## 8. Visual design

- Dark theme by default; light theme via the header toggle; choice stored in `localStorage`.
  The OS preference is not used for the default.
- Colour tokens, fonts (Schibsted Grotesk, IBM Plex Sans, JetBrains Mono) and type colours exactly as in the prototype.
- Layout: max width 1180px; card grid `auto-fill, minmax(300px, 1fr)`; artifact page stacks to one column below 860px.

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

- `node --test` unit tests for `search.js` (tokenizer, stop words, type hints, synonyms, scoring order on a
  fixed fixture, highlighting with HTML in input) and `build-catalog.mjs` (fixture marketplace with each
  component type, an external plugin, a broken plugin, a rollback changelog).
- Golden queries (`scripts/test/fixtures/search-golden.json`): queries and the item that must rank first,
  or a short list of acceptable first results when several answers are equally right
  (e.g. "review pull requests" → `code-review/skill/review-pr`). Runs in CI. Uses sample data until real
  plugins exist; then a second list runs against the real catalog.
- Manual checklist before launch: both themes, 360px width, keyboard-only pass, copy buttons in Safari.

## 12. Later

- Contribute screen with a plugin scaffold generator (prototyped earlier, deferred).
- Search inside reference files of skills.
- "Popular" sort if download data ever becomes available.
- Eval results per plugin once evals run in CI.

## 13. Milestones

1. `build-catalog.mjs` + `catalog.json`/`releases.json` with tests.
2. `search.js` with tests and golden queries.
3. Browse and artifact page.
4. My stack, What's new, Get started.
5. `pages.yml`, Pages enabled in repo settings, launch checklist.

## 14. Decisions

- Repository: `sotvorenniy/ai-market`. Marketplace name: `ai-market`.
- Site URL: `https://sotvorenniy.github.io/ai-market/` (default GitHub Pages domain, no custom domain).
  All asset and data paths are relative so the `/ai-market/` base path works.
- The site is public.
