/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/**
 * ============================================================================
 * [DESCONECTADO 2026-08-13 — smartcityV3.0_fix-mapa-pines]
 * ----------------------------------------------------------------------------
 * ESTE ARCHIVO YA NO SE CARGA EN index.html (su <script> quedó comentado).
 * NO BORRAR ESTA NOTA en una limpieza futura de comentarios — explica por
 * qué el archivo sigue en el repo sin usarse.
 *
 * Motivo: CAUSA RAÍZ CONFIRMADA del bug "los pines nuevos/editados no
 * aparecen en el mapa". La guardia que este archivo instalaba sobre
 * `makeMarker` (ver `_installMakeMarkerGuard` más abajo) bloqueaba en
 * silencio cualquier pin cuyo ID no existiera en AppState — y como
 * AppState solo se hidrataba con los 4 lugares fijos de
 * `pois_cordoba.json` (vía `pois-loader.js`, también desconectado),
 * NINGÚN pin real creado desde el admin (Firestore) llegaba a dibujarse
 * nunca, sin importar que `pin-adjust.js` sí llamara a `makeMarker(p)`
 * correctamente después de guardar. Diagnóstico y fix completos en
 * CAMBIOS.txt.
 * ============================================================================
 */

/**
 * ============================================================================
 * js/pois-bootstrap.js
 * ----------------------------------------------------------------------------
 * Conecta la carga de `pois_cordoba.json` (vía PoisLoader) con el dibujado
 * real de marcadores (`makeMarker`, definida en markers.js) — y GARANTIZA
 * que en el mapa solo puedan existir los POIs de la lista maestra actual,
 * sin importar qué otro código (Firestore, ingesta vieja, `app.js`) intente
 * dibujar un pin viejo que ya no está en `pois_cordoba.json`.
 *
 * PROBLEMA QUE RESUELVE:
 *   Algún código anterior a esta migración (Firestore / `app.js`, que no
 *   tenemos a la vista) sigue intentando dibujar lugares viejos como
 *   "legislatura-de-cordoba" que ya no están en `pois_cordoba.json`. Ese
 *   código puede correr ANTES o DESPUÉS de este bootstrap (por ejemplo, si
 *   viene de un listener asíncrono de Firestore que tarda en resolver), así
 *   que no alcanza con "limpiar una sola vez al principio": hace falta un
 *   punto de control único por el que TODO pin tenga que pasar.
 *
 * SOLUCIÓN — dos capas, sin tocar `app.js` ni `markers.js`:
 *   1. GUARDIA en `makeMarker`: se reemplaza la función global por una
 *      versión que, antes de dibujar, chequea que el POI exista en
 *      AppState (la lista maestra actual). Si no existe, el pin
 *      simplemente no se dibuja — no importa quién lo haya llamado ni
 *      cuándo. Este es el fix de fondo: da lo mismo si el código viejo
 *      corre antes, después, o en un callback async.
 *   2. LIMPIEZA inicial: al cargar `pois_cordoba.json`, se borra
 *      cualquier marcador que ya estuviera dibujado (por si algo llegó
 *      a pintarse antes de que la guardia quedara instalada) y recién
 *      ahí se dibujan los 4 POIs actuales.
 *
 * ORDEN DE CARGA REQUERIDO (ver index.html):
 *   app-state.js → pois-loader.js → map.js → markers.js → poi-panel.js
 *   → pois-bootstrap.js (este archivo, INMEDIATAMENTE después de markers.js
 *     para que la guardia quede instalada antes de que cualquier otro
 *     script — admin.js, cluster.js, app.js — tenga chance de llamar a
 *     makeMarker con un pin viejo)
 * ============================================================================
 */

(function () {
  'use strict';

  /**
   * Reemplaza el `makeMarker` global (definido en markers.js) por una
   * versión que solo dibuja el pin si el POI todavía existe en AppState
   * (es decir, si sigue en `pois_cordoba.json`). Idempotente: si ya se
   * instaló antes, no vuelve a envolverla dos veces.
   */
  function _installMakeMarkerGuard() {
    if (typeof window.makeMarker !== 'function') {
      console.error('[PoisBootstrap] makeMarker no está definida todavía — revisá el orden de <script> (markers.js debe ir antes que este archivo).');
      return;
    }
    if (window.makeMarker._guardedByPoisBootstrap) return; // ya instalada

    const originalMakeMarker = window.makeMarker;

    function guardedMakeMarker(poi) {
      const stillExists = poi && poi.id && AppState.getPoi(poi.id);
      if (!stillExists) {
        console.debug(`[PoisBootstrap] Pin ignorado (ya no está en la lista maestra): "${poi && poi.id}"`);
        return;
      }
      return originalMakeMarker(poi);
    }

    guardedMakeMarker._guardedByPoisBootstrap = true;
    window.makeMarker = guardedMakeMarker;
  }

  /**
   * Borra todos los marcadores actualmente dibujados en el mapa, sin
   * importar quién los haya puesto ahí. Se apoya en `removeMarker` y en
   * el objeto global `markers` (ambos ya definidos en markers.js).
   */
  function _clearAllMarkers() {
    // Capa 1: si el mapa usa un layer group de Leaflet para clustering
    // (`markersGroup`, definido en cluster.js — no lo tocamos, solo lo
    // usamos), esta es la forma "nativa" y más prolija de vaciarlo.
    if (window.markersGroup && typeof window.markersGroup.clearLayers === 'function') {
      window.markersGroup.clearLayers();
    }

    // Capa 2: fallback existente por si algún marcador no pasó por el
    // layer group (o si `markersGroup` no existe en tu versión actual).
    if (typeof window.markers === 'object' && window.markers) {
      Object.keys(window.markers).forEach((id) => {
        if (typeof window.removeMarker === 'function') window.removeMarker(id);
      });
    }
  }

  function _drawMasterListOnly() {
    _clearAllMarkers();
    const pois = AppState.getPois();
    pois.forEach((poi) => makeMarker(poi));
  }

  // La guardia se instala YA, en cuanto este script corre — no espera a
  // DOMContentLoaded — para blindar `makeMarker` lo antes posible, antes
  // de que cualquier script que cargue después (admin.js, cluster.js,
  // app.js) tenga oportunidad de dibujar un pin viejo.
  _installMakeMarkerGuard();

  document.addEventListener('DOMContentLoaded', () => {
    PoisLoader.loadFromJson('pois_cordoba.json')
      .then(_drawMasterListOnly)
      .catch((err) => {
        console.error('[PoisBootstrap] Error cargando pois_cordoba.json:', err);
      });
  });
})();
