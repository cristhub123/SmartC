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
    if (typeof expandPin === 'function') expandPin(poiId);

    window.PoiPanel.open(poiId);

    // Centrado suave del mapa en el pin — mismo delay que usaba el
    // pinClick original, para dar tiempo a que el pin termine de
    // agrandarse antes de mover el mapa.
    if (typeof panToPoiCenter === 'function' && window.markers && window.markers[poiId]) {
      requestAnimationFrame(() => {
        setTimeout(() => panToPoiCenter(window.markers[poiId].poi), 50);
      });
    }
  } else if (typeof window.openPoiPanel === 'function') {
    window.openPoiPanel(poiId);
  }
}

window.pinClick = pinClick;