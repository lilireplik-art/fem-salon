'use strict';
/*
 * Ilustraciones abstractas de "mechones de cabello" generadas en SVG.
 * Se usan SOLO como imagen de ejemplo hasta que el salón cargue sus fotos reales desde el panel.
 */

function rng(seed) {
  let a = 0;
  for (const c of seed) a = (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VARIANTS = {
  balayage:      { bg: ['#F4ECE6', '#EADCD2'], grads: [['#2E211B', '#4A3326', '#8C5E3C', '#D2AB7C', '#EFDDBE'], ['#3A2A21', '#5A3E2D', '#A77A52', '#E4C79C', '#F6E8CF']], wave: 1, sheen: .32 },
  babylights:    { bg: ['#F3ECE7', '#E8DDD5'], grads: [['#3B2A21', '#523A2B', '#6E4F39', '#7F5C43']], hi: [['#8A6A4E', '#C9A57C', '#EBD3AC', '#F3E2C2']], hiRatio: .4, wave: .8, sheen: .3 },
  iluminaciones: { bg: ['#F5EDE8', '#ECDFD6'], grads: [['#4A3427', '#7B573E', '#B98B60', '#E2C398']], hi: [['#A57C57', '#DDBA8C', '#F2DDB9']], hiRatio: .25, wave: 1.1, sheen: .35 },
  tintura:       { bg: ['#F3E9E6', '#E7D6D1'], grads: [['#3A1A18', '#5E2622', '#86382C', '#A3503A'], ['#461E1B', '#6E2D26', '#944233', '#B35E44']], wave: .9, sheen: .3 },
  correccion:    { bg: ['#F2ECE9', '#E6DCD6'], grads: [['#3C2B24', '#6B4E3F', '#A88468', '#D9C0A6', '#EFE2D2']], hi: [['#B79A80', '#E1CDB6', '#F4EADD']], hiRatio: .15, wave: 1, sheen: .3 },
  cortes:        { bg: ['#F4EEEA', '#EAE0DA'], grads: [['#221916', '#33251F', '#4A362C', '#5E463A']], wave: .5, cut: .68, sheen: .3 },
  tratamientos:  { bg: ['#F5EEEA', '#EDE1DA'], grads: [['#2F211B', '#4C3428', '#6D4A37', '#84593F']], wave: .7, sheen: .5, sheenStrong: true },
  brillo:        { bg: ['#F6EFEC', '#ECE0DB'], grads: [['#3A2821', '#5C4031', '#7E5840', '#9A6D4E']], wave: 1.2, sheen: .42, sheenStrong: true },
  alisado:       { bg: ['#F3EDE9', '#E9DFD8'], grads: [['#2A1F1A', '#3F2E25', '#5B4234', '#6F5241']], wave: .06, sheen: .45, sheenStrong: true },
  rose:          { bg: ['#F7EEF0', '#EFDDE2'], grads: [['#3B2A23', '#65463A', '#B08A76', '#E6CFC6', '#F5E6E6']], wave: 1, sheen: .3 },
  cejas:         { bg: ['#F7EEEF', '#EEDFE2'], lashes: true }
};
const ALIASES = { hero: 'balayage', about: 'rose', color: 'tintura', colorimetria: 'balayage' };

const f = n => Math.round(n);
function catmull(p) {
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}
function grad(id, stops, H) {
  const n = stops.length - 1;
  const offs = n === 4 ? [0, .28, .55, .8, 1] : stops.map((_, i) => i / n);
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${H}">${stops.map((c, i) => `<stop offset="${offs[i]}" stop-color="${c}"/>`).join('')}</linearGradient>`;
}

function hair(cfg, r, W, H) {
  const defs = [grad('bg', cfg.bg, H)];
  cfg.grads.forEach((g, i) => defs.push(grad(`g${i}`, g, H)));
  (cfg.hi || []).forEach((g, i) => defs.push(grad(`h${i}`, g, H)));
  defs.push(`<radialGradient id="sh" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity="${cfg.sheenStrong ? .55 : .32}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`);

  const k = (Math.PI * 2) / (H * 0.95);
  const amp = 36 * cfg.wave;
  const endBase = cfg.cut ? H * cfg.cut : H + 30;
  const pathAt = (x0, phase, ampI, t, endY) => {
    const pts = [];
    for (let j = 0; j <= 8; j++) {
      const y = -30 + (endY + 30) * j / 8;
      const x = x0 + Math.sin(y * k + phase + t * 1.4) * ampI + (t - .5) * 90 * cfg.wave * Math.pow(Math.max(y, 0) / H, 1.6);
      pts.push([x, y]);
    }
    return pts;
  };

  // Masa base del cabello (sin huecos)
  let mass;
  if (cfg.cut) {
    const top = [], bottom = [];
    for (let i = 0; i <= 10; i++) bottom.push([W + 20 - (W + 40) * i / 10, endBase + Math.sin(i * 1.3) * 4]);
    mass = `<path d="M-20 -20H${W + 20}V${f(endBase)}${bottom.map(p => `L${f(p[0])} ${f(p[1])}`).join('')}Z" fill="url(#g0)"/>`;
    void top;
  } else {
    mass = `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#g0)"/>`;
  }

  const base = [], hi = [];
  const N = 120;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const x0 = -W * 0.18 + t * W * 1.36 + (r() - .5) * 16;
    const phase = (r() - .5) * .7;
    const ampI = amp * (0.75 + r() * .5);
    const endY = cfg.cut ? endBase + (r() - .5) * 8 : endBase;
    const isHi = cfg.hi && r() < cfg.hiRatio;
    const g = isHi ? `h${Math.floor(r() * cfg.hi.length)}` : `g${Math.floor(r() * cfg.grads.length)}`;
    const w = isHi ? 1.4 + r() * 2 : 2.5 + r() * 6;
    const op = (isHi ? .8 : .5) + r() * .45;
    (isHi ? hi : base).push(`<path d="${catmull(pathAt(x0, phase, ampI, t, endY))}" stroke="url(#${g})" stroke-width="${w.toFixed(1)}" stroke-opacity="${op.toFixed(2)}"/>`);
  }
  // Brillos finos
  const glints = [];
  for (let i = 0; i < 26; i++) {
    const t = r();
    glints.push(`<path d="${catmull(pathAt(-W * 0.18 + t * W * 1.36, 0, amp, t, endBase))}" stroke="#fff" stroke-width="${(0.6 + r()).toFixed(1)}" stroke-opacity="${(0.08 + r() * .14).toFixed(2)}"/>`);
  }
  const sy = H * (cfg.sheen || .35);
  const sheen = `<ellipse cx="${W / 2}" cy="${f(sy)}" rx="${f(W * .75)}" ry="${f(H * .09)}" fill="url(#sh)" transform="rotate(-8 ${W / 2} ${f(sy)})"/>`;
  return `<defs>${defs.join('')}</defs><rect width="${W}" height="${H}" fill="url(#bg)"/>${mass}<g fill="none" stroke-linecap="round">${base.join('')}${hi.join('')}${glints.join('')}</g>${sheen}`;
}

function lashes(cfg, r, W, H) {
  const defs = `<defs>${grad('bg', cfg.bg, H)}<radialGradient id="glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>`;
  const out = [];
  const x1 = W * .16, x2 = W * .84, y = H * .56, cy = H * .66;
  const P = t => [(1 - t) ** 2 * x1 + 2 * (1 - t) * t * (W / 2) + t * t * x2, (1 - t) ** 2 * y + 2 * (1 - t) * t * cy + t * t * y];
  const T = t => { const dx = 2 * (1 - t) * (W / 2 - x1) + 2 * t * (x2 - W / 2); const dy = 2 * (1 - t) * (cy - y) + 2 * t * (y - cy); const l = Math.hypot(dx, dy); return [dx / l, dy / l]; };
  out.push(`<path d="M${f(x1)} ${f(y)}Q${f(W / 2)} ${f(cy)} ${f(x2)} ${f(y)}" stroke="#2B1E1A" stroke-width="5" fill="none" stroke-linecap="round"/>`);
  for (let i = 0; i < 58; i++) {
    const t = 0.04 + 0.92 * (i / 57) + (r() - .5) * .01;
    const [px, py] = P(t), [tx, ty] = T(t);
    const nx = -ty, ny = tx; // normal hacia abajo
    const L = (70 + 95 * Math.sin(Math.PI * t)) * (0.85 + r() * .3);
    const side = (t - .5) * 2;
    const ex = px + nx * L + tx * L * .45 * side, ey = py + ny * L * .8;
    const mx = px + nx * L * .6, my = py + ny * L * .75;
    out.push(`<path d="M${f(px)} ${f(py)}Q${f(mx)} ${f(my)} ${f(ex)} ${f(ey)}" stroke="#2B1E1A" stroke-width="${(1.6 + r() * 1.4).toFixed(1)}" stroke-opacity="${(.75 + r() * .25).toFixed(2)}" fill="none" stroke-linecap="round"/>`);
  }
  // Ceja
  const bx1 = W * .14, bx2 = W * .88, by = H * .30, bcy = H * .17;
  for (let i = 0; i < 150; i++) {
    const t = r();
    const px = (1 - t) ** 2 * bx1 + 2 * (1 - t) * t * (W * .62) + t * t * bx2;
    const py = (1 - t) ** 2 * (by + 8) + 2 * (1 - t) * t * bcy + t * t * (by - 4) + (r() - .5) * 26 * (1 - Math.abs(t - .45));
    const len = 22 + r() * 26;
    const ang = (-0.35 + t * 0.75) + (r() - .5) * .3;
    out.push(`<path d="M${f(px)} ${f(py)}l${f(Math.cos(ang) * len)} ${f(-Math.sin(ang) * len * .55)}" stroke="#4A3428" stroke-width="${(1.4 + r() * 1.6).toFixed(1)}" stroke-opacity="${(.35 + r() * .5).toFixed(2)}" stroke-linecap="round"/>`);
  }
  return `${defs}<rect width="${W}" height="${H}" fill="url(#bg)"/><ellipse cx="${W / 2}" cy="${f(H * .5)}" rx="${f(W * .55)}" ry="${f(H * .38)}" fill="url(#glow)"/>${out.join('')}`;
}

const cache = new Map();
function renderArt(name) {
  const m = /^([a-z]+)(?:-(\d{1,2}))?$/.exec(name || '');
  if (!m) return null;
  const key = ALIASES[m[1]] || m[1];
  const cfg = VARIANTS[key];
  if (!cfg) return null;
  if (cache.has(name)) return cache.get(name);
  const W = 800, H = 1000;
  const r = rng(`${name}:fem`);
  const body = cfg.lashes ? lashes(cfg, r, W, H) : hair(cfg, r, W, H);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${body}</svg>`;
  cache.set(name, svg);
  return svg;
}
const artNames = () => [...Object.keys(VARIANTS), ...Object.keys(ALIASES)];

module.exports = { renderArt, artNames };
