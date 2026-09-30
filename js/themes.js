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

/* ═══════════════════════════════════════════════════════════
   TEMAS DE PINES — sistema de reskins visuales masivos
   ---------------------------------------------------------------
   FUTURO: cada tema, una vez conectado a Firebase/Storage (ver
   roadmap r11, r28), controla qué variante de imagen se muestra
   por lugar. Hoy este panel gestiona los datos/interruptores;
   la conexión real con las imágenes del mapa llega cuando se
   evolucione el guardado de imágenes a lista abierta (r28).
   ═══════════════════════════════════════════════════════════ */

/* === ESTRUCTURA DE UN TEMA (modelo nuevo — PLAN_TAB_TEMAS_OVERRIDE.md, Paso 1) ===
   { id, name,
     keyword:          string -> SUFIJO EXACTO de la imagen (lo que va entre los
                                 dos "_" del archivo: prefijo_SUFIJO_indice.ext).
                                 Minúsculas, solo a-z 0-9 y "-", sin "_".
     active:           bool   -> tema encendido ahora (interruptor manual)
     showOnMap:        bool   -> miniatura del mapa (antes: mapDefault)
     showInEye:        bool   -> aparece en el ojito (antes: altEnabled)
     eyePosition:      1,2,3… | 'last' -> posición en el ojito (antes: panelDefault -> 1)
     mapPriorityDay:   bool   -> prevalece en el mapa de día
     mapPriorityNight: bool   -> prevalece en el mapa de noche
     isNight:          bool   -> se mantiene tal cual (legado)
     -- CAMPOS LEGADO (mapDefault / panelDefault / altEnabled) --
     Desde el Paso 2 ya nadie los lee: _normalizeTema los usa UNA vez para
     migrar y los borra del tema.
   }
*/
let TEMAS = [];

/* === CONFIG GLOBAL DÍA/NOCHE === */
globalSettings.nightHour  = globalSettings.nightHour  ?? null; // 0-23
globalSettings.nightTheme = globalSettings.nightTheme ?? null; // KEYWORD (sufijo) del tema de noche — antes era el id; para temas viejos keyword == id, así que los datos guardados siguen valiendo

function slugifyTema(str) {
  return str.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // saca tildes
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/* === NORMALIZACIÓN / MIGRACIÓN (una sola función) ===
   Completa los campos que falten de un tema guardado con el modelo viejo
   SIN perder nada ni cambiar lo que hacía: keyword <- id, showOnMap <-
   mapDefault, showInEye <- altEnabled, eyePosition <- 1 si panelDefault
   (si no 'last'). Se llama al cargar (settings-sync.js) y al crear un
   tema. Devuelve el mismo objeto. */
const TEMA_EYE_POSITIONS_MAX = 10;

function _normalizeTema(t) {
  if (!t || typeof t !== 'object') return t;
  if (typeof t.keyword !== 'string' || !t.keyword) t.keyword = t.id || slugifyTema(t.name || '');
  // Paso 2: un tema viejo con "default en el mapa" ya estaba APLICÁNDOSE al
  // público (sin interruptor de encendido), así que migra ENCENDIDO y con
  // prevalencia sobre el tema de noche (como funcionaba antes). Los demás
  // temas viejos migran apagados.
  const legacyOn = !!t.mapDefault;
  if (typeof t.active           !== 'boolean') t.active           = legacyOn;
  if (typeof t.showOnMap        !== 'boolean') t.showOnMap        = !!t.mapDefault;
  if (typeof t.showInEye        !== 'boolean') t.showInEye        = t.altEnabled !== undefined ? !!t.altEnabled : true;
  if (!(t.eyePosition === 'last' || (Number.isInteger(t.eyePosition) && t.eyePosition >= 1))) {
    t.eyePosition = t.panelDefault ? 1 : 'last';
  }
  if (typeof t.mapPriorityDay   !== 'boolean') t.mapPriorityDay   = legacyOn;
  if (typeof t.mapPriorityNight !== 'boolean') t.mapPriorityNight = legacyOn;
  if (typeof t.isNight          !== 'boolean') t.isNight          = false;
  delete t.mapDefault; delete t.panelDefault; delete t.altEnabled;
  return t;
}

/* Valida el sufijo: devuelve { ok, value, error }. Minúsculas, solo
   a-z 0-9 y "-", NO "_" (es el delimitador del nombre de archivo). */
function validateTemaKeyword(raw) {
  const value = String(raw == null ? '' : raw).trim().toLowerCase();
  if (!value) return { ok: false, value, error: 'El sufijo no puede estar vacío.' };
  if (value.includes('_')) return { ok: false, value, error: 'El sufijo no puede llevar "_" (es el separador del nombre del archivo). Usá guion medio "-".' };
  if (!/^[a-z0-9-]+$/.test(value)) return { ok: false, value, error: 'El sufijo solo admite letras a-z sin tildes, números y guion medio "-".' };
  return { ok: true, value, error: '' };
}

/* Regla de UNA sola miniatura de mapa: devuelve el OTRO tema activo que
   ya tiene miniatura tildada (o null). `t` = tema que se quiere dejar
   activo + con miniatura. */
function _temaMapThumbConflict(t) {
  return TEMAS.find(x => x.id !== t.id && x.active && x.showOnMap) || null;
}

function _escTema(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

/* ═══════════════════════════════════════════════════════════
   REDIBUJADO DEL MAPA AL CAMBIAR UN TEMA [Paso 3 — PLAN_TAB_TEMAS_OVERRIDE.md]
   ---------------------------------------------------------------
   Reusa rebuildAllMarkers() (js/admin-global.js) — NO hay un segundo
   sistema de redibujado (AI_RULES 6 y 7). Las miniaturas de baja
   resolución no necesitan ningún proceso propio: toThumbCandidateUrl
   (js/markers.js) ya arma la URL 150x150 y Cloudinary la genera y
   cachea sola la primera vez que se pide.
   rebuildAllMarkers colapsa el pin maximizado y cierra el panel; si
   había uno abierto se vuelve a abrir con pinClick (js/cluster.js), así
   el ojito y el pin se refrescan con la lista nueva (cyclePinExpandedImage
   busca la posición real por URL, no por índice guardado).
   Se llama en cada cambio de la tab (vista previa del admin, en memoria)
   y al borrar / guardar; lo que ve el público sigue dependiendo de
   "Guardar cambios" (los visitantes leen los temas al cargar la página).
   ═══════════════════════════════════════════════════════════ */
let _temasRefreshTimer = null;

function _refreshThemesOnMap() {
  clearTimeout(_temasRefreshTimer);
  // Un solo redibujado aunque se toquen varios controles seguidos.
  _temasRefreshTimer = setTimeout(() => {
    if (typeof rebuildAllMarkers !== 'function' || typeof markers === 'undefined') return;
    const reopenId = (typeof expandedId !== 'undefined') ? expandedId : null;
    try {
      rebuildAllMarkers();
    } catch (err) {
      console.warn('[themes] No se pudo redibujar el mapa tras el cambio de tema:', err);
      return;
    }
    if (reopenId && markers[reopenId] && typeof pinClick === 'function' &&
        (typeof expandedId === 'undefined' || expandedId === null)) {
      try { pinClick(markers[reopenId].poi); }
      catch (err) { console.warn('[themes] No se pudo reabrir el pin tras redibujar:', err); }
    }
  }, 60);
}

/* === RENDER — dibuja la lista de temas con todos sus controles === */
function _eyePosOptions(t) {
  const opts = [];
  const max = Math.max(TEMA_EYE_POSITIONS_MAX, Number.isInteger(t.eyePosition) ? t.eyePosition : 0);
  for (let i = 1; i <= max; i++) opts.push(`<option value="${i}" ${t.eyePosition === i ? 'selected' : ''}>${i}ª</option>`);
  opts.push(`<option value="last" ${t.eyePosition === 'last' ? 'selected' : ''}>Última</option>`);
  return opts.join('');
}

function renderTemasAdmin() {
  const list = document.getElementById('temas-admin-list');
  if (!list) return;

  if (!TEMAS.length) {
    list.innerHTML = `<p style="font-size:12px;color:var(--text3)">Todavía no hay temas creados. Agregá el primero arriba.</p>`;
  } else {
    list.innerHTML = TEMAS.map(t => `
      <div class="za-row" data-id="${_escTema(t.id)}" style="flex-direction:column;align-items:stretch;gap:8px;padding:12px 0">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="za-name" style="flex:1;font-weight:600">${_escTema(t.name)}</span>
          <label style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600">
            <input type="checkbox" ${t.active ? 'checked' : ''} onchange="toggleTemaFlag('${_escTema(t.id)}','active',this.checked)">
            Tema activo
          </label>
          <button class="za-edit-btn" onclick="deleteTema('${_escTema(t.id)}')" title="Eliminar tema">🗑️</button>
        </div>
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;flex-wrap:wrap">
          <span style="color:var(--text3)">Sufijo de imagen:</span>
          <code style="color:var(--text3)">prefijo_</code>
          <input class="fi" type="text" value="${_escTema(t.keyword)}" maxlength="40" style="width:170px"
                 placeholder="ej: halloween-noche"
                 onchange="setTemaKeyword('${_escTema(t.id)}', this)">
          <code style="color:var(--text3)">_indice</code>
        </div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;align-items:center">
          <label style="display:flex;align-items:center;gap:5px">
            <input type="checkbox" ${t.showOnMap ? 'checked' : ''} onchange="toggleTemaFlag('${_escTema(t.id)}','showOnMap',this.checked)">
            Miniatura en el mapa
          </label>
          <label style="display:flex;align-items:center;gap:5px">
            <input type="checkbox" ${t.showInEye ? 'checked' : ''} onchange="toggleTemaFlag('${_escTema(t.id)}','showInEye',this.checked)">
            Aparece en el ojito
          </label>
          <label style="display:flex;align-items:center;gap:5px;${t.showInEye ? '' : 'opacity:.45'}">
            Posición:
            <select class="fi" ${t.showInEye ? '' : 'disabled'} style="width:auto;padding:2px 6px"
                    onchange="setTemaEyePosition('${_escTema(t.id)}', this.value)">${_eyePosOptions(t)}</select>
          </label>
        </div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px">
          <label style="display:flex;align-items:center;gap:5px">
            <input type="checkbox" ${t.mapPriorityDay ? 'checked' : ''} onchange="toggleTemaFlag('${_escTema(t.id)}','mapPriorityDay',this.checked)">
            Prevalece en mapa de día
          </label>
          <label style="display:flex;align-items:center;gap:5px">
            <input type="checkbox" ${t.mapPriorityNight ? 'checked' : ''} onchange="toggleTemaFlag('${_escTema(t.id)}','mapPriorityNight',this.checked)">
            Prevalece en mapa de noche
          </label>
        </div>
      </div>`).join('');
  }

  // Refrescar el selector de "tema de noche" — ahora resuelve por KEYWORD
  const sel = document.getElementById('tema-night-select');
  if (sel) {
    sel.innerHTML = `<option value="">— Ninguno —</option>` +
      TEMAS.map(t => `<option value="${_escTema(t.keyword)}" ${globalSettings.nightTheme===t.keyword?'selected':''}>${_escTema(t.name)} (${_escTema(t.keyword)})</option>`).join('');
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

  const kw = validateTemaKeyword(id);
  if (!kw.ok) { toast('⚠️ Con ese nombre no se puede armar un sufijo válido: ' + kw.error + ' Probá con otro nombre.'); return; }
  if (TEMAS.some(t => t.keyword === kw.value)) { toast('⚠️ Ya hay un tema con el sufijo "' + kw.value + '"'); return; }

  TEMAS.push(_normalizeTema({ id, name, keyword: kw.value, active:false, showOnMap:false, showInEye:true, eyePosition:'last', mapPriorityDay:false, mapPriorityNight:false, isNight:false }));
  input.value = '';
  renderTemasAdmin();
  _markTemasDirty();
  toast(`✅ Tema "${name}" agregado — no olvides "Guardar cambios"`);
});

/* === INTERRUPTORES POR TEMA (active, showOnMap, showInEye, prioridades) ===
   Regla de UNA sola miniatura de mapa: si se intenta dejar ACTIVO un tema
   con "miniatura en el mapa" (o tildar la miniatura estando activo) y ya
   hay OTRO tema activo con miniatura, se rechaza con un mensaje que dice
   cuál es y qué destildar. No se toca nada del estado al rechazar. */
const _TEMA_FLAG_LABELS = {
  active: 'Tema activo', showOnMap: 'Miniatura en el mapa', showInEye: 'Aparece en el ojito',
  mapPriorityDay: 'Prevalece en mapa de día', mapPriorityNight: 'Prevalece en mapa de noche'
};

window.toggleTemaFlag = function(id, flag, value) {
  const t = TEMAS.find(x => x.id === id);
  if (!t || !(flag in _TEMA_FLAG_LABELS)) return;
  value = !!value;

  if (value && (flag === 'active' || flag === 'showOnMap')) {
    const willBeActive = flag === 'active' ? true : t.active;
    const willHaveThumb = flag === 'showOnMap' ? true : t.showOnMap;
    if (willBeActive && willHaveThumb) {
      const other = _temaMapThumbConflict(t);
      if (other) {
        toast(`⚠️ No se puede: el tema "${other.name}" ya está activo con "Miniatura en el mapa". ` +
              `Solo 1 tema activo puede tener miniatura en el mapa. Destildá la miniatura en "${other.name}" ` +
              `(o en "${t.name}") y probá de nuevo.`);
        renderTemasAdmin(); // devuelve el checkbox a su estado real
        return;
      }
    }
  }

  t[flag] = value;
  renderTemasAdmin();
  _markTemasDirty();
  _refreshThemesOnMap();
  toast(`✅ ${t.name}: "${_TEMA_FLAG_LABELS[flag]}" ${value ? 'activado' : 'desactivado'} — no olvides "Guardar cambios"`);
};

/* === POSICIÓN EN EL OJITO (1ª, 2ª… o última) === */
window.setTemaEyePosition = function(id, raw) {
  const t = TEMAS.find(x => x.id === id);
  if (!t) return;
  t.eyePosition = raw === 'last' ? 'last' : Math.max(1, parseInt(raw, 10) || 1);
  renderTemasAdmin();
  _markTemasDirty();
  _refreshThemesOnMap();
  toast(`✅ ${t.name}: posición en el ojito ${t.eyePosition === 'last' ? 'última' : t.eyePosition + 'ª'} — no olvides "Guardar cambios"`);
};

/* === SUFIJO DE IMAGEN (keyword) — validado === */
window.setTemaKeyword = function(id, inputEl) {
  const t = TEMAS.find(x => x.id === id);
  if (!t) return;
  const v = validateTemaKeyword(inputEl.value);
  if (!v.ok) { toast('⚠️ ' + v.error); renderTemasAdmin(); return; }
  if (v.value === t.keyword) { inputEl.value = v.value; return; }
  const dup = TEMAS.find(x => x.id !== t.id && x.keyword === v.value);
  if (dup) { toast(`⚠️ El sufijo "${v.value}" ya lo usa el tema "${dup.name}".`); renderTemasAdmin(); return; }
  const old = t.keyword;
  t.keyword = v.value;
  // El tema de noche se guarda por keyword: si apuntaba a este tema, lo seguimos
  // (en memoria; se persiste con "Guardar configuración día/noche").
  if (globalSettings.nightTheme === old) globalSettings.nightTheme = v.value;
  renderTemasAdmin();
  _markTemasDirty();
  _refreshThemesOnMap();
  toast(`✅ ${t.name}: sufijo "${v.value}" — no olvides "Guardar cambios"`);
};

/* === ELIMINAR TEMA === */
window.deleteTema = function(id) {
  const t = TEMAS.find(x => x.id === id);
  if (!t) return;
  // [FIX Etapa 5 — PLAN_CORRECCIONES_ADMIN.md] antes borraba al toque,
  // sin ninguna confirmación. Igual que Categorías: el borrado en sí
  // queda sujeto a "Guardar cambios" (recién es definitivo cuando se
  // guarda esta pestaña), pero ahora además se confirma antes de
  // sacarlo de la lista en memoria.
  confirmarBorrado(`¿Eliminar el tema "${t.name}"? Esta acción no se puede deshacer.`, () => {
    TEMAS = TEMAS.filter(x => x.id !== id);
    if (globalSettings.nightTheme === t.keyword) globalSettings.nightTheme = null;
    renderTemasAdmin();
    _markTemasDirty();
    _refreshThemesOnMap();
    toast(`🗑️ Tema "${t.name}" eliminado — no olvides "Guardar cambios"`);
  }, '¿Eliminar tema?');
};

/* ═══════════════════════════════════════════════════════════
   GUARDADO MANUAL DE LA LISTA DE TEMAS [NUEVO — Etapa 4.1,
   PLAN_CORRECCIONES_ADMIN.md]
   ---------------------------------------------------------------
   Mismo patrón que ya usa Categorías (js/categories.js): todo lo de
   arriba (alta/baja/edición de tema, los 3 interruptores) queda SOLO
   en memoria hasta que se aprieta "💾 Guardar cambios" — recién ahí
   se persiste en Firestore (saveThemesSettings, js/settings-sync.js).
   Si se recarga sin guardar, se pierde lo no guardado (a propósito,
   mismo criterio que Categorías).
   ═══════════════════════════════════════════════════════════ */
let _temasDirty = false;

function _markTemasDirty() {
  _temasDirty = true;
  const btn = document.getElementById('btn-save-temas');
  const warn = document.getElementById('temas-unsaved-warning');
  if (btn) { btn.textContent = '💾 Guardar cambios ●'; btn.style.opacity = '1'; }
  if (warn) warn.style.display = '';
}

function _clearTemasDirty() {
  _temasDirty = false;
  const btn = document.getElementById('btn-save-temas');
  const warn = document.getElementById('temas-unsaved-warning');
  if (btn) { btn.textContent = '💾 Guardar cambios'; }
  if (warn) warn.style.display = 'none';
}

window.addEventListener('beforeunload', (e) => {
  if (!_temasDirty) return;
  e.preventDefault();
  e.returnValue = '';
});

(function _wireTemasSaveButton() {
  const btn = document.getElementById('btn-save-temas');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const ok = await saveThemesSettings();
    btn.disabled = false;
    if (ok) { _clearTemasDirty(); _refreshThemesOnMap(); toast('✅ Temas guardados'); }
    // si ok es false, saveThemesSettings() ya mostró su propio toast
    // de error — no duplicar el aviso.
  });
})();

/* === GUARDAR CONFIGURACIÓN DÍA/NOCHE === */
// [FIX Etapa 4.1 — PLAN_CORRECCIONES_ADMIN.md] antes este botón solo
// actualizaba globalSettings en memoria — la hora/tema de noche recién
// quedaban guardados de verdad si DESPUÉS se entraba a la pestaña
// "Apariencia global" y se tocaba "Aplicar a todos los pins" (el único
// lugar que llamaba a saveGlobalSettings()). Ahora este botón guarda
// directo, sin depender de otra pestaña — nightHour/nightTheme viven
// en el mismo objeto globalSettings que ya persiste esa función, así
// que no hace falta ningún documento nuevo para esto.
document.getElementById('btn-save-nightmode').addEventListener('click', async () => {
  const hourVal = document.getElementById('tema-night-hour').value;
  const themeVal = document.getElementById('tema-night-select').value;
  globalSettings.nightHour  = hourVal === '' ? null : parseInt(hourVal);
  globalSettings.nightTheme = themeVal || null;
  const btn = document.getElementById('btn-save-nightmode');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }
  const ok = await saveGlobalSettings();
  if (btn) { btn.disabled = false; btn.textContent = '✓ Guardar configuración día/noche'; }
  if (ok) { _refreshThemesOnMap(); toast('✅ Configuración día/noche guardada'); }
  // si ok es false, saveGlobalSettings() ya mostró su propio toast de error.
});

/* === REGISTRO DE PESTAÑA ADMIN === */
SC.registerTabPlugin('temas-admin', renderTemasAdmin);
