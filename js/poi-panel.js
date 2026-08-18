/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

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
 *   - El panel usa 2 tamaños abiertos CONFIGURABLES desde Admin >
 *     Global > "Panel de información" (globalSettings.panelPctPortrait
 *     / panelPctLandscape, ver js/admin-global.js): en pantallas
 *     verticales sigue siendo bottom sheet (arrastrable) con su alto
 *     abierto = panelPctPortrait% de la altura; en pantallas
 *     cuadradas/horizontales (INCLUYE desktop, ya no hay un
 *     breakpoint de ancho fijo) es un sidebar fijo a la izquierda sin
 *     drag, con ancho = panelPctLandscape% del ancho. Ver
 *     _applyPanelSizeVars() / getOpenAreaPx().
 *   - El botón "Editar" del footer solo se muestra si hay una sesión
 *     de administrador activa (`window.isAdminActive`).
 *   - `_render()` hace fallback a los campos legados del POI
 *     (`poi.name`/`poi.titulo`, `poi.desc`/`poi.descripcion`,
 *     `poi.hist`/`poi.historia`, `poi.hours`) cuando el contenido
 *     multiidioma nuevo está vacío o no existe.
 *   - [2026-08-14] El toggle on/off por imagen (activar/desactivar un
 *     skin) YA NO vive acá — se movió al panel admin de cada lugar
 *     (ver js/img-slots.js, junto a cada slot de imagen). Este panel
 *     público solo LEE qué skins están activos (`_getActiveSkinList`).
 *   - [2026-08-14] El "ojito" cambió de función: ya no controla la
 *     visibilidad pública del contador de clicks (esa función quedó
 *     huérfana en AppState.toggleClicksVisibility, sin UI que la
 *     dispare — pendiente de decidir dónde va).
 *   - [2026-08-15] El "ojito" cambió de función OTRA VEZ: ya NO toca
 *     la imagen de este panel. Ahora recorre las imágenes ACTIVAS del
 *     lugar (mismo criterio que antes, `getActiveSkinList` — ver
 *     js/utils.js) sobre el PIN MAXIMIZADO en el mapa, en loop (ver
 *     `cyclePinExpandedImage` en js/markers.js). El banner de este
 *     panel (`_renderHeroImage`) pasó a ser una imagen APARTE y fija
 *     (`poi.banner.url`), que el ojito no toca para nada.
 *   - [2026-08-15] Banner del panel: ya NO usa ninguna imagen del pin
 *     (`poi.skins`/`poi.imgB64`) — usa `poi.banner.url`, un campo
 *     separado subido a una carpeta distinta de Cloudinary
 *     (".../banner/", ver CloudinaryAdmin.buildFolder y el bloque de
 *     uploaders "Imagen banner del panel" en utils.js/index.html). Si
 *     no hay banner cargado, el hueco queda en 0px de alto (ya
 *     funcionaba así, ver css/poi-panel.css `.poi-panel__hero[hidden]`).
 *   - El centrado del mapa sobre el pin NO se hace desde este archivo
 *     — queda unificado en `window.panToPoiCenter` (js/app.js),
 *     llamado por js/cluster.js.
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

  // [2026-08-15] _heroSkinIndex se eliminó: el ojito YA NO cambia la
  // imagen hero de este panel (ver _renderHeroImage, ahora usa
  // poi.banner.url) — pasó a recorrer la imagen maximizada del PIN en
  // el mapa (js/markers.js, cyclePinExpandedImage). El índice/total
  // que muestra el badge del ojito (_renderEyeBadge) se lee de ahí.

  // Tamaño ABIERTO del panel — YA NO es un breakpoint de ancho fijo
  // (antes 1024px) ni un peek fijo en px (antes 300px). Ahora sale de
  // 2 sliders configurables en Admin > Global > "Panel de
  // información" (ver js/admin-global.js: globalSettings.panelPctPortrait
  // / globalSettings.panelPctLandscape), aplicados como % de pantalla:
  //   - panelPctPortrait  → % del ALTO en pantallas verticales
  //     (alto > ancho): el panel sigue siendo bottom sheet, pero su
  //     tamaño abierto ("peek", el que usa por defecto al abrir un
  //     POI) ahora es ese % de vh en vez de un fijo 300px.
  //   - panelPctLandscape → % del ANCHO en pantallas cuadradas u
  //     horizontales (ancho >= alto, INCLUYE desktop): el panel pasa
  //     a comportarse como sidebar fijo a la izquierda (sin drag),
  //     con ese % de vw en vez del fijo 380px de antes.
  // El criterio de orientación (`_isLandscapeScreen`) es el MISMO que
  // usa window.panToPoiCenter (js/app.js) — de hecho ese archivo lee
  // el tamaño real acá vía `getOpenAreaPx()` para que el centrado del
  // mapa y el tamaño visual del panel NUNCA queden desincronizados.
  function _panelPctPortrait() {
    const gs = (typeof globalSettings !== 'undefined') ? globalSettings : {};
    return (gs.panelPctPortrait != null) ? gs.panelPctPortrait : 45;
  }
  function _panelPctLandscape() {
    const gs = (typeof globalSettings !== 'undefined') ? globalSettings : {};
    return (gs.panelPctLandscape != null) ? gs.panelPctLandscape : 34;
  }
  function _isLandscapeScreen() {
    return window.innerWidth >= window.innerHeight;
  }
  function _portraitOpenPx() {
    return Math.round(window.innerHeight * (_panelPctPortrait() / 100));
  }
  function _landscapeOpenPx() {
    return Math.round(window.innerWidth * (_panelPctLandscape() / 100));
  }
  // Reemplaza al viejo _isDesktop()/matchMedia(min-width:1024px): el
  // criterio ahora es de orientación, no de ancho fijo — ver nota de
  // arriba.
  function _isSideMode() {
    return _isLandscapeScreen();
  }
  // Vuelca el % configurado a variables CSS reales (px) + al atributo
  // data-orientation que decide qué set de reglas CSS aplica (ver
  // css/poi-panel.css). Se llama al crear el DOM, al abrir un POI (por
  // si cambiaron los sliders o giró la pantalla desde la última vez)
  // y en cada resize mientras el panel exista.
  function _applyPanelSizeVars() {
    document.documentElement.style.setProperty('--poi-panel-peek-visible', _portraitOpenPx() + 'px');
    document.documentElement.style.setProperty('--poi-panel-side-width', _landscapeOpenPx() + 'px');
    if (_els) _els.panel.setAttribute('data-orientation', _isLandscapeScreen() ? 'landscape' : 'portrait');
  }

  /** Tamaño real (en px) que ocupa el panel ahora mismo, y de qué
   *  lado/eje — lo consume window.panToPoiCenter (js/app.js) para
   *  centrar el pin exactamente en la porción libre real, sin
   *  duplicar la lectura de globalSettings en 2 archivos distintos. */
  function getOpenAreaPx() {
    return _isLandscapeScreen()
      ? { mode: 'landscape', px: _landscapeOpenPx() }
      : { mode: 'portrait',  px: _portraitOpenPx() };
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
      <div data-role="lang-row" style="display:flex;justify-content:flex-end;align-items:center;gap:4px;padding:0 1.5rem 0.25rem;">
        <button type="button" data-role="eye-btn" title="Ver otra imagen de este lugar" style="border:none;background:transparent;padding:2px 4px;border-radius:6px;cursor:pointer;font-size:1rem;line-height:1;display:flex;align-items:center;gap:4px;color:#94a3b8;">
          <span data-role="eye-icon">👁️</span><span data-role="eye-count" style="font-size:0.75rem;font-weight:700;"></span>
        </button>
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
      actionBtn: panel.querySelector('[data-role="action-btn"]'),
    };

    _bindStaticEvents();
    _applyPanelSizeVars();
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

    // [Etapa 7] El selector ES/EN/PT ya no vive acá — pasó al header
    // global (js/lang-switcher.js). Este panel solo LEE `_currentLang`
    // (vía AppState.getContent más arriba) para pintarse en el idioma
    // activo; el resaltado del botón lo maneja el switcher del header.

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
    const finalFields = _resolveFields(poi, rawContent);

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

    // --- Campos internos (título + texto, cantidad libre, sin nombres fijos) ---
    _renderMeta(finalFields);

    // --- Botón de acción (solo visible/habilitado para admin) ---
    const isAdmin = _isAdminActive();
    els.actionBtn.hidden = !isAdmin;
    if (isAdmin) {
      els.actionBtn.textContent = _isEditMode ? 'Guardar cambios' : 'Editar';
    }
  }

  /**
   * Carga la imagen BANNER del panel — [REESCRITO 2026-08-15].
   * Ya NO usa las imágenes del pin (`poi.skins`/`poi.imgB64`): esas
   * son harina de otro costal, el mismo edificio/ícono que se ve en
   * el mapa. El banner es una imagen APARTE, guardada en
   * `poi.banner.url`, subida a una carpeta distinta de Cloudinary
   * (".../banner/", ver CloudinaryAdmin.buildFolder y el bloque de
   * uploaders en utils.js). No hay lista ni ojito acá: es una sola
   * imagen fija por lugar. Si no existe, no se intenta mostrar nada
   * — el banner queda en display:none / 0 alto (ver CSS) y el texto
   * sube pegado al título, nunca cae de vuelta a la imagen del pin.
   * @param {Object} poi
   */
  function _renderHeroImage(poi) {
    const els = _els;
    const url = (poi.banner && poi.banner.url) || '';

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
   * [2026-08-15] La lista de skins activos ahora es una función
   * GLOBAL compartida (ver js/utils.js, `getActiveSkinList`) — la
   * necesita también js/markers.js para el recorrido del ojito sobre
   * el pin maximizado. Este wrapper se deja solo para no tener que
   * tocar cada llamado interno de este archivo.
   * @param {Object} poi
   * @returns {{name: string, url: string}[]}
   */
  function _getActiveSkinList(poi) {
    return (typeof getActiveSkinList === 'function') ? getActiveSkinList(poi) : [];
  }

  /**
   * [2026-08-18] Sin uso desde que _renderEyeBadge dejó de mostrar el
   * numerito "posición/total" (a pedido de Cris — el contador
   * confundía con pocas imágenes activas de un total mayor cargado).
   * Se deja la función (no se borra): sigue siendo la forma correcta
   * de leer, del pin maximizado en el mapa, qué posición de la lista
   * de imágenes activas está mostrando ahora mismo (ver
   * js/markers.js — cyclePinExpandedImage guarda esto en
   * dataset.skinIndex del <img> del pin) — útil si se reactiva el
   * contador o se necesita ese dato para otra cosa más adelante.
   * @param {string} poiId
   * @returns {number}
   */
  function _getExpandedPinIndex(poiId) {
    const el = document.querySelector(`#pw-${poiId} .pin-img`);
    return el ? parseInt(el.dataset.skinIndex || '0', 10) : 0;
  }

  /**
   * Pinta el "ojito": el control público para recorrer las imágenes
   * activas del lugar SOBRE EL PIN MAXIMIZADO en el mapa —
   * [REESCRITO 2026-08-15] ya no toca la imagen banner de este panel
   * (ver _renderHeroImage). Muestra "posición/total" (ej. "2/4")
   * cuando hay más de una imagen activa disponible; se oculta el
   * contador si solo hay una (o ninguna), ya que no hay nada para
   * recorrer. El brillo (`eyeglow`, definido por shadow-eye.js) se
   * usa acá solo como indicador de "hay más para ver" — se reutiliza,
   * no se duplica.
   * @param {Object} poi
   */
  function _renderEyeBadge(poi) {
    const els = _els;
    const list = _getActiveSkinList(poi);
    const hasMultiple = list.length > 1;

    els.eyeIcon.style.opacity = hasMultiple ? '1' : '0.35';
    els.eyeIcon.style.animation = hasMultiple ? 'eyeglow 2s ease-in-out infinite' : 'none';
    // [2026-08-18] El numerito "1/10" se saca de la vista a pedido de
    // Cris: con pocas imágenes activas de un total mayor cargado, el
    // número confundía más de lo que ayudaba (no queda claro contra
    // qué total real cuenta). El ojito sigue funcionando igual —el
    // brillo (eyeglow) ya avisa "hay más para ver"— solo deja de
    // mostrarse el contador. `eyeCount` queda vacío en vez de borrado
    // del DOM por si se decide reactivarlo más adelante.
    els.eyeCount.textContent = '';

    els.eyeBtn.style.cursor = hasMultiple ? 'pointer' : 'default';
    els.eyeBtn.title = hasMultiple ? 'Ver otra imagen de este lugar' : '';
  }

  function _formatSubtitle(poi) {
    const parts = [];
    const coords = _getPoiCoords(poi);
    if (coords) parts.push(`${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
    if (poi.location_code) parts.push(poi.location_code);
    return parts.join(' · ');
  }

  /**
   * Resuelve los "campos internos" de un lugar (título + texto, cantidad
   * libre, SIN nombres de campo preestablecidos por el sistema — el
   * título de cada campo lo define quien carga el contenido, nunca el
   * código). Orden de prioridad, de más nuevo a más viejo:
   *
   *   1. content[idioma].fields[]  → [{title, text}, ...]  (esquema definitivo)
   *   2. content[idioma].custom_fields  → {clave: valor}   (esquema intermedio,
   *      ya en desuso; se sigue leyendo por compatibilidad con lo que se
   *      haya cargado mientras existió)
   *   3. poi.attrs  → [{l, v}, ...]  (editor viejo del admin, sin idioma
   *      — se usa igual para cualquier idioma como último respaldo)
   *   4. poi.hours suelto → un único campo "Horario" (comportamiento
   *      legado que ya existía antes de este cambio, se preserva tal
   *      cual para no romper pines viejos)
   *
   * Se usa el primer nivel que tenga contenido real; no se combinan.
   */
  function _resolveFields(poi, rawContent) {
    if (rawContent && Array.isArray(rawContent.fields) && rawContent.fields.length) {
      const fields = rawContent.fields
        .filter((f) => f && (String(f.title || '').trim() || String(f.text || '').trim()))
        .map((f) => ({ title: f.title || '', text: f.text || '' }));
      if (fields.length) return fields;
    }

    if (rawContent && rawContent.custom_fields && typeof rawContent.custom_fields === 'object') {
      const entries = Object.entries(rawContent.custom_fields)
        .filter(([, v]) => v && String(v).trim() !== '')
        .map(([key, value]) => ({ title: key, text: String(value) }));
      if (entries.length) return entries;
    }

    if (Array.isArray(poi.attrs) && poi.attrs.length) {
      const fromAttrs = poi.attrs
        .filter((a) => a && String(a.l || '').trim() && String(a.v || '').trim())
        .map((a) => ({ title: a.l, text: a.v }));
      if (fromAttrs.length) return fromAttrs;
    }

    if (poi.hours) return [{ title: 'Horario', text: poi.hours }];

    return [];
  }

  /**
   * Renderiza los campos internos como bloques verticales
   * "título arriba / texto abajo" — cantidad libre, sin límite.
   * @param {Array<{title:string, text:string}>} fields
   */
  function _renderMeta(fields) {
    const els = _els;
    els.metaRow.innerHTML = '';

    if (!fields || fields.length === 0) {
      els.metaSection.hidden = true;
      return;
    }

    els.metaSection.hidden = false;
    fields.forEach((field) => {
      const block = document.createElement('div');
      block.className = 'poi-panel__field-block';

      if (field.title) {
        const titleEl = document.createElement('p');
        titleEl.className = 'poi-panel__field-title';
        titleEl.textContent = field.title;
        block.appendChild(titleEl);
      }

      if (field.text) {
        const textEl = document.createElement('p');
        textEl.className = 'poi-panel__field-text';
        textEl.textContent = field.text;
        block.appendChild(textEl);
      }

      els.metaRow.appendChild(block);
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

    // [Etapa 7] El click de ES/EN/PT se maneja ahora en el header
    // global (js/lang-switcher.js), no acá — se sacó el bloque que
    // llamaba a AppState.setLanguage() por cada langBtn de este panel.

    // [FIX 2026-08-16] cyclePinExpandedImage (markers.js) ahora precarga
    // cada imagen antes de mostrarla y, si una falla, salta sola a la
    // siguiente — cuando eso pasa, el índice real que terminó
    // mostrándose puede no coincidir con el que se pintó al toque del
    // click (que es optimista). Este hook deja que markers.js avise acá
    // para repintar el contador con el valor correcto, sin que el
    // usuario tenga que volver a tocar el ojito.
    window.onPinImageCycled = (id) => {
      if (id !== _currentPoiId) return;
      const poi = AppState.getPoi(id);
      if (poi) _renderEyeBadge(poi);
    };

    els.eyeBtn.addEventListener('click', () => {
      // [REESCRITO 2026-08-15] Público: pasa a la siguiente imagen
      // activa del lugar, en loop — pero ahora sobre el PIN
      // MAXIMIZADO en el mapa (js/markers.js), no sobre el banner de
      // este panel (que es una imagen aparte, fija, ver
      // _renderHeroImage). El pin siempre está expandido mientras el
      // panel está abierto (lo hace pinClick en js/cluster.js), así
      // que alcanza con pedirle a markers.js que avance su imagen.
      if (!_currentPoiId) return;
      if (typeof cyclePinExpandedImage !== 'function') return;
      const result = cyclePinExpandedImage(_currentPoiId);
      if (!result) return; // nada para recorrer, o el pin no está expandido
      const poi = AppState.getPoi(_currentPoiId);
      if (poi) _renderEyeBadge(poi);
    });

    // [NUEVO 2026-08-18] Doble click / doble tap en cualquier parte
    // del panel pasa al "próximo" estado: peek → full, full → peek
    // (aproximadamente a la mitad, el mismo tamaño con el que abre
    // por defecto). No hace nada estando cerrado (no debería ser
    // posible tocarlo cerrado, pero por las dudas no rompe).
    // Se ignoran los dobles clicks sobre botones/inputs/links (para
    // no interferir con "Editar"/el ojito/selección de texto en modo
    // edición) y mientras _isEditMode está activo, donde un doble
    // click debe poder seleccionar una palabra en los campos como en
    // cualquier formulario.
    function _isInteractiveTarget(target) {
      return !!(target && target.closest && target.closest('button, a, input, textarea, select, [contenteditable="true"]'));
    }
    let _lastDoubleActivateAt = 0;
    function _toggleStateOnDoubleActivate() {
      // Guard: evita que el 'dblclick' nativo y la detección manual de
      // doble-tap de abajo disparen el toggle 2 veces para el mismo
      // gesto (algunos navegadores móviles sintetizan AMBOS eventos
      // para un mismo doble tap) — eso se vería como "no pasó nada"
      // porque el segundo toggle deshace al primero.
      const now = Date.now();
      if (now - _lastDoubleActivateAt < 250) return;
      _lastDoubleActivateAt = now;

      if (_panelState === SNAP.PEEK) {
        _snapTo(SNAP.FULL);
      } else if (_panelState === SNAP.FULL) {
        _snapTo(SNAP.PEEK);
      }
    }
    els.panel.addEventListener('dblclick', (e) => {
      if (_isEditMode || _isInteractiveTarget(e.target)) return;
      _toggleStateOnDoubleActivate();
    });
    // Fallback manual para doble TAP táctil: en algunos navegadores/
    // condiciones el 'dblclick' sintético de un doble tap no llega de
    // forma confiable (a diferencia del doble click de mouse, que
    // siempre es nativo). Se mide tiempo+distancia entre 2 pointerup
    // consecutivos de tipo touch.
    let _lastTapAt = 0;
    let _lastTapX = 0;
    let _lastTapY = 0;
    els.panel.addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'touch') return;
      if (_isEditMode || _isInteractiveTarget(e.target)) return;
      const now = Date.now();
      const dx = Math.abs(e.clientX - _lastTapX);
      const dy = Math.abs(e.clientY - _lastTapY);
      if (now - _lastTapAt < 350 && dx < 30 && dy < 30) {
        _toggleStateOnDoubleActivate();
        _lastTapAt = 0; // no encadenar un 3er tap como otro "doble"
      } else {
        _lastTapAt = now;
        _lastTapX = e.clientX;
        _lastTapY = e.clientY;
      }
    });

    document.addEventListener('app:languageChanged', (e) => {
      if (e.detail && e.detail.lang) {
        setLang(e.detail.lang);
      }
    });

    // Recalcula tamaño abierto + orientación al rotar/redimensionar
    // (ej. girar el celular, o pasar de ventana angosta a ancha en
    // desktop) — con rAF para no recalcular en cada pixel del resize.
    let _resizeRAF = null;
    window.addEventListener('resize', () => {
      if (_resizeRAF) cancelAnimationFrame(_resizeRAF);
      _resizeRAF = requestAnimationFrame(_applyPanelSizeVars);
    });
  }

  function _currentTranslateY() {
    const els = _els;
    const height = els.panel.getBoundingClientRect().height;
    if (_panelState === SNAP.FULL) return 0;
    if (_panelState === SNAP.PEEK) return height - _portraitOpenPx();
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
    if (_isSideMode()) return; // en modo lateral (landscape) el panel es sidebar fijo, no se arrastra

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
    function _openNow() {
      _ensureDom();
      _bindAppStateEvents();
      _applyPanelSizeVars(); // por si cambiaron los sliders o giró la pantalla desde el último open()

      _currentPoiId = poiId;
      _isEditMode = false;
      _render();
      _snapTo(initialState === SNAP.FULL ? SNAP.FULL : SNAP.PEEK);

      // El centrado del mapa sobre el pin YA NO se hace acá: queda a
      // cargo exclusivo de window.panToPoiCenter (js/app.js), llamado
      // desde js/cluster.js con el delay de 50ms tras el click. Tener
      // dos sistemas de centrado corriendo en paralelo (este panel +
      // panToPoiCenter) era justamente lo que rompía el centrado: el
      // segundo interrumpía al primero a mitad de animación.
    }

    // [NUEVO 2026-08-18] Si había otro panel/menú abierto (ej. el
    // dropdown de zonas) que js/cluster.js no haya cerrado ya de
    // antemano, lo cierra ya mismo y recién abre este 50ms después
    // (ver js/overlay-manager.js). Cuando el que llama (cluster.js)
    // ya se encargó de cerrar todo antes de esta llamada, acá no
    // queda nada para cerrar y `_openNow` corre sin ninguna demora
    // extra — no se acumulan dos delays.
    if (window.OverlayManager) {
      window.OverlayManager.beforeOpen('poiPanel', _openNow);
    } else {
      _openNow();
    }
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

  // [NUEVO 2026-08-18] Registro en OverlayManager (js/overlay-manager.js):
  // permite que abrir OTRO panel/menú (ej. el dropdown de zonas) cierre
  // este panel ya mismo, sin esperar su transición de salida. `open()`
  // ya no llama a `close()`/`_snapTo()` directo — pasa por `_openNow`
  // envuelta en `OverlayManager.beforeOpen`, que a su vez llama acá a
  // `close` si hiciera falta cerrar algún otro overlay primero.
  if (window.OverlayManager) {
    window.OverlayManager.register('poiPanel', {
      isOpen: () => _panelState !== SNAP.CLOSED,
      close,
    });
  }

  return {
    open,
    close,
    setLang,
    getCurrentPoiId,
    getOpenAreaPx,
  };
})();

window.PoiPanel = PoiPanel;
