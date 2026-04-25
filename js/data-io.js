/* ═══════════════════════════════════════════════════════════
   EXPORT / IMPORT — Esquema canónico v1.0
   Campos estables (nunca cambian entre versiones):
     id, name, category, lat, lng, icon, imgB64
   Campos extendidos (pueden crecer):
     desc, hist, soc, events, iconCyber, iconWinter, iconZombie
   ═══════════════════════════════════════════════════════════ */

const SCHEMA_VERSION = "3.0";

/* ─────────────────────────────────────────
   EXPORT — includes POIs + globalSettings
   ───────────────────────────────────────── */
/* ═══════════════════════════════════════════════════════════
   EXPORT — snapshot completo de TODO el estado del admin
   Cualquier propiedad nueva en globalSettings o nueva
   colección (CUSTOM_CATS, GROUPS) se incluye automáticamente.
   ═══════════════════════════════════════════════════════════ */
function exportPOIs() {
  // Aseguramos que eyeGlowIntensity y shadowOn/shadowColor/shadowOpacity
  // ya están en globalSettings (se setean al cargar la página, pero por
  // si acaso los inicializamos con defaults aquí)
  const settings = {
    solidPx:        globalSettings.solidPx        ?? 0,
    solidColor:     globalSettings.solidColor      ?? '#ffffff',
    glowPx:         globalSettings.glowPx          ?? 0,
    glowColor:      globalSettings.glowColor       ?? '#60a5fa',
    dimOpacity:     globalSettings.dimOpacity       ?? 0.35,
    pinSize:        globalSettings.pinSize          ?? 44,
    expandScale:    globalSettings.expandScale      ?? 3.2,
    eyeGlowColor:   globalSettings.eyeGlowColor     ?? '#60a5fa',
    eyeGlowIntensity: globalSettings.eyeGlowIntensity ?? 2,
    nameSize:       globalSettings.nameSize         ?? 26,
    shadowOn:       globalSettings.shadowOn         ?? true,
    shadowColor:    globalSettings.shadowColor      ?? '#000000',
    shadowOpacity:  globalSettings.shadowOpacity    ?? 0.20,
    // Captura cualquier propiedad adicional que pueda haberse agregado
    ...globalSettings,
  };

  const payload = {
    schema:   SCHEMA_VERSION,
    app:      "smartcity-urbano",
    exported: new Date().toISOString().split('T')[0],

    // ── Configuración del mapa (tile provider, tint, opacity) ──
    mapaSettings: typeof _mapaSettings !== 'undefined' ? { ..._mapaSettings } : null,

    // ── Configuración visual completa ──
    settings,

    // ── Categorías personalizadas (creadas en admin) ──
    customCats: { ...CUSTOM_CATS },

    // ── Grupos de lugares ──
    groups: GROUPS.map(g => ({ ...g })),

    // ── Zonas de interés ──
    zonas: ZONAS.map(z => ({ ...z })),

    // ── Lugares ──
    pois: POIS.map(p => ({
      id: p.id, name: p.name,
      category:  p.category,
      categories: p.categories || null,
      lat: p.lat, lng: p.lng,
      icon: p.icon,
      imgB64:   p.imgB64   || null,
      imgAlt1:  p.imgAlt1  || null,
      imgAlt2:  p.imgAlt2  || null,
      imgAlt3:  p.imgAlt3  || null,
      desc:     p.desc     || "",
      hist:     p.hist     || "",
      soc:      p.soc      || [],
      tags:     p.tags     || [],
      events:   p.events   || [],
      address:  p.address  || "",
      groupId:  p.groupId  || null,
      active:   p.active   !== false,
      iconCyber:  p.iconCyber  || "🔵",
      iconWinter: p.iconWinter || "❄️",
      iconZombie: p.iconZombie || "☣️",
      categoryLabel: p.categoryLabel || (CAT[p.category]||{label:(p.category||'').toUpperCase()}).label,
    })),
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `smartcity-cordoba-${payload.exported}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`✅ ${POIS.length} lugares + configuración completa exportados`);
}

/* ─────────────────────────────────────────
   IMPORT — validation UI with checklist
   ───────────────────────────────────────── */
let _importData    = null;
let _importChecks  = [];   // { key, label, status:'ok'|'warn'|'error', selected }

function handleImportFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (typeof data !== 'object') throw new Error("No es un objeto JSON válido");
      _importData = data;
      runImportChecks(data);
    } catch(err) {
      toast('⚠️ Archivo inválido: ' + err.message);
      document.getElementById('import-file').value = '';
    }
  };
  reader.readAsText(file);
}

function runImportChecks(data) {
  _importChecks = [];

  function chk(key, label, fn) {
    let status = 'ok', detail = '';
    try {
      const result = fn(data);
      if (result === true)              { status = 'ok'; }
      else if (typeof result === 'string') { status = 'warn'; detail = result; }
    } catch(err) { status = 'error'; detail = err.message; }
    _importChecks.push({ key, label, status, detail, selected: status !== 'error' });
  }

  chk('schema',     'Versión del archivo',
    d => {
      if (!d.schema) return 'Sin versión — puede ser archivo antiguo';
      if (d.schema === SCHEMA_VERSION) return true;
      return `v${d.schema} → app usa v${SCHEMA_VERSION} (compatible)`;
    });

  chk('pois',       `Lugares (${(data.pois||[]).length} encontrados)`,
    d => {
      if (!d.pois || !Array.isArray(d.pois)) throw new Error("No hay lista de lugares");
      if (d.pois.length === 0) return 'La lista está vacía';
      const bad = d.pois.filter(p => !p.name || p.lat === undefined || p.lng === undefined);
      if (bad.length > 0) return `${bad.length} lugar(es) con datos incompletos (se cargarán con fallbacks)`;
      return true;
    });

  chk('images',     'Imágenes de edificios',
    d => {
      if (!d.pois) return true;
      const withImg = d.pois.filter(p => p.imgB64).length;
      if (withImg === 0) return 'Sin imágenes — se usarán emojis';
      return true;
    });

  chk('settings',   'Configuración visual (outline, glow, sombra, tamaños)',
    d => {
      if (!d.settings) return 'Sin config guardada — se mantendrá la actual';
      const keys = ['solidPx','glowPx','pinSize','expandScale','shadowOn','shadowColor','shadowOpacity'];
      const missing = keys.filter(k => d.settings[k] === undefined);
      if (missing.length) return `Faltan campos: ${missing.join(', ')} (se usarán defaults)`;
      return true;
    });

  chk('customCats', `Categorías personalizadas (${Object.keys(data.customCats||{}).length} encontradas)`,
    d => {
      if (!d.customCats || !Object.keys(d.customCats).length)
        return 'Sin categorías personalizadas — se mantendrán las actuales';
      return true;
    });

  chk('groups',     `Grupos de lugares (${(data.groups||[]).length} encontrados)`,
    d => {
      if (!d.groups || !d.groups.length) return 'Sin grupos — se mantendrán los actuales';
      return true;
    });

  chk('zonas',      `Zonas de interés (${(data.zonas||[]).length} encontradas)`,
    d => {
      if (!d.zonas || !d.zonas.length) return 'Sin zonas — se mantendrán las actuales';
      return true;
    });

  chk('tags',       'Tags/Subcategorías por lugar',
    d => {
      if (!d.pois) return true;
      const withTags = d.pois.filter(p => p.tags && p.tags.length > 0).length;
      if (withTags === 0) return 'Sin tags guardados';
      return true;
    });

  renderImportModal();
}

function renderImportModal() {
  const warn = document.getElementById('import-warning');
  const d = _importData;
  const allOk    = _importChecks.every(c => c.status !== 'error');
  const hasWarn  = _importChecks.some(c => c.status === 'warn');
  const checksHtml = _importChecks.map((c, i) => {
    const icon = c.status==='ok' ? '✅' : c.status==='warn' ? '⚠️' : '❌';
    const col  = c.status==='ok' ? '#16a34a' : c.status==='warn' ? '#d97706' : '#dc2626';
    const checked = c.selected ? 'checked' : '';
    const disabled = c.status==='error' ? 'disabled' : '';
    return `<label style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid rgba(0,0,0,.05);cursor:pointer;">
      <input type="checkbox" data-ci="${i}" ${checked} ${disabled}
        style="margin-top:2px;accent-color:var(--accent);flex-shrink:0">
      <span style="flex:1">
        <span style="font-size:13px;font-weight:600;color:${col}">${icon} ${c.label}</span>
        ${c.detail ? `<span style="display:block;font-size:11px;color:var(--text3);margin-top:1px">${c.detail}</span>` : ''}
      </span>
    </label>`;
  }).join('');

  warn.innerHTML = `
    <div style="font-weight:700;font-size:13px;margin-bottom:8px">
      📂 Archivo: <span style="color:var(--accent)">${d.exported||'?'}</span>
      · Schema <span style="color:var(--text2)">v${d.schema||'?'}</span>
    </div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:10px">
      Seleccioná qué datos querés cargar. Los marcados en rojo tienen errores y no se pueden importar.
    </div>
    ${checksHtml}
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      <button id="import-confirm" style="flex:1;background:${allOk?'var(--accent)':'var(--amber)'};color:white;border:none;border-radius:6px;padding:8px 12px;font-size:12px;font-weight:600;cursor:pointer">
        ${allOk ? '✓ Importar seleccionados' : '⚠ Importar igual'}
      </button>
      <button id="import-cancel" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-size:12px;cursor:pointer">Cancelar</button>
    </div>`;
  warn.classList.add('show');

  // Wire checkboxes
  warn.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      _importChecks[parseInt(cb.dataset.ci)].selected = cb.checked;
    });
  });
  document.getElementById('import-confirm').onclick = confirmImport;
  document.getElementById('import-cancel').onclick  = cancelImport;
}

function confirmImport() {
  if (!_importData) return;
  const sel = key => _importChecks.find(c => c.key === key)?.selected;

  // ── Mapa settings ──
  if (_importData.mapaSettings) {
    Object.assign(_mapaSettings, _importData.mapaSettings);
    // applyTileUrl/_mapaSettings are defined later in the script — call safely
    if (typeof applyTileUrl === 'function') {
      applyTileUrl(_mapaSettings.tileUrl);
      applyMapaOpacity(_mapaSettings.opacity);
      applyTint();
    }
  }

  // ── POIs ──
  if (sel('pois') && _importData.pois?.length) {
    Object.keys(markers).forEach(id => removeMarker(parseInt(id)));
    markers = {}; POIS.length = 0;
    let maxId = 99;
    _importData.pois.forEach(p => {
      const poi = {
        id: p.id, name: p.name,
        category:   p.category,
        categories: p.categories || null,
        lat: parseFloat(p.lat), lng: parseFloat(p.lng),
        icon: p.icon || "📍",
        imgB64:  sel('images') ? (p.imgB64  || null) : null,
        imgAlt1: sel('images') ? (p.imgAlt1 || null) : null,
        imgAlt2: sel('images') ? (p.imgAlt2 || null) : null,
        imgAlt3: sel('images') ? (p.imgAlt3 || null) : null,
        desc:     p.desc     || "",
        hist:     p.hist     || "Sin datos históricos.",
        soc:      Array.isArray(p.soc)    ? p.soc    : [],
        tags:     sel('tags') && Array.isArray(p.tags) ? p.tags : [],
        events:   Array.isArray(p.events) ? p.events : [],
        address:  p.address  || "",
        groupId:  p.groupId  || null,
        active:   p.active   !== false,
        iconCyber:  p.iconCyber  || "🔵",
        iconWinter: p.iconWinter || "❄️",
        iconZombie: p.iconZombie || "☣️",
        categoryLabel: p.categoryLabel || (CAT[p.category]||{label:(p.category||'').toUpperCase()}).label,
      };
      POIS.push(poi); makeMarker(poi);
      if (p.id > maxId) maxId = p.id;
    });
    nextId = maxId + 1;
    applyFilter(); renderList();
    if (POIS.length) {
      const lats = POIS.map(p => p.lat), lngs = POIS.map(p => p.lng);
      map.fitBounds([[Math.min(...lats),Math.min(...lngs)],[Math.max(...lats),Math.max(...lngs)]],{padding:[40,40],maxZoom:16,animate:true});
    }
  }

  // ── Settings visuales ──
  if (sel('settings') && _importData.settings) {
    // Merge genérico: cualquier propiedad futura también se restaura
    Object.assign(globalSettings, _importData.settings);
    const s = globalSettings;

    applyGlobalDim();
    rebuildAllMarkers();
    if (typeof applyShadow === 'function') applyShadow();
    if (typeof applyEyeGlowColor === 'function') applyEyeGlowColor();

    // Sync UI — sliders y displays
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    setVal('g-solid-px',        s.solidPx);          setText('g-solid-px-val',       s.solidPx + 'px');
    setVal('g-glow-px',         s.glowPx);            setText('g-glow-px-val',        s.glowPx + 'px');
    setVal('g-pin-size',        s.pinSize);           setText('g-pin-size-val',       s.pinSize + 'px');
    setVal('g-expand-scale',    s.expandScale * 10);  setText('g-expand-scale-val',   s.expandScale + '×');
    setVal('g-name-size',       s.nameSize || 26);    setText('g-name-size-val',      (s.nameSize||26) + 'px');
    setVal('g-solid-color',     s.solidColor);        setVal('g-solid-hex',           s.solidColor);
    setVal('g-glow-color',      s.glowColor);         setVal('g-glow-hex',            s.glowColor);
    setVal('g-eye-glow-color',  s.eyeGlowColor);
    setVal('g-shadow-color',    s.shadowColor);
    setVal('g-shadow-opacity',  Math.round((s.shadowOpacity||0.2)*100));
    setText('g-shadow-opacity-val', Math.round((s.shadowOpacity||0.2)*100) + '%');
    setVal('g-eye-glow-intensity', s.eyeGlowIntensity || 2);

    const shadowToggle = document.getElementById('g-shadow-toggle');
    if (shadowToggle) shadowToggle.classList.toggle('on', s.shadowOn !== false);

    document.documentElement.style.setProperty('--pp-name-size', (s.nameSize||26) + 'px');
  }

  // ── Categorías personalizadas ──
  if (sel('customCats') && _importData.customCats) {
    CUSTOM_CATS = {};
    Object.entries(_importData.customCats).forEach(([k, v]) => { CUSTOM_CATS[k] = { ...v }; });
    if (typeof renderCatsAdmin  === 'function') renderCatsAdmin();
    if (typeof updateFilterBar  === 'function') updateFilterBar();
  }

  // ── Grupos ──
  if (sel('groups') && _importData.groups?.length) {
    GROUPS.length = 0;
    _importData.groups.forEach(g => GROUPS.push({ ...g }));
    if (typeof renderGroupsAdmin  === 'function') renderGroupsAdmin();
    if (typeof refreshGroupSelects === 'function') refreshGroupSelects();
  }

  // ── Zonas ──
  if (sel('zonas') && _importData.zonas?.length) {
    ZONAS.length = 0;
    _importData.zonas.forEach(z => ZONAS.push({ ...z }));
    if (typeof buildZonasDropdown === 'function') buildZonasDropdown();
    if (typeof renderZonasAdmin   === 'function') renderZonasAdmin();
  }

  document.getElementById('import-warning').classList.remove('show');
  _importData = null;
  document.getElementById('import-file').value = '';
  const imported = _importChecks.filter(c => c.selected).map(c => c.label).join(', ');
  toast(`✅ Importado: ${imported}`);
}

function cancelImport() {
  _importData = null;
  document.getElementById('import-warning').classList.remove('show');
  document.getElementById('import-file').value = '';
}

