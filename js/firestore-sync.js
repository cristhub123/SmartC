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

/* [NUEVO 2026-08-13 — smartcityV3.0_fix-mapa-pines] NO BORRAR ESTA NOTA en
   una limpieza futura de comentarios — documenta un fix central del proyecto.
   ---------------------------------------------------------------------------
   Mantiene AppState sincronizado con el array real POIS (declarado en
   config.js). Hace falta porque `poi-panel.js` (el panel que se abre al
   tocar un pin) lee EXCLUSIVAMENTE vía `AppState.getPoi()`/`getContent()` —
   nunca lee POIS directo. Antes de este fix, AppState solo se hidrataba con
   los 4 lugares fijos de `pois_cordoba.json` (vía `pois-loader.js`, ahora
   desconectado — ver index.html), así que ningún pin real tenía datos para
   mostrar en el panel, aunque se llegara a dibujar en el mapa.
   `AppState.loadPois()` no transforma nada — guarda el arreglo tal cual
   (shallow copy) — y `poi-panel.js` ya tiene fallback a los campos planos
   legados (name/desc/hist/hours), que es exactamente el esquema real de
   POIS. Por eso no hace falta ningún mapeo especial acá.
   Se llama en cada punto donde POIS queda en su estado final — los mismos
   puntos donde ya se llama `regeneratePublicCache()` (ver grep en
   CAMBIOS.txt para la lista completa de call sites). */
function syncAppStateWithPOIS() {
  if (typeof AppState !== 'undefined' && typeof AppState.loadPois === 'function') {
    AppState.loadPois(POIS);
  }
}

/* [CORREGIDO 2026-08-13 — smartcityV3.0_fix-mapa-pines] NO BORRAR ESTA NOTA
   en una limpieza futura de comentarios — documenta un fix central del
   proyecto, con evidencia directa de Cris (capturas de Firestore).
   ---------------------------------------------------------------------------
   BUG CONFIRMADO CON EVIDENCIA DIRECTA: esta función confiaba ciegamente en
   el documento `cache/all-pines` si existía, sin verificar nunca que
   estuviera completo/actualizado respecto a la colección `pines` real. Cris
   confirmó con capturas de Firestore: la colección `pines` tenía 11
   documentos reales, pero el panel Admin (que arma su lista leyendo POIS,
   hidratado acá) solo mostraba 5. Uno de los faltantes, `plaza-san-martin-
   cba`, es un documento perfectamente válido y completo (nombre, coords,
   imagen ya subida a Cloudinary) — descarta que sea un problema de datos:
   es un problema de LECTURA. El caché quedó desactualizado en algún momento
   de sesiones anteriores (antes del fix de orden/await de
   `regeneratePublicCache()` de la sesión pasada) y, como el código solo
   reconstruía el caché si el documento NO EXISTÍA en absoluto (nunca por
   estar incompleto), quedó atascado así para siempre.
   FIX: se deja de leer `cache/all-pines` para armar POIS. Se lee siempre en
   vivo la colección `pines` completa, y de paso se regenera el caché en
   cada carga (autosanándolo, por si en el futuro se quiere reintroducir la
   lectura cacheada). A la escala actual del proyecto (~11 lugares, apuntando
   a ~100) esto es 1 lectura extra por sesión, insignificante contra la
   cuota gratis de Firestore (50.000 lecturas/día) — la optimización de
   caché tenía sentido pensando en cientos de visitantes públicos por
   noche, pero hoy cuesta más en bugs de lo que ahorra en cuota. Si más
   adelante (cerca del lanzamiento público de noviembre) el tráfico real lo
   justifica, se puede reintroducir la lectura cacheada — PERO hay que
   resolver antes cómo invalidar el caché quando esté desactualizado (por
   ejemplo comparando cantidad de documentos con una `count()` aggregation
   query, que cuesta 1 sola lectura sin importar el tamaño de la colección),
   no simplemente confiar en que existe. El código viejo queda comentado
   abajo, no borrado, para esa reintroducción futura. */
async function loadPOISFromFirestore() {
  try {
    // [DESCONECTADO 2026-08-13 — no se lee más el caché para armar POIS,
    // ver nota arriba. Se deja comentado, no borrado, para reintroducir
    // esta optimización más adelante si el tráfico real lo justifica.]
    // const cacheDoc = await db.collection('cache').doc('all-pines').get();
    // if (cacheDoc.exists && Array.isArray(cacheDoc.data().pois)) {
    //   POIS = cacheDoc.data().pois;
    //   syncAppStateWithPOIS();
    //   return true;
    // }
    const snapshot = await db.collection('pines').get();
    const loaded = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.name) return; // salta documentos de prueba con otro esquema
      loaded.push({ id: doc.id, ...data });
    });
    POIS = loaded;
    syncAppStateWithPOIS(); // [NUEVO 2026-08-13] ver nota arriba
    await regeneratePublicCache(); // autosana el caché en cada carga
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


/* [CORREGIDO 2026-08-13] Antes esta función regeneraba el caché
   público ella misma, sin esperar (fire-and-forget), JUSTO DESPUÉS
   de escribir el documento — pero en la mayoría de los que la
   llaman (saveEdit/saveNew/importaciones), el array POIS en memoria
   TODAVÍA no estaba actualizado con los datos nuevos en ese
   instante exacto (esa actualización pasa después, más abajo en
   cada función). Resultado: el caché público (el que lee CUALQUIER
   visitante al cargar la página) se regeneraba con datos VIEJOS —
   a veces el cambio recién se reflejaba en el próximo guardado de
   OTRO lugar cualquiera, a veces nunca si era un cambio de ID (el
   caso más grave: el documento viejo se borra de Firestore, pero el
   caché queda apuntando a ese ID que ya no existe → el lugar
   desaparece por completo al recargar).
   SOLUCIÓN: esta función YA NO dispara la regeneración del caché
   por su cuenta. Cada lugar que la llama es responsable de llamar a
   `regeneratePublicCache()` (con await) DESPUÉS de haber actualizado
   POIS en memoria con el dato final y correcto — así el caché nunca
   puede quedar desincronizado. */
async function savePoiToFirestore(poi) {
  try {
    const { id, ...data } = poi; // el id va aparte, no adentro del documento
    await db.collection('pines').doc(id).set(data, { merge: false });
    return true;
  } catch (err) {
    console.error('Error guardando en Firestore:', err);
    toast('⚠️ No se guardó en la base de datos. Probá de nuevo (¿iniciaste sesión?).');
    return false;
  }
}

/* === GUARDADO PARCIAL — SOLO IMÁGENES (no toca el resto del pin) ===
   [NUEVO 2026-08-12] A diferencia de `savePoiToFirestore` (que
   reemplaza el documento entero con merge:false), esta función usa
   merge:true y manda ÚNICAMENTE el campo `skins` (+ `imgB64` si vino
   una variante "main", por compatibilidad con el pin del mapa que
   todavía la usa como fallback). Firestore hace merge profundo del
   mapa `skins`: las variantes que no se mencionan acá quedan como
   estaban, y el resto del documento (nombre, descripción, categoría,
   tags, coordenadas, etc.) no se toca en absoluto.
   La usa `linkPinImagesFromText` en pin-adjust.js. */
async function saveSkinsToFirestore(id, skinsPartial, mainUrl) {
  try {
    const payload = { skins: skinsPartial };
    if (mainUrl) payload.imgB64 = mainUrl;
    await db.collection('pines').doc(id).set(payload, { merge: true });
    // [CORREGIDO 2026-08-13] Ídem savePoiToFirestore — ya no regenera
    // el caché acá. El que llama (importImageLinksFromText) lo hace
    // una sola vez al final, con POIS ya actualizado del todo.
    return true;
  } catch (err) {
    console.error('Error vinculando imágenes en Firestore:', err);
    toast('⚠️ No se pudieron vincular las imágenes. Probá de nuevo (¿iniciaste sesión?).');
    return false;
  }
}

/* === BORRAR UN LUGAR DE FIRESTORE === */
async function deletePoiFromFirestore(id) {
  try {
    await db.collection('pines').doc(id).delete();
    // [CORREGIDO 2026-08-13] Ídem savePoiToFirestore — el que llama
    // regenera el caché explícitamente, con POIS ya actualizado.
    return true;
  } catch (err) {
    console.error('Error borrando de Firestore:', err);
    toast('⚠️ No se pudo borrar en la base de datos.');
    return false;
  }
}

/* [NUEVO 2026-08-13 — smartcityV3.0_fix-mapa-pines] NO BORRAR ESTA NOTA en
   una limpieza futura de comentarios — documenta un bug real, distinto del
   de arriba, encontrado de paso durante esta misma sesión.
   ---------------------------------------------------------------------------
   BUG ENCONTRADO: `AppState.updatePoi()` / `toggleSkinStatus()` /
   `toggleClicksVisibility()` (js/app-state.js) — las 3 funciones que
   `poi-panel.js` usa para persistir un cambio hecho DESDE EL PANEL de un
   pin (editar texto, tocar un skin, tocar el "ojito") — llaman a
   `FirestoreSync.savePoi(...)`. Ese objeto global `FirestoreSync` NUNCA
   existió en el proyecto: este archivo solo exponía funciones sueltas
   (`savePoiToFirestore`, `regeneratePublicCache`, etc.), nunca un objeto
   con ese nombre. Resultado: cualquier edición hecha desde el panel de un
   pin real quedaba SOLO en memoria (se veía bien hasta el próximo F5) y
   nunca se guardaba en Firestore — sin ningún error visible para quien
   editaba.
   Por qué nunca se había notado: hasta el fix de arriba (AppState
   hidratado con datos reales), el panel jamás tenía un pin real para
   editar — solo los 4 de prueba del JSON viejo —, así que este camino de
   código prácticamente nunca se ejecutaba con datos reales.
   FIX: se agrega acá el objeto `FirestoreSync` que faltaba, como wrapper
   sobre las funciones que ya existen — mismo patrón que usa el admin real
   al guardar (pin-adjust.js): escribe en Firestore, actualiza POIS en
   memoria, sincroniza AppState y regenera el caché público. */
window.FirestoreSync = {
  async savePoi(poi) {
    if (!poi || !poi.id) return false;
    const ok = await savePoiToFirestore(poi);
    if (!ok) return false;

    const idx = POIS.findIndex(p => p.id === poi.id);
    if (idx === -1) POIS.push(poi); else POIS[idx] = poi;

    syncAppStateWithPOIS();
    await regeneratePublicCache();
    return true;
  },
};

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

/* ═══════════════════════════════════════════
   PRESETS DE TIPOGRAFÍA — cada preset define color/tipografía/tamaño
   para 3 niveles (título, título de sección, texto) y tiene "scopes"
   (a qué partes de la app aplica: "pines", "zonas", o ambos).
   ---------------------------------------------------------------
   REGLA DE EXCLUSIVIDAD: un scope solo puede estar "en manos" de UN
   preset a la vez — así nunca hay ambigüedad sobre qué preset manda
   en "pines" o en "zonas". Guardar un preset con un scope se lo saca
   automáticamente a cualquier otro preset que lo tuviera (no lo
   borra, solo deja de aplicar ahí).
═══════════════════════════════════════════ */

/**
 * Guarda (crea o edita) un preset de tipografía, aplicando la regla
 * de exclusividad de scope contra el resto de los presets existentes.
 * @param {{id:string, name:string, scopes:string[], levels:Object}} preset
 */
async function saveTypographyPreset(preset) {
  try {
    const { id, ...data } = preset;
    const scopes = data.scopes || [];

    const batch = db.batch();

    if (scopes.length) {
      const snapshot = await db.collection('typography-presets').get();
      snapshot.forEach(doc => {
        if (doc.id === id) return; // no tocar el propio preset acá, va aparte abajo
        const other = doc.data();
        const otherScopes = other.scopes || [];
        const cleaned = otherScopes.filter(s => !scopes.includes(s));
        if (cleaned.length !== otherScopes.length) {
          batch.set(db.collection('typography-presets').doc(doc.id), { scopes: cleaned }, { merge: true });
        }
      });
    }

    batch.set(db.collection('typography-presets').doc(id), data, { merge: false });
    await batch.commit();
    return true;
  } catch (err) {
    console.error('Error guardando preset de tipografía:', err);
    toast('⚠️ No se guardó el preset de tipografía.');
    return false;
  }
}

/** Trae todos los presets de tipografía guardados. */
async function loadTypographyPresets() {
  try {
    const snapshot = await db.collection('typography-presets').get();
    const presets = [];
    snapshot.forEach(doc => presets.push({ id: doc.id, ...doc.data() }));
    return presets;
  } catch (err) {
    console.error('Error cargando presets de tipografía:', err);
    return [];
  }
}

/** Borra un preset de tipografía (no afecta a otros presets). */
async function deleteTypographyPreset(id) {
  try {
    await db.collection('typography-presets').doc(id).delete();
    return true;
  } catch (err) {
    console.error('Error borrando preset de tipografía:', err);
    toast('⚠️ No se pudo borrar el preset.');
    return false;
  }
}

/* ═══════════════════════════════════════════
   UBICACIONES (Entrega 1 del plan multi-ciudad) — cada combinación
   país/provincia/ciudad que el admin declara queda guardada de forma
   permanente en la colección "locations", para poder elegirla del
   dropdown de 3 niveles cuantas veces haga falta sin volver a
   tipearla. El ID del documento se arma con los 3 códigos, ej.
   "arg__p-cba__c-cba" (doble guion bajo para no confundir con los
   guiones que ya usan los códigos como p-cba).
═══════════════════════════════════════════ */

function _locationDocId(countryCode, provinceCode, cityCode) {
  return `${countryCode}__${provinceCode}__${cityCode}`;
}

/**
 * Guarda (crea) una ubicación. Si ya existe exactamente esa
 * combinación de códigos, la sobreescribe (por si cambiaste una
 * etiqueta) en vez de duplicarla.
 * @param {{countryCode,countryLabel,provinceCode,provinceLabel,cityCode,cityLabel}} loc
 */
async function saveLocation(loc) {
  try {
    const id = _locationDocId(loc.countryCode, loc.provinceCode, loc.cityCode);
    await db.collection('locations').doc(id).set(loc, { merge: false });
    return true;
  } catch (err) {
    console.error('Error guardando la ubicación:', err);
    toast('⚠️ No se guardó la ubicación en la base de datos.');
    return false;
  }
}

/** Trae todas las ubicaciones guardadas. */
async function loadLocations() {
  try {
    const snapshot = await db.collection('locations').get();
    const locations = [];
    snapshot.forEach(doc => locations.push({ id: doc.id, ...doc.data() }));
    return locations;
  } catch (err) {
    console.error('Error cargando ubicaciones:', err);
    toast('⚠️ No se pudieron cargar las ubicaciones. Revisá tu conexión.');
    return [];
  }
}

/** Borra una ubicación guardada (por si hay que corregir un error de tipeo). */
async function deleteLocation(id) {
  try {
    await db.collection('locations').doc(id).delete();
    return true;
  } catch (err) {
    console.error('Error borrando la ubicación:', err);
    toast('⚠️ No se pudo borrar la ubicación.');
    return false;
  }
}

