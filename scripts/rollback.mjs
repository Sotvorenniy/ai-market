#!/usr/bin/env node
// Roll a plugin back to the contents of an earlier release.
//
//   npm run rollback -- <plugin> [--to X.Y.Z] [--dry-run] [--push] [--allow-branch] [--skip-validate]
//
// This is a roll-forward: the plugin folder is restored from the tag "<plugin>--v<X.Y.Z>" and released
// under a NEW patch version. Claude Code only updates a plugin when its version string changes, and users
// who already have the broken version cached would never receive an older version number reliably.
// The current CHANGELOG.md is kept (history is not rewritten) and gains a "Rolled back" entry.
// Without --to, the plugin goes back to the release before the latest one.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import {
  bumpVersion, ensureBranch, ensureCleanTree, fail, git, insertChangelogSection, loadPlugin, parseArgs,
  pluginTags, repoRoot, run, tagExists, tagName, today, validate, writeJson, readJson, compareVersions,
} from './lib/repo.mjs';

const USAGE = 'Usage: npm run rollback -- <plugin> [--to X.Y.Z] [--dry-run] [--push] [--allow-branch] [--skip-validate]';

run(() => {
  const args = parseArgs(process.argv.slice(2), {
    flags: ['--dry-run', '--push', '--allow-branch', '--skip-validate'],
    options: ['--to'],
  });
  const [name] = args.positional;
  if (!name || args.positional.length > 1) fail(USAGE);
  const dryRun = args.flags.has('--dry-run');

  const root = repoRoot();
  const plugin = loadPlugin(root, name);
  if (!dryRun) {
    ensureCleanTree(root);
    ensureBranch(root, 'main', args.flags.has('--allow-branch'));
  }

  const tags = pluginTags(root, name);
  if (tags.length < 2 && !args.options['--to']) fail(`"${name}" has fewer than two releases; pass --to explicitly.`);
  const latest = tags.at(-1)?.version;
  const target = args.options['--to'] ?? tags.at(-2).version;
  const targetTag = tagName(name, target);
  if (!tagExists(root, targetTag)) {
    fail(`Tag ${targetTag} does not exist. Released versions: ${tags.map((t) => t.version).join(', ') || 'none'}.`);
  }

  const current = plugin.manifest.version;
  const base = [current, latest].filter(Boolean).sort(compareVersions).at(-1);
  if (compareVersions(target, base) >= 0) fail(`Target ${target} is not older than the current version ${base}.`);
  const next = bumpVersion(base, 'patch');
  const nextTag = tagName(name, next);
  if (tagExists(root, nextTag)) fail(`Tag ${nextTag} already exists.`);

  console.log(`Rolling back ${name}: contents of v${target} will ship as v${next} (current ${base}).`);
  console.log(`  restore from: ${targetTag}`);
  console.log(`  new tag:      ${nextTag}`);
  if (dryRun) {
    console.log('Dry run: no files, commits or tags were changed.');
    return;
  }

  const changelogBefore = existsSync(plugin.changelogPath)
    ? readFileSync(plugin.changelogPath, 'utf8')
    : '# Changelog\n\n## [Unreleased]\n';

  // Replace the whole plugin folder so files added after the target release are removed too.
  git(['rm', '-r', '-q', '--', plugin.relDir], { cwd: root });
  git(['checkout', targetTag, '--', plugin.relDir], { cwd: root });

  const restored = readJson(plugin.manifestPath);
  if (restored.name !== name) fail(`plugin.json at ${targetTag} has name "${restored.name}". Restore manually.`);
  writeJson(plugin.manifestPath, { ...restored, version: next });
  writeFileSync(
    plugin.changelogPath,
    insertChangelogSection(
      changelogBefore,
      `## [${next}] - ${today()}`,
      `### Rolled back\n\n- Restored the plugin contents of v${target} (tag \`${targetTag}\`). Changes released after v${target} are reverted.`,
    ),
  );

  try {
    validate(root, [plugin.relDir, '.'], args.flags.has('--skip-validate'));
  } catch (err) {
    git(['reset', '-q', '--hard', 'HEAD'], { cwd: root });
    throw err;
  }

  git(['add', '-A', '--', plugin.relDir], { cwd: root });
  git(['commit', '-m', `rollback(${name}): v${next} restores v${target}`], { cwd: root });
  git(['tag', '-a', nextTag, '-m', `${name} v${next} (rollback to v${target})`], { cwd: root });
  console.log(`✔ Committed and tagged ${nextTag}.`);

  if (args.flags.has('--push')) {
    git(['push', 'origin', 'HEAD'], { cwd: root });
    git(['push', 'origin', nextTag], { cwd: root });
    console.log('✔ Pushed commit and tag.');
  } else {
    console.log(`Next: git push origin HEAD && git push origin ${nextTag}`);
  }
});
