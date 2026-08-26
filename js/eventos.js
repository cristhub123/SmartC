/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/**
 * [Etapa 3 — PLAN_USUARIOS_EVENTOS.md, 2026-08-25]
 * COLECCIÓN "eventos" — ADMIN-ONLY POR AHORA
 * ---------------------------------------------------------------
 * Nueva tab del panel Admin (#eventos-admin / tp-eventos-admin).
 * Por ahora SOLO el admin puede crear eventos (el toggle que
 * habilita a dueños/usuarios para crearlos desde su propio panel es
 * la Etapa 6) — por eso esta pantalla vive acá y no en
 * OwnerPanel/la UI pública, aunque el modelo de datos ya está
 * preparado para ese caso futuro (ver `creadorUid`/`usuarioAsignadoUid`
 * más abajo).
 *
 * Un evento SIEMPRE queda anexado a un pin (`poi_id`) — 2 caminos:
 *   A) el lugar YA tiene pin en el mapa → se busca y se elige (sin
 *      restringir a "pines propios": el admin no tiene pines propios).
 *   B) el lugar todavía NO tiene pin → se crea acá mismo un pin
 *      MÍNIMO pero ya funcional (nombre + coordenadas por geocoder o
 *      click en el mapa), `tipo: 'evento_temporal'`, categoría fija
 *      "Evento". La Etapa 4 le va a agregar el ciclo de vida (auto-
 *      desactivación cuando vencen todos sus eventos) — acá no se
 *      implementa nada de eso, el pin ya queda funcional igual que
 *      cualquier otro.
 *
 * Modelo de datos (colección `eventos/{eventoId}`, id automático de
 * Firestore):
 *   { nombre, descripcion, categoria, fecha_inicio (ISO string o
 *     null), fecha_fin (ISO string o null), poi_id, creadorUid
 *     (null mientras el alta sea admin-only), usuarioAsignadoUid
 *     (uid asignado a mano por ahora — ver más abajo), activo
 *     (bool, toggle de habilitación manual del admin), estado
 *     ('aprobado' al crearlo el admin — el flujo pendiente/rechazado
 *     es para cuando un dueño/usuario lo cree directo, Etapa 6),
 *     creadoEn (serverTimestamp) }
 *
 * `usuarioAsignadoUid`: mientras la creación siga siendo admin-only,
 * se asigna A MANO (pegar UID directo, o resolver por mail con el
 * mismo criterio que ya usa `_resolveOwnerEmailToUid` en
 * pin-adjust.js para el dueño de un pin — reusada tal cual, no
 * reimplementada acá). A futuro (Etapa 6 en adelante), cuando el
 * dueño del evento lo cree con su propio usuario, el sistema lo va a
 * autoasignar solo — ese cambio no toca el modelo de datos, solo
 * quién completa el campo.
 *
 * Dependencias externas que este archivo asume ya cargadas (ver
 * orden de scripts en AI_RULES.md / index.html): `db` (firebase-init.js),
 * `POIS`/`savePoiToFirestore`/`syncAppStateWithPOIS`/`regeneratePublicCache`
 * (config.js/firestore-sync.js), `makeMarker` (markers.js), `toast`/
 * `switchTab`/`startPickMode` (admin.js), `slugify` (markers.js),
 * `_autoSlugBase`/`_resolveOwnerEmailToUid` (pin-adjust.js),
 * `getCitySuffixFor`/`ACTIVE_LOCATION` (cities.js), `setupGeocoder`
 * (geocoder.js), `_escHtml`/`_escAttr` (owner-panel.js, reusadas tal
 * cual — mismo criterio que ya deja este proyecto reusar helpers
 * chicos entre módulos sin duplicarlos).
 */

let _eventosCache = [];
let _evtCamino = 'a'; // 'a' = pin ya existe | 'b' = crear pin mínimo
let _evtSelectedPinId = null;
let _evtAsignadoResueltoUid = null;

/* ═══════════════════════════════════════════════════════════
   CAMINO A / B — toggle de UI
   ═══════════════════════════════════════════════════════════ */
function _evtSetCamino(camino) {
  _evtCamino = camino;
  document.getElementById('evt-camino-a-btn')?.classList.toggle('on', camino === 'a');
  document.getElementById('evt-camino-b-btn')?.classList.toggle('on', camino === 'b');
  const paneA = document.getElementById('evt-camino-a-pane');
  const paneB = document.getElementById('evt-camino-b-pane');
  if (paneA) paneA.style.display = camino === 'a' ? '' : 'none';
  if (paneB) paneB.style.display = camino === 'b' ? '' : 'none';
}

document.getElementById('evt-camino-a-btn')?.addEventListener('click', () => _evtSetCamino('a'));
document.getElementById('evt-camino-b-btn')?.addEventListener('click', () => _evtSetCamino('b'));

/* ── Camino A: buscador de pines existentes (click para elegir) ──
   No se restringe a "pines propios" — el admin no tiene pines
   propios, a diferencia de OwnerPanel (Etapa 2). */
function _evtBuscarPines(query) {
  const wrap = document.getElementById('evt-buscar-pin-results');
  if (!wrap) return;
  const q = (query || '').trim().toLowerCase();
  if (!q) { wrap.innerHTML = ''; wrap.classList.remove('show'); return; }
  const matches = (typeof POIS !== 'undefined' ? POIS : [])
    .filter(p => (p.name || '').toLowerCase().includes(q))
    .slice(0, 8);
  if (!matches.length) {
    wrap.innerHTML = '<div class="geocoder-result"><strong>Sin resultados</strong><span>Probá con otro nombre</span></div>';
    wrap.classList.add('show');
    return;
  }
  wrap.innerHTML = matches.map(p => `
    <div class="geocoder-result" data-pin-id="${_escAttr(p.id)}">
      <strong>${_escHtml(p.name || p.id)}</strong>
      <span>${_escHtml(p.categoryLabel || p.id)}</span>
    </div>
  `).join('');
  wrap.classList.add('show');
  wrap.querySelectorAll('[data-pin-id]').forEach(el => {
    el.addEventListener('click', () => _evtSeleccionarPin(el.dataset.pinId));
  });
}

function _evtSeleccionarPin(pinId) {
  const p = (typeof POIS !== 'undefined' ? POIS : []).find(x => x.id === pinId);
  if (!p) return;
  _evtSelectedPinId = pinId;
  document.getElementById('evt-buscar-pin-results').classList.remove('show');
  document.getElementById('evt-buscar-pin-input').value = '';
  const sel = document.getElementById('evt-pin-seleccionado');
  if (sel) {
    sel.style.display = '';
    sel.querySelector('.evt-pin-seleccionado-name').textContent = p.name || p.id;
  }
}

function _evtQuitarSeleccion() {
  _evtSelectedPinId = null;
  const sel = document.getElementById('evt-pin-seleccionado');
  if (sel) sel.style.display = 'none';
}

document.getElementById('evt-buscar-pin-input')?.addEventListener('input', e => _evtBuscarPines(e.target.value));
document.getElementById('evt-pin-seleccionado-quitar')?.addEventListener('click', _evtQuitarSeleccion);
document.addEventListener('click', e => {
  const wrap = document.getElementById('evt-buscar-pin-results');
  const input = document.getElementById('evt-buscar-pin-input');
  if (wrap && input && !wrap.contains(e.target) && e.target !== input) wrap.classList.remove('show');
});

/* ── Camino B: pin mínimo (nombre + geocoder/click en mapa) ──
   La Etapa 4 le agrega después el ciclo de vida (auto-desactivación
   al vencer todos sus eventos) — acá se crea ya funcional. */
function _syncEvtPinCoordDisplay() {
  const lat = document.getElementById('evt-pin-lat')?.value;
  const lng = document.getElementById('evt-pin-lng')?.value;
  const d = document.getElementById('evt-pin-coord-display');
  if (!d) return;
  if (lat && lng) {
    d.textContent = `${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}`;
    d.classList.add('set');
  } else {
    d.textContent = 'Sin coordenadas — buscá una dirección o hacé click en el mapa';
    d.classList.remove('set');
  }
}
window._syncEvtPinCoordDisplay = _syncEvtPinCoordDisplay;

document.getElementById('btn-pick-evento-pin')?.addEventListener('click', () => {
  if (typeof startPickMode === 'function') startPickMode('evento-pin');
});

/**
 * Crea el pin mínimo del Camino B y lo deja funcionando igual que
 * cualquier otro pin (mismo criterio de guardado que saveNew() en
 * pin-adjust.js, reducido a los campos imprescindibles). No reusa
 * saveNew() directo porque ese depende del DOM completo de la tab
 * "Nuevo" — acá se arma el objeto a mano con los mismos defaults.
 * @returns {Promise<string|null>} el id del pin nuevo, o null si falló.
 */
async function _crearPinMinimoEvento(nombre, lat, lng) {
  const country  = (window.ACTIVE_LOCATION && ACTIVE_LOCATION.countryCode)  || '';
  const province = (window.ACTIVE_LOCATION && ACTIVE_LOCATION.provinceCode) || '';
  const cityCode = (window.ACTIVE_LOCATION && ACTIVE_LOCATION.cityCode)     || '';
  const citySuffix = (typeof getCitySuffixFor === 'function') ? getCitySuffixFor(country, province, cityCode) : cityCode;
  const base = (typeof _autoSlugBase === 'function') ? _autoSlugBase(nombre) : slugify(nombre);
  let slug = citySuffix ? `${base}-${citySuffix}` : base;
  if (!slug) { toast('⚠️ No se pudo generar un ID para el pin del evento'); return null; }
  // Si ya existe otro pin con ese ID (poco probable, pero posible si
  // dos eventos usan lugares con nombre parecido), se desambigua con
  // un sufijo numérico — mismo espíritu que el aviso de duplicado de
  // saveNew(), pero acá se resuelve solo en vez de bloquear el alta.
  let attempt = slug, n = 2;
  while ((typeof POIS !== 'undefined') && POIS.some(p => p.id === attempt)) {
    attempt = `${slug}-${n}`; n += 1;
  }
  slug = attempt;

  const p = {
    id: slug, name: nombre,
    category: 'evento', categories: ['evento'], categoryLabel: 'Evento',
    icon: '🎉', lat, lng, address: '',
    country, province, city: cityCode,
    imgB64: null, banner: null,
    pinScale: 100, pinOffsetX: 0, pinOffsetY: 0,
    desc: '', hist: 'Sin datos históricos.',
    content: {},
    soc: [], tags: [], phone: '', hours: '',
    events: [], iconCyber: '🔵', iconWinter: '❄️', iconZombie: '☣️',
    active: true,
    ownerId: null,
    // [Etapa 3] marca de origen — la Etapa 4 usa este campo para saber
    // qué pines son candidatos a auto-desactivación al vencer sus
    // eventos (un pin normal, aunque tenga eventos, no se desactiva solo).
    tipo: 'evento_temporal',
  };

  const guardadoOk = await savePoiToFirestore(p);
  if (!guardadoOk) return null;

  POIS.push(p);
  syncAppStateWithPOIS();
  await regeneratePublicCache();
  if (typeof makeMarker === 'function') makeMarker(p);
  if (typeof applyFilter === 'function') applyFilter();

  return slug;
}

/* ═══════════════════════════════════════════════════════════
   ASIGNACIÓN MANUAL (usuarioAsignadoUid) — pegar UID o resolver
   por mail con click (mismo criterio que la asignación de dueño
   de pin por mail, ver _resolveOwnerEmailToUid en pin-adjust.js).
   ═══════════════════════════════════════════════════════════ */
async function _evtBuscarAsignadoPorMail() {
  const emailInput = document.getElementById('evt-asignado-email');
  const resultEl = document.getElementById('evt-asignado-resultado');
  const email = (emailInput?.value || '').trim();
  if (!email) { toast('⚠️ Escribí un mail para buscar'); return; }
  if (resultEl) resultEl.innerHTML = 'Buscando...';
  try {
    const uid = (typeof _resolveOwnerEmailToUid === 'function') ? await _resolveOwnerEmailToUid(email) : null;
    if (!uid) {
      if (resultEl) resultEl.innerHTML = `⚠️ No hay ninguna cuenta registrada con el mail "${_escHtml(email)}"`;
      return;
    }
    _evtAsignadoResueltoUid = uid;
    if (resultEl) {
      resultEl.innerHTML = `<span class="evt-asignado-click" data-uid="${_escAttr(uid)}">✓ Click para asignar a "${_escHtml(email)}" (UID: ${_escHtml(uid)})</span>`;
      resultEl.querySelector('.evt-asignado-click').addEventListener('click', () => {
        document.getElementById('evt-asignado-uid').value = uid;
        if (resultEl) resultEl.innerHTML = `Asignado: ${_escHtml(email)}`;
      });
    }
  } catch (err) {
    console.warn('Error buscando usuario por mail:', err);
    if (resultEl) resultEl.innerHTML = '⚠️ No se pudo buscar. Probá de nuevo.';
  }
}
document.getElementById('evt-asignado-buscar-btn')?.addEventListener('click', _evtBuscarAsignadoPorMail);

/* ═══════════════════════════════════════════════════════════
   GUARDAR EVENTO NUEVO
   ═══════════════════════════════════════════════════════════ */
function _dateInputToIso(inputId) {
  const v = document.getElementById(inputId)?.value;
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function saveEventoNuevo() {
  const errEl = document.getElementById('evt-form-error');
  const btn = document.getElementById('btn-save-evento');
  if (errEl) errEl.textContent = '';

  const nombre = document.getElementById('evt-nombre')?.value.trim() || '';
  if (!nombre) { toast('⚠️ Ingresá el nombre del evento'); return; }

  const descripcion = document.getElementById('evt-descripcion')?.value.trim() || '';
  const categoria = document.getElementById('evt-categoria')?.value.trim() || '';
  const fecha_inicio = _dateInputToIso('evt-fecha-inicio');
  const fecha_fin = _dateInputToIso('evt-fecha-fin');
  const activo = !!document.getElementById('evt-activo')?.checked;
  const usuarioAsignadoUid = document.getElementById('evt-asignado-uid')?.value.trim() || null;

  btn.textContent = 'Guardando...'; btn.disabled = true;

  let poi_id = null;
  if (_evtCamino === 'a') {
    if (!_evtSelectedPinId) {
      if (errEl) errEl.textContent = '⚠️ Elegí un pin existente para anexar el evento (Camino A)';
      btn.textContent = '✓ Crear evento'; btn.disabled = false;
      return;
    }
    poi_id = _evtSelectedPinId;
  } else {
    const pinNombre = document.getElementById('evt-pin-nombre')?.value.trim() || '';
    const lat = parseFloat(document.getElementById('evt-pin-lat')?.value);
    const lng = parseFloat(document.getElementById('evt-pin-lng')?.value);
    if (!pinNombre) {
      if (errEl) errEl.textContent = '⚠️ Ingresá el nombre del lugar para crear su pin (Camino B)';
      btn.textContent = '✓ Crear evento'; btn.disabled = false;
      return;
    }
    if (isNaN(lat) || isNaN(lng)) {
      if (errEl) errEl.textContent = '⚠️ Ubicá el lugar con el buscador o haciendo click en el mapa (Camino B)';
      btn.textContent = '✓ Crear evento'; btn.disabled = false;
      return;
    }
    toast('⏳ Creando pin del lugar...');
    poi_id = await _crearPinMinimoEvento(pinNombre, lat, lng);
    if (!poi_id) {
      if (errEl) errEl.textContent = '⚠️ No se pudo crear el pin del lugar. Probá de nuevo.';
      btn.textContent = '✓ Crear evento'; btn.disabled = false;
      return;
    }
  }

  const evento = {
    nombre, descripcion, categoria,
    fecha_inicio, fecha_fin,
    poi_id,
    creadorUid: null, // [Etapa 3] admin-only: nace sin creador de usuario
    usuarioAsignadoUid,
    activo,
    estado: 'aprobado', // admin-only: no hace falta moderación de su propia alta
    creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
  };

  try {
    await db.collection('eventos').add(evento);
    toast(`✅ Evento "${nombre}" creado`);
    _resetEventoForm();
    await _loadEventosAdminList();
  } catch (err) {
    console.warn('Error guardando evento:', err);
    if (errEl) errEl.textContent = '⚠️ No se pudo guardar el evento. Probá de nuevo (¿iniciaste sesión?).';
  } finally {
    btn.textContent = '✓ Crear evento'; btn.disabled = false;
  }
}
document.getElementById('btn-save-evento')?.addEventListener('click', saveEventoNuevo);

function _resetEventoForm() {
  ['evt-nombre', 'evt-descripcion', 'evt-categoria', 'evt-fecha-inicio', 'evt-fecha-fin',
   'evt-pin-nombre', 'evt-pin-lat', 'evt-pin-lng', 'geo-input-evt',
   'evt-asignado-uid', 'evt-asignado-email'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const activoEl = document.getElementById('evt-activo');
  if (activoEl) activoEl.checked = true;
  const resultEl = document.getElementById('evt-asignado-resultado');
  if (resultEl) resultEl.innerHTML = '';
  _evtAsignadoResueltoUid = null;
  _evtQuitarSeleccion();
  _syncEvtPinCoordDisplay();
  _evtSetCamino('a');
}

/* ═══════════════════════════════════════════════════════════
   LISTADO DE EVENTOS YA CARGADOS
   ═══════════════════════════════════════════════════════════ */
async function _loadEventosAdminList() {
  const listEl = document.getElementById('eventos-admin-list');
  if (!listEl) return;
  listEl.innerHTML = '<p class="owner-panel-loading">Cargando eventos...</p>';
  try {
    const snap = await db.collection('eventos').orderBy('creadoEn', 'desc').get();
    _eventosCache = [];
    snap.forEach(doc => _eventosCache.push({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn('Error cargando eventos:', err);
    listEl.innerHTML = '<p class="owner-panel-loading">⚠️ No se pudieron cargar los eventos. Probá de nuevo.</p>';
    return;
  }

  if (!_eventosCache.length) {
    listEl.innerHTML = '<p class="owner-panel-loading">Todavía no hay eventos cargados.</p>';
    return;
  }

  listEl.innerHTML = _eventosCache.map(ev => {
    const pin = (typeof POIS !== 'undefined' ? POIS : []).find(p => p.id === ev.poi_id);
    const pinLabel = pin ? (pin.name || pin.id) : (ev.poi_id || '—');
    const fechas = [ev.fecha_inicio, ev.fecha_fin].filter(Boolean)
      .map(iso => new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))
      .join(' → ');
    return `
      <div class="evt-admin-row" data-evento-id="${_escAttr(ev.id)}">
        <div class="evt-admin-row-main">
          <strong>${_escHtml(ev.nombre || '(sin nombre)')}</strong>
          <span class="evt-admin-row-pin">📍 ${_escHtml(pinLabel)}</span>
          ${fechas ? `<span class="evt-admin-row-fechas">🗓 ${_escHtml(fechas)}</span>` : ''}
          <span class="evt-admin-row-estado">${_escHtml(ev.estado || 'aprobado')}</span>
        </div>
        <div class="evt-admin-row-actions">
          <button type="button" class="evt-admin-toggle ${ev.activo ? 'on' : ''}" data-action="toggle" title="${ev.activo ? 'Desactivar' : 'Activar'}"></button>
          <button type="button" class="evt-admin-del" data-action="delete" title="Eliminar">🗑</button>
        </div>
      </div>`;
  }).join('');

  listEl.querySelectorAll('.evt-admin-row').forEach(row => {
    const id = row.dataset.eventoId;
    row.querySelector('[data-action="toggle"]')?.addEventListener('click', () => _toggleEventoActivo(id));
    row.querySelector('[data-action="delete"]')?.addEventListener('click', () => _deleteEvento(id));
  });
}

async function _toggleEventoActivo(eventoId) {
  const ev = _eventosCache.find(e => e.id === eventoId);
  if (!ev) return;
  const nuevoValor = !ev.activo;
  try {
    await db.collection('eventos').doc(eventoId).set({ activo: nuevoValor }, { merge: true });
    ev.activo = nuevoValor;
    await _loadEventosAdminList();
  } catch (err) {
    console.warn('Error actualizando evento:', err);
    toast('⚠️ No se pudo actualizar el evento. Probá de nuevo.');
  }
}

async function _deleteEvento(eventoId) {
  const ev = _eventosCache.find(e => e.id === eventoId);
  if (!confirm(`¿Eliminar el evento "${ev?.nombre || ''}"? Esta acción no se puede deshacer.`)) return;
  try {
    await db.collection('eventos').doc(eventoId).delete();
    toast('🗑 Evento eliminado');
    await _loadEventosAdminList();
  } catch (err) {
    console.warn('Error eliminando evento:', err);
    toast('⚠️ No se pudo eliminar el evento. Probá de nuevo.');
  }
}

/* Se registra como tab plugin (mismo patrón que features.js/roadmap.js
   para tabs agregadas después de admin.js) — al entrar a la tab
   "Eventos" se refresca la lista contra Firestore. */
if (window.SC && typeof SC.registerTabPlugin === 'function') {
  SC.registerTabPlugin('eventos-admin', _loadEventosAdminList);
}

/* Geocoder del Camino B — mismo helper genérico que usan las tabs
   Nuevo/Editar (ver geocoder.js), apuntando a los campos propios de
   esta pantalla. */
if (typeof setupGeocoder === 'function') {
  setupGeocoder('geo-input-evt', 'geo-btn-evt', 'geo-results-evt', 'evt-pin-lat', 'evt-pin-lng', 'evt-pin-coord-display', _syncEvtPinCoordDisplay);
}

window.Eventos = { refreshList: _loadEventosAdminList };
