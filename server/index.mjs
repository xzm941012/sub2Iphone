import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import app from './bridge.mjs';
const root = fileURLToPath(new URL('../client/', import.meta.url));
const port = Number(process.env.SUBWATCH_PORT || 4185), base = '/subwatch';
const publicOrigin = process.env.SUBWATCH_PUBLIC_ORIGIN || 'http://127.0.0.1:' + port;
const allowedHosts = (process.env.SUBWATCH_ALLOWED_HOSTS || 'sub2api.onemem.cc,sub2apicn.onemem.cc,sub2api-jp.onemem.cc').split(',').map(x => x.trim()).filter(Boolean);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const env = { ALLOWED_HOSTS: allowedHosts, ASSETS: { async fetch(request) {
  let pathname; try { pathname = decodeURIComponent(new URL(request.url).pathname); } catch { return new Response('Bad path', { status: 400 }); }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root)) return new Response('Forbidden', { status: 403 });
  try { if (!(await stat(file)).isFile()) throw Error(); return new Response(request.method === 'HEAD' ? null : await readFile(file), { headers: { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' } }); } catch { return new Response('Not found', { status: 404 }); }
} } };
let active = 0;
const server = createServer(async (req, res) => {
  if (active >= 32) { res.writeHead(503, { 'Retry-After': '5' }); res.end('Busy'); return; }
  active++;
  try {
    if (req.url === base) { res.writeHead(308, { Location: base + '/' }); res.end(); return; }
    if (!req.url.startsWith(base + '/')) { res.writeHead(404); res.end('Not found'); return; }
    const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (v) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    const request = new Request(publicOrigin + req.url.slice(base.length), { method: req.method, headers, ...(!['GET', 'HEAD'].includes(req.method) ? { body: req, duplex: 'half' } : {}) });
    const response = await app.fetch(request, env); res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(req.method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
  } catch { if (!res.headersSent) res.writeHead(500, { 'Cache-Control': 'no-store' }); res.end('Server error'); }
  finally { active--; }
});
server.requestTimeout = 110000; server.headersTimeout = 10000;
server.listen(port, '127.0.0.1', () => console.log('SubWatch listening on loopback port ' + port + ' at ' + base + '/'));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
