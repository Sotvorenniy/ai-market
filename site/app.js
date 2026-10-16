// Entry point: loads the catalog, routes between screens and handles shared clicks.

import { createIndex, prepareConfig } from './search.js';
import { browseState, parseHash } from './router.js';
import { createStack, load, save } from './store.js';
import { renderLoadError, renderResults, renderSkeleton, replaceBrowseUrl, setupBrowse, syncControls } from './browse.js';
import { renderItem } from './item.js';
import { TYPES, copyText, toast } from './ui.js';

const app = {
  catalog: null,
  config: null,
  index: null,
  plugins: new Map(),
  items: new Map(),
  browse: { q: '', type: 'all', category: 'all', sort: 'relevance' },
  lastBrowseHash: '#/',
  installTab: 'claude',
  stack: createStack((names) => updateStackCount(names)),
  ready: false,
};

const $ = (id) => document.getElementById(id);

function updateStackCount(names) {
  const badge = $('stack-count');
  badge.textContent = String(names.length);
  badge.hidden = names.length === 0;
}

/* ---------- loading ---------- */

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${path} returned ${response.status}.`);
  return response.json();
}

async function loadCatalog() {
  app.ready = false;
  renderSkeleton();
  try {
    const [config, catalog] = await Promise.all([fetchJson('search-config.json'), fetchJson('data/catalog.json')]);
    app.config = prepareConfig(config);
    app.catalog = catalog;
    app.plugins = new Map(catalog.plugins.map((p) => [p.name, p]));
    app.items = new Map(catalog.items.map((i) => [i.id, i]));
    app.index = createIndex(catalog.items, app.config);
    app.stack.prune(new Set(app.plugins.keys()));
    setupBrowse(app);
    app.ready = true;
    route();
  } catch (err) {
    renderLoadError(err instanceof Error ? err.message : 'Unknown error.');
  }
}

/* ---------- routing ---------- */

function showView(name) {
  for (const section of document.querySelectorAll('.view')) section.hidden = section.id !== `view-${name}`;
  for (const link of document.querySelectorAll('[data-nav]')) {
    const current = link.dataset.nav === (name === 'item' ? 'browse' : name);
    if (current) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

function route({ scroll = true } = {}) {
  const { view, params, itemId } = parseHash(location.hash);
  const pageView = ['stack', 'whats-new', 'get-started'].includes(view) ? 'placeholder' : view;
  showView(pageView);

  if (!app.ready) {
    if (view !== 'browse') showView('browse');
    return;
  }

  if (view === 'browse') {
    app.browse = browseState(params, { types: TYPES.map(([key]) => key), categories: app.catalog.categories });
    syncControls(app);
    renderResults(app);
    replaceBrowseUrl(app);
    document.title = app.browse.q ? `${app.browse.q} · AI Market` : 'AI Market';
  } else if (view === 'item') {
    $('view-item').innerHTML = renderItem(app, itemId);
    const item = app.items.get(itemId);
    document.title = item ? `${item.type === 'plugin' ? item.name : `${item.plugin}:${item.name}`} · AI Market` : 'Not found · AI Market';
    if (scroll) window.scrollTo(0, 0);
  } else {
    document.title = 'AI Market';
    if (scroll) window.scrollTo(0, 0);
  }
}

/* ---------- events ---------- */

function updateBrowse(change) {
  Object.assign(app.browse, change);
  replaceBrowseUrl(app);
  renderResults(app);
}

$('q').addEventListener('input', (e) => updateBrowse({ q: e.target.value }));
$('q').addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && e.target.value) {
    e.target.value = '';
    updateBrowse({ q: '' });
  }
});
$('category').addEventListener('change', (e) => updateBrowse({ category: e.target.value }));
$('sort').addEventListener('change', (e) => updateBrowse({ sort: e.target.value }));
$('search-form').addEventListener('submit', (e) => e.preventDefault());

document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-copy],[data-stack],[data-example],[data-type],[data-install-tab],[data-back],[data-retry],[data-href],a,button');
  if (!target) return;
  const { dataset } = target;
  if (dataset.copy !== undefined) copyText(dataset.copy, target);
  else if (dataset.stack) {
    const added = app.stack.toggle(dataset.stack);
    toast(added ? `Added ${dataset.stack} to your stack` : `Removed ${dataset.stack} from your stack`);
    route({ scroll: false });
  } else if (dataset.example) {
    app.browse = { ...app.browse, q: dataset.example, type: 'all' };
    if (parseHash(location.hash).view === 'browse') {
      syncControls(app);
      updateBrowse({});
    } else {
      location.hash = `#/?q=${encodeURIComponent(dataset.example)}`;
    }
    $('q').focus();
  } else if (dataset.type) updateBrowse({ type: dataset.type });
  else if (dataset.installTab) {
    app.installTab = dataset.installTab;
    save('installTab', app.installTab);
    route({ scroll: false });
  } else if (dataset.back !== undefined) location.hash = app.lastBrowseHash;
  else if (dataset.retry !== undefined) loadCatalog();
  else if (dataset.href && target.tagName === 'ARTICLE') location.hash = dataset.href;
});

document.addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? '') || document.activeElement?.isContentEditable) return;
  e.preventDefault();
  if (parseHash(location.hash).view !== 'browse') location.hash = app.lastBrowseHash;
  $('q').focus();
});

window.addEventListener('hashchange', () => route());

/* ---------- theme ---------- */

const ICONS = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
};

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const button = $('theme-toggle');
  button.innerHTML = theme === 'dark' ? ICONS.sun : ICONS.moon;
  button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
}

$('theme-toggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  applyTheme(next);
  save('theme', next);
});

/* ---------- boot ---------- */

applyTheme(load('theme', 'dark') === 'light' ? 'light' : 'dark');
app.installTab = load('installTab', 'claude');
updateStackCount(app.stack.names);
if (parseHash(location.hash).view === 'browse') $('q').focus();
loadCatalog();
