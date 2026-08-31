/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/**
 * [Etapa 1 — PLAN_USUARIOS_EVENTOS.md, 2026-08-19]
 * LOGIN/REGISTRO PÚBLICO — Firebase Authentication (usuarios finales)
 * ---------------------------------------------------------------
 * Es un sistema separado del login de administrador
 * (js/admin-auth.js): mismo Firebase Auth, pero para 2 tipos de
 * cuenta de la app PÚBLICA:
 *   - "usuario_comun"  → visitante registrado (sin permisos extra
 *                        todavía, se usa en etapas futuras)
 *   - "dueno_negocio"  → dueño de pin/negocio (base para el panel de
 *                        Etapa 2, donde va a poder editar sus pines)
 *
 * El rol elegido al registrarse se guarda en Firestore, colección
 * "usuarios", documento con id = uid de Firebase Auth:
 *   { uid, email, nombre, rol, creadoEn }
 *
 * Con Google Sign-In no hay forma de pedir el rol ANTES de crear la
 * cuenta (el popup de Google no tiene ese paso) — por eso, si es la
 * primera vez que ese uid inicia sesión, se le pide elegir el tipo de
 * cuenta DESPUÉS del popup, antes de terminar el login (ver
 * `_finishGoogleSignIn`/`_showGoogleRoleStep`).
 *
 * El admin (js/admin-auth.js) sigue siendo su propio nivel, separado
 * de estos roles — no se tocó ni se extendió ese archivo.
 *
 * Reglas de seguridad de Firestore para la colección "usuarios":
 * ver FIRESTORE_RULES_NOTES.md (no se pueden aplicar desde acá, hay
 * que pegarlas a mano en la consola de Firebase).
 */

let _currentUser = null;        // objeto de Firebase Auth (o null)
let _currentUserProfile = null; // doc de Firestore "usuarios/{uid}" (o null)
let _pendingGoogleUser = null;  // usuario de Google mientras se le pide el rol (cuenta nueva)

firebase.auth().onAuthStateChanged(async (user) => {
  _currentUser = user;
  if (!user) {
    _currentUserProfile = null;
    _renderUserAccountButton();
    return;
  }
  try {
    const snap = await db.collection('usuarios').doc(user.uid).get();
    _currentUserProfile = snap.exists ? snap.data() : null;
  } catch (err) {
    console.warn('No se pudo leer el perfil de usuario:', err);
    _currentUserProfile = null;
  }
  _renderUserAccountButton();
});

/* ── Botón del header: "Ingresar" (sin sesión) o nombre/rol (con sesión) ── */
function _renderUserAccountButton() {
  const btn = document.getElementById('btn-user-account');
  if (!btn) return;
  if (_currentUser && _currentUserProfile) {
    const label = _currentUserProfile.nombre || _currentUser.email || 'Cuenta';
    btn.classList.add('logged-in');
    btn.title = `${label} · ${_userRoleLabel(_currentUserProfile.rol)} (tocar para ver tu panel)`;
    btn.textContent = '👤';
  } else {
    btn.classList.remove('logged-in');
    btn.title = 'Ingresar / Registrarme';
    btn.textContent = '👤';
  }
}

function _userRoleLabel(rol) {
  if (rol === 'dueno_negocio') return 'Dueño de negocio';
  if (rol === 'usuario_comun') return 'Usuario';
  return rol || '—';
}

/* Click en el botón de cuenta del header: si hay sesión, abre el
   panel de usuario unificado (Etapa 6, js/user-panel.js: Info/Pines/
   Eventos); si no, el login. */
function onUserAccountButtonClick() {
  if (_currentUser) {
    if (window.UserPanel) {
      UserPanel.open();
    } else {
      console.error('[user-auth.js] UserPanel no está definido. ¿Se cargó js/user-panel.js? Revisá la pestaña Network (F12) buscando un 404, o Ctrl+Shift+R.');
      if (typeof toast === 'function') toast('⚠️ No se pudo abrir tu panel — recargá la página (Ctrl+Shift+R)');
    }
    return;
  }
  showUserAuth();
}

/* ── Overlay de login/registro (2 tabs) ── */
function showUserAuth() {
  document.getElementById('user-auth-overlay').classList.add('on');
  switchUserAuthTab('login');
  _clearUserAuthErrors();
}
function hideUserAuth() {
  document.getElementById('user-auth-overlay').classList.remove('on');
  _pendingGoogleUser = null;
  document.getElementById('user-auth-google-role-step').classList.remove('on');
}

function switchUserAuthTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('user-auth-tab-login').classList.toggle('active', isLogin);
  document.getElementById('user-auth-tab-register').classList.toggle('active', !isLogin);
  document.getElementById('user-auth-pane-login').classList.toggle('on', isLogin);
  document.getElementById('user-auth-pane-register').classList.toggle('on', !isLogin);
  _clearUserAuthErrors();
}

function _clearUserAuthErrors() {
  document.getElementById('user-auth-login-error').textContent = '';
  document.getElementById('user-auth-register-error').textContent = '';
}

/* ── Login con email/contraseña ── */
async function doUserLogin() {
  const email = document.getElementById('user-auth-login-email').value.trim();
  const pass  = document.getElementById('user-auth-login-pass').value;
  const errEl = document.getElementById('user-auth-login-error');
  const btn   = document.getElementById('user-auth-login-btn');
  if (!email || !pass) { errEl.textContent = '⚠️ Completá los dos campos'; return; }

  btn.textContent = 'Ingresando...'; btn.disabled = true;
  try {
    await firebase.auth().signInWithEmailAndPassword(email, pass);
    document.getElementById('user-auth-login-pass').value = '';
    hideUserAuth();
  } catch (err) {
    console.warn('Login de usuario — error:', err.code);
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

/* ── Registro con email/contraseña + rol elegido en el formulario ── */
async function doUserRegister() {
  const nombre = document.getElementById('user-auth-register-nombre').value.trim();
  const email  = document.getElementById('user-auth-register-email').value.trim();
  const pass   = document.getElementById('user-auth-register-pass').value;
  const rolEl  = document.querySelector('input[name="user-auth-rol"]:checked');
  const errEl  = document.getElementById('user-auth-register-error');
  const btn    = document.getElementById('user-auth-register-btn');

  if (!nombre || !email || !pass) { errEl.textContent = '⚠️ Completá todos los campos'; return; }
  if (pass.length < 6) { errEl.textContent = '⚠️ La contraseña necesita al menos 6 caracteres'; return; }
  if (!rolEl) { errEl.textContent = '⚠️ Elegí un tipo de cuenta'; return; }

  btn.textContent = 'Creando cuenta...'; btn.disabled = true;
  try {
    const cred = await firebase.auth().createUserWithEmailAndPassword(email, pass);
    await _createUserProfile(cred.user.uid, { email, nombre, rol: rolEl.value });
    hideUserAuth();
    toast(`✅ Cuenta creada — ¡bienvenido/a, ${nombre}!`);
  } catch (err) {
    console.warn('Registro de usuario — error:', err.code);
    if (err.code === 'auth/email-already-in-use') {
      errEl.textContent = '⚠️ Ese correo ya tiene una cuenta';
    } else if (err.code === 'auth/invalid-email') {
      errEl.textContent = '⚠️ Correo inválido';
    } else if (err.code === 'auth/weak-password') {
      errEl.textContent = '⚠️ Contraseña muy débil (mínimo 6 caracteres)';
    } else {
      errEl.textContent = '⚠️ No se pudo crear la cuenta. Revisá tu conexión.';
    }
  } finally {
    btn.textContent = 'Crear cuenta'; btn.disabled = false;
  }
}

/* ── Google Sign-In (sirve para login y para registro — es el mismo botón) ── */
async function doUserGoogleSignIn() {
  const errEl = document.getElementById('user-auth-login-error');
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await firebase.auth().signInWithPopup(provider);
    const snap = await db.collection('usuarios').doc(result.user.uid).get();
    if (snap.exists) {
      // Cuenta ya conocida: listo, onAuthStateChanged ya actualiza todo.
      hideUserAuth();
    } else {
      // Cuenta de Google nueva para esta app: falta elegir el rol.
      _pendingGoogleUser = result.user;
      _showGoogleRoleStep();
    }
  } catch (err) {
    console.warn('Google Sign-In — error:', err.code);
    if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
      errEl.textContent = '⚠️ No se pudo continuar con Google';
    }
  }
}

function _showGoogleRoleStep() {
  document.getElementById('user-auth-pane-login').classList.remove('on');
  document.getElementById('user-auth-pane-register').classList.remove('on');
  document.getElementById('user-auth-google-role-step').classList.add('on');
  const name = _pendingGoogleUser ? (_pendingGoogleUser.displayName || _pendingGoogleUser.email) : '';
  document.getElementById('user-auth-google-role-name').textContent = name;
}

async function confirmGoogleRole() {
  if (!_pendingGoogleUser) return;
  const rolEl = document.querySelector('input[name="user-auth-google-rol"]:checked');
  const errEl = document.getElementById('user-auth-google-role-error');
  if (!rolEl) { errEl.textContent = '⚠️ Elegí un tipo de cuenta'; return; }

  await _createUserProfile(_pendingGoogleUser.uid, {
    email: _pendingGoogleUser.email || '',
    nombre: _pendingGoogleUser.displayName || _pendingGoogleUser.email || '',
    rol: rolEl.value,
  });
  toast('✅ ¡Cuenta lista!');
  _pendingGoogleUser = null;
  document.getElementById('user-auth-google-role-step').classList.remove('on');
  hideUserAuth();
}

/* Cancelar el paso de "elegir rol" tras un Google Sign-In nuevo:
   la cuenta de Firebase Auth ya quedó creada por el popup, pero sin
   documento en "usuarios" (queda incompleta) — se cierra la sesión
   para no dejarla en un estado a medias sin rol asignado. */
async function cancelGoogleRoleStep() {
  _pendingGoogleUser = null;
  document.getElementById('user-auth-google-role-step').classList.remove('on');
  await firebase.auth().signOut();
  switchUserAuthTab('login');
}

async function _createUserProfile(uid, { email, nombre, rol }) {
  await db.collection('usuarios').doc(uid).set({
    uid,
    email,
    nombre,
    rol,
    creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
  });
  _currentUserProfile = { uid, email, nombre, rol };
  _renderUserAccountButton();
}

function doUserLogout() {
  firebase.auth().signOut();
  toast('🔓 Sesión cerrada');
}

/* Exponer lo que otras etapas (Etapa 2 en adelante) van a necesitar
   para saber quién está logueado y con qué rol, sin releer Firestore. */
window.UserAuth = {
  getCurrentUser: () => _currentUser,
  getCurrentUserProfile: () => _currentUserProfile,
  isLoggedIn: () => !!_currentUser,
  hasRole: (rol) => !!_currentUserProfile && _currentUserProfile.rol === rol,
  roleLabel: _userRoleLabel,
};

// [Hotfix 2026-08-27] Delegado desde `document` en vez de directo
// sobre el botón — más robusto ante cualquier caso en que el nodo se
// reconstruya en algún momento (con delegación no importa, sigue
// andando igual, porque escucha en el document, no en el botón).
document.addEventListener('click', (e) => {
  if (e.target && e.target.closest && e.target.closest('#btn-user-account')) {
    onUserAccountButtonClick();
  }
});

document.getElementById('user-account-logout-btn').addEventListener('click', () => {
  if (window.UserPanel) UserPanel.close();
  doUserLogout();
});
document.getElementById('user-auth-tab-login').addEventListener('click', () => switchUserAuthTab('login'));
document.getElementById('user-auth-tab-register').addEventListener('click', () => switchUserAuthTab('register'));
document.getElementById('user-auth-login-btn').addEventListener('click', doUserLogin);
document.getElementById('user-auth-register-btn').addEventListener('click', doUserRegister);
document.getElementById('user-auth-google-btn').addEventListener('click', doUserGoogleSignIn);
document.getElementById('user-auth-google-role-confirm-btn').addEventListener('click', confirmGoogleRole);
document.getElementById('user-auth-google-role-cancel-btn').addEventListener('click', cancelGoogleRoleStep);
document.getElementById('user-auth-close').addEventListener('click', hideUserAuth);
document.getElementById('user-auth-login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doUserLogin(); });
document.getElementById('user-auth-register-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doUserRegister(); });

/* Click afuera del cuadro cierra el overlay sin loguear (mismo patrón
   que #admin-login-overlay) */
// [NUEVO 2026-08-31] Guarda anti-selección-de-texto-arrastrada — ver
// js/ui-guards.js (Punto 1, PLAN_FIX_CIERRE_PANELES.md). Es el caso
// puntual que reportó Cris: pintar la contraseña y soltar afuera.
document.getElementById('user-auth-overlay').addEventListener('click', e => {
  if (window.UIGuards && window.UIGuards.wasTextDragRelease(e)) return;
  if (e.target.id === 'user-auth-overlay') hideUserAuth();
});
