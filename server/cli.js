'use strict';
/*
 * Utilidades de línea de comandos:
 *   npm run admin:reset  -- <usuario> <nueva-contraseña>
 *   npm run admin:create -- <usuario> <contraseña> [admin|staff]
 */
const path = require('node:path');
try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch { /* sin .env */ }
const { db } = require('./db');
const { hashPassword } = require('./util');

const [cmd, a, b, c] = process.argv.slice(2);

function fail(msg) { console.error(msg); process.exit(1); }

if (cmd === 'reset-password') {
  if (!a || !b) fail('Uso: npm run admin:reset -- <usuario> <nueva-contraseña>');
  if (b.length < 8) fail('La contraseña debe tener al menos 8 caracteres.');
  const r = db.prepare('UPDATE users SET password_hash = ?, active = 1 WHERE username = ?').run(hashPassword(b), a);
  if (!r.changes) fail(`No existe el usuario "${a}".`);
  db.prepare('DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE username = ?)').run(a);
  console.log(`Contraseña actualizada para "${a}".`);
} else if (cmd === 'create-user') {
  if (!a || !b) fail('Uso: npm run admin:create -- <usuario> <contraseña> [admin|staff]');
  if (b.length < 8) fail('La contraseña debe tener al menos 8 caracteres.');
  const role = c === 'staff' ? 'staff' : 'admin';
  try {
    db.prepare('INSERT INTO users (username, name, password_hash, role) VALUES (?, ?, ?, ?)').run(a, a, hashPassword(b), role);
    console.log(`Usuario "${a}" creado con rol ${role}.`);
  } catch { fail(`No se pudo crear: el usuario "${a}" ya existe.`); }
} else {
  console.log('Comandos: reset-password <usuario> <clave> | create-user <usuario> <clave> [admin|staff]');
}
