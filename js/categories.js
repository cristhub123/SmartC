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
  return CAT[id] || CUSTOM_CATS[id] || SPECIAL_CATS[id] || null;
}

/* [2026-09-28] Categorías ESPECIALES del sistema: aparecen en la tab
   Categorías del admin y en la fila de botones del mapa igual que las
   demás (nombre ES/EN/PT, ícono, color, subcategorías, activar/
   desactivar), pero NO se pueden eliminar y NO forman parte de CAT ni de
   getAllCats() a propósito: no son una categoría "real" que se le asigne
   a un pin (poi.categories), así que no deben aparecer en los
   selectores de categoría de los formularios de lugar, en la búsqueda,
   ni en la importación masiva. Hoy hay una sola: Eventos (id fijo
   '__eventos__', el mismo que ya usa el filtro del mapa). */
const SPECIAL_CATS = {
  __eventos__: {
    label: { es: 'EVENTOS', en: 'EVENTS', pt: 'EVENTOS' },
    icon: '🎉',
    color: '#1c1c1e',
    active: true,
    subcategories: {},
    special: true
  }
};

/* Lo que muestra la tab Categorías del admin: las especiales primero
   (Eventos queda al principio, igual que en el mapa) + todas las demás. */
function getAdminCats() {
  const result = {};
  Object.entries(SPECIAL_CATS).forEach(([k, v]) => { result[k] = { ...v, builtin: true, special: true, active: v.active !== false }; });
  Object.entries(getAllCats()).forEach(([k, v]) => { result[k] = v; });
  return result;
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
  // [FIX solicitado por Cris — 2026-09-06] El nombre en español ahora
  // se edita con un campo SIEMPRE visible en la fila (ver
  // data-name-input en renderCatsAdmin) — este acordeón queda solo
  // para EN/PT, que son secundarios y no necesitan estar siempre a la
  // vista. LANG_CODES sigue teniendo 'es' primero porque otras partes
  // del proyecto (getCatLabel) dependen de ese orden de fallback; acá
  // simplemente no lo iteramos.
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
  const all = getAdminCats();
  list.innerHTML = Object.entries(all).map(([id, cat]) => {
    const isOn = cat.active !== false;
    // Eventos no es una categoría asignable a un pin: su contador son los
    // eventos vigentes ahora mismo (mismo criterio que usa el filtro del mapa).
    const count = cat.special
      ? ((typeof EVENTOS !== 'undefined' && typeof _eventoEsVigente === 'function') ? EVENTOS.filter(ev => _eventoEsVigente(ev)).length : 0)
      : POIS.filter(p => {
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
      // [FIX solicitado por Cris — 2026-09-06] antes el nombre era un
      // <span> de solo lectura (solo editable "escondido" adentro del
      // acordeón 🌐 Idiomas) — ahora es un campo de texto SIEMPRE
      // visible en la fila, mismo patrón .fi que cualquier otro campo
      // editable de la app. Escribe en sub.label.es (ver listener
      // data-name-input más abajo); EN/PT siguen en el acordeón.
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
      ${cat.builtin?`<span style="font-size:11px;color:var(--text3);font-family:var(--font-m);flex-shrink:0" ${cat.special?'title="Categoría fija del sistema: se puede ocultar, no eliminar"':''}>${cat.special?'FIJA':'BASE'}</span>`:`<button class="za-edit-btn" onclick="deleteCat('${id}')" title="Eliminar">🗑</button>`}
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
   mientras está escribiendo. */
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

  /* [FIX solicitado por Cris — 2026-09-06] antes el nombre (español)
     de una categoría/subcategoría solo se podía tocar adentro del
     acordeón "🌐 Idiomas" — ahora hay un campo siempre visible en la
     fila (ver data-name-input en renderCatsAdmin) que escribe
     directamente en label.es. No dispara renderCatsAdmin() en cada
     cambio para no perder el foco/cursor del campo que se está
     editando; el contador "(N)" y el resto de la fila no dependen de
     este valor, así que no hace falta repintar nada más. */
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
  const all = getAdminCats();
  const cat = all[id];
  if (!cat) return;
  const newState = !(cat.active !== false);
  if (CAT[id]) CAT[id].active = newState;
  if (CUSTOM_CATS[id]) CUSTOM_CATS[id].active = newState;
  if (SPECIAL_CATS[id]) SPECIAL_CATS[id].active = newState;
  // Si el filtro que estaba elegido en el mapa acaba de ocultarse, volver
  // a "Todo" — si no, el mapa quedaría filtrado por un botón que ya no existe.
  if (!newState && activeFilter === id) { activeFilter = 'all'; activeSubfilter = null; }
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
  // [FIX Etapa 6 — PLAN_CORRECCIONES_ADMIN.md] antes usaba el confirm()
  // nativo del navegador (ya frenaba el borrado, pero se veía distinto
  // al resto de la app) — ahora mismo modal prolijo que ya usa Lugares
  // (confirmarBorrado, js/utils.js). El borrado en sí sigue igual,
  // sujeto a "Guardar cambios" como cualquier otro cambio de la pestaña.
  confirmarBorrado(`¿Eliminar la categoría "${name}"? Esta acción no se puede deshacer.`, () => {
    delete CUSTOM_CATS[id];
    renderCatsAdmin();
    updateFilterBar();
    _markCatsDirty();
    toast(`🗑 "${name}" eliminada`);
  }, '¿Eliminar categoría?');
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
  // [FIX Etapa 6 — PLAN_CORRECCIONES_ADMIN.md] mismo cambio que deleteCat de arriba.
  confirmarBorrado(`¿Eliminar la subcategoría "${name}"? Esta acción no se puede deshacer.`, () => {
    delete cat.subcategories[subId];
    renderCatsAdmin();
    _markCatsDirty();
    toast(`🗑 "${name}" eliminada`);
  }, '¿Eliminar subcategoría?');
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

/* [FIX solicitado por Cris — 2026-09-06] Refuerzo extra: si hay
   cambios sin guardar en esta pestaña (_catsDirty) y el admin intenta
   recargar o cerrar la pestaña del navegador, se le avisa con el
   diálogo nativo de "salir sin guardar" — así queda clarísimo, antes
   de perderlos, que esos cambios (incluyendo un borrado) todavía NO
   están en Firestore. Los navegadores ignoran el texto personalizado
   y muestran su propio mensaje genérico; igual hace falta
   returnValue para que el diálogo aparezca en todos ellos. */
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

/* [Etapa D, PLAN_CATEGORIAS_SUBCATEGORIAS.md — sección 4]
   Drag-to-scroll de la fila de filtros, factorizado acá para no
   duplicarlo entre la fila principal y la fila de subcategorías
   (antes vivía inline, una sola vez, adentro de updateFilterBar).
   Devuelve `consumeDragFlag()`: true la primera vez que se llama
   después de un arrastre real (y lo resetea) — mismo criterio exacto
   que el `if (moved) {...}` que ya existía, solo reusable. */
function _attachFilterBarDragScroll(bar) {
  let isDragging = false, startX = 0, scrollLeft = 0, moved = false, _pid = null;
  // [FIX 2026-10-01] solo izquierda-derecha: si por cualquier motivo (foco,
  // scrollIntoView, rebote del navegador) la fila se desplaza en vertical,
  // se devuelve a 0 de inmediato. El arrastre ya solo toca scrollLeft.
  bar.addEventListener('scroll', () => { if (bar.scrollTop !== 0) bar.scrollTop = 0; });
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
  bar.addEventListener('pointercancel', () => { isDragging = false; });
  return { consumeDragFlag() { if (moved) { moved = false; return true; } return false; } };
}

/* [Etapa D, PLAN_CATEGORIAS_SUBCATEGORIAS.md — sección 11, pregunta 3]
   Decisión de Cris (06/09): tocar una categoría sin ninguna
   subcategoría ACTIVA cargada filtra normal, sin abrir la fila de
   subcategorías — por eso esto excluye las inactivas, igual que
   `_rebuildSubcatSelector` en el admin. */
function _catHasActiveSubcats(catId) {
  const cat = getAllCats()[catId];
  if (!cat || !cat.subcategories) return false;
  return Object.values(cat.subcategories).some(s => s.active !== false);
}

/* [Etapa E, PLAN_CATEGORIAS_SUBCATEGORIAS.md] Reescrito 2026-09-07:
   reemplaza ENTERO el intento anterior (FLIP con getBoundingClientRect,
   flexbox normal) por el mecanismo exacto que pidió Cris — calcado de
   su ejemplo de referencia (index.html/styles.css/script.js que subió,
   con `--current-x` + position:absolute) — generalizado acá para N
   categorías reales (el ejemplo tenía 5 fijas) y conectado al filtro
   real de la app (activeFilter/activeSubfilter + applyFilter()).

   Por qué el intento anterior se sacó por completo en vez de
   convivir con este: los dos usaban `.fbtn`/`.filter-row` con
   layouts incompatibles (flexbox normal vs. position:absolute +
   `--current-x`) y clases con nombres parecidos — dejar los dos
   generaba exactamente el pisado que Cris pidió evitar. Se borraron
   `_animateOpenSubcatRow`/`_animateCloseSubcatRow`/
   `_appendAnimatedSubcats`/`_renderMainFilterRowAnimatedReturn`/
   `_flipTransform` viejas y se vuelven a escribir con estos mismos
   nombres (evita romper si algo más los llamaba) pero con la lógica
   nueva.

   CLAVE del porqué no hay conflicto entre el "reposo" (fila normal)
   y las clases de animación: la posición de reposo de cada botón
   NUNCA se escribe como `transform` inline — solo se escribe la
   variable CSS `--current-x` (ver `_setBtnX`), y es el propio CSS
   (`.fbtn`, `.fbtn:hover`, `.fbtn.on`, `.fbtn-exit-down`,
   `.fbtn-enter-up`) el que arma el `transform` final leyendo esa
   variable. Si el `transform` de reposo se hubiera escrito inline
   (como en el ejemplo de Cris, que no tiene estados :hover propios
   para pisar), el CSS existente `.fbtn:hover`/`.fbtn.on` de la app
   (que sí existían antes de esta etapa) hubiese quedado inútil — un
   estilo inline siempre le gana a una clase sin !important, sin
   importar :hover/:active. Con la variable, en cambio, cada clase
   compite en igualdad de condiciones y gana la de mayor especificidad
   de siempre (`.fbtn.on` le gana a `.fbtn`, como ya pasaba). */

/* Ancho de cada "casillero" de la fila — categorías y subcategorías
   comparten el mismo ancho para que las cuentas de posición sean una
   sola multiplicación (índice * FILTER_SLOT_W). Mismo valor que usó
   Cris en su referencia. */
const FILTER_SLOT_W = 78;

/* Estado de animación de la fila: `.is-animating` vive en el propio
   contenedor y es la única señal compartida entre JS y CSS. Mientras
   está activa, la fila no reconstruye sus botones y el hover queda
   deshabilitado. */

function _setBtnX(btn, x) { btn.style.setProperty('--current-x', `${x}px`); }

/* Arma la lista de "casillones" de la fila principal: Todo + Eventos
   (fijos, no son categorías reales — no viven en CAT/CUSTOM_CATS) +
   las categorías activas, mismo orden que ya usaba la fila antes de
   esta etapa. */
function _getMainFilterItems() {
  const _t = (k) => (window.I18N ? I18N.t(k) : k);
  const items = [
    { id: 'all', label: _t('filter_all'), iconHTML: LUCIDE.all, color: '#1c1c1e' }
  ];
  // [2026-09-28] Eventos ahora es una categoría más de la tab del admin
  // (SPECIAL_CATS): nombre/ícono/color editables y se puede ocultar. Queda
  // siempre justo después de "Todo", como estaba antes.
  Object.entries(SPECIAL_CATS).filter(([, v]) => v.active !== false).forEach(([id, cat]) => {
    const labelStr = getCatLabel(cat);
    const label = labelStr.charAt(0).toUpperCase() + labelStr.slice(1).toLowerCase();
    items.push({ id, label, iconHTML: cat.icon || '🎉', color: cat.color });
  });
  Object.entries(getAllCats()).filter(([, v]) => v.active !== false).forEach(([id, cat]) => {
    const labelStr = getCatLabel(cat);
    const label = labelStr.charAt(0).toUpperCase() + labelStr.slice(1).toLowerCase();
    items.push({ id, label, iconHTML: getCatIcon(cat, id), color: cat.color });
  });
  return items;
}

function _buildMainBtn(item, x, isOn) {
  const btn = document.createElement('button');
  btn.className = 'fbtn' + (isOn ? ' on' : '');
  btn.dataset.f = item.id;
  _setBtnX(btn, x);
  btn.innerHTML = `<div class="fbtn-circle" style="background:${item.color}">${item.iconHTML}</div><span class="fbtn-label">${item.label}</span>`;
  return btn;
}

function _buildSubBtn(bar, cat, subId, sub, parentIcon, x, isOn) {
  const btn = document.createElement('button');
  btn.className = 'fbtn fbtn-sub' + (isOn ? ' on' : '');
  btn.dataset.sf = subId;
  _setBtnX(btn, x);
  const labelStr = getCatLabel(sub);
  const label = labelStr.charAt(0).toUpperCase() + labelStr.slice(1).toLowerCase();
  btn.innerHTML = `<div class="fbtn-circle" style="background:${cat.color}">${parentIcon}</div><span class="fbtn-label">${label}</span>`;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    if (bar.classList.contains('is-animating')) return;
    const wasOn = btn.classList.contains('on');
    bar.querySelectorAll('.fbtn-sub.on').forEach(b => b.classList.remove('on'));
    activeSubfilter = wasOn ? null : subId;
    if (!wasOn) btn.classList.add('on');
    applyFilter();
    if (typeof window._onFilterBarUpdated === 'function') window._onFilterBarUpdated();
  });
  return btn;
}

/* [ajuste 2026-09-28] Botón calendario que aparece sobre "Eventos"
   al abrir su esquina — visualmente calcado de `_buildSubBtn` (mismo
   círculo+etiqueta, misma coreografía de entrada/salida vía
   `.fbtn-sub`), pero NO es una subcategoría real: no toca
   `activeSubfilter` ni filtra nada acá. Solo arma el botón; quien lo
   engancha (abre/cierra el popover del calendario propio) es
   `window._wireCalendarioFechaBtn` (js/eventos-fecha-filtro.js) — se
   llama aparte, después de insertar este botón en el DOM, porque ese
   archivo es el dueño de esa lógica (una sola fuente de verdad, no se
   duplica acá el manejo del popover). Id fijo `eventos-fecha-btn`: ese
   mismo archivo lo busca por id cada vez. */
function _buildCalendarSubBtn(x) {
  const cat = SPECIAL_CATS.__eventos__;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'eventos-fecha-btn';
  btn.className = 'fbtn fbtn-sub';
  btn.setAttribute('aria-haspopup', 'true');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('data-i18n-aria', 'eventos_fecha_aria');
  btn.setAttribute('aria-label', 'Elegir fecha para ver eventos de ese día');
  _setBtnX(btn, x);
  const label = window.I18N ? I18N.t('fbtn_fecha_label') : 'Fecha';
  btn.innerHTML = `<div class="fbtn-circle" style="background:${cat.color}">${LUCIDE.calendar}</div><span class="fbtn-label">${label}</span>`;
  // [FIX] `I18N.apply(root)` busca con `root.querySelectorAll(...)` —
  // eso mira los DESCENDIENTES de `root`, nunca `root` mismo. Como acá
  // el atributo está en el propio botón (no en un hijo), hay que
  // completar el aria-label a mano una vez; el atributo
  // `data-i18n-aria` queda puesto igual para que un cambio de idioma
  // posterior (que sí corre sobre `document` completo, con el botón
  // ya insertado adentro) lo actualice solo.
  if (window.I18N) btn.setAttribute('aria-label', I18N.t('eventos_fecha_aria'));
  return btn;
}


/* [Etapa 15, PLAN_USUARIOS_EVENTOS.md, 2026-09-29] Botón "Todos" de la
   esquina de Eventos: abre el panel "Todos los eventos" (mismo PoiPanel,
   directo en 'full' — `PoiPanel.openTodosEventos()`, js/poi-panel.js).
   Vive al lado del botón calendario, con la misma coreografía y el mismo
   look (.fbtn-sub). Tocarlo con el panel ya abierto lo cierra. Id fijo
   `eventos-todos-btn`. Lo apaga/enciende el switch "Panel Todos los
   eventos" de Admin → Funciones (FEATURES.todosEventos, js/features.js). */
function _buildTodosSubBtn(x) {
  const cat = SPECIAL_CATS.__eventos__;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'eventos-todos-btn';
  btn.className = 'fbtn fbtn-sub';
  btn.setAttribute('data-i18n-aria', 'eventos_todos_aria');
  btn.setAttribute('aria-label', window.I18N ? I18N.t('eventos_todos_aria') : 'Ver todos los eventos');
  _setBtnX(btn, x);
  const label = window.I18N ? I18N.t('fbtn_todos_label') : 'Todos';
  btn.innerHTML = `<div class="fbtn-circle" style="background:${cat.color}">${LUCIDE.listado}</div><span class="fbtn-label">${label}</span>`;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const bar = document.querySelector('.filter-row');
    if (bar && bar.classList.contains('is-animating')) return;
    if (window.PoiPanel && typeof window.PoiPanel.openTodosEventos === 'function') window.PoiPanel.openTodosEventos();
  });
  return btn;
}

/* [Etapa 15] Qué botones lleva la esquina de Eventos: "Fecha" (si el filtro
   de fecha está habilitado en Admin → Eventos) y/o "Todos" (si el switch de
   Admin → Funciones está encendido). Con 0 botones, tocar "Eventos" filtra
   normal sin abrir la esquina (igual que una categoría sin subcategorías).
   Una sola fuente de verdad para updateFilterBar / el click / la animación. */
function _eventosCornerBtns() {
  const fecha = typeof window.isFechaFiltroHabilitado === 'function' && window.isFechaFiltroHabilitado();
  const todos = (typeof FEATURES === 'undefined') ? true : !!(FEATURES.todosEventos && FEATURES.todosEventos.on);
  return { fecha, todos, n: (fecha ? 1 : 0) + (todos ? 1 : 0) };
}

/* Arma los botones de la esquina de Eventos, en orden (Fecha, Todos), cada
   uno en su casillero. Devuelve el array de nodos. */
function _buildEventosCornerBtns() {
  const c = _eventosCornerBtns();
  const btns = [];
  if (c.fecha) btns.push(_buildCalendarSubBtn((btns.length + 1) * FILTER_SLOT_W));
  if (c.todos) btns.push(_buildTodosSubBtn((btns.length + 1) * FILTER_SLOT_W));
  return btns;
}

/* Espaciador invisible (altura 1px, en el flujo normal — a
   diferencia de los `.fbtn`, que son position:absolute y por eso NO
   le dan ancho de scroll al contenedor por sí solos) para que
   `.filter-row` siga siendo scrolleable horizontalmente con drag
   (`_attachFilterBarDragScroll`) sin importar cuántos casilleros haya
   — categorías reales activas, o subcategorías de la que esté
   abierta, lo que sea más ancho. */
function _setFilterRowWidth(bar, slots) {
  let spacer = bar.querySelector('.filter-row-spacer');
  if (!spacer) {
    spacer = document.createElement('div');
    spacer.className = 'filter-row-spacer';
    spacer.style.cssText = 'height:1px;pointer-events:none;';
    bar.appendChild(spacer);
  } else {
    bar.appendChild(spacer); // reordena al final, no tapa nada (1px de alto)
  }
  spacer.style.width = (slots * FILTER_SLOT_W) + 'px';
}

/* [Etapa D→E, PLAN_CATEGORIAS_SUBCATEGORIAS.md — sección 4]
   Punto de entrada "en frío": arma la fila completa desde cero y la
   deja YA en el estado que le corresponda a `activeFilter`/
   `activeSubfilter` actuales, de una sola vez, SIN animación. Se
   llama muy seguido (cada carga de pines al mover el mapa, ver
   pins-viewport-loader.js) — tiene que ser barata y siempre terminar
   en el estado correcto esté o no abierta una categoría, animado o
   no. La coreografía animada (caída/subida en cascada) es aparte,
   solo la dispara un click real del usuario — ver
   _animateOpenSubcatRow/_animateCloseSubcatRow más abajo. */
function updateFilterBar() {
  const bar = document.querySelector('.filter-row');
  if (!bar) return;

  // Durante una coreografía, los refrescos de fondo no reconstruyen la fila.
  if (bar.classList.contains('is-animating')) {
    applyFilter();
    if (typeof window._onFilterBarUpdated === 'function') window._onFilterBarUpdated();
    return;
  }

  const items = _getMainFilterItems();
  const isEventosFilter = activeFilter === '__eventos__';
  // [ajuste 2026-09-28] Eventos ahora también abre la esquina — no con
  // subcategorías reales (`cat.subcategories`, hoy no filtran nada en
  // el mapa, ver nota vieja en `_pinMatchesActiveFilter`), sino con EL
  // botón calendario (`_buildCalendarSubBtn`) — y solo si el filtro de
  // fecha está habilitado desde Admin → Eventos (si no, tocar "Eventos"
  // filtra normal, sin abrir nada, igual que una categoría sin
  // subcategorías activas).
  const showSubs = activeFilter !== 'all'
    && (isEventosFilter ? _eventosCornerBtns().n > 0 : _catHasActiveSubcats(activeFilter));
  const openCat = showSubs ? _getCatRef(activeFilter) : null; // _getCatRef (no getAllCats): resuelve también SPECIAL_CATS.__eventos__
  const subs = (openCat && !isEventosFilter) ? Object.entries(openCat.subcategories || {}).filter(([, s]) => s.active !== false) : [];

  // Si la esquina que va a quedar armada NO es la de Eventos, pero el
  // popover del calendario había quedado abierto de una vuelta
  // anterior (ej. el admin desactivó el filtro de fecha mientras
  // estaba abierto en otra pestaña), lo cierra — evita un popover
  // huérfano sin el botón que lo abrió.
  if (!(openCat && isEventosFilter) && typeof window._cerrarPopoverFecha === 'function') window._cerrarPopoverFecha();

  bar.innerHTML = '';

  // [FIX 2026-10-01 — bug "los botones principales desaparecen y no se
  // pueden recuperar"] Antes, con una categoría abierta, esta función
  // reconstruía la fila con SOLO el botón de la categoría activa y
  // BORRABA los demás botones principales del DOM. Pero esta función se
  // vuelve a llamar sola cada vez que el mapa trae pines nuevos (zoom/
  // arrastre → drawLoadedPins) o se cambia el idioma. Si eso pasaba con
  // una categoría abierta, el cierre animado (_animateCloseSubcatRow)
  // quedaba sin nada que restaurar: "Todo", "Eventos", etc. ya no
  // existían. Ahora la fila reconstruida queda IGUAL que después de la
  // animación de apertura: todos los principales en el DOM, y los que no
  // son la categoría abierta escondidos con .fbtn-exit-down (invisibles
  // y sin click, tal cual los deja la coreografía).
  items.forEach((item, realIdx) => {
    const esLaAbierta = item.id === activeFilter;
    const btn = _buildMainBtn(item, (openCat && esLaAbierta) ? 0 : realIdx * FILTER_SLOT_W, esLaAbierta);
    btn.dataset.idx = realIdx; // posición "de origen" — la usa el cierre animado para saber a dónde volver
    if (openCat && !esLaAbierta) btn.classList.add('fbtn-exit-down');
    bar.appendChild(btn);
  });

  if (openCat) {
    if (isEventosFilter) {
      _buildEventosCornerBtns().forEach(b => bar.appendChild(b));
    } else {
      const parentIcon = getCatIcon(openCat, activeFilter);
      subs.forEach(([subId, sub], i) => {
        bar.appendChild(_buildSubBtn(bar, openCat, subId, sub, parentIcon, (i + 1) * FILTER_SLOT_W, activeSubfilter === subId));
      });
    }
  }

  _setFilterRowWidth(bar, openCat ? 1 + (isEventosFilter ? _eventosCornerBtns().n : subs.length) : items.length);
  const drag = _attachFilterBarDragScroll(bar);
  // El botón calendario recién se agregó al DOM recién arriba — engancharlo ahora.
  if (openCat && isEventosFilter && typeof window._wireCalendarioFechaBtn === 'function') window._wireCalendarioFechaBtn();

  bar.querySelectorAll('.fbtn[data-f]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (drag.consumeDragFlag()) return;
      if (bar.classList.contains('is-animating')) return;
      const id = btn.dataset.f;
      // [FIX 2026-09-07 — bug "se queda trabado al volver a tocar la
      // categoría"] Antes esto miraba `openCat`, una variable
      // calculada UNA sola vez al armar la fila y capturada acá por
      // clausura — pero abrir/cerrar la fila con la animación NO pasa
      // por acá de nuevo (no se vuelve a llamar updateFilterBar()),
      // así que `openCat` quedaba congelada con su valor viejo aunque
      // la fila ya estuviera abierta de verdad. Ahora se chequea el
      // estado REAL en el momento del click: ¿esta misma categoría
      // está activa Y hay chips de subcategoría visibles ahora mismo?
      const isOpenNow = id === activeFilter && !!bar.querySelector('.fbtn-sub');
      // [Etapa E, decisión de Cris — reemplaza el botón "Volver"] si
      // ya está abierta la vista de subcategorías de ESTA misma
      // categoría (quedó primera, con .on), tocarla de nuevo cierra.
      if (isOpenNow) { _animateCloseSubcatRow(bar, id); return; }
      // [ajuste 2026-09-28] Eventos entra por la misma rama que
      // cualquier categoría con subcategorías — ver nota de arriba.
      if (id !== 'all' && (id === '__eventos__' ? _eventosCornerBtns().n > 0 : _catHasActiveSubcats(id))) { _animateOpenSubcatRow(bar, id, btn); return; }
      activeFilter = id;
      activeSubfilter = null;
      updateFilterBar();
      applyFilter();
      if (typeof window._onFilterBarUpdated === 'function') window._onFilterBarUpdated();
    });
  });

  applyFilter();
  if (typeof window._onFilterBarUpdated === 'function') window._onFilterBarUpdated();
}

/* [Etapa E] Coreografía de apertura — calcada 1:1 del ejemplo de
   referencia de Cris (handleCategoryClick de su script.js):
   1) los demás botones principales caen con fade, en cascada de
      derecha a izquierda (40ms entre uno y otro);
   2) la categoría tocada viaja a la posición 0 (solo cambia
      `--current-x`, el CSS anima el resto — ver nota grande arriba);
   3) las subcategorías suben con fade, en cascada (60ms entre una y
      otra). Generalizada para N categorías reales y conectada al
      filtro real (activeFilter/activeSubfilter + applyFilter()) —
      el mapa ya filtra por toda la categoría desde el instante del
      toque, no espera a que termine la animación (así lo pidió Cris
      en la Etapa D). */
function _animateOpenSubcatRow(bar, catId, selectedBtn) {
  const cat = _getCatRef(catId); // _getCatRef (no getAllCats): resuelve también SPECIAL_CATS.__eventos__
  if (!cat) return;
  bar.classList.add('is-animating');

  const mainBtns = Array.from(bar.querySelectorAll('.fbtn[data-f]'));
  const otherBtns = mainBtns.filter(b => b !== selectedBtn);
  const sortedOthers = otherBtns.slice().sort((a, b) => b.dataset.idx - a.dataset.idx);
  sortedOthers.forEach((btn, i) => {
    setTimeout(() => btn.classList.add('fbtn-exit-down'), i * 40);
  });

  setTimeout(() => {
    _setBtnX(selectedBtn, 0);
    selectedBtn.classList.add('on');
  }, 80);

  setTimeout(() => {
    const isEventosFilter = catId === '__eventos__';
    if (isEventosFilter) {
      // [ajuste 2026-09-28] En vez de subcategorías reales, suben los
      // botones propios de Eventos: "Fecha" (calendario del filtro de
      // fecha, ver `_buildCalendarSubBtn`) y, desde la Etapa 15, "Todos"
      // (panel "Todos los eventos", ver `_buildTodosSubBtn`). Mismo
      // mecanismo de entrada que un `.fbtn-sub` normal (fade+cascada).
      const cornerBtns = _buildEventosCornerBtns();
      _setFilterRowWidth(bar, 1 + cornerBtns.length);
      cornerBtns.forEach((cb, i) => {
        cb.classList.add('fbtn-enter-up');
        bar.appendChild(cb);
        const isLast = i === cornerBtns.length - 1;
        requestAnimationFrame(() => {
          setTimeout(() => {
            cb.classList.add('fbtn-entered');
            if (isLast) {
              // [FIX 2026-09-07, mismo criterio para Eventos] recién acá
              // termina el último paso real de la coreografía — desbloquea
              // updateFilterBar() y los clicks nuevos.
              bar.classList.remove('is-animating');
              // El botón calendario recién quedó insertado en el DOM —
              // engancharlo ahora (js/eventos-fecha-filtro.js es quien sabe
              // abrir el popover, acá no se duplica esa lógica). No hace
              // nada si esta vez no hay botón calendario.
              if (typeof window._wireCalendarioFechaBtn === 'function') window._wireCalendarioFechaBtn();
            }
          }, (i + 1) * 60);
        });
      });
      if (!cornerBtns.length) bar.classList.remove('is-animating');
    } else {
      const parentIcon = getCatIcon(cat, catId);
      const subs = Object.entries(cat.subcategories || {}).filter(([, s]) => s.active !== false);
      _setFilterRowWidth(bar, 1 + subs.length);
      subs.forEach(([subId, sub], i) => {
        const x = (i + 1) * FILTER_SLOT_W;
        const subBtn = _buildSubBtn(bar, cat, subId, sub, parentIcon, x, false);
        subBtn.classList.add('fbtn-enter-up');
        bar.appendChild(subBtn);
        const isLast = i === subs.length - 1;
        requestAnimationFrame(() => {
          setTimeout(() => {
            subBtn.classList.add('fbtn-entered');
            // [FIX 2026-09-07] recién acá termina el último paso real
            // de la coreografía — desbloquea updateFilterBar() y los
            // clicks nuevos.
            if (isLast) bar.classList.remove('is-animating');
          }, (i + 1) * 60);
        });
      });
      if (!subs.length) bar.classList.remove('is-animating');
    }
  }, 500);

  activeFilter = catId;
  activeSubfilter = null;
  applyFilter();
  if (typeof window._onFilterBarUpdated === 'function') window._onFilterBarUpdated();
}

/* [Etapa E] Reversa — calcada de resetToMain() del ejemplo de Cris:
   las subcategorías caen en cascada y se sacan del DOM; al terminar,
   los botones principales (que nunca se borraron, solo quedaron
   ocultos con .fbtn-exit-down) vuelven a su `--current-x` de origen
   (dataset.idx, guardado al construir la fila) y reaparecen. */
function _animateCloseSubcatRow(bar, catId) {
  // [ajuste 2026-09-28] Si lo que se está cerrando es la esquina de
  // Eventos, el botón calendario (.fbtn-sub de acá abajo) puede tener
  // su popover abierto — cerrarlo ANTES de sacar el botón del DOM
  // (si no, el popover queda flotando sin el botón que lo controla).
  // Llamado sin condición: es barato y no hace nada si no hay nada
  // abierto, así cubre también cualquier vía indirecta de cierre.
  if (typeof window._cerrarPopoverFecha === 'function') window._cerrarPopoverFecha();

  bar.classList.add('is-animating');
  const subBtns = Array.from(bar.querySelectorAll('.fbtn-sub'));
  const mainBtns = Array.from(bar.querySelectorAll('.fbtn[data-f]'));

  subBtns.forEach((btn, i) => {
    setTimeout(() => {
      btn.classList.remove('fbtn-entered');
      btn.classList.add('fbtn-enter-up');
      setTimeout(() => btn.remove(), 250);
    }, i * 30);
  });

  setTimeout(() => {
    mainBtns.forEach(btn => {
      _setBtnX(btn, parseInt(btn.dataset.idx, 10) * FILTER_SLOT_W);
      btn.classList.remove('fbtn-exit-down', 'on');
    });
    const allBtn = bar.querySelector('.fbtn[data-f="all"]');
    if (allBtn) allBtn.classList.add('on');
    _setFilterRowWidth(bar, mainBtns.length);
    // [FIX 2026-09-07] último paso real de esta coreografía — recién
    // acá desbloquea updateFilterBar() y los clicks nuevos.
    bar.classList.remove('is-animating');
    // [FIX 2026-10-01] Red de seguridad: si por cualquier motivo faltan
    // botones principales en el DOM (la fila se reconstruyó a mitad de
    // camino), no hay nada que "restaurar" — se arma la fila completa
    // de cero. activeFilter ya vale 'all' acá, así que queda bien.
    if (mainBtns.length !== _getMainFilterItems().length) updateFilterBar();
  }, subBtns.length * 30 + 250);

  activeFilter = 'all';
  activeSubfilter = null;
  applyFilter();
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
 *  duplicar el criterio de "vigente" en dos archivos.
 *  [Etapa D, PLAN_CATEGORIAS_SUBCATEGORIAS.md — sección 4.1] Cuando
 *  además hay una subcategoría activa (`activeSubfilter`), un pin
 *  tiene que matchear la categoría Y la subcategoría — no se
 *  duplica la decisión de mostrar/ocultar, `pin-visibility.js` sigue
 *  siendo el único que la aplica, esto solo extiende el criterio. */
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
  #cat-chips-add,#cat-chips-edit,#subcat-chips-add,#subcat-chips-edit{display:flex;flex-wrap:wrap;gap:2px;padding:8px 0 4px}
  .subcat-chip{font-size:11px;padding:4px 10px}
  /* [FIX solicitado por Cris — 2026-09-06] textos chicos de la pestaña
     Categorías (#tp-cats) con muy bajo contraste (verde claro,
     --text3) y difíciles de leer. Se sobreescribe --text3 SOLO
     adentro de #tp-cats (no toca el resto del panel admin ni el mapa
     público) por un verde bien oscuro; con el skin oscuro
     "neobrutal-night" se usa un tono claro en su lugar, porque un
     verde oscuro sobre fondo casi negro sería igual de ilegible.
     Además se fuerza +2px a los tamaños de fuente chicos que ya
     estaban hardcodeados en HTML (selector por substring del propio
     atributo style, para no tener que reescribir cada línea de
     index.html una por una). */
  #tp-cats{--text3:#2f5233}
  [data-skin="neobrutal-night"] #tp-cats{--text3:#d4d4d8}
  #tp-cats [style*="font-size:9px"]{font-size:11px!important}
  #tp-cats [style*="font-size:9.5px"]{font-size:11.5px!important}
  #tp-cats [style*="font-size:10px"]{font-size:12px!important}
  #tp-cats [style*="font-size:11px"]{font-size:13px!important}
  #tp-cats [style*="font-size:12px"]{font-size:14px!important}`;
  document.head.appendChild(s);
})();

/* [Etapa C, PLAN_CATEGORIAS_SUBCATEGORIAS.md — sección 3.2]
   `selectedSubcats` es opcional — se usa solo para la carga inicial
   (formulario "Editar" con un pin que ya tenía subcategorías
   guardadas). En los toggles posteriores de categoría, el selector de
   subcategorías se reconstruye solo (ver toggleCatChip) preservando
   lo que ya estaba tildado. */
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

/* [Etapa C, PLAN_CATEGORIAS_SUBCATEGORIAS.md — sección 3.2]
   Recorre todas las categorías (builtin + custom) buscando en qué
   subcategoría vive `subId` — hace falta porque los ids de
   subcategoría son únicos globalmente (mismo criterio que el resto
   del plan), pero el objeto vive anidado adentro de su categoría
   padre, no hay un mapa plano ya armado. */
function _findSubcatOwner(subId) {
  const all = getAllCats();
  for (const [catId, cat] of Object.entries(all)) {
    if (cat.subcategories && cat.subcategories[subId]) {
      return { catId, cat, sub: cat.subcategories[subId] };
    }
  }
  return null;
}

/* [Etapa C, PLAN_CATEGORIAS_SUBCATEGORIAS.md — sección 3.2]
   Arma (o reconstruye) la fila de chips de subcategoría de un
   formulario, filtrada dinámicamente: solo muestra subcategorías
   ACTIVAS que pertenezcan a alguna de las categorías principales ya
   tildadas en `catContainerId` (unión, si hay más de una tildada).
   `forceSelected`: solo se usa en la carga inicial (ver
   buildMultiCatSelector). Si no se pasa, preserva lo que ya estuviera
   tildado en el selector de subcategorías actual, descartando
   automáticamente cualquier subcategoría "huérfana" cuya categoría
   padre se acaba de destildar (regla explícita de la sección 3.2).
   Convención de nombres: 'cat-chips-add' -> 'subcat-chips-add',
   'cat-chips-edit' -> 'subcat-chips-edit'. */
function _rebuildSubcatSelector(catContainerId, forceSelected) {
  const subContainerId = catContainerId.replace('cat-chips-', 'subcat-chips-');
  const subContainer = document.getElementById(subContainerId);
  if (!subContainer) return;

  const mainCatIds = getSelectedCats(catContainerId);
  const previouslyOn = forceSelected !== undefined
    ? new Set(forceSelected)
    : new Set(getSelectedSubcats(subContainerId));

  const all = getAllCats();
  const eligible = []; // [{subId, sub, parentColor}]
  mainCatIds.forEach(catId => {
    const cat = all[catId];
    if (!cat || !cat.subcategories) return;
    Object.entries(cat.subcategories).forEach(([subId, sub]) => {
      if (sub.active === false) return;
      if (eligible.some(e => e.subId === subId)) return; // ya agregada (unión)
      eligible.push({ subId, sub, parentColor: cat.color });
    });
  });

  if (!eligible.length) {
    subContainer.innerHTML = mainCatIds.length
      ? '' // categoría(s) tildada(s) pero sin subcategorías cargadas — fila vacía, sin mensaje (no es un error)
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
  // [Etapa C] cada toggle de categoría principal puede cambiar qué
  // subcategorías son elegibles — se reconstruye la fila de abajo.
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

/* [Etapa C, PLAN_CATEGORIAS_SUBCATEGORIAS.md — sección 3.2]
   Análoga a getSelectedCats pero para el nuevo selector de
   subcategorías (poi.subcategories). */
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

/* [i18n 2026-09-26] La fila de filtros pública (Todo/Eventos/
   categorías) ya resolvía bien el idioma activo en cada label
   (getCatLabel ya leía AppState.getLanguage()) pero nunca se
   refrescaba SOLA al tocar el selector de idioma del header — recién
   se veía el cambio si el admin togleaba algo. Con esto alcanza con
   updateFilterBar(), que ya es idempotente (ver su propio comentario
   sobre "barata y siempre termina en el estado correcto"). */
if (typeof AppState !== 'undefined') {
  AppState.on(AppState.EVENTS.LANGUAGE_CHANGED, () => {
    if (typeof updateFilterBar === 'function') updateFilterBar();
  });
}




