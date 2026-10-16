#!/usr/bin/env node
// Install every plugin from the marketplace the way a user would and check that each one loads.
//
//   npm run install-check [-- <marketplace source>]
//
// "claude plugin validate" checks manifests one at a time; it does not resolve dependency version ranges.
// This script adds the marketplace (default: this checkout) to a throwaway Claude Code config directory,
// installs every plugin from marketplace.json, and fails when a plugin does not load (for example a
// dependency range that no released version satisfies) or when a file of the plugin folder is missing
// from the installed copy in the plugin cache. Your own Claude Code config is never touched.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fail, parseArgs, readJson, repoRoot, run } from './lib/repo.mjs';

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

run(() => {
  const args = parseArgs(process.argv.slice(2));
  if (args.positional.length > 1) fail(USAGE);

  const root = repoRoot();
  const source = args.positional[0] ?? root;
  const marketplace = readJson(join(root, '.claude-plugin', 'marketplace.json'));
  const configDir = mkdtempSync(join(tmpdir(), 'ai-market-install-check-'));
  const env = { ...process.env, CLAUDE_CONFIG_DIR: configDir };
  const problems = [];

  try {
    claude(['plugin', 'marketplace', 'add', source], env);
    for (const entry of marketplace.plugins) {
      claude(['plugin', 'install', `${entry.name}@${marketplace.name}`], env);
    }

    const installed = JSON.parse(claude(['plugin', 'list', '--json'], env));
    for (const entry of marketplace.plugins) {
      const id = `${entry.name}@${marketplace.name}`;
      const plugin = installed.find((p) => p.id === id);
      if (!plugin) {
        problems.push(`${id}: not installed`);
        continue;
      }
      for (const error of plugin.errors ?? []) problems.push(`${id}: ${error}`);

      // Supporting files (scripts, references) must survive the copy into the plugin cache.
      const sourceDir = join(root, entry.source);
      if (existsSync(plugin.installPath)) {
        const cached = new Set(listFiles(plugin.installPath));
        for (const file of listFiles(sourceDir)) {
          if (!file.startsWith('evals/results/') && !cached.has(file)) problems.push(`${id}: ${file} is missing from the plugin cache`);
        }
      }
      console.log(`${problems.some((p) => p.startsWith(id)) ? '✘' : '✔'} ${id} ${plugin.version}`);
    }
  } finally {
    rmSync(configDir, { recursive: true, force: true });
  }

  if (problems.length) fail(`Install check failed:\n  ${problems.join('\n  ')}`);
  console.log(`✔ All ${marketplace.plugins.length} plugins install and load.`);
});
