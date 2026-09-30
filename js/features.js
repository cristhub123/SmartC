/*
AI PROJECT NOTE — LECTURA OBLIGATORIA PARA CUALQUIER IA:
Antes de modificar este archivo, toda IA (Claude, ChatGPT u otra) DEBE
leer primero /AI_RULES.md completo. Sin excepcion, sin importar cuan
chico o simple parezca el cambio, y sin esperar a que el usuario lo
pida o lo recuerde — esta nota es la instruccion, no un recordatorio
opcional. Si /AI_RULES.md ya se leyo en esta misma sesion, alcanza con
revisar /AI_SESSION.md en su lugar.

Despues de modificar este archivo, actualizar /AI_SESSION.md con el
cambio hecho y la verificacion realizada.
*/

/* ═══════════════════════════════════════════
   FUNCIONES (FEATURE FLAGS) — panel admin con on/off por función
   ---------------------------------------------
   REGLA PERMANENTE: de acá en adelante, cualquier función nueva
   parecida a "Comer cerca" (algo que el público usa, y que el admin
   podría querer apagar sin tocar código) se agrega a este mismo
   panel, con su propio interruptor — no se crean paneles nuevos
   sueltos para cada función.
   Se guarda en Firestore (colección "settings", doc "features")
   para que quede igual aunque se recargue la página o entre desde
   otro dispositivo.
═══════════════════════════════════════════ */

/* Lista central de funciones con interruptor. Para agregar una
   función nueva a futuro: sumar una línea acá, con su propio id
   y una descripción corta — el panel se arma solo. */
let FEATURES = {
  comerCerca: { label: '🍴 Botón "Comer cerca"', desc: 'Destaca lugares gastronómicos cercanos al abrir un pin no gastronómico', on: true },
  // [Etapa 15, PLAN_USUARIOS_EVENTOS.md] Botón "Todos" en la esquina de Eventos (js/categories.js) → panel "Todos los eventos".
  todosEventos: { label: '🗂 Panel "Todos los eventos"', desc: 'Botón "Todos" al tocar Eventos: abre un panel con el buscador y todos los eventos de la app', on: true },
};

/* === CARGAR desde Firestore al iniciar (si existe guardado) === */
async function loadFeaturesFromFirestore() {
  try {
    const doc = await db.collection('settings').doc('features').get();
    if (doc.exists) {
      const saved = doc.data();
      Object.keys(FEATURES).forEach(key => {
        if (saved[key] !== undefined) FEATURES[key].on = saved[key];
      });
    }
  } catch (err) {
    console.warn('No se pudieron cargar las funciones desde Firestore (se usan los valores por defecto):', err);
  }
}

/* === GUARDAR el estado actual de todas las funciones === */
async function saveFeaturesToFirestore() {
  try {
    const flat = {};
    Object.keys(FEATURES).forEach(key => { flat[key] = FEATURES[key].on; });
    await db.collection('settings').doc('features').set(flat);
  } catch (err) {
    console.error('No se pudo guardar el estado de funciones:', err);
    toast('⚠️ No se guardó el cambio. ¿Iniciaste sesión?');
  }
}

/* === RENDER del panel admin === */
function renderFuncionesAdmin() {
  const list = document.getElementById('funciones-admin-list');
  if (!list) return;
  list.innerHTML = Object.entries(FEATURES).map(([key, f]) => `
    <div class="za-row" style="align-items:flex-start;padding:10px 0">
      <div style="flex:1">
        <div style="font-weight:600">${f.label}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">${f.desc}</div>
      </div>
      <button class="za-toggle ${f.on?'on':''}" onclick="toggleFeature('${key}',this)" title="${f.on?'Desactivar':'Activar'}"></button>
    </div>`).join('');
}

window.toggleFeature = function(key, btn) {
  if (!FEATURES[key]) return;
  FEATURES[key].on = !FEATURES[key].on;
  btn.classList.toggle('on', FEATURES[key].on);
  saveFeaturesToFirestore();
  toast(FEATURES[key].on ? `✅ ${FEATURES[key].label} activada` : `⭕ ${FEATURES[key].label} desactivada`);
};

SC.registerTabPlugin('funciones-admin', renderFuncionesAdmin);
