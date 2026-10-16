// UI strings. All user-facing text lives in i18n/<locale>.json; components only reference keys.

import { escapeHtml } from './search.js';

let strings = {};

export function setStrings(next) {
  strings = next ?? {};
}

export async function loadStrings(locale = 'en') {
  const response = await fetch(`i18n/${locale}.json`, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`i18n/${locale}.json returned ${response.status}.`);
  setStrings(await response.json());
}

const fill = (template, vars, format) => template.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? format(vars[name]) : match));

/** Plain text for a key with {placeholders} filled in. Missing keys return the key, so gaps are visible. */
export function t(key, vars = {}) {
  const template = strings[key];
  return template === undefined ? key : fill(template, vars, String);
}

/** HTML for a key: the template is escaped, placeholder values are inserted as given (they must be safe HTML). */
export function tHtml(key, html = {}) {
  const template = strings[key];
  return template === undefined ? escapeHtml(key) : fill(escapeHtml(template), html, String);
}

/** Picks "<key>.one" or "<key>.other" by count and fills {n}. */
export function plural(key, n, vars = {}) {
  return t(`${key}.${n === 1 ? 'one' : 'other'}`, { n, ...vars });
}

/** Fills static markup: data-i18n (text), data-i18n-placeholder, data-i18n-aria-label. */
export function applyStaticStrings(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
  for (const el of root.querySelectorAll('[data-i18n-aria-label]')) el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
}
