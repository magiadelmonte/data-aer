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
  const km = best.toFixed(1) + ' km';
  if(best <= DATA.r1_km)
    return '<span class="mark yes">✓</span> <span class="yes">' + km + '</span>';
  return '<span class="mark no">✗</span> <span class="no">' + km + '</span>';
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
function tipoCell(f){
  let tipo = f.type_label || f.icao_type || '';
  let cat = f.ac_type_label || '';
  if(!tipo){ tipo = cat; cat = ''; }
  if(cat) tipo += '<span class="cat">' + cat + '</span>';
  return tipo;
}

const HEAD = '<tr><th>Hora</th><th>Vuelo</th><th>Matrícula</th><th>Aeronave</th>' +
  '<th>País</th><th>Visible</th><th>FOV</th><th>Trayecto</th><th>Duración</th></tr>';

const rowKey = f => (f.callsign || f.icao24 || '') + '|' + (f.ts_start_iso || '');
function rowHtml(f, live){
  const flag = f.country
    ? '<img class="flag" src="https://flagcdn.com/w40/' + f.country +
      '.png" onerror="this.style.display=\'none\'">' : '';
  const pais = f.country_name_spa || f.country_name_eng || f.country || '';
  const dur = live
    ? durHMS(Math.max(0, Math.floor(Date.now() / 1000 - (f.ts_start || 0))))
    : durHMS(f.duration_sec);
  return '<tr data-k="' + rowKey(f).replace(/"/g, '&quot;') + '">' +
    '<td class="hora">' + hourMin(f.ts_start_iso) + '</td>' +
    '<td>' + (f.callsign || f.icao24 || '') + '</td>' +
    '<td>' + (f.registration || '') + '</td>' +
    '<td>' + tipoCell(f) + '</td>' +
    '<td>' + flag + pais + '</td>' +
    '<td>' + capillaInfo(f) + '</td>' +
    '<td class="fov">' + (f.fov ? '<span class="mark yes">✓</span>' : '') + '</td>' +
    '<td class="dir">' + orientInfo(f) + '</td>' +
    '<td class="dur">' + dur + '</td>' +
    '</tr>';
}

function daySection(key, flights, open){
  const rows = flights.map(f => rowHtml(f, false)).join('');
  const secCls = 'day' + (open ? ' open' : '') + (key === DATA.today ? ' today' : '');
  return '<section class="' + secCls + '" data-key="' + key + '"><h2 class="day-title toggle">' + fmtDay(key) + '</h2>' +
    '<div class="day-body"><table><thead>' + HEAD + '</thead>' +
    '<tbody>' + rows + '</tbody></table></div></section>';
}

let liveData = { flights: [] };
function renderLive(){
  const box = document.getElementById('live');
  const flights = (liveData && liveData.flights) || [];
  const body = flights.length
    ? '<table><thead>' + HEAD + '</thead><tbody>' +
        flights.map(f => rowHtml(f, true)).join('') + '</tbody></table>'
    : '<p class="empty">No hay vuelos sobrevolando Capilla del Monte en este momento</p>';
  box.innerHTML = '<section class="day open live">' +
    '<h2 class="day-title">Vuelos actuales<span class="live-dot"></span></h2>' +
    '<div class="day-body">' + body + '</div></section>';
  marcarFilas();
}
function pollLive(){
  fetch('r1_live.json?_=' + Date.now(), {cache: 'no-store'})
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(j => { liveData = j || { flights: [] }; renderLive(); })
    .catch(() => {});
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
  fetch('reportes.json?_=' + Date.now(), {cache: 'no-store'})
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
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
  document.getElementById('foot').innerHTML = meta +
    ' · <a href="https://www.youtube.com/@MagiaDelMonte">Observatorio Uritorco</a>';
  marcarFilas();
}

document.getElementById('days').addEventListener('click', e => {
  const t = e.target.closest('.day-title.toggle');
  if(t) t.parentElement.classList.toggle('open');
});

// La tabla semanal se recarga de semana.json (index.html no se regenera).
const WEEK_REFRESH_MS = 300000;   // 5 min
function loadWeek(first){
  fetch('semana.json?_=' + Date.now(), {cache: 'no-store'})
    .then(r => r.ok ? r.json() : Promise.reject(r.status))
    .then(j => { DATA = j || { flights: [] }; render(); })
    .catch(() => {
      if(first){
        document.getElementById('days').innerHTML =
          '<p class="na" style="text-align:center">No se pudieron cargar los datos (semana.json).</p>';
        document.getElementById('foot').textContent = '';
      }
    });
}
function tickReloj(){
  const d = new Date();
  document.getElementById('reloj').innerHTML = '<div class="fecha">' + d.toLocaleDateString('es-AR') +
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

// Bloque "Vuelos actuales": recarga r1_live.json cada LIVE_REFRESH_MS (def. 60 s).
// Se puede ajustar con ?live=<ms> en la URL (mínimo 10 s).
const LIVE_REFRESH_MS = Math.max(10000, parseInt(_p.get('live') || '60000', 10) || 60000);
pollLive();
setInterval(pollLive, LIVE_REFRESH_MS);

// Bloque "Reportes": se recarga junto con la tabla semanal (misma ventana de días).
pollReportes();
