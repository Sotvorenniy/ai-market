import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { itemHash, parseHash, pluginHash, searchHash, searchState } from '../src/router.js';
import { renderMarkdown } from '../src/markdown.js';
import { KINDS, installCommand, invocation } from '../src/ui.js';
import { filterResults } from '../src/results.js';
import { topKeywords } from '../src/home.js';
import { createIndex, prepareConfig } from '../src/search.js';

const load = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

/* ---------- router ---------- */

test('parseHash recognizes every route', () => {
  assert.equal(parseHash('').view, 'home');
  assert.equal(parseHash('#/').view, 'home');
  assert.equal(parseHash('#/search?q=review').params.get('q'), 'review');
  assert.deepEqual(parseHash('#/plugin/code-review'), { view: 'plugin', params: new URLSearchParams(), name: 'code-review' });
  assert.equal(parseHash('#/item/code-review').view, 'plugin', 'old plugin links still work');
  assert.equal(parseHash('#/item/code-review/skill/review-pr').itemId, 'code-review/skill/review-pr');
  assert.equal(parseHash('#/item/code-review/command/git%3Async').itemId, 'code-review/command/git:sync');
  assert.equal(parseHash('#/whats-new').view, 'whats-new');
  assert.equal(parseHash('#/get-started').view, 'get-started');
});

test('parseHash sends unknown and malformed routes home', () => {
  assert.equal(parseHash('#/nope').view, 'home');
  assert.equal(parseHash('#/item/a/b').view, 'home');
  assert.equal(parseHash('#/item/%E0%A4%A').view, 'home');
  assert.equal(parseHash('#/search/extra').view, 'home');
});

test('searchState keeps known values and drops the rest', () => {
  const params = new URLSearchParams('q=tests&kind=skill,robot,agent&kw=react,ui&author=QA%20guild&sort=updated');
  assert.deepEqual(searchState(params, KINDS), { q: 'tests', kinds: ['skill', 'agent'], keywords: ['react', 'ui'], author: 'QA guild', sort: 'updated' });
  assert.deepEqual(searchState(new URLSearchParams('sort=random'), KINDS), { q: '', kinds: [], keywords: [], author: null, sort: 'relevance' });
});

test('searchHash omits defaults and round-trips', () => {
  assert.equal(searchHash({ q: ' ', kinds: [], keywords: [], author: null, sort: 'relevance' }), '#/search');
  const state = { q: 'review & test', kinds: ['skill', 'agent'], keywords: ['pull-request'], author: 'QA guild', sort: 'name' };
  const hash = searchHash(state);
  assert.equal(hash, '#/search?q=review+%26+test&kind=skill,agent&kw=pull-request&author=QA+guild&sort=name');
  assert.deepEqual(searchState(parseHash(hash).params, KINDS), state);
});

test('itemHash links plugins to the plugin page and encodes segments', () => {
  assert.equal(itemHash('code-review'), '#/plugin/code-review');
  assert.equal(pluginHash('a b'), '#/plugin/a%20b');
  assert.equal(itemHash('code-review/command/git:sync'), '#/item/code-review/command/git%3Async');
  assert.equal(parseHash(itemHash('code-review/command/git:sync')).itemId, 'code-review/command/git:sync');
});

/* ---------- helpers ---------- */

test('installCommand and invocation', () => {
  assert.equal(installCommand({ name: 'ai-market' }, 'code-review'), '/plugin install code-review@ai-market');
  assert.equal(invocation({ type: 'skill', plugin: 'p', name: 'review' }), '/p:review');
  assert.equal(invocation({ type: 'command', plugin: 'p', name: 'git:sync' }), '/p:git:sync');
  assert.equal(invocation({ type: 'hook', plugin: 'p', name: 'x', meta: { event: 'PreToolUse · Bash' } }), 'PreToolUse · Bash');
  assert.equal(invocation({ type: 'agent', plugin: 'p', name: 'x' }), '');
});

/* ---------- facets ---------- */

const catalog = load('./fixtures/sample-catalog.json');
const app = {
  catalog,
  plugins: new Map(catalog.plugins.map((p) => [p.name, p])),
  index: createIndex(catalog.items, prepareConfig(load('../src/search-config.json'))),
};
const base = { q: '', kinds: [], keywords: [], author: null, sort: 'relevance' };

test('facets filter by kind, keyword and author', () => {
  const skills = filterResults(app, { ...base, kinds: ['skill'] }).rows;
  assert.ok(skills.length > 0 && skills.every((i) => i.type === 'skill'));
  const tagged = filterResults(app, { ...base, keywords: ['security'] }).rows;
  assert.ok(tagged.length > 0 && tagged.every((i) => i.tags.includes('security')));
  const qa = filterResults(app, { ...base, author: 'QA guild' }).rows;
  assert.ok(qa.length > 0 && qa.every((i) => i.plugin === 'test-writer'));
});

test("facet counts ignore the facet's own selection", () => {
  const all = filterResults(app, base);
  const withKind = filterResults(app, { ...base, kinds: ['skill'] });
  assert.deepEqual([...withKind.kindCounts], [...all.kindCounts], 'kind counts stay put when a kind is selected');
  assert.ok(withKind.authorCounts.get('QA guild') < all.authorCounts.get('QA guild'), 'other facets narrow');
});

test('query and facets combine; sort by name and updated', () => {
  const { rows } = filterResults(app, { ...base, q: 'review', kinds: ['skill'] });
  assert.equal(rows[0].id, 'code-review/skill/review-pr');
  const byName = filterResults(app, { ...base, kinds: ['plugin'], sort: 'name' }).rows.map((i) => i.displayName);
  assert.deepEqual(byName, [...byName].sort((a, b) => a.localeCompare(b)));
  const byDate = filterResults(app, { ...base, kinds: ['plugin'], sort: 'updated' }).rows.map((i) => app.plugins.get(i.plugin).updated ?? '');
  assert.deepEqual(byDate, [...byDate].sort().reverse());
});

test('topKeywords ranks tags by frequency', () => {
  const top = topKeywords([{ tags: ['a', 'b'] }, { tags: ['b'] }, { tags: ['c', 'b', 'a'] }], 2);
  assert.deepEqual(top, [{ tag: 'b', count: 3 }, { tag: 'a', count: 2 }]);
});

/* ---------- markdown ---------- */

test('renderMarkdown supports the documented subset', () => {
  const html = renderMarkdown([
    '# Title', '', 'Some **bold** and `code`.', '', '- one', '- two', '', '1. first', '2. second', '',
    '```bash', 'echo "<hi>"', '```', '### Small', '[docs](https://example.com/a)',
  ].join('\n'));
  assert.equal(html, [
    '<h3>Title</h3>',
    '<p>Some <strong>bold</strong> and <code>code</code>.</p>',
    '<ul>', '<li>one</li>', '<li>two</li>', '</ul>',
    '<ol>', '<li>first</li>', '<li>second</li>', '</ol>',
    '<pre><code>echo &quot;&lt;hi&gt;&quot;</code></pre>',
    '<h4>Small</h4>',
    '<p><a href="https://example.com/a" target="_blank" rel="noopener">docs</a></p>',
  ].join('\n'));
});

test('renderMarkdown never renders raw HTML or unsafe links', () => {
  const html = renderMarkdown('<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))\n\n`<b>` **<i>**');
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<a '));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('<code>&lt;b&gt;</code>'));
  assert.ok(html.includes('<strong>&lt;i&gt;</strong>'));
});

test('renderMarkdown keeps markup characters inside inline code literal', () => {
  assert.equal(renderMarkdown('`**not bold**` and `[a](https://x.y)`'), '<p><code>**not bold**</code> and <code>[a](https://x.y)</code></p>');
});
