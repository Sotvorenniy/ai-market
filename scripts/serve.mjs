#!/usr/bin/env node
// Local preview of the catalog site.
//
//   npm run dev               # data built live from this repository on every request
//   npm run dev -- --sample   # sample data from scripts/dev (the repo has few or no plugins yet)
//   npm run dev -- --port 5000

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog, repoFromRemote } from './build-catalog.mjs';
import { execFileSync } from 'node:child_process';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const siteDir = join(root, 'site');
const args = process.argv.slice(2);
const sample = args.includes('--sample');
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
};

function repo() {
  try {
    return repoFromRemote(execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8' }).trim());
  } catch {
    return null;
  }
}

async function data(name) {
  if (sample) return readFile(join(root, 'scripts', 'dev', `sample-${name}`), 'utf8');
  const { catalog, releases, warnings } = buildCatalog({ root, repo: repo() });
  for (const warning of warnings) console.warn(`! ${warning}`);
  return JSON.stringify(name === 'catalog.json' ? catalog : releases);
}

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  try {
    if (path === '/data/catalog.json' || path === '/data/releases.json') {
      res.writeHead(200, { 'content-type': TYPES['.json'], 'cache-control': 'no-store' });
      res.end(await data(path.slice('/data/'.length)));
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
  console.log(`Catalog preview: http://localhost:${port}/ (${sample ? 'sample data' : 'live data from this repo'})`);
});
