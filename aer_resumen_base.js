// Helpers compartidos con `aer_mapa.js` para la pagina de resumen.
// `aer_mapa.js` los toma de `aer_tabla.js` en el listado; la pagina de resumen no
// carga la tabla (esa hoja pide semana.json, reportes y el reloj del index), asi
// que aca van las mismas funciones, con el mismo comportamiento.
// Va **antes** de aer_mapa.js: el setInterval de abajo usa WEEK_REFRESH_MS.

const toRad = d => d * Math.PI / 180;

function bearing(lat1, lon1, lat2, lon2){
  const f1 = toRad(lat1), f2 = toRad(lat2), dl = toRad(lon2 - lon1);
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function distKm(lat1, lon1, lat2, lon2){
  const R = 6371, dφ = toRad(lat2 - lat1), dλ = toRad(lon2 - lon1);
  const a = Math.sin(dφ/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dλ/2)**2;
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

// Los JSON se publican por snapshot: un pedido puede caer justo mientras el
// archivo se reescribe. Se reintenta 3 veces (2 s entre intentos), igual que
// en el listado.
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

const WEEK_REFRESH_MS = 300000;   // 5 min (el dia en curso se refresca solo)
