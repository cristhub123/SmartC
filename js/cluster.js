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
    // Si el panel ya estaba abierto para el mismo POI, lo cierra; si no, lo abre
    if (window.PoiPanel.getCurrentPoiId() === poiId) {
      window.PoiPanel.close();
    } else {
      window.PoiPanel.open(poiId);
    }
  } else if (typeof window.openPoiPanel === 'function') {
    window.openPoiPanel(poiId);
  }
}

window.pinClick = pinClick;