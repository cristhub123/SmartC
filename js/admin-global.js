/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/* admin-global.js — globalSettings, outline, glow, rebuild */
/* ═══════════════════════════════════════════════════════════
   GLOBAL APPEARANCE SETTINGS
   ═══════════════════════════════════════════════════════════ */
const globalSettings = {
  solidPx:      0,
  solidColor:   '#ffffff',
  glowPx:       0,
  glowColor:    '#60a5fa',
  dimOpacity:   0.35,
  pinSize:      44,
  expandScale:  3.2,
  eyeGlowColor: '#60a5fa',
  nameSize:     26,
  // [2026-08-14] % de pantalla que ocupa el panel de info del lugar
  // al abrirse — separado por orientación real de pantalla (no por
  // ancho fijo), ver js/poi-panel.js (_applyPanelSizeVars /
  // getOpenAreaPx) y js/app.js (panToPoiCenter, que lee este mismo
  // valor para saber dónde centrar el pin en la porción libre).
  panelPctPortrait:  45, // % del ALTO en pantallas verticales (bottom sheet)
  panelPctLandscape: 34, // % del ANCHO en pantallas cuadradas/horizontales, incluye desktop (sidebar)
};

// [2026-09-03] Copia congelada de los valores de arriba, ANTES de que
// loadGlobalSettings() los pise con lo guardado en Firestore — es lo
// que usa el botón "Restaurar valores originales" (no relee de
// Firestore, no borra nada ahí: solo repone estos números/colores en
// pantalla; para que quede guardado de verdad todavía hay que tocar
// "Aplicar a todos los pins", igual que con cualquier otro cambio).
//
// `expandSize` (tamaño del edificio expandido) NO vive en el objeto
// de arriba — lo agrega js/pin-adjust.js, que carga DESPUÉS de este
// archivo. Se suma acá a mano con el mismo default (160) que usa ese
// archivo, para que el botón de reset también lo cubra.
const GLOBAL_SETTINGS_DEFAULTS = JSON.parse(JSON.stringify(globalSettings));
GLOBAL_SETTINGS_DEFAULTS.expandSize = 160;

/* Build filter string: glow first (underneath), then solid border */
function buildFilterString(baseFilter) {
  const parts = [];
  // Glow (only if enabled and > 0)
  if (globalSettings.glowEnabled !== false && globalSettings.glowPx > 0) {
    const g = globalSettings.glowColor, px = globalSettings.glowPx;
    parts.push(`drop-shadow(0 0 ${px*2}px ${g})`, `drop-shadow(0 0 ${px}px ${g})`);
  }
  // Solid outline (only if enabled and > 0)
  if (globalSettings.solidEnabled !== false && globalSettings.solidPx > 0) {
    const c = globalSettings.solidColor, s = globalSettings.solidPx;
    parts.push(
      `drop-shadow(${s}px 0 0 ${c})`,
      `drop-shadow(-${s}px 0 0 ${c})`,
      `drop-shadow(0 ${s}px 0 ${c})`,
      `drop-shadow(0 -${s}px 0 ${c})`
    );
  }
  // Base shadow — ONLY if shadowOn is true
  if (globalSettings.shadowOn !== false) {
    parts.push(baseFilter || 'drop-shadow(0 4px 10px rgba(0,0,0,.4))');
  }
  return parts.length ? parts.join(' ') : 'none';
}

function applyGlobalOutline() {
  let s = document.getElementById('dyn-outline');
  if (!s) { s = document.createElement('style'); s.id = 'dyn-outline'; document.head.appendChild(s); }
  const f = buildFilterString();
  s.textContent = (f && f !== 'drop-shadow(0 4px 10px rgba(0,0,0,.4))')
    ? '.pin-img-wrap { filter: ' + f + ' !important; }'
    : '';
}

function getDynStyle() {
  let s = document.getElementById('dyn-style');
  if (!s) { s = document.createElement('style'); s.id = 'dyn-style'; document.head.appendChild(s); }
  return s;
}

function applyGlobalDim() {
  const sz = globalSettings.pinSize;
  const sc = globalSettings.expandScale;
  // ANTES: acá se armaba `.pin-wrap.dim { filter: grayscale(80%);
  // opacity: ${op}; transform: scale(.9); }` — eso es lo que apagaba
  // todos los pines (y con ellos, visualmente, el mapa entero) al
  // expandir uno. Se saca por completo, sin importar en qué quede el
  // slider "g-dim-opacity" del admin (ver más abajo, ahora no hace
  // nada — se deja el control en el HTML por si en el futuro se
  // quiere reactivar esto de otra forma, pero ya no tiene efecto).
  getDynStyle().textContent = `
    .pin-wrap.big { transform: scale(${sc}) !important; }
    :root { --eye-glow-color: ${globalSettings.eyeGlowColor}; }
  `;
}

/* FIX: rebuildAllMarkers — fully recreates marker with new size AND rewires click */
function rebuildAllMarkers() {
  const sz = globalSettings.pinSize;
  // Collapse any expanded pin first to avoid stale state
  if (expandedId !== null) { collapsePin(expandedId); closePoiPanel(); }

  Object.keys(markers).forEach(idStr => {
    const id  = idStr; // el id es el slug (texto), no un número — nada de parseInt
    const poi = markers[id].poi;
    markers[id].m.remove();
    delete markers[id];
    makeMarker(poi); // full recreation with new size + fresh click listener
  });

  // Apply new size via CSS (faster than rebuilding icons)
  const extra = getDynStyle().textContent;
  getDynStyle().textContent = extra.replace(/\.pin-img\s*{[^}]*}/g, '')
    .replace(/\.pin-head\s*{[^}]*}/g, '');
  getDynStyle().textContent += `
    .pin-img  { width: ${sz}px !important; height: ${sz}px !important; }
    .pin-head { width: ${sz}px !important; height: ${sz}px !important; }
  `;
  applyGlobalOutline();
}

// Wire slider controls
document.getElementById('g-solid-px').addEventListener('input', function() {
  document.getElementById('g-solid-px-val').textContent = this.value + 'px';
  globalSettings.solidPx = parseInt(this.value);
  updateGPreview();
});
document.getElementById('g-solid-color').addEventListener('input', function() {
  globalSettings.solidColor = this.value;
  document.getElementById('g-solid-hex').value = this.value;
  updateGPreview();
});
document.getElementById('g-solid-hex').addEventListener('change', function() {
  if (/^#[0-9a-fA-F]{6}$/.test(this.value)) {
    globalSettings.solidColor = this.value;
    document.getElementById('g-solid-color').value = this.value;
    updateGPreview();
  }
});
document.getElementById('g-glow-px').addEventListener('input', function() {
  document.getElementById('g-glow-px-val').textContent = this.value + 'px';
  globalSettings.glowPx = parseInt(this.value);
  updateGPreview();
});
document.getElementById('g-glow-color').addEventListener('input', function() {
  globalSettings.glowColor = this.value;
  document.getElementById('g-glow-hex').value = this.value;
  updateGPreview();
});
document.getElementById('g-glow-hex').addEventListener('change', function() {
  if (/^#[0-9a-fA-F]{6}$/.test(this.value)) {
    globalSettings.glowColor = this.value;
    document.getElementById('g-glow-color').value = this.value;
    updateGPreview();
  }
});
// NOTA: este slider queda guardado en globalSettings.dimOpacity por
// compatibilidad, pero ya no tiene ningún efecto visual — applyGlobalDim()
// dejó de usarlo (ver ese archivo). Se deja el control en el HTML sin
// romper nada, por si en algún momento se quiere reactivar el dimming
// con otro criterio.
document.getElementById('g-dim-opacity').addEventListener('input', function() {
  document.getElementById('g-dim-opacity-val').textContent = this.value + '%';
  globalSettings.dimOpacity = parseInt(this.value) / 100;
});
document.getElementById('g-pin-size').addEventListener('input', function() {
  document.getElementById('g-pin-size-val').textContent = this.value + 'px';
  globalSettings.pinSize = parseInt(this.value);
  updateGPreview();
});
document.getElementById('g-expand-scale').addEventListener('input', function() {
  const val = (parseInt(this.value) / 10).toFixed(1);
  document.getElementById('g-expand-scale-val').textContent = val + '×';
  globalSettings.expandScale = parseFloat(val);
  updateGPreview();
});
document.getElementById('g-name-size').addEventListener('input', function() {
  document.getElementById('g-name-size-val').textContent = this.value + 'px';
  globalSettings.nameSize = parseInt(this.value);
  document.documentElement.style.setProperty('--pp-name-size', this.value + 'px');
});

// [2026-08-14] Sliders de tamaño del panel de info — se aplican en
// vivo (no hace falta tocar "Aplicar apariencia global"): el panel
// lee _applyPanelSizeVars() cada vez que se abre un lugar, y
// panToPoiCenter (app.js) lee el mismo valor vía
// PoiPanel.getOpenAreaPx(), así que alcanza con actualizar
// globalSettings acá — el guardado a Firestore sigue yendo con el
// resto de "Apariencia global" al tocar el botón "Aplicar".
document.getElementById('g-panel-pct-portrait').addEventListener('input', function() {
  document.getElementById('g-panel-pct-portrait-val').textContent = this.value + '%';
  globalSettings.panelPctPortrait = parseInt(this.value);
});
document.getElementById('g-panel-pct-landscape').addEventListener('input', function() {
  document.getElementById('g-panel-pct-landscape-val').textContent = this.value + '%';
  globalSettings.panelPctLandscape = parseInt(this.value);
});

// Color presets (data-target="solid"|"glow"|"eyeglow"|"newcat")
document.querySelectorAll('.color-preset').forEach(el => {
  el.addEventListener('click', () => {
    const target = el.dataset.target;
    const c = el.dataset.c;
    if (target === 'solid') {
      globalSettings.solidColor = c;
      document.getElementById('g-solid-color').value = c;
      document.getElementById('g-solid-hex').value = c;
      updateGPreview();
    } else if (target === 'glow') {
      globalSettings.glowColor = c;
      document.getElementById('g-glow-color').value = c;
      document.getElementById('g-glow-hex').value = c;
      updateGPreview();
    } else if (target === 'eyeglow') {
      globalSettings.eyeGlowColor = c;
      document.getElementById('g-eye-glow-color').value = c;
      applyEyeGlowColor();
    } else if (target === 'shadow') {
      globalSettings.shadowColor = c;
      const sp = document.getElementById('g-shadow-color');
      if (sp) sp.value = c;
      if (typeof applyShadow === 'function') applyShadow();
    } else if (target === 'newcat') {
      document.getElementById('nc-color').value = c;
    }
  });
});

function updateGPreview() {
  const f   = buildFilterString();
  const sz  = globalSettings.pinSize;
  const sc  = globalSettings.expandScale;
  const prev  = document.getElementById('g-preview-pin');
  const prevB = document.getElementById('g-preview-pin-big');
  if (prev)  { prev.style.fontSize = sz+'px'; prev.style.filter = f; }
  if (prevB) { prevB.style.fontSize = sz+'px'; prevB.style.filter = f; prevB.style.transform = `scale(${sc*0.45})`; }
}

document.getElementById('btn-apply-global').addEventListener('click', () => {
  applyGlobalDim();
  rebuildAllMarkers();
  saveGlobalSettings(); // ahora sí queda guardado de verdad, no solo en memoria
  toast('✅ Apariencia global aplicada y guardada');
});

document.getElementById('btn-reset-global').addEventListener('click', () => {
  Object.assign(globalSettings, JSON.parse(JSON.stringify(GLOBAL_SETTINGS_DEFAULTS)));
  initGlobalTab();       // repone los sliders/colores en pantalla
  applyGlobalDim();
  applyGlobalOutline();
  rebuildAllMarkers();   // vista previa en vivo con los pines reales
  toast('↺ Valores originales repuestos — tocá "Aplicar" para guardarlos');
});

/* === Sincronizar los sliders con los valores REALES ya cargados
   (desde Firestore) cada vez que se abre la pestaña "Global" —
   sin esto, el admin vería siempre la posición por defecto del
   HTML aunque los valores guardados fueran otros. === */
function initGlobalTab() {
  const setSlider = (id, valId, val, suffix) => {
    const el = document.getElementById(id);
    const lbl = document.getElementById(valId);
    if (el) el.value = val;
    if (lbl) lbl.textContent = val + suffix;
  };
  setSlider('g-solid-px',     'g-solid-px-val',     globalSettings.solidPx,               'px');
  setSlider('g-glow-px',      'g-glow-px-val',      globalSettings.glowPx,                'px');
  setSlider('g-dim-opacity',  'g-dim-opacity-val',  Math.round(globalSettings.dimOpacity*100), '%');
  setSlider('g-pin-size',     'g-pin-size-val',     globalSettings.pinSize,               'px');
  setSlider('g-expand-scale', 'g-expand-scale-val', Math.round(globalSettings.expandScale*10), '×'); // se corrige abajo
  setSlider('g-name-size',    'g-name-size-val',    globalSettings.nameSize,              'px');
  const esEl = document.getElementById('g-expand-scale-val');
  if (esEl) esEl.textContent = globalSettings.expandScale.toFixed(1) + '×';

  setSlider('g-panel-pct-portrait',  'g-panel-pct-portrait-val',  globalSettings.panelPctPortrait,  '%');
  setSlider('g-panel-pct-landscape', 'g-panel-pct-landscape-val', globalSettings.panelPctLandscape, '%');

  // [2026-09-03] BUG ENCONTRADO: este slider (tamaño del edificio
  // expandido, campo independiente `expandSize` agregado en
  // js/pin-adjust.js) nunca se sincronizaba acá — por eso SIEMPRE
  // mostraba "160" (el default fijo del HTML) al abrir la tab,
  // sin importar el valor real cargado desde Firestore. Mismo
  // patrón que el resto de los sliders de arriba.
  setSlider('g-expand-size', 'g-expand-size-val', globalSettings.expandSize || 160, 'px');

  const solidColor = document.getElementById('g-solid-color');
  const solidHex   = document.getElementById('g-solid-hex');
  if (solidColor) solidColor.value = globalSettings.solidColor;
  if (solidHex)   solidHex.value   = globalSettings.solidColor;

  const glowColor = document.getElementById('g-glow-color');
  const glowHex   = document.getElementById('g-glow-hex');
  if (glowColor) glowColor.value = globalSettings.glowColor;
  if (glowHex)   glowHex.value   = globalSettings.glowColor;

  updateGPreview();
}
SC.registerTabPlugin('global', initGlobalTab);



