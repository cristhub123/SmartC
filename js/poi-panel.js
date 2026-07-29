/**
 * ============================================================================
 * js/poi-panel.js
 * ----------------------------------------------------------------------------
 * PANEL DE POI — BOTTOM SHEET MINIMALISTA, CONECTADO A AppState
 * ----------------------------------------------------------------------------
 * Responsabilidades:
 *   1. Renderizar el panel flotante (bottom sheet) para un POI.
 *   2. Manejar arrastre (Pointer Events) con snap a "full" (92%) / "peek" (300px).
 *   3. Leer datos EXCLUSIVAMENTE vía AppState.getPoi() / AppState.getContent().
 *   4. Escribir cambios EXCLUSIVAMENTE vía AppState.updatePoi() /
 *      AppState.toggleSkinStatus(). Este archivo NUNCA llama a FirestoreSync
 *      directamente ni mantiene su propia copia autoritativa de los datos.
 *
 * INTEGRACIÓN REQUERIDA (no toca tu HTML existente):
 *   - Este módulo inyecta su propio DOM (el panel) al final de <body>
 *     la primera vez que se usa. No hace falta agregar markup a mano
 *     en el HTML — solo enlazar este script y css/poi-panel.css.
 *   - Para abrir el panel desde donde hoy dispares el click sobre un pin:
 *         PoiPanel.open(poiId);
 *   - Si tu app maneja el idioma activo con una variable/función propia,
 *     conectala así (elegí la que aplique, o ambas):
 *         PoiPanel.setLang('en');                         // manual
 *         document.dispatchEvent(new CustomEvent('app:languageChanged',
 *           { detail: { lang: 'en' } }));                  // reactivo
 *   - Este archivo asume que AppState ya fue hidratado (loadPois) antes
 *     de llamar a PoiPanel.open() — aunque AppState ahora también se
 *     auto-hidrata desde `window.POIS` como red de seguridad.
 *
 * NOTAS DE ESTA REVISIÓN:
 *   - Se eliminó por completo el overlay de fondo: el mapa ya no se
 *     oscurece cuando el panel está abierto.
 *   - En desktop (>=1024px) el panel se comporta como sidebar fijo a
 *     la izquierda (sin drag); en mobile sigue siendo bottom sheet.
 *   - El botón "Editar" del footer solo se muestra si hay una sesión
 *     de administrador activa (`window.isAdminActive`).
 *   - `_render()` hace fallback a los campos legados del POI
 *     (`poi.name`, `poi.desc`, `poi.hist`, `poi.hours`) cuando el
 *     contenido multiidioma nuevo está vacío o no existe.
 *   - Al abrir un POI se carga su imagen "full" (1024px) vía
 *     `AppState.getImageUrl(slug, skin, 'full')` y se centra el mapa
 *     suavemente en sus coordenadas (`_centerMapOn`, con 3 vías de
 *     integración posibles — ver comentario de esa función).
 * ============================================================================
 */

const PoiPanel = (function () {
  'use strict';

  // --------------------------------------------------------------------
  // 1. ESTADO INTERNO DEL PANEL (UI, no de datos — los datos viven en AppState)
  // --------------------------------------------------------------------

  let _currentPoiId = null;
  let _currentLang = 'es';
  let _isEditMode = false;
  let _panelState = 'closed'; // 'closed' | 'peek' | 'full'
  let _unsubscribers = [];

  // Breakpoint desktop: por encima de esto el panel es sidebar fijo
  // (sin drag); por debajo, bottom sheet arrastrable. Debe coincidir
  // con el media query usado en css/poi-panel.css.
  const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';
  const _desktopMql = (typeof window !== 'undefined' && window.matchMedia)
    ? window.matchMedia(DESKTOP_MEDIA_QUERY)
    : { matches: false, addEventListener: () => {}, addListener: () => {} };

  function _isDesktop() {
    return _desktopMql.matches;
  }

  // Referencias DOM (se crean una sola vez, ver _ensureDom)
  let _els = null;

  // --------------------------------------------------------------------
  // 2. CONSTRUCCIÓN DEL DOM (una sola vez, inyectado en <body>)
  // --------------------------------------------------------------------

  function _ensureDom() {
    if (_els) return _els;

    const panel = document.createElement('div');
    panel.className = 'poi-panel';
    panel.setAttribute('data-state', 'closed');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');

    panel.innerHTML = `
      <div class="poi-panel__handle-zone" data-role="handle-zone">
        <div class="poi-panel__handle"></div>
      </div>
      <div class="poi-panel__hero" data-role="hero">
        <img class="poi-panel__hero-image" data-role="hero-image" alt="">
      </div>
      <div class="poi-panel__header" data-role="header">
        <p class="poi-panel__category" data-role="category"></p>
        <h2 class="poi-panel__title" data-role="title"></h2>
        <p class="poi-panel__subtitle" data-role="subtitle"></p>
      </div>
      <div class="poi-panel__scroll" data-role="scroll">
        <div data-role="body-section">
          <p class="poi-panel__gancho" data-role="gancho"></p>
          <p class="poi-panel__body" data-role="description"></p>
        </div>
        <div data-role="meta-section" hidden>
          <p class="poi-panel__section-title">Datos</p>
          <div class="poi-panel__meta-row" data-role="meta-row"></div>
        </div>
        <div data-role="skins-section" hidden>
          <p class="poi-panel__section-title">Skins disponibles</p>
          <div class="poi-panel__skins-grid" data-role="skins-grid"></div>
        </div>
      </div>
      <div class="poi-panel__footer">
        <button type="button" class="poi-panel__action-btn" data-role="action-btn">
          Editar
        </button>
      </div>
    `;

    document.body.appendChild(panel);

    _els = {
      panel,
      handleZone: panel.querySelector('[data-role="handle-zone"]'),
      hero: panel.querySelector('[data-role="hero"]'),
      heroImage: panel.querySelector('[data-role="hero-image"]'),
      category: panel.querySelector('[data-role="category"]'),
      title: panel.querySelector('[data-role="title"]'),
      subtitle: panel.querySelector('[data-role="subtitle"]'),
      scroll: panel.querySelector('[data-role="scroll"]'),
      bodySection: panel.querySelector('[data-role="body-section"]'),
      gancho: panel.querySelector('[data-role="gancho"]'),
      description: panel.querySelector('[data-role="description"]'),
      metaSection: panel.querySelector('[data-role="meta-section"]'),
      metaRow: panel.querySelector('[data-role="meta-row"]'),
      skinsSection: panel.querySelector('[data-role="skins-section"]'),
      skinsGrid: panel.querySelector('[data-role="skins-grid"]'),
      actionBtn: panel.querySelector('[data-role="action-btn"]'),
    };

    _bindStaticEvents();
    return _els;
  }

  // --------------------------------------------------------------------
  // 3. RENDER — pinta el panel a partir del estado actual de AppState
  // --------------------------------------------------------------------

  function _render() {
    if (!_currentPoiId) return;
    const els = _ensureDom();

    const poi = AppState.getPoi(_currentPoiId);
    if (!poi) {
      console.warn(`[PoiPanel] POI "${_currentPoiId}" no encontrado en AppState.`);
      close();
      return;
    }

    const rawContent = AppState.getContent(_currentPoiId, _currentLang);

    // ------------------------------------------------------------
    // FALLBACK A CAMPOS LEGADOS: si el POI todavía no migró al
    // esquema `content` multiidioma (o vino resuelto desde
    // `window.POIS` crudo), completamos con sus campos planos
    // tradicionales para que el panel nunca se vea en blanco.
    // ------------------------------------------------------------
    const finalName = (rawContent && rawContent.name) || poi.name || '';
    const finalGancho = (rawContent && rawContent.gancho) || '';
    const finalDescription = (rawContent && rawContent.description) || poi.desc || poi.hist || '';
    const finalCustomFields = { ...((rawContent && rawContent.custom_fields) || {}) };
    if (!finalCustomFields.horario && poi.hours) {
      finalCustomFields.horario = poi.hours;
    }

    // --- Imagen principal (versión "full", 1024px, skin activo del POI) ---
    _renderHeroImage(poi);

    // --- Encabezado ---
    els.category.textContent = poi.category || '';
    els.subtitle.textContent = _formatSubtitle(poi);

    if (_isEditMode) {
      els.title.innerHTML = `<input type="text" class="poi-panel__input poi-panel__title-input" data-role="title-input" value="${_escapeAttr(finalName)}">`;
      els.gancho.innerHTML = `<input type="text" class="poi-panel__input" data-role="gancho-input" value="${_escapeAttr(finalGancho)}" placeholder="Gancho / bajada">`;
      els.description.innerHTML = `<textarea class="poi-panel__textarea" data-role="description-input" placeholder="Descripción">${_escapeHtml(finalDescription)}</textarea>`;
    } else {
      els.title.textContent = finalName;
      els.gancho.textContent = finalGancho;
      els.gancho.hidden = !finalGancho;
      els.description.textContent = finalDescription;
    }

    // --- Metadatos (custom_fields no vacíos, con fallback a poi.hours) ---
    _renderMeta(finalCustomFields);

    // --- Skins ---
    _renderSkins(poi);

    // --- Botón de acción (solo visible/habilitado para admin) ---
    const isAdmin = _isAdminActive();
    els.actionBtn.hidden = !isAdmin;
    if (isAdmin) {
      els.actionBtn.textContent = _isEditMode ? 'Guardar cambios' : 'Editar';
    }
  }

  /**
   * Carga la imagen principal/maximizada del POI (tamaño "full", 1024px)
   * usando el helper centralizado `AppState.getImageUrl`. Usa el skin
   * activo del POI (`poi.active_skin`), con fallback a "main".
   * @param {Object} poi
   */
  function _renderHeroImage(poi) {
    const els = _els;
    const slug = poi.slug || poi.id;

    if (!slug || typeof AppState.getImageUrl !== 'function') {
      els.hero.hidden = true;
      return;
    }

    const skin = poi.active_skin || 'main';
    const url = AppState.getImageUrl(slug, skin, 'full');

    els.hero.hidden = false;
    els.heroImage.src = url;
    els.heroImage.alt = (poi.content && poi.content[_currentLang] && poi.content[_currentLang].name) || poi.name || '';
  }

  /**
   * Centra suavemente el mapa en las coordenadas del POI al abrir el
   * panel. Como este archivo no conoce la implementación concreta del
   * mapa (Leaflet u otra), prueba, en orden, los puntos de integración
   * más probables del proyecto y usa el primero disponible:
   *   1. `window.SmartCityMap.centerOn(lat, lng)`  — API propia del proyecto, si existe.
   *   2. `window.map.flyTo([lat, lng], zoom)`      — instancia Leaflet expuesta globalmente.
   *   3. Evento genérico `poi:centerMap`           — por si el mapa prefiere suscribirse en vez de ser llamado directo.
   * Si ninguno de los tres existe, no hace nada (no rompe si el mapa
   * todavía no expone ninguna de estas vías).
   * @param {{lat: number, lng: number}} coords
   */
  function _centerMapOn(coords) {
    if (!coords) return;
    const { lat, lng } = coords;

    if (typeof window === 'undefined') return;

    if (window.SmartCityMap && typeof window.SmartCityMap.centerOn === 'function') {
      window.SmartCityMap.centerOn(lat, lng);
      return;
    }

    if (window.map && typeof window.map.flyTo === 'function') {
      window.map.flyTo([lat, lng], window.map.getZoom ? window.map.getZoom() : undefined);
      return;
    }

    document.dispatchEvent(new CustomEvent('poi:centerMap', { detail: { lat, lng } }));
  }

  /**
   * Determina si hay una sesión de administrador activa. Soporta tanto
   * una función (`window.isAdminActive()`) como un valor plano
   * (`window.isAdminActive` booleano), según cómo lo exponga el resto
   * de la app.
   * @returns {boolean}
   */
  function _isAdminActive() {
    if (typeof window === 'undefined') return false;
    const flag = window.isAdminActive;
    if (typeof flag === 'function') {
      try {
        return !!flag();
      } catch (err) {
        console.error('[PoiPanel] Error al evaluar window.isAdminActive():', err);
        return false;
      }
    }
    return !!flag;
  }

  /**
   * Extrae { lat, lng } de un POI soportando tanto el esquema nuevo
   * (`poi.coordinates.lat/lng`) como el legado (`poi.lat`/`poi.lng`
   * planos, tal como vienen en `window.POIS`).
   * @param {Object} poi
   * @returns {{lat: number, lng: number}|null}
   */
  function _getPoiCoords(poi) {
    if (poi.coordinates && typeof poi.coordinates.lat === 'number' && typeof poi.coordinates.lng === 'number') {
      return { lat: poi.coordinates.lat, lng: poi.coordinates.lng };
    }
    if (typeof poi.lat === 'number' && typeof poi.lng === 'number') {
      return { lat: poi.lat, lng: poi.lng };
    }
    return null;
  }

  function _formatSubtitle(poi) {
    const parts = [];
    const coords = _getPoiCoords(poi);
    if (coords) parts.push(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
    if (poi.location_code) parts.push(poi.location_code);
    return parts.join(' · ');
  }

  function _renderMeta(customFields) {
    const els = _els;
    const entries = Object.entries(customFields || {}).filter(([, v]) => v && String(v).trim() !== '');

    els.metaRow.innerHTML = '';
    if (entries.length === 0) {
      els.metaSection.hidden = true;
      return;
    }

    els.metaSection.hidden = false;
    entries.forEach(([key, value]) => {
      const span = document.createElement('span');
      span.className = 'poi-panel__meta-item';
      span.textContent = value;
      span.title = key;
      els.metaRow.appendChild(span);
    });
  }

  function _renderSkins(poi) {
    const els = _els;
    const skins = poi.skins || {};
    const skinNames = Object.keys(skins);

    els.skinsGrid.innerHTML = '';
    if (skinNames.length === 0) {
      els.skinsSection.hidden = true;
      return;
    }

    els.skinsSection.hidden = false;

    skinNames.forEach((skinName) => {
      const skin = skins[skinName];
      const row = document.createElement('div');
      row.className = 'poi-panel__skin-row';

      const thumb = document.createElement('img');
      thumb.className = 'poi-panel__skin-thumb';
      thumb.src = skin.url || '';
      thumb.alt = skinName;
      thumb.loading = 'lazy';

      const name = document.createElement('span');
      name.className = 'poi-panel__skin-name';
      name.textContent = skinName;

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'poi-panel__switch' + (skin.active ? ' is-active' : '');
      toggle.setAttribute('aria-pressed', String(!!skin.active));
      toggle.setAttribute('aria-label', `Activar/desactivar skin ${skinName}`);

      // Regla de negocio: 'main' es el fallback obligatorio y no se desactiva
      // (coincide con la guarda ya implementada en AppState.toggleSkinStatus).
      if (skinName === 'main') {
        toggle.disabled = true;
        toggle.title = "El skin 'main' no se puede desactivar (es el fallback).";
      }

      toggle.addEventListener('click', () => {
        const nextActive = !skin.active;
        AppState.toggleSkinStatus(_currentPoiId, skinName, nextActive);
        // No se re-renderiza acá manualmente: el listener de
        // AppState.EVENTS.SKIN_TOGGLED (ver _bindAppStateEvents) se
        // encarga de refrescar el panel cuando el estado cambia.
      });

      row.appendChild(thumb);
      row.appendChild(name);
      row.appendChild(toggle);
      els.skinsGrid.appendChild(row);
    });
  }

  function _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function _escapeAttr(str) {
    return _escapeHtml(str).replace(/"/g, '&quot;');
  }

  // --------------------------------------------------------------------
  // 4. EDICIÓN Y GUARDADO
  // --------------------------------------------------------------------

  function _enterEditMode() {
    _isEditMode = true;
    _render();
    // Al entrar en modo edición, forzamos snap a "full" para que el
    // usuario tenga espacio cómodo para escribir.
    _snapTo('full');
  }

  function _saveChanges() {
    const els = _els;
    const titleInput = els.title.querySelector('[data-role="title-input"]');
    const ganchoInput = els.gancho.querySelector('[data-role="gancho-input"]');
    const descInput = els.description.querySelector('[data-role="description-input"]');

    const poi = AppState.getPoi(_currentPoiId);
    if (!poi) return;

    const currentContent = poi.content && poi.content[_currentLang]
      ? poi.content[_currentLang]
      : {};

    const updatedContent = {
      ...poi.content,
      [_currentLang]: {
        ...currentContent,
        name: titleInput ? titleInput.value.trim() : currentContent.name,
        gancho: ganchoInput ? ganchoInput.value.trim() : currentContent.gancho,
        description: descInput ? descInput.value.trim() : currentContent.description,
      },
    };

    els.actionBtn.disabled = true;
    els.actionBtn.textContent = 'Guardando...';

    Promise.resolve(AppState.updatePoi({ id: _currentPoiId, content: updatedContent }))
      .finally(() => {
        _isEditMode = false;
        els.actionBtn.disabled = false;
        _render();
      });
  }

  // --------------------------------------------------------------------
  // 5. DRAG & SNAP (Pointer Events)
  // --------------------------------------------------------------------

  const SNAP = Object.freeze({ FULL: 'full', PEEK: 'peek', CLOSED: 'closed' });
  const PEEK_VISIBLE_PX = 300;
  const CLOSE_DRAG_THRESHOLD_PX = 120; // arrastre extra más allá de "peek" que dispara el cierre

  let _dragState = null; // { startY, startTranslate, panelHeight, pointerId }

  function _bindStaticEvents() {
    const els = _els;

    els.handleZone.addEventListener('pointerdown', _onPointerDown);

    els.actionBtn.addEventListener('click', () => {
      if (!_isAdminActive()) return; // defensa extra: el botón ya está oculto para no-admins
      if (_isEditMode) {
        _saveChanges();
      } else {
        _enterEditMode();
      }
    });

    document.addEventListener('app:languageChanged', (e) => {
      if (e.detail && e.detail.lang) {
        setLang(e.detail.lang);
      }
    });
  }

  function _currentTranslateY() {
    const els = _els;
    const height = els.panel.getBoundingClientRect().height;
    if (_panelState === SNAP.FULL) return 0;
    if (_panelState === SNAP.PEEK) return height - PEEK_VISIBLE_PX;
    return height; // closed
  }

  function _onPointerDown(e) {
    if (_isDesktop()) return; // en desktop el panel es sidebar fijo, no se arrastra

    const els = _els;
    const height = els.panel.getBoundingClientRect().height;

    _dragState = {
      startY: e.clientY,
      startTranslate: _currentTranslateY(),
      panelHeight: height,
      pointerId: e.pointerId,
    };

    els.handleZone.setPointerCapture(e.pointerId);
    els.panel.classList.add('is-dragging');

    els.handleZone.addEventListener('pointermove', _onPointerMove);
    els.handleZone.addEventListener('pointerup', _onPointerUp);
    els.handleZone.addEventListener('pointercancel', _onPointerUp);
  }

  function _onPointerMove(e) {
    if (!_dragState) return;
    const els = _els;

    const delta = e.clientY - _dragState.startY;
    const maxTranslate = _dragState.panelHeight; // límite inferior (cerrado)
    const nextTranslate = Math.min(
      Math.max(_dragState.startTranslate + delta, 0),
      maxTranslate + CLOSE_DRAG_THRESHOLD_PX
    );

    els.panel.style.transform = `translate(-50%, ${nextTranslate}px)`;
  }

  function _onPointerUp(e) {
    if (!_dragState) return;
    const els = _els;

    const delta = e.clientY - _dragState.startY;
    const finalTranslate = Math.max(_dragState.startTranslate + delta, 0);

    els.handleZone.releasePointerCapture(_dragState.pointerId);
    els.panel.classList.remove('is-dragging');
    els.handleZone.removeEventListener('pointermove', _onPointerMove);
    els.handleZone.removeEventListener('pointerup', _onPointerUp);
    els.handleZone.removeEventListener('pointercancel', _onPointerUp);

    const peekTranslate = _dragState.panelHeight - PEEK_VISIBLE_PX;
    const closeTranslate = _dragState.panelHeight + CLOSE_DRAG_THRESHOLD_PX * 0.6;

    _dragState = null;

    // Decide el snap más cercano: full / peek / cerrado.
    if (finalTranslate >= closeTranslate) {
      close();
      return;
    }

    // Punto medio entre full y peek decide a cuál de los dos snapea.
    const midPoint = peekTranslate / 2;
    if (finalTranslate <= midPoint) {
      _snapTo(SNAP.FULL);
    } else {
      _snapTo(SNAP.PEEK);
    }
  }

  function _snapTo(state) {
    const els = _ensureDom();
    _panelState = state;
    els.panel.setAttribute('data-state', state);
    // Se limpia el transform inline del arrastre: las reglas CSS por
    // atributo [data-state] retoman el control con su transición.
    els.panel.style.transform = '';
  }

  // --------------------------------------------------------------------
  // 6. SUSCRIPCIÓN A AppState — el panel se re-renderiza solo cuando
  //    los datos cambian, sin que ninguna otra parte de la app tenga
  //    que acordarse de "avisarle" al panel.
  // --------------------------------------------------------------------

  function _bindAppStateEvents() {
    if (_unsubscribers.length > 0) return; // ya suscripto

    _unsubscribers.push(
      AppState.on(AppState.EVENTS.POI_UPDATED, ({ poi }) => {
        if (poi && poi.id === _currentPoiId) _render();
      })
    );

    _unsubscribers.push(
      AppState.on(AppState.EVENTS.SKIN_TOGGLED, ({ poiId }) => {
        if (poiId === _currentPoiId) _render();
      })
    );

    _unsubscribers.push(
      AppState.on(AppState.EVENTS.ERROR, ({ message }) => {
        console.error('[PoiPanel] Error recibido desde AppState:', message);
      })
    );
  }

  // --------------------------------------------------------------------
  // 7. API PÚBLICA
  // --------------------------------------------------------------------

  /**
   * Abre el panel para un POI determinado, en estado "peek" por defecto.
   * @param {string} poiId
   * @param {'peek'|'full'} [initialState='peek']
   */
  function open(poiId, initialState) {
    _ensureDom();
    _bindAppStateEvents();

    _currentPoiId = poiId;
    _isEditMode = false;
    _render();
    _snapTo(initialState === SNAP.FULL ? SNAP.FULL : SNAP.PEEK);

    // Centrado suave del mapa en las coordenadas del POI recién abierto.
    const poi = AppState.getPoi(poiId);
    if (poi) _centerMapOn(_getPoiCoords(poi));
  }

  /** Cierra el panel y limpia el estado de edición. */
  function close() {
    _isEditMode = false;
    _snapTo(SNAP.CLOSED);
    // Se retrasa el clear del id hasta terminar la transición de salida,
    // para que un cierre accidental no borre datos a mitad de animación.
    window.setTimeout(() => {
      if (_panelState === SNAP.CLOSED) _currentPoiId = null;
    }, 350);
  }

  /** Cambia el idioma activo del contenido mostrado y re-renderiza. */
  function setLang(lang) {
    _currentLang = lang;
    if (_currentPoiId) _render();
  }

  /** @returns {string|null} id del POI actualmente abierto, o null */
  function getCurrentPoiId() {
    return _currentPoiId;
  }

  return {
    open,
    close,
    setLang,
    getCurrentPoiId,
  };
})();

window.PoiPanel = PoiPanel;
