#!/usr/bin/env node
// Cut a release of one plugin.
//
//   npm run release -- <plugin> <patch|minor|major|X.Y.Z> [--dry-run] [--push] [--allow-branch] [--skip-validate]
//
// Steps: check the repo state, bump "version" in plugin.json, move the "## [Unreleased]" notes in the
// plugin's CHANGELOG.md into a dated version section, run "claude plugin validate --strict" on the plugin
// and the marketplace, commit, and create the annotated tag "<plugin>--v<version>".
// Users only receive an update when the version string changes, so every release must go through here.

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  bumpVersion, compareVersions, ensureBranch, ensureCleanTree, fail, git, loadPlugin, parseArgs,
  parseVersion, releaseChangelog, repoRoot, run, tagExists, tagName, today, validate, writeJson,
} from './lib/repo.mjs';

const USAGE = 'Usage: npm run release -- <plugin> <patch|minor|major|X.Y.Z> [--dry-run] [--push] [--allow-branch] [--skip-validate]';

run(() => {
  const args = parseArgs(process.argv.slice(2), {
    flags: ['--dry-run', '--push', '--allow-branch', '--skip-validate'],
  });
  const [name, bump] = args.positional;
  if (!name || !bump || args.positional.length > 2) fail(USAGE);
  const dryRun = args.flags.has('--dry-run');

  const root = repoRoot();
  const plugin = loadPlugin(root, name);
  if (!dryRun) {
    ensureCleanTree(root);
    ensureBranch(root, 'main', args.flags.has('--allow-branch'));
  }

  const current = plugin.manifest.version;
  if (current !== undefined && !parseVersion(current)) fail(`plugin.json version "${current}" is not X.Y.Z.`);
  const next = bumpVersion(current ?? '0.0.0', bump);
  if (current && compareVersions(next, current) <= 0) fail(`New version ${next} must be greater than ${current}.`);

  const tag = tagName(name, next);
  if (tagExists(root, tag)) fail(`Tag ${tag} already exists.`);
  if (!existsSync(plugin.changelogPath)) fail(`Missing ${join(plugin.relDir, 'CHANGELOG.md')}. Add one with a "## [Unreleased]" section.`);
  const changelog = releaseChangelog(readFileSync(plugin.changelogPath, 'utf8'), next, today());

  console.log(`Releasing ${name}: ${current ?? '(none)'} → ${next}`);
  console.log(`  tag:    ${tag}`);
  console.log(`  commit: release(${name}): v${next}`);
  if (dryRun) {
    console.log('Dry run: no files, commits or tags were changed.');
    return;
  }

  writeJson(plugin.manifestPath, { ...plugin.manifest, version: next });
  writeFileSync(plugin.changelogPath, changelog);

  try {
    validate(root, [plugin.relDir, '.'], args.flags.has('--skip-validate'));
  } catch (err) {
    git(['checkout', '--', plugin.relDir], { cwd: root });
    throw err;
  }

  git(['add', plugin.manifestPath, plugin.changelogPath], { cwd: root });
  git(['commit', '-m', `release(${name}): v${next}`], { cwd: root });
  git(['tag', '-a', tag, '-m', `${name} v${next}`], { cwd: root });
  console.log(`✔ Committed and tagged ${tag}.`);

  if (args.flags.has('--push')) {
    git(['push', 'origin', 'HEAD'], { cwd: root });
    git(['push', 'origin', tag], { cwd: root });
    console.log('✔ Pushed commit and tag.');
  } else {
    console.log(`Next: git push origin HEAD && git push origin ${tag}`);
  }
});
