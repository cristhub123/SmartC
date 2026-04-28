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
function saveEdit() {
  if (editingId === null) return;
  const idx = POIS.findIndex(x => x.id === editingId);
  if (idx === -1) return;

  const name = document.getElementById('e-name').value.trim();
  const cats = (typeof getSelectedCats === 'function') ? getSelectedCats('cat-chips-edit') : [document.getElementById('e-cat')?.value].filter(Boolean);
  const lat  = parseFloat(document.getElementById('e-lat').value);
  const lng  = parseFloat(document.getElementById('e-lng').value);
  if (!name)        { toast('⚠️ El nombre no puede estar vacío'); return; }
  if (!cats.length) { toast('⚠️ Seleccioná al menos una categoría'); return; }

  const mainCat = cats[0];
  const allCatsFn = typeof getAllCats === 'function' ? getAllCats() : CAT;
  const cfg = allCatsFn[mainCat] || {label: (mainCat||'').toUpperCase()};

  const updated = {
    ...POIS[idx], name,
    category:      mainCat,
    categories:    cats,
    categoryLabel: cfg.label,
    icon:          editEmoji,
    lat, lng,
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
    soc:       document.getElementById('e-soc').value.split(',').map(s=>s.trim()).filter(Boolean),
    tags:      document.getElementById('e-tags').value.split(',').map(s=>s.trim()).filter(Boolean),
    phone:     (document.getElementById('e-phone')||{value:''}).value.trim(),
    hours:     (document.getElementById('e-hours')||{value:''}).value.trim(),
  };

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
function saveNew() {
  const name = document.getElementById('a-name').value.trim();
  const cats = (typeof getSelectedCats === 'function') ? getSelectedCats('cat-chips-add') : [];
  const lat  = parseFloat(document.getElementById('a-lat').value);
  const lng  = parseFloat(document.getElementById('a-lng').value);
  const address = document.getElementById('a-address')?.value.trim() || '';

  if (!name)             { toast('⚠️ Ingresá el nombre del lugar'); return; }
  if (!cats.length)      { toast('⚠️ Seleccioná al menos una categoría'); return; }
  if (isNaN(lat)||isNaN(lng)) { toast('⚠️ Falta la ubicación en el mapa'); return; }

  const mainCat = cats[0];
  const allCatsFn = typeof getAllCats === 'function' ? getAllCats() : CAT;
  const cfg = allCatsFn[mainCat] || {label: (mainCat||'').toUpperCase()};

  const p = {
    id: nextId++, name,
    category: mainCat, categories: cats, categoryLabel: cfg.label,
    icon: addEmoji, lat, lng, address,
    imgB64:  window._addImgB64  || null,
    imgAlt1: window._addImgAlt1 || null,
    imgAlt2: window._addImgAlt2 || null,
    imgAlt3: window._addImgAlt3 || null,
    pinScale: 100, pinOffsetX: 0, pinOffsetY: 0,
    desc:  document.getElementById('a-desc').value.trim(),
    hist:  document.getElementById('a-hist').value.trim() || 'Sin datos históricos.',
    soc:   document.getElementById('a-soc').value.split(',').map(s=>s.trim()).filter(Boolean),
    tags:  document.getElementById('a-tags').value.split(',').map(s=>s.trim()).filter(Boolean),
    phone: (document.getElementById('a-phone')||{value:''}).value.trim(),
    hours: (document.getElementById('a-hours')||{value:''}).value.trim(),
    events: [], iconCyber:'🔵', iconWinter:'❄️', iconZombie:'☣️',
    active: true,
  };

  // Aplicar campos compartidos del grupo si aplica
  if (p.groupId) applyGroupFields(p);

  POIS.push(p);
  makeMarker(p);

  ['a-name','a-desc','a-hist','a-soc','a-lat','a-lng','a-phone','a-hours','a-tags'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  const addrEl = document.getElementById('a-address'); if (addrEl) addrEl.value = '';
  document.querySelectorAll('#eg-add .eopt').forEach(e => e.classList.remove('sel'));
  const defE = document.querySelector('#eg-add [data-e="📍"]'); if (defE) defE.classList.add('sel');
  addEmoji = '📍';
  document.getElementById('img-prev-add').innerHTML = '🏙️';
  document.getElementById('img-lbl-add').textContent = 'Subir imagen del edificio';
  document.getElementById('iu-add').classList.remove('has-img');
  window._addImgB64 = null; window._addImgAlt1 = null; window._addImgAlt2 = null; window._addImgAlt3 = null;
  if (typeof buildMultiCatSelector === 'function') buildMultiCatSelector('cat-chips-add', []);
  syncAddCoordDisplay();
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
