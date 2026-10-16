// Plugin and artifact pages. See catalog/docs/spec.md §7.3.

import { renderMarkdown } from './markdown.js';
import { itemHash, pluginHash } from './router.js';
import { KIND_PLURAL, esc, githubUrl, installBar, installCommand, invocation, kindChip, kindDot } from './ui.js';

const ORDER = ['skill', 'agent', 'command', 'hook', 'mcp'];

const notFound = (what) => `<main class="page narrow">
  <div class="empty-block">
    <div class="empty-icon" aria-hidden="true">🔍</div>
    <h2>This ${what} no longer exists</h2>
    <p>It may have been renamed or removed from the marketplace.</p>
    <div class="row center"><a class="btn primary" href="#/search">Browse the catalog</a></div>
  </div>
</main>`;

const trustNote = (text) => `<p class="trust-note">${text}</p>`;

function sourceUrl(app, plugin, item) {
  if (plugin.external) return plugin.sourceUrl;
  const repoUrl = githubUrl(app.catalog.marketplace.repo);
  const path = item?.path ?? plugin.path;
  if (!repoUrl || !path) return null;
  return `${repoUrl}/${item ? 'blob' : 'tree'}/main/${path}`;
}

function dependencyLink(app, dep) {
  const name = dep.split('@')[0].split(':')[0];
  return app.plugins.has(name)
    ? `<a class="dep mono" href="${esc(pluginHash(name))}">${esc(dep)} ↗</a>`
    : `<span class="dep mono">${esc(dep)}</span>`;
}

export function renderPlugin(app, name) {
  const plugin = app.plugins.get(name);
  if (!plugin) return notFound('plugin');
  const { marketplace } = app.catalog;
  const item = app.items.get(plugin.name);
  const components = plugin.items.map((id) => app.items.get(id)).filter(Boolean);
  const groups = ORDER.map((kind) => ({ kind, items: components.filter((c) => c.type === kind) })).filter((g) => g.items.length);
  const releases = app.releases.filter((r) => r.plugin === plugin.name);
  const github = sourceUrl(app, plugin);
  const runsCode = components.some((c) => c.type === 'hook' || c.type === 'mcp');
  const facts = [plugin.owner, plugin.updated ? `updated ${plugin.updated}` : null, plugin.license].filter(Boolean).join(' · ');

  return `<main class="page narrow">
    <button class="back" type="button" data-back>← Back</button>
    <div class="plugin-head">
      <div class="plugin-icon" aria-hidden="true">◆</div>
      <div class="grow min0">
        <div class="row wrap">
          <h1>${esc(plugin.displayName)}</h1>
          ${plugin.version ? `<span class="version-pill mono">v${esc(plugin.version)}</span>` : ''}
          ${plugin.external ? '<span class="badge">External source</span>' : ''}
          ${plugin.hasEvals ? '<span class="ok-pill mono">✓ evals</span>' : ''}
        </div>
        <p class="dim">${plugin.description ? esc(plugin.description) : 'No description yet.'}</p>
        ${facts ? `<div class="mono faint small">${esc(facts)}</div>` : ''}
      </div>
    </div>

    ${installBar(installCommand(marketplace, plugin.name), github ? `<a class="btn" href="${esc(github)}" target="_blank" rel="noopener">View on GitHub ↗</a>` : '')}

    ${groups.length ? `<section class="block">
      <h2>Contents</h2>
      <div class="stack gap16">${groups.map((g) => `
        <div>
          <div class="group-head">${kindDot(g.kind)}<span class="caps dim">${esc(KIND_PLURAL[g.kind])}</span><span class="mono faint xsmall">${g.items.length}</span></div>
          <div class="component-grid">${g.items.map((c) => `
            <a class="component" href="${esc(itemHash(c.id))}">
              <div class="row between"><span class="strong small">${esc(c.displayName ?? c.name)}</span><span class="mono accent xsmall ellipsis">${esc(invocation(c))}</span></div>
              <div class="dim xsmall ellipsis">${esc(c.description)}</div>
            </a>`).join('')}
          </div>
        </div>`).join('')}
      </div>
      ${runsCode ? trustNote('This plugin includes hooks or MCP servers that run code on your machine with your permissions. Read the source before you install it.') : ''}
    </section>` : plugin.external ? `<section class="block"><h2>Contents</h2><p class="dim">This plugin lives in its own repository. Its skills and agents are listed there.</p></section>` : ''}

    ${plugin.dependencies?.length ? `<section class="block"><h2>Dependencies</h2><div class="row wrap">${plugin.dependencies.map((d) => dependencyLink(app, d)).join('')}</div></section>` : ''}

    ${item?.body ? `<section class="block"><h2>README</h2><div class="doc prose">${renderMarkdown(item.body)}</div></section>` : ''}

    <section class="block">
      <h2>Changelog</h2>
      <div class="stack">${releases.length ? releases.map((r) => `
        <div class="changelog-entry">
          <div class="row"><span class="mono strong small version">v${esc(r.version)}</span><span class="faint small">${esc(r.date)}</span>${r.kind === 'rollback' ? '<span class="badge warn">Rollback</span>' : r.kind === 'major' ? '<span class="badge accent">Breaking</span>' : ''}</div>
          <div class="dim small">${esc(r.notes.join(' · ') || 'No release notes.')}</div>
        </div>`).join('') : '<p class="dim">No releases yet.</p>'}
      </div>
    </section>
  </main>`;
}

export function renderArtifact(app, id) {
  const item = app.items.get(id);
  if (!item || item.type === 'plugin') return notFound('artifact');
  const plugin = app.plugins.get(item.plugin);
  const call = invocation(item);
  const tools = item.meta?.tools ?? [];
  const config = item.meta?.config ?? [];
  const github = sourceUrl(app, plugin, item);

  return `<main class="page narrower">
    <nav class="breadcrumb small dim" aria-label="Breadcrumb">
      <a href="#/search">Catalog</a><span class="faint"> / </span><a href="${esc(pluginHash(plugin.name))}">${esc(plugin.displayName)}</a><span class="faint"> / ${esc(item.name)}</span>
    </nav>
    <div class="row wrap">
      ${kindChip(item.type, 'large')}
      <h1 class="artifact-title">${esc(item.displayName ?? item.name)}</h1>
      ${call ? `<span class="invocation mono">${esc(call)}</span>` : ''}
    </div>
    <p class="dim lead">${item.description ? esc(item.description) : 'No description yet.'}</p>

    ${tools.length ? `<div class="meta-block"><div class="caps faint xsmall">Tools / permissions</div><div class="row wrap tight">${tools.map((t) => `<span class="tool mono">${esc(t)}</span>`).join('')}</div></div>` : ''}
    ${config.length ? `<div class="meta-block"><div class="caps faint xsmall">Asks for on install</div><div class="row wrap tight">${config.map((c) => `<span class="tool mono">${esc(c)}</span>`).join('')}</div></div>` : ''}
    ${item.type === 'hook' ? trustNote('Hooks run commands on your machine with your permissions. Read the source before you install the plugin.') : ''}
    ${item.type === 'mcp' ? trustNote('MCP servers run code on your machine with your permissions. Read the source before you install the plugin.') : ''}

    ${installBar(installCommand(app.catalog.marketplace, plugin.name), github ? `<a class="btn" href="${esc(github)}" target="_blank" rel="noopener">Source ↗</a>` : '')}
    <p class="faint small install-note">Installs the whole <a href="${esc(pluginHash(plugin.name))}">${esc(plugin.displayName)}</a> plugin. Add the marketplace first: <a href="#/get-started">Get started</a>.</p>

    <section class="block">
      <h2>Documentation</h2>
      <div class="doc prose">${item.body ? renderMarkdown(item.body) : `<p>${esc(item.description || 'No documentation yet.')}</p>`}</div>
    </section>
  </main>`;
}
