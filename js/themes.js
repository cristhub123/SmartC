/* ═══════════════════════════════════════════════════════════
   TEMAS DE PINES — sistema de reskins visuales masivos
   ---------------------------------------------------------------
   FUTURO: cada tema, una vez conectado a Firebase/Storage (ver
   roadmap r11, r28), controla qué variante de imagen se muestra
   por lugar. Hoy este panel gestiona los datos/interruptores;
   la conexión real con las imágenes del mapa llega cuando se
   evolucione el guardado de imágenes a lista abierta (r28).
   ═══════════════════════════════════════════════════════════ */

/* === ESTRUCTURA DE UN TEMA ===
   { id, name,
     altEnabled:    bool  -> disponible como variante opcional (carrusel)
     panelDefault:  bool  -> imagen por defecto al abrir el panel del lugar
     mapDefault:    bool  -> imagen por defecto del pin en el mapa
     isNight:       bool  -> marcado como el tema a usar en modo noche
   }
*/
let TEMAS = [];

/* === CONFIG GLOBAL DÍA/NOCHE === */
globalSettings.nightHour  = globalSettings.nightHour  ?? null; // 0-23
globalSettings.nightTheme = globalSettings.nightTheme ?? null; // id de tema

function slugifyTema(str) {
  return str.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // saca tildes
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/* === RENDER — dibuja la lista de temas con sus 3 toggles === */
function renderTemasAdmin() {
  const list = document.getElementById('temas-admin-list');
  if (!list) return;

  if (!TEMAS.length) {
    list.innerHTML = `<p style="font-size:12px;color:var(--text3)">Todavía no hay temas creados. Agregá el primero arriba.</p>`;
  } else {
    list.innerHTML = TEMAS.map(t => `
      <div class="za-row" data-id="${t.id}" style="flex-direction:column;align-items:stretch;gap:6px;padding:10px 0">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="za-name" style="flex:1;font-weight:600">${t.name}</span>
          <button class="za-edit-btn" onclick="deleteTema('${t.id}')" title="Eliminar tema">🗑️</button>
        </div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px">
          <label style="display:flex;align-items:center;gap:5px">
            <input type="checkbox" ${t.altEnabled  ? 'checked' : ''} onchange="toggleTemaFlag('${t.id}','altEnabled',this.checked)">
            Variante opcional (carrusel)
          </label>
          <label style="display:flex;align-items:center;gap:5px">
            <input type="checkbox" ${t.panelDefault? 'checked' : ''} onchange="toggleTemaFlag('${t.id}','panelDefault',this.checked)">
            Default al abrir el panel
          </label>
          <label style="display:flex;align-items:center;gap:5px">
            <input type="checkbox" ${t.mapDefault  ? 'checked' : ''} onchange="toggleTemaFlag('${t.id}','mapDefault',this.checked)">
            Default en el mapa
          </label>
        </div>
      </div>`).join('');
  }

  // Refrescar el selector de "tema de noche"
  const sel = document.getElementById('tema-night-select');
  if (sel) {
    sel.innerHTML = `<option value="">— Ninguno —</option>` +
      TEMAS.map(t => `<option value="${t.id}" ${globalSettings.nightTheme===t.id?'selected':''}>${t.name}</option>`).join('');
  }
  const hourInput = document.getElementById('tema-night-hour');
  if (hourInput && globalSettings.nightHour !== null) hourInput.value = globalSettings.nightHour;
}

/* === AGREGAR TEMA NUEVO === */
document.getElementById('btn-add-tema').addEventListener('click', () => {
  const input = document.getElementById('tema-new-name');
  const name = input.value.trim();
  if (!name) { toast('⚠️ Ingresá un nombre para el tema'); return; }
  const id = slugifyTema(name);
  if (TEMAS.some(t => t.id === id)) { toast('⚠️ Ya existe un tema con ese nombre'); return; }

  TEMAS.push({ id, name, altEnabled:true, panelDefault:false, mapDefault:false, isNight:false });
  input.value = '';
  renderTemasAdmin();
  toast(`✅ Tema "${name}" agregado`);
});

/* === TOGGLE DE CUALQUIERA DE LOS 3 INTERRUPTORES POR TEMA === */
window.toggleTemaFlag = function(id, flag, value) {
  const t = TEMAS.find(x => x.id === id);
  if (!t) return;
  t[flag] = value;
  toast(`✅ ${t.name}: ${flag} ${value ? 'activado' : 'desactivado'}`);
};

/* === ELIMINAR TEMA === */
window.deleteTema = function(id) {
  const t = TEMAS.find(x => x.id === id);
  if (!t) return;
  TEMAS = TEMAS.filter(x => x.id !== id);
  if (globalSettings.nightTheme === id) globalSettings.nightTheme = null;
  renderTemasAdmin();
  toast(`🗑️ Tema "${t.name}" eliminado`);
};

/* === GUARDAR CONFIGURACIÓN DÍA/NOCHE === */
document.getElementById('btn-save-nightmode').addEventListener('click', () => {
  const hourVal = document.getElementById('tema-night-hour').value;
  const themeVal = document.getElementById('tema-night-select').value;
  globalSettings.nightHour  = hourVal === '' ? null : parseInt(hourVal);
  globalSettings.nightTheme = themeVal || null;
  toast('✅ Configuración día/noche guardada');
});

/* === REGISTRO DE PESTAÑA ADMIN === */
SC.registerTabPlugin('temas-admin', renderTemasAdmin);
