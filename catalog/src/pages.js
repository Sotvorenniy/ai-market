// What's new and Get started screens.

import { t, tHtml } from './i18n.js';
import { releaseRow } from './home.js';
import { esc } from './ui.js';

export function renderWhatsNew(app) {
  return `<main class="page narrower">
    <a class="back" href="#/">${esc(t('whatsNew.home'))}</a>
    <div class="row between page-title">
      <h1>${esc(t('whatsNew.title'))}</h1>
      <a class="btn mono small" href="feed.xml" target="_blank" rel="noopener">${esc(t('whatsNew.rss'))}</a>
    </div>
    <div class="stack">${app.releases.length
      ? app.releases.map((r) => releaseRow(app, r, true)).join('')
      : `<p class="dim">${esc(t('whatsNew.empty'))}</p>`}
    </div>
  </main>`;
}

export function renderGetStarted(app) {
  const { marketplace, plugins } = app.catalog;
  const repo = marketplace.repo ?? '<owner>/<repo>';
  const example = plugins.find((p) => !p.external)?.name ?? plugins[0]?.name ?? '<plugin>';
  const steps = [
    ['start.step1Title', 'start.step1Text', `/plugin marketplace add ${repo}`],
    ['start.step2Title', 'start.step2Text', `/plugin install ${example}@${marketplace.name}`],
    ['start.step3Title', 'start.step3Text', `/plugin marketplace update ${marketplace.name}`],
  ];
  return `<main class="page narrowest">
    <a class="back" href="#/">${esc(t('whatsNew.home'))}</a>
    <h1 class="page-title">${esc(t('start.heading'))}</h1>
    <p class="dim intro">${esc(t('start.intro'))}</p>
    <ol class="steps">${steps.map(([title, text, cmd], i) => `
      <li class="step">
        <div class="step-n mono" aria-hidden="true">${i + 1}</div>
        <div class="grow min0">
          <h3>${esc(t(title))}</h3>
          <p class="dim small">${esc(t(text))}</p>
          <div class="install-bar inline"><span class="prompt" aria-hidden="true">$</span><code>${esc(cmd)}</code><button class="copy-link" type="button" data-copy="${esc(cmd)}" data-label="${esc(t('copy.copy'))}" data-copied-label="${esc(t('copy.copiedShort'))}">${esc(t('copy.copy'))}</button></div>
        </div>
      </li>`).join('')}
    </ol>
    <div class="note-box small dim">
      <strong>${esc(t('start.noteTitle'))}</strong> ${tHtml('start.noteText', {
        command: `<code>/plugin update &lt;name&gt;@${esc(marketplace.name)}</code>`,
        menu: `<code>/plugin</code> → ${esc(t('start.marketplacesTab'))}`,
      })}
    </div>
  </main>`;
}
