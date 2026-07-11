/* map-settings.js — tile provider, styles, opacity, tint */

/* ─────────────────────────────────────────
   TILE PRESETS
   Styles inspired by high-contrast monochrome maps
   ───────────────────────────────────────── */
const TILE_PRESETS = [

  // ── HIGH CONTRAST / MONOCHROME (like the reference image) ──
  {
    id: 'stamen-toner',
    name: 'Monocromo Stark',
    desc: 'Blanco y negro, alto contraste, muy limpio',
    url: 'https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}{r}.png',
    preview: '#ffffff',
    darkText: true,
  },
  {
    id: 'stamen-toner-lite',
    name: 'Monocromo Suave',
    desc: 'Gris claro, calles definidas, minimalista',
    url: 'https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}{r}.png',
    preview: '#f5f5f5',
    darkText: true,
  },
  {
    id: 'blue-mono',
    name: 'Azul Índigo',
    desc: 'Monochrome azul oscuro — similar al mapa de referencia',
    url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
    preview: '#1a2744',
    darkText: false,
  },
  {
    id: 'carto-positron',
    name: 'Positron Minimal',
    desc: 'Blanco muy limpio, casi sin color',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    preview: '#f8f8f8',
    darkText: true,
  },
  {
    id: 'carto-voyager',
    name: 'Voyager Color',
    desc: 'Colores suaves, estilo moderno',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    preview: '#e8f0e8',
    darkText: true,
  },

  // ── NIGHT / DARK ──
  {
    id: 'carto-dark',
    name: '🌙 Dark Matter',
    desc: 'Negro profundo, tema noche clásico',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    preview: '#1a1a2e',
    darkText: false,
  },
  {
    id: 'stadia-dark',
    name: '🌙 Alidade Dark',
    desc: 'Oscuro azulado, elegante',
    url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
    preview: '#13293d',
    darkText: false,
  },
  {
    id: 'esri-dark',
    name: '🌙 ESRI Dark Gray',
    desc: 'Gris oscuro neutro, muy profesional',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    preview: '#2d2d2d',
    darkText: false,
  },

  // ── SPECIALTY ──
  {
    id: 'osm-fr',
    name: 'OSM Estándar',
    desc: 'OpenStreetMap clásico',
    url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
    preview: '#d4e8c8',
    darkText: true,
  },
  {
    id: 'esri-topo',
    name: 'ESRI Topográfico',
    desc: 'Con relieve y topografía',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    preview: '#c8d8a8',
    darkText: true,
  },
];

let _currentTileLayer = null;
const _mapaSettings = {
  tileUrl:   TILE_PRESETS[3].url,  // default: Positron
  presetId:  'carto-positron',
  opacity:   1.0,
  tintColor: '',
  tintOpacity: 0,
};
let _tintLayer = null;

/* ─────────────────────────────────────────
   TILE APPLICATION
   ───────────────────────────────────────── */
function applyTileUrl(url) {
  if (!url || !url.includes('{z}')) return;
  if (_currentTileLayer) {
    try { map.removeLayer(_currentTileLayer); } catch(e) {}
  }
  _currentTileLayer = L.tileLayer(url, {
    subdomains: 'abcd',
    maxZoom: 19,
    opacity: _mapaSettings.opacity,
    crossOrigin: true,
  });
  _currentTileLayer.addTo(map);
  _mapaSettings.tileUrl = url;
}

function applyMapaOpacity(val) {
  _mapaSettings.opacity = parseFloat(val) || 1;
  if (_currentTileLayer) _currentTileLayer.setOpacity(_mapaSettings.opacity);
}

function applyTint() {
  if (_tintLayer) { try { map.removeLayer(_tintLayer); } catch(e) {} _tintLayer = null; }
  if (_mapaSettings.tintColor && _mapaSettings.tintOpacity > 0) {
    const c = _mapaSettings.tintColor;
    const o = _mapaSettings.tintOpacity;
    _tintLayer = L.rectangle(
      [[-90,-180],[90,180]],
      { color: c, fillColor: c, fillOpacity: o, opacity: 0, interactive: false }
    ).addTo(map);
  }
}

/* ─────────────────────────────────────────
   ADMIN TAB — Mapa
   ───────────────────────────────────────── */
function initMapaTab() {
  const grid = document.getElementById('mapa-preset-grid');
  if (!grid || grid.dataset.built) return;
  grid.dataset.built = '1';

  TILE_PRESETS.forEach(p => {
    const card = document.createElement('div');
    card.className = 'mapa-preset-card' + (_mapaSettings.presetId === p.id ? ' active' : '');
    card.dataset.id = p.id;
    card.innerHTML =
      '<div class="mapa-preview" style="background:' + p.preview + '">' +
        '<div class="mapa-preview-lines" style="opacity:' + (p.darkText ? '0.25' : '0.3') + '"></div>' +
      '</div>' +
      '<div class="mapa-card-name">' + p.name + '</div>';
    card.addEventListener('click', () => {
      document.querySelectorAll('.mapa-preset-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      _mapaSettings.presetId = p.id;
      const urlInp = document.getElementById('mapa-url-input');
      if (urlInp) urlInp.value = p.url;
      applyTileUrl(p.url);
      toast('🗺 Mapa: ' + p.name);
    });
    grid.appendChild(card);
  });

  // Opacity slider
  const opSlider = document.getElementById('mapa-opacity');
  const opVal    = document.getElementById('mapa-opacity-val');
  if (opSlider) {
    opSlider.value = Math.round(_mapaSettings.opacity * 100);
    opSlider.addEventListener('input', () => {
      const v = parseInt(opSlider.value) / 100;
      if (opVal) opVal.textContent = opSlider.value + '%';
      applyMapaOpacity(v);
    });
  }

  // Custom URL
  const urlInp  = document.getElementById('mapa-url-input');
  const urlBtn  = document.getElementById('mapa-url-apply');
  if (urlInp) urlInp.value = _mapaSettings.tileUrl;
  if (urlBtn && urlInp) {
    urlBtn.addEventListener('click', () => {
      const url = urlInp.value.trim();
      if (!url.includes('{z}')) { toast('⚠️ URL inválida — debe tener {z}/{x}/{y}'); return; }
      _mapaSettings.presetId = 'custom';
      document.querySelectorAll('.mapa-preset-card').forEach(c => c.classList.remove('active'));
      applyTileUrl(url);
      toast('🗺 Mapa personalizado aplicado');
    });
  }
}

// Register tab plugin
SC.registerTabPlugin('mapa', initMapaTab);



