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

  // Botón "Nueva zona" — se inyecta arriba de la lista si el
  // contenedor todavía no lo tiene (defensivo: no rompe si en algún
  // momento se agrega a mano directo en el HTML).
  const container = list && list.parentElement;
  if (container && !document.getElementById('btn-new-zona')) {
    const btn = document.createElement('button');
    btn.id = 'btn-new-zona';
    btn.type = 'button';
    btn.textContent = '➕ Nueva zona';
    btn.className = 'ibtn';
    btn.style.cssText = 'margin-bottom:10px;width:100%;';
    btn.addEventListener('click', startNewZona);
    container.insertBefore(btn, list);
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

  // Build attrs inputs
  const wrap = document.getElementById('ze-attrs-wrap');
  wrap.innerHTML = (z.attrs||[]).map((a,i) => `
    <div style="display:flex;gap:7px;margin-bottom:7px">
      <input class="fi" style="flex:0 0 110px;font-size:12px" value="${a.l}" id="ze-al-${i}" placeholder="Label">
      <input class="fi" style="flex:1;font-size:12px" value="${a.v}" id="ze-av-${i}" placeholder="Valor">
    </div>`).join('');
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
    ZONAS = ZONAS_SEED.map(z => ({ ...z, active: true, clicks: 0 }));
    await Promise.all(ZONAS.map(z => saveZonaToFirestore(z)));
  }

  ZONAS.forEach(z => { if (z.active === undefined) z.active = true; });
  buildZonasDropdown();
}
_initZonas();

/* === REGISTRO DE PESTAÑA ADMIN — dibuja la lista de zonas al abrir la pestaña === */
SC.registerTabPlugin('zonas-admin', renderZonasAdmin);


