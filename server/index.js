'use strict';
const path = require('node:path');
try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch { /* sin archivo .env */ }

const http = require('node:http');
const fs = require('node:fs');
const zlib = require('node:zlib');
const { ROOT, UPLOAD_DIR, getSettings } = require('./db');
const { handleApi } = require('./api');
const { renderPage, renderManage, renderNotFound, PAGES } = require('./render');
const { renderArt } = require('./art');
const { findByToken } = require('./appointments');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(ROOT, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json'
};
const COMPRESSIBLE = /^(text\/|application\/(javascript|json|xml|manifest)|image\/svg)/;

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "frame-src https://www.google.com https://maps.google.com https://google.com",
  "connect-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'"
].join('; ');

function baseHeaders(req, res) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (process.env.TRUST_PROXY === '1' && req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  }
}

function send(req, res, status, body, type, cache = 'no-cache') {
  const headers = { 'Content-Type': type, 'Cache-Control': cache, Vary: 'Accept-Encoding' };
  let buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  if (buf.length > 1024 && COMPRESSIBLE.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    buf = zlib.gzipSync(buf, { level: 6 });
    headers['Content-Encoding'] = 'gzip';
  }
  headers['Content-Length'] = buf.length;
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : buf);
}

function originOf(req) {
  const s = getSettings();
  if (s.site_url) return s.site_url.replace(/\/+$/, '');
  const proto = process.env.TRUST_PROXY === '1' && req.headers['x-forwarded-proto'] ? String(req.headers['x-forwarded-proto']).split(',')[0] : (req.socket.encrypted ? 'https' : 'http');
  const host = String(req.headers.host || `localhost:${PORT}`).replace(/[^\w.:-]/g, '');
  return `${proto}://${host}`;
}

const fileCache = new Map();
function serveFile(req, res, baseDir, rel, cache) {
  const file = path.normalize(path.join(baseDir, rel));
  if (!file.startsWith(path.normalize(baseDir + path.sep))) return false;
  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext];
  if (!type) return false;
  let stat;
  try { stat = fs.statSync(file); } catch { return false; }
  if (!stat.isFile()) return false;
  const key = file + ':' + stat.mtimeMs;
  let data = fileCache.get(key);
  if (!data) {
    data = fs.readFileSync(file);
    if (stat.size < 2e6) fileCache.set(key, data);
  }
  send(req, res, 200, data, type, cache);
  return true;
}

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#203539"/><text x="32" y="42" text-anchor="middle" font-family="Jost,Arial,sans-serif" font-weight="700" font-size="26" fill="#E9A5BC" letter-spacing="1">FEM</text></svg>`;

const server = http.createServer(async (req, res) => {
  baseHeaders(req, res);
  let url;
  try { url = new URL(req.url, 'http://local'); } catch { res.writeHead(400); return res.end(); }
  const p = decodeURIComponent(url.pathname);

  try {
    if (p.startsWith('/api/')) return await handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }

    const page = PAGES.find(x => x.path === p || (p === '/index.html' && x.path === '/'));
    if (page) return send(req, res, 200, renderPage(page.key, originOf(req)), MIME['.html']);
    // /servicios/ -> /servicios
    if (p.length > 1 && p.endsWith('/') && PAGES.some(x => x.path === p.slice(0, -1))) {
      res.writeHead(301, { Location: p.slice(0, -1) });
      return res.end();
    }

    const manage = /^\/turno\/([A-Za-z0-9-]+)$/.exec(p);
    if (manage) {
      try {
        return send(req, res, 200, renderManage(findByToken(manage[1], url.searchParams.get('t'))), MIME['.html'], 'no-store');
      } catch { return send(req, res, 404, renderNotFound(), MIME['.html']); }
    }

    if (p === '/admin') { res.writeHead(301, { Location: '/admin/' }); return res.end(); }
    if (p === '/admin/') {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      if (serveFile(req, res, PUBLIC_DIR, 'admin/index.html', 'no-cache')) return;
    }

    const art = /^\/art\/([a-z0-9-]+)\.svg$/.exec(p);
    if (art) {
      const svg = renderArt(art[1]);
      if (svg) return send(req, res, 200, svg, MIME['.svg'], 'public, max-age=604800');
    }
    if (p === '/favicon.svg' || p === '/favicon.ico') return send(req, res, 200, FAVICON, MIME['.svg'], 'public, max-age=604800');
    if (p === '/robots.txt') {
      return send(req, res, 200, `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nDisallow: /turno/\n\nSitemap: ${originOf(req)}/sitemap.xml\n`, MIME['.txt']);
    }
    if (p === '/sitemap.xml') {
      const base = originOf(req);
      const urls = PAGES.map(x => `<url><loc>${base}${x.path}</loc><changefreq>weekly</changefreq><priority>${x.path === '/' ? '1.0' : '0.8'}</priority></url>`).join('');
      return send(req, res, 200, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`, MIME['.xml']);
    }
    if (p.startsWith('/uploads/') && serveFile(req, res, UPLOAD_DIR, p.slice('/uploads/'.length), 'public, max-age=2592000, immutable')) return;
    if (/^\/(css|js|img|admin)\//.test(p)) {
      const cache = url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : p.startsWith('/admin/') ? 'no-cache' : 'public, max-age=3600';
      if (serveFile(req, res, PUBLIC_DIR, p.slice(1), cache)) return;
    }
    return send(req, res, 404, renderNotFound(), MIME['.html']);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(req, res, 500, 'Error interno del servidor', 'text/plain; charset=utf-8');
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => console.log(`FEM salón funcionando en http://localhost:${PORT}  (panel: http://localhost:${PORT}/admin)`));
}
module.exports = { server };
