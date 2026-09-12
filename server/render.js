'use strict';
const { db, getSettings } = require('./db');
const { esc, rich, priceInfo, durationText, waLink, WEEKDAYS, formatDateLong } = require('./util');
const { bookingWindow } = require('./availability');
const { canClientCancel, googleCalendarUrl } = require('./appointments');

const ASSET_V = Date.now().toString(36);

/* ---------- Páginas del sitio ---------- */
const PAGES = [
  { path: '/', key: 'inicio', label: 'Inicio' },
  { path: '/servicios', key: 'servicios', label: 'Servicios' },
  { path: '/colorimetria', key: 'colorimetria', label: 'Colorimetría' },
  { path: '/galeria', key: 'galeria', label: 'Galería' },
  { path: '/nosotros', key: 'nosotros', label: 'Sobre nosotros' },
  { path: '/turnos', key: 'turnos', label: 'Turnos' },
  { path: '/contacto', key: 'contacto', label: 'Contacto' }
];
const pageByKey = k => PAGES.find(p => p.key === k);

const GALLERY_CATS = [
  { key: 'balayage', label: 'Balayage' },
  { key: 'babylights', label: 'Babylights' },
  { key: 'color', label: 'Color' },
  { key: 'cortes', label: 'Cortes' },
  { key: 'tratamientos', label: 'Tratamientos' }
];
const PH_GALLERY = [
  ['balayage', 'balayage', 'Balayage'], ['babylights', 'babylights', 'Babylights'], ['color', 'tintura', 'Color'],
  ['cortes', 'cortes', 'Corte'], ['balayage', 'balayage-2', 'Balayage'], ['tratamientos', 'tratamientos', 'Tratamiento'],
  ['color', 'correccion', 'Corrección de color'], ['babylights', 'babylights-2', 'Babylights'], ['color', 'iluminaciones', 'Iluminación'],
  ['tratamientos', 'alisado', 'Alisado'], ['cortes', 'cortes-2', 'Corte'], ['balayage', 'balayage-3', 'Balayage']
];
const SWATCHES = [
  ['Balayage', 'balayage', 'balayage'], ['Babylights', 'babylights', 'babylights'],
  ['Iluminaciones', 'tecnicas-de-iluminacion', 'iluminaciones'], ['Correcciones de color', 'correccion-de-color', 'correccion'],
  ['Tinturas', 'tintura', 'tintura']
];
const CAT_ICONS = { colorimetria: 'drop', cortes: 'scissors', tratamientos: 'leaf' };
const STATUS_LABEL = { pendiente: 'Pendiente de confirmación', confirmado: 'Confirmado', completado: 'Completado', cancelado: 'Cancelado' };

/* ---------- Íconos (sprite SVG) ---------- */
const S = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
const SPRITE = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">
<symbol id="i-wa" viewBox="0 0 24 24"><path fill="currentColor" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35m-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.16-3.48-8.41"/></symbol>
<symbol id="i-ig" viewBox="0 0 24 24"><g ${S}><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/></g><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor"/></symbol>
<symbol id="i-pin" viewBox="0 0 24 24"><g ${S}><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></g></symbol>
<symbol id="i-phone" viewBox="0 0 24 24"><path ${S} d="M21 16.4v2.8a1.9 1.9 0 0 1-2.1 1.9 18.8 18.8 0 0 1-8.2-2.9 18.5 18.5 0 0 1-5.7-5.7A18.8 18.8 0 0 1 2.1 4.2 1.9 1.9 0 0 1 4 2.1h2.8a1.9 1.9 0 0 1 1.9 1.6c.12.9.34 1.8.66 2.7a1.9 1.9 0 0 1-.43 2L7.7 9.6a15.2 15.2 0 0 0 5.7 5.7l1.2-1.2a1.9 1.9 0 0 1 2-.43c.87.32 1.77.54 2.7.66a1.9 1.9 0 0 1 1.6 1.9z"/></symbol>
<symbol id="i-clock" viewBox="0 0 24 24"><g ${S}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></g></symbol>
<symbol id="i-star" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2.6l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2l-5.9 3.3 1.3-6.5-4.9-4.6 6.6-.8z"/></symbol>
<symbol id="i-cal" viewBox="0 0 24 24"><g ${S}><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></g></symbol>
<symbol id="i-arrow" viewBox="0 0 24 24"><path ${S} d="M5 12h14M13 6l6 6-6 6"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path ${S} d="M5 12.5l4.5 4.5L19 7.5"/></symbol>
<symbol id="i-scissors" viewBox="0 0 24 24"><g ${S}><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/></g></symbol>
<symbol id="i-drop" viewBox="0 0 24 24"><path ${S} d="M12 2.8c3.4 3.9 6 7.3 6 10.5a6 6 0 0 1-12 0c0-3.2 2.6-6.6 6-10.5z"/></symbol>
<symbol id="i-leaf" viewBox="0 0 24 24"><path ${S} d="M5 19c0-8 5.2-14 15-14 0 9.8-6 15-14 15M5 19l7.5-7.5"/></symbol>
<symbol id="i-sparkle" viewBox="0 0 24 24"><path ${S} d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></symbol>
<symbol id="i-user" viewBox="0 0 24 24"><g ${S}><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></g></symbol>
<symbol id="i-map" viewBox="0 0 24 24"><path ${S} d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4zM9 4v14M15 6v14"/></symbol>
<symbol id="i-chev-l" viewBox="0 0 24 24"><path ${S} d="M15 5l-7 7 7 7"/></symbol>
<symbol id="i-chev-r" viewBox="0 0 24 24"><path ${S} d="M9 5l7 7-7 7"/></symbol>
<symbol id="i-close" viewBox="0 0 24 24"><path ${S} d="M6 6l12 12M18 6 6 18"/></symbol>
</svg>`;
const icon = (id, cls = '') => `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true" focusable="false"><use href="#i-${id}"/></svg>`;

/* ---------- Datos ---------- */
function salonScheduleRows() {
  return db.prepare('SELECT weekday, start_time, end_time FROM schedules WHERE professional_id IS NULL ORDER BY weekday, start_time').all();
}
function hoursSummary(rows = salonScheduleRows()) {
  const byDay = Array.from({ length: 7 }, () => []);
  rows.forEach(r => byDay[r.weekday].push(`${r.start_time} a ${r.end_time}`));
  const txt = d => (byDay[d].length ? byDay[d].join(' y ') : 'Cerrado');
  const order = [1, 2, 3, 4, 5, 6, 0];
  if (order.every(d => txt(d) === txt(1))) return [{ days: 'Todos los días', hours: txt(1) }];
  const groups = [];
  for (const d of order) {
    const last = groups[groups.length - 1];
    if (last && last.hours === txt(d)) last.to = d; else groups.push({ from: d, to: d, hours: txt(d) });
  }
  return groups.map(g => ({ days: g.from === g.to ? WEEKDAYS[g.from] : `${WEEKDAYS[g.from]} a ${WEEKDAYS[g.to].toLowerCase()}`, hours: g.hours }));
}

function loadSite() {
  const s = getSettings();
  const cats = db.prepare('SELECT * FROM categories WHERE active = 1 ORDER BY sort_order, id').all();
  const services = db.prepare('SELECT * FROM services WHERE active = 1 ORDER BY sort_order, id').all();
  const pros = db.prepare('SELECT * FROM professionals WHERE active = 1 ORDER BY sort_order, id').all();
  const links = db.prepare('SELECT professional_id, service_id FROM professional_services').all();
  const gallery = db.prepare('SELECT * FROM gallery WHERE visible = 1 ORDER BY sort_order, id DESC').all();
  const reviews = db.prepare('SELECT * FROM reviews WHERE visible = 1 ORDER BY sort_order, id DESC').all();
  const scheduleRows = salonScheduleRows();
  const groups = cats.map(c => ({ ...c, services: services.filter(x => x.category_id === c.id) })).filter(g => g.services.length);
  const orphans = services.filter(x => !groups.some(g => g.id === x.category_id));
  if (orphans.length) groups.push({ id: 0, slug: 'otros', name: 'Otros servicios', subtitle: '', description: '', services: orphans });
  return { s, cats, services, groups, pros, links, gallery, reviews, scheduleRows, hours: hoursSummary(scheduleRows) };
}

const imgOf = (url, art) => url || `/art/${art || 'balayage'}.svg`;
const waMsg = (s, service) => (service ? s.wa_service_message.replace(/\{servicio\}/gi, service) : s.wa_default_message);
const wa = (s, service) => waLink(s.whatsapp_number, waMsg(s, service));
const ph = s => s.show_placeholders === '1';
const safeUrl = u => (/^https?:\/\//i.test(String(u || '')) ? u : '');
const bookHref = id => (id ? `/turnos?servicio=${id}` : '/turnos');

// A partir de la dirección se arman solos: ficha, "Cómo llegar", mapa incrustado y reseñas.
function mapLinks(s) {
  const address = [s.address_street, [s.address_postal, s.address_city].filter(Boolean).join(' '), s.address_region, 'Argentina']
    .filter(Boolean).join(', ');
  const q = encodeURIComponent(address);
  const place = safeUrl(s.maps_url) || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.business_name}, ${address}`)}`;
  return { place, reviews: place, directions: `https://www.google.com/maps/dir/?api=1&destination=${q}`, embed: `https://www.google.com/maps?q=${q}&output=embed` };
}

function logo(s) {
  if (s.logo_image) return `<img class="logo__img" src="${esc(s.logo_image)}" alt="${esc(s.business_name)}" height="40">`;
  return `<span class="logo__word" aria-hidden="true"><span class="logo__fem">FEM</span><span class="logo__salon">SALÓN</span></span><span class="sr-only">${esc(s.business_name)}</span>`;
}
function stars(value) {
  const n = parseFloat(String(value).replace(',', '.')) || 0;
  const pct = Math.max(0, Math.min(100, (n / 5) * 100));
  const row = icon('star').repeat(5);
  return `<span class="stars" role="img" aria-label="${esc(String(value))} de 5 estrellas"><span class="stars__base">${row}</span><span class="stars__fill" style="width:${pct.toFixed(1)}%">${row}</span></span>`;
}

/* ---------- Estructura ---------- */
function head({ s, origin, path, title, description, noindex = false, jsonld = '' }) {
  const og = s.hero_image ? (s.hero_image.startsWith('http') ? s.hero_image : origin + s.hero_image) : '';
  return `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex, nofollow">' : `<meta name="keywords" content="${esc(s.seo_keywords)}">
<link rel="canonical" href="${esc(origin + path)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_AR">
<meta property="og:site_name" content="${esc(s.business_name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(origin + path)}">
${og ? `<meta property="og:image" content="${esc(og)}">\n<meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'}
<meta name="geo.region" content="AR-B">
<meta name="geo.placename" content="${esc(s.address_city)}">`}
<meta name="theme-color" content="#FBF8F6">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Jost:wght@300;400;500;600&display=swap">
<link rel="stylesheet" href="/css/site.css?v=${ASSET_V}">
${jsonld ? `<script type="application/ld+json">${jsonld}</script>` : ''}
</head>`;
}

function jsonLd(d, origin) {
  const { s } = d;
  const byRange = new Map();
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (const r of d.scheduleRows) {
    const k = `${r.start_time}-${r.end_time}`;
    if (!byRange.has(k)) byRange.set(k, { '@type': 'OpeningHoursSpecification', dayOfWeek: [], opens: r.start_time, closes: r.end_time === '24:00' ? '23:59' : r.end_time });
    byRange.get(k).dayOfWeek.push(DAYS[r.weekday]);
  }
  const data = {
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    name: s.business_name,
    url: origin + '/',
    telephone: s.phone_intl,
    address: {
      '@type': 'PostalAddress', streetAddress: s.address_street, addressLocality: s.address_city,
      postalCode: s.address_postal, addressRegion: s.address_region, addressCountry: 'AR'
    },
    openingHoursSpecification: [...byRange.values()],
    hasMap: mapLinks(s).place,
    image: s.hero_image ? (s.hero_image.startsWith('http') ? s.hero_image : origin + s.hero_image) : undefined,
    sameAs: safeUrl(s.instagram_url) ? [s.instagram_url] : undefined,
    areaServed: s.address_city,
    makesOffer: d.services.slice(0, 20).map(x => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: x.name } }))
  };
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function header(s, current) {
  return `<a class="skip-link" href="#main">Saltar al contenido</a>
<header class="site-header" id="siteHeader">
  <div class="container site-header__bar">
    <a class="logo" href="/">${logo(s)}</a>
    <nav class="nav" id="siteNav" aria-label="Principal">
      <ul class="nav__list">
        ${PAGES.map(p => `<li><a class="nav__link${p.key === current ? ' is-active' : ''}" href="${p.path}"${p.key === current ? ' aria-current="page"' : ''}>${p.label}</a></li>`).join('')}
      </ul>
      <div class="nav__extra">
        <a class="btn btn--primary btn--block" href="/turnos">Reservar turno</a>
        <a class="btn btn--wa btn--block" href="${esc(wa(s))}" target="_blank" rel="noopener">${icon('wa')} Escribinos por WhatsApp</a>
        <p class="nav__contact">${esc(s.address_street)}, ${esc(s.address_city)}<br><a href="tel:${esc(s.phone_intl)}">${esc(s.phone_display)}</a></p>
      </div>
    </nav>
    <div class="site-header__actions">
      <a class="icon-btn icon-btn--wa" href="${esc(wa(s))}" target="_blank" rel="noopener" aria-label="Escribinos por WhatsApp">${icon('wa')}</a>
      <a class="icon-btn icon-btn--book" href="/turnos" aria-label="Reservar turno" title="Reservar turno">${icon('cal')}</a>
      <a class="btn btn--primary btn--sm site-header__cta" href="/turnos">Reservar turno</a>
      <button class="burger" type="button" aria-expanded="false" aria-controls="siteNav" aria-label="Abrir menú"><span></span><span></span><span></span></button>
    </div>
  </div>
</header>`;
}

function pageHead({ key, eyebrow, title, lead }) {
  const p = pageByKey(key);
  return `<header class="page-head">
  <div class="container">
    <nav class="crumbs" aria-label="Ubicación"><a href="/">Inicio</a><span aria-hidden="true">/</span><span>${esc(p.label)}</span></nav>
    ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
    <h1 class="h1">${rich(title)}</h1>
    ${lead ? `<p class="lead">${esc(lead)}</p>` : ''}
  </div>
</header>`;
}

function ctaBand(s, { title = 'Reservá *tu turno*', text = s.booking_intro } = {}) {
  return `<section class="cta-band">
  <div class="container cta-band__inner">
    <div>
      <h2 class="h2">${rich(title)}</h2>
      ${text ? `<p>${esc(text)}</p>` : ''}
    </div>
    <div class="cta-band__actions">
      <a class="btn btn--primary btn--lg" href="/turnos">Reservar turno ${icon('arrow')}</a>
      <a class="btn btn--outline-light" href="${esc(wa(s))}" target="_blank" rel="noopener">${icon('wa')} WhatsApp</a>
    </div>
  </div>
</section>`;
}

function footer(s, hours) {
  return `<footer class="site-footer">
  <div class="container site-footer__grid">
    <div class="site-footer__brand">
      <a class="logo logo--light" href="/">${logo(s)}</a>
      <p>${esc(s.footer_tagline)}</p>
      <div class="social">
        ${safeUrl(s.instagram_url) ? `<a href="${esc(s.instagram_url)}" target="_blank" rel="noopener" aria-label="Instagram">${icon('ig')}</a>` : ''}
        <a href="${esc(wa(s))}" target="_blank" rel="noopener" aria-label="WhatsApp">${icon('wa')}</a>
        ${`<a href="${esc(mapLinks(s).place)}" target="_blank" rel="noopener" aria-label="Google Maps">${icon('pin')}</a>`}
      </div>
    </div>
    <div>
      <h3>Visitanos</h3>
      <p>${esc(s.business_name)}<br>${esc(s.address_street)}<br>${esc(s.address_city)}, Buenos Aires</p>
      <p><a href="tel:${esc(s.phone_intl)}">${esc(s.phone_display)}</a></p>
    </div>
    <div>
      <h3>Horario</h3>
      ${hours.map(h => `<p>${esc(h.days)} de ${esc(h.hours)}</p>`).join('')}
    </div>
    <nav aria-label="Enlaces del pie">
      <h3>Secciones</h3>
      <ul>${PAGES.map(p => `<li><a href="${p.path}">${p.label}</a></li>`).join('')}</ul>
    </nav>
  </div>
  <div class="container site-footer__bottom">
    <p>© ${new Date().getFullYear()} ${esc(s.business_name)} · ${esc(s.address_city)}, Buenos Aires</p>
    <a href="/turnos">Reservar turno ${icon('arrow')}</a>
  </div>
</footer>`;
}

function floating(s) {
  return `<a class="wa-float" href="${esc(wa(s))}" target="_blank" rel="noopener" aria-label="Escribinos por WhatsApp">${icon('wa')}</a>
<div class="mobile-cta" id="mobileCta"><a class="btn btn--primary btn--block" href="/turnos">${icon('cal')} Reservar turno</a></div>
<dialog class="lightbox" id="lightbox" aria-label="Imagen ampliada">
  <button type="button" class="lightbox__close" aria-label="Cerrar">${icon('close')}</button>
  <button type="button" class="lightbox__nav lightbox__prev" aria-label="Imagen anterior">${icon('chev-l')}</button>
  <figure class="lightbox__fig"><img alt=""><figcaption></figcaption></figure>
  <button type="button" class="lightbox__nav lightbox__next" aria-label="Imagen siguiente">${icon('chev-r')}</button>
</dialog>`;
}

function layout(d, { key, title, description, body, jsonld = '', origin = '' }) {
  const { s } = d;
  const p = pageByKey(key);
  return `${head({ s, origin, path: p.path, title, description, jsonld })}
<body class="page page--${key}">
${SPRITE}
${header(s, key)}
<main id="main">
${body}
</main>
${footer(s, d.hours)}
${floating(s)}
<script src="/js/site.js?v=${ASSET_V}" defer></script>
</body>
</html>`;
}

/* ---------- Bloques reutilizables ---------- */
function hero(d) {
  const { s } = d;
  const h = d.hours[0];
  return `<section class="hero">
  <div class="container hero__grid">
    <div class="hero__copy">
      <h1 class="hero__title"><span class="eyebrow">${esc(s.hero_eyebrow)}</span>${rich(s.hero_title)}</h1>
      <p class="hero__lead">${esc(s.hero_subtitle)}</p>
      <div class="hero__actions">
        <a class="btn btn--primary btn--lg" href="/turnos">Reservar turno ${icon('arrow')}</a>
        <a class="btn btn--ghost btn--lg" href="/servicios">Ver servicios</a>
      </div>
      <ul class="hero__facts">
        ${s.rating_value ? `<li>${stars(s.rating_value)}<span><strong>${esc(s.rating_value)}</strong>${s.rating_count ? ` · más de ${esc(s.rating_count)} reseñas${s.rating_source ? ` en ${esc(s.rating_source)}` : ''}` : ''}</span></li>` : ''}
        <li>${icon('pin')}<span>${esc(s.address_street)}, ${esc(s.address_city)}</span></li>
        ${h ? `<li>${icon('clock')}<span>${esc(h.days)} · ${esc(h.hours)}</span></li>` : ''}
      </ul>
    </div>
    <div class="hero__media">
      <div class="hero__arch">
        <img src="${esc(imgOf(s.hero_image, 'hero'))}" alt="${s.hero_image ? `Trabajo de color en ${esc(s.business_name)}` : 'Ilustración de cabello con técnica de balayage'}" width="800" height="1000" fetchpriority="high">
        ${!s.hero_image && ph(s) ? '<span class="ph-tag">Imagen de ejemplo</span>' : ''}
      </div>
      <div class="hero__card">
        <span class="hero__card-kicker">Colorimetría</span>
        <span class="hero__card-list">Balayage · Babylights · Tinturas</span>
      </div>
      <span class="hero__ring" aria-hidden="true"></span>
    </div>
  </div>
</section>`;
}

function aboutBlock(d, { full = false } = {}) {
  const { s } = d;
  return `<section class="section about">
  <div class="container about__grid">
    <figure class="about__media reveal">
      <img src="${esc(imgOf(s.about_image, 'about'))}" alt="${s.about_image ? `Interior de ${esc(s.business_name)}` : 'Ilustración de cabello'}" loading="lazy" decoding="async" width="800" height="1000">
      ${!s.about_image && ph(s) ? '<span class="ph-tag">Imagen de ejemplo</span>' : ''}
    </figure>
    <div class="about__copy reveal">
      ${full ? '' : '<p class="eyebrow">Sobre nosotros</p>'}
      <h2 class="h2">${rich(s.about_title)}</h2>
      <p class="lead">${esc(s.about_text)}</p>
      <ul class="pillars stagger">
        <li>${icon('drop')}<div><h3>Colorimetría</h3><p>Balayage, babylights, tinturas y correcciones de color.</p></div></li>
        <li>${icon('user')}<div><h3>Atención personalizada</h3><p>Cada servicio pensado según tu cabello y lo que querés lograr.</p></div></li>
        <li>${icon('sparkle')}<div><h3>Cuidado del cabello</h3><p>Cortes, alisados, nutriciones y tratamientos capilares.</p></div></li>
      </ul>
      ${full ? '' : '<p class="block-more"><a class="btn btn--ghost" href="/nosotros">Conocé el salón ' + icon('arrow') + '</a></p>'}
    </div>
  </div>
</section>`;
}

function teamBlock(d) {
  const team = d.pros.filter(p => p.show_on_site);
  if (!team.length) return '';
  return `<section class="section team-section">
  <div class="container">
    <header class="section-head"><p class="eyebrow">Equipo</p><h2 class="h2">Quiénes te atienden</h2></header>
    <ul class="team__grid stagger">${team.map(p => `<li class="team__card">
      <div class="team__photo">${p.photo ? `<img src="${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy">` : `<span>${esc(p.name.trim().charAt(0).toUpperCase())}</span>`}</div>
      <p class="team__name">${esc(p.name)}</p>${p.role ? `<p class="team__role">${esc(p.role)}</p>` : ''}
      ${p.bio ? `<p class="team__bio">${esc(p.bio)}</p>` : ''}
    </li>`).join('')}</ul>
  </div>
</section>`;
}

function serviceCard(x, s) {
  const pi = priceInfo(x);
  const priceHtml = pi.kind === 'options'
    ? `<ul class="price-list">${pi.options.map(o => `<li><span>${esc(o.label)}</span><strong>${esc(o.text)}</strong></li>`).join('')}</ul>`
    : `<strong>${esc(pi.kind === 'consult' ? 'Consultar' : pi.text)}</strong>`;
  return `<article class="svc-card">
    <div class="svc-card__media"><img src="${esc(imgOf(x.image, x.art))}" alt="${x.image ? esc(x.name) : `Ilustración: ${esc(x.name)}`}" loading="lazy" decoding="async" width="800" height="1000"></div>
    <div class="svc-card__body">
      <h4 class="svc-card__name">${esc(x.name)}</h4>
      ${x.description ? `<p class="svc-card__desc">${esc(x.description)}</p>` : ''}
      <dl class="svc-card__meta${pi.kind === 'options' ? ' has-options' : ''}">
        <div class="svc-card__price"><dt>Precio</dt><dd>${priceHtml}</dd></div>
        <div><dt>Duración</dt><dd><strong>${esc(durationText(x))}</strong></dd></div>
      </dl>
      <div class="svc-card__actions">
        ${x.bookable ? `<a class="btn btn--primary btn--sm" href="${bookHref(x.id)}">Reservar</a>` : ''}
        <a class="btn btn--text btn--sm" href="${esc(wa(s, x.name))}" target="_blank" rel="noopener">${icon('wa')} Consultar</a>
      </div>
    </div>
  </article>`;
}

function servicesFull(d) {
  const { s, groups } = d;
  return `<section class="section services">
  <div class="container">
    <div class="svc-tabs" role="tablist" aria-label="Categorías de servicios">
      ${groups.map((g, i) => `<button class="svc-tab" type="button" role="tab" id="tab-${esc(g.slug)}" aria-controls="panel-${esc(g.slug)}" aria-selected="${i ? 'false' : 'true'}" tabindex="${i ? -1 : 0}">${icon(CAT_ICONS[g.slug] || 'sparkle')}<span>${esc(g.name)}</span></button>`).join('')}
    </div>
    ${groups.map((g, i) => `<div class="svc-panel" role="tabpanel" id="panel-${esc(g.slug)}" aria-labelledby="tab-${esc(g.slug)}"${i ? ' data-inactive' : ''}>
      <div class="svc-panel__intro">
        <h3 class="svc-panel__title">${esc(g.name)}${g.subtitle ? ` <span>${esc(g.subtitle)}</span>` : ''}</h3>
        ${g.description ? `<p>${esc(g.description)}</p>` : ''}
      </div>
      <div class="svc-grid stagger">${g.services.map(x => serviceCard(x, s)).join('')}</div>
    </div>`).join('')}
    <p class="services__note">¿No encontrás lo que buscás? <a href="${esc(wa(s))}" target="_blank" rel="noopener">Escribinos por WhatsApp</a> y te asesoramos.</p>
  </div>
</section>`;
}

function categoriesGrid(d) {
  const { s, groups } = d;
  return `<section class="section cats">
  <div class="container">
    <header class="section-head section-head--row reveal">
      <div>
        <p class="eyebrow">Servicios</p>
        <h2 class="h2">${rich(s.services_title)}</h2>
      </div>
      <p class="section-head__text">${esc(s.services_intro)}</p>
    </header>
    <ul class="cat-grid stagger">
      ${groups.map(g => `<li class="cat-card">
        <a href="/servicios#${esc(g.slug)}">
          <span class="cat-card__img"><img src="${esc(imgOf(g.image, g.art))}" alt="" loading="lazy" decoding="async" width="800" height="1000"></span>
          <span class="cat-card__body">
            <span class="cat-card__name">${esc(g.name)}</span>
            <span class="cat-card__list">${esc(g.services.slice(0, 4).map(x => x.name).join(' · '))}</span>
            <span class="cat-card__cta">Ver servicios ${icon('arrow')}</span>
          </span>
        </a>
      </li>`).join('')}
    </ul>
  </div>
</section>`;
}

function colorBlock(d, { full = false } = {}) {
  const { s, services: all } = d;
  const bySlug = Object.fromEntries(all.map(x => [x.slug, x]));
  return `<section class="section color">
  <div class="container">
    <div class="color__head reveal">
      <div>
        <p class="eyebrow eyebrow--light">Colorimetría</p>
        <h2 class="h2">${rich(s.color_title)}</h2>
      </div>
      <div class="color__side">
        <p class="lead">${esc(s.color_text)}</p>
        <div class="color__actions">
          <a class="btn btn--light" href="${esc(waLink(s.whatsapp_number, s.wa_color_message))}" target="_blank" rel="noopener">${icon('wa')} Consultar mi color</a>
          ${full ? `<a class="btn btn--outline-light" href="/turnos">Reservar turno</a>` : `<a class="btn btn--outline-light" href="/colorimetria">Ver colorimetría</a>`}
        </div>
      </div>
    </div>
    <ul class="swatches stagger">
      ${SWATCHES.map(([label, slug, art], i) => {
        const svc = bySlug[slug];
        const img = imgOf(svc && svc.image, art);
        const inner = `<span class="swatch__img"><img src="${esc(img)}" alt="" loading="lazy" decoding="async" width="800" height="1000"></span>
          <span class="swatch__num">0${i + 1}</span><span class="swatch__name">${esc(label)}</span>`;
        return `<li class="swatch">${svc && svc.bookable
          ? `<a href="${bookHref(svc.id)}" aria-label="Reservar ${esc(svc.name)}">${inner}<span class="swatch__cta">Reservar ${icon('arrow')}</span></a>`
          : `<div>${inner}</div>`}</li>`;
      }).join('')}
    </ul>
  </div>
</section>`;
}

function galleryBlock(d, { filters = true, limit = 0 } = {}) {
  const { s } = d;
  let items = d.gallery.map(g => ({ cat: g.category, img: g.image, caption: g.caption, ph: false }));
  const usingPh = !items.length && ph(s);
  if (usingPh) items = PH_GALLERY.map(([cat, art, caption]) => ({ cat, img: `/art/${art}.svg`, caption, ph: true }));
  if (limit) items = items.slice(0, limit);
  const label = k => (GALLERY_CATS.find(c => c.key === k) || {}).label || k;
  return `<section class="section gallery">
  <div class="container">
    <header class="section-head section-head--row reveal">
      <div>
        <p class="eyebrow">Galería</p>
        <h2 class="h2">${rich(s.gallery_title)}</h2>
      </div>
      ${s.gallery_intro ? `<p class="section-head__text">${esc(s.gallery_intro)}</p>` : ''}
    </header>
    ${items.length ? `${filters ? `<div class="chips" role="group" aria-label="Filtrar trabajos">
      <button type="button" class="chip is-active" data-filter="all" aria-pressed="true">Todos</button>
      ${GALLERY_CATS.map(c => `<button type="button" class="chip" data-filter="${c.key}" aria-pressed="false">${esc(c.label)}</button>`).join('')}
    </div>` : ''}
    ${usingPh && filters ? '<p class="ph-note">Imágenes de ejemplo: se reemplazarán por fotos reales de trabajos de FEM salón.</p>' : ''}
    <ul class="g-grid stagger">
      ${items.map((it, i) => `<li class="g-item" data-cat="${esc(it.cat)}">
        <button type="button" class="g-item__btn" data-lightbox="${i}" data-src="${esc(it.img)}" data-caption="${esc(it.caption || label(it.cat))}${it.ph ? ' — Imagen de ejemplo' : ''}" aria-label="Ampliar imagen: ${esc(it.caption || label(it.cat))}">
          <img src="${esc(it.img)}" alt="${esc(it.caption || label(it.cat))}${it.ph ? ' (imagen de ejemplo)' : ''}" loading="lazy" decoding="async" width="800" height="1000">
          ${it.ph ? '<span class="ph-tag">Imagen de ejemplo</span>' : ''}
          <span class="g-item__cap">${esc(it.caption || label(it.cat))}</span>
        </button>
      </li>`).join('')}
    </ul>
    ${filters ? '<p class="g-empty" hidden>Todavía no hay trabajos cargados en esta categoría.</p>' : `<p class="block-more"><a class="btn btn--ghost" href="/galeria">Ver la galería completa ${icon('arrow')}</a></p>`}` : '<p class="g-empty">Muy pronto vas a ver acá nuestros trabajos.</p>'}
    ${filters && safeUrl(s.instagram_url) ? `<p class="gallery__more"><a class="btn btn--ghost" href="${esc(s.instagram_url)}" target="_blank" rel="noopener">${icon('ig')} Ver más en Instagram</a></p>` : ''}
  </div>
</section>`;
}

function reviewsBlock(d, { limit = 0 } = {}) {
  const { s } = d;
  const list = limit ? d.reviews.slice(0, limit) : d.reviews;
  const cards = list.length
    ? list.map(r => `<figure class="review">
        ${r.rating ? stars(r.rating) : ''}
        <blockquote>${esc(r.text)}</blockquote>
        <figcaption><strong>${esc(r.author)}</strong>${r.source || r.review_date ? `<span>${esc([r.source, r.review_date].filter(Boolean).join(' · '))}</span>` : ''}</figcaption>
      </figure>`).join('')
    : (ph(s) ? [1, 2].map(() => `<figure class="review review--ph">
        <span class="review__ph-icon">${icon('star')}</span>
        <p>Espacio reservado para una reseña real de una clienta.</p>
        <span class="ph-tag ph-tag--inline">Se carga desde el panel</span>
      </figure>`).join('') : '');
  return `<section class="section reviews">
  <div class="container reviews__grid">
    <div class="reviews__summary reveal">
      <p class="eyebrow">Reseñas</p>
      <h2 class="h2">${rich(s.reviews_title)}</h2>
      ${s.rating_value ? `<div class="rating">
        <span class="rating__value">${esc(s.rating_value)}</span>
        <div>${stars(s.rating_value)}<p class="rating__count">${s.rating_count ? `Más de ${esc(s.rating_count)} reseñas` : 'Valoración'}${s.rating_source ? ` en ${esc(s.rating_source)}` : ''}</p></div>
      </div>` : ''}
      ${`<a class="btn btn--ghost" href="${esc(mapLinks(s).reviews)}" target="_blank" rel="noopener">Ver reseñas${s.rating_source ? ` en ${esc(s.rating_source)}` : ''} ${icon('arrow')}</a>`}
    </div>
    ${cards ? `<div class="reviews__list stagger">${cards}</div>` : ''}
  </div>
</section>`;
}

function bookingBlock(d) {
  const { s } = d;
  const win = bookingWindow();
  const bookable = d.groups.flatMap(g => g.services).filter(x => x.bookable);
  const proServices = id => d.links.filter(l => l.professional_id === id).map(l => l.service_id);
  const boot = {
    services: bookable.map(x => {
      const pi = priceInfo(x);
      return { id: x.id, name: x.name, cat: x.category_id || 0, price: pi.kind === 'consult' ? 'Consultar precio' : pi.short, duration: x.duration_min ? durationText(x) : '', img: imgOf(x.image, x.art) };
    }),
    categories: d.groups.map(g => ({ id: g.id, name: g.name, subtitle: g.subtitle })),
    pros: d.pros.map(p => ({ id: p.id, name: p.name, role: p.role, photo: p.photo, services: proServices(p.id) })),
    wa: String(s.whatsapp_number).replace(/\D/g, ''), waDefault: s.wa_default_message, waService: s.wa_service_message,
    business: s.business_name, address: `${s.address_street}, ${s.address_city}`,
    today: win.today, maxDate: win.maxDate, enabled: s.booking_enabled === '1', notice: s.booking_notice,
    autoConfirm: s.booking_auto_confirm === '1'
  };
  return `<section class="section booking" id="turnos">
  <div class="container">
    <div class="booker" id="booker">
      <div class="booker__loading">Cargando turnos disponibles…</div>
    </div>
    <noscript><p class="booker-noscript">Para reservar online necesitás tener JavaScript activado. También podés <a href="${esc(wa(s))}">escribirnos por WhatsApp</a>.</p></noscript>
    <p class="booking__help">¿Preferís coordinar por mensaje? <a href="${esc(wa(s))}" target="_blank" rel="noopener">${icon('wa')} Escribinos por WhatsApp</a></p>
  </div>
  <script type="application/json" id="bootData">${JSON.stringify(boot).replace(/</g, '\\u003c')}</script>
</section>`;
}

function contactBlock(d, { map = true } = {}) {
  const { s } = d;
  return `<section class="section contact">
  <div class="container contact__grid">
    <div class="contact__info reveal">
      <ul class="contact__list">
        <li>${icon('pin')}<div><h3>Dirección</h3><p>${esc(s.address_street)}<br>${esc(s.address_city)}, Buenos Aires</p></div></li>
        <li>${icon('phone')}<div><h3>Teléfono</h3><p><a href="tel:${esc(s.phone_intl)}">${esc(s.phone_display)}</a></p></div></li>
        <li>${icon('clock')}<div><h3>Horario</h3>${d.hours.map(h => `<p>${esc(h.days)}<br>${esc(h.hours.replace(/ a /g, ' – '))}</p>`).join('')}</div></li>
        ${s.email ? `<li>${icon('user')}<div><h3>Email</h3><p><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></p></div></li>` : ''}
      </ul>
      <div class="contact__actions">
        ${`<a class="btn btn--primary" href="${esc(mapLinks(s).directions)}" target="_blank" rel="noopener">${icon('map')} Cómo llegar</a>`}
        <a class="btn btn--wa" href="${esc(wa(s))}" target="_blank" rel="noopener">${icon('wa')} WhatsApp</a>
        <a class="btn btn--ghost" href="tel:${esc(s.phone_intl)}">${icon('phone')} Llamar</a>
      </div>
    </div>
    ${map ? `<div class="contact__map reveal">
      <iframe src="${esc(mapLinks(s).embed)}" title="Mapa: ${esc(s.business_name)}, ${esc(s.address_street)}, ${esc(s.address_city)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
    </div>` : ''}
  </div>
</section>`;
}

/* ---------- Páginas ---------- */
function renderPage(key, origin) {
  const d = loadSite();
  const { s } = d;
  const city = s.address_city;
  const biz = s.business_name;

  if (key === 'inicio') {
    return layout(d, {
      key, origin, title: s.seo_title, description: s.seo_description, jsonld: jsonLd(d, origin),
      body: hero(d) + aboutBlock(d) + categoriesGrid(d) + colorBlock(d) + galleryBlock(d, { filters: false, limit: 6 }) + reviewsBlock(d, { limit: 2 }) + ctaBand(s)
    });
  }
  if (key === 'servicios') {
    return layout(d, {
      key, origin,
      title: `Servicios | ${biz} — Peluquería en ${city}`,
      description: `Colorimetría, cortes, alisados y tratamientos capilares en ${biz}, ${city}. Consultá precios y reservá tu turno online.`,
      body: pageHead({ key, eyebrow: 'Servicios', title: s.services_title, lead: s.services_intro }) + servicesFull(d) + ctaBand(s)
    });
  }
  if (key === 'colorimetria') {
    const color = d.groups.find(g => g.slug === 'colorimetria');
    return layout(d, {
      key, origin,
      title: `Colorimetría en ${city} | ${biz}`,
      description: `Balayage, babylights, iluminaciones, correcciones de color y tinturas en ${biz}, ${city}. Reservá tu turno.`,
      body: pageHead({ key, eyebrow: 'Especialidad', title: s.color_title, lead: s.color_text })
        + colorBlock(d, { full: true })
        + (color ? `<section class="section">
  <div class="container">
    <header class="section-head"><p class="eyebrow">Servicios de color</p><h2 class="h2">Cada técnica, según tu cabello</h2>
    ${color.description ? `<p class="section-head__text">${esc(color.description)}</p>` : ''}</header>
    <div class="svc-grid stagger">${color.services.map(x => serviceCard(x, s)).join('')}</div>
  </div>
</section>` : '')
        + galleryBlock(d, { filters: false, limit: 4 }) + ctaBand(s)
    });
  }
  if (key === 'galeria') {
    return layout(d, {
      key, origin,
      title: `Galería de trabajos | ${biz}`,
      description: `Trabajos de color, cortes y tratamientos realizados en ${biz}, ${city}.`,
      body: pageHead({ key, eyebrow: 'Galería', title: s.gallery_title, lead: s.gallery_intro }) + galleryBlock(d, { filters: true }) + ctaBand(s)
    });
  }
  if (key === 'nosotros') {
    return layout(d, {
      key, origin,
      title: `Sobre nosotros | ${biz}, peluquería en ${city}`,
      description: `Conocé ${biz}: peluquería especializada en colorimetría y cuidado del cabello en ${city}.`,
      body: pageHead({ key, eyebrow: 'Sobre nosotros', title: s.about_title })
        + aboutBlock(d, { full: true }) + teamBlock(d) + reviewsBlock(d) + ctaBand(s)
    });
  }
  if (key === 'turnos') {
    const h = d.hours[0];
    return layout(d, {
      key, origin,
      title: `Reservá tu turno | ${biz}`,
      description: `Reservá tu turno online en ${biz}, ${city}: elegí servicio, día y horario disponible.`,
      body: pageHead({ key, eyebrow: 'Turnos online', title: s.booking_title, lead: s.booking_intro })
        + bookingBlock(d)
        + `<section class="section info-strip">
  <div class="container info-strip__grid stagger">
    <div>${icon('pin')}<h3>Dónde estamos</h3><p>${esc(s.address_street)}, ${esc(s.address_city)}</p></div>
    <div>${icon('clock')}<h3>Horario de atención</h3><p>${h ? `${esc(h.days)} de ${esc(h.hours)}` : ''}</p></div>
    <div>${icon('phone')}<h3>Teléfono</h3><p><a href="tel:${esc(s.phone_intl)}">${esc(s.phone_display)}</a></p></div>
  </div>
</section>`
    });
  }
  if (key === 'contacto') {
    return layout(d, {
      key, origin,
      title: `Contacto y ubicación | ${biz}, ${city}`,
      description: `${s.address_street}, ${city}. Teléfono ${s.phone_display}. Escribinos por WhatsApp o reservá tu turno online.`,
      body: pageHead({ key, eyebrow: 'Contacto', title: s.contact_title, lead: `${s.address_street}, ${city}. Escribinos y coordinamos tu turno.` })
        + contactBlock(d) + ctaBand(s)
    });
  }
  return null;
}

/* ---------- Páginas auxiliares ---------- */
function simplePage(s, title, body) {
  const hours = hoursSummary();
  return `${head({ s, origin: '', path: '/', title: `${title} · ${s.business_name}`, description: s.seo_description, noindex: true })}
<body class="page page--simple">
${SPRITE}
${header(s, '')}
<main id="main" class="simple-main"><div class="container">${body}</div></main>
${footer(s, hours)}
${floating(s)}
<script src="/js/site.js?v=${ASSET_V}" defer></script>
</body>
</html>`;
}

function renderManage(a) {
  const s = getSettings();
  const cancellable = canClientCancel(a);
  const waText = `Hola ${s.business_name}, tengo un turno reservado (código ${a.code}) para ${a.service_name} el ${formatDateLong(a.date)} a las ${a.start_time}.`;
  const icsUrl = `/api/appointments/${encodeURIComponent(a.code)}/ics?t=${encodeURIComponent(a.token)}`;
  const body = `<article class="ticket">
    <p class="eyebrow">Tu turno</p>
    <h1 class="h2">${esc(a.service_name)}</h1>
    <span class="status status--${esc(a.status)}">${esc(STATUS_LABEL[a.status] || a.status)}</span>
    <dl class="ticket__list">
      <div><dt>Fecha</dt><dd>${esc(formatDateLong(a.date))}</dd></div>
      <div><dt>Horario</dt><dd>${esc(a.start_time)} hs</dd></div>
      <div><dt>Profesional</dt><dd>${esc(a.professional_name || 'A asignar por el salón')}</dd></div>
      <div><dt>A nombre de</dt><dd>${esc(a.first_name)} ${esc(a.last_name)}</dd></div>
      <div><dt>Código</dt><dd><strong>${esc(a.code)}</strong></dd></div>
      <div><dt>Dirección</dt><dd>${esc(s.address_street)}, ${esc(s.address_city)}</dd></div>
    </dl>
    ${a.status !== 'cancelado' ? `<div class="ticket__actions">
      <a class="btn btn--ghost" href="${esc(googleCalendarUrl(a, s))}" target="_blank" rel="noopener">${icon('cal')} Google Calendar</a>
      <a class="btn btn--ghost" href="${esc(icsUrl)}">${icon('cal')} Descargar .ics</a>
      <a class="btn btn--wa" href="${esc(waLink(s.whatsapp_number, waText))}" target="_blank" rel="noopener">${icon('wa')} Contactar por WhatsApp</a>
    </div>` : ''}
    ${cancellable ? `<div class="ticket__cancel">
      <button type="button" class="btn btn--danger-text" data-cancel-code="${esc(a.code)}" data-cancel-token="${esc(a.token)}">Cancelar mi turno</button>
      <p class="ticket__msg" role="status"></p>
    </div>` : ''}
    <p class="ticket__back"><a href="/">${icon('chev-l')} Volver al inicio</a></p>
  </article>`;
  return simplePage(s, 'Tu turno', body);
}

function renderNotFound() {
  const s = getSettings();
  return simplePage(s, 'Página no encontrada', `<article class="ticket ticket--center">
    <p class="eyebrow">Error 404</p>
    <h1 class="h2">No encontramos esta página</h1>
    <p>Es posible que el enlace esté incompleto o que la página ya no exista.</p>
    <p class="ticket__actions"><a class="btn btn--primary" href="/">Ir al inicio</a><a class="btn btn--ghost" href="/turnos">Reservar turno</a></p>
  </article>`);
}

module.exports = { renderPage, renderManage, renderNotFound, hoursSummary, ASSET_V, GALLERY_CATS, PAGES };
