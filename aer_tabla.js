// El index.html es siempre el mismo: los datos se cargan de semana.json.
let DATA = { flights: [], n: 0, window_days: 5, updated_iso: '', today: null };

const WEEKDAYS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto',
  'Septiembre','Octubre','Noviembre','Diciembre'];
const CARD_ABREV = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'];

const toRad = d => d * Math.PI / 180;
const cardAbrev = deg => (deg == null ? null
  : CARD_ABREV[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]);

function bearing(lat1, lon1, lat2, lon2){
  const f1 = toRad(lat1), f2 = toRad(lat2), dl = toRad(lon2 - lon1);
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
function distKm(lat1, lon1, lat2, lon2){
  const R = 6371, dφ = toRad(lat2 - lat1), dλ = toRad(lon2 - lon1);
  const a = Math.sin(dφ/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dλ/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function hourMin(iso){
  const m = /T(\d{2}):(\d{2})/.exec(iso || '');
  return m ? m[1] + ':' + m[2] : '';
}
function fechaHora(iso){                 // 27/10/2026 12:42 (hora local del vuelo)
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso || '');
  return m ? m[3] + '/' + m[2] + '/' + m[1] + ' ' + m[4] + ':' + m[5] : '';
}
function dayKey(iso){ return (iso || '').slice(0, 10); }
function fmtDay(key){
  if(key === DATA.today) return 'HOY';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if(!m) return key;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return WEEKDAYS[d.getDay()] + ' ' + d.getDate() + ' de ' +
         MONTHS[d.getMonth()] + ' de ' + d.getFullYear();
}
function capillaInfo(f){
  const pts = f.path || [];
  if(pts.length === 0 || DATA.center_lat == null)
    return '<span class="na">—</span>';
  let best = Infinity;
  for(const p of pts){
    const d = distKm(p.lat, p.lon, DATA.center_lat, DATA.center_lon);
    if(d < best) best = d;
  }
  const km = best.toLocaleString('es-AR',
    {minimumFractionDigits: 1, maximumFractionDigits: 1}) + ' km';
  // Sin color por zona: la distancia va siempre en blanco (el detalle queda en el
  // tooltip, que sí dice si pasó dentro de R1).
  return '<span class="dist" title="' +
    (best <= DATA.r1_km ? 'dentro de R1' : 'fuera de R1') + '">' + km + '</span>';
}
function durHMS(sec){
  if(sec == null) return '';
  sec = Math.round(sec);
  const p = n => String(n).padStart(2, '0');
  return p(Math.floor(sec/3600)) + ':' + p(Math.floor((sec%3600)/60)) + ':' + p(sec%60);
}
function orientInfo(f){
  const pts = f.path || [];
  if(pts.length < 2) return '<span class="na">—</span>';
  const a = pts[0], b = pts[pts.length - 1];
  const brg = bearing(a.lat, a.lon, b.lat, b.lon);
  return cardAbrev((brg + 180) % 360) + '→' + cardAbrev(brg);
}
// Ficha del avión en Flightradar24 (data-aer es estático: el link se arma en el front).
const FR24_AIRCRAFT = 'https://www.flightradar24.com/data/aircraft/';
function regLink(reg){
  const r = String(reg == null ? '' : reg).trim();
  if(!r || r === '—') return '';
  const url = FR24_AIRCRAFT + encodeURIComponent(r.toLowerCase());
  return '<a class="ext reg" href="' + url + '" target="_blank" rel="noopener"' +
    ' title="Ver ' + r + ' en Flightradar24">' + r + '</a>';
}

function tipoCell(f){
  let tipo = f.type_label || f.icao_type || '';
  let cat = f.ac_type_label || '';
  if(!tipo){ tipo = cat; cat = ''; }
  if(cat) tipo += '<span class="cat">' + cat + '</span>';
  // Matricula + boton FOTO (solo si hay foto cargada), juntos en la columna Aeronave.
  if(!f.registration) return tipo;
  const k = rowKey(f), kq = k.replace(/"/g, '&quot;');
  let foto = '';
  if(f.photo && f.photo.url){
    FOTOS[k] = {url: f.photo.url,
      titulo: [f.registration, f.type_label].filter(Boolean).join(' · ')};
    foto = ' <a class="mlink foto" href="#" data-fotok="' + kq + '">FOTO</a>';
  }
  return regLink(f.registration) + foto +
         (tipo ? ' <span class="tipo">' + tipo + '</span>' : '');
}

const HEAD = '<tr><th>Hora</th><th>Duración</th><th>Vuelo</th><th>Aeronave</th>' +
  '<th>País</th><th>Distancia</th><th>Trayecto</th><th>Mapas</th></tr>';

const rowKey = f => (f.callsign || f.icao24 || '') + '|' + (f.ts_start_iso || '');
const esHoy = iso => dayKey(iso) ===
  (DATA.today || new Date().toLocaleDateString('en-CA'));   // yyyy-mm-dd local
const FOTOS = {};                        // clave de fila -> {url, titulo}
function mapLinks(f){
  // Cada día tiene su JSON de trayectos: el mapa se arma con el día de la fila.
  const k = rowKey(f);
  const kq = k.replace(/"/g, '&quot;');
  const link = (modo, txt) => '<a class="mlink" href="#" data-k="' + kq +
    '" data-modo="' + modo + '">' + txt + '</a>';
  // El mapa FOV solo aparece si el vuelo entró al sector azimutal de la cámara
  // (aunque no se haya visto: puede haber pasado por debajo o por encima del FOV).
  // Si no entró, el link SAT le pasa `data-nofov` a la modal para que no ofrezca FOV.
  const sat = link('sat', 'SAT').replace('data-modo="sat"',
    'data-modo="sat"' + (f.fov_az ? '' : ' data-nofov="1"'));
  return sat + (f.fov_az ? link('fov', 'FOV') : '');
}

// Modal de fotografía: se abre desde el link FOTO de la lista de vuelos.
function abrirFoto(k){
  const dato = FOTOS[k];
  if(!dato) return;
  document.getElementById('ftit').textContent = dato.titulo || 'Fotografía';
  const img = document.getElementById('fimg');
  img.src = dato.url;
  img.alt = dato.titulo || '';
  document.getElementById('fotomodal').classList.add('on');
  document.getElementById('fotomodal').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function cerrarFoto(){
  document.getElementById('fotomodal').classList.remove('on');
  document.getElementById('fotomodal').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}
document.getElementById('fotomodal').addEventListener('click', e => {
  if(e.target.id === 'fotomodal') cerrarFoto();
});
document.getElementById('fclose').addEventListener('click', cerrarFoto);
document.addEventListener('keydown', e => { if(e.key === 'Escape') cerrarFoto(); });
document.addEventListener('click', e => {
  const a = e.target.closest('a.mlink[data-fotok]');
  if(!a) return;
  e.preventDefault();
  abrirFoto(a.dataset.fotok);
});
// La columna Vuelo enlaza a la ficha publica de FlightAware (pestaña nueva).
function vueloLink(f){
  const cs = f.callsign || f.icao24 || '';
  if(!cs) return '';
  return '<a class="ext" href="https://www.flightaware.com/live/flight/' +
    encodeURIComponent(cs) + '" target="_blank" rel="noopener noreferrer">' +
    cs + '</a>';
}
function rowHtml(f){
  const flag = f.country
    ? '<img class="flag" src="https://flagcdn.com/w40/' + f.country +
      '.png" onerror="this.style.display=\'none\'">' : '';
  const pais = f.country_name_spa || f.country_name_eng || f.country || '';
  const dur = durHMS(f.duration_sec);
  return '<tr data-k="' + rowKey(f).replace(/"/g, '&quot;') + '">' +
    '<td class="hora">' + hourMin(f.ts_paso_iso || f.ts_start_iso) + '</td>' +
    '<td class="dur">' + dur + '</td>' +
    '<td>' + vueloLink(f) + '</td>' +
    '<td>' + tipoCell(f) + '</td>' +
    '<td>' + flag + pais + '</td>' +
    '<td>' + capillaInfo(f) + '</td>' +
    '<td class="dir">' + orientInfo(f) + '</td>' +
    '<td class="mapas">' + mapLinks(f) + '</td>' +
    '</tr>';
}

function daySection(key, flights, open){
  const rows = flights.map(f => rowHtml(f)).join('');
  const secCls = 'day' + (open ? ' open' : '') + (key === DATA.today ? ' today' : '');
  return '<section class="' + secCls + '" data-key="' + key + '"><h2 class="day-title toggle">' + fmtDay(key) + '</h2>' +
    '<div class="day-body"><table><thead>' + HEAD + '</thead>' +
    '<tbody>' + rows + '</tbody></table></div></section>';
}

// Bloque "Totales semanales": máximos por categoría (horario/aerolínea/tipo/país/
// trayecto) de los últimos días. Columnas propias (sin Matrícula/Visible/Duración, que
// no aplican): Hora | Vuelo | Aeronave | País | Trayecto. La cantidad va entre
// paréntesis al lado del dato.
const HEAD_REPORTES = '<tr><th>Hora</th><th>Vuelo</th><th>Aeronave</th>' +
  '<th>País</th><th>Trayecto</th></tr>';
let repData = { tops: {}, n: 0 };
function topCell(t){
  if(!t || t.flights == null) return '<span class="na">—</span>';
  const label = t.label || t.key || '';
  return label + ' <span class="tot">(' + t.flights + ')</span>';
}
function renderReportes(){
  const box = document.getElementById('reportes');
  const tops = (repData && repData.tops) || {};
  const has = tops.airline || tops.country || tops.type || tops.track || tops.hour;
  const dash = '<span class="na">—</span>';
  const ctry = tops.country;
  const paisCell = (ctry && ctry.key)
    ? '<img class="flag" src="https://flagcdn.com/w40/' + ctry.key +
      '.png" onerror="this.style.display=\'none\'">' +
      (ctry.label || ctry.key) + ' <span class="tot">(' + ctry.flights + ')</span>'
    : dash;
  const body = has
    ? '<tr>' +
        '<td class="hora">' + topCell(tops.hour) + '</td>' +
        '<td>' + topCell(tops.airline) + '</td>' +
        '<td>' + topCell(tops.type) + '</td>' +
        '<td>' + paisCell + '</td>' +
        '<td class="dir">' + topCell(tops.track) + '</td>' +
      '</tr>'
    : '<tr><td colspan="5"><span class="na">Sin datos de totales.</span></td></tr>';
  box.innerHTML = '<section class="day open">' +
    '<h2 class="day-title">Totales semanales</h2>' +
    '<div class="day-body"><table><thead>' + HEAD_REPORTES + '</thead>' +
    '<tbody>' + body + '</tbody></table></div></section>';
}
function pollReportes(){
  getJson('reportes.json')
    .then(j => { repData = j || { tops: {} }; renderReportes(); })
    .catch(() => {});
}

function render(){
  // Conservar el estado abierto/cerrado de cada día entre refrescos. El estado
  // actual del DOM manda; si un día no está en el DOM (primera vez que aparece),
  // el día de hoy arranca abierto y el resto cerrado.
  const openStates = {};
  document.querySelectorAll('#days .day[data-key]').forEach(sec => {
    openStates[sec.dataset.key] = sec.classList.contains('open');
  });
  const groups = {};
  (DATA.flights || []).forEach(f => {
    const k = dayKey(f.ts_start_iso);
    (groups[k] = groups[k] || []).push(f);
  });
  const keys = Object.keys(groups).sort().reverse();   // día más reciente primero
  const days = document.getElementById('days');
  days.innerHTML = keys.length
    ? keys.map(k => {
        groups[k].sort((a, b) => (b.ts_start || 0) - (a.ts_start || 0));
        const open = (k in openStates) ? openStates[k] : (k === DATA.today);
        return daySection(k, groups[k], open);
      }).join('')
    : '<p class="na" style="text-align:center">Sin vuelos registrados.</p>';
  const meta = DATA.n
    ? 'Actualizado: ' + DATA.updated_iso + ' · ' + DATA.n +
      ' vuelos · últimos ' + DATA.window_days + ' días'
    : 'Sin vuelos';
  // Build de los assets en el pie: permite confirmar de un vistazo si la página
  // que se está viendo es la última o vino del caché.
  const ver = (/[?&]v=([^&"]+)/.exec(
    (document.querySelector('script[src*="aer_mapa"]') || {}).src || '') || [])[1];
  document.getElementById('foot').innerHTML = meta + (ver ? ' · v' + ver : '') +
    ' · <a href="https://www.youtube.com/@MagiaDelMonte">Observatorio Uritorco</a>';
  marcarFilas();
}

document.getElementById('days').addEventListener('click', e => {
  const t = e.target.closest('.day-title.toggle');
  if(t) t.parentElement.classList.toggle('open');
});

// ---- Actualización manual desde la tabla (sólo en el Flask local) ----------
// Ctrl+Shift+doble clic sobre la fila de un vuelo abre `tools/aer_manual.html`
// con los datos ya cargados (hex, matrícula, callsign, tipo) y la búsqueda en
// FR24 disparada, igual que el clic en las tarjetas de mapa_aer_onair. La
// herramienta no se publica, así que en el sitio público no se activa.
const ES_LOCAL = /^(127\.0\.0\.1|localhost|\[?::1\]?)$/.test(location.hostname);
function abrirUpdate(f){
  const q = new URLSearchParams();
  if(f.registration) q.set('matricula', String(f.registration).toUpperCase());
  if(f.callsign) q.set('callsign', String(f.callsign).toUpperCase());
  if(f.icao_type) q.set('tipo', String(f.icao_type).toUpperCase());
  if(f.icao24) q.set('hex', String(f.icao24).toUpperCase());
  q.set('auto', '1');
  window.open('tools/aer_manual.html?' + q.toString(), '_blank', 'noopener');
}
const daysBox = document.getElementById('days');
// Con Ctrl+Shift los links de la fila no navegan: el gesto es para el update.
daysBox.addEventListener('click', e => {
  if(ES_LOCAL && e.ctrlKey && e.shiftKey && e.target.closest('tr[data-k]'))
    e.preventDefault();
}, true);
daysBox.addEventListener('dblclick', e => {
  if(!ES_LOCAL || !e.ctrlKey || !e.shiftKey) return;
  const tr = e.target.closest('tr[data-k]');
  if(!tr) return;
  const f = (DATA.flights || []).find(x => rowKey(x) === tr.dataset.k);
  if(f) abrirUpdate(f);
});

// Los JSON se publican por snapshot: un pedido puede caer justo mientras el archivo
// se reescribe. Se reintenta 3 veces antes de dar el error (2 s entre intentos).
const JSON_TRIES = 3, JSON_RETRY_MS = 2000;
function getJson(name, tries){
  const total = tries || JSON_TRIES;
  return new Promise((resolve, reject) => {
    let intento = 0;
    const pedir = () => {
      intento++;
      fetch(name + '?_=' + Date.now(), {cache: 'no-store'})
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(resolve)
        .catch(err => {
          if(intento >= total) return reject(err);
          setTimeout(pedir, JSON_RETRY_MS);
        });
    };
    pedir();
  });
}

// La tabla semanal se recarga de semana.json (index.html no se regenera).
const WEEK_REFRESH_MS = 300000;   // 5 min
function mensajeSinDatos(){
  const days = document.getElementById('days');
  days.innerHTML =
    '<p class="na" style="text-align:center">Se están actualizando los datos de los vuelos · ' +
    '<a href="#" class="mlink" id="reintentar">Reintentar</a></p>';
  document.getElementById('foot').textContent = '';
  const a = document.getElementById('reintentar');
  if(a) a.addEventListener('click', ev => {
    ev.preventDefault();
    days.innerHTML = '<p class="na" style="text-align:center">Se están actualizando los datos de los vuelos…</p>';
    loadWeek(true);
    pollReportes();
  });
}
function loadWeek(first){
  getJson('semana.json')
    .then(j => { DATA = j || { flights: [] }; render(); })
    .catch(() => { if(first) mensajeSinDatos(); });
}
function tickReloj(){
  const d = new Date();
  const p = n => String(n).padStart(2, '0');      // dd/mm/aaaa con día y mes a 2 dígitos
  const fecha = p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
  document.getElementById('reloj').innerHTML = '<div class="fecha">' + fecha +
    '</div><div class="hora">' + d.toLocaleTimeString('es-AR', {hour12: false}) + '</div>';
}
tickReloj(); setInterval(tickReloj, 1000);

loadWeek(true);
setInterval(() => loadWeek(false), WEEK_REFRESH_MS);

// Bloque "Reportes": se refresca junto con la tabla semanal y con el bloque vivo.
const _p = new URLSearchParams(location.search);
const REPORT_REFRESH_MS = Math.max(10000, parseInt(_p.get('report') || '60000', 10) || 60000);
pollReportes();
setInterval(pollReportes, REPORT_REFRESH_MS);

// Bloque "Reportes": se recarga junto con la tabla semanal (misma ventana de días).
pollReportes();

// ---- Tooltip propio -------------------------------------------------------
// Los `title` nativos los dibuja el sistema (fondo celeste, fuera de la paleta).
// Acá se reemplazan por un globo con los colores del skin: al entrar en un
// elemento con `title` se copia el texto, se quita el atributo (para que no
// aparezca el nativo) y se muestra el globo; se restaura al salir.
(function(){
  const tip = document.createElement('div');
  tip.className = 'tip';
  document.body.appendChild(tip);
  let actual = null;
  const mover = ev => {
    tip.style.left = Math.min(ev.clientX + 12, window.innerWidth - tip.offsetWidth - 8) + 'px';
    tip.style.top = (ev.clientY + 16) + 'px';
  };
  document.addEventListener('mouseover', ev => {
    const el = ev.target.closest && ev.target.closest('[title]');
    if(!el || el === actual) return;
    if(actual) actual.setAttribute('title', actual.dataset.tipTxt || '');
    actual = el;
    el.dataset.tipTxt = el.getAttribute('title') || '';
    el.removeAttribute('title');
    tip.textContent = el.dataset.tipTxt;
    tip.style.display = 'block';
    mover(ev);
  });
  document.addEventListener('mousemove', ev => { if(actual) mover(ev); });
  document.addEventListener('mouseout', ev => {
    if(!actual) return;
    if(ev.relatedTarget && actual.contains(ev.relatedTarget)) return;
    actual.setAttribute('title', actual.dataset.tipTxt || '');
    actual = null;
    tip.style.display = 'none';
  });
})();
