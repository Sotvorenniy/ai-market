// Shared helpers for the release and rollback scripts.
// Version policy: a plugin's version lives only in plugins/<name>/.claude-plugin/plugin.json.
// The marketplace entry must not declare "version" (plugin.json would silently win anyway).

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
export const UNRELEASED = '## [Unreleased]';

export class UsageError extends Error {}

export function fail(message) {
  throw new UsageError(message);
}

export function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: opts.cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export function repoRoot() {
  try {
    return git(['rev-parse', '--show-toplevel']);
  } catch {
    fail('Run this script inside the marketplace git repository.');
  }
}

export function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    fail(`Cannot read ${path}: ${err.message}`);
  }
}

export function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

export function parseArgs(argv, { flags = [], options = [] } = {}) {
  const result = { positional: [], flags: new Set(), options: {} };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      result.positional.push(arg);
    } else if (flags.includes(arg)) {
      result.flags.add(arg);
    } else if (options.includes(arg)) {
      const value = argv[++i];
      if (value === undefined || value.startsWith('--')) fail(`${arg} needs a value.`);
      result.options[arg] = value;
    } else {
      fail(`Unknown option ${arg}.`);
    }
  }
  return result;
}

export function parseVersion(version) {
  const match = SEMVER.exec(version ?? '');
  return match ? match.slice(1).map(Number) : null;
}

export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

export function bumpVersion(current, kind) {
  if (parseVersion(kind)) return kind;
  const parts = parseVersion(current);
  if (!parts) fail(`Current version "${current}" is not X.Y.Z. Pass an explicit version instead of "${kind}".`);
  const [major, minor, patch] = parts;
  switch (kind) {
    case 'major': return `${major + 1}.0.0`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'patch': return `${major}.${minor}.${patch + 1}`;
    default: fail(`Unknown bump "${kind}". Use patch, minor, major or an explicit X.Y.Z.`);
  }
}

export function tagName(plugin, version) {
  return `${plugin}--v${version}`;
}

export function pluginTags(root, plugin) {
  const prefix = `${plugin}--v`;
  return git(['tag', '--list', `${prefix}*`], { cwd: root })
    .split('\n')
    .filter(Boolean)
    .map((tag) => ({ tag, version: tag.slice(prefix.length) }))
    .filter(({ version }) => parseVersion(version))
    .sort((a, b) => compareVersions(a.version, b.version));
}

export function tagExists(root, tag) {
  return git(['tag', '--list', tag], { cwd: root }) === tag;
}

export function loadPlugin(root, name) {
  const marketplacePath = join(root, '.claude-plugin', 'marketplace.json');
  if (!existsSync(marketplacePath)) fail(`Missing ${marketplacePath}.`);
  const marketplace = readJson(marketplacePath);
  const entry = (marketplace.plugins ?? []).find((p) => p.name === name);
  if (!entry) fail(`Plugin "${name}" is not listed in .claude-plugin/marketplace.json.`);
  if (typeof entry.source !== 'string' || !entry.source.startsWith('./')) {
    fail(`Plugin "${name}" has an external source. These scripts only release plugins stored in this repo.`);
  }
  if (entry.version !== undefined) {
    fail(`The marketplace entry for "${name}" declares "version". Remove it; the version lives only in plugin.json.`);
  }

  const relDir = entry.source.replace(/^\.\//, '').replace(/\/$/, '');
  const dir = join(root, relDir);
  const manifestPath = join(dir, '.claude-plugin', 'plugin.json');
  if (!existsSync(manifestPath)) fail(`Missing ${manifestPath}.`);
  const manifest = readJson(manifestPath);
  if (manifest.name !== name) {
    fail(`Name mismatch: marketplace entry "${name}" vs plugin.json "${manifest.name}". They must be identical.`);
  }
  return { entry, relDir, dir, manifestPath, manifest, changelogPath: join(dir, 'CHANGELOG.md') };
}

export function ensureCleanTree(root) {
  const status = git(['status', '--porcelain'], { cwd: root });
  if (status) fail(`Working tree has uncommitted changes. Commit or stash them first:\n${status}`);
}

export function ensureBranch(root, expected, allowOther) {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root });
  if (branch !== expected && !allowOther) {
    fail(`You are on "${branch}". Releases are cut from "${expected}" (pass --allow-branch to override).`);
  }
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

// Inserts a released section right below "## [Unreleased]" and returns the new text.
export function insertChangelogSection(text, heading, body) {
  const index = text.indexOf(UNRELEASED);
  if (index === -1) fail(`CHANGELOG.md has no "${UNRELEASED}" section.`);
  const afterHeading = index + UNRELEASED.length;
  const nextSection = text.indexOf('\n## ', afterHeading);
  const end = nextSection === -1 ? text.length : nextSection + 1;
  const unreleased = text.slice(afterHeading, end);
  return `${text.slice(0, afterHeading)}${unreleased.replace(/\s*$/, '\n\n')}${heading}\n\n${body.trim()}\n\n${text.slice(end)}`.replace(/\n{3,}/g, '\n\n');
}

// Moves the body of "## [Unreleased]" into a new version section.
export function releaseChangelog(text, version, date) {
  const index = text.indexOf(UNRELEASED);
  if (index === -1) fail(`CHANGELOG.md has no "${UNRELEASED}" section.`);
  const afterHeading = index + UNRELEASED.length;
  const nextSection = text.indexOf('\n## ', afterHeading);
  const end = nextSection === -1 ? text.length : nextSection + 1;
  const notes = text.slice(afterHeading, end).trim();
  if (!notes) fail('Nothing to release: describe the changes under "## [Unreleased]" in CHANGELOG.md first.');
  return `${text.slice(0, afterHeading)}\n\n## [${version}] - ${date}\n\n${notes}\n\n${text.slice(end)}`.replace(/\n{3,}/g, '\n\n').replace(/\s*$/, '\n');
}

export function validate(root, paths, skip) {
  if (skip) {
    console.warn('! Skipping "claude plugin validate" (--skip-validate).');
    return;
  }
  for (const path of paths) {
    try {
      execFileSync('claude', ['plugin', 'validate', path, '--strict'], { cwd: root, stdio: 'inherit' });
    } catch (err) {
      if (err.code === 'ENOENT') fail('The "claude" CLI is not on PATH. Install Claude Code or pass --skip-validate.');
      fail(`Validation failed for ${path}. Nothing was committed.`);
    }
  }
}

export function run(main) {
  try {
    main();
  } catch (err) {
    if (err instanceof UsageError) {
      console.error(`✖ ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}
