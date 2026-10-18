#!/usr/bin/env node
// Install every plugin from a marketplace the way a user would and check that each one loads.
//
//   npm run install-check [-- <marketplace source>]
//
// The source is anything "/plugin marketplace add" accepts: a local path (default: this checkout),
// "owner/repo" for the latest channel on GitHub, or "owner/repo#stable" for the stable channel.
//
// "claude plugin validate" checks manifests one at a time; it does not resolve dependency version ranges.
// This script adds the marketplace to a throwaway Claude Code config directory, installs every plugin it
// lists, and fails when a plugin does not load (for example a dependency range that no released version
// satisfies), when a file of the plugin is missing from the installed copy in the plugin cache, or, for a
// git-subdir entry, when its "sha" is not the commit of its "ref" or not the commit that got installed.
// Your own Claude Code config is never touched.
//
// git-subdir entries must point at this repository: their files and manifest are read from its history,
// so run the check from a clone that has the commits and tags (CI checks out with fetch-depth: 0).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fail, git, parseArgs, readJson, repoRoot, run } from './lib/repo.mjs';

const USAGE = 'Usage: npm run install-check [-- <marketplace source>]';

function claude(args, env) {
  try {
    return execFileSync('claude', args, { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    if (err.code === 'ENOENT') fail('The "claude" CLI is not on PATH. Install Claude Code first.');
    fail(`claude ${args.join(' ')} failed:\n${err.stderr || err.stdout || err.message}`);
  }
}

function listFiles(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .filter((path) => !path.split('/').includes('.git'));
}

// Where a marketplace entry's files come from: a folder of the marketplace, or a commit of this repository.
function pluginSource(root, marketplaceDir, entry) {
  if (typeof entry.source === 'string') {
    const dir = join(marketplaceDir, entry.source);
    return {
      files: () => listFiles(dir),
      manifest: () => readJson(join(dir, '.claude-plugin', 'plugin.json')),
    };
  }
  if (entry.source?.source !== 'git-subdir') {
    fail(`${entry.name}: source type "${entry.source?.source}" is not supported by this check.`);
  }
  const { path, ref, sha } = entry.source;
  const commit = sha ?? ref;
  try {
    git(['cat-file', '-e', `${commit}^{commit}`], { cwd: root });
  } catch {
    fail(`${entry.name}: ${commit} is not in this clone. Fetch the full history and tags (git fetch --tags --unshallow).`);
  }
  try {
    git(['cat-file', '-e', `${commit}:${path}/.claude-plugin/plugin.json`], { cwd: root });
  } catch {
    fail(`${entry.name}: ${path}/.claude-plugin/plugin.json does not exist at ${commit}. Check the entry's "path".`);
  }
  // Claude Code installs the sha when both are set, so a sha that is not the ref's commit ships other code.
  const resolved = git(['rev-parse', `${commit}^{commit}`], { cwd: root });
  const refCommit = sha && ref ? git(['rev-list', '-n', '1', ref], { cwd: root }) : resolved;
  if (refCommit !== resolved) fail(`${entry.name}: sha ${sha} is not the commit of ref ${ref} (${refCommit}).`);
  return {
    commit: resolved,
    files: () => git(['ls-tree', '-r', '--name-only', commit, '--', `${path}/`], { cwd: root })
      .split('\n').filter(Boolean).map((file) => relative(path, file)),
    manifest: () => JSON.parse(git(['show', `${commit}:${path}/.claude-plugin/plugin.json`], { cwd: root })),
  };
}

function dependencyOrder(entries, sources) {
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const ordered = [];
  const visit = (entry, path = []) => {
    if (ordered.includes(entry)) return;
    if (path.includes(entry.name)) fail(`Dependency cycle: ${[...path, entry.name].join(' → ')}`);
    for (const dep of sources.get(entry.name).manifest().dependencies ?? []) {
      const name = typeof dep === 'string' ? dep.split('@')[0] : dep.name;
      if (byName.has(name)) visit(byName.get(name), [...path, entry.name]);
    }
    ordered.push(entry);
  };
  entries.forEach((entry) => visit(entry));
  return ordered;
}

run(() => {
  const args = parseArgs(process.argv.slice(2));
  if (args.positional.length > 1) fail(USAGE);

  const root = repoRoot();
  const source = args.positional[0] ?? root;
  const configDir = mkdtempSync(join(tmpdir(), 'ai-market-install-check-'));
  const env = { ...process.env, CLAUDE_CONFIG_DIR: configDir };
  const problems = [];
  let count = 0;

  try {
    claude(['plugin', 'marketplace', 'add', source], env);
    // A fresh config holds only the marketplace just added. Read the catalog from its copy, not from
    // this checkout: for a GitHub source the two can differ.
    const [added] = JSON.parse(claude(['plugin', 'marketplace', 'list', '--json'], env));
    const marketplace = readJson(join(added.installLocation, '.claude-plugin', 'marketplace.json'));
    const sources = new Map(marketplace.plugins.map((entry) => [entry.name, pluginSource(root, added.installLocation, entry)]));
    count = marketplace.plugins.length;
    console.log(`Marketplace ${marketplace.name} from ${source}`);

    // Dependencies first: a plugin pulled in as a dependency is copied from its release commit, not from
    // this checkout, so unreleased files in it would look missing.
    for (const entry of dependencyOrder(marketplace.plugins, sources)) {
      claude(['plugin', 'install', `${entry.name}@${marketplace.name}`], env);
    }

    const installed = JSON.parse(claude(['plugin', 'list', '--json'], env));
    // "plugin list" does not report the installed commit; the CLI's own record does.
    const records = readJson(join(configDir, 'plugins', 'installed_plugins.json')).plugins ?? {};
    for (const entry of marketplace.plugins) {
      const id = `${entry.name}@${marketplace.name}`;
      const src = sources.get(entry.name);
      const plugin = installed.find((p) => p.id === id);
      if (!plugin) {
        problems.push(`${id}: not installed`);
        continue;
      }
      for (const error of plugin.errors ?? []) problems.push(`${id}: ${error}`);

      if (src.commit) {
        const expected = src.manifest().version;
        if (plugin.version !== expected) problems.push(`${id}: installed ${plugin.version}, the pinned commit has ${expected}`);
        const installedSha = records[id]?.[0]?.gitCommitSha;
        if (installedSha && installedSha !== src.commit) problems.push(`${id}: installed commit ${installedSha}, pinned ${src.commit}`);
      }

      // Supporting files (scripts, references) must survive the copy into the plugin cache.
      if (existsSync(plugin.installPath)) {
        const cached = new Set(listFiles(plugin.installPath));
        for (const file of src.files()) {
          if (!file.startsWith('evals/results/') && !cached.has(file)) problems.push(`${id}: ${file} is missing from the plugin cache`);
        }
      }
      console.log(`${problems.some((p) => p.startsWith(id)) ? '✘' : '✔'} ${id} ${plugin.version}`);
    }
  } finally {
    rmSync(configDir, { recursive: true, force: true });
  }

  if (problems.length) fail(`Install check failed:\n  ${problems.join('\n  ')}`);
  console.log(`✔ All ${count} plugins install and load.`);
});
