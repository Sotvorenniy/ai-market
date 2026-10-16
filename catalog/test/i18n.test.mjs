import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { plural, setStrings, t, tHtml } from '../src/i18n.js';
import { KINDS } from '../src/ui.js';

const src = new URL('../src/', import.meta.url);
const strings = JSON.parse(readFileSync(new URL('i18n/en.json', src), 'utf8'));
const sources = readdirSync(src).filter((f) => /\.(js|html)$/.test(f)).map((f) => [f, readFileSync(new URL(f, src), 'utf8')]);

test('t, tHtml and plural fill placeholders', () => {
  setStrings({ hello: 'Hi {name}', html: 'A <b>{x}</b> & {y}', 'n.one': '{n} item', 'n.other': '{n} items' });
  assert.equal(t('hello', { name: 'Ann' }), 'Hi Ann');
  assert.equal(t('hello'), 'Hi {name}', 'unknown placeholders stay visible');
  assert.equal(t('missing.key'), 'missing.key', 'missing keys show the key');
  assert.equal(tHtml('html', { x: '<i>ok</i>', y: '1' }), 'A &lt;b&gt;<i>ok</i>&lt;/b&gt; &amp; 1');
  assert.equal(plural('n', 1), '1 item');
  assert.equal(plural('n', 3), '3 items');
  setStrings({});
});

test('every key used in the code exists in en.json', () => {
  const missing = [];
  for (const [file, text] of sources) {
    const used = [
      ...[...text.matchAll(/\b(?:t|tHtml)\('([^']+)'/g)].map((m) => m[1]),
      ...[...text.matchAll(/\bplural\('([^']+)'/g)].flatMap((m) => [`${m[1]}.one`, `${m[1]}.other`]),
      ...[...text.matchAll(/data-i18n(?:-placeholder|-aria-label)?="([^"]+)"/g)].map((m) => m[1]),
    ];
    for (const key of used) if (!(key in strings)) missing.push(`${file}: ${key}`);
  }
  for (const kind of KINDS) for (const form of ['one', 'many']) if (!(`kind.${form}.${kind}` in strings)) missing.push(`kind.${form}.${kind}`);
  assert.deepEqual(missing, []);
});

test('every key in en.json is used somewhere', () => {
  const all = sources.map(([, text]) => text).join('\n');
  const dynamic = [/^kind\.(one|many)\./, /^search\.count\./];
  const unused = Object.keys(strings).filter((key) => !dynamic.some((re) => re.test(key)) && !all.includes(`'${key}'`) && !all.includes(`"${key}"`));
  assert.deepEqual(unused, []);
});

test('components contain no hard-coded English copy', () => {
  // Text between tags in template literals should come from t(); allow symbols, numbers and placeholders only.
  // Slash commands such as <code>/plugin</code> are product syntax, not copy.
  const views = ['app.js', 'home.js', 'results.js', 'detail.js', 'pages.js', 'palette.js', 'ui.js'];
  const offenders = [];
  for (const [file, text] of sources) {
    if (!views.includes(file)) continue;
    for (const m of text.matchAll(/>([^<>${}`'"\n]*[A-Za-z]{3,}[^<>${}`'"\n]*)<\//g)) {
      if (!m[1].trim().startsWith('/')) offenders.push(`${file}: ${m[1].trim()}`);
    }
    for (const m of text.matchAll(/<\/code>\s*([^<>${}`'"\n]*[A-Za-z]{3,}[^<>${}`'"\n]*)/g)) offenders.push(`${file}: ${m[1].trim()}`);
  }
  assert.deepEqual(offenders, []);
});
