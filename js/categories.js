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

function getAllCats() {
  const result = {};
  Object.entries(CAT).forEach(([k,v]) => { result[k] = {...v, builtin:true, active: v.active !== false}; });
  Object.entries(CUSTOM_CATS).forEach(([k,v]) => { result[k] = {...v, builtin:false}; });
  return result;
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
    return `<div class="za-row" style="${isOn?'':'opacity:.55'}">
      <span style="font-size:18px;flex-shrink:0">${cat.icon||'🏷'}</span>
      <span class="za-name" style="color:${cat.color}">${cat.label} <small style="color:var(--text3);font-size:10px">(${count})</small></span>
      ${cat.builtin?'<span style="font-size:9px;color:var(--text3);font-family:var(--font-m)">BASE</span>':`<button class="za-edit-btn" onclick="deleteCat('${id}')" title="Eliminar">🗑</button>`}
      <button class="za-toggle ${isOn?'on':''}" onclick="toggleCat('${id}',this)" title="${isOn?'Desactivar':'Activar'}"></button>
    </div>`;
  }).join('');
}

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
  toast(newState ? `✅ "${cat.label}" activada` : `⭕ "${cat.label}" desactivada`);
};

window.deleteCat = function(id) {
  if (!CUSTOM_CATS[id]) return;
  const name = CUSTOM_CATS[id].label;
  delete CUSTOM_CATS[id];
  renderCatsAdmin();
  updateFilterBar();
  toast(`🗑 "${name}" eliminada`);
};

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
    <div class="fbtn-circle" style="background:#2d4030">${LUCIDE.all}</div>
    <span class="fbtn-label">Todo</span>
  </button>`;

  // [Etapa 5] Filtro especial "Eventos y actividades" — junto a los
  // de categoría, pero NO es una categoría real (no vive en
  // CAT/CUSTOM_CATS): muestra cualquier pin (evento_temporal o no)
  // con ≥1 evento vigente ahora mismo. Ver _pinMatchesActiveFilter().
  const eventosOn = activeFilter === '__eventos__';
  html += `<button class="fbtn ${eventosOn?'on':''}" data-f="__eventos__">
    <div class="fbtn-circle" style="background:#c026d3">🎉</div>
    <span class="fbtn-label">Eventos</span>
  </button>`;

  activeCats.forEach(([id, cat]) => {
    const isOn = activeFilter === id;
    const svg  = getCatIcon(cat, id);
    const label = cat.label.charAt(0).toUpperCase() + cat.label.slice(1).toLowerCase();
    html += `<button class="fbtn ${isOn?'on':''}" data-f="${id}">
      <div class="fbtn-circle" style="background:${cat.color}">${svg}</div>
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
    });
  });
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
    CUSTOM_CATS[id] = {label:name.toUpperCase(), icon, color, active:true};
    document.getElementById('nc-name').value = '';
    document.getElementById('nc-icon').value = '';
    renderCatsAdmin();
    updateFilterBar();
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
      const label = cat.label.charAt(0)+cat.label.slice(1).toLowerCase();
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



