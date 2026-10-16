import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  BODY_LIMIT, BuildError, buildCatalog, buildFeed, changelogNotes, pagesUrl, repoFromRemote, trimBody,
} from '../scripts/build.mjs';

const NOW = new Date('2026-10-16T12:00:00Z');
const dirs = [];

function makeRepo(files) {
  const root = mkdtempSync(join(tmpdir(), 'ai-market-test-'));
  dirs.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  return root;
}

function git(root, ...args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GIT_AUTHOR_DATE: '2026-10-01T10:00:00Z', GIT_COMMITTER_DATE: '2026-10-01T10:00:00Z' },
  });
}

function commitAll(root, message, date) {
  const env = { ...process.env, GIT_AUTHOR_DATE: `${date}T10:00:00Z`, GIT_COMMITTER_DATE: `${date}T10:00:00Z` };
  execFileSync('git', ['add', '-A'], { cwd: root, env });
  execFileSync('git', ['commit', '-q', '-m', message], { cwd: root, env });
}

function tag(root, name, date) {
  const env = { ...process.env, GIT_COMMITTER_DATE: `${date}T10:00:00Z` };
  execFileSync('git', ['tag', '-a', name, '-m', name], { cwd: root, env });
}

function initGit(root) {
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test');
}

const marketplace = (plugins, extra = {}) => ({
  name: 'ai-market', description: 'Test marketplace', owner: { name: 'Marketplace team' }, plugins, ...extra,
});

after(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

/* ---------- full fixture ---------- */

let full;
before(() => {
  const root = makeRepo({
    '.claude-plugin/marketplace.json': marketplace([
      { name: 'code-review', source: './plugins/code-review', description: 'Reviews pull requests.', category: 'Development', tags: ['review'] },
      { name: 'custom-paths', source: './plugins/custom-paths', category: 'Productivity' },
      { name: 'remote-tool', source: { source: 'github', repo: 'acme/remote-tool', ref: 'v1.0.0' }, description: 'Lives elsewhere.', version: '1.0.0', category: 'Development' },
    ]),
    'plugins/code-review/.claude-plugin/plugin.json': {
      name: 'code-review', version: '1.4.0', description: 'Manifest description.', author: { name: 'Platform team' }, license: 'MIT',
      dependencies: ['security-guard', { name: 'tokens', marketplace: 'other' }, { bad: true }],
      userConfig: { JIRA_TOKEN: { title: 'Jira API token', sensitive: true } },
    },
    'plugins/code-review/README.md': '# Code review\n\nInstall and enjoy.\n',
    'plugins/code-review/skills/review-pr/SKILL.md': '---\nname: review-pr\ndescription: Reviews a diff. Use when asked for a review.\ntags: [diff, pull-request]\n---\n# Review\n\nSteps.\n',
    'plugins/code-review/skills/no-frontmatter/SKILL.md': '# Missing frontmatter\n',
    'plugins/code-review/agents/code-reviewer.md': '---\nname: code-reviewer\ndisplayName: Code Reviewer\ndescription: Read-only reviewer.\ntools: Read, Grep, Glob\nmodel: sonnet\n---\nPrompt.\n',
    'plugins/code-review/commands/review.md': '---\ndescription: Run the review.\n---\nDo it.\n',
    'plugins/code-review/commands/git/sync.md': '---\ndescription: Sync branch.\n---\n',
    'plugins/code-review/hooks/hooks.json': {
      description: 'Guardrails.',
      hooks: {
        PreToolUse: [{ matcher: 'Bash', description: 'Blocks dangerous commands.', hooks: [{ type: 'command', command: 'x.sh' }] }],
        SessionStart: [{ hooks: [{ type: 'command', command: 'y.sh' }] }],
      },
    },
    'plugins/code-review/.mcp.json': {
      mcpServers: {
        jira: { command: 'node', args: ['server.js'], env: { TOKEN: '${user_config.JIRA_TOKEN}', SECRET_URL: 'https://internal.example' } },
        docs: { type: 'http', url: 'https://docs.example/mcp', description: 'Docs search.' },
      },
    },
    'plugins/code-review/evals/basic/prompt.md': 'Review this.\n',
    'plugins/custom-paths/.claude-plugin/plugin.json': {
      name: 'custom-paths', description: 'Uses manifest paths.', keywords: ['paths'],
      skills: ['./extra-skills/'], agents: ['./roles/helper.md'],
      commands: { status: { source: './cmd/status.md', description: 'Show status.' } },
      hooks: { PostToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'fmt.sh' }] }] },
      mcpServers: { inline: { command: 'run' } },
    },
    'plugins/custom-paths/skills/default-skill/SKILL.md': '---\nname: default-skill\ndescription: From the default folder.\n---\n',
    'plugins/custom-paths/extra-skills/extra/SKILL.md': '---\nname: extra\ndescription: From a manifest path.\n---\n',
    'plugins/custom-paths/agents/ignored.md': '---\nname: ignored\ndescription: Replaced by the manifest.\n---\n',
    'plugins/custom-paths/roles/helper.md': '---\nname: helper\ndescription: Helper agent.\n---\n',
    'plugins/custom-paths/cmd/status.md': '---\ndescription: File description.\n---\n',
  });
  initGit(root);
  commitAll(root, 'init', '2026-10-01');
  writeFileSync(join(root, 'plugins/code-review/README.md'), '# Code review\n\nUpdated.\n');
  commitAll(root, 'update', '2026-10-09');
  full = { root, ...buildCatalog({ root, repo: 'sotvorenniy/ai-market', now: NOW }) };
});

const item = (id) => full.catalog.items.find((i) => i.id === id);

test('catalog header and marketplace data', () => {
  const { catalog } = full;
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.generatedAt, '2026-10-16T12:00:00.000Z');
  assert.match(catalog.commit, /^[0-9a-f]{7,}$/);
  assert.deepEqual(catalog.marketplace, { name: 'ai-market', repo: 'sotvorenniy/ai-market', description: 'Test marketplace' });
  assert.deepEqual(catalog.categories, ['Development', 'Productivity']);
});

test('plugin fields follow the source precedence', () => {
  const plugin = full.catalog.plugins.find((p) => p.name === 'code-review');
  assert.equal(plugin.description, 'Reviews pull requests.'); // entry wins over plugin.json
  assert.equal(plugin.version, '1.4.0');
  assert.equal(plugin.owner, 'Platform team');
  assert.equal(plugin.license, 'MIT');
  assert.equal(plugin.updated, '2026-10-09');
  assert.equal(plugin.hasEvals, true);
  assert.equal(plugin.path, 'plugins/code-review');
  assert.deepEqual(plugin.tags, ['review']);
  assert.deepEqual(plugin.dependencies, ['security-guard', 'tokens@other']);
  assert.equal(item('code-review').displayName, 'code-review');

  const custom = full.catalog.plugins.find((p) => p.name === 'custom-paths');
  assert.equal(custom.description, 'Uses manifest paths.');
  assert.deepEqual(custom.tags, ['paths']);
  assert.equal(custom.owner, 'Marketplace team');
  assert.equal(custom.hasEvals, false);
});

test('plugins are also search items with their README as body', () => {
  const p = item('code-review');
  assert.equal(p.type, 'plugin');
  assert.match(p.body, /Updated\./);
});

test('skills, agents and commands are read from default folders', () => {
  const skill = item('code-review/skill/review-pr');
  assert.equal(skill.description, 'Reviews a diff. Use when asked for a review.');
  assert.deepEqual(skill.tags, ['diff', 'pull-request']);
  assert.equal(skill.path, 'plugins/code-review/skills/review-pr/SKILL.md');
  assert.equal(skill.body, '# Review\n\nSteps.');
  const agent = item('code-review/agent/code-reviewer');
  assert.equal(agent.description, 'Read-only reviewer.');
  assert.equal(agent.displayName, 'Code Reviewer');
  assert.deepEqual(agent.meta, { tools: ['Read', 'Grep', 'Glob'], model: 'sonnet' });
  assert.equal(skill.displayName, 'review-pr', 'displayName falls back to the name');
  assert.equal(item('code-review/command/review').description, 'Run the review.');
  assert.ok(item('code-review/command/git:sync'), 'nested command uses a colon namespace');
});

test('components without their own tags inherit plugin tags; missing descriptions warn', () => {
  const skill = item('code-review/skill/no-frontmatter');
  assert.deepEqual(skill.tags, ['review']);
  assert.equal(skill.description, '');
  assert.ok(full.warnings.some((w) => w.includes('no-frontmatter/SKILL.md') && w.includes('description')));
});

test('hooks become one item per event and matcher', () => {
  const bash = item('code-review/hook/pretooluse-bash');
  assert.equal(bash.description, 'Blocks dangerous commands.');
  assert.deepEqual(bash.meta, { event: 'PreToolUse · Bash' });
  assert.equal(bash.displayName, 'PreToolUse · Bash');
  assert.equal(item('code-review/hook/sessionstart').description, 'Guardrails.');
});

test('MCP servers publish only transport and option titles', () => {
  const jira = item('code-review/mcp/jira');
  assert.deepEqual(jira.meta, { transport: 'stdio', config: ['Jira API token'] });
  assert.equal(jira.description, 'MCP server "jira" (stdio).');
  assert.equal(item('code-review/mcp/docs').description, 'Docs search.');
  const json = JSON.stringify(full.catalog);
  assert.ok(!json.includes('internal.example'), 'server env is not published');
  assert.ok(!json.includes('server.js'), 'server command is not published');
});

test('manifest paths add skills and replace agents and commands', () => {
  const ids = full.catalog.plugins.find((p) => p.name === 'custom-paths').items;
  assert.deepEqual(ids, [
    'custom-paths/skill/default-skill',
    'custom-paths/skill/extra',
    'custom-paths/agent/helper',
    'custom-paths/command/status',
    'custom-paths/hook/posttooluse-write',
    'custom-paths/mcp/inline',
  ]);
  assert.equal(item('custom-paths/command/status').description, 'Show status.');
});

test('external plugins are listed with entry data and no items', () => {
  const remote = full.catalog.plugins.find((p) => p.name === 'remote-tool');
  assert.equal(remote.external, true);
  assert.equal(remote.sourceUrl, 'https://github.com/acme/remote-tool');
  assert.equal(remote.version, '1.0.0');
  assert.deepEqual(remote.items, []);
  assert.deepEqual(item('remote-tool').meta, { external: true });
});

/* ---------- failures and warnings ---------- */

test('fails on missing or invalid marketplace.json', () => {
  assert.throws(() => buildCatalog({ root: makeRepo({ 'README.md': 'x' }) }), BuildError);
  assert.throws(() => buildCatalog({ root: makeRepo({ '.claude-plugin/marketplace.json': '{ nope' }) }), /not valid JSON/);
});

test('fails when a relative source folder is missing or escapes the repo', () => {
  const missing = makeRepo({ '.claude-plugin/marketplace.json': marketplace([{ name: 'gone', source: './plugins/gone' }]) });
  assert.throws(() => buildCatalog({ root: missing }), /does not exist/);
  const escaping = makeRepo({ '.claude-plugin/marketplace.json': marketplace([{ name: 'up', source: './../up' }]) });
  assert.throws(() => buildCatalog({ root: escaping }), /must not contain/);
});

test('fails on duplicate plugin names', () => {
  const root = makeRepo({
    '.claude-plugin/marketplace.json': marketplace([{ name: 'a', source: './plugins/a' }, { name: 'a', source: './plugins/a' }]),
    'plugins/a/README.md': 'x',
  });
  assert.throws(() => buildCatalog({ root }), /Duplicate plugin name/);
});

test('resolves bare sources with metadata.pluginRoot', () => {
  const root = makeRepo({
    '.claude-plugin/marketplace.json': marketplace([{ name: 'bare', source: 'bare', description: 'Bare.' }], { metadata: { pluginRoot: './plugins' } }),
    'plugins/bare/skills/s/SKILL.md': '---\nname: s\ndescription: d\n---\n',
  });
  const { catalog } = buildCatalog({ root });
  assert.equal(catalog.plugins[0].path, 'plugins/bare');
  assert.equal(catalog.plugins[0].updated, null);
});

test('bad plugin content becomes warnings, not failures', () => {
  const root = makeRepo({
    '.claude-plugin/marketplace.json': marketplace([{ name: 'broken', source: './plugins/broken' }]),
    'plugins/broken/.claude-plugin/plugin.json': '{ invalid',
    'plugins/broken/hooks/hooks.json': '[',
    'plugins/broken/skills/x/SKILL.md': '---\nname: x\n',
  });
  const { catalog, warnings } = buildCatalog({ root });
  assert.equal(catalog.plugins.length, 1);
  assert.ok(warnings.some((w) => w.includes('plugin.json: invalid JSON')));
  assert.ok(warnings.some((w) => w.includes('hooks.json: invalid JSON')));
  assert.ok(warnings.some((w) => w.includes('not closed')));
  assert.ok(warnings.some((w) => w.includes('no description')));
});

test('warns when plugin.json name differs from the entry', () => {
  const root = makeRepo({
    '.claude-plugin/marketplace.json': marketplace([{ name: 'one', source: './plugins/one', description: 'x' }]),
    'plugins/one/.claude-plugin/plugin.json': { name: 'two' },
  });
  assert.ok(buildCatalog({ root }).warnings.some((w) => w.includes('differs')));
});

/* ---------- releases ---------- */

test('releases come from tags and changelog sections', () => {
  const root = makeRepo({
    '.claude-plugin/marketplace.json': marketplace([{ name: 'tool', source: './plugins/tool', description: 'x' }]),
    'plugins/tool/.claude-plugin/plugin.json': { name: 'tool', version: '1.0.0' },
    'plugins/tool/CHANGELOG.md': [
      '# Changelog', '', '## [Unreleased]', '',
      '## [2.0.1] - 2026-10-10', '', '### Rolled back', '', '- Restored v1.1.0.', '',
      '## [2.0.0] - 2026-10-08', '', '### Changed', '- one', '- two', '- three', '- four', '- five', '- six', '- seven', '- eight', '',
      '## [1.1.0] - 2026-10-05', '', '* Added a skill', '',
      '## [1.0.0] - 2026-10-01', '', '- Initial', '',
    ].join('\n'),
  });
  initGit(root);
  commitAll(root, 'init', '2026-10-01');
  tag(root, 'tool--v1.0.0', '2026-10-01');
  tag(root, 'tool--v1.1.0', '2026-10-05');
  tag(root, 'tool--v2.0.0', '2026-10-08');
  tag(root, 'tool--v2.0.1', '2026-10-10');
  tag(root, 'removed--v1.0.0', '2026-10-11');
  tag(root, 'not-a-release', '2026-10-11');

  const { releases } = buildCatalog({ root });
  assert.deepEqual(releases.map((r) => [r.version, r.kind, r.date]), [
    ['2.0.1', 'rollback', '2026-10-10'],
    ['2.0.0', 'major', '2026-10-08'],
    ['1.1.0', 'release', '2026-10-05'],
    ['1.0.0', 'release', '2026-10-01'],
  ]);
  assert.deepEqual(releases[1].notes, ['one', 'two', 'three', 'four', 'five', 'six', 'and 2 more']);
  assert.deepEqual(releases[2].notes, ['Added a skill']);
  assert.ok(releases.every((r) => r.plugin === 'tool'), 'tags of removed plugins are skipped');
});

test('releases are empty outside git', () => {
  const root = makeRepo({
    '.claude-plugin/marketplace.json': marketplace([{ name: 'a', source: './plugins/a', description: 'x' }]),
    'plugins/a/README.md': 'x',
  });
  assert.deepEqual(buildCatalog({ root }).releases, []);
});

/* ---------- helpers ---------- */

test('changelogNotes finds a version section and ignores others', () => {
  const text = '## [1.2.0] - 2026-01-01\n- a\n## [1.2.0-beta]\n- b\n';
  assert.deepEqual(changelogNotes(text, '1.2.0'), { notes: ['a'], rolledBack: false });
  assert.deepEqual(changelogNotes(text, '9.9.9'), { notes: [], rolledBack: false });
});

test('trimBody caps long bodies', () => {
  const long = `${'x'.repeat(BODY_LIMIT)}\nmore`;
  const trimmed = trimBody(long);
  assert.ok(trimmed.length <= BODY_LIMIT + 3);
  assert.ok(trimmed.endsWith('…'));
  assert.equal(trimBody('  short  '), 'short');
});

test('pagesUrl derives the GitHub Pages address', () => {
  assert.equal(pagesUrl('Sotvorenniy/ai-market'), 'https://sotvorenniy.github.io/ai-market/');
  assert.equal(pagesUrl(null), null);
});

test('buildFeed writes a valid, escaped Atom feed', () => {
  const feed = buildFeed([
    { plugin: 'a&b', version: '1.1.0', date: '2026-10-10', kind: 'rollback', notes: ['Fixed <tags>'] },
    { plugin: 'c', version: '1.0.0', date: '2026-10-01', kind: 'release', notes: [] },
  ], { title: 'ai-market releases', siteUrl: 'https://sotvorenniy.github.io/ai-market/' });
  assert.match(feed, /^<\?xml version="1.0" encoding="utf-8"\?>/);
  assert.match(feed, /<updated>2026-10-10T00:00:00Z<\/updated>/);
  assert.ok(feed.includes('<title>a&amp;b v1.1.0 (rollback)</title>'));
  assert.ok(feed.includes('<summary>Fixed &lt;tags&gt;</summary>'));
  assert.ok(feed.includes('<link href="https://sotvorenniy.github.io/ai-market/#/plugin/a%26b"/>'));
  assert.ok(feed.includes('<summary>No release notes.</summary>'));
  assert.equal((feed.match(/<entry>/g) ?? []).length, 2);
});

test('repoFromRemote parses GitHub remotes', () => {
  assert.equal(repoFromRemote('git@github.com:sotvorenniy/ai-market.git'), 'sotvorenniy/ai-market');
  assert.equal(repoFromRemote('https://github.com/sotvorenniy/ai-market'), 'sotvorenniy/ai-market');
  assert.equal(repoFromRemote('https://gitlab.com/a/b.git'), null);
  assert.equal(repoFromRemote(null), null);
});
