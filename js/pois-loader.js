/**
 * ============================================================================
 * js/pois-loader.js
 * ----------------------------------------------------------------------------
 * INGESTA DESDE pois_cordoba.json — reemplaza la carga manual de POIs
 * ----------------------------------------------------------------------------
 * `pois_cordoba.json` (raíz del proyecto) es la lista maestra de lugares.
 * Este módulo la lee, la TRANSFORMA al esquema que espera AppState (el
 * de Firestore: `coordinates`, `content.es`, `skins.{name}.active`, etc.)
 * y la carga con `AppState.loadPois()`.
 *
 * POR QUÉ HACE FALTA TRANSFORMAR Y NO CARGAR EL JSON TAL CUAL:
 *   - `pois_cordoba.json` usa `lat`/`lng` planos → AppState también los
 *     acepta así (soporte legado), pero además arma `coordinates.lat/lng`
 *     para que todo el código que ya espera el esquema nuevo funcione
 *     sin tocar nada.
 *   - `pois_cordoba.json` define `skins` como `{ "main": "patio-olmos_main" }`
 *     (un string con el nombre de archivo) — pero `poi-panel.js` y
 *     `AppState.toggleSkinStatus()` esperan `skins.main = { url, style,
 *     active }` (un objeto). Si se cargara el JSON tal cual, el switch
 *     de skins en el panel rompería (`skin.active` sería `undefined`).
 *     Este loader arma ese objeto para cada skin declarada.
 *   - El string de archivo (ej. "patio-olmos_main") en sí no se usa para
 *     nada — ya coincide 1:1 con la convención `${id}_${skin}.webp`, así
 *     que es puramente informativo en el JSON. Lo que importa es la
 *     CLAVE (el nombre del skin: "main", "enanos", etc.).
 *   - `name`/`desc`/`hist` se copian tal cual (fallback legado, ya
 *     soportado por `poi-panel.js`) Y además se arma `content.es` con
 *     el esquema multiidioma nuevo, para que ambos caminos funcionen.
 *
 * USO:
 *   <script src="js/app-state.js"></script>
 *   <script src="js/pois-loader.js"></script>
 *   <script>
 *     PoisLoader.loadFromJson('pois_cordoba.json')
 *       .then(() => console.log('POIs cargados'))
 *       .catch((err) => console.error(err));
 *   </script>
 *   (Ajustar el orden real de carga según tu index.html — lo importante
 *   es que `app-state.js` ya esté cargado antes de llamar a esta función.)
 * ============================================================================
 */

const PoisLoader = (function () {
  'use strict';

  const DEFAULT_JSON_PATH = 'pois_cordoba.json';

  /**
   * Convierte `raw.skins` (formato `{ nombreSkin: "archivo_stem" }`) al
   * formato que espera AppState: `{ nombreSkin: { url, style, active } }`.
   * El `url` que se guarda acá es la miniatura ("thumb") de esa variante,
   * pensada para el selector de skins dentro del panel — la imagen
   * principal/maximizada se sigue pidiendo aparte con `getImageUrl(id,
   * skin, 'full')` al abrir el POI.
   * @param {string} id - ID limpio del POI (ya unificado).
   * @param {Object} rawSkins
   * @returns {Object}
   */
  function _buildSkins(id, rawSkins) {
    const canBuildUrl = typeof AppState !== 'undefined' && typeof AppState.getImageUrl === 'function';
    const skinNames = rawSkins && typeof rawSkins === 'object' ? Object.keys(rawSkins) : [];

    const result = {};
    skinNames.forEach((skinName) => {
      result[skinName] = {
        url: canBuildUrl ? AppState.getImageUrl(id, skinName, 'thumb') : '',
        style: skinName,
        active: true,
      };
    });

    // 'main' es el fallback obligatorio (ver AppState.getEffectiveSkin) —
    // si por lo que sea no vino declarado en el JSON, lo agregamos igual.
    if (!result.main) {
      result.main = {
        url: canBuildUrl ? AppState.getImageUrl(id, 'main', 'thumb') : '',
        style: 'main',
        active: true,
      };
    }

    return result;
  }

  /**
   * Transforma un registro crudo de `pois_cordoba.json` al esquema
   * completo que usa AppState/Firestore.
   * @param {Object} raw
   * @returns {Object}
   */
  function _transformPoi(raw) {
    return {
      // --- Esquema nuevo (Firestore / AppState) ---
      id: raw.id,
      slug: raw.id, // ID unificado: slug === id, se deja como alias explícito
      category: raw.category || '',
      active_skin: 'main',
      coordinates: {
        lat: raw.lat,
        lng: raw.lng,
      },
      skins: _buildSkins(raw.id, raw.skins),
      content: {
        es: {
          name: raw.name || '',
          gancho: '',
          description: raw.desc || '',
          custom_fields: {},
        },
      },
      owner_uid: null,
      is_claimed: false,
      tier: 'free',

      // --- Campos legados planos (fallback que ya usa poi-panel.js) ---
      lat: raw.lat,
      lng: raw.lng,
      name: raw.name || '',
      desc: raw.desc || '',
      hist: raw.hist || '',
    };
  }

  /**
   * Carga `pois_cordoba.json`, lo transforma y lo entrega a AppState
   * (además de dejarlo en `window.POIS` por compatibilidad con
   * cualquier código legado que todavía lea esa variable directo).
   * @param {string} [jsonPath] - Ruta al JSON. Default: 'pois_cordoba.json' (raíz del proyecto).
   * @returns {Promise<Array<Object>>} el arreglo ya transformado.
   */
  async function loadFromJson(jsonPath) {
    const path = jsonPath || DEFAULT_JSON_PATH;

    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`[PoisLoader] No se pudo cargar "${path}": HTTP ${response.status}`);
    }

    const rawPois = await response.json();
    if (!Array.isArray(rawPois)) {
      throw new Error(`[PoisLoader] "${path}" no contiene un arreglo de POIs.`);
    }

    const transformed = rawPois.map(_transformPoi);

    window.POIS = transformed;

    if (typeof AppState !== 'undefined' && typeof AppState.loadPois === 'function') {
      AppState.loadPois(transformed);
    } else {
      console.warn('[PoisLoader] AppState no está cargado todavía — los POIs quedaron solo en window.POIS.');
    }

    return transformed;
  }

  return { loadFromJson };
})();

window.PoisLoader = PoisLoader;
