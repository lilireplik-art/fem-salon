'use strict';
/*
 * Prueba integral: levanta el servidor con una base de datos temporal y verifica
 * el sitio público, la disponibilidad, la reserva de turnos y el panel.
 *   npm test
 */
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'femsalon-test-'));
process.env.DATA_DIR = tmp;
process.env.UPLOAD_DIR = path.join(tmp, 'uploads');
process.env.ADMIN_USER = 'admin';
process.env.ADMIN_PASSWORD = 'clave-de-prueba-123';
process.env.PORT = '0';

const { server } = require('./index');
const { db } = require('./db');
const { addDays, nowLocal } = require('./util');

let base = '';
let cookie = '';
let pass = 0;
const failures = [];

function check(name, cond, extra) {
  if (cond) { pass++; return true; }
  failures.push(name + (extra ? ` → ${extra}` : ''));
  return false;
}
async function req(url, { method = 'GET', body, admin = false, headers = {} } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(admin ? { 'X-Requested-With': 'fem-admin' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual'
  });
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of setCookie) if (c.startsWith('fem_sid=')) cookie = c.split(';')[0];
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : await res.text();
  return { status: res.status, data, type, headers: res.headers };
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;

  /* ---------- Sitio público ---------- */
  const home = await req('/');
  check('La portada responde 200', home.status === 200, home.status);
  for (const needle of ['FEM salón', 'Tu cabello', 'Rodríguez Peña 1149', 'Castelar', '011 2778-6008',
    'Especialistas en', 'Balayage', 'Babylights', 'HairSalon', 'Reservá', 'wa.me/',
    'href="/servicios"', 'href="/turnos"', 'href="/contacto"']) {
    check(`La portada incluye "${needle}"`, home.data.includes(needle));
  }
  check('La portada ya no muestra Cejas y pestañas', !home.data.includes('Cejas y pestañas') && !home.data.includes('Star Lash'));

  // Cada sección es ahora una página propia.
  const paths = ['/servicios', '/colorimetria', '/galeria', '/nosotros', '/turnos', '/contacto'];
  const pageHtml = {};
  for (const ruta of paths) {
    const r = await req(ruta);
    pageHtml[ruta] = r.data;
    check(`${ruta} responde 200`, r.status === 200, r.status);
    check(`${ruta} tiene un solo <h1>`, (r.data.match(/<h1/g) || []).length === 1, (r.data.match(/<h1/g) || []).length);
    check(`${ruta} marca su enlace en el menú`, r.data.includes(`href="${ruta}" aria-current="page"`));
    check(`${ruta} lleva a las demás páginas`, r.data.includes('href="/galeria"') && r.data.includes('href="/turnos"'));
  }
  check('/turnos incluye el asistente de reservas', pageHtml['/turnos'].includes('id="bootData"') && pageHtml['/turnos'].includes('id="booker"'));
  check('La portada ya no incluye el asistente', !home.data.includes('id="bootData"'));
  check('/contacto incluye el mapa', pageHtml['/contacto'].includes('google.com/maps'));
  check('/galeria incluye los filtros', pageHtml['/galeria'].includes('data-filter="balayage"'));
  const redir = await req('/servicios/');
  check('/servicios/ redirige sin la barra final', redir.status === 301, redir.status);
  // Ningún servicio debe mostrar un precio que el salón no confirmó.
  const cards = [...pageHtml['/servicios'].matchAll(/<article class="svc-card">[\s\S]*?<\/article>/g)].map(x => x[0]);
  check('Se renderizan las 9 tarjetas de servicios', cards.length === 9, cards.length);
  const cardOf = n => cards.find(c => c.includes(`>${n}</h4>`));
  for (const n of ['Balayage', 'Babylights', 'Técnicas de iluminación', 'Tintura', 'Corrección de color',
    'Corte personalizado', 'Nutrición', 'Tratamiento capilar', 'Alisado']) {
    const c = cardOf(n);
    check(`"${n}" muestra "Consultar" y ningún precio inventado`, !!c && !/\$\d/.test(c) && c.includes('Consultar'),
      c ? 'la tarjeta muestra un precio' : 'no se encontró la tarjeta');
  }
  check('Cada tarjeta enlaza a /turnos con su servicio', cards.every(c => /href="\/turnos\?servicio=\d+"/.test(c)));

  for (const [url, type] of [['/css/site.css', 'text/css'], ['/js/site.js', 'javascript'], ['/admin/', 'text/html'],
    ['/admin/admin.js', 'javascript'], ['/admin/admin.css', 'text/css'], ['/art/balayage.svg', 'image/svg'],
    ['/art/cejas.svg', 'image/svg'], ['/art/hero.svg', 'image/svg'], ['/favicon.svg', 'image/svg'],
    ['/robots.txt', 'text/plain'], ['/sitemap.xml', 'xml']]) {
    const r = await req(url);
    check(`${url} responde 200 (${type})`, r.status === 200 && r.type.includes(type), `${r.status} ${r.type}`);
  }
  // El JavaScript del navegador tiene que compilar: un error de sintaxis deja el panel en blanco.
  const vm = require('node:vm');
  for (const f of ['/js/site.js', '/admin/admin.js']) {
    const code = (await req(f)).data;
    let ok = true, msg = '';
    try { new vm.Script(code, { filename: f }); } catch (e) { ok = false; msg = e.message; }
    check(`${f} compila sin errores de sintaxis`, ok, msg);
  }

  const nf = await req('/pagina-que-no-existe');
  check('404 devuelve la página de error', nf.status === 404 && nf.data.includes('No encontramos'));

  /* ---------- Disponibilidad ---------- */
  const svc = db.prepare("SELECT * FROM services WHERE slug = 'balayage'").get();
  const corte = db.prepare("SELECT * FROM services WHERE slug = 'corte-personalizado'").get();
  check('Se sembraron los servicios', !!svc && !!corte);
  const today = nowLocal().date;
  const date = addDays(today, 3);
  const month = date.slice(0, 7);

  const m = await req(`/api/availability/month?service=${svc.id}&professional=any&month=${month}`);
  check('Disponibilidad mensual responde', m.status === 200 && typeof m.data.days === 'object', m.status);
  check('Hay días disponibles en el mes', Object.values(m.data.days).some(n => n > 0));

  const d = await req(`/api/availability/day?service=${svc.id}&professional=any&date=${date}`);
  check('Disponibilidad diaria responde', d.status === 200 && Array.isArray(d.data.slots), d.status);
  check('Los horarios respetan la apertura (09:00)', d.data.slots[0] === '09:00', d.data.slots[0]);
  check('Los horarios respetan el cierre (22:00, 60 min)', d.data.slots[d.data.slots.length - 1] === '21:00', d.data.slots.at(-1));

  const past = await req(`/api/availability/day?service=${svc.id}&professional=any&date=${addDays(today, -1)}`);
  check('No hay horarios en fechas pasadas', past.data.slots.length === 0);

  /* ---------- Reserva pública ---------- */
  const bad = await req('/api/appointments', { method: 'POST', body: { serviceId: svc.id, date, time: '10:00', firstName: '', lastName: '', phone: '12' } });
  check('Rechaza datos incompletos (422)', bad.status === 422 && bad.data.errors, bad.status);

  const book = await req('/api/appointments', {
    method: 'POST',
    body: { serviceId: svc.id, professionalId: 'any', date, time: '10:00', firstName: 'Ana', lastName: 'Pérez', phone: '11 2345-6789', email: 'ana@example.com', comment: 'Primera vez' }
  });
  check('Reserva creada', book.status === 200 && book.data.appointment.code, JSON.stringify(book.data).slice(0, 120));
  const appt = book.data.appointment;
  check('La reserva queda pendiente', appt.status === 'pendiente', appt.status);

  const dup = await req('/api/appointments', {
    method: 'POST',
    body: { serviceId: svc.id, professionalId: 'any', date, time: '10:00', firstName: 'Otra', lastName: 'Clienta', phone: '11 9999-8888' }
  });
  check('El horario ocupado ya no se puede reservar (409)', dup.status === 409 && dup.data.slotTaken, dup.status);

  const after = await req(`/api/availability/day?service=${svc.id}&professional=any&date=${date}`);
  check('El horario reservado desaparece de la lista', !after.data.slots.includes('10:00'));
  check('El horario solapado (09:30) también se bloquea', !after.data.slots.includes('09:30'));

  const ics = await req(`/api/appointments/${appt.code}/ics?t=${book.data.manageUrl.split('t=')[1]}`);
  check('Descarga del .ics', ics.status === 200 && ics.data.includes('BEGIN:VCALENDAR'), ics.status);
  const manage = await req(book.data.manageUrl);
  check('Página "Tu turno" accesible con token', manage.status === 200 && manage.data.includes(appt.code));
  const manageBad = await req(`/turno/${appt.code}?t=token-invalido`);
  check('Token inválido no muestra el turno', manageBad.status === 404);

  /* ---------- Panel: autenticación ---------- */
  const noAuth = await req('/api/admin/bootstrap');
  check('El panel exige sesión (401)', noAuth.status === 401, noAuth.status);
  const badLogin = await req('/api/admin/login', { method: 'POST', admin: true, body: { username: 'admin', password: 'incorrecta' } });
  check('Login incorrecto rechazado (401)', badLogin.status === 401, badLogin.status);
  const login = await req('/api/admin/login', { method: 'POST', admin: true, body: { username: 'admin', password: process.env.ADMIN_PASSWORD } });
  check('Login correcto', login.status === 200 && login.data.user.role === 'admin', login.status);
  check('Se recibió la cookie de sesión', cookie.startsWith('fem_sid='));

  const csrf = await req('/api/admin/settings', { method: 'PUT', body: { business_name: 'Hack' } });
  check('Bloquea peticiones sin cabecera propia (CSRF)', csrf.status === 403, csrf.status);

  const boot = await req('/api/admin/bootstrap', { admin: true });
  check('Bootstrap del panel', boot.status === 200 && boot.data.services.length === 9, boot.data.services && boot.data.services.length);
  check('Ya no quedan servicios de Cejas y pestañas',
    !boot.data.services.some(x => ['Diseño y perfilado', 'Laminado', 'Lifting'].includes(x.name))
    && !boot.data.categories.some(c => c.slug === 'cejas-y-pestanas'));

  /* ---------- Panel: turnos ---------- */
  const list = await req(`/api/admin/appointments?from=${date}&to=${date}`, { admin: true });
  check('Listado de turnos del día', list.status === 200 && list.data.appointments.length === 1, list.status);
  const id = list.data.appointments[0].id;
  const conf = await req('/api/admin/appointments/' + id, { method: 'PUT', admin: true, body: { status: 'confirmado' } });
  check('Confirmar turno desde el panel', conf.status === 200 && conf.data.appointment.status === 'confirmado');

  const create = await req('/api/admin/appointments', {
    method: 'POST', admin: true,
    body: { serviceId: corte.id, date, time: '15:00', firstName: 'Lucía', lastName: 'Gómez', phone: '1122334455', status: 'confirmado' }
  });
  check('Alta de turno desde el panel', create.status === 200 && create.data.appointment.code, create.status);
  const clash = await req('/api/admin/appointments', {
    method: 'POST', admin: true,
    body: { serviceId: corte.id, date, time: '15:00', firstName: 'Otra', lastName: 'Clienta', phone: '1122334456', status: 'confirmado' }
  });
  check('Detecta superposición y avisa (409)', clash.status === 409 && clash.data.conflict, clash.status);
  const forced = await req('/api/admin/appointments', {
    method: 'POST', admin: true,
    body: { serviceId: corte.id, date, time: '15:00', firstName: 'Otra', lastName: 'Clienta', phone: '1122334456', status: 'confirmado', force: true }
  });
  check('Permite forzar el turno igualmente', forced.status === 200, forced.status);

  /* ---------- Panel: bloqueos ---------- */
  const blockDate = addDays(today, 4);
  const block = await req('/api/admin/blocks', {
    method: 'POST', admin: true,
    body: { type: 'block', dateFrom: blockDate, dateTo: blockDate, allDay: false, start: '09:00', end: '13:00', reason: 'Capacitación' }
  });
  check('Crea un bloqueo horario', block.status === 200 && block.data.id, block.status);
  const blocked = await req(`/api/availability/day?service=${svc.id}&professional=any&date=${blockDate}`);
  check('El bloqueo saca los horarios de la mañana', !blocked.data.slots.some(t => t < '13:00'), blocked.data.slots.slice(0, 3).join(','));
  check('La tarde sigue disponible', blocked.data.slots.includes('13:00'));
  await req('/api/admin/blocks/' + block.data.id, { method: 'DELETE', admin: true });
  const unblocked = await req(`/api/availability/day?service=${svc.id}&professional=any&date=${blockDate}`);
  check('Al quitar el bloqueo vuelven los horarios', unblocked.data.slots.includes('09:00'));

  /* ---------- Panel: profesionales y horarios propios ---------- */
  const pro = await req('/api/admin/professionals', {
    method: 'POST', admin: true,
    body: { name: 'Profesional de prueba', role: 'Colorista', use_salon_hours: 0, schedule: [{ weekday: new Date(date + 'T12:00:00Z').getUTCDay(), start: '10:00', end: '14:00' }], services: [svc.id] }
  });
  check('Alta de profesional', pro.status === 200 && pro.data.id, pro.status);
  const proDay = await req(`/api/availability/day?service=${svc.id}&professional=${pro.data.id}&date=${addDays(date, 7)}`);
  check('La profesional solo ofrece su horario propio', proDay.data.slots.length > 0 && proDay.data.slots[0] === '10:00' && proDay.data.slots.at(-1) === '13:00',
    proDay.data.slots.join(','));

  /* ---------- Panel: servicios y precios ---------- */
  const newSvc = await req('/api/admin/services', {
    method: 'POST', admin: true,
    body: { name: 'Servicio de prueba', category_id: boot.data.categories[0].id, description: 'Descripción', price: 45000, price_from: 1, duration_min: 90, bookable: 1, active: 1 }
  });
  check('Alta de servicio con precio', newSvc.status === 200 && newSvc.data.id, newSvc.status);
  const svcPage2 = await req('/servicios');
  check('El precio nuevo aparece en la web', svcPage2.data.includes('Desde $45.000'));
  await req('/api/admin/services/' + newSvc.data.id, { method: 'PUT', admin: true, body: { name: 'Servicio de prueba', price: '', duration_min: '', active: 1, bookable: 1 } });
  const svcPage3 = await req('/servicios');
  check('Al vaciar el precio vuelve a "Consultar"', !svcPage3.data.includes('Desde $45.000'));
  await req('/api/admin/services/' + newSvc.data.id, { method: 'DELETE', admin: true });

  /* ---------- Panel: configuración ---------- */
  const setts = await req('/api/admin/settings', { method: 'PUT', admin: true, body: { hero_title: 'Nuevo *título*', booking_min_notice: '30', instagram_url: 'https://www.instagram.com/femsalon' } });
  check('Guarda configuración', setts.status === 200 && setts.data.settings.hero_title === 'Nuevo *título*', setts.status);
  const home4 = await req('/');
  check('El texto editado se ve en la web', home4.data.includes('Nuevo <em>título</em>'));
  check('El Instagram configurado aparece', home4.data.includes('instagram.com/femsalon'));
  const badUrl = await req('/api/admin/settings', { method: 'PUT', admin: true, body: { instagram_url: 'javascript:alert(1)' } });
  check('Rechaza enlaces inválidos', badUrl.status === 400, badUrl.status);
  const badMap = await req('/api/admin/settings', { method: 'PUT', admin: true, body: { maps_url: 'https://ejemplo.com/mapa' } });
  check('Rechaza una URL que no es de Google Maps', badMap.status === 400, badMap.status);
  const okMap = await req('/api/admin/settings', { method: 'PUT', admin: true, body: { maps_url: 'https://maps.app.goo.gl/abc123' } });
  check('Acepta el enlace corto de Google Maps', okMap.status === 200, okMap.status);
  const contacto2 = await req('/contacto');
  check('"Cómo llegar" se arma solo con la dirección', contacto2.data.includes('maps/dir/') && contacto2.data.includes('destination=Rodr'));
  check('El mapa incrustado se arma solo', contacto2.data.includes('output=embed'));
  check('El enlace de reseñas usa la URL cargada', (await req('/nosotros')).data.includes('maps.app.goo.gl/abc123'));
  await req('/api/admin/settings', { method: 'PUT', admin: true, body: { hero_title: 'Tu cabello, *nuestro arte.*' } });

  /* ---------- Cancelación ---------- */
  const token = book.data.manageUrl.split('t=')[1];
  const cancel = await req(`/api/appointments/${appt.code}/cancel`, { method: 'POST', body: { token } });
  check('La clienta puede cancelar su turno', cancel.status === 200 && cancel.data.appointment.status === 'cancelado', cancel.status);
  const freed = await req(`/api/availability/day?service=${svc.id}&professional=any&date=${date}`);
  check('El horario cancelado vuelve a estar libre', freed.data.slots.includes('10:00'));
  const cancelBad = await req(`/api/appointments/${appt.code}/cancel`, { method: 'POST', body: { token: 'otro' } });
  check('No se puede cancelar sin el token correcto', cancelBad.status === 404, cancelBad.status);

  /* ---------- Escapado / seguridad ---------- */
  await req('/api/admin/settings', { method: 'PUT', admin: true, body: { about_text: 'Texto <script>alert(1)</script> seguro' } });
  const home5 = await req('/');
  check('El HTML se escapa correctamente', home5.data.includes('&lt;script&gt;') && !home5.data.includes('<script>alert(1)</script>'));
  await req('/api/admin/settings', { method: 'PUT', admin: true, body: { about_text: 'En FEM salón nos especializamos en el cuidado del cabello.' } });
  const trav = await req('/uploads/../../server/db.js');
  check('Bloquea el acceso fuera de /uploads', trav.status === 404, trav.status);

  const logout = await req('/api/admin/logout', { method: 'POST', admin: true });
  check('Cierre de sesión', logout.status === 200);
  const afterLogout = await req('/api/admin/bootstrap', { admin: true });
  check('Tras salir, el panel vuelve a pedir login', afterLogout.status === 401, afterLogout.status);

  /* ---------- Resultado ---------- */
  server.close();
  db.close();
  console.log(`\n✔ ${pass} comprobaciones correctas`);
  if (failures.length) {
    console.log(`✘ ${failures.length} fallaron:`);
    failures.forEach(f => console.log('   · ' + f));
  }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* queda en temp */ }
  process.exit(failures.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
