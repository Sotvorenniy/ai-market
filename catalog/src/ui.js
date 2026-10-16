// Shared UI helpers: escaping, kind chips, install commands, copy with feedback, theme storage.

import { escapeHtml } from './search.js';

export const esc = escapeHtml;

export const KINDS = ['plugin', 'skill', 'agent', 'command', 'hook', 'mcp'];
export const KIND_PLURAL = { plugin: 'plugins', skill: 'skills', agent: 'agents', command: 'commands', hook: 'hooks', mcp: 'MCP' };
const KIND_SINGULAR = { plugin: 'plugin', skill: 'skill', agent: 'agent', command: 'command', hook: 'hook', mcp: 'MCP' };

export const kindChip = (kind, extra = '') => `<span class="kind-chip ${extra}" style="--k:var(--kind-${esc(kind)})">${esc(KIND_SINGULAR[kind] ?? kind)}</span>`;
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
    <button class="btn primary" type="button" data-copy="${esc(command)}" data-label="Copy install">Copy install</button>
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
    showToast('Copying is blocked in this browser. Select the command and copy it manually.');
    return;
  }
  showToast('Copied to clipboard');
  if (button) {
    const label = button.dataset.label ?? button.textContent;
    button.textContent = button.dataset.copiedLabel ?? 'Copied ✓';
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
