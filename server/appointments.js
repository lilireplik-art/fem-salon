'use strict';
const { db, getSettings } = require('./db');
const { computeDay, pickProfessional, durationOf } = require('./availability');
const {
  HttpError, TZ, isDate, isTime, toMin, toHHMM, randomCode, randomHex, str, nowLocal, dayNumber,
  safeEqual, clampInt, localToUTC, formatDateLong
} = require('./util');

const STATUSES = ['pendiente', 'confirmado', 'completado', 'cancelado'];
const ACTIVE = ['pendiente', 'confirmado'];

const q = {
  service: db.prepare('SELECT * FROM services WHERE id = ?'),
  pro: db.prepare('SELECT * FROM professionals WHERE id = ?'),
  byId: db.prepare('SELECT * FROM appointments WHERE id = ?'),
  byCode: db.prepare('SELECT * FROM appointments WHERE code = ?'),
  codeExists: db.prepare('SELECT 1 FROM appointments WHERE code = ?'),
  sameSlot: db.prepare("SELECT phone FROM appointments WHERE date = ? AND start_time = ? AND status IN ('pendiente','confirmado')"),
  insert: db.prepare(`INSERT INTO appointments
    (code, token, service_id, service_name, professional_id, professional_name, date, start_time, end_time,
     first_name, last_name, phone, email, comment, admin_notes, status, source)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`),
  update: db.prepare(`UPDATE appointments SET service_id=?, service_name=?, professional_id=?, professional_name=?, date=?,
    start_time=?, end_time=?, first_name=?, last_name=?, phone=?, email=?, comment=?, admin_notes=?, status=?,
    updated_at=datetime('now'), cancelled_at = CASE WHEN ?='cancelado' THEN COALESCE(cancelled_at, datetime('now')) ELSE NULL END
    WHERE id=?`)
};

function validateCustomer(b, { admin = false } = {}) {
  const c = {
    first_name: str(b.firstName ?? b.first_name, 60),
    last_name: str(b.lastName ?? b.last_name, 60),
    phone: str(b.phone, 30),
    email: str(b.email, 120).toLowerCase(),
    comment: str(b.comment, 600)
  };
  const errors = {};
  if (!c.first_name) errors.firstName = 'Ingresá el nombre.';
  if (!admin && !c.last_name) errors.lastName = 'Ingresá el apellido.';
  const digits = c.phone.replace(/\D/g, '');
  if (digits.length < (admin ? 6 : 8) || digits.length > 15) errors.phone = 'Ingresá un teléfono válido, con código de área.';
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email)) errors.email = 'El email no parece válido.';
  if (Object.keys(errors).length) throw new HttpError(422, 'Revisá los datos ingresados.', { errors });
  return c;
}

function insert({ service, proId, date, time, duration, cust, status, source, notes }) {
  const pro = proId ? q.pro.get(proId) : null;
  const end = toMin(time) + duration;
  if (end > 1440) throw new HttpError(400, 'El turno no puede terminar después de la medianoche.');
  let code;
  do { code = 'FEM-' + randomCode(6); } while (q.codeExists.get(code));
  const r = q.insert.run(code, randomHex(20), service.id, service.name, pro ? pro.id : null, pro ? pro.name : '',
    date, time, toHHMM(end), cust.first_name, cust.last_name, cust.phone, cust.email, cust.comment, notes || '', status, source);
  return q.byId.get(r.lastInsertRowid);
}

/* Reserva desde la web pública: siempre valida disponibilidad real. */
function createPublic(b) {
  const s = getSettings();
  if (s.booking_enabled !== '1') throw new HttpError(403, 'Las reservas online están momentáneamente pausadas. Escribinos por WhatsApp.');
  const service = q.service.get(Number(b.serviceId));
  if (!service || !service.active || !service.bookable) throw new HttpError(400, 'Elegí un servicio válido.');
  const proId = b.professionalId && b.professionalId !== 'any' ? Number(b.professionalId) : null;
  if (!isDate(b.date) || !isTime(b.time)) throw new HttpError(400, 'Elegí una fecha y un horario válidos.');
  const cust = validateCustomer(b);
  const digits = cust.phone.replace(/\D/g, '');
  if (q.sameSlot.all(b.date, b.time).some(r => r.phone.replace(/\D/g, '') === digits)) {
    throw new HttpError(409, 'Ya tenés un turno reservado en ese horario.');
  }
  const slot = computeDay({ service, professionalId: proId, date: b.date }).find(x => x.time === b.time);
  if (!slot) throw new HttpError(409, 'Ese horario ya no está disponible. Por favor, elegí otro.', { slotTaken: true });
  return insert({
    service, proId: proId || pickProfessional(slot, b.date), date: b.date, time: b.time, duration: durationOf(service), cust,
    status: s.booking_auto_confirm === '1' ? 'confirmado' : 'pendiente', source: 'web', notes: ''
  });
}

/* Alta desde el panel: valida disponibilidad salvo que se fuerce. */
function createAdmin(b) {
  const service = q.service.get(Number(b.serviceId));
  if (!service) throw new HttpError(400, 'Elegí un servicio.');
  if (!isDate(b.date) || !isTime(b.time)) throw new HttpError(400, 'Elegí una fecha y un horario válidos.');
  const cust = validateCustomer(b, { admin: true });
  const duration = clampInt(b.duration, 5, 720, durationOf(service));
  const status = STATUSES.includes(b.status) ? b.status : 'confirmado';
  let proId = b.professionalId ? Number(b.professionalId) : null;
  if (proId && !q.pro.get(proId)) throw new HttpError(400, 'La profesional elegida no existe.');
  if (!b.force && ACTIVE.includes(status)) {
    const slot = computeDay({ service, professionalId: proId, date: b.date, admin: true, duration }).find(x => x.time === b.time);
    if (!slot) throw new HttpError(409, 'Ese horario no figura como disponible (fuera de horario, bloqueado u ocupado).', { conflict: true });
    if (!proId) proId = pickProfessional(slot, b.date);
  }
  return insert({ service, proId, date: b.date, time: b.time, duration, cust, status, source: 'admin', notes: str(b.adminNotes, 1000) });
}

function updateAdmin(id, b) {
  const cur = q.byId.get(id);
  if (!cur) throw new HttpError(404, 'Turno no encontrado.');
  const next = { ...cur };
  let service = cur.service_id ? q.service.get(cur.service_id) : null;

  if ('serviceId' in b && Number(b.serviceId) !== cur.service_id) {
    service = q.service.get(Number(b.serviceId));
    if (!service) throw new HttpError(400, 'Servicio inválido.');
    next.service_id = service.id; next.service_name = service.name;
  }
  if ('professionalId' in b) {
    const pid = b.professionalId ? Number(b.professionalId) : null;
    if (pid) {
      const pro = q.pro.get(pid);
      if (!pro) throw new HttpError(400, 'Profesional inválida.');
      next.professional_id = pid; next.professional_name = pro.name;
    } else { next.professional_id = null; next.professional_name = ''; }
  }
  if ('date' in b) { if (!isDate(b.date)) throw new HttpError(400, 'Fecha inválida.'); next.date = b.date; }
  if ('time' in b) { if (!isTime(b.time)) throw new HttpError(400, 'Horario inválido.'); next.start_time = b.time; }
  const curDur = toMin(cur.end_time) - toMin(cur.start_time);
  let duration = curDur;
  if (b.duration !== undefined && b.duration !== '' && b.duration !== null) duration = clampInt(b.duration, 5, 720, curDur);
  else if (next.service_id !== cur.service_id && service) duration = durationOf(service);
  const endMin = toMin(next.start_time) + duration;
  if (endMin > 1440) throw new HttpError(400, 'El turno no puede terminar después de la medianoche.');
  next.end_time = toHHMM(endMin);

  if (['firstName', 'lastName', 'phone', 'email', 'comment'].some(k => k in b)) {
    Object.assign(next, validateCustomer({
      firstName: b.firstName ?? cur.first_name, lastName: b.lastName ?? cur.last_name, phone: b.phone ?? cur.phone,
      email: b.email ?? cur.email, comment: b.comment ?? cur.comment
    }, { admin: true }));
  }
  if ('adminNotes' in b) next.admin_notes = str(b.adminNotes, 1000);
  if ('status' in b) {
    if (!STATUSES.includes(b.status)) throw new HttpError(400, 'Estado inválido.');
    next.status = b.status;
  }

  const scheduleChanged = ['date', 'start_time', 'end_time', 'professional_id', 'service_id'].some(k => next[k] !== cur[k]);
  const reactivated = ACTIVE.includes(next.status) && !ACTIVE.includes(cur.status);
  if (!b.force && service && ACTIVE.includes(next.status) && (scheduleChanged || reactivated)) {
    const slot = computeDay({ service, professionalId: next.professional_id, date: next.date, excludeId: id, admin: true, duration })
      .find(x => x.time === next.start_time);
    if (!slot) throw new HttpError(409, 'Ese horario no figura como disponible (fuera de horario, bloqueado u ocupado).', { conflict: true });
  }
  q.update.run(next.service_id, next.service_name, next.professional_id, next.professional_name, next.date, next.start_time,
    next.end_time, next.first_name, next.last_name, next.phone, next.email, next.comment, next.admin_notes, next.status,
    next.status, id);
  return q.byId.get(id);
}

function findByToken(code, token) {
  const a = q.byCode.get(String(code || '').toUpperCase());
  if (!a || !token || !safeEqual(a.token, token)) throw new HttpError(404, 'No encontramos ese turno.');
  return a;
}
function isFuture(a) {
  const now = nowLocal();
  return dayNumber(a.date) * 1440 + toMin(a.start_time) > dayNumber(now.date) * 1440 + now.minutes;
}
function canClientCancel(a) {
  return getSettings().booking_allow_cancel === '1' && ACTIVE.includes(a.status) && isFuture(a);
}
function cancelPublic(code, token) {
  const a = findByToken(code, token);
  if (getSettings().booking_allow_cancel !== '1') throw new HttpError(403, 'Para cancelar tu turno, escribinos por WhatsApp.');
  if (!ACTIVE.includes(a.status)) throw new HttpError(409, 'Este turno ya no está activo.');
  if (!isFuture(a)) throw new HttpError(409, 'Este turno ya pasó.');
  db.prepare("UPDATE appointments SET status='cancelado', cancelled_at=datetime('now'), updated_at=datetime('now'), admin_notes = TRIM(admin_notes || ' [Cancelado por la clienta desde la web]') WHERE id=?").run(a.id);
  return q.byId.get(a.id);
}

function publicView(a) {
  return {
    code: a.code, service: a.service_name, professional: a.professional_name, date: a.date, dateText: formatDateLong(a.date),
    time: a.start_time, endTime: a.end_time, status: a.status, firstName: a.first_name, lastName: a.last_name,
    phone: a.phone, email: a.email
  };
}

/* ---------- Calendario ---------- */
const icsDate = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsEsc = t => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function address(s) { return `${s.address_street}, ${s.address_city}, ${s.address_region}`; }
function buildICS(a, s) {
  const details = [`Código de turno: ${a.code}`, a.professional_name ? `Profesional: ${a.professional_name}` : '', `Tel.: ${s.phone_display}`].filter(Boolean).join('\n');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FEM salon//Turnos//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${a.code}@femsalon`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(localToUTC(a.date, a.start_time))}`,
    `DTEND:${icsDate(localToUTC(a.date, a.end_time))}`,
    `SUMMARY:${icsEsc(`${a.service_name} · ${s.business_name}`)}`,
    `LOCATION:${icsEsc(address(s))}`,
    `DESCRIPTION:${icsEsc(details)}`,
    'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(`Turno en ${s.business_name}`)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', ''
  ].join('\r\n');
}
function googleCalendarUrl(a, s) {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${a.service_name} · ${s.business_name}`,
    dates: `${icsDate(localToUTC(a.date, a.start_time))}/${icsDate(localToUTC(a.date, a.end_time))}`,
    ctz: TZ,
    details: `Código de turno: ${a.code}${a.professional_name ? `\nProfesional: ${a.professional_name}` : ''}`,
    location: address(s)
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

module.exports = {
  STATUSES, ACTIVE, createPublic, createAdmin, updateAdmin, cancelPublic, findByToken, canClientCancel,
  publicView, buildICS, googleCalendarUrl
};
