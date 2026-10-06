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

   [2026-10-06 — SIN LOGIN PROPIO DE ADMIN, pedido de Cris] Se eliminó
   el cuadro "Acceso de administrador" (#admin-login-overlay). El admin
   inicia sesión por el 👤 (js/user-auth.js) como cualquier cuenta.
   Este archivo solo escucha la sesión: si la cuenta está en
   `admins/{uid}`, completa `_adminUser` y MUESTRA la tuerca
   (#btn-admin, oculta por defecto con el atributo `hidden`); si no hay
   sesión o la cuenta no es admin, la oculta y cierra el panel admin si
   estaba abierto. Las reglas de Firestore siguen siendo la protección
   real de las escrituras — esto es solo la interfaz.
   ═══════════════════════════════════════════ */

let _adminUser = null;    // solo si hay sesión Y esa cuenta es admin de verdad (admins/{uid})
let _isCheckingAdmin = false; // evita que el click del engranaje corra mientras el chequeo async todavía no terminó

/* [2026-10-06] Única fuente de verdad de si la tuerca se ve o no. */
function _syncAdminGear() {
  const btn = document.getElementById('btn-admin');
  if (btn) btn.hidden = !_adminUser;
  if (!_adminUser && document.getElementById('admin')?.classList.contains('open')) {
    closeAdmin();
  }
  // El botón 👤 muestra "Administrador" como rol si la cuenta es admin
  // y no tiene documento en `usuarios` (ver _userRoleLabel, user-auth.js).
  if (typeof _renderUserAccountButton === 'function') _renderUserAccountButton();
}

firebase.auth().onAuthStateChanged(async user => {
  _adminUser = null;
  if (!user) { _syncAdminGear(); return; }
  _isCheckingAdmin = true;
  try {
    const doc = await db.collection('admins').doc(user.uid).get();
    _adminUser = doc.exists ? user : null;
  } catch (err) {
    console.warn('[admin-auth] No se pudo verificar admins/{uid}:', err);
    _adminUser = null;
  } finally {
    _isCheckingAdmin = false;
    _syncAdminGear();
  }
});

/* Botón "🔓 Salir" del panel admin — cierra la sesión entera (es la
   misma sesión del 👤). onAuthStateChanged oculta la tuerca solo. */
function doAdminLogout() {
  firebase.auth().signOut();
  closeAdmin();
  toast('🔓 Sesión cerrada');
}

document.getElementById('admin-logout').addEventListener('click', doAdminLogout);
