// Íconos de aeronave del mapa: un SVG por categoría en `img/aer_icons/`, con el
// **mismo nombre** que el campo `icon` de la tabla `aer_icon` (aircraft.db).
// Los SVG son siluetas negras vistas desde arriba y nariz hacia arriba: el mapa
// las usa como máscara y las pinta con `color` (así un solo archivo sirve para
// cualquier tema). `rot`: se gira al rumbo del vuelo en el punto final.
const ICON_DIR = 'img/aer_icons';
const ICONS = {
  airliner:   { color: '#e8e8e8', rot: true },
  bizjet:     { color: '#d4c9b0', rot: true },
  cargo:      { color: '#c8a15a', rot: true },
  military:   { color: '#8fbf6a', rot: true },
  c130:       { color: '#8fbf6a', rot: true },   // Hercules (transporte militar)
  f16:        { color: '#8fbf6a', rot: true },   // caza
  light:      { color: '#a9c6d8', rot: true },
  turboprop:  { color: '#b6c9a5', rot: true },
  helicopter: { color: '#cfcfcf', rot: true },
  seaplane:   { color: '#7fb4c8', rot: true },
  gyrocopter: { color: '#b59ad6', rot: true },
  ultralight: { color: '#b9c98a', rot: true },
  balloon:    { color: '#d98f8f', rot: false },
  glider:     { color: '#9fb6c9', rot: false },
  drone:      { color: '#8fb39a', rot: false },
  paramotor:  { color: '#d4b483', rot: false },
  unknown:    { color: '#8a8a8a', rot: false },
};
