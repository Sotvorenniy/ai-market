// Home screen: hero search, counts, latest releases, browse by type.

import { searchHash, pluginHash } from './router.js';
import { KINDS, KIND_PLURAL, esc, githubUrl, kindDot } from './ui.js';

export function topKeywords(items, limit) {
  const counts = new Map();
  for (const item of items) for (const tag of item.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([tag, count]) => ({ tag, count }));
}

export function releaseRow(app, release, full = false) {
  const plugin = app.plugins.get(release.plugin);
  const badge = release.kind === 'rollback' ? '<span class="badge warn">Rollback</span>' : release.kind === 'major' ? '<span class="badge accent">Breaking</span>' : '';
  const summary = release.notes.join(' · ') || 'No release notes.';
  if (full) {
    return `<a class="release-row full" href="${esc(pluginHash(release.plugin))}">
      <div class="release-version"><div class="mono version">v${esc(release.version)}</div><div class="mono faint small">${esc(release.date)}</div></div>
      <div class="grow"><div class="strong">${esc(plugin?.displayName ?? release.plugin)} ${badge}</div><div class="dim small">${esc(summary)}</div></div>
    </a>`;
  }
  return `<a class="release-row" href="${esc(pluginHash(release.plugin))}">
    <span class="version-pill mono">v${esc(release.version)}</span>
    <div class="grow min0"><div class="strong">${esc(plugin?.displayName ?? release.plugin)} ${badge}</div><div class="dim small ellipsis">${esc(summary)}</div></div>
    <span class="mono faint small nowrap">${esc(release.date)}</span>
  </a>`;
}

export function renderHome(app) {
  const { items, plugins } = app.catalog;
  const empty = plugins.length === 0;
  const count = (kind) => items.filter((i) => i.type === kind).length;
  const repoUrl = githubUrl(app.catalog.marketplace.repo);

  const hero = `
    <section class="hero">
      <div class="eyebrow mono">Marketplace of plugins · skills · agents</div>
      <h1>Find the artifact you need<br>and install it with one copy-paste</h1>
      <p>Search across names, descriptions, keywords and documentation of everything in the marketplace.</p>
      <div class="hero-search">
        <span class="search-icon" aria-hidden="true">⌕</span>
        <input id="hero-q" type="search" autocomplete="off" spellcheck="false" aria-label="Search the catalog"
          placeholder="Describe what you need, e.g. “a skill to review pull requests”">
      </div>
      <div class="hero-chips">${topKeywords(items, 7).map(({ tag }) => `<a class="hash-chip mono" href="${esc(searchHash({ keywords: [tag] }))}">#${esc(tag)}</a>`).join('')}</div>
    </section>`;

  if (empty) {
    return `<main class="page home">${hero}
      <section class="empty-block">
        <div class="empty-icon" aria-hidden="true">📦</div>
        <h2>The catalog is empty</h2>
        <p>There are no plugins yet. Add the first one and it shows up here after the next CI build.</p>
        <div class="row center">
          <a class="btn primary" href="#/get-started">How to start</a>
          ${repoUrl ? `<a class="btn" href="${esc(repoUrl)}" target="_blank" rel="noopener">View repository</a>` : ''}
        </div>
      </section>
    </main>`;
  }

  const stats = ['plugin', 'skill', 'agent', 'command', 'mcp'].map((kind) => `
    <a class="stat" href="${esc(searchHash({ kinds: [kind] }))}">
      <div class="stat-count mono">${count(kind)}</div>
      <div class="dim small">${esc(KIND_PLURAL[kind])}</div>
    </a>`).join('');

  const latest = app.releases.slice(0, 4);
  return `<main class="page home">${hero}
    <section class="stats">${stats}</section>
    <section class="block">
      <div class="block-head"><h2>What's new</h2><a class="dim small" href="#/whats-new">Full feed →</a></div>
      <div class="stack">${latest.length ? latest.map((r) => releaseRow(app, r)).join('') : '<p class="dim">No releases yet.</p>'}</div>
    </section>
    <section class="block">
      <h2>Browse by type</h2>
      <div class="kind-buttons">${KINDS.map((kind) => `
        <a class="kind-button" href="${esc(searchHash({ kinds: [kind] }))}">${kindDot(kind)}<span class="label">${esc(KIND_PLURAL[kind])}</span><span class="mono faint small">${count(kind)}</span></a>`).join('')}
      </div>
    </section>
  </main>`;
}
