/**
 * ============================================================================
 * js/pois-bootstrap.js
 * ----------------------------------------------------------------------------
 * Conecta la carga de `pois_cordoba.json` (vía PoisLoader) con el dibujado
 * real de marcadores (`makeMarker`, definida en markers.js).
 *
 * Por qué es un archivo aparte y no vive dentro de pois-loader.js ni de
 * markers.js: `pois-loader.js` solo sabe de datos (AppState), no debería
 * saber que existe un mapa o una función `makeMarker`. `markers.js` solo
 * sabe dibujar un marcador dado un POI, no de dónde salen los POIs. Este
 * archivo es el único punto que conoce ambos mundos.
 *
 * ORDEN DE CARGA REQUERIDO (ver index.html):
 *   app-state.js → pois-loader.js → map.js → markers.js → poi-panel.js
 *   → pois-bootstrap.js (este archivo)
 * ============================================================================
 */

(function () {
  'use strict';

  function _drawAllMarkers() {
    const pois = AppState.getPois();
    pois.forEach((poi) => {
      // makeMarker (markers.js) espera un POI con `.lat`/`.lng`/`.id` —
      // el esquema transformado por PoisLoader ya los trae planos,
      // además del esquema nuevo (`coordinates`), así que esto funciona
      // sin tocar markers.js.
      makeMarker(poi);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    PoisLoader.loadFromJson('pois_cordoba.json')
      .then(_drawAllMarkers)
      .catch((err) => {
        console.error('[PoisBootstrap] Error cargando pois_cordoba.json:', err);
      });
  });
})();
