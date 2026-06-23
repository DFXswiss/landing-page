import { createServer } from 'node:http';
import { appendFile, mkdir, readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const dataDir = join(root, 'data');
const eventsFile = join(dataDir, 'analytics-events.ndjson');
const port = Number(process.env.PORT || 8765);
const maxBodyBytes = 128 * 1024;
const maxEventsResponse = 5000;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.mp4': 'video/mp4'
};

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': headers['Content-Type'] || 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(payload);
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket.remoteAddress || '';
}

function sanitizeEvent(event, req) {
  if (!event || typeof event !== 'object') throw new Error('Invalid event body');
  const type = String(event.type || '').slice(0, 80);
  if (!type) throw new Error('Missing event type');
  return {
    ...event,
    type,
    receivedAt: new Date().toISOString(),
    server: {
      ip: clientIp(req),
      userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
      origin: String(req.headers.origin || ''),
      referer: String(req.headers.referer || '')
    }
  };
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new Error('Body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function track(req, res) {
  try {
    const raw = await readBody(req);
    const event = sanitizeEvent(JSON.parse(raw), req);
    await mkdir(dataDir, { recursive: true });
    await appendFile(eventsFile, JSON.stringify(event) + '\n', 'utf8');
    send(res, 204, '', { 'Content-Type': 'text/plain; charset=utf-8' });
  } catch (error) {
    send(res, 400, { error: error.message });
  }
}

async function events(req, res) {
  try {
    const raw = await readFile(eventsFile, 'utf8').catch((error) => {
      if (error.code === 'ENOENT') return '';
      throw error;
    });
    const lines = raw.trim() ? raw.trim().split('\n') : [];
    const parsed = lines.slice(-maxEventsResponse).map((line) => JSON.parse(line));
    send(res, 200, {
      generatedAt: new Date().toISOString(),
      source: 'server',
      count: parsed.length,
      events: parsed
    });
  } catch (error) {
    send(res, 500, { error: error.message });
  }
}

async function serveStatic(req, res, pathname) {
  const cleanPath = pathname === '/' ? '/index.html' : pathname;
  const relativePath = normalize(cleanPath).replace(/^[/\\]+/, '').replace(/^(\.\.[/\\])+/, '');
  const candidate = resolve(root, relativePath);
  if (!candidate.startsWith(root)) {
    send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }

  try {
    const info = await stat(candidate);
    if (!info.isFile()) throw new Error('Not a file');
    res.writeHead(200, {
      'Content-Type': types[extname(candidate).toLowerCase()] || 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': candidate.endsWith('.html') ? 'no-store' : 'public, max-age=60'
    });
    createReadStream(candidate).pipe(res);
  } catch {
    send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'POST' && url.pathname === '/api/track') {
    await track(req, res);
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/events') {
    await events(req, res);
    return;
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    await serveStatic(req, res, url.pathname);
    return;
  }
  send(res, 405, { error: 'Method not allowed' });
}).listen(port, () => {
  console.log(`DFX analytics server listening on http://localhost:${port}`);
});
