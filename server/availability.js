'use strict';
const { db, getSettings } = require('./db');
const { toMin, toHHMM, weekdayOf, nowLocal, dayNumber, addDays, clampInt } = require('./util');

const ACTIVE = "('pendiente','confirmado')";

/* ---------- Operaciones sobre intervalos [inicio, fin) en minutos ---------- */
function merge(list) {
  const a = list.filter(i => i[1] > i[0]).map(i => [i[0], i[1]]).sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const i of a) {
    const last = out[out.length - 1];
    if (last && i[0] <= last[1]) last[1] = Math.max(last[1], i[1]);
    else out.push(i);
  }
  return out;
}
function subtract(base, cuts) {
  let res = merge(base);
  for (const [cs, ce] of merge(cuts)) {
    const next = [];
    for (const [s, e] of res) {
      if (ce <= s || cs >= e) { next.push([s, e]); continue; }
      if (cs > s) next.push([s, cs]);
      if (ce < e) next.push([ce, e]);
    }
    res = next;
  }
  return res;
}
function intersect(a, b) {
  const out = [];
  for (const [s1, e1] of merge(a)) for (const [s2, e2] of merge(b)) {
    const s = Math.max(s1, s2), e = Math.min(e1, e2);
    if (e > s) out.push([s, e]);
  }
  return merge(out);
}
const contains = (list, s, e) => list.some(([a, b]) => a <= s && e <= b);

const q = {
  weekly: db.prepare('SELECT start_time, end_time FROM schedules WHERE professional_id IS ? AND weekday = ?'),
  rules: db.prepare('SELECT type, start_time, end_time FROM time_blocks WHERE professional_id IS ? AND date_from <= ? AND date_to >= ?'),
  proAppts: db.prepare(`SELECT id, start_time, end_time FROM appointments WHERE professional_id = ? AND date = ? AND status IN ${ACTIVE}`),
  unassigned: db.prepare(`SELECT id, start_time, end_time FROM appointments WHERE professional_id IS NULL AND date = ? AND status IN ${ACTIVE}`),
  eligible: db.prepare(`SELECT p.* FROM professionals p JOIN professional_services ps ON ps.professional_id = p.id
    WHERE ps.service_id = ? AND p.active = 1 ORDER BY p.sort_order, p.id`),
  proDayCount: db.prepare(`SELECT COUNT(*) n FROM appointments WHERE professional_id = ? AND date = ? AND status IN ${ACTIVE}`)
};

const rowsToIv = rows => rows.map(r => [toMin(r.start_time), toMin(r.end_time)]);

function dayRules(proId, date) {
  const opens = [], blocks = [];
  for (const r of q.rules.all(proId, date, date)) {
    const iv = r.start_time && r.end_time ? [toMin(r.start_time), toMin(r.end_time)] : [0, 1440];
    (r.type === 'open' ? opens : blocks).push(iv);
  }
  return { opens, blocks };
}

// Horario efectivo del salón en una fecha: horario semanal + aperturas especiales − bloqueos.
function salonDay(date) {
  const weekly = rowsToIv(q.weekly.all(null, weekdayOf(date)));
  const { opens, blocks } = dayRules(null, date);
  return { open: subtract(merge([...weekly, ...opens]), blocks), blocks };
}

// Horario efectivo de una profesional: su horario (o el del salón) + sus aperturas − sus bloqueos − bloqueos del salón.
function proDay(pro, date, salon = salonDay(date)) {
  const own = pro.use_salon_hours ? salon.open : intersect(rowsToIv(q.weekly.all(pro.id, weekdayOf(date))), salon.open);
  const { opens, blocks } = dayRules(pro.id, date);
  return subtract(merge([...own, ...opens]), [...blocks, ...salon.blocks]);
}

function params() {
  const s = getSettings();
  return {
    step: clampInt(s.booking_slot_interval, 5, 240, 30),
    defaultDuration: clampInt(s.booking_default_duration, 10, 720, 60),
    minNotice: clampInt(s.booking_min_notice, 0, 43200, 60),
    windowDays: clampInt(s.booking_window_days, 1, 365, 60),
    capacity: clampInt(s.booking_capacity, 1, 50, 1)
  };
}
function durationOf(service, p = params()) {
  return Number(service.duration_min) > 0 ? Number(service.duration_min) : p.defaultDuration;
}
function bookingWindow() {
  const p = params(), now = nowLocal();
  return { today: now.date, maxDate: addDays(now.date, p.windowDays) };
}

/**
 * Horarios disponibles de un día.
 * - Si hay profesionales asignadas al servicio: se usa la agenda de cada una.
 * - Si no hay ninguna: se usa el horario del salón con la capacidad simultánea configurada.
 * admin = true ignora la anticipación mínima y la ventana de reserva (pero respeta horarios y ocupación).
 */
function computeDay({ service, professionalId = null, date, excludeId = 0, admin = false, duration = null }) {
  const p = params();
  const now = nowLocal();
  const today = dayNumber(now.date), dn = dayNumber(date);
  if (!admin && (dn < today || dn > today + p.windowDays)) return [];
  const minAbs = admin ? -Infinity : today * 1440 + now.minutes + p.minNotice;
  const dur = Number(duration) > 0 ? Number(duration) : durationOf(service, p);

  const salon = salonDay(date);
  let pros = q.eligible.all(service.id);
  const poolMode = pros.length === 0;
  if (professionalId) {
    pros = pros.filter(x => x.id === Number(professionalId));
    if (!pros.length) return [];
  }
  const unassigned = q.unassigned.all(date).filter(a => a.id !== excludeId).map(a => [toMin(a.start_time), toMin(a.end_time)]);
  const proFree = pros.map(pro => {
    const busy = q.proAppts.all(pro.id, date).filter(a => a.id !== excludeId).map(a => [toMin(a.start_time), toMin(a.end_time)]);
    return { id: pro.id, free: subtract(proDay(pro, date, salon), busy) };
  });

  const slots = [];
  for (let s = 0; s + dur <= 1440; s += p.step) {
    const e = s + dur;
    if (dn * 1440 + s < minAbs) continue;
    const overlapUnassigned = unassigned.filter(([a, b]) => a < e && s < b).length;
    if (poolMode) {
      if (!contains(salon.open, s, e) || overlapUnassigned >= p.capacity) continue;
      slots.push({ time: toHHMM(s), pros: [] });
    } else {
      const avail = proFree.filter(x => contains(x.free, s, e)).map(x => x.id);
      if (!avail.length) continue;
      if (!professionalId && avail.length - overlapUnassigned <= 0) continue;
      slots.push({ time: toHHMM(s), pros: avail });
    }
  }
  return slots;
}

function computeMonth({ service, professionalId, month }) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const days = {};
  for (let d = 1; d <= last; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    days[date] = computeDay({ service, professionalId, date }).length;
  }
  return days;
}

// Para "sin preferencia": la profesional con menos turnos ese día.
function pickProfessional(slot, date) {
  if (!slot || !slot.pros.length) return null;
  let best = null, bestN = Infinity;
  for (const id of slot.pros) {
    const n = q.proDayCount.get(id, date).n;
    if (n < bestN) { best = id; bestN = n; }
  }
  return best;
}

module.exports = { merge, subtract, intersect, salonDay, proDay, computeDay, computeMonth, pickProfessional, durationOf, params, bookingWindow };
