/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/* ═══════════════════════════════════════════
   app.js — CENTRAL INIT
   Runs after ALL other scripts are loaded.
   This is the ONLY place that calls init code.
   ═══════════════════════════════════════════ */

async function init() {
  // 0. [2026-08-29 — PLAN_OPTIMIZACION_PERFORMANCE_2026-08-29.md, sección 2]
  //    Antes esto era 7 `await` en cadena, uno atrás de otro, y nada se
  //    dibujaba en el mapa hasta terminar el último. De esos 7, estos 5
  //    leen documentos distintos e independientes entre sí (`settings/
  //    appearance`, `settings/mapstyle`, `settings/features`, `settings/
  //    eventos-config`, y la colección `eventos` completa) — no hace
  //    falta esperarlos en fila, se piden todos juntos con Promise.all.
  //    `loadPOISFromFirestore()` queda afuera de este grupo a propósito:
  //    dispara el toast "Cargando lugares..." y es el dato más pesado/
  //    visible, se mantiene aparte más abajo. `checkEventosTemporalesLifecycle()`
  //    también queda afuera: necesita el resultado de `loadEventosFromFirestore()`
  //    (la lista de EVENTOS) para poder correr, así que sigue secuencial,
  //    después de este grupo.
  // [2026-08-29] loadClusterSettings() (js/cluster-grouping.js) se
  // suma acá: lee el mismo doc de un solo golpe (settings/clustering)
  // que el resto, mismo motivo de fondo (independiente de los demás,
  // no hace falta esperarlo en fila).
  await Promise.all([
    loadGlobalSettings(),
    loadMapSettings(),
    typeof loadFeaturesFromFirestore === 'function' ? loadFeaturesFromFirestore() : Promise.resolve(),
    typeof loadEventosConfig === 'function' ? loadEventosConfig() : Promise.resolve(),
    typeof loadEventosFromFirestore === 'function' ? loadEventosFromFirestore() : Promise.resolve(),
    typeof loadClusterSettings === 'function' ? loadClusterSettings() : Promise.resolve(),
    // [Filtro de fecha de eventos, 2026-09-03] mismo motivo que
    // loadClusterSettings: lee un doc propio e independiente
    // (settings/filtroFechaEventos), no hace falta esperarlo en fila.
    typeof loadFiltroFechaSettings === 'function' ? loadFiltroFechaSettings() : Promise.resolve(),
  ]);

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
  // [FIX 2026-09-03] applyShadow()/applyEyeGlowColor() (js/shadow-eye.js)
  // se ejecutaban UNA sola vez, al momento de parsear ese script — que
  // pasa ANTES de que este await Promise.all(...) de acá arriba termine
  // de traer la configuración real guardada. Como nada las volvía a
  // llamar después, la sombra y el glow de ojos quedaban SIEMPRE con el
  // valor por defecto del código, sin importar lo que Cris hubiera
  // guardado — se veían "reseteados" en cada carga de página aunque el
  // dato real estuviera bien guardado en Firestore. Se vuelven a llamar
  // acá, ya con globalSettings hidratado de verdad.
  if (typeof applyShadow === 'function') applyShadow();
  if (typeof applyEyeGlowColor === 'function') applyEyeGlowColor();

  // 3. Cargar los lugares reales desde Firestore (reemplaza el
  //    array hardcodeado que había antes).
  // [2026-08-29 — PLAN_OPTIMIZACION_PERFORMANCE_2026-08-29.md, punto
  // 6.1] Antes esto era `loadPOISFromFirestore()` (colección `pines`
  // COMPLETA, sin límite) + un forEach(makeMarker) más abajo. Ahora
  // el mapa público carga por área visible (viewport/zoom) — ver
  // js/pins-viewport-loader.js. Se usa `fetchPinsInViewport()` (solo
  // trae datos, no dibuja nada todavía) en vez de `loadPinsInViewport()`
  // a propósito: el dibujado real se hace más abajo, DESPUÉS de
  // `checkEventosTemporalesLifecycle()` — mismo motivo que ya
  // explicaba la nota vieja de la sección 3.5 (que un pin recién
  // vencido nazca ya oculto, sin parpadeo). El panel Admin sigue
  // viendo TODO, sin recorte — se fuerza aparte en `openAdmin()`
  // (js/admin.js).
  toast('⏳ Cargando lugares...');
  const _pinesRecienCargados = await fetchPinsInViewport();

  // 3.5. [Etapa 4/5 — PLAN_USUARIOS_EVENTOS.md] revisa el ciclo de vida
  // de los pines `tipo: 'evento_temporal'` (auto-desactiva los que ya no
  // tienen ningún evento vigente, sin borrarlos) usando el EVENTOS ya
  // cargado en el Promise.all de arriba. Todo esto ACÁ, antes del
  // forEach de abajo, para que un pin recién auto-desactivado nazca ya
  // oculto sin parpadeo — ver detalle completo en js/eventos.js.
  // [2026-08-29] `loadFeaturesFromFirestore()`, `loadEventosFromFirestore()`
  // y `loadEventosConfig()` ya se resolvieron arriba, en paralelo — no
  // se vuelven a llamar acá.
  if (typeof checkEventosTemporalesLifecycle === 'function') {
    await checkEventosTemporalesLifecycle(typeof EVENTOS !== 'undefined' ? EVENTOS : undefined);
  }

  // 4. Build all markers
  // [2026-08-29 — PLAN_OPTIMIZACION_PERFORMANCE_2026-08-29.md, punto
  // 6.1] Dibuja recién ACÁ (después de checkEventosTemporalesLifecycle,
  // sección 3.5 arriba) los pines que trajo `fetchPinsInViewport()` —
  // mismo try/catch por-pin de siempre, ver js/pins-viewport-loader.js
  // → drawLoadedPins(). Nota vieja de 2026-08-15 sobre el motivo del
  // try/catch por-pin se mantiene ahí, no se pierde.
  drawLoadedPins(_pinesRecienCargados);

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

  // 6b. Click en el mapa (el fondo, no un pin) → cierra el panel del
  //     lugar y minimiza el pin maximizado, si había alguno abierto.
  //     El click de un pin hace stopPropagation() sobre el elemento
  //     DOM (ver js/markers.js), así que nunca llega hasta acá — este
  //     listener solo se dispara con clicks realmente vacíos del mapa.
  map.on('click', (e) => {
    // [NUEVO 2026-08-31] Guarda anti-selección-de-texto-arrastrada —
    // ver js/ui-guards.js (Punto 1, PLAN_FIX_CIERRE_PANELES.md).
    if (window.UIGuards && window.UIGuards.wasTextDragRelease(e.originalEvent)) return;
    if (expandedId !== null) {
      collapsePin(expandedId);
      closePoiPanel();
    }
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
    // [NUEVO 2026-08-29] activar/desactivar un pin cambia qué cuenta
    // como candidato para el clustering (js/cluster-grouping.js) —
    // recalcular para que el número de las burbujas quede correcto.
    if (typeof scheduleClusterRecompute === 'function') scheduleClusterRecompute();
  };

  // 8. Live search
  // [2026-08-29 — PLAN_OPTIMIZACION_PERFORMANCE_2026-08-29.md, punto
  // 6.1] Antes filtraba directo sobre `POIS` (que con el mapa cargando
  // TODO de arranque, tenía siempre el 100% de los lugares). Ahora
  // que el mapa carga por viewport (js/pins-viewport-loader.js), POIS
  // puede no tener un lugar que está del otro lado del mapa sin
  // haber sido navegado todavía — el buscador tiene que seguir
  // encontrándolo igual. Por eso usa su propio índice separado
  // (`loadSearchIndex()`, js/firestore-sync.js): se pide UNA sola vez
  // (la primera vez que alguien realmente usa el buscador, no en cada
  // carga de página) y queda en caché para el resto de la sesión. Si
  // el resultado elegido no está todavía dibujado en el mapa (no hay
  // marcador para ese id), se crea al vuelo antes de abrir su panel.
  (function wireSearch() {
    const inp = document.getElementById('search-input');
    const res = document.getElementById('search-results');
    if (!inp || !res) return;

    async function runSearch() {
      const q = inp.value.trim().toLowerCase();
      if (q.length < 1) { res.classList.remove('show'); return; }

      const source = (typeof loadSearchIndex === 'function') ? await loadSearchIndex() : POIS;
      // Si mientras esperaba la carga el usuario ya borró el texto o
      // escribió otra cosa, este resultado quedó viejo — se descarta.
      if (inp.value.trim().toLowerCase() !== q) return;

      const all = (typeof getAllCats === 'function') ? getAllCats() : CAT;
      const hits = source.filter(p => {
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
          // Si el resultado elegido todavía no está en el mapa (fuera
          // del área ya cargada por viewport), se crea al vuelo con
          // los datos que ya trajo el índice de búsqueda, y se centra
          // el mapa ahí antes de abrir su panel.
          if (!markers[id]) {
            const poi = (_searchIndexPOIS || []).find(p => p.id === id);
            if (poi) {
              if (!POIS.find(p => p.id === id)) POIS.push(poi);
              try { makeMarker(poi); } catch (err) { console.error('[search] No se pudo crear el marcador de', id, err); }
              map.setView([poi.lat, poi.lng], Math.max(map.getZoom(), 16));
            }
          }
          pinClick(id);
        });
      });
    }

    inp.addEventListener('input', runSearch);
    inp.addEventListener('blur', () => setTimeout(() => res.classList.remove('show'), 200));
    inp.addEventListener('focus', () => { if (inp.value.trim()) runSearch(); });
  })();

  // 9. Pan helper — ÚNICO responsable de centrar el mapa sobre el pin
  //    activo (el panel del lugar YA NO se centra a sí mismo, ver
  //    js/poi-panel.js: antes había 2 sistemas de centrado corriendo
  //    en paralelo y se pisaban entre sí a mitad de animación).
  //
  //    [2026-08-14 v2] 2 correcciones sobre la versión anterior:
  //
  //    1) FUENTE ÚNICA DE VERDAD: antes esta función tenía sus propias
  //       constantes fijas (peek 300px, sidebar 380px, breakpoint
  //       1024px) que podían desincronizarse del tamaño REAL del
  //       panel (ej. si alguien cambiaba una sola de las 2 copias).
  //       Ahora el tamaño abierto del panel es configurable desde
  //       Admin > Global > "Panel de información" (2 sliders, % de
  //       pantalla, uno para vertical y otro para horizontal/cuadrada
  //       — ver globalSettings.panelPctPortrait/panelPctLandscape en
  //       js/admin-global.js) y este helper lee el hueco libre real
  //       directo de `PoiPanel.getOpenAreaPx()` (js/poi-panel.js) —
  //       nunca vuelve a calcular el % por su cuenta, así el panel
  //       visual y el centrado del mapa NUNCA quedan desincronizados.
  //
  //    2) MÉTODO DE PANEO MÁS ROBUSTO: la versión anterior usaba
  //       `map.panBy([dx,dy], {..., noMoveStart:true})`. Cris reportó
  //       que el mapa no se movía nada al tocar un pin. No se pudo
  //       reproducir en un entorno con navegador real para confirmar
  //       la causa exacta, pero `panBy` tiene un camino interno donde,
  //       si el offset calculado da inválido (por ejemplo NaN en
  //       algún caso límite de timing), Leaflet directamente no anima
  //       nada y sale en silencio, sin ningún error en consola. Se
  //       cambió a un método más directo y más simple de razonar:
  //       en vez de pedirle al mapa "moveté X píxeles", se calcula
  //       la coordenada geográfica exacta que debería quedar en el
  //       centro para que el pin caiga en el punto deseado, y se usa
  //       `map.setView(...)` — el método más básico y más probado de
  //       Leaflet para animar el centro del mapa.
  window.panToPoiCenter = function(poi) {
    // [2026-08-15] DIAGNÓSTICO TEMPORAL — ver misma nota en js/cluster.js.
    console.log('[panToPoiCenter] llamada con poi:', poi && poi.id, '— lat/lng:', poi && poi.lat, poi && poi.lng);
    if (!poi || typeof poi.lat !== 'number' || typeof poi.lng !== 'number') {
      console.warn('[panToPoiCenter] poi sin lat/lng numéricos — no se puede centrar. poi recibido:', poi);
      return;
    }

    const vw = window.innerWidth, vh = window.innerHeight;
    const area = (window.PoiPanel && typeof window.PoiPanel.getOpenAreaPx === 'function')
      ? window.PoiPanel.getOpenAreaPx()
      : null;
    console.log('[panToPoiCenter] vw/vh:', vw, vh, '— area (tamaño real del panel):', area);

    // Punto de la pantalla (relativo al viewport) donde debe quedar
    // el pin: el centro de la porción que NO tapa el panel.
    let targetX, targetY;
    if (area && area.mode === 'landscape') {
      // Panel lateral fijo a la izquierda, ancho = area.px.
      targetX = area.px + (vw - area.px) * 0.5;
      targetY = vh * 0.5;
    } else if (area) {
      // Bottom sheet, alto visible = area.px, desde abajo.
      targetX = vw * 0.5;
      targetY = (vh - area.px) * 0.5;
    } else {
      // Defensivo: si por algún motivo PoiPanel todavía no cargó,
      // centrado simple en toda la pantalla en vez de romper.
      targetX = vw * 0.5;
      targetY = vh * 0.5;
    }

    const mapEl = (typeof map !== 'undefined') ? map : null;
    if (!mapEl) {
      console.error('[panToPoiCenter] la variable global "map" no existe en este scope — no se puede centrar.');
      return;
    }

    const rect = mapEl.getContainer().getBoundingClientRect();
    const targetPx = L.point(targetX - rect.left, targetY - rect.top);
    const pinPx = mapEl.latLngToContainerPoint([poi.lat, poi.lng]);
    const centerPx = mapEl.latLngToContainerPoint(mapEl.getCenter());
    console.log('[panToPoiCenter] target (donde debe quedar el pin):', targetPx, '— pin ahora en:', pinPx, '— centro actual del mapa en px:', centerPx);

    // Nuevo centro = centro actual desplazado exactamente lo mismo
    // que hace falta mover el pin (pinPx → targetPx) — así, al
    // recentrar el mapa ahí, el pin cae justo en targetPx.
    const newCenterPx = centerPx.add(pinPx.subtract(targetPx));
    const newCenterLatLng = mapEl.containerPointToLatLng(newCenterPx);
    console.log('[panToPoiCenter] nuevo centro calculado (lat/lng):', newCenterLatLng, '— centro actual (lat/lng):', mapEl.getCenter(), '— zoom actual:', mapEl.getZoom());

    mapEl.setView(newCenterLatLng, mapEl.getZoom(), { animate: true, duration: .4 });
    console.log('[panToPoiCenter] map.setView() ejecutado sin tirar excepción.');
  };
}

// Run init after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}



