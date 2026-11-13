// ============================================================
// AST — motor del cielo (estrellas, planetas, espacio profundo)
// ============================================================
// Único lugar donde vive el dibujo del cielo astronómico. Lo usan:
//   - FRONTEND/js/mapa_aer_fov_lib.js (overlay FOV en vivo y data-sat)
//   - aer/web/aer_mapa.js (modal de trayectoria de data-aer)
//   - sat/web/tools/sat_camara.html (visor público de data-sat)
//
// NO confundir con el "astro del clima" (salida/puesta de sol, fase lunar):
// eso vive en CLM (`/clm/clm-astro`) y no se dibuja acá.
//
// Config: `ast_cielo.json` (ventana nocturna, colores, alfa de constelaciones).
// Catálogo: `ast_catalogo.json` (copias de data-sat). `window.AST_BASE` permite
// cargar desde otra ruta: en el servidor es `/ast/web/`; en data-aer/data-sat se
// publican los tres archivos al lado del index y queda vacío.
//
// El motor sólo dibuja: recibe el proyector az/el -> píxel, el encuadre y el
// observador. Así sirve para cualquier FOV (URI hoy; GEM cuando esté).
// ============================================================
const AST_BASE = (typeof window !== 'undefined' && window.AST_BASE) || '';
const AST_CFG_URL = AST_BASE + 'ast_cielo.json';
const AST_CAT_URL = AST_BASE + 'ast_catalogo.json';
const AST = {cfg: null, cat: null, pidiendo: null, cbs: [], error: false};

const AST_D2R = Math.PI / 180, AST_R2D = 180 / Math.PI;
const AST_A = 6378.137, AST_F = 1 / 298.257223563, AST_E2 = AST_F * (2 - AST_F);
const AST_AU = 149597870.7;

// Elementos keplerianos J2000 (Standish) + radio del punto en píxeles; mismo
// juego que el visor de SAT.
const AST_PLANETAS = [
  {n: 'Mercurio', r: 3, el: [0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749, 252.25032350, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081]},
  {n: 'Venus', r: 5, el: [0.72333566, 0.00000390, 0.00677672, -0.00004107, 3.39467605, -0.00078890, 181.97909950, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418]},
  {n: 'Marte', r: 3.5, el: [1.52371034, 0.00001847, 0.09339410, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343]},
  {n: 'Júpiter', r: 4.5, el: [5.20288700, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714, 34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106]},
  {n: 'Saturno', r: 3.5, el: [9.53667594, -0.00125060, 0.05386179, -0.00050991, 2.48599187, 0.00193609, 49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794]},
  {n: 'Urano', r: 2, el: [19.18916464, -0.00196176, 0.04725744, -0.00004397, 0.77263783, -0.00242939, 313.23810451, 428.48202785, 170.95427630, 0.40805281, 74.01692503, 0.04240589]},
  {n: 'Neptuno', r: 2, el: [30.06992276, 0.00026291, 0.00859048, 0.00005105, 1.77004347, 0.00035372, -55.12002969, 218.45945325, 44.96476227, -0.32241464, 131.78422574, -0.00508664]}
];
const AST_TIERRA_EL = [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668,
                       100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0, 0];

const astJd = ms => ms / 86400000 + 2440587.5;
const astGmst = j => ((280.46061837 + 360.98564736629 * (j - 2451545)) % 360) * AST_D2R;

function astSunEci(j){          // Sol geocéntrico (km)
  const n = j - 2451545, L = 280.460 + 0.9856474 * n, g = (357.528 + 0.9856003 * n) * AST_D2R;
  const lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * AST_D2R;
  const eps = (23.439 - 4e-7 * n) * AST_D2R;
  const R = (1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g)) * AST_AU;
  return [R * Math.cos(lam), R * Math.cos(eps) * Math.sin(lam), R * Math.sin(eps) * Math.sin(lam)];
}

function astLunaEci(j){         // Luna geocéntrica (km), serie abreviada (~0.3°)
  const T = (j - 2451545) / 36525, d = x => x * AST_D2R, sn = x => Math.sin(d(x)), cs = x => Math.cos(d(x));
  const lam = d(218.32 + 481267.881 * T
    + 6.29 * sn(135 + 477198.87 * T) - 1.27 * sn(259.3 - 413335.36 * T)
    + 0.66 * sn(235.7 + 890534.22 * T) + 0.21 * sn(269.9 + 954397.74 * T)
    - 0.19 * sn(357.5 + 35999.05 * T) - 0.11 * sn(186.5 + 966404.03 * T));
  const bet = d(5.13 * sn(93.3 + 483202.02 * T) + 0.28 * sn(228.2 + 960400.89 * T)
    - 0.28 * sn(318.3 + 6003.15 * T) - 0.17 * sn(217.6 - 407332.21 * T));
  const par = 0.9508 + 0.0518 * cs(135 + 477198.87 * T) + 0.0095 * cs(259.3 - 413335.36 * T)
    + 0.0078 * cs(235.7 + 890534.22 * T) + 0.0028 * cs(269.9 + 954397.74 * T);
  const R = AST_A / Math.sin(d(par)), eps = d(23.439 - 0.0130 * T);
  return [R * Math.cos(bet) * Math.cos(lam),
          R * (Math.cos(eps) * Math.cos(bet) * Math.sin(lam) - Math.sin(eps) * Math.sin(bet)),
          R * (Math.sin(eps) * Math.cos(bet) * Math.sin(lam) + Math.cos(eps) * Math.sin(bet))];
}

// Dibuja la Luna con su fase real: disco oscuro (luz cenicienta) + la parte
// iluminada, orientada hacia el Sol en pantalla, con el radio angular de su
// distancia del momento (perigeo/apogeo, ~±5 %).
function astDibujarLuna(g, x, y, r, ilum, angSol, lit, oscuro){
  const k = Math.max(0, Math.min(1, ilum));
  g.save();
  g.translate(x, y); g.rotate(angSol || 0);
  g.beginPath(); g.arc(0, 0, r, 0, 6.2832);
  g.fillStyle = oscuro; g.fill();
  if(k > 0.02){
    const rx = r * Math.abs(1 - 2 * k);
    g.beginPath();
    g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);      // mitad hacia el Sol
    g.ellipse(0, 0, rx, r, 0, Math.PI / 2, -Math.PI / 2, k < 0.5);
    g.closePath();
    g.fillStyle = lit; g.fill();
  }
  g.restore();
}

function astTeme2ecef(r, g){
  const c = Math.cos(g), s = Math.sin(g);
  return [r[0] * c + r[1] * s, -r[0] * s + r[1] * c, r[2]];
}

// Vector ECEF -> azimut/elevación (grados) vistos desde el observatorio.
function astAzElEcef(e, lat, lon){
  const la = lat * AST_D2R, lo = lon * AST_D2R;
  const sp = Math.sin(la), cp = Math.cos(la), sl = Math.sin(lo), cl = Math.cos(lo);
  const N0 = AST_A / Math.sqrt(1 - AST_E2 * sp * sp);
  const dx = e[0] - N0 * cp * cl, dy = e[1] - N0 * cp * sl, dz = e[2] - N0 * (1 - AST_E2) * sp;
  const E = -sl * dx + cl * dy;
  const N = -sp * cl * dx - sp * sl * dy + cp * dz;
  const U = cp * cl * dx + cp * sl * dy + sp * dz;
  const r = Math.hypot(E, N, U) || 1;
  return [(Math.atan2(E / r, N / r) * AST_R2D + 360) % 360,
          Math.asin(Math.max(-1, Math.min(1, U / r))) * AST_R2D];
}

// AR/Dec J2000 (grados) -> azimut/elevación (grados), con precesión abreviada.
function astRaDecAzEl(ra, dec, yrs, gmst, lat, lon){
  const a = ra * AST_D2R, d = dec * AST_D2R, k = AST_D2R / 3600;
  const tanD = Math.tan(d);
  const ra2 = a + (46.1 + 20.0 * Math.sin(a) * (isFinite(tanD) ? tanD : 0)) * k * yrs;
  const de2 = d + 20.0 * Math.cos(a) * k * yrs;
  const H = gmst + lon * AST_D2R - ra2;
  const cd = Math.cos(de2), sd = Math.sin(de2);
  const sp = Math.sin(lat * AST_D2R), cp = Math.cos(lat * AST_D2R);
  const E = -cd * Math.sin(H);
  const N = sd * cp - cd * sp * Math.cos(H);
  const U = sd * sp + cd * cp * Math.cos(H);
  return [(Math.atan2(E, N) * AST_R2D + 360) % 360,
          Math.asin(Math.max(-1, Math.min(1, U))) * AST_R2D];
}

function astHelio(el, T){       // posición heliocéntrica eclíptica J2000 (UA)
  const v = i => el[2 * i] + el[2 * i + 1] * T;
  const a = v(0), e = v(1), I = v(2) * AST_D2R, L = v(3), w = v(4), O = v(5) * AST_D2R;
  let M = ((L - w) % 360 + 540) % 360 - 180;
  M *= AST_D2R;
  let E = M + e * Math.sin(M);
  for(let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E), om = w * AST_D2R - O;
  const co = Math.cos(om), so = Math.sin(om), cO = Math.cos(O), sO = Math.sin(O);
  const cI = Math.cos(I), sI = Math.sin(I);
  return [(co * cO - so * sO * cI) * xp + (-so * cO - co * sO * cI) * yp,
          (co * sO + so * cO * cI) * xp + (-so * sO + co * cO * cI) * yp,
          so * sI * xp + co * sI * yp];
}

function astPlanetaRaDec(p, T){ // AR/Dec geocéntricas J2000 (grados)
  const h = astHelio(p.el, T), t = astHelio(AST_TIERRA_EL, T);
  const g = [h[0] - t[0], h[1] - t[1], h[2] - t[2]], ep = 23.43928 * AST_D2R;
  const x = g[0], y = g[1] * Math.cos(ep) - g[2] * Math.sin(ep), z = g[1] * Math.sin(ep) + g[2] * Math.cos(ep);
  return [(Math.atan2(y, x) * AST_R2D + 360) % 360, Math.asin(z / Math.hypot(x, y, z)) * AST_R2D];
}

// ¿El instante cae dentro de la ventana nocturna? `iso` es la hora local del
// sitio (p. ej. 2026-10-25T21:51:58-03:00). Sin config válida, no hay noche.
function astCieloEsNoche(iso){
  const cfg = AST.cfg;
  if(!cfg || !cfg.noche) return false;
  const m = /T(\d\d):(\d\d)/.exec(iso || '');
  const hm = s => { const q = /^(\d{1,2}):(\d{2})/.exec(s || ''); return q ? +q[1] * 60 + +q[2] : null; };
  const desde = hm(cfg.noche.desde), hasta = hm(cfg.noche.hasta);
  if(!m || desde == null || hasta == null) return false;
  const t = +m[1] * 60 + +m[2];
  return desde <= hasta ? (t >= desde && t < hasta) : (t >= desde || t < hasta);
}

// Carga perezosa: config al abrir la página, catálogo la primera vez que hace falta.
fetch(AST_CFG_URL, {cache: 'no-cache'})
  .then(r => r.ok ? r.json() : null)
  .then(c => { if(c) AST.cfg = c; })
  .catch(() => {});

function astCieloCargar(listo){
  if(listo) AST.cbs.push(listo);
  if(AST.cat || AST.pidiendo || AST.error) return AST.pidiendo;
  AST.pidiendo = fetch(AST_CAT_URL, {cache: 'force-cache'})
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(cat => {
      AST.cat = cat;
      if(!AST.cfg) AST.cfg = {};       // sin config no hay ventana nocturna
    })
    .catch(() => { AST.error = true; })
    .then(() => {
      AST.pidiendo = null;
      const cbs = AST.cbs; AST.cbs = [];
      cbs.forEach(fn => { try{ fn(); }catch(e){} });
    });
  return AST.pidiendo;
}

// Dibuja el cielo sobre el encuadre ya pintado. Todo entra por `o`:
//   g          contexto 2d destino
//   P          proyector (az, el) -> [x, y] | null
//   W, H       tamaño del encuadre
//   focal      distancia focal en píxeles (para el tamaño de Sol/Luna)
//   ts         instante en ms (default: ahora)
//   iso        hora local ISO del instante (para la ventana nocturna)
//   lat, lon   observador
//   colors     paleta opcional (sol, luna, planeta, estrella, constel, profundo, txt)
//   constelAlfa  opacidad de las constelaciones (default: config)
//   texto      escala de los rótulos (1 = 11 px)
//   filtros    {SISTEMA, ESTRELLAS, CONSTEL, PROFUNDO} en false para omitir
//   noche      false = dibujar siempre (visor SAT); default = sólo de noche
//   listo      callback cuando termina de bajar el catálogo (para reintentar)
//   estrellas  array opcional: se llena con {x, y, r, hip, mag, name} para tooltips
// Devuelve {SISTEMA, ESTRELLAS, CONSTEL, PROFUNDO} con lo visible, o null si
// todavía no hay config/catálogo (o si es de día y `noche` no es false).
function astCieloDibujar(o){
  const g = o.g, P = o.P, W = o.W, H = o.H, focal = o.focal;
  const lat = o.lat, lon = o.lon;
  if(!g || !P || !W || !H || !focal || lat == null || lon == null) return null;
  if(!AST.cfg || !AST.cat){
    astCieloCargar(o.listo);
    return null;
  }
  const ts = o.ts == null ? Date.now() : o.ts;
  const iso = o.iso || new Date(ts).toISOString();
  if(o.noche !== false && !astCieloEsNoche(iso)) return null;

  const cat = AST.cat;
  const col = Object.assign({}, (AST.cfg && AST.cfg.colores) || {}, o.colors || {});
  const constelAlfa = o.constelAlfa == null
    ? (AST.cfg.constelAlfa == null ? .225 : AST.cfg.constelAlfa)
    : o.constelAlfa;
  const filtros = o.filtros || {};
  const on = k => filtros[k] !== false;
  const sc = o.texto || 1;                    // 1 = 11 px; los overlays piden 1,5
  const cn = {SISTEMA: 0, ESTRELLAS: 0, CONSTEL: 0, PROFUNDO: 0};

  const j = astJd(ts), gm = astGmst(j), T = (j - 2451545) / 36525, yrs = T * 100;
  const pRD = (ra, dec) => P(...astRaDecAzEl(ra, dec, yrs, gm, lat, lon));
  const pAz = e => P(...astAzElEcef(e, lat, lon));
  const dentro = (p, m) => p && p[0] >= -(m || 0) && p[0] <= W + (m || 0) &&
                                p[1] >= -(m || 0) && p[1] <= H + (m || 0);
  const rotulo = (p, nom, dx, colr, a) => {
    g.globalAlpha = a; g.fillStyle = colr;
    g.font = (11 * sc) + 'px "Courier New", monospace';
    g.fillText(nom, p[0] + dx, p[1] + 4 * sc); g.globalAlpha = 1;
  };

  // 1. Constelaciones: líneas y rótulo en el centro de lo visible.
  const tConstel = on('CONSTEL'), vis = {};
  g.strokeStyle = col.constel || '#8fb0d8';
  g.lineWidth = 1; g.setLineDash([]); g.globalAlpha = constelAlfa;
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
      if(tConstel) g.stroke();
    }
  }
  g.globalAlpha = .85;
  g.fillStyle = col.constel || '#8fb0d8';
  g.font = (12 * sc) + 'px "Courier New", monospace';
  for(const id in vis){
    const t = vis[id];
    if(t[2] < 2) continue;
    cn.CONSTEL++;
    if(!tConstel) continue;
    const nom = (cat.constel.n[id] ? cat.constel.n[id][0] : id).toUpperCase();
    g.fillText(nom, t[0] / t[2] - g.measureText(nom).width / 2, t[1] / t[2]);
  }
  g.globalAlpha = 1;

  // 2. Estrellas: todo el catálogo, tamaño y brillo según la magnitud.
  const tEstrellas = on('ESTRELLAS');
  g.fillStyle = col.estrella || '#cfd8ff';
  const E = cat.estr;
  for(let i = 0; i < E.length; i += 4){
    const mg = E[i + 2] / 10;
    const p = pRD(E[i] / 100, E[i + 1] / 100);
    if(!dentro(p)) continue;
    cn.ESTRELLAS++;
    const hp = E[i + 3];
    if(o.estrellas) o.estrellas.push({x: p[0], y: p[1], r: Math.max(.6, Math.min(5.5, .5 + .55 * (6.5 - mg))),
      hip: hp, mag: mg, name: (cat.nom && cat.nom[hp]) || ('HIP ' + hp)});
    if(tEstrellas){
      const r = Math.max(.6, Math.min(5.5, .5 + .55 * (6.5 - mg)));
      g.globalAlpha = Math.min(.95, .35 + .1 * (6 - mg));
      g.beginPath(); g.arc(p[0], p[1], r, 0, 6.2832); g.fill();
    }
  }
  g.globalAlpha = 1;
  if(tEstrellas){
    for(const e of cat.estrellas){    // las brillantes, con nombre
      const p = pRD(e[1] * 15, e[2]);
      if(!dentro(p)) continue;
      const dx = Math.max(.6, Math.min(5.5, .5 + .55 * (6.5 - e[3]))) + 4;
      rotulo(p, e[0], dx, col.estrella || '#cfd8ff', .95);
    }
  }

  // 3. Espacio profundo: mancha difusa según magnitud (los cúmulos abiertos se
  // ven por sus estrellas: sólo rótulo).
  const tProfundo = on('PROFUNDO');
  for(const e of cat.profundo){
    const p = pRD(e[1], e[2]);
    if(!dentro(p)) continue;
    cn.PROFUNDO++;
    if(!tProfundo) continue;
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
  const tSistema = on('SISTEMA');
  const sv = astSunEci(j), ps = pAz(astTeme2ecef(sv, gm));
  if(dentro(ps, 20)){
    cn.SISTEMA++;
    if(tSistema){
      const rs = Math.max(5, focal * Math.tan(.265 * AST_D2R));
      g.fillStyle = col.sol || '#ffe27a';
      g.beginPath(); g.arc(ps[0], ps[1], rs, 0, 6.2832); g.fill();
      rotulo(ps, 'SOL', rs + 4, col.sol || '#ffe27a', 1);
    }
  }
  const lm = astLunaEci(j), sn = Math.hypot(sv[0], sv[1], sv[2]) || 1;
  const ilum = (1 - (lm[0] * sv[0] + lm[1] * sv[1] + lm[2] * sv[2]) /
                    (Math.hypot(lm[0], lm[1], lm[2]) * sn)) / 2;
  const lp = pAz(astTeme2ecef(lm, gm));
  if(dentro(lp, 20)){
    cn.SISTEMA++;
    if(tSistema){
      // Fase y tamaño reales: radio angular = asin(1737.4 km / distancia).
      const distL = Math.hypot(lm[0], lm[1], lm[2]);
      // +50 % respecto del tamaño angular real: sigue variando con la distancia.
      const rl = Math.max(3, 1.5 * focal * Math.tan(Math.asin(1737.4 / distL)));
      // Dirección al Sol en pantalla. Si el Sol está fuera del encuadre (de noche
      // siempre lo está) `ps` es null: se usa un punto interpolado 5 % hacia el
      // Sol y, si tampoco, se asume la luz viniendo de abajo.
      let ref = ps;
      if(!ref){
        const mix = [lm[0] + (sv[0] - lm[0]) * .05,
                     lm[1] + (sv[1] - lm[1]) * .05,
                     lm[2] + (sv[2] - lm[2]) * .05];
        ref = pAz(astTeme2ecef(mix, gm));
      }
      const angSol = ref ? Math.atan2(ref[1] - lp[1], ref[0] - lp[0]) : Math.PI / 2;
      astDibujarLuna(g, lp[0], lp[1], rl, ilum, angSol,
                     'rgba(235,235,215,' + (.75 + ilum / 4).toFixed(2) + ')',
                     'rgba(235,235,215,.10)');
      rotulo(lp, 'LUNA', rl + 4, col.txt || '#d4c9b0', 1);
    }
  }
  for(const pl of AST_PLANETAS){
    const rd = astPlanetaRaDec(pl, T);
    const pp = pRD(rd[0], rd[1]);
    if(!dentro(pp)) continue;
    cn.SISTEMA++;
    if(tSistema){
      g.globalAlpha = .95; g.fillStyle = col.planeta || '#ffb877';
      g.beginPath(); g.arc(pp[0], pp[1], pl.r, 0, 6.2832); g.fill();
      g.globalAlpha = 1;
      rotulo(pp, pl.n, pl.r + 4, col.planeta || '#ffb877', .95);
    }
  }
  return cn;
}
