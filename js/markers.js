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

/* Cadena de candidatos en CALIDAD ORIGINAL (sin ningún recorte de
   tamaño) — es la base tanto del thumb del pin (se le agrega el
   recorte 150x150 aparte, ver toThumbCandidateUrl) como de la
   imagen full-quality que se muestra al maximizar el pin (ver
   swapPinToFullQuality). Mismo orden de respaldo que antes. */
function resolvePinImageCandidates(poi) {
  if (poi.imgB64) return [poi.imgB64];
  return buildImageFallbackChain(poi, { forMap: true });
}

function toThumbCandidateUrl(url) {
  return url.includes('res.cloudinary.com')
    ? url.replace('/image/upload/', '/image/upload/c_fill,g_auto,w_150,h_150/')
    : url;
}

/* Resuelve qué URL de imagen mostrar para el PIN del mapa (versión
   chica, la que queda puesta siempre que el pin no está maximizado):
   1) si el lugar ya tiene imgB64 guardado a mano → se respeta tal cual
   2) si no, se arma la cadena completa de respaldo (ver utils.js)
   En los 2 casos se le aplica el recorte 150x150 con c_fill,g_auto
   (recorte inteligente a cuadrado) — chequeando que sea una URL de
   Cloudinary antes de tocarla, para no romper una URL externa que
   no soporte transformaciones. */
function resolvePinImageUrl(poi) {
  return resolvePinImageCandidates(poi).map(toThumbCandidateUrl);
}

/* ═══════════════════════════════════════════
   SWAP A CALIDAD FULL AL MAXIMIZAR EL PIN
   ---------------------------------------------
   [2026-08-14] El pin en el mapa SIEMPRE usa el thumb 150x150 (buen
   rendimiento con muchos pines a la vez). El problema encontrado:
   al maximizar un pin (.pin-wrap.big, transform:scale(3.2)), ese
   mismo thumb de 150x150 quedaba estirado 3.2x — de ahí la imagen
   borrosa/pixelada que reportó Cris, no era la imagen full la que
   se mostraba, era el thumb agrandado por CSS.
   Fix: al maximizar, se precarga (fuera del DOM) la URL full-quality
   del MISMO candidato que terminó mostrándose como thumb (mismo
   índice de la cadena de respaldo, ver dataset.idx en
   attachImageFallbackChain de utils.js) y recién cuando esa carga
   termina se reemplaza el <img> real por esa URL — el thumb sigue
   visible mientras tanto, así nunca hay un parpadeo a roto/vacío.
   Al colapsar el pin, se vuelve al thumb 150x150 (la idea explícita
   de Cris: el pin en reposo siempre queda liviano). */
function swapPinToFullQuality(id) {
  const el = document.querySelector(`#pw-${id} .pin-img`);
  if (!el || el.dataset.qualitySwapped === 'full') return;
  let fullCandidates = [];
  try { fullCandidates = JSON.parse(el.dataset.fullCandidates || '[]'); } catch (e) { /* noop */ }
  const idx = parseInt(el.dataset.idx || '0', 10);
  const fullUrl = fullCandidates[idx];
  if (!fullUrl) return;
  const preload = new Image();
  preload.onload = () => {
    // Si mientras cargaba el usuario ya cerró este pin o abrió otro,
    // no lo reemplazamos — evita pisar el thumb de un pin distinto.
    if (typeof expandedId === 'undefined' || expandedId !== id) return;
    if (!el.dataset.thumbSrc) el.dataset.thumbSrc = el.src;
    el.src = fullUrl;
    el.dataset.qualitySwapped = 'full';
  };
  preload.src = fullUrl;
}

function restorePinThumbQuality(id) {
  const el = document.querySelector(`#pw-${id} .pin-img`);
  if (!el || el.dataset.qualitySwapped !== 'full') return;
  if (el.dataset.thumbSrc) el.src = el.dataset.thumbSrc;
  delete el.dataset.qualitySwapped;
}

/* ═══════════════════════════════════════════
   MARKER FACTORY
═══════════════════════════════════════════ */
function catColor(cat) { return (CAT[cat]||{color:'#6055d8'}).color; }

function makePinHTML(poi) {
  const col = catColor(poi.category);
  const fullCandidates  = resolvePinImageCandidates(poi);
  const thumbCandidates = fullCandidates.map(toThumbCandidateUrl);
  return `<div class="pin-wrap" id="pw-${poi.id}">
      <div class="pin-img-wrap">
        <div class="pin-img-ripple" style="background:${col}"></div>
        <img class="pin-img" data-candidates='${JSON.stringify(thumbCandidates)}' data-full-candidates='${JSON.stringify(fullCandidates)}' data-idx="0"
             src="${thumbCandidates[0] || ''}" alt="${poi.name}" draggable="false">
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
        el.addEventListener('click', e => {
          e.stopPropagation();
          console.log('[markers.js] click detectado en el pin', _poiId); // [2026-08-15] diagnóstico temporal
          pinClick(_poiId);
        });
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
  swapPinToFullQuality(id);
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
  restorePinThumbQuality(id);
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



