/* ═══════════════════════════════════════════
   LOGIN DE ADMINISTRADOR — Firebase Authentication
   ---------------------------------------------
   Reemplaza el acceso expuesto de antes (cualquiera podía tocar
   el engranaje y entrar). Ahora: sin sesión iniciada, tocar el
   engranaje muestra el login, no el panel. El panel solo abre si
   Firebase confirma que hay una sesión real activa.
   ═══════════════════════════════════════════ */

let _adminUser = null; // se completa solo cuando Firebase confirma sesión

firebase.auth().onAuthStateChanged(user => {
  _adminUser = user;
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
    await firebase.auth().signInWithEmailAndPassword(email, pass);
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
document.getElementById('admin-login-overlay').addEventListener('click', e => {
  if (e.target.id === 'admin-login-overlay') hideAdminLogin();
});
