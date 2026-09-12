'use strict';
const crypto = require('node:crypto');

const TZ = process.env.TZ_SALON || 'America/Argentina/Buenos_Aires';

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

/* ---------- HTML ---------- */
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// Texto editable: *palabras* se muestran en cursiva de acento. Todo lo demás se escapa.
function rich(v) {
  return esc(v).replace(/\*([^*]+)\*/g, '<em>$1</em>');
}
function plain(v) {
  return String(v ?? '').replace(/\*/g, '');
}
function nl2br(v) {
  return esc(v).replace(/\r?\n/g, '<br>');
}

/* ---------- Fechas y horas (hora local del salón) ---------- */
function nowLocal() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const g = t => parts.find(p => p.type === t).value;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, minutes: Number(g('hour')) * 60 + Number(g('minute')) };
}
function tzOffsetMinutes(dateStr, timeStr) {
  const probe = new Date(`${dateStr}T${timeStr}:00Z`);
  const name = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' })
    .formatToParts(probe).find(p => p.type === 'timeZoneName').value;
  const m = /GMT([+-])(\d{1,2}):?(\d{2})?/.exec(name);
  if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0));
}
function localToUTC(dateStr, timeStr) {
  const t = timeStr === '24:00' ? '23:59' : timeStr;
  const extra = timeStr === '24:00' ? 60000 : 0;
  return new Date(Date.parse(`${dateStr}T${t}:00Z`) - tzOffsetMinutes(dateStr, t) * 60000 + extra);
}
function isDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}
function isTime(s) {
  return typeof s === 'string' && (/^([01]\d|2[0-3]):[0-5]\d$/.test(s) || s === '24:00');
}
function isMonth(s) {
  return typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const toHHMM = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const dayNumber = d => Math.round(Date.parse(d + 'T00:00:00Z') / 86400000);
const weekdayOf = d => new Date(d + 'T00:00:00Z').getUTCDay();
function addDays(d, n) {
  const x = new Date(d + 'T00:00:00Z');
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
function formatDateLong(d) {
  const s = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(d + 'T12:00:00Z'));
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/* ---------- Precios ---------- */
function formatARS(n) {
  return '$' + Math.round(Number(n)).toLocaleString('es-AR', { maximumFractionDigits: 0 });
}
function parseOptions(raw) {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw;
    return Array.isArray(v) ? v.filter(o => o && o.label && Number.isFinite(Number(o.amount)))
      .map(o => ({ label: String(o.label).slice(0, 40), amount: Math.round(Number(o.amount)) })) : [];
  } catch { return []; }
}
function priceInfo(service) {
  const options = parseOptions(service.price_options);
  if (options.length) {
    return { kind: 'options', options: options.map(o => ({ label: o.label, text: formatARS(o.amount) })),
      short: `${service.price_from ? 'Desde ' : ''}${formatARS(Math.min(...options.map(o => o.amount)))}` };
  }
  if (service.price != null && service.price !== '') {
    const t = (service.price_from ? 'Desde ' : '') + formatARS(service.price);
    return { kind: 'single', text: t, short: t };
  }
  return { kind: 'consult', text: 'Consultar precio', short: 'Consultar precio' };
}
function durationText(service) {
  const m = Number(service.duration_min);
  if (!m) return 'Consultar';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/* ---------- Seguridad ---------- */
function randomHex(bytes = 24) { return crypto.randomBytes(bytes).toString('hex'); }
function randomCode(len = 6) {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += A[crypto.randomInt(A.length)];
  return s;
}
function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pw), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}
function verifyPassword(pw, stored) {
  try {
    const [alg, s, h] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const expected = Buffer.from(h, 'base64');
    const got = crypto.scryptSync(String(pw), Buffer.from(s, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
    return crypto.timingSafeEqual(expected, got);
  } catch { return false; }
}
function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

class RateLimiter {
  constructor(max, windowMs) { this.max = max; this.windowMs = windowMs; this.hits = new Map(); }
  hit(key) {
    const now = Date.now();
    let e = this.hits.get(key);
    if (!e || e.reset < now) { e = { count: 0, reset: now + this.windowMs }; this.hits.set(key, e); }
    e.count++;
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (v.reset < now) this.hits.delete(k);
    return e.count <= this.max;
  }
}

/* ---------- HTTP ---------- */
function readBody(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'El contenido enviado es demasiado grande.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
async function readJSON(req, limit) {
  const raw = await readBody(req, limit);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw new HttpError(400, 'Formato de datos inválido.'); }
}
function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function clientIP(req) {
  if (process.env.TRUST_PROXY === '1') {
    const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (xf) return xf;
  }
  return req.socket.remoteAddress || 'unknown';
}
function slugify(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';
}
function clampInt(v, min, max, def) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}
function str(v, max = 200) { return String(v ?? '').trim().slice(0, max); }
function waLink(number, text) {
  const n = String(number || '').replace(/\D/g, '');
  return `https://wa.me/${n}${text ? '?text=' + encodeURIComponent(text) : ''}`;
}

module.exports = {
  TZ, HttpError, esc, rich, plain, nl2br, nowLocal, tzOffsetMinutes, localToUTC, isDate, isTime, isMonth,
  toMin, toHHMM, dayNumber, weekdayOf, addDays, formatDateLong, WEEKDAYS, formatARS, parseOptions,
  priceInfo, durationText, randomHex, randomCode, sha256, hashPassword, verifyPassword, safeEqual,
  RateLimiter, readBody, readJSON, parseCookies, clientIP, slugify, clampInt, str, waLink
};
