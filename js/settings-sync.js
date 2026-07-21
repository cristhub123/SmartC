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
