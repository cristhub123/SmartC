/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

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
  resetEditIdLock(p && p.id);
};

/* ═══════════════════════════════════════════════════════════
   ID (panel "Editar") — doble candado de seguridad
   El campo e-slug arranca siempre bloqueado y muestra el ID actual.
   Se habilita (fondo/borde rojo) solo cuando los 2 checkboxes de
   seguridad están tildados a la vez; destildar cualquiera de los dos
   vuelve a bloquear el campo y restaura el valor original (se
   descarta cualquier edición a medio hacer). saveEdit() solo aplica
   un ID nuevo si el candado está abierto Y el valor cambió.
   ═══════════════════════════════════════════════════════════ */
function resetEditIdLock(currentId) {
  const slugEl = document.getElementById('e-slug');
  const lock1  = document.getElementById('e-slug-lock1');
  const lock2  = document.getElementById('e-slug-lock2');
  const warn   = document.getElementById('e-slug-warning');
  if (slugEl) { slugEl.value = currentId || ''; slugEl.disabled = true; slugEl.style.color = ''; slugEl.style.borderColor = ''; }
  if (lock1) lock1.checked = false;
  if (lock2) lock2.checked = false;
  if (warn) warn.style.display = 'none';
}

function _applyEditIdLockState() {
  const slugEl = document.getElementById('e-slug');
  const lock1  = document.getElementById('e-slug-lock1');
  const lock2  = document.getElementById('e-slug-lock2');
  const warn   = document.getElementById('e-slug-warning');
  if (!slugEl || !lock1 || !lock2) return;
  const unlocked = lock1.checked && lock2.checked;
  slugEl.disabled = !unlocked;
  slugEl.style.color = unlocked ? '#ef4444' : '';
  slugEl.style.borderColor = unlocked ? '#ef4444' : '';
  if (warn) warn.style.display = unlocked ? '' : 'none';
  if (!unlocked && editingId !== null) {
    const p = POIS.find(x => x.id === editingId);
    slugEl.value = (p && p.id) || '';
  }
}

(function _wireEditIdLock() {
  const lock1 = document.getElementById('e-slug-lock1');
  const lock2 = document.getElementById('e-slug-lock2');
  if (lock1) lock1.addEventListener('change', _applyEditIdLockState);
  if (lock2) lock2.addEventListener('change', _applyEditIdLockState);
})();

// ÚNICA definición final de saveEdit — incluye todos los campos
/**
 * [Mejora asignación de dueño por email, 2026-08-21]
 * Busca en Firestore ("usuarios", campo `email`) la cuenta registrada
 * con ese mail y devuelve su UID, o null si no existe ninguna.
 * Requiere que las reglas de Firestore permitan a los admins leer la
 * colección "usuarios" (ver FIRESTORE_RULES_NOTES.md, bloque
 * actualizado) — sin eso, esta consulta falla con error de permisos.
 */
async function _resolveOwnerEmailToUid(email) {
  const snap = await db.collection('usuarios')
    .where('email', '==', email)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].id; // el id del doc "usuarios/{uid}" ES el uid
}

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
    // Imagen banner del panel — [NUEVO 2026-08-15] campo totalmente
    // aparte de imgB64/skins (esos son la imagen del PIN). Vive en su
    // propia carpeta de Cloudinary (".../banner/", ver
    // CloudinaryAdmin.buildFolder) y solo la lee poi-panel.js para el
    // banner del panel — nunca el mapa/marcador.
    banner: window._editBannerImg !== undefined
      ? (window._editBannerImg ? { url: window._editBannerImg } : null)
      : (POIS[idx].banner || null),
    pinScale:   _eScale ? parseInt(_eScale.value)  : (POIS[idx].pinScale   ?? 100),
    pinOffsetX: _eOffX  ? parseInt(_eOffX.value)   : (POIS[idx].pinOffsetX ?? 0),
    pinOffsetY: _eOffY  ? parseInt(_eOffY.value)   : (POIS[idx].pinOffsetY ?? 0),
    desc:      document.getElementById('e-desc').value.trim(),
    hist:      document.getElementById('e-hist').value.trim() || 'Sin datos históricos.',
    // [Etapa 3] content[idioma].fields[] es ahora la fuente de verdad;
    // `attrs` (legado) NO se toca acá — queda como estaba (ver spread
    // `...POIS[idx]` más arriba) para que siga sirviendo de fallback.
    content:   _buildContentWithFields(POIS[idx].content, _readPinFieldsFromForm('e-attrs-wrap')),
    soc:       document.getElementById('e-soc').value.split(',').map(s=>s.trim()).filter(Boolean),
    tags:      document.getElementById('e-tags').value.split(',').map(s=>s.trim()).filter(Boolean),
    phone:     (document.getElementById('e-phone')||{value:''}).value.trim(),
    hours:     (document.getElementById('e-hours')||{value:''}).value.trim(),
  };

  // [Mejora asignación de dueño por email, 2026-08-21] El campo ahora
  // pide el MAIL del dueño, no el UID — se resuelve acá antes de
  // guardar. Si el campo quedó vacío, se saca el dueño (ownerId: null).
  // Si tiene texto pero no existe ninguna cuenta registrada con ese
  // mail, se corta el guardado con un aviso claro en vez de guardar
  // un ownerId incorrecto o dejar el pin sin dueño por error.
  const _eOwnerEmailInput = document.getElementById('e-owner-email');
  if (_eOwnerEmailInput) {
    const email = _eOwnerEmailInput.value.trim();
    if (!email) {
      updated.ownerId = null;
    } else {
      const uid = await _resolveOwnerEmailToUid(email);
      if (!uid) {
        toast(`⚠️ No hay ninguna cuenta registrada con el mail "${email}" — pedile al dueño que se registre primero desde la app (botón 👤)`);
        return;
      }
      updated.ownerId = uid;
    }
  } else {
    updated.ownerId = POIS[idx].ownerId || null;
  }

  // Skins — [MIGRADO 2026-08-13] igual que en saveNew, pero acá hay
  // que preservar lo que ya existía y NO está bajo control de este
  // editor visual: variantes con nombre distinto de "altN" (ej.
  // "noche", o cualquiera vinculada por texto en Importar) se dejan
  // intactas. Las "altN" sí se reconstruyen enteras a partir de los
  // slots dinámicos actuales (si se borró un slot, esa variante
  // desaparece; si se cambió, se actualiza; si no se tocó, sigue
  // igual porque AltSlotsEdit.reset() precargó el mismo valor).
  const existingSkins = POIS[idx].skins || {};
  const skins = {};
  Object.entries(existingSkins).forEach(([k, v]) => {
    if (k === 'main' || /^alt\d+$/.test(k)) return; // se reconstruyen abajo
    skins[k] = v;
  });
  if (updated.imgB64) {
    skins.main = existingSkins.main ? { ...existingSkins.main, url: updated.imgB64 } : { url: updated.imgB64, style: 'main', active: true };
  }
  const altSkins = (typeof AltSlotsEdit !== 'undefined' && AltSlotsEdit) ? AltSlotsEdit.getSkins() : {};
  Object.entries(altSkins).forEach(([variant, { url, active }]) => {
    skins[variant] = existingSkins[variant] ? { ...existingSkins[variant], url, active } : { url, style: variant, active };
  });
  updated.skins = skins;

  // Barrita dorada (revisado): si este pin ya estaba marcado como
  // revisado y ahora se guarda un cambio normal (no el botón de
  // "Marcar como revisado" en sí, que es una función aparte), queda
  // en "mitad" — sigue habiendo un OK previo, pero algo cambió desde
  // entonces y conviene volver a mirarlo.
  if (POIS[idx].reviewed) updated.reviewedDirty = true;

  // Cambio de ID: solo se aplica si el candado (2 checkboxes) está
  // abierto y el valor del campo e-slug realmente difiere del ID
  // actual. El ID es el nombre del documento en Firestore, así que
  // "cambiarlo" en la práctica es crear un documento nuevo con el ID
  // nuevo y borrar el viejo — no un simple update de campo.
  const oldId  = POIS[idx].id;
  const lock1  = document.getElementById('e-slug-lock1');
  const lock2  = document.getElementById('e-slug-lock2');
  const idUnlocked = !!(lock1 && lock1.checked && lock2 && lock2.checked);
  let newId = oldId;
  if (idUnlocked) {
    const rawNewId = (document.getElementById('e-slug')?.value || '').trim();
    const candidate = rawNewId ? slugify(rawNewId) : '';
    if (!candidate) { toast('⚠️ El ID no puede quedar vacío'); return; }
    if (candidate !== oldId) {
      if (POIS.some(x => x.id === candidate)) {
        toast(`⚠️ Ya existe un lugar con el ID "${candidate}"`);
        return;
      }
      newId = candidate;
    }
  }
  updated.id = newId;

  toast('⏳ Guardando...');
  const guardadoOk = await savePoiToFirestore(updated);
  if (!guardadoOk) return; // el propio savePoiToFirestore ya avisó el error, no seguimos

  if (newId !== oldId) {
    // Migración de ID: el doc viejo queda huérfano si no se borra.
    await deletePoiFromFirestore(oldId);
    if (typeof removeMarker === 'function') removeMarker(oldId);
    editingId = newId;
  }

  POIS[idx] = updated;
  // [CORREGIDO 2026-08-13] Recién ACÁ, con POIS ya actualizado al
  // dato final (incluido el ID nuevo si se renombró), se regenera el
  // caché público — antes se regeneraba desde adentro de
  // savePoiToFirestore/deletePoiFromFirestore, ANTES de esta línea,
  // con datos viejos. Eso era la causa real de que un lugar
  // renombrado desapareciera del todo al refrescar.
  syncAppStateWithPOIS(); // [NUEVO 2026-08-13] ver nota en firestore-sync.js — sin esto, el panel de este pin seguía mostrando el ID/datos viejos tras editar
  await regeneratePublicCache();
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
  window._editBannerImg = null;
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
  syncAppStateWithPOIS(); // [NUEVO 2026-08-13] ver nota en firestore-sync.js
  await regeneratePublicCache(); // [CORREGIDO 2026-08-13]
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
  ['a-name','a-slug','a-desc','a-hist','a-soc','a-lat','a-lng','a-phone','a-hours','a-tags'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  window._addSlugTouched = false; // el ID vuelve a autocompletarse desde el próximo nombre tipeado
  const addrEl = document.getElementById('a-address'); if (addrEl) addrEl.value = '';
  document.querySelectorAll('#eg-add .eopt').forEach(e => e.classList.remove('sel'));
  const defE = document.querySelector('#eg-add [data-e="📍"]'); if (defE) defE.classList.add('sel');
  addEmoji = '📍';

  // Imagen principal
  const mainPrev = document.getElementById('img-prev-add'); if (mainPrev) mainPrev.innerHTML = '🏙️';
  const mainLbl  = document.getElementById('img-lbl-add');  if (mainLbl)  mainLbl.textContent = 'Subir imagen del edificio';
  const mainWrap = document.getElementById('iu-add');       if (mainWrap) mainWrap.classList.remove('has-img');
  window._addImgB64 = null;

  // Imagen banner del panel — [NUEVO 2026-08-15] aparte de la del pin.
  const bannerPrev = document.getElementById('img-prev-banner-add'); if (bannerPrev) bannerPrev.innerHTML = '🖼️';
  const bannerLbl  = document.getElementById('img-lbl-banner-add');  if (bannerLbl)  bannerLbl.textContent = 'Subir imagen banner';
  const bannerWrap = document.getElementById('iu-banner-add');       if (bannerWrap) bannerWrap.classList.remove('has-img');
  window._addBannerImg = null;

  // Variantes — [MIGRADO 2026-08-13] ahora son slots dinámicos sin
  // límite (ver js/img-slots.js). reset() sin argumentos = arranca
  // con 1 slot vacío, como un pin nuevo sin ninguna variante todavía.
  if (typeof AltSlotsAdd !== 'undefined' && AltSlotsAdd) AltSlotsAdd.reset();

  // Inputs de archivo + input de URL de la imagen principal — texto/
  // archivo tipeado o elegido que quedaba sin limpiar aunque nunca
  // se hubiera tocado "Cargar". (Los inputs de las variantes se
  // recrean solos desde cero en AltSlotsAdd.reset(), no hace falta
  // limpiarlos acá.)
  ['img-input-add', 'img-url-add', 'img-input-banner-add', 'img-url-banner-add']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  if (typeof _renderPinFieldsEditor === 'function') _renderPinFieldsEditor('a-attrs-wrap', {});
  if (typeof _renderAddCountrySelect === 'function') _renderAddCountrySelect(); // vuelve al default (Ubicación Activa)
  if (typeof buildMultiCatSelector === 'function') buildMultiCatSelector('cat-chips-add', []);
  if (typeof syncAddCoordDisplay === 'function') syncAddCoordDisplay();
  updateAddIdPreview();
}

/* ═══════════════════════════════════════════════════════════
   PALABRAS DE RELLENO EN EL ID AUTOGENERADO
   ---------------------------------------------------------------
   Solo se filtran cuando el ID se arma SOLO del nombre (no hay
   Código Corto/ID tipeado a mano). "Museo de la Industria y el
   Trabajo" → "museo-industria-trabajo-cba", no el nombre completo.
   Si el resultado quedara vacío (nombre = puro relleno), se usa
   el nombre sin filtrar como respaldo, para nunca perder el ID.
   El campo ID tipeado a mano NUNCA pasa por este filtro — ahí el
   admin escribe lo que quiera, tal cual, sin ninguna corrección.
   ═══════════════════════════════════════════════════════════ */
const ID_STOPWORDS = new Set(['de','del','la','las','el','los','y','en','a','al','o','u','un','una','unos','unas','con','por']);

function _autoSlugBase(name) {
  const words = slugify(name).split('-').filter(Boolean);
  const filtered = words.filter(w => !ID_STOPWORDS.has(w));
  return (filtered.length ? filtered : words).join('-');
}

/* ═══════════════════════════════════════════════════════════
   PREVIEW EN VIVO DEL ID (tab "Nuevo") + ALERTA DE DUPLICADO
   ---------------------------------------------------------------
   Recalcula, en cada tecla/cambio, el mismo ID que saveNew() va a
   generar (mismo criterio: Código corto manual si está escrito, si
   no nombre+sigla de ciudad) y lo muestra debajo del campo ID. Si
   ese ID ya existe en POIS, el texto pasa a rojo con un aviso. Es
   solo informativo — nunca bloquea el tipeo; el bloqueo real sigue
   estando en saveNew() como respaldo.
   ═══════════════════════════════════════════════════════════ */
function _computeAddSlugPreview() {
  const name = (document.getElementById('a-name')?.value || '').trim();
  const country  = document.getElementById('a-country')?.value  || (window.ACTIVE_LOCATION && window.ACTIVE_LOCATION.countryCode)  || '';
  const province = document.getElementById('a-state')?.value    || (window.ACTIVE_LOCATION && window.ACTIVE_LOCATION.provinceCode) || '';
  const cityCode = document.getElementById('a-city')?.value     || (window.ACTIVE_LOCATION && window.ACTIVE_LOCATION.cityCode)     || '';
  const citySuffix = (typeof getCitySuffixFor === 'function') ? getCitySuffixFor(country, province, cityCode) : cityCode;
  const autoSlug   = citySuffix ? `${_autoSlugBase(name)}-${citySuffix}` : _autoSlugBase(name);
  const rawSlugVal = (document.getElementById('a-slug')?.value || '').trim();
  return rawSlugVal ? slugify(rawSlugVal) : autoSlug;
}

function updateAddIdPreview() {
  const previewEl = document.getElementById('a-slug-preview');
  if (!previewEl) return;
  const slug = _computeAddSlugPreview();
  if (!slug) { previewEl.textContent = ''; previewEl.style.color = ''; return; }

  const duplicate = typeof POIS !== 'undefined' && POIS.some(p => p.id === slug);
  if (duplicate) {
    previewEl.style.color = '#ef4444';
    previewEl.textContent = `⚠️ Ya existe un lugar con el ID "${slug}" — cambiá el nombre o el ID para diferenciarlo`;
  } else {
    previewEl.style.color = 'var(--text3)';
    previewEl.textContent = `ID: ${slug}`;
  }
}

(function _wireAddIdPreview() {
  ['a-name','a-slug','a-country','a-state','a-city'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', updateAddIdPreview);
    el.addEventListener('change', updateAddIdPreview);
  });
})();

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

  // El ID del lugar es el identificador único (campo `id`) — el mismo
  // valor que se usa como prefijo para nombrar las imágenes en
  // Cloudinary. Se lee del campo a-slug del panel: por defecto trae el
  // valor autocompletado (nombre+ciudad), pero el usuario puede haberlo
  // reemplazado a mano (ej. para diferenciar sucursales con el mismo
  // nombre: "pichi-cln120-cba" vs "pichi-alv150-cba"). Se pasa por
  // slugify() igual para garantizar que sea válido como nombre de
  // archivo/documento aunque el usuario haya tipeado espacios o
  // mayúsculas. Si el campo queda vacío, se cae al autogenerado.
  const country  = document.getElementById('a-country')?.value  || (window.ACTIVE_LOCATION && window.ACTIVE_LOCATION.countryCode)  || '';
  const province = document.getElementById('a-state')?.value    || (window.ACTIVE_LOCATION && window.ACTIVE_LOCATION.provinceCode) || '';
  const cityCode = document.getElementById('a-city')?.value     || (window.ACTIVE_LOCATION && window.ACTIVE_LOCATION.cityCode)     || '';
  // El sufijo del ID es la SIGLA de 3 letras de la ciudad (ej. "cba"),
  // no el cityCode completo (que puede traer un prefijo tipo "c-" y se
  // usa para la carpeta de Cloudinary, no para el ID del pin). Se busca
  // en las ubicaciones guardadas (cities.js); si no encuentra nada,
  // getCitySuffixFor ya devuelve un respaldo razonable.
  const citySuffix = (typeof getCitySuffixFor === 'function') ? getCitySuffixFor(country, province, cityCode) : cityCode;
  const autoSlug   = citySuffix ? `${_autoSlugBase(name)}-${citySuffix}` : _autoSlugBase(name);
  const rawSlugVal = (document.getElementById('a-slug')?.value || '').trim();
  const slug = rawSlugVal ? slugify(rawSlugVal) : autoSlug;

  if (!slug) { toast('⚠️ El ID no puede quedar vacío'); return; }
  if (POIS.some(p => p.id === slug)) {
    toast(`⚠️ Ya existe un lugar con el ID "${slug}" — cambialo para diferenciarlo (ej. agregando la altura/calle)`);
    return;
  }

  const p = {
    id: slug, name,
    category: mainCat, categories: cats, categoryLabel: cfg.label,
    icon: addEmoji, lat, lng, address,
    country, province, city: cityCode,
    imgB64:  window._addImgB64  || null,
    // Imagen banner del panel — [NUEVO 2026-08-15] ver nota igual en saveEdit().
    banner:  window._addBannerImg ? { url: window._addBannerImg } : null,
    pinScale: 100, pinOffsetX: 0, pinOffsetY: 0,
    desc:  document.getElementById('a-desc').value.trim(),
    hist:  document.getElementById('a-hist').value.trim() || 'Sin datos históricos.',
    // [Etapa 3] pin nuevo: nace directo con content[idioma].fields[],
    // sin `attrs` (legado) — ver regla 4 del modelo de datos en
    // PLAN_IMPORTACION_MASIVA.md ("attrs nunca fuente de verdad para
    // pines nuevos").
    content: _buildContentWithFields(null, _readPinFieldsFromForm('a-attrs-wrap')),
    soc:   document.getElementById('a-soc').value.split(',').map(s=>s.trim()).filter(Boolean),
    tags:  document.getElementById('a-tags').value.split(',').map(s=>s.trim()).filter(Boolean),
    phone: (document.getElementById('a-phone')||{value:''}).value.trim(),
    hours: (document.getElementById('a-hours')||{value:''}).value.trim(),
    events: [], iconCyber:'🔵', iconWinter:'❄️', iconZombie:'☣️',
    active: true,
  };

  // [Mejora asignación de dueño por email, 2026-08-21] Mismo criterio
  // que en saveEdit(): el campo pide el mail, se resuelve acá antes
  // de guardar; si no existe cuenta con ese mail, se corta el guardado.
  const _aOwnerEmailInput = document.getElementById('a-owner-email');
  if (_aOwnerEmailInput) {
    const email = _aOwnerEmailInput.value.trim();
    if (!email) {
      p.ownerId = null;
    } else {
      const uid = await _resolveOwnerEmailToUid(email);
      if (!uid) {
        toast(`⚠️ No hay ninguna cuenta registrada con el mail "${email}" — pedile al dueño que se registre primero desde la app (botón 👤)`);
        return;
      }
      p.ownerId = uid;
    }
  } else {
    p.ownerId = null;
  }

  // Skins — [MIGRADO 2026-08-13] la imagen principal + las variantes
  // (slots dinámicos de AltSlotsAdd) se guardan en `poi.skins`, el
  // mismo campo que usa el carrusel del panel y la vinculación de
  // imágenes por texto. Ya no existe el campo legado imgAlt1/2/3.
  const skins = {};
  if (p.imgB64) skins.main = { url: p.imgB64, style: 'main', active: true };
  const altSkins = (typeof AltSlotsAdd !== 'undefined' && AltSlotsAdd) ? AltSlotsAdd.getSkins() : {};
  Object.entries(altSkins).forEach(([variant, { url, active }]) => {
    skins[variant] = { url, style: variant, active };
  });
  if (Object.keys(skins).length > 0) p.skins = skins;

  // Aplicar campos compartidos del grupo si aplica
  if (p.groupId) applyGroupFields(p);

  toast('⏳ Guardando...');
  const guardadoOk = await savePoiToFirestore(p);
  if (!guardadoOk) return; // el propio savePoiToFirestore ya avisó el error, no seguimos

  POIS.push(p);
  // [CORREGIDO 2026-08-13] Regenerar caché acá, con POIS ya incluyendo
  // el lugar nuevo — antes se disparaba desde adentro de
  // savePoiToFirestore, ANTES de este push.
  syncAppStateWithPOIS(); // [NUEVO 2026-08-13] ver nota en firestore-sync.js — sin esto, el pin se dibuja en el mapa pero al tocarlo el panel no encuentra datos
  await regeneratePublicCache();
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
  // [CORREGIDO 2026-08-13] Una sola regeneración de caché al final,
  // con POIS ya con todos los pines-cascarón nuevos adentro — antes
  // se regeneraba (mal) adentro de cada savePoiToFirestore del loop.
  if (created > 0) { syncAppStateWithPOIS(); await regeneratePublicCache(); } // [NUEVO 2026-08-13] ver nota en firestore-sync.js
  textarea.value = '';
  renderList();
  toast(`✅ ${created} lugar(es) creado(s)` + (skipped ? `, ${skipped} omitido(s) (ya existían o nombre inválido)` : ''));
}

(function wireBulkCreateBtn() {
  const btn = document.getElementById('btn-bulk-create');
  if (btn) btn.addEventListener('click', createShellPinsFromPrefixList);
})();

/* ═══════════════════════════════════════════════════════════
   CAMPOS DE INFORMACIÓN LIBRES POR PIN — [REESCRITO Etapa 3,
   2026-08-15] Ahora escriben directo a `content[idioma].fields[]`
   (esquema definitivo, ver PLAN_IMPORTACION_MASIVA.md), en vez del
   viejo `poi.attrs` sin idioma. Selector de idioma (ES/EN/PT) arriba
   de las filas: cada idioma tiene su propia lista de campos,
   independiente de los otros dos — un lugar puede tener 4 campos en
   español y 2 en inglés sin problema.
   `poi.attrs` (legado) queda intacto como fallback de compatibilidad
   para pines viejos — este editor nuevo ya no lo lee ni lo escribe.
   Se separó como función genérica (recibe el id del contenedor)
   porque hace falta en DOS formularios (Agregar y Editar).
   ═══════════════════════════════════════════════════════════ */

const PIN_FIELD_LANGS = ['es', 'en', 'pt'];
const PIN_FIELD_LANG_LABELS = { es: 'ES', en: 'EN', pt: 'PT' };

// Estado en memoria de cada editor (uno para 'a-attrs-wrap', otro para
// 'e-attrs-wrap'): qué idioma está visible ahora mismo y los campos
// acumulados de los 3 idiomas (los no-visibles no están en el DOM,
// por eso hace falta guardarlos acá en vez de leerlos siempre del form).
const _pinFieldsState = {
  'a-attrs-wrap': { lang: 'es', data: { es: [], en: [], pt: [] } },
  'e-attrs-wrap': { lang: 'es', data: { es: [], en: [], pt: [] } },
};

/**
 * Lee del DOM las filas título/texto tal como están ahora en pantalla
 * (solo el idioma actualmente visible — incluye filas vacías, el
 * filtrado se hace al guardar en Firestore).
 * [Etapa 9, 2026-08-16] El input de `id` no se muestra en pantalla
 * (es un dato interno, no algo que Cris tenga que tipear) — por eso
 * acá se recupera por posición desde el estado en memoria
 * (`_pinFieldsState`), que sí lo conserva desde que se cargó el pin
 * o desde que `_ensureFieldIds` se lo asignó en un guardado anterior.
 * El orden de las filas en el DOM siempre coincide con el del array
 * de estado (agregar hace `push`, quitar hace `splice` en ambos a la
 * vez), así que leer por índice es seguro.
 * @param {string} wrapId - 'a-attrs-wrap' o 'e-attrs-wrap'
 * @returns {Array<{id?:string, title:string, text:string}>}
 */
function _readVisiblePinFieldRows(wrapId) {
  const p = wrapId === 'a-attrs-wrap' ? 'a' : 'e';
  const titlePrefix = `${p}-fl-`;
  const textPrefix = `${p}-fv-`;
  const st = _pinFieldsState[wrapId];
  const prevRows = (st && st.data && st.data[st.lang]) || [];
  const count = document.querySelectorAll(`[id^="${titlePrefix}"]`).length;
  const rows = [];
  for (let i = 0; i < count; i++) {
    const title = document.getElementById(`${titlePrefix}${i}`)?.value ?? '';
    const text = document.getElementById(`${textPrefix}${i}`)?.value ?? '';
    const row = { title, text };
    if (prevRows[i] && prevRows[i].id) row.id = prevRows[i].id;
    rows.push(row);
  }
  return rows;
}

/** Vuelca las filas visibles en pantalla al estado en memoria, antes
 * de cambiar de idioma, agregar o quitar una fila. */
function _syncVisiblePinFieldsIntoState(wrapId) {
  const st = _pinFieldsState[wrapId];
  st.data[st.lang] = _readVisiblePinFieldRows(wrapId);
}

/**
 * Lee el estado completo (los 3 idiomas), sincronizando primero el
 * idioma visible en pantalla. Filas totalmente vacías se descartan.
 * @param {string} wrapId - 'a-attrs-wrap' o 'e-attrs-wrap'
 * @returns {{es:Array<{title:string,text:string}>, en:Array, pt:Array}}
 */
function _readPinFieldsFromForm(wrapId) {
  _syncVisiblePinFieldsIntoState(wrapId);
  const st = _pinFieldsState[wrapId];
  const clean = (arr) => (arr || []).filter(f => (f.title || '').trim() || (f.text || '').trim());
  return { es: clean(st.data.es), en: clean(st.data.en), pt: clean(st.data.pt) };
}

/** Dibuja las filas título/texto del idioma activo + botón "Agregar". */
function _renderPinFieldRows(wrapId) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  const p = wrapId === 'a-attrs-wrap' ? 'a' : 'e';
  const titlePrefix = `${p}-fl-`;
  const textPrefix = `${p}-fv-`;
  const addBtnId = `btn-add-${p}-field`;
  const st = _pinFieldsState[wrapId];
  const rows = st.data[st.lang] || [];

  wrap.innerHTML = rows.map((f, i) => `
    <div style="display:flex;gap:7px;margin-bottom:7px;align-items:center">
      <input class="fi" style="flex:0 0 110px;font-size:12px" value="${f.title || ''}" id="${titlePrefix}${i}" placeholder="Título (ej: Dato curioso)">
      <input class="fi" style="flex:1;font-size:12px" value="${f.text || ''}" id="${textPrefix}${i}" placeholder="Texto">
      <button type="button" class="ibtn" data-remove-pin-field="${i}" title="Quitar este campo" style="flex:0 0 auto;padding:6px 9px;">🗑</button>
    </div>`).join('');

  wrap.querySelectorAll('[data-remove-pin-field]').forEach(btn => {
    btn.addEventListener('click', () => {
      _syncVisiblePinFieldsIntoState(wrapId);
      st.data[st.lang].splice(parseInt(btn.dataset.removePinField, 10), 1);
      _renderPinFieldRows(wrapId);
    });
  });

  let addBtn = document.getElementById(addBtnId);
  if (!addBtn) {
    addBtn = document.createElement('button');
    addBtn.id = addBtnId;
    addBtn.type = 'button';
    addBtn.className = 'ibtn';
    addBtn.style.cssText = 'width:100%;margin-bottom:10px;';
    wrap.parentNode.insertBefore(addBtn, wrap.nextSibling);
  }
  addBtn.textContent = `➕ Agregar campo de información (${PIN_FIELD_LANG_LABELS[st.lang]})`;
  addBtn.onclick = () => {
    _syncVisiblePinFieldsIntoState(wrapId);
    st.data[st.lang].push({ title: '', text: '' });
    _renderPinFieldRows(wrapId);
  };
}

/** Dibuja (o actualiza) la barra de pestañas ES/EN/PT arriba de las filas. */
function _renderPinFieldsLangTabs(wrapId) {
  const wrap = document.getElementById(wrapId);
  if (!wrap) return;
  const p = wrapId === 'a-attrs-wrap' ? 'a' : 'e';
  const tabBarId = `${p}-fields-lang-tabs`;
  const st = _pinFieldsState[wrapId];

  let tabBar = document.getElementById(tabBarId);
  if (!tabBar) {
    tabBar = document.createElement('div');
    tabBar.id = tabBarId;
    tabBar.style.cssText = 'display:flex;gap:6px;margin-bottom:8px;';
    wrap.parentNode.insertBefore(tabBar, wrap);
  }
  tabBar.innerHTML = PIN_FIELD_LANGS.map(lang => `
    <button type="button" class="ibtn" data-pin-fields-lang="${lang}"
      style="flex:1;padding:5px 0;font-size:11px;font-weight:${lang === st.lang ? '700' : '400'};
      background:${lang === st.lang ? 'var(--accent, #0d9488)' : ''};
      color:${lang === st.lang ? '#fff' : ''};">
      ${PIN_FIELD_LANG_LABELS[lang]}${(st.data[lang] || []).length ? ` (${st.data[lang].length})` : ''}
    </button>`).join('');

  tabBar.querySelectorAll('[data-pin-fields-lang]').forEach(btn => {
    btn.addEventListener('click', () => {
      const newLang = btn.dataset.pinFieldsLang;
      if (newLang === st.lang) return;
      _syncVisiblePinFieldsIntoState(wrapId);
      st.lang = newLang;
      _renderPinFieldsLangTabs(wrapId);
      _renderPinFieldRows(wrapId);
    });
  });
}

/**
 * Inicializa/reinicia el editor de campos dentro de `wrapId`
 * ('a-attrs-wrap' o 'e-attrs-wrap') con el contenido multi-idioma de
 * un POI (o vacío, para el form de "Agregar"). Siempre arranca
 * mostrando la pestaña ES.
 * @param {string} wrapId
 * @param {Object} [content] - `poi.content` tal como está en Firestore,
 *   ej. `{ es: {fields:[...]}, en: {...}, pt: {...} }`. Cualquier
 *   idioma ausente o sin `fields` arranca con lista vacía.
 */
function _renderPinFieldsEditor(wrapId, content) {
  const c = content || {};
  _pinFieldsState[wrapId] = {
    lang: 'es',
    data: {
      es: (c.es && Array.isArray(c.es.fields)) ? c.es.fields.map(f => ({ ...f })) : [],
      en: (c.en && Array.isArray(c.en.fields)) ? c.en.fields.map(f => ({ ...f })) : [],
      pt: (c.pt && Array.isArray(c.pt.fields)) ? c.pt.fields.map(f => ({ ...f })) : [],
    },
  };
  _renderPinFieldsLangTabs(wrapId);
  _renderPinFieldRows(wrapId);
}

/**
 * [Etapa 9, 2026-08-16] Calcula el próximo id disponible para un
 * campo nuevo dentro de UN array de fields de UN idioma de UN pin
 * (`campo-01`, `campo-02`... dos dígitos). Mira los ids YA asignados
 * en ese array (pueden tener huecos si se borró alguno en el medio)
 * y devuelve el siguiente al más alto. Si no hay ninguno con id
 * todavía, arranca en `campo-01`.
 * @param {Array<{id?:string}>} existingFields
 * @returns {string}
 */
function _nextFieldId(existingFields) {
  let max = 0;
  (existingFields || []).forEach((f) => {
    const m = f && typeof f.id === 'string' && f.id.match(/^campo-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `campo-${String(max + 1).padStart(2, '0')}`;
}

/**
 * [Etapa 9, 2026-08-16] Recorre un array de fields de un idioma y le
 * asigna `id` a cualquier campo que todavía no lo tenga, respetando
 * el id de los que ya lo tienen (nunca se reasigna un id existente,
 * ni se cambia el orden). Es el único lugar del proyecto donde se
 * generan ids nuevos de campo — lo usan tanto el editor manual del
 * admin (`_buildContentWithFields`, más abajo) como el importador
 * `### PIN` (que arma fields sin id todavía en `parsePinBulkText`).
 * @param {Array<{id?:string, title?:string, text?:string}>} fields
 * @returns {Array<{id:string, title:string, text:string}>} copia nueva, con id en todos
 */
function _ensureFieldIds(fields) {
  const result = [];
  (fields || []).forEach((f) => {
    if (f && f.id) { result.push({ ...f }); return; }
    result.push({ ...f, id: _nextFieldId(result) });
  });
  return result;
}

/**
 * Arma el objeto `content` completo a mandar a Firestore, preservando
 * `name`/`gancho`/`description`/`custom_fields` que ya existieran por
 * idioma (esos campos son de otras etapas, este editor no los toca) y
 * reemplazando únicamente `fields[]` con lo que se acaba de editar.
 * [Etapa 9, 2026-08-16] Antes de guardar, cada array de fields pasa
 * por `_ensureFieldIds` — así todo campo (nuevo o ya existente) queda
 * con un `id` estable, sin importar si vino del editor manual o del
 * importador `### PIN`.
 * @param {Object|null|undefined} existingContent - `poi.content` previo (o nada, pin nuevo)
 * @param {{es:Array, en:Array, pt:Array}} fieldsByLang - resultado de `_readPinFieldsFromForm`
 * @returns {Object} `content` listo para guardar
 */
function _buildContentWithFields(existingContent, fieldsByLang) {
  const existing = existingContent || {};
  const result = {};
  PIN_FIELD_LANGS.forEach((lang) => {
    result[lang] = { ...(existing[lang] || {}), fields: _ensureFieldIds(fieldsByLang[lang] || []) };
  });
  return result;
}

// El form de Agregar arranca vacío (sin pin todavía cargado) — se
// dibuja una sola vez al cargar la página.
_renderPinFieldsEditor('a-attrs-wrap', {});

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
     campos_en:
       Description: text...
       Fun fact: text...
     campos_pt:
       Descrição: texto...
     imagenes:
       cabildo-cba_main_01.webp
       cabildo-cba_night_01.webp

   [Etapa 5, 2026-08-15] "campos:" (sin sufijo) = español, cantidad
   libre de título+texto, igual que siempre. Se agregan "campos_en:"
   y "campos_pt:" opcionales, mismo formato, para cargar los otros 2
   idiomas en el mismo bloque si ya se tienen traducidos. Cualquiera
   de los 3 puede faltar — un pin puede entrar solo con "campos:" (ES)
   y completarse en EN/PT más adelante con otra importación o a mano
   desde el admin.
   Los 3 van directo a `content[idioma].fields[]` (esquema definitivo
   de la Etapa 1/3) — este importador YA NO escribe `poi.attrs`
   (legado). Al ACTUALIZAR un pin existente, un idioma que no aparece
   en el bloque de texto (ej. no se puso "campos_pt:") NO se toca —
   se preservan los campos que ya tenía cargados en ese idioma, no se
   pisan con una lista vacía.

   Si un lugar del texto ya existe (mismo id/slug), se ACTUALIZA en
   vez de duplicarse. Un error en un bloque puntual no frena a los
   demás — se reporta al final cuáles fallaron y por qué.

   [Etapa 6, 2026-08-15] Flujo en 2 pasos, nada se escribe en
   Firestore hasta confirmar: "🔍 Revisar antes de importar"
   (`previewBulkFullImport`) solo parsea y muestra un reporte —
   cuántos son nuevos, cuántos actualizan uno existente, y sobre todo
   qué datos cargados a mano (categoría, banner, descripción/historia
   del campo viejo, etc.) se van a perder en cada actualización. Recién
   "✅ Confirmar e importar" (`confirmBulkFullImport`) graba de verdad.
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

  // Mapea la clave de sección tal como la escribe Cris en el texto al
  // idioma interno del modelo de datos (content[idioma].fields[]).
  const FIELD_SECTION_TO_LANG = {
    campos: 'es',
    campos_es: 'es',
    campos_en: 'en',
    campos_pt: 'pt',
  };

  blocks.forEach((block, blockIndex) => {
    try {
      const lines = block.split('\n');
      // [Etapa 5] `fields` reemplaza al viejo `attrs` plano: ahora es
      // un objeto por idioma. `providedLangs` registra qué idiomas
      // aparecieron de verdad en este bloque de texto (aunque sea con
      // 0 campos válidos adentro) — se usa después, al actualizar un
      // pin ya existente, para no pisar con vacío un idioma que ni
      // siquiera se mencionó en esta importación puntual.
      const data = { tags: [], images: [], fields: { es: [], en: [], pt: [] }, providedLangs: new Set() };
      let section = null; // null | 'es' | 'en' | 'pt' | 'imagenes'

      for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '');
        if (!line.trim()) continue;

        const isIndented = /^\s{2,}/.test(line);

        if (!isIndented) {
          const m = line.match(/^([a-zA-Záéíóúñ_]+)\s*:\s*(.*)$/i);
          if (!m) continue;
          const key = m[1].trim().toLowerCase();
          const value = m[2].trim();

          if (FIELD_SECTION_TO_LANG[key]) {
            section = FIELD_SECTION_TO_LANG[key];
            data.providedLangs.add(section);
            continue;
          }
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
        if (section === 'es' || section === 'en' || section === 'pt') {
          const m = line.trim().match(/^(.+?):\s*(.*)$/);
          if (m) data.fields[section].push({ title: m[1].trim(), text: m[2].trim() });
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
        // [Etapa 5] `_bulkFields`/`_bulkProvidedLangs` son temporales
        // — no se guardan en Firestore tal cual, `confirmBulkFullImport`
        // los convierte a `content[idioma].fields[]` (fusionando con
        // lo ya existente en un update) y los borra antes de guardar.
        _bulkFields: data.fields,
        _bulkProvidedLangs: [...data.providedLangs],
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

// [Etapa 6] Guarda el resultado del parseo entre "Revisar" y
// "Confirmar" — nada se escribe en Firestore hasta que el admin
// aprieta el botón de confirmar viendo el reporte.
let _pendingBulkFullImport = null;

/**
 * Compara cada pin recién parseado contra lo que YA existe en
 * Firestore (si existe) y arma el HTML del reporte de previsualización:
 * cuántos son nuevos, cuántos van a actualizar un pin existente, qué
 * idiomas de `campos` se tocan en cada uno, y — el punto central de
 * la Etapa 6 — qué datos ya cargados a mano en el admin (categoría,
 * imagen banner, descripción/historia del campo viejo, teléfono,
 * horario del campo viejo, si estaba publicado, posición/tamaño del
 * pin en el mapa) se van a PERDER si se confirma, porque este
 * importador reemplaza el pin entero al actualizar (ver aviso de la
 * Etapa 5 en PLAN_IMPORTACION_MASIVA.md).
 */
function _buildBulkImportPreviewHtml(pins, errors) {
  let newCount = 0, updateCount = 0, warnCount = 0;
  const rows = pins.map((p) => {
    const existing = POIS.find(x => x.id === p.id);
    const langsProvided = p._bulkProvidedLangs || [];
    const langsLabel = PIN_FIELD_LANGS
      .map(l => langsProvided.includes(l) ? PIN_FIELD_LANG_LABELS[l] : null)
      .filter(Boolean).join('/') || '(sin campos de texto en este bloque)';
    const imgCount = Object.keys(p.skins || {}).length;

    if (!existing) {
      newCount++;
      return `<div style="margin-bottom:6px">🆕 <strong>${p.name}</strong> — pin nuevo. Campos cargados: ${langsLabel}. Imágenes vinculadas: ${imgCount}.</div>`;
    }

    updateCount++;
    const losses = [];
    if (existing.category || (existing.categories && existing.categories.length)) losses.push('categoría');
    if (existing.banner && existing.banner.url) losses.push('imagen banner');
    if (existing.desc && existing.desc.trim()) losses.push('descripción (el campo viejo del editor, no "campos_es")');
    if (existing.hist && existing.hist.trim() && existing.hist !== 'Sin datos históricos.') losses.push('historia');
    if (existing.phone) losses.push('teléfono');
    if (existing.hours) losses.push('horario (el campo viejo del editor)');
    if (existing.active === true) losses.push('estado publicado (queda oculto/inactivo)');
    if (existing.pinScale && existing.pinScale !== 100) losses.push('tamaño del pin ajustado en el mapa');
    if ((existing.pinOffsetX && existing.pinOffsetX !== 0) || (existing.pinOffsetY && existing.pinOffsetY !== 0)) losses.push('posición del pin ajustada en el mapa');

    let warnHtml = '';
    if (losses.length) {
      warnCount++;
      warnHtml = `<div style="color:var(--danger,#e11d48);margin-top:2px">⚠️ ya existe y tiene <strong>${losses.join(', ')}</strong> cargado(s) a mano — se va(n) a perder si confirmás, porque este importador reemplaza el pin entero.</div>`;
    }
    return `<div style="margin-bottom:6px">✏️ <strong>${p.name}</strong> — ya existe, se actualiza. Campos que se tocan: ${langsLabel}. Imágenes en este bloque: ${imgCount}.${warnHtml}</div>`;
  }).join('');

  let html = `<div style="margin-bottom:8px"><strong>${newCount} pin(es) nuevo(s), ${updateCount} a actualizar${warnCount ? `, ${warnCount} con datos en riesgo de perderse` : ''}.</strong></div>`;
  html += rows;
  if (errors.length) {
    html += `<div style="margin-top:8px;color:var(--danger,#e11d48)"><strong>${errors.length} error(es) — esos bloques NO se van a importar aunque confirmes:</strong><br>` + errors.map(e => `• ${e}`).join('<br>') + `</div>`;
  }
  return html;
}

/**
 * Paso 1 (botón "🔍 Revisar antes de importar"): parsea el texto y
 * muestra el reporte de previsualización, SIN tocar Firestore
 * todavía. Guarda lo parseado en `_pendingBulkFullImport` a la espera
 * de que el admin confirme o cancele.
 */
function previewBulkFullImport() {
  const textarea = document.getElementById('bulk-full-text');
  const previewBox = document.getElementById('bulk-import-preview');
  const confirmRow = document.getElementById('bulk-import-confirm-row');
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

  _pendingBulkFullImport = { pins, errors };
  if (report) report.innerHTML = '';
  if (previewBox) { previewBox.style.display = 'block'; previewBox.innerHTML = _buildBulkImportPreviewHtml(pins, errors); }
  if (confirmRow) confirmRow.style.display = 'flex';
}

/**
 * Paso 2 (botón "✅ Confirmar e importar"): recién acá se escribe en
 * Firestore, usando lo que quedó guardado en `_pendingBulkFullImport`.
 * Si el admin edita el textarea después de pedir la vista previa, el
 * listener de `input` invalida este pendiente automáticamente (ver
 * `wireBulkFullImportBtn`), así que lo que se confirma acá siempre es
 * justo lo que se mostró en el reporte.
 */
async function confirmBulkFullImport() {
  if (!_pendingBulkFullImport) return;
  const { pins, errors } = _pendingBulkFullImport;
  const textarea = document.getElementById('bulk-full-text');
  const report = document.getElementById('bulk-import-report');
  const previewBox = document.getElementById('bulk-import-preview');
  const confirmRow = document.getElementById('bulk-import-confirm-row');

  const btn = document.getElementById('btn-bulk-full-import-confirm');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Importando...'; }

  let created = 0, updated = 0;
  for (const p of pins) {
    const existingIdx = POIS.findIndex(x => x.id === p.id);

    // [Etapa 5] Convertir los campos crudos del parser a
    // `content[idioma].fields[]` recién acá, porque acá es donde se
    // sabe si el pin ya existía. Un idioma que NO apareció en el
    // bloque de texto (ej. el admin solo puso "campos_es:") no se
    // toca — se preserva lo que ese idioma ya tuviera cargado en
    // Firestore, en vez de pisarlo con una lista vacía.
    const existingContent = existingIdx !== -1 ? POIS[existingIdx].content : null;
    const fieldsByLang = { es: [], en: [], pt: [] };
    PIN_FIELD_LANGS.forEach((lang) => {
      if (p._bulkProvidedLangs.includes(lang)) {
        fieldsByLang[lang] = p._bulkFields[lang];
      } else if (existingContent && existingContent[lang] && Array.isArray(existingContent[lang].fields)) {
        fieldsByLang[lang] = existingContent[lang].fields;
      }
    });
    p.content = _buildContentWithFields(existingContent, fieldsByLang);
    delete p._bulkFields;
    delete p._bulkProvidedLangs;

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

  if (btn) { btn.disabled = false; btn.textContent = '✅ Confirmar e importar'; }
  // [CORREGIDO 2026-08-13] Una sola regeneración de caché al final,
  // con POIS ya con todos los creados/actualizados de este lote.
  if (created > 0 || updated > 0) { syncAppStateWithPOIS(); await regeneratePublicCache(); } // [NUEVO 2026-08-13] ver nota en firestore-sync.js
  textarea.value = '';
  renderList();

  if (report) {
    report.innerHTML = `✅ ${created} creado(s), ${updated} actualizado(s).` +
      (errors.length ? `<br>⚠️ ${errors.length} aviso(s):<br>` + errors.map(e => `• ${e}`).join('<br>') : '');
  }
  toast(`✅ Importación terminada: ${created} creado(s), ${updated} actualizado(s)`);

  _pendingBulkFullImport = null;
  if (previewBox) { previewBox.style.display = 'none'; previewBox.innerHTML = ''; }
  if (confirmRow) confirmRow.style.display = 'none';
}

/** Botón "✖ Cancelar": descarta el parseo pendiente sin tocar
 * Firestore ni borrar lo que el admin tenía tipeado en el textarea. */
function cancelBulkFullImport() {
  _pendingBulkFullImport = null;
  const previewBox = document.getElementById('bulk-import-preview');
  const confirmRow = document.getElementById('bulk-import-confirm-row');
  if (previewBox) { previewBox.style.display = 'none'; previewBox.innerHTML = ''; }
  if (confirmRow) confirmRow.style.display = 'none';
}

(function wireBulkFullImportBtn() {
  const btn = document.getElementById('btn-bulk-full-import');
  if (btn) btn.addEventListener('click', previewBulkFullImport);
  const confirmBtn = document.getElementById('btn-bulk-full-import-confirm');
  if (confirmBtn) confirmBtn.addEventListener('click', confirmBulkFullImport);
  const cancelBtn = document.getElementById('btn-bulk-full-import-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', cancelBulkFullImport);
  // [Etapa 6] Si el admin sigue editando el texto DESPUÉS de pedir la
  // vista previa, esa vista previa queda vieja — se descarta para que
  // no pueda confirmar algo distinto de lo que ve tipeado ahora.
  const textarea = document.getElementById('bulk-full-text');
  if (textarea) textarea.addEventListener('input', () => {
    if (_pendingBulkFullImport) cancelBulkFullImport();
  });
})();


/* ═══════════════════════════════════════════════════════════
   [NUEVO 2026-08-12] VINCULAR IMÁGENES POR TEXTO (sin pisar el pin)
   ---------------------------------------------------------------
   Pensado para el flujo real: subís las imágenes directo a
   Cloudinary (fuera del admin) y después pegás acá SOLO el id de
   cada lugar + los nombres de archivo. A diferencia de "Importar
   lugares completos" de arriba, esto NO crea ni reemplaza el pin:
   el lugar tiene que existir ya, y solo se actualiza su campo de
   imágenes (`skins`), vía `saveSkinsToFirestore` (merge:true) —
   descripción, categoría, tags, coordenadas, etc. quedan intactos.

   Formato (bloques separados por "### IMG"):

     ### IMG
     id: cabildo-cba
     imagenes:
       cabildo-cba_main_01.webp
       cabildo-cba_night_01.webp
   ═══════════════════════════════════════════════════════════ */

/**
 * Parsea el texto de vinculación de imágenes en bloques "### IMG".
 * Reutiliza `parseImageFilename` (misma regla de nomenclatura que
 * ya usa "Importar lugares completos"). No lanza excepción por un
 * bloque puntual mal formado — lo reporta en `errors` y sigue.
 * @param {string} text
 * @returns {{items: Array<{id:string, skins:Object}>, errors: Array<string>}}
 */
function parseImageLinkText(text) {
  const blocks = text.split(/^###\s*IMG\s*$/mi).map(b => b.trim()).filter(Boolean);
  const items = [];
  const errors = [];

  blocks.forEach((block, blockIndex) => {
    try {
      const lines = block.split('\n');
      let id = null;
      const images = [];
      let inImagesSection = false;

      for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '');
        if (!line.trim()) continue;
        const isIndented = /^\s{2,}/.test(line);

        if (!isIndented) {
          const m = line.match(/^([a-zA-Záéíóúñ_]+)\s*:\s*(.*)$/i);
          if (!m) continue;
          const key = m[1].trim().toLowerCase();
          const value = m[2].trim();
          if (key === 'imagenes' || key === 'imágenes') { inImagesSection = true; continue; }
          inImagesSection = false;
          if (key === 'id') id = value;
          continue;
        }
        if (inImagesSection) {
          const filename = line.trim();
          if (filename) images.push(filename);
        }
      }

      if (!id) {
        errors.push(`Bloque #${blockIndex + 1}: falta "id:" — se saltea.`);
        return;
      }
      if (!images.length) {
        errors.push(`"${id}": no tiene ninguna imagen listada en "imagenes:" — se saltea.`);
        return;
      }

      const existing = POIS.find(x => x.id === id);
      if (!existing) {
        errors.push(`"${id}": no existe ningún lugar con ese ID todavía — creálo primero (o revisá que esté bien escrito).`);
        return;
      }

      const skins = {};
      images.forEach(filename => {
        const parsed = parseImageFilename(filename);
        if (!parsed) {
          errors.push(`"${id}": nombre de imagen inválido "${filename}" (sin extensión) — se saltea esa imagen.`);
          return;
        }
        const check = (typeof validateUploadFilename === 'function') ? validateUploadFilename(filename, id) : { valid: true };
        if (!check.valid) {
          errors.push(`"${id}" / "${filename}": ${check.reason}`);
          return;
        }
        skins[parsed.variant] = {
          url: _buildBulkImageUrl(filename),
          style: parsed.variant,
          active: true,
        };
      });

      if (Object.keys(skins).length === 0) return;
      items.push({ id, skins });
    } catch (err) {
      errors.push(`Bloque #${blockIndex + 1}: error inesperado (${err.message}) — se saltea.`);
    }
  });

  return { items, errors };
}

/**
 * Guarda las vinculaciones parseadas: merge del campo `skins` en
 * Firestore (sin tocar el resto del documento) + actualiza POIS en
 * memoria + re-renderiza. Si el pin editado está abierto en el panel
 * en ese momento, también lo refresca para que se vea al toque.
 */
async function importImageLinksFromText() {
  const textarea = document.getElementById('bulk-img-link-text');
  const report = document.getElementById('bulk-img-link-report');
  if (!textarea) return;

  const { items, errors } = parseImageLinkText(textarea.value || '');

  if (!items.length && !errors.length) {
    toast('⚠️ Pegá al menos un lugar con el formato "### IMG"');
    return;
  }

  const btn = document.getElementById('btn-bulk-img-link');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Vinculando...'; }

  let linked = 0;
  for (const item of items) {
    const idx = POIS.findIndex(x => x.id === item.id);
    if (idx === -1) { errors.push(`"${item.id}": desapareció de la lista local — reintentá.`); continue; }

    const mainUrl = item.skins.main ? item.skins.main.url : null;
    const ok = await saveSkinsToFirestore(item.id, item.skins, mainUrl);
    if (!ok) { errors.push(`"${item.id}": no se pudo guardar en Firestore.`); continue; }

    // Skins ya mergeados (existentes + nuevos) — se usan tanto para el
    // arreglo global POIS (lista del admin, marcadores) como para
    // avisarle a AppState (panel de lugar) del cambio.
    const mergedSkins = { ...(POIS[idx].skins || {}), ...item.skins };
    POIS[idx].skins = mergedSkins;
    if (mainUrl) POIS[idx].imgB64 = mainUrl;

    if (typeof AppState !== 'undefined' && typeof AppState.updatePoi === 'function') {
      const patch = { id: item.id, skins: mergedSkins };
      if (mainUrl) patch.imgB64 = mainUrl;
      AppState.updatePoi(patch); // dispara POI_UPDATED → el panel se re-renderiza solo si está abierto en ese lugar
    }

    linked++;
  }

  if (btn) { btn.disabled = false; btn.textContent = '🖼️ Vincular imágenes'; }
  // [CORREGIDO 2026-08-13] Una sola regeneración de caché al final,
  // con POIS ya con todos los skins vinculados de este lote.
  if (linked > 0) { syncAppStateWithPOIS(); await regeneratePublicCache(); } // [NUEVO 2026-08-13] ver nota en firestore-sync.js
  textarea.value = '';
  renderList();

  if (report) {
    report.innerHTML = `✅ ${linked} lugar(es) vinculado(s).` +
      (errors.length ? `<br>⚠️ ${errors.length} aviso(s):<br>` + errors.map(e => `• ${e}`).join('<br>') : '');
  }
  toast(`✅ Vinculación terminada: ${linked} lugar(es) actualizado(s)`);
}

(function wireBulkImageLinkBtn() {
  const btn = document.getElementById('btn-bulk-img-link');
  if (btn) btn.addEventListener('click', importImageLinksFromText);
})();


/* ═══════════════════════════════════════════════════════════
   [NUEVO Etapa 9, 2026-08-16] ACTUALIZAR SOLO TEXTO DE CAMPOS
   PUNTUALES (sin pisar nombre/coordenadas/imágenes/otros campos)
   ---------------------------------------------------------------
   Mismo espíritu que "### IMG" arriba: el lugar tiene que existir
   ya, y esto NO crea ni reemplaza el pin — solo toca, DENTRO de un
   idioma puntual de un pin puntual, el título y/o el texto de campos
   puntuales identificados por su `id` estable (`campo-01`, `campo-02`,
   etc. — ver `_nextFieldId`/`_ensureFieldIds` más arriba). Cualquier
   otro campo de ese mismo idioma que no se mencione queda intacto,
   en su misma posición. Vía `saveFieldsPartialToFirestore`
   (merge:true sobre `content.<idioma>.fields`), nada fuera de esa
   ruta puntual se toca — ni `skins`, ni `banner`, ni coordenadas, ni
   tags, ni categoría, ni los otros 2 idiomas.

   Formato (bloques separados por "### TEXTO", siempre UN pin y UN
   idioma por bloque — para actualizar varios idiomas de un mismo pin,
   son varios bloques seguidos; se pueden mezclar bloques de pines
   distintos uno atrás del otro en el mismo textarea):

     ### TEXTO
     id: alto-paz-tower-cba
     idioma: es
     campo-02:
       titulo: Arquitectura renovada de Morini Arquitectos
       texto: Su moderno diseño fue recientemente premiado por...
     campo-05:
       texto: Solo cambio el texto de este campo, el título queda igual.

   Si ponés los dos (`titulo:`/`texto:`) se actualizan ambos; si
   ponés solo uno, el otro queda exactamente como estaba. Si el
   `campo-NN` todavía no existe en ese idioma, se crea nuevo con ese
   id — para eso hacen falta `titulo:` Y `texto:` los dos (no tiene
   sentido crear un campo con solo la mitad); si falta alguno, se
   reporta el aviso y se saltea ese campo puntual (el resto del
   bloque sigue procesándose normalmente).
   ═══════════════════════════════════════════════════════════ */

/**
 * Parsea el texto de actualización de campos en bloques "### TEXTO".
 * No lanza excepción por un bloque puntual mal formado — lo reporta
 * en `errors` y sigue con los demás.
 * @param {string} text
 * @returns {{items: Array<{pinId:string, idioma:string, campos:Array<{campoId:string, hasTitulo:boolean, titulo:string, hasTexto:boolean, texto:string}>}>, errors: Array<string>}}
 */
function parseTextoBulkText(text) {
  const blocks = text.split(/^###\s*TEXTO\s*$/mi).map(b => b.trim()).filter(Boolean);
  const items = [];
  const errors = [];

  blocks.forEach((block, blockIndex) => {
    try {
      const lines = block.split('\n');
      let pinId = null;
      let idioma = null;
      const campos = [];
      let currentCampo = null;

      for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '');
        if (!line.trim()) continue;
        const isIndented = /^\s{2,}/.test(line);

        if (!isIndented) {
          const m = line.match(/^([a-zA-Z0-9áéíóúñ_-]+)\s*:\s*(.*)$/i);
          if (!m) continue;
          const key = m[1].trim().toLowerCase();
          const value = m[2].trim();

          const campoMatch = key.match(/^campo-(\d+)$/);
          if (campoMatch) {
            currentCampo = {
              campoId: `campo-${campoMatch[1].padStart(2, '0')}`,
              hasTitulo: false, titulo: '',
              hasTexto: false, texto: '',
            };
            campos.push(currentCampo);
            continue;
          }
          currentCampo = null;

          if (key === 'id') pinId = value;
          else if (key === 'idioma') idioma = value.toLowerCase();
          continue;
        }

        // Línea indentada: título/texto del campo activo.
        if (currentCampo) {
          const m = line.trim().match(/^(titulo|título|texto)\s*:\s*(.*)$/i);
          if (!m) continue;
          const k = m[1].toLowerCase();
          if (k === 'titulo' || k === 'título') { currentCampo.titulo = m[2]; currentCampo.hasTitulo = true; }
          else { currentCampo.texto = m[2]; currentCampo.hasTexto = true; }
        }
      }

      if (!pinId) { errors.push(`Bloque #${blockIndex + 1}: falta "id:" — se saltea.`); return; }
      if (!idioma || !PIN_FIELD_LANGS.includes(idioma)) {
        errors.push(`Bloque #${blockIndex + 1} ("${pinId}"): falta "idioma:" válido (es/en/pt) — se saltea.`);
        return;
      }
      if (!campos.length) { errors.push(`"${pinId}"/${idioma}: no tiene ningún "campo-NN:" — se saltea.`); return; }

      const existing = POIS.find(x => x.id === pinId);
      if (!existing) {
        errors.push(`"${pinId}": no existe ningún lugar con ese ID todavía — creálo primero (o revisá que esté bien escrito).`);
        return;
      }

      items.push({ pinId, idioma, campos });
    } catch (err) {
      errors.push(`Bloque #${blockIndex + 1}: error inesperado (${err.message}) — se saltea.`);
    }
  });

  return { items, errors };
}

/**
 * Guarda las actualizaciones parseadas: para cada combinación
 * pin+idioma que aparece en el texto, arma el array de fields final
 * en memoria (actualizando/creando solo los `campo-NN` mencionados,
 * dejando el resto intacto) y lo manda con `saveFieldsPartialToFirestore`
 * (una sola escritura por pin+idioma, aunque haya varios bloques del
 * mismo pin+idioma en el mismo texto). Actualiza POIS en memoria +
 * AppState (para refrescar el panel si está abierto) + re-renderiza.
 */
async function importTextoFieldsFromText() {
  const textarea = document.getElementById('bulk-texto-text');
  const report = document.getElementById('bulk-texto-report');
  if (!textarea) return;

  const { items, errors } = parseTextoBulkText(textarea.value || '');

  if (!items.length && !errors.length) {
    toast('⚠️ Pegá al menos un bloque con el formato "### TEXTO"');
    return;
  }

  const btn = document.getElementById('btn-bulk-texto');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Actualizando...'; }

  // Un array de fields "en construcción" por cada combinación
  // pin+idioma que aparece en el texto — así, si el mismo pin+idioma
  // aparece en más de un bloque, se acumulan los cambios y se escribe
  // en Firestore una sola vez al final, no una vez por bloque.
  const pending = new Map(); // key `${pinId}::${idioma}` -> Array<field>
  const touchedKeys = [];

  for (const item of items) {
    const key = `${item.pinId}::${item.idioma}`;
    if (!pending.has(key)) {
      const idx = POIS.findIndex(x => x.id === item.pinId);
      const existingFields = (idx !== -1 && POIS[idx].content && POIS[idx].content[item.idioma] && Array.isArray(POIS[idx].content[item.idioma].fields))
        ? POIS[idx].content[item.idioma].fields.map(f => ({ ...f }))
        : [];
      pending.set(key, existingFields);
      touchedKeys.push(key);
    }
    const fields = pending.get(key);

    for (const campo of item.campos) {
      const fIdx = fields.findIndex(f => f.id === campo.campoId);
      if (fIdx !== -1) {
        if (campo.hasTitulo) fields[fIdx].title = campo.titulo;
        if (campo.hasTexto) fields[fIdx].text = campo.texto;
      } else if (campo.hasTitulo && campo.hasTexto) {
        fields.push({ id: campo.campoId, title: campo.titulo, text: campo.texto });
      } else {
        errors.push(`"${item.pinId}"/${item.idioma}: "${campo.campoId}" no existe todavía y falta ${campo.hasTitulo ? 'el texto' : 'el título'} para crearlo — se saltea.`);
      }
    }
  }

  let updated = 0;
  for (const key of touchedKeys) {
    const [pinId, idioma] = key.split('::');
    const fields = pending.get(key);
    const ok = await saveFieldsPartialToFirestore(pinId, idioma, fields);
    if (!ok) { errors.push(`"${pinId}"/${idioma}: no se pudo guardar en Firestore.`); continue; }

    const idx = POIS.findIndex(x => x.id === pinId);
    let mergedContent = { [idioma]: { fields } };
    if (idx !== -1) {
      const existingContent = POIS[idx].content || {};
      mergedContent = { ...existingContent, [idioma]: { ...(existingContent[idioma] || {}), fields } };
      POIS[idx].content = mergedContent;
    }
    // Igual que en `importImageLinksFromText`: avisarle a AppState del
    // cambio para que, si el panel de este lugar está abierto en ese
    // momento, se refresque solo (evento POI_UPDATED). El documento ya
    // quedó guardado arriba con `saveFieldsPartialToFirestore`
    // (merge:true, solo esa ruta) — este `updatePoi` es nada más para
    // la UI en vivo.
    if (typeof AppState !== 'undefined' && typeof AppState.updatePoi === 'function') {
      AppState.updatePoi({ id: pinId, content: mergedContent });
    }
    updated++;
  }

  if (btn) { btn.disabled = false; btn.textContent = '🔤 Actualizar solo texto'; }
  if (updated > 0) { syncAppStateWithPOIS(); await regeneratePublicCache(); }
  textarea.value = '';
  renderList();

  if (report) {
    report.innerHTML = `✅ ${updated} combinación(es) pin/idioma actualizada(s).` +
      (errors.length ? `<br>⚠️ ${errors.length} aviso(s):<br>` + errors.map(e => `• ${e}`).join('<br>') : '');
  }
  toast(`✅ Actualización de texto terminada: ${updated} actualizada(s)`);
}

(function wireBulkTextoBtn() {
  const btn = document.getElementById('btn-bulk-texto');
  if (btn) btn.addEventListener('click', importTextoFieldsFromText);
})();


/* ═══════════════════════════════════════════════════════════
   [NUEVO Etapa 9, 2026-08-16] MIGRACIÓN — asignar `id` a campos que
   ya existían antes de esta etapa (creados por el editor manual o
   por "### PIN" en sesiones/versiones previas, cuando `fields[]`
   todavía no tenía `id`). Es un botón de un solo uso (se puede
   apretar más de una vez sin problema, es idempotente — pines/idiomas
   ya migrados se saltean sin escribir nada), pensado para correr una
   vez antes de empezar a usar "### TEXTO" sobre pines viejos.

   Recorre POIS en memoria; para cada pin y cada idioma cuyo `fields[]`
   tenga algún elemento sin `id`, le asigna `campo-01`, `campo-02`...
   en el ORDEN en que ya estaban guardados (no reordena ni toca
   título/texto), vía `_ensureFieldIds` (la misma función que usa el
   editor manual y "### PIN"), y guarda SOLO esa ruta con
   `saveFieldsPartialToFirestore` — no toca nombre, coordenadas,
   imágenes ni ningún otro campo del pin.
   ═══════════════════════════════════════════════════════════ */
async function migrateFieldIds() {
  const btn = document.getElementById('btn-migrate-field-ids');
  const report = document.getElementById('migrate-field-ids-report');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Migrando...'; }

  let migratedCount = 0, skippedCount = 0;
  const errors = [];

  for (const poi of POIS) {
    if (!poi.content) continue;
    for (const lang of PIN_FIELD_LANGS) {
      const langContent = poi.content[lang];
      if (!langContent || !Array.isArray(langContent.fields) || !langContent.fields.length) continue;
      const needsMigration = langContent.fields.some(f => !f || !f.id);
      if (!needsMigration) { skippedCount++; continue; }

      const migratedFields = _ensureFieldIds(langContent.fields);
      const ok = await saveFieldsPartialToFirestore(poi.id, lang, migratedFields);
      if (!ok) { errors.push(`"${poi.id}"/${lang}: no se pudo guardar en Firestore.`); continue; }

      poi.content[lang] = { ...langContent, fields: migratedFields };
      migratedCount++;
    }
  }

  if (btn) { btn.disabled = false; btn.textContent = '🔧 Asignar IDs a campos existentes'; }
  if (migratedCount > 0) { syncAppStateWithPOIS(); await regeneratePublicCache(); }
  renderList();

  if (report) {
    report.innerHTML = `✅ ${migratedCount} combinación(es) pin/idioma migrada(s), ${skippedCount} ya estaban al día.` +
      (errors.length ? `<br>⚠️ ${errors.length} aviso(s):<br>` + errors.map(e => `• ${e}`).join('<br>') : '');
  }
  toast(`✅ Migración de IDs terminada: ${migratedCount} migrada(s)`);
}

(function wireMigrateFieldIdsBtn() {
  const btn = document.getElementById('btn-migrate-field-ids');
  if (btn) btn.addEventListener('click', migrateFieldIds);
})();


