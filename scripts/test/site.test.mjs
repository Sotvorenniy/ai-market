import { test } from 'node:test';
import assert from 'node:assert/strict';
import { browseHash, browseState, itemHash, parseHash } from '../../site/router.js';
import { renderMarkdown } from '../../site/markdown.js';
import { installSnippets } from '../../site/ui.js';

/* ---------- router ---------- */

const known = { types: ['all', 'plugin', 'skill'], categories: ['Development'] };

test('parseHash recognizes every route', () => {
  assert.equal(parseHash('').view, 'browse');
  assert.equal(parseHash('#/').view, 'browse');
  assert.equal(parseHash('#/?q=review').params.get('q'), 'review');
  assert.deepEqual({ ...parseHash('#/item/code-review') }.itemId, 'code-review');
  assert.equal(parseHash('#/item/code-review/skill/review-pr').itemId, 'code-review/skill/review-pr');
  assert.equal(parseHash('#/item/code-review/command/git%3Async').itemId, 'code-review/command/git:sync');
  assert.equal(parseHash('#/stack?plugins=a,b').view, 'stack');
  assert.equal(parseHash('#/whats-new').view, 'whats-new');
  assert.equal(parseHash('#/get-started').view, 'get-started');
});

test('parseHash sends unknown and malformed routes to browse', () => {
  assert.equal(parseHash('#/nope').view, 'browse');
  assert.equal(parseHash('#/item/a/b').view, 'browse');
  assert.equal(parseHash('#/item/%E0%A4%A').view, 'browse');
  assert.equal(parseHash('#browse').view, 'browse');
});

test('browseState keeps known values and drops the rest', () => {
  const params = new URLSearchParams('q=tests&type=skill&category=Development&sort=updated');
  assert.deepEqual(browseState(params, known), { q: 'tests', type: 'skill', category: 'Development', sort: 'updated' });
  const bad = new URLSearchParams('type=robot&category=Nope&sort=random');
  assert.deepEqual(browseState(bad, known), { q: '', type: 'all', category: 'all', sort: 'relevance' });
});

test('browseHash omits defaults and round-trips through parseHash', () => {
  assert.equal(browseHash({ q: '  ', type: 'all', category: 'all', sort: 'relevance' }), '#/');
  const hash = browseHash({ q: 'review & test', type: 'skill', category: 'Development', sort: 'relevance' });
  assert.equal(hash, '#/?q=review+%26+test&type=skill&category=Development');
  assert.deepEqual(browseState(parseHash(hash).params, known), { q: 'review & test', type: 'skill', category: 'Development', sort: 'relevance' });
});

test('itemHash encodes each segment', () => {
  assert.equal(itemHash('code-review/command/git:sync'), '#/item/code-review/command/git%3Async');
  assert.equal(parseHash(itemHash('code-review/command/git:sync')).itemId, 'code-review/command/git:sync');
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

/* ---------- install snippets ---------- */

test('installSnippets builds commands and team settings', () => {
  const s = installSnippets({ name: 'ai-market', repo: 'sotvorenniy/ai-market' }, ['code-review', 'db-helper']);
  assert.equal(s.claude, '/plugin marketplace add sotvorenniy/ai-market\n/plugin install code-review@ai-market\n/plugin install db-helper@ai-market');
  assert.equal(s.terminal.split('\n')[0], 'claude plugin marketplace add sotvorenniy/ai-market');
  assert.deepEqual(JSON.parse(s.settings), {
    extraKnownMarketplaces: { 'ai-market': { source: { source: 'github', repo: 'sotvorenniy/ai-market' } } },
    enabledPlugins: { 'code-review@ai-market': true, 'db-helper@ai-market': true },
  });
});
