const ICONS = {   // mismos íconos que aer/web/mapa.html (nariz hacia arriba)
  airliner:   { color: '#e8e8e8', rot: true,
    svg: '<path d="M12 1.6 L13.1 7.6 L22.4 13.1 L22.4 15.2 L13.1 12.3 L12.7 17.2 L15.9 20.2 L15.9 21.9 L12 20.4 L8.1 21.9 L8.1 20.2 L11.3 17.2 L10.9 12.3 L1.6 15.2 L1.6 13.1 L10.9 7.6 Z"/>' },
  bizjet:     { color: '#d4c9b0', rot: true,
    svg: '<path d="M12 2 L12.9 8.6 L20 13.4 L20 15 L12.9 12.6 L12.6 16.4 L14.8 18.6 L14.8 19.6 L12 18.4 L9.2 19.6 L9.2 18.6 L11.4 16.4 L11.1 12.6 L4 15 L4 13.4 L11.1 8.6 Z"/>'
       + '<rect x="9.7" y="13.1" width="1.3" height="3.2" rx="0.65"/><rect x="13" y="13.1" width="1.3" height="3.2" rx="0.65"/>' },
  cargo:      { color: '#c8a15a', rot: true,
    svg: '<path d="M12 1.6 L13.3 7.2 L22.4 12.9 L22.4 15 L13.3 12.2 L13.2 18.6 L16.2 20.4 L16.2 22 L12 20.7 L7.8 22 L7.8 20.4 L10.8 18.6 L10.7 12.2 L1.6 15 L1.6 12.9 L10.7 7.2 Z"/>' },
  military:   { color: '#d05a5a', rot: true,
    svg: '<path d="M12 1.5 L12.6 10 L21.5 16.5 L21.5 18 L12.6 14.2 L12.6 17.6 L15.4 20.2 L15.4 21.6 L12 20.3 L8.6 21.6 L8.6 20.2 L11.4 17.6 L11.4 14.2 L2.5 18 L2.5 16.5 L11.4 10 Z"/>' },
  light:      { color: '#a9c6d8', rot: true,
    svg: '<rect x="8.6" y="2.6" width="6.8" height="0.9" rx="0.45"/>'
       + '<path d="M12 3.4 L12.7 8.5 L19.6 12 L19.6 13.3 L12.7 11.4 L12.4 16 L14.6 18 L14.6 18.9 L12 17.9 L9.4 18.9 L9.4 18 L11.6 16 L11.3 11.4 L4.4 13.3 L4.4 12 L11.3 8.5 Z"/>' },
  turboprop:  { color: '#b6c9a5', rot: true,
    svg: '<rect x="8.6" y="2.4" width="6.8" height="0.9" rx="0.45"/>'
       + '<path d="M12 3.4 L12.7 8.5 L19.6 12 L19.6 13.3 L12.7 11.4 L12.4 16 L14.6 18 L14.6 18.9 L12 17.9 L9.4 18.9 L9.4 18 L11.6 16 L11.3 11.4 L4.4 13.3 L4.4 12 L11.3 8.5 Z"/>'
       + '<rect x="8.2" y="10.4" width="1.8" height="3" rx="0.9"/><rect x="14" y="10.4" width="1.8" height="3" rx="0.9"/>' },
  helicopter: { color: '#cfcfcf', rot: true,
    svg: '<rect x="2" y="3.2" width="20" height="1.1" rx="0.55"/>'
       + '<rect x="11.4" y="4.3" width="1.2" height="1.9"/>'
       + '<path d="M8.8 7.3 C8.8 6 10.2 5.2 12 5.2 C13.8 5.2 15.2 6 15.2 7.3 L15.2 12.3 C15.2 13.6 13.8 14.3 12 14.3 C10.2 14.3 8.8 13.6 8.8 12.3 Z"/>'
       + '<rect x="11.2" y="14" width="1.6" height="5.2"/>'
       + '<rect x="9" y="19" width="6" height="1.1" rx="0.55"/>' },
  seaplane:   { color: '#7fb4c8', rot: true,
    svg: '<path d="M12 1.8 L13 7.6 L22 13 L22 15 L13 12.3 L12.7 16.8 L15.7 19.6 L15.7 21.2 L12 19.8 L8.3 21.2 L8.3 19.6 L11.3 16.8 L11 12.3 L2 15 L2 13 L11 7.6 Z"/>'
       + '<rect x="6.4" y="16" width="1.7" height="6.4" rx="0.85"/><rect x="15.9" y="16" width="1.7" height="6.4" rx="0.85"/>' },
  gyrocopter: { color: '#b59ad6', rot: true,
    svg: '<rect x="2" y="4" width="20" height="1.1" rx="0.55"/>'
       + '<rect x="11.4" y="5.1" width="1.2" height="1.5"/>'
       + '<path d="M9.4 6.8 C9.4 5.8 10.4 5.2 12 5.2 C13.6 5.2 14.6 5.8 14.6 6.8 L14.6 11 C14.6 11.9 13.7 12.4 12 12.4 C10.3 12.4 9.4 11.9 9.4 11 Z"/>'
       + '<rect x="11.3" y="11.6" width="1.4" height="6"/>'
       + '<rect x="8.4" y="17.2" width="7.2" height="1.1" rx="0.55"/>' },
  ultralight: { color: '#b9c98a', rot: true,
    svg: '<path d="M12 2.5 L21.5 14 L12 11.4 L2.5 14 Z"/><rect x="10.9" y="12.4" width="2.2" height="3.6" rx="1.1"/>' },
  balloon:    { color: '#d98f8f', rot: false,
    svg: '<path d="M12 2 C7.3 2 4.5 5.8 4.5 9.6 C4.5 13.2 7.6 15.4 9.6 17.2 L14.4 17.2 C16.4 15.4 19.5 13.2 19.5 9.6 C19.5 5.8 16.7 2 12 2 Z"/>'
       + '<path d="M9.6 17.2 L10.1 19.4 M14.4 17.2 L13.9 19.4" stroke="currentColor" stroke-width="0.7" fill="none"/>'
       + '<rect x="10" y="19.4" width="4" height="3" rx="0.6"/>' },
  glider:     { color: '#9fb6c9', rot: false,
    svg: '<path d="M12 2 L12.6 11.2 L23 12.2 L23 13.2 L12.6 12.8 L12 21 L11.4 12.8 L1 13.2 L1 12.2 L11.4 11.2 Z"/>' },
  drone:      { color: '#8fb39a', rot: false,
    svg: '<path d="M12 12 L5 5 M12 12 L19 5 M12 12 L5 19 M12 12 L19 19" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/>'
       + '<circle cx="4.4" cy="4.4" r="2.5"/><circle cx="19.6" cy="4.4" r="2.5"/><circle cx="4.4" cy="19.6" r="2.5"/><circle cx="19.6" cy="19.6" r="2.5"/><circle cx="12" cy="12" r="2.4"/>' },
  paramotor:  { color: '#d4b483', rot: false,
    svg: '<path d="M3 9.5 C3 3.5 21 3.5 21 9.5 L18.6 9.5 C18.6 5.6 5.4 5.6 5.4 9.5 Z"/>'
       + '<path d="M6.2 9.5 L11 16 M17.8 9.5 L13 16" stroke="currentColor" stroke-width="0.7" fill="none"/>'
       + '<circle cx="12" cy="15.4" r="1.4"/><rect x="10.6" y="16" width="2.8" height="3.6" rx="1.2"/>' },
  unknown:    { color: '#8a8a8a', rot: false,
    svg: '<text x="12" y="17.2" text-anchor="middle" font-size="16" font-weight="700" font-family="monospace" fill="currentColor">?</text>' },
};
