   MAPA ADMIN — tile provider, opacity, tint, overlay layers
   ═══════════════════════════════════════════════════════════ */

const TILE_PRESETS = [
  {
    id: 'carto-voyager',
    name: 'Carto Voyager',
    desc: 'Limpio, colores suaves, ideal para esta app',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    preview: '#e8f0e8',
  },
  {
    id: 'carto-positron',
    name: 'Carto Positron',
    desc: 'Muy minimalista, casi blanco y negro',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    preview: '#f5f5f5',
  },
  {
    id: 'carto-dark',
    name: 'Carto Dark Matter',
    desc: 'Fondo oscuro, ideal para modo noche',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    preview: '#1a1a2e',
  },
  {
    id: 'osm-standard',
    name: 'OpenStreetMap Estándar',
    desc: 'El mapa clásico de OSM, colores tradicionales',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    preview: '#b5d0b5',
  },
  {
    id: 'stadia-alidade',
    name: 'Stadia Alidade Smooth',
    desc: 'Moderno, suave, buena legibilidad',
    url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png',
    preview: '#e0e8e0',
  },
  {
    id: 'stadia-dark',
    name: 'Stadia Alidade Dark',
    desc: 'Oscuro premium, muy limpio',
    url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
    preview: '#1e2830',
  },
  {
    id: 'stadia-toner',
    name: 'Stadia Toner',
    desc: 'Blanco y negro extremo, muy gráfico',
    url: 'https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}{r}.png',
    preview: '#ffffff',
  },
  {
    id: 'esri-world',
    name: 'ESRI World Street Map',
    desc: 'Mapa de calles detallado de ESRI/ArcGIS',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    preview: '#d4e0c8',
  },
  {
    id: 'esri-topo',
    name: 'ESRI World Topo',
    desc: 'Mapa topográfico con relieve y detalles',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    preview: '#c8d4b0',
  },
  {
    id: 'custom',
    name: 'URL personalizada',
    desc: 'Ingresá cualquier URL de tiles compatible',
    url: '',
    preview: '#cccccc',
  },
];

// Visual overlay layers (drawn on top of tiles via Leaflet or CSS)
const OVERLAY_LAYERS = [
  { id: 'ov-labels',   name: 'Etiquetas de calles',   desc: 'Nombres de calles y avenidas',       url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png', active: false, leafletLayer: null },
  { id: 'ov-buildings',name: 'Volumen de edificios',   desc: 'Sombras de edificios en 2D',         url: 'https://tiles.stadiamaps.com/tiles/stamen_toner_lines/{z}/{x}/{y}{r}.png',             active: false, leafletLayer: null },
  { id: 'ov-nolabels', name: 'Base sin etiquetas',     desc: 'Carto Voyager sin texto (solo mapa)',url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png',   active: false, leafletLayer: null },
];

let _activeTileLayer = null;
let _mapaSettings = {
  tileUrl:      TILE_PRESETS[0].url,
  tilePresetId: TILE_PRESETS[0].id,
  opacity:      100,
  tintOn:       false,
  tintColor:    '#4CAF50',
  tintOpacity:  0,
};

function applyTileUrl(url) {
  if (!url || !url.includes('{z}')) {
    document.getElementById('tile-status').textContent = '⚠ URL inválida — debe contener {z}/{x}/{y}';
    return;
  }
  if (_activeTileLayer) map.removeLayer(_activeTileLayer);
  _activeTileLayer = L.tileLayer(url, { subdomains: 'abcd', maxZoom: 19, opacity: _mapaSettings.opacity / 100 });
  _activeTileLayer.addTo(map);
  _activeTileLayer.bringToBack();
  _mapaSettings.tileUrl = url;
  document.getElementById('tile-status').textContent = '✅ Mapa actualizado';
  setTimeout(() => { const el = document.getElementById('tile-status'); if (el) el.textContent = ''; }, 3000);
}

function applyMapaOpacity(val) {
  _mapaSettings.opacity = val;
  if (_activeTileLayer) _activeTileLayer.setOpacity(val / 100);
  document.getElementById('mapa-opacity-val').textContent = val + '%';
}

function applyTint() {
  const overlay = document.getElementById('mapa-tint-overlay');
  if (!overlay) return;
  if (!_mapaSettings.tintOn || _mapaSettings.tintOpacity === 0) {
    overlay.style.background = 'rgba(0,0,0,0)';
    return;
  }
  const c = _mapaSettings.tintColor;
  const r = parseInt(c.slice(1,3),16), g2 = parseInt(c.slice(3,5),16), b = parseInt(c.slice(5,7),16);
  overlay.style.background = `rgba(${r},${g2},${b},${_mapaSettings.tintOpacity / 100})`;
}

function toggleOverlayLayer(ovId) {
  const ov = OVERLAY_LAYERS.find(o => o.id === ovId);
  if (!ov) return;
  ov.active = !ov.active;
  if (ov.active) {
    ov.leafletLayer = L.tileLayer(ov.url, { subdomains: 'abcd', maxZoom: 19, opacity: 0.8 });
    ov.leafletLayer.addTo(map);
  } else {
    if (ov.leafletLayer) { map.removeLayer(ov.leafletLayer); ov.leafletLayer = null; }
  }
  renderOverlayLayers();
}

function renderOverlayLayers() {
  const list = document.getElementById('mapa-layers-list');
  if (!list) return;
  list.innerHTML = OVERLAY_LAYERS.map(ov => `
    <div style="display:flex;align-items:center;gap:10px;background:#fff;border:1.5px solid var(--border);border-radius:var(--r);padding:10px 14px;box-shadow:var(--shadow-xs)">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700;color:var(--text)">${ov.name}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">${ov.desc}</div>
      </div>
      <button class="za-toggle ${ov.active?'on':''}" onclick="toggleOverlayLayer('${ov.id}')"></button>
    </div>
  `).join('');
}

function initMapaTab() {
  // ── Presets ──
  const presetsEl = document.getElementById('tile-presets');
  if (!presetsEl) return;
  presetsEl.innerHTML = TILE_PRESETS.map(p => {
    const isActive = _mapaSettings.tilePresetId === p.id;
    return `<div onclick="selectTilePreset('${p.id}')"
      style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:var(--r);
      border:2px solid ${isActive ? 'var(--accent)' : 'var(--border)'};
      background:${isActive ? 'var(--accent-pale)' : '#fff'};cursor:pointer;transition:all .18s;box-shadow:var(--shadow-xs)"
      id="tile-preset-${p.id}">
      <div style="width:32px;height:32px;border-radius:8px;background:${p.preview};flex-shrink:0;border:1px solid rgba(0,0,0,.1)"></div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700;color:${isActive?'var(--accent)':'var(--text)'}">${p.name}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:1px">${p.desc}</div>
      </div>
      ${isActive ? '<span style="color:var(--accent);font-size:16px">✓</span>' : ''}
    </div>`;
  }).join('');

  // ── Custom URL input ──
  const urlInput = document.getElementById('mapa-custom-url');
  if (urlInput) urlInput.value = _mapaSettings.tileUrl;

  // ── Opacity ──
  const opEl = document.getElementById('mapa-opacity');
  if (opEl) opEl.value = _mapaSettings.opacity;
  const opValEl = document.getElementById('mapa-opacity-val');
  if (opValEl) opValEl.textContent = _mapaSettings.opacity + '%';

  // ── Tint ──
  const tintToggle = document.getElementById('mapa-tint-toggle');
  if (tintToggle) tintToggle.classList.toggle('on', _mapaSettings.tintOn);
  const tintColor = document.getElementById('mapa-tint-color');
  if (tintColor) tintColor.value = _mapaSettings.tintColor;
  const tintOp = document.getElementById('mapa-tint-opacity');
  if (tintOp) tintOp.value = _mapaSettings.tintOpacity;
  const tintOpVal = document.getElementById('mapa-tint-opacity-val');
  if (tintOpVal) tintOpVal.textContent = _mapaSettings.tintOpacity + '%';

  // ── Overlay layers ──
  renderOverlayLayers();

  // ── Wire events (only once) ──
  if (presetsEl.dataset.wired) return;
  presetsEl.dataset.wired = '1';

  document.getElementById('btn-apply-tile')?.addEventListener('click', () => {
    const url = document.getElementById('mapa-custom-url')?.value.trim();
    _mapaSettings.tilePresetId = 'custom';
    applyTileUrl(url);
    initMapaTab(); // refresh preset UI
  });

  document.getElementById('mapa-opacity')?.addEventListener('input', function() {
    applyMapaOpacity(parseInt(this.value));
  });

  document.getElementById('mapa-tint-toggle')?.addEventListener('click', function() {
    _mapaSettings.tintOn = !_mapaSettings.tintOn;
    this.classList.toggle('on', _mapaSettings.tintOn);
    applyTint();
  });
  document.getElementById('mapa-tint-color')?.addEventListener('input', function() {
    _mapaSettings.tintColor = this.value;
    applyTint();
  });
  document.getElementById('mapa-tint-opacity')?.addEventListener('input', function() {
    _mapaSettings.tintOpacity = parseInt(this.value);
    document.getElementById('mapa-tint-opacity-val').textContent = this.value + '%';
    applyTint();
  });
}

window.selectTilePreset = function(id) {
  const preset = TILE_PRESETS.find(p => p.id === id);
  if (!preset) return;
  _mapaSettings.tilePresetId = id;
  if (id === 'custom') {
    // just focus the URL input
    document.getElementById('mapa-custom-url')?.focus();
    initMapaTab();
    return;
  }
  const urlInput = document.getElementById('mapa-custom-url');
  if (urlInput) urlInput.value = preset.url;
  applyTileUrl(preset.url);
  initMapaTab(); // refresh checkmarks
};

// Initial tile applied in init() at the bottom of the script


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

  /* ── drag-to-scroll ── */
  let isDragging = false, startX = 0, scrollLeft = 0, moved = false;
  bar.addEventListener('pointerdown', e => {
    isDragging = true; moved = false;
    startX = e.clientX;
    scrollLeft = bar.scrollLeft;
    bar.setPointerCapture(e.pointerId);
  });
  bar.addEventListener('pointermove', e => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) moved = true;
    bar.scrollLeft = scrollLeft - dx;
  });
  bar.addEventListener('pointerup', () => { isDragging = false; });

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