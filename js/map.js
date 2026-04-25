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

// Tile layer managed by the Mapa admin panel (applyTileUrl called after JS loads)
// See: TILE_PRESETS / _mapaSettings / applyTileUrl() below


/* ═══════════════════════════════════════════
   MARKER FACTORY
═══════════════════════════════════════════ */
function catColor(cat) { return (CAT[cat]||{color:'#6055d8'}).color; }

function makePinHTML(poi) {
  const col = catColor(poi.category);
  if (poi.imgB64) {
    // PNG personalizado — se muestra directo sin pin-gota
    return `<div class="pin-wrap" id="pw-${poi.id}">
      <div class="pin-img-wrap">
        <div class="pin-img-ripple" style="background:${col}"></div>
        <img class="pin-img" src="${poi.imgB64}" alt="${poi.name}" draggable="false">
        <div class="pin-img-dot" style="background:${col}"></div>
      </div>
      <!-- label oculto, nombre solo en panel -->
    </div>`;
  }
  // Fallback emoji
  return `<div class="pin-wrap" id="pw-${poi.id}">
    <div class="pin-ripple" style="background:${col}"></div>
    <div class="pin-head" style="background:${col}">
      <span class="pin-emoji">${poi.icon}</span>
    </div>
    <!-- label oculto -->
  </div>`;
}

function makeMarker(poi) {
  const hasImg = !!poi.imgB64;
  const icon = L.divIcon({
    className: '',
    html: makePinHTML(poi),
    iconSize:   hasImg ? [44, 44] : [40, 40],
    iconAnchor: hasImg ? [22, 22] : [20, 20],
  });

  const m = L.marker([poi.lat, poi.lng], {
    icon,
    zIndexOffset: Math.round((90 + poi.lat) * -1000),
  }).addTo(map);

  // Use requestAnimationFrame to ensure Leaflet has rendered the marker DOM
  const _poiId = poi.id;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const el = document.getElementById('pw-' + _poiId);
      if (el && !el._clickBound) {
        el._clickBound = true;
        el.addEventListener('click', e => { e.stopPropagation(); pinClick(_poiId); });
      }
    });
  });

  markers[poi.id] = { m, poi };
}

function removeMarker(id) {
  if (markers[id]) { markers[id].m.remove(); delete markers[id]; }
}
