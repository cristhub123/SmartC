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
    if (typeof panToPoiCenter === 'function' && window.markers && window.markers[poiId]) {
      panToPoiCenter(window.markers[poiId].poi);
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