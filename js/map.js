/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/* map.js — Leaflet init */
const map = L.map('map', {
  center: [-31.4167, -64.1833],
  zoom: 15,
  zoomControl: true,
  maxZoom: 19, minZoom: 12,
  attributionControl: false,
});
// Tiles loaded by map-settings.js after DOM ready

// [2026-09-02 — fix mapa en blanco en iPhone] Safari en iOS todavía tiene
// la toolbar/barra de direcciones visible en el instante en que Leaflet
// mide el contenedor por primera vez, así que arma su tamaño interno
// (y su grilla de tiles) para un viewport más chico del real. Sin este
// invalidateSize(), esa medición vieja queda pegada para siempre y el
// mapa se ve angosto arriba con el resto vacío. Se llama una vez con
// delay (para dar tiempo a que el layout/toolbar se asiente) y de nuevo
// en cada resize/orientationchange real (rotación, teclado, toolbar de
// Safari mostrándose/ocultándose).
setTimeout(() => map.invalidateSize(), 300);
window.addEventListener('resize', () => map.invalidateSize());
window.addEventListener('orientationchange', () => map.invalidateSize());
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => map.invalidateSize());
}



