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
const ACLARAR = 0.14;
const MAP_BG = '#303030';   // fondo del lienzo mientras carga el estilo (= tierra ya aclarada)
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

function marcarFilas(){
  document.querySelectorAll('#days tr[data-k], #live tr[data-k]').forEach(tr => {
    const has = !!TKEY[tr.dataset.k];
    tr.classList.toggle('has-traj', has);
    tr.title = has ? 'clic para ver el mapa del trayecto' : '';
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
      const dLat = (rings[2] * 1000 / 6371000) * (180 / Math.PI);
      const dLon = dLat / Math.cos(lat * Math.PI / 180);
      m.fitBounds([[lon - dLon, lat - dLat], [lon + dLon, lat + dLat]],
                  {padding: 30, duration: 0});   // margen para los cardinales del anillo exterior
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

// Separa el trayecto en tramos según el FOV de la cámara en cada punto (`in_fov`, 0/1:
// azimut + altura + alcance). Los dos tramos comparten el punto de cambio, así no se corta.
function tramosFov(lls){
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
  return out.filter(t => t.pts.length > 1);
}

function dibujarTrayecto(f){
  limpiarTrayecto();
  const lls = f.path.map(p => [p[0], p[1], p[2], p[3]]);
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
  // Un tramo por cada parte dentro/fuera del FOV: continua adentro, punteada afuera.
  tramosFov(lls).forEach((tr, i) => {
    const id = 'traj' + i;
    MMAP.addSource(id, {type: 'geojson', data: {type: 'Feature',
      geometry: {type: 'LineString', coordinates: tr.pts.map(p => [p[1], p[0]])}}});
    MMAP.addLayer({id: id, type: 'line', source: id,
      layout: {'line-join': 'round', 'line-cap': 'round'},
      paint: tr.ok
        ? {'line-color': '#fff', 'line-width': 1.8, 'line-opacity': 1}
        : {'line-color': '#fff', 'line-width': 1.6, 'line-opacity': .9,
           'line-dasharray': [.4, 2.2]}});
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

function abrirTrayecto(k){
  const f = TKEY[k];
  if(!f || TRAJ.center_lat == null) return;
  document.getElementById('mtit').textContent = f.callsign || '';
  document.getElementById('msub').textContent = hourMin(f.ts_start_iso) + ' hs';
  document.getElementById('modal').classList.add('on');
  document.body.style.overflow = 'hidden';
  if(!MMAP) MMAP = initMapa();
  MACTUAL = f;
  MMAP_READY.then(() => {
    if(MACTUAL !== f) return;
    MMAP.resize();
    dibujarTrayecto(f);
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
  const tr = e.target.closest('tr[data-k]');
  if(tr && TKEY[tr.dataset.k]) abrirTrayecto(tr.dataset.k);
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