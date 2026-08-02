/* ═══════════════════════════════════════════════════════════
   TIPOGRAFÍA Y ESTILOS — 3 niveles (Nombre principal / Título de
   sección interna / Texto de contenido), con presets que declaran a
   qué "scope" aplican (pines, zonas, o ambos — como un sistema de
   tags simple), y hasta 8 fuentes extra de Google Fonts que el
   propio admin puede sumar sin pedírselo a nadie.
   ---------------------------------------------------------------
   ARQUITECTURA (siguiendo la de la app, no una paralela):
   - Los valores de cada nivel se aplican SOLO como variables CSS
     (nunca `element.style.x = ...` desde JS), inyectadas en un
     <style id="dyn-typography"> — mismo mecanismo que ya usan
     admin-global.js (dyn-style/dyn-outline) y shadow-eye.js
     (dyn-shadow/dyn-eyeglow). poi-panel.css y base.css leen esas
     variables con un valor de resguardo (fallback) para que, si
     todavía no guardaste ningún preset, se vea exactamente igual
     que antes.
   - Los presets se guardan en Firestore (colección
     "typography-presets", ver firestore-sync.js) — mismo patrón que
     los presets de orden de zonas.
   - La lista de fuentes extra cargadas se guarda como un documento
     único en "settings" (ver settings-sync.js), igual que
     "appearance"/"mapstyle".
   ═══════════════════════════════════════════════════════════ */

const TYPO_MAX_FONTS = 8;
const TYPO_BASE_FONTS = ['Sora', 'Nunito', 'JetBrains Mono']; // ya vienen cargadas con la página, sin costo extra
const TYPO_LEVELS = [
  { key: 'title',   cssVarPrefix: 'title',   fallbackFontVar: '--font-d', label: 'Nombre principal' },
  { key: 'section', cssVarPrefix: 'section', fallbackFontVar: '--font-b', label: 'Título de sección interna' },
  { key: 'body',    cssVarPrefix: 'body',    fallbackFontVar: '--font-b', label: 'Texto de contenido' },
];

let _typoFonts = [];        // fuentes EXTRA cargadas (no incluye las 3 base)
let _typoPresets = [];      // todos los presets guardados
let _typoEditingId = null;  // id del preset que se está editando (null = nuevo)

/* === Slug simple para IDs de preset/fuente (reusa el criterio de slugify) === */
function _typoSlug(str) {
  return (str || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/* ─────────────────────────────────────────────────────────────
   FUENTES — inyección real del <link> de Google Fonts (solo pesos
   400/700, con display=swap, tal como pidió la auditoría de
   rendimiento) y wiring del panel "Fuentes disponibles".
   ───────────────────────────────────────────────────────────── */

function _injectGoogleFont(fontName) {
  if (!fontName || TYPO_BASE_FONTS.includes(fontName)) return; // las base ya están cargadas
  const linkId = 'gf-' + _typoSlug(fontName);
  if (document.getElementById(linkId)) return; // ya inyectada
  const family = encodeURIComponent(fontName).replace(/%20/g, '+');
  const link = document.createElement('link');
  link.id = linkId;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${family}:wght@400;700&display=swap`;
  document.head.appendChild(link);
}

function _renderTypoFontsList() {
  const wrap = document.getElementById('typo-fonts-list');
  if (!wrap) return;
  const baseHtml = TYPO_BASE_FONTS.map(f =>
    `<span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;background:var(--surface2);border-radius:999px;padding:4px 10px;margin:0 6px 6px 0">${f} <span style="color:var(--text3)">(base)</span></span>`
  ).join('');
  const extraHtml = _typoFonts.map(f =>
    `<span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;background:var(--surface2);border-radius:999px;padding:4px 6px 4px 10px;margin:0 6px 6px 0">
       ${f}
       <button type="button" data-remove-font="${f}" title="Quitar fuente" style="border:none;background:transparent;cursor:pointer;font-size:11px;line-height:1;">🗑</button>
     </span>`
  ).join('');
  wrap.innerHTML = baseHtml + extraHtml +
    `<div style="font-size:11px;color:var(--text3);margin-top:4px">${_typoFonts.length}/${TYPO_MAX_FONTS} fuentes extra usadas</div>`;

  wrap.querySelectorAll('[data-remove-font]').forEach(btn => {
    btn.addEventListener('click', () => _removeTypoFont(btn.dataset.removeFont));
  });
}

/** Llena los 3 <select> de tipografía (uno por nivel) con las fuentes
 *  base + las extra, más la opción de "usar la fuente por defecto". */
function _renderTypoFontSelects() {
  const allFonts = [...TYPO_BASE_FONTS, ..._typoFonts];
  TYPO_LEVELS.forEach(lvl => {
    const sel = document.getElementById(`typo-${lvl.key}-font`);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = `<option value="">— Fuente por defecto de la página —</option>` +
      allFonts.map(f => `<option value="${f}">${f}</option>`).join('');
    sel.value = current || '';
  });
}

async function _addTypoFont() {
  const input = document.getElementById('typo-font-new');
  if (!input) return;
  const name = input.value.trim();
  if (!name) { toast('⚠️ Escribí el nombre de la fuente'); return; }
  if (TYPO_BASE_FONTS.includes(name) || _typoFonts.includes(name)) {
    toast('⚠️ Esa fuente ya está disponible'); return;
  }
  if (_typoFonts.length >= TYPO_MAX_FONTS) {
    toast(`⚠️ Ya tenés el máximo de ${TYPO_MAX_FONTS} fuentes extra — quitá una para agregar otra`);
    return;
  }
  _injectGoogleFont(name);
  _typoFonts.push(name);
  input.value = '';
  await saveTypographyFonts(_typoFonts);
  _renderTypoFontsList();
  _renderTypoFontSelects();
  toast(`✅ "${name}" agregada — ya la podés elegir en cualquier nivel`);
}

async function _removeTypoFont(name) {
  _typoFonts = _typoFonts.filter(f => f !== name);
  await saveTypographyFonts(_typoFonts);
  _renderTypoFontsList();
  _renderTypoFontSelects();
  toast(`🗑️ "${name}" quitada de la lista de disponibles (los presets que ya la tenían elegida caen a la fuente por defecto)`);
}

/* ─────────────────────────────────────────────────────────────
   FORMULARIO DE NIVELES — sincroniza color↔hex (mismo patrón que
   ya usás para g-solid-color/g-solid-hex) y el label del slider.
   ───────────────────────────────────────────────────────────── */

function _wireLevelControls(lvl) {
  const sizeInput = document.getElementById(`typo-${lvl.key}-size`);
  const sizeVal   = document.getElementById(`typo-${lvl.key}-size-val`);
  const colorInput= document.getElementById(`typo-${lvl.key}-color`);
  const hexInput  = document.getElementById(`typo-${lvl.key}-hex`);

  if (sizeInput && sizeVal) {
    sizeInput.addEventListener('input', () => { sizeVal.textContent = sizeInput.value + 'px'; });
  }
  if (colorInput && hexInput) {
    colorInput.addEventListener('input', () => { hexInput.value = colorInput.value; });
    hexInput.addEventListener('change', () => {
      if (/^#[0-9a-fA-F]{6}$/.test(hexInput.value)) colorInput.value = hexInput.value;
    });
  }
}

function _readLevelsFromForm() {
  const levels = {};
  TYPO_LEVELS.forEach(lvl => {
    levels[lvl.key] = {
      font:  document.getElementById(`typo-${lvl.key}-font`)?.value || '',
      size:  parseInt(document.getElementById(`typo-${lvl.key}-size`)?.value) || 14,
      color: document.getElementById(`typo-${lvl.key}-color`)?.value || '#000000',
    };
  });
  return levels;
}

function _fillLevelsInForm(levels) {
  TYPO_LEVELS.forEach(lvl => {
    const data = (levels && levels[lvl.key]) || { font: '', size: 14, color: '#000000' };
    const fontEl = document.getElementById(`typo-${lvl.key}-font`);
    const sizeEl = document.getElementById(`typo-${lvl.key}-size`);
    const sizeValEl = document.getElementById(`typo-${lvl.key}-size-val`);
    const colorEl = document.getElementById(`typo-${lvl.key}-color`);
    const hexEl = document.getElementById(`typo-${lvl.key}-hex`);
    if (fontEl) fontEl.value = data.font || '';
    if (sizeEl) sizeEl.value = data.size;
    if (sizeValEl) sizeValEl.textContent = data.size + 'px';
    if (colorEl) colorEl.value = data.color;
    if (hexEl) hexEl.value = data.color;
  });
}

/* ─────────────────────────────────────────────────────────────
   PRESETS — selector, guardado, borrado.
   ───────────────────────────────────────────────────────────── */

function _renderTypoPresetSelect() {
  const sel = document.getElementById('typo-preset-select');
  if (!sel) return;
  sel.innerHTML = `<option value="">— Nuevo preset —</option>` +
    _typoPresets.map(p => `<option value="${p.id}">${p.name} (${(p.scopes||[]).join(', ') || 'sin alcance'})</option>`).join('');
  sel.value = _typoEditingId || '';
}

function _loadPresetIntoForm(id) {
  _typoEditingId = id || null;
  const nameEl = document.getElementById('typo-preset-name');
  const scopePinesEl = document.getElementById('typo-scope-pines');
  const scopeZonasEl = document.getElementById('typo-scope-zonas');

  if (!id) {
    if (nameEl) nameEl.value = '';
    if (scopePinesEl) scopePinesEl.checked = false;
    if (scopeZonasEl) scopeZonasEl.checked = false;
    _fillLevelsInForm(null);
    return;
  }

  const preset = _typoPresets.find(p => p.id === id);
  if (!preset) return;
  if (nameEl) nameEl.value = preset.name || '';
  if (scopePinesEl) scopePinesEl.checked = (preset.scopes || []).includes('pines');
  if (scopeZonasEl) scopeZonasEl.checked = (preset.scopes || []).includes('zonas');
  _fillLevelsInForm(preset.levels);
}

async function _saveTypoPreset() {
  const nameEl = document.getElementById('typo-preset-name');
  const name = nameEl ? nameEl.value.trim() : '';
  if (!name) { toast('⚠️ Ponele un nombre al preset'); return; }

  const scopes = [];
  if (document.getElementById('typo-scope-pines')?.checked) scopes.push('pines');
  if (document.getElementById('typo-scope-zonas')?.checked) scopes.push('zonas');

  const id = _typoEditingId || _typoSlug(name);
  const preset = { id, name, scopes, levels: _readLevelsFromForm() };

  const btn = document.getElementById('btn-typo-save');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }

  const ok = await saveTypographyPreset(preset);

  if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar cambios'; }

  if (ok) {
    _typoEditingId = id;
    await _reloadTypoPresets();
    _applyTypographyCSSVars();
    toast(`✅ "${name}" guardado — así lo van a ver los usuarios`);
  }
}

async function _deleteTypoPreset() {
  if (!_typoEditingId) { toast('⚠️ No hay ningún preset guardado seleccionado'); return; }
  const preset = _typoPresets.find(p => p.id === _typoEditingId);
  await deleteTypographyPreset(_typoEditingId);
  _typoEditingId = null;
  await _reloadTypoPresets();
  _loadPresetIntoForm(null);
  _applyTypographyCSSVars();
  toast(`🗑️ Preset "${preset ? preset.name : ''}" borrado`);
}

async function _reloadTypoPresets() {
  _typoPresets = await loadTypographyPresets();
  _renderTypoPresetSelect();
}

/* ─────────────────────────────────────────────────────────────
   APLICACIÓN VIA VARIABLES CSS — el único lugar que efectivamente
   "pinta" algo. Nunca toca poi-panel.js ni zones.js, nunca hace
   element.style.x = ... Arma un <style id="dyn-typography"> con
   las variables por scope, con clamp() para que un tamaño extremo
   no rompa el layout en celulares (protección pedida explícitamente).
   ───────────────────────────────────────────────────────────── */

function _getDynTypographyStyle() {
  let s = document.getElementById('dyn-typography');
  if (!s) { s = document.createElement('style'); s.id = 'dyn-typography'; document.head.appendChild(s); }
  return s;
}

function _applyTypographyCSSVars() {
  const scopes = { pines: null, zonas: null };
  _typoPresets.forEach(p => {
    (p.scopes || []).forEach(s => { if (scopes.hasOwnProperty(s)) scopes[s] = p; });
  });

  let css = '';
  Object.keys(scopes).forEach(scope => {
    const preset = scopes[scope];
    if (!preset) return; // sin preset activo en este scope: se queda con los defaults del CSS estático
    TYPO_LEVELS.forEach(lvl => {
      const data = preset.levels && preset.levels[lvl.key];
      if (!data) return;
      const fontValue = data.font ? `'${data.font}', var(${lvl.fallbackFontVar})` : `var(${lvl.fallbackFontVar})`;
      css += `:root{--${scope}-${lvl.cssVarPrefix}-font:${fontValue};--${scope}-${lvl.cssVarPrefix}-size:${data.size}px;--${scope}-${lvl.cssVarPrefix}-color:${data.color};}`;
    });
  });

  _getDynTypographyStyle().textContent = css;
}

/* ─────────────────────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────────────────────── */

async function initTypographyTab() {
  _renderTypoFontsList();
  _renderTypoFontSelects();
  _renderTypoPresetSelect();
}

(async function _bootTypography() {
  // 1. Fuentes: se cargan para TODOS los visitantes, no solo en el
  //    admin — por eso esto corre siempre, no solo al abrir la pestaña.
  _typoFonts = await loadTypographyFonts();
  _typoFonts.forEach(_injectGoogleFont);

  // 2. Presets: se leen siempre (para aplicar las variables CSS a
  //    cualquier visitante), la UI de edición se llena recién si el
  //    admin abre la pestaña (ver SC.registerTabPlugin más abajo).
  _typoPresets = await loadTypographyPresets();
  _applyTypographyCSSVars();

  // 3. Wiring de controles — es seguro llamarlo aunque el HTML de
  //    esta pestaña no exista todavía en una versión vieja del
  //    index.html: todo acá adentro chequea que el elemento exista.
  TYPO_LEVELS.forEach(_wireLevelControls);

  const addFontBtn = document.getElementById('btn-typo-font-add');
  if (addFontBtn) addFontBtn.addEventListener('click', _addTypoFont);

  const presetSelect = document.getElementById('typo-preset-select');
  if (presetSelect) presetSelect.addEventListener('change', () => _loadPresetIntoForm(presetSelect.value || null));

  const saveBtn = document.getElementById('btn-typo-save');
  if (saveBtn) saveBtn.addEventListener('click', _saveTypoPreset);

  const deleteBtn = document.getElementById('btn-typo-delete');
  if (deleteBtn) deleteBtn.addEventListener('click', _deleteTypoPreset);
})();

if (typeof SC !== 'undefined' && SC.registerTabPlugin) {
  SC.registerTabPlugin('typography', initTypographyTab);
}
