/* ═══════════════════════════════════════════
   app.js — CENTRAL INIT
   Runs after ALL other scripts are loaded.
   This is the ONLY place that calls init code.
   ═══════════════════════════════════════════ */

async function init() {
  // 0. Cargar configuraciones guardadas (apariencia global + estilo
  //    de mapa) ANTES de aplicar nada — así se ve correcto desde el
  //    primer instante, sin parpadeo, para cualquier persona que
  //    abra la app, no solo para vos.
  await loadGlobalSettings();
  await loadMapSettings();

  // 1. Aplicar el estilo de mapa ya cargado (o el default si es la
  //    primera vez que se usa la app y todavía no hay nada guardado)
  if (typeof applyTileUrl === 'function') {
    applyTileUrl(_mapaSettings.tileUrl);
    if (typeof applyTint === 'function') applyTint();
  } else {
    // Fallback si map-settings no cargó por algún motivo
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {subdomains:'abcd',maxZoom:19}).addTo(map);
  }

  // 2. Aplicar apariencia global (tamaño de pin, glow, etc.) antes
  //    de crear los marcadores, para que nazcan ya con el tamaño
  //    correcto en vez de "saltar" después.
  if (typeof applyGlobalDim === 'function') applyGlobalDim();
  if (typeof applyGlobalOutline === 'function') applyGlobalOutline();

  // 3. Cargar los lugares reales desde Firestore (reemplaza el
  //    array hardcodeado que había antes) — se espera a que
  //    termine antes de dibujar los pines en el mapa.
  toast('⏳ Cargando lugares...');
  await loadPOISFromFirestore();
  await loadFeaturesFromFirestore();

  // 4. Build all markers
  POIS.forEach(makeMarker);

  // 3. Build category filter bar
  if (typeof updateFilterBar === 'function') updateFilterBar();

  // 4. Build zones dropdown
  ZONAS.forEach(z => { if (z.active === undefined) z.active = true; });
  if (typeof buildZonasDropdown === 'function') buildZonasDropdown();

  // 5. Wire export/import buttons
  const btnExport = document.getElementById('btn-export');
  const importFile = document.getElementById('import-file');
  if (btnExport)  btnExport.addEventListener('click', exportPOIs);
  if (importFile) importFile.addEventListener('change', e => handleImportFile(e.target.files[0]));

  // 6. Wire map move → remove cluster
  map.on('movestart zoomstart', () => {
    if (typeof removeClusterMenu === 'function') removeClusterMenu();
    document.querySelectorAll('[id^="cluster-btn-"]').forEach(b => { if(b._tip) b._tip.remove(); });
    document.querySelectorAll('div[style*="backdrop-filter:blur(2px)"]').forEach(e => e.remove());
  });

  // 7. Wire toggle POI
  window.togglePoi = function(id, btn) {
    const p = POIS.find(x => x.id === id);
    if (!p) return;
    p.active = !(p.active !== false);
    btn.classList.toggle('on', p.active);
    const row = btn.closest('.poi-row');
    if (row) row.style.opacity = p.active ? '' : '.5';
    const mEl = document.getElementById('pw-' + id);
    const parent = mEl && mEl.parentElement;
    if (parent) parent.style.visibility = p.active ? '' : 'hidden';
    if (!p.active && expandedId === id) { collapsePin(id); closePoiPanel(); }
    toast(p.active ? '✅ "' + p.name + '" activado' : '⭕ "' + p.name + '" desactivado');
  };

  // 8. Live search
  (function wireSearch() {
    const inp = document.getElementById('search-input');
    const res = document.getElementById('search-results');
    if (!inp || !res) return;
    inp.addEventListener('input', () => {
      const q = inp.value.trim().toLowerCase();
      if (q.length < 1) { res.classList.remove('show'); return; }
      const all = (typeof getAllCats === 'function') ? getAllCats() : CAT;
      const hits = POIS.filter(p => {
        if (p.active === false) return false;
        return (p.name||'').toLowerCase().includes(q) ||
               (p.desc||'').toLowerCase().includes(q) ||
               (p.tags||[]).some(t => t.toLowerCase().includes(q));
      }).slice(0, 8);
      if (!hits.length) { res.classList.remove('show'); return; }
      res.innerHTML = hits.map(p => {
        const cats = Array.isArray(p.categories) && p.categories.length ? p.categories : [p.category];
        const cfg  = all[cats[0]] || {color:'#6055d8', icon:'📍'};
        const thumb = p.imgB64
          ? '<img src="' + p.imgB64 + '" style="width:100%;height:100%;object-fit:contain;">'
          : cfg.icon;
        return '<div class="sr-item" data-id="' + p.id + '">' +
          '<div class="sr-ico" style="background:' + cfg.color + '20">' + thumb + '</div>' +
          '<div><div class="sr-name">' + p.name + '</div>' +
          '<div class="sr-cat">' + cats.map(c => (all[c]||{}).label||c).join(', ') + '</div></div>' +
          '</div>';
      }).join('');
      res.classList.add('show');
      res.querySelectorAll('.sr-item').forEach(el => {
        el.addEventListener('click', () => {
          const id = el.dataset.id;
          res.classList.remove('show');
          inp.value = ''; inp.blur();
          pinClick(id);
        });
      });
    });
    inp.addEventListener('blur', () => setTimeout(() => res.classList.remove('show'), 200));
    inp.addEventListener('focus', () => { if (inp.value.trim()) inp.dispatchEvent(new Event('input')); });
  })();

  // 9. Pan helper — ÚNICO responsable de centrar el mapa sobre el pin
  //    activo (el panel del lugar YA NO se centra a sí mismo, ver
  //    js/poi-panel.js: antes había 2 sistemas de centrado corriendo
  //    en paralelo y se pisaban entre sí a mitad de animación).
  //
  //    Debe coincidir con el mismo breakpoint de desktop que usa
  //    js/poi-panel.js (DESKTOP_MEDIA_QUERY = min-width:1024px), que
  //    es donde el panel pasa de "bottom sheet" a sidebar fijo a la
  //    izquierda de 380px.
  //
  //    - Pantalla VERTICAL (alto > ancho), bottom sheet: el panel
  //      ocupa la mitad inferior, así que el pin se centra
  //      horizontalmente en su coordenada exacta (50% del ancho) y
  //      verticalmente en el centro de la mitad libre de arriba (25%
  //      desde arriba).
  //    - Pantalla CUADRADA u HORIZONTAL (ancho >= alto), todavía en
  //      bottom sheet (menos de 1024px de ancho): se invierte —
  //      vertical exacto (50% del alto) y horizontal centrado en la
  //      mitad libre lateral (25% desde la izquierda, asumiendo la
  //      mitad reservada a la derecha).
  //      [NOTA] La grilla CSS del panel (css/poi-panel.css) hoy solo
  //      pasa a modo "lateral" a partir de 1024px de ancho — en
  //      cuadrado/horizontal por debajo de eso el panel sigue siendo
  //      bottom sheet visualmente, aunque el centrado ya calcula el
  //      hueco como si fuera lateral. Si se quiere que el panel
  //      también deslice desde el costado en esas pantallas, es un
  //      cambio aparte de CSS a definir.
  //    - Desktop (ancho >= 1024px, panel lateral REAL de 380px fijo
  //      a la izquierda): vertical exacto (50% del alto) y horizontal
  //      centrado en el hueco real que deja el sidebar (desde 380px
  //      hasta el borde derecho).
  const DESKTOP_PANEL_WIDTH = 380;
  const DESKTOP_BREAKPOINT_PX = 1024;

  window.panToPoiCenter = function(poi) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const isDesktop = vw >= DESKTOP_BREAKPOINT_PX;
    const isPortrait = vh > vw;

    let targetX, targetY;
    if (isDesktop) {
      targetX = DESKTOP_PANEL_WIDTH + (vw - DESKTOP_PANEL_WIDTH) * 0.5;
      targetY = vh * 0.5;
    } else if (isPortrait) {
      targetX = vw * 0.5;
      targetY = vh * 0.25;
    } else {
      targetX = vw * 0.25;
      targetY = vh * 0.5;
    }

    const rect  = map.getContainer().getBoundingClientRect();
    const pinPx = map.latLngToContainerPoint([poi.lat, poi.lng]);
    const dx = pinPx.x - (targetX - rect.left);
    const dy = pinPx.y - (targetY - rect.top);
    map.panBy([dx, dy], { animate: true, duration: .4, noMoveStart: true });
  };
}

// Run init after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}



