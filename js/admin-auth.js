/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/* ═══════════════════════════════════════════
   LOGIN DE ADMINISTRADOR — Firebase Authentication
   ---------------------------------------------
   Reemplaza el acceso expuesto de antes (cualquiera podía tocar
   el engranaje y entrar). Ahora: sin sesión iniciada, tocar el
   engranaje muestra el login, no el panel. El panel solo abre si
   Firebase confirma que hay una sesión real activa.

   [2026-08-26 — FIX DE SEGURIDAD, encontrado por Cris probando con
   una cuenta de prueba de usuario común] El chequeo de arriba
   ("¿hay una sesión de Firebase Auth activa?") estaba MAL: la
   verificación real de quién es admin de verdad vive en la
   colección Firestore `admins/{uid}` (ver FIRESTORE_RULES_NOTES.md
   — así están protegidas las escrituras reales, esa parte SIEMPRE
   estuvo segura). El problema era solo la UI: `_adminUser` se
   completaba con CUALQUIER sesión de Firebase Auth, incluida la de
   un usuario común o dueño de negocio logueado con el login
   separado de js/user-auth.js (comparten el mismo
   firebase.auth()). Entonces cualquier cuenta logueada, sin ser
   admin de verdad, veía el botón del engranaje abrir el panel admin
   completo — sus escrituras reales hubieran sido rechazadas por las
   reglas, pero la UI no debería haberse abierto para empezar. Ahora
   `_adminUser` solo se completa si, además de haber sesión, esa
   cuenta existe en `admins/{uid}`.
   ═══════════════════════════════════════════ */

let _adminUser = null;    // solo si hay sesión Y esa cuenta es admin de verdad (admins/{uid})
let _isCheckingAdmin = false; // evita que el click del engranaje corra mientras el chequeo async todavía no terminó

firebase.auth().onAuthStateChanged(async user => {
  _adminUser = null;
  if (!user) return;
  _isCheckingAdmin = true;
  try {
    const doc = await db.collection('admins').doc(user.uid).get();
    _adminUser = doc.exists ? user : null;
    if (!doc.exists && document.getElementById('admin')?.classList.contains('open')) {
      // Sesión de una cuenta no-admin que de alguna forma tenía el
      // panel abierto (ej. quedó abierto de una sesión admin previa
      // en el mismo navegador) — se cierra ya mismo, por las dudas.
      closeAdmin();
    }
  } catch (err) {
    console.warn('[admin-auth] No se pudo verificar admins/{uid}:', err);
    _adminUser = null;
  } finally {
    _isCheckingAdmin = false;
  }
});

function showAdminLogin() {
  document.getElementById('admin-login-overlay').classList.add('on');
  document.getElementById('admin-login-error').textContent = '';
  document.getElementById('admin-login-email').focus();
}
function hideAdminLogin() {
  document.getElementById('admin-login-overlay').classList.remove('on');
}

async function doAdminLogin() {
  const email = document.getElementById('admin-login-email').value.trim();
  const pass  = document.getElementById('admin-login-pass').value;
  const errEl = document.getElementById('admin-login-error');
  const btn   = document.getElementById('admin-login-btn');
  if (!email || !pass) { errEl.textContent = '⚠️ Completá los dos campos'; return; }

  btn.textContent = 'Ingresando...'; btn.disabled = true;
  try {
    const cred = await firebase.auth().signInWithEmailAndPassword(email, pass);
    // [2026-08-26] No alcanza con que el login/contraseña sean
    // correctos: hay que confirmar que ESA cuenta está en
    // `admins/{uid}` antes de abrir el panel — ver nota de arriba.
    const doc = await db.collection('admins').doc(cred.user.uid).get();
    if (!doc.exists) {
      await firebase.auth().signOut();
      errEl.textContent = '⚠️ Esta cuenta no tiene permisos de administrador.';
      return;
    }
    _adminUser = cred.user;
    hideAdminLogin();
    document.getElementById('admin-login-pass').value = '';
    openAdmin();
  } catch (err) {
    console.warn('Login error:', err.code);
    if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
      errEl.textContent = '⚠️ Correo o contraseña incorrectos';
    } else if (err.code === 'auth/too-many-requests') {
      errEl.textContent = '⚠️ Demasiados intentos. Probá de nuevo en unos minutos.';
    } else {
      errEl.textContent = '⚠️ No se pudo iniciar sesión. Revisá tu conexión.';
    }
  } finally {
    btn.textContent = 'Ingresar'; btn.disabled = false;
  }
}

function doAdminLogout() {
  firebase.auth().signOut();
  closeAdmin();
  toast('🔓 Sesión cerrada');
}

document.getElementById('admin-login-btn').addEventListener('click', doAdminLogin);
document.getElementById('admin-login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doAdminLogin(); });
document.getElementById('admin-logout').addEventListener('click', doAdminLogout);

/* Click afuera del cuadro de login lo cierra sin loguear (no cierra
   la app, solo cancela el intento de acceso) */
// [NUEVO 2026-08-31] Guarda anti-selección-de-texto-arrastrada — ver
// js/ui-guards.js (Punto 1, PLAN_FIX_CIERRE_PANELES.md).
document.getElementById('admin-login-overlay').addEventListener('click', e => {
  if (window.UIGuards && window.UIGuards.wasTextDragRelease(e)) return;
  if (e.target.id === 'admin-login-overlay') hideAdminLogin();
});
