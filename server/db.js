'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { hashPassword, randomHex } = require('./util');

// node:sqlite emite un aviso "experimental" en algunas versiones de Node; lo silenciamos solo a él.
const origEmit = process.emitWarning;
process.emitWarning = (w, ...a) => (String(w).includes('SQLite') ? undefined : origEmit.call(process, w, ...a));
const { DatabaseSync } = require('node:sqlite');
process.emitWarning = origEmit;

const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(ROOT, 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(process.env.DB_FILE || path.join(DATA_DIR, 'femsalon.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','staff')),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  subtitle    TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  image       TEXT NOT NULL DEFAULT '',
  art         TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS services (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  price         INTEGER,
  price_from    INTEGER NOT NULL DEFAULT 0,
  price_options TEXT NOT NULL DEFAULT '[]',
  duration_min  INTEGER,
  image         TEXT NOT NULL DEFAULT '',
  art           TEXT NOT NULL DEFAULT '',
  bookable      INTEGER NOT NULL DEFAULT 1,
  active        INTEGER NOT NULL DEFAULT 1,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS professionals (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT '',
  bio             TEXT NOT NULL DEFAULT '',
  photo           TEXT NOT NULL DEFAULT '',
  color           TEXT NOT NULL DEFAULT '#B25C7A',
  use_salon_hours INTEGER NOT NULL DEFAULT 1,
  show_on_site    INTEGER NOT NULL DEFAULT 1,
  active          INTEGER NOT NULL DEFAULT 1,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS professional_services (
  professional_id INTEGER NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  service_id      INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (professional_id, service_id)
);
-- professional_id NULL = horario general del salón
CREATE TABLE IF NOT EXISTS schedules (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  professional_id INTEGER REFERENCES professionals(id) ON DELETE CASCADE,
  weekday         INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time      TEXT NOT NULL,
  end_time        TEXT NOT NULL
);
-- Bloqueos (cerrar horarios) y aperturas especiales. professional_id NULL = todo el salón.
CREATE TABLE IF NOT EXISTS time_blocks (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  type            TEXT NOT NULL DEFAULT 'block' CHECK (type IN ('block','open')),
  professional_id INTEGER REFERENCES professionals(id) ON DELETE CASCADE,
  date_from       TEXT NOT NULL,
  date_to         TEXT NOT NULL,
  start_time      TEXT,
  end_time        TEXT,
  reason          TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS appointments (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  code              TEXT NOT NULL UNIQUE,
  token             TEXT NOT NULL,
  service_id        INTEGER REFERENCES services(id) ON DELETE SET NULL,
  service_name      TEXT NOT NULL,
  professional_id   INTEGER REFERENCES professionals(id) ON DELETE SET NULL,
  professional_name TEXT NOT NULL DEFAULT '',
  date              TEXT NOT NULL,
  start_time        TEXT NOT NULL,
  end_time          TEXT NOT NULL,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  phone             TEXT NOT NULL,
  email             TEXT NOT NULL DEFAULT '',
  comment           TEXT NOT NULL DEFAULT '',
  admin_notes       TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','confirmado','completado','cancelado')),
  source            TEXT NOT NULL DEFAULT 'web',
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  cancelled_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_appt_date ON appointments(date, status);
CREATE INDEX IF NOT EXISTS idx_appt_pro  ON appointments(professional_id, date);
CREATE TABLE IF NOT EXISTS reviews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  author      TEXT NOT NULL,
  rating      INTEGER CHECK (rating BETWEEN 1 AND 5),
  text        TEXT NOT NULL DEFAULT '',
  review_date TEXT NOT NULL DEFAULT '',
  source      TEXT NOT NULL DEFAULT '',
  visible     INTEGER NOT NULL DEFAULT 1,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS gallery (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  image      TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'color',
  caption    TEXT NOT NULL DEFAULT '',
  visible    INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

/* ---------- Configuración editable (valores iniciales = datos confirmados) ---------- */
const MAPS_QUERY = encodeURIComponent('FEM salón, Rodríguez Peña 1149, Castelar, Buenos Aires');
const DEFAULT_SETTINGS = {
  business_name: 'FEM salón',
  address_street: 'Rodríguez Peña 1149',
  address_city: 'Castelar',
  address_region: 'Provincia de Buenos Aires',
  address_postal: 'B1712',
  address_country: 'Argentina',
  phone_display: '011 2778-6008',
  phone_intl: '+541127786008',
  whatsapp_number: '5491127786008',
  email: '',
  instagram_url: '',
  // Única URL de Google Maps que se carga a mano. "Cómo llegar", el mapa y el enlace
  // a las reseñas se arman solos a partir de la dirección (ver mapLinks() en render.js).
  maps_url: `https://www.google.com/maps/search/?api=1&query=${MAPS_QUERY}`,
  rating_value: '4,9',
  rating_count: '240',
  rating_source: 'Google',
  logo_image: '',
  hero_image: '',
  about_image: '',
  hero_eyebrow: 'Peluquería y colorimetría en Castelar',
  hero_title: 'Tu cabello, *nuestro arte.*',
  hero_subtitle: 'Color, cuidado y estilo personalizado en FEM salón.',
  about_title: 'Bienvenidas a *FEM salón*',
  about_text: 'En FEM salón nos especializamos en el cuidado, transformación y belleza del cabello. Trabajamos cada servicio de manera personalizada, buscando que cada clienta encuentre un resultado que se adapte a su estilo, su cabello y lo que desea lograr.',
  services_title: 'Encontrá tu *próximo look.*',
  services_intro: 'Colorimetría, cortes y tratamientos pensados para tu cabello.',
  color_title: 'Especialistas en *colorimetría*',
  color_text: 'Iluminamos tu cabello respetando su personalidad y buscando un resultado que se adapte a vos.',
  gallery_title: 'Color pensado *para vos.*',
  gallery_intro: 'Algunos de nuestros trabajos.',
  reviews_title: 'Lo que dicen *nuestras clientas*',
  booking_title: 'Reservá *tu turno*',
  booking_intro: 'Reservá tu turno y empezá a transformar tu look.',
  booking_notice: '',
  contact_title: 'Encontranos',
  footer_tagline: 'Tu cabello, nuestro arte.',
  wa_default_message: 'Hola FEM salón, quisiera consultar por un turno.',
  wa_service_message: 'Hola FEM salón, quisiera consultar por un turno para {servicio}.',
  wa_color_message: 'Hola FEM salón, quisiera hacer una consulta de color.',
  booking_enabled: '1',
  booking_slot_interval: '30',
  booking_default_duration: '60',
  booking_min_notice: '60',
  booking_window_days: '60',
  booking_capacity: '1',
  booking_auto_confirm: '0',
  booking_allow_cancel: '1',
  show_placeholders: '1',
  seo_title: 'FEM salón | Peluquería y Colorimetría en Castelar',
  seo_description: 'FEM salón en Castelar. Peluquería, colorimetría, balayage, babylights, cortes y tratamientos capilares. Reservá tu turno.',
  seo_keywords: 'peluquería Castelar, peluquería en Castelar, colorimetría Castelar, balayage Castelar, babylights Castelar, peluquería cerca de Castelar, salón de belleza Castelar',
  site_url: ''
};

const insSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insSetting.run(k, v);

let settingsCache = null;
function getSettings() {
  if (!settingsCache) {
    settingsCache = { ...DEFAULT_SETTINGS };
    for (const r of db.prepare('SELECT key, value FROM settings').all()) settingsCache[r.key] = r.value;
  }
  return settingsCache;
}
function saveSettings(obj) {
  const up = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  db.exec('BEGIN');
  try {
    for (const [k, v] of Object.entries(obj)) if (k in DEFAULT_SETTINGS) up.run(k, String(v ?? ''));
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  settingsCache = null;
  return getSettings();
}

/* ---------- Datos iniciales (solo la primera vez) ---------- */
function seed() {
  const hasCats = db.prepare('SELECT COUNT(*) n FROM categories').get().n > 0;
  if (!hasCats) {
    const insCat = db.prepare('INSERT INTO categories (slug, name, subtitle, description, art, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
    const insSvc = db.prepare(`INSERT INTO services (category_id, slug, name, description, price, price_options, duration_min, art, sort_order)
      VALUES (?, ?, ?, ?, NULL, ?, NULL, ?, ?)`);
    const cats = [
      ['colorimetria', 'Colorimetría', '', 'Trabajos de color personalizados para lograr el resultado que buscás, teniendo en cuenta la base, el estado del cabello y el resultado deseado.', 'balayage', [
        ['balayage', 'Balayage', 'Iluminación personalizada para lograr un resultado natural y luminoso.', 'balayage'],
        ['babylights', 'Babylights', 'Técnica de iluminación sutil para aportar luminosidad y dimensión al cabello.', 'babylights'],
        ['tecnicas-de-iluminacion', 'Técnicas de iluminación', 'Iluminaciones personalizadas según tu base y el resultado que buscás.', 'iluminaciones'],
        ['tintura', 'Tintura', 'Color personalizado según el tono que buscás y el estado de tu cabello.', 'tintura'],
        ['correccion-de-color', 'Corrección de color', 'Servicio personalizado para corregir y transformar trabajos de color anteriores.', 'correccion']
      ]],
      ['cortes', 'Cortes', '', 'Un corte pensado para adaptarse a tu estilo y a las características de tu cabello.', 'cortes', [
        ['corte-personalizado', 'Corte personalizado', 'Un corte pensado para adaptarse a tu estilo y a las características de tu cabello.', 'cortes']
      ]],
      ['tratamientos', 'Tratamientos', '', 'Tratamientos orientados al cuidado, nutrición y mantenimiento de la salud del cabello.', 'tratamientos', [
        ['nutricion', 'Nutrición', 'Tratamiento orientado a nutrir y cuidar tu cabello.', 'tratamientos'],
        ['tratamiento-capilar', 'Tratamiento capilar', 'Tratamientos pensados según las necesidades de tu cabello.', 'brillo'],
        ['alisado', 'Alisado', 'Alisado pensado según tu tipo de cabello y el resultado que buscás.', 'alisado']
      ]]
    ];
    db.exec('BEGIN');
    cats.forEach(([slug, name, sub, desc, art, services], ci) => {
      const catId = insCat.run(slug, name, sub, desc, art, ci + 1).lastInsertRowid;
      services.forEach(([sslug, sname, sdesc, sart, opts], si) => {
        const options = JSON.stringify((opts || []).map(([label, amount]) => ({ label, amount })));
        insSvc.run(catId, sslug, sname, sdesc, options, sart, si + 1);
      });
    });
    db.exec('COMMIT');
  }
  const hasSchedule = db.prepare('SELECT COUNT(*) n FROM schedules WHERE professional_id IS NULL').get().n > 0;
  if (!hasSchedule) {
    const ins = db.prepare('INSERT INTO schedules (professional_id, weekday, start_time, end_time) VALUES (NULL, ?, ?, ?)');
    for (let wd = 0; wd < 7; wd++) ins.run(wd, '09:00', '22:00');
  }
  const hasUsers = db.prepare('SELECT COUNT(*) n FROM users').get().n > 0;
  if (!hasUsers) {
    const username = process.env.ADMIN_USER || 'admin';
    const password = process.env.ADMIN_PASSWORD || randomHex(6);
    db.prepare('INSERT INTO users (username, name, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(username, 'Administración', hashPassword(password), 'admin');
    const line = '='.repeat(62);
    console.log(`\n${line}\n  Usuario administrador creado\n  Usuario:    ${username}\n  Contraseña: ${process.env.ADMIN_PASSWORD ? '(la definida en ADMIN_PASSWORD)' : password}\n  Cambiala desde el panel: /admin  →  Usuarios\n${line}\n`);
  }
}
seed();

module.exports = { db, getSettings, saveSettings, DEFAULT_SETTINGS, DATA_DIR, UPLOAD_DIR, ROOT };
