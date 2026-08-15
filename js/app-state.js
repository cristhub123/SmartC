/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/**
 * ============================================================================
 * js/app-state.js
 * ----------------------------------------------------------------------------
 * MÓDULO DE ESTADO CENTRALIZADO (CENTRAL STORE) — SMART CITY
 * ============================================================================
 *
 * Responsabilidad única: ser la ÚNICA fuente de verdad en memoria para
 * `pois`, `zones` y `roadmap`, y el ÚNICO punto de entrada para modificarlos.
 *
 * Ningún otro archivo (poi-panel.js, zones.js, admin-panel.js, etc.) debe:
 *   - mutar directamente los arreglos internos de este módulo,
 *   - llamar a FirestoreSync por su cuenta,
 *   - refrescar el mapa/UI manualmente.
 *
 * En cambio, deben:
 *   1. Leer estado vía los getters expuestos (getPois, getPoi, getContent...).
 *   2. Pedir cambios vía los métodos mutadores (updatePoi, toggleSkinStatus...).
 *   3. Suscribirse a los eventos emitidos (AppState.on(...)) para reaccionar
 *      cuando el estado cambia, en vez de sondear el estado manualmente.
 *
 * Este archivo NO modifica HTML ni CSS. Es puramente lógica de estado.
 * Se apoya en `FirestoreSync` (ya existente en el proyecto) para la
 * persistencia real contra Firestore — este módulo no llama a Firebase
 * directamente, delega esa responsabilidad.
 * ============================================================================
 */

const AppState = (function () {
  'use strict';

  // --------------------------------------------------------------------
  // 1. ESTADO INTERNO (privado — no se expone directamente)
  // --------------------------------------------------------------------

  /** @type {Array<Object>} Arreglo de POIs, cada uno con el esquema completo de Firestore */
  let _pois = [];

  /** @type {Array<Object>} Arreglo de zonas */
  let _zones = [];

  /** @type {Array<Object>} Arreglo de ideas/roadmap */
  let _roadmap = [];

  /** Idioma de fallback obligatorio cuando no existe traducción */
  const FALLBACK_LANG = 'es';

  /** Idioma activo actual de toda la app (selector ES/EN/PT del panel) */
  let _currentLang = FALLBACK_LANG;

  /** Skin de fallback obligatorio cuando un POI no tiene activo el skin global */
  const FALLBACK_SKIN = 'main';

  /** Skin actualmente aplicado a todo el mapa (nivel global) */
  let _globalSkin = FALLBACK_SKIN;

  // --------------------------------------------------------------------
  // 1.1 CONFIGURACIÓN DE IMÁGENES (CLOUDINARY)
  // --------------------------------------------------------------------
  // Estructura real en el dashboard:
  //   smartcity/media/arg/p-cba/c-cba/images/{slug}_{skin}.webp
  //   (con hermanas audio/, video/, gifs/ para más adelante)
  //
  // Solo existen 2 tamaños reales en toda la interfaz:
  //   - "thumb": pines del mapa, ~160px, vía transformación w_160,c_limit
  //   - "full": versión máster 1024px, sin resize (solo f_auto,q_auto)
  //
  // FUENTE DE VERDAD ÚNICA: el `slug` limpio (ej. "alto-paz-tower",
  // "patio-olmos") es el mismo ID que se usa en el mapa, en Firestore
  // (`poi.id`) y en el nombre de archivo de Cloudinary. Ya no hay un id
  // autogenerado de Firestore por un lado y un slug "de exhibición" por
  // otro: son el mismo valor.

  /** Nombre de cloud de Cloudinary. Ajustar acá o sobreescribir con
   *  `window.CLOUDINARY_CLOUD_NAME` antes de que cargue este script. */
  const CLOUD_NAME = (typeof window !== 'undefined' && window.CLOUDINARY_CLOUD_NAME)
    || 'TU_CLOUD_NAME';

  /** Carpeta base fija donde viven las imágenes de POIs en Cloudinary.
   *  GUION MEDIO (p-cba/c-cba) — convención definitiva; antes tenía
   *  guion bajo, que no coincidía con las carpetas reales de Cloudinary.
   *  Nota: esta ruta es fija a propósito — la usa solo el loader legado
   *  de `pois_cordoba.json` (ver pois-loader.js), que es Córdoba-only
   *  por diseño. El admin real (multi-ciudad) arma la carpeta dinámica
   *  con CloudinaryAdmin.buildFolder(), no con esta constante. */
  const CLOUDINARY_IMAGES_PATH = 'smartcity/media/arg/p-cba/c-cba/images';

  /** Transformaciones válidas por tamaño — únicas 2 variantes soportadas */
  const IMAGE_TRANSFORMS = Object.freeze({
    thumb: 'f_auto,q_auto,w_160,c_limit',
    full: 'f_auto,q_auto',
  });

  /**
   * Helper centralizado para construir URLs de imagen de Cloudinary.
   * Única vía autorizada para armar estas URLs — así, si el día de
   * mañana cambia la estructura de carpetas o el cloud name, se toca
   * en un solo lugar.
   *
   * @param {string} slug - Slug del POI (ej. "patio-olmos").
   * @param {string} [skin='main'] - Variante de skin (ej. "main", "enanos").
   * @param {'thumb'|'full'} [size='full'] - Tamaño: "thumb" (~256px, pines) o "full" (1024px, vista maximizada).
   * @returns {string} URL completa lista para usar en un <img src>.
   */
  function getImageUrl(slug, skin, size) {
    const resolvedSkin = skin || FALLBACK_SKIN;
    const resolvedSize = size === 'thumb' ? 'thumb' : 'full';
    const transform = IMAGE_TRANSFORMS[resolvedSize];

    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transform}/${CLOUDINARY_IMAGES_PATH}/${slug}_${resolvedSkin}.webp`;
  }

  // --------------------------------------------------------------------
  // 2. SISTEMA DE EVENTOS INTERNO
  // --------------------------------------------------------------------
  // Se usa un EventTarget nativo para no depender de librerías externas.
  // Los listeners de la UI (mapa, panel admin, etc.) se suscriben acá.

  const _emitter = new EventTarget();

  /** Nombres de eventos que este módulo puede emitir */
  const EVENTS = Object.freeze({
    POI_UPDATED: 'state:poiUpdated',
    SKIN_TOGGLED: 'state:skinToggled',
    GLOBAL_SKIN_CHANGED: 'state:globalSkinChanged',
    POIS_LOADED: 'state:poisLoaded',
    ZONES_LOADED: 'state:zonesLoaded',
    ROADMAP_LOADED: 'state:roadmapLoaded',
    ROADMAP_UPDATED: 'state:roadmapUpdated',
    LANGUAGE_CHANGED: 'state:languageChanged',
    ERROR: 'state:error',
  });

  /**
   * Suscribe un callback a un evento de estado.
   * @param {string} eventName - Uno de los valores de EVENTS.
   * @param {(detail: any) => void} callback
   * @returns {() => void} función para des-suscribirse
   */
  function on(eventName, callback) {
    const handler = (e) => callback(e.detail);
    _emitter.addEventListener(eventName, handler);
    return () => _emitter.removeEventListener(eventName, handler);
  }

  /**
   * Emite un evento de estado con un payload.
   * @param {string} eventName
   * @param {any} detail
   */
  function _emit(eventName, detail) {
    _emitter.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  // --------------------------------------------------------------------
  // 3. UTILIDADES INTERNAS
  // --------------------------------------------------------------------

  /**
   * NORMALIZACIÓN DE ID
   * ----------------------------------------------------------------
   * `markers.js`/`cluster.js` todavía generan algunos IDs de marcador
   * con un sufijo regional pegado a mano (ej. `"alto-paz-tower-cordoba"`),
   * mientras que los POIs cargados en AppState usan la clave limpia
   * (`"alto-paz-tower"`). En vez de salir a tocar marker por marker en
   * el mapa, esta función limpia el ID ANTES de comparar, así la
   * búsqueda es infalible sin importar de qué lado venga el sufijo.
   *
   * Lista de sufijos regionales conocidos — agregar acá si aparece
   * alguno nuevo (ej. otras ciudades a futuro).
   */
  const REGIONAL_SUFFIXES = ['-cordoba'];

  /**
   * @param {string} id
   * @returns {string} id limpio (trim + sin sufijo regional), o '' si `id` es falsy.
   */
  function _normalizeId(id) {
    if (!id) return '';
    let clean = String(id).trim();
    for (const suffix of REGIONAL_SUFFIXES) {
      const re = new RegExp(`${suffix}$`, 'i');
      clean = clean.replace(re, '');
    }
    return clean;
  }

  /**
   * Compara un POI contra un id "crudo" (tal como llegó, ej. desde un
   * marker de Leaflet) probando 4 combinaciones: id/slug del POI
   * contra el id crudo y contra su versión normalizada. La comparación
   * es insensible a mayúsculas/minúsculas de punta a punta, para que
   * no importe si el marker manda "ALTO-PAZ-TOWER-Cordoba" o cualquier
   * otra variante de capitalización.
   * @param {Object} p - POI candidato.
   * @param {string} rawId - id tal como llegó, sin procesar.
   * @param {string} cleanId - id ya normalizado (`_normalizeId(rawId)`).
   * @returns {boolean}
   */
  function _poiMatchesId(p, rawId, cleanId) {
    if (!p) return false;
    const poiId = (p.id || '').toLowerCase();
    const poiSlug = (p.slug || '').toLowerCase();
    const rawLower = rawId.toLowerCase();
    const cleanLower = cleanId.toLowerCase();
    return (
      poiId === rawLower || poiSlug === rawLower ||
      poiId === cleanLower || poiSlug === cleanLower ||
      _normalizeId(poiId).toLowerCase() === cleanLower ||
      _normalizeId(poiSlug).toLowerCase() === cleanLower
    );
  }

  /**
   * Busca el índice de un POI por id dentro del arreglo interno.
   * Con la unificación de IDs, `poi.id` ES el slug limpio (ej.
   * "alto-paz-tower") — coincide exactamente con el ID del mapa y con
   * el nombre de archivo en Cloudinary. Además de aceptar `p.slug`
   * como alias, normaliza ambos lados de la comparación para tolerar
   * sufijos regionales pegados por el mapa (ver `_normalizeId`).
   * @param {string} poiId
   * @returns {number} índice, o -1 si no existe
   */
  function _findPoiIndex(poiId) {
    const rawId = String(poiId || '').trim();
    const cleanId = _normalizeId(rawId);
    return _pois.findIndex((p) => _poiMatchesId(p, rawId, cleanId));
  }

  /**
   * COMPATIBILIDAD CON DATOS LEGADOS
   * ----------------------------------------------------------------
   * El proyecto viene de una etapa previa a AppState donde los POIs
   * vivían en una variable global `window.POIS` (arreglo plano, con
   * campos como `name`, `desc`, `hist`, `hours` en vez del esquema
   * multiidioma de Firestore). Mientras la migración de datos no esté
   * terminada, AppState debe poder:
   *   1. Auto-hidratarse desde `window.POIS` al arrancar, si nadie
   *      llamó a `loadPois()` todavía.
   *   2. Si un id/slug puntual no está en `_pois` (por ejemplo porque
   *      se cargó parcialmente), caer a buscarlo directo en
   *      `window.POIS` como último recurso, en vez de devolver null.
   * Esto es un puente temporal: el objetivo final sigue siendo que
   * todo pase por `_pois` con el esquema nuevo.
   */
  function _autoHydrateFromLegacyGlobal() {
    if (_pois.length > 0) return;
    if (typeof window === 'undefined') return;
    if (Array.isArray(window.POIS) && window.POIS.length > 0) {
      loadPois(window.POIS);
    }
  }

  /**
   * Busca un POI directamente en `window.POIS` (dato legado crudo),
   * sin pasar por `_pois`. Devuelve el objeto tal cual está en el
   * arreglo global, sin normalizar al esquema nuevo — quien consuma
   * esto (ej. poi-panel.js) es responsable de aplicar sus propios
   * fallbacks a campos legados (`name`, `desc`, `hist`, `hours`).
   * @param {string} poiId
   * @returns {Object|null}
   */
  function _findInLegacyGlobal(poiId) {
    if (typeof window === 'undefined' || !Array.isArray(window.POIS)) return null;
    const rawId = String(poiId || '').trim();
    const cleanId = _normalizeId(rawId);
    const found = window.POIS.find((p) => _poiMatchesId(p, rawId, cleanId));
    return found ? { ...found } : null;
  }

  /**
   * Clona superficialmente un objeto para evitar que quien consume el
   * estado (getters) pueda mutar el store por referencia sin pasar por
   * los métodos oficiales.
   * @param {any} obj
   */
  function _cloneShallow(obj) {
    if (Array.isArray(obj)) return obj.map((item) => ({ ...item }));
    if (obj && typeof obj === 'object') return { ...obj };
    return obj;
  }

  /**
   * Valida que FirestoreSync esté disponible antes de intentar usarlo.
   * Si no existe, se avisa por consola y se emite un evento de error,
   * pero el cambio local NO se revierte (optimistic update) — se
   * documenta en la sección 6 (Persistencia) el motivo de este diseño.
   */
  function _assertFirestoreSync() {
    if (typeof FirestoreSync === 'undefined') {
      const msg = '[AppState] FirestoreSync no está disponible. El cambio quedó solo en memoria local.';
      console.error(msg);
      _emit(EVENTS.ERROR, { message: msg });
      return false;
    }
    return true;
  }

  // --------------------------------------------------------------------
  // 4. CARGA INICIAL (hidratación del store)
  // --------------------------------------------------------------------
  // Estos métodos NO llaman a Firestore directamente: reciben los datos
  // ya resueltos (por ejemplo, desde FirestoreSync.fetchPois() en el
  // punto de arranque de la app) y los usan para poblar el store.
  // Esto mantiene la responsabilidad de "cómo se trae la data" fuera de
  // este módulo, que solo se ocupa de "cómo se administra en memoria".

  /**
   * Hidrata el store con el arreglo completo de POIs (ej. al arrancar la app).
   * @param {Array<Object>} poisArray
   */
  function loadPois(poisArray) {
    _pois = Array.isArray(poisArray) ? poisArray.map((p) => ({ ...p })) : [];
    _emit(EVENTS.POIS_LOADED, { pois: getPois() });
  }

  /**
   * Hidrata el store con el arreglo completo de zonas.
   * @param {Array<Object>} zonesArray
   */
  function loadZones(zonesArray) {
    _zones = Array.isArray(zonesArray) ? zonesArray.map((z) => ({ ...z })) : [];
    _emit(EVENTS.ZONES_LOADED, { zones: getZones() });
  }

  /**
   * Hidrata el store con el arreglo completo del roadmap.
   * @param {Array<Object>} roadmapArray
   */
  function loadRoadmap(roadmapArray) {
    _roadmap = Array.isArray(roadmapArray) ? roadmapArray.map((r) => ({ ...r })) : [];
    _emit(EVENTS.ROADMAP_LOADED, { roadmap: getRoadmap() });
  }

  // --------------------------------------------------------------------
  // 5. GETTERS (lectura de estado — siempre devuelven copias)
  // --------------------------------------------------------------------

  /** @returns {Array<Object>} copia del arreglo completo de POIs */
  function getPois() {
    _autoHydrateFromLegacyGlobal();
    return _cloneShallow(_pois);
  }

  /**
   * Devuelve un único POI por id (o por slug, ver `_findPoiIndex`).
   * Orden de búsqueda:
   *   1. Arreglo interno `_pois` (fuente de verdad normal), comparando
   *      tanto el id crudo como su versión normalizada (ver
   *      `_normalizeId` / `_poiMatchesId`) — así da lo mismo si
   *      `markers.js` manda `"alto-paz-tower-cordoba"` y AppState tiene
   *      guardado `"alto-paz-tower"`.
   *   2. Si `_pois` está vacío, se auto-hidrata desde `window.POIS`
   *      antes de buscar (cubre el caso "arrancó sin loadPois()").
   *   3. Si igual no aparece, se busca como último recurso directo en
   *      `window.POIS` (cubre hidratación parcial / datos legados que
   *      todavía no migraron al esquema nuevo), también normalizado.
   * @param {string} poiId
   * @returns {Object|null}
   */
  function getPoi(poiId) {
    _autoHydrateFromLegacyGlobal();

    const rawId = String(poiId || '').trim();
    const cleanId = _normalizeId(rawId);

    const poi = _pois.find((p) => _poiMatchesId(p, rawId, cleanId));
    if (poi) return { ...poi };

    const legacy = _findInLegacyGlobal(poiId);
    if (legacy) {
      console.warn(`[AppState] POI "${poiId}" resuelto desde window.POIS (dato legado), no desde _pois.`);
      return legacy;
    }

    console.debug(`[AppState] POI no encontrado en la lista maestra actual. Buscado: "${rawId}" (normalizado: "${cleanId}")`);
    return null;
  }

  /** @returns {Array<Object>} copia del arreglo completo de zonas */
  function getZones() {
    return _cloneShallow(_zones);
  }

  /** @returns {Array<Object>} copia del arreglo completo del roadmap */
  function getRoadmap() {
    return _cloneShallow(_roadmap);
  }

  /** @returns {string} skin global activo actualmente */
  function getGlobalSkin() {
    return _globalSkin;
  }

  /**
   * Devuelve el contenido multiidioma de un POI para el idioma pedido,
   * haciendo fallback automático a `es` si la traducción no existe o
   * está incompleta.
   *
   * @param {string} poiId
   * @param {'es'|'en'|'pt'|string} lang
   * @returns {Object|null} objeto de contenido (name, gancho, description, custom_fields)
   */
  /**
   * Cambia el idioma activo de toda la app (selector ES/EN/PT) y avisa
   * a quien esté suscripto (ej. poi-panel.js) para que refresque la
   * vista con el nuevo idioma.
   * @param {'es'|'en'|'pt'|string} lang
   */
  function setLanguage(lang) {
    if (!lang || lang === _currentLang) return;
    _currentLang = lang;
    _emit(EVENTS.LANGUAGE_CHANGED, { lang });
  }

  /** @returns {string} idioma activo actual */
  function getLanguage() {
    return _currentLang;
  }

  function getContent(poiId, lang) {
    _autoHydrateFromLegacyGlobal();

    const resolvedLang = lang || _currentLang;
    const rawId = String(poiId || '').trim();
    const cleanId = _normalizeId(rawId);

    let poi = _pois.find((p) => _poiMatchesId(p, rawId, cleanId));
    if (!poi) poi = _findInLegacyGlobal(poiId);

    // POI legado sin esquema `content` multiidioma: se devuelve null y
    // es responsabilidad del consumidor (ej. poi-panel.js) aplicar su
    // propio fallback a los campos planos legados (name, desc, hist, hours).
    if (!poi || !poi.content) return null;

    const requested = poi.content[resolvedLang];
    const fallback = poi.content[FALLBACK_LANG];

    // Si no existe el idioma pedido directamente, fallback completo a 'es'.
    if (!requested) {
      return fallback ? { ...fallback } : null;
    }

    // Si existe parcialmente (ej. falta 'gancho' o 'description'), se
    // completan los campos faltantes con el contenido en español para
    // evitar mostrar textos vacíos en la UI.
    return {
      name: requested.name || (fallback && fallback.name) || '',
      gancho: requested.gancho || (fallback && fallback.gancho) || '',
      description: requested.description || (fallback && fallback.description) || '',
      custom_fields: {
        ...(fallback && fallback.custom_fields ? fallback.custom_fields : {}),
        ...(requested.custom_fields || {}),
      },
    };
  }

  /**
   * Resuelve qué skin debe mostrarse efectivamente para un POI dado,
   * aplicando el fallback automático a 'main' cuando el skin global
   * no está activo para ese POI puntual.
   *
   * @param {string} poiId
   * @returns {{ skinName: string, url: string }|null}
   */
  function getEffectiveSkin(poiId) {
    const rawId = String(poiId || '').trim();
    const cleanId = _normalizeId(rawId);
    const poi = _pois.find((p) => _poiMatchesId(p, rawId, cleanId));
    if (!poi || !poi.skins) return null;

    const desired = poi.skins[_globalSkin];
    if (desired && desired.active) {
      return { skinName: _globalSkin, url: desired.url };
    }

    const main = poi.skins[FALLBACK_SKIN];
    if (main) {
      return { skinName: FALLBACK_SKIN, url: main.url };
    }

    // Caso límite: ni siquiera existe 'main' (dato corrupto/incompleto).
    console.warn(`[AppState] POI "${poiId}" no tiene skin "${FALLBACK_SKIN}" disponible.`);
    return null;
  }

  // --------------------------------------------------------------------
  // 6. MUTADORES (única vía autorizada para modificar el estado)
  // --------------------------------------------------------------------
  //
  // Estrategia de persistencia: UPDATE OPTIMISTA.
  //   1. Se aplica el cambio en memoria local primero (UI instantánea).
  //   2. Se dispara la sincronización con Firestore vía FirestoreSync.
  //   3. Se emite el evento correspondiente para que la UI/mapa reaccione.
  //
  // Si FirestoreSync.savePoi() devuelve una Promise, se espera y, si
  // falla, se emite EVENTS.ERROR con el detalle — pero el estado local
  // NO se revierte automáticamente, para no generar parpadeos en la UI.
  // Quien escuche EVENTS.ERROR puede decidir cómo informar al usuario
  // (ej. un toast "no se pudo guardar, reintentando...").

  /**
   * Actualiza (o inserta si no existe) un POI completo en el store y
   * sincroniza el cambio con Firestore.
   *
   * @param {Object} poiData - Objeto POI completo o parcial con al menos `id`.
   * @returns {Promise<void>}
   */
  async function updatePoi(poiData) {
    if (!poiData || !poiData.id) {
      const msg = '[AppState] updatePoi requiere un objeto con "id" válido.';
      console.error(msg);
      _emit(EVENTS.ERROR, { message: msg });
      return;
    }

    const index = _findPoiIndex(poiData.id);

    if (index === -1) {
      // POI nuevo: se agrega al store.
      _pois.push({ ...poiData });
    } else {
      // POI existente: merge superficial sobre el objeto actual para no
      // perder campos que `poiData` no incluya (update parcial).
      _pois[index] = { ..._pois[index], ...poiData };
    }

    const updatedPoi = getPoi(poiData.id);
    _emit(EVENTS.POI_UPDATED, { poi: updatedPoi });

    if (!_assertFirestoreSync()) return;

    try {
      await FirestoreSync.savePoi(updatedPoi);
    } catch (err) {
      console.error(`[AppState] Error al sincronizar POI "${poiData.id}" con Firestore:`, err);
      _emit(EVENTS.ERROR, { message: 'Error al guardar en Firestore', poiId: poiData.id, error: err });
    }
  }

  /**
   * Activa o desactiva un skin específico de un POI, y sincroniza el
   * cambio con Firestore.
   *
   * @param {string} poiId
   * @param {string} skinName
   * @param {boolean} isActive
   * @returns {Promise<void>}
   */
  async function toggleSkinStatus(poiId, skinName, isActive) {
    const index = _findPoiIndex(poiId);
    if (index === -1) {
      const msg = `[AppState] toggleSkinStatus: no existe el POI "${poiId}".`;
      console.error(msg);
      _emit(EVENTS.ERROR, { message: msg });
      return;
    }

    const poi = _pois[index];
    if (!poi.skins || !poi.skins[skinName]) {
      const msg = `[AppState] toggleSkinStatus: el POI "${poiId}" no tiene el skin "${skinName}".`;
      console.error(msg);
      _emit(EVENTS.ERROR, { message: msg });
      return;
    }

    // No permitir desactivar 'main' — siempre debe existir un fallback válido.
    if (skinName === FALLBACK_SKIN && isActive === false) {
      const msg = `[AppState] El skin "${FALLBACK_SKIN}" no puede desactivarse: es el fallback obligatorio.`;
      console.warn(msg);
      _emit(EVENTS.ERROR, { message: msg });
      return;
    }

    poi.skins[skinName] = { ...poi.skins[skinName], active: isActive };

    _emit(EVENTS.SKIN_TOGGLED, { poiId, skinName, isActive, poi: getPoi(poiId) });

    if (!_assertFirestoreSync()) return;

    try {
      await FirestoreSync.savePoi(getPoi(poiId));
    } catch (err) {
      console.error(`[AppState] Error al sincronizar skin "${skinName}" de "${poiId}":`, err);
      _emit(EVENTS.ERROR, { message: 'Error al guardar skin en Firestore', poiId, skinName, error: err });
    }
  }

  /**
   * Cambia el skin visible a nivel global (todo el mapa). No requiere
   * escritura en Firestore por sí mismo (es una preferencia de sesión/UI,
   * no un dato persistente del POI), pero notifica a todas las capas del
   * mapa para que se re-rendericen con el nuevo skin, aplicando fallback
   * automático a 'main' en cada POI que no tenga ese skin activo.
   *
   * @param {string} skinName
   */
  function setGlobalSkin(skinName) {
    _globalSkin = skinName;

    // Se pre-calcula la resolución efectiva de cada POI para que la capa
    // del mapa no tenga que repetir la lógica de fallback por su cuenta.
    const resolved = _pois.map((poi) => ({
      poiId: poi.id,
      ...getEffectiveSkin(poi.id),
    }));

    _emit(EVENTS.GLOBAL_SKIN_CHANGED, { skinName, resolved });
  }

  /**
   * Activa/desactiva la visibilidad pública del contador de clicks de
   * un POI (el "ojito"). Mismo comportamiento que `togglePublicClicks`
   * de admin.js, pero pasando por AppState para que cualquier UI
   * (panel del mapa, admin) quede sincronizada vía eventos, en vez de
   * que cada lugar tenga su propia copia de la lógica.
   *
   * @param {string} poiId
   * @param {boolean} isPublic
   * @returns {Promise<void>}
   */
  async function toggleClicksVisibility(poiId, isPublic) {
    const index = _findPoiIndex(poiId);
    if (index === -1) {
      const msg = `[AppState] toggleClicksVisibility: no existe el POI "${poiId}".`;
      console.error(msg);
      _emit(EVENTS.ERROR, { message: msg });
      return;
    }

    _pois[index] = { ..._pois[index], clicksPublicVisible: isPublic };
    const updatedPoi = getPoi(poiId);
    _emit(EVENTS.POI_UPDATED, { poi: updatedPoi });

    if (!_assertFirestoreSync()) return;

    try {
      await FirestoreSync.savePoi(updatedPoi);
    } catch (err) {
      console.error(`[AppState] Error al sincronizar visibilidad de clicks de "${poiId}":`, err);
      _emit(EVENTS.ERROR, { message: 'Error al guardar visibilidad de clicks en Firestore', poiId, error: err });
    }
  }

  /**
   * Agrega una idea al roadmap. Respeta la regla de trabajo permanente:
   * el texto debe guardarse literal (solo se permite corregir
   * ortografía/puntuación fuera de este módulo, antes de llamar acá).
   *
   * @param {Object} entry - Debe incluir al menos { text: string }.
   * @returns {Promise<void>}
   */
  async function addRoadmapEntry(entry) {
    if (!entry || !entry.text) {
      const msg = '[AppState] addRoadmapEntry requiere un objeto con "text".';
      console.error(msg);
      _emit(EVENTS.ERROR, { message: msg });
      return;
    }

    const newEntry = {
      id: entry.id || `roadmap_${Date.now()}`,
      text: entry.text,
      createdAt: entry.createdAt || new Date().toISOString(),
      ...entry,
    };

    _roadmap.push(newEntry);
    _emit(EVENTS.ROADMAP_UPDATED, { roadmap: getRoadmap() });

    if (!_assertFirestoreSync()) return;

    try {
      if (typeof FirestoreSync.saveRoadmapEntry === 'function') {
        await FirestoreSync.saveRoadmapEntry(newEntry);
      }
    } catch (err) {
      console.error('[AppState] Error al sincronizar entrada de roadmap:', err);
      _emit(EVENTS.ERROR, { message: 'Error al guardar roadmap en Firestore', error: err });
    }
  }

  // --------------------------------------------------------------------
  // 6.1 AUTO-HIDRATACIÓN AL ARRANCAR
  // --------------------------------------------------------------------
  // Intento inmediato (por si `window.POIS` ya existe cuando este script
  // se evalúa) y un reintento en DOMContentLoaded (por si `POIS` se
  // define en un <script> que carga después de este archivo).

  _autoHydrateFromLegacyGlobal();

  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _autoHydrateFromLegacyGlobal, { once: true });
  }

  // --------------------------------------------------------------------
  // 7. API PÚBLICA
  // --------------------------------------------------------------------

  return {
    // Eventos
    EVENTS,
    on,

    // Carga inicial
    loadPois,
    loadZones,
    loadRoadmap,

    // Getters
    getPois,
    getPoi,
    getZones,
    getRoadmap,
    getGlobalSkin,
    getContent,
    getEffectiveSkin,
    getImageUrl,

    // Mutadores
    updatePoi,
    toggleSkinStatus,
    setGlobalSkin,
    addRoadmapEntry,
    setLanguage,
    getLanguage,
    toggleClicksVisibility,
  };
})();

// Se expone globalmente para mantener compatibilidad con la arquitectura
// Vanilla JS existente (sin módulos ES / bundler).
window.AppState = AppState;
