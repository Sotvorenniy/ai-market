// Small shared UI helpers: escaping, chips, code blocks, copy, toast, dates, install snippets.

import { escapeHtml } from './search.js';

export const esc = escapeHtml;

export const TYPES = [
  ['all', 'All'],
  ['plugin', 'Plugins'],
  ['skill', 'Skills'],
  ['agent', 'Agents'],
  ['command', 'Commands'],
  ['hook', 'Hooks'],
  ['mcp', 'MCP servers'],
];

const TYPE_LABELS = { plugin: 'plugin', skill: 'skill', agent: 'agent', command: 'command', hook: 'hook', mcp: 'mcp server' };

export const typeChip = (type) => `<span class="type ${esc(type)}">${esc(TYPE_LABELS[type] ?? type)}</span>`;

export function formatDate(date, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!date) return '';
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString('en-GB', options);
}

export function codeBlock(text, label = 'Copy') {
  return `<div class="code"><pre>${esc(text)}</pre><button class="btn copy" type="button" data-copy="${esc(text)}">${esc(label)}</button></div>`;
}

let toastTimer;
export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

export async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard');
  } catch {
    const pre = button?.closest('.code')?.querySelector('pre');
    if (pre) {
      const range = document.createRange();
      range.selectNodeContents(pre);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    toast('Copying is blocked here. The text is selected: press ⌘C or Ctrl+C.');
  }
}

/** Install instructions for one or more plugins of this marketplace. */
export function installSnippets(marketplace, pluginNames) {
  const repo = marketplace.repo ?? '<owner>/<repo>';
  const ids = pluginNames.map((name) => `${name}@${marketplace.name}`);
  return {
    claude: [`/plugin marketplace add ${repo}`, ...ids.map((id) => `/plugin install ${id}`)].join('\n'),
    terminal: [`claude plugin marketplace add ${repo}`, ...ids.map((id) => `claude plugin install ${id}`)].join('\n'),
    settings: JSON.stringify({
      extraKnownMarketplaces: { [marketplace.name]: { source: { source: 'github', repo } } },
      enabledPlugins: Object.fromEntries(ids.map((id) => [id, true])),
    }, null, 2),
  };
}

export function stackButton(stack, name, compact = false) {
  const on = stack.has(name);
  const label = on ? '✓ In stack' : compact ? '+ Stack' : '+ Add to stack';
  return `<button class="btn ${on ? 'on' : ''}" type="button" data-stack="${esc(name)}" aria-pressed="${on}">${label}</button>`;
}

export function githubUrl(repo, path = '') {
  return repo ? `https://github.com/${repo}${path}` : null;
}
