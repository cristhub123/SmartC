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
   FIREBASE INIT — conexión real al proyecto "SmartCity"
   ---------------------------------------------
   Usa el SDK "compat" (no ES modules) para que funcione igual
   que el resto del proyecto (scripts sueltos, sin build step).
   Expone window.db (Firestore) para que el resto del código lo use.
═══════════════════════════════════════════ */
const firebaseConfig = {
  apiKey: "AIzaSyA6x1yQMxO1R0WuKXLQMxwgmgw_tePZTRs",
  authDomain: "smartcity-3368a.firebaseapp.com",
  projectId: "smartcity-3368a",
  storageBucket: "smartcity-3368a.firebasestorage.app",
  messagingSenderId: "521222453315",
  appId: "1:521222453315:web:c7c2352179676d86b4bcf6",
  measurementId: "G-F8VEQRX4R7"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
