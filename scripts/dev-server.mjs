import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORT } from '../tests/pages.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = process.env.PORT ? Number(process.env.PORT) : PORT;

// Mirror the Cloudflare Pages routing layer so the test suite exercises the same
// behaviour as production (otherwise the dev server would 200 pages that prod
// 301-redirects or never deploys — exactly how a broken/redirected link slips
// through). Only the static parts that matter for local page tests are honoured.

// _redirects: exact (non-dynamic) rules. Dynamic :param/* rules target external
// app/api hosts and are irrelevant to local page navigation, so they are skipped.
function loadRedirects() {
  const map = new Map();
  const file = join(root, '_redirects');
  if (!existsSync(file)) return map;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;
    const from = parts[0];
    if (from.includes(':') || from.includes('*')) continue;
    map.set(from, { to: parts[1], status: Number(parts[2]) || 301 });
  }
  return map;
}

// .assetsignore: files Cloudflare excludes from the deploy. Anything matched is
// not served in production, so the dev server 404s it too.
function loadExclusions() {
  const rules = [];
  const file = join(root, '.assetsignore');
  if (existsSync(file)) {
    for (const raw of readFileSync(file, 'utf8').split('\n')) {
      const line = raw.trim();
      if (line && !line.startsWith('#')) rules.push(line);
    }
  }
  return function isExcluded(relPath) {
    const p = relPath.replace(/^\//, '');
    return rules.some(function (rule) {
      if (rule.endsWith('/')) return p === rule.slice(0, -1) || p.startsWith(rule);
      if (rule.startsWith('*.')) return p.endsWith(rule.slice(1));
      return p === rule;
    });
  };
}

const redirects = loadRedirects();
const isExcluded = loadExclusions();

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.mp4', 'video/mp4'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function send(response, status, body = '') {
  response.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  response.end(body);
}

function resolveRequestPath(url) {
  const pathname = decodeURIComponent(new URL(url, `http://127.0.0.1:${port}`).pathname);
  const cleanPath = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(root, cleanPath === '/' ? 'index.html' : cleanPath);
  const resolved = resolve(filePath);

  if (!resolved.startsWith(root)) {
    return null;
  }

  if (existsSync(resolved) && statSync(resolved).isDirectory()) {
    return join(resolved, 'index.html');
  }

  return resolved;
}

createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    send(response, 405, 'Method Not Allowed');
    return;
  }

  const reqPath = decodeURIComponent(
    new URL(request.url || '/', `http://127.0.0.1:${port}`).pathname,
  );

  // Honour _redirects (exact rules) exactly as Cloudflare Pages would.
  const redirect = redirects.get(reqPath);
  if (redirect) {
    response.writeHead(redirect.status, { location: redirect.to });
    response.end();
    return;
  }

  // Honour .assetsignore: paths excluded from the deploy are not served in prod.
  if (reqPath !== '/' && isExcluded(reqPath)) {
    send(response, 404, 'Not Found');
    return;
  }

  const filePath = resolveRequestPath(request.url || '/');

  if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
    send(response, 404, 'Not Found');
    return;
  }

  response.writeHead(200, {
    'content-type': mimeTypes.get(extname(filePath)) || 'application/octet-stream',
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  createReadStream(filePath).pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root} on http://127.0.0.1:${port}`);
});
