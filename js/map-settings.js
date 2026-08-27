/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/* map-settings.js — tile provider, styles, opacity, tint */

/* ─────────────────────────────────────────
   TILE PRESETS
   Styles inspired by high-contrast monochrome maps
   ───────────────────────────────────────── */
const TILE_PRESETS = [
  // ── ESTILOS CLAROS / MINIMALISTAS & BLANCOS ──
  {
    id: 'osm-standard',
    name: 'OSM Estándar Clásico',
    desc: 'El mapa tradicional de OpenStreetMap, confiable y libre',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    preview: '#d4e8c8',
    darkText: true,
  },
  {
    id: 'osm-hot',
    name: 'Humanitario / Vías Claras',
    desc: 'Enfoque limpio en manzanas, calles y áreas naturales',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    preview: '#f5f5f5',
    darkText: true,
  },
  {
    id: 'esri-light',
    name: 'ESRI Gris Claro Moderno',
    desc: 'Estilo neutro y suave, perfecto para que resalten los pines',
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    preview: '#e0e0e0',
    darkText: true,
  },
  {
    id: 'cyclosm',
    name: 'Verde y Urbano (Parques)',
    desc: 'Destaca de forma muy estética los espacios verdes y agua',
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    preview: '#c8d8a8',
    darkText: true,
  },
  {
    id: 'opentopomap',
    name: 'Topográfico Suave',
    desc: 'Relieve sutil con énfasis en caminos principales',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    preview: '#e1ebd0',
    darkText: true,
  },
  {
    id: 'osm-bw',
    name: 'Blanco y Negro Lineal',
    desc: 'Trazos en escala de grises absoluta y limpia',
    url: 'https://tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png',
    preview: '#ffffff',
    darkText: true,
  },
  {
    id: 'hikebike',
    name: 'Caminos y Rutas Claras',
    desc: 'Diseño minimalista enfocado en la traza vial',
    url: 'https://tiles.wmflabs.org/hikebike/{z}/{x}/{y}.png',
    preview: '#f9f9f9',
    darkText: true,
  },

  // ── ESTILOS OSCUROS / NIGHT MODE ──
  {
    id: 'esri-dark',
    name: '🌙 ESRI Dark Gray',
    desc: 'Gris oscuro plomizo profesional, elegante de noche',
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    preview: '#2d2d2d',
    darkText: false,
  },
  {
    id: 'dark-toner',
    name: '🌙 Oscuro Vectorial Simple',
    desc: 'Contraste alto con fondo nocturno y líneas sutiles',
    url: 'https://tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png',
    preview: '#181818',
    darkText: false,
  },
  {
    id: 'stamen-dark-alt',
    name: '🌙 Noche Profunda',
    desc: 'Fondo negro total con demarcación de calles mínimas',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    preview: '#111111',
    darkText: false,
  },

  // ── VARIANTES DE CALLES DESTACADAS Y COLOR ──
  {
    id: 'osm-fr-color',
    name: 'Francia Vías Coloridas',
    desc: 'Calles principales remarcadas en tonos cálidos',
    url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
    preview: '#d0e1f9',
    darkText: true,
  },
  {
    id: 'world-imagery-canvas',
    name: 'Canvas Neutro de Autor',
    desc: 'Diseño de manzanas planas con retícula despejada',
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    preview: '#dfdcd7',
    darkText: true,
  }
];

let _currentTileLayer = null;
const _mapaSettings = {
  tileUrl:   TILE_PRESETS[0].url,  
  presetId:  'osm-standard',
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
      saveMapSettings();
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
    opSlider.addEventListener('change', () => saveMapSettings());
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
      saveMapSettings();
      toast('🗺 Mapa personalizado aplicado y guardado');
    });
  }
}

// Register tab plugin
SC.registerTabPlugin('mapa', initMapaTab);