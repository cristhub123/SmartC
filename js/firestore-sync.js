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

/* ═══════════════════════════════════════════
   ZONAS — mismo patrón exacto que arriba (colección "zonas" +
   caché público "cache/all-zonas"), para que las zonas queden
   guardadas de forma permanente en vez de vivir solo en memoria.
   El ID del documento es `z.id` (el slug de la zona, ej. "guemes").
═══════════════════════════════════════════ */

/* === CARGAR TODAS LAS ZONAS AL ABRIR EL ADMIN — 1 sola lectura === */
async function loadZonasFromFirestore() {
  try {
    const cacheDoc = await db.collection('cache').doc('all-zonas').get();
    if (cacheDoc.exists && Array.isArray(cacheDoc.data().zonas)) {
      return cacheDoc.data().zonas;
    }
    // Primera vez (el caché todavía no existe): se lee la colección
    // completa una vez y se genera el caché para la próxima carga.
    const snapshot = await db.collection('zonas').get();
    const loaded = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.name) return; // salta documentos de prueba con otro esquema
      loaded.push({ id: doc.id, ...data });
    });
    await db.collection('cache').doc('all-zonas').set({
      zonas: loaded,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return loaded;
  } catch (err) {
    console.error('Error cargando zonas desde Firestore:', err);
    toast('⚠️ No se pudieron cargar las zonas. Revisá tu conexión.');
    return [];
  }
}

/* === REGENERAR EL CACHÉ PÚBLICO DE ZONAS === */
async function regenerateZonasPublicCache() {
  try {
    await db.collection('cache').doc('all-zonas').set({
      zonas: ZONAS,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error('Error regenerando el caché público de zonas:', err);
    return false;
  }
}

/* === GUARDAR (crear o editar) UNA ZONA === */
async function saveZonaToFirestore(zona) {
  try {
    const { id, ...data } = zona;
    await db.collection('zonas').doc(id).set(data, { merge: false });
    regenerateZonasPublicCache(); // no se espera, no bloquea la UI
    return true;
  } catch (err) {
    console.error('Error guardando zona en Firestore:', err);
    toast('⚠️ No se guardó la zona en la base de datos. Probá de nuevo (¿iniciaste sesión?).');
    return false;
  }
}

/* === BORRAR UNA ZONA DE FIRESTORE (por si algún día hace falta —
   la vía normal para "no quiero esta zona" es el toggle on/off,
   que no borra nada) === */
async function deleteZonaFromFirestore(id) {
  try {
    await db.collection('zonas').doc(id).delete();
    regenerateZonasPublicCache();
    return true;
  } catch (err) {
    console.error('Error borrando zona de Firestore:', err);
    toast('⚠️ No se pudo borrar la zona.');
    return false;
  }
}

/* === CONTEO DE CLICKS POR ZONA — permanente, no se resetea nunca === */
function incrementZonaClicks(id) {
  db.collection('zonas').doc(id).update({
    clicks: firebase.firestore.FieldValue.increment(1),
  }).catch(err => console.warn('No se pudo registrar el click de zona (no crítico):', err));
}

/* ═══════════════════════════════════════════
   ORDEN DE ZONAS — el campo numérico `order` en cada documento de
   "zonas" define en qué posición aparece en el dropdown del usuario.
   Se guarda con un solo batch write (una sola operación atómica,
   no N escrituras sueltas) cada vez que el admin reordena (botón
   A-Z, arrastre manual, o cargar un preset).
═══════════════════════════════════════════ */

/**
 * Guarda el `order` (0,1,2...) de cada zona según su posición actual
 * en el arreglo que se le pasa — típicamente el `ZONAS` en memoria,
 * ya reordenado. Un solo batch, no N escrituras sueltas.
 * @param {Array<Object>} zonasArray - ZONAS ya en el orden deseado.
 */
async function saveZonasOrder(zonasArray) {
  try {
    const batch = db.batch();
    zonasArray.forEach((z, i) => {
      // CLAVE: actualizar z.order EN MEMORIA acá también, no solo en
      // Firestore. Antes esto faltaba — el documento de Firestore
      // quedaba bien, pero el objeto `z` en memoria seguía con su
      // `order` viejo. Como `regenerateZonasPublicCache()` guarda el
      // caché público a partir de estos mismos objetos en memoria,
      // el caché terminaba con `order` desactualizado — y la próxima
      // vez que alguien cargaba la página, el `ZONAS.sort(...)` de
      // _initZonas() volvía a barajar todo usando esos valores viejos,
      // deshaciendo el orden recién guardado. Por eso "parecía" que
      // el reordenamiento nunca quedaba guardado.
      z.order = i;
      // set(..., {merge:true}) en vez de update(): update() falla si el
      // documento no existe todavía, y como el batch es atómico, UN
      // SOLO documento faltante hacía fallar el guardado de TODAS las
      // zonas sin avisar bien la causa — parecía que "no guardaba
      // nada" cuando en realidad era un solo doc corrupto/inexistente
      // el que tiraba abajo todo el lote. set con merge crea el campo
      // si falta, y nunca falla por esto.
      batch.set(db.collection('zonas').doc(z.id), { order: i }, { merge: true });
    });
    await batch.commit();
    regenerateZonasPublicCache(); // el caché público también debe reflejar el nuevo orden
    return true;
  } catch (err) {
    console.error('Error guardando el orden de zonas:', err);
    toast('⚠️ No se pudo guardar el nuevo orden.');
    return false;
  }
}

/* ═══════════════════════════════════════════
   PRESETS DE ORDEN — "fotos" del orden actual, guardadas con un
   nombre (ej. "Orden Principal", "Verano 2026"), para poder volver
   a cualquiera de ellas con un clic sin tener que reordenar todo de
   nuevo a mano. Colección aparte ("zona-presets"), no mezclada con
   los documentos de zonas en sí.
═══════════════════════════════════════════ */

/**
 * Guarda el orden actual como un preset con nombre. Si ya existe un
 * preset con ese nombre, lo sobreescribe (mismo criterio que "Guardar
 * cambios" en todo el resto del admin: el nombre es el identificador).
 * @param {string} name
 * @param {Array<Object>} zonasArray - ZONAS en el orden a guardar.
 */
async function saveZonaOrderPreset(name, zonasArray) {
  try {
    const id = slugify(name);
    await db.collection('zona-presets').doc(id).set({
      name,
      orderIds: zonasArray.map(z => z.id),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  } catch (err) {
    console.error('Error guardando preset de orden:', err);
    toast('⚠️ No se pudo guardar el preset.');
    return false;
  }
}

/** Trae todos los presets de orden guardados (para el selector del admin). */
async function loadZonaOrderPresets() {
  try {
    const snapshot = await db.collection('zona-presets').get();
    const presets = [];
    snapshot.forEach(doc => presets.push({ id: doc.id, ...doc.data() }));
    return presets;
  } catch (err) {
    console.error('Error cargando presets de orden:', err);
    return [];
  }
}

/** Borra un preset de orden guardado. */
async function deleteZonaOrderPreset(id) {
  try {
    await db.collection('zona-presets').doc(id).delete();
    return true;
  } catch (err) {
    console.error('Error borrando preset de orden:', err);
    toast('⚠️ No se pudo borrar el preset.');
    return false;
  }
}

