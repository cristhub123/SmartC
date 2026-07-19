/* ═══════════════════════════════════════════
   FIRESTORE SYNC — capa de conexión entre POIS (memoria) y la
   base de datos real. Cada lugar se guarda como un documento en
   la colección "pines", usando el SLUG como ID del documento
   (mismo identificador que ya usamos para nombrar las imágenes
   en Cloudinary — todo conectado por el mismo dato).
   ---------------------------------------------------------------
   CACHÉ PÚBLICO (clave para no gastar cuota de lecturas):
   Además de los documentos individuales en "pines" (que son la
   fuente real para el admin), se mantiene UN SOLO documento
   ("cache/all-pines") con la lista completa. Cargar la app así
   cuesta 1 lectura, no 300 — sin esto, 1.000 visitantes en una
   noche podrían agotar el límite gratis diario de Firestore.
═══════════════════════════════════════════ */

/* === CARGAR TODOS LOS LUGARES AL ABRIR LA APP — 1 sola lectura === */
async function loadPOISFromFirestore() {
  try {
    const cacheDoc = await db.collection('cache').doc('all-pines').get();
    if (cacheDoc.exists && Array.isArray(cacheDoc.data().pois)) {
      POIS = cacheDoc.data().pois;
      return true;
    }
    // Primera vez que se usa la app (el caché todavía no existe):
    // se lee la colección completa UNA vez, y de paso se genera
    // el caché para que las próximas cargas ya sean baratas.
    const snapshot = await db.collection('pines').get();
    const loaded = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.name) return; // salta documentos de prueba con otro esquema
      loaded.push({ id: doc.id, ...data });
    });
    POIS = loaded;
    await regeneratePublicCache();
    return true;
  } catch (err) {
    console.error('Error cargando lugares desde Firestore:', err);
    toast('⚠️ No se pudieron cargar los lugares. Revisá tu conexión.');
    return false;
  }
}

/* === REGENERAR EL CACHÉ PÚBLICO — se llama sola después de cada
   guardado/borrado, usando el POIS de memoria (ya actualizado) === */
async function regeneratePublicCache() {
  try {
    await db.collection('cache').doc('all-pines').set({
      pois: POIS,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error('Error regenerando el caché público:', err);
    // No se avisa al usuario con un toast acá — el guardado individual
    // (en "pines") ya funcionó, esto es una optimización, no algo crítico.
    return false;
  }
}

/* === CONTEO DE CLICKS POR PIN — permanente, no se resetea nunca ===
   Se incrementa directo en el documento individual (no regenera el
   caché público en cada click — con muchos visitantes, regenerar
   el caché por cada click gastaría cuota de escritura innecesaria).
   El conteo se actualiza en pantalla al admin recién en la próxima
   carga/lectura, no en vivo — es un dato acumulado, no un dashboard
   en tiempo real. */
function incrementPinClicks(id) {
  db.collection('pines').doc(id).update({
    clicks: firebase.firestore.FieldValue.increment(1),
  }).catch(err => console.warn('No se pudo registrar el click (no crítico):', err));
}


async function savePoiToFirestore(poi) {
  try {
    const { id, ...data } = poi; // el id va aparte, no adentro del documento
    await db.collection('pines').doc(id).set(data, { merge: false });
    regeneratePublicCache(); // mantiene el caché público al día (no se espera, no bloquea la UI)
    return true;
  } catch (err) {
    console.error('Error guardando en Firestore:', err);
    toast('⚠️ No se guardó en la base de datos. Probá de nuevo (¿iniciaste sesión?).');
    return false;
  }
}

/* === BORRAR UN LUGAR DE FIRESTORE === */
async function deletePoiFromFirestore(id) {
  try {
    await db.collection('pines').doc(id).delete();
    regeneratePublicCache(); // mantiene el caché público al día
    return true;
  } catch (err) {
    console.error('Error borrando de Firestore:', err);
    toast('⚠️ No se pudo borrar en la base de datos.');
    return false;
  }
}
