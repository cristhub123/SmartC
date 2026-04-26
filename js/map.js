/* map.js — Leaflet init */
/* ═══════════════════════════════════════════
   MAP — OpenStreetMap tiles (calles reales + nombres)
═══════════════════════════════════════════ */
const map = L.map('map', {
  center: [-31.4167, -64.1833],
  zoom: 15,
  zoomControl: true,
  maxZoom: 19, minZoom: 12,
  attributionControl: false,
});

// Tile layer con múltiples fallbacks
const tileProviders = [
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
];

let tileLayerLoaded = false;
let currentProviderIdx = 0;

function tryTileProvider(idx) {
  if (idx >= tileProviders.length) return;
  const layer = L.tileLayer(tileProviders[idx], {
    subdomains: 'abcd',
    maxZoom: 19,
    crossOrigin: true,
  });
  layer.on('tileerror', () => {
    if (!tileLayerLoaded) {
      map.removeLayer(layer);
      tryTileProvider(idx + 1);
    }
  });
  layer.on('tileload', () => { tileLayerLoaded = true; });
  layer.addTo(map);
}
tryTileProvider(0);
