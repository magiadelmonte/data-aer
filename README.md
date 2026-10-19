# Telemetry — Observatorio Uritorco

Snapshot público de los sobrevuelos detectados por el módulo **AER** del
Observatorio Uritorco sobre Capilla del Monte (Argentina), de los **últimos 5 días**.

El sitio es **estático** y `index.html` es siempre el mismo: los datos se cargan
por `fetch` desde dos JSON, que son lo único que se actualiza:

- **`semana.json`** — vuelos cerrados de los últimos 5 días (tabla por día).
- **`r1_live.json`** — vuelos que están ahora mismo dentro de R1 (bloque
  "Vuelos actuales"; se recarga cada 60 s).

La página se refresca sola: `r1_live.json` cada 60 s y `semana.json` cada 5 min.

Columnas de la tabla:

- **Visible**: ✓ si el recorrido del vuelo entró al radio R1 (≤ 25 km del centro);
  ✗ con la distancia mínima al centro si no.
- **Trayecto**: orientación abreviada de entrada → salida (p. ej. `NO→SSE`).
- **Duración**: tiempo registrado entre la detección y el cierre del vuelo.

Datos generados automáticamente desde el servidor del observatorio (snapshot; no
es en vivo). Página servida por **GitHub Pages**.
