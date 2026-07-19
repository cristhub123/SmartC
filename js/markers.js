/* markers.js — makeMarker, removeMarker */
/* ═══════════════════════════════════════════
   URLS DE IMAGEN CALCULADAS POR FÓRMULA (CLOUDINARY)
   ---------------------------------------------------
   No se "buscan" ni se guardan a mano — se arman con una fórmula
   fija a partir del slug del lugar. Si la imagen no existe todavía
   en Cloudinary, el <img onerror> se encarga de mostrar el emoji
   de respaldo en vez de romper el pin.
═══════════════════════════════════════════ */
function slugify(str) {
  return (str || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function getPoiSlug(poi) { return poi.slug || `${slugify(poi.name)}-cordoba`; }

function cloudinaryImageUrl(slug, { suffix = '', w, h } = {}) {
  const transform = (w && h) ? `c_scale,w_${w},h_${h}/` : '';
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${transform}${DEFAULT_IMG_FOLDER}/${slug}${suffix}.png`;
}

/* Resuelve qué URL de imagen mostrar para el PIN del mapa:
   1) si el lugar ya tiene imgB64 guardado a mano → se respeta tal cual
   2) si no, se arma la cadena completa de respaldo (ver utils.js) */
function resolvePinImageUrl(poi) {
  if (poi.imgB64) return [poi.imgB64];
  return buildImageFallbackChain(poi).map(url =>
    // La cadena base de utils.js no trae tamaño — acá se agrega
    // el recorte de 200x200 solo a las URLs calculadas por fórmula.
    url.replace('/image/upload/', '/image/upload/c_scale,w_200,h_200/')
  );
}

/* ═══════════════════════════════════════════
   MARKER FACTORY
═══════════════════════════════════════════ */
function catColor(cat) { return (CAT[cat]||{color:'#6055d8'}).color; }

function makePinHTML(poi) {
  const col = catColor(poi.category);
  const candidates = resolvePinImageUrl(poi);
  return `<div class="pin-wrap" id="pw-${poi.id}">
      <div class="pin-img-wrap">
        <div class="pin-img-ripple" style="background:${col}"></div>
        <img class="pin-img" data-candidates='${JSON.stringify(candidates)}' data-idx="0"
             src="${candidates[0]}" alt="${poi.name}" draggable="false">
        <span class="pin-emoji" style="display:none">${poi.icon || '📍'}</span>
        <div class="pin-img-dot" style="background:${col}"></div>
      </div>
      <!-- label oculto, nombre solo en panel -->
    </div>`;
}

/* Engancha el onerror en cadena a TODOS los pines del mapa después
   de renderizarlos (más prolijo que armar el atributo onerror a mano
   en el string de HTML). Se llama una vez por pin, en makeMarker. */
function wirePinImageFallback(id) {
  const el = document.querySelector(`#pw-${id} .pin-img`);
  if (!el) return;
  const candidates = JSON.parse(el.dataset.candidates || '[]');
  const emojiEl = document.querySelector(`#pw-${id} .pin-emoji`);
  attachImageFallbackChain(el, candidates, emojiEl);
}

function makeMarker(poi) {
  const icon = L.divIcon({
    className: '',
    html: makePinHTML(poi),
    iconSize:   [44, 44],
    iconAnchor: [22, 22],
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
      wirePinImageFallback(_poiId);
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



