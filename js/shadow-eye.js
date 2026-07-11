/* shadow-eye.js — pin shadow + eye glow controls */
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
    // Hide ALL shadow elements — including the drop-shadow filter on the wrapper
    s.textContent =
      '.pin-img-shadow,.pin-img-dot,.pin-img-ripple{display:none!important}' +
      '.pin-img-wrap{filter:none!important}' +
      '.pin-wrap.big .pin-img-wrap{filter:none!important}';
    // Also trigger outline rebuild so buildFilterString picks up shadowOn=false
    if (typeof applyGlobalOutline === 'function') applyGlobalOutline();
    return;
  }
  const col = globalSettings.shadowColor || '#000000';
  const op  = globalSettings.shadowOpacity || 0.20;
  const r   = parseInt(col.slice(1,3),16);
  const g   = parseInt(col.slice(3,5),16);
  const b   = parseInt(col.slice(5,7),16);
  const rgba = `rgba(${r},${g},${b},${op})`;
  s.textContent =
    `.pin-img-shadow{background:${rgba}!important;display:block!important}` +
    `.pin-img-dot{background:${rgba}!important}` +
    `.pin-img-ripple{background:${rgba}!important}` +
    `.pin-img-wrap{filter:drop-shadow(0 4px 10px ${rgba})!important}`;
  if (typeof applyGlobalOutline === 'function') applyGlobalOutline();
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



