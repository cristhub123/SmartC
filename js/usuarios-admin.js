/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/**
 * [Etapa 7 — PLAN_USUARIOS_EVENTOS.md] CAMPOS PREPARADOS PARA PAGOS
 * (sin cobro automático todavía)
 * ---------------------------------------------------------------
 * Todo lo de acá se prende/apaga A MANO desde este tab admin —
 * simula lo que a futuro haría un webhook de pago real (Checkout Pro
 * / Preapproval de Mercado Pago). La integración de cobro real queda
 * explícitamente fuera de esta etapa.
 *
 * Modelo de datos nuevo:
 *   - `settings/premium-config` → { funciones: [{clave, etiqueta}] }
 *     catálogo de funciones candidatas a premium, configurable sin
 *     tocar código — no hacen nada por sí solas todavía.
 *   - `usuarios/{uid}.plan` → 'free' | 'premium'. NO bloquea la
 *     cuenta, solo habilita funciones extra (aclaración de Cris, ver
 *     PLAN_USUARIOS_EVENTOS.md).
 *   - `usuarios/{uid}.premiumEnabled` → { [clave]: true/false } — qué
 *     funciones del catálogo están prendidas para ESA cuenta puntual.
 *   - `eventos/{id}.destacado` / `.destacado_hasta` → por evento, no
 *     por cuenta (una misma cuenta puede tener varios eventos
 *     destacados a la vez) — campos agregados directamente al form de
 *     eventos existente, ver js/eventos.js.
 *
 * Reusa `_resolveOwnerEmailToUid` (js/pin-adjust.js) para la búsqueda
 * de cuenta por mail — mismo patrón que ya usa la asignación de
 * eventos y de pines.
 */

let _premiumFuncionesState = []; // [{clave, etiqueta}]
let _cuentaPlanUid = null;

/* ═══════════════════════════════════════════════════════════
   CATÁLOGO DE FUNCIONES PREMIUM (settings/premium-config)
   ═══════════════════════════════════════════════════════════ */
async function _loadPremiumConfig() {
  try {
    const doc = await db.collection('settings').doc('premium-config').get();
    _premiumFuncionesState = (doc.exists && Array.isArray(doc.data().funciones)) ? doc.data().funciones : [];
  } catch (err) {
    console.warn('[Etapa 7] No se pudo cargar el catálogo de funciones premium:', err);
    _premiumFuncionesState = [];
  }
  _paintPremiumFuncionesRows();
}

function _paintPremiumFuncionesRows() {
  const wrap = document.getElementById('premium-funciones-wrap');
  if (!wrap) return;
  wrap.innerHTML = _premiumFuncionesState.map((f, i) => `
    <div class="owner-field-row" data-idx="${i}">
      <input class="owner-field-title" data-k="clave" placeholder="Clave interna (ej: sin_publicidad)" value="${_escAttr(f.clave || '')}">
      <input class="owner-field-title" data-k="etiqueta" placeholder="Nombre visible (ej: Sin publicidad)" value="${_escAttr(f.etiqueta || '')}">
      <button type="button" class="owner-field-remove" data-action="remove">✕ Quitar</button>
    </div>
  `).join('');
  wrap.querySelectorAll('.owner-field-row').forEach(row => {
    const idx = parseInt(row.dataset.idx, 10);
    row.querySelectorAll('[data-k]').forEach(input => {
      input.addEventListener('input', () => { _premiumFuncionesState[idx][input.dataset.k] = input.value; });
    });
    row.querySelector('[data-action="remove"]').addEventListener('click', () => {
      _premiumFuncionesState.splice(idx, 1);
      _paintPremiumFuncionesRows();
    });
  });
}

document.getElementById('premium-add-funcion-btn')?.addEventListener('click', () => {
  _premiumFuncionesState.push({ clave: '', etiqueta: '' });
  _paintPremiumFuncionesRows();
});

async function _savePremiumConfig() {
  const limpio = _premiumFuncionesState
    .map(f => ({ clave: (f.clave || '').trim(), etiqueta: (f.etiqueta || '').trim() }))
    .filter(f => f.clave && f.etiqueta);
  try {
    await db.collection('settings').doc('premium-config').set({ funciones: limpio }, { merge: true });
    _premiumFuncionesState = limpio;
    _paintPremiumFuncionesRows();
    toast('✅ Catálogo de funciones premium guardado');
    if (_cuentaPlanUid) _paintCuentaPremiumChecks(); // por si había una cuenta abierta
  } catch (err) {
    console.warn('[Etapa 7] Error guardando catálogo premium:', err);
    toast('⚠️ No se pudo guardar. Probá de nuevo.');
  }
}
document.getElementById('btn-save-premium-config')?.addEventListener('click', _savePremiumConfig);

/* ═══════════════════════════════════════════════════════════
   PLAN Y FUNCIONES PREMIUM DE UNA CUENTA PUNTUAL
   ═══════════════════════════════════════════════════════════ */
async function _cuentaBuscarPorMail() {
  const emailInput = document.getElementById('cuenta-buscar-email');
  const resultEl = document.getElementById('cuenta-buscar-resultado');
  const email = (emailInput?.value || '').trim();
  if (!email) { toast('⚠️ Escribí un mail para buscar'); return; }
  if (resultEl) resultEl.innerHTML = 'Buscando...';
  document.getElementById('cuenta-plan-form').style.display = 'none';
  try {
    const uid = (typeof _resolveOwnerEmailToUid === 'function') ? await _resolveOwnerEmailToUid(email) : null;
    if (!uid) {
      if (resultEl) resultEl.innerHTML = `⚠️ No hay ninguna cuenta registrada con el mail "${_escHtml(email)}"`;
      return;
    }
    const doc = await db.collection('usuarios').doc(uid).get();
    const data = doc.exists ? doc.data() : {};
    _cuentaPlanUid = uid;
    if (resultEl) resultEl.innerHTML = `✓ Cuenta encontrada (rol: ${_escHtml(data.rol || 'sin rol')})`;
    document.getElementById('cuenta-plan-titulo').textContent = data.nombre || email;
    document.getElementById('cuenta-plan-premium').checked = data.plan === 'premium';
    _paintCuentaPremiumChecks(data.premiumEnabled || {});
    document.getElementById('cuenta-plan-error').textContent = '';
    document.getElementById('cuenta-plan-form').style.display = '';
  } catch (err) {
    console.warn('[Etapa 7] Error buscando cuenta por mail:', err);
    if (resultEl) resultEl.innerHTML = '⚠️ No se pudo buscar. Probá de nuevo.';
  }
}
document.getElementById('cuenta-buscar-btn')?.addEventListener('click', _cuentaBuscarPorMail);

function _paintCuentaPremiumChecks(premiumEnabled) {
  const wrap = document.getElementById('cuenta-premium-funciones-check');
  if (!wrap) return;
  premiumEnabled = premiumEnabled || {};
  if (!_premiumFuncionesState.length) {
    wrap.innerHTML = '<p style="font-size:11px;color:var(--text3)">No hay ninguna función premium cargada en el catálogo todavía.</p>';
    return;
  }
  wrap.innerHTML = _premiumFuncionesState.map(f => `
    <div class="fg" style="display:flex;align-items:center;gap:8px">
      <input type="checkbox" class="cuenta-premium-check" data-clave="${_escAttr(f.clave)}" ${premiumEnabled[f.clave] ? 'checked' : ''} style="width:auto">
      <label class="fl" style="margin:0">${_escHtml(f.etiqueta)}</label>
    </div>
  `).join('');
}

async function _saveCuentaPlan() {
  if (!_cuentaPlanUid) return;
  const errEl = document.getElementById('cuenta-plan-error');
  const btn = document.getElementById('btn-save-cuenta-plan');
  if (errEl) errEl.textContent = '';
  const plan = document.getElementById('cuenta-plan-premium').checked ? 'premium' : 'free';
  const premiumEnabled = {};
  document.querySelectorAll('.cuenta-premium-check').forEach(chk => {
    if (chk.dataset.clave) premiumEnabled[chk.dataset.clave] = chk.checked;
  });
  btn.textContent = 'Guardando...'; btn.disabled = true;
  try {
    await db.collection('usuarios').doc(_cuentaPlanUid).update({ plan, premiumEnabled });
    toast('✅ Cuenta actualizada');
  } catch (err) {
    console.warn('[Etapa 7] Error guardando plan de cuenta:', err);
    if (errEl) errEl.textContent = '⚠️ No se pudo guardar. Probá de nuevo.';
  } finally {
    btn.textContent = 'Guardar cuenta'; btn.disabled = false;
  }
}
document.getElementById('btn-save-cuenta-plan')?.addEventListener('click', _saveCuentaPlan);

window.PremiumConfig = {
  getFunciones: () => _premiumFuncionesState,
};

// Carga el catálogo apenas arranca la app (lectura pública de
// settings/{docId}, no requiere estar logueado) — mismo criterio que
// loadEventosConfig() en js/eventos.js.
_loadPremiumConfig();
