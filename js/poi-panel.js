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
 *     (`poi.name`/`poi.titulo`, `poi.desc`/`poi.descripcion`,
 *     `poi.hist`/`poi.historia`, `poi.hours`) cuando el contenido
 *     multiidioma nuevo está vacío o no existe.
 *   - Al abrir un POI se carga su imagen "full" (1024px) desde la URL
 *     real ya guardada en el POI (`poi.skins[skin].url`/`poi.imgB64`,
 *     ver `_renderHeroImage`) y se centra el mapa suavemente en sus
 *     coordenadas (`_centerMapOn`, con 3 vías de integración posibles
 *     — ver comentario de esa función).
 *   - ID unificado: `poi.id` ahora ES el slug limpio (ej.
 *     "alto-paz-tower"), el mismo valor usado en el mapa y en el
 *     nombre de archivo de Cloudinary. `AppState.getPoi` normaliza
 *     además cualquier sufijo regional que markers.js/cluster.js le
 *     pegue al ID (ej. "-cordoba"), así que este archivo no necesita
 *     limpiar nada por su cuenta — solo llama a `AppState.getPoi(id)`
 *     tal cual.
 *   - Umbral de arrastre reducido a 36px (antes se pedía cruzar el
 *     punto medio entre "full" y "peek"): un gesto corto ya alcanza
 *     para subir/bajar/cerrar el panel. El drag SOLO arranca tocando
 *     el handle (`.poi-panel__handle-zone`); dentro del cuerpo
 *     scrolleable el gesto siempre es scroll de texto, nunca arrastre
 *     del panel completo.
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
      <div data-role="lang-row" style="display:flex;justify-content:space-between;align-items:center;gap:4px;padding:0 1.5rem 0.25rem;">
        <button type="button" data-role="eye-btn" title="Visibilidad pública del contador de visitas" style="border:none;background:transparent;padding:2px 4px;border-radius:6px;cursor:pointer;font-size:1rem;line-height:1;display:flex;align-items:center;gap:4px;color:#94a3b8;">
          <span data-role="eye-icon">👁️</span><span data-role="eye-count" style="font-size:0.75rem;font-weight:700;"></span>
        </button>
        <div style="display:flex;gap:4px;">
          <button type="button" data-role="lang-btn" data-lang="es" style="border:none;background:transparent;font-size:0.75rem;font-weight:700;letter-spacing:0.04em;padding:2px 6px;border-radius:6px;cursor:pointer;color:#94a3b8;">ES</button>
          <button type="button" data-role="lang-btn" data-lang="en" style="border:none;background:transparent;font-size:0.75rem;font-weight:700;letter-spacing:0.04em;padding:2px 6px;border-radius:6px;cursor:pointer;color:#94a3b8;">EN</button>
          <button type="button" data-role="lang-btn" data-lang="pt" style="border:none;background:transparent;font-size:0.75rem;font-weight:700;letter-spacing:0.04em;padding:2px 6px;border-radius:6px;cursor:pointer;color:#94a3b8;">PT</button>
        </div>
      </div>
      <div class="poi-panel__header" data-role="header">
        <p class="poi-panel__category" data-role="category"></p>
        <h2 class="poi-panel__title" data-role="title"></h2>
      </div>
      <div class="poi-panel__hero" data-role="hero" hidden>
        <img class="poi-panel__hero-image" data-role="hero-image" alt="">
      </div>
      <div class="poi-panel__subtitle-row" data-role="subtitle-row">
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
      langBtns: Array.from(panel.querySelectorAll('[data-role="lang-btn"]')),
      eyeBtn: panel.querySelector('[data-role="eye-btn"]'),
      eyeIcon: panel.querySelector('[data-role="eye-icon"]'),
      eyeCount: panel.querySelector('[data-role="eye-count"]'),
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
      // Caso esperado durante la migración a pois_cordoba.json: un pin
      // viejo (de una fuente anterior — Firestore, ingesta manual, etc.)
      // que ya no forma parte de la lista maestra actual. No es un error
      // de la app, así que no se grita en consola como tal — solo un
      // console.debug para quien esté depurando con verbose activado.
      console.debug(`[PoiPanel] POI "${_currentPoiId}" no está en la lista maestra actual — se ignora.`);
      close();
      return;
    }

    const rawContent = AppState.getContent(_currentPoiId, _currentLang);

    // --- Selector de idioma: resalta el botón activo ---
    els.langBtns.forEach((btn) => {
      const isActive = btn.dataset.lang === _currentLang;
      btn.style.color = isActive ? '#0d9488' : '#94a3b8';
      btn.style.background = isActive ? 'rgba(13,148,136,0.08)' : 'transparent';
    });

    // --- Ojito: visibilidad pública del contador de clicks ---
    _renderEyeBadge(poi);

    // ------------------------------------------------------------
    // FALLBACK A CAMPOS LEGADOS: si el POI todavía no migró al
    // esquema `content` multiidioma (o vino resuelto desde
    // `window.POIS` crudo), completamos con sus campos planos
    // tradicionales para que el panel nunca se vea en blanco.
    // ------------------------------------------------------------
    const finalName = (rawContent && rawContent.name) || poi.name || poi.titulo || '';
    const finalGancho = (rawContent && rawContent.gancho) || '';
    const finalDescription = (rawContent && rawContent.description)
      || poi.desc || poi.descripcion || poi.description
      || poi.hist || poi.historia
      || '';
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
   * a partir de la URL real ya guardada en el POI (`poi.skins[skin].url`
   * o `poi.imgB64`). Usa el skin activo del POI (`poi.active_skin`),
   * con fallback a "main". No adivina ninguna URL — si no hay ninguna
   * guardada, no se muestra imagen.
   * @param {Object} poi
   */
  function _renderHeroImage(poi) {
    const els = _els;
    const skin = poi.active_skin || 'main';

    // [LIMPIEZA 2026-08-12] Prioridad de la URL: 1) la real ya subida a
    // Cloudinary guardada en el POI (skins[skin].url, o el legado
    // poi.imgB64 para "main" — ver nota en utils.js: pese al nombre,
    // ya contiene una URL real, no base64). Antes había un 3er paso
    // que "adivinaba" la URL con AppState.getImageUrl — esa función
    // arma la ruta fija de Córdoba, así que en cualquier otra ciudad
    // apuntaba a un lugar equivocado de Cloudinary. Se sacó: si no hay
    // ninguna URL guardada de verdad, no se intenta cargar nada (el
    // banner queda oculto, ver más abajo).
    let url = '';
    if (poi.skins && poi.skins[skin] && poi.skins[skin].url) {
      url = poi.skins[skin].url;
    } else if (skin === 'main' && poi.imgB64) {
      url = poi.imgB64;
    }

    // Ocultación estricta: si no hay ninguna URL posible, ni se
    // intenta cargar — el banner queda en display:none / 0 alto
    // (ver CSS) y el texto se pega directo debajo del título.
    if (!url) {
      els.hero.hidden = true;
      els.heroImage.removeAttribute('src');
      return;
    }

    // Se mantiene oculto HASTA que la imagen realmente cargue (evento
    // `load`, atado una sola vez en _ensureDom) — así nunca se ve ni
    // un instante el recuadro gris antes de saber si la foto existe.
    // Si falla (404, CORS, etc.), el evento `error` lo deja oculto.
    els.hero.hidden = true;
    els.heroImage.alt = (poi.content && poi.content[_currentLang] && poi.content[_currentLang].name) || poi.name || poi.titulo || '';
    els.heroImage.src = url;
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

  /**
   * Pinta el "ojito": si `clicksPublicVisible` está activo, todos ven
   * el conteo de visitas del lugar con el efecto de brillo que ya
   * define shadow-eye.js (`--eye-glow-color` + `@keyframes eyeglow`,
   * inyectados dinámicamente por ese archivo — acá solo se reutilizan,
   * no se duplican). El toggle (tocar el botón para prender/apagar la
   * visibilidad) solo está habilitado para admin, igual que el botón
   * "Editar" — para un usuario normal, el ojito es de solo lectura.
   * @param {Object} poi
   */
  function _renderEyeBadge(poi) {
    const els = _els;
    const isPublic = !!poi.clicksPublicVisible;
    const isAdmin = _isAdminActive();

    els.eyeIcon.style.opacity = isPublic ? '1' : '0.35';
    els.eyeIcon.style.animation = isPublic ? 'eyeglow 2s ease-in-out infinite' : 'none';
    els.eyeCount.textContent = isPublic ? String(poi.clicks || 0) : '';
    els.eyeCount.style.color = 'var(--eye-glow-color, #60a5fa)';

    // Solo-lectura para usuarios normales: el ojito muestra el dato
    // pero no se puede tocar. Admin sí puede tocarlo para prender/
    // apagar la visibilidad pública.
    els.eyeBtn.style.cursor = isAdmin ? 'pointer' : 'default';
    els.eyeBtn.title = isAdmin
      ? (isPublic ? 'Ocultar el contador de visitas al público' : 'Mostrar el contador de visitas al público')
      : (isPublic ? `${poi.clicks || 0} visitas` : '');
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

  // Umbral de sensibilidad: un arrastre de solo 30-40px alcanza para
  // cambiar de estado (subir/bajar/cerrar el panel). Antes se pedía
  // arrastrar hasta pasar el punto medio entre "full" y "peek", lo
  // cual se sentía duro/pesado; ahora es un gesto corto y suave.
  const DRAG_THRESHOLD_PX = 36;

  let _dragState = null; // { startY, startTranslate, panelHeight, pointerId, startState }

  function _bindStaticEvents() {
    const els = _els;

    els.handleZone.addEventListener('pointerdown', _onPointerDown);

    // Ocultación estricta del banner: solo se revela si la imagen
    // efectivamente carga. Si falla (404, CORS, lo que sea), o si
    // nunca se le asignó `src` (ver _renderHeroImage), el contenedor
    // queda oculto (display:none / 0 alto vía CSS) y el texto sube
    // pegado al título — nunca se ve un recuadro gris vacío.
    els.heroImage.addEventListener('load', () => {
      if (els.heroImage.getAttribute('src')) els.hero.hidden = false;
    });
    els.heroImage.addEventListener('error', () => {
      els.hero.hidden = true;
    });

    els.actionBtn.addEventListener('click', () => {
      if (!_isAdminActive()) return; // defensa extra: el botón ya está oculto para no-admins
      if (_isEditMode) {
        _saveChanges();
      } else {
        _enterEditMode();
      }
    });

    els.langBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        AppState.setLanguage(btn.dataset.lang);
        // El re-render llega solo vía AppState.EVENTS.LANGUAGE_CHANGED
        // (ver _bindAppStateEvents), así que acá no hace falta nada más.
      });
    });

    els.eyeBtn.addEventListener('click', () => {
      if (!_isAdminActive() || !_currentPoiId) return; // solo-lectura para usuarios normales
      const poi = AppState.getPoi(_currentPoiId);
      if (!poi) return;
      AppState.toggleClicksVisibility(_currentPoiId, !poi.clicksPublicVisible);
      // El re-render llega vía AppState.EVENTS.POI_UPDATED.
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

  /**
   * El arrastre del panel SOLO puede arrancar tocando el drag handle
   * (`.poi-panel__handle-zone`, el equivalente de "header"/handle del
   * spec). El cuerpo scrolleable (`.poi-panel__scroll`) no tiene este
   * listener — ahí el pointerdown/move nativo del navegador hace
   * scroll de texto normal, sin interferir con el panel.
   */
  function _onPointerDown(e) {
    if (_isDesktop()) return; // en desktop el panel es sidebar fijo, no se arrastra

    const els = _els;
    const height = els.panel.getBoundingClientRect().height;

    _dragState = {
      startY: e.clientY,
      startTranslate: _currentTranslateY(),
      startState: _panelState,
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
      maxTranslate
    );

    els.panel.style.transform = `translate(-50%, ${nextTranslate}px)`;
  }

  function _onPointerUp(e) {
    if (!_dragState) return;
    const els = _els;

    const delta = e.clientY - _dragState.startY; // + = arrastró hacia abajo, - = hacia arriba
    const { startState } = _dragState;

    els.handleZone.releasePointerCapture(_dragState.pointerId);
    els.panel.classList.remove('is-dragging');
    els.handleZone.removeEventListener('pointermove', _onPointerMove);
    els.handleZone.removeEventListener('pointerup', _onPointerUp);
    els.handleZone.removeEventListener('pointercancel', _onPointerUp);
    _dragState = null;

    // Con un arrastre por debajo del umbral, el panel vuelve a su
    // estado de partida (gesto no intencional / mano temblando).
    if (Math.abs(delta) < DRAG_THRESHOLD_PX) {
      _snapTo(startState);
      return;
    }

    const draggedDown = delta > 0;

    if (startState === SNAP.FULL) {
      // Desde "full": un toque hacia abajo alcanza para bajar a "peek".
      _snapTo(draggedDown ? SNAP.PEEK : SNAP.FULL);
      return;
    }

    if (startState === SNAP.PEEK) {
      // Desde "peek": hacia arriba sube a "full", hacia abajo cierra.
      if (draggedDown) {
        close();
      } else {
        _snapTo(SNAP.FULL);
      }
      return;
    }

    // Estado "closed" no debería recibir drag (el panel no es visible),
    // pero por las dudas no rompemos si pasara.
    _snapTo(startState);
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
      AppState.on(AppState.EVENTS.LANGUAGE_CHANGED, ({ lang }) => {
        _currentLang = lang;
        if (_currentPoiId) _render();
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
