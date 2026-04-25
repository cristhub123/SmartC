const ZONAS = [
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

let zonasOpen   = false;
let lastZonaId  = null; // persistencia inteligente

let _editingZonaId = null;

function renderZonasAdmin() {
  const list = document.getElementById('zonas-admin-list');
  list.innerHTML = ZONAS.map((z,i) => `
    <div class="za-row" data-id="${z.id}" draggable="true">
      <span class="za-drag">⠿</span>
      <span class="za-name">${z.name}</span>
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
  toast(z.active ? `✅ ${z.name} activada` : `⭕ ${z.name} desactivada`);
};

window.startEditZona = function(id) {
  const z = ZONAS.find(x => x.id === id);
  if (!z) return;
  _editingZonaId = id;
  document.getElementById('ze-name').value = z.name;
  document.getElementById('ze-tags').value = (z.tags||[]).join(', ');
  // Build attrs inputs
  const wrap = document.getElementById('ze-attrs-wrap');
  wrap.innerHTML = (z.attrs||[]).map((a,i) => `
    <div style="display:flex;gap:7px;margin-bottom:7px">
      <input class="fi" style="flex:0 0 110px;font-size:12px" value="${a.l}" id="ze-al-${i}" placeholder="Label">
      <input class="fi" style="flex:1;font-size:12px" value="${a.v}" id="ze-av-${i}" placeholder="Valor">
    </div>`).join('');
  document.getElementById('zona-edit-form').style.display = 'block';
  document.getElementById('zona-edit-form').scrollIntoView({behavior:'smooth'});
};

document.getElementById('btn-save-zona').addEventListener('click', () => {
  const z = ZONAS.find(x => x.id === _editingZonaId);
  if (!z) return;
  z.name  = document.getElementById('ze-name').value.trim() || z.name;
  z.tags  = document.getElementById('ze-tags').value.split(',').map(s=>s.trim()).filter(Boolean);
  const attrCount = document.querySelectorAll('[id^="ze-al-"]').length;
  z.attrs = [];
  for (let i=0; i<attrCount; i++) {
    const l = document.getElementById(`ze-al-${i}`)?.value.trim();
    const v = document.getElementById(`ze-av-${i}`)?.value.trim();
    if (l) z.attrs.push({l,v});
  }
  document.getElementById('zona-edit-form').style.display = 'none';
  buildZonasDropdown();
  renderZonasAdmin();
  toast(`✅ ${z.name} actualizada`);
  _editingZonaId = null;
});

document.getElementById('btn-cancel-zona').addEventListener('click', () => {
  document.getElementById('zona-edit-form').style.display = 'none';
  _editingZonaId = null;
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

// Init active flag
ZONAS.forEach(z => { if (z.active === undefined) z.active = true; });
buildZonasDropdown();
