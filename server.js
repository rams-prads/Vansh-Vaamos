/*
 * Local development server.
 *
 * On Vercel the files in api/ run as serverless functions and the static
 * files are served by the platform. This script reproduces that locally so
 * you can work offline: it serves the folder and hands /api/* to the very
 * same handler files, through a small shim that gives them the
 * req.body / res.status().json() shape Vercel provides.
 *
 *     node server.js   ->  http://localhost:3000
 *
 * With no DATABASE_URL it stores orders in vamoss.db (SQLite). Set
 * DATABASE_URL and it talks to Postgres instead, exactly like production.
 *
 * It listens on 127.0.0.1 only. Do not expose this script to the internet.
 */

'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const productsHandler = require('./api/products');
const ordersHandler = require('./api/orders');
const store = require('./api/_lib/store');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const HOST = '127.0.0.1';

/* ---------------------------------------------------------------
   Make a plain Node response look like the one Vercel passes in
   --------------------------------------------------------------- */
function enhance(res) {
  res.status = code => { res.statusCode = code; return res; };
  res.json = body => {
    const text = JSON.stringify(body);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Length', Buffer.byteLength(text));
    res.end(text);
    return res;
  };
  return res;
}

function readBody(req, limit = 100 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/* ---------------------------------------------------------------
   Static files
   --------------------------------------------------------------- */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon'
};

// never serve these over http, locally or anywhere
const BLOCKED = ['vamoss.db', 'originals', 'server.js', '.claude', 'api/', '.env', 'node_modules'];

function serveStatic(res, pathname) {
  const rel = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  const file = path.join(ROOT, rel);

  if (!file.startsWith(ROOT + path.sep)) {
    return enhance(res).status(403).json({ error: 'Forbidden' });
  }
  const norm = rel.replace(/\\/g, '/').toLowerCase();
  if (BLOCKED.some(b => norm.includes(b))) {
    return enhance(res).status(404).json({ error: 'Not found' });
  }

  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      return enhance(res).status(404).json({ error: 'Not found' });
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(file).pipe(res);
  });
}

/* ---------------------------------------------------------------
   Server
   --------------------------------------------------------------- */
const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host || HOST}`);

  try {
    if (pathname === '/api/products' || pathname === '/api/orders') {
      enhance(res);
      if (req.method === 'POST' || req.method === 'PUT') {
        const raw = await readBody(req);
        try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = null; }
      }
      const handler = pathname === '/api/products' ? productsHandler : ordersHandler;
      return await handler(req, res);
    }

    if (pathname.startsWith('/api/')) {
      return enhance(res).status(404).json({ error: 'No such endpoint' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return enhance(res).status(405).json({ error: 'Method not allowed' });
    }
    serveStatic(res, pathname);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) enhance(res).status(500).json({ error: 'Server error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  Vamoss running at http://localhost:${PORT}`);
  console.log(`  Orders page:       http://localhost:${PORT}/admin.html`);
  console.log(`  Storage:           ${store.kind}\n`);
});
