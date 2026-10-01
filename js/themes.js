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
/* ═══════════════════════════════════════════════════════════
   CÓMO ACTÚA UN TEMA (2.ª versión — PLAN_TAB_TEMAS_CORRECCION.md)
   El tema NO enciende ni apaga imágenes: las MUEVE de casillero en el
   "orden de exhibición" de cada lugar (campo `order` de cada skin).
     · orden 1-49  → visible        · orden 50-99 → SIEMPRE invisible
   Al "Guardar cambios", applyThemesToPins() (abajo) recorre todos los
   lugares y deja cada imagen cuyo sufijo coincide EXACTO con el `keyword`
   de un tema así:
     - tema ACTIVO + "Miniatura en el mapa" → casillero 1 (la principal;
       las demás se corren solo si el casillero siguiente está ocupado);
     - tema ACTIVO + "Aparece en el ojito" → casillero 2ª…10ª o el último;
     - tema ACTIVO sin ninguna de las dos → se queda oculta (50+);
     - tema APAGADO / borrado / con otro sufijo → baja al 50 (o al
       siguiente libre) y desaparece.
   El tema de noche automático (globalSettings.nightTheme) NO se toca.
   ═══════════════════════════════════════════════════════════ */
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
  if (value === 'main') return { ok: false, value, error: '"main" es la imagen principal del lugar; un tema no puede usar ese sufijo (la ocultaría).' };
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
   PLANIFICADOR DE CASILLEROS (función PURA — no toca Firestore)
   planThemeOrders(skins, temas, retire, nightKey) → { changes, warnings }
     changes: { variante: { order, active? } } — SOLO lo que hay que
              escribir (vacío = el lugar ya está bien; idempotente).
   Reglas:
     · solo variantes distintas de `main` y con url; coincidencia EXACTA
       con el keyword de un tema; el sufijo del tema de noche no se toca;
     · tema inactivo / sin ninguna opción de visibilidad / keyword en
       `retire` → la imagen baja al 50 o al siguiente libre (si ya está en
       50+ no se toca);
     · tema activo → casillero destino (1 con miniatura; si no, 2ª…N o
       el último). Se inserta ahí; si está ocupado el ocupante pasa al
       siguiente, y así en cadena SOLO mientras los casilleros estén
       ocupados (si hay hueco, lo de más allá no se mueve);
     · una imagen de tema que ya está en su casillero destino no se
       empuja (dos temas con el mismo destino quedan uno después del otro);
     · nunca se llega al 50 empujando: si una cadena no entra en 1-49 se
       deja ese lugar sin tocar y se avisa;
     · `active` solo se ajusta al CRUZAR el 50 (igual que el admin al
       cambiar un orden): al subir a 1-49 queda en true, al bajar a 50+ en
       false. Nunca hay toggles manuales de por medio.
   ═══════════════════════════════════════════════════════════ */
const THEME_HIDDEN_FROM = 50;   // = SKIN_ORDER_HIDDEN_FROM de utils.js
const THEME_LAST_VISIBLE = 49;

function planThemeOrders(skins, temas, retire, nightKey) {
  const warnings = [];
  skins = skins || {};
  retire = new Set(retire || []);
  const orig = {};   // variante -> order original (number|null)
  const cur = {};    // variante -> order actual de trabajo
  Object.keys(skins).forEach((v) => {
    const sk = skins[v];
    if (v === 'main' || !sk || !sk.url) return;
    orig[v] = typeof sk.order === 'number' ? sk.order : null;
    cur[v] = orig[v];
  });

  // variante -> { theme|null, kind: 'hide'|'show', target }
  const themed = {};
  const byKeyword = {};
  (temas || []).forEach((t) => { if (t && typeof t.keyword === 'string' && t.keyword) byKeyword[t.keyword] = t; });
  retire.forEach((k) => { if (!byKeyword[k] || byKeyword[k] === undefined) byKeyword[k] = { keyword: k, active: false }; });
  // un keyword retirado que además existe como tema vigente NO se retira
  (temas || []).forEach((t) => { if (t && t.keyword) byKeyword[t.keyword] = t; });
  Object.keys(byKeyword).forEach((k) => {
    if (k === 'main' || k === nightKey || !(k in cur)) return;
    const t = byKeyword[k];
    const wantsMap = !!t.showOnMap, wantsEye = !!t.showInEye;
    if (!t.active || (!wantsMap && !wantsEye)) themed[k] = { kind: 'hide' };
    else if (wantsMap) themed[k] = { kind: 'show', target: 1 };
    else if (t.eyePosition === 'last') themed[k] = { kind: 'show', last: true };
    else themed[k] = { kind: 'show', target: Math.max(2, Number.isInteger(t.eyePosition) ? t.eyePosition : 2) };
  });

  const occupant = (slot, except) => Object.keys(cur).find((v) => v !== except && cur[v] === slot);
  const usedAny = (slot, except) => Object.keys(cur).some((v) => v !== except && cur[v] === slot);

  // 1) ocultar: al 50 o siguiente libre
  Object.keys(themed).filter((k) => themed[k].kind === 'hide').forEach((k) => {
    if (typeof cur[k] === 'number' && cur[k] >= THEME_HIDDEN_FROM) return;
    let slot = THEME_HIDDEN_FROM;
    while (usedAny(slot, k)) slot++;
    cur[k] = slot;
  });

  // 2) mostrar: de menor a mayor destino (los "último" al final)
  const shows = Object.keys(themed).filter((k) => themed[k].kind === 'show')
    .sort((a, b) => (themed[a].last ? 1e9 : themed[a].target) - (themed[b].last ? 1e9 : themed[b].target));
  const lastKeys = new Set(shows.filter((k) => themed[k].last));
  const placed = new Set();
  const snapshotBefore = JSON.stringify(cur);
  let failed = false;

  shows.forEach((k) => {
    if (failed) return;
    const info = themed[k];
    const maxOther = Math.max(1, ...Object.keys(cur)
      .filter((v) => v !== k && !lastKeys.has(v) && typeof cur[v] === 'number' && cur[v] < THEME_HIDDEN_FROM)
      .map((v) => cur[v]));
    let target = info.target;
    if (info.last) {
      if (typeof cur[k] === 'number' && cur[k] < THEME_HIDDEN_FROM && cur[k] > maxOther) { placed.add(k); return; } // ya está al final
      const maxPlaced = Math.max(0, ...Array.from(placed).filter((v) => lastKeys.has(v)).map((v) => cur[v]));
      target = Math.max(2, maxOther + 1, maxPlaced + 1);
    } else if (cur[k] === target) { placed.add(k); return; }

    cur[k] = null; // lo saco de donde estaba
    let slot = target;
    while (placed.has(occupant(slot, k))) slot++; // no empuja a otra imagen de tema ya en su destino
    // inserción con cascada solo mientras haya ocupantes
    let carry = k;
    while (true) {
      if (slot > THEME_LAST_VISIBLE) { failed = true; break; }
      const occ = occupant(slot, carry);
      cur[carry] = slot;
      if (!occ) break;
      carry = occ;
      cur[carry] = null;
      slot++;
    }
    placed.add(k);
  });

  if (failed) {
    warnings.push('no hay casilleros libres entre el 1 y el 49 para acomodar la imagen de un tema; este lugar no se tocó.');
    return { changes: {}, warnings };
  }

  const changes = {};
  Object.keys(cur).forEach((v) => {
    const o = orig[v], n = cur[v];
    const sk = skins[v] || {};
    const isTheme = !!themed[v];
    const patch = {};
    if (n !== o && typeof n === 'number') patch.order = n;
    if (isTheme && typeof n === 'number') {
      if (n >= THEME_HIDDEN_FROM && n !== o && sk.active !== false) patch.active = false;
      if (n < THEME_HIDDEN_FROM && sk.active !== true) patch.active = true;
    }
    if (Object.keys(patch).length) changes[v] = patch;
  });
  return { changes, warnings };
}

/* Aplica los temas a TODOS los lugares guardados (colección `pines`):
   lee cada lugar, calcula con planThemeOrders y escribe SOLO el campo
   `skins` de los que cambian (merge, en tandas de 400). Después actualiza
   POIS en memoria, el caché público y redibuja el mapa. */
async function applyThemesToPins({ retire = [] } = {}) {
  if (typeof db === 'undefined' || !db) return { ok: false, count: 0, warnings: [] };
  const nightKey = (typeof globalSettings !== 'undefined' && globalSettings) ? globalSettings.nightTheme : null;
  const warnings = [];
  const updates = [];
  try {
    const snap = await db.collection('pines').get();
    snap.forEach((doc) => {
      const d = doc.data();
      if (!d || !d.name || !d.skins) return;
      const plan = planThemeOrders(d.skins, TEMAS, retire, nightKey);
      plan.warnings.forEach((w) => warnings.push(`${d.name}: ${w}`));
      if (Object.keys(plan.changes).length) updates.push({ id: doc.id, changes: plan.changes });
    });
    for (let i = 0; i < updates.length; i += 400) {
      const batch = db.batch();
      updates.slice(i, i + 400).forEach((u) => {
        batch.set(db.collection('pines').doc(u.id), { skins: u.changes }, { merge: true });
      });
      await batch.commit();
    }
  } catch (err) {
    console.error('[themes] No se pudieron aplicar los temas a los lugares:', err);
    return { ok: false, count: 0, warnings };
  }
  warnings.forEach((w) => console.warn('[themes]', w));

  // Memoria + caché + mapa
  if (updates.length && typeof POIS !== 'undefined' && Array.isArray(POIS)) {
    updates.forEach((u) => {
      const p = POIS.find((x) => x.id === u.id);
      if (!p || !p.skins) return;
      Object.keys(u.changes).forEach((v) => { if (p.skins[v]) Object.assign(p.skins[v], u.changes[v]); });
    });
    try { if (typeof syncAppStateWithPOIS === 'function') syncAppStateWithPOIS(); } catch (e) { /* no crítico */ }
    try { if (typeof regeneratePublicCache === 'function') await regeneratePublicCache(); } catch (e) { /* no crítico */ }
  }
  _refreshThemesOnMap();
  return { ok: true, count: updates.length, warnings };
}

const _temasRetire = new Set(); // sufijos de temas renombrados/borrados cuyas imágenes hay que bajar al guardar

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
  // Con "Miniatura en el mapa" tildada la imagen va SIEMPRE al casillero 1.
  if (t.showOnMap) return `<option value="1" selected>1ª (miniatura)</option>`;
  const opts = [];
  const cur = t.eyePosition === 1 ? 2 : t.eyePosition; // sin miniatura la 1ª es de la principal
  const max = Math.max(TEMA_EYE_POSITIONS_MAX, Number.isInteger(cur) ? cur : 0);
  for (let i = 2; i <= max; i++) opts.push(`<option value="${i}" ${cur === i ? 'selected' : ''}>${i}ª</option>`);
  opts.push(`<option value="last" ${cur === 'last' ? 'selected' : ''}>Última</option>`);
  return opts.join('');
}

/* Estado del motor: avisa si quedó algún archivo viejo (utils.js / markers.js). */
function _themeEngineStatus() {
  const okU = typeof THEME_ENGINE_VERSION !== 'undefined' && THEME_ENGINE_VERSION >= 4 && typeof getPrincipalThemeSkinKey === 'function';
  const okM = typeof THEME_MARKERS_VERSION !== 'undefined' && THEME_MARKERS_VERSION >= 4;
  if (okU && okM) return { ok: true, text: '✔ Motor de temas al día (utils.js y markers.js actualizados)' };
  const faltan = [!okU ? 'js/utils.js' : null, !okM ? 'js/markers.js' : null].filter(Boolean).join(' y ');
  return { ok: false, text: `✘ Motor de temas DESACTUALIZADO: falta subir ${faltan} (y recargar con Ctrl+F5). Mientras tanto los temas no van a funcionar bien.` };
}

function renderTemasAdmin() {
  const list = document.getElementById('temas-admin-list');
  if (!list) return;

  const st = _themeEngineStatus();
  const stEl = document.getElementById('temas-engine-status');
  if (stEl) {
    stEl.textContent = st.text;
    stEl.style.color = st.ok ? 'var(--text3)' : '#c0392b';
    stEl.style.fontWeight = st.ok ? '400' : '700';
  }

  if (!TEMAS.length) {
    list.innerHTML = `<p style="font-size:12px;color:var(--text3)">Todavía no hay temas creados. Agregá el primero arriba.</p>`;
  } else {
    list.innerHTML = TEMAS.map(t => {
      const dis = t.active ? '' : 'disabled';                 // R1: interruptor maestro
      const dim = t.active ? '' : 'opacity:.45;';
      return `
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
        ${t.active ? '' : `<div style="font-size:11px;color:var(--text3)">Tema apagado: no afecta nada y su imagen no se ve. Activalo para habilitar las opciones de abajo.</div>`}
        <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;align-items:center;${dim}">
          <label style="display:flex;align-items:center;gap:5px">
            <input type="checkbox" ${dis} ${t.showOnMap ? 'checked' : ''} onchange="toggleTemaFlag('${_escTema(t.id)}','showOnMap',this.checked)">
            Miniatura en el mapa
          </label>
          <label style="display:flex;align-items:center;gap:5px">
            <input type="checkbox" ${dis} ${t.showInEye ? 'checked' : ''} onchange="toggleTemaFlag('${_escTema(t.id)}','showInEye',this.checked)">
            Aparece en el ojito
          </label>
          <label style="display:flex;align-items:center;gap:5px;${t.showInEye ? '' : 'opacity:.45'}">
            Posición:
            <select class="fi" ${(t.active && t.showInEye && !t.showOnMap) ? '' : 'disabled'} style="width:auto;padding:2px 6px"
                    onchange="setTemaEyePosition('${_escTema(t.id)}', this.value)">${_eyePosOptions(t)}</select>
          </label>
        </div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;${dim}">
          <label style="display:flex;align-items:center;gap:5px">
            <input type="checkbox" ${dis} ${t.mapPriorityDay ? 'checked' : ''} onchange="toggleTemaFlag('${_escTema(t.id)}','mapPriorityDay',this.checked)">
            Prevalece en mapa de día
          </label>
          <label style="display:flex;align-items:center;gap:5px">
            <input type="checkbox" ${dis} ${t.mapPriorityNight ? 'checked' : ''} onchange="toggleTemaFlag('${_escTema(t.id)}','mapPriorityNight',this.checked)">
            Prevalece en mapa de noche
          </label>
        </div>
      </div>`;
    }).join('');
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

  // R1 — interruptor maestro: con el tema apagado, el resto de los tildes no se toca.
  if (flag !== 'active' && !t.active) {
    toast(`⚠️ Primero activá el tema "${t.name}" para poder cambiar sus opciones.`);
    renderTemasAdmin();
    return;
  }

  if (value && (flag === 'active' || flag === 'showOnMap')) {
    const willBeActive = flag === 'active' ? true : t.active;
    const willHaveThumb = flag === 'showOnMap' ? true : t.showOnMap;
    if (willBeActive && willHaveThumb) {
      const other = _temaMapThumbConflict(t);
      if (other) {
        toast(`⚠️ No se puede: el tema "${other.name}" ya está activo con "Miniatura en el mapa". ` +
              `Solo 1 tema activo puede tener miniatura en el mapa. Apagá "${other.name}" o destildá ` +
              `su miniatura y probá de nuevo.`);
        renderTemasAdmin(); // devuelve el checkbox a su estado real
        return;
      }
    }
  }

  t[flag] = value;
  renderTemasAdmin();
  _markTemasDirty();
  toast(`✅ ${t.name}: "${_TEMA_FLAG_LABELS[flag]}" ${value ? 'activado' : 'desactivado'} — no olvides "Guardar cambios"`);
};

/* === POSICIÓN EN EL OJITO (1ª, 2ª… o última) === */
window.setTemaEyePosition = function(id, raw) {
  const t = TEMAS.find(x => x.id === id);
  if (!t) return;
  if (!t.active) { toast(`⚠️ Primero activá el tema "${t.name}" para poder cambiar sus opciones.`); renderTemasAdmin(); return; }
  t.eyePosition = raw === 'last' ? 'last' : Math.max(1, parseInt(raw, 10) || 1);
  renderTemasAdmin();
  _markTemasDirty();
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
  _temasRetire.add(old); // las imágenes con el sufijo viejo se bajan al 50 en el próximo guardado
  _temasRetire.delete(v.value);
  t.keyword = v.value;
  // El tema de noche se guarda por keyword: si apuntaba a este tema, lo seguimos
  // (en memoria; se persiste con "Guardar configuración día/noche").
  if (globalSettings.nightTheme === old) globalSettings.nightTheme = v.value;
  renderTemasAdmin();
  _markTemasDirty();
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
    _temasRetire.add(t.keyword); // sus imágenes se bajan al 50 en el próximo guardado
    if (globalSettings.nightTheme === t.keyword) globalSettings.nightTheme = null;
    renderTemasAdmin();
    _markTemasDirty();
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
    if (ok) {
      _clearTemasDirty();
      toast('⏳ Temas guardados. Aplicándolos a todos los lugares…');
      const r = await applyThemesToPins({ retire: Array.from(_temasRetire) });
      if (r.ok) {
        _temasRetire.clear();
        toast(r.count
          ? `✅ Temas aplicados: se movieron imágenes en ${r.count} lugar(es)` + (r.warnings.length ? ` — ⚠️ ${r.warnings.length} aviso(s), ver consola` : '')
          : '✅ Temas aplicados: no hubo nada que mover');
      } else {
        toast('⚠️ Los temas se guardaron, pero NO se pudieron aplicar a los lugares. Probá de nuevo (¿sesión de admin?).');
      }
    }
    btn.disabled = false;
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
