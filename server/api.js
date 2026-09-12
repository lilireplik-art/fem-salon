'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { db, getSettings, saveSettings, DEFAULT_SETTINGS, UPLOAD_DIR } = require('./db');
const {
  HttpError, readJSON, parseCookies, clientIP, RateLimiter, randomHex, sha256, hashPassword, verifyPassword,
  isDate, isTime, isMonth, toMin, str, slugify, clampInt, parseOptions, nowLocal, addDays
} = require('./util');
const { computeDay, computeMonth, bookingWindow } = require('./availability');
const appts = require('./appointments');
const { GALLERY_CATS } = require('./render');
const { artNames } = require('./art');

const SESSION_COOKIE = 'fem_sid';
const SESSION_DAYS = 14;
const limits = {
  login: new RateLimiter(10, 15 * 60e3),
  booking: new RateLimiter(12, 60 * 60e3),
  availability: new RateLimiter(240, 60e3),
  cancel: new RateLimiter(20, 60 * 60e3)
};

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

/* ---------- Sesiones ---------- */
function isSecure(req) {
  if (process.env.COOKIE_SECURE === '1') return true;
  if (process.env.COOKIE_SECURE === '0') return false;
  return Boolean(req.socket.encrypted) || (process.env.TRUST_PROXY === '1' && req.headers['x-forwarded-proto'] === 'https');
}
function setSessionCookie(req, res, token, maxAge) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isSecure(req) ? '; Secure' : ''}`);
}
function currentUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const row = db.prepare(`SELECT u.id, u.username, u.name, u.role, u.active, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?`).get(sha256(token));
  if (!row || !row.active || row.expires_at < Date.now()) return null;
  return { id: row.id, username: row.username, name: row.name, role: row.role };
}

/* ---------- Mapeos ---------- */
const bool = v => (v === true || v === 1 || v === '1' || v === 'true' || v === 'on' ? 1 : 0);
const intOrNull = v => (v === '' || v === null || v === undefined || isNaN(parseInt(v, 10)) ? null : Math.max(0, parseInt(v, 10)));
const imgPath = v => { const s = str(v, 400); return !s || s.startsWith('/uploads/') || s.startsWith('/art/') || /^https:\/\//.test(s) ? s : ''; };

function serviceRow(x, links) {
  return { ...x, price_options: parseOptions(x.price_options), professionals: links.filter(l => l.service_id === x.id).map(l => l.professional_id) };
}
function adminData() {
  const links = db.prepare('SELECT * FROM professional_services').all();
  const schedules = db.prepare('SELECT * FROM schedules ORDER BY weekday, start_time').all();
  return {
    settings: getSettings(),
    categories: db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all(),
    services: db.prepare('SELECT * FROM services ORDER BY sort_order, id').all().map(x => serviceRow(x, links)),
    professionals: db.prepare('SELECT * FROM professionals ORDER BY sort_order, id').all().map(p => ({
      ...p,
      services: links.filter(l => l.professional_id === p.id).map(l => l.service_id),
      schedule: schedules.filter(r => r.professional_id === p.id).map(r => ({ weekday: r.weekday, start: r.start_time, end: r.end_time }))
    })),
    salonSchedule: schedules.filter(r => r.professional_id === null).map(r => ({ weekday: r.weekday, start: r.start_time, end: r.end_time })),
    gallery: db.prepare('SELECT * FROM gallery ORDER BY sort_order, id DESC').all(),
    reviews: db.prepare('SELECT * FROM reviews ORDER BY sort_order, id DESC').all(),
    galleryCategories: GALLERY_CATS,
    artNames: artNames(),
    statuses: appts.STATUSES,
    today: nowLocal().date
  };
}

function validateWeekly(list) {
  if (!Array.isArray(list)) throw new HttpError(400, 'Horario inválido.');
  return list.map(r => {
    const wd = Number(r.weekday);
    if (!(wd >= 0 && wd <= 6) || !isTime(r.start) || !isTime(r.end) || toMin(r.end) <= toMin(r.start)) {
      throw new HttpError(400, 'Revisá los horarios: la hora de fin debe ser posterior a la de inicio.');
    }
    return { weekday: wd, start: r.start, end: r.end };
  });
}
function saveWeekly(proId, list) {
  db.prepare('DELETE FROM schedules WHERE professional_id IS ?').run(proId);
  const ins = db.prepare('INSERT INTO schedules (professional_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?)');
  for (const r of list) ins.run(proId, r.weekday, r.start, r.end);
}
function tx(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
}
function uniqueSlug(table, base, id = 0) {
  let slug = slugify(base), i = 2;
  while (db.prepare(`SELECT 1 FROM ${table} WHERE slug = ? AND id != ?`).get(slug, id)) slug = `${slugify(base)}-${i++}`;
  return slug;
}

/* ---------- Rutas públicas ---------- */
function getServiceOr404(id) {
  const s = db.prepare('SELECT * FROM services WHERE id = ? AND active = 1 AND bookable = 1').get(Number(id));
  if (!s) throw new HttpError(404, 'Servicio no disponible.');
  return s;
}
const proParam = v => (v && v !== 'any' ? Number(v) : null);

const publicRoutes = [
  ['GET', /^\/api\/availability\/month$/, ({ query }) => {
    if (!isMonth(query.get('month'))) throw new HttpError(400, 'Mes inválido.');
    const service = getServiceOr404(query.get('service'));
    return { days: computeMonth({ service, professionalId: proParam(query.get('professional')), month: query.get('month') }), ...bookingWindow() };
  }],
  ['GET', /^\/api\/availability\/day$/, ({ query }) => {
    if (!isDate(query.get('date'))) throw new HttpError(400, 'Fecha inválida.');
    const service = getServiceOr404(query.get('service'));
    return { slots: computeDay({ service, professionalId: proParam(query.get('professional')), date: query.get('date') }).map(x => x.time) };
  }],
  ['POST', /^\/api\/appointments$/, async ({ req, ip }) => {
    const b = await readJSON(req, 20e3);
    if (b.website) throw new HttpError(400, 'No se pudo procesar la reserva.'); // honeypot anti-spam
    if (!limits.booking.hit(ip)) throw new HttpError(429, 'Hiciste demasiadas reservas seguidas. Probá más tarde o escribinos por WhatsApp.');
    const a = appts.createPublic(b);
    const s = getSettings();
    return {
      appointment: appts.publicView(a),
      manageUrl: `/turno/${encodeURIComponent(a.code)}?t=${a.token}`,
      icsUrl: `/api/appointments/${encodeURIComponent(a.code)}/ics?t=${a.token}`,
      googleUrl: appts.googleCalendarUrl(a, s)
    };
  }],
  ['POST', /^\/api\/appointments\/([A-Z0-9-]+)\/cancel$/i, async ({ req, ip, params }) => {
    if (!limits.cancel.hit(ip)) throw new HttpError(429, 'Demasiados intentos. Probá más tarde.');
    const b = await readJSON(req, 4e3);
    return { appointment: appts.publicView(appts.cancelPublic(params[0], b.token)) };
  }]
];

/* ---------- Rutas de administración ---------- */
const A = 'admin';
const adminRoutes = [
  ['GET', /^\/me$/, ({ user }) => ({ user })],
  ['POST', /^\/logout$/, ({ req, res }) => {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
    setSessionCookie(req, res, '', 0);
    return { ok: true };
  }],
  ['POST', /^\/password$/, async ({ req, user }) => {
    const b = await readJSON(req);
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id);
    if (!verifyPassword(b.current, row.password_hash)) throw new HttpError(400, 'La contraseña actual no es correcta.');
    if (String(b.next || '').length < 8) throw new HttpError(400, 'La nueva contraseña debe tener al menos 8 caracteres.');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(b.next), user.id);
    return { ok: true };
  }],
  ['GET', /^\/bootstrap$/, ({ user }) => ({ user, ...adminData() })],
  ['GET', /^\/stats$/, () => {
    const today = nowLocal().date;
    const weekEnd = addDays(today, 6);
    const c = (sql, ...p) => db.prepare(sql).get(...p).n;
    return {
      today: c("SELECT COUNT(*) n FROM appointments WHERE date = ? AND status IN ('pendiente','confirmado','completado')", today),
      pending: c("SELECT COUNT(*) n FROM appointments WHERE status = 'pendiente' AND date >= ?", today),
      week: c("SELECT COUNT(*) n FROM appointments WHERE date BETWEEN ? AND ? AND status IN ('pendiente','confirmado')", today, weekEnd),
      newWeb: c("SELECT COUNT(*) n FROM appointments WHERE source = 'web' AND created_at >= datetime('now','-1 day')")
    };
  }],

  /* Turnos */
  ['GET', /^\/appointments$/, ({ query }) => {
    const where = [], p = [];
    if (isDate(query.get('from'))) { where.push('a.date >= ?'); p.push(query.get('from')); }
    if (isDate(query.get('to'))) { where.push('a.date <= ?'); p.push(query.get('to')); }
    const pro = query.get('professional');
    if (pro === 'none') where.push('a.professional_id IS NULL');
    else if (pro) { where.push('a.professional_id = ?'); p.push(Number(pro)); }
    if (query.get('service')) { where.push('a.service_id = ?'); p.push(Number(query.get('service'))); }
    const st = query.get('status');
    if (st === 'activos') where.push("a.status IN ('pendiente','confirmado')");
    else if (appts.STATUSES.includes(st)) { where.push('a.status = ?'); p.push(st); }
    const text = str(query.get('q'), 60);
    if (text) {
      where.push("(a.first_name || ' ' || a.last_name LIKE ? OR a.phone LIKE ? OR a.code LIKE ? OR a.email LIKE ?)");
      const like = `%${text}%`; p.push(like, like, like, like);
    }
    const sql = `SELECT a.*, p.color AS professional_color FROM appointments a LEFT JOIN professionals p ON p.id = a.professional_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY a.date, a.start_time LIMIT 2000`;
    return { appointments: db.prepare(sql).all(...p) };
  }],
  ['POST', /^\/appointments$/, async ({ req }) => ({ appointment: appts.createAdmin(await readJSON(req)) })],
  ['PUT', /^\/appointments\/(\d+)$/, async ({ req, params }) => ({ appointment: appts.updateAdmin(Number(params[0]), await readJSON(req)) })],
  ['DELETE', /^\/appointments\/(\d+)$/, ({ params }) => {
    db.prepare('DELETE FROM appointments WHERE id = ?').run(Number(params[0]));
    return { ok: true };
  }, A],
  ['GET', /^\/availability$/, ({ query }) => {
    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(Number(query.get('service')));
    if (!service || !isDate(query.get('date'))) throw new HttpError(400, 'Datos inválidos.');
    return {
      slots: computeDay({
        service, professionalId: query.get('professional') ? Number(query.get('professional')) : null, date: query.get('date'),
        excludeId: Number(query.get('exclude')) || 0, admin: true, duration: Number(query.get('duration')) || null
      }).map(x => x.time)
    };
  }],

  /* Horarios y bloqueos */
  ['PUT', /^\/schedule$/, async ({ req }) => {
    const list = validateWeekly((await readJSON(req)).weekly);
    tx(() => saveWeekly(null, list));
    return { salonSchedule: adminData().salonSchedule };
  }, A],
  ['GET', /^\/blocks$/, ({ query }) => {
    const from = isDate(query.get('from')) ? query.get('from') : addDays(nowLocal().date, -60);
    return {
      blocks: db.prepare(`SELECT b.*, p.name AS professional_name FROM time_blocks b LEFT JOIN professionals p ON p.id = b.professional_id
        WHERE b.date_to >= ? ORDER BY b.date_from, b.start_time`).all(from)
    };
  }],
  ['POST', /^\/blocks$/, async ({ req }) => {
    const b = await readJSON(req);
    const type = b.type === 'open' ? 'open' : 'block';
    const from = b.dateFrom, to = b.dateTo || b.dateFrom;
    if (!isDate(from) || !isDate(to) || to < from) throw new HttpError(400, 'Revisá las fechas.');
    let start = null, end = null;
    if (!b.allDay) {
      if (!isTime(b.start) || !isTime(b.end) || toMin(b.end) <= toMin(b.start)) throw new HttpError(400, 'Revisá el horario: la hora de fin debe ser posterior a la de inicio.');
      start = b.start; end = b.end;
    } else if (type === 'open') throw new HttpError(400, 'Para abrir un horario indicá desde y hasta qué hora.');
    const proId = b.professionalId ? Number(b.professionalId) : null;
    if (proId && !db.prepare('SELECT 1 FROM professionals WHERE id = ?').get(proId)) throw new HttpError(400, 'Profesional inválida.');
    const r = db.prepare('INSERT INTO time_blocks (type, professional_id, date_from, date_to, start_time, end_time, reason) VALUES (?,?,?,?,?,?,?)')
      .run(type, proId, from, to, start, end, str(b.reason, 200));
    const affected = db.prepare(`SELECT COUNT(*) n FROM appointments WHERE status IN ('pendiente','confirmado') AND date BETWEEN ? AND ?
      ${proId ? 'AND professional_id = ?' : ''}`).get(...[from, to, ...(proId ? [proId] : [])]).n;
    return { id: Number(r.lastInsertRowid), affected: type === 'block' ? affected : 0 };
  }],
  ['DELETE', /^\/blocks\/(\d+)$/, ({ params }) => {
    db.prepare('DELETE FROM time_blocks WHERE id = ?').run(Number(params[0]));
    return { ok: true };
  }],

  /* Servicios */
  ['POST', /^\/services$/, async ({ req }) => saveService(0, await readJSON(req)), A],
  ['PUT', /^\/services\/(\d+)$/, async ({ req, params }) => saveService(Number(params[0]), await readJSON(req)), A],
  ['DELETE', /^\/services\/(\d+)$/, ({ params }) => {
    db.prepare('DELETE FROM services WHERE id = ?').run(Number(params[0]));
    return { ok: true };
  }, A],

  /* Categorías */
  ['POST', /^\/categories$/, async ({ req }) => saveCategory(0, await readJSON(req)), A],
  ['PUT', /^\/categories\/(\d+)$/, async ({ req, params }) => saveCategory(Number(params[0]), await readJSON(req)), A],
  ['DELETE', /^\/categories\/(\d+)$/, ({ params }) => {
    db.prepare('DELETE FROM categories WHERE id = ?').run(Number(params[0]));
    return { ok: true };
  }, A],

  /* Profesionales */
  ['POST', /^\/professionals$/, async ({ req }) => saveProfessional(0, await readJSON(req)), A],
  ['PUT', /^\/professionals\/(\d+)$/, async ({ req, params }) => saveProfessional(Number(params[0]), await readJSON(req)), A],
  ['DELETE', /^\/professionals\/(\d+)$/, ({ params }) => {
    db.prepare('DELETE FROM professionals WHERE id = ?').run(Number(params[0]));
    return { ok: true };
  }, A],

  /* Galería */
  ['POST', /^\/gallery$/, async ({ req }) => {
    const b = await readJSON(req);
    const image = imgPath(b.image);
    if (!image) throw new HttpError(400, 'Falta la imagen.');
    const cat = GALLERY_CATS.some(c => c.key === b.category) ? b.category : 'color';
    const r = db.prepare('INSERT INTO gallery (image, category, caption, visible, sort_order) VALUES (?,?,?,?,?)')
      .run(image, cat, str(b.caption, 120), b.visible === undefined ? 1 : bool(b.visible), clampInt(b.sort_order, -9999, 9999, 0));
    return { item: db.prepare('SELECT * FROM gallery WHERE id = ?').get(r.lastInsertRowid) };
  }, A],
  ['PUT', /^\/gallery\/(\d+)$/, async ({ req, params }) => {
    const b = await readJSON(req);
    const cur = db.prepare('SELECT * FROM gallery WHERE id = ?').get(Number(params[0]));
    if (!cur) throw new HttpError(404, 'No encontrado.');
    const cat = GALLERY_CATS.some(c => c.key === b.category) ? b.category : cur.category;
    db.prepare('UPDATE gallery SET category=?, caption=?, visible=?, sort_order=? WHERE id=?')
      .run(cat, 'caption' in b ? str(b.caption, 120) : cur.caption, 'visible' in b ? bool(b.visible) : cur.visible,
        'sort_order' in b ? clampInt(b.sort_order, -9999, 9999, 0) : cur.sort_order, cur.id);
    return { item: db.prepare('SELECT * FROM gallery WHERE id = ?').get(cur.id) };
  }, A],
  ['DELETE', /^\/gallery\/(\d+)$/, ({ params }) => {
    const cur = db.prepare('SELECT * FROM gallery WHERE id = ?').get(Number(params[0]));
    if (cur) {
      db.prepare('DELETE FROM gallery WHERE id = ?').run(cur.id);
      removeUpload(cur.image);
    }
    return { ok: true };
  }, A],

  /* Reseñas */
  ['POST', /^\/reviews$/, async ({ req }) => saveReview(0, await readJSON(req)), A],
  ['PUT', /^\/reviews\/(\d+)$/, async ({ req, params }) => saveReview(Number(params[0]), await readJSON(req)), A],
  ['DELETE', /^\/reviews\/(\d+)$/, ({ params }) => {
    db.prepare('DELETE FROM reviews WHERE id = ?').run(Number(params[0]));
    return { ok: true };
  }, A],

  /* Configuración */
  ['PUT', /^\/settings$/, async ({ req }) => {
    const b = await readJSON(req, 200e3);
    const clean = {};
    for (const [k, v] of Object.entries(b || {})) {
      if (!(k in DEFAULT_SETTINGS)) continue;
      let val = String(v ?? '').slice(0, 2000);
      if (/_url$/.test(k) && val && !/^https:\/\//i.test(val)) throw new HttpError(400, `El enlace "${k}" debe empezar con https://`);
      if (k === 'maps_url' && val && !/^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(val)) {
        throw new HttpError(400, 'Pegá el enlace de Google Maps del salón (https://maps.app.goo.gl/... o https://www.google.com/maps/...).');
      }
      if (/_image$/.test(k)) val = imgPath(val);
      if (/^booking_(slot_interval|default_duration|min_notice|window_days|capacity)$/.test(k)) val = String(clampInt(val, 0, 43200, Number(DEFAULT_SETTINGS[k])));
      if (k === 'whatsapp_number') val = val.replace(/\D/g, '');
      clean[k] = val;
    }
    return { settings: saveSettings(clean) };
  }, A],

  /* Imágenes */
  ['POST', /^\/upload$/, async ({ req }) => {
    const b = await readJSON(req, 14e6);
    const m = /^data:image\/(webp|jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(String(b.dataUrl || ''));
    if (!m) throw new HttpError(400, 'Formato de imagen no admitido. Usá JPG, PNG o WEBP.');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 10e6) throw new HttpError(413, 'La imagen es demasiado pesada (máximo 10 MB).');
    const isJpg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
    const isPng = buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
    const isWebp = buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP';
    const ext = isJpg ? 'jpg' : isPng ? 'png' : isWebp ? 'webp' : null;
    if (!ext) throw new HttpError(400, 'El archivo no es una imagen válida.');
    const sub = nowLocal().date.slice(0, 7);
    const dir = path.join(UPLOAD_DIR, sub);
    fs.mkdirSync(dir, { recursive: true });
    const name = `${Date.now().toString(36)}-${randomHex(5)}.${ext}`;
    fs.writeFileSync(path.join(dir, name), buf);
    return { url: `/uploads/${sub}/${name}` };
  }, A],

  /* Usuarios */
  ['GET', /^\/users$/, () => ({ users: db.prepare('SELECT id, username, name, role, active, created_at, last_login_at FROM users ORDER BY id').all() }), A],
  ['POST', /^\/users$/, async ({ req }) => {
    const b = await readJSON(req);
    const username = str(b.username, 40).toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new HttpError(400, 'El usuario debe tener entre 3 y 40 caracteres (letras, números, punto o guion).');
    if (String(b.password || '').length < 8) throw new HttpError(400, 'La contraseña debe tener al menos 8 caracteres.');
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) throw new HttpError(400, 'Ese usuario ya existe.');
    db.prepare('INSERT INTO users (username, name, password_hash, role) VALUES (?,?,?,?)')
      .run(username, str(b.name, 80), hashPassword(b.password), b.role === 'staff' ? 'staff' : 'admin');
    return { ok: true };
  }, A],
  ['PUT', /^\/users\/(\d+)$/, async ({ req, params, user }) => {
    const b = await readJSON(req);
    const id = Number(params[0]);
    const cur = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!cur) throw new HttpError(404, 'Usuario no encontrado.');
    if (id === user.id && (b.active === false || b.role === 'staff')) throw new HttpError(400, 'No podés quitarte permisos a vos misma/o.');
    if ('name' in b || 'role' in b || 'active' in b) {
      db.prepare('UPDATE users SET name=?, role=?, active=? WHERE id=?').run('name' in b ? str(b.name, 80) : cur.name,
        'role' in b ? (b.role === 'staff' ? 'staff' : 'admin') : cur.role, 'active' in b ? bool(b.active) : cur.active, id);
    }
    if (b.password) {
      if (String(b.password).length < 8) throw new HttpError(400, 'La contraseña debe tener al menos 8 caracteres.');
      db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(b.password), id);
      if (id !== user.id) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    }
    if ('active' in b && !bool(b.active)) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
    return { ok: true };
  }, A],
  ['DELETE', /^\/users\/(\d+)$/, ({ params, user }) => {
    const id = Number(params[0]);
    if (id === user.id) throw new HttpError(400, 'No podés eliminar tu propio usuario.');
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return { ok: true };
  }, A]
];

function saveService(id, b) {
  const name = str(b.name, 80);
  if (!name) throw new HttpError(400, 'El servicio necesita un nombre.');
  const cur = id ? db.prepare('SELECT * FROM services WHERE id = ?').get(id) : null;
  if (id && !cur) throw new HttpError(404, 'Servicio no encontrado.');
  const catId = b.category_id ? Number(b.category_id) : null;
  if (catId && !db.prepare('SELECT 1 FROM categories WHERE id = ?').get(catId)) throw new HttpError(400, 'Categoría inválida.');
  const options = parseOptions(b.price_options).filter(o => o.amount >= 0);
  const cat = catId ? db.prepare('SELECT art FROM categories WHERE id = ?').get(catId) : null;
  const art = artNames().includes(b.art) ? b.art : (cur ? cur.art : (cat && cat.art) || 'balayage');
  const values = [catId, name, str(b.description, 600), intOrNull(b.price), bool(b.price_from), JSON.stringify(options), intOrNull(b.duration_min),
    imgPath(b.image), art, b.bookable === undefined ? 1 : bool(b.bookable), b.active === undefined ? 1 : bool(b.active), clampInt(b.sort_order, -9999, 9999, 0)];
  return tx(() => {
    let sid = id;
    if (id) {
      db.prepare(`UPDATE services SET category_id=?, name=?, description=?, price=?, price_from=?, price_options=?, duration_min=?, image=?, art=?,
        bookable=?, active=?, sort_order=?, updated_at=datetime('now') WHERE id=?`).run(...values, id);
    } else {
      sid = Number(db.prepare(`INSERT INTO services (category_id, name, description, price, price_from, price_options, duration_min, image, art, bookable,
        active, sort_order, slug) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(...values, uniqueSlug('services', name)).lastInsertRowid);
    }
    if (Array.isArray(b.professionals)) {
      db.prepare('DELETE FROM professional_services WHERE service_id = ?').run(sid);
      const ins = db.prepare('INSERT OR IGNORE INTO professional_services (professional_id, service_id) VALUES (?, ?)');
      for (const pid of b.professionals) if (db.prepare('SELECT 1 FROM professionals WHERE id = ?').get(Number(pid))) ins.run(Number(pid), sid);
    }
    return { id: sid };
  });
}
function saveCategory(id, b) {
  const name = str(b.name, 60);
  if (!name) throw new HttpError(400, 'La categoría necesita un nombre.');
  const art = artNames().includes(b.art) ? b.art : 'balayage';
  const v = [name, str(b.subtitle, 60), str(b.description, 600), imgPath(b.image), art, clampInt(b.sort_order, -9999, 9999, 0), b.active === undefined ? 1 : bool(b.active)];
  if (id) {
    const r = db.prepare('UPDATE categories SET name=?, subtitle=?, description=?, image=?, art=?, sort_order=?, active=? WHERE id=?').run(...v, id);
    if (!r.changes) throw new HttpError(404, 'Categoría no encontrada.');
    return { id };
  }
  return { id: Number(db.prepare('INSERT INTO categories (name, subtitle, description, image, art, sort_order, active, slug) VALUES (?,?,?,?,?,?,?,?)').run(...v, uniqueSlug('categories', name)).lastInsertRowid) };
}
function saveProfessional(id, b) {
  const name = str(b.name, 80);
  if (!name) throw new HttpError(400, 'Ingresá el nombre de la profesional.');
  const useSalon = b.use_salon_hours === undefined ? 1 : bool(b.use_salon_hours);
  const weekly = useSalon ? [] : validateWeekly(b.schedule || []);
  const color = /^#[0-9a-f]{6}$/i.test(b.color || '') ? b.color : '#B25C7A';
  const v = [name, str(b.role, 80), str(b.bio, 600), imgPath(b.photo), color, useSalon, b.show_on_site === undefined ? 1 : bool(b.show_on_site),
    b.active === undefined ? 1 : bool(b.active), clampInt(b.sort_order, -9999, 9999, 0)];
  return tx(() => {
    let pid = id;
    if (id) {
      const r = db.prepare('UPDATE professionals SET name=?, role=?, bio=?, photo=?, color=?, use_salon_hours=?, show_on_site=?, active=?, sort_order=? WHERE id=?').run(...v, id);
      if (!r.changes) throw new HttpError(404, 'Profesional no encontrada.');
    } else {
      pid = Number(db.prepare('INSERT INTO professionals (name, role, bio, photo, color, use_salon_hours, show_on_site, active, sort_order) VALUES (?,?,?,?,?,?,?,?,?)').run(...v).lastInsertRowid);
    }
    saveWeekly(pid, weekly);
    if (Array.isArray(b.services)) {
      db.prepare('DELETE FROM professional_services WHERE professional_id = ?').run(pid);
      const ins = db.prepare('INSERT OR IGNORE INTO professional_services (professional_id, service_id) VALUES (?, ?)');
      for (const sid of b.services) if (db.prepare('SELECT 1 FROM services WHERE id = ?').get(Number(sid))) ins.run(pid, Number(sid));
    }
    return { id: pid };
  });
}
function saveReview(id, b) {
  const author = str(b.author, 80), text = str(b.text, 1200);
  if (!author || !text) throw new HttpError(400, 'Completá el nombre y el texto de la reseña.');
  const rating = b.rating ? clampInt(b.rating, 1, 5, 5) : null;
  const v = [author, rating, text, str(b.review_date, 40), str(b.source, 40), b.visible === undefined ? 1 : bool(b.visible), clampInt(b.sort_order, -9999, 9999, 0)];
  if (id) {
    const r = db.prepare('UPDATE reviews SET author=?, rating=?, text=?, review_date=?, source=?, visible=?, sort_order=? WHERE id=?').run(...v, id);
    if (!r.changes) throw new HttpError(404, 'Reseña no encontrada.');
    return { id };
  }
  return { id: Number(db.prepare('INSERT INTO reviews (author, rating, text, review_date, source, visible, sort_order) VALUES (?,?,?,?,?,?,?)').run(...v).lastInsertRowid) };
}
function removeUpload(url) {
  if (!String(url).startsWith('/uploads/')) return;
  const still = ['gallery', 'services', 'categories'].some(t => db.prepare(`SELECT 1 FROM ${t} WHERE image = ?`).get(url)) ||
    db.prepare('SELECT 1 FROM professionals WHERE photo = ?').get(url) || Object.values(getSettings()).includes(url);
  if (still) return;
  const file = path.normalize(path.join(UPLOAD_DIR, url.slice('/uploads/'.length)));
  if (file.startsWith(path.normalize(UPLOAD_DIR))) fs.rm(file, { force: true }, () => {});
}

/* ---------- Despachador ---------- */
async function handleApi(req, res, url) {
  const ip = clientIP(req);
  const ctx = { req, res, url, query: url.searchParams, ip, params: [] };
  try {
    const p = url.pathname;
    if (p.startsWith('/api/admin/')) {
      const sub = p.slice('/api/admin'.length);
      if (req.method !== 'GET' && req.headers['x-requested-with'] !== 'fem-admin') throw new HttpError(403, 'Solicitud no permitida.');
      if (sub === '/login' && req.method === 'POST') {
        if (!limits.login.hit(ip)) throw new HttpError(429, 'Demasiados intentos. Esperá unos minutos.');
        const b = await readJSON(req, 4e3);
        const u = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(str(b.username, 60));
        if (!u || !verifyPassword(b.password, u.password_hash)) throw new HttpError(401, 'Usuario o contraseña incorrectos.');
        const token = randomHex(32);
        db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
        db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), u.id, Date.now() + SESSION_DAYS * 864e5);
        db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(u.id);
        setSessionCookie(req, res, token, SESSION_DAYS * 86400);
        return json(res, 200, { user: { id: u.id, username: u.username, name: u.name, role: u.role } });
      }
      const user = currentUser(req);
      if (!user) throw new HttpError(401, 'Tu sesión expiró. Volvé a ingresar.');
      ctx.user = user;
      for (const [method, re, fn, role] of adminRoutes) {
        const m = req.method === method && re.exec(sub);
        if (!m) continue;
        if (role === A && user.role !== 'admin') throw new HttpError(403, 'Tu usuario no tiene permisos para esta acción.');
        ctx.params = m.slice(1);
        return json(res, 200, await fn(ctx));
      }
      throw new HttpError(404, 'Ruta no encontrada.');
    }
    if (p.startsWith('/api/availability') && !limits.availability.hit(ip)) throw new HttpError(429, 'Demasiadas consultas. Esperá un momento.');
    const ics = /^\/api\/appointments\/([A-Z0-9-]+)\/ics$/i.exec(p);
    if (ics && req.method === 'GET') {
      const a = appts.findByToken(ics[1], url.searchParams.get('t'));
      res.writeHead(200, { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="turno-${a.code}.ics"`, 'Cache-Control': 'no-store' });
      return res.end(appts.buildICS(a, getSettings()));
    }
    for (const [method, re, fn] of publicRoutes) {
      const m = req.method === method && re.exec(p);
      if (!m) continue;
      ctx.params = m.slice(1);
      return json(res, 200, await fn(ctx));
    }
    throw new HttpError(404, 'Ruta no encontrada.');
  } catch (e) {
    if (e instanceof HttpError) return json(res, e.status, { error: e.message, ...e.extra });
    console.error(e);
    return json(res, 500, { error: 'Ocurrió un error inesperado. Intentá nuevamente.' });
  }
}

module.exports = { handleApi };
