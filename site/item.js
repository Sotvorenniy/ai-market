// Artifact and plugin page. See docs/specs/catalog-site.md §7.3.

import { renderMarkdown } from './markdown.js';
import { itemHash } from './router.js';
import { codeBlock, esc, formatDate, githubUrl, installSnippets, stackButton, typeChip } from './ui.js';

const INSTALL_TABS = [
  ['claude', 'In Claude Code', 'Paste one line at a time into a Claude Code session. The first line is only needed once per machine.'],
  ['terminal', 'Terminal', 'Add <code>--scope project</code> to share the plugin with everyone working in the current repository.'],
  ['settings', 'Team settings', 'Merge into <code>.claude/settings.json</code> and commit. Teammates get the plugin after they trust the folder.'],
];

function usage(item) {
  const id = `/${item.plugin}:${item.name}`;
  switch (item.type) {
    case 'skill':
      return `${codeBlock(id)}<p class="hint">Claude also loads this skill on its own when your request matches its description.</p>`;
    case 'command':
      return `${codeBlock(id)}<p class="hint">Type the command in a Claude Code session.</p>`;
    case 'agent':
      return `${codeBlock(`Use the ${item.name} agent to …`)}<p class="hint">Ask for the agent by name, or let Claude delegate to it.</p>`;
    case 'hook':
      return `<p class="lead-text">Runs automatically on <strong>${esc(item.meta?.event ?? 'its event')}</strong>.</p>`;
    case 'mcp': {
      const config = item.meta?.config ?? [];
      return `${codeBlock('/mcp')}<p class="hint">Lists the server and its tools once the plugin is enabled.</p>${config.length
        ? `<p class="hint">Claude Code asks for these values when you enable the plugin:</p><ul class="plain-list">${config.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>`
        : ''}`;
    }
    default:
      return '';
  }
}

function trustNote(item) {
  if (item.type !== 'hook' && item.type !== 'mcp') return '';
  return `<p class="note">${item.type === 'hook' ? 'Hooks run' : 'MCP servers run'} code on your machine with your permissions. Read the source before you enable the plugin.</p>`;
}

export function renderNotFound() {
  return `<div class="empty">
    <h2>This item no longer exists</h2>
    <p>It may have been renamed or removed from the marketplace.</p>
    <a class="btn" href="#/">Back to search</a>
  </div>`;
}

export function renderItem(app, id) {
  const item = app.items.get(id);
  if (!item) return renderNotFound();
  const plugin = app.plugins.get(item.plugin);
  const isPlugin = item.type === 'plugin';
  const { marketplace } = app.catalog;
  const snippets = installSnippets(marketplace, [plugin.name]);
  const tab = INSTALL_TABS.find(([key]) => key === app.installTab) ?? INSTALL_TABS[0];

  const repoUrl = githubUrl(marketplace.repo);
  const sourceUrl = plugin.external ? plugin.sourceUrl
    : repoUrl && item.path ? `${repoUrl}/${isPlugin ? 'tree' : 'blob'}/main/${item.path}` : null;
  const changelogUrl = repoUrl && !plugin.external ? `${repoUrl}/blob/main/${plugin.path}/CHANGELOG.md` : null;
  const issueUrl = repoUrl ? `${repoUrl}/issues/new?labels=${encodeURIComponent(plugin.name)}&title=${encodeURIComponent(`[${plugin.name}] `)}&body=${encodeURIComponent(
    `Artifact: ${item.type} ${item.name}\nPlugin version: ${plugin.version ?? 'unknown'}\n\nWhat happened:\n`)}` : null;

  const tagSet = new Set(item.tags ?? []);
  const related = isPlugin ? [] : [...app.items.values()]
    .filter((other) => other.plugin !== item.plugin && other.type !== 'plugin' && (other.tags ?? []).some((t) => tagSet.has(t)))
    .slice(0, 4);

  const components = isPlugin ? plugin.items.map((cid) => app.items.get(cid)).filter(Boolean) : [];
  const title = isPlugin ? plugin.name : `${plugin.name}:${item.name}`;
  const meta = [
    ['Version', plugin.version ?? '—'],
    ['Updated', formatDate(plugin.updated) || '—'],
    ['Category', plugin.category ?? '—'],
    ['Owner', plugin.owner ?? '—'],
    ['License', plugin.license ?? '—'],
  ];

  return `
    <div class="back"><button class="link-btn" type="button" data-back>← Back to results</button></div>
    <div class="detail-head">
      <div class="row">
        ${typeChip(item.type)}
        ${isPlugin ? '' : `<span class="muted">in plugin <a class="mono-link" href="${esc(itemHash(plugin.name))}">${esc(plugin.name)}</a></span>`}
        ${plugin.version ? `<span class="muted">v${esc(plugin.version)}</span>` : ''}
        ${plugin.external ? '<span class="badge">External source</span>' : ''}
      </div>
      <h1>${esc(title)}</h1>
      <p>${item.description ? esc(item.description) : '<span class="muted">No description yet.</span>'}</p>
      <div class="row">${stackButton(app.stack, plugin.name)}<div class="tags">${(item.tags ?? []).map((t) => `<button class="chip" type="button" data-example="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>
    </div>
    <div class="detail">
      <div class="column">
        <section class="panel" aria-labelledby="install-title">
          <h2 id="install-title">Install${isPlugin ? '' : ` <span class="subtle">· installs the whole ${esc(plugin.name)} plugin</span>`}</h2>
          <div class="mini-tabs" role="tablist" aria-label="Install method">
            ${INSTALL_TABS.map(([key, label]) => `<button type="button" role="tab" data-install-tab="${key}" aria-selected="${key === tab[0]}">${label}</button>`).join('')}
          </div>
          ${codeBlock(snippets[tab[0]])}
          <p class="hint">${tab[2]}</p>
        </section>
        ${isPlugin ? '' : `<section class="panel"><h2>How to use</h2>${usage(item)}${trustNote(item)}</section>`}
        ${components.length ? `<section class="panel"><h2>What's inside</h2><div class="inside">${components.map((c) => `
          <a href="${esc(itemHash(c.id))}">${typeChip(c.type)}<span class="name">${esc(c.name)}</span><span class="desc">${esc(c.description)}</span></a>`).join('')}</div></section>` : ''}
        ${isPlugin && components.some((c) => c.type === 'hook' || c.type === 'mcp') ? '<p class="note">This plugin includes hooks or MCP servers that run code on your machine with your permissions. Read the source before you enable it.</p>' : ''}
        ${item.body ? `<section class="panel"><h2>${esc(isPlugin ? 'README' : (item.path ?? '').split('/').pop() || 'Details')}</h2><div class="prose">${renderMarkdown(item.body)}</div></section>` : ''}
        ${plugin.external && !item.body ? `<section class="panel"><h2>Details</h2><p class="hint">This plugin lives in its own repository. Its skills and agents are listed there.</p></section>` : ''}
      </div>
      <aside class="column">
        <section class="panel">
          <dl class="meta">
            ${meta.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}
            <dt>Evals</dt><dd><span class="status ${plugin.hasEvals ? '' : 'warn'}">${plugin.hasEvals ? 'Included' : 'Not set up'}</span></dd>
          </dl>
          <div class="rail-links">
            ${sourceUrl ? `<a class="btn" target="_blank" rel="noopener" href="${esc(sourceUrl)}">View source</a>` : ''}
            ${changelogUrl ? `<a class="btn" target="_blank" rel="noopener" href="${esc(changelogUrl)}">Changelog</a>` : ''}
            ${issueUrl ? `<a class="btn" target="_blank" rel="noopener" href="${esc(issueUrl)}">Report a problem</a>` : ''}
          </div>
        </section>
        ${related.length ? `<section class="panel"><h2>Related</h2><div class="related">${related.map((r) => `<a href="${esc(itemHash(r.id))}">${typeChip(r.type)}<span>${esc(r.plugin)}:${esc(r.name)}</span></a>`).join('')}</div></section>` : ''}
      </aside>
    </div>`;
}
