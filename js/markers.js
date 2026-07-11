/* markers.js — makeMarker, removeMarker */
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

/* ═══════════════════════════════════════════
   PIN INTERACTION
═══════════════════════════════════════════ */
function pinClick(id) {
  if (expandedId === id) { collapsePin(id); closePoiPanel(); return; }
  if (expandedId !== null) collapsePin(expandedId);
  expandPin(id);
  openPoiPanel(markers[id].poi);
  // Centrar pin: horizontalmente en pantalla, verticalmente en zona libre
  const _poi    = markers[id].poi;
  // Centro real del viewport (window, no mapa) para ignorar controles
  const _vw      = window.innerWidth;
  const _vh      = window.innerHeight;
  const _hdr     = 44;                         // header height px (reducido)
  const _filterH = 58;                         // filter bar height px
  const _freeH   = _vh - _hdr - _filterH;     // zona totalmente libre
  const _panelH  = _vh * 0.62;                // panel glass
  const _freeTop = _vh - _panelH;             // donde empieza el panel
  const _targetY = _hdr + (_freeTop - _hdr) * 0.5; // centro zona libre
  const _targetX = _vw * 0.5;                 // centro horizontal del viewport
  // Convertir targetX/Y a coordenadas de contenedor Leaflet
  const _mapContainer = map.getContainer().getBoundingClientRect();
  const _cTargetX = _targetX - _mapContainer.left;
  const _cTargetY = _targetY - _mapContainer.top;
  const _pinPx    = map.latLngToContainerPoint([_poi.lat, _poi.lng]);
  const _dx = _pinPx.x - _cTargetX;
  const _dy = _pinPx.y - _cTargetY;
  // Delay pan until after expand animation — prevents layout recalc during transition
  requestAnimationFrame(() => {
    setTimeout(() => {
      map.panBy([_dx, _dy], {animate: true, duration: .38, noMoveStart: true});
    }, 50);
  });
}
function expandPin(id) {
  expandedId = id;
  const el = document.getElementById('pw-' + id);
  if (el) {
    el.classList.add('big');
    // Leaflet sets z-index on the marker wrapper (.leaflet-marker-icon),
    // not on our inner div. We must override it there to beat other markers.
    const markerEl = el.parentElement;
    if (markerEl) {
      markerEl._prevZ = markerEl.style.zIndex;
      markerEl.style.zIndex = '99999';
      markerEl.style.setProperty('z-index', '99999', 'important');
    }
  }
}
function collapsePin(id) {
  const el = document.getElementById('pw-' + id);
  if (el) {
    el.classList.remove('big');
    const markerEl = el.parentElement;
    if (markerEl) {
      markerEl.style.zIndex = markerEl._prevZ || '';
      markerEl.style.removeProperty('z-index');
      delete markerEl._prevZ;
    }
  }
  if (expandedId === id) expandedId = null;
}



