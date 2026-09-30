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

/**
 * [Etapa 8 — PLAN_USUARIOS_EVENTOS.md] SUBUSUARIO EMPLEADO
 * ---------------------------------------------------------------
 * El dueño de negocio da de alta DIRECTAMENTE una cuenta de empleado
 * (mail + contraseña que él mismo define y le pasa a mano — sin
 * invitación por mail) desde la solapa "Pines" del panel de usuario
 * unificado (Etapa 6). Esa cuenta queda con `rol: 'empleado'` y
 * `ownerId` apuntando al dueño, y puede administrar los MISMOS pines
 * que administra el dueño (mismo formulario/reglas que ya usa
 * OwnerPanel — ver js/owner-panel.js — solo que la regla de Firestore
 * de `pines` ahora también reconoce a un empleado activo del dueño).
 *
 * ⚠️ Alcance decidido para esta etapa (confirmar con Cris si hace
 * falta más adelante): el empleado SOLO puede editar pines, igual que
 * el dueño. No se le dio ningún permiso sobre eventos ni sobre nada
 * más — si Cris pide que también pueda gestionar eventos, se agrega
 * sin tocar el resto de este flujo.
 *
 * PROBLEMA TÉCNICO A RESOLVER: `firebase.auth().createUserWithEmail
 * AndPassword(...)` en el SDK de cliente deja automáticamente
 * logueado como el usuario RECIÉN CREADO — si lo hiciéramos con la
 * instancia normal de Firebase, el dueño de negocio se quedaría
 * deslogueado de su propia cuenta y logueado como su empleado nuevo.
 * Solución estándar: una SEGUNDA instancia de Firebase App (separada
 * de la que usa toda la app), se usa solo para este alta puntual, y
 * se cierra sesión ahí apenas termina — la sesión principal del dueño
 * nunca se toca.
 */

let _empleadosSecondaryApp = null;

function _getEmpleadosSecondaryApp() {
  if (_empleadosSecondaryApp) return _empleadosSecondaryApp;
  try {
    _empleadosSecondaryApp = firebase.initializeApp(firebaseConfig, 'empleados-secondary');
  } catch (err) {
    // Ya estaba inicializada (puede pasar con hot-reload en desarrollo) — se reusa.
    _empleadosSecondaryApp = firebase.app('empleados-secondary');
  }
  return _empleadosSecondaryApp;
}

/* ═══════════════════════════════════════════════════════════
   MOSTRAR/OCULTAR EL BLOQUE — solo dueño de negocio
   ═══════════════════════════════════════════════════════════ */
function _empleadosActivarBloque() {
  const esDueno = !!(window.UserAuth && UserAuth.hasRole('dueno_negocio'));
  const block = document.getElementById('empleados-block');
  if (!block) return;
  block.style.display = esDueno ? '' : 'none';
  if (esDueno) _loadEmpleados();
}
window.EmpleadosPanel = { activar: _empleadosActivarBloque };

/* ═══════════════════════════════════════════════════════════
   LISTAR EMPLEADOS DEL DUEÑO LOGUEADO
   ═══════════════════════════════════════════════════════════ */
async function _loadEmpleados() {
  const listEl = document.getElementById('empleados-list');
  const emptyEl = document.getElementById('empleados-empty');
  if (!listEl || !window.UserAuth || !UserAuth.isLoggedIn()) return;
  const ownerId = UserAuth.getCurrentUser().uid;
  const _t = (k) => (window.I18N ? I18N.t(k) : k);
  listEl.innerHTML = `<p class="owner-panel-loading">${_t('cargando')}</p>`;
  try {
    const snap = await db.collection('usuarios').where('ownerId', '==', ownerId).get();
    const empleados = [];
    snap.forEach(doc => empleados.push({ id: doc.id, ...doc.data() }));
    if (!empleados.length) {
      listEl.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';
    listEl.innerHTML = empleados.map(emp => {
      const activo = emp.activo !== false;
      return `
      <div class="owner-panel-item" style="cursor:default" data-uid="${_escAttr(emp.id)}" data-activo="${activo}">
        <div>
          <div class="owner-panel-item-name">${_escHtml(emp.nombre || emp.email || _t('emp_sin_nombre'))}</div>
          <div class="owner-panel-item-cat">${_escHtml(emp.email || '')} · ${activo ? _t('emp_estado_activo') : _t('emp_estado_desactivado')}</div>
        </div>
        <button type="button" class="geocoder-btn" data-action="toggle">${activo ? _t('emp_desactivar') : _t('emp_reactivar')}</button>
      </div>
    `;
    }).join('');
    listEl.querySelectorAll('[data-action="toggle"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const row = e.currentTarget.closest('[data-uid]');
        const actual = row.dataset.activo === 'true';
        _toggleEmpleadoActivo(row.dataset.uid, !actual);
      });
    });
  } catch (err) {
    console.warn('[Etapa 8] Error cargando empleados:', err);
    listEl.innerHTML = `<p class="owner-panel-loading">${_t('emp_list_error')}</p>`;
  }
}

async function _toggleEmpleadoActivo(uid, nuevoActivo) {
  try {
    await db.collection('usuarios').doc(uid).update({ activo: nuevoActivo });
    toast(nuevoActivo ? '✅ Empleado reactivado' : '✅ Empleado desactivado — ya no puede editar tus pines');
    _loadEmpleados();
  } catch (err) {
    console.warn('[Etapa 8] Error activando/desactivando empleado:', err);
    toast('⚠️ No se pudo guardar. Probá de nuevo.');
  }
}

/* ═══════════════════════════════════════════════════════════
   MOSTRAR/OCULTAR EL FORMULARIO DE ALTA
   ═══════════════════════════════════════════════════════════ */
document.getElementById('btn-mostrar-form-empleado')?.addEventListener('click', () => {
  document.getElementById('empleado-form').style.display = '';
  document.getElementById('btn-mostrar-form-empleado').style.display = 'none';
});
function _cerrarFormEmpleado() {
  document.getElementById('empleado-form').style.display = 'none';
  document.getElementById('btn-mostrar-form-empleado').style.display = '';
  ['empleado-nombre', 'empleado-email', 'empleado-pass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('empleado-form-error').textContent = '';
}
document.getElementById('btn-cancelar-empleado')?.addEventListener('click', _cerrarFormEmpleado);

/* ═══════════════════════════════════════════════════════════
   CREAR CUENTA DE EMPLEADO (instancia secundaria, ver nota de cabecera)
   ═══════════════════════════════════════════════════════════ */
async function _crearEmpleado() {
  if (!window.UserAuth || !UserAuth.hasRole('dueno_negocio')) return;
  const _t = (k) => (window.I18N ? I18N.t(k) : k);
  const nombre = document.getElementById('empleado-nombre')?.value.trim() || '';
  const email = document.getElementById('empleado-email')?.value.trim() || '';
  const pass = document.getElementById('empleado-pass')?.value || '';
  const errEl = document.getElementById('empleado-form-error');
  const btn = document.getElementById('btn-crear-empleado');
  if (errEl) errEl.textContent = '';

  if (!nombre || !email || !pass) { if (errEl) errEl.textContent = _t('ua_err_campos_todos'); return; }
  if (pass.length < 6) { if (errEl) errEl.textContent = _t('ua_err_pass_corta'); return; }

  const ownerId = UserAuth.getCurrentUser().uid;
  btn.textContent = _t('emp_creando'); btn.disabled = true;

  const secondaryApp = _getEmpleadosSecondaryApp();
  const secondaryAuth = secondaryApp.auth();
  try {
    const cred = await secondaryAuth.createUserWithEmailAndPassword(email, pass);
    // Mientras la sesión secundaria sigue siendo la del empleado recién
    // creado, escribe su propio perfil — coincide con la regla de
    // Firestore "solo puedo crear mi propio doc de usuarios" (misma
    // regla que ya usa el alta normal, sin necesidad de tocarla).
    await secondaryApp.firestore().collection('usuarios').doc(cred.user.uid).set({
      uid: cred.user.uid,
      email,
      nombre,
      rol: 'empleado',
      ownerId,
      activo: true,
      creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await secondaryAuth.signOut();
    toast(window.I18N ? I18N.tf('toast_empleado_creado', nombre) : `✅ Cuenta de empleado creada para ${nombre}`);
    _cerrarFormEmpleado();
    _loadEmpleados();
  } catch (err) {
    console.warn('[Etapa 8] Error creando empleado:', err.code || err);
    if (err.code === 'auth/email-already-in-use') {
      if (errEl) errEl.textContent = _t('ua_err_email_en_uso');
    } else if (err.code === 'auth/invalid-email') {
      if (errEl) errEl.textContent = _t('ua_err_email_invalido');
    } else if (err.code === 'auth/weak-password') {
      if (errEl) errEl.textContent = _t('ua_err_pass_debil');
    } else {
      if (errEl) errEl.textContent = _t('ua_err_register_generic');
    }
    // Por las dudas la sesión secundaria haya quedado logueada como
    // el intento fallido, se cierra igual (no afecta al dueño, que
    // sigue en la instancia PRINCIPAL de Firebase todo este tiempo).
    try { await secondaryAuth.signOut(); } catch (e2) { /* no-op */ }
  } finally {
    btn.textContent = _t('emp_create_btn'); btn.disabled = false;
  }
}
document.getElementById('btn-crear-empleado')?.addEventListener('click', _crearEmpleado);
