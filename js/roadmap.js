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
  { id:'r10b',status:'planned', priority:'low',  title:'Splash screen con visual aleatorio (branding)',
    desc:'Pantalla de bienvenida con miniatura isométrica random al abrir la app (fondo oscuro + logo + fade out al terminar de cargar el mapa). Lista fija de imágenes disponibles (no consulta dinámica a Storage) para simplificar. Fallback a logo estático si falla la carga. Arranca solo con imágenes estáticas, sin video. FASE 1 — MVP, pero AL FINAL: es mejora de impacto visual, no bloquea ninguna función; se corta primero si falta tiempo antes de noviembre. ~3.5-4.5 hs.' },

  /* === FASE 2 — Post-lanzamiento (app ya viva y probada) === */
  { id:'r11', status:'planned', priority:'high', title:'Backend real (Firestore + Storage)',
    desc:'Migrar de memoria/JSON manual a Firestore (datos) + Storage (imágenes). Incluye reglas de seguridad por rol. Base de todo lo demás de esta fase.' },
  { id:'r12', status:'planned', priority:'high', title:'Sistema de roles completo (User-2 y User-3)',
    desc:'Login real con Firebase Auth. User-2 = dueño de pin, edita solo la info de su lugar. User-3 = permiso a una sección específica otorgado por el admin.' },
  { id:'r13', status:'planned', priority:'high', title:'Mercado Pago — Checkout Pro',
    desc:'Pagos en pesos argentinos sin manejar datos de tarjetas. Usado para: suscripción mensual de negocios, ruleta, eventos destacados 24hs.' },
  { id:'r14', status:'idea',    priority:'mid',  title:'Login con Google para el público (User-4)',
    desc:'Opcional, sin fricción. Habilita favoritos y features que dependan de "quién es" el usuario (match grupal, etc).' },
  { id:'r15', status:'idea',    priority:'mid',  title:'Rutas sugeridas sobre el mapa',
    desc:'Colecciones de pines en un orden, trazadas visualmente con Leaflet. Ej: "Ruta del centro histórico".' },
  { id:'r16', status:'idea',    priority:'low',  title:'Geolocalización real (confirmar visita)',
    desc:'Pedir permiso de ubicación al celular y comparar contra la del pin (radio ~10-20m) para contar "visita confirmada" en vez de solo click. Fricción esperada: no todos aceptan compartir ubicación.' },
  { id:'r17', status:'idea',    priority:'mid',  title:'Multi-idioma ES/EN/PT',
    desc:'Banderas arriba para cambiar idioma. Interfaz (botones/labels) vía diccionario simple. Contenido de cada lugar (bloques de texto) requiere carga de 3 versiones — ya resuelto vía carga masiva JSON con IA externa (ChatGPT/Gemini) + slug fijo como identificador.' },
  { id:'r18', status:'idea',    priority:'low',  title:'Panel de estilos globales (colores/tipografía)',
    desc:'Pantalla en el admin para tocar las variables de diseño (css/base.css) con selectores visuales en vez de editar código. Base ya documentada con comentarios en el CSS. ~20-25 controles individuales, valor real está en cablearlos uno a uno.' },
  { id:'r19', status:'idea',    priority:'mid',  title:'Botón "Comer cerca" en paneles no gastronómicos',
    desc:'Ícono de tenedor visible solo en lugares sin categoría gastronómica. Al tocar: calcula distancia (fórmula Haversine, a construir) a todos los lugares de comida, filtra+centra el mapa en los 5-8 más cercanos. Versión completa (mini-lista con distancias en el panel) queda como mejora posterior.' },

  /* === FASE 3 — Funciones avanzadas (negocio ya validado, con pagos activos) === */
  { id:'r20', status:'idea', priority:'mid', title:'Sistema de ruleta con filtros',
    desc:'Usuario indeciso elige parámetros (zona, tipo de comida), la app selecciona al azar entre los negocios activos que pagan su mensualidad para participar. Requiere Mercado Pago funcionando antes.' },
  { id:'r21', status:'idea', priority:'low', title:'Sistema de "match" grupal',
    desc:'Varias personas votan opciones al mismo tiempo (tiempo real vía Firestore) y el sistema cruza resultados para decidir dónde comer en grupo. La función más compleja del roadmap.' },
  { id:'r22', status:'idea', priority:'low', title:'Evento especial 24hs pago (dueño de negocio)',
    desc:'El dueño paga por destacar su local en la sección de filtro gastronómico por 24hs. Campo "evento activo" con fecha de expiración, se apaga solo. Ligado a Mercado Pago.' },
  { id:'r23', status:'idea', priority:'low', title:'Bloques de contenido tipo trivia',
    desc:'Bloque interactivo con pregunta + opciones múltiples y feedback visual. Se apoya en el sistema de bloques dinámicos (order/title/text) ya definido para el panel de cada lugar.' },
  { id:'r24', status:'idea', priority:'low', title:'Campo de links (Instagram, WhatsApp, etc)',
    desc:'Botones clickeables por lugar, tipo {label, url}, viven afuera de los bloques de texto junto a phone/address. Bajo costo, alto valor para negocios.' },
  { id:'r25', status:'idea', priority:'low', title:'Panel de edición para dueño de lugar (User-2) — bloques dinámicos',
    desc:'El dueño puede agregar bloques de texto propios más allá de los 3 por defecto (Descripción/Info general/Dato curioso). Límite gratuito de bloques, desbloqueo de más con costo mensual vía Mercado Pago.' },
  { id:'r26', status:'idea', priority:'low', title:'Venta de entradas — modelo afiliado',
    desc:'La app redirige al usuario a plataformas de venta de entradas de terceros (ej. Passline, TuEntrada) y cobra comisión por la derivación. No maneja pagos propios ni factura nada — riesgo legal/impositivo bajo de nuestro lado. Requiere que la plataforma de terceros tenga sistema de links con seguimiento (afiliado). Modelo más simple de los dos, no depende de nada más del roadmap.' },
  { id:'r27', status:'idea', priority:'low', title:'Venta de entradas — venta directa (marketplace propio)',
    desc:'La app cobra la entrada directamente al usuario final. Mercado Pago tiene modo "Marketplace" que divide el pago automáticamente (comisión propia + parte del organizador) en pesos, sin dólares de por medio. Suma complejidad real: gestión de tickets/códigos de acceso, control de cupos, y temas de facturación/situación impositiva que requieren un contador (no resuelto por desarrollo). Depende de tener Mercado Pago ya integrado (r13). Evaluar recién con la app validada y funcionando.' },
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



