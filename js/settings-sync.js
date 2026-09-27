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

/* === CATEGORÍAS (Tab "Categorías" del admin) ===
   [2026-09-06] Hasta ahora CUSTOM_CATS (categorías creadas por el
   admin) y el flag `active` de las categorías base (CAT, definidas
   en config.js) vivían SOLO en memoria del navegador — se perdían al
   recargar. Mismo esquema de un solo documento que appearance/
   mapstyle/skin: se guarda TODO junto (categorías propias + qué
   categorías base están activas/inactivas) en un único doc.
   customCats trae ya el flag `active` adentro de cada categoría
   (ver CUSTOM_CATS[id] en js/categories.js).

   [Etapa A, PLAN_CATEGORIAS_SUBCATEGORIAS.md — 2026-09-06] Antes
   `builtinActive` solo persistía el flag `active` de las categorías
   base, porque su contenido (label) vivía hardcodeado en config.js
   sin ser editable. Ahora que el label es multi-idioma y hay
   subcategorías anidadas (editables a futuro desde el admin, Etapa
   B), se persiste la categoría base COMPLETA en `builtinData` (label
   + subcategories + active) — no solo el flag. Se sigue leyendo el
   esquema viejo `builtinActive` si `builtinData` no existe todavía,
   para no perder el estado ya guardado en instalaciones anteriores a
   este cambio. `languageFieldsCount` (candado de cantidad de idiomas,
   Etapa B) vive en el mismo documento. */
async function saveCategoriesSettings() {
  try {
    const builtinData = {};
    Object.keys(CAT).forEach(id => {
      builtinData[id] = {
        label: CAT[id].label,
        subcategories: CAT[id].subcategories || {},
        active: CAT[id].active !== false,
        // [FIX Etapa 2 — PLAN_CORRECCIONES_ADMIN.md] faltaban color/icon acá
        // — se guardaba todo lo demás pero el color/ícono editado en
        // categories.js se perdía al recargar porque nunca viajaba a
        // Firestore. Ver loadCategoriesSettings() abajo, que ahora los
        // restaura.
        color: CAT[id].color,
        icon: CAT[id].icon
      };
    });
    await db.collection('settings').doc('categories').set({
      customCats: CUSTOM_CATS,
      builtinData,
      languageFieldsCount: (typeof languageFieldsCount === 'number' ? languageFieldsCount : 3)
    });
    return true;
  } catch (err) {
    console.error('No se pudo guardar las categorías:', err);
    toast('⚠️ No se guardaron las categorías. ¿Iniciaste sesión?');
    return false;
  }
}

async function loadCategoriesSettings() {
  try {
    const doc = await db.collection('settings').doc('categories').get();
    if (!doc.exists) return;
    const data = doc.data();
    if (data.customCats && typeof data.customCats === 'object') {
      Object.assign(CUSTOM_CATS, data.customCats);
    }
    if (data.builtinData && typeof data.builtinData === 'object') {
      Object.entries(data.builtinData).forEach(([id, saved]) => {
        if (!CAT[id] || !saved) return;
        if (saved.label) CAT[id].label = saved.label;
        if (saved.subcategories) CAT[id].subcategories = saved.subcategories;
        if (typeof saved.active === 'boolean') CAT[id].active = saved.active;
        // [FIX Etapa 2 — PLAN_CORRECCIONES_ADMIN.md] restaura color/icon
        // guardados arriba (docs viejos sin estos campos no rompen nada,
        // simplemente quedan con el color/icon original de config.js).
        if (saved.color) CAT[id].color = saved.color;
        if (saved.icon) CAT[id].icon = saved.icon;
      });
    } else if (data.builtinActive && typeof data.builtinActive === 'object') {
      // Esquema viejo (antes de este cambio) — solo traía el flag active.
      Object.entries(data.builtinActive).forEach(([id, active]) => {
        if (CAT[id]) CAT[id].active = active;
      });
    }
    if (typeof data.languageFieldsCount === 'number' && data.languageFieldsCount >= 3) {
      languageFieldsCount = data.languageFieldsCount;
    }
  } catch (err) {
    console.warn('No se pudieron cargar las categorías guardadas (se usan valores por defecto):', err);
  }
}

/* ═══════════════════════════════════════════
   TEMAS / ROADMAP / GRUPOS — persistencia real [NUEVO — Etapa 4,
   PLAN_CORRECCIONES_ADMIN.md]
   ---------------------------------------------
   Antes vivían SOLO en memoria del navegador (arrays TEMAS/ROADMAP/
   GROUPS — js/themes.js, js/roadmap.js, js/groups.js) y se perdían
   al recargar. Mismo patrón que ya usa saveCategoriesSettings() de
   arriba: 1 documento por sistema en la colección "settings", con
   el array completo adentro. El guardado real recién pasa cuando se
   aprieta "💾 Guardar cambios" en cada pestaña (no en cada alta/baja
   individual) — ver _markTemasDirty/_markRoadmapDirty/_markGroupsDirty
   en cada archivo respectivo.
═══════════════════════════════════════════ */

async function saveThemesSettings() {
  try {
    await db.collection('settings').doc('themes').set({ temas: TEMAS });
    return true;
  } catch (err) {
    console.error('No se pudieron guardar los temas:', err);
    toast('⚠️ No se guardaron los temas. ¿Iniciaste sesión?');
    return false;
  }
}

async function loadThemesSettings() {
  try {
    const doc = await db.collection('settings').doc('themes').get();
    if (doc.exists && Array.isArray(doc.data().temas)) {
      TEMAS.length = 0;
      TEMAS.push(...doc.data().temas);
    }
    // si el doc no existe todavía (primera vez), TEMAS se queda vacío
    // como siempre arrancó — no hay nada previo que migrar acá.
  } catch (err) {
    console.warn('No se pudieron cargar los temas guardados (se usa lista vacía):', err);
  }
}

async function saveRoadmapSettings() {
  try {
    await db.collection('settings').doc('roadmap').set({ items: ROADMAP });
    return true;
  } catch (err) {
    console.error('No se pudo guardar el roadmap:', err);
    toast('⚠️ No se guardó el roadmap. ¿Iniciaste sesión?');
    return false;
  }
}

async function loadRoadmapSettings() {
  try {
    const doc = await db.collection('settings').doc('roadmap').get();
    if (doc.exists && Array.isArray(doc.data().items)) {
      ROADMAP.length = 0;
      ROADMAP.push(...doc.data().items);
    }
    // [Etapa 4.2] si el doc todavía NO existe (primera vez que corre
    // esto), se deja ROADMAP tal cual arranca en roadmap.js (la carga
    // hardcodeada r1..r34) — no se pisa con nada. La primera vez que
    // se toque "Guardar cambios" en esta pestaña, ESE historial
    // completo viaja a Firestore de una sola vez, sin perder nada.
  } catch (err) {
    console.warn('No se pudo cargar el roadmap guardado (se usa la lista local):', err);
  }
}

async function saveGroupsSettings() {
  try {
    await db.collection('settings').doc('groups').set({ items: GROUPS });
    return true;
  } catch (err) {
    console.error('No se pudieron guardar los grupos:', err);
    toast('⚠️ No se guardaron los grupos. ¿Iniciaste sesión?');
    return false;
  }
}

async function loadGroupsSettings() {
  try {
    const doc = await db.collection('settings').doc('groups').get();
    if (doc.exists && Array.isArray(doc.data().items)) {
      GROUPS.length = 0;
      GROUPS.push(...doc.data().items);
    }
    // Los selects de grupo en Nuevo/Editar lugar (js/groups.js) hoy
    // solo se llenan al crear un grupo en esta misma sesión — hace
    // falta refrescarlos acá también, apenas se cargan los ya
    // guardados, para que aparezcan sin tener que crear uno nuevo.
    if (typeof refreshGroupSelects === 'function') refreshGroupSelects();
  } catch (err) {
    console.warn('No se pudieron cargar los grupos guardados (se usa lista vacía):', err);
  }
}

