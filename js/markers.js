/* markers.js — makeMarker, removeMarker */
/* ═══════════════════════════════════════════
   URLS DE IMAGEN — SOLO LO REALMENTE GUARDADO
   ---------------------------------------------------
   [LIMPIEZA 2026-08-12] Antes esta URL se "adivinaba" con una fórmula
   fija (carpeta vieja `ar/cordoba`, extensión `.png`, sufijos con
   guion tipo `-alt1`) que YA NO coincide con la convención definitiva
   de Cloudinary (`smartcity/media/{país}/{prov}/{ciudad}/images/
   {slug}_{skin}_{NN}.{ext}`). Esa fórmula quedó eliminada del todo:
   ahora el mapa solo usa URLs reales ya guardadas en el POI
   (`poi.imgB64` o `poi.skins[...].url`, ver buildImageFallbackChain
   en utils.js). Si no hay ninguna URL guardada, se muestra el emoji
   de respaldo directamente — nunca se inventa una URL que puede
   apuntar a un lugar equivocado de Cloudinary.
═══════════════════════════════════════════ */
function slugify(str) {
  return (str || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/* Resuelve qué URL de imagen mostrar para el PIN del mapa:
   1) si el lugar ya tiene imgB64 guardado a mano → se respeta tal cual
   2) si no, se arma la cadena completa de respaldo (ver utils.js) */
function resolvePinImageUrl(poi) {
  // ANTES: esta rama devolvía `poi.imgB64` tal cual, sin ningún recorte
  // de tamaño — como casi todos los lugares ya tienen `imgB64` seteado
  // (es la URL real de Cloudinary desde la corrección de utils.js, ver
  // notas del proyecto), el pin del mapa terminaba pidiendo siempre la
  // foto en su resolución original. Con 2 lugares no se nota; con 100+
  // sería un problema real de rendimiento. Ahora se le aplica el mismo
  // recorte 150x150 que a la cadena de respaldo, con c_fill,g_auto
  // (recorte inteligente a cuadrado, en vez de solo escalar) — y se
  // chequea que sea una URL de Cloudinary antes de tocarla, para no
  // romper el caso de una URL externa que no soporte transformaciones.
  if (poi.imgB64) {
    const url = poi.imgB64.includes('res.cloudinary.com')
      ? poi.imgB64.replace('/image/upload/', '/image/upload/c_fill,g_auto,w_150,h_150/')
      : poi.imgB64;
    return [url];
  }
  return buildImageFallbackChain(poi, { forMap: true }).map(url =>
    // La cadena base de utils.js no trae tamaño — acá se agrega
    // el recorte de 150x150 solo a las URLs calculadas por fórmula.
    url.replace('/image/upload/', '/image/upload/c_fill,g_auto,w_150,h_150/')
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
   [NOTA] Esta pinClick() nunca se ejecuta en la práctica: js/cluster.js
   declara una función global con el mismo nombre y carga después en
   index.html, así que esa es la que realmente atiende el click (ver
   window.pinClick al final de cluster.js). Se deja acá sin borrar para
   no romper nada que dependa de ella indirectamente, pero el código
   real a tocar para el comportamiento de click en un pin es cluster.js.
═══════════════════════════════════════════ */
function pinClick(id) {
  if (expandedId === id) { collapsePin(id); closePoiPanel(); return; }
  if (expandedId !== null) collapsePin(expandedId);
  expandPin(id);
  openPoiPanel(markers[id].poi);
  // Centrado simple y directo en las coordenadas exactas del pin —
  // sin cálculos de "zona libre" (ver nota en app.js/panToPoiCenter).
  requestAnimationFrame(() => {
    setTimeout(() => panToPoiCenter(markers[id].poi), 50);
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



