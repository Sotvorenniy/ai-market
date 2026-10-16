#!/usr/bin/env node
// Local development server for the catalog site. Always shows the real marketplace in this repository:
// catalog data is rebuilt from .claude-plugin/ and plugins/ on every request, so new or edited plugins
// appear after a page reload.
//
//   npm run dev                  # inside catalog/
//   npm run dev -- --port 5000

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog, buildFeed, pagesUrl, repoFromRemote } from './build.mjs';
import { execFileSync } from 'node:child_process';

const catalogDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const root = resolve(catalogDir, '..');
const siteDir = join(catalogDir, 'src');
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const port = Number(portIndex === -1 ? 4173 : args[portIndex + 1]) || 4173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.xml': 'application/atom+xml; charset=utf-8',
};

function repo() {
  try {
    return repoFromRemote(execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8' }).trim());
  } catch {
    return null;
  }
}

async function load() {
  const result = buildCatalog({ root, repo: repo() });
  for (const warning of result.warnings) console.warn(`! ${warning}`);
  return result;
}

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  try {
    if (path === '/data/catalog.json' || path === '/data/releases.json') {
      const { catalog, releases } = await load();
      res.writeHead(200, { 'content-type': TYPES['.json'], 'cache-control': 'no-store' });
      res.end(JSON.stringify(path.endsWith('catalog.json') ? catalog : releases));
      return;
    }
    if (path === '/feed.xml') {
      const { catalog, releases } = await load();
      res.writeHead(200, { 'content-type': TYPES['.xml'], 'cache-control': 'no-store' });
      res.end(buildFeed(releases, { title: `${catalog.marketplace.name} releases`, siteUrl: pagesUrl(catalog.marketplace.repo) }));
      return;
    }
    const file = normalize(join(siteDir, path.endsWith('/') ? `${path}index.html` : path));
    if (file !== siteDir && !file.startsWith(siteDir + sep)) throw Object.assign(new Error('Outside site'), { code: 'ENOENT' });
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch (err) {
    const status = err.code === 'ENOENT' || err.code === 'EISDIR' ? 404 : 500;
    if (status === 500) console.error(err);
    res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(status === 404 ? 'Not found' : `Error: ${err.message}`);
  }
});

server.listen(port, () => {
  console.log(`Catalog dev server: http://localhost:${port}/ (data rebuilt from this repository on every request)`);
});
