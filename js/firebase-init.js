/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
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
