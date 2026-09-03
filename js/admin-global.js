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
// [2026-09-03] Valores originales de fábrica — usados por el botón
// "↺ Restaurar valores originales" de la pestaña Global. Deben
// mantenerse en sync manualmente si en el futuro cambia algún default
// de acá abajo (no hay forma automática de derivarlos sin duplicar
// lógica en otro lado).
const DEFAULT_GLOBAL_SETTINGS = {
  solidPx:      0,
  solidColor:   '#ffffff',
  glowPx:       0,
  glowColor:    '#60a5fa',
  dimOpacity:   0.35,
  pinSize:      44,
  expandPercent: 30,
  eyeGlowColor: '#60a5fa',
  eyeGlowIntensity: 2,
  nameSize:     26,
  panelPctPortrait:  45,
  panelPctLandscape: 34,
  shadowOn:      true,
  shadowColor:   '#000000',
  shadowOpacity: 0.20,
};

const globalSettings = {
  solidPx:      0,
  solidColor:   '#ffffff',
  glowPx:       0,
  glowColor:    '#60a5fa',
  dimOpacity:   0.35,
  pinSize:      44,
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
  // ANTES: acá se armaba `.pin-wrap.dim { filter: grayscale(80%);
  // opacity: ${op}; transform: scale(.9); }` — eso es lo que apagaba
  // todos los pines (y con ellos, visualmente, el mapa entero) al
  // expandir uno. Se saca por completo, sin importar en qué quede el
  // slider "g-dim-opacity" del admin (ver más abajo, ahora no hace
  // nada — se deja el control en el HTML por si en el futuro se
  // quiere reactivar esto de otra forma, pero ya no tiene efecto).
  // [FIX 2026-09-03] Se sacó de acá la regla vieja
  // `.pin-wrap.big { transform: scale(${expandScale}) !important; }`
  // — era un segundo sistema de tamaño del edificio maximizado,
  // paralelo y en conflicto con el que realmente se usa (expandPercent,
  // aplicado en js/pin-adjust.js sobre cada pin al expandirlo). Tener
  // los 2 corriendo a la vez era la causa real de que el tamaño se
  // viera inconsistente según el momento. Ver AI_SESSION.md.
  getDynStyle().textContent = `
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
  // [FIX 2026-09-03] Antes usaba expandScale (sistema retirado). Este
  // swatch es solo decorativo (previsualización chica en el panel, no
  // el pin real del mapa), así que alcanza con una escala aproximada
  // que crezca con expandPercent — no necesita replicar la cuenta
  // exacta de pin-adjust.js (esa sí mide el tamaño real en pantalla).
  const previewScale = 1 + ((globalSettings.expandPercent || 30) / 100);
  const prev  = document.getElementById('g-preview-pin');
  const prevB = document.getElementById('g-preview-pin-big');
  if (prev)  { prev.style.fontSize = sz+'px'; prev.style.filter = f; }
  if (prevB) { prevB.style.fontSize = sz+'px'; prevB.style.filter = f; prevB.style.transform = `scale(${previewScale})`; }
}

document.getElementById('btn-apply-global').addEventListener('click', () => {
  applyGlobalDim();
  rebuildAllMarkers();
  saveGlobalSettings(); // ahora sí queda guardado de verdad, no solo en memoria
  toast('✅ Apariencia global aplicada y guardada');
});

// [NUEVO 2026-09-03] Botón "↺ Restaurar valores originales" — pedido
// explícito de Cris. Mismo flujo que "Aplicar apariencia global" pero
// partiendo de DEFAULT_GLOBAL_SETTINGS en vez de lo que haya en el
// formulario — así queda guardado de verdad, no solo visual.
const btnResetGlobal = document.getElementById('btn-reset-global');
if (btnResetGlobal) {
  btnResetGlobal.addEventListener('click', () => {
    Object.assign(globalSettings, DEFAULT_GLOBAL_SETTINGS);
    initGlobalTab(); // repinta todos los controles con los valores default
    if (typeof applyShadow === 'function') applyShadow();
    if (typeof applyEyeGlowColor === 'function') applyEyeGlowColor();
    applyGlobalDim();
    rebuildAllMarkers();
    saveGlobalSettings();
    toast('↺ Apariencia global restaurada a los valores originales');
  });
}

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
  setSlider('g-expand-size',  'g-expand-size-val',  globalSettings.expandPercent || 30,   '%');
  setSlider('g-name-size',    'g-name-size-val',    globalSettings.nameSize,              'px');

  setSlider('g-panel-pct-portrait',  'g-panel-pct-portrait-val',  globalSettings.panelPctPortrait,  '%');
  setSlider('g-panel-pct-landscape', 'g-panel-pct-landscape-val', globalSettings.panelPctLandscape, '%');

  // [FIX 2026-09-03] Sombra del pin y glow de ojos (js/shadow-eye.js)
  // nunca se sincronizaban acá — al abrir la pestaña Global siempre se
  // veían con el valor por defecto del HTML, aunque lo guardado fuera
  // otra cosa. Mismo síntoma que el bug de aplicación temprana ya
  // corregido en app.js, pero en el PANEL en vez de en el mapa.
  const shadowToggleEl = document.getElementById('g-shadow-toggle');
  if (shadowToggleEl) shadowToggleEl.classList.toggle('on', globalSettings.shadowOn !== false);
  const shadowColorEl = document.getElementById('g-shadow-color');
  if (shadowColorEl) shadowColorEl.value = globalSettings.shadowColor || '#000000';
  setSlider('g-shadow-opacity', 'g-shadow-opacity-val', Math.round((globalSettings.shadowOpacity ?? 0.20) * 100), '%');
  const eyeColorEl = document.getElementById('g-eye-glow-color');
  if (eyeColorEl) eyeColorEl.value = globalSettings.eyeGlowColor || '#60a5fa';
  setSlider('g-eye-glow-intensity', 'g-eye-glow-intensity-val', globalSettings.eyeGlowIntensity || 2, '');

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



