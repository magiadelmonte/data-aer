# Telemetry — Observatorio Uritorco

Snapshot público de los sobrevuelos detectados por el módulo **AER** del
Observatorio Uritorco sobre Capilla del Monte (Argentina), de los **últimos 5 días**.

El sitio es **estático** y `index.html` es siempre el mismo: los datos se cargan
por `fetch` desde dos JSON, que son lo único que se actualiza:

- **`semana.json`** — vuelos cerrados de los últimos 5 días (tabla por día).
- **`r1_live.json`** — vuelos que están ahora mismo dentro de R2 (radio de 50 km:
  incluye R1 y el anillo 25-50 km; bloque "Vuelos actuales"; se recarga cada 60 s).

La página se refresca sola: `r1_live.json` cada 60 s y `semana.json` cada 5 min.

Columnas de la tabla: **Hora · Duración · Vuelo · Aeronave · País · Distancia ·
Trayecto · FOV · Mapas**.

- **Distancia**: mínima del recorrido al centro (en verde si entró a R1, ≤ 25 km).
- **Trayecto**: orientación abreviada de entrada → salida (p. ej. `NO→SSE`).
- **FOV**: ✓ si el vuelo entró al encuadre de la cámara (azimut + altura + alcance).
- **Mapas**: **SAT** abre el mapa del trayecto; **FOV** (solo si el vuelo entró al
  sector azimutal de la cámara, aunque no se haya visto) abre la vista de la cámara
  (encuadre 16:9 con el contorno de las sierras), con el vuelo proyectado en
  azimut/elevación.

Datos generados automáticamente desde el servidor del observatorio (snapshot; no
es en vivo). Página servida por **GitHub Pages**.
