/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/**
 * [Etapa 6 — PLAN_PANEL_USUARIO_EDICION_EVENTOS_2026-08-26.md]
 * PANEL DE USUARIO UNIFICADO — 3 solapas (Info / Pines / Eventos)
 * ---------------------------------------------------------------
 * Reemplaza al mini panel de cuenta (Etapa 1) que abría
 * js/user-auth.js, y absorbe al panel del dueño de negocio (Etapa 2,
 * js/owner-panel.js) como una solapa más. Se abre desde
 * #btn-user-account ya logueado (ver onUserAccountButtonClick en
 * js/user-auth.js).
 *
 * Solapas:
 *   - Info: nombre/rol/cerrar sesión — mismo contenido que el mini
 *     panel anterior, sin cambios de lógica.
 *   - Pines: SOLO para rol 'dueno_negocio'. Reusa TAL CUAL la lista y
 *     el editor de js/owner-panel.js (mismos ids de DOM, relocalizados
 *     dentro de #up-pane-pines en index.html) — este archivo solo
 *     decide CUÁNDO llamar a OwnerPanel.loadPins()/backToList().
 *   - Eventos: para CUALQUIER cuenta logueada. Autoservicio de alta
 *     (Camino A/B, igual que la tab admin) y edición limitada (solo
 *     nombre/descripción/categoría/fechas — no el lugar, ver nota más
 *     abajo) de sus propios eventos.
 *
 * "Sus propios eventos" = `creadorUid == uid` O `usuarioAsignadoUid
 * == uid` (2 queries a Firestore, merged y sin duplicados — Firestore
 * no permite OR entre campos distintos en una sola query).
 *
 * Reglas de negocio ya decididas con Cris (ver
 * PLAN_PANEL_USUARIO_EDICION_EVENTOS_2026-08-26.md, sección 3):
 *   - Alta bloqueable con el toggle admin `creacionEventosHabilitada`
 *     (settings/eventos-config, ver js/eventos.js).
 *   - Todo evento creado acá nace `activo:false` — lo activa el admin
 *     a mano.
 *   - Edición consume 1 de `cambiosRestantes` por cada "Guardar
 *     cambios", sin importar cuántos campos se tocaron — 1 sola
 *     escritura (`.update()` con `FieldValue.increment(-1)` incluido
 *     en el mismo objeto, no una escritura aparte).
 *   - Nombre único por ciudad — mismo mecanismo que el alta admin
 *     (ver EventosShared.checkNombreDuplicado en js/eventos.js).
 *
 * Punto AÚN sin definir con Cris (no bloqueante, ver plan): si la
 * edición del propio evento también debería poder mover/renombrar el
 * pin `evento_temporal` del Camino B. Por eso, acá la edición NUNCA
 * toca el lugar/pin — solo la creación. Si más adelante Cris pide
 * que también se pueda, se agrega sin tocar el resto de este flujo.
 *
 * Dependencias externas que este archivo asume ya cargadas (ver orden
 * de scripts en index.html — se carga después de eventos.js):
 * `db`, `POIS`, `slugify`, `getCitySuffixFor`/`ACTIVE_LOCATION`
 * (cities.js), `setupGeocoder` (geocoder.js), `startPickMode`
 * (admin.js), `toast`, `UserAuth` (user-auth.js), `OwnerPanel`
 * (owner-panel.js), `EventosShared` (eventos.js), `_escHtml`/`_escAttr`
 * (owner-panel.js, reusadas tal cual).
 */

let _upEvtCamino = 'a';         // 'a' = pin ya existe | 'b' = crear pin mínimo
let _upEvtSelectedPinId = null;
let _upEvtEditingId = null;     // id del evento en edición (autoservicio) — null = modo alta
let _upMisEventos = [];

/* ═══════════════════════════════════════════════════════════
   ABRIR / CERRAR + SOLAPAS
   ═══════════════════════════════════════════════════════════ */
function _upOpen() {
  try {
    if (!window.UserAuth || !UserAuth.isLoggedIn()) return;
    const overlay = document.getElementById('user-panel-overlay');
    if (!overlay) { console.error('[user-panel.js] No se encontró #user-panel-overlay.'); return; }
    // [Hotfix 2026-08-27] Se fuerza también con estilos inline, además
    // de la clase "on" — así el panel se muestra pase lo que pase con
    // el CSS externo (algún caché viejo, alguna regla que pise la
    // clase, etc.). Es redundante a propósito, no hace daño.
    overlay.classList.add('on');
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'all';
    _upRenderInfo();
    _upSwitchTab('info');
  } catch (err) {
    console.error('[user-panel.js] Error abriendo el panel de usuario:', err);
    if (typeof toast === 'function') toast('⚠️ No se pudo abrir tu panel — probá recargar (Ctrl+Shift+R)');
  }
}

function _upClose() {
  const overlay = document.getElementById('user-panel-overlay');
  if (!overlay) return;
  overlay.classList.remove('on');
  overlay.style.opacity = '';
  overlay.style.pointerEvents = '';
}

function _upSwitchTab(tab) {
  document.querySelectorAll('.user-panel-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.upTab === tab);
  });
  document.getElementById('up-pane-info').classList.toggle('on', tab === 'info');
  document.getElementById('up-pane-pines').classList.toggle('on', tab === 'pines');
  document.getElementById('up-pane-eventos').classList.toggle('on', tab === 'eventos');

  if (tab === 'pines') _upActivatePinesTab();
  if (tab === 'eventos') _upActivateEventosTab();
}

// [Hotfix 2026-08-27] Delegado desde `document` (mismo criterio que
// el botón de cuenta en js/user-auth.js) — más robusto, y cubre las
// 3 solapas con un solo listener.
document.addEventListener('click', (e) => {
  const tabBtn = e.target && e.target.closest && e.target.closest('.user-panel-tab');
  if (tabBtn && tabBtn.dataset.upTab) _upSwitchTab(tabBtn.dataset.upTab);
});
document.getElementById('user-panel-close').addEventListener('click', _upClose);
document.getElementById('user-panel-overlay').addEventListener('click', e => {
  if (e.target.id === 'user-panel-overlay') _upClose();
});

/* ═══════════════════════════════════════════════════════════
   SOLAPA INFO
   ═══════════════════════════════════════════════════════════ */
function _upRenderInfo() {
  const user = UserAuth.getCurrentUser();
  const profile = UserAuth.getCurrentUserProfile();
  if (!user) return;
  const label = (profile && profile.nombre) || user.email || 'Cuenta';
  document.getElementById('user-account-name').textContent = label;
  document.getElementById('user-account-role').textContent = UserAuth.roleLabel(profile && profile.rol);
}

/* ═══════════════════════════════════════════════════════════
   SOLAPA PINES — solo dueño de negocio; reusa js/owner-panel.js
   ═══════════════════════════════════════════════════════════ */
function _upActivatePinesTab() {
  const esDueno = !!(window.UserAuth && UserAuth.hasRole('dueno_negocio'));
  document.getElementById('up-pines-disabled').style.display = esDueno ? 'none' : 'block';
  document.getElementById('owner-panel-list').style.display = esDueno ? '' : 'none';
  document.getElementById('owner-panel-empty').style.display = 'none';
  document.getElementById('owner-panel-form').classList.remove('on');
  if (window.EmpleadosPanel) EmpleadosPanel.activar(); // [Etapa 8]
  if (!esDueno || !window.OwnerPanel) return;
  OwnerPanel.backToList();
  OwnerPanel.loadPins();
}

/* ═══════════════════════════════════════════════════════════
   SOLAPA EVENTOS — cualquier cuenta logueada
   ═══════════════════════════════════════════════════════════ */
function _upActivateEventosTab() {
  _upShowEventosList();
  _upLoadMisEventos();
}

async function _upLoadMisEventos() {
  const wrap = document.getElementById('up-eventos-list');
  wrap.innerHTML = '<p class="owner-panel-loading">Cargando tus eventos...</p>';
  const uid = UserAuth.getCurrentUser().uid;
  try {
    const [porCreador, porAsignado] = await Promise.all([
      db.collection('eventos').where('creadorUid', '==', uid).get(),
      db.collection('eventos').where('usuarioAsignadoUid', '==', uid).get(),
    ]);
    const byId = new Map();
    porCreador.forEach(doc => byId.set(doc.id, { id: doc.id, ...doc.data() }));
    porAsignado.forEach(doc => byId.set(doc.id, { id: doc.id, ...doc.data() }));
    _upMisEventos = Array.from(byId.values());
  } catch (err) {
    console.warn('[Etapa 6] Error cargando eventos del usuario:', err);
    wrap.innerHTML = '<p class="owner-panel-loading">⚠️ No se pudieron cargar tus eventos. Probá de nuevo.</p>';
    return;
  }
  _upRenderMisEventos();
}

function _upRenderMisEventos() {
  const listEl = document.getElementById('up-eventos-list');
  const emptyEl = document.getElementById('up-eventos-empty');
  const cfg = (window.EventosShared ? EventosShared.getConfig() : { creacionEventosHabilitada: true });

  if (!_upMisEventos.length) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
    document.getElementById('btn-up-add-evento').style.display = cfg.creacionEventosHabilitada ? '' : 'none';
    document.getElementById('up-eventos-disabled-msg').style.display = cfg.creacionEventosHabilitada ? 'none' : 'block';
    return;
  }
  emptyEl.style.display = 'none';

  listEl.innerHTML = _upMisEventos.map(ev => {
    const pin = (typeof POIS !== 'undefined' ? POIS : []).find(p => p.id === ev.poi_id);
    const pinLabel = pin ? (pin.name || pin.id) : (ev.poi_id || '—');
    const fechas = [ev.fecha_inicio, ev.fecha_fin].filter(Boolean)
      .map(iso => new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))
      .join(' → ');
    const cambios = (typeof ev.cambiosRestantes === 'number') ? ev.cambiosRestantes : 0;
    const puedeEditar = cambios > 0;
    const entradaTxt = ev.entradaGratis === false ? `💵 ${ev.valorEntrada || 'con costo'}` : '🆓 Gratis';
    return `
      <div class="evt-admin-row" data-evento-id="${_escAttr(ev.id)}">
        <div class="evt-admin-row-main">
          <strong>${_escHtml(ev.nombre || '(sin nombre)')}</strong>
          <span class="evt-admin-row-pin">📍 ${_escHtml(pinLabel)}</span>
          ${fechas ? `<span class="evt-admin-row-fechas">🗓 ${_escHtml(fechas)}${ev.horario ? ` · ${_escHtml(ev.horario)}` : ''}</span>` : ''}
          <span class="evt-admin-row-estado">${ev.activo ? 'activo' : 'esperando aprobación del admin'}</span>
          <span class="evt-admin-row-estado">${entradaTxt}</span>
          <span class="evt-admin-row-cambios">✏️ ${cambios} cambio${cambios === 1 ? '' : 's'} disponible${cambios === 1 ? '' : 's'}</span>
        </div>
        <div class="evt-admin-row-actions">
          <button type="button" class="evt-admin-edit" data-action="edit" ${puedeEditar ? '' : 'disabled style="opacity:.35;cursor:not-allowed"'} title="${puedeEditar ? 'Editar' : 'Sin cambios disponibles — pedile al admin que te recargue'}">✏️</button>
        </div>
      </div>`;
  }).join('');

  listEl.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', e => {
      if (btn.disabled) return;
      _upStartEdit(e.currentTarget.closest('.evt-admin-row').dataset.eventoId);
    });
  });
}

function _upShowEventosList() {
  document.getElementById('up-eventos-list-wrap').style.display = '';
  document.getElementById('up-evt-form').style.display = 'none';
  _upResetEvtForm();
}

function _upShowEventosForm() {
  document.getElementById('up-eventos-list-wrap').style.display = 'none';
  document.getElementById('up-evt-form').style.display = '';
}

document.getElementById('btn-up-add-evento')?.addEventListener('click', () => {
  const cfg = (window.EventosShared ? EventosShared.getConfig() : { creacionEventosHabilitada: true });
  if (!cfg.creacionEventosHabilitada) { toast('⚠️ La creación de eventos está deshabilitada por ahora'); return; }
  _upResetEvtForm();
  document.getElementById('up-evt-form-title').textContent = 'Nuevo evento';
  document.getElementById('up-evt-lugar-block').style.display = '';
  document.getElementById('up-evt-cambios-info').textContent = '';
  _upShowEventosForm();
});
document.getElementById('up-evt-form-back-btn')?.addEventListener('click', _upShowEventosList);

/* ── Camino A/B (mismo criterio que la tab admin, ids propios) ── */
function _upSetCamino(camino) {
  _upEvtCamino = camino;
  EventosFormCommon.applyCaminoUI('up-evt-', camino);
  if (window.EventosShared) EventosShared.syncDireccionBlock('up-evt-', camino, _upEvtSelectedPinId);
}
document.getElementById('up-evt-camino-a-btn')?.addEventListener('click', () => _upSetCamino('a'));
document.getElementById('up-evt-camino-b-btn')?.addEventListener('click', () => _upSetCamino('b'));

function _upBuscarPines(query) {
  EventosFormCommon.renderBuscarPinResults('up-evt-', query, _upSeleccionarPin);
}
document.getElementById('up-evt-buscar-pin-input')?.addEventListener('input', e => _upBuscarPines(e.target.value));
EventosFormCommon.wireBuscarPinClickOutside('up-evt-');

function _upSeleccionarPin(pinId) {
  const p = (typeof POIS !== 'undefined' ? POIS : []).find(x => x.id === pinId);
  if (!p) return;
  _upEvtSelectedPinId = pinId;
  EventosFormCommon.applyPinSeleccionado('up-evt-', p, 'up-evt-pin-seleccionado-name');
  _upSyncNombrePreview();
  if (window.EventosShared) EventosShared.syncDireccionBlock('up-evt-', _upEvtCamino, _upEvtSelectedPinId);
}
function _upQuitarSeleccion() {
  _upEvtSelectedPinId = null;
  EventosFormCommon.ocultarPinSeleccionado('up-evt-');
  if (window.EventosShared) EventosShared.syncDireccionBlock('up-evt-', _upEvtCamino, _upEvtSelectedPinId);
}
document.getElementById('up-evt-pin-seleccionado-quitar')?.addEventListener('click', _upQuitarSeleccion);

/* ── Camino B: pin mínimo (geocoder/click en mapa) ── */
function _syncUpEvtPinCoordDisplay() {
  EventosFormCommon.syncPinCoordDisplay('up-evt-');
}
window._syncUpEvtPinCoordDisplay = _syncUpEvtPinCoordDisplay;

document.getElementById('btn-pick-up-evento-pin')?.addEventListener('click', () => {
  if (typeof startPickMode === 'function') startPickMode('user-evento-pin');
});

/* Llamada desde admin.js al terminar de elegir el punto en el mapa —
   reabre el panel de usuario en la solapa Eventos, con el formulario
   tal cual estaba (nada se pierde, solo se ocultó con CSS). */
function reopenUserPanelAfterPick() {
  document.getElementById('user-panel-overlay').classList.add('on');
  _upSwitchTab('eventos');
  _upShowEventosForm();
}
window.reopenUserPanelAfterPick = reopenUserPanelAfterPick;

/* ── Preview en vivo del nombre (reusa EventosShared) ── */
function _upSyncNombrePreview() {
  if (!window.EventosShared) return;
  EventosShared.syncNombrePreview('up-evt-nombre', 'up-evt-nombre-preview', _upEvtEditingId,
    () => EventosShared.resolveCityFromForm(_upEvtCamino, _upEvtSelectedPinId));
}
document.getElementById('up-evt-nombre')?.addEventListener('input', _upSyncNombrePreview);

/* ═══════════════════════════════════════════════════════════
   EDITAR (autoservicio) — solo nombre/descripción/categoría/fechas,
   nunca el lugar (ver nota de cabecera sobre el punto sin definir).
   ═══════════════════════════════════════════════════════════ */
function _upStartEdit(eventoId) {
  const ev = _upMisEventos.find(e => e.id === eventoId);
  if (!ev) return;
  _upEvtEditingId = eventoId;

  // [Etapa 10, Parte 2] campos de contenido comunes — precarga
  // centralizada (misma función que usa el panel admin).
  EventosFormCommon.precargarCamposComunes('up-evt-', ev);
  if (window.EventosShared) {
    // La edición nunca toca el lugar — el bloque de dirección se
    // sincroniza igual, contra el pin YA anexado (`ev.poi_id`).
    EventosShared.syncDireccionBlock('up-evt-', 'a', ev.poi_id);
  }

  document.getElementById('up-evt-form-title').textContent = `Editando: ${ev.nombre || ''}`;
  document.getElementById('up-evt-lugar-block').style.display = 'none'; // la edición no toca el lugar
  const cambios = (typeof ev.cambiosRestantes === 'number') ? ev.cambiosRestantes : 0;
  document.getElementById('up-evt-cambios-info').textContent =
    `Este guardado va a consumir 1 de tus ${cambios} cambio${cambios === 1 ? '' : 's'} disponible${cambios === 1 ? '' : 's'}.`;
  document.getElementById('btn-save-up-evento').textContent = '💾 Guardar cambios';
  _upSyncNombrePreview();
  _upShowEventosForm();
}

/* ═══════════════════════════════════════════════════════════
   GUARDAR (alta o edición) — 1 sola escritura, mismo criterio que
   saveEvento() en js/eventos.js.
   ═══════════════════════════════════════════════════════════ */
async function saveUpEvento() {
  if (!window.EventosShared) { toast('⚠️ No se pudo guardar — recargá la página'); return; }
  const errEl = document.getElementById('up-evt-form-error');
  const btn = document.getElementById('btn-save-up-evento');
  const editando = !!_upEvtEditingId;
  if (errEl) errEl.textContent = '';

  // [Etapa 10, Parte 2] campos de contenido comunes — lectura
  // centralizada (misma función que usa el panel admin).
  const comunes = EventosFormCommon.readCamposComunes('up-evt-');
  const { nombre, descripcion, fecha_inicio, fecha_fin, horario, entradaGratis, valorEntrada,
          contactoEmail, contactoRedSocial, contactoTelefono, contactoWeb, tags } = comunes;
  if (!nombre) { toast('⚠️ Ingresá el nombre del evento'); return; }

  const originalBtnText = editando ? '💾 Guardar cambios' : '✓ Crear evento';
  btn.textContent = 'Guardando...'; btn.disabled = true;

  const uid = UserAuth.getCurrentUser().uid;
  let poi_id, city;

  if (editando) {
    const evActual = _upMisEventos.find(e => e.id === _upEvtEditingId);
    if (!evActual) { btn.textContent = originalBtnText; btn.disabled = false; return; }
    const cambiosActuales = (typeof evActual.cambiosRestantes === 'number') ? evActual.cambiosRestantes : 0;
    if (cambiosActuales <= 0) {
      if (errEl) errEl.textContent = '⚠️ Ya no te quedan cambios disponibles para este evento — pedile al admin que te recargue.';
      btn.textContent = originalBtnText; btn.disabled = false;
      return;
    }
    poi_id = evActual.poi_id;
    city = evActual.city || '';
  } else {
    const cfg = EventosShared.getConfig();
    if (!cfg.creacionEventosHabilitada) {
      if (errEl) errEl.textContent = '⚠️ La creación de eventos está deshabilitada por ahora.';
      btn.textContent = originalBtnText; btn.disabled = false;
      return;
    }
    if (_upEvtCamino === 'a') {
      if (!_upEvtSelectedPinId) {
        if (errEl) errEl.textContent = '⚠️ Elegí un pin existente para anexar el evento';
        btn.textContent = originalBtnText; btn.disabled = false;
        return;
      }
      poi_id = _upEvtSelectedPinId;
    } else {
      const pinNombre = document.getElementById('up-evt-pin-nombre')?.value.trim() || '';
      const lat = parseFloat(document.getElementById('up-evt-pin-lat')?.value);
      const lng = parseFloat(document.getElementById('up-evt-pin-lng')?.value);
      if (!pinNombre) {
        if (errEl) errEl.textContent = '⚠️ Ingresá el nombre del lugar para crear su pin';
        btn.textContent = originalBtnText; btn.disabled = false;
        return;
      }
      if (isNaN(lat) || isNaN(lng)) {
        if (errEl) errEl.textContent = '⚠️ Ubicá el lugar con el buscador o haciendo click en el mapa';
        btn.textContent = originalBtnText; btn.disabled = false;
        return;
      }
      const direccionParaPin = EventosShared.resolveDireccionFinal('up-evt-', 'b', null);
      toast('⏳ Creando pin del lugar...');
      poi_id = await EventosShared.crearPinMinimoEvento(pinNombre, lat, lng, direccionParaPin);
      if (!poi_id) {
        if (errEl) errEl.textContent = '⚠️ No se pudo crear el pin del lugar. Probá de nuevo.';
        btn.textContent = originalBtnText; btn.disabled = false;
        return;
      }
    }
    city = EventosShared.resolveCityFromForm(_upEvtCamino, poi_id);
  }

  // Dirección final: heredada del pin ya anexado (edición o Camino A),
  // o la recién usada para crear el pin mínimo (Camino B).
  const direccion = EventosShared.resolveDireccionFinal('up-evt-', 'a', poi_id)
    || EventosShared.resolveDireccionFinal('up-evt-', 'b', null);

  const errComun = EventosShared.validateComunes({ fecha_inicio, fecha_fin, horario, direccion, contactoEmail, contactoRedSocial, contactoTelefono, contactoWeb, tags });
  if (errComun) {
    if (errEl) errEl.textContent = errComun;
    btn.textContent = originalBtnText; btn.disabled = false;
    return;
  }

  const dup = EventosShared.checkNombreDuplicado(nombre, city, _upEvtEditingId);
  if (dup) {
    if (errEl) errEl.textContent = `⚠️ Ya existe un evento con ese nombre en esta ciudad: "${dup.nombre}"`;
    btn.textContent = originalBtnText; btn.disabled = false;
    return;
  }
  const nombreSlug = EventosShared.slugifyNombre(nombre);

  try {
    if (editando) {
      await db.collection('eventos').doc(_upEvtEditingId).update({
        nombre, nombreSlug, descripcion, fecha_inicio, fecha_fin, horario,
        entradaGratis, valorEntrada, direccion, tags,
        contactoEmail, contactoRedSocial, contactoTelefono, contactoWeb,
        cambiosRestantes: firebase.firestore.FieldValue.increment(-1),
      });
      toast(`✅ Evento "${nombre}" actualizado`);
    } else {
      const cfg = EventosShared.getConfig();
      await db.collection('eventos').add({
        nombre, nombreSlug, descripcion, fecha_inicio, fecha_fin, horario,
        entradaGratis, valorEntrada, direccion, tags,
        contactoEmail, contactoRedSocial, contactoTelefono, contactoWeb,
        poi_id, city,
        creadorUid: uid,
        usuarioAsignadoUid: uid, // [Etapa 6] autoservicio: se autoasigna, sin elegirlo a mano
        activo: false, // [Etapa 6] nace desactivado — lo activa el admin
        estado: 'pendiente',
        cambiosRestantes: (typeof cfg.cambiosDefault === 'number') ? cfg.cambiosDefault : 3,
        creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
      });
      toast(`✅ Evento "${nombre}" creado — queda a la espera de que el admin lo active`);
    }
    await _upLoadMisEventos();
    _upShowEventosList();
  } catch (err) {
    console.warn('[Etapa 6] Error guardando evento (autoservicio):', err);
    if (errEl) errEl.textContent = '⚠️ No se pudo guardar el evento. Probá de nuevo.';
  } finally {
    btn.textContent = originalBtnText; btn.disabled = false;
  }
}
document.getElementById('btn-save-up-evento')?.addEventListener('click', saveUpEvento);

function _upResetEvtForm() {
  // [Etapa 10, Parte 2] campos de contenido comunes — reset
  // centralizado (misma función que usa el panel admin).
  EventosFormCommon.resetCamposComunes('up-evt-');
  ['up-evt-pin-nombre', 'up-evt-pin-lat', 'up-evt-pin-lng', 'geo-input-up-evt'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('up-evt-cambios-info').textContent = '';
  document.getElementById('btn-save-up-evento').textContent = '✓ Crear evento';
  _upEvtEditingId = null;
  _upQuitarSeleccion();
  _syncUpEvtPinCoordDisplay();
  _upSetCamino('a');
}

/* Tilde "entrada gratuita" (mismo criterio que el form admin). */
EventosFormCommon.wireEntradaGratisToggle('up-evt-');

/* Geocoder del Camino B — mismo helper genérico que usa la tab admin
   (ver geocoder.js), apuntando a los campos propios de este panel. */
if (typeof setupGeocoder === 'function') {
  setupGeocoder('geo-input-up-evt', 'geo-btn-up-evt', 'geo-results-up-evt', 'up-evt-pin-lat', 'up-evt-pin-lng', 'up-evt-pin-coord-display', _syncUpEvtPinCoordDisplay);
}

window.UserPanel = { open: _upOpen, close: _upClose };