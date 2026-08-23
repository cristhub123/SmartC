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
 * Crea un manejador de slots dinámicos para un contenedor.
 * @param {string} containerId - id del <div> donde van los slots.
 * @param {'add'|'edit'} formPrefix - qué formulario alimenta.
 * @returns {{reset: Function, getSkins: Function}|null}
 */
function createAltSlotManager(containerId, formPrefix) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  let slots = []; // [{ variant, hasImg, url, ids }]

  function _nextAutoVariant() {
    let max = 0;
    slots.forEach(s => {
      const m = /^alt(\d+)$/.exec(s.variant);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return `alt${max + 1}`;
  }

  function _syncWindowVar() {
    const out = {};
    slots.forEach(s => { if (s.hasImg && s.url) out[s.variant] = { url: s.url, active: s.active !== false }; });
    window[formPrefix === 'edit' ? '_editAltSkins' : '_addAltSkins'] = out;
  }

  function _ensureTrailingEmptySlot() {
    const last = slots[slots.length - 1];
    if (!last || last.hasImg) _addSlot(null, null);
  }

  /**
   * Agrega un slot al final del contenedor.
   * @param {string|null} variant - nombre fijo (ej. "alt2") si viene
   *   de un pin ya cargado, o null para autogenerar el próximo libre.
   * @param {string|null} prefillUrl - URL ya guardada, si la hay.
   * @param {boolean} [prefillActive=true] - si el skin ya guardado
   *   estaba activo (`skin.active !== false`) o lo desactivó el admin.
   */
  function _addSlot(variant, prefillUrl, prefillActive) {
    const v = variant || _nextAutoVariant();
    const slotNum = slots.length + 2; // +2: el slot 1 visual es "principal", que va aparte
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
    };

    const wrap = document.createElement('div');
    wrap.className = 'img-uploader';
    wrap.id = ids.wrapId;
    wrap.innerHTML = `
      <input type="file" accept="image/*" id="${ids.inputId}">
      <div class="img-uploader-inner">
        <div class="img-preview-box" id="${ids.prevId}">${slotNum}</div>
        <div class="img-uploader-text"><strong id="${ids.lblId}">Variante ${slotNum}</strong><span>WebP recomendado</span></div>
      </div>
      <button class="img-clear" id="${ids.clearId}" type="button">✕</button>
    `;
    const urlRow = document.createElement('div');
    urlRow.className = 'url-input-row';
    urlRow.innerHTML = `
      <input class="fi url-fi" id="${ids.urlId}" type="url" placeholder="O pegá el link de la imagen (Cloudinary, Dropbox, etc.)">
      <button class="url-load-btn" id="${ids.urlBtnId}" type="button">Cargar</button>
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
    container.appendChild(wrap);
    container.appendChild(urlRow);
    container.appendChild(activeRow);

    const state = { variant: v, hasImg: false, url: null, active: prefillActive !== false, ids };
    slots.push(state);

    const toggleBtn = document.getElementById(ids.toggleId);
    function _paintToggle() {
      toggleBtn.classList.toggle('on', state.active);
      toggleBtn.setAttribute('aria-pressed', String(state.active));
    }
    _paintToggle();
    toggleBtn.addEventListener('click', () => {
      state.active = !state.active;
      _paintToggle();
      _syncWindowVar();
    });

    function onLoad(url) {
      state.hasImg = !!url;
      state.url = url;
      _ensureTrailingEmptySlot();
      _syncWindowVar();
    }

    setupImgUploader(ids.inputId, ids.prevId, ids.lblId, ids.clearId, ids.wrapId, `Variante ${slotNum}`, onLoad, _uploadCtx(formPrefix, v));
    setupUrlLoader(ids.urlId, ids.urlBtnId, ids.prevId, ids.lblId, ids.wrapId, onLoad, _uploadCtx(formPrefix, v));

    if (prefillUrl) {
      document.getElementById(ids.prevId).innerHTML = `<img src="${prefillUrl}" alt="variante">`;
      // Nombre completo del archivo real (ej. "caca-cba_carpetabierta2_01.jpeg"),
      // extraído de la URL de Cloudinary, para que el admin sepa qué
      // imagen es cada una sin adivinar por el número de slot. Si por
      // algún motivo la URL no trae un nombre de archivo reconocible,
      // se cae al nombre de variante como respaldo.
      const fileMatch = prevUrlFileName(prefillUrl);
      const fullName = fileMatch || v;
      document.getElementById(ids.lblId).textContent = `${fullName} — clic para cambiar`;
      wrap.classList.add('has-img');
      state.hasImg = true;
      state.url = prefillUrl;
    }
  }

  /**
   * Reinicia el contenedor. Si se pasa `prefillSkins` (el `poi.skins`
   * de un lugar existente), precarga TODAS sus variantes salvo "main"
   * (que tiene su propio cuadro de "imagen principal" aparte) — sin
   * importar cómo se llame la variante, para que el admin pueda ver
   * y leer el nombre completo de cada imagen cargada para ese pin,
   * las haya subido por acá, por texto de importación masiva, o
   * como sea. Solo afecta qué se MUESTRA en este editor; no cambia
   * cómo se suben imágenes nuevas ni toca nada en Cloudinary.
   * @param {Object} [prefillSkins]
   */
  function reset(prefillSkins) {
    container.innerHTML = '';
    slots = [];

    const altEntries = Object.entries(prefillSkins || {})
      .filter(([k]) => k !== 'main')
      .sort((a, b) => a[0].localeCompare(b[0]));

    if (altEntries.length === 0) {
      _addSlot(null, null);
    } else {
      altEntries.forEach(([variant, skin]) => _addSlot(variant, skin && skin.url, skin && skin.active));
      _ensureTrailingEmptySlot();
    }
    _syncWindowVar();
  }

  /** @returns {Object} mapa {variant: {url, active}} de los slots con imagen cargada */
  function getSkins() {
    _syncWindowVar();
    return window[formPrefix === 'edit' ? '_editAltSkins' : '_addAltSkins'] || {};
  }

  return { reset, getSkins };
}

const AltSlotsAdd  = createAltSlotManager('alt-slots-add',  'add');
const AltSlotsEdit = createAltSlotManager('alt-slots-edit', 'edit');
if (AltSlotsAdd)  AltSlotsAdd.reset();
