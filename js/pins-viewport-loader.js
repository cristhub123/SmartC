/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/* ═══════════════════════════════════════════
   CARGA DE PINES POR VIEWPORT/ZOOM
   ---------------------------------------------
   [NUEVO 2026-08-29 — PLAN_OPTIMIZACION_PERFORMANCE_2026-08-29.md,
   punto 6.1] Reemplaza, para el mapa PÚBLICO, el `.get()` sin límite
   que traía la colección `pines` COMPLETA en cada visita (ver
   js/firestore-sync.js) por una carga acotada al área que se está
   viendo en el mapa en ese momento — con margen extra alrededor para
   que no se note el "salto" al hacer pan. Al moverse o hacer zoom, se
   piden (y dibujan) los pines nuevos que entraron al área ampliada;
   los que ya se cargaron una vez NO se vuelven a pedir ni se borran
   del mapa (crecer en memoria a medida que alguien explora es
   normal y esperado — lo que se evita es la descarga masiva de
   arranque, no el guardar en memoria lo que ya se mostró).

   IMPORTANTE — esto es SOLO para el mapa público. El panel Admin
   (tab Lugares) necesita ver/editar/borrar TODOS los pines existan o
   no en el área visible — sigue usando `loadPOISFromFirestore()` sin
   recorte, forzado en `openAdmin()` (js/admin.js). Y el buscador
   también ve TODOS los pines, mediante `loadSearchIndex()`
   (js/firestore-sync.js) — es una consulta APARTE, no relacionada con
   esta ni con el viewport, se dispara sola la primera vez que alguien
   usa el buscador.

   TRADE-OFF conocido, aceptado por Cris: la barra de categorías y el
   dropdown de zonas se arman con los pines YA cargados en cada
   momento — al recién entrar a la página pueden no reflejar el 100%
   de categorías/zonas que existen hasta que se navega el mapa. Con
   pocos pines (hoy: 11 de prueba) no se nota; si se vuelve un
   problema real más adelante, se resuelve aparte (ej. una consulta
   liviana solo de categorías/zonas distintas, sin traer los pines
   completos).

   REQUIERE UN ÍNDICE COMPUESTO EN FIRESTORE (lat, lng) — si no existe
   todavía, la consulta de abajo va a fallar la PRIMERA vez con un
   error en la consola del navegador que trae un link directo para
   crearlo en un clic (Firebase Console → pestaña Indexes). Es normal,
   pasa una sola vez.
═══════════════════════════════════════════ */

const _loadedPinIds = new Set(); // ids ya traídos de Firestore + dibujados — nunca se sacan de acá
let _viewportLoadTimer = null;
const _VIEWPORT_PADDING_FACTOR = 0.5; // 50% de margen extra alrededor de lo visible en cada carga

function _paddedBounds() {
  const b = map.getBounds();
  const latPad = (b.getNorth() - b.getSouth()) * _VIEWPORT_PADDING_FACTOR;
  const lngPad = (b.getEast() - b.getWest()) * _VIEWPORT_PADDING_FACTOR;
  return {
    latMin: b.getSouth() - latPad,
    latMax: b.getNorth() + latPad,
    lngMin: b.getWest() - lngPad,
    lngMax: b.getEast() + lngPad,
  };
}

/* Trae los pines dentro del área visible ampliada que todavía no se
   hayan cargado, y los suma a POIS + `_loadedPinIds` — SIN dibujar
   marcadores todavía. Separado de `loadPinsInViewport()` (que sí
   dibuja) para que `init()` (js/app.js) pueda meter en el medio
   `checkEventosTemporalesLifecycle()` ANTES de que cualquier pin
   `evento_temporal` recién vencido llegue a dibujarse (mismo
   criterio de "nace ya oculto, sin parpadeo" que ya existía antes de
   este cambio — ver comentario en app.js sección 3.5). Devuelve la
   lista de POIs recién agregados (los que todavía hay que dibujar). */
async function fetchPinsInViewport() {
  if (typeof map === 'undefined' || typeof db === 'undefined') return [];
  const bounds = _paddedBounds();
  const added = [];
  try {
    const snapshot = await db.collection('pines')
      .where('lat', '>=', bounds.latMin)
      .where('lat', '<=', bounds.latMax)
      .where('lng', '>=', bounds.lngMin)
      .where('lng', '<=', bounds.lngMax)
      .get();

    snapshot.forEach(doc => {
      if (_loadedPinIds.has(doc.id)) return; // ya lo tenemos, no duplicar
      const data = doc.data();
      if (!data.name) return; // mismo filtro de siempre: salta documentos de prueba con otro esquema
      const poi = { id: doc.id, ...data };
      POIS.push(poi);
      _loadedPinIds.add(doc.id);
      added.push(poi);
    });
  } catch (err) {
    console.error('Error cargando pines del área visible del mapa:', err);
    // No se muestra toast acá a propósito: en un moveend/zoomend normal
    // (no la carga inicial) sería molesto para cualquier visitante ver
    // un aviso de error solo porque falta crear el índice compuesto la
    // primera vez — el error queda igual en consola para diagnosticar.
  }
  return added;
}
window.fetchPinsInViewport = fetchPinsInViewport;

/* Dibuja (makeMarker, con el mismo try/catch por-pin de siempre) una
   lista de POIs ya agregados a POIS por `fetchPinsInViewport()`. */
function drawLoadedPins(poisList) {
  if (!poisList || !poisList.length) return;
  poisList.forEach(poi => {
    try {
      makeMarker(poi);
    } catch (err) {
      console.error('[drawLoadedPins] No se pudo crear el marcador de', poi.id, '— se sigue con el resto:', err);
    }
  });
  if (typeof syncAppStateWithPOIS === 'function') syncAppStateWithPOIS();
  if (typeof updateFilterBar === 'function') updateFilterBar();
}
window.drawLoadedPins = drawLoadedPins;

/* Uso normal (pan/zoom en vivo): trae y dibuja de un saque. La carga
   INICIAL de la página no usa esta función — usa
   fetchPinsInViewport() + drawLoadedPins() por separado, con
   checkEventosTemporalesLifecycle() en el medio (ver js/app.js). */
async function loadPinsInViewport() {
  const added = await fetchPinsInViewport();
  drawLoadedPins(added);
}
window.loadPinsInViewport = loadPinsInViewport;

function _scheduleViewportLoad() {
  if (_viewportLoadTimer) clearTimeout(_viewportLoadTimer);
  _viewportLoadTimer = setTimeout(() => {
    _viewportLoadTimer = null;
    loadPinsInViewport();
  }, 350);
}

if (typeof map !== 'undefined') {
  map.on('moveend zoomend', _scheduleViewportLoad);
}
