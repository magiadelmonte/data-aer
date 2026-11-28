// Pagina de resumen de un vuelo (`aer_resumen.html?k=<callsign>|<ts_start_iso>`).
// Muestra el mapa SAT del trayecto (izquierda), el mapa FOV (derecha arriba), la
// foto y todos los datos del vuelo y de la aeronave. Reusa el motor de dibujo del
// listado (`aer_mapa.js`): mapa SAT, FOV, hover y cielo nocturno son los mismos.

const Q = new URLSearchParams(location.search);
const CLAVE = Q.get('k') || '';
const esc2 = s => String(s == null ? '' : s).replace(/[&<>"]/g,
  c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const num = (v, dec) => v == null || v === '' || isNaN(+v) ? null
  : (+v).toLocaleString('es-AR', {minimumFractionDigits: dec || 0,
                                  maximumFractionDigits: dec || 0});
const siNo = v => v ? 'Sí' : 'No';

function durHMS(sec){
  if(sec == null || isNaN(+sec)) return null;
  sec = Math.round(+sec);
  const p = n => String(n).padStart(2, '0');
  return Math.floor(sec / 3600) + ':' + p(Math.floor(sec % 3600 / 60)) + ':' + p(sec % 60);
}
const hhmm = iso => {
  const m = /T(\d{2}):(\d{2})/.exec(iso || '');
  return m ? m[1] + ':' + m[2] : null;
};
const bandera = (c, alto) => /^[a-z]{2}$/i.test(String(c || ''))
  ? '<img class="flag" src="https://flagcdn.com/w' + (alto ? 40 : 20) + '/' +
    String(c).toLowerCase() + '.png" onerror="this.style.display=\'none\'">' : '';

function fila(etiqueta, valor){
  return '<tr><th>' + esc2(etiqueta) + '</th><td>' +
    (valor == null || valor === '' ? '<span class="na">—</span>' : valor) + '</td></tr>';
}
function bloque(titulo, filas){
  return '<section class="rbloque"><h2>' + esc2(titulo) + '</h2>' +
    '<table class="rtabla"><tbody>' + filas.join('') + '</tbody></table></section>';
}
function mensaje(texto){
  const m = document.getElementById('rmensaje');
  m.hidden = false;
  m.textContent = texto;
}

function pintarCabecera(d, f){
  const tipo = d.ac_type_label || d.type_label || f.ac_type_label || f.type_label || '';
  const reg = d.registration || f.registration || '';
  document.getElementById('rtit').textContent =
    (f.callsign || f.icao24 || 'Vuelo') + (reg ? ' · ' + reg : '');
  document.getElementById('rsub').textContent =
    [tipo, fechaHora(d.ts_paso_iso || f.ts_paso_iso || d.ts_start_iso || f.ts_start_iso)]
      .filter(Boolean).join(' · ');
  const fa = document.getElementById('rfa');
  const id = f.callsign || f.icao24 || '';
  if(id){
    fa.href = 'https://www.flightaware.com/live/flight/' + encodeURIComponent(id);
    fa.hidden = false;
  }
}

function pintarFoto(d, f){
  const box = document.getElementById('rfoto');
  const ph = d.photo || f.photo || null;
  const url = ph && (ph.url || ph.thumb);
  box.innerHTML = url
    ? '<img src="' + esc2(url) + '" alt="Foto de la aeronave">'
    : '<div class="rplaceholder">sin foto</div>';
  if(url) box.classList.remove('vacia');
  else box.classList.add('vacia');
}

function pintarDatos(d, f){
  const fa = d.fa || f.fa || {};
  const ac = d.ac_detail || {};
  const origen = fa.origin || {}, destino = fa.destination || {};
  const pais = d.country_name || f.country_name_spa || f.country_name_eng || fa.country_name ||
    d.country || f.country || '';
  const nombrePunto = p => {
    if(!p || (!p.iata && !p.icao && !p.name)) return null;
    const cod = p.iata || p.icao || '';
    const nom = p.name || p.municipality || '';
    return bandera(p.country) + (cod ? '<b>' + esc2(cod) + '</b>' : '') +
      (nom ? ' · ' + esc2(nom) : '');
  };
  const zona = d.zone || f.zone;
  const fovTxt = (d.fov_az || f.fov_az)
    ? siNo(true) + (d.fov === false ? ' (pasó por el sector, fuera del encuadre)' : '')
    : siNo(!!(d.fov || f.fov));
  const vuelo = [
    fila('Inicio', fechaHora(d.ts_start_iso || f.ts_start_iso)),
    fila('Fin', (d.ts_end_iso || f.ts_end_iso)
      ? fechaHora(d.ts_end_iso || f.ts_end_iso) : 'en vuelo'),
    fila('Paso por la zona', fechaHora(d.ts_paso_iso || f.ts_paso_iso)),
    fila('Duración', durHMS(d.duration_sec != null ? d.duration_sec
      : f.duration_sec)),
    fila('Zona', zona ? 'R' + zona : null),
    fila('Distancia mínima', d.min_dist_km != null
      ? num(d.min_dist_km, 1) + ' km' : null),
    fila('En FOV', fovTxt),
    fila('Puntos', num(d.n_points != null ? d.n_points
      : (f.path || []).length)),
    fila('Altura máxima', d.alt_max_m != null ? num(Math.round(d.alt_max_m)) + ' m' : null),
    fila('Fuente', d.source || null),
    fila('País', pais ? bandera(d.country || f.country) + esc2(pais) : null),
  ];
  const ruta = [
    fila('Aerolínea', fa.airline && fa.airline.name
      ? esc2(fa.airline.name) + (fa.airline.iata ? ' (' + esc2(fa.airline.iata) + ')' : '')
      : (fa.iata ? esc2(fa.iata) : null)),
    fila('Origen', nombrePunto(origen)),
    fila('Destino', nombrePunto(destino)),
    fila('Despegue', hhmm(fa.takeoff)),
    fila('Aterrizaje', hhmm(fa.landing)),
    fila('Estado', fa.status || null),
  ];
  const avion = [
    fila('Matrícula', d.registration || f.registration
      ? '<span class="reg">' + esc2(d.registration || f.registration) + '</span>' : null),
    fila('Tipo', d.type_label || f.type_label || null),
    fila('Modelo', ac.model ? esc2(ac.manufacturer ? ac.manufacturer + ' ' + ac.model
      : ac.model) : null),
    fila('Código ICAO', d.icao_type || f.icao_type || null),
    fila('Categoría', [d.ac_type_label || f.ac_type_label, d.category_label]
      .filter(Boolean).join(' · ') || null),
    fila('Peso', d.class_label || null),
    fila('Motor', [ac.engine_type, ac.engine_count ? ac.engine_count + '×' : null]
      .filter(Boolean).join(' ') || d.engine_class || null),
    fila('Estela (WTC)', ac.wtc || null),
    fila('Segmento', d.jet_segment || null),
    fila('Hex', d.icao24 || f.icao24 || null),
    fila('Foto', d.photo && d.photo.source
      ? '<a class="ext" href="' + esc2(d.photo.url || d.photo.thumb || '#') +
        '" target="_blank" rel="noopener">' + esc2(d.photo.source) + '</a>' : null),
  ];
  document.getElementById('rbloques').innerHTML =
    bloque('Vuelo', vuelo) + bloque('Ruta', ruta) + bloque('Aeronave', avion);
}

function arrancar(){
  if(!CLAVE){ mensaje('Falta el vuelo: abrí el resumen desde la columna Mapas del listado.'); return; }
  const iso = String(CLAVE).split('|')[1] || '';
  const dia = dayKey(iso);
  if(!dia){ mensaje('La clave del vuelo no tiene fecha.'); return; }
  const ymd = dia.replace(/-/g, '');
  Promise.all([
    getJson('trayectos_' + ymd + '.json').catch(() => null),
    getJson('detalle_' + ymd + '.json').catch(() => null),
  ]).then(([tr, dt]) => {
    if(!tr){ mensaje('No está publicado el día de este vuelo.'); return; }
    const f = (tr.flights || []).find(x => x.k === CLAVE) ||
      (tr.flights || []).find(x => String(x.k).split('|')[1] === iso);
    if(!f){ mensaje('Ese vuelo no está en el snapshot publicado.'); return; }
    const d = (dt && dt.flights && (dt.flights[CLAVE] || dt.flights[f.k])) || {};
    // La hora del vuelo (epoch) la usa el cielo nocturno del FOV.
    if(d.ts_start && !f.ts_start) f.ts_start = d.ts_start;
    // El `fov_az` viaja en los trayectos nuevos; si el JSON es viejo, lo trae el
    // detalle (es el que decide si se dibuja el mapa FOV).
    if(d.fov_az != null) f.fov_az = d.fov_az;
    if(d.fov != null) f.fov = d.fov;
    TRAJ = tr;
    MACTUAL = f;
    pintarCabecera(d, f);
    pintarFoto(d, f);
    pintarDatos(d, f);
    dibujarMapas(f);
  }).catch(() => mensaje('No se pudieron cargar los datos del vuelo.'));
}

function dibujarMapas(f){
  // Mapa SAT: el mismo del modal (anillos, sector FOV, trayecto y avión).
  MMAP = initMapa('mmap');
  MMAP_READY.then(() => {
    if(MACTUAL !== f) return;
    MMAP.resize();
    dibujarTrayecto(f);
    encuadrar('sat');
  });
  // Mapa FOV: si el vuelo no cruzó el sector, queda el aviso.
  const caja = document.getElementById('rfovbox');
  if(f.fov_az && TRAJ.fov){
    MFOV_ON = true;
    requestAnimationFrame(() => { if(MACTUAL === f) dibujarFov(f); });
  } else {
    caja.classList.add('sinfov');
    document.getElementById('rfovmsg').hidden = false;
  }
  window.addEventListener('resize', () => {
    if(MMAP) MMAP.resize();
    if(f.fov_az && TRAJ.fov) requestAnimationFrame(() => dibujarFov(f));
  });
}

arrancar();
