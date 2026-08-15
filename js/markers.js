/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

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
    // [2026-08-15] Si mientras cargaba el usuario ya usó el ojito para
    // pasar a otra imagen (ver cyclePinExpandedImage), no lo pisamos —
    // esta carga era solo para mostrar la primera (main) al maximizar,
    // y llegar tarde no debe retroceder la que el usuario ya eligió.
    if (el.dataset.userCycled === '1') return;
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
  // [2026-08-15] Limpieza del estado del ojito (ver cyclePinExpandedImage)
  // para que la próxima vez que se maximice este pin arranque de nuevo
  // en la primera imagen (main), no donde había quedado la vez anterior.
  delete el.dataset.userCycled;
  delete el.dataset.skinIndex;
}

/* ═══════════════════════════════════════════
   OJITO 👁 — RECORRE LAS IMÁGENES ACTIVAS SOBRE EL PIN MAXIMIZADO
   ---------------------------------------------
   [NUEVO 2026-08-15] Antes el ojito cambiaba la imagen "hero" del
   panel (js/poi-panel.js) — eso quedó descartado: el panel ahora
   tiene su propia imagen banner, independiente (poi.banner.url, ver
   utils.js). El ojito pasó a controlar la imagen MAXIMIZADA del pin
   en el mapa (el mismo recuadro que agranda swapPinToFullQuality):
   cada click avanza a la siguiente imagen ACTIVA del lugar (mismo
   criterio que getActiveSkinList — respeta el toggle "Imagen activa"
   de cada slot en js/img-slots.js, nunca muestra una desactivada), en
   loop. Lo llama el botón del ojito en poi-panel.js.
   @param {string} id - id del POI (debe ser el pin actualmente expandido)
   @returns {{index: number, total: number}|null} nueva posición, o
     null si no hay pin expandido o no hay más de 1 imagen para recorrer.
   ═══════════════════════════════════════════ */
function cyclePinExpandedImage(id) {
  if (typeof expandedId === 'undefined' || expandedId !== id) return null;
  const el = document.querySelector(`#pw-${id} .pin-img`);
  if (!el) return null;

  // Se usa el POI fresco de AppState (si está disponible) en vez del
  // guardado en `markers[id].poi`, para respetar el toggle de
  // "Imagen activa" tal como está AHORA — no como estaba cuando se
  // dibujó el marcador por última vez.
  const poi = (typeof AppState !== 'undefined' && AppState.getPoi)
    ? (AppState.getPoi(id) || (markers[id] && markers[id].poi))
    : (markers[id] && markers[id].poi);
  if (!poi) return null;

  const list = (typeof getActiveSkinList === 'function') ? getActiveSkinList(poi) : [];
  if (list.length <= 1) return null; // nada para recorrer

  const currentIdx = parseInt(el.dataset.skinIndex || '0', 10);
  const nextIdx = (currentIdx + 1) % list.length;
  const nextUrl = list[nextIdx].url;

  if (!el.dataset.thumbSrc) el.dataset.thumbSrc = el.src; // por si se clickea antes de que termine el swap inicial
  el.src = nextUrl;
  el.dataset.qualitySwapped = 'full';
  el.dataset.skinIndex = String(nextIdx);
  el.dataset.userCycled = '1';

  return { index: nextIdx, total: list.length };
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
  // [2026-08-15] CAUSA RAÍZ REAL del "el mapa no se mueve" — encontrada
  // recién ahora, gracias a la consola que mandó Cris: el error real es
  // "Uncaught (in promise) Error: Invalid LatLng object: (NaN, NaN)"
  // en leaflet.min.js, y aparece YA AL CARGAR LA PÁGINA, antes de tocar
  // ningún pin. Causa: algún POI (típicamente un pin-cascarón creado por
  // la lista de prefijos o por importación masiva — quedan con
  // `lat:null, lng:null` a propósito hasta que se les carga ubicación
  // real, ver Entrega 2) llega hasta acá y `L.marker([null,null])` tira
  // esa excepción de Leaflet. Como `POIS.forEach(makeMarker)` (app.js)
  // NO tenía ningún try/catch, esa excepción CORTABA EL FOREACH ENTERO
  // — y con él, todo el resto de `init()` (app.js), incluida la línea
  // que define `window.panToPoiCenter`. Por ESO nunca se ejecutaba: la
  // función ni siquiera llegaba a EXISTIR, sin importar qué tan bien
  // estuviera el resto de la cadena del click (que sí estaba bien).
  // Fix acá (capa 1): si el POI no tiene lat/lng numéricos válidos, se
  // omite su marcador con un aviso claro, en vez de romper todo lo que
  // viene después. Fix en app.js (capa 2, defensa adicional): el forEach
  // ahora también tiene try/catch por si aparece cualquier otro caso no
  // contemplado acá.
  if (typeof poi.lat !== 'number' || typeof poi.lng !== 'number' || Number.isNaN(poi.lat) || Number.isNaN(poi.lng)) {
    console.warn('[makeMarker] POI sin lat/lng válidos — se omite su marcador (normal en un pin-cascarón sin ubicación cargada todavía):', poi.id, '— lat:', poi.lat, '— lng:', poi.lng);
    return;
  }

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



