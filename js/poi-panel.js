/*
AI PROJECT NOTE — LECTURA OBLIGATORIA PARA CUALQUIER IA:
Antes de modificar este archivo, toda IA (Claude, ChatGPT u otra) DEBE
leer primero /AI_RULES.md completo. Sin excepcion, sin importar cuan
chico o simple parezca el cambio, y sin esperar a que el usuario lo
pida o lo recuerde — esta nota es la instruccion, no un recordatorio
opcional. Si /AI_RULES.md ya se leyo en esta misma sesion, alcanza con
revisar /AI_SESSION.md en su lugar.

Despues de modificar este archivo, actualizar /AI_SESSION.md con el
cambio hecho y la verificacion realizada.
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
  /* [Etapa 5] título configurable de la pestaña "Eventos" del panel
     público, cargado una vez desde Firestore (settings/eventos-config,
     ver js/eventos.js → loadEventosConfig()) y refrescado si el admin
     lo guarda de nuevo en su propia sesión. */
  let _eventosConfigCache = null;
  let _panelState = 'closed'; // 'closed' | 'peek' | 'full'
  /* [Etapa 15, 2026-09-29] Modo "Todos los eventos": el MISMO panel, sin un
     lugar puntual (`_currentPoiId` queda en null), mostrando el buscador +
     grilla de js/eventos-todos.js. Se apaga solo en cuanto se abre un lugar
     (`open()`). `_pendingTab` deja pedir la pestaña inicial del PRÓXIMO
     lugar que se abra (tocar una tarjeta de "Todos" → pestaña Eventos). */
  let _todosMode = false;
  let _pendingTab = null;
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
        <button type="button" data-role="eye-btn" title="" style="border:none;background:transparent;padding:2px 4px;border-radius:6px;cursor:pointer;font-size:1rem;line-height:1;display:flex;align-items:center;gap:4px;color:#94a3b8;">
          <span data-role="eye-icon">👁️</span><span data-role="eye-count" style="font-size:0.75rem;font-weight:700;"></span>
        </button>
      </div>
      <div class="poi-panel__header" data-role="header">
        <h2 class="poi-panel__title" data-role="title"></h2>
        <!-- [2026-09-28] Categorías/subcategorías reales del lugar: texto simple
             (no botones), una sola línea justo bajo el título; si no entran,
             se desplazan de izquierda a derecha. -->
        <div class="poi-panel__cats-wrap" data-role="cats-wrap" hidden>
          <div class="poi-panel__cats-row" data-role="cats-row"></div>
        </div>
      </div>
      <div class="poi-panel__hero" data-role="hero" hidden>
        <img class="poi-panel__hero-image" data-role="hero-image" alt="">
      </div>
      <!-- [Etapa 5] Sistema de 2 pestañas — SOLO se muestra cuando el
           pin tiene ≥1 evento vigente en este momento (ver
           _eventosVigentesDelPoi()). Con 0 eventos vigentes queda
           oculto y el panel se comporta exactamente igual que antes
           (info general, sin pestañas). El rótulo de la 2da pestaña
           es editable por el admin (ver evt-config-titulo-panel en
           el admin, cargado acá vía loadEventosConfig()). -->
      <div class="poi-panel__tabs-row" data-role="tabs-row" hidden>
        <button type="button" class="poi-panel__tab-btn on" data-role="tab-info-btn" data-tab="info"></button>
        <button type="button" class="poi-panel__tab-btn" data-role="tab-eventos-btn" data-tab="eventos"></button>
      </div>
      <div class="poi-panel__subtitle-row" data-role="subtitle-row">
        <p class="poi-panel__subtitle" data-role="subtitle"></p>
      </div>
      <div class="poi-panel__scroll" data-role="scroll">
        <div data-role="info-tab-content">
          <div data-role="body-section">
            <p class="poi-panel__gancho" data-role="gancho"></p>
            <p class="poi-panel__body" data-role="description"></p>
          </div>
          <div data-role="meta-section" hidden>
            <p class="poi-panel__section-title" data-role="meta-section-title"></p>
            <div class="poi-panel__meta-row" data-role="meta-row"></div>
          </div>
        </div>
        <div data-role="eventos-tab-content" hidden>
          <div data-role="eventos-list"></div>
        </div>
        <!-- [Etapa 15] Contenido del modo "Todos los eventos" (js/eventos-todos.js) -->
        <div data-role="todos-content" hidden></div>
      </div>
      <div class="poi-panel__footer">
        <button type="button" class="poi-panel__action-btn" data-role="action-btn">
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
      title: panel.querySelector('[data-role="title"]'),
      subtitle: panel.querySelector('[data-role="subtitle"]'),
      subtitleRow: panel.querySelector('[data-role="subtitle-row"]'),
      catsRow: panel.querySelector('[data-role="cats-row"]'),
      catsWrap: panel.querySelector('[data-role="cats-wrap"]'),
      scroll: panel.querySelector('[data-role="scroll"]'),
      tabsRow: panel.querySelector('[data-role="tabs-row"]'),
      tabInfoBtn: panel.querySelector('[data-role="tab-info-btn"]'),
      tabEventosBtn: panel.querySelector('[data-role="tab-eventos-btn"]'),
      infoTabContent: panel.querySelector('[data-role="info-tab-content"]'),
      eventosTabContent: panel.querySelector('[data-role="eventos-tab-content"]'),
      eventosList: panel.querySelector('[data-role="eventos-list"]'),
      todosContent: panel.querySelector('[data-role="todos-content"]'),
      bodySection: panel.querySelector('[data-role="body-section"]'),
      gancho: panel.querySelector('[data-role="gancho"]'),
      description: panel.querySelector('[data-role="description"]'),
      metaSection: panel.querySelector('[data-role="meta-section"]'),
      metaSectionTitle: panel.querySelector('[data-role="meta-section-title"]'),
      metaRow: panel.querySelector('[data-role="meta-row"]'),
      actionBtn: panel.querySelector('[data-role="action-btn"]'),
    };

    _els.catsRow.addEventListener('scroll', _updateCatsHints, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(_updateCatsHints).observe(_els.catsRow);
    _els.tabInfoBtn.addEventListener('click', () => _setActiveTab('info'));
    _els.tabEventosBtn.addEventListener('click', () => _setActiveTab('eventos'));

    // [i18n 2026-09-26] Textos fijos del "cascarón" del panel (pestaña
    // Info, título de sección "Datos") que el template arma UNA sola
    // vez — a diferencia del resto del contenido, esto no pasa por
    // _render() en cada apertura, así que hace falta aplicarlo acá Y
    // re-aplicarlo cada vez que cambia el idioma (ver suscripción en
    // _bindAppStateEvents). El resto de los textos fijos del panel
    // (ojito, "Eventos" default, Editar/Guardar) SÍ se resetean solos
    // en cada _render(), no hace falta tocarlos acá.
    _applyStaticChromeI18n();

    // [Etapa 12] click del ícono 📍 de las tarjetas de evento + fallback de foto
    // rota — delegado sobre la lista, sobrevive a los re-pintados.
    if (window.EventoCard) EventoCard.bind(_els.eventosList);

    _bindStaticEvents();
    _applyPanelSizeVars();
    return _els;
  }

  function _applyStaticChromeI18n() {
    if (!_els) return;
    const _t = (k) => (window.I18N ? I18N.t(k) : k);
    _els.tabInfoBtn.textContent = _t('poi_tab_info');
    _els.metaSectionTitle.textContent = _t('pp_datos_label');
  }

  /** [Etapa 5] Cambia de pestaña sin volver a pintar todo el panel —
   *  ambos contenidos ya están renderizados, solo se alterna qué se
   *  ve. `_activeTab` se resetea a 'info' cada vez que se abre un
   *  pin nuevo (ver open()). */
  let _activeTab = 'info';
  function _setActiveTab(tab) {
    _activeTab = tab;
    const els = _els;
    if (!els) return;
    els.tabInfoBtn.classList.toggle('on', tab === 'info');
    els.tabEventosBtn.classList.toggle('on', tab === 'eventos');
    els.infoTabContent.hidden = tab !== 'info';
    els.eventosTabContent.hidden = tab !== 'eventos';
  }

  /** [Etapa 5] Eventos vigentes de un pin puntual, mismo criterio de
   *  "vigente" que el ciclo de vida de la Etapa 4
   *  (`_eventoEsVigente`, definida en js/eventos.js — se referencia
   *  acá tal cual, sin duplicar el criterio). Ordenados por
   *  cercanía de fecha: el que antes vence (o antes empieza, si no
   *  tiene fecha_fin) va arriba; los sin ninguna fecha quedan al
   *  final. */
  function _eventosVigentesDelPoi(poiId) {
    if (typeof EVENTOS === 'undefined' || typeof _eventoEsVigente !== 'function') return [];
    // [Filtro de fecha de eventos, 2026-09-03] con el filtro "Eventos"
    // activo y una fecha elegida, además de los vigentes-hoy también
    // entran los eventos del pin que ocurren ESE día aunque ya no
    // sean vigentes respecto a hoy (caso: fecha elegida en el
    // pasado) — así el pin siempre muestra sus eventos de la fecha
    // seleccionada. Ver js/eventos-fecha-filtro.js.
    const fechaActiva = (typeof activeFilter !== 'undefined' && activeFilter === '__eventos__'
      && typeof fechaFiltroEventos !== 'undefined' && fechaFiltroEventos) ? fechaFiltroEventos : null;
    // [Etapa 14, 2026-09-28] fin del rango elegido, o null si es un día puntual.
    const fechaHastaActiva = fechaActiva && typeof fechaFiltroEventosHasta !== 'undefined' ? fechaFiltroEventosHasta : null;
    const ocurreEnFechaActiva = ev => fechaActiva && typeof _eventoOcurreEnFecha === 'function' && _eventoOcurreEnFecha(ev, fechaActiva, undefined, fechaHastaActiva);
    const propios = EVENTOS.filter(ev => ev.poi_id === poiId && (_eventoEsVigente(ev) || ocurreEnFechaActiva(ev)));
    const fechaOrden = ev => {
      const f = ev.fecha_fin || ev.fecha_inicio;
      const d = f ? new Date(f).getTime() : NaN;
      return isNaN(d) ? Infinity : d;
    };
    return propios.sort((a, b) => {
      // Con fecha activa, los eventos que ocurren ESE día van
      // siempre arriba; el resto (otros días) queda debajo, cada
      // grupo ordenado igual que antes por cercanía de fecha.
      if (fechaActiva) {
        const aMatch = ocurreEnFechaActiva(a) ? 0 : 1;
        const bMatch = ocurreEnFechaActiva(b) ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
      }
      return fechaOrden(a) - fechaOrden(b);
    });
  }

  /** [Etapa 5] Tarjetas de eventos dentro del panel público — texto
   *  por ahora (a futuro cada evento podría tener foto/banner propio,
   *  ver PLAN_USUARIOS_EVENTOS.md). */
  function _renderEventosTab(poi, eventosDelPoi) {
    const els = _els;
    const hayEventos = eventosDelPoi.length > 0;
    els.tabsRow.hidden = !hayEventos;
    if (!hayEventos) {
      els.eventosList.innerHTML = '';
      if (_activeTab === 'eventos') _setActiveTab('info');
      return;
    }
    if (els.tabEventosBtn && typeof _eventosConfigCache !== 'undefined') {
      // [i18n 2026-09-26] El rótulo custom que puso el admin
      // (tituloPanelEventos) queda tal cual lo escribió — es un solo
      // idioma, no forma parte de este alcance (ver ACLARACIONES_
      // RELEVANTES.md). Solo el DEFAULT ("Eventos") se traduce.
      const _t = (k) => (window.I18N ? I18N.t(k) : k);
      els.tabEventosBtn.textContent = (_eventosConfigCache && _eventosConfigCache.tituloPanelEventos) || _t('pp_sec_eventos');
    }
    // [Filtro de fecha de eventos, 2026-09-03] con fecha activa, la
    // tarjeta de un evento que NO ocurre ese día queda atenuada
    // (opacidad configurable en Admin → Eventos) — el orden ya la deja
    // debajo de los que sí coinciden (ver _eventosVigentesDelPoi).
    const fechaActiva = (typeof activeFilter !== 'undefined' && activeFilter === '__eventos__'
      && typeof fechaFiltroEventos !== 'undefined' && fechaFiltroEventos) ? fechaFiltroEventos : null;
    // [Etapa 14, 2026-09-28] fin del rango elegido, o null si es un día puntual.
    const fechaHastaActiva = fechaActiva && typeof fechaFiltroEventosHasta !== 'undefined' ? fechaFiltroEventosHasta : null;
    // [Etapa 12/13, 2026-09-28] Las tarjetas salen de EventoCard (js/evento-card.js,
    // una sola función de render) y se muestran en un carrusel horizontal con
    // scroll (ya no una lista apilada de texto).
    const catalogo = (_eventosConfigCache && Array.isArray(_eventosConfigCache.categoriasEvento)) ? _eventosConfigCache.categoriasEvento : [];
    const tarjetas = eventosDelPoi.map(ev => {
      const noCoincideConFecha = fechaActiva && typeof _eventoOcurreEnFecha === 'function' && !_eventoOcurreEnFecha(ev, fechaActiva, undefined, fechaHastaActiva);
      const dimOpacity = noCoincideConFecha
        ? (window.getOpacidadReducidaFiltroFecha ? window.getOpacidadReducidaFiltroFecha() : 0.35)
        : null;
      // [2026-09-30] Polaroid: fechaDesde/fechaHasta deciden verde/rojo de los
      // recuadros (null = EventoCard usa la fecha de hoy).
      return window.EventoCard ? EventoCard.render(ev, { catalogo, dimOpacity, fechaDesde: fechaActiva, fechaHasta: fechaHastaActiva }) : '';
    }).join('');
    els.eventosList.innerHTML = `<div class="poi-panel__eventos-carousel${eventosDelPoi.length === 1 ? ' poi-panel__eventos-carousel--single' : ''}">${tarjetas}</div>`;
    // Mantiene la pestaña activa que ya tuviera (no fuerza a "eventos"
    // cada vez que se re-pinta, ver decisión de Cris: solo aparece la
    // pestaña, no se auto-abre encima de la info general).
    _setActiveTab(_activeTab);
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
    // [2026-09-28] "Sin datos históricos." es un texto de relleno que
    // el sistema guarda en poi.hist cuando no hay historia cargada — no
    // es información para el visitante, así que se trata como vacío.
    const finalDescription = [
      rawContent && rawContent.description,
      poi.desc, poi.descripcion, poi.description,
      poi.hist, poi.historia,
    ].map(_stripPlaceholderText).find(Boolean) || '';
    const allFields = _resolveFields(poi, rawContent);
    // Los campos titulados "Categoría" se reemplazan por la fila de
    // categorías (ver _renderCategoriesRow) — no se muestran duplicados.
    const finalFields = allFields.filter((f) => !_isCategoryFieldTitle(f.title));

    // --- Imagen principal (versión "full", 1024px, skin activo del POI) ---
    _renderHeroImage(poi);

    // --- Encabezado ---
    // [2026-09-28] El panel ya no muestra textos sueltos sin conexión con el
    // sistema de filtros (categoría suelta sobre el título, coordenadas,
    // location_code): solo el nombre, y las categorías reales en su fila.
    els.subtitle.textContent = '';
    els.subtitleRow.hidden = true;

    if (_isEditMode) {
      els.title.innerHTML = `<input type="text" class="poi-panel__input poi-panel__title-input" data-role="title-input" value="${_escapeAttr(finalName)}">`;
      els.gancho.innerHTML = `<input type="text" class="poi-panel__input" data-role="gancho-input" value="${_escapeAttr(finalGancho)}" placeholder="Gancho / bajada">`;
      els.description.innerHTML = `<textarea class="poi-panel__textarea" data-role="description-input" placeholder="Descripción">${_escapeHtml(finalDescription)}</textarea>`;
      els.description.hidden = false;
    } else {
      els.title.textContent = finalName;
      els.gancho.textContent = finalGancho;
      els.gancho.hidden = !finalGancho;
      els.description.textContent = finalDescription;
      els.description.hidden = !finalDescription;
    }
    // Color propio del nombre, por pin (opcional, tab Editar) — si no
    // se cargó ninguno, se limpia el inline style y el CSS vuelve a
    // usar var(--pines-title-color, var(--poi-panel-slate-900)) como
    // siempre (color general de la pestaña "Interfaz").
    els.title.style.color = poi.titleColor || '';

    // --- Categorías del lugar, en una sola fila ---
    _renderCategoriesRow(poi);

    // --- Campos internos (título + texto, cantidad libre, sin nombres fijos) ---
    _renderMeta(finalFields);

    // --- [Etapa 5] Pestaña "Eventos" del panel público — solo
    // aparece si el pin tiene ≥1 evento vigente ahora mismo. ---
    _renderEventosTab(poi, _eventosVigentesDelPoi(_currentPoiId));

    // --- Botón de acción (solo visible/habilitado para admin) ---
    const isAdmin = _isAdminActive();
    els.actionBtn.hidden = !isAdmin;
    if (isAdmin) {
      const _t = (k) => (window.I18N ? I18N.t(k) : k);
      els.actionBtn.textContent = _isEditMode ? _t('guardar_cambios') : _t('pp_editar_btn');
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
    els.eyeBtn.title = hasMultiple ? (window.I18N ? I18N.t('pp_eye_other_image_title') : 'Ver otra imagen de este lugar') : '';
  }

  /** Texto de relleno que el sistema escribe cuando no hay contenido
   *  real (ver pin-adjust.js / content-import.js). Devuelve '' si el
   *  texto es ese relleno, o el texto tal cual si no. */
  function _stripPlaceholderText(text) {
    const t = String(text || '').trim();
    return /^sin datos hist[oó]ricos\.?$/i.test(t) ? '' : t;
  }

  /** ¿Este campo interno es el viejo bloque "Categoría"? */
  function _isCategoryFieldTitle(title) {
    const t = String(title || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s:.\-]+$/g, '');
    return t === 'categoria' || t === 'categorias' || t === 'category' || t === 'categories';
  }

  /** Nombres (en el idioma activo) de TODAS las categorías y
   *  subcategorías del lugar, sin repetir. */
  function _getPoiCategoryLabels(poi) {
    const labels = [];
    const seen = new Set();
    const push = (l) => {
      const clean = String(l || '').trim();
      if (!clean) return;
      const nice = clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
      const key = nice.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      labels.push(nice);
    };
    const all = (typeof getAllCats === 'function') ? getAllCats() : {};
    const ids = Array.isArray(poi.categories) && poi.categories.length
      ? poi.categories
      : (poi.category ? [poi.category] : []);
    ids.forEach((id) => {
      const cfg = all[id];
      // Solo categorías que existen en el sistema de filtros; un texto
      // libre legado (ej. "Tiendas") sin categoría real detrás no se muestra.
      if (cfg && typeof getCatLabel === 'function') push(getCatLabel(cfg, _currentLang));
    });
    (Array.isArray(poi.subcategories) ? poi.subcategories : []).forEach((subId) => {
      const owner = (typeof _findSubcatOwner === 'function') ? _findSubcatOwner(subId) : null;
      if (owner && typeof getCatLabel === 'function') push(getCatLabel(owner.sub, _currentLang));
    });
    return labels;
  }

  /** Pinta la fila única de categorías. Solo usa las categorías/
   *  subcategorías reales del lugar (poi.categories / poi.subcategories);
   *  si no tiene ninguna, la fila no se muestra. */
  function _renderCategoriesRow(poi) {
    const els = _els;
    const labels = _getPoiCategoryLabels(poi);
    // Texto simple separado por " - " (no botones), una sola línea.
    els.catsRow.innerHTML = labels
      .map((l) => `<span class="poi-panel__cat-chip">${_escapeHtml(l)}</span>`)
      .join('&nbsp;-&nbsp;');
    els.catsWrap.hidden = labels.length === 0;
    els.catsRow.scrollLeft = 0;
    requestAnimationFrame(_updateCatsHints);
  }

  /** Indicadores ‹ › (clase has-left / has-right en el contenedor) cuando
   *  la fila de categorías tiene más texto oculto hacia ese lado. */
  function _updateCatsHints() {
    const els = _els;
    if (!els || !els.catsRow) return;
    const r = els.catsRow;
    els.catsWrap.classList.toggle('has-left', r.scrollLeft > 4);
    els.catsWrap.classList.toggle('has-right', r.scrollLeft < r.scrollWidth - r.clientWidth - 4);
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
    els.actionBtn.textContent = (window.I18N ? I18N.t('pp_guardando') : 'Guardando...');

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

    // [2026-09-28] El panel se puede arrastrar desde CUALQUIER parte de
    // su superficie (táctil) — ver _onPanelTouch* más abajo. El handle
    // conserva su propio arrastre por Pointer Events (funciona también
    // con mouse).
    els.panel.addEventListener('touchstart', _onPanelTouchStart, { passive: true });
    els.panel.addEventListener('touchmove', _onPanelTouchMove, { passive: false });
    els.panel.addEventListener('touchend', _onPanelTouchEnd, { passive: true });
    els.panel.addEventListener('touchcancel', _onPanelTouchEnd, { passive: true });

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

  // Posición vertical (translateY, px) de cada estado — mismas cuentas
  // que las reglas [data-state] de css/poi-panel.css.
  function _translateForState(state, height) {
    if (state === SNAP.FULL) return 0;
    if (state === SNAP.PEEK) {
      const gap = Math.max(0, window.innerHeight - height);
      return Math.max(0, height - gap - _portraitOpenPx());
    }
    return height; // closed
  }

  /** Posición real actual del panel (sirve incluso a mitad de una
   *  transición de estado). */
  function _measureTranslateY(height) {
    const rect = _els.panel.getBoundingClientRect();
    const t = rect.top - (window.innerHeight - height);
    return Math.min(Math.max(t, 0), height);
  }

  // ---- Núcleo del arrastre (lo comparten el handle y el resto del panel) ----

  function _beginDrag(y, pointerId) {
    const els = _els;
    const height = els.panel.getBoundingClientRect().height;
    _dragState = {
      startY: y,
      startTranslate: _measureTranslateY(height),
      startState: _panelState,
      panelHeight: height,
      pointerId,
      lastY: y, lastT: performance.now(), vel: 0, // px/ms, + = hacia abajo
    };
    els.panel.classList.add('is-dragging');
  }

  function _moveDrag(y) {
    if (!_dragState) return;
    const now = performance.now();
    const dt = now - _dragState.lastT;
    if (dt > 0) _dragState.vel = 0.6 * ((y - _dragState.lastY) / dt) + 0.4 * _dragState.vel;
    _dragState.lastY = y; _dragState.lastT = now;
    const delta = y - _dragState.startY;
    const next = Math.min(Math.max(_dragState.startTranslate + delta, 0), _dragState.panelHeight);
    _els.panel.style.transform = `translate(-50%, ${next}px)`;
  }

  function _finishDrag(y) {
    if (!_dragState) return;
    const { startY, startTranslate, startState, panelHeight, vel } = _dragState;
    _els.panel.classList.remove('is-dragging');
    _dragState = null;

    const delta = y - startY; // + = hacia abajo, - = hacia arriba

    // Un "flick" (deslizamiento corto pero rápido) cuenta como intencional
    // aunque no llegue al umbral de distancia.
    const isFlick = Math.abs(vel) > 0.4 && Math.abs(delta) >= 10 && (vel > 0) === (delta > 0);

    // Con un arrastre por debajo del umbral, el panel vuelve a su
    // estado de partida (gesto no intencional / mano temblando).
    if (Math.abs(delta) < DRAG_THRESHOLD_PX && !isFlick) {
      _snapTo(startState);
      return;
    }
    const draggedDown = delta > 0;

    if (startState === SNAP.FULL) {
      if (!draggedDown) { _snapTo(SNAP.FULL); return; }
      // Desde "full": hacia abajo baja a "peek"; si se lo arrastró
      // más allá de la mitad del tramo entre "peek" y el borde de
      // abajo, se cierra directo (el panel "se va" por completo).
      const finalT = Math.min(Math.max(startTranslate + delta, 0), panelHeight);
      const peekT = _translateForState(SNAP.PEEK, panelHeight);
      if (finalT > peekT + (panelHeight - peekT) / 2) close();
      else _snapTo(SNAP.PEEK);
      return;
    }

    if (startState === SNAP.PEEK) {
      // Desde "peek": hacia arriba sube a "full", hacia abajo lo baja
      // del todo. El pin queda maximizado; un click sobre él lo cierra
      // (ver pinClick en js/cluster.js).
      if (draggedDown) close();
      else _snapTo(SNAP.FULL);
      return;
    }

    _snapTo(startState); // "closed" no debería recibir drag
  }

  // ---- Arrastre desde el handle (Pointer Events — mouse y táctil) ----

  function _onPointerDown(e) {
    if (_isSideMode()) return; // en modo lateral (landscape) el panel es sidebar fijo, no se arrastra
    _beginDrag(e.clientY, e.pointerId);
    const els = _els;
    els.handleZone.setPointerCapture(e.pointerId);
    els.handleZone.addEventListener('pointermove', _onPointerMove);
    els.handleZone.addEventListener('pointerup', _onPointerUp);
    els.handleZone.addEventListener('pointercancel', _onPointerUp);
  }

  function _onPointerMove(e) {
    _moveDrag(e.clientY);
  }

  function _onPointerUp(e) {
    if (!_dragState) return;
    const els = _els;
    try { els.handleZone.releasePointerCapture(_dragState.pointerId); } catch (_) {}
    els.handleZone.removeEventListener('pointermove', _onPointerMove);
    els.handleZone.removeEventListener('pointerup', _onPointerUp);
    els.handleZone.removeEventListener('pointercancel', _onPointerUp);
    _finishDrag(e.clientY);
  }

  // ---- Arrastre táctil desde cualquier parte del panel ----
  //
  // Reglas para no pelear con el scroll del contenido:
  //  - Gesto horizontal (ej. carrusel de eventos): se ignora.
  //  - Dentro del área de scroll con el panel en "full": arrastrar
  //    hacia arriba, o hacia abajo con el texto ya scrolleado, hace
  //    scroll normal; arrastrar hacia abajo con el texto al tope
  //    (scrollTop = 0) mueve el panel.
  //  - En "peek" (mitad) o fuera del área de scroll (título, pestañas,
  //    etc.): siempre mueve el panel.
  //  - Inputs/textareas no arrastran (se usan para escribir/seleccionar).
  let _touch = null; // { x, y, lastY, inScroll, scrollTop, mode: 'pending'|'drag'|'scrolling'|'ignore' }

  function _onPanelTouchStart(e) {
    _touch = null;
    if (_isSideMode() || _dragState) return;
    if (e.touches.length !== 1) return;
    const target = e.target;
    if (target && target.closest && target.closest('[data-role="handle-zone"], input, textarea, select')) return;
    const t = e.touches[0];
    _touch = {
      x: t.clientX, y: t.clientY, lastY: t.clientY,
      inScroll: _els.scroll.contains(target),
      scrollTop: _els.scroll.scrollTop,
      mode: 'pending',
    };
  }

  function _onPanelTouchMove(e) {
    if (!_touch || _touch.mode === 'ignore') return;
    if (e.touches.length !== 1) {
      if (_touch.mode === 'drag') _onPanelTouchEnd();
      _touch = null;
      return;
    }
    const t = e.touches[0];
    const prevY = _touch.lastY;
    _touch.lastY = t.clientY;

    // [2026-09-28] Continuidad del gesto: si el dedo empezó sobre el texto
    // ya scrolleado (el navegador lo está scrolleando), apenas el texto
    // llega al tope (scrollTop = 0) y el dedo sigue bajando, el MISMO
    // gesto pasa a mover el panel — sin tener que levantar el dedo y
    // repetir el movimiento (antes esa zona parecía "muerta").
    if (_touch.mode === 'scrolling') {
      if (_els.scroll.scrollTop <= 0 && t.clientY > prevY) {
        _touch.mode = 'drag';
        _beginDrag(t.clientY);
      } else if (t.clientY < prevY) {
        _touch.mode = 'ignore'; // cambió de sentido: es scroll normal
        return;
      } else {
        return;
      }
    }

    if (_touch.mode === 'pending') {
      const dx = t.clientX - _touch.x;
      const dy = t.clientY - _touch.y;
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (Math.abs(dx) > Math.abs(dy)) { _touch.mode = 'ignore'; return; }

      let moveIt = true;
      if (_touch.inScroll && _panelState === SNAP.FULL) {
        moveIt = dy > 0 && _touch.scrollTop <= 0;
        // Hacia abajo con texto scrolleado: scroll nativo, pero atento
        // a tomar el control cuando llegue al tope (ver arriba).
        if (!moveIt && dy > 0) { _touch.mode = 'scrolling'; return; }
      }
      if (!moveIt || !e.cancelable) { _touch.mode = 'ignore'; return; }

      _touch.mode = 'drag';
      _beginDrag(_touch.y);
    }

    if (_touch.mode === 'drag') {
      e.preventDefault();
      _moveDrag(t.clientY);
    }
  }

  function _onPanelTouchEnd() {
    const touch = _touch;
    _touch = null;
    if (touch && touch.mode === 'drag') _finishDrag(touch.lastY);
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
        _applyStaticChromeI18n();
        if (_todosMode) _renderTodos();
        else if (_currentPoiId) _render();
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
      if (window.EventoCard) EventoCard.closeDetail(true); // [2026-09-30] ver close()
      _ensureDom();
      _bindAppStateEvents();
      _applyPanelSizeVars(); // por si cambiaron los sliders o giró la pantalla desde el último open()

      _currentPoiId = poiId;
      _isEditMode = false;
      // [Etapa 15] salir del modo "Todos los eventos" (si estaba) — el panel
      // vuelve a ser el de un lugar.
      _salirModoTodos();
      // [Etapa 5] cada pin nuevo arranca en la pestaña Info — EXCEPTO
      // [Filtro de fecha de eventos, corregido 2026-09-04] con el
      // filtro "Eventos" activo, arranca directo en "Eventos" —
      // INDEPENDIENTE de si hay una fecha elegida o no (la fecha solo
      // afecta el orden/atenuado DENTRO de la lista, ver
      // _eventosVigentesDelPoi/_renderEventosTab). El criterio es
      // únicamente "el filtro Eventos está activo" + "el pin tiene
      // algún evento visible al público" — si no tiene ninguno,
      // _renderEventosTab lo vuelve a "info" solo, ver esa función.
      _activeTab = (typeof activeFilter !== 'undefined' && activeFilter === '__eventos__') ? 'eventos' : 'info';
      // [Etapa 15] pestaña pedida por quien abre (tarjeta de "Todos los eventos");
      // si el lugar no tiene eventos visibles, _renderEventosTab la vuelve a "info".
      if (_pendingTab) { _activeTab = _pendingTab; _pendingTab = null; }
      _render();
      _setActiveTab(_activeTab); // deja visible el contenido correcto (venía de "Todos", donde ambos estaban ocultos)
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

  // --------------------------------------------------------------------
  // [Etapa 15, 2026-09-29] MODO "TODOS LOS EVENTOS"
  // --------------------------------------------------------------------

  /** Vuelve el panel al modo normal (de un lugar). Idempotente. */
  function _salirModoTodos() {
    _todosMode = false;
    if (!_els) return;
    _els.panel.classList.remove('poi-panel--todos');
    _els.todosContent.hidden = true;
  }

  /** Pinta el modo "Todos": título fijo, sin banner/categorías/pestañas/
   *  ojito/botón de editar (lo oculta el CSS de `.poi-panel--todos`), y el
   *  contenido lo arma js/eventos-todos.js. */
  function _renderTodos() {
    const els = _ensureDom();
    els.panel.classList.add('poi-panel--todos');
    els.title.textContent = window.I18N ? I18N.t('todos_eventos_titulo') : 'Todos los eventos';
    els.title.style.color = '';
    els.infoTabContent.hidden = true;
    els.eventosTabContent.hidden = true;
    els.todosContent.hidden = false;
    els.actionBtn.hidden = true;
    if (window.EventosTodos) EventosTodos.render(els.todosContent);
  }

  /** Abre el panel "Todos los eventos" — el mismo panel, directo en 'full'.
   *  Con el panel ya abierto en este modo, vuelve a tocarse el botón →
   *  se cierra. Con un lugar abierto, lo reemplaza (y minimiza su pin). */
  function openTodosEventos() {
    if (_todosMode && _panelState !== SNAP.CLOSED) { close(); return; }
    function _openNow() {
      if (window.EventoCard) EventoCard.closeDetail(true); // [2026-09-30] ver close()
      _ensureDom();
      _bindAppStateEvents();
      _applyPanelSizeVars();
      // El pin maximizado de un lugar abierto no tiene sentido sin su panel.
      if (typeof expandedId !== 'undefined' && expandedId !== null) {
        if (typeof collapsePin === 'function') collapsePin(expandedId);
        expandedId = null;
      }
      _currentPoiId = null;
      _isEditMode = false;
      _todosMode = true;
      _renderTodos();
      _els.scroll.scrollTop = 0;
      _snapTo(SNAP.FULL);
    }
    if (window.OverlayManager) window.OverlayManager.beforeOpen('poiPanel', _openNow);
    else _openNow();
  }

  /** Pide la pestaña inicial del PRÓXIMO lugar que se abra con open().
   *  Se descarta sola a los 3 s por si ese open() nunca llega. */
  function requestTab(tab) {
    _pendingTab = (tab === 'eventos' || tab === 'info') ? tab : null;
    if (_pendingTab) setTimeout(() => { _pendingTab = null; }, 3000);
  }

  /** ¿El panel está abierto en modo "Todos los eventos"? */
  function isTodosOpen() {
    return _todosMode && _panelState !== SNAP.CLOSED;
  }

  /** Lo llama EventoCard después de centrar el mapa con el 📍. En modo
   *  "Todos", pantalla vertical y panel en 'full', el panel tapa casi todo
   *  el mapa y centrar el pin no se vería — por eso ahí (y solo ahí) baja
   *  a 'peek'. En el panel de un lugar no hace nada (no cambia de tamaño). */
  /** [2026-09-30] Tamaño actual del panel ('full' | 'peek' | 'closed'). Lo usa
   *  EventoCard para subir a 'full' al abrir la vista ampliada de un evento. */
  function getSnap() { return _panelState; }

  /** [2026-09-30] Cambia entre 'full' y 'peek' (nunca abre ni cierra el panel). */
  function snapTo(state) {
    if (_panelState === SNAP.CLOSED) return;
    if (state === SNAP.FULL || state === SNAP.PEEK) _snapTo(state);
  }

  function afterLocate() {
    if (_todosMode && _panelState === SNAP.FULL && !_isSideMode()) _snapTo(SNAP.PEEK);
  }

  /** Cierra el panel y limpia el estado de edición. */
  function close() {
    _isEditMode = false;
    // [2026-09-30] la vista ampliada de un evento vive DENTRO del panel: se
    // quita sin animación para que no quede colgada al reabrirlo.
    if (window.EventoCard) EventoCard.closeDetail(true);
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

  /** [Etapa 5] Actualiza el título de la pestaña "Eventos" sin
   *  esperar a que el visitante recargue la página — llamado desde
   *  js/eventos.js cuando el admin guarda un rótulo nuevo en su
   *  propia sesión. Si el panel está abierto en la pestaña de
   *  eventos, se refleja al toque. */
  function setEventosConfig(cfg) {
    _eventosConfigCache = cfg || null;
    if (_els && _els.tabEventosBtn && _eventosConfigCache) {
      _els.tabEventosBtn.textContent = _eventosConfigCache.tituloPanelEventos || 'Eventos';
    }
  }

  /** [Filtro de fecha de eventos, 2026-09-03] re-pinta el panel ya
   *  abierto (si hay uno) sin cerrarlo/reabrirlo — usado desde
   *  js/eventos-fecha-filtro.js cuando el usuario cambia/limpia la
   *  fecha elegida, para que la pestaña de eventos ya abierta
   *  refleje la fecha nueva al toque. No toca `_activeTab`: si el
   *  panel ya estaba en "eventos" sigue ahí, no vuelve a "info". */
  function refresh() {
    if (_todosMode) { if (_panelState !== SNAP.CLOSED) _renderTodos(); return; }
    if (_currentPoiId) _render();
  }

  return {
    open,
    close,
    setLang,
    getCurrentPoiId,
    getOpenAreaPx,
    setEventosConfig,
    refresh,
    // [Etapa 15]
    openTodosEventos,
    requestTab,
    isTodosOpen,
    afterLocate,
    // [2026-09-30] vista ampliada de evento (EventoCard.openDetail)
    getSnap,
    snapTo,
  };
})();

window.PoiPanel = PoiPanel;