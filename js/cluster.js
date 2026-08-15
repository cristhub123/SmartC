/* ═══════════════════════════════════════════
   LÓGICA DE PINS Y CLUSTERS (RECONECTADA A PoiPanel)
═══════════════════════════════════════════ */

// Funciones puente de compatibilidad por si alguna otra parte vieja las llama
window.openPoiPanel = function(poiId) {
  if (window.PoiPanel && typeof window.PoiPanel.open === 'function') {
    window.PoiPanel.open(poiId);
  }
};

window.closePoiPanel = function() {
  if (window.PoiPanel && typeof window.PoiPanel.close === 'function') {
    window.PoiPanel.close();
  }
};

function pinClick(poi) {
  if (!poi) return;

  const poiId = typeof poi === 'string' ? poi : (poi.id || poi.slug);

  if (window.PoiPanel && typeof window.PoiPanel.open === 'function') {
    // Si el panel ya estaba abierto para el mismo POI, lo cierra (y
    // colapsa el pin agrandado); si no, lo abre.
    if (window.PoiPanel.getCurrentPoiId() === poiId) {
      window.PoiPanel.close();
      if (typeof collapsePin === 'function') collapsePin(poiId);
      if (typeof expandedId !== 'undefined') expandedId = null;
      return;
    }

    // Si había otro pin agrandado, lo colapsamos primero (mismo
    // comportamiento que tenía el pinClick original de markers.js).
    if (typeof expandedId !== 'undefined' && expandedId !== null && typeof collapsePin === 'function') {
      collapsePin(expandedId);
    }

    // [2026-08-14] Secuencia de las 3 acciones del click en un pin,
    // pedida explícitamente por Cris: no hace falta que sean 100%
    // simultáneas — de hecho separarlas por un frame cada una es
    // mejor para el rendimiento en celulares de gama baja — pero la
    // diferencia debe ser mínima (imperceptible) y el ORDEN importa:
    //   1) el mapa arranca a desplazarse hacia el pin (es la
    //      animación más "pesada", conviene que sea la primera en
    //      empezar a trabajar);
    //   2) el pin hace el pop (maximiza + swap a imagen full
    //      quality), un frame después;
    //   3) el panel de info se abre, otro frame después.
    // Antes el orden era pop → panel → (recién 50ms después) paneo,
    // exactamente al revés de lo pedido.
    // [2026-08-14] Bug real encontrado (reportado por Cris): esta
    // condición chequeaba `window.markers`, pero `markers` está
    // declarado en js/config.js como `let markers = {}` a nivel de
    // script — una declaración `let`/`const` de nivel superior NUNCA
    // crea una propiedad en `window` (a diferencia de `var` o de una
    // función declarada), aunque la variable sí es accesible tal
    // cual (`markers`, sin `window.`) desde cualquier otro script de
    // la página, porque todos comparten el mismo entorno léxico
    // global. Entonces `window.markers` daba `undefined` SIEMPRE, la
    // condición completa quedaba `false` sin tirar ningún error, y
    // panToPoiCenter() nunca se llegaba a ejecutar — esa era la causa
    // real de que el mapa no se moviera nunca. Fix: usar `markers`
    // (la variable real) en vez de `window.markers`.
    if (typeof panToPoiCenter === 'function' && typeof markers !== 'undefined' && markers[poiId]) {
      panToPoiCenter(markers[poiId].poi);
    }

    requestAnimationFrame(() => {
      if (typeof expandPin === 'function') expandPin(poiId);

      requestAnimationFrame(() => {
        window.PoiPanel.open(poiId);
      });
    });
  } else if (typeof window.openPoiPanel === 'function') {
    window.openPoiPanel(poiId);
  }
}

window.pinClick = pinClick;