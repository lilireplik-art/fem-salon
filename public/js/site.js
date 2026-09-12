/* FEM salón — interacción del sitio público */
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = n => `<svg class="ic" aria-hidden="true" focusable="false"><use href="#i-${n}"/></svg>`;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('js');

  /* ---------- Header y menú ---------- */
  const header = $('#siteHeader');
  const nav = $('#siteNav');
  const burger = $('.burger');
  const onScroll = () => header && header.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  function setNav(open) {
    if (!nav || !burger) return;
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    document.body.classList.toggle('nav-open', open);
  }
  burger && burger.addEventListener('click', () => setNav(!nav.classList.contains('is-open')));
  nav && nav.addEventListener('click', e => { if (e.target.closest('a')) setNav(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav && nav.classList.contains('is-open')) setNav(false); });
  window.matchMedia('(min-width: 1180px)').addEventListener('change', e => { if (e.matches) setNav(false); });

  /* ---------- Aparición suave (solo lo que está fuera de pantalla al cargar) ---------- */
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target;
        if (el.classList.contains('stagger--pending')) {
          el.classList.remove('stagger--pending');
          el.classList.add('stagger--in');
        } else {
          el.classList.remove('reveal--pending');
          el.classList.add('reveal--in');
        }
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    const fuera = el => el.getBoundingClientRect().top > window.innerHeight * 0.92;
    $('.reveal').filter(fuera).forEach(el => { el.classList.add('reveal--pending'); io.observe(el); });
    $('.stagger').filter(fuera).forEach(el => {
      el.classList.add('stagger--pending');
      [...el.children].forEach((ch, i) => ch.style.setProperty('--d', Math.min(i, 8) * 70 + 'ms'));
      io.observe(el);
    });
  }

  /* ---------- Pestañas de servicios ---------- */
  const tabs = $$('.svc-tab');
  function selectTab(tab, focus) {
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) on ? panel.removeAttribute('data-inactive') : panel.setAttribute('data-inactive', '');
    });
    if (focus) tab.focus();
    tab.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  // Enlace directo a una categoría: /servicios#colorimetria
  if (tabs.length && location.hash) {
    const target = tabs.find(t => t.getAttribute('aria-controls') === 'panel-' + location.hash.slice(1));
    if (target) selectTab(target);
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', e => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) { e.preventDefault(); selectTab(tabs[(i + d + tabs.length) % tabs.length], true); }
    });
  });

  /* ---------- Galería + lightbox ---------- */
  const chips = $$('.gallery .chip');
  const items = $$('.g-item');
  const emptyMsg = $('.gallery .g-empty[hidden], .gallery .g-empty');
  chips.forEach(ch => ch.addEventListener('click', () => {
    const f = ch.dataset.filter;
    chips.forEach(c => { c.classList.toggle('is-active', c === ch); c.setAttribute('aria-pressed', String(c === ch)); });
    let shown = 0;
    items.forEach(it => { const on = f === 'all' || it.dataset.cat === f; it.hidden = !on; if (on) shown++; });
    if (emptyMsg && items.length) emptyMsg.hidden = shown > 0;
  }));

  const lb = $('#lightbox');
  if (lb && items.length) {
    const img = $('img', lb), cap = $('figcaption', lb);
    let list = [], idx = 0;
    const show = i => {
      idx = (i + list.length) % list.length;
      const b = list[idx];
      img.src = b.dataset.src;
      img.alt = b.dataset.caption || '';
      cap.textContent = b.dataset.caption || '';
    };
    const open = btn => {
      list = items.filter(it => !it.hidden).map(it => $('.g-item__btn', it));
      show(Math.max(0, list.indexOf(btn)));
      if (typeof lb.showModal === 'function') lb.showModal(); else lb.setAttribute('open', '');
      document.body.style.overflow = 'hidden';
    };
    const close = () => { if (lb.open) lb.close ? lb.close() : lb.removeAttribute('open'); };
    lb.addEventListener('close', () => { document.body.style.overflow = ''; });
    $$('.g-item__btn').forEach(b => b.addEventListener('click', () => open(b)));
    $('.lightbox__close', lb).addEventListener('click', close);
    $('.lightbox__prev', lb).addEventListener('click', () => show(idx - 1));
    $('.lightbox__next', lb).addEventListener('click', () => show(idx + 1));
    lb.addEventListener('click', e => { if (e.target === lb || e.target.classList.contains('lightbox__fig')) close(); });
    lb.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') show(idx + 1);
      if (e.key === 'ArrowLeft') show(idx - 1);
    });
    let x0 = null;
    lb.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 45) show(idx + (dx < 0 ? 1 : -1));
      x0 = null;
    });
  }

  /* ---------- Barra inferior móvil ---------- */
  const cta = $('#mobileCta');
  const bookingSection = $('#turnos');
  if (cta && bookingSection && 'IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => {
      cta.classList.toggle('is-hidden', en.isIntersecting);
      document.body.classList.toggle('cta-hidden', en.isIntersecting);
    }, { rootMargin: '0px 0px -30% 0px' }).observe(bookingSection);
  }

  /* ---------- Utilidades ---------- */
  async function api(url, opts = {}) {
    let res;
    try {
      res = await fetch(url, {
        method: opts.method || 'GET',
        headers: opts.body ? { 'Content-Type': 'application/json' } : {},
        body: opts.body ? JSON.stringify(opts.body) : undefined
      });
    } catch {
      throw Object.assign(new Error('No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.'), { data: {} });
    }
    let data = {};
    try { data = await res.json(); } catch { /* respuesta vacía */ }
    if (!res.ok) throw Object.assign(new Error(data.error || 'Ocurrió un error. Intentá de nuevo.'), { data, status: res.status });
    return data;
  }
  const dateLong = d => {
    const s = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const waHref = (num, text) => `https://wa.me/${num}?text=${encodeURIComponent(text)}`;

  /* ---------- Sistema de reservas ---------- */
  const bootEl = $('#bootData');
  const root = $('#booker');
  let booker = null;
  if (bootEl && root) {
    try { booker = Booker(root, JSON.parse(bootEl.textContent)); } catch (e) { console.error(e); }
  }
  // /turnos?servicio=3 abre el asistente con ese servicio ya elegido.
  if (booker) {
    const pre = Number(new URLSearchParams(location.search).get('servicio'));
    if (pre) booker.selectService(pre);
  }

  document.addEventListener('click', e => {
    const book = e.target.closest('[data-book]');
    if (book && booker && book.getAttribute('href') === '#turnos') setNav(false);
  });

  function Booker(root, B) {
    const STEPS = ['Servicio', 'Profesional', 'Fecha', 'Horario', 'Tus datos', 'Confirmación'];
    const st = {
      step: 1, serviceId: null, proId: 'any', date: null, time: null, cat: 'all', month: B.today.slice(0, 7),
      form: {}, fieldErrors: {}, error: '', info: '', result: null, months: {}, days: {}, errs: {}, pending: {}, submitting: false
    };
    const svc = () => B.services.find(s => s.id === st.serviceId);
    const pro = () => B.pros.find(p => p.id === st.proId);
    const eligible = () => B.pros.filter(p => p.services.includes(st.serviceId));
    const waGeneral = waHref(B.wa, B.waDefault);

    if (!B.enabled) {
      root.innerHTML = `<div class="booker__msg"><p>Las reservas online están momentáneamente pausadas.<br>Escribinos y coordinamos tu turno.</p>
        <a class="btn btn--wa" href="${esc(waGeneral)}" target="_blank" rel="noopener">${ic('wa')} Reservar por WhatsApp</a></div>`;
      return { selectService() {} };
    }
    if (!B.services.length) {
      root.innerHTML = `<div class="booker__msg"><p>Muy pronto vas a poder reservar online.</p>
        <a class="btn btn--wa" href="${esc(waGeneral)}" target="_blank" rel="noopener">${ic('wa')} Consultar por WhatsApp</a></div>`;
      return { selectService() {} };
    }

    root.innerHTML = '<aside class="booker__aside" aria-label="Resumen de tu reserva"></aside><div class="booker__main" tabindex="-1"></div>';
    const aside = $('.booker__aside', root);
    const main = $('.booker__main', root);

    const title = (t, sub) => `<h3 class="step-title" tabindex="-1">${t}</h3>${sub ? `<p class="step-sub">${sub}</p>` : ''}`;
    const monthKey = m => `${st.serviceId}|${st.proId}|${m}`;
    const dayKey = d => `${st.serviceId}|${st.proId}|${d}`;

    function renderAside() {
      const s = svc(), p = pro();
      const item = (label, val, step) => `<li><span class="summary__label">${label}</span>
        <span class="summary__val${val ? '' : ' is-empty'}">${val ? esc(val) : 'Sin elegir'}</span>
        ${val && st.step !== 6 && step < st.step ? `<button type="button" class="summary__edit" data-act="goto" data-v="${step}">Cambiar</button>` : ''}</li>`;
      aside.innerHTML = `<h3>Tu reserva</h3><ul class="summary">
        ${item('Servicio', s && s.name, 1)}
        ${item('Profesional', st.serviceId && st.step > 1 ? (p ? p.name : 'Sin preferencia') : '', 2)}
        ${item('Fecha', st.date ? dateLong(st.date) : '', 3)}
        ${item('Horario', st.time ? `${st.time} hs` : '', 4)}
      </ul><p class="booker__aside-foot">${ic('pin')}<span>${esc(B.business)}<br>${esc(B.address)}</span></p>`;
    }

    function head() {
      if (st.step === 6) return '';
      const s = svc(), p = pro();
      const mini = [s && s.name, st.step > 2 ? (p ? p.name : 'Sin preferencia') : '', st.date && st.step > 3 ? dateLong(st.date) : '', st.time && st.step > 4 ? `${st.time} hs` : ''].filter(Boolean);
      return `<ol class="steps" aria-hidden="true">${STEPS.map((_, i) => `<li class="${i + 1 < st.step ? 'is-done' : i + 1 === st.step ? 'is-current' : ''}"></li>`).join('')}</ol>
        <div class="step-label"><span>Paso ${st.step} de 6 · ${STEPS[st.step - 1]}</span>
        ${st.step > 1 ? `<button type="button" class="back-link" data-act="back">${ic('chev-l')} Volver</button>` : ''}</div>
        ${mini.length && st.step > 1 ? `<div class="mini-summary">${mini.map(m => `<span>${esc(m)}</span>`).join('')}</div>` : ''}`;
    }

    function stepService() {
      const cats = B.categories.filter(c => B.services.some(s => s.cat === c.id));
      const list = B.services.filter(s => st.cat === 'all' || s.cat === st.cat);
      const chip = (v, l) => `<button type="button" class="chip${String(st.cat) === String(v) ? ' is-active' : ''}" data-act="cat" data-v="${v}">${esc(l)}</button>`;
      return title('Elegí tu servicio', '¿Qué te gustaría hacerte?') +
        (cats.length > 1 ? `<div class="chips chips--tight">${chip('all', 'Todos')}${cats.map(c => chip(c.id, c.name)).join('')}</div>` : '') +
        `<div class="opts opts--2">${list.map(s => `<button type="button" class="opt${s.id === st.serviceId ? ' is-selected' : ''}" data-act="service" data-v="${s.id}">
          <span class="opt__thumb"><img src="${esc(s.img)}" alt="" loading="lazy"></span>
          <span class="opt__body"><span class="opt__name">${esc(s.name)}</span><span class="opt__meta">${esc([s.price, s.duration].filter(Boolean).join(' · '))}</span></span>
          <span class="opt__check">${ic('check')}</span></button>`).join('')}</div>`;
    }

    function stepPro() {
      const pros = eligible();
      const opt = (v, name, meta, thumb) => `<button type="button" class="opt${String(st.proId) === String(v) ? ' is-selected' : ''}" data-act="pro" data-v="${v}">
        <span class="opt__thumb">${thumb}</span><span class="opt__body"><span class="opt__name">${esc(name)}</span>${meta ? `<span class="opt__meta">${esc(meta)}</span>` : ''}</span>
        <span class="opt__check">${ic('check')}</span></button>`;
      return title('Elegí profesional', pros.length
        ? 'Podés elegir con quién atenderte o dejar que te asignemos una profesional disponible.'
        : 'Te asignamos una profesional disponible para tu servicio.') +
        `<div class="opts opts--2">${opt('any', 'Sin preferencia', 'Primera profesional disponible', ic('sparkle'))}
        ${pros.map(p => opt(p.id, p.name, p.role, p.photo ? `<img src="${esc(p.photo)}" alt="" loading="lazy">` : esc(p.name.trim().charAt(0).toUpperCase()))).join('')}</div>`;
    }

    function load(kind, key, url) {
      const store = kind === 'm' ? st.months : st.days;
      if (store[key] || st.pending[key] || st.errs[key]) return;
      st.pending[key] = true;
      api(url).then(r => { store[key] = kind === 'm' ? r.days : r.slots; })
        .catch(e => { st.errs[key] = e.message; })
        .finally(() => { delete st.pending[key]; render(false); });
    }
    const loadingBox = t => `<div class="loading" role="status">${t}</div>`;
    const errorBox = key => `<div class="empty-box"><p>${esc(st.errs[key])}</p><button type="button" class="btn btn--ghost btn--sm" data-act="retry" data-v="${esc(key)}">Reintentar</button></div>`;

    function stepDate() {
      const key = monthKey(st.month);
      const days = st.months[key];
      const intro = title('Elegí la fecha', 'Los días marcados tienen horarios disponibles.');
      if (st.errs[key]) return intro + errorBox(key);
      if (!days) {
        load('m', key, `/api/availability/month?service=${st.serviceId}&professional=${st.proId}&month=${st.month}`);
        return intro + loadingBox('Buscando días disponibles…');
      }
      const [y, m] = st.month.split('-').map(Number);
      const first = new Date(Date.UTC(y, m - 1, 1));
      const offset = (first.getUTCDay() + 6) % 7;
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const monthName = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);
      const canPrev = st.month > B.today.slice(0, 7);
      const canNext = st.month < B.maxDate.slice(0, 7);
      let cells = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map(d => `<span class="cal__dow">${d}</span>`).join('');
      cells += '<span></span>'.repeat(offset);
      for (let d = 1; d <= last; d++) {
        const date = `${st.month}-${String(d).padStart(2, '0')}`;
        const n = days[date] || 0;
        const cls = ['cal__day', n ? 'is-available' : '', date === B.today ? 'is-today' : '', date === st.date ? 'is-selected' : ''].filter(Boolean).join(' ');
        cells += `<button type="button" class="${cls}" data-act="day" data-v="${date}" ${n ? `aria-label="${esc(dateLong(date))}, ${n} horarios disponibles"` : 'disabled aria-disabled="true"'}>${d}</button>`;
      }
      const any = Object.values(days).some(n => n > 0);
      return intro + `<div class="cal">
        <div class="cal__head">
          <button type="button" class="cal__nav" data-act="month" data-v="-1" aria-label="Mes anterior" ${canPrev ? '' : 'disabled'}>${ic('chev-l')}</button>
          <p class="cal__title" aria-live="polite">${esc(monthName)}</p>
          <button type="button" class="cal__nav" data-act="month" data-v="1" aria-label="Mes siguiente" ${canNext ? '' : 'disabled'}>${ic('chev-r')}</button>
        </div>
        <div class="cal__grid">${cells}</div>
        <p class="cal__legend"><span><i></i>Con turnos disponibles</span></p>
        ${any ? '' : `<div class="empty-box"><p>No quedan turnos online disponibles este mes${canNext ? '. Probá con el mes siguiente' : ''}.</p>
          ${canNext ? `<button type="button" class="btn btn--ghost btn--sm" data-act="month" data-v="1">Ver mes siguiente</button>` : ''}
          <a class="btn btn--wa btn--sm" href="${esc(waHref(B.wa, B.waService.replace(/\{servicio\}/gi, svc().name)))}" target="_blank" rel="noopener">${ic('wa')} Consultar por WhatsApp</a></div>`}
      </div>`;
    }

    function stepTime() {
      const key = dayKey(st.date);
      const slots = st.days[key];
      const intro = title('Elegí el horario', esc(dateLong(st.date))) + (st.info ? `<p class="alert alert--info" role="alert">${esc(st.info)}</p>` : '');
      if (st.errs[key]) return intro + errorBox(key);
      if (!slots) {
        load('d', key, `/api/availability/day?service=${st.serviceId}&professional=${st.proId}&date=${st.date}`);
        return intro + loadingBox('Buscando horarios…');
      }
      if (!slots.length) {
        return intro + `<div class="empty-box"><p>Ya no quedan horarios disponibles para este día.</p>
          <button type="button" class="btn btn--ghost btn--sm" data-act="goto" data-v="3">Elegir otra fecha</button></div>`;
      }
      const groups = [['Mañana', t => t < '12:00'], ['Tarde', t => t >= '12:00' && t < '19:00'], ['Noche', t => t >= '19:00']];
      return intro + groups.map(([label, fn]) => {
        const list = slots.filter(fn);
        return list.length ? `<div class="slot-group"><h4>${label}</h4><div class="slots">${list.map(t =>
          `<button type="button" class="slot${t === st.time ? ' is-selected' : ''}" data-act="slot" data-v="${t}">${t}</button>`).join('')}</div></div>` : '';
      }).join('');
    }

    function field(name, label, type, auto, required, extra = '') {
      const err = st.fieldErrors[name];
      return `<div class="field${err ? ' has-error' : ''}">
        <label for="bk-${name}">${label}</label>
        <input id="bk-${name}" name="${name}" type="${type}" autocomplete="${auto}" ${required ? 'required' : ''} value="${esc(st.form[name] || '')}" ${extra} ${err ? `aria-invalid="true" aria-describedby="bk-${name}-err"` : ''}>
        ${err ? `<span class="field__err" id="bk-${name}-err">${esc(err)}</span>` : ''}
      </div>`;
    }
    function stepForm() {
      return title('Tus datos', 'Completá tus datos para confirmar la reserva.') + `<form class="form" novalidate data-form>
        <div class="form__row">${field('firstName', 'Nombre', 'text', 'given-name', true, 'maxlength="60"')}${field('lastName', 'Apellido', 'text', 'family-name', true, 'maxlength="60"')}</div>
        <div class="form__row">${field('phone', 'Teléfono', 'tel', 'tel', true, 'inputmode="tel" maxlength="30" placeholder="Ej.: 11 2345-6789"')}${field('email', 'Email <small>(opcional)</small>', 'email', 'email', false, 'maxlength="120"')}</div>
        <div class="field"><label for="bk-comment">Comentario <small>(opcional)</small></label>
          <textarea id="bk-comment" name="comment" maxlength="600" placeholder="Contanos cómo tenés tu cabello hoy o qué te gustaría lograr.">${esc(st.form.comment || '')}</textarea></div>
        <div class="hp" aria-hidden="true"><label>No completar este campo <input name="website" tabindex="-1" autocomplete="off"></label></div>
        ${B.notice ? `<p class="form__notice">${esc(B.notice)}</p>` : ''}
        ${st.error ? `<div class="alert" role="alert">${esc(st.error)}</div>` : ''}
        <div class="form__actions">
          <button type="button" class="back-link" data-act="goto" data-v="4">${ic('chev-l')} Cambiar horario</button>
          <button type="submit" class="btn btn--primary btn--lg" ${st.submitting ? 'disabled' : ''}>${st.submitting ? 'Reservando…' : 'Confirmar reserva'}</button>
        </div>
      </form>`;
    }

    function stepDone() {
      const r = st.result, a = r.appointment;
      const waText = `Hola ${B.business}, acabo de reservar un turno para ${a.service} el ${a.dateText} a las ${a.time} hs. Código: ${a.code}. Nombre: ${a.firstName} ${a.lastName}.`;
      const row = (k, v) => (v ? `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>` : '');
      return `<div class="done">
        <div class="done__icon">${ic('check')}</div>
        <h3 class="step-title" tabindex="-1">¡Tu turno fue reservado!</h3>
        <p class="step-sub">${a.status === 'confirmado' ? 'Tu reserva quedó <strong>confirmada</strong>.' : 'Tu reserva quedó registrada y figura como <strong>pendiente de confirmación</strong> por parte del salón.'}</p>
        <dl class="done__list">
          ${row('Servicio', a.service)}${row('Fecha', a.dateText)}${row('Horario', `${a.time} hs`)}
          ${row('Profesional', a.professional || 'A asignar por el salón')}${row('Nombre', `${a.firstName} ${a.lastName}`)}
          ${row('Teléfono', a.phone)}${row('Email', a.email)}${row('Código', a.code)}
        </dl>
        <div class="done__actions">
          <details class="dropdown"><summary class="btn btn--ghost">${ic('cal')} Agregar al calendario</summary>
            <div class="dropdown__menu"><a href="${esc(r.googleUrl)}" target="_blank" rel="noopener">Google Calendar</a><a href="${esc(r.icsUrl)}">Apple / Outlook (.ics)</a></div>
          </details>
          <a class="btn btn--wa" href="${esc(waHref(B.wa, waText))}" target="_blank" rel="noopener">${ic('wa')} Contactar por WhatsApp</a>
        </div>
        <p class="done__foot"><a href="${esc(r.manageUrl)}">Ver o cancelar mi turno</a> · <button type="button" class="linklike" data-act="restart">Reservar otro turno</button></p>
      </div>`;
    }

    const bodies = [null, stepService, stepPro, stepDate, stepTime, stepForm, stepDone];
    function render(focus = true) {
      renderAside();
      main.innerHTML = head() + bodies[st.step]();
      if (!reduceMotion) { main.classList.remove('is-anim'); void main.offsetWidth; main.classList.add('is-anim'); }
      if (focus) {
        const t = $('.step-title', main);
        if (t) t.focus({ preventScroll: true });
        const r = root.getBoundingClientRect();
        if (r.top < 0 || r.top > window.innerHeight * 0.6) root.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      }
    }
    function go(step) { st.step = step; st.error = ''; if (step !== 4) st.info = ''; render(); }

    function selectService(id) {
      if (!B.services.some(s => s.id === id)) return;
      if (st.serviceId !== id) { st.proId = 'any'; st.date = null; st.time = null; }
      st.serviceId = id;
      if (st.step === 6) { st.result = null; st.form = {}; }
      go(2);
    }

    root.addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      if (!el || !root.contains(el)) return;
      const v = el.dataset.v;
      switch (el.dataset.act) {
        case 'cat': st.cat = v === 'all' ? 'all' : Number(v); render(false); break;
        case 'service': selectService(Number(v)); break;
        case 'pro': {
          const next = v === 'any' ? 'any' : Number(v);
          if (next !== st.proId) { st.date = null; st.time = null; }
          st.proId = next; go(3); break;
        }
        case 'month': {
          const [y, m] = st.month.split('-').map(Number);
          const d = new Date(Date.UTC(y, m - 1 + Number(v), 1));
          st.month = d.toISOString().slice(0, 7); render(false); break;
        }
        case 'day': st.date = v; st.time = null; go(4); break;
        case 'slot': st.time = v; go(5); break;
        case 'goto': if (Number(v) < st.step) go(Number(v)); break;
        case 'back': if (st.step > 1) go(st.step - 1); break;
        case 'retry': delete st.errs[v]; render(false); break;
        case 'restart':
          Object.assign(st, { step: 1, serviceId: null, proId: 'any', date: null, time: null, result: null, form: {}, fieldErrors: {}, error: '', info: '' });
          render(); break;
      }
    });
    root.addEventListener('input', e => {
      if (e.target.name && e.target.closest('[data-form]') && e.target.name !== 'website') st.form[e.target.name] = e.target.value;
    });
    root.addEventListener('submit', async e => {
      const form = e.target.closest('[data-form]');
      if (!form) return;
      e.preventDefault();
      if (st.submitting) return;
      const data = Object.fromEntries(new FormData(form));
      Object.assign(st.form, { firstName: data.firstName, lastName: data.lastName, phone: data.phone, email: data.email, comment: data.comment });
      const errs = {};
      if (!String(data.firstName || '').trim()) errs.firstName = 'Ingresá tu nombre.';
      if (!String(data.lastName || '').trim()) errs.lastName = 'Ingresá tu apellido.';
      const digits = String(data.phone || '').replace(/\D/g, '');
      if (digits.length < 8 || digits.length > 15) errs.phone = 'Ingresá un teléfono válido, con código de área.';
      if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) errs.email = 'El email no parece válido.';
      st.fieldErrors = errs;
      st.error = '';
      if (Object.keys(errs).length) {
        render(false);
        const first = $('[aria-invalid="true"]', main);
        if (first) first.focus();
        return;
      }
      st.submitting = true; render(false);
      try {
        st.result = await api('/api/appointments', {
          method: 'POST',
          body: { serviceId: st.serviceId, professionalId: st.proId, date: st.date, time: st.time, ...data }
        });
        st.submitting = false; st.months = {}; st.days = {};
        go(6);
      } catch (err) {
        st.submitting = false;
        if (err.data && err.data.slotTaken) {
          delete st.days[dayKey(st.date)]; delete st.months[monthKey(st.date.slice(0, 7))];
          st.time = null; st.info = err.message; go(4);
        } else {
          st.fieldErrors = (err.data && err.data.errors) || {};
          st.error = err.message; render(false);
        }
      }
    });

    render(false);
    return { selectService };
  }

  /* ---------- Página "Tu turno": cancelar ---------- */
  const cancelBtn = $('[data-cancel-code]');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', async () => {
      if (!window.confirm('¿Querés cancelar tu turno? Esta acción no se puede deshacer.')) return;
      const msg = $('.ticket__msg');
      cancelBtn.disabled = true;
      try {
        await api(`/api/appointments/${encodeURIComponent(cancelBtn.dataset.cancelCode)}/cancel`, { method: 'POST', body: { token: cancelBtn.dataset.cancelToken } });
        msg.textContent = 'Tu turno fue cancelado.';
        setTimeout(() => window.location.reload(), 900);
      } catch (e) {
        msg.textContent = e.message;
        cancelBtn.disabled = false;
      }
    });
  }
})();
