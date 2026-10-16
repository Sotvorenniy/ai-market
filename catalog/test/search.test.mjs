import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createIndex, editDistance, escapeHtml, highlight, parseQuery, prepareConfig, search, stem, termMatch, tokens, words,
} from '../src/search.js';

const load = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const config = prepareConfig(load('../src/search-config.json'));
const sample = load('./fixtures/sample-items.json');
const golden = load('./fixtures/search-golden.json');
const index = createIndex(sample, config);
const ids = (query, idx = index) => search(idx, query).results.map((r) => r.item.id);

const item = (id, fields) => ({ id, type: 'skill', name: id, plugin: 'p', description: '', tags: [], body: '', ...fields });

/* ---------- text helpers ---------- */

test('words lowercases and splits on punctuation and hyphens', () => {
  assert.deepEqual(words('Review-PR: "Pull requests", e2e!'), ['review', 'pr', 'pull', 'requests', 'e2e']);
  assert.deepEqual(words(null), []);
});

test('stem strips a plural s only from longer words', () => {
  assert.equal(stem('tests'), 'test');
  assert.equal(stem('class'), 'class');
  assert.equal(stem('gas'), 'gas');
  assert.deepEqual(tokens('Writes tests'), ['write', 'test']);
});

test('editDistance and termMatch grade matches', () => {
  assert.equal(editDistance('review', 'reviev'), 1);
  assert.equal(editDistance('review', 'reveiw'), 1, 'a swap of neighbouring letters is one edit');
  assert.equal(editDistance('review', 'reviewers'), 2);
  assert.equal(termMatch('review', 'review'), 1);
  assert.equal(termMatch('rev', 'review'), 0.75);
  assert.equal(termMatch('reviewing', 'review'), 0.6);
  assert.equal(termMatch('reviev', 'review'), 0.55);
  assert.equal(termMatch('re', 'review'), 0);
  assert.equal(termMatch('tset', 'test'), 0, 'short words get no typo tolerance');
});

/* ---------- query parsing ---------- */

test('parseQuery drops stop words, stems terms and detects the type', () => {
  assert.deepEqual(parseQuery('I need a skill to review pull requests', config), {
    terms: ['review', 'pull', 'request'], related: [], typeHint: 'skill',
  });
});

test('parseQuery adds synonyms as related terms without duplicates', () => {
  const parsed = parseQuery('PR tests tests', config);
  assert.deepEqual(parsed.terms, ['pr', 'test']);
  assert.deepEqual(parsed.related, ['pull', 'request', 'review', 'testing']);
});

test('prepareConfig stems synonym keys so plural queries find them', () => {
  const cfg = prepareConfig({ synonyms: { tickets: ['Jira issues'] } });
  assert.deepEqual(cfg.synonyms.get('ticket'), ['jira', 'issue']);
  assert.deepEqual(cfg.fieldWeights.name, 5);
});

/* ---------- ranking ---------- */

test('field weights rank name over tags over description over body', () => {
  const idx = createIndex([
    item('in-body', { body: 'deploy' }),
    item('in-description', { description: 'deploy' }),
    item('in-tags', { tags: ['deploy'] }),
    item('deploy'),
  ], config);
  assert.deepEqual(ids('deploy', idx), ['deploy', 'in-tags', 'in-description', 'in-body']);
});

test('items matching more of the terms rank higher', () => {
  const idx = createIndex([
    item('a', { description: 'cache invalidation' }),
    item('b', { description: 'cache invalidation strategy' }),
  ], config);
  assert.deepEqual(ids('cache invalidation strategy', idx), ['b', 'a']);
});

test('the type hint boosts items of that type', () => {
  const idx = createIndex([
    item('notes-agent', { type: 'agent', description: 'meeting notes' }),
    item('notes-skill', { type: 'skill', description: 'meeting notes' }),
  ], config);
  assert.deepEqual(ids('agent for meeting notes', idx), ['notes-agent', 'notes-skill']);
  assert.deepEqual(ids('skill for meeting notes', idx), ['notes-skill', 'notes-agent']);
});

test('plugins win ties with their own components', () => {
  const idx = createIndex([item('x/skill/sync', { name: 'sync' }), item('sync', { type: 'plugin', name: 'sync' })], config);
  assert.deepEqual(ids('sync', idx), ['sync', 'x/skill/sync']);
});

test('prefix and one-typo matches are found', () => {
  assert.equal(ids('playwr')[0], 'test-writer/skill/e2e-playwright');
  assert.equal(ids('playwrigth')[0], 'test-writer/skill/e2e-playwright');
  assert.equal(ids('plawright')[0], 'test-writer/skill/e2e-playwright');
});

test('weak and unrelated matches are dropped', () => {
  assert.deepEqual(ids('kubernetes helm chart'), []);
  const idx = createIndex([item('a', { body: 'just a mention of rust' })], config);
  assert.deepEqual(ids('rust', idx), ['a'], 'a full body match passes the threshold');
  assert.deepEqual(ids('rus', createIndex([item('b', { body: 'trust' })], config)), [], 'mid-word text does not match');
});

test('empty query lists everything by name; a type word alone lists that type', () => {
  const all = search(index, '').results;
  assert.equal(all.length, sample.length);
  assert.ok(all.every((r) => r.score === 0));
  assert.deepEqual(all.map((r) => r.item.name), [...all.map((r) => r.item.name)].sort((a, b) => a.localeCompare(b)));
  const agents = search(index, 'agents').results;
  assert.ok(agents.length > 0 && agents.every((r) => r.item.type === 'agent'));
  assert.equal(search(index, 'please').results.length, sample.length, 'only stop words acts like empty');
});

// "top" is the id that must rank first, or a list of ids where any one of them may rank first.
test('golden queries rank the expected item first', () => {
  const failures = golden
    .map(({ query, top }) => ({ query, top, got: ids(query).slice(0, 3) }))
    .filter(({ top, got }) => ![top].flat().includes(got[0]));
  assert.deepEqual(failures, []);
});

/* ---------- highlighting ---------- */

test('highlight marks words that start with a term, longest term first', () => {
  assert.equal(highlight('Reviews pull-requests', ['review', 'request', 're']), '<mark>Reviews</mark> pull-<mark>requests</mark>');
  assert.equal(highlight('Prereview', ['review']), 'Prereview', 'no match inside a word');
});

test('highlight escapes HTML and never matches inside entities', () => {
  assert.equal(highlight('<i>amp & lt</i>', ['amp', 'lt']), '&lt;i&gt;<mark>amp</mark> &amp; <mark>lt</mark>&lt;/i&gt;');
  assert.equal(highlight('x &amp; y', ['amp']), 'x &amp;<mark>amp</mark>; y', 'a literal "&amp;" in the text is escaped, then matched as text');
  assert.equal(highlight('<script>', []), '&lt;script&gt;');
  assert.equal(highlight('a "quote"', ['quote']), 'a &quot;<mark>quote</mark>&quot;');
  assert.equal(escapeHtml("'"), '&#39;');
});

test('highlight ignores terms that are not plain words', () => {
  assert.equal(highlight('a.b', ['.*', 'a']), 'a.b', 'single letters and regex characters are ignored');
});

/* ---------- performance ---------- */

test('2,000 items search fast enough to run on every keystroke', () => {
  const vocab = 'review test deploy cache query schema token secret design layout article headline metric alert incident queue worker build bundle lint format'.split(' ');
  const pick = (seed, n) => Array.from({ length: n }, (_, i) => `${vocab[(seed * 7 + i * 13) % vocab.length]}${(seed + i) % 50}`);
  const items = Array.from({ length: 2000 }, (_, i) => item(`item-${i}`, {
    name: pick(i, 2).join('-'),
    tags: pick(i + 1, 3),
    description: pick(i + 2, 25).join(' '),
    body: pick(i + 3, 300).join(' '),
  }));
  const idx = createIndex(items, config);
  const queries = ['review cache', 'deploy schema token', 'I need a skill for headline metrics', 'workr', 'incident alert queue'];
  search(idx, 'warm up');
  const start = performance.now();
  for (const query of queries) search(idx, query);
  const perQuery = (performance.now() - start) / queries.length;
  assert.ok(perQuery < 60, `average ${perQuery.toFixed(1)} ms per query`);
});
