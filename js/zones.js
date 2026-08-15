/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/* zones.js — zonas de interés + admin */
/* ═══════════════════════════════════════════════════════════
   ZONAS DE INTERÉS — zones.js (futuro archivo separado)
   Datos canónicos: id, name, lat, lng, zoom
   Datos extendidos: tags, attrs
   ═══════════════════════════════════════════════════════════ */
// Add active field to all zones on load
/* ANTES: esto era `const ZONAS = [...]` y vivía SOLO en memoria — se
   perdía cualquier cambio del admin al recargar la página. Ahora es
   la semilla de migración: si Firestore todavía no tiene ninguna
   zona guardada (primera vez que corre esto), se usan estos 12
   barrios como punto de partida y se guardan en Firestore de una,
   así no se pierde nada de lo que ya tenías. Después de esa primera
   vez, la fuente real es siempre Firestore, no este arreglo.
   `ZONAS` (sin "_SEED") es el arreglo vivo en memoria, cargado desde
   Firestore al arrancar — ver `_initZonas()` al final del archivo. */
const ZONAS_SEED = [
  { id:'guemes',     name:'Barrio Güemes',
    lat:-31.4227,  lng:-64.1880, zoom:16,
    tags:['Noche','Bares','Arte','Diseño'],
    attrs:[
      {l:'Ideal para',  v:'Salir de noche, bares, música en vivo'},
      {l:'Ambiente',    v:'Bohemio, activo y social'},
      {l:'Tipo de plan',v:'Gastronómico + cultural'},
      {l:'Horario fuerte', v:'Tarde y noche'},
    ]},
  { id:'nva-cba',    name:'Nueva Córdoba',
    lat:-31.4230,  lng:-64.1920, zoom:16,
    tags:['Gastronomía','Vida nocturna','Universidades'],
    attrs:[
      {l:'Ideal para',  v:'Bares, restaurantes, movida universitaria'},
      {l:'Ambiente',    v:'Dinámico y diverso'},
      {l:'Tipo de plan',v:'Gastronómico + social'},
      {l:'Horario fuerte', v:'Todo el día'},
    ]},
  { id:'centro',     name:'Centro Histórico',
    lat:-31.4135,  lng:-64.1833, zoom:16,
    tags:['Turismo','Historia','Compras','Cultura'],
    attrs:[
      {l:'Ideal para',  v:'Turismo, paseo, compras y cultura'},
      {l:'Ambiente',    v:'Activo y céntrico'},
      {l:'Tipo de plan',v:'Cultural + comercial'},
      {l:'Horario fuerte', v:'Mañana y tarde'},
    ]},
  { id:'gral-paz',   name:'Barrio General Paz',
    lat:-31.3980,  lng:-64.1980, zoom:16,
    tags:['Residencial','Gastronomía','Tranquilo'],
    attrs:[
      {l:'Ideal para',  v:'Comer bien, paseo tranquilo'},
      {l:'Ambiente',    v:'Barrial y familiar'},
      {l:'Tipo de plan',v:'Gastronómico + relax'},
      {l:'Horario fuerte', v:'Mediodía y tarde'},
    ]},
  { id:'cerro-rosas',name:'Cerro de las Rosas',
    lat:-31.3780,  lng:-64.2210, zoom:15,
    tags:['Premium','Restaurantes','Exclusivo'],
    attrs:[
      {l:'Ideal para',  v:'Comer bien, salidas tranquilas'},
      {l:'Ambiente',    v:'Elegante y exclusivo'},
      {l:'Tipo de plan',v:'Restaurantes + bares premium'},
      {l:'Horario fuerte', v:'Noche'},
    ]},
  { id:'belgrano',   name:'Villa Belgrano',
    lat:-31.3650,  lng:-64.2380, zoom:15,
    tags:['Residencial','Parques','Familiar'],
    attrs:[
      {l:'Ideal para',  v:'Parques, actividades al aire libre'},
      {l:'Ambiente',    v:'Tranquilo y verde'},
      {l:'Tipo de plan',v:'Recreativo + familiar'},
      {l:'Horario fuerte', v:'Mañana y tarde'},
    ]},
  { id:'arguello',   name:'Argüello',
    lat:-31.3480,  lng:-64.2520, zoom:15,
    tags:['Shoppings','Gastronomía','Comercial'],
    attrs:[
      {l:'Ideal para',  v:'Compras, gastronomía, entretenimiento'},
      {l:'Ambiente',    v:'Comercial y familiar'},
      {l:'Tipo de plan',v:'Comercial + gastronómico'},
      {l:'Horario fuerte', v:'Todo el día'},
    ]},
  { id:'urca',       name:'Barrio Urca',
    lat:-31.4050,  lng:-64.2200, zoom:16,
    tags:['Residencial','Parques','Tranquilo'],
    attrs:[
      {l:'Ideal para',  v:'Paseos, plazas, tranquilidad'},
      {l:'Ambiente',    v:'Barrial y relajado'},
      {l:'Tipo de plan',v:'Paseo + gastronomía cercana'},
      {l:'Horario fuerte', v:'Tarde'},
    ]},
  { id:'jardin',     name:'Barrio Jardín',
    lat:-31.4020,  lng:-64.1680, zoom:16,
    tags:['Residencial','Verde','Tranquilo'],
    attrs:[
      {l:'Ideal para',  v:'Entorno verde, paseos urbanos'},
      {l:'Ambiente',    v:'Residencial y arbolado'},
      {l:'Tipo de plan',v:'Relax + naturaleza'},
      {l:'Horario fuerte', v:'Mañana'},
    ]},
  { id:'alta-cba',   name:'Alta Córdoba / Cofico',
    lat:-31.3920,  lng:-64.1900, zoom:16,
    tags:['Cultural','Bares','Barrial'],
    attrs:[
      {l:'Ideal para',  v:'Bares barriales, vida cultural alternativa'},
      {l:'Ambiente',    v:'Auténtico y popular'},
      {l:'Tipo de plan',v:'Cultural + gastronómico'},
      {l:'Horario fuerte', v:'Noche'},
    ]},
  { id:'juniors',    name:'Barrio Juniors',
    lat:-31.4120,  lng:-64.2050, zoom:16,
    tags:['Residencial','Gastronomía','Barrial'],
    attrs:[
      {l:'Ideal para',  v:'Gastronomía barrial, ambiente local'},
      {l:'Ambiente',    v:'Tranquilo y familiar'},
      {l:'Tipo de plan',v:'Gastronómico'},
      {l:'Horario fuerte', v:'Mediodía'},
    ]},
  { id:'zona-sur',   name:'Zona Sur',
    lat:-31.4480,  lng:-64.2020, zoom:15,
    tags:['Comercial','Acceso fácil','En desarrollo'],
    attrs:[
      {l:'Ideal para',  v:'Comercios, acceso rápido desde el sur'},
      {l:'Ambiente',    v:'Variado y en crecimiento'},
      {l:'Tipo de plan',v:'Comercial + gastronómico'},
      {l:'Horario fuerte', v:'Todo el día'},
    ]},
];

/** Arreglo vivo en memoria — se llena en `_initZonas()` desde
 *  Firestore (o desde ZONAS_SEED si es la primera vez que corre
 *  esto). Todo el resto del archivo sigue usando `ZONAS` igual que
 *  antes, así que no hizo falta tocar el resto de las funciones. */
let ZONAS = [];

let zonasOpen   = false;
let lastZonaId  = null; // persistencia inteligente

let _editingZonaId = null;
let _isCreatingZona = false; // true mientras el form de edición está en modo "nueva zona"

function renderZonasAdmin() {
  const list = document.getElementById('zonas-admin-list');

  // Botones "Nueva zona" / "Ordenar A-Z" — se inyectan arriba de la
  // lista si el contenedor todavía no los tiene (defensivo: no rompe
  // si en algún momento se agregan a mano directo en el HTML).
  const container = list && list.parentElement;
  if (container && !document.getElementById('btn-new-zona')) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;';

    const btnNew = document.createElement('button');
    btnNew.id = 'btn-new-zona';
    btnNew.type = 'button';
    btnNew.textContent = '➕ Nueva zona';
    btnNew.className = 'ibtn';
    btnNew.style.cssText = 'flex:1;min-width:120px;';
    btnNew.addEventListener('click', startNewZona);

    const btnAZ = document.createElement('button');
    btnAZ.id = 'btn-zonas-az';
    btnAZ.type = 'button';
    btnAZ.textContent = '🔤 Ordenar A-Z';
    btnAZ.className = 'ibtn';
    btnAZ.style.cssText = 'flex:1;min-width:120px;';
    btnAZ.title = 'Ordena todas las zonas alfabéticamente y lo guarda';
    btnAZ.addEventListener('click', sortZonasAlphabetically);

    // Botón explícito de guardado — el arrastre manual y "Ordenar A-Z"
    // YA guardan solos, pero se deja este botón para que quede el
    // mismo patrón visual que el resto del admin (ej. "✓ Guardar
    // cambios" en Editar Zona, "✓ Aplicar a todos los pins" en
    // Global) y sirva de confirmación/reintento explícito por las
    // dudas — con feedback claro de que sí quedó guardado.
    const btnSaveOrder = document.createElement('button');
    btnSaveOrder.id = 'btn-zonas-save-order';
    btnSaveOrder.type = 'button';
    btnSaveOrder.textContent = '💾 Guardar orden';
    btnSaveOrder.className = 'ibtn';
    btnSaveOrder.style.cssText = 'flex:1;min-width:120px;';
    btnSaveOrder.title = 'Guarda el orden actual de la lista de forma permanente';
    btnSaveOrder.addEventListener('click', async () => {
      btnSaveOrder.disabled = true;
      const originalText = btnSaveOrder.textContent;
      btnSaveOrder.textContent = '⏳ Guardando...';
      const ok = await saveZonasOrder(ZONAS);
      btnSaveOrder.textContent = originalText;
      btnSaveOrder.disabled = false;
      if (ok) toast('✅ Orden guardado — así lo van a ver los usuarios');
    });

    row.appendChild(btnNew);
    row.appendChild(btnAZ);
    row.appendChild(btnSaveOrder);
    container.insertBefore(row, list);
  }

  list.innerHTML = ZONAS.map((z,i) => `
    <div class="za-row" data-id="${z.id}" draggable="true">
      <span class="za-drag">⠿</span>
      <span class="za-name">${z.name}</span>
      <span style="font-size:11px;color:var(--text3);white-space:nowrap;">👁 ${z.clicks || 0}</span>
      <button class="za-edit-btn" onclick="startEditZona('${z.id}')" title="Editar">✏️</button>
      <button class="za-toggle ${z.active?'on':''}" onclick="toggleZona('${z.id}',this)" title="${z.active?'Desactivar':'Activar'}"></button>
    </div>`).join('');
  // Drag-to-reorder (touch + mouse)
  setupZonaDrag(list);

  // Presets de orden — solo si el HTML ya tiene estos controles (ver
  // el bloque que se agrega a index.html); si no existen, no hace nada.
  _refreshZonaPresetSelect();
}

/**
 * Ordena todas las zonas alfabéticamente por nombre (case-insensitive,
 * respeta acentos/ñ vía localeCompare), reasigna `order` según la
 * nueva posición, y lo guarda de una — no queda solo en memoria.
 */
async function sortZonasAlphabetically() {
  ZONAS.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  renderZonasAdmin();
  buildZonasDropdown();
  await saveZonasOrder(ZONAS);
  toast('✅ Zonas ordenadas alfabéticamente');
}

/* ═══════════════════════════════════════════════════════════
   PRESETS DE ORDEN — guardar el orden actual con un nombre, y
   restaurar cualquiera de los guardados con un clic. Los controles
   son opcionales en el HTML (`zona-preset-name`, `btn-zona-preset-save`,
   `zona-preset-select`, `btn-zona-preset-load`) — todo acá es
   defensivo, si no existen simplemente no se conecta nada.
   ═══════════════════════════════════════════════════════════ */

async function _refreshZonaPresetSelect() {
  const select = document.getElementById('zona-preset-select');
  if (!select) return; // el HTML todavía no tiene el selector — nada que hacer
  const presets = await loadZonaOrderPresets();
  select.innerHTML = '<option value="">— Elegir preset guardado —</option>' +
    presets.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}

function _wireZonaPresetControls() {
  const nameInput  = document.getElementById('zona-preset-name');
  const btnSave    = document.getElementById('btn-zona-preset-save');
  const select     = document.getElementById('zona-preset-select');
  const btnLoad    = document.getElementById('btn-zona-preset-load');

  if (btnSave && nameInput) {
    btnSave.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) { toast('⚠️ Ponele un nombre al preset (ej: "Orden Principal")'); return; }
      await saveZonaOrderPreset(name, ZONAS);
      nameInput.value = '';
      await _refreshZonaPresetSelect();
      toast(`✅ Preset "${name}" guardado`);
    });
  }

  if (btnLoad && select) {
    btnLoad.addEventListener('click', async () => {
      const id = select.value;
      if (!id) { toast('⚠️ Elegí un preset de la lista'); return; }
      const presets = await loadZonaOrderPresets();
      const preset = presets.find(p => p.id === id);
      if (!preset) return;

      // Reordena ZONAS según el orden guardado en el preset. Si algún
      // id del preset ya no existe (se borró esa zona después), se
      // ignora sin romper; si aparece una zona NUEVA que no estaba en
      // el preset, se agrega al final para no perderla de la lista.
      const byId = new Map(ZONAS.map(z => [z.id, z]));
      const reordered = preset.orderIds.map(id2 => byId.get(id2)).filter(Boolean);
      const missing = ZONAS.filter(z => !preset.orderIds.includes(z.id));
      ZONAS = [...reordered, ...missing];

      renderZonasAdmin();
      buildZonasDropdown();
      await saveZonasOrder(ZONAS);
      toast(`✅ Orden "${preset.name}" restaurado`);
    });
  }
}


window.toggleZona = function(id, btn) {
  const z = ZONAS.find(x => x.id === id);
  if (!z) return;
  z.active = !z.active;
  btn.classList.toggle('on', z.active);
  buildZonasDropdown();
  saveZonaToFirestore(z); // ahora sí queda guardado, no solo en memoria
  toast(z.active ? `✅ ${z.name} activada` : `⭕ ${z.name} desactivada`);
};

/**
 * Abre el form en modo EDICIÓN de una zona existente.
 * @param {string} id
 */
window.startEditZona = function(id) {
  const z = ZONAS.find(x => x.id === id);
  if (!z) return;
  _editingZonaId = id;
  _isCreatingZona = false;
  _fillZonaForm(z);
  document.getElementById('zona-edit-form').style.display = 'block';
  document.getElementById('zona-edit-form').scrollIntoView({behavior:'smooth'});
};

/**
 * Abre el form en modo CREACIÓN de una zona nueva (todo vacío).
 * Reusa el mismo form de edición — no hacía falta un HTML aparte.
 */
function startNewZona() {
  _editingZonaId = null;
  _isCreatingZona = true;
  _fillZonaForm({ name: '', lat: null, lng: null, zoom: 15, tags: [], attrs: [] });
  const title = document.getElementById('zona-edit-title');
  if (title) title.textContent = 'Nueva zona';
  document.getElementById('zona-edit-form').style.display = 'block';
  document.getElementById('zona-edit-form').scrollIntoView({behavior:'smooth'});
}
window.startNewZona = startNewZona;

/**
 * Llena el formulario de edición con los datos de una zona (o vacíos,
 * para el modo "nueva"). Centraliza lo que antes estaba solo dentro
 * de startEditZona, para no duplicarlo en startNewZona.
 * @param {Object} z
 */
function _fillZonaForm(z) {
  document.getElementById('ze-name').value = z.name || '';
  document.getElementById('ze-tags').value = (z.tags||[]).join(', ');

  // Campos de ubicación — mismo sistema que los lugares: buscador
  // por texto (prioridad) + clic en el mapa (alternativa). Ver nota
  // en la respuesta: esto todavía necesita el archivo real donde
  // vive ese buscador (geocoder.js/autofill.js) para conectarse del
  // todo — mientras tanto, lat/lng se pueden completar a mano acá.
  const latEl  = document.getElementById('ze-lat');
  const lngEl  = document.getElementById('ze-lng');
  const zoomEl = document.getElementById('ze-zoom');
  if (latEl)  latEl.value  = (z.lat  !== null && z.lat  !== undefined) ? z.lat  : '';
  if (lngEl)  lngEl.value  = (z.lng  !== null && z.lng  !== undefined) ? z.lng  : '';
  if (zoomEl) zoomEl.value = z.zoom || 15;
  if (typeof _syncZonaCoordDisplay === 'function') _syncZonaCoordDisplay();

  const title = document.getElementById('zona-edit-title');
  if (title) title.textContent = z.name ? `Editando "${z.name}"` : 'Nueva zona';

  // Editor de campos de información (antes: solo mostraba los que
  // ya tenía la zona, sin forma de agregar uno nuevo ni sacar uno).
  _renderZonaAttrsEditor(z.attrs || []);
}

/**
 * Lee del formulario los pares [título, texto] tal como están AHORA
 * en pantalla (incluye filas vacías recién agregadas — el filtrado
 * de filas sin título se hace recién al guardar, no acá).
 * @returns {Array<{l:string, v:string}>}
 */
function _readZonaAttrsFromForm() {
  const attrCount = document.querySelectorAll('[id^="ze-al-"]').length;
  const attrs = [];
  for (let i=0; i<attrCount; i++) {
    const l = document.getElementById(`ze-al-${i}`)?.value ?? '';
    const v = document.getElementById(`ze-av-${i}`)?.value ?? '';
    attrs.push({ l, v });
  }
  return attrs;
}

/**
 * Dibuja el editor de "campos de información" de la zona (los que se
 * ven como Ideal para / Ambiente / Tipo de plan / Horario fuerte en
 * el panel del usuario) — con título y texto editables, más un botón
 * "🗑" para quitar cada uno y "➕ Agregar campo" para sumar uno nuevo
 * en blanco. El admin define tanto el TÍTULO del campo como su TEXTO
 * — no hay nada hardcodeado, la cantidad de campos tampoco es fija.
 * @param {Array<{l:string, v:string}>} attrs
 */
function _renderZonaAttrsEditor(attrs) {
  const wrap = document.getElementById('ze-attrs-wrap');
  if (!wrap) return;

  wrap.innerHTML = (attrs || []).map((a,i) => `
    <div class="za-attr-row" style="display:flex;gap:7px;margin-bottom:7px;align-items:center">
      <input class="fi" style="flex:0 0 110px;font-size:12px" value="${a.l||''}" id="ze-al-${i}" placeholder="Título (ej: Ideal para)">
      <input class="fi" style="flex:1;font-size:12px" value="${a.v||''}" id="ze-av-${i}" placeholder="Texto">
      <button type="button" class="ibtn" data-remove-attr="${i}" title="Quitar este campo" style="flex:0 0 auto;padding:6px 9px;">🗑</button>
    </div>`).join('');

  wrap.querySelectorAll('[data-remove-attr]').forEach(btn => {
    btn.addEventListener('click', () => {
      const current = _readZonaAttrsFromForm();
      current.splice(parseInt(btn.dataset.removeAttr, 10), 1);
      _renderZonaAttrsEditor(current);
    });
  });

  // Botón "Agregar campo" — se inyecta una sola vez, justo después
  // del contenedor de filas (no adentro, para que no se borre en
  // cada re-render de las filas).
  let addBtn = document.getElementById('btn-add-zona-attr');
  if (!addBtn) {
    addBtn = document.createElement('button');
    addBtn.id = 'btn-add-zona-attr';
    addBtn.type = 'button';
    addBtn.className = 'ibtn';
    addBtn.style.cssText = 'width:100%;margin-bottom:10px;';
    addBtn.textContent = '➕ Agregar campo de información';
    wrap.parentNode.insertBefore(addBtn, wrap.nextSibling);
  }
  addBtn.onclick = () => {
    const current = _readZonaAttrsFromForm();
    current.push({ l: '', v: '' });
    _renderZonaAttrsEditor(current);
  };
}

/** Muestra la coordenada elegida arriba del botón "clic en el mapa",
 *  igual que `syncAddCoordDisplay`/`syncEditCoordDisplay` de admin.js. */
function _syncZonaCoordDisplay() {
  const lat = document.getElementById('ze-lat')?.value;
  const lng = document.getElementById('ze-lng')?.value;
  const d   = document.getElementById('ze-coord-display');
  if (!d) return;
  if (lat && lng) {
    d.textContent = `${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}`;
    d.classList.add('set');
  } else {
    d.textContent = 'Sin coordenadas — buscá una dirección o hacé clic en el mapa';
    d.classList.remove('set');
  }
}
['ze-lat','ze-lng'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', _syncZonaCoordDisplay);
});

/* === UBICACIÓN DE LA ZONA: mismo combo que los lugares ===
   1) Buscador por nombre/dirección (Nominatim) — vía rápida.
   2) "📍 O hacer clic en el mapa" — alternativa, para zonas amplias
      o lugares que el buscador no encuentra.
   Ambos son DEFENSIVOS: si todavía no agregaste los inputs
   `geo-input-zona`/`geo-btn-zona`/`geo-results-zona` ni el botón
   `btn-pick-zona` al HTML del form de zonas, esto simplemente no
   hace nada — no rompe el resto del archivo. */
if (document.getElementById('geo-input-zona') && typeof setupGeocoder === 'function') {
  setupGeocoder(
    'geo-input-zona', 'geo-btn-zona', 'geo-results-zona',
    'ze-lat', 'ze-lng', 'ze-coord-display', _syncZonaCoordDisplay
  );
}

const _btnPickZona = document.getElementById('btn-pick-zona');
if (_btnPickZona && typeof startPickMode === 'function') {
  _btnPickZona.addEventListener('click', () => {
    startPickMode('zona');
  });
}

document.getElementById('btn-save-zona').addEventListener('click', () => {
  const name = document.getElementById('ze-name').value.trim();
  if (!name) { toast('⚠️ Ingresá el nombre de la zona'); return; }

  const latEl = document.getElementById('ze-lat');
  const lngEl = document.getElementById('ze-lng');
  const lat = latEl ? parseFloat(latEl.value) : NaN;
  const lng = lngEl ? parseFloat(lngEl.value) : NaN;
  if (latEl && lngEl && (isNaN(lat) || isNaN(lng))) {
    toast('⚠️ Falta la ubicación — buscá una dirección o hacé clic en el mapa');
    return;
  }

  const tags = document.getElementById('ze-tags').value.split(',').map(s=>s.trim()).filter(Boolean);
  const attrCount = document.querySelectorAll('[id^="ze-al-"]').length;
  const attrs = [];
  for (let i=0; i<attrCount; i++) {
    const l = document.getElementById(`ze-al-${i}`)?.value.trim();
    const v = document.getElementById(`ze-av-${i}`)?.value.trim();
    if (l) attrs.push({l,v});
  }

  let z;
  if (_isCreatingZona) {
    const id = slugify(name);
    if (ZONAS.some(x => x.id === id)) {
      toast('⚠️ Ya existe una zona con ese nombre');
      return;
    }
    z = {
      id, name, tags, attrs,
      lat: latEl ? lat : 0,
      lng: lngEl ? lng : 0,
      zoom: parseInt(document.getElementById('ze-zoom')?.value) || 15,
      active: true,
      clicks: 0,
    };
    ZONAS.push(z);
  } else {
    z = ZONAS.find(x => x.id === _editingZonaId);
    if (!z) return;
    z.name = name;
    z.tags = tags;
    z.attrs = attrs;
    if (latEl) z.lat = lat;
    if (lngEl) z.lng = lng;
    const zoomEl = document.getElementById('ze-zoom');
    if (zoomEl) z.zoom = parseInt(zoomEl.value) || z.zoom;
  }

  document.getElementById('zona-edit-form').style.display = 'none';
  buildZonasDropdown();
  renderZonasAdmin();
  saveZonaToFirestore(z); // guardado real y permanente
  toast(`✅ ${z.name} ${_isCreatingZona ? 'creada' : 'actualizada'}`);
  _editingZonaId = null;
  _isCreatingZona = false;
});

document.getElementById('btn-cancel-zona').addEventListener('click', () => {
  document.getElementById('zona-edit-form').style.display = 'none';
  _editingZonaId = null;
  _isCreatingZona = false;
});

function setupZonaDrag(list) {
  let dragSrc = null;
  list.querySelectorAll('.za-row').forEach(row => {
    row.addEventListener('dragstart', e => {
      dragSrc = row;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => row.style.opacity = '.4', 0);
    });
    row.addEventListener('dragend', () => { row.style.opacity = ''; });
    row.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
    row.addEventListener('drop', e => {
      e.preventDefault();
      if (dragSrc === row) return;
      const fromId = dragSrc.dataset.id;
      const toId   = row.dataset.id;
      const fi = ZONAS.findIndex(z=>z.id===fromId);
      const ti = ZONAS.findIndex(z=>z.id===toId);
      if (fi<0||ti<0) return;
      const [moved] = ZONAS.splice(fi,1);
      ZONAS.splice(ti,0,moved);
      renderZonasAdmin();
      buildZonasDropdown();
      saveZonasOrder(ZONAS); // el arrastre queda guardado, no solo en memoria
    });
  });
}

function buildZonasDropdown() {
  const scroll = document.getElementById('zonas-list-scroll');
  scroll.innerHTML = '';
  ZONAS.filter(z => z.active !== false).forEach(z => {
    const row = document.createElement('div');
    row.className = 'zd-item';
    row.dataset.id = z.id;
    row.innerHTML = `
      <span class="zd-name">${z.name}</span>
      <button class="zd-info-btn" data-id="${z.id}" title="Ver info">ⓘ</button>`;
    row.querySelector('.zd-name').addEventListener('click', () => navigateToZona(z));
    row.querySelector('.zd-info-btn').addEventListener('click', e => {
      e.stopPropagation(); openZonaPanel(z);
    });
    scroll.appendChild(row);
  });
}

function navigateToZona(z) {
  closeZonasDropdown();
  closeZonaPanel();
  lastZonaId = z.id;
  map.flyTo([z.lat, z.lng], z.zoom, {animate: true, duration: 1.1});

  // Conteo de clicks — permanente en Firestore, mismo criterio que
  // los lugares (incrementPinClicks). Se actualiza también el valor
  // en memoria para que el admin lo vea sin tener que recargar.
  z.clicks = (z.clicks || 0) + 1;
  if (typeof incrementZonaClicks === 'function') incrementZonaClicks(z.id);
}

function openZonaPanel(z) {
  closeZonasDropdown();
  lastZonaId = z.id;
  document.getElementById('zp-name').textContent = z.name;
  const body = document.getElementById('zp-body');
  const tags = z.tags.map(t => `<span class="zp-tag">${t}</span>`).join('');
  const attrs = z.attrs.map(a =>
    `<div class="zp-attr"><span class="zp-attr-label">${a.l}</span><span class="zp-attr-val">${a.v}</span></div>`
  ).join('');
  body.innerHTML = `
    <div class="zp-tag-row">${tags}</div>
    ${attrs}
    <button class="zp-go-btn" id="zp-go">📍 Ir a ${z.name}</button>`;
  document.getElementById('zp-go').addEventListener('click', () => navigateToZona(z));
  document.getElementById('zona-panel').classList.add('open');
  document.getElementById('map').classList.add('zona-blur');
}

function closeZonaPanel() {
  document.getElementById('zona-panel').classList.remove('open');
  document.getElementById('map').classList.remove('zona-blur');
}

function toggleZonasDropdown() {
  zonasOpen = !zonasOpen;
  document.getElementById('zonas-dropdown').classList.toggle('open', zonasOpen);
  document.getElementById('btn-zonas').classList.toggle('open', zonasOpen);
}

function closeZonasDropdown() {
  zonasOpen = false;
  document.getElementById('zonas-dropdown').classList.remove('open');
  document.getElementById('btn-zonas').classList.remove('open');
}

// Wire
document.getElementById('btn-zonas').addEventListener('click', e => {
  e.stopPropagation();
  toggleZonasDropdown();
});
document.getElementById('zp-close').addEventListener('click', closeZonaPanel);

// Swipe down to close zona panel
const zpanel = document.getElementById('zona-panel');
let zpTouchY = 0;
zpanel.addEventListener('touchstart', e => { zpTouchY = e.touches[0].clientY; }, {passive:true});
zpanel.addEventListener('touchend',   e => {
  if (e.changedTouches[0].clientY - zpTouchY > 70 && zpanel.scrollTop === 0) closeZonaPanel();
}, {passive:true});

// Close dropdown on map click or outside click
map.on('click', () => { closeZonasDropdown(); });
document.addEventListener('click', e => {
  if (!e.target.closest('#btn-zonas') && !e.target.closest('#zonas-dropdown')) {
    closeZonasDropdown();
  }
});

/* === INIT — carga las zonas desde Firestore antes de construir
   el dropdown. Si Firestore todavía no tiene ninguna zona guardada
   (primera vez que corre esto sobre este proyecto), usa ZONAS_SEED
   como punto de partida Y las guarda de una, para no perder los 12
   barrios que ya tenías armados. === */
async function _initZonas() {
  const loaded = await loadZonasFromFirestore();

  if (loaded.length > 0) {
    ZONAS = loaded;
  } else {
    // Migración única: Firestore está vacío, se siembra con lo que
    // ya tenías hardcodeado y se guarda cada una de una vez.
    ZONAS = ZONAS_SEED.map((z, i) => ({ ...z, active: true, clicks: 0, order: i }));
    await Promise.all(ZONAS.map(z => saveZonaToFirestore(z)));
  }

  ZONAS.forEach(z => { if (z.active === undefined) z.active = true; });

  // Orden: por el campo `order` si lo tiene. Migración silenciosa
  // para zonas viejas que quedaron sin `order` (de antes de esta
  // función) — se les asigna uno según su posición actual y se
  // guarda, así la próxima carga ya viene ordenada sin este parche.
  const sinOrder = ZONAS.some(z => typeof z.order !== 'number');
  if (sinOrder) {
    ZONAS.forEach((z, i) => { if (typeof z.order !== 'number') z.order = i; });
    saveZonasOrder(ZONAS);
  }
  ZONAS.sort((a, b) => a.order - b.order);

  buildZonasDropdown();
}
_initZonas();
_wireZonaPresetControls();

/* === REGISTRO DE PESTAÑA ADMIN — dibuja la lista de zonas al abrir la pestaña === */
SC.registerTabPlugin('zonas-admin', renderZonasAdmin);


