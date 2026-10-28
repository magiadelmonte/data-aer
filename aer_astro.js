// ============================================================
// Cielo del mapa FOV (vuelos nocturnos)
// ============================================================
// Dibuja el fondo celeste del encuadre de la cámara con el **mismo catálogo y los
// mismos colores que data-sat** (`sat_camara.html`): sistema solar (Sol, Luna y
// planetas), estrellas (catálogo completo + las brillantes con nombre),
// constelaciones (líneas y rótulo) y espacio profundo (galaxias, nebulosas y
// cúmulos). El snapshot es el instante del vuelo (`ts_start`), no "ahora".
//
// Sólo se muestra en vuelos nocturnos: la ventana horaria y los colores viven en
// `astro.json` (junto a esta página) y el catálogo en `catalogo_astro.json`, que
// es una copia del de data-sat. La geometría (observador, cámara y proyector) la
// pone el mapa: acá se recibe el proyector az/el -> píxel ya armado.
//
// Depende de: aer_mapa.js (llama a `astroDibujar` desde `dibujarFov`).
// ============================================================
const ASTRO_CFG_URL = 'astro.json';           // ventana nocturna + colores
const ASTRO_CAT_URL = 'catalogo_astro.json';  // copia del catálogo de data-sat
const ASTRO = {cfg: null, cat: null, pidiendo: null, cbs: [], error: false};

const ASTRO_D2R = Math.PI / 180, ASTRO_R2D = 180 / Math.PI;
const ASTRO_A = 6378.137, ASTRO_F = 1 / 298.257223563, ASTRO_E2 = ASTRO_F * (2 - ASTRO_F);
const ASTRO_AU = 149597870.7;

// Elementos keplerianos J2000 (Standish) + radio del punto en píxeles; mismo
// juego que data-sat. `el` = a, e, I, L, long. perihelio, long. nodo, con su
// variación por siglo.
const ASTRO_PLANETAS = [
  {n: 'Mercurio', r: 3, el: [0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749, 252.25032350, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081]},
  {n: 'Venus', r: 5, el: [0.72333566, 0.00000390, 0.00677672, -0.00004107, 3.39467605, -0.00078890, 181.97909950, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418]},
  {n: 'Marte', r: 3.5, el: [1.52371034, 0.00001847, 0.09339410, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343]},
  {n: 'Júpiter', r: 4.5, el: [5.20288700, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714, 34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106]},
  {n: 'Saturno', r: 3.5, el: [9.53667594, -0.00125060, 0.05386179, -0.00050991, 2.48599187, 0.00193609, 49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794]},
  {n: 'Urano', r: 2, el: [19.18916464, -0.00196176, 0.04725744, -0.00004397, 0.77263783, -0.00242939, 313.23810451, 428.48202785, 170.95427630, 0.40805281, 74.01692503, 0.04240589]},
  {n: 'Neptuno', r: 2, el: [30.06992276, 0.00026291, 0.00859048, 0.00005105, 1.77004347, 0.00035372, -55.12002969, 218.45945325, 44.96476227, -0.32241464, 131.78422574, -0.00508664]}
];
const ASTRO_TIERRA_EL = [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668,
                         100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0, 0];

const astroJd = ms => ms / 86400000 + 2440587.5;
const astroGmst = j => ((280.46061837 + 360.98564736629 * (j - 2451545)) % 360) * ASTRO_D2R;

function astroSunEci(j){          // Sol geocéntrico (km)
  const n = j - 2451545, L = 280.460 + 0.9856474 * n, g = (357.528 + 0.9856003 * n) * ASTRO_D2R;
  const lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * ASTRO_D2R;
  const eps = (23.439 - 4e-7 * n) * ASTRO_D2R;
  const R = (1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g)) * ASTRO_AU;
  return [R * Math.cos(lam), R * Math.cos(eps) * Math.sin(lam), R * Math.sin(eps) * Math.sin(lam)];
}

function astroLunaEci(j){         // Luna geocéntrica (km), serie abreviada (~0.3°)
  const T = (j - 2451545) / 36525, d = x => x * ASTRO_D2R, sn = x => Math.sin(d(x)), cs = x => Math.cos(d(x));
  const lam = d(218.32 + 481267.881 * T
    + 6.29 * sn(135 + 477198.87 * T) - 1.27 * sn(259.3 - 413335.36 * T)
    + 0.66 * sn(235.7 + 890534.22 * T) + 0.21 * sn(269.9 + 954397.74 * T)
    - 0.19 * sn(357.5 + 35999.05 * T) - 0.11 * sn(186.5 + 966404.03 * T));
  const bet = d(5.13 * sn(93.3 + 483202.02 * T) + 0.28 * sn(228.2 + 960400.89 * T)
    - 0.28 * sn(318.3 + 6003.15 * T) - 0.17 * sn(217.6 - 407332.21 * T));
  const par = 0.9508 + 0.0518 * cs(135 + 477198.87 * T) + 0.0095 * cs(259.3 - 413335.36 * T)
    + 0.0078 * cs(235.7 + 890534.22 * T) + 0.0028 * cs(269.9 + 954397.74 * T);
  const R = ASTRO_A / Math.sin(d(par)), eps = d(23.439 - 0.0130 * T);
  return [R * Math.cos(bet) * Math.cos(lam),
          R * (Math.cos(eps) * Math.cos(bet) * Math.sin(lam) - Math.sin(eps) * Math.sin(bet)),
          R * (Math.sin(eps) * Math.cos(bet) * Math.sin(lam) + Math.cos(eps) * Math.sin(bet))];
}

function astroTeme2ecef(r, g){
  const c = Math.cos(g), s = Math.sin(g);
  return [r[0] * c + r[1] * s, -r[0] * s + r[1] * c, r[2]];
}

// Vector ECEF -> azimut/elevación (grados) vistos desde el observatorio.
function astroAzElEcef(e, lat, lon){
  const la = lat * ASTRO_D2R, lo = lon * ASTRO_D2R;
  const sp = Math.sin(la), cp = Math.cos(la), sl = Math.sin(lo), cl = Math.cos(lo);
  const N0 = ASTRO_A / Math.sqrt(1 - ASTRO_E2 * sp * sp);
  const dx = e[0] - N0 * cp * cl, dy = e[1] - N0 * cp * sl, dz = e[2] - N0 * (1 - ASTRO_E2) * sp;
  const E = -sl * dx + cl * dy;
  const N = -sp * cl * dx - sp * sl * dy + cp * dz;
  const U = cp * cl * dx + cp * sl * dy + sp * dz;
  const r = Math.hypot(E, N, U) || 1;
  return [(Math.atan2(E / r, N / r) * ASTRO_R2D + 360) % 360,
          Math.asin(Math.max(-1, Math.min(1, U / r))) * ASTRO_R2D];
}

// AR/Dec J2000 (grados) -> azimut/elevación (grados), con precesión abreviada.
function astroRaDecAzEl(ra, dec, yrs, gmst, lat, lon){
  const a = ra * ASTRO_D2R, d = dec * ASTRO_D2R, k = ASTRO_D2R / 3600;
  const tanD = Math.tan(d);
  const ra2 = a + (46.1 + 20.0 * Math.sin(a) * (isFinite(tanD) ? tanD : 0)) * k * yrs;
  const de2 = d + 20.0 * Math.cos(a) * k * yrs;
  const H = gmst + lon * ASTRO_D2R - ra2;
  const cd = Math.cos(de2), sd = Math.sin(de2);
  const sp = Math.sin(lat * ASTRO_D2R), cp = Math.cos(lat * ASTRO_D2R);
  const E = -cd * Math.sin(H);
  const N = sd * cp - cd * sp * Math.cos(H);
  const U = sd * sp + cd * cp * Math.cos(H);
  return [(Math.atan2(E, N) * ASTRO_R2D + 360) % 360,
          Math.asin(Math.max(-1, Math.min(1, U))) * ASTRO_R2D];
}

function astroHelio(el, T){       // posición heliocéntrica eclíptica J2000 (UA)
  const v = i => el[2 * i] + el[2 * i + 1] * T;
  const a = v(0), e = v(1), I = v(2) * ASTRO_D2R, L = v(3), w = v(4), O = v(5) * ASTRO_D2R;
  let M = ((L - w) % 360 + 540) % 360 - 180;
  M *= ASTRO_D2R;
  let E = M + e * Math.sin(M);
  for(let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E), om = w * ASTRO_D2R - O;
  const co = Math.cos(om), so = Math.sin(om), cO = Math.cos(O), sO = Math.sin(O);
  const cI = Math.cos(I), sI = Math.sin(I);
  return [(co * cO - so * sO * cI) * xp + (-so * cO - co * sO * cI) * yp,
          (co * sO + so * cO * cI) * xp + (-so * sO + co * cO * cI) * yp,
          so * sI * xp + co * sI * yp];
}

function astroPlanetaRaDec(p, T){ // AR/Dec geocéntricas J2000 (grados)
  const h = astroHelio(p.el, T), t = astroHelio(ASTRO_TIERRA_EL, T);
  const g = [h[0] - t[0], h[1] - t[1], h[2] - t[2]], ep = 23.43928 * ASTRO_D2R;
  const x = g[0], y = g[1] * Math.cos(ep) - g[2] * Math.sin(ep), z = g[1] * Math.sin(ep) + g[2] * Math.cos(ep);
  return [(Math.atan2(y, x) * ASTRO_R2D + 360) % 360, Math.asin(z / Math.hypot(x, y, z)) * ASTRO_R2D];
}

// ¿El vuelo arrancó dentro de la ventana nocturna? Se compara la hora local del
// sitio que ya trae `ts_start_iso` (p. ej. 2026-10-25T21:51:58-03:00).
function astroEsNoche(iso){
  const cfg = ASTRO.cfg;
  if(!cfg || !cfg.noche) return false;
  const m = /T(\d\d):(\d\d)/.exec(iso || '');
  const hm = s => { const q = /^(\d{1,2}):(\d{2})/.exec(s || ''); return q ? +q[1] * 60 + +q[2] : null; };
  const desde = hm(cfg.noche.desde), hasta = hm(cfg.noche.hasta);
  if(!m || desde == null || hasta == null) return false;
  const t = +m[1] * 60 + +m[2];
  return desde <= hasta ? (t >= desde && t < hasta) : (t >= desde || t < hasta);
}

// Carga perezosa: config al abrir la página, catálogo la primera vez que hace falta.
fetch(ASTRO_CFG_URL, {cache: 'no-cache'})
  .then(r => r.ok ? r.json() : null)
  .then(c => { if(c) ASTRO.cfg = c; })
  .catch(() => {});

function astroCargar(listo){
  if(listo) ASTRO.cbs.push(listo);
  if(ASTRO.cat || ASTRO.pidiendo || ASTRO.error) return ASTRO.pidiendo;
  ASTRO.pidiendo = fetch(ASTRO_CAT_URL, {cache: 'force-cache'})
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(cat => {
      ASTRO.cat = cat;
      if(!ASTRO.cfg) ASTRO.cfg = {};       // sin config no hay ventana nocturna
    })
    .catch(() => { ASTRO.error = true; })
    .then(() => {
      ASTRO.pidiendo = null;
      const cbs = ASTRO.cbs; ASTRO.cbs = [];
      cbs.forEach(fn => { try{ fn(); }catch(e){} });
    });
  return ASTRO.pidiendo;
}

// Dibuja el cielo sobre el encuadre ya pintado (grilla y fondo). `P(az, el)` es el
// proyector del mapa FOV; `listo` se llama cuando el catálogo terminó de bajar.
// Devuelve true si dibujó algo en esta pasada.
function astroDibujar(g, P, F, W, H, f, lat, lon, listo){
  if(lat == null || lon == null) return false;
  if(!astroEsNoche(f.ts_start_iso)) return false;
  if(!ASTRO.cat){ astroCargar(listo); return false; }
  const cat = ASTRO.cat, col = ASTRO.cfg.colores || {};
  const ms = f.ts_start ? f.ts_start * 1000 : Date.parse(f.ts_start_iso);
  if(!isFinite(ms)) return false;
  const j = astroJd(ms), gm = astroGmst(j), T = (j - 2451545) / 36525, yrs = T * 100;
  const focal = (W / 2) / Math.tan(F.fovH / 2 * ASTRO_D2R);
  const pRD = (ra, dec) => P(...astroRaDecAzEl(ra, dec, yrs, gm, lat, lon));
  const pAz = e => P(...astroAzElEcef(e, lat, lon));
  const dentro = (p, m) => p && p[0] >= -(m || 0) && p[0] <= W + (m || 0) &&
                                p[1] >= -(m || 0) && p[1] <= H + (m || 0);
  const rotulo = (p, nom, dx, colr, a) => {
    g.globalAlpha = a; g.fillStyle = colr; g.font = '11px "Courier New", monospace';
    g.fillText(nom, p[0] + dx, p[1] + 4); g.globalAlpha = 1;
  };

  // 1. Constelaciones: líneas y rótulo en el centro de lo visible.
  const vis = {};
  g.strokeStyle = col.constel || '#8fb0d8';
  g.lineWidth = .8; g.setLineDash([]); g.globalAlpha = ASTRO.cfg.constelAlfa == null ? .225 : ASTRO.cfg.constelAlfa;
  for(const id in cat.constel.l){
    for(const seg of cat.constel.l[id]){
      g.beginPath(); let pen = false;
      for(const q of seg){
        const p = pRD(q[0], q[1]);
        if(!p){ pen = false; continue; }
        if(!pen){ g.moveTo(p[0], p[1]); pen = true; } else g.lineTo(p[0], p[1]);
        if(p[0] > 0 && p[0] < W && p[1] > 0 && p[1] < H){
          const t = vis[id] || (vis[id] = [0, 0, 0]);
          t[0] += p[0]; t[1] += p[1]; t[2]++;
        }
      }
      g.stroke();
    }
  }
  g.globalAlpha = .7;
  g.fillStyle = col.constel || '#8fb0d8'; g.font = '12px "Courier New", monospace';
  for(const id in vis){
    const t = vis[id];
    if(t[2] < 2) continue;
    const nom = (cat.constel.n[id] ? cat.constel.n[id][0] : id).toUpperCase();
    g.fillText(nom, t[0] / t[2] - g.measureText(nom).width / 2, t[1] / t[2]);
  }
  g.globalAlpha = 1;

  // 2. Estrellas: todo el catálogo, tamaño y brillo según la magnitud.
  g.fillStyle = col.estrella || '#cfd8ff';
  const E = cat.estr;
  for(let i = 0; i < E.length; i += 4){
    const mg = E[i + 2] / 10;
    const p = pRD(E[i] / 100, E[i + 1] / 100);
    if(!dentro(p)) continue;
    const r = Math.max(.6, Math.min(5.5, .5 + .55 * (6.5 - mg)));
    g.globalAlpha = Math.min(.95, .35 + .1 * (6 - mg));
    g.beginPath(); g.arc(p[0], p[1], r, 0, 6.2832); g.fill();
  }
  g.globalAlpha = 1;
  for(const e of cat.estrellas){    // las brillantes, con nombre
    const p = pRD(e[1] * 15, e[2]);
    if(!dentro(p)) continue;
    const dx = Math.max(.6, Math.min(5.5, .5 + .55 * (6.5 - e[3]))) + 4;
    rotulo(p, e[0], dx, col.estrella || '#cfd8ff', .95);
  }

  // 3. Espacio profundo: mancha difusa según magnitud (los cúmulos abiertos se
  // ven por sus estrellas: sólo rótulo).
  for(const e of cat.profundo){
    const p = pRD(e[1], e[2]);
    if(!dentro(p)) continue;
    let dx = 6;
    if(e[3] !== 'oc'){
      const r = Math.max(2.5, Math.min(9, 2 + .9 * (7 - e[4])));
      const gr = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
      gr.addColorStop(0, 'rgba(143,184,200,.9)'); gr.addColorStop(1, 'rgba(143,184,200,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(p[0], p[1], r, 0, 6.2832); g.fill();
      dx = r + 4;
    }
    rotulo(p, e[0], dx, col.profundo || '#8fb8c8', .9);
  }

  // 4. Sistema solar: Sol, Luna (con iluminación) y planetas.
  const sv = astroSunEci(j);
  const ps = pAz(astroTeme2ecef(sv, gm));
  if(dentro(ps, 20)){
    const rs = Math.max(5, focal * Math.tan(.265 * ASTRO_D2R));
    g.fillStyle = col.sol || '#ffe27a';
    g.beginPath(); g.arc(ps[0], ps[1], rs, 0, 6.2832); g.fill();
    rotulo(ps, 'SOL', rs + 4, col.sol || '#ffe27a', 1);
  }
  const lm = astroLunaEci(j), sn = Math.hypot(sv[0], sv[1], sv[2]) || 1;
  const ilum = (1 - (lm[0] * sv[0] + lm[1] * sv[1] + lm[2] * sv[2]) /
                    (Math.hypot(lm[0], lm[1], lm[2]) * sn)) / 2 * 100;
  const lp = pAz(astroTeme2ecef(lm, gm));
  if(dentro(lp, 20)){
    const rl = Math.max(4, focal * Math.tan(.26 * ASTRO_D2R));
    g.fillStyle = 'rgba(235,235,215,' + (.35 + ilum / 160).toFixed(2) + ')';
    g.beginPath(); g.arc(lp[0], lp[1], rl, 0, 6.2832); g.fill();
    rotulo(lp, 'LUNA ' + Math.round(ilum) + '%', rl + 4, col.txt || '#d4c9b0', 1);
  }
  for(const pl of ASTRO_PLANETAS){
    const rd = astroPlanetaRaDec(pl, T);
    const pp = pRD(rd[0], rd[1]);
    if(!dentro(pp)) continue;
    g.globalAlpha = .95; g.fillStyle = col.planeta || '#ffb877';
    g.beginPath(); g.arc(pp[0], pp[1], pl.r, 0, 6.2832); g.fill();
    g.globalAlpha = 1;
    rotulo(pp, pl.n, pl.r + 4, col.planeta || '#ffb877', .95);
  }
  return true;
}
