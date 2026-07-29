/**
 * ============================================================================
 * js/cloudinary-admin.js
 * ----------------------------------------------------------------------------
 * SUBIDA DE IMÁGENES + ARMADO DE DOCUMENTO POI — Panel Admin
 * ----------------------------------------------------------------------------
 * Implementa la arquitectura dinámica de carpetas/nombres para que el Admin
 * quede sincronizado con lo que el frontend ya busca (`AppState.getImageUrl`):
 *
 *   Carpeta:   smartcity/media/{country}/{state}/{city}/images/
 *   Archivo:   {slug}_{skin}.webp   (ej. "alto-paz-tower_main")
 *
 * NO TENGO tu admin.js real todavía — este archivo es un módulo aparte,
 * pensado para conectarse con UN SOLO llamado desde tu formulario existente
 * (ver sección 5, "INTEGRACIÓN"). En cuanto me pases tu admin.js real, esta
 * lógica se fusiona ahí directo y este archivo deja de ser necesario.
 *
 * ⚠️ AJUSTE OBLIGATORIO EN EL DASHBOARD DE CLOUDINARY (esto NO es código):
 *   Para que Cloudinary respete el `public_id` exacto que mandamos (en vez
 *   de agregarle un sufijo random), el Upload Preset que estás usando
 *   (Settings → Upload → Upload presets) tiene que tener:
 *     - "Unique filename": OFF
 *     - "Overwrite": ON
 *   Si esto queda en default (ON/OFF invertido), Cloudinary va a seguir
 *   generando nombres random aunque el código ya mande el `public_id`
 *   correcto — y volveríamos al mismo síntoma que estamos arreglando.
 * ============================================================================
 */

const CloudinaryAdmin = (function () {
  'use strict';

  // --------------------------------------------------------------------
  // 1. CONFIGURACIÓN
  // --------------------------------------------------------------------
  const CLOUD_NAME = (typeof window !== 'undefined' && window.CLOUDINARY_CLOUD_NAME) || 'TU_CLOUD_NAME';
  const UPLOAD_PRESET = (typeof window !== 'undefined' && window.CLOUDINARY_UPLOAD_PRESET) || 'TU_UPLOAD_PRESET';

  /** Valores por defecto — Córdoba Capital, para no romper el flujo local */
  const DEFAULT_LOCATION = Object.freeze({ country: 'arg', state: 'p_cba', city: 'c_cba' });

  // --------------------------------------------------------------------
  // 2. FOLDER / PUBLIC_ID DINÁMICOS
  // --------------------------------------------------------------------

  /**
   * Arma la carpeta destino en Cloudinary según la ubicación del POI.
   * Si no se pasa alguno de los 3 campos, cae al default de Córdoba.
   * @param {{country?: string, state?: string, city?: string}} location
   * @returns {string}
   */
  function buildFolder(location) {
    const loc = { ...DEFAULT_LOCATION, ...(location || {}) };
    return `smartcity/media/${loc.country}/${loc.state}/${loc.city}/images`;
  }

  /**
   * Arma el `public_id` obligatorio: `{slug}_{skin}`. Este es el nombre
   * final del archivo en Cloudinary — reemplaza cualquier nombre
   * original del teléfono/computadora del admin.
   * @param {string} slug
   * @param {string} [skin='main']
   * @returns {string}
   */
  function buildPublicId(slug, skin) {
    return `${slug}_${skin || 'main'}`;
  }

  // --------------------------------------------------------------------
  // 3. SUBIDA A CLOUDINARY (unsigned upload)
  // --------------------------------------------------------------------

  /**
   * Sube una imagen a Cloudinary con carpeta y public_id ya resueltos
   * según la nueva convención. Usa unsigned upload (mismo esquema que
   * ya usa el proyecto — ver notas en /areas/smartcity-app.md sobre
   * Cloudinary free tier).
   *
   * @param {File} file - Archivo de imagen seleccionado en el form.
   * @param {Object} opts
   * @param {string} opts.slug - Slug del POI (ID unificado).
   * @param {string} [opts.skin='main']
   * @param {{country?: string, state?: string, city?: string}} [opts.location]
   * @returns {Promise<{secure_url: string, public_id: string, folder: string}>}
   */
  async function uploadPoiImage(file, opts) {
    const { slug, skin = 'main', location } = opts || {};
    if (!file) throw new Error('[CloudinaryAdmin] uploadPoiImage requiere un archivo.');
    if (!slug) throw new Error('[CloudinaryAdmin] uploadPoiImage requiere el slug del POI.');

    const folder = buildFolder(location);
    const publicId = buildPublicId(slug, skin);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', folder);
    formData.append('public_id', publicId);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`[CloudinaryAdmin] Error subiendo imagen (HTTP ${response.status}): ${errText}`);
    }

    const data = await response.json();
    return {
      secure_url: data.secure_url,
      public_id: data.public_id,
      folder,
    };
  }

  // --------------------------------------------------------------------
  // 4. DOCUMENTO FIRESTORE — content NUNCA nulo/desestructurado
  // --------------------------------------------------------------------

  /**
   * Arma el documento completo de POI para guardar en Firestore.
   * Garantiza que `content.es/en/pt` siempre existan: si no hay
   * traducción para en/pt, se copia el texto base de `es` (nunca queda
   * `content` nulo, ni con un idioma faltante).
   *
   * @param {Object} params
   * @param {string} params.slug
   * @param {string} params.category
   * @param {number} params.lat
   * @param {number} params.lng
   * @param {{es?: {name?, description?}, en?: {name?, description?}, pt?: {name?, description?}}} params.texts
   * @param {{country?: string, state?: string, city?: string}} [params.location]
   * @param {{secure_url: string}} [params.uploadedImage] - Resultado de `uploadPoiImage`.
   * @returns {Object} documento listo para `FirestoreSync.savePoi()`.
   */
  function buildPoiDocument(params) {
    const { slug, category, lat, lng, texts, location, uploadedImage } = params || {};
    if (!slug) throw new Error('[CloudinaryAdmin] buildPoiDocument requiere slug.');

    const loc = { ...DEFAULT_LOCATION, ...(location || {}) };

    const esText = {
      name: (texts && texts.es && texts.es.name) || '',
      description: (texts && texts.es && texts.es.description) || '',
    };

    // Si no vino traducción real para en/pt, se completa con copia base
    // de 'es' — así `content` nunca queda incompleto ni nulo.
    const enText = (texts && texts.en && (texts.en.name || texts.en.description))
      ? { name: texts.en.name || esText.name, description: texts.en.description || esText.description }
      : { ...esText };

    const ptText = (texts && texts.pt && (texts.pt.name || texts.pt.description))
      ? { name: texts.pt.name || esText.name, description: texts.pt.description || esText.description }
      : { ...esText };

    return {
      id: slug,
      slug,
      category: category || '',
      country: loc.country,
      state: loc.state,
      city: loc.city,
      coordinates: { lat, lng },
      active_skin: 'main',
      // Referencia de la skin principal — coincide 1:1 con el archivo
      // subido a Cloudinary (buildPublicId(slug, 'main')).
      skins: {
        main: {
          url: uploadedImage ? uploadedImage.secure_url : '',
          style: 'main',
          active: true,
        },
      },
      content: {
        es: esText,
        en: enText,
        pt: ptText,
      },
      owner_uid: null,
      is_claimed: false,
      tier: 'free',
    };
  }

  // --------------------------------------------------------------------
  // 5. INTEGRACIÓN — un solo llamado desde el formulario del Admin
  // --------------------------------------------------------------------

  /**
   * Orquesta el flujo completo: sube la imagen (si se pasó una), arma
   * el documento, y lo guarda con `FirestoreSync.savePoi()` (misma vía
   * que ya usa `AppState.updatePoi()` — ver js/app-state.js).
   *
   * @param {Object} formValues - Ver `buildPoiDocument` para la forma exacta.
   * @param {File} [imageFile] - Opcional: si no se sube imagen nueva, el
   *   documento queda con `skins.main.url = ''` (se puede completar después).
   * @returns {Promise<Object>} el documento guardado.
   */
  async function saveNewPoi(formValues, imageFile) {
    let uploadedImage = null;

    if (imageFile) {
      uploadedImage = await uploadPoiImage(imageFile, {
        slug: formValues.slug,
        skin: 'main',
        location: formValues.location,
      });
    }

    const poiDoc = buildPoiDocument({ ...formValues, uploadedImage });

    if (typeof FirestoreSync !== 'undefined' && typeof FirestoreSync.savePoi === 'function') {
      await FirestoreSync.savePoi(poiDoc);
    } else {
      console.warn('[CloudinaryAdmin] FirestoreSync no disponible — el documento no se guardó, solo se armó en memoria.');
    }

    return poiDoc;
  }

  return {
    DEFAULT_LOCATION,
    buildFolder,
    buildPublicId,
    uploadPoiImage,
    buildPoiDocument,
    saveNewPoi,
  };
})();

window.CloudinaryAdmin = CloudinaryAdmin;
