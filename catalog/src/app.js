// Entry point: loads data, routes between screens, handles header search, copy, theme and the palette.

import { createIndex, prepareConfig } from './search.js';
import { parseHash, searchHash, searchState } from './router.js';
import { renderHome } from './home.js';
import { renderSearch } from './results.js';
import { renderArtifact, renderPlugin } from './detail.js';
import { renderGetStarted, renderWhatsNew } from './pages.js';
import { createPalette } from './palette.js';
import { KINDS, copyText, esc, githubUrl, loadTheme, saveTheme } from './ui.js';

const app = {
  catalog: null,
  releases: [],
  config: null,
  index: null,
  plugins: new Map(),
  items: new Map(),
  search: { q: '', kinds: [], keywords: [], author: null, sort: 'relevance' },
  lastListHash: '#/',
};

const $ = (id) => document.getElementById(id);
const view = $('view');
const headerInput = $('q');
const palette = createPalette(app);

/* ---------- loading ---------- */

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${path} returned ${response.status}.`);
  return response.json();
}

function renderLoading() {
  view.innerHTML = `<main class="page"><div class="cards" aria-busy="true">${'<div class="card skeleton"><span></span><span></span><span></span></div>'.repeat(6)}</div></main>`;
}

function renderError(message) {
  view.innerHTML = `<main class="page narrow"><div class="empty-block">
    <div class="empty-icon" aria-hidden="true">⚠</div>
    <h2>The catalog didn't load</h2>
    <p>${esc(message)} Check your connection and try again.</p>
    <div class="row center"><button class="btn primary" type="button" data-retry>Try again</button></div>
  </div></main>`;
}

async function load() {
  renderLoading();
  try {
    const [config, catalog, releases] = await Promise.all([
      fetchJson('search-config.json'),
      fetchJson('data/catalog.json'),
      fetchJson('data/releases.json').catch(() => []),
    ]);
    app.config = prepareConfig(config);
    app.catalog = catalog;
    app.releases = releases;
    app.plugins = new Map(catalog.plugins.map((p) => [p.name, p]));
    app.items = new Map(catalog.items.map((i) => [i.id, i]));
    app.index = createIndex(catalog.items, app.config);
    const repoUrl = githubUrl(catalog.marketplace.repo);
    $('github-link').hidden = !repoUrl;
    if (repoUrl) $('github-link').href = repoUrl;
    $('brand-badge').textContent = catalog.marketplace.name;
    route();
  } catch (err) {
    renderError(err instanceof Error ? err.message : 'Unknown error.');
  }
}

/* ---------- routing ---------- */

function setTitle(text) {
  document.title = text ? `${text} · ${app.catalog.marketplace.name} catalog` : `${app.catalog.marketplace.name} catalog`;
}

function route({ keepScroll = false } = {}) {
  if (!app.catalog) return;
  const { view: name, params, name: pluginName, itemId } = parseHash(location.hash);
  if (name === 'search') {
    app.search = searchState(params, KINDS);
    if (document.activeElement !== headerInput && headerInput.value !== app.search.q) headerInput.value = app.search.q;
    view.innerHTML = renderSearch(app, app.search);
    app.lastListHash = searchHash(app.search);
    setTitle(app.search.q ? `“${app.search.q}”` : 'Browse');
  } else {
    if (document.activeElement !== headerInput) headerInput.value = '';
    if (name === 'plugin') {
      view.innerHTML = renderPlugin(app, pluginName);
      setTitle(app.plugins.get(pluginName)?.displayName ?? 'Not found');
    } else if (name === 'artifact') {
      view.innerHTML = renderArtifact(app, itemId);
      const item = app.items.get(itemId);
      setTitle(item ? `${item.plugin}:${item.name}` : 'Not found');
    } else if (name === 'whats-new') {
      view.innerHTML = renderWhatsNew(app);
      setTitle("What's new");
    } else if (name === 'get-started') {
      view.innerHTML = renderGetStarted(app);
      setTitle('Get started');
    } else {
      view.innerHTML = renderHome(app);
      app.lastListHash = '#/';
      setTitle('');
    }
  }
  if (!keepScroll) window.scrollTo(0, 0);
}

/** Updates the search state; the first change from another screen adds a history entry, later ones replace it. */
function updateSearch(change) {
  app.search = { ...app.search, ...change };
  const hash = searchHash(app.search);
  if (parseHash(location.hash).view === 'search') {
    history.replaceState(null, '', hash);
    route({ keepScroll: true });
  } else {
    location.hash = hash;
  }
}

/* ---------- header search ---------- */

function startSearch(q) {
  if (parseHash(location.hash).view !== 'search') {
    app.search = { q: '', kinds: [], keywords: [], author: null, sort: 'relevance' };
  }
  updateSearch({ q });
}

headerInput.addEventListener('input', () => startSearch(headerInput.value));
headerInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startSearch(headerInput.value);
  if (e.key === 'Escape' && headerInput.value) {
    headerInput.value = '';
    startSearch('');
  }
});
$('header-search').addEventListener('submit', (e) => e.preventDefault());

// The hero input hands over to the header input so typing continues without losing focus.
view.addEventListener('input', (e) => {
  if (e.target.id !== 'hero-q') return;
  headerInput.value = e.target.value;
  startSearch(e.target.value);
  headerInput.focus();
  headerInput.setSelectionRange(headerInput.value.length, headerInput.value.length);
});

view.addEventListener('change', (e) => {
  if (e.target.id === 'sort') updateSearch({ sort: e.target.value });
});

/* ---------- clicks ---------- */

const toggle = (list, value) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-copy],[data-kind],[data-keyword],[data-author],[data-clear-facets],[data-back],[data-retry],[data-palette-open],[data-theme-toggle]');
  if (!target) return;
  const { dataset } = target;
  if (dataset.copy !== undefined) copyText(dataset.copy, target);
  else if (dataset.kind) updateSearch({ kinds: toggle(app.search.kinds, dataset.kind) });
  else if (dataset.keyword) updateSearch({ keywords: toggle(app.search.keywords, dataset.keyword) });
  else if (dataset.author) updateSearch({ author: app.search.author === dataset.author ? null : dataset.author });
  else if (dataset.clearFacets !== undefined) {
    headerInput.value = '';
    updateSearch({ q: '', kinds: [], keywords: [], author: null });
  } else if (dataset.back !== undefined) location.hash = app.lastListHash;
  else if (dataset.retry !== undefined) load();
  else if (dataset.paletteOpen !== undefined) palette.open();
  else if (dataset.themeToggle !== undefined) {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    applyTheme(next);
    saveTheme(next);
  }
});

/* ---------- keyboard ---------- */

document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if ((e.metaKey || e.ctrlKey) && key === 'k') {
    e.preventDefault();
    palette.toggle();
  } else if (e.key === 'Escape' && palette.isOpen) {
    palette.close();
  } else if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
    const tag = document.activeElement?.tagName ?? '';
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || document.activeElement?.isContentEditable) return;
    e.preventDefault();
    headerInput.focus();
  }
});

window.addEventListener('hashchange', () => {
  palette.close();
  route();
});

/* ---------- theme ---------- */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const button = $('theme-toggle');
  button.textContent = theme === 'dark' ? '☾' : '☀';
  button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
}

/* ---------- boot ---------- */

applyTheme(loadTheme());
$('palette-button').querySelector('kbd').textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';
load();
