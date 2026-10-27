// Modal de trayectoria: todo el mapa vive acá. Depende de aer_iconos.js (ICONS) y de aer_tabla.js (bearing, distKm, hourMin, WEEK_REFRESH_MS).
// ============================================================
// Modal de trayectoria (vuelos de hoy): mapa plano oscuro + 3 anillos
// ============================================================
let TRAJ = { flights: [], rings_km: [25, 50, 65] };
const TKEY = {};                       // k -> vuelo con trayectoria
// Basemap: CARTO Dark Matter (vectorial, plano, con etiquetas; gratis con atribución)
// Mapa plano y oscuro: sin relieve.
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
// Recolor de los azules del estilo Nova: todo color con matiz azul/cian/índigo se pasa a TINTE.
// h = matiz destino (0-360; 40 = ocre del sitio) y s = fracción de saturación que se conserva (0 = gris puro, 1 = igual de saturado).
const TINTE = { h: 40, s: 0.30 };
const AZUL_H = [165, 265], AZUL_S_MIN = 0.12;   // rango de matiz que se considera "azul" y saturación mínima
// Aclareo del mapa base: se suma esta fracción de la luminosidad que falta hasta el blanco
// (0 = estilo original; 0,14 ≈ tierras #0e0e0e -> #2f2f2f, más del doble de brillo).
// Los halos de las etiquetas quedan oscuros para no perder contraste.
const ACLARAR = 0.02;
const MAP_BG = '#05070a';   // mismo fondo que data-sat (negro)
const CELESTE = 'rgba(143,176,216,.5)';   // celeste de constelaciones, al 50%
function parseColor(v){
  let m = /^#([0-9a-f]{3,8})$/i.exec(v);
  if(m){
    let x = m[1]; if(x.length < 6) x = x.split('').map(c => c + c).join('');
    return {r: parseInt(x.slice(0,2),16), g: parseInt(x.slice(2,4),16), b: parseInt(x.slice(4,6),16),
            a: x.length === 8 ? parseInt(x.slice(6,8),16) / 255 : 1};
  }
  m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+%?))?\s*\)$/i.exec(v);
  if(m) return {r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4])};
  m = /^hsla?\(\s*([\d.]+)(?:deg)?[ ,]+([\d.]+)%[ ,]+([\d.]+)%(?:[ ,/]+([\d.]+%?))?\s*\)$/i.exec(v);
  if(m){
    const c = hsl2rgb(+m[1], +m[2] / 100, +m[3] / 100);
    return {r: c[0], g: c[1], b: c[2], a: m[4] == null ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4])};
  }
  return null;
}
function rgb2hsl(r, g, b){
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if(d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
function hsl2rgb(h, s, l){
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
function recolorAzul(v){     // un color: los azules/cianes pasan al tinte del sitio
  const c = parseColor(v); if(!c) return v;
  const [h, s, l] = rgb2hsl(c.r, c.g, c.b);
  if(h < AZUL_H[0] || h > AZUL_H[1] || s < AZUL_S_MIN) return v;
  const n = hsl2rgb(TINTE.h, s * TINTE.s, l);
  return 'rgba(' + n[0] + ',' + n[1] + ',' + n[2] + ',' + c.a + ')';
}
function aclararColor(v){    // un color: sube la luminosidad conservando matiz y saturación
  const c = parseColor(v); if(!c) return v;
  const [h, s, l] = rgb2hsl(c.r, c.g, c.b);
  const n = hsl2rgb(h, s, l + (1 - l) * ACLARAR);
  return 'rgba(' + n[0] + ',' + n[1] + ',' + n[2] + ',' + c.a + ')';
}
function mapColores(v, fn){  // recorre arrays/objetos (expresiones, stops) y aplica fn solo a strings de color
  if(Array.isArray(v)) return v.map(x => mapColores(x, fn));
  if(v && typeof v === 'object'){ for(const k in v) v[k] = mapColores(v[k], fn); return v; }
  if(typeof v !== 'string') return v;
  return fn(v);
}
function recolorAzules(v){ return mapColores(v, recolorAzul); }
// Etiquetas del mapa base: "Capilla del Monte" se parte en dos renglones ("Capilla del" / "Monte").
function partirCapilla(tf){
  let base;
  if(typeof tf === 'string'){   // plantilla "{name}" -> expresión
    const parts = tf.split(/(\{[^}]+\})/).filter(Boolean)
      .map(x => /^\{.+\}$/.test(x) ? ['to-string', ['coalesce', ['get', x.slice(1, -1)], '']] : x);
    if(parts.length === 0) return tf;   // text-field vacío: se deja como está
    base = parts.length === 1 ? parts[0] : ['concat', ...parts];
  } else if(Array.isArray(tf) && tf[0] === 'step'){
    // text-field que cambia con el zoom: "zoom" solo puede ser la entrada de un "step" de primer nivel,
    // así que se transforma cada salida del step (índices pares desde el 2) y no la expresión completa.
    return tf.map((x, i) => (i >= 2 && i % 2 === 0) ? partirCapilla(x) : x);
  } else if(Array.isArray(tf) && tf[0] !== 'format' && JSON.stringify(tf).indexOf('"zoom"') < 0){
    base = ['to-string', tf];
  } else return tf;
  return ['let', 'n', base, ['case', ['==', ['var', 'n'], 'Capilla del Monte'], 'Capilla del\nMonte', ['var', 'n']]];
}
let MMAP = null, MMAP_READY = null, MACTUAL = null;
let MTRAJ_IDS = [], MPLANE = null;

function trajOf(k){                      // vuelo cerrado (trayectos.json) o en curso (r1_live.json)
  return TKEY[k] || (typeof LIVE_TKEY !== 'undefined' && LIVE_TKEY[k]) || null;
}
function marcarFilas(){
  document.querySelectorAll('.mlink[data-k]').forEach(a => {
    const has = !!trajOf(a.dataset.k);
    a.classList.toggle('off', !has);
    a.title = has
      ? (a.dataset.modo === 'fov' ? 'Mapa del sector FOV' : 'Mapa del trayecto')
      : 'Sin trayecto disponible';
  });
}

function destino(lat, lon, brg, km){
  // Punto de destino por rumbo/distancia (fórmula directa sobre esfera).
  const R = 6371, d = km / R, b = toRad(brg);
  const f1 = toRad(lat), l1 = toRad(lon);
  const f2 = Math.asin(Math.sin(f1) * Math.cos(d) + Math.cos(f1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(f1),
                             Math.cos(d) - Math.sin(f1) * Math.sin(f2));
  return [f2 * 180 / Math.PI, ((l2 * 180 / Math.PI + 540) % 360) - 180];
}

function initMapa(){
  const lat = TRAJ.center_lat, lon = TRAJ.center_lon;
  const rings = TRAJ.rings_km || [25, 50, 65];
  const m = new maplibregl.Map({
    container: 'mmap',
    style: {version: 8, sources: {}, layers: [
      {id: 'fondo', type: 'background', paint: {'background-color': MAP_BG}}]},
    center: [lon, lat], zoom: 8, attributionControl: false, interactive: false,
    fadeDuration: 0,
  });
  // Se arma el estilo en 3 niveles: 2 = recolor + etiqueta partida, 1 = solo recolor, 0 = estilo original.
  // Si MapLibre rechaza el estilo (error de validación en alguna capa) se baja un nivel, para que el mapa nunca quede vacío.
  const armar = (base, nivel) => {
    const st = JSON.parse(base);
    if(nivel >= 1){
      (st.layers || []).forEach(l => {
        if(!l.paint) return;
        l.paint = recolorAzules(l.paint);               // por si quedara algún azul
        for(const k in l.paint){                         // tierras, aguas, rutas, bordes y textos más visibles
          if(!/color/.test(k) || /halo/.test(k)) continue;   // los halos de texto quedan oscuros (contraste)
          l.paint[k] = mapColores(l.paint[k], aclararColor);
        }
      });
      (st.layers || []).forEach(l => {
        if(l.type === 'line'){
          l.paint = l.paint || {};
          l.paint['line-color'] = CELESTE;
        } else if(l.type === 'symbol'){
          l.paint = l.paint || {};
          l.paint['text-color'] = CELESTE;
          l.paint['text-halo-color'] = 'rgba(5,7,10,.92)';
          if(l.paint['icon-color'] !== undefined) l.paint['icon-color'] = CELESTE;
        }
      });
      const bg = (st.layers || []).find(l => l.type === 'background');
      if(bg){ bg.paint = bg.paint || {}; bg.paint['background-color'] = MAP_BG; }
    }
    if(nivel >= 2){
      (st.layers || []).forEach(l => {
        if(l.type === 'symbol' && l.layout && l.layout['text-field']) l.layout['text-field'] = partirCapilla(l.layout['text-field']);
      });
    }
    return st;
  };
  MMAP_READY = fetch(MAP_STYLE, {cache: 'force-cache'})
    .then(r => r.json())
    .then(st => {
      const base = JSON.stringify(st);
      let nivel = 2;
      const onErr = e => {
        const msg = (e && e.error && e.error.message) || '';
        if(nivel > 0 && /layers\[\d+\]|sources\.|Expected|Invalid/i.test(msg) && !/Failed to fetch|NetworkError|AJAX|404|403/i.test(msg)){
          console.warn('Estilo rechazado en nivel ' + nivel + ': ' + msg);
          nivel--; m.setStyle(armar(base, nivel), {diff: false});
        }
      };
      m.on('error', onErr);
      m.setStyle(armar(base, nivel), {diff: false});
      return new Promise(res => {
        const check = () => (m.isStyleLoaded() &&
          (m.getStyle().layers || []).length > 1) ? res() : setTimeout(check, 50);
        check();
      });
    })
    .then(() => {
      // Porción de "pizza": encuadre de la cámara (az_min..az_max) hasta su alcance.
      const FOV = TRAJ.fov;
      if(FOV){
        const alcance = FOV.radius_km || rings[2];
        const sector = [[lon, lat]];
        for(let a = FOV.az_min; a <= FOV.az_max; a += 2){
          const q = destino(lat, lon, a, alcance);
          sector.push([q[1], q[0]]);
        }
        const q = destino(lat, lon, FOV.az_max, alcance);
        sector.push([q[1], q[0]], [lon, lat]);
        m.addSource('sector', {type: 'geojson', data: {type: 'Feature',
          geometry: {type: 'Polygon', coordinates: [sector]}}});
        m.addLayer({id: 'sector', type: 'fill', source: 'sector',
          paint: {'fill-color': '#fff', 'fill-opacity': .26}});
      }
      // Anillos punteados (25 / 50 / 65 km). La distancia de cada uno va apoyada en su propio
      // anillo (paralela a la línea, del lado de adentro), en el norte, donde el texto queda horizontal.
      rings.forEach((r, i) => {
        const pts = [];
        for(let a = 0; a <= 360; a += 2){
          const p = destino(lat, lon, a, r);
          pts.push([p[1], p[0]]);
        }
        m.addSource('ring' + r, {type: 'geojson', data: {type: 'Feature',
          geometry: {type: 'LineString', coordinates: pts}}});
        m.addLayer({id: 'ring' + r, type: 'line', source: 'ring' + r,
          layout: {'line-cap': 'butt', 'line-join': 'round'},
          paint: {'line-color': '#fff', 'line-opacity': i ? .23 : .32,
            'line-width': i ? .42 : .57, 'line-dasharray': [16, 16]}});
        const p = destino(lat, lon, 0, r);
        const el = document.createElement('span');
        el.className = 'mlab mlab_km';
        el.textContent = r + ' km';
        // Apoyada en el anillo: el anillo es el renglón y el texto queda 7 px adentro.
        new maplibregl.Marker({element: el, anchor: 'center', offset: [0, 7]})
          .setLngLat([p[1], p[0]]).addTo(m);
      });
      // 8 puntos cardinales en el anillo exterior, blancos y apenas por fuera de la línea.
      const CARD = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135],
                    ['S', 180], ['SO', 225], ['O', 270], ['NO', 315]];
      CARD.forEach(([txt, az]) => {
        const p = destino(lat, lon, az, rings[2] + 2.5);
        const el = document.createElement('span');
        el.className = 'mlab mlab_card';
        el.textContent = txt;
        new maplibregl.Marker({element: el, anchor: 'center'})
          .setLngLat([p[1], p[0]]).addTo(m);
      });
      // Bordes de la porción azimutal: líneas punteadas desde el centro hasta el alcance del FOV.
      (FOV ? [FOV.az_min, FOV.az_max] : []).forEach(az => {
        const q = destino(lat, lon, az, FOV.radius_km || rings[2]);
        m.addSource('borde' + az, {type: 'geojson', data: {type: 'Feature',
          geometry: {type: 'LineString', coordinates: [[lon, lat], [q[1], q[0]]]}}});
        m.addLayer({id: 'borde' + az, type: 'line', source: 'borde' + az,
          layout: {'line-cap': 'butt'},
          paint: {'line-color': '#fff', 'line-opacity': .18, 'line-width': .42, 'line-dasharray': [16, 16]}});
      });
      encuadrar(MODO);
    });
  return m;
}

function limpiarTrayecto(){
  MTRAJ_IDS.forEach(id => {
    if(MMAP.getLayer(id)) MMAP.removeLayer(id);
    if(MMAP.getSource(id)) MMAP.removeSource(id);
  });
  MTRAJ_IDS = [];
  if(MPLANE){ MPLANE.remove(); MPLANE = null; }
}

// Separa el trayecto en tramos dentro/fuera del FOV. El corte se calcula en el
// punto exacto donde el segmento cruza un límite (azimut, elevación o alcance) y
// no en el vértice: así la línea no queda sólida afuera ni punteada adentro.
function tramosFlags(lls){                 // respaldo si falta el bloque fov en los datos
  const out = [];
  let run = [lls[0]], ok = lls[0][3] !== 0;
  for(let i = 1; i < lls.length; i++){
    const ok2 = lls[i][3] !== 0;
    if(ok2 === ok){ run.push(lls[i]); continue; }
    run.push(lls[i]);
    out.push({ok: ok, pts: run});
    run = [lls[i]];
    ok = ok2;
  }
  out.push({ok: ok, pts: run});
  return out.filter(tr => tr.pts.length > 1);
}

function tramosFov(lls){
  const F = TRAJ.fov;
  if(!F || lls.length < 2 || typeof bearing !== 'function' || typeof distKm !== 'function')
    return tramosFlags(lls);
  const half = F.fovH / 2, dmax = F.radius_km || 65;
  // Valores de cada vértice que definen el FOV, con el azimut relativo al centro
  // desenvuelto para que un cruce por el sur no salte de +180 a -180.
  const S = lls.map(p => ({
    e: p[4],
    r: ((bearing(TRAJ.center_lat, TRAJ.center_lon, p[0], p[1]) - F.az0 + 540) % 360) - 180,
    d: distKm(p[0], p[1], TRAJ.center_lat, TRAJ.center_lon)}));
  for(let i = 1; i < S.length; i++){
    while(S[i].r - S[i-1].r > 180) S[i].r -= 360;
    while(S[i].r - S[i-1].r < -180) S[i].r += 360;
  }
  const inside = (e, r, d) => e != null && e >= F.el_min && e <= F.el_max &&
    Math.abs(r) <= half && d <= dmax;
  const out = [];
  const push = (ok, pts) => {
    if(pts.length < 2) return;
    const last = out[out.length - 1];
    if(last && last.ok === ok) last.pts = last.pts.concat(pts.slice(1));
    else out.push({ok: ok, pts: pts});
  };
  for(let i = 0; i < lls.length - 1; i++){
    const a = lls[i], b = lls[i + 1], sa = S[i], sb = S[i + 1];
    const ts = [0, 1];
    const addT = (v0, v1, target) => {
      if(v0 == null || v1 == null) return;
      const den = v1 - v0;
      if(!den) return;
      const t = (target - v0) / den;
      if(t > 1e-9 && t < 1 - 1e-9) ts.push(t);
    };
    addT(sa.e, sb.e, F.el_min);
    addT(sa.e, sb.e, F.el_max);
    addT(sa.r, sb.r, -half);
    addT(sa.r, sb.r, half);
    addT(sa.d, sb.d, dmax);
    ts.sort((x, y) => x - y);
    const lim = ts.filter((x, j) => j === 0 || x - ts[j - 1] > 1e-7);
    const at = t => {
      const e = (sa.e == null || sb.e == null) ? null : sa.e + t * (sb.e - sa.e);
      const alt = (a[2] == null || b[2] == null) ? (a[2] == null ? b[2] : a[2])
                                                : a[2] + t * (b[2] - a[2]);
      return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), alt, 1, e];
    };
    for(let j = 0; j < lim.length - 1; j++){
      const t0 = lim[j], t1 = lim[j + 1], tm = (t0 + t1) / 2;
      const e = (sa.e == null || sb.e == null) ? null : sa.e + tm * (sb.e - sa.e);
      const r = sa.r + tm * (sb.r - sa.r);
      const d = sa.d + tm * (sb.d - sa.d);
      push(inside(e, r, d), [at(t0), at(t1)]);
    }
  }
  return out;
}

function dibujarTrayecto(f){
  limpiarTrayecto();
  const lls = f.path.map(p => [p[0], p[1], p[2], p[3], p[4]]);
  const altOf = i => {              // altura (m): si falta el dato se arrastra el último conocido
    for(let j = i; j >= 0; j--) if(lls[j][2] != null) return lls[j][2];
    for(let j = i; j < lls.length; j++) if(lls[j][2] != null) return lls[j][2];
    return 0;
  };
  const elOf = i => {               // altura relativa (grados sobre el horizonte), idem
    for(let j = i; j >= 0; j--) if(lls[j][4] != null) return lls[j][4];
    for(let j = i; j < lls.length; j++) if(lls[j][4] != null) return lls[j][4];
    return null;
  };
  // Tramos: adentro continuo (salvo elevación > 27°, que va punteado normal); afuera
  // punteado al 50% de opacidad (más ligero que la línea normal).
  tramosFov(lls).forEach((tr, i) => {
    const id = 'traj' + i;
    MMAP.addSource(id, {type: 'geojson', data: {type: 'Feature',
      geometry: {type: 'LineString', coordinates: tr.pts.map(p => [p[1], p[0]])}}});
    const alto = tr.pts.reduce((m, p) => (p[4] != null && p[4] > m ? p[4] : m), -Infinity);
    const dash = !tr.ok || alto > 27;
    MMAP.addLayer({id: id, type: 'line', source: id,
      layout: {'line-join': 'round', 'line-cap': 'round'},
      paint: dash
        ? {'line-color': '#fff', 'line-width': 1.6, 'line-opacity': tr.ok ? 1 : .45,
           'line-dasharray': [.4, 2.2]}
        : {'line-color': '#fff', 'line-width': 1.8, 'line-opacity': 1}});
    MTRAJ_IDS.push(id);
  });
  // Altura y altura relativa en cada vértice, para el globo del hover.
  MHOVER = lls.map((p, i) => ({lat: p[0], lon: p[1],
    alt: p[2] != null ? p[2] : altOf(i),
    el: p[4] != null ? p[4] : elOf(i)}));
  const hasAlt = lls.some(p => p[2] != null);
  if(!hasAlt) MHOVER = null;
  MMAP.addSource('trajhover', {type: 'geojson', data: {type: 'FeatureCollection', features: []}});
  MMAP.addLayer({id: 'trajhover', type: 'circle', source: 'trajhover',
    paint: {'circle-radius': 4, 'circle-color': '#fff',
      'circle-stroke-color': '#000', 'circle-stroke-width': 1.5}});
  MTRAJ_IDS.push('trajhover');
  activarHover();
  // Avión en el último punto, orientado al rumbo final.
  const brg = rumboFinal(lls);
  const el = document.createElement('div');
  el.innerHTML = iconHTML(f.icon, brg);
  MPLANE = new maplibregl.Marker({element: el, anchor: 'center'})
    .setLngLat([lls[lls.length - 1][1], lls[lls.length - 1][0]]).addTo(MMAP);
}


// ============================================================
// Mapa FOV: la vista de la cámara (encuadre 16:9), no el mapa de arriba.
// Mismo contorno de sierras que sat_camara.html y el trayecto proyectado en
// azimut/elevación desde el observatorio: cada punto cae donde lo vería la cámara.
// ============================================================
let MFOV_ON = false, MFOV_PTS = null, MFOV_TIP = null, MFOV_CV = null;

function camBasis(F){                    // vectores de la cámara (ENU), igual que SAT
  const ca = F.az0 * Math.PI / 180, ce = F.el0 * Math.PI / 180;
  const FWD = [Math.sin(ca) * Math.cos(ce), Math.cos(ca) * Math.cos(ce), Math.sin(ce)];
  const RGT = [Math.cos(ca), -Math.sin(ca), 0];
  const UPV = [RGT[1] * FWD[2] - RGT[2] * FWD[1],
               RGT[2] * FWD[0] - RGT[0] * FWD[2],
               RGT[0] * FWD[1] - RGT[1] * FWD[0]];
  return {FWD: FWD, RGT: RGT, UPV: UPV};
}
function proyector(F, W, H){
  const B = camBasis(F);
  const f = (W / 2) / Math.tan(F.fovH / 2 * Math.PI / 180);
  return (az, el) => {                  // az/el (grados) -> píxel del encuadre (o null)
    const a = az * Math.PI / 180, e = el * Math.PI / 180;
    const v = [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)];
    const z = v[0] * B.FWD[0] + v[1] * B.FWD[1] + v[2] * B.FWD[2];
    if(z <= 0.02) return null;
    const x = v[0] * B.RGT[0] + v[1] * B.RGT[1];
    const y = v[0] * B.UPV[0] + v[1] * B.UPV[1] + v[2] * B.UPV[2];
    return [W / 2 + f * x / z, H / 2 - f * y / z];
  };
}
const elDe = (lls, i) => {              // elevación del vértice; si falta, la del más cercano
  for(let j = i; j >= 0; j--) if(lls[j][4] != null) return lls[j][4];
  for(let j = i; j < lls.length; j++) if(lls[j][4] != null) return lls[j][4];
  return null;
};

function sierraFov(g, S, W, H, conRelleno){
  if(!S || !S.pts || S.pts.length < 2) return;
  const sx = W / (S.ancho || 1920), sy = H / (S.alto || 1080);
  const xmax = (S.ancho || 1920) - 1, paso = S.paso || 8;
  const trazo = () => {
    g.beginPath();
    S.pts.forEach((v, i) => {
      const x = Math.min(i * paso, xmax) * sx, y = v * sy;
      if(i) g.lineTo(x, y); else g.moveTo(x, y);
    });
  };
  if(conRelleno){
    trazo(); g.lineTo(W, H); g.lineTo(0, H); g.closePath();
    g.fillStyle = 'rgba(5,7,10,' + (S.opacidad == null ? .7 : S.opacidad) + ')';
    g.fill();
  }
  trazo(); g.strokeStyle = 'rgba(139,26,26,.9)'; g.lineWidth = 2;
  g.setLineDash([]); g.stroke();
}

function dibujarFov(f){
  const cv = document.getElementById('mfov'), caja = document.getElementById('mfovbox');
  if(!cv || !caja) return;
  const F = TRAJ.fov;
  const dispW = caja.clientWidth, dispH = caja.clientHeight;
  if(!F || !dispW || !dispH || !f.path || f.path.length < 1) return;
  // Lienzo con la relación exacta del encuadre (tan H / tan V), a todo el ancho.
  const ratio = Math.tan(F.fovH / 2 * Math.PI / 180) / Math.tan(F.fovV / 2 * Math.PI / 180);
  const W = dispW, H = W / ratio;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#05070a'; g.fillRect(0, 0, W, H);

  const P = proyector(F, W, H);
  const top = F.el0 + F.fovV / 2, bot = Math.max(0, F.el0 - F.fovV / 2);
  const azL = F.az0 - F.fovH / 2, azR = F.az0 + F.fovH / 2;
  g.font = '11px "Courier New", monospace';

  // Grilla: azimut cada 10°, elevación cada 5°.
  for(let az = Math.ceil(azL / 10) * 10; az <= azR; az += 10){
    g.beginPath();
    for(let el = bot; el <= top; el += 1){
      const p = P(az, el);
      if(!p) continue;
      if(el === bot) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]);
    }
    g.strokeStyle = 'rgba(212,201,176,.14)'; g.lineWidth = 1; g.stroke();
    const lp = P(az, bot + 1.5);
    if(lp && lp[0] > 16 && lp[0] < W - 26){
      g.fillStyle = 'rgba(212,201,176,.45)'; g.fillText(az + '°', lp[0] + 3, H - 7);
    }
  }
  for(let el = Math.ceil(bot / 5) * 5; el <= top; el += 5){
    g.beginPath();
    for(let az = azL; az <= azR; az += 1){
      const p = P(az, el);
      if(!p) continue;
      if(az === azL) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]);
    }
    g.strokeStyle = 'rgba(212,201,176,.14)'; g.lineWidth = 1; g.stroke();
    const lp = P(azL + 1.2, el);
    if(lp && lp[1] > 12 && lp[1] < H - 16){
      g.fillStyle = 'rgba(212,201,176,.45)'; g.fillText(el + '°', 5, lp[1] - 3);
    }
  }

  // Cresta del Uritorco (la silueta rellena va al final, para tapar lo que pasa detrás).
  sierraFov(g, F.sierra, W, H, false);

  // Trayecto: continuo dentro del FOV, punteado afuera; se corta en el cruce real.
  const lls = f.path.map(p => [p[0], p[1], p[2], p[3], p[4]]);
  const clat = TRAJ.center_lat, clon = TRAJ.center_lon;
  MFOV_PTS = lls.map((p, i) => {
    const el = elDe(lls, i);
    const q = el == null ? null : P(bearing(clat, clon, p[0], p[1]), el);
    return {x: q ? q[0] : null, y: q ? q[1] : null, alt: p[2], el: el};
  });
  // En la vista de la cámara el trazo es siempre continuo.
  g.beginPath(); let pen = false;
  lls.forEach((p, i) => {
    const q = MFOV_PTS[i];
    if(q.x == null){ pen = false; return; }
    if(!pen){ g.moveTo(q.x, q.y); pen = true; } else g.lineTo(q.x, q.y);
  });
  g.strokeStyle = '#fff'; g.lineWidth = 1.8; g.setLineDash([]); g.stroke();

  // Punta del trayecto: delta abierto con la dirección del vuelo (no sólido).
  let ult = null, prev = null;
  for(let i = MFOV_PTS.length - 1; i >= 0; i--){
    const q = MFOV_PTS[i];
    if(q.x == null || q.x < 0 || q.x > W || q.y < 0 || q.y > H) continue;
    ult = q;
    for(let j = i - 1; j >= 0; j--){
      if(MFOV_PTS[j].x != null){ prev = MFOV_PTS[j]; break; }
    }
    break;
  }
  if(ult){
    const ang = prev ? Math.atan2(ult.y - prev.y, ult.x - prev.x) : -Math.PI / 2;
    const L = 10;
    g.beginPath();
    g.moveTo(ult.x - Math.cos(ang - .5) * L, ult.y - Math.sin(ang - .5) * L);
    g.lineTo(ult.x, ult.y);
    g.lineTo(ult.x - Math.cos(ang + .5) * L, ult.y - Math.sin(ang + .5) * L);
    g.strokeStyle = '#fff'; g.lineWidth = 1.6; g.setLineDash([]); g.stroke();
  }
  // El cerro tapa (atenúa) lo que pasa por detrás, igual que en data-sat.
  sierraFov(g, F.sierra, W, H, true);
  // Marco y rótulo del encuadre.
  g.strokeStyle = 'rgba(180,150,80,.35)'; g.lineWidth = 1; g.strokeRect(.5, .5, W - 1, H - 1);
  g.fillStyle = 'rgba(212,201,176,.62)'; g.font = '11px "Courier New", monospace';
  g.fillText('Cámara · az ' + F.az0 + '° · ' + F.fovH + '° × ' + F.fovV + '°', 9, 15);
  activarHoverFov(cv);
}

function activarHoverFov(cv){
  if(MFOV_CV === cv) return;
  MFOV_CV = cv;
  if(!MFOV_TIP){
    MFOV_TIP = document.createElement('div');
    MFOV_TIP.className = 'mtip';
    document.getElementById('mfovbox').appendChild(MFOV_TIP);
  }
  cv.addEventListener('mousemove', e => {
    if(!MFOV_PTS){ MFOV_TIP.style.display = 'none'; return; }
    let best = null;
    const W = cv.clientWidth, H = cv.clientHeight;
    MFOV_PTS.forEach(p => {
      if(p.x == null || p.x < 0 || p.x > W || p.y < 0 || p.y > H) return;
      const d = Math.hypot(e.offsetX - p.x, e.offsetY - p.y);
      if(!best || d < best.d) best = {d: d, x: p.x, y: p.y, alt: p.alt, el: p.el};
    });
    if(!best || best.d > 16 || best.alt == null){ MFOV_TIP.style.display = 'none'; return; }
    MFOV_TIP.textContent = Math.round(best.alt).toLocaleString('es-AR') + ' m' +
      (best.el == null ? '' : ' · ' + (Math.round(best.el * 10) / 10)
        .toLocaleString('es-AR') + '°');
    MFOV_TIP.style.display = 'block';
    const bx = cv.offsetLeft, by = cv.offsetTop;
    const bw = document.getElementById('mfovbox').clientWidth, tw = MFOV_TIP.offsetWidth;
    MFOV_TIP.style.left = Math.max(4, Math.min(bw - tw - 4, bx + best.x + 12)) + 'px';
    MFOV_TIP.style.top = Math.max(4, by + best.y - 30) + 'px';
  });
  cv.addEventListener('mouseleave', () => { MFOV_TIP.style.display = 'none'; });
}
window.addEventListener('resize', () => {
  if(MFOV_ON && MACTUAL) dibujarFov(MACTUAL);
});

// Hover sobre el trayecto: muestra la altura (msnm) del punto más cercano al mouse.
let MHOVER = null, MTIP = null, HOVER_ON = false;
function activarHover(){
  if(HOVER_ON) return;
  HOVER_ON = true;
  MTIP = document.createElement('div');
  MTIP.className = 'mtip';
  MMAP.getContainer().appendChild(MTIP);
  const ocultar = () => {
    MTIP.style.display = 'none';
    MMAP.getCanvas().style.cursor = '';
    const src = MMAP.getSource('trajhover');
    if(src) src.setData({type: 'FeatureCollection', features: []});
  };
  MMAP.on('mousemove', e => {
    if(!MHOVER || MHOVER.length < 2 || !MMAP.getSource('trajhover')) return ocultar();
    const mx = e.point.x, my = e.point.y;
    let best = null;
    for(let i = 0; i < MHOVER.length - 1; i++){
      const A = MMAP.project([MHOVER[i].lon, MHOVER[i].lat]);
      const B = MMAP.project([MHOVER[i + 1].lon, MHOVER[i + 1].lat]);
      const dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy;
      let t = L2 ? ((mx - A.x) * dx + (my - A.y) * dy) / L2 : 0;
      t = Math.max(0, Math.min(1, t));
      const px = A.x + t * dx, py = A.y + t * dy;
      const d = Math.hypot(mx - px, my - py);
      if(!best || d < best.d) best = {d: d, i: i, t: t, x: px, y: py};
    }
    if(!best || best.d > 14) return ocultar();
    const P = MHOVER[best.i], Q = MHOVER[best.i + 1];
    const alt = P.alt + best.t * (Q.alt - P.alt);
    // Altura relativa (grados): se interpola igual que la altura; null si no hay dato.
    const elev = (P.el == null && Q.el == null) ? null
      : (P.el == null ? Q.el : Q.el == null ? P.el : P.el + best.t * (Q.el - P.el));
    const lon = P.lon + best.t * (Q.lon - P.lon), lat = P.lat + best.t * (Q.lat - P.lat);
    MMAP.getSource('trajhover').setData({type: 'Feature',
      geometry: {type: 'Point', coordinates: [lon, lat]}});
    MTIP.textContent = Math.round(alt).toLocaleString('es-AR') + ' m' +
      (elev == null ? '' : ' · ' + (Math.round(elev * 10) / 10).toLocaleString('es-AR') + '°');
    MTIP.style.display = 'block';
    const W = MMAP.getContainer().clientWidth, tw = MTIP.offsetWidth;
    MTIP.style.left = Math.max(4, Math.min(W - tw - 4, best.x + 12)) + 'px';
    MTIP.style.top = Math.max(4, best.y - 30) + 'px';
    MMAP.getCanvas().style.cursor = 'crosshair';
  });
  MMAP.getCanvas().addEventListener('mouseleave', ocultar);
}

function iconHTML(key, deg){
  const spec = ICONS[key] || ICONS.unknown;
  const rot = spec.rot ? 'transform:rotate(' + deg.toFixed(0) + 'deg);' : '';
  return '<div class="mplane" style="' + rot + '"><svg viewBox="0 0 24 24" ' +
    'width="30" height="30" fill="' + spec.color + '" color="' + spec.color + '" ' +
    'stroke="#000" stroke-width=".55" stroke-linejoin="round">' + spec.svg +
    '</svg></div>';
}

function rumboFinal(lls){
  const b = lls[lls.length - 1];
  for(let i = lls.length - 2; i >= 0; i--){
    const a = lls[i];
    if(Math.abs(a[0] - b[0]) > 1e-5 || Math.abs(a[1] - b[1]) > 1e-5)
      return bearing(a[0], a[1], b[0], b[1]);
  }
  return 0;
}

// Encuadre según el mapa: SAT = los tres anillos completos; FOV = solo el sector
// de la cámara (az_min..az_max hasta su alcance) con el trayecto adentro.
function encuadrar(modo){
  if(!MMAP || TRAJ.center_lat == null) return;
  const lat = TRAJ.center_lat, lon = TRAJ.center_lon;
  const rings = TRAJ.rings_km || [25, 50, 65];
  const F = TRAJ.fov;
  if(modo === 'fov' && F){
    const r = F.radius_km || rings[2];
    let x0 = lon, x1 = lon, y0 = lat, y1 = lat;
    for(let a = F.az_min; a <= F.az_max; a += 2){
      const q = destino(lat, lon, a, r);
      x0 = Math.min(x0, q[1]); x1 = Math.max(x1, q[1]);
      y0 = Math.min(y0, q[0]); y1 = Math.max(y1, q[0]);
    }
    MMAP.fitBounds([[x0, y0], [x1, y1]], {padding: 34, duration: 0});
    return;
  }
  const dLat = (rings[2] * 1000 / 6371000) * (180 / Math.PI);
  const dLon = dLat / Math.cos(lat * Math.PI / 180);
  MMAP.fitBounds([[lon - dLon, lat - dLat], [lon + dLon, lat + dLat]],
                 {padding: 30, duration: 0});   // margen para los cardinales del anillo exterior
}

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g,
  c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

// Título del modal: tipo de vuelo · vuelo · bandera + matrícula · fecha y hora.
function tituloModal(f, modo){
  const tipo = f.ac_type_label || f.type_label || '';
  const flag = f.country
    ? '<img class="flag" src="https://flagcdn.com/w40/' +
      encodeURIComponent(f.country) + '.png" onerror="this.style.display=\'none\'">'
    : '';
  document.getElementById('mtit').innerHTML =
    '<span class="mmodo">' + (modo === 'fov' ? 'FOV' : 'SAT') + '</span>' +
    (tipo ? '<span class="mtipo">' + esc(tipo) + '</span>' : '') +
    '<span class="mcall">' + esc(f.callsign || '') + '</span>' +
    ((flag || f.registration)
      ? '<span class="mreg">' + flag + esc(f.registration || '') + '</span>' : '');
  document.getElementById('msub').textContent = fechaHora(f.ts_start_iso);
}

let MODO = 'sat';
function abrirTrayecto(k, modo){
  const f = trajOf(k);
  if(!f || TRAJ.center_lat == null) return;
  MODO = modo === 'fov' ? 'fov' : 'sat';
  tituloModal(f, MODO);
  document.querySelector('#modal .mbox').classList.toggle('fov', MODO === 'fov');
  document.getElementById('modal').classList.add('on');
  document.body.style.overflow = 'hidden';
  MACTUAL = f;
  if(MODO === 'fov'){
    MFOV_ON = true;
    if(MFOV_TIP) MFOV_TIP.style.display = 'none';
    requestAnimationFrame(() => { if(MACTUAL === f) dibujarFov(f); });
    return;
  }
  MFOV_ON = false;
  if(!MMAP) MMAP = initMapa();
  MMAP_READY.then(() => {
    if(MACTUAL !== f) return;
    MMAP.resize();
    dibujarTrayecto(f);
    encuadrar(MODO);
  });
}

function cerrarModal(){
  document.getElementById('modal').classList.remove('on');
  document.body.style.overflow = '';
}

document.getElementById('modal').addEventListener('click', e => {
  if(e.target.id === 'modal') cerrarModal();
});
document.addEventListener('keydown', e => {
  if(e.key === 'Escape') cerrarModal();
});
document.addEventListener('click', e => {
  const a = e.target.closest('a.mlink[data-k]');
  if(!a) return;
  e.preventDefault();
  if(!trajOf(a.dataset.k)) return;
  abrirTrayecto(a.dataset.k, a.dataset.modo);
});

function loadTrayectos(){
  fetch('trayectos.json?_=' + Date.now(), {cache: 'no-store'})
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(j => {
      TRAJ = j || {flights: []};
      Object.keys(TKEY).forEach(k => delete TKEY[k]);
      (TRAJ.flights || []).forEach(f => { TKEY[f.k] = f; });
      marcarFilas();
    })
    .catch(() => {});
}
loadTrayectos();
setInterval(loadTrayectos, WEEK_REFRESH_MS);