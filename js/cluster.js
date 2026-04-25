/* ═══════════════════════════════════════════════════════════
   CLUSTER / RUEDA DE PINES
   ═══════════════════════════════════════════════════════════ */
const CLUSTER_PX_THRESHOLD = 42;
let clusterMenu = null;
let _skipCluster = false;

function removeClusterMenu() {
  if (clusterMenu) { clusterMenu.remove(); clusterMenu = null; }
}

function getNearbyPois(clickedPoi) {
  const clickedPx = map.latLngToContainerPoint([clickedPoi.lat, clickedPoi.lng]);
  return Object.values(markers)
    .filter(({poi}) => {
      if (poi.id === clickedPoi.id || poi.active === false) return false;
      const all = getAllCats();
      const cs = Array.isArray(poi.categories) ? poi.categories : [poi.category];
      if (cs.every(c => all[c] && all[c].active === false)) return false;
      const px = map.latLngToContainerPoint([poi.lat, poi.lng]);
      return Math.sqrt((px.x-clickedPx.x)**2 + (px.y-clickedPx.y)**2) < CLUSTER_PX_THRESHOLD;
    }).map(({poi}) => poi);
}

function showClusterMenu(allPois, anchorLatLng) {
  removeClusterMenu();
  const n = allPois.length;
  if (n < 2) return false;
  const px = map.latLngToContainerPoint(anchorLatLng);
  const rect = map.getContainer().getBoundingClientRect();
  const cx = rect.left + px.x, cy = rect.top + px.y;
  const RADIUS = 76, THUMB = 48;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:1999;background:rgba(0,0,0,.28);backdrop-filter:blur(2px);';
  overlay.addEventListener('click', () => { removeClusterMenu(); overlay.remove(); label.remove(); allTips.forEach(t=>t.remove()); });
  document.body.appendChild(overlay);

  const label = document.createElement('div');
  label.style.cssText = `position:fixed;z-index:2001;left:${cx}px;top:${cy}px;transform:translate(-50%,-50%);background:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#3a8c4f;box-shadow:0 4px 16px rgba(0,0,0,.2);border:2.5px solid #3a8c4f;pointer-events:none;font-family:Nunito,sans-serif;`;
  label.textContent = n;
  document.body.appendChild(label);

  const allTips = [];
  const allBtns = [];

  allPois.forEach((poi, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI/2;
    const bx = cx + RADIUS * Math.cos(angle);
    const by = cy + RADIUS * Math.sin(angle);
    const cfg = getAllCats()[poi.category] || {color:'#6055d8'};

    const btn = document.createElement('div');
    btn.id = 'cluster-btn-' + poi.id;
    btn.style.cssText = `position:fixed;z-index:2001;left:${bx}px;top:${by}px;transform:translate(-50%,-50%) scale(0);width:${THUMB}px;height:${THUMB}px;border-radius:${poi.imgB64?'10px':'50%'};background:${poi.imgB64?'white':cfg.color};border:2.5px solid ${cfg.color};box-shadow:0 4px 16px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;transition:transform .25s cubic-bezier(.34,1.56,.64,1);pointer-events:all;transition-delay:${i*35}ms;`;
    if (poi.imgB64) { const img=document.createElement('img'); img.src=poi.imgB64; img.style.cssText='width:100%;height:100%;object-fit:contain;'; btn.appendChild(img); }
    else { btn.style.fontSize='22px'; btn.textContent=poi.icon; }

    const tip = document.createElement('div');
    tip.textContent = poi.name;
    tip.style.cssText = `position:fixed;z-index:2002;left:${bx}px;top:${by-THUMB/2-8}px;transform:translate(-50%,-100%);background:#1c1917;color:white;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:600;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .15s;font-family:sans-serif;`;
    document.body.appendChild(tip);
    allTips.push(tip);

    btn.addEventListener('mouseenter', () => tip.style.opacity='1');
    btn.addEventListener('mouseleave', () => tip.style.opacity='0');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      allBtns.forEach(b => { if(b._tip) b._tip.remove(); b.remove(); });
      label.remove(); overlay.remove(); allTips.forEach(t=>t.remove());
      clusterMenu = null;
      _skipCluster = true;
      pinClick(poi.id);
    });
    btn._tip = tip;
    document.body.appendChild(btn);
    allBtns.push(btn);
    requestAnimationFrame(() => requestAnimationFrame(() => { btn.style.transform='translate(-50%,-50%) scale(1)'; }));
  });

  clusterMenu = { remove: () => { allBtns.forEach(b=>{if(b._tip)b._tip.remove();b.remove();}); label.remove(); allTips.forEach(t=>t.remove()); try{overlay.remove();}catch(e){} } };
  return true;
}

// pinClick definitivo con cluster + skip + cat check
const _pinClickBase = pinClick;
function pinClick(id) {
  if (expandedId === id) { collapsePin(id); closePoiPanel(); return; }

  if (_skipCluster) {
    _skipCluster = false;
    if (expandedId !== null) collapsePin(expandedId);
    expandPin(id);
    openPoiPanel(markers[id].poi);
    const poi = markers[id].poi;
    const vw=window.innerWidth, vh=window.innerHeight, hdr=44, panelH=vh*.62;
    const targetY = hdr + (vh-panelH-hdr)*.5, targetX = vw*.5;
    const rect = map.getContainer().getBoundingClientRect();
    const pinPx = map.latLngToContainerPoint([poi.lat, poi.lng]);
    map.panBy([pinPx.x-(targetX-rect.left), pinPx.y-(targetY-rect.top)], {animate:true,duration:.38,noMoveStart:true});
    return;
  }

  removeClusterMenu();
  const poi = markers[id] && markers[id].poi;
  if (!poi || poi.active === false) return;

  // Bloquear si todas las categorías del poi están desactivadas
  const allC = getAllCats();
  const poiCats = Array.isArray(poi.categories)&&poi.categories.length ? poi.categories : [poi.category];
  if (poiCats.every(c => allC[c] && allC[c].active === false)) return;

  const nearby = getNearbyPois(poi);
  if (nearby.length >= 1) {
    if (showClusterMenu([poi,...nearby], [poi.lat, poi.lng])) return;
  }

  if (expandedId !== null) collapsePin(expandedId);
  expandPin(id);
  openPoiPanel(poi);
  const vw=window.innerWidth, vh=window.innerHeight, hdr=44, panelH=vh*.62;
  const targetY=hdr+(vh-panelH-hdr)*.5, targetX=vw*.5;
  const rect=map.getContainer().getBoundingClientRect();
  const pinPx=map.latLngToContainerPoint([poi.lat,poi.lng]);
  requestAnimationFrame(()=>setTimeout(()=>map.panBy([pinPx.x-(targetX-rect.left),pinPx.y-(targetY-rect.top)],{animate:true,duration:.38,noMoveStart:true}),50));
}

map.on('movestart zoomstart', () => {
  removeClusterMenu();
  document.querySelectorAll('[id^="cluster-btn-"]').forEach(b=>{if(b._tip)b._tip.remove();b.remove();});
  document.querySelectorAll('div[style*="backdrop-filter:blur(2px)"]').forEach(e=>e.remove());
});

/* ── TOGGLE POI ── */
window.togglePoi = function(id, btn) {
  const p = POIS.find(x => x.id === id);
  if (!p) return;
  p.active = !(p.active !== false);
  btn.classList.toggle('on', p.active);
  const row = btn.closest('.poi-row');
  if (row) row.style.opacity = p.active ? '' : '.5';
  const mEl = document.getElementById('pw-' + id);
  const parent = mEl && mEl.parentElement;
  if (parent) parent.style.visibility = p.active ? '' : 'hidden';
  if (!p.active && expandedId === id) { collapsePin(id); closePoiPanel(); }
  toast(p.active ? `✅ "${p.name}" activado` : `⭕ "${p.name}" desactivado`);
};

/* ── Wire up buttons ── */
document.getElementById('btn-export').addEventListener('click', exportPOIs);
document.getElementById('import-file').addEventListener('change', e => handleImportFile(e.target.files[0]));
