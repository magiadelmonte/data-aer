// Pagina de resumen de un vuelo (`aer_resumen.html?k=<callsign>|<ts_start_iso>`).
// Muestra el mapa SAT del trayecto (izquierda), el mapa FOV (derecha arriba), la
// foto y los datos del vuelo y de la aeronave en una grilla 2x2. Reusa el motor de
// dibujo del listado (`aer_mapa.js`): mapa SAT, FOV, hover y cielo nocturno.

const Q = new URLSearchParams(location.search);
const CLAVE = Q.get('k') || '';
const esc2 = s => String(s == null ? '' : s).replace(/[&<>"]/g,
  c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const num = (v, dec) => v == null || v === '' || isNaN(+v) ? null
  : (+v).toLocaleString('es-AR', {minimumFractionDigits: dec || 0,
                                  maximumFractionDigits: dec || 0});
const hhmm = iso => {
  const m = /T(\d{2}):(\d{2})/.exec(iso || '');
  return m ? m[1] + ':' + m[2] : null;
};
const bandera = c => /^[a-z]{2}$/i.test(String(c || ''))
  ? '<img class="flag" src="https://flagcdn.com/w20/' + String(c).toLowerCase() +
    '.png" onerror="this.style.display=\'none\'">' : '';

function fila(etiqueta, valor){
  return '<tr><th>' + esc2(etiqueta) + '</th><td>' +
    (valor == null || valor === '' ? '<span class="na">—</span>' : valor) + '</td></tr>';
}
function bloque(titulo, filas){
  return '<h2>' + esc2(titulo) + '</h2>' +
    '<table class="rtabla"><tbody>' + filas.join('') + '</tbody></table>';
}
function mensaje(texto){
  const m = document.getElementById('rmensaje');
  m.hidden = false;
  m.textContent = texto;
}

function pintarFoto(d, f){
  const box = document.getElementById('rfoto');
  const ph = d.photo || f.photo || null;
  const url = ph && (ph.url || ph.thumb);
  box.innerHTML = url
    ? '<img src="' + esc2(url) + '" alt="Foto de la aeronave">'
    : '<div class="rplaceholder">sin foto</div>';
}

function pintarDatos(d, f){
  const fa = d.fa || f.fa || {};
  const ac = d.ac_detail || {};
  const origen = fa.origin || {}, destino = fa.destination || {};
  const pais = d.country_name || f.country_name_spa || f.country_name_eng ||
    d.country || f.country || '';
  const nombrePunto = p => {
    if(!p || (!p.iata && !p.icao && !p.name)) return null;
    const cod = p.iata || p.icao || '';
    const nom = p.name || p.municipality || '';
    return bandera(p.country) + (cod ? '<b>' + esc2(cod) + '</b>' : '') +
      (nom ? ' · ' + esc2(nom) : '');
  };
  const modelo = ac.model
    ? (ac.manufacturer ? ac.manufacturer + ' ' + ac.model : ac.model)
    : (d.type_label || d.icao_type || f.type_label || null);
  const motor = [ac.engine_type, ac.engine_count ? ac.engine_count + '×' : null]
    .filter(Boolean).join(' ') || d.engine_class || null;
  const mp = d.min_point || {};
  const alt = mp.alt_m == null ? null : num(Math.round(mp.alt_m)) + ' m';
  const gr = mp.elev_deg == null ? null : num(mp.elev_deg, 1) + '°';
  const altitud = alt ? alt + (gr ? ' (' + gr + ')' : '') : null;
  const paso = d.fov_in
    ? (d.fov_in + (d.fov_out && d.fov_out !== d.fov_in ? ' – ' + d.fov_out : ''))
    : null;

  document.getElementById('raeronave').innerHTML = bloque('Aeronave', [
    fila('Matrícula', d.registration || f.registration || null),
    fila('Modelo', modelo),
    fila('Categoría', d.category_label || null),
    fila('Motor', motor),
    fila('País', pais ? bandera(d.country || f.country) + esc2(pais) : null),
  ]);
  document.getElementById('rvuelo').innerHTML = bloque('Vuelo', [
    fila('Inicio', fechaHora(d.ts_start_iso || f.ts_start_iso)),
    fila('Fin', (d.ts_end_iso || f.ts_end_iso)
      ? fechaHora(d.ts_end_iso || f.ts_end_iso) : 'en vuelo'),
    fila('Paso por FOV', paso),
    fila('Distancia mínima', d.min_dist_km != null
      ? num(d.min_dist_km, 1) + ' km' : null),
    fila('Altitud', altitud),
  ]);
  document.getElementById('rruta').innerHTML = bloque('Ruta', [
    fila('Aerolínea', fa.airline && fa.airline.name
      ? esc2(fa.airline.name) + (fa.airline.iata ? ' (' + esc2(fa.airline.iata) + ')' : '')
      : (fa.iata ? esc2(fa.iata) : null)),
    fila('Origen', nombrePunto(origen)),
    fila('Despegue', hhmm(fa.takeoff)),
    fila('Destino', nombrePunto(destino)),
    fila('Aterrizaje', hhmm(fa.landing)),
  ]);
}

// Mapa SAT: el mismo del modal (anillos, sector FOV, trayecto y avión).
function dibujarSat(f){
  MMAP = initMapa('mmap');
  MMAP_READY.then(() => {
    if(MACTUAL !== f) return;
    MMAP.resize();
    dibujarTrayecto(f);
    encuadrar('sat');
  });
}

// Mapa FOV: si el vuelo no cruzó el sector, queda el aviso. El dibujo en sí es
// el de `aer_mapa.js` (mismo motor que el modal).
function pintarFovVuelo(f){
  const caja = document.getElementById('rfovbox');
  if(!(f.fov_az && TRAJ.fov)){
    caja.classList.add('sinfov');
    document.getElementById('rfovmsg').hidden = false;
    return;
  }
  caja.classList.remove('sinfov');
  document.getElementById('rfovmsg').hidden = true;
  MFOV_ON = true;
  requestAnimationFrame(() => { if(MACTUAL === f) dibujarFov(f); });
}

function arrancar(){
  if(!CLAVE){
    mensaje('Falta el vuelo: abrí el resumen desde la columna Mapas del listado.');
    return;
  }
  const iso = String(CLAVE).split('|')[1] || '';
  const dia = dayKey(iso);
  if(!dia){ mensaje('La clave del vuelo no tiene fecha.'); return; }
  const ymd = dia.replace(/-/g, '');
  const trayectos = getJson('trayectos_' + ymd + '.json');
  // El detalle puede faltar (día viejo): un solo intento y se sigue con lo básico.
  const detalle = getJson('detalle_' + ymd + '.json', 1).catch(() => null);

  trayectos.then(tr => {
    const f = (tr.flights || []).find(x => x.k === CLAVE) ||
      (tr.flights || []).find(x => String(x.k).split('|')[1] === iso);
    if(!f){ mensaje('Ese vuelo no está en el snapshot publicado.'); return; }
    TRAJ = tr;
    MACTUAL = f;
    document.title = (f.callsign || 'Vuelo') + ' · Resumen | Estación de rastreo aéreo';
    // El mapa y el FOV salen con el primer JSON; los datos llegan enseguida.
    dibujarSat(f);
    pintarFovVuelo(f);
    window.addEventListener('resize', () => {
      if(MMAP) MMAP.resize();
      if(f.fov_az && TRAJ.fov) requestAnimationFrame(() => dibujarFov(f));
    });
    detalle.then(dt => {
      const d = (dt && dt.flights && (dt.flights[CLAVE] || dt.flights[f.k])) || {};
      if(d.ts_start && !f.ts_start) f.ts_start = d.ts_start;
      // El `fov_az` viaja en los trayectos nuevos; si el JSON es viejo, lo trae el
      // detalle (es el que decide si se dibuja el mapa FOV).
      const teniaFov = !!(f.fov_az && TRAJ.fov);
      if(d.fov_az != null) f.fov_az = d.fov_az;
      if(d.fov != null) f.fov = d.fov;
      pintarFoto(d, f);
      pintarDatos(d, f);
      if(!teniaFov && f.fov_az && TRAJ.fov) pintarFovVuelo(f);
    });
  }).catch(() => mensaje('No se pudieron cargar los datos del vuelo.'));
}

arrancar();
