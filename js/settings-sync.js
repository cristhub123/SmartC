/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/* ═══════════════════════════════════════════
   SETTINGS SYNC — persistencia real de "Apariencia global" (tamaños,
   colores, glow) y "Estilo del mapa" (tile, opacidad, tinte).
   ---------------------------------------------
   Antes, estas configuraciones vivían SOLO en la memoria del
   navegador (globalSettings / _mapaSettings) — se perdían al
   recargar la página, igual que pasaba con los lugares antes del
   Paso 3. Ahora se guardan en Firestore (colección "settings") y
   se le aplican a CUALQUIER persona que abra la app, no solo a vos.
═══════════════════════════════════════════ */

async function saveGlobalSettings() {
  try {
    await db.collection('settings').doc('appearance').set(globalSettings);
    return true;
  } catch (err) {
    console.error('No se pudo guardar la apariencia global:', err);
    toast('⚠️ No se guardó la apariencia. ¿Iniciaste sesión?');
    return false;
  }
}

async function loadGlobalSettings() {
  try {
    const doc = await db.collection('settings').doc('appearance').get();
    if (doc.exists) Object.assign(globalSettings, doc.data());
  } catch (err) {
    console.warn('No se pudo cargar la apariencia global guardada (se usan valores por defecto):', err);
  }
}

async function saveMapSettings() {
  try {
    await db.collection('settings').doc('mapstyle').set(_mapaSettings);
    return true;
  } catch (err) {
    console.error('No se pudo guardar el estilo del mapa:', err);
    toast('⚠️ No se guardó el estilo del mapa. ¿Iniciaste sesión?');
    return false;
  }
}

async function loadMapSettings() {
  try {
    const doc = await db.collection('settings').doc('mapstyle').get();
    if (doc.exists) Object.assign(_mapaSettings, doc.data());
  } catch (err) {
    console.warn('No se pudo cargar el estilo del mapa guardado (se usan valores por defecto):', err);
  }
}

/* === TIPOGRAFÍA — lista de fuentes extra de Google Fonts que el
   admin fue agregando (hasta 8), para que se carguen automáticamente
   en cada visita, a todos los usuarios, sin depender de que alguien
   vuelva a tocar el panel. Mismo esquema que appearance/mapstyle:
   un solo documento con el dato completo. === */
async function saveTypographyFonts(fontsArray) {
  try {
    await db.collection('settings').doc('typography-fonts').set({ fonts: fontsArray });
    return true;
  } catch (err) {
    console.error('No se pudo guardar la lista de fuentes:', err);
    toast('⚠️ No se guardó la lista de fuentes. ¿Iniciaste sesión?');
    return false;
  }
}

async function loadTypographyFonts() {
  try {
    const doc = await db.collection('settings').doc('typography-fonts').get();
    return (doc.exists && Array.isArray(doc.data().fonts)) ? doc.data().fonts : [];
  } catch (err) {
    console.warn('No se pudo cargar la lista de fuentes guardada:', err);
    return [];
  }
}

/* === UBICACIONES (Entrega 1) ===
   "Contexto activo": qué país/provincia/ciudad/subcarpeta quedaron
   seleccionados en la pestaña Ubicaciones — se guarda para que
   sobreviva un F5 y para que la Entrega 2 (creación masiva de pines)
   sepa en qué carpeta de Cloudinary buscar sin tener que volver a
   elegirlo cada vez. Mismo esquema de un solo documento que
   appearance/mapstyle/typography-fonts. */
async function saveActiveLocationContext(context) {
  try {
    await db.collection('settings').doc('active-location').set(context);
    return true;
  } catch (err) {
    console.error('No se pudo guardar el contexto de ubicación activo:', err);
    toast('⚠️ No se guardó la ubicación activa. ¿Iniciaste sesión?');
    return false;
  }
}

async function loadActiveLocationContext() {
  try {
    const doc = await db.collection('settings').doc('active-location').get();
    return doc.exists ? doc.data() : null;
  } catch (err) {
    console.warn('No se pudo cargar el contexto de ubicación activo guardado:', err);
    return null;
  }
}

/* Tipos de subcarpeta dentro de cada ciudad (hoy "images", mañana
   "sounds" y lo que haga falta) — lista simple, mismo patrón que las
   fuentes extra de tipografía. */
async function saveSubfolderTypes(typesArray) {
  try {
    await db.collection('settings').doc('subfolder-types').set({ types: typesArray });
    return true;
  } catch (err) {
    console.error('No se pudo guardar la lista de tipos de subcarpeta:', err);
    toast('⚠️ No se guardaron los tipos de subcarpeta. ¿Iniciaste sesión?');
    return false;
  }
}

async function loadSubfolderTypes() {
  try {
    const doc = await db.collection('settings').doc('subfolder-types').get();
    return (doc.exists && Array.isArray(doc.data().types) && doc.data().types.length)
      ? doc.data().types
      : ['images'];
  } catch (err) {
    console.warn('No se pudo cargar la lista de tipos de subcarpeta guardada (se usa "images" por defecto):', err);
    return ['images'];
  }
}

/* === SISTEMA DE SKINS (PLAN_SISTEMA_SKINS.md) ===
   Qué skin (id) eligió el admin como skin activo — mismo esquema de
   un solo documento que appearance/mapstyle/typography-fonts. La
   preferencia del USUARIO logueado (prioridad más alta, a futuro) va
   a vivir aparte, no acá — este documento es solo "lo que decide el
   admin para todos los visitantes sin cuenta". */
async function saveActiveSkin(skinId) {
  try {
    await db.collection('settings').doc('skin').set({ id: skinId });
    return true;
  } catch (err) {
    console.error('No se pudo guardar el skin activo:', err);
    toast('⚠️ No se guardó el skin. ¿Iniciaste sesión?');
    return false;
  }
}

async function loadActiveSkin() {
  try {
    const doc = await db.collection('settings').doc('skin').get();
    return (doc.exists && doc.data().id) ? doc.data().id : null;
  } catch (err) {
    console.warn('No se pudo cargar el skin activo guardado (se usa el skin default):', err);
    return null;
  }
}

