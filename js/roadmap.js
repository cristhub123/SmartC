/* roadmap.js — roadmap system */
/* ═══════════════════════════════════════════════════════════
   ROADMAP SYSTEM
   Estructura portable — en versiones futuras irá a roadmap.json
   ═══════════════════════════════════════════════════════════ */
const ROADMAP = [
  { id:'r1', status:'idea',     priority:'high', title:'Mapa minimalista (sin POIs OSM)',        desc:'Usar MapTiler con estilo custom que solo muestre calles, manzanas, ríos y puentes. Sin íconos ni labels de negocios.' },
  { id:'r2', status:'idea',     priority:'high', title:'Sistema de login por negocio',            desc:'Cada dueño accede a su propio dashboard para editar la info de su pin. Requiere backend (Bubble o Node.js + DB).' },
  { id:'r3', status:'planned',  priority:'high', title:'Migrar datos a pois.json externo',        desc:'Separar el array POIS del index.html a un archivo JSON independiente. Facilita mantenimiento y actualizaciones.' },
  { id:'r4', status:'planned',  priority:'mid',  title:'Sistema de membresías y pagos',           desc:'Integración con Stripe para que cada negocio pague su membresía mensual. Activa/desactiva pins automáticamente.' },
  { id:'r5', status:'idea',     priority:'mid',  title:'Clustering de pins en zoom out',          desc:'Cuando hay muchos pins juntos, agruparlos en un círculo con número. Se separan al hacer zoom in.' },
  { id:'r6', status:'idea',     priority:'mid',  title:'Eventos con fecha real y calendario',     desc:'Sistema de eventos con fecha/hora real. Los eventos vencidos se archivan automáticamente.' },
  { id:'r7', status:'idea',     priority:'low',  title:'Filtro "abierto ahora"',                  desc:'Cada negocio carga sus horarios. El filtro muestra solo los lugares actualmente abiertos según la hora del celular.' },
  { id:'r8', status:'idea',     priority:'low',  title:'Modo nocturno del mapa',                  desc:'Switch para alternar entre mapa claro y oscuro. Especialmente útil para exploración nocturna.' },
  { id:'r9', status:'building', priority:'high', title:'Export/Import de datos (JSON)',           desc:'✅ Implementado en v4. Permite guardar y cargar todos los pins con imágenes incluidas.' },
  { id:'r10',status:'done',     priority:'high', title:'Imágenes PNG personalizadas por pin',     desc:'✅ Cada pin puede tener su propia imagen isométrica del edificio con transparencia.' },
];

const RM_STATUS = {
  idea:     { label:'💡 Idea',           bg:'#fef3c7', color:'#92400e' },
  planned:  { label:'📋 Planeado',       bg:'#dbeafe', color:'#1e40af' },
  building: { label:'🔨 En desarrollo',  bg:'#dcfce7', color:'#166534' },
  done:     { label:'✅ Hecho',          bg:'#f0fdf4', color:'#15803d' },
};
const RM_PRIORITY = {
  high: '🔴', mid: '🟡', low: '🟢'
};

function renderRoadmap() {
  const c = document.getElementById('roadmap-items');
  if (!c) return;
  const grouped = {};
  ['building','planned','idea','done'].forEach(s => { grouped[s] = ROADMAP.filter(r => r.status === s); });
  let html = '';
  ['building','planned','idea','done'].forEach(s => {
    if (!grouped[s].length) return;
    const st = RM_STATUS[s];
    html += `<div style="font-family:var(--font-m);font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text3);margin:14px 0 7px">${st.label}</div>`;
    grouped[s].forEach(r => {
      html += `<div class="rm-item">
        <button class="rm-delete" onclick="deleteRoadmapItem('${r.id}')">✕</button>
        <div class="rm-item-head">
          <span>${RM_PRIORITY[r.priority]}</span>
          <span class="rm-title">${r.title}</span>
        </div>
        ${r.desc ? `<div class="rm-desc">${r.desc}</div>` : ''}
      </div>`;
    });
  });
  c.innerHTML = html || '<div class="empty-state"><div class="big">🗺</div>Sin items en el roadmap.</div>';
}

window.deleteRoadmapItem = function(id) {
  const idx = ROADMAP.findIndex(r => r.id === id);
  if (idx !== -1) { ROADMAP.splice(idx, 1); renderRoadmap(); }
};

document.getElementById('btn-add-rm').addEventListener('click', () => {
  const title = document.getElementById('rm-title').value.trim();
  if (!title) { toast('⚠️ Ingresá un título'); return; }
  ROADMAP.unshift({
    id:       'r' + Date.now(),
    status:   document.getElementById('rm-status').value,
    priority: document.getElementById('rm-priority').value,
    title,
    desc:     document.getElementById('rm-desc').value.trim(),
  });
  document.getElementById('rm-title').value = '';
  document.getElementById('rm-desc').value  = '';
  renderRoadmap();
  toast('✅ Idea agregada al roadmap');
});

// Render roadmap when tab opens
SC.registerTabPlugin('roadmap', renderRoadmap);
