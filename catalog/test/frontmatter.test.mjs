import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter } from '../scripts/lib/frontmatter.mjs';

test('parses plain, quoted and inline list values', () => {
  const { data, body, error } = parseFrontmatter(
    '---\nname: review-pr\ndescription: "Reviews a PR: checks \\"tests\\""\nother: \'it\'\'s\'\ntags: [review, "pull-request"]\n---\n# Body\n',
  );
  assert.equal(error, null);
  assert.deepEqual(data, { name: 'review-pr', description: 'Reviews a PR: checks "tests"', other: "it's", tags: ['review', 'pull-request'] });
  assert.equal(body, '# Body\n');
});

test('parses block lists, folded and literal scalars, nested maps', () => {
  const { data, error } = parseFrontmatter([
    '---',
    'description: >',
    '  First line',
    '  continues here.',
    '',
    '  New paragraph.',
    'notes: |',
    '  line one',
    '  line two',
    'tags:',
    '  - a',
    '  - b',
    'metadata:',
    '  owner: team',
    '  enabled: true',
    '---',
    '',
  ].join('\n'));
  assert.equal(error, null);
  assert.equal(data.description, 'First line continues here.\n\nNew paragraph.');
  assert.equal(data.notes, 'line one\nline two');
  assert.deepEqual(data.tags, ['a', 'b']);
  assert.deepEqual(data.metadata, { owner: 'team', enabled: true });
});

test('joins a plain scalar continued on indented lines', () => {
  const { data } = parseFrontmatter('---\ndescription: Writes tests for a module\n  using the repo framework.\n---\n');
  assert.equal(data.description, 'Writes tests for a module using the repo framework.');
});

test('handles CRLF, BOM and files without frontmatter', () => {
  assert.equal(parseFrontmatter('﻿---\r\nname: x\r\n---\r\nBody').data.name, 'x');
  const plain = parseFrontmatter('# Title\n');
  assert.deepEqual(plain.data, {});
  assert.equal(plain.body, '# Title\n');
});

test('reports unclosed frontmatter and unparseable lines', () => {
  assert.match(parseFrontmatter('---\nname: x\n').error, /not closed/);
  const { data, error } = parseFrontmatter('---\nname: x\nthis is not yaml\n---\n');
  assert.equal(data.name, 'x');
  assert.match(error, /Cannot parse line 3/);
});
