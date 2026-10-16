// Browse screen: search input, filters and result cards. See docs/specs/catalog-site.md §7.2.

import { highlight, search } from './search.js';
import { browseHash, itemHash } from './router.js';
import { TYPES, esc, formatDate, githubUrl, stackButton, typeChip } from './ui.js';

const exampleChips = (examples) => examples
  .map((e) => `<button class="chip" type="button" data-example="${esc(e)}">${esc(e)}</button>`)
  .join('');

/** Fills the static parts of the browse screen once the catalog and config are loaded. */
export function setupBrowse(app) {
  document.getElementById('examples').innerHTML = `<span class="muted">Try:</span>${exampleChips(app.config.examples)}`;
  document.getElementById('category').innerHTML = `<option value="all">All categories</option>${
    app.catalog.categories.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}`;
}

export function renderSkeleton() {
  document.getElementById('result-count').textContent = 'Loading the catalog…';
  document.getElementById('results').innerHTML = Array.from({ length: 6 }, () => '<div class="card skeleton" aria-hidden="true"><span></span><span></span><span></span></div>').join('');
}

export function renderLoadError(message) {
  document.getElementById('result-count').textContent = '';
  document.getElementById('type-tabs').innerHTML = '';
  document.getElementById('results').innerHTML = `<div class="empty">
    <h2>The catalog didn't load</h2>
    <p>${esc(message)} Check your connection and try again.</p>
    <button class="btn primary" type="button" data-retry>Try again</button>
  </div>`;
}

function explanation({ terms, related, typeHint }) {
  const parts = [];
  const code = (t) => `<b>${esc(t)}</b>`;
  if (terms.length) parts.push(`Searching for ${terms.map(code).join(' ')}`);
  if (terms.length && related.length) parts.push(`also related: ${related.slice(0, 4).map(code).join(' ')}`);
  if (typeHint) {
    const label = TYPES.find(([key]) => key === typeHint)[1].toLowerCase();
    parts.push(`${terms.length ? 'ranking' : 'showing'} ${label} ${terms.length ? 'first ' : ''}because you wrote “${esc(typeHint)}”`);
  }
  return parts.join(' · ');
}

function card(app, item, terms) {
  const plugin = app.plugins.get(item.plugin);
  const version = plugin.version ? `v${plugin.version}` : (plugin.external ? 'external' : '');
  const where = item.type === 'plugin' ? version : [plugin.name, version].filter(Boolean).join(' · ');
  const updated = formatDate(plugin.updated);
  const href = itemHash(item.id);
  return `<article class="card" data-href="${esc(href)}">
    <div class="card-top">${typeChip(item.type)}<span class="card-plugin">${esc(where)}</span></div>
    <h3><a href="${esc(href)}">${highlight(item.name, terms)}</a></h3>
    <p>${item.description ? highlight(item.description, terms) : '<span class="muted">No description yet.</span>'}</p>
    <div class="tags">${(item.tags ?? []).slice(0, 4).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
    <div class="card-foot"><span class="meta">${updated ? `Updated ${updated}` : ''}</span>${stackButton(app.stack, plugin.name, true)}</div>
  </article>`;
}

function emptyState(app, query) {
  const issues = githubUrl(app.catalog.marketplace.repo, '/issues/new');
  const request = issues
    ? `<a class="btn primary" target="_blank" rel="noopener" href="${esc(`${issues}?labels=request&title=${encodeURIComponent(`Request: ${query}`)}&body=${encodeURIComponent(`I searched the catalog for "${query}" and found nothing.\n\nWhat I want to do:\n`)}`)}">Request this</a>`
    : '';
  return `<div class="empty">
    <h2>Nothing matches “${esc(query)}”</h2>
    <p>Try fewer or more general words, or clear the filters. If it doesn't exist yet, ask for it.</p>
    <div class="examples">${exampleChips(app.config.examples.slice(1, 4))}</div>
    ${request}
  </div>`;
}

const SORTERS = {
  updated: (app) => (a, b) => (app.plugins.get(b.item.plugin).updated ?? '').localeCompare(app.plugins.get(a.item.plugin).updated ?? '')
    || a.item.name.localeCompare(b.item.name),
  name: () => (a, b) => a.item.name.localeCompare(b.item.name) || a.item.id.localeCompare(b.item.id),
};

/** Renders results for app.browse (the state parsed from the URL). */
export function renderResults(app) {
  const state = app.browse;
  const { parsed, results } = search(app.index, state.q);
  const inCategory = results.filter(({ item }) => state.category === 'all' || app.plugins.get(item.plugin).category === state.category);

  const counts = Object.fromEntries(TYPES.map(([key]) => [key, 0]));
  for (const { item } of inCategory) {
    counts.all++;
    counts[item.type] = (counts[item.type] ?? 0) + 1;
  }
  document.getElementById('type-tabs').innerHTML = TYPES.map(([key, label]) => `<button class="tab" role="tab" type="button" data-type="${key}" aria-selected="${state.type === key}">${label} <span class="n">${counts[key]}</span></button>`).join('');

  const rows = inCategory.filter(({ item }) => state.type === 'all' || item.type === state.type);
  if (state.sort !== 'relevance') rows.sort(SORTERS[state.sort](app));

  document.getElementById('explain').innerHTML = explanation(parsed);
  const noun = rows.length === 1 ? 'result' : 'results';
  document.getElementById('result-count').textContent = parsed.terms.length
    ? `${rows.length} ${noun}`
    : `${rows.length} ${noun} · everything in the marketplace`;

  const terms = [...parsed.terms, ...parsed.related];
  const results_ = document.getElementById('results');
  if (!app.catalog.plugins.length) {
    results_.innerHTML = '<div class="empty"><h2>No plugins yet</h2><p>The marketplace is set up, but nothing has been published. Check back after the first release.</p></div>';
  } else if (!rows.length) {
    results_.innerHTML = state.q.trim() ? emptyState(app, state.q.trim()) : '<div class="empty"><h2>Nothing in this filter</h2><p>Choose another type or category.</p></div>';
  } else {
    results_.innerHTML = rows.map(({ item }) => card(app, item, terms)).join('');
  }
}

/** Syncs form controls with app.browse (after navigation or Back). */
export function syncControls(app) {
  const { q, category, sort } = app.browse;
  const input = document.getElementById('q');
  if (input.value !== q) input.value = q;
  document.getElementById('category').value = category;
  document.getElementById('sort').value = sort;
}

/** Writes the browse state to the URL without adding a history entry. */
export function replaceBrowseUrl(app) {
  const hash = browseHash(app.browse);
  app.lastBrowseHash = hash;
  if (location.hash !== hash && !(hash === '#/' && (location.hash === '' || location.hash === '#'))) {
    history.replaceState(null, '', hash);
  }
}
