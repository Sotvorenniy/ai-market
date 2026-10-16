#!/usr/bin/env node
// Run one plugin's eval suite with its dependencies loaded.
//
//   npm run eval -- <plugin> [claude plugin eval options...]
//
// "claude plugin eval plugins/<name>" only loads plugins from inside that plugin's folder, so a case's
// `plugins:` entry for a sibling dependency (../../../engineering-paved-path) is refused and a plugin with
// dependencies fails to load. Running against the marketplace root with --eval-dir makes the repository
// the containment root, so every case can load the plugin under test plus its dependencies.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fail, repoRoot, run } from './lib/repo.mjs';

const USAGE = 'Usage: npm run eval -- <plugin> [claude plugin eval options...]';

run(() => {
  const [name, ...rest] = process.argv.slice(2);
  if (!name || name.startsWith('-')) fail(USAGE);

  const root = repoRoot();
  const evalDir = join('plugins', name, 'evals');
  if (!existsSync(join(root, evalDir))) fail(`No eval suite at ${evalDir}.`);

  const result = spawnSync('claude', ['plugin', 'eval', '.', '--eval-dir', evalDir, ...rest], { cwd: root, stdio: 'inherit' });
  if (result.error?.code === 'ENOENT') fail('The "claude" CLI is not on PATH. Install Claude Code first.');
  process.exitCode = result.status ?? 1;
});
