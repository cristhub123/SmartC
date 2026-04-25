
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
   MODO DE UBICACIÓN GLOBAL (Coordenadas / Dirección)
   ═══════════════════════════════════════════════════════════ */
let _locationMode = 'coords'; // 'coords' | 'address'

async function geocodeAddress(address) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ', Córdoba, Argentina')}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
    const data = await res.json();
    if (data && data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch(e) { console.warn('Geocode error:', e); }
  return null;
}

async function switchLocationMode(mode) {
  _locationMode = mode;
  const btnC = document.getElementById('loc-mode-coords');
  const btnA = document.getElementById('loc-mode-address');
  const lbl  = document.getElementById('loc-mode-label');
  if (btnC) { btnC.className = mode === 'coords'  ? 'btn-primary' : 'btn-outline'; btnC.style.marginTop = '0'; }
  if (btnA) { btnA.className = mode === 'address' ? 'btn-primary' : 'btn-outline'; btnA.style.marginTop = '0'; }
  if (lbl)  lbl.textContent = mode === 'coords' ? 'Coordenadas' : 'Dirección';

  if (mode === 'address') {
    toast('🔄 Reubicando pines por dirección…');
    let ok = 0, fail = 0;
    for (const poi of POIS) {
      if (!poi.address) { fail++; continue; }
      const coords = await geocodeAddress(poi.address);
      if (coords) {
        poi.lat = coords.lat; poi.lng = coords.lng;
        removeMarker(poi.id); makeMarker(poi); ok++;
      } else { fail++; }
    }
    toast(`✅ ${ok} reubicados · ${fail} sin dirección`);
    applyFilter();
  }
}

const btnLocCoords = document.getElementById('loc-mode-coords');
const btnLocAddr   = document.getElementById('loc-mode-address');
if (btnLocCoords) btnLocCoords.addEventListener('click', () => switchLocationMode('coords'));
if (btnLocAddr)   btnLocAddr.addEventListener('click',   () => switchLocationMode('address'));

// Autocompletar address en el geocoder al seleccionar resultado
// Patch del geocoder para guardar display_name en el campo address
const _origSetupGeocoder = setupGeocoder;
// Sobreescribir setupGeocoder para interceptar el resultado seleccionado
// (lo hacemos escuchando el evento en el div de resultados)
['geo-results-add', 'geo-results-edit'].forEach((resId, i) => {
  const isEdit = i === 1;
  document.getElementById(resId)?.addEventListener('click', function(e) {
    const row = e.target.closest('.geocoder-result');
    if (!row) return;
    const name = row.querySelector('strong')?.textContent || '';
    const addrId = isEdit ? 'e-address' : 'a-address';
    const addrEl = document.getElementById(addrId);
    if (addrEl && name) addrEl.value = name;
  });
});

/* ═══════════════════════════════════════════════════════════
   GRUPOS DE LUGARES
   ═══════════════════════════════════════════════════════════ */
let GROUPS = []; // { id, name, desc, shareImg, shareDesc, shareHist, shareSoc, shareCats, imgB64 }

function applyGroupFields(poi) {
  if (!poi.groupId) return;
  const g = GROUPS.find(x => x.id === poi.groupId);
  if (!g) return;
  if (g.shareImg  && g.imgB64)  poi.imgB64  = g.imgB64;
  if (g.shareDesc && g.desc)    poi.desc    = g.desc;
  if (g.shareHist && g.hist)    poi.hist    = g.hist;
  if (g.shareSoc  && g.soc)     poi.soc     = [...g.soc];
  if (g.shareCats && g.cats)    { poi.categories = [...g.cats]; poi.category = g.cats[0]; }
}

function renderGroupsAdmin() {
  const list = document.getElementById('groups-admin-list');
  if (!list) return;
  if (!GROUPS.length) {
    list.innerHTML = '<div class="empty-state" style="padding:12px 0"><div class="big">📦</div>Sin grupos creados.</div>';
    return;
  }
  list.innerHTML = GROUPS.map(g => {
    const memberCount = POIS.filter(p => p.groupId === g.id).length;
    const shared = [
      g.shareImg  && '🖼 Imagen',
      g.shareDesc && '📝 Desc',
      g.shareHist && '📜 Hist',
      g.shareSoc  && '🔗 Redes',
      g.shareCats && '🏷 Categ',
    ].filter(Boolean).join(' · ');
    return `<div class="za-row" style="flex-wrap:wrap;gap:6px">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px">${g.name}</div>
        <div style="font-size:11px;color:var(--text3)">${memberCount} lugar(es) · ${shared||'Sin campos compartidos'}</div>
      </div>
      <button class="ibtn del" onclick="deleteGroup('${g.id}')" title="Eliminar grupo">🗑️</button>
    </div>`;
  }).join('');
}

window.deleteGroup = function(id) {
  const idx = GROUPS.findIndex(g => g.id === id);
  if (idx !== -1) {
    POIS.forEach(p => { if (p.groupId === id) delete p.groupId; });
    GROUPS.splice(idx, 1);
    renderGroupsAdmin();
    toast('🗑 Grupo eliminado');
  }
};

const btnAddGroup = document.getElementById('btn-add-group');
if (btnAddGroup) {
  btnAddGroup.addEventListener('click', () => {
    const name = document.getElementById('ng-name')?.value.trim();
    if (!name) { toast('⚠️ Ingresá el nombre del grupo'); return; }
    const g = {
      id:        'g_' + Date.now().toString(36),
      name,
      desc:      document.getElementById('ng-desc')?.value.trim() || '',
      shareImg:  document.getElementById('ng-share-img')?.checked  || false,
      shareDesc: document.getElementById('ng-share-desc')?.checked || false,
      shareHist: document.getElementById('ng-share-hist')?.checked || false,
      shareSoc:  document.getElementById('ng-share-soc')?.checked  || false,
      shareCats: document.getElementById('ng-share-cats')?.checked || false,
      soc: [],
    };
    GROUPS.push(g);
    document.getElementById('ng-name').value = '';
    document.getElementById('ng-desc').value = '';
    renderGroupsAdmin();
    // Agregar el grupo a los selects de lugar (add/edit)
    refreshGroupSelects();
    toast(`✅ Grupo "${name}" creado`);
  });
}

function refreshGroupSelects() {
  // Agrega selector de grupo en los formularios de agregar/editar
  ['a-group','e-group'].forEach(selId => {
    const sel = document.getElementById(selId);
    if (!sel) return;
    sel.innerHTML = `<option value="">Sin grupo</option>` +
      GROUPS.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
  });
}

// Agregar el selector de grupo al formulario de edición de forma dinámica
(function injectGroupSelectors() {
  // En el formulario "Agregar"
  const addNameFg = document.getElementById('a-name')?.closest('.fg');
  if (addNameFg && !document.getElementById('a-group')) {
    const fg = document.createElement('div');
    fg.className = 'fg';
    fg.innerHTML = `<label class="fl">Grupo (opcional)</label>
      <select class="fs" id="a-group"><option value="">Sin grupo</option></select>`;
    addNameFg.parentNode.insertBefore(fg, addNameFg.nextSibling);
  }
  // En el formulario "Editar"
  const editNameFg = document.getElementById('e-name')?.closest('.fg');
  if (editNameFg && !document.getElementById('e-group')) {
    const fg = document.createElement('div');
    fg.className = 'fg';
    fg.innerHTML = `<label class="fl">Grupo (opcional)</label>
      <select class="fs" id="e-group"><option value="">Sin grupo</option></select>`;
    editNameFg.parentNode.insertBefore(fg, editNameFg.nextSibling);
  }
})();

// Extender switchTab para renderizar grupos
const _origSwitchTabGroups = window.switchTab;
window.switchTab = function(t) {
  _origSwitchTabGroups(t);
  if (t === 'groups') { renderGroupsAdmin(); refreshGroupSelects(); }
};
// Agregar groups al mapa de tabs
const _mapTGroups = {list:'tp-list',add:'tp-add',edit:'tp-edit',global:'tp-global','zonas-admin':'tp-zonas-admin',roadmap:'tp-roadmap',cats:'tp-cats',groups:'tp-groups'};
const _stFnOrig = switchTab;
switchTab = function(t) {
  document.querySelectorAll('.atab').forEach(a => a.classList.toggle('on', a.dataset.t === t));
  document.querySelectorAll('.tpane').forEach(p => p.classList.remove('on'));
  const el = document.getElementById(_mapTGroups[t]);
  if (el) el.classList.add('on');
  if (t === 'roadmap')     renderRoadmap();
  if (t === 'zonas-admin') renderZonasAdmin();
  if (t === 'cats')        renderCatsAdmin();
  if (t === 'groups')      { renderGroupsAdmin(); refreshGroupSelects(); }
};

/* ═══════════════════════════════════════════════════════════
   SOMBRA DEL PIN — on/off + color + opacidad
   ═══════════════════════════════════════════════════════════ */
globalSettings.shadowOn      = true;
globalSettings.shadowColor   = '#000000';
globalSettings.shadowOpacity = 0.20;

function applyShadow() {
  let s = document.getElementById('dyn-shadow');
  if (!s) { s = document.createElement('style'); s.id = 'dyn-shadow'; document.head.appendChild(s); }
  if (!globalSettings.shadowOn) {
    s.textContent = '.pin-img-shadow,.pin-img-dot,.pin-img-ripple{display:none!important}';
    return;
  }
  const col = globalSettings.shadowColor || '#000000';
  const op  = globalSettings.shadowOpacity || 0.20;
  const r   = parseInt(col.slice(1,3),16);
  const g   = parseInt(col.slice(3,5),16);
  const b   = parseInt(col.slice(5,7),16);
  const rgba = `rgba(${r},${g},${b},${op})`;
  s.textContent = `.pin-img-shadow{background:${rgba}!important;display:block!important}.pin-img-dot{background:${rgba}!important}.pin-img-ripple{background:${rgba}!important}`;
}
applyShadow();

const _shadowToggle = document.getElementById('g-shadow-toggle');
if (_shadowToggle) {
  _shadowToggle.addEventListener('click', function() {
    globalSettings.shadowOn = !globalSettings.shadowOn;
    this.classList.toggle('on', globalSettings.shadowOn);
    applyShadow();
  });
}
const _shadowColor = document.getElementById('g-shadow-color');
if (_shadowColor) {
  _shadowColor.addEventListener('input', function() {
    globalSettings.shadowColor = this.value;
    applyShadow();
  });
}
const _shadowOpacity = document.getElementById('g-shadow-opacity');
if (_shadowOpacity) {
  _shadowOpacity.addEventListener('input', function() {
    globalSettings.shadowOpacity = parseInt(this.value) / 100;
    document.getElementById('g-shadow-opacity-val').textContent = this.value + '%';
    applyShadow();
  });
}

/* ═══════════════════════════════════════════════════════════
   EYE GLOW CONTROLS
   ═══════════════════════════════════════════════════════════ */
const EYE_GLOW_LEVELS = {
  1:{inner:2,mid:4,outer:8,label:'Suave'},
  2:{inner:3,mid:8,outer:16,label:'Medio'},
  3:{inner:5,mid:12,outer:24,label:'Fuerte'},
  4:{inner:8,mid:18,outer:36,label:'Intenso'},
  5:{inner:12,mid:24,outer:48,label:'Extremo'},
};

function applyEyeGlowColor() {
  const c = globalSettings.eyeGlowColor || '#60a5fa';
  const lvl = globalSettings.eyeGlowIntensity || 2;
  const gL = EYE_GLOW_LEVELS[lvl];
  document.documentElement.style.setProperty('--eye-glow-color', c);
  let s = document.getElementById('dyn-eyeglow');
  if (!s) { s = document.createElement('style'); s.id = 'dyn-eyeglow'; document.head.appendChild(s); }
  s.textContent = `@keyframes eyeglow{
    0%,100%{filter:drop-shadow(0 0 ${gL.inner}px ${c}) drop-shadow(0 0 ${gL.mid}px ${c});opacity:.85;transform:scale(1)}
    50%{filter:drop-shadow(0 0 ${gL.mid}px ${c}) drop-shadow(0 0 ${gL.outer}px ${c}) drop-shadow(0 0 ${Math.round(gL.outer*1.5)}px ${c});opacity:1;transform:scale(1.15)}
  }`;
  const prev = document.getElementById('eye-glow-preview');
  if (prev) prev.style.color = c;
}

const _eyeColorPicker = document.getElementById('g-eye-glow-color');
if (_eyeColorPicker) {
  _eyeColorPicker.addEventListener('input', function() {
    globalSettings.eyeGlowColor = this.value;
    applyEyeGlowColor();
  });
}
const _eyeIntSlider = document.getElementById('g-eye-glow-intensity');
if (_eyeIntSlider) {
  _eyeIntSlider.addEventListener('input', function() {
    const lvl = parseInt(this.value);
    globalSettings.eyeGlowIntensity = lvl;
    document.getElementById('g-eye-glow-intensity-val').textContent = EYE_GLOW_LEVELS[lvl]?.label || lvl;
    applyEyeGlowColor();
  });
}
applyEyeGlowColor();

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
  POIS.forEach(p => {
    const cats = Array.isArray(p.categories) ? p.categories : [p.category];
    if (cats.includes(id)) {
      const el = document.getElementById('pw-' + p.id);
      const parent = el && el.parentElement;
      if (parent) parent.style.visibility = newState ? '' : 'hidden';
    }
  });
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

/* ═══════════════════════════════════════════════════════════