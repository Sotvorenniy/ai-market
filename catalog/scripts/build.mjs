#!/usr/bin/env node
// Builds the catalog site data from the marketplace repository.
//
//   npm run build [-- --out dist]        (run inside catalog/)
//
// Copies src/ into <out> and writes <out>/data/catalog.json, <out>/data/releases.json and <out>/feed.xml.
// The marketplace itself (.claude-plugin/, plugins/) is read from the repository root.
// Fails when marketplace.json is unreadable or a relative plugin source is missing. Problems inside a
// single plugin become warnings; the plugin is still published with what could be read.
// See catalog/docs/spec.md §3–4.

import { execFileSync } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseFrontmatter } from './lib/frontmatter.mjs';

export const SCHEMA_VERSION = 1;
export const BODY_LIMIT = 4000;
export const RELEASE_LIMIT = 100;
export const NOTES_LIMIT = 6;
const TAG_PATTERN = /^(.+)--v(\d+)\.(\d+)\.(\d+)$/;

export class BuildError extends Error {}

/* ---------- small helpers ---------- */

function git(root, args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

const toPosix = (path) => path.split(sep).join('/');
const isDir = (path) => existsSync(path) && statSync(path).isDirectory();
const isFile = (path) => existsSync(path) && statSync(path).isFile();
const asArray = (value) => (value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]);
const nonEmpty = (value) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

function readJsonFile(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function toTags(value) {
  if (Array.isArray(value)) return value.map(String).map((t) => t.trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((t) => t.trim()).filter(Boolean);
  return [];
}

export function trimBody(body, limit = BODY_LIMIT) {
  const text = body.trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastBreak = cut.lastIndexOf('\n');
  return `${(lastBreak > limit * 0.8 ? cut.slice(0, lastBreak) : cut).trimEnd()}\n\n…`;
}

/** Splits a tools list ("Read, Agent(a, b)") on commas outside parentheses. */
export function toTools(value) {
  if (Array.isArray(value)) return value.map(String).map((t) => t.trim()).filter(Boolean);
  if (typeof value !== 'string') return [];
  const tools = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth++;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      tools.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  tools.push(current);
  return tools.map((t) => t.trim()).filter(Boolean);
}

const slug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'all';

/* ---------- component readers ---------- */

function readMarkdownComponent(ctx, file, type, fallbackName) {
  const { data, body, error } = parseFrontmatter(readFileSync(file, 'utf8'));
  const rel = toPosix(relative(ctx.root, file));
  if (error) ctx.warn(`${rel}: ${error}`);
  const name = nonEmpty(data.name) ?? fallbackName;
  const description = nonEmpty(data.description);
  if (!description) ctx.warn(`${rel}: missing "description" in frontmatter.`);
  const meta = {};
  const tools = toTools(data.tools ?? data['allowed-tools']);
  if (tools.length) meta.tools = tools;
  if (nonEmpty(data.model)) meta.model = data.model.trim();
  return {
    type,
    name,
    displayName: nonEmpty(data.displayName) ?? nonEmpty(data['display-name']) ?? nonEmpty(data.title) ?? name,
    description: description ?? '',
    tags: toTags(data.tags),
    path: rel,
    body: trimBody(body),
    meta,
  };
}

// Resolves a manifest component path ("./x") inside the plugin; warns and skips paths that escape it.
function pluginPath(ctx, plugin, value) {
  if (typeof value !== 'string') return null;
  const full = resolve(plugin.dir, value);
  if (full !== plugin.dir && !full.startsWith(plugin.dir + sep)) {
    ctx.warn(`${plugin.rel}: path "${value}" points outside the plugin and is ignored.`);
    return null;
  }
  if (!existsSync(full)) {
    ctx.warn(`${plugin.rel}: path "${value}" does not exist.`);
    return null;
  }
  return full;
}

function readSkills(ctx, plugin) {
  const roots = [];
  const defaultDir = join(plugin.dir, 'skills');
  if (isDir(defaultDir)) roots.push(defaultDir);
  else if (isFile(join(plugin.dir, 'SKILL.md'))) roots.push(plugin.dir);
  for (const value of asArray(plugin.manifest.skills)) {
    const full = value === '.' || value === './' ? plugin.dir : pluginPath(ctx, plugin, value);
    if (full && !roots.includes(full)) roots.push(full);
  }

  const skills = [];
  for (const root of roots) {
    if (isFile(join(root, 'SKILL.md'))) {
      skills.push(readMarkdownComponent(ctx, join(root, 'SKILL.md'), 'skill', basename(root === plugin.dir ? plugin.name : root)));
      continue;
    }
    for (const entry of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = join(root, entry.name, 'SKILL.md');
      if (entry.isDirectory() && isFile(file)) skills.push(readMarkdownComponent(ctx, file, 'skill', entry.name));
    }
  }
  return skills;
}

function markdownFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...markdownFiles(full));
    else if (entry.name.endsWith('.md')) files.push(full);
  }
  return files;
}

// Agents and commands: a manifest value replaces the default folder.
function readMarkdownSet(ctx, plugin, type, folder, manifestValue) {
  const items = [];
  const nameFor = (file, base) => toPosix(relative(base, file)).replace(/\.md$/, '').split('/').join(':');

  if (manifestValue && typeof manifestValue === 'object' && !Array.isArray(manifestValue)) {
    // commands: { "status": { "source": "./commands/status.md", "description": "…" } }
    for (const [name, def] of Object.entries(manifestValue)) {
      const file = pluginPath(ctx, plugin, def?.source);
      if (!file) continue;
      const item = readMarkdownComponent(ctx, file, type, name);
      if (item.displayName === item.name) item.displayName = name;
      item.name = name;
      if (nonEmpty(def.description)) item.description = def.description.trim();
      items.push(item);
    }
    return items;
  }

  const sources = manifestValue === undefined
    ? (isDir(join(plugin.dir, folder)) ? [join(plugin.dir, folder)] : [])
    : asArray(manifestValue).map((value) => pluginPath(ctx, plugin, value)).filter(Boolean);
  for (const source of sources) {
    if (isDir(source)) {
      for (const file of markdownFiles(source)) items.push(readMarkdownComponent(ctx, file, type, nameFor(file, source)));
    } else {
      items.push(readMarkdownComponent(ctx, source, type, basename(source, '.md')));
    }
  }
  return items;
}

function readJsonConfigs(ctx, plugin, defaultFile, manifestValue) {
  const configs = [];
  const loaded = new Set();
  const load = (file) => {
    if (loaded.has(file)) return;
    loaded.add(file);
    try {
      configs.push({ data: readJsonFile(file), path: toPosix(relative(ctx.root, file)) });
    } catch (err) {
      ctx.warn(`${toPosix(relative(ctx.root, file))}: invalid JSON (${err.message}).`);
    }
  };
  if (isFile(join(plugin.dir, defaultFile))) load(join(plugin.dir, defaultFile));
  for (const value of asArray(manifestValue)) {
    if (typeof value === 'string') {
      if (/^https?:\/\//.test(value) || /\.(mcpb|dxt)$/.test(value)) continue;
      const file = pluginPath(ctx, plugin, value);
      if (file) load(file);
    } else if (value && typeof value === 'object') {
      configs.push({ data: value, path: toPosix(relative(ctx.root, join(plugin.dir, '.claude-plugin', 'plugin.json'))) });
    }
  }
  return configs;
}

function readHooks(ctx, plugin) {
  const items = [];
  for (const { data, path } of readJsonConfigs(ctx, plugin, join('hooks', 'hooks.json'), plugin.manifest.hooks)) {
    const events = data.hooks && typeof data.hooks === 'object' ? data.hooks : data;
    for (const [event, groups] of Object.entries(events)) {
      if (!Array.isArray(groups)) continue;
      for (const group of groups) {
        const matcher = nonEmpty(group?.matcher);
        const label = matcher ? `${event} · ${matcher}` : event;
        items.push({
          type: 'hook',
          name: matcher ? `${slug(event)}-${slug(matcher)}` : slug(event),
          displayName: label,
          description: nonEmpty(group?.description) ?? nonEmpty(data.description) ?? `Runs on ${label}.`,
          tags: [],
          path,
          body: '',
          meta: { event: label },
        });
      }
    }
  }
  return items;
}

function readMcpServers(ctx, plugin) {
  const items = [];
  const userConfig = plugin.manifest.userConfig ?? {};
  for (const { data, path } of readJsonConfigs(ctx, plugin, '.mcp.json', plugin.manifest.mcpServers)) {
    const servers = data.mcpServers && typeof data.mcpServers === 'object' ? data.mcpServers : data;
    for (const [name, server] of Object.entries(servers)) {
      if (!server || typeof server !== 'object') continue;
      const transport = server.type ?? (server.command ? 'stdio' : 'http');
      const keys = [...new Set([...JSON.stringify(server).matchAll(/\$\{user_config\.([A-Za-z0-9_]+)\}/g)].map((m) => m[1]))];
      items.push({
        type: 'mcp',
        name,
        displayName: name,
        description: nonEmpty(server.description) ?? `MCP server "${name}" (${transport}).`,
        tags: [],
        path,
        body: '',
        // Only option titles are published. Commands, URLs, env and values stay out of the public site.
        meta: { transport, config: keys.map((key) => nonEmpty(userConfig[key]?.title) ?? key) },
      });
    }
  }
  return items;
}

/* ---------- plugins ---------- */

function toDependencies(value) {
  return asArray(value)
    .map((dep) => (typeof dep === 'string' ? dep : nonEmpty(dep?.name) && (dep.marketplace ? `${dep.name}@${dep.marketplace}` : dep.name)))
    .filter((dep) => typeof dep === 'string' && dep.trim())
    .map((dep) => dep.trim());
}

function externalSourceUrl(source) {
  switch (source?.source) {
    case 'github': return `https://github.com/${source.repo}`;
    case 'url': return source.url;
    case 'git-subdir': return /^[\w.-]+\/[\w.-]+$/.test(source.url) ? `https://github.com/${source.url}` : source.url;
    case 'npm': return `https://www.npmjs.com/package/${source.package}`;
    default: return null;
  }
}

function resolveLocalSource(root, marketplace, entry) {
  if (typeof entry.source !== 'string') return null;
  const pluginRoot = marketplace.metadata?.pluginRoot;
  const rel = entry.source.startsWith('./') || !pluginRoot ? entry.source : `${pluginRoot.replace(/\/$/, '')}/${entry.source}`;
  if (rel.split(/[\\/]/).includes('..')) throw new BuildError(`Plugin "${entry.name}": source "${entry.source}" must not contain "..".`);
  return resolve(root, rel);
}

function buildPlugin(ctx, marketplace, entry) {
  const dir = resolveLocalSource(ctx.root, marketplace, entry);
  if (!dir) {
    const sourceUrl = externalSourceUrl(entry.source);
    return {
      plugin: {
        name: entry.name,
        displayName: nonEmpty(entry.displayName) ?? entry.name,
        version: nonEmpty(entry.version) ?? null,
        description: nonEmpty(entry.description) ?? '',
        category: nonEmpty(entry.category) ?? null,
        tags: toTags(entry.tags ?? entry.keywords),
        owner: nonEmpty(entry.author?.name) ?? nonEmpty(marketplace.owner?.name) ?? null,
        license: nonEmpty(entry.license) ?? null,
        updated: null,
        hasEvals: false,
        path: null,
        external: true,
        sourceUrl,
        dependencies: toDependencies(entry.dependencies),
        items: [],
      },
      components: [],
      readme: '',
    };
  }

  if (!isDir(dir)) throw new BuildError(`Plugin "${entry.name}": source folder "${entry.source}" does not exist.`);
  const rel = toPosix(relative(ctx.root, dir));
  const manifestPath = join(dir, '.claude-plugin', 'plugin.json');
  let manifest = {};
  if (isFile(manifestPath)) {
    try {
      manifest = readJsonFile(manifestPath);
    } catch (err) {
      ctx.warn(`${rel}/.claude-plugin/plugin.json: invalid JSON (${err.message}).`);
    }
  }
  if (manifest.name && manifest.name !== entry.name) {
    ctx.warn(`${rel}: plugin.json name "${manifest.name}" differs from the marketplace entry "${entry.name}".`);
  }

  const plugin = { name: entry.name, dir, rel, manifest };
  const description = nonEmpty(entry.description) ?? nonEmpty(manifest.description);
  if (!description) ctx.warn(`${rel}: no description in the marketplace entry or plugin.json.`);

  const components = [
    ...readSkills(ctx, plugin),
    ...readMarkdownSet(ctx, plugin, 'agent', 'agents', manifest.agents),
    ...readMarkdownSet(ctx, plugin, 'command', 'commands', manifest.commands),
    ...readHooks(ctx, plugin),
    ...readMcpServers(ctx, plugin),
  ];
  const readmePath = join(dir, 'README.md');

  return {
    plugin: {
      name: entry.name,
      displayName: nonEmpty(entry.displayName) ?? nonEmpty(manifest.displayName) ?? entry.name,
      version: nonEmpty(manifest.version) ?? nonEmpty(entry.version) ?? null,
      description: description ?? '',
      category: nonEmpty(entry.category) ?? nonEmpty(manifest.category) ?? null,
      tags: toTags(entry.tags ?? manifest.keywords ?? entry.keywords),
      owner: nonEmpty(manifest.author?.name) ?? nonEmpty(entry.author?.name) ?? nonEmpty(marketplace.owner?.name) ?? null,
      license: nonEmpty(manifest.license) ?? nonEmpty(entry.license) ?? null,
      updated: git(ctx.root, ['log', '-1', '--format=%cs', '--', rel]) || null,
      hasEvals: isDir(join(dir, 'evals')),
      path: rel,
      external: false,
      sourceUrl: null,
      dependencies: toDependencies(manifest.dependencies ?? entry.dependencies),
      items: [],
    },
    components,
    readme: isFile(readmePath) ? trimBody(parseFrontmatter(readFileSync(readmePath, 'utf8')).body) : '',
  };
}

/* ---------- releases ---------- */

export function changelogNotes(text, version) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const start = lines.findIndex((line) => new RegExp(`^## \\[?v?${version.replace(/\./g, '\\.')}\\]?(\\s|$)`).test(line));
  if (start === -1) return { notes: [], rolledBack: false };
  let end = lines.findIndex((line, i) => i > start && /^## /.test(line));
  if (end === -1) end = lines.length;
  const section = lines.slice(start + 1, end);
  const bullets = section.filter((line) => /^[-*] /.test(line)).map((line) => line.slice(2).trim());
  const notes = bullets.length > NOTES_LIMIT
    ? [...bullets.slice(0, NOTES_LIMIT), `and ${bullets.length - NOTES_LIMIT} more`]
    : bullets;
  return { notes, rolledBack: section.some((line) => /^###\s+Rolled back\s*$/i.test(line)) };
}

export function buildReleases(root, plugins) {
  const output = git(root, ['for-each-ref', 'refs/tags', '--format=%(refname:short)%09%(creatordate:short)']);
  if (!output) return [];
  const byPlugin = new Map();
  for (const line of output.split('\n')) {
    const [tag, date] = line.split('\t');
    const match = TAG_PATTERN.exec(tag);
    if (!match) continue;
    const [, plugin, ...parts] = match;
    if (!byPlugin.has(plugin)) byPlugin.set(plugin, []);
    byPlugin.get(plugin).push({ version: parts.join('.'), parts: parts.map(Number), date });
  }

  const releases = [];
  for (const [name, tags] of byPlugin) {
    const plugin = plugins.find((p) => p.name === name && !p.external);
    if (!plugin) continue; // removed or external plugins have no page to link to
    const changelogPath = join(root, plugin.path, 'CHANGELOG.md');
    const changelog = isFile(changelogPath) ? readFileSync(changelogPath, 'utf8') : '';
    tags.sort((a, b) => a.parts[0] - b.parts[0] || a.parts[1] - b.parts[1] || a.parts[2] - b.parts[2]);
    tags.forEach((tag, i) => {
      const { notes, rolledBack } = changelogNotes(changelog, tag.version);
      const previous = tags[i - 1];
      const kind = rolledBack ? 'rollback' : previous && tag.parts[0] > previous.parts[0] ? 'major' : 'release';
      releases.push({ plugin: name, version: tag.version, date: tag.date, kind, notes, _parts: tag.parts });
    });
  }
  releases.sort((a, b) => b.date.localeCompare(a.date)
    || b._parts[0] - a._parts[0] || b._parts[1] - a._parts[1] || b._parts[2] - a._parts[2]
    || a.plugin.localeCompare(b.plugin));
  return releases.slice(0, RELEASE_LIMIT).map(({ _parts, ...release }) => release);
}

/* ---------- catalog ---------- */

export function repoFromRemote(url) {
  const match = /github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/.exec(url ?? '');
  return match ? match[1] : null;
}

/**
 * @param {{ root: string, repo?: string | null, now?: Date }} options
 */
export function buildCatalog({ root, repo = null, now = new Date() }) {
  const warnings = [];
  const ctx = { root: resolve(root), warn: (message) => warnings.push(message) };
  const marketplacePath = join(ctx.root, '.claude-plugin', 'marketplace.json');
  if (!isFile(marketplacePath)) throw new BuildError('Missing .claude-plugin/marketplace.json.');
  let marketplace;
  try {
    marketplace = readJsonFile(marketplacePath);
  } catch (err) {
    throw new BuildError(`.claude-plugin/marketplace.json is not valid JSON: ${err.message}`);
  }
  if (!nonEmpty(marketplace.name)) throw new BuildError('.claude-plugin/marketplace.json has no "name".');
  if (!Array.isArray(marketplace.plugins)) throw new BuildError('.claude-plugin/marketplace.json has no "plugins" array.');

  const plugins = [];
  const items = [];
  const seen = new Set();
  for (const entry of marketplace.plugins) {
    if (!nonEmpty(entry?.name)) throw new BuildError('A marketplace entry has no "name".');
    if (seen.has(entry.name)) throw new BuildError(`Duplicate plugin name "${entry.name}" in marketplace.json.`);
    seen.add(entry.name);

    const { plugin, components, readme } = buildPlugin(ctx, marketplace, entry);
    items.push({
      id: plugin.name,
      type: 'plugin',
      name: plugin.name,
      displayName: plugin.displayName,
      plugin: plugin.name,
      description: plugin.description,
      tags: plugin.tags,
      path: plugin.path,
      body: readme,
      meta: plugin.external ? { external: true } : {},
    });
    const ids = new Set();
    for (const component of components) {
      const id = `${plugin.name}/${component.type}/${component.name}`;
      if (ids.has(id)) {
        ctx.warn(`${component.path}: duplicate ${component.type} "${component.name}" in ${plugin.name}; only the first is published.`);
        continue;
      }
      ids.add(id);
      plugin.items.push(id);
      items.push({ id, ...component, plugin: plugin.name, tags: component.tags.length ? component.tags : plugin.tags });
    }
    plugins.push(plugin);
  }

  const catalog = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: now.toISOString(),
    commit: git(ctx.root, ['rev-parse', '--short', 'HEAD']),
    marketplace: {
      name: marketplace.name,
      repo,
      description: nonEmpty(marketplace.description) ?? nonEmpty(marketplace.metadata?.description) ?? '',
    },
    categories: [...new Set(plugins.map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    plugins,
    items,
  };
  return { catalog, releases: buildReleases(ctx.root, plugins), warnings };
}

/* ---------- feed ---------- */

const xml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

/** Site URL on GitHub Pages: https://<owner>.github.io/<repo>/ */
export function pagesUrl(repo) {
  const [owner, name] = (repo ?? '').split('/');
  return owner && name ? `https://${owner.toLowerCase()}.github.io/${name}/` : null;
}

/** Atom feed of plugin releases for "Subscribe" on the What's new page. */
export function buildFeed(releases, { title, siteUrl, now = new Date() }) {
  const base = siteUrl ?? '';
  const entries = releases.slice(0, 50).map((r) => {
    const link = `${base}#/plugin/${encodeURIComponent(r.plugin)}`;
    const kind = r.kind === 'rollback' ? ' (rollback)' : r.kind === 'major' ? ' (breaking)' : '';
    return `  <entry>
    <title>${xml(`${r.plugin} v${r.version}${kind}`)}</title>
    <id>${xml(`${base}#release/${r.plugin}/${r.version}`)}</id>
    <link href="${xml(link)}"/>
    <updated>${xml(r.date)}T00:00:00Z</updated>
    <summary>${xml(r.notes.join(' · ') || 'No release notes.')}</summary>
  </entry>`;
  });
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${xml(title)}</title>
  <id>${xml(base || title)}</id>
  <link href="${xml(base)}"/>
  <link rel="self" href="${xml(`${base}feed.xml`)}"/>
  <updated>${(releases[0]?.date ? `${releases[0].date}T00:00:00Z` : now.toISOString())}</updated>
${entries.join('\n')}
</feed>
`;
}

/* ---------- CLI ---------- */

const CATALOG_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function main(argv) {
  const outIndex = argv.indexOf('--out');
  const out = resolve(CATALOG_DIR, outIndex === -1 ? 'dist' : argv[outIndex + 1] ?? 'dist');
  const root = git(CATALOG_DIR, ['rev-parse', '--show-toplevel']) ?? resolve(CATALOG_DIR, '..');
  const repo = process.env.GITHUB_REPOSITORY || repoFromRemote(git(root, ['remote', 'get-url', 'origin']));
  const siteUrl = process.env.SITE_URL || pagesUrl(repo);

  const { catalog, releases, warnings } = buildCatalog({ root, repo });
  if (!repo) warnings.push('Repository slug unknown: set GITHUB_REPOSITORY or add an "origin" remote on GitHub.');

  rmSync(out, { recursive: true, force: true });
  cpSync(join(CATALOG_DIR, 'src'), out, { recursive: true });
  mkdirSync(join(out, 'data'), { recursive: true });
  writeFileSync(join(out, 'data', 'catalog.json'), `${JSON.stringify(catalog)}\n`);
  writeFileSync(join(out, 'data', 'releases.json'), `${JSON.stringify(releases)}\n`);
  writeFileSync(join(out, 'feed.xml'), buildFeed(releases, { title: `${catalog.marketplace.name} releases`, siteUrl }));
  writeFileSync(join(out, '.nojekyll'), '');

  const size = statSync(join(out, 'data', 'catalog.json')).size;
  console.log(`✔ ${catalog.plugins.length} plugins, ${catalog.items.length} items, ${releases.length} releases → ${toPosix(relative(process.cwd(), out)) || '.'} (catalog ${(size / 1024).toFixed(1)} KB)`);
  if (size > 1024 * 1024) warnings.push(`catalog.json is ${(size / 1024 / 1024).toFixed(2)} MB, above the 1 MB budget.`);
  for (const warning of warnings) console.warn(`! ${warning}`);
  if (process.env.GITHUB_STEP_SUMMARY && warnings.length) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Catalog warnings\n\n${warnings.map((w) => `- ${w}`).join('\n')}\n`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    if (err instanceof BuildError) {
      console.error(`✖ ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}
