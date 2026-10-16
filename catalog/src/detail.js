// Plugin and artifact pages. See catalog/docs/spec.md §7.4–7.5.

import { t, tHtml } from './i18n.js';
import { renderMarkdown } from './markdown.js';
import { releaseBadge, releaseSummary } from './home.js';
import { itemHash, pluginHash } from './router.js';
import { esc, githubUrl, installBar, installCommand, invocation, kindChip, kindDot, kindPlural } from './ui.js';

const ORDER = ['skill', 'agent', 'command', 'hook', 'mcp'];

const notFound = (titleKey) => `<main class="page narrow">
  <div class="empty-block">
    <div class="empty-icon" aria-hidden="true">🔍</div>
    <h2>${esc(t(titleKey))}</h2>
    <p>${esc(t('notFound.text'))}</p>
    <div class="row center"><a class="btn primary" href="#/search">${esc(t('notFound.browse'))}</a></div>
  </div>
</main>`;

const trustNote = (key) => `<p class="trust-note">${esc(t(key))}</p>`;

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
  if (!plugin) return notFound('notFound.plugin');
  const item = app.items.get(plugin.name);
  const components = plugin.items.map((id) => app.items.get(id)).filter(Boolean);
  const groups = ORDER.map((kind) => ({ kind, items: components.filter((c) => c.type === kind) })).filter((g) => g.items.length);
  const releases = app.releases.filter((r) => r.plugin === plugin.name);
  const github = sourceUrl(app, plugin);
  const runsCode = components.some((c) => c.type === 'hook' || c.type === 'mcp');
  const facts = [plugin.owner, plugin.updated ? t('plugin.updated', { date: plugin.updated }) : null, plugin.license].filter(Boolean).join(' · ');

  return `<main class="page narrow">
    <button class="back" type="button" data-back>${esc(t('plugin.back'))}</button>
    <div class="plugin-head">
      <div class="plugin-icon" aria-hidden="true">◆</div>
      <div class="grow min0">
        <div class="row wrap">
          <h1>${esc(plugin.displayName)}</h1>
          ${plugin.version ? `<span class="version-pill mono">v${esc(plugin.version)}</span>` : ''}
          ${plugin.external ? `<span class="badge">${esc(t('plugin.external'))}</span>` : ''}
          ${plugin.hasEvals ? `<span class="ok-pill mono">${esc(t('plugin.evals'))}</span>` : ''}
        </div>
        <p class="dim">${esc(plugin.description || t('card.noDescription'))}</p>
        ${facts ? `<div class="mono faint small">${esc(facts)}</div>` : ''}
      </div>
    </div>

    ${installBar(installCommand(app.catalog.marketplace, plugin.name), github ? `<a class="btn" href="${esc(github)}" target="_blank" rel="noopener">${esc(t('plugin.github'))}</a>` : '')}

    ${groups.length ? `<section class="block">
      <h2>${esc(t('plugin.contents'))}</h2>
      <div class="stack gap16">${groups.map((g) => `
        <div>
          <div class="group-head">${kindDot(g.kind)}<span class="caps dim">${esc(kindPlural(g.kind))}</span><span class="mono faint xsmall">${g.items.length}</span></div>
          <div class="component-grid">${g.items.map((c) => `
            <a class="component" href="${esc(itemHash(c.id))}">
              <div class="row between"><span class="strong small">${esc(c.displayName ?? c.name)}</span><span class="mono accent xsmall ellipsis">${esc(invocation(c))}</span></div>
              <div class="dim xsmall ellipsis">${esc(c.description)}</div>
            </a>`).join('')}
          </div>
        </div>`).join('')}
      </div>
      ${runsCode ? trustNote('plugin.trust') : ''}
    </section>` : plugin.external ? `<section class="block"><h2>${esc(t('plugin.contents'))}</h2><p class="dim">${esc(t('plugin.externalContents'))}</p></section>` : ''}

    ${plugin.dependencies?.length ? `<section class="block"><h2>${esc(t('plugin.dependencies'))}</h2><div class="row wrap">${plugin.dependencies.map((d) => dependencyLink(app, d)).join('')}</div></section>` : ''}

    ${item?.body ? `<section class="block"><h2>${esc(t('plugin.readme'))}</h2><div class="doc prose">${renderMarkdown(item.body)}</div></section>` : ''}

    <section class="block">
      <h2>${esc(t('plugin.changelog'))}</h2>
      <div class="stack">${releases.length ? releases.map((r) => `
        <div class="changelog-entry">
          <div class="row"><span class="mono strong small version">v${esc(r.version)}</span><span class="faint small">${esc(r.date)}</span>${releaseBadge(r)}</div>
          <div class="dim small">${esc(releaseSummary(r))}</div>
        </div>`).join('') : `<p class="dim">${esc(t('release.none'))}</p>`}
      </div>
    </section>
  </main>`;
}

export function renderArtifact(app, id) {
  const item = app.items.get(id);
  if (!item || item.type === 'plugin') return notFound('notFound.artifact');
  const plugin = app.plugins.get(item.plugin);
  const call = invocation(item);
  const tools = item.meta?.tools ?? [];
  const config = item.meta?.config ?? [];
  const github = sourceUrl(app, plugin, item);
  const pills = (list) => `<div class="row wrap tight">${list.map((x) => `<span class="tool mono">${esc(x)}</span>`).join('')}</div>`;
  const pluginLink = `<a href="${esc(pluginHash(plugin.name))}">${esc(plugin.displayName)}</a>`;

  return `<main class="page narrower">
    <nav class="breadcrumb small dim" aria-label="${esc(t('artifact.breadcrumb'))}">
      <a href="#/search">${esc(t('artifact.catalog'))}</a><span class="faint"> / </span>${pluginLink}<span class="faint"> / ${esc(item.name)}</span>
    </nav>
    <div class="row wrap">
      ${kindChip(item.type, 'large')}
      <h1 class="artifact-title">${esc(item.displayName ?? item.name)}</h1>
      ${call ? `<span class="invocation mono">${esc(call)}</span>` : ''}
    </div>
    <p class="dim lead">${esc(item.description || t('card.noDescription'))}</p>

    ${tools.length ? `<div class="meta-block"><div class="caps faint xsmall">${esc(t('artifact.tools'))}</div>${pills(tools)}</div>` : ''}
    ${config.length ? `<div class="meta-block"><div class="caps faint xsmall">${esc(t('artifact.asksFor'))}</div>${pills(config)}</div>` : ''}
    ${item.type === 'hook' ? trustNote('artifact.trustHook') : ''}
    ${item.type === 'mcp' ? trustNote('artifact.trustMcp') : ''}

    ${installBar(installCommand(app.catalog.marketplace, plugin.name), github ? `<a class="btn" href="${esc(github)}" target="_blank" rel="noopener">${esc(t('artifact.source'))}</a>` : '')}
    <p class="faint small install-note">${tHtml('artifact.installNote', { plugin: pluginLink, link: `<a href="#/get-started">${esc(t('start.title'))}</a>` })}</p>

    <section class="block">
      <h2>${esc(t('artifact.documentation'))}</h2>
      <div class="doc prose">${item.body ? renderMarkdown(item.body) : `<p>${esc(item.description || t('artifact.noDocs'))}</p>`}</div>
    </section>
  </main>`;
}
