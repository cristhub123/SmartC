# PLAN_IMPORTACION_MASIVA.md — Plan de trabajo persistente
### Importación masiva de lugares + contenido multi-idioma (ES/EN/PT)

> ═══════════════════════════════════════════════════════════════
> CÓMO USAR ESTE ARCHIVO (leer esto primero, siempre)
> ═══════════════════════════════════════════════════════════════
> Este archivo NUNCA se borra ni se resetea (a diferencia de
> CAMBIOS.txt). Cada etapa que se completa se AGREGA al final de
> "REGISTRO POR ETAPA" — el historial completo queda siempre.
>
> Si sos una IA retomando este trabajo en un chat nuevo:
> 1. Leé la sección "ESTADO ACTUAL" de abajo — te dice en qué etapa
>    estamos y qué es lo próximo a hacer, con la lista exacta de
>    archivos a revisar. NO hace falta releer todo el proyecto.
> 2. Solo si "ESTADO ACTUAL" te manda a un archivo puntual, revisalo.
>    El resto del contexto ya está en este documento y en
>    AI_RULES.md / AI_SESSION.md (arquitectura general del proyecto).
> 3. Al terminar una etapa: agregá una entrada nueva en "REGISTRO POR
>    ETAPA" (nunca edites/borres entradas viejas), actualizá el
>    checklist de "PLAN GENERAL", y reescribí "ESTADO ACTUAL" para
>    que apunte a la etapa siguiente.
> 4. Entregá el ZIP completo del proyecto con este archivo actualizado
>    adentro, nombrado `smartcityV3.0_AAAA-MM-DD_HHMM.zip`.

---

## ESTADO ACTUAL

**Última etapa completada:** Etapa 9 — cada campo de `fields[]` tiene
ahora un `id` estable (`campo-01`, `campo-02`...) dentro de su idioma,
y hay un tercer importador de texto, `### TEXTO`, para actualizar
título y/o texto de un campo puntual (de uno o varios pines a la vez)
sin tocar nada más del pin. Se hizo fuera de orden respecto al plan
original (la Etapa 8, prueba end-to-end, sigue pendiente — ver abajo)
porque Cris lo pidió puntualmente como plan aparte y después pidió
ejecutarlo directo.

**⚠️ Aviso pendiente para Cris, sigue en pie desde la Etapa 5/6 (no
se tocó en la Etapa 7 ni en la 9):** el importador de texto masivo
(`### PIN`) reemplaza el documento completo al actualizar un pin
existente — categoría, banner, descripción/historia vieja, teléfono,
horario viejo, estado publicado y posición/tamaño del pin en el mapa
se pueden perder al reimportar. El reporte de "Revisar antes de
importar" (Etapa 6) avisa esto en rojo antes de confirmar, pero no lo
soluciona. `### TEXTO` (Etapa 9) es justamente la herramienta a usar
en su lugar cuando lo único que se quiere tocar es el texto de un
campo — no reemplaza `### PIN`, es un camino alternativo más seguro
para ese caso puntual. Ver el registro de la Etapa 6 para el detalle
completo del aviso original.

**Próxima etapa a hacer:** Etapa 8 — Prueba real end-to-end: cargar
3-5 lugares reales (no de prueba) con contenido en los 3 idiomas
usando el importador (Etapas 5/6), y confirmar en el navegador real
que todo el circuito funciona junto: importar → ver en el panel en
cada idioma vía el selector del header (Etapa 7) → editar un campo a
mano desde el admin (Etapa 3) → reimportar el mismo lugar sin perder
lo que no se tocó. Con la Etapa 9 ya hecha, conviene sumar a esa
prueba: correr la migración de IDs una vez, después actualizar el
texto de un campo puntual con `### TEXTO` y confirmar en el panel que
el resto de los campos de ese pin no cambió. Es una etapa de
verificación con Cris en su entorno real, no de código nuevo de
entrada — salvo que la prueba encuentre algo para corregir, en cuyo
caso esa corrección se documenta como parte de esta misma etapa.

**No hace falta ningún archivo puntual para arrancar la Etapa 8** — es
una prueba guiada por Cris en su navegador, con los formularios ya
construidos (Editar en `js/admin.js`/`pin-adjust.js`, los 3 importadores
de texto en `index.html` — `### PIN`/`### IMG`/`### TEXTO` —, el botón
de migración de IDs, y el selector de idioma en el header). Si algo
falla durante la prueba, ese es el punto de partida para la próxima
sesión de código.

**Ver el registro completo de la Etapa 9 más abajo** para el detalle
línea por línea de qué se cambió.

---

## PLAN GENERAL (etapas)

- [x] **Etapa 1** — Definir el modelo de datos definitivo (diseño, sin código)
- [x] **Etapa 2** — Panel público: renderizar `content[idioma].fields[]` (título+texto, cantidad libre, sin nombres fijos)
- [x] **Etapa 3** — Admin: editor de campos que escribe directo a `content[idioma].fields[]`, con selector de idioma
- [x] **Etapa 4** — ~~Migración de datos viejos~~ DESCARTADA (2026-08-15): pines actuales son solo de prueba, no hace falta migrar; ver registro de la Etapa 4 más abajo para el motivo completo
- [x] **Etapa 5** — Importador de texto masivo: aceptar bloques ES/EN/PT con campos numerados libres
- [x] **Etapa 6** — Validación previa a importar (reporte antes de escribir en Firestore)
- [x] **Etapa 7** — Selector de idioma global (sacarlo del panel, notificar a toda la app)
- [ ] **Etapa 8** — Prueba real end-to-end con 3-5 lugares en los 3 idiomas, antes de la carga masiva definitiva
- [x] **Etapa 9** — IDs estables por campo (`campo-01`, `campo-02`...) + importador `### TEXTO` para actualizar solo título/texto de un campo puntual, sin tocar el resto del pin. Hecha fuera de orden (Etapa 8 sigue pendiente), a pedido explícito de Cris.

Este orden es el recomendado pero no es rígido: si al hacer una etapa
aparece algo que obliga a reordenar, se documenta en el registro de esa
etapa (ver regla de "desvíos" abajo) y se actualiza este checklist.

---

## MODELO DE DATOS DEFINITIVO (resultado de la Etapa 1)

```
poi = {
  // ── Identidad y ubicación (YA IMPLEMENTADO, no tocar en este plan) ──
  id, active, lat, lng, country, province, city,
  categories: [...], tags: [...],
  icon, pinScale, pinOffsetX, pinOffsetY,
  skins: {...}, banner: {...},

  // ── Contenido multi-idioma (ESTO ES LO QUE FALTA CONSTRUIR) ──
  content: {
    es: {
      name: "...",
      gancho: "...",
      description: "...",
      fields: [
        { id: "campo-01", title: "...", text: "..." },
        { id: "campo-02", title: "...", text: "..." },
        // cantidad LIBRE — puede haber 0, 1, 5 o 12. Nunca un
        // límite fijo en el código, y NUNCA un título predefinido
        // tipo "Dato curioso"/"Horario" — el título lo escribe
        // quien carga el contenido, campo por campo.
        // [Etapa 9, 2026-08-16] `id` (`campo-01`, `campo-02`...) es
        // estable por campo, vive DENTRO de este array (no es único
        // entre pines ni entre idiomas de un mismo pin) — permite
        // referenciar "el campo 2 de este idioma" desde el importador
        // `### TEXTO` sin depender de su posición. Lo asigna
        // `_ensureFieldIds()` (pin-adjust.js) automáticamente cada vez
        // que se crea un campo nuevo, desde donde sea (editor manual,
        // `### PIN`, o la migración de un solo uso).
      ]
    },
    en: { name, gancho, description, fields: [...] },
    pt: { name, gancho, description, fields: [...] }
  },

  // ── Legado (fallback de compatibilidad, NO se borra) ──
  name, desc, hist, hours, attrs: [{l, v}, ...]
}
```

**Reglas fijadas para este modelo (decisión de Cris, no reabrir sin
avisar):**
1. `fields[]` es un array, no un objeto de claves fijas — cada campo es
   simplemente "el campo N de este lugar", con su propio título y texto
   libres. El sistema no conoce ni impone ningún nombre de campo.
2. No hay cantidad mínima ni máxima fija en el código. (Nota: en una
   sesión anterior se había hablado de un límite configurable de 5 con
   override por POI — Cris después aclaró explícitamente que **no**
   quiere ningún límite fijo, ni de cantidad ni de nombre. Esta versión
   reemplaza esa idea anterior.)
3. Los 3 idiomas son independientes entre sí: un lugar puede tener 4
   campos en español y solo 2 en inglés si todavía no se tradujo el
   resto — el panel debe soportar esa asimetría sin romperse (fallback
   a español si falta el idioma pedido, regla ya definida en
   `app-state.js`/`FALLBACK_LANG`, se reusa tal cual).
4. `attrs` (el sistema viejo, sin idioma) se mantiene como fallback de
   compatibilidad para pines ya cargados, nunca como fuente de verdad
   para pines nuevos.

---

## REGISTRO POR ETAPA

### Etapa 1 — Modelo de datos definitivo (2026-08-15)

**Qué se pidió:** Cris le pidió a ChatGPT un análisis completo del
sistema de carga masiva de lugares con contenido en 3 idiomas y campos
de texto internos versátiles (sin títulos ni cantidad fijos). ChatGPT
devolvió un diagnóstico de 21 puntos y un plan de 17 etapas.

**Qué se hizo:** Se auditó ese diagnóstico contra el código real del
ZIP (no contra memoria/suposiciones). Confirmado con lectura directa
de código:
- El bug central es real: `js/pin-adjust.js` escribe `poi.attrs`
  (array `{l,v}`, sin idioma), pero `js/poi-panel.js` únicamente lee
  `poi.content[idioma].custom_fields` (objeto de claves, no array) —
  son dos sistemas que nunca se conectaron.
- Nada en el proyecto escribe hoy `poi.content` en absoluto — la
  infraestructura de idioma (`AppState.setLanguage/getContent`, ES/EN/PT
  en el panel) es real y global, pero no tiene datos que mostrar.
- País/provincia/ciudad, categorías/tags, imágenes (`skins`/`banner`)
  e ID explícito con lat/lng **ya están resueltos** de sesiones
  anteriores (ver `AI_SESSION.md`/`CAMBIOS.txt`) — no forman parte de
  este plan, se dejan afuera del alcance.
- El importador que ChatGPT usó como referencia principal
  (`js/content-import.js`) es una herramienta vieja y angosta (sin
  lat/lng, sin país/provincia/ciudad, sin `attrs`) — el importador real
  y completo es `parsePinBulkText`/`importFullPinsFromText` en
  `js/pin-adjust.js`.
- Se definió el modelo de datos final (arriba) con el array `fields[]`
  libre, sin títulos ni cantidad predefinidos, según la aclaración
  explícita de Cris.

**Resultado:** Modelo de datos acordado y documentado. Ningún archivo
de código fue modificado todavía.

**Desvíos del plan original:** El plan de 17 etapas de ChatGPT se
redujo a 8, porque varias de sus etapas (país/provincia/ciudad,
categorías, Cloudinary, geolocalización) ya estaban completadas en
sesiones previas y no hace falta retrabajarlas. También se descartó la
idea de un "límite configurable de campos" que había surgido en una
charla anterior — Cris pidió explícitamente que no haya ningún límite
ni título fijo.

**Archivos tocados:** Ninguno (solo se creó este archivo de plan).

**Qué falta / próximo paso exacto:** Etapa 2 — reescribir
`_renderMeta()` en `js/poi-panel.js` para que lea
`content[idioma].fields[]` (array) en vez de `custom_fields` (objeto),
y renderice cada campo como bloque "título arriba / texto abajo" (hoy
el título se pone como `tooltip` HTML, invisible salvo hover — hay que
cambiar eso a un elemento de texto visible). Mantener el fallback a
`poi.hours` que ya existe. Archivos involucrados: `js/poi-panel.js`,
posiblemente `css/poi-panel.css` para el estilo de los bloques nuevos.

---

### Etapa 2 — Panel público renderiza campos título+texto (2026-08-15)

**Qué se pidió:** lo que quedó anotado como próximo paso en la Etapa 1
(ver arriba).

**Qué se hizo:** en `js/poi-panel.js`, nueva función `_resolveFields(poi,
rawContent)` con fallback en cascada: (1) `content[idioma].fields[]`
— el esquema definitivo, array libre de `{title, text}` — (2)
`custom_fields` (objeto, esquema intermedio ya en desuso, se sigue
leyendo por si quedó algo cargado con esa forma) — (3) `poi.attrs`
(array `{l,v}`, el que escribe HOY el editor del admin, sin idioma —
este es el nivel que efectivamente se usa mientras no se haga la Etapa
3) — (4) `poi.hours` suelto como único campo "Horario" (comportamiento
legado preexistente, se preservó tal cual). `_renderMeta()` reescrita
para crear un bloque por campo con el título como texto visible arriba
(antes era un `tooltip` HTML invisible salvo hover) y el texto abajo,
sin límite de cantidad. CSS actualizado en `css/poi-panel.css`: la fila
horizontal de chips pasó a columna vertical con separador entre
bloques, reutilizando las variables de la pestaña Tipografía que ya
existían (`--pines-section-*`/`--pines-body-*`) para que el estilo se
mantenga consistente con el resto del panel.

**Resultado:** `node --check js/poi-panel.js` sin errores. No probado
en navegador real (sin entorno con DOM en esta sesión) — Cris debería
ver el cambio apenas suba este ZIP: los pines que ya tienen `attrs`
cargado van a mostrar el título visible en vez de solo al pasar el
mouse, sin necesitar ningún cambio en el admin todavía.

**Desvíos del plan original:** ninguno — se hizo tal cual quedó
planteado en la Etapa 1.

**Archivos tocados:** `js/poi-panel.js`, `css/poi-panel.css`,
`AI_SESSION.md` (nueva entrada de sesión).

**Qué falta / próximo paso exacto:** Etapa 3 — el editor de campos del
admin (`pin-adjust.js`) sigue escribiendo `poi.attrs` (nivel 3 del
fallback), no `content[idioma].fields[]` (nivel 1, el definitivo).
Mientras no se haga la Etapa 3, el panel funciona pero sin
multi-idioma real en los campos (todos los idiomas ven el mismo
`poi.attrs`, vía fallback). Archivos a tocar: `js/pin-adjust.js`
(`_renderPinAttrsEditor`/`_readPinAttrsFromForm`/`saveNew`/`saveEdit`),
`index.html` (markup del editor en las tabs Nuevo/Editar).

---

### Etapa 3 — Admin: editor de campos escribe `content[idioma].fields[]` (2026-08-15)

**Qué se pidió:** lo que quedó anotado como próximo paso en la Etapa 2
(ver arriba).

**Qué se hizo:** en `js/pin-adjust.js` se reescribió por completo el
bloque "CAMPOS DE INFORMACIÓN LIBRES POR PIN": se sacaron
`_renderPinAttrsEditor()`/`_readPinAttrsFromForm()` (leían/escribían
`poi.attrs`, sin idioma) y se agregaron en su lugar:
- `_renderPinFieldsEditor(wrapId, content)` — inicializa el editor
  (usado en los dos formularios, Nuevo y Editar) a partir de
  `poi.content` completo, arrancando siempre en la pestaña ES.
- Una barra de pestañas ES/EN/PT (`_renderPinFieldsLangTabs`),
  insertada dinámicamente arriba de las filas, con contador de campos
  por idioma. Al cambiar de pestaña se sincronizan primero las filas
  visibles al estado en memoria (`_pinFieldsState`) antes de mostrar
  el otro idioma — así no se pierde nada tipeado al ir y volver entre
  idiomas sin guardar todavía.
- `_readPinFieldsFromForm(wrapId)` — devuelve `{es:[...], en:[...],
  pt:[...]}` ya filtrado (sin filas vacías), listo para mandar a
  Firestore.
- `_buildContentWithFields(existingContent, fieldsByLang)` — arma el
  `content` final preservando `name`/`gancho`/`description`/
  `custom_fields` que ya existieran por idioma (de otras etapas/
  herramientas, ej. `cloudinary-admin.js`) y reemplazando solo
  `fields[]`.

`saveNew()` y `saveEdit()` ahora arman `content:
_buildContentWithFields(...)` en vez de `attrs: ...`. En `saveEdit()`
el campo `attrs` legado del pin YA NO se toca (queda igual que estaba,
vía el spread `...POIS[idx]`), sigue sirviendo de fallback para pines
no migrados. En `saveNew()` los pines nuevos nacen sin `attrs` en
absoluto (regla 4 del modelo de datos).

`js/admin.js` (`startEdit()`) se actualizó para llamar a
`_renderPinFieldsEditor('e-attrs-wrap', p.content || {})` en vez de
pasarle `p.attrs`.

**Desvío del plan original (importante):** al revisar `js/app-state.js`
(no estaba en la lista de archivos a chequear de la Etapa 2/3, pero
hacía falta) se encontró que `AppState.getContent()` arma el objeto de
contenido a mano campo por campo (`name`, `gancho`, `description`,
`custom_fields`) y **no incluía `fields[]` en absoluto** — lo
descartaba silenciosamente. Sin corregir esto, todo lo que escribiera
el editor nuevo en `content[idioma].fields[]` nunca habría llegado a
`js/poi-panel.js` (que lee vía `AppState.getContent()`), y la Etapa 3
habría quedado sin efecto visible pese a estar "bien implementada" en
el admin. Se agregó `fields` al objeto que devuelve `getContent()`,
con la misma lógica de fallback a español que ya tenían `name`/
`gancho`/`description`, pero sin mezclar arrays entre idiomas (si el
idioma pedido no tiene campos cargados todavía, se usa el array
completo de español; si los tiene, se usa tal cual, no se combinan
entradas de los dos idiomas).

**Resultado:** `node --check` sin errores en `js/pin-adjust.js`,
`js/admin.js` y `js/app-state.js`. No probado en navegador real (sin
entorno con DOM en esta sesión) — a validar por Cris: cargar 2-3
campos en ES, cambiar a EN y cargar campos distintos, guardar, y
confirmar en el panel público que el selector de idioma muestra cada
lista por separado.

**Archivos tocados:** `js/pin-adjust.js`, `js/admin.js`,
`js/app-state.js`.

**Qué falta / próximo paso exacto:** Etapa 4 — migración de pines
viejos (`attrs` sin `content.es.fields`) a `content.es.fields[]`. Ver
detalle en "ESTADO ACTUAL" arriba.

---

### Etapa 4 — DESCARTADA, no se hace (2026-08-15)

**Qué se pidió:** seguir con la Etapa 4 tal como quedó planteada en la
Etapa 3 (migrar pines viejos de `attrs` a `content.es.fields[]`).

**Qué se hizo:** antes de programar nada, Cris aclaró que todos los
pines que existen hoy en Firestore son solo de prueba (para verificar
que el sistema nuevo funciona) — no le importa perderlos y los puede
borrar de Cloudinary/Firestore cuando quiera. La carga real de datos
todavía no arrancó. Se evaluó que la Etapa 4, tal como está definida,
solo sirve para esos pines de prueba actuales: no es una función que
vaya a necesitar ningún otro sistema del proyecto a futuro, porque
tanto el editor manual (Etapa 3, ya hecho) como el importador masivo
(Etapa 5, próximo paso) escriben directo a `content[idioma].fields[]`
desde el vamos, sin pasar nunca por `attrs`. El panel público sigue
funcionando bien para pines viejos gracias al fallback de la Etapa 2,
así que no migrar no rompe nada.

**Resultado:** Etapa 4 descartada del plan. Ningún archivo de código
fue modificado — solo este documento de plan.

**Desvíos del plan original:** se elimina la Etapa 4 del orden
original de 8 etapas. Si en el futuro Cris decide que sí hace falta
migrar pines (por ejemplo si ya cargó datos reales con `attrs` antes
de terminar de leer este documento), esta decisión se puede reabrir
sin problema — no se borró nada, `attrs` nunca se tocó.

**Archivos tocados:** ninguno (solo este archivo de plan).

**Qué falta / próximo paso exacto:** Etapa 5 — Importador de texto
masivo, escribiendo directo a `content[idioma].fields[]`. Ver detalle
en "ESTADO ACTUAL" arriba.

---

### Etapa 5 — Importador de texto masivo con ES/EN/PT (2026-08-15)

**Qué se pidió:** lo que quedó anotado como próximo paso en la Etapa 4
(ver arriba) — que `parsePinBulkText`/`importFullPinsFromText` en
`js/pin-adjust.js` acepten bloques con campos en los 3 idiomas y
escriban directo a `content[idioma].fields[]`, en vez de al viejo
`poi.attrs` plano.

**Qué se hizo:** en `js/pin-adjust.js`:
- El formato de texto se extendió: la sección `campos:` (sin sufijo)
  sigue siendo español, igual que siempre — no cambia nada para texto
  ya escrito antes. Se agregaron `campos_en:` y `campos_pt:`
  opcionales, mismo formato título+texto indentado, cantidad libre.
  Cualquiera de los 3 puede faltar en un bloque.
- `parsePinBulkText()` ahora arma `data.fields = {es:[], en:[], pt:[]}`
  (en vez del viejo `data.attrs` plano) y además registra en
  `data.providedLangs` qué idiomas aparecieron de verdad en el texto
  (aunque hayan quedado con 0 campos válidos). Esto se guarda
  temporalmente en cada pin parseado como `_bulkFields`/
  `_bulkProvidedLangs`.
- `importFullPinsFromText()` — recién en este punto (donde ya se sabe
  si el pin es nuevo o ya existía en `POIS`) convierte eso a
  `content[idioma].fields[]` con `_buildContentWithFields()` (la misma
  función de la Etapa 3): para cada idioma, si apareció en el bloque
  de texto usa lo que se acaba de parsear; si NO apareció, conserva lo
  que ese idioma ya tenía cargado en Firestore (no lo pisa con una
  lista vacía). Los campos temporales `_bulkFields`/
  `_bulkProvidedLangs` se borran antes de guardar — nunca llegan a
  Firestore.
- El importador YA NO escribe `poi.attrs` en absoluto, ni para pines
  nuevos ni para actualizaciones (regla 4 del modelo de datos).
- `index.html`: se actualizó el texto de ayuda y el placeholder del
  textarea del formulario "Importar lugares completos" para mostrar el
  nuevo formato con `campos_en:`.

**⚠️ Punto importante para Cris — leer antes de usar el importador
para actualizar pines existentes:** esta herramienta (`importFullPinsFromText`,
el botón "📥 Importar lugares completos") guarda el documento COMPLETO
en Firestore con `merge:false` — es decir, cuando actualiza un pin que
ya existía, reemplaza TODO el documento por lo que hay en `p` (esto ya
era así antes de esta etapa, no es un cambio nuevo). La única
excepción que se armó en esta etapa es específicamente `content[idioma].fields`:
ahí sí se preserva por idioma lo que no se mencionó en el bloque de
texto. Pero otros campos del pin que el bloque de texto no vuelve a
escribir explícitamente (ej. categoría, banner, `pinScale`/offsets del
pin en el mapa) SÍ pueden perderse al reimportar un pin ya existente
con este botón — ese comportamiento es previo a esta etapa y quedó
igual, no se tocó. Si en algún momento pensás usar este importador
para actualizar (no solo crear) lugares que ya tengan esos datos
cargados a mano desde el admin, avisá para revisarlo antes — no es
parte del alcance de la Etapa 5, pero es bueno tenerlo anotado para no
llevarse una sorpresa.

**Resultado:** `node --check js/pin-adjust.js` sin errores. Se probó
`parsePinBulkText()` con un bloque de prueba en Node (fuera del
navegador, sin Firestore real) con `campos:`+`campos_en:` y sin
`campos_pt:` — el resultado fue el esperado: `es` y `en` con sus
campos, `pt` vacío y ausente de `providedLangs` (para que en un update
no se pise). No probado en navegador real ni contra Firestore real en
esta sesión — a validar por Cris: importar un pin nuevo con los 3
idiomas, después reimportar el mismo bloque cambiando solo
`campos_en:` y confirmar en el panel que ES y PT no se alteraron.

**Desvíos del plan original:** ninguno en el alcance pedido. Se
identificó (no se corrigió, ver aviso arriba) que el importador
reemplaza el documento completo en Firestore al actualizar, más allá
del tratamiento especial que se le dio a `content[idioma].fields` acá.

**Archivos tocados:** `js/pin-adjust.js`, `index.html`.

**Qué falta / próximo paso exacto:** Etapa 6 — Validación previa a
importar: mostrar un reporte de qué se va a crear/actualizar/qué
errores hay ANTES de escribir nada en Firestore (hoy `importFullPinsFromText`
guarda directo y recién después muestra el reporte). Archivos a tocar:
`js/pin-adjust.js` (`parsePinBulkText`, `importFullPinsFromText`),
`index.html` (agregar el paso de previsualización/confirmación en la
UI antes del botón de importar definitivo).

---

### Etapa 6 — Validación previa a importar, con reporte de "qué se pierde" (2026-08-15)

**Qué se pidió:** lo que quedó anotado como próximo paso en la Etapa 5
(ver arriba) — separar el importador en "parsear y mostrar reporte" y
"guardar en Firestore", con confirmación del admin en el medio.

**Qué se hizo:** en `js/pin-adjust.js`, `importFullPinsFromText()` se
partió en 3 funciones:
- `previewBulkFullImport()` — botón "🔍 Revisar antes de importar".
  Parsea el texto (`parsePinBulkText`, sin cambios ahí) y arma el
  reporte de previsualización, sin tocar Firestore. Lo parseado queda
  guardado en `_pendingBulkFullImport` (variable de módulo) a la
  espera de confirmación.
- `_buildBulkImportPreviewHtml(pins, errors)` — arma el HTML del
  reporte: cuántos pines son nuevos, cuántos van a actualizar uno
  existente (comparando contra `POIS` en memoria), qué idiomas de
  `campos_es`/`campos_en`/`campos_pt` trae cada bloque, cuántas
  imágenes vincula.
- `confirmBulkFullImport()` — botón "✅ Confirmar e importar", el
  único lugar que ahora escribe en Firestore. Usa lo que quedó en
  `_pendingBulkFullImport` (la conversión a `content[idioma].fields[]`
  con `_buildContentWithFields`, igual que en la Etapa 5, se mudó acá
  sin cambios de lógica).
- `cancelBulkFullImport()` — botón "✖ Cancelar", descarta el pendiente
  sin guardar nada ni borrar el texto tipeado.
- Si el admin sigue editando el textarea DESPUÉS de pedir la vista
  previa, un listener de `input` invalida automáticamente el pendiente
  (`cancelBulkFullImport()`) — así nunca puede confirmar algo distinto
  de lo que vio en el reporte.

**Hallazgo importante — el reporte ahora avisa la pérdida de datos
real, no solo la de `content.fields`:** al armar el reporte se
revisó a fondo qué campos escribe `parsePinBulkText()` con valor fijo
sin importar lo que el pin ya tuviera cargado, y son más de los que
se había avisado en la Etapa 5. Además de categoría/banner (ya
avisados), también se resetean SIEMPRE al reimportar: `desc`/`hist`
(los campos "Descripción"/"Historia" del editor VIEJO, aparte de
`campos_es`), `phone`, `hours` (el campo "Horario" viejo del editor,
no confundir con un campo llamado "Horario" DENTRO de `campos_es`),
`active` (**un pin ya publicado queda oculto** si se reimporta —
posiblemente el más peligroso de todos), y `pinScale`/`pinOffsetX`/
`pinOffsetY` (tamaño y posición del pin ajustados a mano en el mapa).
El reporte de la Etapa 6 chequea los 9 campos y lista exactamente
cuáles tiene cargados cada pin existente antes de que el admin
confirme.

**Lo que la Etapa 6 NO hace (a propósito, es solo el reporte, no la
solución de fondo):** sigue sin arreglarse el motivo de fondo de por
qué se pierden esos datos — `savePoiToFirestore()` reemplaza el
documento completo (`merge:false`) en vez de fusionar solo lo que
cambió. El reporte avisa antes de que pase, pero si el admin confirma
igual, esos datos se pierden en Firestore lo mismo (en `POIS` local
sí quedan, por el merge que hace `confirmBulkFullImport` en la línea
`POIS[existingIdx] = {...POIS[existingIdx], ...p}` — pero eso es
memoria del navegador, se pierde apenas se recarga la página y se
vuelve a traer de Firestore). Si en algún momento se quiere resolver
de raíz (que el importador SOLO pise lo que trae el bloque de texto y
preserve todo lo demás, en vez de solo avisar), es un cambio aparte,
más grande, a `savePoiToFirestore` o a cómo arma `p` este importador
— no incluido acá.

**Resultado:** `node --check js/pin-adjust.js` sin errores. Se probó
`_buildBulkImportPreviewHtml()` en Node con un pin existente simulado
(con categoría, banner, desc/hist, teléfono, horario, activo=true,
pinScale/offset ajustados) y un pin nuevo en el mismo texto: el
reporte separó bien "1 nuevo, 1 a actualizar, 1 con datos en riesgo" y
listó los 8 campos en riesgo del pin existente correctamente. No
probado en navegador real (sin DOM en esta sesión) — a validar por
Cris: pegar un bloque que actualice un pin con categoría/banner
cargados, click en "Revisar", confirmar que aparece el aviso en rojo
ANTES de tocar "Confirmar e importar".

**Desvíos del plan original:** ninguno en el alcance pedido. Se
identificó (no se corrigió, ver arriba) que la lista de "qué se
pierde" es más larga de lo que se había avisado en la Etapa 5 —
`active`/`hours`/`phone`/`desc`/`hist`/`pinScale`/offsets, no solo
categoría y banner.

**Archivos tocados:** `js/pin-adjust.js`, `index.html` (agregado el
recuadro de vista previa y los botones Confirmar/Cancelar debajo del
botón principal, que ahora dice "🔍 Revisar antes de importar").

**Qué falta / próximo paso exacto:** Etapa 7 — Selector de idioma
global: sacar el idioma del panel individual y que sea una elección a
nivel de toda la app (hoy cada panel arranca en `FALLBACK_LANG` fijo
en `js/app-state.js`, línea 56). Archivos a chequear: `js/app-state.js`
(`setLanguage`/`getLanguage`/`FALLBACK_LANG`), y dónde vive hoy
cualquier selector de idioma en la interfaz pública (si existe) o si
hay que crear uno nuevo.

---

### Etapa 7 — Selector de idioma global en el header (2026-08-16)

**Qué se pidió:** lo que quedó anotado como próximo paso en la Etapa 6
(ver arriba) — sacar el idioma del panel individual y que sea una
elección a nivel de toda la app.

**Qué se hizo:** se encontró que `AppState.setLanguage()`/`getLanguage()`
y el evento `LANGUAGE_CHANGED` (con el que cualquier parte de la app
se puede suscribir a cambios de idioma) ya existían de antes y
funcionaban bien — lo único que faltaba era: (1) un control fuera del
panel de un lugar puntual, visible siempre, y (2) que la elección
persista entre visitas.

- **`index.html`** — se agregó `#lang-switcher` (3 botones ES/EN/PT)
  al `#header` público, entre la barra de búsqueda y el botón ⚙
  Administrador. Vive en el header de TODA la app, no dentro de
  ningún panel — el visitante lo ve y lo puede usar sin haber abierto
  ningún pin todavía.
- **`js/lang-switcher.js` (archivo nuevo)** — se encarga de: leer el
  idioma guardado de una visita anterior desde `localStorage` (clave
  `smartcity_lang`) y aplicarlo al cargar la página; guardar en
  `localStorage` cada vez que el visitante cambia de idioma; resaltar
  el botón activo; y mantenerse sincronizado vía
  `AppState.EVENTS.LANGUAGE_CHANGED` por si el idioma cambiara desde
  cualquier otro lugar de la app en el futuro. Se agregó al `<script>`
  de `index.html` justo después de `js/app-state.js` (de quien
  depende) y antes de todo lo demás.
- **`css/base.css`** — estilo de `#lang-switcher`, mismo lenguaje
  visual que `#btn-zonas`/`#btn-admin` (píldora blanca flotante con
  sombra), con una variante angosta para pantallas chicas.
- **`js/poi-panel.js`** — se sacó el selector ES/EN/PT que vivía
  DENTRO del panel de cada lugar (los 3 botones en la fila de arriba,
  al lado del ojito 👁️): se quitaron del template HTML del panel, de
  `_els` (`langBtns`), del handler de click, y del código que
  resaltaba el botón activo en `_render()`. El panel de un lugar sigue
  leyendo `_currentLang` normal (vía `AppState.getContent`) para
  pintarse en el idioma activo — solo se sacó el control para
  cambiarlo desde ahí, ahora está únicamente en el header.

**Resultado:** `node --check` sin errores en los 3 archivos JS
tocados/agregados. Se armó un test de integración con `jsdom`
(instalado temporalmente, desinstalado después de probar — no quedó
como dependencia del proyecto) simulando el header real: confirmó que
arranca en español, que al clickear "EN" cambia
`AppState.getLanguage()`, resalta el botón correcto, y guarda
`en` en `localStorage`. No probado en navegador real contra Firestore
en esta sesión — a validar por Cris: abrir la página, cambiar a EN
desde el header ANTES de abrir ningún pin, después abrir un pin y
confirmar que ya se ve en inglés (si tiene `content.en.fields`
cargado), cerrar y recargar la página entera, y confirmar que sigue
en inglés (persistencia por `localStorage`).

**Desvíos del plan original:** ninguno respecto a lo pedido. La
`infraestructura` (`setLanguage`/`getLanguage`/evento) ya estaba
hecha de antes de este plan — la Etapa 7 fue pura UI/persistencia,
no hizo falta tocar la lógica de idioma de `js/app-state.js`.

**Archivos tocados:** `index.html`, `css/base.css`, `js/poi-panel.js`.
**Archivo nuevo:** `js/lang-switcher.js`.

**Qué falta / próximo paso exacto:** Etapa 8 — Prueba real end-to-end:
cargar 3-5 lugares reales (no de prueba) con contenido en los 3
idiomas usando el importador de texto masivo (Etapas 5/6), y
confirmar en el navegador real que todo el circuito funciona junto:
importar → ver en el panel en cada idioma vía el selector del header
→ editar un campo a mano desde el admin → reimportar el mismo lugar
sin perder lo que no se tocó. Es una etapa de verificación con Cris en
su entorno real, no de código nuevo — salvo que la prueba encuentre
algo para corregir.

---

### Etapa 9 — IDs estables por campo + importador `### TEXTO` (2026-08-16)

**Qué se pidió:** independiente del orden del plan original (la Etapa
8 — prueba end-to-end — seguía pendiente), Cris pidió en un chat
aparte poder actualizar el título y/o el texto de UN campo puntual de
UN pin (o de varios a la vez) pegando un bloque de texto corto, sin
arriesgar nombre, coordenadas, categoría, tags, imágenes ni los demás
campos de esos pines. Primero se armó el plan (documento aparte,
`plan-ids-campos-texto-smartcity.md`, entregado sin tocar código) y
después, en un mensaje posterior, pidió explícitamente ejecutarlo.

**Diagnóstico confirmado antes de tocar nada:** `content[idioma].fields`
era (y sigue siendo) un array simple `{title, text}` sin ningún
identificador propio — se identificaban solo por posición. El
importador `### PIN` reemplaza el array de fields completo por
idioma al actualizar (no campo por campo). No había forma de decir
"cambiame el campo 2, dejá el resto como está".

**Qué se hizo:**

- **`js/pin-adjust.js`:**
  - `_nextFieldId(existingFields)` — calcula el próximo id libre
    (`campo-01`, `campo-02`... dos dígitos) mirando los ids ya usados
    en ESE array (de un idioma de un pin), tolera huecos.
  - `_ensureFieldIds(fields)` — recorre un array de fields y le asigna
    `id` a cualquiera que no lo tenga todavía, sin tocar los que ya
    tienen (ni su id, ni su orden). Es el único lugar que genera ids
    nuevos.
  - `_buildContentWithFields()` (la usan `saveNew`, `saveEdit` y
    `confirmBulkFullImport`) ahora pasa cada array de fields por
    `_ensureFieldIds()` antes de guardar — así CUALQUIER campo nuevo,
    venga del editor manual del admin o de `### PIN`, nace con id.
  - `_readVisiblePinFieldRows()` (editor manual) — el `id` no se
    muestra en pantalla (no es algo que Cris tenga que tipear), así
    que se recupera por posición desde `_pinFieldsState` al leer las
    filas del DOM, para no perderlo al releer título/texto tipeados.
  - **Nuevo importador `### TEXTO`:** `parseTextoBulkText(text)`
    parsea bloques `### TEXTO` (un pin + un idioma por bloque, formato
    `campo-NN:` con `titulo:`/`texto:` indentados debajo, cualquiera de
    los dos opcional salvo para crear un campo nuevo). No lanza
    excepción por bloque mal formado, reporta y sigue.
    `importTextoFieldsFromText()` arma, por cada combinación pin+idioma
    que aparece en el texto, el array final de fields (actualiza el
    campo si el id ya existe, lo crea si no y trae título+texto
    completos, reporta aviso y lo saltea si no) y lo guarda con
    `saveFieldsPartialToFirestore` — una sola escritura por
    combinación pin+idioma, aunque el texto tenga varios bloques de la
    misma. Actualiza `POIS` en memoria y llama a `AppState.updatePoi`
    (mismo patrón que `importImageLinksFromText` para refrescar el
    panel en vivo si está abierto en ese momento) antes de regenerar
    el caché público una sola vez al final.
  - **Migración de un solo uso:** `migrateFieldIds()` — recorre `POIS`,
    para cada pin+idioma con algún campo sin `id` le asigna
    `campo-01`, `campo-02`... en el orden en que ya estaban guardados
    (vía `_ensureFieldIds`) y guarda solo esa ruta. Idempotente — se
    puede correr más de una vez sin problema, lo ya migrado se
    saltea.
- **`js/firestore-sync.js`:** nueva `saveFieldsPartialToFirestore(id,
  idioma, fields)` — hermana de `saveSkinsToFirestore`, mismo patrón:
  `merge:true` sobre la ruta puntual `content.<idioma>.fields`, no
  toca nada más del documento (ni otros idiomas, ni `skins`/`banner`/
  coordenadas/tags/categoría).
- **`index.html`:** tres bloques nuevos en la pestaña Importar — el
  botón de migración ("🔧 Asignar IDs a campos existentes", arriba de
  todo, con su explicación de que es de un solo uso), y la caja
  "🔤 Actualizar solo texto" (`### TEXTO`) debajo de "Vincular
  imágenes", con placeholder de ejemplo y texto de ayuda.
- **`js/poi-panel.js`:** sin cambios — se confirmó que `_resolveFields`
  ya lee cada field como `{title, text}` e ignora cualquier propiedad
  extra (`id` no rompe nada ahí).

**Resultado:** `node --check` sin errores en `js/pin-adjust.js` y
`js/firestore-sync.js`. Se probó en Node (fuera del navegador, sin
Firestore real) `_ensureFieldIds` (ids secuenciales nuevos + respeto
de ids ya asignados, incluso con huecos) y `parseTextoBulkText` (bloque
con 2 pines válidos + 1 pin inexistente correctamente descartado y
reportado; un `campo-NN` con solo `texto:` reconocido como "no trae
título"). También se simuló la lógica de merge completa (actualizar
solo título de un campo dejando su texto intacto, crear un campo
nuevo con título+texto completos, y rechazar con aviso un intento de
crear un campo con solo la mitad de los datos) con los resultados
esperados. No probado en navegador real contra Firestore (sin entorno
con DOM/Firestore en esta sesión) — a validar por Cris: correr la
migración una vez, después actualizar con `### TEXTO` solo el texto de
un campo existente y confirmar en el panel público que el título de
ese campo y el resto de los campos del pin no cambiaron un carácter.

**Desvíos del plan original (`plan-ids-campos-texto-smartcity.md`):**
ninguno de fondo. Un detalle que el plan no explicitaba y se resolvió
al implementar: el refresco en vivo del panel público si está abierto
en el momento de la actualización — se siguió el mismo patrón ya
usado por `importImageLinksFromText` (llamar a `AppState.updatePoi`
después de guardar con merge parcial), en vez de dejarlo sin resolver.

**Archivos tocados:** `js/pin-adjust.js`, `js/firestore-sync.js`,
`index.html`, `PLAN_IMPORTACION_MASIVA.md`, `AI_SESSION.md`.

**Qué falta / próximo paso exacto:** retomar la Etapa 8 (prueba real
end-to-end, ver "ESTADO ACTUAL" arriba), ahora incluyendo la migración
de IDs y `### TEXTO` en la prueba guiada por Cris.
