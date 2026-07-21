/* data-io.js — export/import JSON v2.0+ */
/* ═══════════════════════════════════════════════════════════
   EXPORT / IMPORT — Esquema canónico v1.0
   Campos estables (nunca cambian entre versiones):
     id, name, category, lat, lng, icon, imgB64
   Campos extendidos (pueden crecer):
     desc, hist, soc, events, iconCyber, iconWinter, iconZombie
   ═══════════════════════════════════════════════════════════ */

const SCHEMA_VERSION = "2.0";

/* ─────────────────────────────────────────
   EXPORT — includes POIs + globalSettings
   ───────────────────────────────────────── */
function exportPOIs() {
  const payload = {
    schema:   SCHEMA_VERSION,
    app:      "smartcity-urbano",
    exported: new Date().toISOString().split('T')[0],
    settings: { ...globalSettings },           // ← toda la config visual
    zonas:    ZONAS.map(z => ({...z})),        // ← zonas con su estado
    pois: POIS.map(p => ({
      id: p.id, name: p.name, category: p.category,
      lat: p.lat, lng: p.lng, icon: p.icon,
      imgB64:   p.imgB64   || null,
      imgAlt1:  p.imgAlt1  || null,
      imgAlt2:  p.imgAlt2  || null,
      imgAlt3:  p.imgAlt3  || null,
      desc:     p.desc     || "",
      hist:     p.hist     || "",
      soc:      p.soc      || [],
      tags:     p.tags     || [],
      phone:    p.phone    || '',
      hours:    p.hours    || '',
      events:   p.events   || [],
      iconCyber:  p.iconCyber  || "🔵",
      iconWinter: p.iconWinter || "❄️",
      iconZombie: p.iconZombie || "☣️",
      categoryLabel: p.categoryLabel || (CAT[p.category]||{label:p.category.toUpperCase()}).label,
    }))
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], {type:'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `smartcity-cordoba-${payload.exported}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`✅ ${POIS.length} lugares + configuración exportados`);
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
      if (result === true) { status = 'ok'; }
      else if (typeof result === 'string') { status = 'warn'; detail = result; }
    } catch(err) { status = 'error'; detail = err.message; }
    _importChecks.push({ key, label, status, detail, selected: status !== 'error' });
  }

  chk('schema',   'Versión del archivo',
    d => {
      if (!d.schema) return 'Sin versión — puede ser archivo antiguo';
      if (d.schema === SCHEMA_VERSION) return true;
      return `v${d.schema} → app usa v${SCHEMA_VERSION} (compatible)`;
    });
  chk('pois',     `Lugares (${(data.pois||[]).length} encontrados)`,
    d => {
      if (!d.pois || !Array.isArray(d.pois)) throw new Error("No hay lista de lugares");
      if (d.pois.length === 0) return 'La lista está vacía';
      const bad = d.pois.filter(p => !p.name || p.lat === undefined || p.lng === undefined);
      if (bad.length > 0) return `${bad.length} lugar(es) con datos incompletos (se cargarán igual con fallbacks)`;
      return true;
    });
  chk('images',   'Imágenes de edificios',
    d => {
      if (!d.pois) return true;
      const withImg = d.pois.filter(p => p.imgB64).length;
      if (withImg === 0) return 'Sin imágenes — se usarán emojis';
      return true;  // "X lugares con imagen"
    });
  chk('settings', 'Configuración visual (outline, glow, tamaños)',
    d => {
      if (!d.settings) return 'Sin config guardada — se mantendrá la actual';
      const keys = ['solidPx','glowPx','pinSize','expandScale'];
      const missing = keys.filter(k => d.settings[k] === undefined);
      if (missing.length) return `Faltan campos: ${missing.join(', ')} (se usarán defaults)`;
      return true;
    });
  chk('zonas',    `Zonas de interés (${(data.zonas||[]).length} encontradas)`,
    d => {
      if (!d.zonas || !d.zonas.length) return 'Sin zonas — se mantendrán las actuales';
      return true;
    });
  chk('tags',     'Tags/Subcategorías por lugar',
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
  const sel = key => _importChecks.find(c=>c.key===key)?.selected;

  // POIs
  if (sel('pois') && _importData.pois?.length) {
    Object.keys(markers).forEach(id => removeMarker(id));
    markers = {}; POIS.length = 0;
    let maxId = 99;
    _importData.pois.forEach(p => {
      const poi = {
        id: p.id, name: p.name, category: p.category,
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
        phone:    p.phone  || '',
        hours:    p.hours  || '',
        events:   Array.isArray(p.events) ? p.events : [],
        iconCyber:  p.iconCyber  || "🔵",
        iconWinter: p.iconWinter || "❄️",
        iconZombie: p.iconZombie || "☣️",
        categoryLabel: p.categoryLabel || (CAT[p.category]||{label:(p.category||'').toUpperCase()}).label,
      };
      POIS.push(poi); makeMarker(poi);
      savePoiToFirestore(poi); // el import también persiste en Firestore
    });
    applyFilter(); renderList();
    if (POIS.length) {
      const lats = POIS.map(p=>p.lat), lngs = POIS.map(p=>p.lng);
      map.fitBounds([[Math.min(...lats),Math.min(...lngs)],[Math.max(...lats),Math.max(...lngs)]],{padding:[40,40],maxZoom:16,animate:true});
    }
  }

  // Settings
  if (sel('settings') && _importData.settings) {
    Object.assign(globalSettings, _importData.settings);
    applyGlobalDim(); rebuildAllMarkers();
    // Sync UI sliders
    const s = globalSettings;
    const setSlider = (id, val) => { const el=document.getElementById(id); if(el) el.value=val; };
    setSlider('g-solid-px', s.solidPx);
    setSlider('g-glow-px',  s.glowPx);
    setSlider('g-pin-size', s.pinSize);
    setSlider('g-expand-scale', s.expandScale * 10);
    setSlider('g-name-size', s.nameSize || 26);
    document.documentElement.style.setProperty('--pp-name-size', (s.nameSize||26)+'px');
    document.getElementById('g-solid-px-val').textContent  = s.solidPx + 'px';
    document.getElementById('g-glow-px-val').textContent   = s.glowPx + 'px';
    document.getElementById('g-pin-size-val').textContent  = s.pinSize + 'px';
    document.getElementById('g-expand-scale-val').textContent = s.expandScale + '×';
    document.getElementById('g-name-size-val').textContent = (s.nameSize||26) + 'px';
  }

  // Zonas
  if (sel('zonas') && _importData.zonas?.length) {
    ZONAS.length = 0;
    _importData.zonas.forEach(z => ZONAS.push(z));
    buildZonasDropdown();
    renderZonasAdmin();
  }

  document.getElementById('import-warning').classList.remove('show');
  _importData = null;
  document.getElementById('import-file').value = '';
  const imported = _importChecks.filter(c=>c.selected).map(c=>c.label).join(', ');
  toast(`✅ Importado: ${imported}`);
}

function cancelImport() {
  _importData = null;
  document.getElementById('import-warning').classList.remove('show');
  document.getElementById('import-file').value = '';
}




