// ⌘K / Ctrl+K command palette: jump to any plugin or artifact by name.

import { search } from './search.js';
import { itemHash } from './router.js';
import { t } from './i18n.js';
import { esc, kindDot, kindName } from './ui.js';

const LIMIT = 8;

export function createPalette(app) {
  const root = document.getElementById('palette');
  const input = document.getElementById('palette-q');
  const list = document.getElementById('palette-results');
  let results = [];
  let active = 0;
  let returnFocus = null;

  function render() {
    const q = input.value;
    results = (q.trim() ? search(app.index, q).results.map((r) => r.item) : app.catalog.items).slice(0, LIMIT);
    active = Math.min(active, Math.max(results.length - 1, 0));
    list.innerHTML = results.length
      ? results.map((item, i) => `
        <a class="palette-row ${i === active ? 'active' : ''}" role="option" id="palette-opt-${i}" aria-selected="${i === active}" href="${esc(itemHash(item.id))}" data-palette-close>
          ${kindDot(item.type)}
          <span class="grow min0 ellipsis"><span class="strong">${esc(item.displayName ?? item.name)}</span> <span class="faint small">· ${esc(item.type === 'plugin' ? t('palette.plugin') : item.plugin)}</span></span>
          <span class="mono faint xsmall cap">${esc(kindName(item.type))}</span>
        </a>`).join('')
      : `<div class="palette-empty">${esc(t('palette.empty'))}</div>`;
    input.setAttribute('aria-activedescendant', results.length ? `palette-opt-${active}` : '');
  }

  function open() {
    if (!app.index) return;
    returnFocus = document.activeElement;
    input.value = '';
    active = 0;
    root.hidden = false;
    render();
    input.focus();
  }

  function close() {
    if (root.hidden) return;
    root.hidden = true;
    returnFocus?.focus?.();
  }

  input.addEventListener('input', () => {
    active = 0;
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!results.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      render();
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      location.hash = itemHash(results[active].id);
      close();
    }
  });
  root.addEventListener('click', (e) => {
    if (e.target === root || e.target.closest('[data-palette-close]')) close();
  });

  return { open, close, toggle: () => (root.hidden ? open() : close()), get isOpen() { return !root.hidden; } };
}
