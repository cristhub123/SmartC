# AI_SESSION.md — memoria de trabajo de la sesión actual

> Uso: al empezar una sesión nueva, comprobar si esta información corresponde
> realmente a esa sesión (mismo día, mismo hilo de trabajo) antes de confiar
> en ella. Si un archivo listado como "revisado" fue modificado después,
> vuelve a estar pendiente de verificación.

## Sesión: 2026-08-15 (2ª) — banner del panel separado del pin + ojito recorre el pin maximizado

**Pedido:** 2 cosas.
1. El banner del panel de cada lugar no debe usar la imagen del pin —
   debe ser una imagen aparte, guardada en Cloudinary en
   `.../{país}/{prov}/{ciudad}/banner/` (carpeta hermana de `images/`).
   Si no hay banner, el hueco debe quedar en 0px de alto.
2. El "ojito" (que hasta ahora cambiaba la imagen del banner) debe dejar
   de tocar el banner y pasar a recorrer las imágenes alternativas
   ACTIVAS del lugar sobre la imagen MAXIMIZADA del pin en el mapa,
   saltando las que estén con el toggle apagado.

**Archivos revisados en profundidad esta sesión:** `js/poi-panel.js`
(completo), `js/markers.js` (completo), `js/utils.js` (completo),
`js/cloudinary-admin.js` (completo), `js/img-slots.js` (completo),
`js/pin-adjust.js` (secciones saveNew/saveEdit/resetAddTab/bulk-import),
`js/admin.js` (startEdit), `css/poi-panel.css` (bloque `.poi-panel__hero`),
`index.html` (markup de las tabs Nuevo/Editar), `js/firestore-sync.js`
(savePoiToFirestore, para confirmar que no filtra campos nuevos como
`banner`), `js/app-state.js` (para confirmar que no filtra campos al leer).

**Archivos modificados esta sesión:**
- `js/cloudinary-admin.js` — `buildFolder(location, subfolder)` acepta
  2do parámetro (`'images'` por defecto, `'banner'` nuevo).
- `js/utils.js` — `uploadToCloudinary`/`_uploadCtx` propagan `subfolder`;
  nueva función global `getActiveSkinList(poi)` (antes vivía privada
  y duplicada dentro de `poi-panel.js`); nuevo bloque de uploaders
  "Imagen banner del panel" (`img-input-banner-add/edit` +
  `img-url-banner-add/edit`) que suben a la carpeta `banner/`; nuevas
  variables `window._addBannerImg`/`window._editBannerImg`.
- `index.html` — nuevo campo "Imagen banner del panel" en las tabs Nuevo
  y Editar (uploader + input de URL), debajo del bloque de imágenes
  alternativas.
- `js/admin.js` (`startEdit`) — prefill del preview del banner desde
  `p.banner.url` al abrir "Editar".
- `js/pin-adjust.js` — `saveNew()`/`saveEdit()` guardan `banner: {url}`
  (o `null`) en el documento del POI; `resetAddTab()` limpia también el
  campo banner.
- `js/markers.js` — `swapPinToFullQuality`/`restorePinThumbQuality`
  ahora manejan un flag `dataset.userCycled` para no pisar una imagen
  que el usuario ya eligió con el ojito; nueva función
  `cyclePinExpandedImage(id)` (recorre `getActiveSkinList(poi)` sobre
  el `<img>` del pin maximizado, en loop, respetando el toggle activo).
- `js/poi-panel.js` — `_renderHeroImage` reescrita: usa `poi.banner.url`
  en vez de la lista de skins del pin; se eliminó `_heroSkinIndex`;
  `_getActiveSkinList` pasó a ser un wrapper de la función global de
  `utils.js`; nueva `_getExpandedPinIndex(poiId)` (lee el índice actual
  desde el `<img>` del pin en el mapa); `_renderEyeBadge` y el listener
  de `eyeBtn` ahora llaman a `cyclePinExpandedImage` de `markers.js` en
  vez de tocar el hero local.
- `AI_RULES.md` — nueva sección 10 documentando la separación banner
  vs. imagen del pin.

**Pruebas/verificaciones realizadas:** `node --check` sobre los 35 `.js`
del proyecto (sin errores de sintaxis) después de cada tanda de cambios.
No se probó en navegador real (sin entorno con DOM/Firestore/Cloudinary
en esta sesión) — pendiente que el usuario lo pruebe en su entorno.

**Pendiente / a criterio de sesiones futuras:**
- El importador masivo de texto (`importImageLinksFromText` en
  `pin-adjust.js`) sigue apuntando siempre a la carpeta `images/` — no
  se conectó con la carpeta `banner/`. Si en el futuro se quiere cargar
  banners por lote de texto, hay que extenderlo a propósito.
- Edge case menor no resuelto: la primera imagen que se ve al maximizar
  un pin (resuelta por la cadena de fallback de `markers.js`, basada en
  cuál carga con éxito) no está garantizado que sea exactamente
  `getActiveSkinList(poi)[0]` en el 100% de los casos (por ejemplo si el
  tema noche está activo globalmente). El contador del ojito arranca
  igual en "1/N" al abrir un pin; en el peor caso el primer click podría
  repetir una imagen ya vista antes de seguir el orden. No reportado
  como bug por el usuario, queda anotado por si se nota en uso real.



**Archivos revisados en profundidad esta sesión:**
- `index.html` (solo orden de `<script>`, no el resto del HTML)
- Todos los `.js` de `js/` (barrido de: funciones top-level, asignaciones a
  `window.*`, variables globales `let`/`const`/`var` de nivel superior)
- `js/app-state.js`, `js/poi-panel.js`, `js/cloudinary-admin.js`,
  `js/pois-loader.js` (API pública / notas internas, no línea por línea)
- `js/markers.js` y `js/cluster.js` (caso `pinClick` duplicado)

**No revisados en profundidad esta sesión** (no hacía falta para esta
tarea, no asumir que están auditados): contenido completo de `css/base.css`,
`css/poi-panel.css`, `index.html` (cuerpo HTML/CSS inline), `pois_cordoba.json`,
`README.md`, `vercel.json`, `netlify.toml`, `CAMBIOS.txt`.

**Archivos modificados esta sesión:**
- Creado `AI_RULES.md` (nuevo, raíz del proyecto)
- Creado `AI_SESSION.md` (nuevo, raíz del proyecto — este archivo)
- Se agregó el encabezado de comentario estándar (ver `AI_RULES.md` sección
  "encabezados") al inicio de todos los `.js` propios del proyecto y de
  `css/base.css` / `css/poi-panel.css`. **No se tocó ninguna otra línea de
  esos archivos** — cero cambios funcionales.

**Pruebas/verificaciones realizadas:** ninguna funcional (tarea era
documentación pura, sin tocar comportamiento). Se verificó por lectura que
los encabezados quedaron como comentario válido en cada tipo de archivo
(`/* ... */` en JS y CSS) y que no se tocó ninguna otra línea.

**Inconsistencias arquitectónicas encontradas (no corregidas, solo
documentadas):**
1. `markers` es `let markers = {}` en `config.js` (variable de scope de
   script), **no** `window.markers`. Código legacy (`pois-bootstrap.js`,
   hoy desconectado) asumía que sí lo era — ver `AI_RULES.md` sección 4.
2. Dos funciones `pinClick` (una en `markers.js`, otra real/activa en
   `cluster.js`) — ya estaba documentado con un comentario in-situ en
   `markers.js` antes de esta sesión; se formalizó también en
   `AI_RULES.md` sección 6.
3. `js/pois-loader.js` y `js/pois-bootstrap.js` siguen en el repo pero
   están **desconectados** de `index.html` (comentados) desde una sesión
   anterior (`fix-mapa-pines`). No es un hallazgo nuevo, pero queda
   documentado en `AI_RULES.md` sección 2 para que ninguna sesión futura
   los reactive por error.

**Pendiente / a criterio de sesiones futuras:** ninguna corrección de
código en esta sesión — es intencional, la tarea era solo documentación.
