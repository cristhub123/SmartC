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
  return `<details class="cats-lang-details" data-lang-key="${key}" ${open?'open':''} style="margin-top:6px">
    <summary style="cursor:pointer;font-size:11px;color:var(--text3)">🌐 Idiomas</summary>
    <div style="display:flex;flex-direction:column;gap:4px;margin:6px 0 2px;padding-left:4px">
      ${LANG_CODES.map(code => `
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:10px;color:var(--text3);width:22px;flex-shrink:0">${LANG_NAMES[code]}</span>
          <input type="text" class="fi" style="flex:1;font-size:12px;padding:4px 8px"
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
    // [Etapa B] La sub-lista de subcategorías: cada una con su propio
    // toggle activo/inactivo (mismo patrón .za-toggle) y su propio
    // editor de idiomas. Sin contador de pines todavía — poi.
    // subcategories no existe hasta la Etapa C, mostrar (0) siempre
    // sería engañoso.
    const subsHTML = subEntries.map(([subId, sub]) => {
      const subOn = sub.active !== false;
      return `<div class="za-row" style="padding-left:20px;${subOn?'':'opacity:.55'}">
        <span class="za-name" style="font-size:12px" data-row-label="${id}::${subId}">${getCatLabel(sub)}</span>
        <button class="za-edit-btn" onclick="deleteSubcat('${id}','${subId}')" title="Eliminar">🗑</button>
        <button class="za-toggle ${subOn?'on':''}" onclick="toggleSubcat('${id}','${subId}',this)" title="${subOn?'Desactivar':'Activar'}"></button>
      </div>
      <div style="padding-left:20px">${_langEditorHTML(id, subId, sub.label)}</div>`;
    }).join('');
    const iconEditOpen = _catsUIState.openIconEdit.has(id);
    return `<div class="za-row" style="flex-wrap:wrap;${isOn?'':'opacity:.55'}">
      <span style="font-size:18px;flex-shrink:0">${cat.icon||'🏷'}</span>
      <span class="za-name" style="color:${cat.color}"><span data-row-label="${id}">${getCatLabel(cat)}</span> <small style="color:var(--text3);font-size:10px">(${count})</small></span>
      ${cat.builtin?'<span style="font-size:9px;color:var(--text3);font-family:var(--font-m)">BASE</span>':`<button class="za-edit-btn" onclick="deleteCat('${id}')" title="Eliminar">🗑</button>`}
      <button class="za-toggle ${isOn?'on':''}" onclick="toggleCat('${id}',this)" title="${isOn?'Desactivar':'Activar'}"></button>
      <div style="flex-basis:100%">${_langEditorHTML(id, null, cat.label)}</div>
      <details class="cats-icon-details" data-icon-key="${id}" ${iconEditOpen?'open':''} style="flex-basis:100%;margin-top:2px">
        <summary style="cursor:pointer;font-size:11px;color:var(--text3)">✏️ Ícono y color</summary>
        <div style="display:flex;gap:10px;align-items:center;margin:6px 0 2px;padding-left:4px">
          <input type="text" class="fi" maxlength="4" style="width:56px;font-size:18px;text-align:center;padding:4px"
            value="${_escAttr(cat.icon||'')}" data-icon-input data-cat="${id}">
          <input type="color" style="width:40px;height:34px;border:1.5px solid var(--border);border-radius:6px;padding:2px;cursor:pointer"
            value="${cat.color||'#2563eb'}" data-color-input data-cat="${id}">
        </div>
      </details>
      <details class="cats-subcats-details" data-subcat-key="${id}" ${subsOpen?'open':''} style="flex-basis:100%;margin-top:4px">
        <summary style="cursor:pointer;font-size:11px;color:var(--text3)">📂 Subcategorías (${subEntries.length})</summary>
        <div style="margin-top:6px">${subsHTML}</div>
        <div style="display:flex;gap:6px;margin-top:6px;padding-left:20px;align-items:stretch">
          <input type="text" class="fi" data-subcat-name-input="${id}" placeholder="Nueva subcategoría..." style="flex:1;min-width:0;font-size:12px;padding:6px 8px">
          <button type="button" class="btn-outline" style="width:auto;flex:0 0 auto;margin-top:0;padding:6px 12px;font-size:12px;white-space:nowrap" onclick="addSubcat('${id}')">+ Agregar</button>
        </div>
      </details>
    </div>`;
  }).join('');
  _wireCatsDetailsToggles(list);
}

/* Guarda en _catsUIState qué <details> quedan abiertos, para que el
   próximo renderCatsAdmin() (disparado por togglear/agregar/eliminar)
   no los cierre de golpe — se re-attachea en cada render porque
   list.innerHTML destruye los nodos anteriores. */
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

/* [Etapa B] Guardado de los campos de idioma — delegado en el
   contenedor (sobrevive a que renderCatsAdmin() reemplace el
   innerHTML) para no tener que re-atachear un listener por input.
   A propósito NO llama a renderCatsAdmin() en cada tecla/cambio —
   eso colapsaría el <details> que el admin tiene abierto justo
   mientras está escribiendo; solo actualiza el nombre visible de esa
   fila puntual (data-row-label) y la barra de filtros pública. */
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
    const rowKey = subId ? `${catId}::${subId}` : catId;
    const rowLabelEl = list.querySelector(`[data-row-label="${rowKey}"]`);
    if (rowLabelEl) rowLabelEl.textContent = getCatLabel(target);
    if (typeof updateFilterBar === 'function') updateFilterBar();
    _markCatsDirty();
  });

  /* [FIX solicitado por Cris — 2026-09-06] antes el ícono/color solo se
     podían fijar al crear la categoría, sin forma de corregirlos
     después — mismo problema de fondo que el nombre antes del
     editor de idiomas. Icono/color son solo de categorías de primer
     nivel (las subcategorías no tienen, ver sección 3.1 del plan). */
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
    renderCatsAdmin(); // el emoji/color grande de la fila necesita repintarse
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
  // [FIX 2026-09-03] Antes acá se ocultaba/mostraba el pin ENTERO
  // apenas SU categoría se apagaba/prendía, sin mirar si el pin tenía
  // OTRA categoría todavía activa — un pin con 2+ categorías podía
  // quedar oculto de más, y el resultado dependía del orden en que se
  // tocaran los toggles. applyAllPinVisibility() (js/pin-visibility.js)
  // recalcula TODOS los pines desde cero usando isPinVisible(), que sí
  // pide "al menos 1 categoría activa" — resuelve ese caso de paso.
  if (typeof applyAllPinVisibility === 'function') applyAllPinVisibility();
  // El set de pines visibles acaba de cambiar — recalcular clusters.
  if (typeof scheduleClusterRecompute === 'function') scheduleClusterRecompute();
  renderCatsAdmin();
  updateFilterBar();
  // [FIX solicitado por Cris — 2026-09-06] antes esto se guardaba en
  // Firestore al toque de cada click — un error acá (o cualquier otro
  // cambio de esta pestaña) quedaba visible para cualquiera que
  // cargue la página, sin forma de arrepentirse. Ahora TODO cambio de
  // la pestaña Categorías (este toggle incluido) queda solo en
  // memoria hasta que se aprieta "💾 Guardar cambios" al final de la
  // pestaña — ver _markCatsDirty()/btn-save-cats más abajo.
  _markCatsDirty();
  toast(newState ? `✅ "${getCatLabel(cat)}" activada` : `⭕ "${getCatLabel(cat)}" desactivada`);
};

window.deleteCat = function(id) {
  if (!CUSTOM_CATS[id]) return;
  const name = getCatLabel(CUSTOM_CATS[id]);
  // [FIX solicitado por Cris — 2026-09-06] antes borraba directo, sin
  // ninguna confirmación — un click de más borraba la categoría sin
  // vuelta atrás. Un solo botón + confirm() (mismo patrón que ya usa
  // el borrado de eventos, js/eventos.js) en vez de un candado de
  // checkboxes: 1 click, 1 pregunta, se entiende al toque.
  if (!confirm(`¿Eliminar la categoría "${name}"? Esta acción no se puede deshacer.`)) return;
  delete CUSTOM_CATS[id];
  renderCatsAdmin();
  updateFilterBar();
  _markCatsDirty();
  toast(`🗑 "${name}" eliminada`);
};

/* [Etapa B, PLAN_CATEGORIAS_SUBCATEGORIAS.md] CRUD de subcategorías.
   Mismo patrón que toggleCat/deleteCat de arriba, un nivel más
   adentro (cat.subcategories[subId] en vez de CAT[id]/CUSTOM_CATS[id]
   directo). No tocan applyAllPinVisibility/scheduleClusterRecompute
   ni updateFilterBar todavía: hasta que exista poi.subcategories y el
   filtrado por subcategoría (Etapa C/D), una subcategoría activa o
   inactiva no cambia qué pin se ve en el mapa. */
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
  // Misma estructura que una categoría de primer nivel recién creada
  // (sección 3.1/3.2 del plan): label multi-idioma con el mismo texto
  // en los 3 (todavía sin distinguir por idioma) + activa por defecto.
  cat.subcategories[id] = { label: {es:name.toUpperCase(), en:name.toUpperCase(), pt:name.toUpperCase()}, active: true };
  _catsUIState.openSub.add(catId); // no colapsar la sub-lista que se acaba de usar
  renderCatsAdmin();
  _markCatsDirty();
  toast(`✅ Subcategoría "${name}" creada`);
};

/* ═══════════════════════════════════════════════════════════
   [FIX solicitado por Cris — 2026-09-06] Guardado manual de TODA la
   pestaña Categorías. Antes cada acción (activar/desactivar, borrar,
   editar idioma/ícono/color, crear categoría o subcategoría, cambiar
   la cantidad de campos de idioma) escribía en Firestore al toque —
   un click de más quedaba visible para cualquiera que cargue la
   página, sin forma de arrepentirse. Mismo patrón que ya usa la
   pestaña "Apariencia global" (js/admin-global.js, botón
   btn-apply-global): todo cambio de esta pestaña queda SOLO en
   memoria del navegador (CAT/CUSTOM_CATS/languageFieldsCount) hasta
   que se aprieta "💾 Guardar cambios" al final de la pestaña — recién
   ahí se persiste en Firestore. Si se recarga la página sin guardar,
   lo no guardado se pierde (a propósito: es la forma de "deshacer"
   un error antes de que sea visible para el resto).
   ═══════════════════════════════════════════════════════════ */
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

(function _wireCatsSaveButton() {
  const btn = document.getElementById('btn-save-cats');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (typeof saveCategoriesSettings !== 'function') return;
    btn.disabled = true;
    const ok = await saveCategoriesSettings();
    btn.disabled = false;
    if (ok) { _clearCatsDirty(); toast('✅ Cambios de categorías guardados'); }
    // si ok es false, saveCategoriesSettings() ya mostró su propio
    // toast de error (ver js/settings-sync.js) — no duplicar el aviso.
  });
})();

// [FIX 2026-09-06] Antes renderCatsAdmin() solo se llamaba desde
// toggleCat/deleteCat/btn-add-cat — nunca al ABRIR el tab "cats" del
// admin. Resultado: #cats-admin-list arrancaba vacío y la única forma
// de ver las opciones (activar/desactivar, eliminar) de las
// categorías YA EXISTENTES era crear una categoría nueva primero,
// porque ese era el único code path que disparaba el render. Usamos
// el mecanismo ya existente de admin.js (SC.registerTabPlugin, ver
// js/config.js) en vez de tocar switchTab() a mano.
if (window.SC && SC.registerTabPlugin) {
  SC.registerTabPlugin('cats', renderCatsAdmin);
  SC.registerTabPlugin('cats', _resetLangCountLock);
}

function getCatIcon(cat, id) {
  const key = cat.lucide || id;
  return LUCIDE[key] || LUCIDE.default;
}

function updateFilterBar() {
  const bar = document.querySelector('.filter-row');
  if (!bar) return;
  const all = getAllCats();
  const activeCats = Object.entries(all).filter(([,v]) => v.active !== false);

  const allActive = activeFilter === 'all';
  let html = `<button class="fbtn ${allActive?'on':''}" data-f="all">
    <div class="fbtn-circle">${LUCIDE.all}</div>
    <span class="fbtn-label">Todo</span>
  </button>`;

  // [Etapa 5] Filtro especial "Eventos y actividades" — junto a los
  // de categoría, pero NO es una categoría real (no vive en
  // CAT/CUSTOM_CATS): muestra cualquier pin (evento_temporal o no)
  // con ≥1 evento vigente ahora mismo. Ver _pinMatchesActiveFilter().
  const eventosOn = activeFilter === '__eventos__';
  html += `<button class="fbtn ${eventosOn?'on':''}" data-f="__eventos__">
    <div class="fbtn-circle">🎉</div>
    <span class="fbtn-label">Eventos</span>
  </button>`;

  // [Actualización estética 2026-09-06] cat.color ya NO se usa acá
  // para pintar el círculo (ver nota en css/base.css) — se sigue
  // usando en el resto de la app (pines, admin, chips de categoría).
  activeCats.forEach(([id, cat]) => {
    const isOn = activeFilter === id;
    const svg  = getCatIcon(cat, id);
    const labelStr = getCatLabel(cat);
    const label = labelStr.charAt(0).toUpperCase() + labelStr.slice(1).toLowerCase();
    html += `<button class="fbtn ${isOn?'on':''}" data-f="${id}">
      <div class="fbtn-circle">${svg}</div>
      <span class="fbtn-label">${label}</span>
    </button>`;
  });

  bar.innerHTML = html;

  /* ── drag-to-scroll ──
     [FIX 2026-09-04 — causa real de "los filtros no hacen nada en
     PC, sí en el celular"] `bar.setPointerCapture(e.pointerId)` se
     llamaba en el `pointerdown`, es decir, en CUALQUIER toque —
     incluido un simple click sin arrastre. Es un bug conocido y
     documentado de esta API (afecta sobre todo a mouse/desktop,
     varía entre navegadores): una vez que el contenedor captura el
     puntero, el click posterior puede terminar dirigido al
     CONTENEDOR (`bar`) en vez del botón que el usuario realmente
     tocó — y como el listener de click vive en cada botón
     (`.fbtn`), ese click nunca le llega, aunque visualmente se vea
     el "apretado" nativo del botón (eso es CSS del navegador, no
     depende de JS). En el celular no se notaba porque el touch
     suele tolerar mejor este caso.
     Fix real (no un parche puntual — es el patrón correcto y
     documentado para "arrastre que no debe romper el click"):
     capturar el puntero recién cuando se CONFIRMA que es un
     arrastre real (se cruza el umbral), nunca en el pointerdown. Un
     click sin arrastre nunca llega a capturar nada, así que el
     click llega íntegro al botón como corresponde. */
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
    // Umbral más alto para mouse (el pulso de la mano mueve unos pocos px
    // incluso en un simple click) — con touch/dedo el temblor es mínimo.
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

  /* ── tap to filter (only if not a drag) ── */
  bar.querySelectorAll('.fbtn').forEach(btn => {
    btn.addEventListener('click', e => {
      if (moved) { moved = false; return; }
      bar.querySelectorAll('.fbtn').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      activeFilter = btn.dataset.f;
      applyFilter();
      // [Filtro de fecha de eventos, 2026-09-03] muestra/oculta y
      // wirea la barra de fecha según el filtro que quedó activo —
      // ver js/eventos-fecha-filtro.js.
      if (typeof window._onFilterBarUpdated === 'function') window._onFilterBarUpdated();
    });
  });

  // Misma llamada al pintar la barra la primera vez (carga inicial),
  // no solo en cada click.
  if (typeof window._onFilterBarUpdated === 'function') window._onFilterBarUpdated();
}

/* ═══════════════════════════════════════════════════════════
   [Etapa 5, PLAN_USUARIOS_EVENTOS.md] FILTRO DEL MAPA — implementación
   real de applyFilter()
   ---------------------------------------------------------------
   Esta función se llamaba desde acá mismo (líneas de arriba),
   pin-adjust.js, pin-geocode.js y data-io.js, pero nunca existía en
   ningún archivo del proyecto — tocar un filtro de categoría en el
   mapa público no filtraba nada (bug de fondo, ya existente antes
   de esta etapa; se encontró al construir el filtro nuevo de
   eventos y se aprovechó para dejarlo andando de verdad).
   [FIX 2026-09-03, PLAN_VISIBILIDAD_PINES_UNIFICADA.md] Ahora delega
   TODA la decisión y la aplicación a applyAllPinVisibility()
   (js/pin-visibility.js) — antes tenía su propia copia de la lógica
   de mostrar/ocultar, separada de la que usaba el sistema de
   clusters, que por eso nunca se enteraba de este filtro.
   ═══════════════════════════════════════════════════════════ */
function applyFilter() {
  if (typeof applyAllPinVisibility === 'function') applyAllPinVisibility();
  // Recalcular clusters: el set de pines visibles acaba de cambiar.
  if (typeof scheduleClusterRecompute === 'function') scheduleClusterRecompute();
}

/** Además de "all" y las categorías normales, `activeFilter` puede
 *  valer `'__eventos__'` — el filtro especial "Eventos y
 *  actividades" agregado en la Etapa 5 (ver updateFilterBar arriba)
 *  — que matchea cualquier pin (evento_temporal o no) con al menos
 *  un evento vigente ahora mismo. `_eventoEsVigente` está definida
 *  en js/eventos.js (Etapa 4); se referencia acá tal cual para no
 *  duplicar el criterio de "vigente" en dos archivos. */
function _pinMatchesActiveFilter(p) {
  if (activeFilter === 'all') return true;
  if (activeFilter === '__eventos__') {
    return typeof EVENTOS !== 'undefined' && typeof _eventoEsVigente === 'function'
      && EVENTOS.some(ev => ev.poi_id === p.id && _eventoEsVigente(ev));
  }
  const cats = Array.isArray(p.categories) && p.categories.length ? p.categories : [p.category];
  return cats.includes(activeFilter);
}

const _btnAddCat = document.getElementById('btn-add-cat');
if (_btnAddCat) {
  _btnAddCat.addEventListener('click', () => {
    const name  = document.getElementById('nc-name').value.trim();
    const icon  = document.getElementById('nc-icon').value.trim() || '🏷';
    const color = document.getElementById('nc-color').value;
    if (!name) { toast('⚠️ Ingresá el nombre'); return; }
    const id = 'cat_' + name.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') + '_' + Date.now().toString(36);
    // [Etapa A, PLAN_CATEGORIAS_SUBCATEGORIAS.md] mismo shape que las
    // categorías base (CAT): label multi-idioma + subcategories — una
    // sola fuente de verdad para "qué es una categoría", sea builtin o
    // custom. Arranca con el mismo texto en los 3 idiomas (todavía no
    // hay editor de idiomas, ver Etapa B); el admin podrá corregir cada
    // uno por separado cuando exista.
    CUSTOM_CATS[id] = {label:{es:name.toUpperCase(), en:name.toUpperCase(), pt:name.toUpperCase()}, icon, color, active:true, subcategories:{}};
    document.getElementById('nc-name').value = '';
    document.getElementById('nc-icon').value = '';
    renderCatsAdmin();
    updateFilterBar();
    _markCatsDirty();
    toast(`✅ Categoría "${name}" creada`);
  });
}

/* ── CSS para chips de categoría ── */
(function() {
  const s = document.createElement('style');
  s.textContent = `.cat-chip{display:inline-flex;align-items:center;gap:4px;padding:5px 11px;border-radius:99px;border:1.5px solid;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;background:transparent;font-family:var(--font-b);-webkit-tap-highlight-color:transparent;margin:3px}
  .cat-chip:hover{opacity:.85;transform:scale(1.04)}
  #cat-chips-add,#cat-chips-edit{display:flex;flex-wrap:wrap;gap:2px;padding:8px 0 4px}`;
  document.head.appendChild(s);
})();

function buildMultiCatSelector(containerId, selectedCats) {
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
}

window.toggleCatChip = function(btn, catId, containerId) {
  btn.classList.toggle('on');
  const cat = getAllCats()[catId];
  if (!cat) return;
  if (btn.classList.contains('on')) { btn.style.background=cat.color; btn.style.borderColor=cat.color; btn.style.color='white'; }
  else { btn.style.background=''; btn.style.borderColor=cat.color+'40'; btn.style.color=cat.color; }
};

function getSelectedCats(containerId) {
  const c = document.getElementById(containerId);
  if (!c) return [];
  return Array.from(c.querySelectorAll('.cat-chip.on')).map(b => b.dataset.cat);
}

(function patchAddForm() {
  const fg = document.getElementById('a-cat')?.closest('.fg');
  if (!fg) return;
  fg.innerHTML = `<label class="fl">Categoría * (podés elegir más de una)</label><div id="cat-chips-add"></div>`;
  buildMultiCatSelector('cat-chips-add', []);
})();
(function patchEditForm() {
  const fg = document.getElementById('e-cat')?.closest('.fg');
  if (!fg) return;
  fg.innerHTML = `<label class="fl">Categoría (podés elegir más de una)</label><div id="cat-chips-edit"></div>`;
})();

/* ═══════════════════════════════════════════════════════════
   [Etapa B, PLAN_CATEGORIAS_SUBCATEGORIAS.md — sección 3.3]
   "Cantidad de campos de idioma" — mismo patrón de doble candado que
   el ID de un pin (resetEditIdLock/_applyEditIdLockState/
   _wireEditIdLock en js/pin-adjust.js): el campo arranca siempre
   bloqueado mostrando el valor actual; se habilita (borde/texto rojo)
   solo con los 2 checkboxes tildados a la vez; destildar cualquiera
   de los dos vuelve a bloquear y descarta el valor a medio escribir.
   Mínimo duro: 3 (nunca menos — hoy además es el único valor con
   efecto real, ver nota de LANG_CODES más arriba).
   ═══════════════════════════════════════════════════════════ */
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
  if (!unlocked) inp.value = languageFieldsCount; // descarta edición a medio hacer
}

(function _wireLangCountLock() {
  const inp   = document.getElementById('cats-lang-count');
  const lock1 = document.getElementById('cats-lang-count-lock1');
  const lock2 = document.getElementById('cats-lang-count-lock2');
  if (lock1) lock1.addEventListener('change', _applyLangCountLockState);
  if (lock2) lock2.addEventListener('change', _applyLangCountLockState);
  if (inp) inp.addEventListener('change', () => {
    let v = parseInt(inp.value, 10);
    if (!Number.isFinite(v) || v < 3) v = 3; // mínimo duro, nunca se borra contenido ya cargado
    inp.value = v;
    languageFieldsCount = v;
    _markCatsDirty();
    toast(`✅ Cantidad de campos de idioma: ${v} (no olvides "Guardar cambios")`);
  });
})();

/* ── Color presets global handler ── */
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




