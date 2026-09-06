# PLAN_CATEGORIAS_SUBCATEGORIAS.md

> Archivo de continuidad — mismo patrón que `PLAN_IMPORTACION_MASIVA.md`,
> `PLAN_USUARIOS_EVENTOS.md`, `PLAN_OPTIMIZACION_PERFORMANCE_2026-08-29.md`,
> `PLAN_TIMEZONE_CIUDADES.md`. Va en la raíz del proyecto y no se resetea:
> se va completando por etapas en `REGISTRO POR ETAPA` (sección 13).

## 0. Contexto obligatorio para quien continúe este plan (otra IA / otro chat)

Este proyecto (**SmartCity**, app cultural/gastronómica de Córdoba con mapa
isométrico) tiene reglas de proceso embebidas en el propio código: **arriba
de cada `.js` e `index.html` hay un comentario que obliga a leer
`/AI_RULES.md` primero** (o `/AI_SESSION.md` si `AI_RULES.md` ya se leyó en
la sesión actual) **antes de modificar ese archivo**, y a actualizar
`/AI_SESSION.md` después con el cambio hecho y la verificación realizada.
Esto aplica siempre, en cualquier chat, sin que Cris tenga que pedirlo.

`AI_RULES.md` no es una lista de prohibiciones (su propia sección 9 lo
aclara), pero documenta la arquitectura real del proyecto y varias reglas
que **aplican de lleno a esta implementación** — quedan citadas en la
sección 9 de este plan, con las partes puntuales que hay que respetar.

Regla general de trabajo de Cris: si para responder algo hace falta
modificar código (no solo dar texto/instrucciones), hay que consultarle
antes de largarse a hacer el cambio directamente.

---

## 1. Objetivo y alcance de esta etapa

Reemplazar el filtro de categorías actual (plano, un solo nivel, sin
idiomas editables) por un sistema de **categorías con subcategorías
anidadas**, con:

- Navegación por animación deslizante dentro de la misma barra de filtros
  (**Opción 1** — la única elegida por Cris; otras variantes que se hayan
  charlado en otro momento quedan descartadas para esta etapa).
- Filtrado del mapa en 2 niveles (categoría → subcategoría), reactivo
  desde el toque en la categoría principal, sin esperar a que se toque
  una subcategoría.
- Textos de cada botón editables por idioma desde el panel admin, con un
  sistema de cantidad de campos de idioma bloqueado por doble candado.

Fuera de alcance de esta etapa (no pedido por Cris acá): agregar más
idiomas más allá de los 3 actuales, traducción automática, y cualquier
otra variante de navegación de categorías que no sea la Opción 1.

---

## 2. Estado actual del código (para no reinventar nada — leer antes de tocar)

- **`js/config.js`** define `CAT`, plano, 7 categorías hardcodeadas
  (`food`, `culture`, `music`, `bar`, `art`, `historic`, `shop`), cada una
  con `{label: 'STRING', color, lucide}` — **el label es un string único,
  no hay multi-idioma** y **no hay ningún concepto de subcategoría**.
- **`js/categories.js`** maneja `CUSTOM_CATS` (categorías creadas desde el
  admin, mismo shape plano que `CAT`), `getAllCats()` (merge de ambas),
  `renderCatsAdmin()` (tab admin), `updateFilterBar()` (pinta
  `.filter-row` con un botón por categoría activa) y `applyFilter()`
  (delega en `applyAllPinVisibility()` de `js/pin-visibility.js`).
- El filtro hoy es **de un solo nivel y de selección única**: la variable
  global `activeFilter` (definida en `config.js`, scope de script — **no**
  cuelga de `window`, ver sección 4 de `AI_RULES.md`) vale `'all'`, el id
  de una categoría, o el valor especial `'__eventos__'` (filtro de
  eventos vigentes, no es una categoría real). `_pinMatchesActiveFilter(p)`
  en `categories.js` es la función que decide si un pin matchea.
- **`.filter-row` / `.fbtn`** (`css/base.css`, línea ~438 en adelante): fila
  horizontal con scroll (drag-to-scroll con pointer capture, cuidado con
  el bug ya documentado y corregido de 2026-09-04 si se toca ese código).
  Estado activo ya resuelto en CSS: `.fbtn.on` = `translateY(-5px)
  scale(1.1)` + sombra más fuerte. **Reusar este mismo estado, no crear
  uno nuevo** — Cris lo pidió explícitamente ("como ya está establecido").
- **Persistencia**: `js/settings-sync.js` → `saveCategoriesSettings()` /
  `loadCategoriesSettings()` guardan/leen un único doc Firestore
  `settings/categories` con `{customCats, builtinActive}`. Importante:
  hoy **`builtinActive` solo guarda el flag `active` de las categorías
  base**, no su contenido completo (label, color, etc.) — porque hoy ese
  contenido vive hardcodeado en `config.js` y no es editable. Esto va a
  tener que cambiar (ver sección 7).
- **Sistema de doble candado ya implementado y a reusar tal cual**:
  `js/pin-adjust.js`, función `resetEditIdLock()` /
  `_applyEditIdLockState()` sobre el campo `e-slug` (ID del pin en
  "Editar"). Patrón: campo arranca bloqueado mostrando el valor actual;
  se habilita (fondo/borde rojo de advertencia) **solo cuando los 2
  checkboxes de seguridad están tildados a la vez**; destildar cualquiera
  de los dos vuelve a bloquear el campo y **descarta cualquier edición a
  medio hacer**, restaurando el valor original. Este es el patrón exacto
  que hay que reusar para el candado de "cantidad de campos de idioma"
  (sección 6).
- **Selector de categorías múltiples en Nuevo/Editar**: `categories.js` →
  `buildMultiCatSelector()` / `toggleCatChip()` / `getSelectedCats()`,
  chips clickeables, un pin puede tener varias categorías
  (`poi.categories: string[]`). **No existe hoy ningún selector
  equivalente para subcategorías** — hay que crearlo (sección 3.2).
- **Multi-idioma de contenido de POIs** (ya resuelto, tomar como
  referencia de patrón): `js/app-state.js` → `AppState.getContent(poiId,
  lang)`, con `FALLBACK_LANG = 'es'` y fallback completo a español si el
  idioma pedido no tiene datos. Los 3 idiomas activos hoy en la app son
  **ES / EN / PT** (`js/lang-switcher.js`).

---

## 3. Modelo de datos propuesto

### 3.1 Categorías y subcategorías (`CAT` / `CUSTOM_CATS`)

Cada categoría pasa a tener un label multi-idioma (objeto en vez de
string) y un mapa interno de subcategorías con el mismo shape:

```js
CAT = {
  culture: {
    label: { es: 'CULTURA', en: 'CULTURE', pt: 'CULTURA' },
    color: '#5a52d8',
    lucide: 'culture',
    active: true,
    subcategories: {
      historico: {
        label: { es: 'Histórico', en: 'Historic', pt: 'Histórico' },
        lucide: 'historic',   // o hereda el ícono del padre — a definir
        active: true
      },
      // ...más subcategorías
    }
  },
  // ...resto de categorías
}
```

`CUSTOM_CATS` (categorías creadas desde el admin) debe tener exactamente
el mismo shape, incluyendo `subcategories: {}` desde que se crean —
**una sola fuente de verdad para el shape de "categoría"**, sea builtin o
custom (ver sección 9, regla de `AI_RULES.md` sección 7).

⚠️ **Migración de las 7 categorías actuales**: pasan a ser el nivel 1 tal
cual están, **conservando sus ids** (`food`, `culture`, `music`, `bar`,
`art`, `historic`, `shop`) para no romper `poi.categories` ya guardado en
Firestore. El ejemplo que dio Cris usa "histórico" como subcategoría de
"cultura" — pero **hoy `historic` es una categoría de primer nivel**. Esto
implica que **Cris va a tener que redefinir el árbol real desde el admin**
una vez esté construida la UI (decidir qué queda como categoría de primer
nivel y qué pasa a ser subcategoría de qué). Esto no es parte del trabajo
técnico de esta implementación, queda anotado como pendiente en la
sección 11, punto 2.

### 3.2 Asignación de subcategoría en un POI

Nuevo campo, análogo a `poi.categories`:

```js
poi.subcategories: string[]  // ids de subcategoría
```

Para que el filtro no tenga que resolver ambigüedad de "a qué categoría
padre pertenece este id de subcategoría", **los ids de subcategoría deben
ser únicos globalmente** (no reusar el mismo id en dos categorías padre
distintas) — mismo criterio de generación de id que ya usa `CUSTOM_CATS`
hoy (`'cat_' + nombre_slugificado + '_' + timestamp`), reusar esa función,
no reimplementar una nueva.

Nuevo selector de chips en los formularios "Nuevo"/"Editar" (mismo patrón
visual que `buildMultiCatSelector`), pero **filtrado dinámicamente**: solo
muestra subcategorías que pertenezcan a alguna de las categorías ya
tildadas en ese pin. Si el pin tiene 2 categorías principales marcadas, se
muestra la unión de subcategorías de ambas. Si el admin destilda una
categoría principal, las subcategorías de esa categoría que estuvieran
marcadas en el pin deberían destildarse también (no dejar subcategorías
"huérfanas" sin su categoría padre activa en el mismo pin).

### 3.3 Config de cantidad de campos de idioma (doble candado)

Nuevo valor de configuración global: `languageFieldsCount` (default y
mínimo **3**, no editable salvo que el doble candado esté abierto). Vive
en la parte superior ("top") del panel/tab "Categorías" del admin.
Reusar **exactamente** el patrón de `pin-adjust.js` descrito en la
sección 2 (2 checkboxes, campo numérico deshabilitado por default, se
re-bloquea y descarta cualquier cambio a medio hacer si se destilda
cualquiera de los 2 candados) — no reimplementar la lógica de candado a
mano en un archivo nuevo.

---

## 4. Estado de filtro / máquina de estados del mapa (nuevo)

Hoy `activeFilter` es una única variable de un solo nivel. Propuesta: **no
tocar `activeFilter` en su rol actual** (sigue siendo `'all'` | id de
categoría | `'__eventos__'`, todo lo que ya depende de ese valor sigue
funcionando) y sumar una variable nueva:

```js
let activeSubfilter = null; // null | id de subcategoría
```

Reglas de la máquina de estados:

1. Click en **"Todo"** o en **"Eventos"** → `activeFilter` cambia como ya
   pasa hoy, `activeSubfilter = null`, y si la fila de subcategorías
   estaba abierta se colapsa (animación inversa, sección 5).
2. Click en una **categoría** (`activeFilter = catId`) → `activeSubfilter
   = null` → el mapa filtra exactamente igual que hoy (todos los pines de
   esa categoría, es decir **todas sus subcategorías simultáneamente**) +
   se dispara la animación que abre la fila de subcategorías de esa
   categoría.
3. Click en una **subcategoría** (mientras `activeFilter = catId`
   está activa):
   - si esa subcategoría **ya estaba activa** → toggle off:
     `activeSubfilter = null` (vuelve a mostrarse todo lo de la
     categoría, sin colapsar la fila de subcategorías).
   - si no → `activeSubfilter = subcatId` (filtra más, muestra solo esa
     subcategoría dentro de la categoría activa).
4. Click en la **flecha ←** → vuelve a la fila principal (animación
   inversa). Queda abierta la pregunta de a qué filtro vuelve el mapa —
   ver sección 11, punto 1.

### 4.1 Extensión de la decisión de visibilidad

`_pinMatchesActiveFilter(p)` (`categories.js`) es la función a extender,
no duplicar: cuando `activeSubfilter` esté seteado, un pin es visible si
matchea la categoría **Y** (`activeSubfilter === null` **O**
`p.subcategories.includes(activeSubfilter)`). La decisión final de
mostrar/ocultar sigue centralizada en `applyAllPinVisibility()` /
`isPinVisible()` (`js/pin-visibility.js`) — **no crear una segunda lógica
de mostrar/ocultar en paralelo**, `categories.js` solo debe seguir
delegando ahí como ya hace hoy.

---

## 5. Especificación de UI / animación (Opción 1)

Estado actual de `.filter-row`: botón "Todo" + botón "Eventos" + 1 botón
por categoría activa, con scroll horizontal libre (drag-to-scroll).

Al tocar una categoría:

1. La barra pasa a "vista de subcategorías" de esa categoría.
2. **Todos** los botones que estaban visibles (Todo, Eventos, el resto de
   categorías) se desplazan hacia la izquierda y salen de la fila
   (`transform: translateX(...)`), con un **easing tipo curva S bien
   pronunciada** (ida y vuelta marcada, no un ease-in-out suave — algo en
   la línea de `cubic-bezier(.83,0,.17,1)` o similar; el valor exacto hay
   que afinarlo visualmente probando en el navegador, Cris no dio un
   número concreto, es una sensación ("si se entiende mi idea")).
3. Entran desde la derecha, **en este orden**: primero el botón de
   **flecha ←** (termina ubicado exactamente donde estaba el primer botón
   de la fila original), seguido por los botones de **todas** las
   subcategorías de la categoría tocada.
4. Reusar el mismo estado visual `.fbtn.on` que ya existe
   (`translateY(-5px) scale(1.1)` + sombra) para el botón de subcategoría
   activa — Cris fue explícito: "como ya está establecido", no crear un
   estilo nuevo.
5. Volver: tocar la flecha ← reproduce la animación inversa (subcategorías
   salen hacia la derecha, la fila original de categorías entra desde la
   izquierda), misma curva S.

⚠️ Punto sin definir por Cris: una vez que solo se ven las subcategorías,
**el botón de la categoría padre (ej. "Cultura") deja de estar a la
vista** — no hay indicador de qué categoría está abierta salvo el
contexto de qué subcategorías aparecen. Queda anotado como pregunta
abierta (sección 11, punto 5) — puede resolverse con un label/breadcrumb
chico, pero no fue pedido explícitamente y no hay que inventarlo sin
consultar.

---

## 6. Cambios en el admin (tab "Categorías")

- **Fila superior nueva** ("top de la ventana de categorías"): input
  numérico de "Cantidad de campos de idioma" bloqueado + 2 checkboxes de
  candado, mismo patrón que `e-slug-lock1`/`e-slug-lock2` de
  `pin-adjust.js` (sección 3.3). Mínimo duro: **3**, nunca menos.
  Importante: bajar este número no debería borrar contenido ya cargado en
  los idiomas que dejen de mostrarse — ocultar, no eliminar.
- Cada fila de categoría en `cats-admin-list` (hoy pintada por
  `renderCatsAdmin()`) gana:
  - Un control que abre un **dropdown con los campos de texto por
    idioma** (3 hoy, `languageFieldsCount` a futuro) para editar
    `cat.label` — evita "un sinfín de renglones" como pidió Cris.
  - Una **sub-lista colapsable de subcategorías** dentro de esa
    categoría, cada una con: su propio dropdown de idiomas, su propio
    toggle activo/inactivo (mismo patrón `toggleCat`/`.za-toggle` ya
    existente), y botón eliminar si no es builtin.
  - Botón "+ agregar subcategoría" dentro de cada categoría (mismo
    patrón de generación de id que `btn-add-cat` ya usa para categorías,
    ver sección 3.2).

---

## 7. Persistencia (Firestore)

Extender `saveCategoriesSettings()` / `loadCategoriesSettings()`
(`js/settings-sync.js`) — **mismo doc `settings/categories`, mismo
patrón "se guarda todo junto"** que ya usan `appearance`/`mapstyle`/
`skin` — para incluir:

- Las `subcategories` anidadas dentro de cada categoría, builtin y
  custom.
- Los labels multi-idioma completos, **tanto de categorías builtin como
  custom** — cambio de fondo respecto a hoy: `builtinActive` actualmente
  solo persiste el flag `active` de las categorías base porque su
  contenido vivía hardcodeado en `config.js` sin ser editable; ahora que
  el label es editable, hay que empezar a persistir el label completo de
  las builtin también, no solo el flag.
- `languageFieldsCount` (mismo doc o uno propio — a decidir en la etapa
  de implementación según cómo termine de armarse el resto del doc).

---

## 8. Impacto en archivos existentes (mapa de cambios)

| Archivo | Cambio |
|---|---|
| `js/config.js` | `CAT` pasa de label string a label multi-idioma + `subcategories` anidadas |
| `js/categories.js` | `getAllCats()`, `renderCatsAdmin()`, `updateFilterBar()`, `_pinMatchesActiveFilter()`, nuevo estado `activeSubfilter`, nueva animación de la fila |
| `js/pin-visibility.js` | Extender el criterio de `isPinVisible()` para considerar `activeSubfilter` (sin duplicar lógica) |
| `js/settings-sync.js` | `saveCategoriesSettings()`/`loadCategoriesSettings()` con el esquema ampliado (sección 7) |
| `index.html` / `js/admin.js` | Nuevos inputs del tab "Categorías": candado de cantidad de idiomas, dropdowns de idioma por categoría/subcategoría, selector de subcategorías en Nuevo/Editar |
| `css/base.css` | Animación de la fila de filtros (translateX + curva S), estilos del dropdown de idiomas en el admin |
| `js/lang-switcher.js` | Verificar si necesita engancharse a algo (probablemente no — solo cambia `AppState._currentLang`, los labels de categoría se resuelven aparte) |
| `js/poi-panel.js` / `js/markers.js` | No deberían verse afectados — solo consumen el resultado de la visibilidad, no la lógica de categorías |

---

## 9. Buenas prácticas obligatorias (citando `AI_RULES.md`)

Este documento asume que quien implemente ya leyó `AI_RULES.md` completo
(obligatorio por el comentario embebido en cada archivo, sección 0). Se
resaltan acá los puntos que aplican de lleno a esta implementación:

- **Sección 6** ("Funciones con el mismo nombre... a propósito" / "Regla
  para código nuevo"): antes de crear o modificar una función importante,
  `grep -rn "function nombreFn"` para ver si ya existe algo con el mismo
  propósito. Aplica directo acá: **el candado de cantidad de idiomas debe
  reusar el patrón de `pin-adjust.js` (2 checkboxes), no reinventarlo**;
  el selector de subcategorías debe reusar el patrón de
  `buildMultiCatSelector`, no crear un sistema paralelo de chips.
- **Sección 7** ("Una sola fuente de verdad"): no duplicar en más de un
  lugar el criterio de "qué subcategorías tiene una categoría" ni el
  shape de "categoría" (builtin vs custom deben compartir exactamente la
  misma estructura, como ya pasa hoy con `CAT`/`CUSTOM_CATS` a nivel
  categoría).
- **Sección 8** ("Rastrear la cadena antes de tocar una funcionalidad
  existente"): antes de tocar `applyFilter()`/`isPinVisible()`, rastrear
  la cadena completa click → `activeFilter`/`activeSubfilter` →
  `_pinMatchesActiveFilter` → `applyAllPinVisibility` →
  `scheduleClusterRecompute`. Ya hubo un bug histórico documentado de un
  filtro que "no hacía nada" en el mapa por este mismo tipo de cadena
  rota — no repetirlo.
- **Sección 9** ("Este documento no es una camisa de fuerza"): si en el
  camino conviene migrar el esquema de configuración (por ejemplo, el
  cambio de fondo en qué persiste `builtinActive`, sección 7 de este
  plan), está bien — pero hay que **documentar el cambio y actualizar
  `AI_RULES.md`** para que refleje la nueva realidad, como indica esa
  misma sección.
- Regla de proceso de Cris (sección 0 de este plan y "Reglas permanentes
  de trabajo" en la memoria del proyecto): actualizar `/AI_SESSION.md`
  después de cada cambio, y consultar antes de modificar código si hace
  falta para responder algo.

---

## 10. Multi-idioma — resolución de fallback

Igual que `AppState.getContent()` hace fallback completo a español si el
idioma pedido no tiene datos cargados, el label de categoría/subcategoría
debe resolverse con el mismo criterio: si falta el texto en el idioma
activo, mostrar el de `FALLBACK_LANG` ('es') en vez de dejar el botón sin
texto. No reinventar un segundo criterio de fallback — replicar el mismo
patrón ya usado en `app-state.js`.

---

## 11. Preguntas abiertas / decisiones pendientes

Estas preguntas no estaban resueltas en el pedido original de Cris (sección
14) — quedaron anotadas como huecos del plan y se le consultaron aparte,
en un chat posterior, ya con el plan escrito. Lo que sigue a cada pregunta
**no es parte del pedido inicial**: es la respuesta que Cris dio después,
al ser consultado puntualmente por cada caso.

1. **Pregunta**: al tocar la flecha ← estando una subcategoría
   seleccionada, ¿el filtro del mapa vuelve a `'all'` o a la categoría
   completa (todas sus subcategorías, sin subcategoría puntual)? Cris no
   lo había especificado en el pedido original.
   **Respuesta de Cris**: vuelve a `'all'` (Todo).

2. Mapeo real de qué categorías actuales pasan a ser subcategorías de
   cuáles (el ejemplo usa "histórico" como subcategoría de "cultura",
   pero "histórico" hoy es una categoría de primer nivel) — esto lo
   define Cris desde el admin una vez construida la UI, no es parte del
   trabajo técnico de esta implementación. **Sigue sin resolver**, no se
   le consultó todavía.

3. **Pregunta**: si una categoría todavía no tiene ninguna subcategoría
   cargada, ¿qué pasa al tocarla? ¿Sigue funcionando como filtro simple
   sin animación, o la animación corre igual mostrando solo la flecha (0
   subcategorías)?
   **Respuesta de Cris**: funciona como filtro simple, sin animación.

4. **Pregunta**: mientras la fila de subcategorías está abierta, ¿tocar
   "Todo" o "Eventos" debe estar disponible directamente, o el sistema
   debe forzar volver con la flecha primero?
   **Respuesta de Cris**: hay que forzar volver con la flecha primero —
   "Todo"/"Eventos" no están accesibles mientras las subcategorías están
   abiertas.

5. **Pregunta**: ¿hace falta algún indicador de qué categoría padre está
   abierta mientras solo se ven sus subcategorías (ver nota de la
   sección 5)?
   **Respuesta de Cris**: por ahora no se resalta con nada visual — no
   encontró una forma de agregarlo sin sumar un ícono extra ni romper la
   simplicidad actual (ya está el botón flecha a la izquierda seguido de
   las subcategorías; poner el nombre de la categoría en el lugar de la
   flecha resulta confuso, y jerarquizarlo con otro color también suma
   complejidad). Pidió dejar el campo/estructura preparada para que esto
   pueda agregarse más adelante — todavía no decidió cómo se va a
   visualizar.

6. **Pregunta**: ¿los "3 idiomas" de categorías son exactamente los
   mismos ES/EN/PT que ya usa el resto de la app (`lang-switcher.js`), o
   un set independiente?
   **Respuesta de Cris**: son los mismos ES/EN/PT, y deben regirse por el
   selector global de idioma que está arriba en la página — ese selector
   afecta a todo texto de la app según lo que esté seleccionado ahí.

7. **Pregunta**: ¿hace falta alguna ayuda de traducción automática en el
   admin, o carga 100% manual?
   **Respuesta de Cris**: carga 100% manual, por ahora.

---

## 12. Plan de etapas sugerido

- **Etapa A** — Modelo de datos: `CAT` anidado con subcategorías + labels
  multi-idioma, `poi.subcategories`, esquema ampliado del doc Firestore.
  Sin UI nueva todavía (migración de datos primero).
- **Etapa B** — Admin: CRUD de subcategorías + editor de idiomas
  (dropdown) + candado de cantidad de idiomas.
- **Etapa C** — Admin: selector de subcategorías en Nuevo/Editar de
  pines.
- **Etapa D** — Mapa público: máquina de estados
  (`activeFilter`/`activeSubfilter`) + extensión de la lógica de
  filtrado en `pin-visibility.js` (sin animación todavía).
- **Etapa E** — Mapa público: animación de la fila de filtros
  (deslizamiento + flecha + curva S).
- **Etapa F** — QA: pines multi-categoría, idiomas incompletos (fallback
  a ES), y los casos borde de la sección 11 ya resueltos con Cris.

## 13. REGISTRO POR ETAPA

**Etapa A — 2026-09-06 — Modelo de datos.** `CAT` (`js/config.js`)
pasa de `label` string a `label` multi-idioma (`{es,en,pt}`) +
`subcategories:{}` anidado (vacío en las 7 categorías — árbol real
pendiente, ver sección 11, punto 2). `CUSTOM_CATS` adopta el mismo
shape al crearse. Nueva `getCatLabel(cat, lang)` en `categories.js`
(fallback a español, mismo criterio que `AppState.getContent`) —
único punto correcto para leer el label como string; se actualizaron
todos los consumidores existentes (`categories.js`, `content-import.js`,
`app.js`, `admin.js`, `data-io.js`, `pin-adjust.js`) para usarla, sin
lo cual se hubiera roto cualquier UI que mostrara una categoría.
`saveCategoriesSettings()`/`loadCategoriesSettings()`
(`settings-sync.js`) persisten ahora la categoría base completa
(`builtinData`: label + subcategories + active), con fallback de
lectura al esquema viejo (`builtinActive`). Se agregó
`languageFieldsCount` (default 3, `config.js` + persistencia) para el
candado de la Etapa B. Sin UI nueva, sin tocar `activeFilter`/
`activeSubfilter` (Etapa D) ni `poi.subcategories` (Etapa C/D).
`node --check` sin errores en los 8 `.js` tocados. NO probado contra
Firebase real ni navegador — pendiente que Cris confirme que la app
sigue funcionando igual que antes (sin diferencia visible todavía).
**Etapa B — 2026-09-06 — Admin: editar idiomas + CRUD subcategorías.**
Tab "Categorías" del admin gana: desplegable "🌐 Idiomas" por
categoría/subcategoría (3 inputs ES/EN/PT, guarda al salir del campo,
actualiza en vivo el nombre de la fila + la barra de filtros pública);
desplegable "📂 Subcategorías" con alta/activar-desactivar/eliminar
(mismo patrón `.za-toggle` de siempre); fila superior "Cantidad de
campos de idioma" con candado doble idéntico al del ID de un pin
(mínimo 3 — subir más de 3 no agrega campos reales todavía porque solo
hay 3 idiomas soportados en toda la app, ver nota en `LANG_CODES`,
`categories.js`). Se agregó `_catsUIState` para que activar/eliminar
(que reconstruyen toda la lista) no cierren los desplegables que el
admin tenía abiertos. Sin cambios de esquema de persistencia (la
Etapa A ya dejó `settings-sync.js` preparado). Bump de cache-busting
`?v=20260906` en los 8 `.js` tocados hoy. `node --check` sin errores
en todo el proyecto; grep cruzado de ids HTML↔JS y de colisión de
nombres nuevos, todo OK. NO probado contra Firebase real ni navegador.
Sin tocar todavía: `poi.subcategories` (Etapa C), filtrado real por
subcategoría en el mapa (Etapa D), animación (Etapa E). Detalle
completo en `AI_SESSION.md`.

---

**Nota post-Etapa B (2026-09-06, continuación 4):** las 3 rondas de
fixes de UX sobre la Etapa B (continuación 2, 3 y 4 — ver
`AI_SESSION.md` para el detalle de cada una) no abren una etapa nueva,
son correcciones dentro de la Etapa B. Detalle importante para quien
continúe: el cache-busting de `js/categories.js` en `index.html` había
quedado en `?v=20260906` sin bumpear en 2 rondas seguidas de cambios
de contenido — corregido a `?v=20260906-1955` recién en esta última
ronda. **Regla a seguir de acá en adelante:** cada vez que se modifique
un `.js` ya servido con `?v=`, bumpear ese valor en `index.html` en la
MISMA entrega, aunque el cambio parezca chico — no asumir que un
`?v=` de más temprano en el mismo día alcanza.

## 14. Apartado — pedido textual de Cris (corregido solo ortográficamente)

> Quiero que hagamos una nueva implementación para el tema de categorías.
>
> Vamos a establecer un sistema de categorías y subcategorías, de la
> siguiente manera:
>
> Lee todo lo charlado acá y tené en cuenta que hoy yo solo elijo ir por
> la opción 1. La de que estén las categorías y, cuando el usuario toca
> en 1, todas las categorías visibles se desplazan hacia la izquierda
> apareciendo nuevos botones viniendo desde el lado derecho; el primer
> botón que viene desde el lado derecho, que es el que se va a ubicar en
> el lugar de la primera categoría inicial, es el de la flecha apuntando
> hacia la izquierda. Y los botones de subcategorías que le siguen al
> mismo hacia el lado derecho son los de las subcategorías de la
> categoría sobre la que el usuario hizo click inicialmente. Todo este
> movimiento con un efecto de movimiento de curva ease tipo S pronunciada
> (si se entiende mi idea).
> El usuario clickea en las subcategorías que quiera y eso se refleja en
> el mapa.
> Otro detalle: desde el momento en que el usuario toca la X categoría (y
> si bien dije categoría, no dije subcategoría) desde ese momento van a
> aparecer solo previsualizadas al 100% todas las subcategorías de esa
> categoría seleccionada, o sea, lo que se ve en el mapa cambia desde el
> momento en que la persona tocó alguna de las categorías principales, no
> es necesario que toque una subcategoría para que el mapa se adapte.
> Ejemplo:
>
> El usuario está en la parte principal de categorías viéndolas a todas
> como (todo activado), luego el usuario toca en categoría "cultura" y,
> si bien cultura tiene varias categorías y cuando el usuario toca en
> cultura comienza a ejecutarse la animación que muestra los botones de
> las subcategorías dentro de la categoría cultura, desde el momento en
> que el usuario toca la categoría principal, en el mapa en ese momento
> ya se muestran todas las subcategorías que incluye cultura
> simultáneamente. Luego, si el usuario vuelve a tocar en alguna
> subcategoría, ahí sí se filtrará aún más la vista en el mapa mostrando
> así, solo dentro de cultura, la subcategoría que el usuario haya
> seleccionado.
> Al mismo tiempo, haremos que si el usuario vuelve a tocar en la
> subcategoría activada, esta se deselecciona y eso genera que se ponga
> nuevamente en el mapa activas, de forma visible, todas las
> subcategorías de la categoría activa de forma simultánea. Ejemplo:
> El usuario, dentro de cultura (que tiene 10 pines), toca en
> subcategoría histórico (que tiene 2 pines); entonces desaparecen o se
> atenúan los otros 8 pines restantes, mostrando solo los 2 pines
> correspondientes a categoría cultura → subcategoría histórico. Pero si
> el usuario vuelve a tocar en subcategoría histórico, esta se
> deselecciona y vuelve a mostrar los 10 totales de la categoría cultura
> en su conjunto.
>
> ¿Se entiende?
>
> Mientras algún botón esté activo, estará levemente hacia arriba, como
> ya está establecido, además de que el mismo estará con color resaltado
> también, como ya está establecido.
>
> Tener en cuenta que en cada botón, el texto de abajo debe estar sujeto
> a lo que son los filtros de los 3 idiomas. Si no es algo que la página
> por sí sola pueda editar, entonces que en el panel admin cada categoría
> y subcategoría tenga 3 campos de texto para poner en cada una el texto
> correspondiente según corresponda por idioma.
> Lo más práctico, creo yo, es que sea para los idiomas tipo 1 dropdown
> menu que incluya los 3 campos de texto, para que no se haga un sinfín
> de renglones. Cada nombre, al clickearlo, 3 opciones de texto (por
> ahora); no sé si a futuro se agreguen más idiomas.
>
> Tal vez se pueda establecer en el top de la ventana de categorías la
> cantidad de campos de texto para cada elemento; ahora serían 3 como
> base mínima, no pudiéndose modificar a menos que 3. Y serían para los 3
> idiomas, para que cada botón tenga las 3 opciones. A futuro, si se
> quiere agregar más idiomas, ese número se podría modificar y tendrá 2
> candados para que no pueda modificarse por error o un click mal
> colocado. 2 candados, al igual que tiene el sistema de renombre de
> pines.
>
> Quiero que hagas un plan para implementar todo esto, puede que lo haga
> con otra IA u otro chat, por lo que sería muy importante que esté bien
> explicado todo el contexto necesario, además de hacer énfasis en el
> tema de las buenas prácticas a llevar a cabo en la app, y cómo se debe
> buscar, como objetivo de trabajo, lo que está en alguno de los archivos
> presentes en el proyecto —por favor, fijate en cuál está—. Pero está en
> uno de los archivos de bloc de notas en la carpeta principal, o bien
> puede estar en el index. Cuando identifiques cuál es el que menciona
> que se debe mantener la app programada de forma tal de evitar cosas que
> se repitan y evitar crear archivos de más, mantener una única fuente de
> verdad, etc., cuando lo ubiques, por favor, en el plan agregá que se
> sigan esas conductas, y agregá al plan, como apartado, este texto mío
> textual pero sin errores ortográficos —es solo para tener constancia de
> lo que realmente pedí, y si para el futuro se sabe si nada quedó sin
> establecer, si no quedó ningún cabo suelto.
