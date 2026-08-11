/* pin-adjust.js — expand scale, per-POI offset, pinch-to-zoom */
/* ═══════════════════════════════════════════════════════════
   EXPAND SIZE INDEPENDIENTE — desacopla tamaño en mapa del expandido
   ═══════════════════════════════════════════════════════════ */
globalSettings.expandSize = 160; // px base del edificio expandido (independiente de pinSize)

// Slider g-expand-size
const gExpandSizeSlider = document.getElementById('g-expand-size');
if (gExpandSizeSlider) {
  gExpandSizeSlider.addEventListener('input', function() {
    globalSettings.expandSize = parseInt(this.value);
    document.getElementById('g-expand-size-val').textContent = this.value + 'px';
  });
}

/* ═══════════════════════════════════════════════════════════
   AJUSTE POR POI — VERSIÓN DEFINITIVA Y LIMPIA
   Maneja pinScale, pinOffsetX, pinOffsetY guardados en cada POI
   ═══════════════════════════════════════════════════════════ */

// Sliders del formulario de edición
const _eScale = document.getElementById('e-pin-scale');
const _eOffX  = document.getElementById('e-pin-offset-x');
const _eOffY  = document.getElementById('e-pin-offset-y');

function _updateScaleLbl()  { const v = _eScale?.value||100;  document.getElementById('e-pin-scale-val').textContent   = v + '%'; }
function _updateOffXLbl()   { const v = _eOffX?.value||0;    document.getElementById('e-pin-offset-x-val').textContent = (v>0?'+':'') + v + 'px'; }
function _updateOffYLbl()   { const v = _eOffY?.value||0;    document.getElementById('e-pin-offset-y-val').textContent = (v>0?'+':'') + v + 'px'; }

if (_eScale)  _eScale.addEventListener('input',  _updateScaleLbl);
if (_eOffX)   _eOffX.addEventListener('input',   _updateOffXLbl);
if (_eOffY)   _eOffY.addEventListener('input',   _updateOffYLbl);

// Inyectar valores al abrir formulario de edición
// (se llama desde dentro de startEdit después de cargar el POI)
function loadPinAdjust(poi) {
  if (!poi) return;
  const sc = poi.pinScale   !== undefined ? poi.pinScale   : 100;
  const ox = poi.pinOffsetX !== undefined ? poi.pinOffsetX : 0;
  const oy = poi.pinOffsetY !== undefined ? poi.pinOffsetY : 0;
  if (_eScale)  { _eScale.value  = sc; _updateScaleLbl(); }
  if (_eOffX)   { _eOffX.value   = ox; _updateOffXLbl(); }
  if (_eOffY)   { _eOffY.value   = oy; _updateOffYLbl(); }
}

// Patch startEdit para incluir loadPinAdjust y campo address
const _startEditPrev = window.startEdit;
window.startEdit = function(id) {
  _startEditPrev(id);
  const p = POIS.find(x => x.id === id);
  loadPinAdjust(p);
  const addrEl = document.getElementById('e-address');
  if (addrEl) addrEl.value = (p && p.address) || '';
};

// ÚNICA definición final de saveEdit — incluye todos los campos
async function saveEdit() {
  if (editingId === null) return;
  const idx = POIS.findIndex(x => x.id === editingId);
  if (idx === -1) return;

  const name = document.getElementById('e-name').value.trim();
  const cats = (typeof getSelectedCats === 'function') ? getSelectedCats('cat-chips-edit') : [document.getElementById('e-cat')?.value].filter(Boolean);
  const lat  = parseFloat(document.getElementById('e-lat').value);
  const lng  = parseFloat(document.getElementById('e-lng').value);
  if (!name) { toast('⚠️ El nombre no puede estar vacío'); return; }
  // ANTES: acá también se exigía al menos 1 categoría. Se relaja
  // (igual que en saveNew) para que un pin creado por importación
  // masiva — que todavía no tiene categoría asignada — se pueda
  // seguir editando y guardando sin trabarse.

  const mainCat = cats[0] || '';
  const allCatsFn = typeof getAllCats === 'function' ? getAllCats() : CAT;
  const cfg = mainCat ? (allCatsFn[mainCat] || {label: mainCat.toUpperCase()}) : {label: ''};

  // País/provincia/ciudad — antes `saveEdit()` nunca los tocaba (el
  // spread `...POIS[idx]` los dejaba tal cual quedaron al crear el
  // pin, sin forma de reubicarlo). Ahora se leen de los 3 dropdowns
  // e-country/e-state/e-city (con fallback al valor que ya tenía el
  // pin, por si no estuvieran en el DOM).
  const country  = document.getElementById('e-country')?.value  || POIS[idx].country  || '';
  const province = document.getElementById('e-state')?.value    || POIS[idx].province || '';
  const city     = document.getElementById('e-city')?.value     || POIS[idx].city     || '';

  const updated = {
    ...POIS[idx], name,
    category:      mainCat,
    categories:    cats,
    categoryLabel: cfg.label,
    icon:          editEmoji,
    lat, lng,
    country, province, city,
    address:   document.getElementById('e-address')?.value.trim() || POIS[idx].address || '',
    imgB64:    window._editImgB64  !== undefined ? window._editImgB64  : POIS[idx].imgB64,
    imgAlt1:   window._editImgAlt1 !== undefined ? window._editImgAlt1 : POIS[idx].imgAlt1,
    imgAlt2:   window._editImgAlt2 !== undefined ? window._editImgAlt2 : POIS[idx].imgAlt2,
    imgAlt3:   window._editImgAlt3 !== undefined ? window._editImgAlt3 : POIS[idx].imgAlt3,
    pinScale:   _eScale ? parseInt(_eScale.value)  : (POIS[idx].pinScale   ?? 100),
    pinOffsetX: _eOffX  ? parseInt(_eOffX.value)   : (POIS[idx].pinOffsetX ?? 0),
    pinOffsetY: _eOffY  ? parseInt(_eOffY.value)   : (POIS[idx].pinOffsetY ?? 0),
    desc:      document.getElementById('e-desc').value.trim(),
    hist:      document.getElementById('e-hist').value.trim() || 'Sin datos históricos.',
    attrs:     _readPinAttrsFromForm('e-attrs-wrap').filter(a => a.l.trim()),
    soc:       document.getElementById('e-soc').value.split(',').map(s=>s.trim()).filter(Boolean),
    tags:      document.getElementById('e-tags').value.split(',').map(s=>s.trim()).filter(Boolean),
    phone:     (document.getElementById('e-phone')||{value:''}).value.trim(),
    hours:     (document.getElementById('e-hours')||{value:''}).value.trim(),
  };

  // Barrita dorada (revisado): si este pin ya estaba marcado como
  // revisado y ahora se guarda un cambio normal (no el botón de
  // "Marcar como revisado" en sí, que es una función aparte), queda
  // en "mitad" — sigue habiendo un OK previo, pero algo cambió desde
  // entonces y conviene volver a mirarlo.
  if (POIS[idx].reviewed) updated.reviewedDirty = true;

  toast('⏳ Guardando...');
  const guardadoOk = await savePoiToFirestore(updated);
  if (!guardadoOk) return; // el propio savePoiToFirestore ya avisó el error, no seguimos

  POIS[idx] = updated;
  removeMarker(editingId);
  makeMarker(updated);
  applyFilter();
  if (currentPoi && currentPoi.id === editingId) openPoiPanel(updated);

  toast(`✅ "${name}" actualizado`);
  renderList();
  document.getElementById('tab-edit-btn').style.display = 'none';
  switchTab('list');
  editingId = null;
  window._editImgB64 = null; window._editImgAlt1 = null; window._editImgAlt2 = null; window._editImgAlt3 = null;
  map.setView([lat, lng], Math.max(map.getZoom(), 16), {animate:true});
}

/**
 * Botón "🟡 Marcar como revisado" — confirma que el admin entró,
 * revisó toda la info del pin y está conforme. Se guarda aparte del
 * botón normal de "Guardar Cambios" a propósito: es una acción
 * puntual (prender la barrita dorada), no un guardado de datos.
 */
async function markPinAsReviewed() {
  if (editingId === null) return;
  const idx = POIS.findIndex(x => x.id === editingId);
  if (idx === -1) return;

  const updated = { ...POIS[idx], reviewed: true, reviewedDirty: false };
  const ok = await savePoiToFirestore(updated);
  if (!ok) return;

  POIS[idx] = updated;
  toast(`🟡 "${updated.name}" marcado como revisado`);
  renderList();
}

(function wireMarkReviewedBtn() {
  const btn = document.getElementById('btn-mark-reviewed');
  if (btn) btn.addEventListener('click', markPinAsReviewed);
})();

// Conectar botón de guardar edición a la función definitiva
(function wireEditBtn() {
  const btn = document.getElementById('btn-save-edit');
  if (!btn) return;
  const clone = btn.cloneNode(true);
  btn.parentNode.replaceChild(clone, btn);
  clone.addEventListener('click', saveEdit);
})();

// Patch saveNew para guardar address
const _saveNewPrev = saveNew;
/**
 * Resetea la tab "Nuevo" por completo: nombre, descripción, categorías,
 * imagen principal + las 3 variantes (alt1/2/3), campos de info libres,
 * coordenadas, y los 3 dropdowns de ubicación (vuelven al default =
 * Ubicación Activa). Se usa después de guardar un pin nuevo Y también
 * cada vez que se cambia la Ubicación Activa en la tab "Ubicaciones" —
 * para que no quede una imagen previsualizada de la ciudad anterior,
 * algo que podía llevar a confusión (imagen de un lugar mostrada como
 * si fuera de otro).
 */
function resetAddTab() {
  ['a-name','a-desc','a-hist','a-soc','a-lat','a-lng','a-phone','a-hours','a-tags'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  const addrEl = document.getElementById('a-address'); if (addrEl) addrEl.value = '';
  document.querySelectorAll('#eg-add .eopt').forEach(e => e.classList.remove('sel'));
  const defE = document.querySelector('#eg-add [data-e="📍"]'); if (defE) defE.classList.add('sel');
  addEmoji = '📍';

  // Imagen principal
  const mainPrev = document.getElementById('img-prev-add'); if (mainPrev) mainPrev.innerHTML = '🏙️';
  const mainLbl  = document.getElementById('img-lbl-add');  if (mainLbl)  mainLbl.textContent = 'Subir imagen del edificio';
  const mainWrap = document.getElementById('iu-add');       if (mainWrap) mainWrap.classList.remove('has-img');
  window._addImgB64 = null;

  // Variantes 2/3/4 — antes esto NO se reseteaba nunca (ni siquiera
  // después de guardar un pin), quedaba la preview de la variante
  // anterior pisada visualmente hasta cargar una nueva a mano.
  [
    ['img-prev-alt1-add', 'img-lbl-alt1-add', 'iu-alt1-add', '2', 'Variante 2'],
    ['img-prev-alt2-add', 'img-lbl-alt2-add', 'iu-alt2-add', '3', 'Variante 3'],
    ['img-prev-alt3-add', 'img-lbl-alt3-add', 'iu-alt3-add', '4', 'Variante 4'],
  ].forEach(([prevId, lblId, wrapId, slotNum, slotLbl]) => {
    const prevEl = document.getElementById(prevId); if (prevEl) prevEl.innerHTML = slotNum;
    const lblEl  = document.getElementById(lblId);  if (lblEl)  lblEl.textContent = slotLbl;
    const wrapEl = document.getElementById(wrapId); if (wrapEl) wrapEl.classList.remove('has-img');
  });
  window._addImgAlt1 = null; window._addImgAlt2 = null; window._addImgAlt3 = null;

  // Inputs de archivo + inputs de URL (pegar link) de las 4 imágenes —
  // texto/archivo tipeado o elegido que quedaba sin limpiar aunque
  // nunca se hubiera tocado "Cargar".
  ['img-input-add','img-input-alt1-add','img-input-alt2-add','img-input-alt3-add',
   'img-url-add','img-url-alt1-add','img-url-alt2-add','img-url-alt3-add']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  if (typeof _renderPinAttrsEditor === 'function') _renderPinAttrsEditor('a-attrs-wrap', []);
  if (typeof _renderAddCountrySelect === 'function') _renderAddCountrySelect(); // vuelve al default (Ubicación Activa)
  if (typeof buildMultiCatSelector === 'function') buildMultiCatSelector('cat-chips-add', []);
  if (typeof syncAddCoordDisplay === 'function') syncAddCoordDisplay();
}

async function saveNew() {
  const name = document.getElementById('a-name').value.trim();
  const cats = (typeof getSelectedCats === 'function') ? getSelectedCats('cat-chips-add') : [];
  const lat  = parseFloat(document.getElementById('a-lat').value);
  const lng  = parseFloat(document.getElementById('a-lng').value);
  const address = document.getElementById('a-address')?.value.trim() || '';

  // ANTES: exigía nombre + categoría + coordenadas juntos para poder
  // guardar. Se relaja a solo el nombre — mismo criterio que ya usa
  // saveEdit() (que nunca exigió categoría ni coordenadas). Así se
  // puede crear un lugar "cascarón" y completar el resto después,
  // sin que el guardado se trabe por datos que todavía no tenés.
  if (!name) { toast('⚠️ Ingresá el nombre del lugar'); return; }

  const mainCat = cats[0];
  const allCatsFn = typeof getAllCats === 'function' ? getAllCats() : CAT;
  const cfg = allCatsFn[mainCat] || {label: (mainCat||'').toUpperCase()};

  // El ID del lugar es su slug (lugar-ciudad) — el mismo identificador
  // que se usa para nombrar las imágenes en Cloudinary. Así todo queda
  // conectado por un único dato, sin contadores artificiales.
  // ANTES: el sufijo de ciudad era "-cordoba" fijo, sin importar la
  // Ubicación Activa — con multi-ciudad eso generaba slugs incorrectos
  // para cualquier lugar que no fuera de Córdoba. Después pasó a usar
  // window.ACTIVE_LOCATION directo, pero eso no dejaba elegir OTRA
  // ubicación para un pin puntual. Ahora se lee de los 3 dropdowns
  // país/provincia/ciudad propios de la tab "Nuevo" (que arrancan
  // en la Ubicación Activa por defecto, pero son editables a mano) —
  // si por algún motivo no están en el DOM, cae a la Ubicación Activa
  // global, y si tampoco hay ninguna, al slug simple sin sufijo.
  const country  = document.getElementById('a-country')?.value  || (window.ACTIVE_LOCATION && window.ACTIVE_LOCATION.countryCode)  || '';
  const province = document.getElementById('a-state')?.value    || (window.ACTIVE_LOCATION && window.ACTIVE_LOCATION.provinceCode) || '';
  const cityCode = document.getElementById('a-city')?.value     || (window.ACTIVE_LOCATION && window.ACTIVE_LOCATION.cityCode)     || '';
  const slug = cityCode ? `${slugify(name)}-${cityCode}` : slugify(name);

  const p = {
    id: slug, name,
    category: mainCat, categories: cats, categoryLabel: cfg.label,
    icon: addEmoji, lat, lng, address,
    country, province, city: cityCode,
    imgB64:  window._addImgB64  || null,
    imgAlt1: window._addImgAlt1 || null,
    imgAlt2: window._addImgAlt2 || null,
    imgAlt3: window._addImgAlt3 || null,
    pinScale: 100, pinOffsetX: 0, pinOffsetY: 0,
    desc:  document.getElementById('a-desc').value.trim(),
    hist:  document.getElementById('a-hist').value.trim() || 'Sin datos históricos.',
    attrs: _readPinAttrsFromForm('a-attrs-wrap').filter(a => a.l.trim()),
    soc:   document.getElementById('a-soc').value.split(',').map(s=>s.trim()).filter(Boolean),
    tags:  document.getElementById('a-tags').value.split(',').map(s=>s.trim()).filter(Boolean),
    phone: (document.getElementById('a-phone')||{value:''}).value.trim(),
    hours: (document.getElementById('a-hours')||{value:''}).value.trim(),
    events: [], iconCyber:'🔵', iconWinter:'❄️', iconZombie:'☣️',
    active: true,
  };

  // Aplicar campos compartidos del grupo si aplica
  if (p.groupId) applyGroupFields(p);

  toast('⏳ Guardando...');
  const guardadoOk = await savePoiToFirestore(p);
  if (!guardadoOk) return; // el propio savePoiToFirestore ya avisó el error, no seguimos

  POIS.push(p);
  makeMarker(p);

  resetAddTab();
  toast(`✅ "${name}" agregado al mapa`);
  renderList(); switchTab('list');
  applyFilter();
  map.setView([lat, lng], Math.max(map.getZoom(), 16), {animate:true});
}

(function wireAddBtn() {
  const btn = document.getElementById('btn-save-add');
  if (!btn) return;
  const clone = btn.cloneNode(true);
  btn.parentNode.replaceChild(clone, btn);
  clone.addEventListener('click', saveNew);
})();

/* ═══════════════════════════════════════════════════════════
   CREACIÓN MASIVA DE PINES-CASCARÓN (Entrega 2 del plan multi-ciudad)
   ---------------------------------------------------------------
   A partir de una lista de prefijos (separados por coma) y de la
   Ubicación Activa definida en la pestaña "Ubicaciones" (Entrega 1),
   crea un pin por cada prefijo único — todos incompletos a propósito
   (sin categoría, sin coordenadas, sin imagen) y DESACTIVADOS
   (`active:false`), para completarlos uno por uno después sin que
   nada se le muestre al público mientras tanto.
   ═══════════════════════════════════════════════════════════ */

async function createShellPinsFromPrefixList() {
  const textarea = document.getElementById('bulk-prefix-list');
  if (!textarea) return;

  if (!window.ACTIVE_LOCATION || !window.ACTIVE_LOCATION.countryCode) {
    toast('⚠️ Primero elegí y guardá una Ubicación Activa en la pestaña Ubicaciones');
    return;
  }

  const raw = textarea.value || '';
  const prefixes = [...new Set(raw.split(',').map(s => s.trim()).filter(Boolean))];
  if (!prefixes.length) {
    toast('⚠️ Pegá al menos un nombre de lugar, separados por coma');
    return;
  }

  const btn = document.getElementById('btn-bulk-create');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Creando...'; }

  let created = 0, skipped = 0;
  for (const rawSlug of prefixes) {
    const slug = slugify(rawSlug);
    if (!slug) { skipped++; continue; }
    if (POIS.some(p => p.id === slug)) { skipped++; continue; } // ya existe, no se pisa

    const p = {
      id: slug,
      name: rawSlug,          // nombre provisorio — se prolija después al editar
      category: '', categories: [], categoryLabel: '',
      icon: '📍',
      lat: null, lng: null,   // sin ubicación todavía — admin.js ya sabe mostrar
                               // el aviso "📍 Falta ubicación" para este caso
      country:  window.ACTIVE_LOCATION.countryCode,
      province: window.ACTIVE_LOCATION.provinceCode,
      city:     window.ACTIVE_LOCATION.cityCode,
      imgB64: null, imgAlt1: null, imgAlt2: null, imgAlt3: null,
      pinScale: 100, pinOffsetX: 0, pinOffsetY: 0,
      desc: '', hist: '', soc: [], tags: [],
      phone: '', hours: '',
      events: [], iconCyber:'🔵', iconWinter:'❄️', iconZombie:'☣️',
      active: false, // nace apagado: el público no ve nada hasta que lo actives a mano
    };

    const ok = await savePoiToFirestore(p);
    if (ok) {
      POIS.push(p);
      created++;
      // OJO: no se llama a makeMarker(p) acá — todavía no tiene
      // lat/lng válidos, Leaflet no puede dibujar un pin sin
      // coordenadas. El marcador se crea solo cuando se edite el
      // pin con una ubicación real y se guarde (ver saveEdit).
    } else {
      skipped++;
    }
  }

  if (btn) { btn.disabled = false; btn.textContent = '📁 Crear pines desde la lista'; }
  textarea.value = '';
  renderList();
  toast(`✅ ${created} lugar(es) creado(s)` + (skipped ? `, ${skipped} omitido(s) (ya existían o nombre inválido)` : ''));
}

(function wireBulkCreateBtn() {
  const btn = document.getElementById('btn-bulk-create');
  if (btn) btn.addEventListener('click', createShellPinsFromPrefixList);
})();

/* ═══════════════════════════════════════════════════════════
   CAMPOS DE INFORMACIÓN LIBRES POR PIN — mismo concepto exacto que
   ya existe para zonas (_renderZonaAttrsEditor en zones.js): título
   y texto arbitrarios, cantidad libre, con "🗑" para quitar y
   "➕ Agregar campo" para sumar uno nuevo en blanco. Se separó como
   función genérica (recibe el id del contenedor) porque acá hace
   falta en DOS formularios (Agregar y Editar), no en uno solo.
   ═══════════════════════════════════════════════════════════ */

/**
 * Lee del formulario los pares [título, texto] tal como están ahora
 * en pantalla (incluye filas vacías — el filtrado se hace al guardar).
 * @param {string} wrapId - 'a-attrs-wrap' o 'e-attrs-wrap'
 * @returns {Array<{l:string, v:string}>}
 */
function _readPinAttrsFromForm(wrapId) {
  const prefix = wrapId === 'a-attrs-wrap' ? 'a-al-' : 'e-al-';
  const vprefix = wrapId === 'a-attrs-wrap' ? 'a-av-' : 'e-av-';
  const count = document.querySelectorAll(`[id^="${prefix}"]`).length;
  const attrs = [];
  for (let i = 0; i < count; i++) {
    const l = document.getElementById(`${prefix}${i}`)?.value ?? '';
    const v = document.getElementById(`${vprefix}${i}`)?.value ?? '';
    attrs.push({ l, v });
  }
  return attrs;
}

/**
 * Dibuja el editor de campos de información dentro de `wrapId`
 * ('a-attrs-wrap' o 'e-attrs-wrap'), con sus filas + botón de
 * agregar. Misma lógica que `_renderZonaAttrsEditor` de zones.js,
 * adaptada para poder usarse en los dos formularios de pin.
 * @param {string} wrapId
 * @param {Array<{l:string, v:string}>} attrs
 */
function _renderPinAttrsEditor(wrapId, attrs) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  const labelPrefix = wrapId === 'a-attrs-wrap' ? 'a-al-' : 'e-al-';
  const valuePrefix = wrapId === 'a-attrs-wrap' ? 'a-av-' : 'e-av-';
  const addBtnId = wrapId === 'a-attrs-wrap' ? 'btn-add-a-attr' : 'btn-add-e-attr';

  wrap.innerHTML = (attrs || []).map((a, i) => `
    <div style="display:flex;gap:7px;margin-bottom:7px;align-items:center">
      <input class="fi" style="flex:0 0 110px;font-size:12px" value="${a.l || ''}" id="${labelPrefix}${i}" placeholder="Título (ej: Dato curioso)">
      <input class="fi" style="flex:1;font-size:12px" value="${a.v || ''}" id="${valuePrefix}${i}" placeholder="Texto">
      <button type="button" class="ibtn" data-remove-pin-attr="${i}" data-wrap="${wrapId}" title="Quitar este campo" style="flex:0 0 auto;padding:6px 9px;">🗑</button>
    </div>`).join('');

  wrap.querySelectorAll('[data-remove-pin-attr]').forEach(btn => {
    btn.addEventListener('click', () => {
      const current = _readPinAttrsFromForm(wrapId);
      current.splice(parseInt(btn.dataset.removePinAttr, 10), 1);
      _renderPinAttrsEditor(wrapId, current);
    });
  });

  let addBtn = document.getElementById(addBtnId);
  if (!addBtn) {
    addBtn = document.createElement('button');
    addBtn.id = addBtnId;
    addBtn.type = 'button';
    addBtn.className = 'ibtn';
    addBtn.style.cssText = 'width:100%;margin-bottom:10px;';
    addBtn.textContent = '➕ Agregar campo de información';
    wrap.parentNode.insertBefore(addBtn, wrap.nextSibling);
  }
  addBtn.onclick = () => {
    const current = _readPinAttrsFromForm(wrapId);
    current.push({ l: '', v: '' });
    _renderPinAttrsEditor(wrapId, current);
  };
}

// El form de Agregar arranca vacío (sin pin todavía cargado) — se
// dibuja una sola vez al cargar la página, con la lista en blanco.
_renderPinAttrsEditor('a-attrs-wrap', []);

/* ═══════════════════════════════════════════════════════════
   EXPAND CON ESCALA INDEPENDIENTE Y OFFSET POR POI
   ═══════════════════════════════════════════════════════════ */
const _expandPinBase   = expandPin;
const _collapsePinBase = collapsePin;

window.expandPin = function(id) {
  _expandPinBase(id);
  const poi = markers[id] && markers[id].poi;
  if (!poi) return;
  const poiScalePct  = (poi.pinScale   !== undefined ? poi.pinScale   : 100) / 100;
  const ox           = poi.pinOffsetX || 0;
  const oy           = poi.pinOffsetY || 0;
  const baseExpandPx = globalSettings.expandSize || 160;
  const pinMapPx     = globalSettings.pinSize    || 44;
  // La escala del CSS .pin-wrap.big está basada en pinSize del mapa
  // Calculamos la escala real para llegar al expandSize independiente
  const targetPx     = baseExpandPx * poiScalePct;
  const cssScale     = (targetPx / pinMapPx) * poiScalePct;
  const el = document.getElementById('pw-' + id);
  if (el) {
    // Los offsets se expresan en px del mapa — dividimos por cssScale para compensar
    const tx = ox / cssScale;
    const ty = oy / cssScale;
    el.style.setProperty('transform', `scale(${cssScale}) translate3d(${tx}px,${ty}px,0)`, 'important');
    el._expandCssScale = cssScale; // guardar para el pinch-zoom
  }
};

window.collapsePin = function(id) {
  const el = document.getElementById('pw-' + id);
  if (el) { el.style.removeProperty('transform'); delete el._expandCssScale; }
  _collapsePinBase(id);
};

/* ═══════════════════════════════════════════════════════════
   ZOOM TÁCTIL SOBRE IMAGEN EXPANDIDA (PINCH TO ZOOM)
   ═══════════════════════════════════════════════════════════ */
let _pinchActive  = false;
let _pinchBaseDist = 0;
let _pinchBaseScale = 1;

function _pinchDist(e) {
  const t = e.touches;
  if (t.length < 2) return 0;
  const dx = t[0].clientX - t[1].clientX;
  const dy = t[0].clientY - t[1].clientY;
  return Math.sqrt(dx*dx + dy*dy);
}

map.getContainer().addEventListener('touchstart', function(e) {
  if (expandedId === null || e.touches.length < 2) return;
  const el = document.getElementById('pw-' + expandedId);
  if (!el) return;
  e.preventDefault(); // interceptar antes que Leaflet
  _pinchActive   = true;
  _pinchBaseDist  = _pinchDist(e);
  _pinchBaseScale = el._expandCssScale || globalSettings.expandScale || 3.2;
}, { passive: false });

map.getContainer().addEventListener('touchmove', function(e) {
  if (!_pinchActive || expandedId === null || e.touches.length < 2) return;
  e.preventDefault();
  const el = document.getElementById('pw-' + expandedId);
  if (!el) return;
  const newDist  = _pinchDist(e);
  const ratio    = newDist / _pinchBaseDist;
  const newScale = Math.max(1, Math.min(_pinchBaseScale * ratio, _pinchBaseScale * 4));
  el.style.setProperty('transform', `scale(${newScale}) translate3d(0,0,0)`, 'important');
}, { passive: false });

map.getContainer().addEventListener('touchend', function(e) {
  if (!_pinchActive) return;
  _pinchActive = false;
  // Volver al tamaño expandido normal
  if (expandedId !== null) {
    setTimeout(() => {
      if (expandedId !== null) window.expandPin(expandedId);
    }, 300);
  }
});

/* ═══════════════════════════════════════════════════════════
   IMPORTACIÓN MASIVA DE LUGARES COMPLETOS (texto estructurado)
   ---------------------------------------------------------------
   Formato acordado con Cris — bloques separados por "### PIN":

     ### PIN
     nombre: cabildo-cba
     titulo: Cabildo Histórico de Córdoba
     lat: -31.4167
     lng: -64.1833
     tags: cultura, historia
     campos:
       Descripción: texto...
       Dato curioso: texto...
     imagenes:
       cabildo-cba_main_01.webp
       cabildo-cba_night_01.webp

   Si un lugar del texto ya existe (mismo id/slug), se ACTUALIZA en
   vez de duplicarse. Un error en un bloque puntual no frena a los
   demás — se reporta al final cuáles fallaron y por qué.
   ═══════════════════════════════════════════════════════════ */

/**
 * Extrae la "variante" de un nombre de archivo de imagen siguiendo
 * la regla del "_" ya acordada: {slug}_{variante}_{NN}.{ext}. El "_"
 * separa niveles, el "-" queda DENTRO de un nivel (por eso el slug
 * "cabildo-cba" y variantes como "t-futurista" no se rompen).
 * @param {string} filename - ej "cabildo-cba_t-futurista_01.gif"
 * @returns {{variant: string, extension: string}|null}
 */
function parseImageFilename(filename) {
  const clean = filename.trim();
  const extMatch = clean.match(/\.([a-zA-Z0-9]+)$/);
  if (!extMatch) return null; // sin extensión, no es un nombre de archivo válido
  const extension = extMatch[1].toLowerCase();
  const withoutExt = clean.slice(0, -(extension.length + 1));
  const parts = withoutExt.split('_');

  if (parts.length < 2) {
    // No hay suficientes niveles para separar slug de variante — se
    // toma todo como "main" para no descartar la imagen de plano.
    return { variant: 'main', extension };
  }
  if (parts.length === 2) {
    // {slug}_{variante}, sin número — está bien, el número es opcional.
    return { variant: parts[1], extension };
  }
  // {slug}_{variante...}_{NN} — el último segmento es el número (se
  // descarta, no es parte del nombre de la variante), todo lo del
  // medio es la variante (puede tener guiones, ej. "t-futurista").
  const last = parts[parts.length - 1];
  const isNumber = /^\d+$/.test(last);
  const variantParts = isNumber ? parts.slice(1, -1) : parts.slice(1);
  return { variant: variantParts.join('_') || 'main', extension };
}

/**
 * Arma la URL de Cloudinary para una imagen, a partir del nombre de
 * archivo TAL CUAL lo escribió el admin (no se reconstruye el
 * nombre — se respeta la extensión exacta que puso, sea la que sea).
 * @param {string} filename
 * @returns {string}
 */
function _buildBulkImageUrl(filename) {
  const cloudName = (typeof CLOUDINARY_CLOUD_NAME !== 'undefined') ? CLOUDINARY_CLOUD_NAME : '';
  const folder = (typeof CloudinaryAdmin !== 'undefined' && CloudinaryAdmin.buildFolder)
    ? CloudinaryAdmin.buildFolder({
        country:  window.ACTIVE_LOCATION?.countryCode,
        state:    window.ACTIVE_LOCATION?.provinceCode,
        city:     window.ACTIVE_LOCATION?.cityCode,
      })
    : '';
  // NOTA: para GIFs animados no conviene forzar f_auto (puede
  // convertir a otro formato y perder la animación) — se usa
  // q_auto solamente, que es seguro para cualquier formato.
  return `https://res.cloudinary.com/${cloudName}/image/upload/q_auto/${folder}/${filename}`;
}

/**
 * Parsea el texto completo (uno o más bloques "### PIN") en una
 * lista de objetos de pin listos para guardar. No lanza excepción
 * por un bloque individual mal formado — lo reporta en `errors` y
 * sigue con los demás.
 * @param {string} text
 * @returns {{pins: Array<Object>, errors: Array<string>}}
 */
function parsePinBulkText(text) {
  const blocks = text.split(/^###\s*PIN\s*$/mi).map(b => b.trim()).filter(Boolean);
  const pins = [];
  const errors = [];

  blocks.forEach((block, blockIndex) => {
    try {
      const lines = block.split('\n');
      const data = { tags: [], attrs: [], images: [] };
      let section = null; // null | 'campos' | 'imagenes'

      for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '');
        if (!line.trim()) continue;

        const isIndented = /^\s{2,}/.test(line);

        if (!isIndented) {
          const m = line.match(/^([a-zA-Záéíóúñ_]+)\s*:\s*(.*)$/i);
          if (!m) continue;
          const key = m[1].trim().toLowerCase();
          const value = m[2].trim();

          if (key === 'campos') { section = 'campos'; continue; }
          if (key === 'imagenes' || key === 'imágenes') { section = 'imagenes'; continue; }
          section = null;

          if (key === 'nombre') data.nombre = value;
          else if (key === 'titulo' || key === 'título') data.titulo = value;
          else if (key === 'lat') data.lat = parseFloat(value);
          else if (key === 'lng' || key === 'lon') data.lng = parseFloat(value);
          else if (key === 'tags') data.tags = value.split(',').map(s => s.trim()).filter(Boolean);
          continue;
        }

        // Línea indentada: pertenece a la sección activa.
        if (section === 'campos') {
          const m = line.trim().match(/^(.+?):\s*(.*)$/);
          if (m) data.attrs.push({ l: m[1].trim(), v: m[2].trim() });
        } else if (section === 'imagenes') {
          const filename = line.trim();
          if (filename) data.images.push(filename);
        }
      }

      if (!data.nombre) {
        errors.push(`Bloque #${blockIndex + 1}: falta "nombre:" — se saltea.`);
        return;
      }

      const cityCode = (window.ACTIVE_LOCATION && window.ACTIVE_LOCATION.cityCode) || '';
      const slug = slugify(data.nombre);
      // Si el admin ya puso el sufijo de ciudad en el nombre (como en
      // los ejemplos, "cabildo-cba"), se respeta tal cual — no se le
      // vuelve a pegar el código de ciudad encima.
      const id = slug;

      const skins = {};
      data.images.forEach(filename => {
        const parsed = parseImageFilename(filename);
        if (!parsed) {
          errors.push(`"${data.nombre}": nombre de imagen inválido "${filename}" (sin extensión) — se saltea esa imagen.`);
          return;
        }
        skins[parsed.variant] = {
          url: _buildBulkImageUrl(filename),
          style: parsed.variant,
          active: true,
        };
      });

      pins.push({
        id,
        name: data.titulo || data.nombre,
        category: '', categories: [], categoryLabel: '',
        icon: '📍',
        lat: isNaN(data.lat) ? null : data.lat,
        lng: isNaN(data.lng) ? null : data.lng,
        country:  window.ACTIVE_LOCATION?.countryCode  || '',
        province: window.ACTIVE_LOCATION?.provinceCode || '',
        city:     window.ACTIVE_LOCATION?.cityCode      || '',
        imgB64: skins.main ? skins.main.url : null, // compatibilidad con el pin del mapa actual
        skins,
        pinScale: 100, pinOffsetX: 0, pinOffsetY: 0,
        desc: '', hist: '',
        attrs: data.attrs.filter(a => a.l),
        soc: [], tags: data.tags,
        phone: '', hours: '',
        active: false, // igual que la creación por lista simple: nace apagado
      });
    } catch (err) {
      errors.push(`Bloque #${blockIndex + 1}: error inesperado (${err.message}) — se saltea.`);
    }
  });

  return { pins, errors };
}

async function importFullPinsFromText() {
  const textarea = document.getElementById('bulk-full-text');
  const report = document.getElementById('bulk-import-report');
  if (!textarea) return;

  if (!window.ACTIVE_LOCATION || !window.ACTIVE_LOCATION.countryCode) {
    toast('⚠️ Primero elegí y guardá una Ubicación Activa en la pestaña Ubicaciones');
    return;
  }

  const { pins, errors } = parsePinBulkText(textarea.value || '');

  if (!pins.length && !errors.length) {
    toast('⚠️ Pegá al menos un lugar con el formato "### PIN"');
    return;
  }

  const btn = document.getElementById('btn-bulk-full-import');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Importando...'; }

  let created = 0, updated = 0;
  for (const p of pins) {
    const existingIdx = POIS.findIndex(x => x.id === p.id);
    if (existingIdx !== -1 && POIS[existingIdx].reviewed) {
      // Ya estaba revisado y ahora la importación le cambia datos —
      // la barrita dorada pasa a "mitad" (mismo criterio que un
      // guardado normal desde el form de edición).
      p.reviewed = true;
      p.reviewedDirty = true;
    }
    const ok = await savePoiToFirestore(p);
    if (!ok) { errors.push(`"${p.name}": no se pudo guardar en Firestore.`); continue; }
    if (existingIdx === -1) { POIS.push(p); created++; }
    else { POIS[existingIdx] = { ...POIS[existingIdx], ...p }; updated++; }
  }

  if (btn) { btn.disabled = false; btn.textContent = '📥 Importar lugares completos'; }
  textarea.value = '';
  renderList();

  if (report) {
    report.innerHTML = `✅ ${created} creado(s), ${updated} actualizado(s).` +
      (errors.length ? `<br>⚠️ ${errors.length} aviso(s):<br>` + errors.map(e => `• ${e}`).join('<br>') : '');
  }
  toast(`✅ Importación terminada: ${created} creado(s), ${updated} actualizado(s)`);
}

(function wireBulkFullImportBtn() {
  const btn = document.getElementById('btn-bulk-full-import');
  if (btn) btn.addEventListener('click', importFullPinsFromText);
})();


