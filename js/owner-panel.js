/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/**
 * [Etapa 2 — PLAN_USUARIOS_EVENTOS.md, 2026-08-19]
 * PANEL DEL DUEÑO DE PIN/NEGOCIO
 * ---------------------------------------------------------------
 * Se abre desde el panel de usuario unificado (ver js/user-panel.js),
 * solapa "Pines" — solo visible si UserAuth.hasRole('dueno_negocio').
 *
 * Lista los pines de la colección "pines" donde `ownerId` == el uid
 * logueado, y deja editar SOLO un subconjunto acotado de campos:
 * desc, hist, phone, hours, tags, content.es.fields — nunca nombre,
 * categoría, coordenadas, imágenes, ID ni el propio ownerId. Esa
 * restricción no es solo de esta UI: las reglas de Firestore (ver
 * FIRESTORE_RULES_NOTES.md) exigen que el update tenga EXACTAMENTE
 * esos campos y que `resource.data.ownerId` sea igual al uid de quien
 * escribe — aunque alguien manipulara este archivo desde la consola
 * del navegador, Firestore va a rechazar cualquier otro campo o
 * cualquier pin que no sea el suyo.
 *
 * El editor de "campos de información" (título+texto) es una
 * reimplementación simple, INDEPENDIENTE de `_renderPinFieldsEditor`
 * de pin-adjust.js — ese módulo asume el DOM completo del admin
 * (ids del admin, `_readPinFieldsFromForm`, etc.) y no está pensado
 * para reutilizarse desde un panel público separado.
 *
 * Alcance de esta etapa (MVP): solo el idioma "es". Editar
 * inglés/portugués desde el panel del dueño queda para una
 * refinación futura — hoy solo el admin gestiona los otros idiomas.
 */

let _ownerPins = [];
let _ownerEditingId = null;
let _ownerFieldsState = [];

/* [Etapa 6, PLAN_PANEL_USUARIO_EDICION_EVENTOS_2026-08-26.md — 4.2]
 * openOwnerPanel/closeOwnerPanel (overlay propio) se eliminaron: el
 * panel del dueño ahora vive como la solapa "Pines" del panel de
 * usuario UNIFICADO — ver js/user-panel.js, que llama a
 * OwnerPanel.loadPins()/backToList() cuando esa solapa se activa. Esta
 * lista/editor de pines sigue siendo la misma (mismo HTML relocalizado
 * dentro de #up-pane-pines en index.html, mismos ids), solo cambió
 * quién decide cuándo mostrarla. */

async function _loadOwnerPins() {
  const listEl  = document.getElementById('owner-panel-list');
  const emptyEl = document.getElementById('owner-panel-empty');
  listEl.innerHTML = '<p class="owner-panel-loading">Cargando tus lugares...</p>';
  emptyEl.style.display = 'none';

  const uid = UserAuth.getCurrentUser().uid;
  try {
    const snap = await db.collection('pines').where('ownerId', '==', uid).get();
    _ownerPins = [];
    snap.forEach(doc => _ownerPins.push({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.warn('Error cargando pines del dueño:', err);
    listEl.innerHTML = '<p class="owner-panel-loading">⚠️ No se pudieron cargar tus lugares. Probá de nuevo.</p>';
    return;
  }

  if (!_ownerPins.length) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }

  listEl.innerHTML = _ownerPins.map(p => `
    <button type="button" class="owner-panel-item" data-pin-id="${_escAttr(p.id)}">
      <span class="owner-panel-item-name">${_escHtml(p.name || p.id)}</span>
      <span class="owner-panel-item-cat">${_escHtml(p.categoryLabel || '')}</span>
    </button>
  `).join('');
  listEl.querySelectorAll('.owner-panel-item').forEach(btn => {
    btn.addEventListener('click', () => _openOwnerEditForm(btn.dataset.pinId));
  });
}

function _openOwnerEditForm(pinId) {
  const p = _ownerPins.find(x => x.id === pinId);
  if (!p) return;
  _ownerEditingId = pinId;

  document.getElementById('owner-panel-list').style.display = 'none';
  document.getElementById('owner-panel-empty').style.display = 'none';
  document.getElementById('owner-panel-back-btn').style.display = 'inline-block';
  document.getElementById('owner-panel-form').classList.add('on');

  document.getElementById('owner-edit-name').textContent = p.name || p.id;
  document.getElementById('owner-edit-desc').value  = p.desc  || '';
  document.getElementById('owner-edit-hist').value  = p.hist  || '';
  document.getElementById('owner-edit-phone').value = p.phone || '';
  document.getElementById('owner-edit-hours').value = p.hours || '';
  document.getElementById('owner-edit-tags').value  = (p.tags || []).join(', ');
  document.getElementById('owner-panel-error').textContent = '';

  const existingFields = (p.content && p.content.es && p.content.es.fields) || [];
  _ownerFieldsState = existingFields.map(f => ({ ...f }));
  _paintOwnerFieldsRows();
}

function _backToOwnerList() {
  _ownerEditingId = null;
  document.getElementById('owner-panel-form').classList.remove('on');
  document.getElementById('owner-panel-back-btn').style.display = 'none';
  document.getElementById('owner-panel-list').style.display = '';
  if (!_ownerPins.length) document.getElementById('owner-panel-empty').style.display = 'block';
}

/* ── Editor simple de campos "título + texto" (independiente del admin) ── */
function _paintOwnerFieldsRows() {
  const wrap = document.getElementById('owner-edit-fields-wrap');
  if (!_ownerFieldsState.length) {
    wrap.innerHTML = '<p class="owner-panel-loading">Todavía no tenés ningún campo cargado.</p>';
    return;
  }
  wrap.innerHTML = _ownerFieldsState.map((f, i) => `
    <div class="owner-field-row" data-idx="${i}">
      <input type="text" class="owner-field-title" placeholder="Título (ej: Dato curioso)" value="${_escAttr(f.title || '')}">
      <textarea class="owner-field-text" placeholder="Texto" rows="2">${_escHtml(f.text || '')}</textarea>
      <button type="button" class="owner-field-remove" title="Quitar este campo">✕</button>
    </div>
  `).join('');
  wrap.querySelectorAll('.owner-field-row').forEach(row => {
    const idx = parseInt(row.dataset.idx, 10);
    row.querySelector('.owner-field-title').addEventListener('input', e => { _ownerFieldsState[idx].title = e.target.value; });
    row.querySelector('.owner-field-text').addEventListener('input', e => { _ownerFieldsState[idx].text = e.target.value; });
    row.querySelector('.owner-field-remove').addEventListener('click', () => {
      _ownerFieldsState.splice(idx, 1);
      _paintOwnerFieldsRows();
    });
  });
}

function _addOwnerField() {
  _ownerFieldsState.push({ id: null, title: '', text: '' });
  _paintOwnerFieldsRows();
}

function _escHtml(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function _escAttr(s) { return _escHtml(s).replace(/"/g, '&quot;'); }

/* ── Guardado — merge parcial, mismos campos que permiten las
   reglas de Firestore para un update de dueño (ver cabecera). ── */
async function saveOwnerEdit() {
  if (!_ownerEditingId) return;
  const errEl = document.getElementById('owner-panel-error');
  const btn   = document.getElementById('owner-panel-save-btn');

  const desc  = document.getElementById('owner-edit-desc').value.trim();
  const hist  = document.getElementById('owner-edit-hist').value.trim();
  const phone = document.getElementById('owner-edit-phone').value.trim();
  const hours = document.getElementById('owner-edit-hours').value.trim();
  const tags  = document.getElementById('owner-edit-tags').value.split(',').map(s => s.trim()).filter(Boolean);

  // Ids estables por campo — mismo criterio que usa pin-adjust.js:
  // un campo que ya tenía id lo conserva, uno nuevo recibe el
  // siguiente número libre (para no chocar con los que ya existían).
  let nextNum = _ownerFieldsState.reduce((max, f) => {
    const m = f.id && /^campo-(\d+)$/.exec(f.id);
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);
  const fields = _ownerFieldsState
    .filter(f => (f.title || '').trim() || (f.text || '').trim())
    .map(f => {
      if (f.id) return { id: f.id, title: (f.title || '').trim(), text: (f.text || '').trim() };
      nextNum += 1;
      return { id: `campo-${String(nextNum).padStart(2, '0')}`, title: (f.title || '').trim(), text: (f.text || '').trim() };
    });

  btn.textContent = 'Guardando...'; btn.disabled = true; errEl.textContent = '';
  try {
    // merge:true + solo esta ruta de "content" — no toca content.en/pt
    // del mismo pin (mismo patrón que saveFieldsPartialToFirestore en
    // firestore-sync.js, reimplementado acá para no depender de esa
    // función — esa está pensada para el flujo del admin).
    await db.collection('pines').doc(_ownerEditingId).set({
      desc, hist, phone, hours, tags,
      content: { es: { fields } },
    }, { merge: true });

    const idx = _ownerPins.findIndex(p => p.id === _ownerEditingId);
    if (idx !== -1) {
      const prevContent = _ownerPins[idx].content || {};
      _ownerPins[idx] = {
        ..._ownerPins[idx], desc, hist, phone, hours, tags,
        content: { ...prevContent, es: { ...(prevContent.es || {}), fields } },
      };
    }

    // Si el visitante ya tenía este pin cargado en memoria (POIS, de
    // config.js), se refleja también ahí y se sincroniza AppState —
    // así el panel público muestra el cambio sin necesitar F5. Si no
    // está en memoria en este momento no pasa nada: se va a leer bien
    // de Firestore en la próxima carga de la página.
    if (typeof POIS !== 'undefined') {
      const gi = POIS.findIndex(p => p.id === _ownerEditingId);
      if (gi !== -1) {
        const prevContent = POIS[gi].content || {};
        POIS[gi] = {
          ...POIS[gi], desc, hist, phone, hours, tags,
          content: { ...prevContent, es: { ...(prevContent.es || {}), fields } },
        };
        if (typeof syncAppStateWithPOIS === 'function') syncAppStateWithPOIS();
      }
    }

    toast('✅ Cambios guardados');
    _backToOwnerList();
  } catch (err) {
    console.warn('Error guardando edición de dueño:', err);
    errEl.textContent = '⚠️ No se pudo guardar. Probá de nuevo.';
  } finally {
    btn.textContent = 'Guardar cambios'; btn.disabled = false;
  }
}

window.OwnerPanel = {
  loadPins: _loadOwnerPins,
  backToList: _backToOwnerList,
  hasPins: () => _ownerPins.length > 0,
};

document.getElementById('owner-panel-back-btn').addEventListener('click', _backToOwnerList);
document.getElementById('owner-panel-save-btn').addEventListener('click', saveOwnerEdit);
document.getElementById('owner-edit-add-field-btn').addEventListener('click', _addOwnerField);
