/* FEM salón — Panel de administración */
(() => {
  'use strict';
  const app = document.getElementById('app');
  const TZ = 'America/Argentina/Buenos_Aires';
  const STATUS = { pendiente: 'Pendiente', confirmado: 'Confirmado', completado: 'Completado', cancelado: 'Cancelado' };
  const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const ORDER = [1, 2, 3, 4, 5, 6, 0];
  const S = { user: null, d: null, stats: null, route: 'agenda', el: null, ag: null, list: null, svcTab: 'servicios', timer: null };

  /* ============================ Utilidades ============================ */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    let value;
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') {
        if (typeof v === 'string') el.setAttribute('style', v);
        else for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? el.style.setProperty(sk, sv) : (el.style[sk] = sv);
      } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') value = v;
      else if (['checked', 'selected', 'disabled', 'hidden', 'required', 'multiple'].includes(k)) el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false || kid === '') continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    if (value !== undefined) el.value = value;
    return el;
  }
  const ICONS = {
    cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
    users: '<circle cx="9" cy="8" r="3.6"/><path d="M2.5 20c1.2-3.4 3.7-5.2 6.5-5.2s5.3 1.8 6.5 5.2M16.5 4.6a3.6 3.6 0 0 1 0 6.9M18 14.9c2 .6 3.2 2.4 3.9 4.4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    image: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.5" cy="10" r="1.8"/><path d="m4 17 5-4.5 5 4 3-2.5 3 2.5"/>',
    star: '<path d="m12 3 2.6 5.5 5.9.8-4.3 4.1 1.1 5.9L12 16.5 6.7 19.3l1.1-5.9L3.5 9.3l5.9-.8z"/>',
    settings: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H10"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    wa: '<path d="M3.5 20.5 5 16.2A7.9 7.9 0 0 1 4 12.3 8.1 8.1 0 1 1 12.1 20a8 8 0 0 1-3.9-1z"/><path d="M9 9.2c.2-.5.4-.5.6-.5h.5c.2 0 .4 0 .6.5l.7 1.7c.1.2 0 .4-.1.5l-.4.5c-.1.2-.3.3-.1.6.2.3.7 1.1 1.5 1.8.9.8 1.7 1 2 1.2.3.1.4 0 .6-.2l.6-.7c.2-.2.3-.2.6-.1l1.6.8c.2.1.4.2.4.3v.6c-.1.4-.7 1-1.2 1.1-.4.1-1 .2-3.1-.7-2.6-1.1-4.2-3.8-4.4-4-.1-.2-1-1.3-1-2.5 0-1.2.6-1.8.9-2z"/>',
    'chev-l': '<path d="M15 5l-7 7 7 7"/>',
    'chev-r': '<path d="M9 5l7 7-7 7"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    check: '<path d="M5 12.5 9.5 17 19 7.5"/>',
    trash: '<path d="M4 7h16M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7M6.5 7l.8 12.1A1.5 1.5 0 0 0 8.8 20.5h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7"/>',
    edit: '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'
  };
  function I(name) {
    const s = document.createElement('span');
    s.className = 'ai';
    s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
    return s;
  }
  const todayAR = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  function nowMinAR() {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
    return toMin(p);
  }
  const addDays = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const addMonths = (d, n) => { const [y, m] = d.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1 + n, 1)); return x.toISOString().slice(0, 10); };
  const wdOf = d => new Date(d + 'T12:00:00Z').getUTCDay();
  const toMin = t => { const [a, b] = String(t).split(':').map(Number); return a * 60 + b; };
  const toHHMM = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const cap = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);
  const fmt = (d, o) => cap(new Intl.DateTimeFormat('es-AR', { ...o, timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z')));
  const fmtLong = d => fmt(d, { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtShort = d => fmt(d, { day: '2-digit', month: '2-digit' });
  const money = n => '$' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 });
  const weekStart = d => addDays(d, -((wdOf(d) + 6) % 7));
  const firstOfMonth = d => d.slice(0, 8) + '01';
  const lastOfMonth = d => { const [y, m] = d.split('-').map(Number); return `${d.slice(0, 7)}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`; };
  const fmtStamp = s => { const dt = new Date(String(s).replace(' ', 'T') + 'Z'); return isNaN(dt) ? s : dt.toLocaleString('es-AR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  function subtract(base, cuts) {
    let res = base.map(i => [...i]);
    for (const [cs, ce] of cuts) {
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

  /* ============================ API ============================ */
  async function api(path, { method = 'GET', body } = {}) {
    let res;
    try {
      res = await fetch('/api/admin' + path, {
        method, credentials: 'same-origin',
        headers: { 'X-Requested-With': 'fem-admin', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
    } catch { throw Object.assign(new Error('Sin conexión con el servidor.'), { data: {} }); }
    let data = {};
    try { data = await res.json(); } catch { /* sin cuerpo */ }
    if (res.status === 401 && path !== '/login') {
      stopPolling(); S.user = null; renderLogin('Tu sesión expiró. Volvé a ingresar.');
      throw Object.assign(new Error(data.error || 'Sesión expirada'), { data, status: 401, silent: true });
    }
    if (!res.ok) throw Object.assign(new Error(data.error || 'Ocurrió un error inesperado.'), { data, status: res.status });
    return data;
  }
  const fail = e => { if (!e.silent) toast(e.message, 'err'); };

  function toast(msg, type = 'ok') {
    let box = document.querySelector('.toasts');
    if (!box) { box = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(box); }
    const t = h('div', { class: `toast toast--${type}` }, msg);
    box.append(t);
    setTimeout(() => t.classList.add('out'), 3400);
    setTimeout(() => t.remove(), 3800);
  }

  function modal({ title, body, footer, wide, onClose }) {
    const overlay = h('div', { class: 'modal-overlay' });
    const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); document.body.classList.remove('modal-open'); onClose && onClose(); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    const box = h('div', { class: 'modal' + (wide ? ' modal--wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('header', { class: 'modal__head' }, h('h2', {}, title), h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Cerrar', onclick: close }, I('x'))),
      h('div', { class: 'modal__body' }, body),
      footer ? h('footer', { class: 'modal__foot' }, footer) : null);
    overlay.append(box);
    overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
    document.body.append(overlay);
    document.body.classList.add('modal-open');
    setTimeout(() => { const f = box.querySelector('input:not([type=hidden]), select, textarea'); if (f) f.focus(); }, 40);
    return { close, box };
  }
  function confirmBox(message, { ok = 'Confirmar', danger = false } = {}) {
    return new Promise(resolve => {
      let done = false;
      const finish = v => { if (done) return; done = true; m.close(); resolve(v); };
      const m = modal({
        title: 'Confirmar', body: h('p', {}, message),
        footer: [h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => finish(false) }, 'Cancelar'),
          h('span', { class: 'grow' }),
          h('button', { class: 'btn ' + (danger ? 'btn--danger' : 'btn--primary'), type: 'button', onclick: () => finish(true) }, ok)],
        onClose: () => { if (!done) { done = true; resolve(false); } }
      });
    });
  }

  /* ============================ Campos ============================ */
  const inp = a => h('input', { class: 'inp', ...a });
  const area = (a, value) => { const t = h('textarea', { class: 'inp', ...a }); t.value = value || ''; return t; };
  function sel(options, value, a = {}) {
    const s = h('select', { class: 'inp', ...a }, options.map(([v, l]) => h('option', { value: v }, l)));
    s.value = value == null ? '' : String(value);
    return s;
  }
  const field = (label, el, help, cls) => h('label', { class: 'fld' + (cls ? ' ' + cls : '') }, h('span', { class: 'fld__label' }, label), el, help ? h('small', { class: 'fld__help' }, help) : null);
  const fieldBox = (label, el, help, cls) => h('div', { class: 'fld' + (cls ? ' ' + cls : '') }, h('span', { class: 'fld__label' }, label), el, help ? h('small', { class: 'fld__help' }, help) : null);
  function checkbox(label, checked, a = {}) {
    const c = h('input', { type: 'checkbox', checked, ...a });
    return { input: c, el: h('label', { class: 'chk' }, c, h('span', {}, label)) };
  }
  function serviceSelect(value, { emptyLabel = 'Elegí un servicio' } = {}) {
    const s = h('select', { class: 'inp' }, h('option', { value: '' }, emptyLabel));
    const groups = S.d.categories.map(c => [c.name, S.d.services.filter(x => x.category_id === c.id)]);
    const orphans = S.d.services.filter(x => !S.d.categories.some(c => c.id === x.category_id));
    if (orphans.length) groups.push(['Otros', orphans]);
    for (const [name, list] of groups) {
      if (!list.length) continue;
      s.append(h('optgroup', { label: name }, list.map(x => h('option', { value: x.id }, x.name + (x.active ? '' : ' (inactivo)')))));
    }
    s.value = value == null ? '' : String(value);
    return s;
  }
  const activePros = () => S.d.professionals.filter(p => p.active);
  const svcById = id => S.d.services.find(x => x.id === Number(id));
  const proById = id => S.d.professionals.find(p => p.id === Number(id));
  function priceLabel(x) {
    const o = x.price_options || [];
    if (o.length) return o.map(p => `${p.label}: ${money(p.amount)}`).join(' · ');
    if (x.price != null && x.price !== '') return (x.price_from ? 'Desde ' : '') + money(x.price);
    return 'Consultar precio';
  }
  const durLabel = x => (x.duration_min ? `${x.duration_min} min` : 'Consultar');
  const artUrl = name => `/art/${name || 'balayage'}.svg`;

  async function uploadImage(file, { keepAlpha = false, max = 1800 } = {}) {
    if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) throw new Error('Formato no admitido. Usá JPG, PNG o WEBP.');
    let bmp;
    try { bmp = await createImageBitmap(file); } catch { throw new Error('No pudimos leer la imagen. Probá con otro archivo.'); }
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close && bmp.close();
    const blob = await new Promise(r => canvas.toBlob(r, 'image/webp', 0.85))
      || await new Promise(r => canvas.toBlob(r, keepAlpha ? 'image/png' : 'image/jpeg', 0.88));
    if (!blob) throw new Error('No pudimos procesar la imagen.');
    const dataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
    const { url } = await api('/upload', { method: 'POST', body: { dataUrl } });
    return url;
  }
  function imageField(value, { keepAlpha = false, fallback = '' } = {}) {
    let cur = value || '';
    const img = h('img', { alt: '' });
    const empty = h('span', { class: 'imgf__empty' }, 'Sin imagen');
    const prev = h('div', { class: 'imgf__prev' }, img, empty);
    const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true });
    const status = h('small', { class: 'fld__help' });
    const rm = h('button', { type: 'button', class: 'btn btn--text btn--sm', onclick: () => { cur = ''; status.textContent = ''; upd(); } }, 'Quitar');
    const up = h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => file.click() }, I('image'), 'Subir imagen');
    function upd() {
      const src = cur || fallback;
      img.hidden = !src; empty.hidden = !!src;
      if (src) img.src = src;
      rm.hidden = !cur;
      prev.classList.toggle('is-fallback', !cur && !!fallback);
    }
    file.addEventListener('change', async () => {
      const f = file.files[0];
      if (!f) return;
      up.disabled = true; status.textContent = 'Subiendo…';
      try { cur = await uploadImage(f, { keepAlpha }); status.textContent = 'Imagen lista. Acordate de guardar.'; upd(); }
      catch (e) { status.textContent = ''; fail(e); }
      finally { up.disabled = false; file.value = ''; }
    });
    upd();
    return { el: h('div', { class: 'imgf' }, prev, h('div', { class: 'imgf__actions' }, up, rm, status), file), get: () => cur, setFallback: f => { fallback = f; upd(); } };
  }
  function weeklyEditor(list) {
    const wrap = h('div', { class: 'wkly' });
    const days = {};
    ORDER.forEach(wd => {
      const ivs = h('div', { class: 'wkly__ivs' });
      const closed = h('span', { class: 'muted' }, 'Cerrado');
      const openChk = h('input', { type: 'checkbox' });
      const addBtn = h('button', { type: 'button', class: 'btn btn--text btn--sm', onclick: () => addIv('14:00', '20:00') }, '+ Franja');
      function sync() {
        ivs.hidden = !openChk.checked; addBtn.hidden = !openChk.checked; closed.hidden = openChk.checked;
        if (openChk.checked && !ivs.children.length) addIv();
      }
      function addIv(s = '09:00', e = '22:00') {
        const a = inp({ type: 'time', value: s, step: 300 });
        const b = inp({ type: 'time', value: e, step: 300 });
        const row = h('div', { class: 'wkly__iv' }, a, h('span', { class: 'muted' }, 'a'), b,
          h('button', { type: 'button', class: 'icon-btn icon-btn--sm', 'aria-label': 'Quitar franja', onclick: () => { row.remove(); if (!ivs.children.length) { openChk.checked = false; sync(); } } }, I('x')));
        row._get = () => ({ weekday: wd, start: a.value, end: b.value });
        ivs.append(row);
      }
      const mine = list.filter(r => r.weekday === wd);
      mine.forEach(r => addIv(r.start, r.end));
      openChk.checked = mine.length > 0;
      openChk.addEventListener('change', sync);
      sync();
      days[wd] = { ivs, openChk };
      wrap.append(h('div', { class: 'wkly__row' },
        h('label', { class: 'chk wkly__day' }, openChk, h('span', {}, DAYS[wd])),
        h('div', { class: 'wkly__body' }, closed, ivs, addBtn)));
    });
    wrap.get = () => ORDER.flatMap(wd => (days[wd].openChk.checked ? [...days[wd].ivs.children].map(r => r._get()) : []));
    return wrap;
  }

  /* ============================ Arranque y sesión ============================ */
  async function boot() {
    try { await api('/me'); await loadData(); renderShell(); }
    catch (e) {
      if (e.status === 401) renderLogin('');
      else { app.textContent = ''; app.append(h('div', { class: 'boot' }, e.message)); }
    }
  }
  async function loadData() { S.d = await api('/bootstrap'); S.user = S.d.user; }

  function renderLogin(msg) {
    stopPolling();
    app.textContent = '';
    const u = inp({ name: 'username', autocomplete: 'username', required: true });
    const p = inp({ name: 'password', type: 'password', autocomplete: 'current-password', required: true });
    const err = h('p', { class: 'login__err', role: 'alert' }, msg || '');
    const btn = h('button', { class: 'btn btn--primary btn--block', type: 'submit' }, 'Ingresar');
    const form = h('form', {
      class: 'login__card',
      onsubmit: async e => {
        e.preventDefault(); btn.disabled = true; err.textContent = '';
        try { await api('/login', { method: 'POST', body: { username: u.value, password: p.value } }); await loadData(); renderShell(); }
        catch (x) { err.textContent = x.message; btn.disabled = false; }
      }
    },
      h('div', { class: 'brand' }, h('span', { class: 'fem' }, 'FEM'), h('span', { class: 'salon' }, 'SALÓN')),
      h('h1', {}, 'Panel de administración'),
      field('Usuario', u), field('Contraseña', p), err, btn,
      h('a', { class: 'login__back', href: '/' }, '← Volver al sitio'));
    app.append(h('div', { class: 'login' }, form));
    setTimeout(() => u.focus(), 50);
  }
  async function logout() {
    try { await api('/logout', { method: 'POST' }); } catch { /* ignorar */ }
    renderLogin('');
  }

  const NAV = [
    ['agenda', 'Agenda', 'cal'], ['turnos', 'Turnos', 'list'], ['servicios', 'Servicios y precios', 'scissors', true],
    ['profesionales', 'Profesionales', 'users', true], ['horarios', 'Horarios y bloqueos', 'clock'],
    ['galeria', 'Galería', 'image', true], ['resenas', 'Reseñas', 'star', true],
    ['ajustes', 'Configuración', 'settings', true], ['usuarios', 'Usuarios', 'user']
  ];
  function renderShell() {
    const isAdmin = S.user.role === 'admin';
    app.textContent = '';
    const nav = h('nav', { class: 'side__nav' }, NAV.filter(n => isAdmin || !n[3]).map(([r, l, i]) =>
      h('a', { href: '#/' + r, class: 'side__link', 'data-route': r }, I(i),
        h('span', {}, r === 'usuarios' && !isAdmin ? 'Mi cuenta' : l),
        r === 'turnos' ? h('span', { class: 'badge', id: 'pendingBadge', hidden: true }) : null)));
    const side = h('aside', { class: 'side' },
      h('div', { class: 'side__brand' }, h('span', { class: 'fem' }, 'FEM'), h('span', { class: 'salon' }, 'SALÓN'), h('small', {}, 'Panel')),
      nav,
      h('div', { class: 'side__foot' },
        h('a', { class: 'side__link', href: '/', target: '_blank', rel: 'noopener' }, I('external'), h('span', {}, 'Ver sitio web')),
        h('button', { class: 'side__link', type: 'button', onclick: logout }, I('logout'), h('span', {}, 'Salir')),
        h('p', { class: 'side__user' }, S.user.name || S.user.username, h('small', {}, isAdmin ? 'Administración' : 'Equipo'))));
    const title = h('h1', { class: 'top__title' });
    const actions = h('div', { class: 'top__actions' });
    const view = h('main', { class: 'view' });
    app.append(h('div', { class: 'layout' }, side,
      h('div', { class: 'side-scrim', onclick: () => document.body.classList.remove('side-open') }),
      h('div', { class: 'main' },
        h('header', { class: 'top' },
          h('button', { class: 'icon-btn top__menu', type: 'button', 'aria-label': 'Menú', onclick: () => document.body.classList.toggle('side-open') }, I('menu')),
          title, actions),
        view)));
    S.el = { title, actions, view };
    window.onhashchange = route;
    route();
    startPolling();
  }

  const VIEWS = {};
  function route() {
    document.body.classList.remove('side-open');
    let r = location.hash.replace(/^#\/?/, '').split('?')[0] || 'agenda';
    const def = NAV.find(n => n[0] === r);
    if (!def || (def[3] && S.user.role !== 'admin')) r = 'agenda';
    S.route = r;
    document.querySelectorAll('.side__link[data-route]').forEach(a => a.classList.toggle('is-active', a.dataset.route === r));
    const label = NAV.find(n => n[0] === r);
    S.el.title.textContent = r === 'usuarios' && S.user.role !== 'admin' ? 'Mi cuenta' : label[1];
    S.el.actions.textContent = '';
    S.el.view.textContent = '';
    VIEWS[r]();
  }
  async function reload() { await loadData(); route(); }
  function refreshCurrent() {
    refreshStats();
    if (S.route === 'agenda' && S.agendaRefresh) S.agendaRefresh();
    else if (S.route === 'turnos' && S.listRefresh) S.listRefresh();
  }
  async function refreshStats() {
    try {
      S.stats = await api('/stats');
      const b = document.getElementById('pendingBadge');
      if (b) { b.hidden = !S.stats.pending; b.textContent = S.stats.pending; }
      document.title = (S.stats.pending ? `(${S.stats.pending}) ` : '') + 'Panel · FEM salón';
      const box = document.querySelector('[data-stats]');
      if (box) drawStats(box);
    } catch { /* silencioso */ }
  }
  function startPolling() { refreshStats(); stopPolling(); S.timer = setInterval(refreshStats, 60000); }
  function stopPolling() { clearInterval(S.timer); S.timer = null; }
  function drawStats(box) {
    const s = S.stats || {};
    box.textContent = '';
    box.append(
      h('div', { class: 'stat' }, h('b', {}, String(s.today ?? '–')), h('span', {}, 'Turnos de hoy')),
      h('div', { class: 'stat' + (s.pending ? ' stat--warn' : '') }, h('b', {}, String(s.pending ?? '–')), h('span', {}, 'Pendientes de confirmar')),
      h('div', { class: 'stat' }, h('b', {}, String(s.week ?? '–')), h('span', {}, 'Próximos 7 días')),
      h('div', { class: 'stat' }, h('b', {}, String(s.newWeb ?? '–')), h('span', {}, 'Reservas web (24 h)')));
  }

  /* ============================ Turno: modal ============================ */
  function waNumber(phone) {
    let d = String(phone || '').replace(/\D/g, '');
    if (d.startsWith('54')) return d;
    d = d.replace(/^0/, '');
    if (d.length === 10) d = '549' + d;
    return d;
  }
  function waHref(phone, text) { return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`; }

  function openAppointment(a, preset = {}) {
    const isNew = !a;
    const cur = a || {};
    const st = S.d.settings;
    const svcSel = serviceSelect(cur.service_id || preset.serviceId || '');
    const proOpts = [['', isNew && activePros().length ? 'Asignar automáticamente' : 'Sin asignar'],
      ...S.d.professionals.filter(p => p.active || p.id === cur.professional_id).map(p => [p.id, p.name + (p.active ? '' : ' (inactiva)')])];
    const proSel = sel(proOpts, cur.professional_id || preset.professionalId || '');
    const date = inp({ type: 'date', value: cur.date || preset.date || todayAR() });
    const time = inp({ type: 'time', step: 300, value: cur.start_time || preset.time || '' });
    const dur = inp({ type: 'number', min: 5, max: 720, step: 5, value: a ? toMin(a.end_time) - toMin(a.start_time) : '' });
    const slots = h('div', { class: 'slotpick' });
    const fn = inp({ value: cur.first_name || '', maxlength: 60 });
    const ln = inp({ value: cur.last_name || '', maxlength: 60 });
    const ph = inp({ type: 'tel', value: cur.phone || '', maxlength: 30 });
    const em = inp({ type: 'email', value: cur.email || '', maxlength: 120 });
    const comment = area({ rows: 2, maxlength: 600 }, cur.comment);
    const notes = area({ rows: 2, maxlength: 1000 }, cur.admin_notes);
    const status = sel(Object.entries(STATUS), cur.status || 'confirmado');

    async function loadSlots() {
      const s = svcById(svcSel.value);
      dur.placeholder = s && s.duration_min ? `${s.duration_min} (del servicio)` : `${st.booking_default_duration} (predeterminada)`;
      slots.textContent = '';
      if (!svcSel.value || !date.value) return;
      const qs = new URLSearchParams({ service: svcSel.value, date: date.value });
      if (proSel.value) qs.set('professional', proSel.value);
      if (a) qs.set('exclude', a.id);
      if (dur.value) qs.set('duration', dur.value);
      slots.append(h('span', { class: 'slotpick__label' }, 'Buscando horarios…'));
      try {
        const r = await api('/availability?' + qs);
        slots.textContent = '';
        slots.append(h('span', { class: 'slotpick__label' }, r.slots.length ? 'Horarios libres:' : 'No hay horarios libres con esa combinación (podés cargarlo igual).'));
        r.slots.forEach(t => slots.append(h('button', {
          type: 'button', class: 'slotpick__btn' + (t === time.value ? ' is-on' : ''),
          onclick: () => { time.value = t; slots.querySelectorAll('.is-on').forEach(x => x.classList.remove('is-on')); slots.querySelectorAll('.slotpick__btn').forEach(b => { if (b.textContent === t) b.classList.add('is-on'); }); }
        }, t)));
      } catch (e) { slots.textContent = ''; if (!e.silent) slots.append(h('span', { class: 'slotpick__label' }, e.message)); }
    }
    [svcSel, proSel, date, dur].forEach(el => el.addEventListener('change', loadSlots));
    loadSlots();

    const body = h('div', { class: 'form-grid' },
      a ? h('div', { class: 'appt-meta span2' },
        h('span', { class: `pill pill--${a.status}` }, STATUS[a.status]),
        h('span', {}, 'Código ' + a.code),
        h('span', {}, a.source === 'web' ? 'Reserva online' : 'Cargado en el panel'),
        h('span', {}, 'Creado: ' + fmtStamp(a.created_at))) : null,
      field('Servicio', svcSel), field('Profesional', proSel),
      field('Fecha', date), field('Hora', time),
      h('div', { class: 'span2' }, slots),
      field('Duración (minutos)', dur, 'Vacío = duración del servicio'), field('Estado', status),
      h('h3', { class: 'sub span2' }, 'Datos de la clienta'),
      field('Nombre', fn), field('Apellido', ln), field('Teléfono', ph), field('Email', em),
      field('Comentario de la clienta', comment, null, 'span2'),
      field('Notas internas', notes, 'Solo se ven en el panel.', 'span2'));

    async function save(force = false) {
      if (!svcSel.value || !date.value || !time.value) return toast('Completá servicio, fecha y hora.', 'err');
      const payload = {
        serviceId: Number(svcSel.value), professionalId: proSel.value ? Number(proSel.value) : null,
        date: date.value, time: time.value, duration: dur.value ? Number(dur.value) : '',
        firstName: fn.value, lastName: ln.value, phone: ph.value, email: em.value,
        comment: comment.value, status: status.value, adminNotes: notes.value, force
      };
      try {
        if (isNew) await api('/appointments', { method: 'POST', body: payload });
        else await api('/appointments/' + a.id, { method: 'PUT', body: payload });
        toast(isNew ? 'Turno creado.' : 'Turno actualizado.');
        m.close(); refreshCurrent();
      } catch (e) {
        if (e.data && e.data.conflict && !force) {
          if (await confirmBox(e.message + ' ¿Querés guardarlo igual?', { ok: 'Guardar igual' })) save(true);
        } else fail(e);
      }
    }
    async function remove() {
      if (!await confirmBox('¿Eliminar definitivamente este turno? Si solo querés liberar el horario, usá "Cancelar turno".', { ok: 'Eliminar', danger: true })) return;
      try { await api('/appointments/' + a.id, { method: 'DELETE' }); toast('Turno eliminado.'); m.close(); refreshCurrent(); } catch (e) { fail(e); }
    }
    async function cancel() {
      if (!await confirmBox('¿Cancelar este turno? El horario vuelve a quedar disponible.', { ok: 'Cancelar turno', danger: true })) return;
      try { await api('/appointments/' + a.id, { method: 'PUT', body: { status: 'cancelado' } }); toast('Turno cancelado.'); m.close(); refreshCurrent(); } catch (e) { fail(e); }
    }
    let waMenu = null;
    if (a && a.phone) {
      const biz = st.business_name, addr = `${st.address_street}, ${st.address_city}`;
      const when = `${fmtLong(a.date)} a las ${a.start_time} hs`;
      waMenu = h('details', { class: 'menu' },
        h('summary', { class: 'btn btn--ghost' }, I('wa'), 'WhatsApp'),
        h('div', { class: 'menu__list' },
          h('a', { href: waHref(a.phone, `¡Hola ${a.first_name}! Te escribimos de ${biz} para confirmar tu turno de ${a.service_name}, el ${when}. Te esperamos en ${addr}.`), target: '_blank', rel: 'noopener' }, 'Confirmar turno'),
          h('a', { href: waHref(a.phone, `¡Hola ${a.first_name}! Te recordamos tu turno de ${a.service_name} en ${biz}, el ${when}.`), target: '_blank', rel: 'noopener' }, 'Enviar recordatorio'),
          h('a', { href: waHref(a.phone, `¡Hola ${a.first_name}! Te escribimos de ${biz} por tu turno del ${when}.`), target: '_blank', rel: 'noopener' }, 'Mensaje abierto')));
    }
    const m = modal({
      title: isNew ? 'Nuevo turno' : `${cur.first_name || ''} ${cur.last_name || ''}`.trim() || 'Turno',
      body, wide: true,
      footer: [
        a && S.user.role === 'admin' ? h('button', { class: 'btn btn--danger-ghost', type: 'button', onclick: remove }, I('trash'), 'Eliminar') : null,
        h('span', { class: 'grow' }),
        waMenu,
        a && a.status !== 'cancelado' ? h('button', { class: 'btn btn--ghost', type: 'button', onclick: cancel }, 'Cancelar turno') : null,
        h('button', { class: 'btn btn--primary', type: 'button', onclick: () => save() }, isNew ? 'Crear turno' : 'Guardar')
      ]
    });
  }

  /* ============================ Vista: Agenda ============================ */
  VIEWS.agenda = function () {
    if (!S.ag) S.ag = { mode: window.innerWidth < 900 ? 'day' : 'week', date: todayAR(), pro: '', service: '', status: '' };
    const ag = S.ag;
    S.el.actions.append(h('button', { class: 'btn btn--primary', onclick: () => openAppointment(null, { date: ag.date }) }, I('plus'), 'Nuevo turno'));
    const stats = h('div', { class: 'stats', 'data-stats': '1' });
    drawStats(stats);
    const lbl = h('strong', { class: 'datenav__label' });
    const jump = inp({ type: 'date', value: ag.date, class: 'inp inp--sm', onchange: e => { if (e.target.value) { ag.date = e.target.value; draw(); } } });
    const shift = n => {
      ag.date = ag.mode === 'day' ? addDays(ag.date, n) : ag.mode === 'week' ? addDays(ag.date, n * 7) : addMonths(ag.date, n);
      draw();
    };
    const toolbar = h('div', { class: 'toolbar' },
      h('div', { class: 'seg' }, [['day', 'Día'], ['week', 'Semana'], ['month', 'Mes']].map(([m, l]) =>
        h('button', { type: 'button', class: ag.mode === m ? 'is-on' : '', onclick: e => { ag.mode = m; [...e.target.parentNode.children].forEach(b => b.classList.toggle('is-on', b === e.target)); draw(); } }, l))),
      h('div', { class: 'datenav' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Anterior', onclick: () => shift(-1) }, I('chev-l')),
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => { ag.date = todayAR(); draw(); } }, 'Hoy'),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Siguiente', onclick: () => shift(1) }, I('chev-r')),
        lbl),
      h('div', { class: 'filters' },
        S.d.professionals.length ? sel([['', 'Todas las profesionales'], ['none', 'Sin asignar'], ...S.d.professionals.map(p => [p.id, p.name])], ag.pro, { onchange: e => { ag.pro = e.target.value; draw(); } }) : null,
        serviceSelect(ag.service, { emptyLabel: 'Todos los servicios' }),
        sel([['', 'Todos los estados'], ['activos', 'Pendientes + confirmados'], ...Object.entries(STATUS)], ag.status, { onchange: e => { ag.status = e.target.value; draw(); } })));
    const svcFilter = toolbar.querySelector('.filters select:nth-of-type(' + (S.d.professionals.length ? 2 : 1) + ')');
    if (svcFilter) svcFilter.addEventListener('change', e => { ag.service = e.target.value; draw(); });
    const body = h('div', {});
    S.el.view.append(stats, toolbar, body);

    async function draw() {
      jump.value = ag.date;
      let from, to;
      if (ag.mode === 'day') { from = to = ag.date; lbl.textContent = fmt(ag.date, { weekday: 'long', day: 'numeric', month: 'long' }); }
      else if (ag.mode === 'week') {
        from = weekStart(ag.date); to = addDays(from, 6);
        lbl.textContent = `${fmt(from, { day: 'numeric', month: 'short' })} – ${fmt(to, { day: 'numeric', month: 'short', year: 'numeric' })}`;
      } else {
        from = weekStart(firstOfMonth(ag.date)); to = addDays(weekStart(lastOfMonth(ag.date)), 6);
        lbl.textContent = fmt(ag.date, { month: 'long', year: 'numeric' });
      }
      body.textContent = '';
      body.append(h('div', { class: 'loading' }, 'Cargando agenda…'));
      const qs = new URLSearchParams({ from, to });
      if (ag.pro) qs.set('professional', ag.pro);
      if (ag.service) qs.set('service', ag.service);
      if (ag.status) qs.set('status', ag.status);
      try {
        const [r1, r2] = await Promise.all([api('/appointments?' + qs), api('/blocks?from=' + from)]);
        body.textContent = '';
        const list = r1.appointments, blocks = r2.blocks;
        body.append(ag.mode === 'day' ? dayView(ag.date, list, blocks) : ag.mode === 'week' ? weekView(from, list, blocks) : monthView(ag.date, from, to, list));
      } catch (e) { body.textContent = ''; if (!e.silent) body.append(h('div', { class: 'empty' }, e.message)); }
    }
    S.agendaRefresh = draw;
    draw();
  };

  function dayRules(blocks, date) {
    return blocks.filter(b => b.date_from <= date && b.date_to >= date);
  }
  function dayView(date, list, blocks) {
    const wd = wdOf(date);
    const rules = dayRules(blocks, date);
    const salonWeekly = S.d.salonSchedule.filter(r => r.weekday === wd).map(r => [toMin(r.start), toMin(r.end)]);
    const salonOpens = rules.filter(b => b.type === 'open' && !b.professional_id && b.start_time).map(b => [toMin(b.start_time), toMin(b.end_time)]);
    const openIv = [...salonWeekly, ...salonOpens];
    const marks = [...openIv.flat(), ...list.flatMap(a => [toMin(a.start_time), toMin(a.end_time)])];
    let start = Math.min(9 * 60, ...(marks.length ? marks : [9 * 60]));
    let end = Math.max(21 * 60, ...(marks.length ? marks : [21 * 60]));
    start = Math.max(0, Math.floor(start / 60) * 60);
    end = Math.min(1440, Math.ceil(end / 60) * 60);
    if (end - start < 240) end = Math.min(1440, start + 240);
    const PX = 1.3;

    let cols;
    const pros = activePros();
    if (S.ag.pro === 'none') cols = [{ key: 'none', name: 'Sin asignar' }];
    else if (S.ag.pro) { const p = proById(S.ag.pro); cols = [{ key: p.id, name: p.name, color: p.color, pro: p }]; }
    else if (pros.length) {
      cols = pros.map(p => ({ key: p.id, name: p.name, color: p.color, pro: p }));
      list.forEach(a => { if (a.professional_id && !cols.some(c => c.key === a.professional_id)) cols.push({ key: a.professional_id, name: a.professional_name || 'Profesional', color: a.professional_color }); });
      if (list.some(a => !a.professional_id)) cols.push({ key: 'none', name: 'Sin asignar' });
    } else cols = [{ key: 'all', name: 'Agenda del salón' }];

    const grid = h('div', { class: 'dg', style: { '--cols': cols.length, '--hour': 60 * PX + 'px' } });
    const times = h('div', { class: 'dg__times' });
    for (let m = start; m <= end; m += 60) times.append(h('span', { style: { top: (m - start) * PX + 'px' } }, toHHMM(m)));
    const cells = cols.map(c => {
      const col = h('div', {
        class: 'dg__col',
        onclick: e => {
          if (e.target !== col) return;
          const m = start + Math.floor((e.offsetY / PX) / 15) * 15;
          openAppointment(null, { date, time: toHHMM(m), professionalId: typeof c.key === 'number' ? c.key : '' });
        }
      });
      let colOpen = openIv;
      if (c.pro && !c.pro.use_salon_hours) {
        colOpen = c.pro.schedule.filter(r => r.weekday === wd).map(r => [toMin(r.start), toMin(r.end)]);
      }
      const proOpens = rules.filter(b => b.type === 'open' && b.professional_id === c.key && b.start_time).map(b => [toMin(b.start_time), toMin(b.end_time)]);
      colOpen = [...colOpen, ...proOpens];
      subtract([[start, end]], colOpen.map(iv => [Math.max(iv[0], start), Math.min(iv[1], end)]).filter(iv => iv[1] > iv[0]))
        .forEach(([s, e]) => col.append(h('div', { class: 'dg__closed', style: { top: (s - start) * PX + 'px', height: (e - s) * PX + 'px' } })));
      rules.filter(b => b.type === 'block' && (!b.professional_id || b.professional_id === c.key)).forEach(b => {
        const s = Math.max(b.start_time ? toMin(b.start_time) : 0, start);
        const e = Math.min(b.end_time ? toMin(b.end_time) : 1440, end);
        if (e <= s) return;
        col.append(h('div', { class: 'dg__block', style: { top: (s - start) * PX + 'px', height: (e - s) * PX + 'px' } },
          'Bloqueado' + (b.reason ? ' · ' + b.reason : '')));
      });
      const mine = list.filter(a => (c.key === 'all' ? true : c.key === 'none' ? !a.professional_id : a.professional_id === c.key));
      const sorted = [...mine].sort((x, y) => toMin(x.start_time) - toMin(y.start_time));
      const laneEnd = [];
      sorted.forEach(a => {
        const s = toMin(a.start_time), e = Math.max(toMin(a.end_time), s + 20);
        let lane = laneEnd.findIndex(x => x <= s);
        if (lane === -1) { lane = laneEnd.length; laneEnd.push(0); }
        laneEnd[lane] = e;
        a.__lane = lane;
      });
      const lanes = Math.max(1, laneEnd.length);
      sorted.forEach(a => {
        const s = toMin(a.start_time), e = Math.max(toMin(a.end_time), s + 20);
        col.append(h('button', {
          class: `appt appt--${a.status}`, type: 'button',
          style: {
            top: (s - start) * PX + 'px', height: Math.max(22, (e - s) * PX - 2) + 'px',
            left: `calc(${(a.__lane / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)`,
            '--pc': a.professional_color || 'var(--rose)'
          },
          onclick: ev => { ev.stopPropagation(); openAppointment(a); }
        }, h('strong', {}, `${a.start_time} ${a.first_name} ${a.last_name}`), h('span', {}, a.service_name)));
      });
      return col;
    });
    const bodyEl = h('div', { class: 'dg__body', style: { height: (end - start) * PX + 'px' } }, times, cells);
    if (date === todayAR()) {
      const n = nowMinAR();
      if (n >= start && n <= end) bodyEl.append(h('div', { class: 'dg__now', style: { top: (n - start) * PX + 'px' } }));
    }
    grid.append(h('div', { class: 'dg__head' }, h('div', {}), cols.map(c => h('div', { class: 'dg__colhead' }, c.color ? h('i', { style: { background: c.color } }) : null, c.name))), bodyEl);
    return h('div', {},
      h('div', { class: 'dg-wrap' }, grid),
      h('p', { class: 'legend' },
        h('span', {}, h('i', { style: { background: '#FFF1D6' } }), 'Pendiente'),
        h('span', {}, h('i', { style: { background: '#E1F1E6' } }), 'Confirmado'),
        h('span', {}, h('i', { style: { background: '#EAEFF0' } }), 'Completado'),
        h('span', {}, h('i', { style: { background: '#F4DCE1' } }), 'Bloqueado'),
        h('span', {}, 'Tocá un espacio libre para cargar un turno.')));
  }

  function weekView(from, list, blocks) {
    const wrap = h('div', { class: 'wk' });
    for (let i = 0; i < 7; i++) {
      const d = addDays(from, i);
      const items = list.filter(a => a.date === d).sort((x, y) => x.start_time.localeCompare(y.start_time));
      const closed = !S.d.salonSchedule.some(r => r.weekday === wdOf(d));
      const rules = dayRules(blocks, d).filter(b => b.type === 'block');
      wrap.append(h('section', { class: 'wk__day' + (d === todayAR() ? ' is-today' : '') },
        h('button', { class: 'wk__head', type: 'button', onclick: () => { S.ag.mode = 'day'; S.ag.date = d; S.agendaRefresh(); } },
          h('span', {}, DAYS_SHORT[wdOf(d)]), h('strong', {}, String(Number(d.slice(8)))),
          items.length ? h('small', {}, `${items.length} turno${items.length > 1 ? 's' : ''}`) : null),
        closed ? h('p', { class: 'wk__note' }, 'Salón cerrado') : null,
        rules.map(b => h('p', { class: 'wk__block' }, `${b.start_time ? `${b.start_time}–${b.end_time}` : 'Todo el día'} · ${b.professional_name || 'Salón'}${b.reason ? ' · ' + b.reason : ''}`)),
        items.map(a => apptChip(a)),
        h('button', { class: 'wk__add', type: 'button', onclick: () => openAppointment(null, { date: d }) }, '+ Turno')));
    }
    return wrap;
  }
  function apptChip(a) {
    return h('button', {
      class: `chipA chipA--${a.status}`, type: 'button', style: { '--pc': a.professional_color || 'var(--rose)' },
      onclick: () => openAppointment(a)
    }, h('b', {}, a.start_time), h('span', {}, `${a.first_name} ${a.last_name}`),
      h('small', {}, a.service_name + (a.professional_name ? ' · ' + a.professional_name : '')));
  }

  function monthView(date, from, to, list) {
    const month = date.slice(0, 7);
    const grid = h('div', { class: 'mo' }, ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => h('div', { class: 'mo__dow' }, d)));
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const items = list.filter(a => a.date === d && a.status !== 'cancelado').sort((x, y) => x.start_time.localeCompare(y.start_time));
      const closed = !S.d.salonSchedule.some(r => r.weekday === wdOf(d));
      const day = d;
      grid.append(h('button', {
        class: 'mo__cell' + (d.slice(0, 7) !== month ? ' is-out' : '') + (d === todayAR() ? ' is-today' : '') + (closed ? ' is-closed' : ''),
        type: 'button', onclick: () => { S.ag.mode = 'day'; S.ag.date = day; S.agendaRefresh(); }
      },
        h('span', { class: 'mo__num' }, String(Number(d.slice(8)))),
        items.length ? h('span', { class: 'mo__count' }, String(items.length)) : null,
        h('span', { class: 'mo__list' },
          items.slice(0, 3).map(a => h('span', { class: `mo__item mo__item--${a.status}` }, `${a.start_time} ${a.first_name}`)),
          items.length > 3 ? h('span', { class: 'mo__more' }, `+${items.length - 3} más`) : null)));
    }
    return grid;
  }

  /* ============================ Vista: Turnos ============================ */
  VIEWS.turnos = function () {
    if (!S.list) S.list = { from: todayAR(), to: addDays(todayAR(), 30), pro: '', service: '', status: '', q: '' };
    const f = S.list;
    let rows = [];
    S.el.actions.append(
      h('button', { class: 'btn btn--ghost', onclick: () => exportCSV(rows) }, 'Exportar CSV'),
      h('button', { class: 'btn btn--primary', onclick: () => openAppointment(null, { date: todayAR() }) }, I('plus'), 'Nuevo turno'));
    const from = inp({ type: 'date', value: f.from, onchange: e => { f.from = e.target.value; draw(); } });
    const to = inp({ type: 'date', value: f.to, onchange: e => { f.to = e.target.value; draw(); } });
    const q = inp({ type: 'search', placeholder: 'Buscar por nombre, teléfono o código', value: f.q, oninput: debounce(e => { f.q = e.target.value; draw(); }, 350) });
    const quick = (label, a, b, status) => h('button', {
      class: 'btn btn--ghost btn--sm', type: 'button',
      onclick: () => { f.from = a; f.to = b; f.status = status || ''; from.value = a; to.value = b; statusSel.value = f.status; draw(); }
    }, label);
    const statusSel = sel([['', 'Todos los estados'], ['activos', 'Pendientes + confirmados'], ...Object.entries(STATUS)], f.status, { onchange: e => { f.status = e.target.value; draw(); } });
    const proSel = S.d.professionals.length
      ? sel([['', 'Todas las profesionales'], ['none', 'Sin asignar'], ...S.d.professionals.map(p => [p.id, p.name])], f.pro, { onchange: e => { f.pro = e.target.value; draw(); } })
      : null;
    const svcSel = serviceSelect(f.service, { emptyLabel: 'Todos los servicios' });
    svcSel.addEventListener('change', e => { f.service = e.target.value; draw(); });
    const table = h('div', {});
    S.el.view.append(
      h('div', { class: 'card' },
        h('div', { class: 'form-grid--3' }, field('Desde', from), field('Hasta', to), field('Buscar', q)),
        h('div', { class: 'filters', style: { marginTop: '12px' } }, proSel, svcSel, statusSel),
        h('div', { class: 'filters', style: { marginTop: '10px' } },
          quick('Hoy', todayAR(), todayAR()),
          quick('Próximos 7 días', todayAR(), addDays(todayAR(), 7)),
          quick('Este mes', firstOfMonth(todayAR()), lastOfMonth(todayAR())),
          quick('Pendientes', todayAR(), addDays(todayAR(), 365), 'pendiente'))),
      table);

    async function draw() {
      table.textContent = '';
      table.append(h('div', { class: 'loading' }, 'Cargando turnos…'));
      const qs = new URLSearchParams();
      if (f.from) qs.set('from', f.from);
      if (f.to) qs.set('to', f.to);
      if (f.pro) qs.set('professional', f.pro);
      if (f.service) qs.set('service', f.service);
      if (f.status) qs.set('status', f.status);
      if (f.q) qs.set('q', f.q);
      try {
        const r = await api('/appointments?' + qs);
        rows = r.appointments;
        table.textContent = '';
        if (!rows.length) { table.append(h('div', { class: 'empty' }, 'No hay turnos con estos filtros.')); return; }
        const tbody = h('tbody', {}, rows.map(a => {
          const st = sel(Object.entries(STATUS), a.status, {
            class: 'inp status-sel st-' + a.status,
            onchange: async e => {
              const v = e.target.value;
              try { await api('/appointments/' + a.id, { method: 'PUT', body: { status: v } }); a.status = v; e.target.className = 'inp status-sel st-' + v; toast('Estado actualizado.'); refreshStats(); }
              catch (err) {
                if (err.data && err.data.conflict && await confirmBox(err.message + ' ¿Guardar igual?', { ok: 'Guardar igual' })) {
                  try { await api('/appointments/' + a.id, { method: 'PUT', body: { status: v, force: true } }); a.status = v; toast('Estado actualizado.'); }
                  catch (e2) { fail(e2); e.target.value = a.status; }
                } else { fail(err); e.target.value = a.status; }
              }
            }
          });
          return h('tr', {},
            h('td', { 'data-l': 'Fecha' }, fmtShort(a.date), h('small', {}, `${a.start_time} – ${a.end_time}`)),
            h('td', { 'data-l': 'Clienta' }, `${a.first_name} ${a.last_name}`, h('small', {}, a.phone)),
            h('td', { 'data-l': 'Servicio' }, a.service_name, a.comment ? h('small', {}, a.comment) : null),
            h('td', { 'data-l': 'Profesional' }, a.professional_name || '—'),
            h('td', { 'data-l': 'Estado' }, st),
            h('td', { 'data-l': 'Origen' }, h('span', { class: 'pill pill--muted' }, a.source === 'web' ? 'Web' : 'Panel')),
            h('td', {}, h('div', { class: 'row-actions' },
              a.phone ? h('a', { class: 'icon-btn icon-btn--sm icon-btn--wa', href: waHref(a.phone, `¡Hola ${a.first_name}! Te escribimos de ${S.d.settings.business_name} por tu turno del ${fmtLong(a.date)} a las ${a.start_time} hs.`), target: '_blank', rel: 'noopener', 'aria-label': 'WhatsApp' }, I('wa')) : null,
              h('button', { class: 'icon-btn icon-btn--sm', type: 'button', 'aria-label': 'Editar', onclick: () => openAppointment(a) }, I('edit')))));
        }));
        table.append(h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
          h('thead', {}, h('tr', {}, ['Fecha', 'Clienta', 'Servicio', 'Profesional', 'Estado', 'Origen', ''].map(t => h('th', {}, t)))), tbody)),
          h('p', { class: 'muted', style: { marginTop: '10px' } }, `${rows.length} turno(s)`));
      } catch (e) { table.textContent = ''; if (!e.silent) table.append(h('div', { class: 'empty' }, e.message)); }
    }
    S.listRefresh = draw;
    draw();
  };

  function exportCSV(rows) {
    if (!rows.length) return toast('No hay turnos para exportar.', 'warn');
    const head = ['Código', 'Fecha', 'Desde', 'Hasta', 'Servicio', 'Profesional', 'Nombre', 'Apellido', 'Teléfono', 'Email', 'Estado', 'Origen', 'Comentario', 'Notas'];
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [head.join(';')].concat(rows.map(a => [a.code, a.date, a.start_time, a.end_time, a.service_name, a.professional_name, a.first_name, a.last_name, a.phone, a.email, STATUS[a.status], a.source, a.comment, a.admin_notes].map(esc).join(';'))).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = h('a', { href: url, download: `turnos-${todayAR()}.csv` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* ============================ Vista: Servicios ============================ */
  VIEWS.servicios = function () {
    const tabs = h('div', { class: 'tabs' },
      [['servicios', 'Servicios'], ['categorias', 'Categorías']].map(([k, l]) =>
        h('button', { type: 'button', class: S.svcTab === k ? 'is-on' : '', onclick: () => { S.svcTab = k; route(); } }, l)));
    S.el.actions.append(S.svcTab === 'servicios'
      ? h('button', { class: 'btn btn--primary', onclick: () => serviceModal(null) }, I('plus'), 'Nuevo servicio')
      : h('button', { class: 'btn btn--primary', onclick: () => categoryModal(null) }, I('plus'), 'Nueva categoría'));
    S.el.view.append(tabs);
    if (S.svcTab === 'categorias') {
      S.el.view.append(h('p', { class: 'note note--info' }, 'Las categorías agrupan los servicios en la web (pestañas de la sección "Servicios").'),
        ...S.d.categories.map(c => h('div', { class: 'svc-row' + (c.active ? '' : ' is-off') },
          h('img', { src: c.image || artUrl(c.art), alt: '' }),
          h('div', { class: 'svc-row__main' },
            h('div', { class: 'svc-row__name' }, c.name, c.subtitle ? h('span', { class: 'svc-row__badges' }, h('span', { class: 'pill pill--rose' }, c.subtitle)) : null,
              c.active ? null : h('span', { class: 'svc-row__badges' }, h('span', { class: 'pill pill--muted' }, 'Oculta'))),
            h('div', { class: 'svc-row__meta' }, `${S.d.services.filter(x => x.category_id === c.id).length} servicio(s) · Orden ${c.sort_order}`)),
          h('button', { class: 'btn btn--ghost btn--sm', onclick: () => categoryModal(c) }, 'Editar'))));
      if (!S.d.categories.length) S.el.view.append(h('div', { class: 'empty' }, 'Todavía no hay categorías.'));
      return;
    }
    const groups = S.d.categories.map(c => [c, S.d.services.filter(x => x.category_id === c.id)]);
    const orphans = S.d.services.filter(x => !S.d.categories.some(c => c.id === x.category_id));
    if (orphans.length) groups.push([{ name: 'Sin categoría', subtitle: '' }, orphans]);
    if (!S.d.services.length) S.el.view.append(h('div', { class: 'empty' }, 'Todavía no hay servicios cargados.'));
    groups.forEach(([c, list]) => {
      if (!list.length) return;
      S.el.view.append(h('section', { class: 'svc-group' },
        h('div', { class: 'svc-group__head' }, h('h2', {}, c.name), c.subtitle ? h('span', { class: 'pill pill--rose' }, c.subtitle) : null),
        list.map(x => h('div', { class: 'svc-row' + (x.active ? '' : ' is-off') },
          h('img', { src: x.image || artUrl(x.art), alt: '' }),
          h('div', { class: 'svc-row__main' },
            h('div', { class: 'svc-row__name' }, x.name, h('span', { class: 'svc-row__badges' },
              x.active ? null : h('span', { class: 'pill pill--muted' }, 'Inactivo'),
              x.bookable ? null : h('span', { class: 'pill pill--muted' }, 'Sin reserva online'))),
            h('div', { class: 'svc-row__meta' }, `${priceLabel(x)} · ${durLabel(x)}`,
              x.professionals.length ? ` · ${x.professionals.length} profesional(es)` : (S.d.professionals.length ? ' · sin profesionales asignadas' : ''))),
          h('button', { class: 'btn btn--ghost btn--sm', onclick: () => serviceModal(x) }, 'Editar')))));
    });
  };

  function optionsEditor(list) {
    const rows = h('div', {});
    const wrap = h('div', {}, rows);
    const add = (o = { label: '', amount: '' }) => {
      const l = inp({ value: o.label, placeholder: 'Ej.: Efectivo', maxlength: 40 });
      const m = inp({ type: 'number', min: 0, step: 100, value: o.amount, placeholder: 'Monto' });
      const row = h('div', { class: 'opts-ed__row' }, l, m,
        h('button', { type: 'button', class: 'icon-btn icon-btn--sm', 'aria-label': 'Quitar', onclick: () => row.remove() }, I('x')));
      row._get = () => ({ label: l.value.trim(), amount: m.value });
      rows.append(row);
    };
    (list || []).forEach(add);
    wrap.append(h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => add() }, I('plus'), 'Agregar opción'));
    wrap.get = () => [...rows.children].map(r => r._get()).filter(o => o.label && o.amount !== '');
    return wrap;
  }
  function artSelect(value) {
    return sel(S.d.artNames.map(n => [n, n]), value || 'balayage');
  }
  function serviceModal(x) {
    const isNew = !x;
    const cur = x || { name: '', description: '', price: '', price_from: 0, price_options: [], duration_min: '', image: '', art: 'balayage', bookable: 1, active: 1, sort_order: (S.d.services.length + 1) * 10, professionals: [], category_id: S.d.categories[0] ? S.d.categories[0].id : '' };
    const name = inp({ value: cur.name, maxlength: 80, required: true });
    const catSel = sel([['', 'Sin categoría'], ...S.d.categories.map(c => [c.id, c.name])], cur.category_id || '');
    const desc = area({ rows: 3, maxlength: 600 }, cur.description);
    const price = inp({ type: 'number', min: 0, step: 100, value: cur.price ?? '', placeholder: 'Vacío = Consultar precio' });
    const from = checkbox('Mostrar como "Desde"', !!cur.price_from);
    const opts = optionsEditor(cur.price_options);
    const duration = inp({ type: 'number', min: 5, max: 720, step: 5, value: cur.duration_min ?? '', placeholder: `Vacío = ${S.d.settings.booking_default_duration} min para la agenda` });
    const art = artSelect(cur.art);
    const img = imageField(cur.image, { fallback: artUrl(cur.art) });
    art.addEventListener('change', () => img.setFallback(artUrl(art.value)));
    const bookable = checkbox('Se puede reservar online', !!cur.bookable);
    const active = checkbox('Visible en la web', !!cur.active);
    const order = inp({ type: 'number', value: cur.sort_order, step: 1 });
    const proChecks = [];
    const prosBox = h('div', { class: 'checks' });
    if (S.d.professionals.length) {
      activePros().forEach(p => {
        const c = checkbox(p.name, cur.professionals.includes(p.id));
        proChecks.push([p.id, c.input]);
        prosBox.append(c.el);
      });
    }
    const body = h('div', { class: 'form-grid' },
      field('Nombre del servicio', name), field('Categoría', catSel),
      field('Descripción', desc, 'Se muestra en la tarjeta del servicio.', 'span2'),
      field('Precio (ARS)', price, 'Dejalo vacío si el precio se consulta.'),
      fieldBox('Opciones', h('div', {}, from.el), 'Marcá si el precio es "desde".'),
      fieldBox('Precios por forma de pago', opts, 'Si cargás opciones (ej.: Efectivo, Transferencia, Tarjeta) se muestran en lugar del precio único.', 'span2'),
      field('Duración (minutos)', duration, 'Define cuánto ocupa en la agenda.'),
      field('Orden', order, 'Menor número = aparece antes.'),
      fieldBox('Imagen', img.el, 'Si no cargás una foto se usa una ilustración de ejemplo.', 'span2'),
      field('Ilustración de ejemplo', art),
      fieldBox('Mostrar', h('div', {}, bookable.el, h('br'), active.el)),
      S.d.professionals.length ? fieldBox('Profesionales que lo realizan', prosBox, 'Si no marcás ninguna, el turno se agenda con el horario general del salón.', 'span2') : null);

    async function save() {
      const payload = {
        name: name.value, category_id: catSel.value || null, description: desc.value,
        price: price.value === '' ? '' : Number(price.value), price_from: from.input.checked ? 1 : 0,
        price_options: opts.get(), duration_min: duration.value === '' ? '' : Number(duration.value),
        image: img.get(), art: art.value, bookable: bookable.input.checked ? 1 : 0, active: active.input.checked ? 1 : 0,
        sort_order: Number(order.value) || 0, professionals: proChecks.filter(([, c]) => c.checked).map(([id]) => id)
      };
      try {
        if (isNew) await api('/services', { method: 'POST', body: payload });
        else await api('/services/' + x.id, { method: 'PUT', body: payload });
        toast('Servicio guardado.'); m.close(); reload();
      } catch (e) { fail(e); }
    }
    async function remove() {
      if (!await confirmBox(`¿Eliminar "${x.name}"? Los turnos ya cargados se conservan. Si solo querés ocultarlo, desmarcá "Visible en la web".`, { ok: 'Eliminar', danger: true })) return;
      try { await api('/services/' + x.id, { method: 'DELETE' }); toast('Servicio eliminado.'); m.close(); reload(); } catch (e) { fail(e); }
    }
    const m = modal({
      title: isNew ? 'Nuevo servicio' : cur.name, body, wide: true,
      footer: [x ? h('button', { class: 'btn btn--danger-ghost', type: 'button', onclick: remove }, I('trash'), 'Eliminar') : null,
        h('span', { class: 'grow' }),
        h('button', { class: 'btn btn--primary', type: 'button', onclick: save }, 'Guardar')]
    });
  }
  function categoryModal(c) {
    const isNew = !c;
    const cur = c || { name: '', subtitle: '', description: '', image: '', art: 'balayage', sort_order: (S.d.categories.length + 1) * 10, active: 1 };
    const name = inp({ value: cur.name, maxlength: 60 });
    const subtitle = inp({ value: cur.subtitle, maxlength: 60, placeholder: 'Ej.: Star Lash' });
    const desc = area({ rows: 3, maxlength: 600 }, cur.description);
    const art = artSelect(cur.art);
    const img = imageField(cur.image, { fallback: artUrl(cur.art) });
    art.addEventListener('change', () => img.setFallback(artUrl(art.value)));
    const order = inp({ type: 'number', value: cur.sort_order });
    const active = checkbox('Visible en la web', !!cur.active);
    const body = h('div', { class: 'form-grid' },
      field('Nombre', name), field('Subtítulo', subtitle, 'Opcional. Ej.: marca o responsable.'),
      field('Descripción', desc, null, 'span2'),
      field('Ilustración de ejemplo', art), field('Orden', order),
      fieldBox('Imagen', img.el, null, 'span2'), fieldBox('Mostrar', active.el));
    async function save() {
      const payload = { name: name.value, subtitle: subtitle.value, description: desc.value, image: img.get(), art: art.value, sort_order: Number(order.value) || 0, active: active.input.checked ? 1 : 0 };
      try {
        if (isNew) await api('/categories', { method: 'POST', body: payload });
        else await api('/categories/' + c.id, { method: 'PUT', body: payload });
        toast('Categoría guardada.'); m.close(); reload();
      } catch (e) { fail(e); }
    }
    async function remove() {
      if (!await confirmBox(`¿Eliminar la categoría "${c.name}"? Los servicios quedan sin categoría.`, { ok: 'Eliminar', danger: true })) return;
      try { await api('/categories/' + c.id, { method: 'DELETE' }); toast('Categoría eliminada.'); m.close(); reload(); } catch (e) { fail(e); }
    }
    const m = modal({
      title: isNew ? 'Nueva categoría' : cur.name, body,
      footer: [c ? h('button', { class: 'btn btn--danger-ghost', type: 'button', onclick: remove }, I('trash'), 'Eliminar') : null,
        h('span', { class: 'grow' }), h('button', { class: 'btn btn--primary', type: 'button', onclick: save }, 'Guardar')]
    });
  }

  /* ============================ Vista: Profesionales ============================ */
  VIEWS.profesionales = function () {
    S.el.actions.append(h('button', { class: 'btn btn--primary', onclick: () => proModal(null) }, I('plus'), 'Nueva profesional'));
    if (!S.d.professionals.length) {
      S.el.view.append(h('p', { class: 'note' }, 'Todavía no cargaste profesionales. Mientras tanto, las reservas online usan el horario del salón y la cantidad de turnos simultáneos configurada en Configuración → Reservas online.'));
    }
    const grid = h('div', { class: 'pro-grid' }, S.d.professionals.map(p => h('div', { class: 'pro-card' + (p.active ? '' : ' is-off') },
      h('div', { class: 'avatar' }, p.photo ? h('img', { src: p.photo, alt: '' }) : (p.name.trim()[0] || '?').toUpperCase()),
      h('div', { class: 'grow' },
        h('h3', {}, p.name),
        p.role ? h('p', {}, p.role) : null,
        h('p', { class: 'muted' }, p.use_salon_hours ? 'Horario del salón' : `${p.schedule.length} franja(s) propias`),
        h('p', { class: 'muted' }, `${p.services.length} servicio(s)`),
        h('p', {}, p.active ? null : h('span', { class: 'pill pill--muted' }, 'Inactiva'), ' ', p.show_on_site ? null : h('span', { class: 'pill pill--muted' }, 'Oculta en la web')),
        h('button', { class: 'btn btn--ghost btn--sm', style: { marginTop: '8px' }, onclick: () => proModal(p) }, 'Editar')))));
    S.el.view.append(grid.children.length ? grid : h('div', { class: 'empty' }, 'Sin profesionales cargadas.'));
  };
  function proModal(p) {
    const isNew = !p;
    const cur = p || { name: '', role: '', bio: '', photo: '', color: '#B25C7A', use_salon_hours: 1, show_on_site: 1, active: 1, sort_order: (S.d.professionals.length + 1) * 10, services: S.d.services.map(x => x.id), schedule: [] };
    const name = inp({ value: cur.name, maxlength: 80 });
    const role = inp({ value: cur.role, maxlength: 80, placeholder: 'Ej.: Colorista' });
    const bio = area({ rows: 2, maxlength: 600 }, cur.bio);
    const photo = imageField(cur.photo);
    const color = h('input', { type: 'color', class: 'inp', value: cur.color, style: { height: '40px', padding: '2px' } });
    const salonHours = h('input', { type: 'radio', name: 'sch', checked: !!cur.use_salon_hours });
    const ownHours = h('input', { type: 'radio', name: 'sch', checked: !cur.use_salon_hours });
    const weekly = weeklyEditor(cur.schedule.length ? cur.schedule : S.d.salonSchedule);
    const syncSched = () => { weekly.hidden = salonHours.checked; };
    salonHours.addEventListener('change', syncSched);
    ownHours.addEventListener('change', syncSched);
    syncSched();
    const svcChecks = [];
    const svcBox = h('div', { class: 'checks' });
    S.d.categories.forEach(c => {
      const list = S.d.services.filter(x => x.category_id === c.id);
      if (!list.length) return;
      svcBox.append(h('div', { class: 'checks__group' }, c.name));
      list.forEach(x => { const ch = checkbox(x.name, cur.services.includes(x.id)); svcChecks.push([x.id, ch.input]); svcBox.append(ch.el); });
    });
    S.d.services.filter(x => !S.d.categories.some(c => c.id === x.category_id)).forEach(x => {
      const ch = checkbox(x.name, cur.services.includes(x.id)); svcChecks.push([x.id, ch.input]); svcBox.append(ch.el);
    });
    const show = checkbox('Mostrar en la web (sección "Nuestro equipo")', !!cur.show_on_site);
    const active = checkbox('Activa (toma turnos)', !!cur.active);
    const order = inp({ type: 'number', value: cur.sort_order });
    const body = h('div', { class: 'form-grid' },
      field('Nombre', name), field('Especialidad', role),
      field('Breve descripción', bio, null, 'span2'),
      fieldBox('Foto', photo.el, null, 'span2'),
      field('Color en la agenda', color), field('Orden', order),
      fieldBox('Servicios que realiza', h('div', {},
        h('button', { type: 'button', class: 'btn btn--text btn--sm', onclick: () => svcChecks.forEach(([, c]) => { c.checked = true; }) }, 'Marcar todos'),
        h('button', { type: 'button', class: 'btn btn--text btn--sm', onclick: () => svcChecks.forEach(([, c]) => { c.checked = false; }) }, 'Desmarcar todos'),
        svcBox), 'Los turnos de esos servicios se pueden agendar con ella.', 'span2'),
      fieldBox('Horario', h('div', {},
        h('label', { class: 'chk' }, salonHours, h('span', {}, 'Usa el horario del salón')),
        h('br'),
        h('label', { class: 'chk' }, ownHours, h('span', {}, 'Horario propio')),
        weekly), null, 'span2'),
      fieldBox('Visibilidad', h('div', {}, show.el, h('br'), active.el), null, 'span2'));
    async function save() {
      const payload = {
        name: name.value, role: role.value, bio: bio.value, photo: photo.get(), color: color.value,
        use_salon_hours: salonHours.checked ? 1 : 0, schedule: salonHours.checked ? [] : weekly.get(),
        show_on_site: show.input.checked ? 1 : 0, active: active.input.checked ? 1 : 0, sort_order: Number(order.value) || 0,
        services: svcChecks.filter(([, c]) => c.checked).map(([id]) => id)
      };
      try {
        if (isNew) await api('/professionals', { method: 'POST', body: payload });
        else await api('/professionals/' + p.id, { method: 'PUT', body: payload });
        toast('Profesional guardada.'); m.close(); reload();
      } catch (e) { fail(e); }
    }
    async function remove() {
      if (!await confirmBox(`¿Eliminar a ${p.name}? Los turnos ya cargados conservan su nombre pero quedan sin asignar.`, { ok: 'Eliminar', danger: true })) return;
      try { await api('/professionals/' + p.id, { method: 'DELETE' }); toast('Profesional eliminada.'); m.close(); reload(); } catch (e) { fail(e); }
    }
    const m = modal({
      title: isNew ? 'Nueva profesional' : cur.name, body, wide: true,
      footer: [p ? h('button', { class: 'btn btn--danger-ghost', type: 'button', onclick: remove }, I('trash'), 'Eliminar') : null,
        h('span', { class: 'grow' }), h('button', { class: 'btn btn--primary', type: 'button', onclick: save }, 'Guardar')]
    });
  }

  /* ============================ Vista: Horarios ============================ */
  VIEWS.horarios = function () {
    const isAdmin = S.user.role === 'admin';
    if (isAdmin) {
      const weekly = weeklyEditor(S.d.salonSchedule);
      const card = h('section', { class: 'card' },
        h('h2', {}, 'Horario del salón'),
        h('p', { class: 'card__sub' }, 'Define los horarios que se ofrecen para reservar online y el rango que se ve en la agenda.'),
        weekly,
        h('div', { style: { marginTop: '14px' } }, h('button', {
          class: 'btn btn--primary', onclick: async e => {
            e.target.disabled = true;
            try { const r = await api('/schedule', { method: 'PUT', body: { weekly: weekly.get() } }); S.d.salonSchedule = r.salonSchedule; toast('Horario guardado.'); }
            catch (x) { fail(x); } finally { e.target.disabled = false; }
          }
        }, 'Guardar horario')));
      S.el.view.append(card);
    }
    const type = sel([['block', 'Bloquear (cerrar) un horario'], ['open', 'Abrir un horario especial']], 'block');
    const who = sel([['', 'Todo el salón'], ...activePros().map(p => [p.id, p.name])], '');
    const dFrom = inp({ type: 'date', value: todayAR() });
    const dTo = inp({ type: 'date', value: todayAR() });
    const allDay = checkbox('Todo el día', true);
    const tFrom = inp({ type: 'time', value: '09:00', step: 300 });
    const tTo = inp({ type: 'time', value: '13:00', step: 300 });
    const reason = inp({ maxlength: 200, placeholder: 'Ej.: feriado, capacitación, vacaciones' });
    const timesRow = h('div', { class: 'form-grid' }, field('Desde las', tFrom), field('Hasta las', tTo));
    const sync = () => {
      const isOpen = type.value === 'open';
      allDay.input.disabled = isOpen;
      if (isOpen) allDay.input.checked = false;
      timesRow.hidden = allDay.input.checked;
    };
    type.addEventListener('change', sync);
    allDay.input.addEventListener('change', sync);
    dFrom.addEventListener('change', () => { if (dTo.value < dFrom.value) dTo.value = dFrom.value; });
    sync();
    const list = h('div', {});
    S.el.view.append(
      h('section', { class: 'card' },
        h('h2', {}, 'Bloquear o abrir horarios'),
        h('p', { class: 'card__sub' }, 'Usalo para feriados, vacaciones, cursos o para abrir un horario fuera de lo habitual.'),
        h('div', { class: 'form-grid' },
          field('¿Qué querés hacer?', type), field('¿A quién aplica?', who),
          field('Desde el día', dFrom), field('Hasta el día', dTo),
          fieldBox('', allDay.el), h('div', {}),
          h('div', { class: 'span2' }, timesRow),
          field('Motivo (opcional)', reason, null, 'span2')),
        h('div', { style: { marginTop: '14px' } }, h('button', {
          class: 'btn btn--primary', onclick: async e => {
            e.target.disabled = true;
            try {
              const r = await api('/blocks', {
                method: 'POST',
                body: { type: type.value, professionalId: who.value || null, dateFrom: dFrom.value, dateTo: dTo.value, allDay: allDay.input.checked, start: tFrom.value, end: tTo.value, reason: reason.value }
              });
              toast(type.value === 'block' ? 'Horario bloqueado.' : 'Horario abierto.');
              if (r.affected) toast(`Atención: hay ${r.affected} turno(s) activo(s) en esas fechas. Revisalos en la agenda.`, 'warn');
              reason.value = '';
              drawList();
            } catch (x) { fail(x); } finally { e.target.disabled = false; }
          }
        }, 'Guardar')),
      h('section', { class: 'card' }, h('h2', {}, 'Bloqueos y aperturas vigentes'), h('p', { class: 'card__sub' }, 'Se muestran los de los últimos 60 días en adelante.'), list)));

    async function drawList() {
      list.textContent = '';
      list.append(h('div', { class: 'loading' }, 'Cargando…'));
      try {
        const r = await api('/blocks');
        list.textContent = '';
        if (!r.blocks.length) { list.append(h('div', { class: 'empty' }, 'No hay bloqueos ni aperturas cargadas.')); return; }
        list.append(h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
          h('thead', {}, h('tr', {}, ['Tipo', 'Fechas', 'Horario', 'Aplica a', 'Motivo', ''].map(t => h('th', {}, t)))),
          h('tbody', {}, r.blocks.map(b => h('tr', {},
            h('td', { 'data-l': 'Tipo' }, h('span', { class: 'pill pill--' + b.type }, b.type === 'block' ? 'Bloqueo' : 'Apertura')),
            h('td', { 'data-l': 'Fechas' }, b.date_from === b.date_to ? fmtLong(b.date_from) : `${fmtShort(b.date_from)} al ${fmtShort(b.date_to)}`),
            h('td', { 'data-l': 'Horario' }, b.start_time ? `${b.start_time} – ${b.end_time}` : 'Todo el día'),
            h('td', { 'data-l': 'Aplica a' }, b.professional_name || 'Todo el salón'),
            h('td', { 'data-l': 'Motivo' }, b.reason || '—'),
            h('td', {}, h('div', { class: 'row-actions' }, h('button', {
              class: 'btn btn--text btn--sm', onclick: async () => {
                if (!await confirmBox('¿Quitar esta regla? El horario vuelve a su estado normal.', { ok: 'Quitar' })) return;
                try { await api('/blocks/' + b.id, { method: 'DELETE' }); toast('Regla eliminada.'); drawList(); } catch (e) { fail(e); }
              }
            }, 'Quitar')))))))));
      } catch (e) { list.textContent = ''; if (!e.silent) list.append(h('div', { class: 'empty' }, e.message)); }
    }
    drawList();
  };

  /* ============================ Vista: Galería ============================ */
  VIEWS.galeria = function () {
    const catSel = sel(S.d.galleryCategories.map(c => [c.key, c.label]), 'balayage');
    const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, hidden: true });
    const upBtn = h('button', { class: 'btn btn--primary', onclick: () => file.click() }, I('image'), 'Subir fotos');
    const progress = h('span', { class: 'muted' });
    S.el.actions.append(upBtn);
    const grid = h('div', { class: 'gal-grid' });
    S.el.view.append(
      h('p', { class: 'note note--info' }, 'Mientras la galería esté vacía, la web muestra ilustraciones de ejemplo (podés desactivarlas en Configuración → Contenido de ejemplo). Subí fotos propias o con autorización de la clienta.'),
      h('section', { class: 'card' }, h('div', { class: 'card__head' }, h('h2', {}, 'Nuevas fotos'), h('div', { class: 'filters' }, field('Categoría', catSel), upBtn.cloneNode(false), progress)), file),
      grid);
    const realUp = S.el.view.querySelector('.card__head .btn');
    if (realUp) { realUp.textContent = 'Subir fotos'; realUp.addEventListener('click', () => file.click()); }
    file.addEventListener('change', async () => {
      const files = [...file.files];
      file.value = '';
      if (!files.length) return;
      upBtn.disabled = true;
      let n = 0;
      for (const f of files) {
        progress.textContent = `Subiendo ${++n} de ${files.length}…`;
        try {
          const url = await uploadImage(f, { max: 1600 });
          const r = await api('/gallery', { method: 'POST', body: { image: url, category: catSel.value, caption: '', sort_order: S.d.gallery.length * 10 } });
          S.d.gallery.unshift(r.item);
        } catch (e) { fail(e); }
      }
      progress.textContent = '';
      upBtn.disabled = false;
      toast('Fotos subidas.');
      drawGrid();
    });
    function drawGrid() {
      grid.textContent = '';
      if (!S.d.gallery.length) { grid.append(h('div', { class: 'empty' }, 'Todavía no hay fotos cargadas.')); return; }
      S.d.gallery.forEach(item => {
        const save = debounce(async body => {
          try { await api('/gallery/' + item.id, { method: 'PUT', body }); Object.assign(item, body); toast('Guardado.'); } catch (e) { fail(e); }
        }, 400);
        const card = h('div', { class: 'gal-card' + (item.visible ? '' : ' is-hidden') },
          h('img', { src: item.image, alt: item.caption || '' }),
          h('div', { class: 'gal-card__body' },
            sel(S.d.galleryCategories.map(c => [c.key, c.label]), item.category, { onchange: e => save({ category: e.target.value, caption: item.caption, visible: item.visible, sort_order: item.sort_order }) }),
            inp({ value: item.caption, placeholder: 'Descripción (opcional)', maxlength: 120, oninput: e => save({ category: item.category, caption: e.target.value, visible: item.visible, sort_order: item.sort_order }) }),
            h('div', { class: 'gal-card__row' },
              (() => {
                const v = checkbox('Visible', !!item.visible);
                v.input.addEventListener('change', () => { card.classList.toggle('is-hidden', !v.input.checked); save({ category: item.category, caption: item.caption, visible: v.input.checked ? 1 : 0, sort_order: item.sort_order }); });
                return v.el;
              })(),
              inp({ type: 'number', value: item.sort_order, style: { width: '72px' }, 'aria-label': 'Orden', onchange: e => save({ category: item.category, caption: item.caption, visible: item.visible, sort_order: Number(e.target.value) || 0 }) }),
              h('button', {
                class: 'icon-btn icon-btn--sm', 'aria-label': 'Eliminar', onclick: async () => {
                  if (!await confirmBox('¿Eliminar esta foto de la galería?', { ok: 'Eliminar', danger: true })) return;
                  try { await api('/gallery/' + item.id, { method: 'DELETE' }); S.d.gallery = S.d.gallery.filter(g => g.id !== item.id); toast('Foto eliminada.'); drawGrid(); } catch (e) { fail(e); }
                }
              }, I('trash')))));
        grid.append(card);
      });
    }
    drawGrid();
  };

  /* ============================ Vista: Reseñas ============================ */
  VIEWS.resenas = function () {
    S.el.actions.append(h('button', { class: 'btn btn--primary', onclick: () => reviewModal(null) }, I('plus'), 'Nueva reseña'));
    S.el.view.append(h('p', { class: 'note' }, 'Cargá únicamente reseñas reales de clientas (por ejemplo, copiadas de Google). La web muestra el promedio y la cantidad que configures en Configuración → Redes, mapa y reseñas.'));
    if (!S.d.reviews.length) S.el.view.append(h('div', { class: 'empty' }, 'Todavía no hay reseñas cargadas.'));
    S.d.reviews.forEach(r => S.el.view.append(h('article', { class: 'rev' + (r.visible ? '' : ' is-off') },
      h('div', { class: 'rev__top' },
        h('strong', {}, r.author),
        r.rating ? h('span', { class: 'rev__stars' }, '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating)) : null,
        r.source ? h('span', { class: 'pill pill--muted' }, r.source) : null,
        r.review_date ? h('span', { class: 'muted' }, r.review_date) : null,
        r.visible ? null : h('span', { class: 'pill pill--muted' }, 'Oculta'),
        h('span', { class: 'grow' }),
        h('button', { class: 'btn btn--ghost btn--sm', onclick: () => reviewModal(r) }, 'Editar')),
      h('p', {}, r.text))));
  };
  function reviewModal(r) {
    const isNew = !r;
    const cur = r || { author: '', rating: 5, text: '', review_date: '', source: 'Google', visible: 1, sort_order: (S.d.reviews.length + 1) * 10 };
    const author = inp({ value: cur.author, maxlength: 80 });
    const rating = sel([['', 'Sin puntuación'], [5, '5 estrellas'], [4, '4 estrellas'], [3, '3 estrellas'], [2, '2 estrellas'], [1, '1 estrella']], cur.rating ?? '');
    const text = area({ rows: 4, maxlength: 1200 }, cur.text);
    const date = inp({ value: cur.review_date, maxlength: 40, placeholder: 'Ej.: marzo 2026' });
    const source = inp({ value: cur.source, maxlength: 40, placeholder: 'Ej.: Google' });
    const visible = checkbox('Visible en la web', !!cur.visible);
    const order = inp({ type: 'number', value: cur.sort_order });
    const body = h('div', { class: 'form-grid' },
      field('Nombre de la clienta', author), field('Puntuación', rating),
      field('Texto de la reseña', text, null, 'span2'),
      field('Fecha (texto libre)', date), field('Fuente', source),
      field('Orden', order), fieldBox('Mostrar', visible.el));
    async function save() {
      const payload = { author: author.value, rating: rating.value ? Number(rating.value) : null, text: text.value, review_date: date.value, source: source.value, visible: visible.input.checked ? 1 : 0, sort_order: Number(order.value) || 0 };
      try {
        if (isNew) await api('/reviews', { method: 'POST', body: payload });
        else await api('/reviews/' + r.id, { method: 'PUT', body: payload });
        toast('Reseña guardada.'); m.close(); reload();
      } catch (e) { fail(e); }
    }
    async function remove() {
      if (!await confirmBox('¿Eliminar esta reseña?', { ok: 'Eliminar', danger: true })) return;
      try { await api('/reviews/' + r.id, { method: 'DELETE' }); toast('Reseña eliminada.'); m.close(); reload(); } catch (e) { fail(e); }
    }
    const m = modal({
      title: isNew ? 'Nueva reseña' : cur.author, body,
      footer: [r ? h('button', { class: 'btn btn--danger-ghost', type: 'button', onclick: remove }, I('trash'), 'Eliminar') : null,
        h('span', { class: 'grow' }), h('button', { class: 'btn btn--primary', type: 'button', onclick: save }, 'Guardar')]
    });
  }

  /* ============================ Vista: Configuración ============================ */
  const TEXT_HELP = 'Usá *asteriscos* para mostrar palabras en cursiva destacada.';
  const SETTINGS = [
    ['Datos del negocio', [
      ['business_name', 'Nombre'], ['address_street', 'Dirección'], ['address_city', 'Localidad'],
      ['address_region', 'Provincia'], ['address_postal', 'Código postal'],
      ['phone_display', 'Teléfono (como se muestra)'], ['phone_intl', 'Teléfono para llamar', 'Formato internacional, ej.: +541127786008'],
      ['email', 'Email', 'Opcional. Vacío = no se muestra.']
    ]],
    ['WhatsApp', [
      ['whatsapp_number', 'Número de WhatsApp', 'Solo números, formato internacional. Ej.: 5491127786008'],
      ['wa_default_message', 'Mensaje general', null, 'textarea'],
      ['wa_service_message', 'Mensaje desde un servicio', 'Usá {servicio} donde va el nombre del servicio.', 'textarea'],
      ['wa_color_message', 'Mensaje de "Consultar mi color"', null, 'textarea']
    ]],
    ['Instagram y ubicación', [
      ['__nota_mapa', 'Con la dirección que cargaste arriba se arman solos el botón "Cómo llegar", el mapa de la página de contacto y el enlace para ver las reseñas. La valoración que aparece en la web también la mantengo yo.', null, 'note'],
      ['instagram_url', 'Instagram (URL completa)', 'Ej.: https://www.instagram.com/usuario · Vacío = el ícono no se muestra.'],
      ['maps_url', 'Google Maps del salón (URL)', 'Buscá el salón en Google Maps, tocá Compartir y pegá el enlace. Vacío = se busca por la dirección.']
    ]],
    ['Imágenes principales', [
      ['logo_image', 'Logo', 'PNG o WEBP con fondo transparente. Vacío = logotipo tipográfico.', 'image'],
      ['hero_image', 'Foto de portada', 'Vertical (4:5). Ideal: un trabajo de color.', 'image'],
      ['about_image', 'Foto de "Sobre nosotros"', null, 'image']
    ]],
    ['Textos de la web', [
      ['hero_eyebrow', 'Portada: línea superior'], ['hero_title', 'Portada: título', TEXT_HELP],
      ['hero_subtitle', 'Portada: subtítulo', null, 'textarea'],
      ['about_title', 'Presentación: título', TEXT_HELP], ['about_text', 'Presentación: texto', null, 'textarea'],
      ['services_title', 'Servicios: título', TEXT_HELP], ['services_intro', 'Servicios: bajada'],
      ['color_title', 'Colorimetría: título', TEXT_HELP], ['color_text', 'Colorimetría: texto', null, 'textarea'],
      ['gallery_title', 'Galería: título', TEXT_HELP], ['gallery_intro', 'Galería: bajada'],
      ['reviews_title', 'Reseñas: título', TEXT_HELP],
      ['booking_title', 'Turnos: título', TEXT_HELP], ['booking_intro', 'Turnos: bajada'],
      ['contact_title', 'Contacto: título', TEXT_HELP], ['footer_tagline', 'Pie: frase']
    ]],
    ['Reservas online', [
      ['__nota_horarios', 'Los días y horarios que ve la clienta al reservar salen del horario del salón: se cambian en "Horarios y bloqueos". Ahí definís el horario semanal y podés cerrar o abrir franjas puntuales (feriados, vacaciones, un curso). Acá abajo se ajusta cómo se ofrecen esos horarios.', { route: '#/horarios', label: 'Ir a Horarios y bloqueos' }, 'note'],
      ['booking_enabled', 'Reservas online activas', 'Si lo desactivás, la web invita a reservar por WhatsApp.', 'bool'],
      ['booking_auto_confirm', 'Confirmar automáticamente', 'Desactivado: las reservas web quedan "Pendientes" hasta que las confirmes.', 'bool'],
      ['booking_allow_cancel', 'La clienta puede cancelar online', 'Desde el enlace de su reserva.', 'bool'],
      ['booking_slot_interval', 'Intervalo entre horarios', null, 'select', [['15', 'Cada 15 minutos'], ['30', 'Cada 30 minutos'], ['60', 'Cada 1 hora']]],
      ['booking_default_duration', 'Duración predeterminada (min)', 'Se usa en servicios sin duración cargada.', 'number'],
      ['booking_min_notice', 'Anticipación mínima (min)', 'Ej.: 60 = no se puede reservar para dentro de menos de una hora.', 'number'],
      ['booking_window_days', 'Se puede reservar hasta (días)', null, 'number'],
      ['booking_capacity', 'Turnos simultáneos sin profesionales', 'Solo se usa mientras un servicio no tenga profesionales asignadas.', 'number'],
      ['booking_notice', 'Aviso antes de confirmar', 'Opcional. Ej.: política de seña o cancelación, si el salón la define.', 'textarea']
    ]],
    ['SEO', [
      ['seo_title', 'Título de la página'], ['seo_description', 'Descripción', 'Hasta 160 caracteres.', 'textarea'],
      ['seo_keywords', 'Palabras clave', null, 'textarea'],
      ['site_url', 'Dirección del sitio', 'Ej.: https://www.femsalon.com.ar — se usa para el enlace canónico y el sitemap.']
    ]],
    ['Contenido de ejemplo', [
      ['show_placeholders', 'Mostrar imágenes y espacios de ejemplo', 'Desactivalo cuando cargues fotos y reseñas reales.', 'bool']
    ]]
  ];
  VIEWS.ajustes = function () {
    const s = S.d.settings;
    const getters = {};
    const save = h('button', {
      class: 'btn btn--primary', onclick: async () => {
        save.disabled = true;
        const body = {};
        for (const [k, g] of Object.entries(getters)) body[k] = g();
        try { const r = await api('/settings', { method: 'PUT', body }); S.d.settings = r.settings; toast('Configuración guardada.'); }
        catch (e) { fail(e); } finally { save.disabled = false; }
      }
    }, 'Guardar cambios');
    S.el.actions.append(save.cloneNode(true));
    S.el.actions.firstChild.addEventListener('click', () => save.click());
    S.el.view.append(h('div', { class: 'settings-nav' }, SETTINGS.map(([g]) => h('a', { href: '#g-' + g.replace(/\W+/g, '') }, g))));
    SETTINGS.forEach(([group, fields]) => {
      const box = h('div', { class: 'form-grid' });
      fields.forEach(([key, label, help, type, opts]) => {
        const val = s[key] ?? '';
        let el, get, cls = '';
        if (type === 'note') {
          box.append(h('p', { class: 'note note--info span2' }, label,
            help ? h('a', { class: 'btn btn--ghost btn--sm', href: help.route, style: { marginLeft: '10px' } }, help.label) : null));
          return;
        }
        if (type === 'bool') { const c = checkbox(label, val === '1'); el = c.el; get = () => (c.input.checked ? '1' : '0'); box.append(fieldBox('', el, help)); getters[key] = get; return; }
        if (type === 'image') {
          const f = imageField(val, { keepAlpha: key === 'logo_image' });
          box.append(fieldBox(label, f.el, help, 'span2'));
          getters[key] = () => f.get();
          return;
        }
        if (type === 'textarea') { el = area({ rows: 3, maxlength: 2000 }, val); cls = 'span2'; }
        else if (type === 'select') el = sel(opts, val);
        else if (type === 'number') el = inp({ type: 'number', value: val });
        else el = inp({ value: val, maxlength: 400 });
        get = () => el.value;
        getters[key] = get;
        box.append(field(label, el, help, cls));
      });
      S.el.view.append(h('section', { class: 'card', id: 'g-' + group.replace(/\W+/g, '') }, h('h2', {}, group), box));
    });
    S.el.view.append(h('div', { class: 'savebar' }, save));
  };

  /* ============================ Vista: Usuarios ============================ */
  VIEWS.usuarios = function () {
    const cur = inp({ type: 'password', autocomplete: 'current-password' });
    const nw = inp({ type: 'password', autocomplete: 'new-password' });
    const rp = inp({ type: 'password', autocomplete: 'new-password' });
    S.el.view.append(h('section', { class: 'card' },
      h('h2', {}, 'Mi contraseña'),
      h('p', { class: 'card__sub' }, `Sesión iniciada como ${S.user.username}.`),
      h('div', { class: 'form-grid--3' }, field('Contraseña actual', cur), field('Nueva contraseña', nw, 'Mínimo 8 caracteres.'), field('Repetir nueva', rp)),
      h('div', { style: { marginTop: '14px' } }, h('button', {
        class: 'btn btn--primary', onclick: async e => {
          if (nw.value !== rp.value) return toast('Las contraseñas nuevas no coinciden.', 'err');
          e.target.disabled = true;
          try { await api('/password', { method: 'POST', body: { current: cur.value, next: nw.value } }); toast('Contraseña actualizada.'); cur.value = nw.value = rp.value = ''; }
          catch (x) { fail(x); } finally { e.target.disabled = false; }
        }
      }, 'Cambiar contraseña'))));
    if (S.user.role !== 'admin') return;
    const box = h('div', {});
    S.el.view.append(h('section', { class: 'card' },
      h('div', { class: 'card__head' }, h('h2', {}, 'Usuarios del panel'),
        h('button', { class: 'btn btn--primary btn--sm', onclick: () => userModal() }, I('plus'), 'Nuevo usuario')),
      h('p', { class: 'card__sub' }, 'Rol "Administración": acceso total. Rol "Equipo": solo agenda, turnos y bloqueos.'),
      box));
    async function draw() {
      box.textContent = '';
      box.append(h('div', { class: 'loading' }, 'Cargando…'));
      try {
        const r = await api('/users');
        box.textContent = '';
        box.append(h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
          h('thead', {}, h('tr', {}, ['Usuario', 'Nombre', 'Rol', 'Estado', 'Último ingreso', ''].map(t => h('th', {}, t)))),
          h('tbody', {}, r.users.map(u => h('tr', {},
            h('td', { 'data-l': 'Usuario' }, u.username),
            h('td', { 'data-l': 'Nombre' }, u.name || '—'),
            h('td', { 'data-l': 'Rol' }, u.role === 'admin' ? 'Administración' : 'Equipo'),
            h('td', { 'data-l': 'Estado' }, h('span', { class: 'pill pill--' + (u.active ? 'confirmado' : 'muted') }, u.active ? 'Activo' : 'Inactivo')),
            h('td', { 'data-l': 'Ingreso' }, u.last_login_at ? fmtStamp(u.last_login_at) : '—'),
            h('td', {}, h('div', { class: 'row-actions' },
              h('button', { class: 'btn btn--text btn--sm', onclick: () => userModal(u, draw) }, 'Editar'),
              u.id === S.user.id ? null : h('button', {
                class: 'btn btn--text btn--sm', onclick: async () => {
                  if (!await confirmBox(`¿Eliminar al usuario "${u.username}"?`, { ok: 'Eliminar', danger: true })) return;
                  try { await api('/users/' + u.id, { method: 'DELETE' }); toast('Usuario eliminado.'); draw(); } catch (e) { fail(e); }
                }
              }, 'Eliminar')))))))));
      } catch (e) { box.textContent = ''; if (!e.silent) box.append(h('div', { class: 'empty' }, e.message)); }
    }
    function userModal(u, after) {
      const isNew = !u;
      const username = inp({ value: u ? u.username : '', maxlength: 40, disabled: !isNew });
      const name = inp({ value: u ? u.name : '', maxlength: 80 });
      const pass = inp({ type: 'password', autocomplete: 'new-password', placeholder: isNew ? 'Mínimo 8 caracteres' : 'Dejar vacío para no cambiarla' });
      const role = sel([['admin', 'Administración'], ['staff', 'Equipo']], u ? u.role : 'staff');
      const active = checkbox('Activo', u ? !!u.active : true);
      const m = modal({
        title: isNew ? 'Nuevo usuario' : u.username,
        body: h('div', { class: 'form-grid' },
          field('Usuario', username, isNew ? 'Letras, números, punto o guion.' : 'No se puede cambiar.'),
          field('Nombre', name), field('Contraseña', pass), field('Rol', role), fieldBox('Estado', active.el)),
        footer: [h('span', { class: 'grow' }), h('button', {
          class: 'btn btn--primary', onclick: async () => {
            try {
              if (isNew) await api('/users', { method: 'POST', body: { username: username.value, name: name.value, password: pass.value, role: role.value } });
              else await api('/users/' + u.id, { method: 'PUT', body: { name: name.value, role: role.value, active: active.input.checked, ...(pass.value ? { password: pass.value } : {}) } });
              toast('Usuario guardado.'); m.close(); (after || draw)();
            } catch (e) { fail(e); }
          }
        }, 'Guardar')]
      });
    }
    draw();
  };

  boot();
})();
