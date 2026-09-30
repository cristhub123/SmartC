/*
AI PROJECT NOTE — LECTURA OBLIGATORIA PARA CUALQUIER IA:
Antes de modificar este archivo, toda IA (Claude, ChatGPT u otra) DEBE
leer primero /AI_RULES.md completo. Sin excepcion, sin importar cuan
chico o simple parezca el cambio, y sin esperar a que el usuario lo
pida o lo recuerde — esta nota es la instruccion, no un recordatorio
opcional. Si /AI_RULES.md ya se leyo en esta misma sesion, alcanza con
revisar /AI_SESSION.md en su lugar.

Despues de modificar este archivo, actualizar /AI_SESSION.md con el
cambio hecho y la verificacion realizada.
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



