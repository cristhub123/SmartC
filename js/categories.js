/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/* categories.js — dynamic category system */
/* ═══════════════════════════════════════════════════════════
   CATEGORÍAS — sistema dinámico
   ═══════════════════════════════════════════════════════════ */
let CUSTOM_CATS = {};

// Offset / espaciado horizontal constante para desplazamientos
const POS_OFFSET_X = 78;

/* [Etapa A, PLAN_CATEGORIAS_SUBCATEGORIAS.md] `cat.label` ahora es un
   objeto multi-idioma ({es,en,pt}) — esta función es la ÚNICA forma
   correcta de leerlo como string (no reimplementar este fallback en
   otro archivo, ver sección 9/10 del plan). Mismo criterio que
   AppState.getContent(): si falta el idioma pedido, fallback completo
   a español. Acepta también el shape legado (label string plano) para
   no romper categorías guardadas antes de esta migración. */
function getCatLabel(cat, lang) {
  if (!cat) return '';
  const label = cat.label;
  if (typeof label === 'string') return label; // shape legado
  if (!label || typeof label !== 'object') return '';
  const resolvedLang = lang || (typeof AppState !== 'undefined' ? AppState.getLanguage() : 'es');
  return label[resolvedLang] || label.es || Object.values(label).find(Boolean) || '';
}
window.getCatLabel = getCatLabel;

/* [Etapa B, PLAN_CATEGORIAS_SUBCATEGORIAS.md] Los 3 idiomas reales
   hoy son ES/EN/PT (mismos que js/lang-switcher.js) — agregar más
   idiomas queda fuera de alcance de este plan (sección 1). El
   candado de `languageFieldsCount` (sección 3.3) queda preparado
   para el día que se sumen más, pero mientras LANG_CODES tenga 3
   elementos, subir ese número no agrega más campos todavía. */
const LANG_CODES = ['es', 'en', 'pt'];
const LANG_NAMES = { es: 'ES', en: 'EN', pt: 'PT' };

/* Devuelve la categoría/subcategoría REAL (no la copia que arma
   getAllCats()) para poder mutarla — CAT o CUSTOM_CATS, según
   corresponda. Única forma de resolver "dónde vive de verdad este
   id" (sección 7 del plan, AI_RULES sección 7). */
function _getCatRef(id) {
  return CAT[id] || CUSTOM_CATS[id] || null;
}

/* Mismo criterio de generación de id que ya usaba el alta de
   categorías custom ('cat_' + nombre_slugificado + '_' + timestamp),
   ahora factorizado para reusarlo también con subcategorías (sección
   3.2 del plan — "reusar esa función, no reimplementar una nueva"). */
function _genCatSlugId(prefix, name) {
  return prefix + '_' + name.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') + '_' + Date.now().toString(36);
}

/* [Etapa B] Qué categorías tienen su editor de idiomas o su sub-lista
   de subcategorías desplegados — se preserva entre renders para que
   activar/desactivar/agregar/eliminar (que vuelven a pintar toda la
   lista) no cierre de golpe lo que el admin tenía abierto. */
const _catsUIState = { openLang: new Set(), openSub: new Set(), openIconEdit: new Set() };

function getAllCats() {
  const result = {};
  Object.entries(CAT).forEach(([k,v]) => { result[k] = {...v, builtin:true, active: v.active !== false}; });
  Object.entries(CUSTOM_CATS).forEach(([k,v]) => { result[k] = {...v, builtin:false}; });
  return result;
}

/* [Etapa B, PLAN_CATEGORIAS_SUBCATEGORIAS.md] Bloque de idiomas
   reusado tanto para una categoría de primer nivel como para una
   subcategoría — `target.label` es el mismo shape en ambas (sección
   3.1/3.2 del plan: una sola fuente de verdad para "qué es una
   categoría"). `catId`/`subId` viajan en data-attrs para que el
   listener delegado (`_wireCatsLangInputs`) sepa dónde guardar. */
function _langEditorHTML(catId, subId, label) {
  const key = subId ? `${catId}::${subId}` : catId;
  const open = _catsUIState.openLang.has(key);
  const secondaryCodes = LANG_CODES.filter(c => c !== 'es');
  return `<details class="cats-lang-details" data-lang-key="${key}" ${open?'open':''} style="margin-top:6px">
    <summary style="cursor:pointer;font-size:13px;color:var(--text3);font-weight:600">🌐 Inglés / Portugués</summary>
    <div style="display:flex;flex-direction:column;gap:4px;margin:6px 0 2px;padding-left:4px">
      ${secondaryCodes.map(code => `
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:12px;color:var(--text3);width:26px;flex-shrink:0;font-weight:700">${LANG_NAMES[code]}</span>
          <input type="text" class="fi" style="flex:1;font-size:14px;padding:4px 8px"
            value="${_escAttr((label && label[code]) || '')}"
            data-lang-input data-cat="${catId}" ${subId?`data-subcat="${subId}"`:''} data-lang="${code}">
        </div>`).join('')}
    </div>
  </details>`;
}

function renderCatsAdmin() {
  const list = document.getElementById('cats-admin-list');
  if (!list) return;
  const all = getAllCats();
  list.innerHTML = Object.entries(all).map(([id, cat]) => {
    const isOn = cat.active !== false;
    const count = POIS.filter(p => {
      const cs = Array.isArray(p.categories) ? p.categories : [p.category];
      return cs.includes(id);
    }).length;
    const subs = cat.subcategories && typeof cat.subcategories === 'object' ? cat.subcategories : {};
    const subEntries = Object.entries(subs);
    const subsOpen = _catsUIState.openSub.has(id);
    
    const subsHTML = subEntries.map(([subId, sub]) => {
      const subOn = sub.active !== false;
      return `<div class="za-row" style="padding-left:20px;${subOn?'':'opacity:.55'}">
        <input type="text" class="fi" style="flex:1;min-width:0;font-size:14px;padding:5px 10px"
          value="${_escAttr(getCatLabel(sub,'es'))}" data-name-input data-cat="${id}" data-subcat="${subId}">
        <button class="za-edit-btn" onclick="deleteSubcat('${id}','${subId}')" title="Eliminar">🗑</button>
        <button class="za-toggle ${subOn?'on':''}" onclick="toggleSubcat('${id}','${subId}',this)" title="${subOn?'Desactivar':'Activar'}"></button>
      </div>
      <div style="padding-left:20px">${_langEditorHTML(id, subId, sub.label)}</div>`;
    }).join('');
    const iconEditOpen = _catsUIState.openIconEdit.has(id);
    return `<div class="za-row" style="flex-wrap:wrap;${isOn?'':'opacity:.55'}">
      <span style="font-size:18px;flex-shrink:0">${cat.icon||'🏷'}</span>
      <input type="text" class="fi" style="flex:1;min-width:120px;font-size:14px;font-weight:600;padding:5px 10px;color:${cat.color}"
        value="${_escAttr(getCatLabel(cat,'es'))}" data-name-input data-cat="${id}">
      <small style="color:var(--text3);font-size:13px;flex-shrink:0">(${count})</small>
      ${cat.builtin?'<span style="font-size:11px;color:var(--text3);font-family:var(--font-m);flex-shrink:0">BASE</span>':`<button class="za-edit-btn" onclick="deleteCat('${id}')" title="Eliminar">🗑</button>`}
      <button class="za-toggle ${isOn?'on':''}" onclick="toggleCat('${id}',this)" title="${isOn?'Desactivar':'Activar'}"></button>
      <div style="flex-basis:100%">${_langEditorHTML(id, null, cat.label)}</div>
      <details class="cats-icon-details" data-icon-key="${id}" ${iconEditOpen?'open':''} style="flex-basis:100%;margin-top:2px">
        <summary style="cursor:pointer;font-size:13px;color:var(--text3);font-weight:600">✏️ Ícono y color</summary>
        <div style="display:flex;gap:10px;align-items:center;margin:6px 0 2px;padding-left:4px">
          <input type="text" class="fi" maxlength="4" style="width:56px;font-size:18px;text-align:center;padding:4px"
            value="${_escAttr(cat.icon||'')}" data-icon-input data-cat="${id}">
          <input type="color" style="width:40px;height:34px;border:1.5px solid var(--border);border-radius:6px;padding:2px;cursor:pointer"
            value="${cat.color||'#2563eb'}" data-color-input data-cat="${id}">
        </div>
      </details>
      <details class="cats-subcats-details" data-subcat-key="${id}" ${subsOpen?'open':''} style="flex-basis:100%;margin-top:4px">
        <summary style="cursor:pointer;font-size:13px;color:var(--text3);font-weight:600">📂 Subcategorías (${subEntries.length})</summary>
        <div style="margin-top:6px">${subsHTML}</div>
        <div style="display:flex;gap:6px;margin-top:6px;padding-left:20px;align-items:stretch">
          <input type="text" class="fi" data-subcat-name-input="${id}" placeholder="Nueva subcategoría..." style="flex:1;min-width:0;font-size:14px;padding:6px 8px">
          <button type="button" class="btn-outline" style="width:auto;flex:0 0 auto;margin-top:0;padding:6px 12px;font-size:14px;white-space:nowrap" onclick="addSubcat('${id}')">+ Agregar</button>
        </div>
      </details>
    </div>`;
  }).join('');
  _wireCatsDetailsToggles(list);
}

function _wireCatsDetailsToggles(list) {
  list.querySelectorAll('.cats-lang-details').forEach(d => {
    d.addEventListener('toggle', () => {
      const key = d.dataset.langKey;
      if (d.open) _catsUIState.openLang.add(key); else _catsUIState.openLang.delete(key);
    });
  });
  list.querySelectorAll('.cats-subcats-details').forEach(d => {
    d.addEventListener('toggle', () => {
      const key = d.dataset.subcatKey;
      if (d.open) _catsUIState.openSub.add(key); else _catsUIState.openSub.delete(key);
    });
  });
  list.querySelectorAll('.cats-icon-details').forEach(d => {
    d.addEventListener('toggle', () => {
      const key = d.dataset.iconKey;
      if (d.open) _catsUIState.openIconEdit.add(key); else _catsUIState.openIconEdit.delete(key);
    });
  });
}

(function _wireCatsLangInputs() {
  const list = document.getElementById('cats-admin-list');
  if (!list) return;
  list.addEventListener('change', (e) => {
    const inp = e.target.closest('[data-lang-input]');
    if (!inp) return;
    const catId = inp.dataset.cat;
    const subId = inp.dataset.subcat || null;
    const lang  = inp.dataset.lang;
    const cat = _getCatRef(catId);
    if (!cat) return;
    const target = subId ? (cat.subcategories && cat.subcategories[subId]) : cat;
    if (!target) return;
    if (!target.label || typeof target.label !== 'object') target.label = {};
    target.label[lang] = inp.value;
    if (typeof updateFilterBar === 'function') updateFilterBar();
    _markCatsDirty();
  });

  list.addEventListener('change', (e) => {
    const inp = e.target.closest('[data-name-input]');
    if (!inp) return;
    const catId = inp.dataset.cat;
    const subId = inp.dataset.subcat || null;
    const cat = _getCatRef(catId);
    if (!cat) return;
    const target = subId ? (cat.subcategories && cat.subcategories[subId]) : cat;
    if (!target) return;
    const val = inp.value.trim();
    if (!val) {
      toast('⚠️ El nombre no puede quedar vacío');
      inp.value = getCatLabel(target, 'es');
      return;
    }
    if (!target.label || typeof target.label !== 'object') target.label = {};
    target.label.es = val;
    inp.value = val;
    if (typeof updateFilterBar === 'function') updateFilterBar();
    _markCatsDirty();
  });

  list.addEventListener('change', (e) => {
    const iconInp = e.target.closest('[data-icon-input]');
    const colorInp = e.target.closest('[data-color-input]');
    const inp = iconInp || colorInp;
    if (!inp) return;
    const catId = inp.dataset.cat;
    const cat = _getCatRef(catId);
    if (!cat) return;
    if (iconInp) cat.icon = iconInp.value;
    if (colorInp) cat.color = colorInp.value;
    renderCatsAdmin();
    if (typeof updateFilterBar === 'function') updateFilterBar();
    _markCatsDirty();
  });
})();

window.toggleCat = function(id, btn) {
  const all = getAllCats();
  const cat = all[id];
  if (!cat) return;
  const newState = !(cat.active !== false);
  if (CAT[id]) CAT[id].active = newState;
  if (CUSTOM_CATS[id]) CUSTOM_CATS[id].active = newState;
  btn.classList.toggle('on', newState);
  if (typeof applyAllPinVisibility === 'function') applyAllPinVisibility();
  if (typeof scheduleClusterRecompute === 'function') scheduleClusterRecompute();
  renderCatsAdmin();
  updateFilterBar();
  _markCatsDirty();
  toast(newState ? `✅ "${getCatLabel(cat)}" activada` : `⭕ "${getCatLabel(cat)}" desactivada`);
};

window.deleteCat = function(id) {
  if (!CUSTOM_CATS[id]) return;
  const name = getCatLabel(CUSTOM_CATS[id]);
  if (!confirm(`¿Eliminar la categoría "${name}"? Esta acción no se puede deshacer.`)) return;
  delete CUSTOM_CATS[id];
  renderCatsAdmin();
  updateFilterBar();
  _markCatsDirty();
  toast(`🗑 "${name}" eliminada`);
};

window.toggleSubcat = function(catId, subId, btn) {
  const cat = _getCatRef(catId);
  const sub = cat && cat.subcategories && cat.subcategories[subId];
  if (!sub) return;
  const newState = !(sub.active !== false);
  sub.active = newState;
  btn.classList.toggle('on', newState);
  _markCatsDirty();
  toast(newState ? `✅ "${getCatLabel(sub)}" activada` : `⭕ "${getCatLabel(sub)}" desactivada`);
};

window.deleteSubcat = function(catId, subId) {
  const cat = _getCatRef(catId);
  if (!cat || !cat.subcategories || !cat.subcategories[subId]) return;
  const name = getCatLabel(cat.subcategories[subId]);
  if (!confirm(`¿Eliminar la subcategoría "${name}"? Esta acción no se puede deshacer.`)) return;
  delete cat.subcategories[subId];
  renderCatsAdmin();
  _markCatsDirty();
  toast(`🗑 "${name}" eliminada`);
};

window.addSubcat = function(catId) {
  const cat = _getCatRef(catId);
  if (!cat) return;
  const input = document.querySelector(`[data-subcat-name-input="${catId}"]`);
  const name = (input && input.value || '').trim();
  if (!name) { toast('⚠️ Ingresá el nombre de la subcategoría'); return; }
  if (!cat.subcategories || typeof cat.subcategories !== 'object') cat.subcategories = {};
  const id = _genCatSlugId('subcat', name);
  cat.subcategories[id] = { label: {es:name.toUpperCase(), en:name.toUpperCase(), pt:name.toUpperCase()}, active: true };
  _catsUIState.openSub.add(catId);
  renderCatsAdmin();
  _markCatsDirty();
  toast(`✅ Subcategoría "${name}" creada`);
};

let _catsDirty = false;

function _markCatsDirty() {
  _catsDirty = true;
  const btn = document.getElementById('btn-save-cats');
  const warn = document.getElementById('cats-unsaved-warning');
  if (btn) { btn.textContent = '💾 Guardar cambios ●'; btn.style.opacity = '1'; }
  if (warn) warn.style.display = '';
}

function _clearCatsDirty() {
  _catsDirty = false;
  const btn = document.getElementById('btn-save-cats');
  const warn = document.getElementById('cats-unsaved-warning');
  if (btn) { btn.textContent = '💾 Guardar cambios'; }
  if (warn) warn.style.display = 'none';
}

window.addEventListener('beforeunload', (e) => {
  if (!_catsDirty) return;
  e.preventDefault();
  e.returnValue = '';
});

(function _wireCatsSaveButton() {
  const btn = document.getElementById('btn-save-cats');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (typeof saveCategoriesSettings !== 'function') return;
    btn.disabled = true;
    const ok = await saveCategoriesSettings();
    btn.disabled = false;
    if (ok) { _clearCatsDirty(); toast('✅ Cambios de categorías guardados'); }
  });
})();

if (window.SC && SC.registerTabPlugin) {
  SC.registerTabPlugin('cats', renderCatsAdmin);
  SC.registerTabPlugin('cats', _resetLangCountLock);
}

function getCatIcon(cat, id) {
  const key = cat.lucide || id;
  return LUCIDE[key] || LUCIDE.default;
}

function _attachFilterBarDragScroll(bar) {
  let isDragging = false, startX = 0, scrollLeft = 0, moved = false, _pid = null;
  bar.addEventListener('pointerdown', e => {
    isDragging = true; moved = false;
    startX = e.clientX;
    scrollLeft = bar.scrollLeft;
    _pid = e.pointerId;
  });
  bar.addEventListener('pointermove', e => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const threshold = e.pointerType === 'mouse' ? 15 : 6;
    if (Math.abs(dx) > threshold) {
      if (!moved) { moved = true; bar.setPointerCapture(_pid); }
      bar.scrollLeft = scrollLeft - dx;
    }
  });
  bar.addEventListener('pointerup', e => {
    isDragging = false;
    if (bar.hasPointerCapture(e.pointerId)) bar.releasePointerCapture(e.pointerId);
  });
  return { consumeDragFlag() { if (moved) { moved = false; return true; } return false; } };
}

function _catHasActiveSubcats(catId) {
  const cat = getAllCats()[catId];
  if (!cat || !cat.subcategories) return false;
  return Object.values(cat.subcategories).some(s => s.active !== false);
}

function updateFilterBar() {
  const bar = document.querySelector('.filter-row');
  if (!bar) return;
  const showSubRow = activeFilter !== 'all' && activeFilter !== '__eventos__' && _catHasActiveSubcats(activeFilter);
  if (showSubRow) _renderSubfilterRow(bar, activeFilter);
  else _renderMainFilterRow(bar);
}

function _renderMainFilterRow(bar) {
  const all = getAllCats();
  const activeCats = Object.entries(all).filter(([,v]) => v.active !== false);

  const allActive = activeFilter === 'all';
  let html = `<button class="fbtn ${allActive?'on':''}" data-f="all">
    <div class="fbtn-circle" style="background:#1c1c1e">${LUCIDE.all}</div>
    <span class="fbtn-label">Todo</span>
  </button>`;

  const eventosOn = activeFilter === '__eventos__';
  html += `<button class="fbtn ${eventosOn?'on':''}" data-f="__eventos__">
    <div class="fbtn-circle" style="background:#1c1c1e">🎉</div>
    <span class="fbtn-label">Eventos</span>
  </button>`;

  activeCats.forEach(([id, cat]) => {
    const isOn = activeFilter === id;
    const svg  = getCatIcon(cat, id);
    const labelStr = getCatLabel(cat);
    const label = labelStr.charAt(0).toUpperCase() + labelStr.slice(1).toLowerCase();
    html += `<button class="fbtn ${isOn?'on':''}" data-f="${id}">
      <div class="fbtn-circle" style="background:${cat.color}">${svg}</div>
      <span class="fbtn-label">${label}</span>
    </button>`;
  });

  bar.innerHTML = html;
  const drag = _attachFilterBarDragScroll(bar);

  bar.querySelectorAll('.fbtn').forEach(btn => {
    btn.addEventListener('click', e => {
      if (drag.consumeDragFlag()) return;
      const id = btn.dataset.f;
      if (id !== 'all' && id !== '__eventos__' && _catHasActiveSubcats(id)) {
        _animateOpenSubcatRow(bar, id, btn);
        return;
      }
      activeFilter = id;
      activeSubfilter = null;
      updateFilterBar();
      applyFilter();
      if (typeof window._onFilterBarUpdated === 'function') window._onFilterBarUpdated();
    });
  });

  if (typeof window._onFilterBarUpdated === 'function') window._onFilterBarUpdated();
}

function _renderSubfilterRow(bar, catId) {
  const cat = getAllCats()[catId];
  if (!cat) { activeFilter = 'all'; activeSubfilter = null; _renderMainFilterRow(bar); return; }
  const parentIcon = getCatIcon(cat, catId);
  const subs = Object.entries(cat.subcategories || {}).filter(([,s]) => s.active !== false);

  const catLabelStr = getCatLabel(cat);
  const catLabel = catLabelStr.charAt(0).toUpperCase() + catLabelStr.slice(1).toLowerCase();
  let html = `<button class="fbtn on selected-parent" data-f="${catId}">
    <div class="fbtn-circle" style="background:${cat.color}">${parentIcon}</div>
    <span class="fbtn-label">${catLabel}</span>
  </button>`;

  subs.forEach(([subId, sub]) => {
    const isOn = activeSubfilter === subId;
    const labelStr = getCatLabel(sub);
    const label = labelStr.charAt(0).toUpperCase() + labelStr.slice(1).toLowerCase();
    html += `<button class="fbtn sub-item ${isOn?'active on':''}" data-sf="${subId}">
      <div class="fbtn-circle" style="background:${cat.color}">${parentIcon}</div>
      <span class="fbtn-label">${label}</span>
    </button>`;
  });

  bar.innerHTML = html;
  const drag = _attachFilterBarDragScroll(bar);

  bar.querySelector('[data-f]').addEventListener('click', e => {
    if (drag.consumeDragFlag()) return;
    _animateCloseSubcatRow(bar, catId);
  });

  bar.querySelectorAll('[data-sf]').forEach(btn => {
    btn.addEventListener('click', e => {
      if (drag.consumeDragFlag()) return;
      const subId = btn.dataset.sf;
      activeSubfilter = (activeSubfilter === subId) ? null : subId;
      updateFilterBar();
      applyFilter();
      if (typeof window._onFilterBarUpdated === 'function') window._onFilterBarUpdated();
    });
  });

  if (typeof window._onFilterBarUpdated === 'function') window._onFilterBarUpdated();
}

/* Animaciones de entrada/salida coordinadas: 
   1) Stagger descendente de derecha a izquierda en ítcones no seleccionados
   2) Desplazamiento S-Curve hacia la posición inicial
   3) Despliegue ascendente de subcategorías de izquierda a derecha */
function _animateOpenSubcatRow(bar, catId, clickedBtn) {
  const cat = getAllCats()[catId];
  if (!cat) return;
  const mainBtns = Array.from(bar.querySelectorAll('.fbtn'));
  const others = mainBtns.filter(b => b !== clickedBtn);

  // Cascading descendente (Derecha a Izquierda)
  others.slice().reverse().forEach((btn, i) => {
    setTimeout(() => btn.classList.add('fbtn-exit-down', 'exit-down'), i * 40);
  });

  const exitDelay = others.length * 40 + 80;
  setTimeout(() => {
    activeFilter = catId;
    activeSubfilter = null;

    const beforeRect = clickedBtn.getBoundingClientRect();
    others.forEach(btn => btn.remove());

    const cleanBtn = clickedBtn.cloneNode(true);
    clickedBtn.replaceWith(cleanBtn);
    bar.prepend(cleanBtn);

    const afterRect = cleanBtn.getBoundingClientRect();
    _flipTransform(cleanBtn, beforeRect, afterRect);
    
    setTimeout(() => cleanBtn.classList.add('on', 'selected-parent'), 380);
    cleanBtn.addEventListener('click', () => _animateCloseSubcatRow(bar, catId));

    setTimeout(() => _appendAnimatedSubcats(bar, cat, catId), 140);

    applyFilter();
    if (typeof window._onFilterBarUpdated === 'function') window._onFilterBarUpdated();
  }, exitDelay);
}

function _animateCloseSubcatRow(bar, catId) {
  const catBtn = bar.querySelector(`[data-f="${catId}"]`);
  const subBtns = Array.from(bar.querySelectorAll('.sub-item'));

  subBtns.forEach((btn, i) => {
    setTimeout(() => {
      btn.classList.remove('enter-up', 'fbtn-entered', 'active');
      btn.classList.add('fbtn-exit-down', 'exit-down');
    }, i * 30);
  });

  const closeDelay = subBtns.length * 30 + 250;
  setTimeout(() => {
    subBtns.forEach(btn => btn.remove());
    activeFilter = 'all';
    activeSubfilter = null;
    _renderMainFilterRowAnimatedReturn(bar, catId, catBtn);
    applyFilter();
    if (typeof window._onFilterBarUpdated === 'function') window._onFilterBarUpdated();
  }, closeDelay);
}

function _appendAnimatedSubcats(bar, cat, catId) {
  const parentIcon = getCatIcon(cat, catId);
  const subs = Object.entries(cat.subcategories || {}).filter(([,s]) => s.active !== false);
  
  subs.forEach(([subId, sub], i) => {
    const subBtn = document.createElement('button');
    subBtn.className = 'fbtn sub-item fbtn-enter-up';
    subBtn.dataset.sf = subId;
    const labelStr = getCatLabel(sub);
    const label = labelStr.charAt(0).toUpperCase() + labelStr.slice(1).toLowerCase();
    
    subBtn.innerHTML = `<div class="fbtn-circle" style="background:${cat.color}">${parentIcon}</div><span class="fbtn-label">${label}</span>`;
    bar.appendChild(subBtn);
    
    requestAnimationFrame(() => {
      setTimeout(() => {
        subBtn.classList.add('fbtn-entered', 'enter-up');
      }, i * 60 + 20);
    });

    subBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const subId2 = subBtn.dataset.sf;
      activeSubfilter = (activeSubfilter === subId2) ? null : subId2;
      
      bar.querySelectorAll('.sub-item').forEach(el => el.classList.remove('active', 'on'));
      if (activeSubfilter) {
        subBtn.classList.add('active', 'on');
      }

      applyFilter();
      if (typeof window._onFilterBarUpdated === 'function') window._onFilterBarUpdated();
    });
  });
}

function _renderMainFilterRowAnimatedReturn(bar, catId, catBtn) {
  const beforeRect = catBtn ? catBtn.getBoundingClientRect() : null;
  _renderMainFilterRow(bar);

  const freshCatBtn = bar.querySelector(`[data-f="${catId}"]`);
  Array.from(bar.querySelectorAll('.fbtn')).forEach((btn, i) => {
    if (btn === freshCatBtn) return;
    btn.classList.add('fbtn-enter-up');
    setTimeout(() => btn.classList.add('fbtn-entered', 'enter-up'), i * 40 + 20);
  });

  if (freshCatBtn && beforeRect) {
    _flipTransform(freshCatBtn, beforeRect, freshCatBtn.getBoundingClientRect());
  }
}

function _flipTransform(el, beforeRect, afterRect) {
  const dx = beforeRect.left - afterRect.left;
  const dy = beforeRect.top - afterRect.top;
  if (!dx && !dy) return;
  el.style.transition = 'none';
  el.style.transform = `translate(${dx}px, ${dy}px)`;
  el.getBoundingClientRect();
  requestAnimationFrame(() => {
    el.style.transition = 'transform .45s cubic-bezier(.65,0,.35,1)';
    el.style.transform = '';
    el.addEventListener('transitionend', function _te(e) {
      if (e.propertyName !== 'transform') return;
      el.style.transition = '';
      el.removeEventListener('transitionend', _te);
    });
  });
}

function applyFilter() {
  if (typeof applyAllPinVisibility === 'function') applyAllPinVisibility();
  if (typeof scheduleClusterRecompute === 'function') scheduleClusterRecompute();
}

function _pinMatchesActiveFilter(p) {
  if (activeFilter === 'all') return true;
  if (activeFilter === '__eventos__') {
    return typeof EVENTOS !== 'undefined' && typeof _eventoEsVigente === 'function'
      && EVENTOS.some(ev => ev.poi_id === p.id && _eventoEsVigente(ev));
  }
  const cats = Array.isArray(p.categories) && p.categories.length ? p.categories : [p.category];
  if (!cats.includes(activeFilter)) return false;
  if (activeSubfilter === null) return true;
  const subs = Array.isArray(p.subcategories) ? p.subcategories : [];
  return subs.includes(activeSubfilter);
}

const _btnAddCat = document.getElementById('btn-add-cat');
if (_btnAddCat) {
  _btnAddCat.addEventListener('click', () => {
    const name  = document.getElementById('nc-name').value.trim();
    const icon  = document.getElementById('nc-icon').value.trim() || '🏷';
    const color = document.getElementById('nc-color').value;
    if (!name) { toast('⚠️ Ingresá el nombre'); return; }
    const id = 'cat_' + name.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') + '_' + Date.now().toString(36);
    CUSTOM_CATS[id] = {label:{es:name.toUpperCase(), en:name.toUpperCase(), pt:name.toUpperCase()}, icon, color, active:true, subcategories:{}};
    document.getElementById('nc-name').value = '';
    document.getElementById('nc-icon').value = '';
    renderCatsAdmin();
    updateFilterBar();
    _markCatsDirty();
    toast(`✅ Categoría "${name}" creada`);
  });
}

(function() {
  const s = document.createElement('style');
  s.textContent = `.cat-chip{display:inline-flex;align-items:center;gap:4px;padding:5px 11px;border-radius:99px;border:1.5px solid;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;background:transparent;font-family:var(--font-b);-webkit-tap-highlight-color:transparent;margin:3px}
  .cat-chip:hover{opacity:.85;transform:scale(1.04)}
  #cat-chips-add,#cat-chips-edit,#subcat-chips-add,#subcat-chips-edit{display:flex;flex-wrap:wrap;gap:2px;padding:8px 0 4px}
  .subcat-chip{font-size:11px;padding:4px 10px}
  #tp-cats{--text3:#2f5233}
  [data-skin="neobrutal-night"] #tp-cats{--text3:#d4d4d8}
  #tp-cats [style*="font-size:9px"]{font-size:11px!important}
  #tp-cats [style*="font-size:9.5px"]{font-size:11.5px!important}
  #tp-cats [style*="font-size:10px"]{font-size:12px!important}
  #tp-cats [style*="font-size:11px"]{font-size:13px!important}
  #tp-cats [style*="font-size:12px"]{font-size:14px!important}`;
  document.head.appendChild(s);
})();

function buildMultiCatSelector(containerId, selectedCats, selectedSubcats) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const all = getAllCats();
  const sel = new Set(selectedCats || []);
  container.innerHTML = Object.entries(all)
    .filter(([,v]) => v.active !== false)
    .map(([id,cat]) => {
      const on = sel.has(id);
      const labelStr = getCatLabel(cat);
      const label = labelStr.charAt(0)+labelStr.slice(1).toLowerCase();
      return `<button type="button" class="cat-chip ${on?'on':''}" data-cat="${id}"
        style="${on?`background:${cat.color};border-color:${cat.color};color:white`:`border-color:${cat.color}40;color:${cat.color}`}"
        onclick="toggleCatChip(this,'${id}','${containerId}')">
        ${label}
      </button>`;
    }).join('');
  _rebuildSubcatSelector(containerId, selectedSubcats || []);
}

function _findSubcatOwner(subId) {
  const all = getAllCats();
  for (const [catId, cat] of Object.entries(all)) {
    if (cat.subcategories && cat.subcategories[subId]) {
      return { catId, cat, sub: cat.subcategories[subId] };
    }
  }
  return null;
}

function _rebuildSubcatSelector(catContainerId, forceSelected) {
  const subContainerId = catContainerId.replace('cat-chips-', 'subcat-chips-');
  const subContainer = document.getElementById(subContainerId);
  if (!subContainer) return;

  const mainCatIds = getSelectedCats(catContainerId);
  const previouslyOn = forceSelected !== undefined
    ? new Set(forceSelected)
    : new Set(getSelectedSubcats(subContainerId));

  const all = getAllCats();
  const eligible = [];
  mainCatIds.forEach(catId => {
    const cat = all[catId];
    if (!cat || !cat.subcategories) return;
    Object.entries(cat.subcategories).forEach(([subId, sub]) => {
      if (sub.active === false) return;
      if (eligible.some(e => e.subId === subId)) return;
      eligible.push({ subId, sub, parentColor: cat.color });
    });
  });

  if (!eligible.length) {
    subContainer.innerHTML = mainCatIds.length
      ? ''
      : `<span style="font-size:13px;color:var(--text3)">Elegí una categoría para ver sus subcategorías</span>`;
    return;
  }

  subContainer.innerHTML = eligible.map(({subId, sub, parentColor}) => {
    const on = previouslyOn.has(subId);
    const labelStr = getCatLabel(sub);
    const label = labelStr.charAt(0)+labelStr.slice(1).toLowerCase();
    return `<button type="button" class="cat-chip subcat-chip ${on?'on':''}" data-subcat="${subId}"
      style="${on?`background:${parentColor};border-color:${parentColor};color:white`:`border-color:${parentColor}40;color:${parentColor}`}"
      onclick="toggleSubcatChip(this,'${subId}')">
      ${label}
    </button>`;
  }).join('');
}

window.toggleCatChip = function(btn, catId, containerId) {
  btn.classList.toggle('on');
  const cat = getAllCats()[catId];
  if (!cat) return;
  if (btn.classList.contains('on')) { btn.style.background=cat.color; btn.style.borderColor=cat.color; btn.style.color='white'; }
  else { btn.style.background=''; btn.style.borderColor=cat.color+'40'; btn.style.color=cat.color; }
  _rebuildSubcatSelector(containerId);
};

window.toggleSubcatChip = function(btn, subId) {
  btn.classList.toggle('on');
  const owner = _findSubcatOwner(subId);
  const color = owner ? owner.cat.color : '#666';
  if (btn.classList.contains('on')) { btn.style.background=color; btn.style.borderColor=color; btn.style.color='white'; }
  else { btn.style.background=''; btn.style.borderColor=color+'40'; btn.style.color=color; }
};

function getSelectedCats(containerId) {
  const c = document.getElementById(containerId);
  if (!c) return [];
  return Array.from(c.querySelectorAll('.cat-chip.on')).map(b => b.dataset.cat);
}

function getSelectedSubcats(containerId) {
  const c = document.getElementById(containerId);
  if (!c) return [];
  return Array.from(c.querySelectorAll('.subcat-chip.on')).map(b => b.dataset.subcat);
}

(function patchAddForm() {
  const fg = document.getElementById('a-cat')?.closest('.fg');
  if (!fg) return;
  fg.innerHTML = `<label class="fl">Categoría * (podés elegir más de una)</label><div id="cat-chips-add"></div>
    <label class="fl" style="margin-top:6px">Subcategoría (opcional)</label><div id="subcat-chips-add"></div>`;
  buildMultiCatSelector('cat-chips-add', []);
})();
(function patchEditForm() {
  const fg = document.getElementById('e-cat')?.closest('.fg');
  if (!fg) return;
  fg.innerHTML = `<label class="fl">Categoría (podés elegir más de una)</label><div id="cat-chips-edit"></div>
    <label class="fl" style="margin-top:6px">Subcategoría (opcional)</label><div id="subcat-chips-edit"></div>`;
})();

function _resetLangCountLock() {
  const inp   = document.getElementById('cats-lang-count');
  const lock1 = document.getElementById('cats-lang-count-lock1');
  const lock2 = document.getElementById('cats-lang-count-lock2');
  const warn  = document.getElementById('cats-lang-count-warning');
  if (inp)   { inp.value = languageFieldsCount; inp.disabled = true; inp.style.color = ''; inp.style.borderColor = ''; }
  if (lock1) lock1.checked = false;
  if (lock2) lock2.checked = false;
  if (warn)  warn.style.display = 'none';
}

function _applyLangCountLockState() {
  const inp   = document.getElementById('cats-lang-count');
  const lock1 = document.getElementById('cats-lang-count-lock1');
  const lock2 = document.getElementById('cats-lang-count-lock2');
  const warn  = document.getElementById('cats-lang-count-warning');
  if (!inp || !lock1 || !lock2) return;
  const unlocked = lock1.checked && lock2.checked;
  inp.disabled = !unlocked;
  inp.style.color = unlocked ? '#ef4444' : '';
  inp.style.borderColor = unlocked ? '#ef4444' : '';
  if (warn) warn.style.display = unlocked ? '' : 'none';
  if (!unlocked) inp.value = languageFieldsCount;
}

(function _wireLangCountLock() {
  const inp   = document.getElementById('cats-lang-count');
  const lock1 = document.getElementById('cats-lang-count-lock1');
  const lock2 = document.getElementById('cats-lang-count-lock2');
  if (lock1) lock1.addEventListener('change', _applyLangCountLockState);
  if (lock2) lock2.addEventListener('change', _applyLangCountLockState);
  if (inp) inp.addEventListener('change', () => {
    let v = parseInt(inp.value, 10);
    if (!Number.isFinite(v) || v < 3) v = 3;
    inp.value = v;
    languageFieldsCount = v;
    _markCatsDirty();
    toast(`✅ Cantidad de campos de idioma: ${v} (no olvides "Guardar cambios")`);
  });
})();

document.querySelectorAll('.color-preset').forEach(el => {
  el.addEventListener('click', () => {
    const target = el.dataset.target, c = el.dataset.c;
    if (target === 'solid')   { globalSettings.solidColor=c; document.getElementById('g-solid-color').value=c; document.getElementById('g-solid-hex').value=c; updateGPreview(); }
    else if (target==='glow') { globalSettings.glowColor=c;  document.getElementById('g-glow-color').value=c;  document.getElementById('g-glow-hex').value=c;  updateGPreview(); }
    else if (target==='eyeglow') { globalSettings.eyeGlowColor=c; document.getElementById('g-eye-glow-color').value=c; applyEyeGlowColor(); }
    else if (target==='shadow')  { globalSettings.shadowColor=c; const sp=document.getElementById('g-shadow-color'); if(sp) sp.value=c; applyShadow(); }
    else if (target==='newcat')  { document.getElementById('nc-color').value=c; }
  });
});