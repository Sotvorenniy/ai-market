// Search screen: facets (type, keywords, author), sort and result cards. See catalog/docs/spec.md §7.3.

import { search, highlight } from './search.js';
import { plural, t } from './i18n.js';
import { itemHash } from './router.js';
import { KINDS, esc, githubUrl, installCommand, kindChip, kindDot, kindPlural } from './ui.js';

const KEYWORD_LIMIT = 24;

/** Applies query and facets. Each facet's counts ignore that facet's own selection. */
export function filterResults(app, state) {
  const { parsed, results } = search(app.index, state.q);
  const owner = (item) => app.plugins.get(item.plugin)?.owner ?? null;
  const byKind = (r) => !state.kinds.length || state.kinds.includes(r.item.type);
  const byKeyword = (r) => !state.keywords.length || (r.item.tags ?? []).some((tag) => state.keywords.includes(tag));
  const byAuthor = (r) => !state.author || owner(r.item) === state.author;

  const rows = results.filter((r) => byKind(r) && byKeyword(r) && byAuthor(r)).map((r) => r.item);
  const plugin = (item) => app.plugins.get(item.plugin);
  if (state.sort === 'name') rows.sort((a, b) => (a.displayName ?? a.name).localeCompare(b.displayName ?? b.name));
  if (state.sort === 'updated') rows.sort((a, b) => (plugin(b)?.updated ?? '').localeCompare(plugin(a)?.updated ?? '') || a.name.localeCompare(b.name));

  const tally = (list, key) => {
    const counts = new Map();
    for (const r of list) for (const value of [key(r.item)].flat()) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
    return counts;
  };
  return {
    parsed,
    rows,
    kindCounts: tally(results.filter((r) => byKeyword(r) && byAuthor(r)), (i) => i.type),
    keywordCounts: tally(results.filter((r) => byKind(r) && byAuthor(r)), (i) => i.tags ?? []),
    authorCounts: tally(results.filter((r) => byKind(r) && byKeyword(r)), owner),
  };
}

function explanation({ terms, related, typeHint }) {
  const code = (list) => list.map((term) => `<b>${esc(term)}</b>`).join(' ');
  const parts = [];
  if (terms.length) parts.push(esc(t('search.searchingFor', { terms: '\u0000' })).replace('\u0000', code(terms)));
  if (terms.length && related.length) parts.push(esc(t('search.related', { terms: '\u0000' })).replace('\u0000', code(related.slice(0, 4))));
  if (typeHint) parts.push(esc(t('search.typeFirst', { kinds: kindPlural(typeHint), word: typeHint })));
  return parts.join(' · ');
}

function card(app, item, terms) {
  const plugin = app.plugins.get(item.plugin);
  const isPlugin = item.type === 'plugin';
  const version = plugin.version ? `v${plugin.version}` : plugin.external ? t('card.external') : '';
  const meta = isPlugin ? plugin.owner ?? '' : [plugin.name, plugin.owner].filter(Boolean).join(' · ');
  const href = itemHash(item.id);
  const command = installCommand(app.catalog.marketplace, plugin.name);
  return `<article class="card">
    <div class="card-body">
      <div class="card-top">${kindChip(item.type)}<span class="mono faint small">${esc(version)}</span></div>
      <h3><a href="${esc(href)}">${highlight(item.displayName ?? item.name, terms)}</a></h3>
      <p>${item.description ? highlight(item.description, terms) : `<span class="faint">${esc(t('card.noDescription'))}</span>`}</p>
      <div class="card-tags">${(item.tags ?? []).slice(0, 3).map((tag) => `<span class="mono faint small">#${esc(tag)}</span>`).join('')}</div>
    </div>
    <div class="card-foot">
      <span class="faint small ellipsis">${esc(meta)}</span>
      <div class="row tight">
        <button class="btn small" type="button" data-copy="${esc(command)}" data-label="${esc(t('copy.install'))}">${esc(t('copy.install'))}</button>
        <a class="btn small primary" href="${esc(href)}">${esc(t('card.open'))}</a>
      </div>
    </div>
  </article>`;
}

function facetButton(attrs, active, inner) {
  return `<button type="button" class="facet ${active ? 'active' : ''}" aria-pressed="${active}" ${attrs}>${inner}</button>`;
}

export function renderSearch(app, state) {
  const { parsed, rows, kindCounts, keywordCounts, authorCounts } = filterResults(app, state);
  const terms = [...parsed.terms, ...parsed.related];
  const q = state.q.trim();

  const keywords = [...keywordCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, KEYWORD_LIMIT).map(([k]) => k);
  for (const k of state.keywords) if (!keywords.includes(k)) keywords.push(k);
  keywords.sort((a, b) => a.localeCompare(b));
  const authors = [...authorCounts.keys()].sort((a, b) => a.localeCompare(b));
  if (state.author && !authors.includes(state.author)) authors.push(state.author);

  const why = explanation(parsed);
  const issues = githubUrl(app.catalog.marketplace.repo, '/issues/new');
  const request = issues && q
    ? `<a class="btn" target="_blank" rel="noopener" href="${esc(`${issues}?labels=request&title=${encodeURIComponent(t('search.requestTitle', { q }))}`)}">${esc(t('search.request'))}</a>`
    : '';
  const sortOption = (value, key) => `<option value="${value}" ${state.sort === value ? 'selected' : ''}>${esc(t(key))}</option>`;

  return `<main class="page search-layout">
    <aside class="facets" aria-label="${esc(t('search.filters'))}">
      <div class="facets-head"><span class="caps faint">${esc(t('search.filters'))}</span><button type="button" class="link small" data-clear-facets>${esc(t('search.reset'))}</button></div>
      <div class="facet-title">${esc(t('search.type'))}</div>
      <div class="facet-list">${KINDS.map((kind) => facetButton(`data-kind="${kind}"`, state.kinds.includes(kind),
        `${kindDot(kind)}<span class="grow cap">${esc(kindPlural(kind))}</span><span class="mono faint xsmall">${kindCounts.get(kind) ?? 0}</span>`)).join('')}
      </div>
      ${keywords.length ? `<div class="facet-title">${esc(t('search.keywords'))}</div>
      <div class="facet-chips">${keywords.map((k) => `<button type="button" class="kw-chip mono ${state.keywords.includes(k) ? 'active' : ''}" aria-pressed="${state.keywords.includes(k)}" data-keyword="${esc(k)}">${esc(k)}</button>`).join('')}</div>` : ''}
      ${authors.length ? `<div class="facet-title">${esc(t('search.author'))}</div>
      <div class="facet-list">${authors.map((a) => facetButton(`data-author="${esc(a)}"`, state.author === a,
        `<span class="grow ellipsis">${esc(a)}</span><span class="mono faint xsmall">${authorCounts.get(a) ?? 0}</span>`)).join('')}</div>` : ''}
    </aside>
    <section class="results min0">
      <div class="results-head">
        <div class="min0">
          <h1>${esc(q ? t('search.resultsFor', { q }) : t('search.browse'))}</h1>
          <div class="dim small" aria-live="polite">${esc(plural('search.count', rows.length))}${why ? ` · ${why}` : ''}</div>
        </div>
        <label class="sort dim small">${esc(t('search.sort'))}
          <select id="sort">
            ${sortOption('relevance', 'search.sortRelevance')}${sortOption('name', 'search.sortName')}${sortOption('updated', 'search.sortUpdated')}
          </select>
        </label>
      </div>
      ${rows.length
        ? `<div class="cards">${rows.map((item) => card(app, item, terms)).join('')}</div>`
        : `<div class="empty-block">
            <div class="empty-icon" aria-hidden="true">🔍</div>
            <h3>${esc(t('search.nothing'))}</h3>
            <p>${esc(t('search.nothingText'))}</p>
            <div class="row center"><button class="btn" type="button" data-clear-facets>${esc(t('search.resetFilters'))}</button>${request}</div>
          </div>`}
    </section>
  </main>`;
}
