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
/* [FIX 2026-08-16] Antes, si `poi.imgB64` estaba seteado, se devolvía
   ÚNICAMENTE esa URL — sin ningún candidato de respaldo. Si esa imagen
   rompía (Cloudinary caído, nombre mal escrito, carpeta equivocada),
   no había a dónde caer: directo al ícono roto. Además, al ser una
   lista de un solo elemento, quedaba en un orden totalmente distinto
   al de getActiveSkinList (que sí recorre todas las variantes) —
   causa directa del desfasaje entre "qué imagen se ve" y "qué dice el
   ojito". Ahora se arma siempre la cadena completa (mismo orden que el
   ojito, ver utils.js) y se antepone imgB64 solo si de verdad no está
   ya reflejado ahí (caso de pines viejos con imgB64 legado pero sin
   skins.main). */
function resolvePinImageCandidates(poi) {
  const chain = buildImageFallbackChain(poi, { forMap: true });
  if (poi.imgB64 && !chain.includes(poi.imgB64)) return [poi.imgB64, ...chain];
  if (chain.length > 0) return chain;
  return poi.imgB64 ? [poi.imgB64] : [];
}

function toThumbCandidateUrl(url) {
  if (!url.includes('res.cloudinary.com')) return url;
  // [2026-08-21] q_auto (compresión automática) es seguro para
  // cualquier formato. f_auto (conversión automática de formato, ej.
  // a WebP/AVIF) NO es seguro para GIFs animados — Cloudinary puede
  // convertir a un formato sin soporte de animación y perder el
  // movimiento — así que se omite solo cuando la URL termina en .gif.
  const isGif = /\.gif(\?|$)/i.test(url);
  const transform = isGif
    ? 'c_fill,g_auto,w_150,h_150,q_auto'
    : 'c_fill,g_auto,w_150,h_150,q_auto,f_auto';
  return url.replace('/image/upload/', `/image/upload/${transform}/`);
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

  /* [FIX 2026-08-18] Antes se confiaba ciegamente en
     `el.dataset.skinIndex` como "posición actual dentro de `list`".
     Reportado por Cris: con pocas imágenes activas (ej. 2 de 10
     cargadas), el ojito podía necesitar muchos clicks para volver a
     la primera — señal de que ese índice guardado no correspondía en
     realidad a la imagen que se estaba viendo (puede desalinearse si
     la imagen mostrada al maximizar el pin vino de un candidato de
     respaldo que no es el primero de `list`, ver resolvePinImageCandidates,
     que no filtra por activo). Ahora, antes de avanzar, se busca la
     posición REAL comparando la URL puesta ahora mismo en el <img>
     contra `list`: si coincide con alguna, se avanza desde ahí (caso
     normal); si NO coincide con ninguna activa (el índice guardado
     estaba desalineado o quedó fuera de rango), se salta directo a la
     PRIMERA imagen activa en vez de sumar 1 a un número que no
     significa nada — así un solo click siempre lleva a una imagen
     realmente disponible, nunca hacen falta N clicks para reengancharse. */
  const matchIdx = list.findIndex((c) => c.url === el.src);
  const storedIdx = parseInt(el.dataset.skinIndex || '-1', 10);
  const startIdx = matchIdx >= 0
    ? matchIdx
    : (storedIdx >= 0 && storedIdx < list.length ? storedIdx : -1);
  const nextIdx = startIdx === -1 ? 0 : (startIdx + 1) % list.length;

  if (!el.dataset.thumbSrc) el.dataset.thumbSrc = el.src; // por si se clickea antes de que termine el swap inicial

  /* [FIX 2026-08-16] Antes se asignaba `el.src = nextUrl` directo, sin
     precargar ni manejar el error: si esa variante en particular tenía
     una URL rota (nombre huérfano del importador de texto, imagen que
     todavía no se subió a Cloudinary, carpeta equivocada, etc.), el
     pin se quedaba mostrando el ícono roto para siempre — nada la
     reintentaba ni volvía a la imagen anterior, ni corregía el
     contador del ojito. Ahora se precarga (mismo patrón que
     swapPinToFullQuality) y, si una falla, se salta automáticamente a
     la siguiente variante activa hasta encontrar una que cargue de
     verdad o agotar la lista — nunca deja el pin roto. */
  function tryLoad(idx, attempts) {
    if (attempts >= list.length) {
      // Ninguna imagen de la lista cargó: se vuelve al thumb conocido
      // en vez de dejar el ícono roto puesto.
      if (el.dataset.thumbSrc) el.src = el.dataset.thumbSrc;
      el.dataset.skinIndex = String(startIdx);
      console.warn(`[cyclePinExpandedImage] Ninguna imagen de "${id}" cargó — se vuelve al thumb.`);
      if (typeof window.onPinImageCycled === 'function') window.onPinImageCycled(id);
      return;
    }
    const candidate = list[idx];
    const preload = new Image();
    preload.onload = () => {
      if (typeof expandedId === 'undefined' || expandedId !== id) return; // el usuario ya cerró/cambió de pin
      el.src = candidate.url;
      el.dataset.qualitySwapped = 'full';
      el.dataset.skinIndex = String(idx);
      el.dataset.userCycled = '1';
      if (typeof window.onPinImageCycled === 'function') window.onPinImageCycled(id);
    };
    preload.onerror = () => {
      console.warn(`[cyclePinExpandedImage] "${candidate.url}" no cargó — se prueba la siguiente imagen de "${id}".`);
      tryLoad((idx + 1) % list.length, attempts + 1);
    };
    preload.src = candidate.url;
  }
  tryLoad(nextIdx, 0);

  // Valor optimista para que el ojito responda al instante; si la
  // precarga falla, window.onPinImageCycled corrige el contador solo
  // (ver el hook en poi-panel.js).
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

      // [FIX 2026-09-03] Antes acá se chequeaba `poi.active === false`
      // directo (ver historial abajo). Se reemplaza por
      // applyPinVisibility() (js/pin-visibility.js) — mismo efecto
      // para pines desactivados, pero AHORA también respeta el filtro
      // público elegido en ese momento (categoría puntual, "Eventos y
      // actividades"). Antes, un pin recién dibujado (ej. al panear el
      // mapa a una zona nueva, vía pins-viewport-loader.js) ignoraba
      // el filtro activo y aparecía igual, sin importar qué filtro
      // hubiera elegido el visitante.
      //
      // [Etapa 4 — bug encontrado y corregido de paso, no solo para
      // eventos] Antes, el campo `active` (activo/publicado) de un pin
      // SOLO se aplicaba visualmente cuando se togleaba EN VIVO desde el
      // panel admin (togglePoi, ver admin.js) — pero acá, al
      // dibujar el marcador por primera vez, nunca se chequeaba. Un pin
      // ya desactivado ANTES de cargar la página (ej. un pin
      // `evento_temporal` que la Etapa 4 acaba de auto-desactivar, o
      // cualquier pin que vos hayas desactivado a mano en otra sesión)
      // igual se dibujaba y se veía normal para cualquier visitante que
      // recién abre el mapa.
      if (el && typeof applyPinVisibility === 'function') applyPinVisibility(poi);
    });
  });

  markers[poi.id] = { m, poi };

  // [NUEVO 2026-08-29] Recalcula el clustering (js/cluster-grouping.js)
  // cada vez que aparece un pin nuevo — debounced, así que crear
  // muchos de golpe (el forEach de init() en app.js, una importación
  // masiva) dispara un solo recálculo, no uno por pin.
  if (typeof scheduleClusterRecompute === 'function') scheduleClusterRecompute();
}

function removeMarker(id) {
  if (markers[id]) {
    markers[id].m.remove();
    delete markers[id];
    // [NUEVO 2026-08-29] mismo motivo que en makeMarker de arriba.
    if (typeof scheduleClusterRecompute === 'function') scheduleClusterRecompute();
  }
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
    // [2026-08-31, PLAN_FIX_ZINDEX_PIN_MAXIMIZADO.md Punto 1] Antes
    // era 99999 — los clusters (js/cluster-grouping.js) se crean con
    // zIndexOffset:500000 a propósito para ganarle a cualquier pin
    // suelto, así que terminaban tapando también al pin maximizado.
    // 600000 queda por encima de cualquier z-index real que Leaflet
    // pueda calcular para un cluster (500000 + posición en pantalla).
    const markerEl = el.parentElement;
    if (markerEl) {
      markerEl._prevZ = markerEl.style.zIndex;
      markerEl.style.zIndex = '600000';
      markerEl.style.setProperty('z-index', '600000', 'important');
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



