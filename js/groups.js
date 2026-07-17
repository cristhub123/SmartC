/* groups.js — groups system */
/* ═══════════════════════════════════════════════════════════
   GRUPOS DE LUGARES
   ═══════════════════════════════════════════════════════════ */
let GROUPS = []; // { id, name, desc, shareImg, shareDesc, shareHist, shareSoc, shareCats, imgB64 }

function applyGroupFields(poi) {
  if (!poi.groupId) return;
  const g = GROUPS.find(x => x.id === poi.groupId);
  if (!g) return;
  if (g.shareImg  && g.imgB64)  poi.imgB64  = g.imgB64;
  if (g.shareDesc && g.desc)    poi.desc    = g.desc;
  if (g.shareHist && g.hist)    poi.hist    = g.hist;
  if (g.shareSoc  && g.soc)     poi.soc     = [...g.soc];
  if (g.shareCats && g.cats)    { poi.categories = [...g.cats]; poi.category = g.cats[0]; }
}

function renderGroupsAdmin() {
  const list = document.getElementById('groups-admin-list');
  if (!list) return;
  if (!GROUPS.length) {
    list.innerHTML = '<div class="empty-state" style="padding:12px 0"><div class="big">📦</div>Sin grupos creados.</div>';
    return;
  }
  list.innerHTML = GROUPS.map(g => {
    const memberCount = POIS.filter(p => p.groupId === g.id).length;
    const shared = [
      g.shareImg  && '🖼 Imagen',
      g.shareDesc && '📝 Desc',
      g.shareHist && '📜 Hist',
      g.shareSoc  && '🔗 Redes',
      g.shareCats && '🏷 Categ',
    ].filter(Boolean).join(' · ');
    return `<div class="za-row" style="flex-wrap:wrap;gap:6px">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px">${g.name}</div>
        <div style="font-size:11px;color:var(--text3)">${memberCount} lugar(es) · ${shared||'Sin campos compartidos'}</div>
      </div>
      <button class="ibtn del" onclick="deleteGroup('${g.id}')" title="Eliminar grupo">🗑️</button>
    </div>`;
  }).join('');
}

window.deleteGroup = function(id) {
  const idx = GROUPS.findIndex(g => g.id === id);
  if (idx !== -1) {
    POIS.forEach(p => { if (p.groupId === id) delete p.groupId; });
    GROUPS.splice(idx, 1);
    renderGroupsAdmin();
    toast('🗑 Grupo eliminado');
  }
};

const btnAddGroup = document.getElementById('btn-add-group');
if (btnAddGroup) {
  btnAddGroup.addEventListener('click', () => {
    const name = document.getElementById('ng-name')?.value.trim();
    if (!name) { toast('⚠️ Ingresá el nombre del grupo'); return; }
    const g = {
      id:        'g_' + Date.now().toString(36),
      name,
      desc:      document.getElementById('ng-desc')?.value.trim() || '',
      shareImg:  document.getElementById('ng-share-img')?.checked  || false,
      shareDesc: document.getElementById('ng-share-desc')?.checked || false,
      shareHist: document.getElementById('ng-share-hist')?.checked || false,
      shareSoc:  document.getElementById('ng-share-soc')?.checked  || false,
      shareCats: document.getElementById('ng-share-cats')?.checked || false,
      soc: [],
    };
    GROUPS.push(g);
    document.getElementById('ng-name').value = '';
    document.getElementById('ng-desc').value = '';
    renderGroupsAdmin();
    // Agregar el grupo a los selects de lugar (add/edit)
    refreshGroupSelects();
    toast(`✅ Grupo "${name}" creado`);
  });
}

function refreshGroupSelects() {
  // Agrega selector de grupo en los formularios de agregar/editar
  ['a-group','e-group'].forEach(selId => {
    const sel = document.getElementById(selId);
    if (!sel) return;
    sel.innerHTML = `<option value="">Sin grupo</option>` +
      GROUPS.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
  });
}

// Agregar el selector de grupo al formulario de edición de forma dinámica
(function injectGroupSelectors() {
  // En el formulario "Agregar"
  const addNameFg = document.getElementById('a-name')?.closest('.fg');
  if (addNameFg && !document.getElementById('a-group')) {
    const fg = document.createElement('div');
    fg.className = 'fg';
    fg.innerHTML = `<label class="fl">Grupo (opcional)</label>
      <select class="fs" id="a-group"><option value="">Sin grupo</option></select>`;
    addNameFg.parentNode.insertBefore(fg, addNameFg.nextSibling);
  }
  // En el formulario "Editar"
  const editNameFg = document.getElementById('e-name')?.closest('.fg');
  if (editNameFg && !document.getElementById('e-group')) {
    const fg = document.createElement('div');
    fg.className = 'fg';
    fg.innerHTML = `<label class="fl">Grupo (opcional)</label>
      <select class="fs" id="e-group"><option value="">Sin grupo</option></select>`;
    editNameFg.parentNode.insertBefore(fg, editNameFg.nextSibling);
  }
})();

// Extender switchTab para renderizar grupos
SC.registerTabPlugin('groups', renderGroupsAdmin);
// Agregar groups al mapa de tabs
const _mapTGroups = {list:'tp-list',add:'tp-add',edit:'tp-edit',global:'tp-global','zonas-admin':'tp-zonas-admin',roadmap:'tp-roadmap',cats:'tp-cats',groups:'tp-groups'};
SC.registerTabPlugin('groups', renderGroupsAdmin);



