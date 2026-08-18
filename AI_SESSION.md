# AI_SESSION.md — memoria de trabajo de la sesión actual

> Uso: al empezar una sesión nueva, comprobar si esta información corresponde
> realmente a esa sesión (mismo día, mismo hilo de trabajo) antes de confiar
> en ella. Si un archivo listado como "revisado" fue modificado después,
> vuelve a estar pendiente de verificación.

## Sesión: 2026-08-18 — exclusividad de paneles, ojito y doble-click en panel

**Pedido (3 cosas, sin relación entre sí):**
1. Si hay un panel/menú abierto (panel de un pin, dropdown de zonas,
   panel de info de zona) y el usuario abre otro, el primero debe
   cerrarse YA MISMO — no esperar a que termine su animación de salida
   para que el segundo arranque. Con ejemplo concreto: pin abierto →
   toca "zonas" → el panel del pin empieza a cerrarse y 50ms después
   (mientras el panel del pin sigue cerrándose) el menú de zonas
   empieza a abrirse. Al revés (zonas abierto → toca un pin): zonas se
   cierra ya mismo, pero la secuencia YA establecida de ese click (ver
   `js/cluster.js`: paneo del mapa → maximizar pin → abrir panel) debe
   arrancar de inmediato, sin esperar los 50ms — pedido explícito de
   Cris de no tocar ese orden ni agregarle demora.
2. El "ojito" del panel (cicla imágenes activas sobre el pin
   maximizado, ver `cyclePinExpandedImage` en `js/markers.js`): con
   pocas imágenes activas de un total mayor cargado (ej. 2 de 10),
   Cris reportó que hacían falta ~10 clicks para volver a la primera
   imagen — percibido como bug de la página. Además, pidió sacar de la
   vista el numerito "1/10" (o el que sea) del badge del ojito, por
   ahora, porque confunde más de lo que ayuda.
3. Doble click (desktop) o doble tap (mobile) en cualquier parte del
   panel de un pin (esté abierto al tamaño "peek" o "full") debe
   pasarlo al otro estado — full→peek, peek→full.

**Archivos revisados en profundidad esta sesión:** `js/cluster.js`
completo, `js/poi-panel.js` completo, `js/markers.js` completo,
`js/zones.js` completo, `js/img-slots.js` completo, `js/utils.js`
(`buildImageFallbackChain`, `_orderedSkinNames`, `getActiveSkinList`),
`css/poi-panel.css` y `css/base.css` (transiciones de `#zona-panel`,
`#zonas-dropdown`, `.poi-panel[data-state]` — confirmado que todo el
abrir/cerrar de estos 3 paneles es 100% CSS-transition, no bloqueante
por JS, condición necesaria para que el mecanismo de exclusividad
funcione sin tocar animaciones existentes).

**Archivos creados/modificados esta sesión:**
- `js/overlay-manager.js` (**NUEVO**) — módulo `OverlayManager`:
  `register(id, {isOpen, close})`, `closeOthers(exceptId)`,
  `beforeOpen(id, openFn)` (cierra otros ya mismo; si cerró alguno,
  espera 50ms antes de `openFn`, si no, abre directo). Sin dependencia
  de ningún panel concreto — solo orquesta timing. Agregado a
  `index.html` justo después de `config.js` (antes de que cualquier
  panel lo use).
- `js/poi-panel.js` — `open()` reescrita: la apertura real quedó en
  `_openNow()` interna, invocada vía
  `OverlayManager.beforeOpen('poiPanel', _openNow)`. Registro del
  panel en `OverlayManager` (`isOpen`/`close`) al final del módulo.
  `_renderEyeBadge()` ya no pinta el numerito (`eyeCount.textContent`
  queda siempre `''`) — se deja `_getExpandedPinIndex` sin uso, con
  nota, por si se reactiva el contador más adelante. Nuevo bloque en
  `_bindStaticEvents()`: listener `dblclick` en `els.panel` +
  fallback manual de doble-tap táctil por `pointerup` (con guard de
  250ms entre ambos para que un mismo gesto no dispare el toggle 2
  veces), ambos ignorando `_isEditMode` y targets interactivos
  (botones/inputs/links).
- `js/markers.js` — `cyclePinExpandedImage()`: antes de avanzar,
  busca la posición REAL comparando `el.src` contra las URLs de
  `list` (imágenes activas); si no matchea ninguna (índice guardado
  desalineado o fuera de rango), salta directo a la primera activa en
  vez de sumar 1 a un índice que no correspondía a nada — 1 click
  siempre lleva a una imagen realmente disponible.
- `js/zones.js` — `openZonaPanel()` y `toggleZonasDropdown()`: la
  apertura real quedó en funciones internas (`_openZonaPanelNow`/
  `_openZonasDropdownNow`), invocadas vía `OverlayManager.beforeOpen`.
  Registro de `'zonasDropdown'` y `'zonaInfoPanel'` en
  `OverlayManager` al final del bloque de zonas.
- `js/cluster.js` — al principio de `pinClick()`, una sola línea:
  `OverlayManager.closeOthers('poiPanel')` (cierre inmediato de otros
  overlays, sin el delay de 50ms — ver punto 3 del pedido y sección 11
  de `AI_RULES.md`).
- `index.html` — agregado `<script src="js/overlay-manager.js" defer>`.
- `AI_RULES.md` — nueva sección 11 (patrón de `OverlayManager`,
  obligatorio para overlays nuevos), fila en la tabla de archivos,
  entrada en el orden de carga de scripts.

**Nota sobre el punto 2 (ojito):** al revisar el código antes de
tocarlo, se encontró que `getActiveSkinList`/`buildImageFallbackChain`
ya habían sido corregidas en una sesión anterior (comentarios
`[FIX 2026-08-16]` ya presentes en el ZIP) para que la lista de
"imágenes activas" que cuenta el ojito y la cadena de respaldo del pin
en el mapa usen el mismo criterio/orden. El fix de esta sesión ataca
específicamente la posible causa restante: que el ÍNDICE guardado
(`dataset.skinIndex`) quedara desalineado de la imagen realmente
mostrada — por eso ahora se recalcula comparando la URL puesta en el
`<img>` contra la lista activa en cada click, en vez de confiar en el
número guardado.

**Pruebas/verificaciones realizadas:** `node --check` sin errores en
los 5 archivos JS tocados/creados
(`overlay-manager.js`, `poi-panel.js`, `markers.js`, `zones.js`,
`cluster.js`). No se probó en navegador real (sin entorno con DOM en
esta sesión) — pendiente que Cris lo pruebe en su entorno: (a) abrir
un pin y tocar "zonas" y viceversa, confirmando el cruce
simultáneo/escalonado sin saltos; (b) un lugar con pocas imágenes
activas de un total mayor, confirmar que el ojito cicla en pocos
clicks y que el numerito ya no se ve; (c) doble click en desktop y
doble tap en mobile sobre el panel de un pin, en ambos tamaños.

**Pendiente / próximo paso exacto:** ninguno de estos 3 pedidos forma
parte de `PLAN_IMPORTACION_MASIVA.md` — son cambios de UI aparte. Si
Cris reporta algo raro al probar, lo primero a revisar es la consola
del navegador (no hay ningún `console.log`/`console.error` nuevo
agregado a propósito esta vez, salvo los ya existentes de
`OverlayManager.closeOthers` si un `close()` registrado tira error).

## Sesión: 2026-08-16 — Etapa 9: IDs estables por campo + importador `### TEXTO`

**Contexto:** en un chat previo (sin acceso al entorno de archivos en
ese momento) se armó y entregó el plan completo como documento
descargable (`plan-ids-campos-texto-smartcity.md`), sin tocar código.
En esta sesión, con el ZIP subido, Cris pidió ejecutarlo directo.

**Pedido:** poder actualizar título y/o texto de UN campo puntual de
UN pin (o de varios a la vez) pegando un bloque corto de texto, sin
tocar nombre/coordenadas/categoría/tags/imágenes de esos pines ni los
demás campos que no se mencionan.

**Archivos revisados en profundidad esta sesión:** `js/pin-adjust.js`
completo (bloque "CAMPOS DE INFORMACIÓN LIBRES POR PIN", el editor
manual ES/EN/PT, `parsePinBulkText`/`confirmBulkFullImport` de
`### PIN`, `parseImageLinkText`/`importImageLinksFromText` de
`### IMG` como referencia de patrón), `js/firestore-sync.js` completo
(`savePoiToFirestore`, `saveSkinsToFirestore`, `regeneratePublicCache`,
el objeto `FirestoreSync` que envuelve `AppState.updatePoi`),
`js/app-state.js` (`updatePoi`, `loadPois`, `getContent`),
`js/poi-panel.js` (`_resolveFields`, para confirmar que un `id` extra
en cada field no rompe nada), `index.html` (markup completo de la
pestaña Importar), `PLAN_IMPORTACION_MASIVA.md` completo (para
mantener la numeración de etapas y el modelo de datos consistentes).

**Archivos modificados esta sesión:**
- `js/pin-adjust.js` — `_nextFieldId()`/`_ensureFieldIds()` (nuevas);
  `_buildContentWithFields()` ahora asigna id a todo campo nuevo antes
  de guardar (cubre editor manual y `### PIN` desde un único lugar);
  `_readVisiblePinFieldRows()` ajustada para no perder el `id` de un
  campo ya existente al releer título/texto del DOM (el id no se
  muestra en pantalla); nuevo importador `### TEXTO`
  (`parseTextoBulkText`/`importTextoFieldsFromText`); nueva migración
  de un solo uso `migrateFieldIds()` (botón aparte, idempotente).
- `js/firestore-sync.js` — nueva `saveFieldsPartialToFirestore(id,
  idioma, fields)`, hermana de `saveSkinsToFirestore`, `merge:true`
  sobre `content.<idioma>.fields` únicamente.
- `index.html` — botón de migración + caja "🔤 Actualizar solo texto"
  (`### TEXTO`) en la pestaña Importar.
- `PLAN_IMPORTACION_MASIVA.md` — nueva Etapa 9 (registro completo),
  `ESTADO ACTUAL` y checklist actualizados, `id` sumado al modelo de
  datos definitivo.

**Hallazgo importante durante la implementación (no estaba en el plan
original tal cual, se resolvió al escribir el código):** el editor
manual del admin (`_renderPinFieldRows`) no muestra el `id` en pantalla
— solo título y texto. Si `_readVisiblePinFieldRows()` reconstruía las
filas leyendo SOLO esos 2 inputs, el `id` que un campo ya tenía se
perdía en cuanto el admin abría "Editar" y volvía a guardar sin tocar
nada — reasignando ids nuevos en cada guardado y rompiendo la
estabilidad que es el objetivo central de esta etapa. Se resolvió
recuperando el `id` por posición desde el estado en memoria
(`_pinFieldsState`), que sí lo conserva.

**Pruebas/verificaciones realizadas:** `node --check` sin errores en
`js/pin-adjust.js` y `js/firestore-sync.js`. Se extrajeron las
funciones puras nuevas (`_nextFieldId`, `_ensureFieldIds`,
`parseTextoBulkText`) a un script de Node aparte y se probaron con
casos concretos: asignación secuencial de ids nuevos, respeto de ids
ya existentes con huecos, un bloque `### TEXTO` con 2 pines válidos +
1 inexistente (correctamente descartado y reportado), un campo con
solo `texto:` (reconocido como "sin título"). También se simuló la
lógica completa de merge (actualizar solo un campo del array dejando
los demás intactos, crear un campo nuevo con datos completos, rechazar
la creación de uno con datos a medias) con resultados correctos. No
probado en navegador real ni contra Firestore real en esta sesión (sin
entorno con DOM en esta sesión) — pendiente que Cris lo pruebe en su
entorno: correr la migración una vez, después usar `### TEXTO` sobre
un pin con campos migrados y confirmar en el panel público que solo
cambió lo mencionado en el bloque.

**Pendiente / próximo paso exacto:** ver "ESTADO ACTUAL" de
`PLAN_IMPORTACION_MASIVA.md` — retomar la Etapa 8 (prueba real
end-to-end), sumando la migración de IDs y `### TEXTO` a esa prueba.

## Sesión: 2026-08-15 (3ª) — Etapa 2 del plan de importación masiva: panel renderiza campos título+texto

**Contexto:** Etapa 2 de `PLAN_IMPORTACION_MASIVA.md` (ver ese archivo
para el plan completo). Objetivo puntual de esta sesión: que el panel
público muestre los "campos internos" de cada lugar como bloques
verticales de "título arriba / texto abajo", cantidad libre, sin
ningún nombre de campo predefinido por el sistema.

**Archivos revisados en profundidad esta sesión:** `js/poi-panel.js`
(función `_render()` completa y `_renderMeta()`), `js/app-state.js`
(función `getContent()`), `css/poi-panel.css` (bloque de metadatos).

**Archivos modificados esta sesión:**
- `js/poi-panel.js` — nueva función `_resolveFields(poi, rawContent)`:
  resuelve los campos con fallback en cascada (1. `content[idioma].fields[]`
  nuevo → 2. `custom_fields` viejo → 3. `poi.attrs` legado del admin →
  4. `poi.hours` suelto como único campo "Horario", comportamiento
  preexistente que se preservó). `_renderMeta()` reescrita: en vez de
  imprimir el título como `tooltip` HTML (invisible salvo hover), ahora
  crea un bloque por campo con el título visible arriba (`<p
  class="poi-panel__field-title">`) y el texto abajo
  (`<p class="poi-panel__field-text">`).
- `css/poi-panel.css` — `.poi-panel__meta-row` pasó de fila horizontal
  con chips separados por punto a columna vertical (`flex-direction:
  column`); nuevas clases `.poi-panel__field-block` (con separador
  `border-top` entre bloques, no antes del primero),
  `.poi-panel__field-title` (mismo estilo que ya usaba
  `.poi-panel__section-title`, reutiliza las variables de Tipografía)
  y `.poi-panel__field-text` (mismo estilo que `.poi-panel__body`, con
  `white-space: pre-wrap` para respetar saltos de línea del texto
  cargado). Se eliminaron `.poi-panel__meta-item` y su pseudo-elemento
  `::after` (el separador de punto), ya sin uso.

**Lo que NO se tocó todavía (a propósito, es la Etapa 3):** ningún
lugar del proyecto escribe hoy `content[idioma].fields[]` — el editor
del admin (`_renderPinAttrsEditor`/`_readPinAttrsFromForm` en
`pin-adjust.js`) sigue escribiendo `poi.attrs` (legado, sin idioma).
Por eso el panel hoy en día seguirá mostrando el nivel 3 de fallback
(`poi.attrs`) para todos los pines existentes hasta que se haga la
Etapa 3 — es el comportamiento esperado, no un bug.

**Pruebas/verificaciones realizadas:** `node --check js/poi-panel.js`
sin errores de sintaxis. No se probó en navegador real (sin entorno
con DOM en esta sesión) — pendiente que Cris lo pruebe en su entorno;
como con el `poi.attrs` existente ya hay datos cargados en varios
pines, debería verse el cambio visual (título visible en vez de
tooltip) apenas se suba este ZIP, sin necesitar tocar el admin todavía.

**Pendiente / próximo paso exacto:** Etapa 3 — reescribir el editor de
campos del admin para que escriba directo a `content[idioma].fields[]`
con selector de idioma, y migrar lo que hoy está en `poi.attrs`. Ver
`PLAN_IMPORTACION_MASIVA.md` para el detalle completo.

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
