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
};

/* Build filter string: glow first (underneath), then solid border */
function buildFilterString(baseFilter) {
  const parts = [];
  if (globalSettings.glowPx > 0) {
    const g = globalSettings.glowColor, px = globalSettings.glowPx;
    parts.push(`drop-shadow(0 0 ${px*2}px ${g})`, `drop-shadow(0 0 ${px}px ${g})`);
  }
  if (globalSettings.solidPx > 0) {
    const c = globalSettings.solidColor, s = globalSettings.solidPx;
    // Simulate solid outline via multiple tight drop-shadows
    parts.push(
      `drop-shadow(${s}px 0 0 ${c})`,
      `drop-shadow(-${s}px 0 0 ${c})`,
      `drop-shadow(0 ${s}px 0 ${c})`,
      `drop-shadow(0 -${s}px 0 ${c})`
    );
  }
  parts.push(baseFilter || 'drop-shadow(0 4px 10px rgba(0,0,0,.4))');
  return parts.join(' ');
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
  const op = globalSettings.dimOpacity;
  const sz = globalSettings.pinSize;
  const sc = globalSettings.expandScale;
  getDynStyle().textContent = `
    .pin-wrap.dim { filter: grayscale(80%); opacity: ${op}; transform: scale(.9); }
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
    const id  = parseInt(idStr);
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
  toast('✅ Apariencia global aplicada');
});
