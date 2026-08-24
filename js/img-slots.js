/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/* ═══════════════════════════════════════════════════════════
   img-slots.js — SLOTS DE IMÁGENES VARIANTES, SIN LÍMITE
   ---------------------------------------------------------------
   [NUEVO 2026-08-13] Reemplaza los 3 bloques fijos que existían
   antes (alt1/alt2/alt3 hardcodeados en el HTML). Ahora cada tab
   (Nuevo/Editar) arranca con 1 slot vacío y agrega uno nuevo solo
   cuando se ocupa el último — sin tope de cantidad.

   CAMBIO IMPORTANTE DE FONDO: antes estos uploaders guardaban en
   un campo legado (`imgAlt1`/`imgAlt2`/`imgAlt3`) que se guardaba
   en Firestore pero NUNCA se mostraba en ningún lado público (ni
   mapa ni panel) — solo se releía a sí mismo al volver a abrir
   "Editar". Ahora los slots guardan directo en `poi.skins`, el
   mismo lugar que ya usa el carrusel del panel de lugar
   (poi-panel.js) y la vinculación de imágenes por texto (Importar
   → "Vincular imágenes"). Resultado: lo que subís acá a mano AHORA
   SÍ se ve en el panel del lugar, cosa que antes no pasaba.

   Reutiliza tal cual `setupImgUploader`/`setupUrlLoader`/`clearImg`
   de utils.js — no hizo falta tocarlos, solo dejaron de llamarse
   3 veces fijas y ahora se llaman dinámicamente por cada slot.

   [NUEVO 2026-08-14] Cada slot ahora tiene su propio toggle ON/OFF
   ("Activo"), reutilizando el estilo .za-toggle ya existente en el
   admin (css/base.css). Esto reemplaza al toggle que antes vivía en
   el panel PÚBLICO del lugar (poi-panel.js) sin ningún control de
   admin — cualquier visitante podía tocarlo. Ahora la decisión de
   qué imagen está activa/visible al público se toma acá, solo desde
   el admin. `getSkins()` cambió de forma: antes devolvía
   `{variant: url}`, ahora devuelve `{variant: {url, active}}` — ver
   los dos lugares que lo consumen en js/pin-adjust.js (saveNew y
   saveEdit), ya actualizados a la forma nueva.
   ═══════════════════════════════════════════════════════════ */

/**
 * Extrae el nombre de archivo real (con extensión) del final de una
 * URL de Cloudinary, para mostrarlo tal cual en el editor del admin
 * (ej. de ".../images/caca-cba_carpetabierta2_01.jpeg" → devuelve
 * "caca-cba_carpetabierta2_01.jpeg"). Devuelve null si la URL no
 * tiene una forma reconocible.
 * @param {string} url
 * @returns {string|null}
 */
function prevUrlFileName(url) {
  if (!url) return null;
  const clean = url.split('?')[0].split('#')[0];
  const last = clean.split('/').pop();
  return last || null;
}

/**
 * [NUEVO 2026-08-24] GRILLA + PANEL COMPARTIDO — reemplaza el listado
 * vertical ("chorizo") de antes: uno por uno, uploader+URL+toggle
 * apilados. Ahora cada variante es una miniatura clickeable dentro de
 * una grilla (varias por fila, según ancho del panel admin); al
 * clickear una, el panel de opciones de abajo (uploader+URL+"Orden"+
 * "Imagen activa") pasa a controlar esa imagen puntual — un solo
 * panel compartido, no uno repetido por variante.
 *
 * "Orden" es un campo nuevo (`skin.order`, número) que define en qué
 * posición se le muestra esa imagen al público (ojito del mapa,
 * panel del lugar) — ver mismo criterio en `_orderedSkinNames` de
 * utils.js, que ahora respeta este campo. Al cargar una imagen nueva
 * se le asigna automáticamente el menor número libre entre las que
 * ya tiene ESE pin (relleno de huecos, no solo "siguiente al
 * máximo"). Si el admin le tipea a mano un número ya usado por otra
 * imagen del mismo pin, las dos intercambian su orden (nunca quedan
 * dos con el mismo número).
 */
function createAltSlotManager(containerId, formPrefix) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  let slots = []; // [{ variant, hasImg, url, active, order, ids, detailEl }]
  let selectedVariant = null;

  const gridEl = document.createElement('div');
  gridEl.className = 'img-grid';
  const panelEl = document.createElement('div');
  panelEl.className = 'img-slot-panel';
  container.appendChild(gridEl);
  container.appendChild(panelEl);

  function _nextAutoVariant() {
    let max = 0;
    slots.forEach(s => {
      const m = /^alt(\d+)$/.exec(s.variant);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return `alt${max + 1}`;
  }

  /**
   * Menor número entero >=2 no usado todavía por ninguna otra imagen
   * de este pin. El 1 queda SIEMPRE reservado para la imagen
   * principal (la del cuadro "IMAGEN DEL PIN" de arriba) — nunca lo
   * ocupa una imagen de la grilla automáticamente.
   */
  function _nextFreeOrder(excludeState) {
    const used = new Set(
      slots.filter(s => s.hasImg && s !== excludeState && typeof s.order === 'number').map(s => s.order)
    );
    let n = 2;
    while (used.has(n)) n++;
    return n;
  }

  function _currentMainUrl() {
    return window[formPrefix === 'edit' ? '_editImgB64' : '_addImgB64'] || null;
  }

  /**
   * El admin escribió "1" en el orden de una imagen de la grilla:
   * quiere que ESA pase a ser la principal (ej. porque el sistema
   * cargó otra por error). Se intercambia el contenido: la imagen de
   * este slot pasa al cuadro "IMAGEN DEL PIN" de arriba, y lo que
   * antes era la principal (si había algo) baja a ocupar este mismo
   * slot como una imagen más de la lista, con el próximo número
   * libre. No hace falta tocar nada en `saveNew`/`saveEdit`: ambos
   * ya leen `window._addImgB64`/`_editImgB64` para la principal, que
   * es justo lo que esta función actualiza.
   * @param {Object} altState
   */
  function _promoteToMain(altState) {
    const mainVar   = formPrefix === 'edit' ? '_editImgB64' : '_addImgB64';
    const mainPrevId = formPrefix === 'edit' ? 'img-prev-edit' : 'img-prev-add';
    const mainLblId  = formPrefix === 'edit' ? 'img-lbl-edit'  : 'img-lbl-add';
    const mainWrapId = formPrefix === 'edit' ? 'iu-edit' : 'iu-add';

    const oldMainUrl = _currentMainUrl();
    const newMainUrl = altState.url;

    window[mainVar] = newMainUrl;
    const mainPrev = document.getElementById(mainPrevId);
    const mainLbl  = document.getElementById(mainLblId);
    const mainWrap = document.getElementById(mainWrapId);
    if (mainPrev) mainPrev.innerHTML = newMainUrl ? `<img src="${newMainUrl}" alt="principal">` : '🏙️';
    if (mainLbl)  mainLbl.textContent = (prevUrlFileName(newMainUrl) || 'Imagen actual') + ' — clic para cambiar';
    if (mainWrap) mainWrap.classList.toggle('has-img', !!newMainUrl);

    altState.url = oldMainUrl;
    altState.hasImg = !!oldMainUrl;
    altState.order = oldMainUrl ? _nextFreeOrder(altState) : undefined;
    const prevEl = document.getElementById(altState.ids.prevId);
    const lblEl  = document.getElementById(altState.ids.lblId);
    const wrapEl = document.getElementById(altState.ids.wrapId);
    if (prevEl) prevEl.innerHTML = oldMainUrl ? `<img src="${oldMainUrl}" alt="variante">` : '🏙️';
    if (lblEl)  lblEl.textContent = oldMainUrl ? ((prevUrlFileName(oldMainUrl) || altState.variant) + ' — clic para cambiar') : 'Nueva imagen';
    if (wrapEl) wrapEl.classList.toggle('has-img', !!oldMainUrl);
    _paintOrderForState(altState);

    _ensureTrailingEmptySlot();
    _renderGrid();
    toast('✅ Ahora esa es la imagen principal');
    _syncWindowVar();
  }

  function _paintOrderForState(s) {
    if (s.orderInputEl) s.orderInputEl.value = s.hasImg ? (s.order || '') : '';
  }

  function _syncWindowVar() {
    const out = {};
    slots.forEach(s => {
      if (s.hasImg && s.url) out[s.variant] = { url: s.url, active: s.active !== false, order: s.order };
    });
    window[formPrefix === 'edit' ? '_editAltSkins' : '_addAltSkins'] = out;
  }

  function _ensureTrailingEmptySlot() {
    const last = slots[slots.length - 1];
    if (!last || last.hasImg) _addSlot(null, null);
  }

  /** Repinta la grilla: la principal siempre primera (badge fijo "1"), después el resto por `order`, la que no tiene imagen siempre al final. */
  function _renderGrid() {
    gridEl.innerHTML = '';
    const mainUrl = _currentMainUrl();
    if (mainUrl) {
      const mcell = document.createElement('div');
      mcell.className = 'img-grid-thumb img-grid-thumb--main';
      mcell.title = 'Imagen principal — se cambia arriba, o escribí 1 en el orden de otra imagen para reemplazarla';
      mcell.innerHTML = `<img src="${mainUrl}" alt=""><span class="img-grid-badge">1</span><span class="img-grid-main-tag">★</span>`;
      gridEl.appendChild(mcell);
    }
    const sorted = slots.slice().sort((a, b) => {
      if (a.hasImg && b.hasImg) return (a.order || 0) - (b.order || 0);
      if (a.hasImg) return -1;
      if (b.hasImg) return 1;
      return 0;
    });
    sorted.forEach(s => {
      const cell = document.createElement('div');
      const classes = ['img-grid-thumb'];
      if (!s.hasImg) classes.push('img-grid-thumb--add');
      if (s.hasImg && s.active === false) classes.push('img-grid-thumb--inactive');
      if (s.variant === selectedVariant) classes.push('is-selected');
      cell.className = classes.join(' ');
      cell.title = s.hasImg ? (prevUrlFileName(s.url) || s.variant) : 'Agregar imagen';
      cell.innerHTML = s.hasImg
        ? `<img src="${s.url}" alt="">
           <span class="img-grid-badge">${s.order || ''}</span>
           ${s.active === false ? '<span class="img-grid-off">OFF</span>' : ''}`
        : `<span class="img-grid-plus">+</span>`;
      cell.addEventListener('click', () => _selectSlot(s.variant));
      gridEl.appendChild(cell);
    });
  }

  function _selectSlot(variant) {
    selectedVariant = variant;
    slots.forEach(s => { if (s.detailEl) s.detailEl.classList.toggle('is-selected', s.variant === variant); });
    _renderGrid();
  }

  /**
   * Agrega un slot. Si `variant` es null se autogenera el próximo
   * nombre interno libre (`altN`, ver `_nextAutoVariant` — es el ID
   * técnico usado como clave en `poi.skins`, no el número de orden
   * visible). `prefillOrder` es el número de orden visible/público a
   * precargar (si el skin ya lo traía guardado) o su posición en la
   * lista si es un skin legado sin ese campo.
   * @param {string|null} variant
   * @param {string|null} prefillUrl
   * @param {boolean} [prefillActive=true]
   * @param {number} [prefillOrder]
   */
  function _addSlot(variant, prefillUrl, prefillActive, prefillOrder) {
    const v = variant || _nextAutoVariant();
    const ids = {
      variant: v,
      wrapId:   `iu-${v}-${formPrefix}-dyn`,
      inputId:  `img-input-${v}-${formPrefix}-dyn`,
      prevId:   `img-prev-${v}-${formPrefix}-dyn`,
      lblId:    `img-lbl-${v}-${formPrefix}-dyn`,
      clearId:  `img-clear-${v}-${formPrefix}-dyn`,
      urlId:    `img-url-${v}-${formPrefix}-dyn`,
      urlBtnId: `img-url-load-${v}-${formPrefix}-dyn`,
      toggleId: `img-active-${v}-${formPrefix}-dyn`,
      orderId:  `img-order-${v}-${formPrefix}-dyn`,
    };

    const detailEl = document.createElement('div');
    detailEl.className = 'img-slot-detail';
    detailEl.id = `detail-${v}-${formPrefix}-dyn`;

    const wrap = document.createElement('div');
    wrap.className = 'img-uploader';
    wrap.id = ids.wrapId;
    wrap.innerHTML = `
      <input type="file" accept="image/*" id="${ids.inputId}">
      <div class="img-uploader-inner">
        <div class="img-preview-box" id="${ids.prevId}">🏙️</div>
        <div class="img-uploader-text"><strong id="${ids.lblId}">Nueva imagen</strong><span>WebP recomendado</span></div>
      </div>
      <button class="img-clear" id="${ids.clearId}" type="button">✕</button>
    `;
    const urlRow = document.createElement('div');
    urlRow.className = 'url-input-row';
    urlRow.innerHTML = `
      <input class="fi url-fi" id="${ids.urlId}" type="url" placeholder="O pegá el link de la imagen (Cloudinary, Dropbox, etc.)">
      <button class="url-load-btn" id="${ids.urlBtnId}" type="button">Cargar</button>
    `;
    // Fila de "Orden" — número visible que decide en qué posición se
    // muestra esta imagen al público (ojito/panel). Independiente del
    // toggle "activa".
    const orderRow = document.createElement('div');
    orderRow.className = 'za-row img-slot-order-row';
    orderRow.style.marginTop = '4px';
    orderRow.innerHTML = `
      <span class="za-name">Orden de exhibición<br><span class="img-order-hint">Escribí 1 para que sea la principal</span></span>
      <input type="number" min="1" step="1" class="fi img-order-input" id="${ids.orderId}">
    `;
    // Toggle "Activo" — controla si esta imagen se muestra al público
    // (antes vivía, sin protección de admin, en el panel público del
    // lugar; ver nota de cabecera del archivo).
    const activeRow = document.createElement('div');
    activeRow.className = 'za-row';
    activeRow.style.marginTop = '4px';
    activeRow.innerHTML = `
      <span class="za-name">Imagen activa (visible al público)</span>
      <button class="za-toggle" id="${ids.toggleId}" type="button" aria-pressed="true"></button>
    `;
    detailEl.appendChild(wrap);
    detailEl.appendChild(urlRow);
    detailEl.appendChild(orderRow);
    detailEl.appendChild(activeRow);
    panelEl.appendChild(detailEl);

    const state = {
      variant: v, hasImg: false, url: null,
      active: prefillActive !== false,
      order: (typeof prefillOrder === 'number' ? prefillOrder : undefined),
      ids, detailEl,
    };
    slots.push(state);

    const orderInput = document.getElementById(ids.orderId);
    state.orderInputEl = orderInput;
    function _paintOrder() { _paintOrderForState(state); }
    _paintOrder();
    orderInput.addEventListener('change', () => {
      const val = parseInt(orderInput.value, 10);
      if (!state.hasImg) return; // no aplica hasta que haya imagen
      if (!val || val < 1) { _paintOrder(); return; }
      if (val === 1) { _promoteToMain(state); return; }
      if (val === state.order) return;
      // Si otra imagen de este mismo pin ya tiene ese número, se
      // intercambian — nunca quedan dos con el mismo orden.
      const conflict = slots.find(s => s !== state && s.hasImg && s.order === val);
      if (conflict) conflict.order = state.order;
      state.order = val;
      _renderGrid();
      _syncWindowVar();
    });

    const toggleBtn = document.getElementById(ids.toggleId);
    function _paintToggle() {
      toggleBtn.classList.toggle('on', state.active);
      toggleBtn.setAttribute('aria-pressed', String(state.active));
    }
    _paintToggle();
    toggleBtn.addEventListener('click', () => {
      state.active = !state.active;
      _paintToggle();
      _renderGrid();
      _syncWindowVar();
    });

    function onLoad(url) {
      const wasEmpty = !state.hasImg;
      state.hasImg = !!url;
      state.url = url;
      if (state.hasImg && wasEmpty && typeof state.order !== 'number') {
        // Imagen nueva: ocupa el próximo número libre (relleno de huecos).
        state.order = _nextFreeOrder(state);
      }
      if (!state.hasImg) state.order = undefined; // se limpió: libera su número para la próxima
      _paintOrder();
      _ensureTrailingEmptySlot();
      if (state.hasImg) selectedVariant = state.variant; // seguir viendo el panel de la que se acaba de cargar
      _renderGrid();
      _selectSlot(selectedVariant);
      _syncWindowVar();
    }

    setupImgUploader(ids.inputId, ids.prevId, ids.lblId, ids.clearId, ids.wrapId, 'Nueva imagen', onLoad, _uploadCtx(formPrefix, v));
    setupUrlLoader(ids.urlId, ids.urlBtnId, ids.prevId, ids.lblId, ids.wrapId, onLoad, _uploadCtx(formPrefix, v));

    if (prefillUrl) {
      document.getElementById(ids.prevId).innerHTML = `<img src="${prefillUrl}" alt="variante">`;
      // Nombre completo del archivo real (ej. "caca-cba_carpetabierta2_01.jpeg"),
      // extraído de la URL de Cloudinary, para que el admin sepa qué
      // imagen es cada una sin adivinar por el número de slot.
      const fileMatch = prevUrlFileName(prefillUrl);
      document.getElementById(ids.lblId).textContent = `${fileMatch || v} — clic para cambiar`;
      wrap.classList.add('has-img');
      state.hasImg = true;
      state.url = prefillUrl;
      if (typeof state.order !== 'number') state.order = _nextFreeOrder(state); // red de seguridad, no debería disparar (reset ya asigna order)
      _paintOrder();
    }
  }

  /**
   * Reinicia el contenedor. Si se pasa `prefillSkins` (el `poi.skins`
   * de un lugar existente), precarga TODAS sus variantes salvo "main"
   * (que tiene su propio cuadro de "imagen principal" aparte) — sin
   * importar cómo se llame la variante, para que el admin pueda ver
   * y leer el nombre completo de cada imagen cargada para ese pin,
   * las haya subido por acá, por texto de importación masiva, o
   * como sea. El orden inicial de la grilla respeta `skin.order` si
   * ya lo tenía guardado (mismo criterio que `_orderedSkinNames` en
   * utils.js); si no lo tenía (skin legado), se le asigna uno según
   * su posición actual, para que arranque siempre con un número
   * concreto en pantalla.
   * @param {Object} [prefillSkins]
   */
  function reset(prefillSkins) {
    container.innerHTML = '';
    gridEl.innerHTML = '';
    panelEl.innerHTML = '';
    container.appendChild(gridEl);
    container.appendChild(panelEl);
    slots = [];
    selectedVariant = null;

    const altEntries = Object.entries(prefillSkins || {})
      .filter(([k]) => k !== 'main')
      .sort((a, b) => {
        const oa = a[1] && typeof a[1].order === 'number' ? a[1].order : null;
        const ob = b[1] && typeof b[1].order === 'number' ? b[1].order : null;
        if (oa !== null && ob !== null) return oa - ob;
        if (oa !== null) return -1;
        if (ob !== null) return 1;
        return a[0].localeCompare(b[0]);
      });

    if (altEntries.length === 0) {
      _addSlot(null, null);
    } else {
      altEntries.forEach(([variant, skin], idx) => {
        const order = (skin && typeof skin.order === 'number') ? skin.order : (idx + 2); // +2: el 1 es de la principal
        _addSlot(variant, skin && skin.url, skin && skin.active, order);
      });
      _ensureTrailingEmptySlot();
    }
    selectedVariant = (slots.find(s => s.hasImg) || slots[0]).variant;
    _selectSlot(selectedVariant);
    _syncWindowVar();
  }

  /** @returns {Object} mapa {variant: {url, active, order}} de los slots con imagen cargada */
  function getSkins() {
    _syncWindowVar();
    return window[formPrefix === 'edit' ? '_editAltSkins' : '_addAltSkins'] || {};
  }

  return { reset, getSkins, refreshMainCell: _renderGrid };
}

const AltSlotsAdd  = createAltSlotManager('alt-slots-add',  'add');
const AltSlotsEdit = createAltSlotManager('alt-slots-edit', 'edit');
if (AltSlotsAdd)  AltSlotsAdd.reset();
