// What's new and Get started screens.

import { releaseRow } from './home.js';
import { esc } from './ui.js';

export function renderWhatsNew(app) {
  return `<main class="page narrower">
    <a class="back" href="#/">← Home</a>
    <div class="row between page-title">
      <h1>What's new</h1>
      <a class="btn mono small" href="feed.xml" target="_blank" rel="noopener">Subscribe · RSS</a>
    </div>
    <div class="stack">${app.releases.length
      ? app.releases.map((r) => releaseRow(app, r, true)).join('')
      : '<p class="dim">No releases yet. Releases appear here when a plugin version is tagged.</p>'}
    </div>
  </main>`;
}

export function renderGetStarted(app) {
  const { marketplace, plugins } = app.catalog;
  const repo = marketplace.repo ?? '<owner>/<repo>';
  const example = plugins.find((p) => !p.external)?.name ?? plugins[0]?.name ?? '<plugin>';
  const steps = [
    ['Add the marketplace', 'Registers this catalog as a plugin source in your Claude Code. Once per machine.', `/plugin marketplace add ${repo}`],
    ['Install a plugin', 'Install any plugin from this marketplace by name.', `/plugin install ${example}@${marketplace.name}`],
    ['Stay up to date', 'Refresh the marketplace to pick up new plugins and versions, then run /reload-plugins.', `/plugin marketplace update ${marketplace.name}`],
  ];
  return `<main class="page narrowest">
    <a class="back" href="#/">← Home</a>
    <h1 class="page-title">Connect the marketplace</h1>
    <p class="dim intro">Three steps. Add the marketplace as a source first, then install individual plugins.</p>
    <ol class="steps">${steps.map(([title, desc, cmd], i) => `
      <li class="step">
        <div class="step-n mono" aria-hidden="true">${i + 1}</div>
        <div class="grow min0">
          <h3>${esc(title)}</h3>
          <p class="dim small">${esc(desc)}</p>
          <div class="install-bar inline"><span class="prompt" aria-hidden="true">$</span><code>${esc(cmd)}</code><button class="copy-link" type="button" data-copy="${esc(cmd)}" data-label="Copy" data-copied-label="✓">Copy</button></div>
        </div>
      </li>`).join('')}
    </ol>
    <div class="note-box small dim">
      <strong>marketplace update vs plugin update.</strong> The first refreshes the list of plugins and versions the marketplace offers. The second updates the code of one installed plugin: <code>/plugin update &lt;name&gt;@${esc(marketplace.name)}</code>. Automatic updates are off by default; turn them on in <code>/plugin</code> → Marketplaces.
    </div>
  </main>`;
}
