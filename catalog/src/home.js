// Home screen: hero search, counts, latest releases, browse by type.

import { t } from './i18n.js';
import { searchHash, pluginHash } from './router.js';
import { KINDS, esc, githubUrl, kindDot, kindPlural } from './ui.js';

export function topKeywords(items, limit) {
  const counts = new Map();
  for (const item of items) for (const tag of item.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([tag, count]) => ({ tag, count }));
}

export function releaseBadge(release) {
  if (release.kind === 'rollback') return `<span class="badge warn">${esc(t('release.rollback'))}</span>`;
  if (release.kind === 'major') return `<span class="badge accent">${esc(t('release.breaking'))}</span>`;
  return '';
}

export const releaseSummary = (release) => release.notes.join(' · ') || t('release.noNotes');

export function releaseRow(app, release, full = false) {
  const plugin = app.plugins.get(release.plugin);
  const name = `${esc(plugin?.displayName ?? release.plugin)} ${releaseBadge(release)}`;
  if (full) {
    return `<a class="release-row full" href="${esc(pluginHash(release.plugin))}">
      <div class="release-version"><div class="mono version">v${esc(release.version)}</div><div class="mono faint small">${esc(release.date)}</div></div>
      <div class="grow"><div class="strong">${name}</div><div class="dim small">${esc(releaseSummary(release))}</div></div>
    </a>`;
  }
  return `<a class="release-row" href="${esc(pluginHash(release.plugin))}">
    <span class="version-pill mono">v${esc(release.version)}</span>
    <div class="grow min0"><div class="strong">${name}</div><div class="dim small ellipsis">${esc(releaseSummary(release))}</div></div>
    <span class="mono faint small nowrap">${esc(release.date)}</span>
  </a>`;
}

export function renderHome(app) {
  const { items, plugins } = app.catalog;
  const count = (kind) => items.filter((i) => i.type === kind).length;
  const repoUrl = githubUrl(app.catalog.marketplace.repo);

  const hero = `
    <section class="hero">
      <div class="eyebrow mono">${esc(t('home.eyebrow'))}</div>
      <h1>${esc(t('home.titleLine1'))}<br>${esc(t('home.titleLine2'))}</h1>
      <p>${esc(t('home.subtitle'))}</p>
      <div class="hero-search">
        <span class="search-icon" aria-hidden="true">⌕</span>
        <input id="hero-q" type="search" autocomplete="off" spellcheck="false" aria-label="${esc(t('header.searchLabel'))}"
          placeholder="${esc(t('home.searchPlaceholder'))}">
      </div>
      <div class="hero-chips">${topKeywords(items, 7).map(({ tag }) => `<a class="hash-chip mono" href="${esc(searchHash({ keywords: [tag] }))}">#${esc(tag)}</a>`).join('')}</div>
    </section>`;

  if (!plugins.length) {
    return `<main class="page home">${hero}
      <section class="empty-block">
        <div class="empty-icon" aria-hidden="true">📦</div>
        <h2>${esc(t('home.emptyTitle'))}</h2>
        <p>${esc(t('home.emptyText'))}</p>
        <div class="row center">
          <a class="btn primary" href="#/get-started">${esc(t('home.emptyStart'))}</a>
          ${repoUrl ? `<a class="btn" href="${esc(repoUrl)}" target="_blank" rel="noopener">${esc(t('home.emptyRepo'))}</a>` : ''}
        </div>
      </section>
    </main>`;
  }

  const stats = ['plugin', 'skill', 'agent', 'command', 'mcp'].map((kind) => `
    <a class="stat" href="${esc(searchHash({ kinds: [kind] }))}">
      <div class="stat-count mono">${count(kind)}</div>
      <div class="dim small">${esc(kindPlural(kind))}</div>
    </a>`).join('');

  const latest = app.releases.slice(0, 4);
  return `<main class="page home">${hero}
    <section class="stats">${stats}</section>
    <section class="block">
      <div class="block-head"><h2>${esc(t('home.whatsNew'))}</h2><a class="dim small" href="#/whats-new">${esc(t('home.fullFeed'))}</a></div>
      <div class="stack">${latest.length ? latest.map((r) => releaseRow(app, r)).join('') : `<p class="dim">${esc(t('release.none'))}</p>`}</div>
    </section>
    <section class="block">
      <h2>${esc(t('home.browseByType'))}</h2>
      <div class="kind-buttons">${KINDS.map((kind) => `
        <a class="kind-button" href="${esc(searchHash({ kinds: [kind] }))}">${kindDot(kind)}<span class="label">${esc(kindPlural(kind))}</span><span class="mono faint small">${count(kind)}</span></a>`).join('')}
      </div>
    </section>
  </main>`;
}
