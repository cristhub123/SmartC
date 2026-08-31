/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/* admin.js — admin panel, switchTab, pickMode, toast, swipe */
/* ═══════════════════════════════════════════
   ADMIN PANEL
═══════════════════════════════════════════ */

/* ═══════════════════════════════════════════
   BARRITAS DE ESTADO (Entrega 3 del plan multi-ciudad)
   ---------------------------------------------------------------
   5 indicadores por lugar, para ver de un vistazo qué le falta a
   cada uno sin tener que entrar a revisarlo 1x1. Doble función:
   muestran el estado Y sirven de filtro clickeable (una fila igual
   arriba de la lista, alineada en columnas).
   - 🔴🔵🟢 son binarias (dos estados reales: 'empty'/'full').
   - ⚫ (night) y 🟡 (revisado) tienen 3 estados reales:
     'empty' / 'half' / 'full'.
   Como FILTRO, cada barrita cicla: sin filtro → exigir llena →
   (si tiene 3 estados) exigir mitad → exigir vacía → sin filtro.
═══════════════════════════════════════════ */

const BAR_DEFS = [
  { key: 'red',   color: '#ef4444', title: 'Tiene imágenes cargadas',      states: 2 },
  { key: 'blue',  color: '#3b82f6', title: 'Tiene algún campo de info',    states: 2 },
  { key: 'black', color: '#111111', title: 'Variante "night" (cargada / activa)', states: 3 },
  { key: 'green', color: '#22c55e', title: 'Tiene coordenadas',            states: 2 },
  { key: 'gold',  color: '#eab308', title: 'Revisado por el admin',        states: 3 },
  { key: 'purple', color: '#8b5cf6', title: 'Visible al público (mismo tilde que "visible al público" de cada fila)', states: 2 },
];

/**
 * Calcula el estado de las 5 barritas para un pin puntual.
 * @param {Object} p
 * @returns {{red:string, blue:string, black:string, green:string, gold:string}}
 */
function computePinBarStates(p) {
  const hasImages = !!(p.skins && Object.keys(p.skins).length) || !!p.imgB64;

  const hasInfo = !!(
    (p.desc && p.desc.trim()) ||
    (p.hist && p.hist.trim() && p.hist !== 'Sin datos históricos.') ||
    (p.attrs && p.attrs.length) ||
    (p.phone && p.phone.trim()) ||
    (p.hours && p.hours.trim()) ||
    (p.tags && p.tags.length)
  );

  let black = 'empty';
  if (p.skins) {
    const nightKey = Object.keys(p.skins).find(k => k.toLowerCase().includes('night'));
    if (nightKey) black = p.skins[nightKey].active ? 'full' : 'half';
  }

  const hasCoords = typeof p.lat === 'number' && typeof p.lng === 'number';

  let gold = 'empty';
  if (p.reviewed) gold = p.reviewedDirty ? 'half' : 'full';

  return {
    red:   hasImages ? 'full' : 'empty',
    blue:  hasInfo   ? 'full' : 'empty',
    black,
    green: hasCoords ? 'full' : 'empty',
    gold,
    purple: p.clicksPublicVisible ? 'full' : 'empty',
  };
}

/* Filtro de estado activo — null en una barrita = "sin filtro" para
   esa columna. Se guarda acá porque tiene que sobrevivir entre
   renders (cada click en la fila maestra dispara un renderList()). */
let _barsFilter = { red: null, blue: null, black: null, green: null, gold: null, purple: null };

/** Ciclo de estados al hacer click, según cuántos tiene la barrita. */
function _cycleBarFilter(key, def) {
  const order = def.states === 3 ? [null, 'full', 'half', 'empty'] : [null, 'full', 'empty'];
  const idx = order.indexOf(_barsFilter[key]);
  _barsFilter[key] = order[(idx + 1) % order.length];
}

function _pinMatchesBarsFilter(p) {
  const states = computePinBarStates(p);
  return BAR_DEFS.every(def => !_barsFilter[def.key] || states[def.key] === _barsFilter[def.key]);
}

/** Un solo bloque de HTML para las 5 barritas — se reusa tanto para
 *  pintar el estado de un pin como (con `clickable:true`) para la
 *  fila maestra de filtro arriba de la lista. */
function _renderBarsHTML(states, clickable) {
  return BAR_DEFS.map(def => {
    const state = states ? states[def.key] : (_barsFilter[def.key] || 'off');
    let opacity = '1', bg = def.color;
    if (state === 'empty' || state === 'off') { bg = '#d1d5db'; opacity = clickable && _barsFilter[def.key] === 'empty' ? '1' : '.5'; }
    else if (state === 'half') { opacity = '.55'; }
    const attrs = clickable ? `data-bar-filter="${def.key}" style="cursor:pointer;` : `style="`;
    return `<span ${attrs}display:inline-block;width:7px;height:18px;border-radius:2px;background:${bg};opacity:${opacity};" title="${def.title}${clickable ? ' — click para filtrar' : ''}"></span>`;
  }).join('');
}

function _renderBarsFilterRow() {
  const row = document.getElementById('bars-filter-row');
  if (!row) return;
  row.innerHTML = _renderBarsHTML(null, true);
  row.querySelectorAll('[data-bar-filter]').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.barFilter;
      const def = BAR_DEFS.find(d => d.key === key);
      _cycleBarFilter(key, def);
      _renderBarsFilterRow();
      renderList();
    });
  });
}

/* === TOAST — avisos chicos flotantes (RECONSTRUIDA: se había
   perdido en algún momento, aunque se seguía llamando 63 veces
   en todo el proyecto — por eso nada guardaba correctamente,
   cualquier función que llamara a toast() se cortaba con error). === */
let _toastTimer = null;
function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  if (!el) { console.warn('toast() sin contenedor #toast en el HTML:', msg); return; }
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('on'), ms);
}

document.getElementById('btn-admin').addEventListener('click', () => {
  // [2026-08-26, fix de seguridad] `_adminUser` ahora solo queda
  // completo si la cuenta logueada está en admins/{uid} — ver
  // js/admin-auth.js. Si el chequeo async todavía está en curso
  // (recién se cargó la página, por ejemplo), no se abre nada
  // todavía en vez de arriesgar un falso positivo.
  if (_isCheckingAdmin) return;
  if (_adminUser) {
    // [NUEVO 2026-08-31, PLAN_FIX_CIERRE_PANELES.md Punto 2] Antes
    // abría directo — si el panel de un lugar estaba abierto, quedaba
    // solapado debajo del admin. Pasa por OverlayManager como el
    // resto de los paneles (ver registro más abajo).
    if (window.OverlayManager) window.OverlayManager.beforeOpen('admin', openAdmin);
    else openAdmin();
  }
  else showAdminLogin();
});
document.getElementById('admin-close').addEventListener('click', closeAdmin);
// [NUEVO 2026-08-31] Guarda anti-selección-de-texto-arrastrada — ver
// js/ui-guards.js (Punto 1, PLAN_FIX_CIERRE_PANELES.md). Cris lo
// reportó explícitamente: pintar texto en un campo del admin y
// soltar afuera no debe cerrar el panel.
document.getElementById('overlay').addEventListener('click', e => {
  if (window.UIGuards && window.UIGuards.wasTextDragRelease(e)) return;
  closeAdmin();
});

async function openAdmin() {
  document.getElementById('admin').classList.add('open');
  document.getElementById('overlay').classList.add('on');
  document.getElementById('btn-admin').classList.add('active');

  // [NUEVO 2026-08-29 — PLAN_OPTIMIZACION_PERFORMANCE_2026-08-29.md,
  // punto 6.1] El mapa público solo carga los pines del área visible
  // (ver js/pins-viewport-loader.js) — pero acá, en el panel Admin,
  // hace falta ver/editar/borrar CUALQUIER pin exista o no en
  // pantalla. Se fuerza una recarga completa sin recorte (misma
  // función de siempre, `loadPOISFromFirestore()`, intacta) antes de
  // armar la lista, y se dibuja el marcador de cualquier pin que el
  // mapa todavía no tuviera.
  toast('⏳ Cargando todos los lugares...');
  await loadPOISFromFirestore();
  POIS.forEach(poi => {
    if (markers[poi.id]) return; // ya estaba dibujado, no duplicar
    try {
      makeMarker(poi);
    } catch (err) {
      console.error('[openAdmin] No se pudo crear el marcador de', poi.id, '— se sigue con el resto:', err);
    }
  });

  renderList();
  switchTab('list');
}
function closeAdmin() {
  document.getElementById('admin').classList.remove('open');
  document.getElementById('overlay').classList.remove('on');
  document.getElementById('btn-admin').classList.remove('active');
  stopPickMode();
}

// [NUEVO 2026-08-31, PLAN_FIX_CIERRE_PANELES.md Punto 2] Registro en
// OverlayManager (ver js/overlay-manager.js, mismo patrón que
// js/poi-panel.js y js/zones.js): al abrir el admin vía
// `OverlayManager.beforeOpen` de arriba, esto cierra automáticamente
// el panel del lugar (u otro overlay) si estaba abierto — antes
// quedaban los dos solapados.
if (window.OverlayManager) {
  window.OverlayManager.register('admin', {
    isOpen: () => document.getElementById('admin').classList.contains('open'),
    close: closeAdmin,
  });
}

document.querySelectorAll('.atab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.t)));

function switchTab(t) {
  document.querySelectorAll('.atab').forEach(a => a.classList.toggle('on', a.dataset.t === t));
  document.querySelectorAll('.tpane').forEach(p => p.classList.remove('on'));
  const targets = {list:'tp-list', add:'tp-add', edit:'tp-edit', global:'tp-global',
    'zonas-admin':'tp-zonas-admin', 'temas-admin':'tp-temas-admin', roadmap:'tp-roadmap', groups:'tp-groups', cats:'tp-cats', mapa:'tp-mapa',
    typography:'tp-typography', locations:'tp-locations',
    'eventos-admin':'tp-eventos-admin', 'usuarios-admin':'tp-usuarios-admin'}; // [Etapa 3/7, PLAN_USUARIOS_EVENTOS.md]
  const el = document.getElementById(targets[t]);
  if (el) el.classList.add('on');
  // Fire registered tab plugins (replaces all monkey-patching)
  if (window.SC && SC._tabPlugins && SC._tabPlugins[t]) {
    SC._tabPlugins[t].forEach(fn => { try { fn(); } catch(e) { console.warn('tabPlugin err',t,e); } });
  }
}
window.switchTab = switchTab;

/* ── LIST TAB ── */
function renderList() {
  const c = document.getElementById('admin-list');

  // Filtro geográfico (país/provincia/ciudad) — a diferencia de antes,
  // esto ya NO es opcional: con varias ciudades cargadas, mostrar todo
  // por defecto significaría listar de una cientos de pines mezclados.
  // Ahora hace falta elegir las 3 (país + provincia + ciudad) para que
  // aparezca cualquier pin — si falta alguna, se muestra un aviso en
  // vez de la lista.
  const fCountry  = document.getElementById('list-filter-country')?.value || '';
  const fProvince = document.getElementById('list-filter-province')?.value || '';
  const fCity     = document.getElementById('list-filter-city')?.value || '';
  // "🌐 Mostrar todo" (valor especial en el dropdown Ciudad) ignora
  // país/provincia/ciudad por completo — incluye también los pines
  // que no tienen ninguna ubicación cargada, cosa que el filtro
  // normal (comparación exacta contra fCity) siempre dejaría afuera.
  const showAllGeo = fCity === '__ALL__';

  // Filtro de texto por nombre — sin distinguir mayúsculas/acentos.
  const fTextRaw = document.getElementById('list-text-filter')?.value || '';
  const fText = fTextRaw.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (!POIS.length) {
    c.innerHTML = '<div class="empty-state"><div class="big">📭</div>No hay lugares cargados.<br>Usá el botón ➕ para agregar.</div>';
    return;
  }

  if (!showAllGeo && (!fCountry || !fProvince || !fCity)) {
    c.innerHTML = '<div class="empty-state"><div class="big">📍</div>Elegí país, provincia y ciudad arriba para ver sus lugares.</div>';
    return;
  }

  const filteredPOIS = POIS.filter(p => {
    if (!showAllGeo) {
      if (fCountry  && p.country  !== fCountry)  return false;
      if (fProvince && p.province !== fProvince) return false;
      if (fCity     && p.city     !== fCity)     return false;
    }
    if (fText) {
      const name = (p.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (!name.includes(fText)) return false;
    }
    return true;
  });

  if (!filteredPOIS.length) {
    c.innerHTML = '<div class="empty-state"><div class="big">🔍</div>Ningún lugar coincide con los filtros activos.</div>';
    return;
  }

  // Barritas de estado (incluida "visible al público"): ya NO ocultan
  // los que no cumplen — los separan al final de la lista, atenuados,
  // para no perder de vista lugares que igual podrías querer tocar.
  // Con ningún filtro de barrita activo, todos "cumplen" trivialmente
  // y queda una sola lista, simplemente en orden alfabético.
  const byName = (a, b) => (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' });
  const matching    = filteredPOIS.filter(p =>  _pinMatchesBarsFilter(p)).sort(byName);
  const nonMatching = filteredPOIS.filter(p => !_pinMatchesBarsFilter(p)).sort(byName);
  const anyBarFilterActive = Object.values(_barsFilter).some(v => v !== null);

  const renderRow = (p) => {
    const cats = Array.isArray(p.categories) && p.categories.length
      ? p.categories.map(k => CAT[k]).filter(Boolean)
      : [CAT[p.category] || {label: p.category||'—', color:'#6055d8'}];
    const mainCat = cats[0] || {label:'—', color:'#6055d8'};
    const isOn = p.active !== false;
    const clicksPublicOn = !!p.clicksPublicVisible;
    const faltaUbicacion = !(typeof p.lat === 'number' && typeof p.lng === 'number');
    const sinCiudad = !p.city;
    const barsHTML = _renderBarsHTML(computePinBarStates(p), false);
    // _rowOpacityFor ya resuelve las 2 razones posibles de atenuado
    // (no cumple el filtro de barritas / pin desactivado) sin sumarlas.
    const rowOpacity = _rowOpacityFor(p);
    return `<div class="poi-row ${sinCiudad ? 'poi-row--sin-ciudad' : ''}" style="${rowOpacity ? `opacity:${rowOpacity}` : ''}">
      <div class="poi-row-ico" style="background:${mainCat.color}20">${p.icon}</div>
      <div class="poi-row-info">
        <div class="poi-row-name">${p.name} ${faltaUbicacion ? '<span style="color:var(--amber);font-size:11px;font-weight:700">📍 Falta ubicación</span>' : ''} ${sinCiudad ? '<span style="color:#ef4444;font-size:11px;font-weight:700">🏙️ Sin ciudad</span>' : ''}</div>
        <div class="poi-row-cat" style="color:${mainCat.color}">${cats.map(c=>c.label).join(' · ')}</div>
        <div style="display:flex;gap:3px;margin-top:4px">${barsHTML}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px;display:flex;align-items:center;gap:8px">
          👁 ${p.clicks || 0} clicks
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
            <input type="checkbox" ${clicksPublicOn?'checked':''} onchange="togglePublicClicks('${p.id}',this.checked)" style="margin:0">
            visible al público
          </label>
        </div>
      </div>
      <div class="poi-row-btns">
        <button class="za-toggle ${isOn?'on':''}" onclick="togglePoi('${p.id}',this)" title="${isOn?'Desactivar':'Activar'}"></button>
        <button class="ibtn" onclick="startEdit('${p.id}')" title="Editar">✏️</button>
        <button class="ibtn del" onclick="askDelete('${p.id}')" title="Eliminar">🗑️</button>
      </div>
    </div>`;
  };

  const divider = (anyBarFilterActive && nonMatching.length)
    ? `<div style="display:flex;align-items:center;gap:8px;margin:10px 0;color:var(--text3);font-size:11px">
         <div style="flex:1;height:1px;background:var(--border)"></div>
         No cumplen el filtro activo
         <div style="flex:1;height:1px;background:var(--border)"></div>
       </div>`
    : '';

  c.innerHTML = matching.map(p => renderRow(p)).join('')
    + divider
    + nonMatching.map(p => renderRow(p)).join('');
}

(function _wireListFilters() {
  const textInput = document.getElementById('list-text-filter');
  if (textInput) textInput.addEventListener('input', renderList);

  const clearBtn = document.getElementById('btn-bars-filter-clear');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    Object.keys(_barsFilter).forEach(k => { _barsFilter[k] = null; });
    _renderBarsFilterRow();
    renderList();
  });

  _renderBarsFilterRow();
})();

window.togglePublicClicks = function(id, checked) {
  const p = POIS.find(x => x.id === id);
  if (!p) return;
  p.clicksPublicVisible = checked;
  savePoiToFirestore(p);
  syncAppStateWithPOIS(); // [NUEVO 2026-08-13] ver nota en firestore-sync.js
  regeneratePublicCache(); // [CORREGIDO 2026-08-13] antes lo hacía savePoiToFirestore por dentro
  toast(checked ? '✅ El conteo ahora es visible al público' : '⭕ El conteo ya no es visible al público');
  // Este checkbox alimenta la barrita/filtro "purple" nueva — sin este
  // refresh, la fila quedaba con el color de barrita viejo y no
  // reubicaba el pin entre "cumple"/"no cumple" si había un filtro activo.
  renderList();
};

/** Misma regla de opacidad que usa cada fila al pintarse — reusada acá
 *  para que togglePoi() no pise el atenuado por "no cumple el filtro
 *  de barritas" con el atenuado por "pin desactivado" (no se suman,
 *  gana el más bajo de los dos). */
function _rowOpacityFor(p) {
  if (!_pinMatchesBarsFilter(p)) return '.4';
  return p.active !== false ? '' : '.5';
}

window.togglePoi = function(id, btn) {
  const p = POIS.find(x => x.id === id);
  if (!p) return;
  p.active = !(p.active !== false);
  btn.classList.toggle('on', p.active);
  const row = btn.closest('.poi-row');
  if (row) { const op = _rowOpacityFor(p); row.style.opacity = op || ''; }
  // Show/hide marker on map
  const m = markers[id];
  if (m) {
    const el = document.getElementById('pw-' + id);
    if (el) el.style.display = p.active ? '' : 'none';
    const markerEl = el && el.parentElement;
    if (markerEl) markerEl.style.visibility = p.active ? '' : 'hidden';
  }
  if (!p.active && expandedId === id) { collapsePin(id); closePoiPanel(); }
  savePoiToFirestore(p); // sincroniza el estado activo/inactivo con la base de datos
  syncAppStateWithPOIS(); // [NUEVO 2026-08-13] ver nota en firestore-sync.js
  regeneratePublicCache(); // [CORREGIDO 2026-08-13] antes lo hacía savePoiToFirestore por dentro
  toast(p.active ? `✅ "${p.name}" activado` : `⭕ "${p.name}" desactivado`);
};

/* ── ADD TAB ── */
// Emoji grid — add form
document.querySelectorAll('#eg-add .eopt').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('#eg-add .eopt').forEach(e => e.classList.remove('sel'));
    el.classList.add('sel');
    addEmoji = el.dataset.e;
  });
});

/* ═══════════════════════════════════════════════════════════
   ID (tab "Nuevo") — autocompletado editable
   NOTA: el autocompletado real vive en js/pin-adjust.js
   (_wireAddIdPreview/updateAddIdPreview), que sí usa la sigla de
   3 letras de la ciudad (getCitySuffixFor, cities.js) en vez del
   código de ciudad completo. Este bloque quedaba compitiendo por
   el mismo campo #a-slug y pisaba ese valor con el cityCode
   completo (ej. "c-cba" en vez de "cba") — se saca de acá para
   que no haya dos sistemas escribiendo el mismo input.
   ═══════════════════════════════════════════════════════════ */
window._addSlugTouched = false;

// Sync lat/lng inputs → coord display
['a-lat','a-lng'].forEach(id => {
  document.getElementById(id).addEventListener('input', syncAddCoordDisplay);
});
function syncAddCoordDisplay() {
  const lat = document.getElementById('a-lat').value;
  const lng = document.getElementById('a-lng').value;
  const d   = document.getElementById('a-coord-display');
  if (lat && lng) {
    d.textContent = `${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}`;
    d.classList.add('set');
  } else {
    d.textContent = 'Sin coordenadas — usá el botón de abajo';
    d.classList.remove('set');
  }
}

document.getElementById('btn-pick-add').addEventListener('click', () => {
  // OJO: NO llamar a closeAdmin() acá — closeAdmin() internamente
  // llama a stopPickMode(), que desregistra el listener de click que
  // startPickMode() acaba de registrar, apagando el modo "elegir en
  // el mapa" en el mismo instante en que se prendía (por eso nunca
  // se colocaba el pin). startPickMode() ya oculta el admin por su
  // cuenta (`#admin { display: none }`), así que no hace falta nada
  // más acá.
  startPickMode('add');
});

// btn-save-add listener handled in image block

/* ── EDIT TAB ── */
window.startEdit = function(id) {
  const p = POIS.find(x => x.id === id);
  if (!p) return;
  editingId = id;

  document.getElementById('e-name').value = p.name;
  document.getElementById('e-desc').value = p.desc  || '';
  document.getElementById('e-hist').value = p.hist  || '';
  document.getElementById('e-soc').value  = (p.soc||[]).join(', ');
  document.getElementById('e-tags').value = (p.tags||[]).join(', ');
  const _ePhone = document.getElementById('e-phone'); if (_ePhone) _ePhone.value = p.phone || '';
  const _eHours = document.getElementById('e-hours'); if (_eHours) _eHours.value = p.hours || '';
  // [Mejora asignación de dueño por email, 2026-08-21] El campo de mail
  // arranca SIEMPRE vacío (solo se completa si querés CAMBIAR el dueño).
  // Abajo se muestra en texto quién es el dueño actual, resuelto desde
  // su UID guardado (requiere permiso de lectura de "usuarios" para
  // admins en las reglas de Firestore — ver FIRESTORE_RULES_NOTES.md).
  const _eOwnerEmail = document.getElementById('e-owner-email'); if (_eOwnerEmail) _eOwnerEmail.value = '';
  const _eOwnerCurrent = document.getElementById('e-owner-current');
  if (_eOwnerCurrent) {
    if (!p.ownerId) {
      _eOwnerCurrent.textContent = 'Sin dueño asignado actualmente.';
    } else {
      _eOwnerCurrent.textContent = 'Buscando dueño actual…';
      db.collection('usuarios').doc(p.ownerId).get()
        .then(snap => {
          _eOwnerCurrent.textContent = snap.exists
            ? `Dueño actual: ${snap.data().email || '(sin mail en su perfil)'}`
            : 'Dueño actual: cuenta no encontrada (UID guardado sin perfil de usuario).';
        })
        .catch(() => { _eOwnerCurrent.textContent = 'No se pudo consultar el dueño actual (revisá permisos de Firestore).'; });
    }
  }
  // [Etapa 3] precarga con content[idioma].fields[] (esquema nuevo),
  // no con p.attrs (legado) — el editor nuevo ya no lo lee.
  if (typeof _renderPinFieldsEditor === 'function') _renderPinFieldsEditor('e-attrs-wrap', p.content || {});

  // Main image
  const prev = document.getElementById('img-prev-edit');
  const lbl  = document.getElementById('img-lbl-edit');
  const wrap = document.getElementById('iu-edit');
  if (p.imgB64) {
    prev.innerHTML = `<img src="${p.imgB64}" alt="preview">`;
    lbl.textContent = 'Imagen actual — clic para cambiar';
    wrap.classList.add('has-img');
    window._editImgB64 = p.imgB64;
  } else {
    prev.innerHTML = '🏙️';
    lbl.textContent = 'Cambiar imagen';
    wrap.classList.remove('has-img');
    window._editImgB64 = null;
  }

  // Alt images (variantes) — [MIGRADO 2026-08-13] antes eran 3
  // preloads fijos leyendo el campo legado imgAlt1/2/3 (que nunca se
  // mostraba en ningún lado público). Ahora AltSlotsEdit.reset() lee
  // directo de poi.skins y recrea tantos slots como variantes "altN"
  // tenga el lugar, más uno vacío al final.
  if (typeof AltSlotsEdit !== 'undefined' && AltSlotsEdit) AltSlotsEdit.reset(p.skins);

  // Imagen banner del panel — [NUEVO 2026-08-15] campo aparte de
  // p.imgB64/p.skins (ver nota de cabecera del bloque de uploaders en
  // utils.js). Vive en p.banner.url.
  const bannerPrev = document.getElementById('img-prev-banner-edit');
  const bannerLbl  = document.getElementById('img-lbl-banner-edit');
  const bannerWrap = document.getElementById('iu-banner-edit');
  if (bannerPrev && bannerLbl && bannerWrap) {
    if (p.banner && p.banner.url) {
      bannerPrev.innerHTML = `<img src="${p.banner.url}" alt="banner">`;
      bannerLbl.textContent = 'Imagen actual — clic para cambiar';
      bannerWrap.classList.add('has-img');
      window._editBannerImg = p.banner.url;
    } else {
      bannerPrev.innerHTML = '🖼️';
      bannerLbl.textContent = 'Cambiar imagen banner';
      bannerWrap.classList.remove('has-img');
      window._editBannerImg = null;
    }
  }

  document.getElementById('e-lat').value  = p.lat;
  document.getElementById('e-lng').value  = p.lng;
  syncEditCoordDisplay();

  // Campos de ubicación para la carpeta dinámica de Cloudinary (ver
  // js/cloudinary-admin.js). Antes: se pisaba el valor a mano con
  // `.value =`, leyendo además `p.state` (el campo real del esquema
  // es `p.province`, no `p.state` — por eso la provincia real del pin
  // nunca se reflejaba acá). Ahora usa la cascada de `cities.js`, con
  // default = la ubicación YA GUARDADA de este pin — pero queda
  // editable a mano si hace falta reubicar sus imágenes a otra ciudad.
  if (typeof initEditLocationDropdowns === 'function') {
    initEditLocationDropdowns({ country: p.country, province: p.province, city: p.city });
  }

  editEmoji = p.icon;
  document.querySelectorAll('#eg-edit .eopt').forEach(e => e.classList.toggle('sel', e.dataset.e === p.icon));

  // Multi-category chips — populated after getAllCats is available (deferred)
  setTimeout(() => {
    const cats = Array.isArray(p.categories) && p.categories.length ? p.categories : (p.category ? [p.category] : []);
    if (typeof buildMultiCatSelector === 'function') buildMultiCatSelector('cat-chips-edit', cats);
  }, 0);

  document.getElementById('tab-edit-btn').style.display = 'flex';
  switchTab('edit');
};

document.querySelectorAll('#eg-edit .eopt').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('#eg-edit .eopt').forEach(e => e.classList.remove('sel'));
    el.classList.add('sel');
    editEmoji = el.dataset.e;
  });
});

['e-lat','e-lng'].forEach(id => {
  document.getElementById(id).addEventListener('input', syncEditCoordDisplay);
});
function syncEditCoordDisplay() {
  const lat = document.getElementById('e-lat').value;
  const lng = document.getElementById('e-lng').value;
  const d   = document.getElementById('e-coord-display');
  if (lat && lng) {
    d.textContent = `${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}`;
    d.classList.add('set');
  } else {
    d.textContent = '—';
    d.classList.remove('set');
  }
}

document.getElementById('btn-pick-edit').addEventListener('click', () => {
  // Mismo bug que btn-pick-add — ver el comentario ahí.
  startPickMode('edit');
});

// btn-save-edit listener handled in image block
document.getElementById('btn-cancel-edit').addEventListener('click', () => {
  document.getElementById('tab-edit-btn').style.display = 'none';
  switchTab('list');
  editingId = null;
});

/* ── DELETE ── */
window.askDelete = function(id) {
  pendingDelId = id;
  const p = POIS.find(x => x.id === id);
  document.getElementById('modal-msg').textContent = `¿Eliminar "${p?.name||'este lugar'}"? Esta acción no se puede deshacer.`;
  document.getElementById('modal-confirm').classList.add('on');
};
document.getElementById('mc-cancel').addEventListener('click', () => {
  pendingDelId = null;
  document.getElementById('modal-confirm').classList.remove('on');
});
document.getElementById('mc-delete').addEventListener('click', () => {
  if (pendingDelId === null) return;
  const p = POIS.find(x => x.id === pendingDelId);
  POIS = POIS.filter(x => x.id !== pendingDelId);
  removeMarker(pendingDelId);
  deletePoiFromFirestore(pendingDelId); // borra de verdad en la base de datos
  syncAppStateWithPOIS(); // [NUEVO 2026-08-13] ver nota en firestore-sync.js — sin esto, AppState (y por lo tanto el panel) seguía viendo el pin borrado
  regeneratePublicCache(); // [CORREGIDO 2026-08-13] antes lo hacía deletePoiFromFirestore por dentro
  if (expandedId === pendingDelId) { closePoiPanel(); expandedId = null; }
  document.getElementById('modal-confirm').classList.remove('on');
  toast(`🗑️ "${p?.name}" eliminado`);
  renderList();
  pendingDelId = null;
});

/* ═══════════════════════════════════════════
   PICK MODE — click on map to set coordinates
═══════════════════════════════════════════ */
let tempMarker = null;

function startPickMode(ctx) {
  pickCtx = ctx;
  // [Etapa 6, PLAN_USUARIOS_EVENTOS.md] 'user-evento-pin': Camino B del
  // formulario de eventos dentro del panel de usuario (no del admin) —
  // acá lo que hay que ocultar es el panel de usuario, no el admin.
  if (ctx === 'user-evento-pin') {
    document.getElementById('user-panel-overlay')?.classList.remove('on');
  } else {
    // Completely hide admin so map is fully interactive
    document.getElementById('admin').style.display = 'none';
    document.getElementById('overlay').classList.remove('on');
  }
  document.getElementById('map').classList.add('picking');
  document.getElementById('pick-banner').classList.add('on');
  // Use a named handler so we can remove it cleanly
  map._pickHandler = function(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    // Temp visual marker
    if (tempMarker) { tempMarker.remove(); tempMarker = null; }
    tempMarker = L.circleMarker([lat, lng], {
      radius: 12, color: '#d4370f', weight: 3,
      fillColor: '#d4370f', fillOpacity: .35
    }).addTo(map);
    setTimeout(() => { if (tempMarker) { tempMarker.remove(); tempMarker = null; } }, 4000);
    if (ctx === 'add') {
      document.getElementById('a-lat').value = lat.toFixed(6);
      document.getElementById('a-lng').value = lng.toFixed(6);
      syncAddCoordDisplay();
    } else if (ctx === 'zona') {
      document.getElementById('ze-lat').value = lat.toFixed(6);
      document.getElementById('ze-lng').value = lng.toFixed(6);
      if (typeof _syncZonaCoordDisplay === 'function') _syncZonaCoordDisplay();
    } else if (ctx === 'evento-pin') {
      // [Etapa 3, PLAN_USUARIOS_EVENTOS.md] Camino B: pin mínimo del
      // lugar de un evento, ver js/eventos.js.
      document.getElementById('evt-pin-lat').value = lat.toFixed(6);
      document.getElementById('evt-pin-lng').value = lng.toFixed(6);
      if (typeof _syncEvtPinCoordDisplay === 'function') _syncEvtPinCoordDisplay();
    } else if (ctx === 'user-evento-pin') {
      // [Etapa 6] Camino B del formulario de eventos del panel de
      // usuario (autoservicio), ver js/user-panel.js.
      document.getElementById('up-evt-pin-lat').value = lat.toFixed(6);
      document.getElementById('up-evt-pin-lng').value = lng.toFixed(6);
      if (typeof _syncUpEvtPinCoordDisplay === 'function') _syncUpEvtPinCoordDisplay();
    } else {
      document.getElementById('e-lat').value = lat.toFixed(6);
      document.getElementById('e-lng').value = lng.toFixed(6);
      syncEditCoordDisplay();
    }
    stopPickMode();
    if (ctx === 'user-evento-pin') {
      if (typeof reopenUserPanelAfterPick === 'function') reopenUserPanelAfterPick();
    } else {
      openAdmin();
      if (ctx === 'edit') switchTab('edit');
      if (ctx === 'zona') switchTab('zonas-admin');
      if (ctx === 'evento-pin') switchTab('eventos-admin');
    }
    toast(`📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
  };
  map.on('click', map._pickHandler);
}

function stopPickMode() {
  if (map._pickHandler) { map.off('click', map._pickHandler); map._pickHandler = null; }
  pickCtx = null;
  document.getElementById('admin').style.display = '';
  document.getElementById('map').classList.remove('picking');
  document.getElementById('pick-banner').classList.remove('on');
}

document.getElementById('pick-banner-cancel').addEventListener('click', () => {
  const wasUserEvtPin = pickCtx === 'user-evento-pin';
  stopPickMode();
  if (wasUserEvtPin) {
    if (typeof reopenUserPanelAfterPick === 'function') reopenUserPanelAfterPick();
  } else {
    openAdmin();
  }
});



