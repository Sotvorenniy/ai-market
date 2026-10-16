// Shared UI helpers: escaping, kind chips, install commands, copy with feedback, theme storage.

import { escapeHtml } from './search.js';
import { t } from './i18n.js';

export const esc = escapeHtml;

export const KINDS = ['plugin', 'skill', 'agent', 'command', 'hook', 'mcp'];
export const kindName = (kind) => t(`kind.one.${kind}`);
export const kindPlural = (kind) => t(`kind.many.${kind}`);

export const kindChip = (kind, extra = '') => `<span class="kind-chip ${extra}" style="--k:var(--kind-${esc(kind)})">${esc(kindName(kind))}</span>`;
export const kindDot = (kind) => `<span class="dot" style="--k:var(--kind-${esc(kind)})" aria-hidden="true"></span>`;

export function installCommand(marketplace, pluginName) {
  return `/plugin install ${pluginName}@${marketplace.name}`;
}

/** How to call an artifact from a Claude Code session, if it has a direct invocation. */
export function invocation(item) {
  if (item.type === 'skill' || item.type === 'command') return `/${item.plugin}:${item.name}`;
  if (item.type === 'hook') return item.meta?.event ?? '';
  return '';
}

export function githubUrl(repo, path = '') {
  return repo ? `https://github.com/${repo}${path}` : null;
}

/** Terminal-style install bar with a copy button. */
export function installBar(command, extra = '') {
  return `<div class="install-row">
    <div class="install-bar"><span class="prompt" aria-hidden="true">$</span><code>${esc(command)}</code></div>
    <button class="btn primary" type="button" data-copy="${esc(command)}" data-label="${esc(t('copy.install'))}">${esc(t('copy.install'))}</button>
    ${extra}
  </div>`;
}

/* ---------- copy ---------- */

let toastTimer;
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.querySelector('[data-toast-text]').textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 1800);
}

function fallbackCopy(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

export async function copyText(text, button) {
  let ok = true;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    ok = fallbackCopy(text);
  }
  if (!ok) {
    showToast(t('copy.blocked'));
    return;
  }
  showToast(t('copy.toast'));
  if (button) {
    const label = button.dataset.label ?? button.textContent;
    button.textContent = button.dataset.copiedLabel ?? t('copy.copied');
    button.classList.add('copied');
    setTimeout(() => {
      button.textContent = label;
      button.classList.remove('copied');
    }, 2000);
  }
}

/* ---------- theme ---------- */

export function loadTheme() {
  try {
    return localStorage.getItem('ai-market:theme') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function saveTheme(theme) {
  try {
    localStorage.setItem('ai-market:theme', theme);
  } catch {
    // Storage blocked: the choice lasts for this page view only.
  }
}
