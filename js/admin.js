/* admin.js — admin panel, switchTab, pickMode, toast, swipe */
/* ═══════════════════════════════════════════
   ADMIN PANEL
═══════════════════════════════════════════ */
document.getElementById('btn-admin').addEventListener('click', () => {
  if (_adminUser) openAdmin();
  else showAdminLogin();
});
document.getElementById('admin-close').addEventListener('click', closeAdmin);
document.getElementById('overlay').addEventListener('click', closeAdmin);

function openAdmin() {
  document.getElementById('admin').classList.add('open');
  document.getElementById('overlay').classList.add('on');
  document.getElementById('btn-admin').classList.add('active');
  renderList();
  switchTab('list');
}
function closeAdmin() {
  document.getElementById('admin').classList.remove('open');
  document.getElementById('overlay').classList.remove('on');
  document.getElementById('btn-admin').classList.remove('active');
  stopPickMode();
}

document.querySelectorAll('.atab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.t)));

function switchTab(t) {
  document.querySelectorAll('.atab').forEach(a => a.classList.toggle('on', a.dataset.t === t));
  document.querySelectorAll('.tpane').forEach(p => p.classList.remove('on'));
  const targets = {list:'tp-list', add:'tp-add', edit:'tp-edit', global:'tp-global',
    'zonas-admin':'tp-zonas-admin', 'temas-admin':'tp-temas-admin', roadmap:'tp-roadmap', groups:'tp-groups', cats:'tp-cats', mapa:'tp-mapa'};
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
  if (!POIS.length) {
    c.innerHTML = '<div class="empty-state"><div class="big">📭</div>No hay lugares cargados.<br>Usá el botón ➕ para agregar.</div>';
    return;
  }
  c.innerHTML = POIS.map(p => {
    const cats = Array.isArray(p.categories) && p.categories.length
      ? p.categories.map(k => CAT[k]).filter(Boolean)
      : [CAT[p.category] || {label: p.category||'—', color:'#6055d8'}];
    const mainCat = cats[0] || {label:'—', color:'#6055d8'};
    const isOn = p.active !== false;
    const clicksPublicOn = !!p.clicksPublicVisible;
    return `<div class="poi-row" style="${isOn?'':'opacity:.5'}">
      <div class="poi-row-ico" style="background:${mainCat.color}20">${p.icon}</div>
      <div class="poi-row-info">
        <div class="poi-row-name">${p.name}</div>
        <div class="poi-row-cat" style="color:${mainCat.color}">${cats.map(c=>c.label).join(' · ')}</div>
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
  }).join('');
}

window.togglePublicClicks = function(id, checked) {
  const p = POIS.find(x => x.id === id);
  if (!p) return;
  p.clicksPublicVisible = checked;
  savePoiToFirestore(p);
  toast(checked ? '✅ El conteo ahora es visible al público' : '⭕ El conteo ya no es visible al público');
};

window.togglePoi = function(id, btn) {
  const p = POIS.find(x => x.id === id);
  if (!p) return;
  p.active = !(p.active !== false);
  btn.classList.toggle('on', p.active);
  const row = btn.closest('.poi-row');
  if (row) row.style.opacity = p.active ? '' : '.5';
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
  startPickMode('add');
  closeAdmin();
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

  // Alt images
  function preloadAlt(imgData, prevId, lblId, wrapperId, slot, varName) {
    const prevEl = document.getElementById(prevId);
    const lblEl  = document.getElementById(lblId);
    const wrapEl = document.getElementById(wrapperId);
    if (!prevEl) return;
    if (imgData) {
      prevEl.innerHTML = `<img src="${imgData}" alt="variante">`;
      lblEl.textContent = `Variante ${slot} cargada — clic para cambiar`;
      wrapEl.classList.add('has-img');
      window[varName] = imgData;
    } else {
      prevEl.innerHTML = String(slot);
      lblEl.textContent = `Variante ${slot}`;
      wrapEl.classList.remove('has-img');
      window[varName] = null;
    }
  }
  preloadAlt(p.imgAlt1, 'img-prev-alt1-edit', 'img-lbl-alt1-edit', 'iu-alt1-edit', 2, '_editImgAlt1');
  preloadAlt(p.imgAlt2, 'img-prev-alt2-edit', 'img-lbl-alt2-edit', 'iu-alt2-edit', 3, '_editImgAlt2');
  preloadAlt(p.imgAlt3, 'img-prev-alt3-edit', 'img-lbl-alt3-edit', 'iu-alt3-edit', 4, '_editImgAlt3');

  document.getElementById('e-lat').value  = p.lat;
  document.getElementById('e-lng').value  = p.lng;
  syncEditCoordDisplay();

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
  startPickMode('edit');
  closeAdmin();
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
  // Completely hide admin so map is fully interactive
  document.getElementById('admin').style.display = 'none';
  document.getElementById('overlay').classList.remove('on');
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
    } else {
      document.getElementById('e-lat').value = lat.toFixed(6);
      document.getElementById('e-lng').value = lng.toFixed(6);
      syncEditCoordDisplay();
    }
    stopPickMode();
    openAdmin();
    if (ctx === 'edit') switchTab('edit');
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
  stopPickMode();
  openAdmin();
});



