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

**Última etapa completada:** Etapa 5 — el importador de texto masivo
(`parsePinBulkText`/`importFullPinsFromText` en `js/pin-adjust.js`)
acepta bloques `campos:`(ES) / `campos_en:` / `campos_pt:` y escribe
directo a `content[idioma].fields[]`, preservando por idioma lo que no
se mencione en el bloque al actualizar un pin existente. Ya no escribe
`poi.attrs`.

**⚠️ Aviso pendiente para Cris (no bloquea la Etapa 6, pero hay que
tenerlo presente):** el importador guarda el documento completo en
Firestore (`merge:false`) al actualizar un pin — campos del pin que el
bloque de texto no vuelve a mencionar (categoría, banner, pinScale/
offsets) pueden perderse al reimportar. Esto es previo a la Etapa 5,
no se tocó. Ver el aviso completo en el registro de la Etapa 5 más
abajo.

**Próxima etapa a hacer:** Etapa 6 — Validación previa a importar: hoy
`importFullPinsFromText()` parsea y guarda todo de una, y recién
después muestra qué se creó/actualizó/qué falló. La Etapa 6 es separar
eso en 2 pasos: primero parsear y mostrar un reporte de qué se va a
hacer (cuántos pines nuevos, cuántos existentes se van a pisar, y con
qué, más los errores de formato) SIN escribir nada en Firestore
todavía, y recién con una confirmación aparte del admin se ejecuta el
guardado real.

**Archivos a chequear para arrancar la Etapa 6** (no hace falta nada más):
- `js/pin-adjust.js` — `parsePinBulkText()` y `importFullPinsFromText()`
  (Etapa 5), para separar la parte de "parsear y armar el reporte" de
  la parte de "efectivamente guardar en Firestore"
- `index.html` — sección "Importar lugares completos" (línea ~265 en
  adelante), para agregar el paso de previsualización/confirmación
  antes del botón de importar definitivo
- La sección "Modelo de datos definitivo" de este archivo, más abajo

**Ver el registro completo de la Etapa 5 más abajo** para el detalle
línea por línea de qué se cambió, incluido el aviso importante sobre
qué SÍ y qué NO se preserva al reimportar un pin existente.

---

## PLAN GENERAL (etapas)

- [x] **Etapa 1** — Definir el modelo de datos definitivo (diseño, sin código)
- [x] **Etapa 2** — Panel público: renderizar `content[idioma].fields[]` (título+texto, cantidad libre, sin nombres fijos)
- [x] **Etapa 3** — Admin: editor de campos que escribe directo a `content[idioma].fields[]`, con selector de idioma
- [x] **Etapa 4** — ~~Migración de datos viejos~~ DESCARTADA (2026-08-15): pines actuales son solo de prueba, no hace falta migrar; ver registro de la Etapa 4 más abajo para el motivo completo
- [x] **Etapa 5** — Importador de texto masivo: aceptar bloques ES/EN/PT con campos numerados libres
- [ ] **Etapa 6** — Validación previa a importar (reporte antes de escribir en Firestore)
- [ ] **Etapa 7** — Selector de idioma global (sacarlo del panel, notificar a toda la app)
- [ ] **Etapa 8** — Prueba real end-to-end con 3-5 lugares en los 3 idiomas, antes de la carga masiva definitiva

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
        { title: "...", text: "..." },
        { title: "...", text: "..." },
        // cantidad LIBRE — puede haber 0, 1, 5 o 12. Nunca un
        // límite fijo en el código, y NUNCA un título predefinido
        // tipo "Dato curioso"/"Horario" — el título lo escribe
        // quien carga el contenido, campo por campo.
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

