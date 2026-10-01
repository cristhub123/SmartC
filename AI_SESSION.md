## Sesión: 2026-09-07 (Etapa E, fix 2) — Tocar de nuevo la categoría abierta no cerraba (se quedaba "trabado")

Cris reportó: tocar una categoría la abre bien (se desplaza, suben las
subcategorías), pero tocarla de nuevo para cerrar no hacía nada — se
quedaba trabado.

**Causa real:** el click de cada botón usaba una variable (`openCat`)
calculada UNA sola vez al armar la fila en frío (`updateFilterBar()`)
y capturada por clausura en ese momento. El problema es que abrir/
cerrar con la animación (`_animateOpenSubcatRow`/
`_animateCloseSubcatRow`) NO vuelve a llamar `updateFilterBar()` —
mueve los botones a mano. Entonces `openCat` quedaba congelada en su
valor de cuando se armó la fila (antes de abrir nada), aunque
visualmente la categoría ya estuviera abierta. Al tocarla de nuevo,
el código "creía" que no había nada abierto y, en vez de cerrar,
intentaba abrir la misma categoría otra vez — como ya estaba todo en
su lugar, no se veía ningún cambio (parecía trabado), pero por dentro
sí estaba corriendo la coreografía de apertura de nuevo.

**Fix:** el click ya no mira esa variable vieja — chequea el estado
REAL en el instante del click: `id === activeFilter &&
bar.querySelector('.fbtn-sub')` (¿hay chips de subcategoría
visibles ahora mismo, de esta categoría?). Como `bar` es el
contenedor vivo (nunca se destruye, solo se le cambia el contenido),
esto siempre refleja el estado actual, sin importar si se llegó ahí
por un render en frío o por la animación.

**Archivos modificados:** `js/categories.js`, `index.html` (bump de
cache-busting a `?v=20260907-1345`).

**Pruebas realizadas:** `node --check` sin errores. Repasado a mano
el flujo completo: abrir categoría → tocarla de nuevo → debe cerrar
(antes no lo hacía, con este fix sí, según lectura del código). **NO
probado contra Firebase real ni navegador.**

## Sesión: 2026-09-07 (Etapa E, fix) — Carrera entre la animación y los refrescos de fondo de la fila de filtros

Cris reportó, después de la entrega de la Etapa E, botones que
desaparecían, quedaban tildados solos, o se duplicaban movimientos.
Pidió entender la causa antes de seguir.

**Causa real (confirmada leyendo el código, no una suposición):**
`updateFilterBar()` se llama muy seguido en segundo plano — cada
carga de pines al mover/hacer zoom en el mapa (`drawLoadedPins()` en
`pins-viewport-loader.js`) — y hace `bar.innerHTML = ''` +
reconstrucción completa de la fila. La coreografía animada
(`_animateOpenSubcatRow`/`_animateCloseSubcatRow`) no es instantánea:
tarda ~0.5-0.9s repartidos en varios `setTimeout`. Si un refresco de
fondo se disparaba EN EL MEDIO de esos pasos, `updateFilterBar()` le
vaciaba el contenido a la fila que la animación todavía estaba
tocando — y los pasos de la coreografía que quedaban pendientes
igual se ejecutaban después, agregando/tocando botones sobre una fila
que ya había sido reconstruida de cero por su cuenta. De ahí los
duplicados y los estados raros que describió Cris.

**Fix:** nuevo flag `_dockAnimating` (`js/categories.js`). Mientras
está en `true` (desde el primer paso de cualquiera de las 2
coreografías hasta el último real, no antes):
- `updateFilterBar()` NO toca el DOM de la fila — sigue llamando
  `applyFilter()` igual, así los pines recién cargados de fondo
  quedan bien filtrados, pero la fila visual espera a que la
  animación termine.
- Un click nuevo en cualquier botón (principal o subcategoría) se
  ignora — no se puede interrumpir una animación a mitad de camino.

**Archivos modificados:** `js/categories.js`, `index.html` (bump de
cache-busting a `?v=20260907-1330`).

**Pruebas realizadas:** `node --check` sin errores en todo el
proyecto. Repasado a mano cada punto donde se lee/escribe
`_dockAnimating`, confirmando que el flag se pone en `true` como
primera línea de cada coreografía y se vuelve a `false` recién en su
último paso real (nunca antes). **NO probado contra Firebase real ni
navegador** — es el fix a un bug que Cris solo pudo reproducir
navegando en vivo (mover el mapa mientras la animación estaba en
curso), así que la confirmación real depende de que lo prueba él en
su entorno.

## Sesión: 2026-09-07 (Etapa E) — Animación de categoría↔subcategorías

Cris pasó 2 ejemplos de referencia (HTML standalone) con la animación
que quería, y pidió explícitamente reemplazar POR COMPLETO cualquier
intento anterior — no dejar conviviendo dos sistemas de animación.

**Contexto:** en una ronda anterior de este mismo día (sin registrar
en este archivo — quedó sin documentar, se corrige acá) ya se había
escrito una primera versión de la Etapa E usando flexbox normal +
técnica FLIP (`getBoundingClientRect` antes/después + `transform`
calculado). Cris la probó, trajo su propio ejemplo de referencia
(`gemini-code-1788756346468.html`, después afinado a 3 archivos
`index.html`/`styles.css`/`script.js` con categorías generadas
dinámicamente) y pidió replicar ESA mecánica exacta, no la FLIP.

**Decisiones tomadas con Cris antes de programar (no inventadas):**
1. Sin flecha ← separada — para cerrar la vista de subcategorías se
   vuelve a tocar la misma categoría (ya movida al primer lugar).
   Reemplaza el botón "Volver" de la Etapa D.
2. Animación vertical (caen/suben con fade), NO el deslizamiento
   horizontal con curva S que describía el plan original — Cris la
   diseñó a su gusto con esa referencia.

**Por qué se sacó el intento FLIP entero en vez de dejarlo convivir:**
los dos usaban `.fbtn`/`.filter-row` con layouts incompatibles
(flexbox normal vs. position:absolute con variable CSS `--current-x`)
y nombres de clase parecidos (`fbtn-exit-down`/`fbtn-enter-up` ya
existían con OTRA semántica) — dejar los dos generaba exactamente el
pisado que Cris preguntó si iba a pasar. Se borró completo
(`_animateOpenSubcatRow`/`_animateCloseSubcatRow`/
`_appendAnimatedSubcats`/`_renderMainFilterRowAnimatedReturn`/
`_flipTransform` viejas, más el CSS de esa versión) y se reescribió
con los mismos 2 nombres de función principales (para no romper nada
que ya los llamara) pero con la lógica nueva, calcada del ejemplo.

**Cambios (`js/categories.js`):**
- `FILTER_SLOT_W = 78` (mismo valor que usó Cris), `_setBtnX(btn,x)`,
  `_getMainFilterItems()`, `_buildMainBtn()`, `_buildSubBtn()`,
  `_setFilterRowWidth()` (espaciador invisible para que el drag-scroll
  siga funcionando — los `.fbtn` ahora son `position:absolute` y no le
  dan ancho de scroll al contenedor por sí solos).
- `updateFilterBar()`: reescrita como punto de entrada "en frío" —
  arma la fila completa y la deja YA en el estado correcto según
  `activeFilter`/`activeSubfilter` actuales, sin animar. Se sigue
  llamando muy seguido (cada carga de pines al mover el mapa), tiene
  que ser barata y siempre terminar bien parada, animada o no.
- `_animateOpenSubcatRow()`/`_animateCloseSubcatRow()`: la coreografía
  animada de verdad, calcada 1:1 de `handleCategoryClick`/
  `resetToMain` del script.js de Cris — solo se dispara con un click
  real del usuario, nunca desde `updateFilterBar()`.
- **Decisión técnica clave (la respuesta a "se van a pisar las
  animaciones"):** la posición de reposo de cada botón NO se escribe
  como `transform` inline — solo se escribe la variable CSS
  `--current-x` (`_setBtnX`). El `transform` final lo arma el propio
  CSS (`.fbtn`, `:hover`, `.on`, `.fbtn-exit-down`, `.fbtn-enter-up`)
  leyendo esa variable. Si el `transform` de reposo se hubiera escrito
  inline (como en el ejemplo de Cris, que no tenía `:hover` propio
  para pisar), el `:hover`/`.on` que YA existían en la app hubiesen
  quedado inútiles — un estilo inline le gana a una clase sin
  `!important`, pase lo que pase con `:hover`/`:active`. Con la
  variable, cada estado compite por especificidad de CSS normal como
  siempre.

**Cambios (`css/base.css`):**
- `.filter-row`: pasa de `display:flex` a `position:relative` + alto
  fijo `82px` (los hijos ya no le dan altura, son absolutos).
- `.fbtn`: pasa a `position:absolute; left:0; width:70px;
  transform:translate(var(--current-x,0px), 0px)`. `:hover`/`.on`
  ahora arman su `transform` completo leyendo la misma variable (ver
  arriba). Transición unificada `.4s cubic-bezier(.65,0,.35,1)`
  (antes `.22s` con rebote — se unificó al valor del ejemplo de Cris,
  el hover/tap va a sentirse un poco menos "rebotón" que antes, es
  intencional).
- `.fbtn-exit-down`/`.fbtn-enter-up(.fbtn-entered)`: reescritas para
  usar `translate(var(--current-x), Ypx)` en vez de solo `translateY`
  — el intento FLIP anterior tenía un bug acá (perdía la X al caer,
  el botón "saltaba" a la izquierda mientras caía en vez de caer
  derecho en su lugar).

**Archivos modificados:** `js/categories.js`, `js/config.js` (se sacó
`LUCIDE.back`, ya no se usa — la flecha se reemplazó por tocar la
categoría de nuevo), `css/base.css`, `index.html` (bump de
cache-busting de los 3).

**No tocado a propósito:** el color de fondo de cada círculo
(`background:${cat.color}` inline) ya estaba corregido de una ronda
anterior del mismo día (el comentario de la Etapa D prometía este
color y no se había escrito) — se mantuvo tal cual, no forma parte de
esta etapa.

**Pendiente/riesgo conocido, no de esta etapa:** `_attachFilterBarDragScroll(bar)`
se vuelve a llamar en cada `updateFilterBar()` (cada carga de pines al
mover el mapa) sobre el MISMO elemento `.filter-row` sin sacar los
listeners de pointer anteriores — acumula listeners duplicados con el
tiempo. Esto NO es nuevo de esta etapa, ya pasaba en el código antes
de todo este plan (`bar.addEventListener('pointerdown', ...)` vivía
inline en el `updateFilterBar()` original). Vale la pena una limpieza
aparte en algún momento (guardar la referencia y hacer
`removeEventListener` antes de re-atachear, o mover el listener a
`bar` UNA sola vez fuera de `updateFilterBar()`), pero no se tocó acá
para no salirse del pedido puntual de esta ronda.

**Pruebas realizadas:** `node --check` sin errores en todo el
proyecto, balance de llaves `{}` verificado en `base.css`. Grep
confirmando que no queda ninguna referencia a los nombres de la
versión FLIP vieja (`_flipTransform`, `_appendAnimatedSubcats`,
`_renderMainFilterRowAnimatedReturn`) fuera de comentarios
explicativos, y que `.filter-row`/`#filter-bar` no se usan en ningún
otro archivo del proyecto de una forma que dependiera del layout flex
viejo. **NO probado contra Firebase real ni navegador** — la altura
exacta de `.filter-row` (82px) y el `top:4px` de `.fbtn` son un
cálculo a mano (circle 54px + gap 5px + label ~14px), van a necesitar
un ajuste fino mirándolo en el navegador real, así lo dice el propio
plan para esta etapa.

**Sigue:** Etapa F (QA final).

## Sesión: 2026-09-06 (Etapa D) — Filtro real del mapa por subcategoría

Antes de tocar código se resolvieron con Cris las 3 preguntas abiertas
de la sección 11 que bloqueaban esta etapa:
1. Flecha ← con subcategoría activa → vuelve a `'all'` ("Todo"), NO a
   la categoría sin subcategoría.
2. Categoría sin ninguna subcategoría ACTIVA cargada → filtra normal,
   NO abre ninguna fila.
3. Con la fila de subcategorías abierta, "Todo"/"Eventos"/otra
   categoría NO están disponibles directo — hay que volver con la
   flecha primero.

**Cambios:**
- `js/config.js`: nueva `let activeSubfilter = null;` junto a
  `activeFilter`. Nuevo ícono `LUCIDE.back` (flecha ←) — única
  definición, la Etapa E lo va a reusar tal cual para la animación.
- `js/categories.js`:
  - `updateFilterBar()` pasa a ser solo el punto de entrada: decide
    fila principal vs. fila de subcategorías mirando
    `activeFilter` + `_catHasActiveSubcats(activeFilter)` — **sin
    bandera de estado nueva**, se deriva del estado existente (así la
    decisión 1 y 2 de arriba caen solas, sin lógica extra).
  - El cuerpo viejo de `updateFilterBar()` pasa tal cual a
    `_renderMainFilterRow()`.
  - Nueva `_renderSubfilterRow(bar, catId)`: flecha "Volver" +
    chips de las subcategorías ACTIVAS de esa categoría (ícono =
    el de la categoría padre, el modelo de datos no tiene ícono por
    subcategoría). Reusa las clases `.fbtn`/`.fbtn-circle`/
    `.fbtn-label` tal cual — mismo estado visual "activo" (elevado +
    resaltado) que ya existía, sin CSS nuevo. Sin animación (Etapa
    E la va a reemplazar por el deslizamiento + curva S).
  - El drag-to-scroll (que antes vivía una sola vez, inline, adentro
    de `updateFilterBar`) se factorizó en `_attachFilterBarDragScroll(bar)`
    para no duplicarlo entre las 2 filas — mismo comportamiento
    exacto (umbral 15px mouse / 6px touch, captura de puntero solo
    tras confirmar arrastre real), ver el fix ya documentado del
    2026-09-04.
  - `_pinMatchesActiveFilter()` extendida (sección 4.1 del plan): si
    hay `activeSubfilter`, además de matchear la categoría el pin
    tiene que tener esa subcategoría en `p.subcategories`. NO se tocó
    `pin-visibility.js` — sigue siendo el único lugar que decide
    mostrar/ocultar, esto solo extiende el criterio que ya consulta.
- `index.html`: bump de cache-busting de `config.js` y `categories.js`
  a `?v=20260906-2145`.

**No tocado a propósito:** cualquier animación/transición (Etapa E).
La fila de subcategorías aparece/desaparece de una, sin transición —
es exactamente lo que dice la sección 12 del plan para esta etapa
("sin animación todavía").

**Pruebas realizadas:** `node --check` sin errores en todo el
proyecto. Repasado a mano el flujo completo contra la sección 4 del
plan (las 4 reglas de la máquina de estados) y contra las 3
respuestas de Cris de arriba. **NO probado contra Firebase real ni
navegador** — falta confirmar en el mapa real: tocar una categoría con
subcategorías (se abre la fila, mapa ya muestra todo lo de la
categoría), tocar una subcategoría (filtra más), tocarla de nuevo
(vuelve a mostrar toda la categoría), flecha (vuelve a "Todo"), y una
categoría SIN subcategorías (filtra normal, no abre nada).

**Sigue:** Etapa E (animación: deslizamiento + curva S + la flecha
entrando desde la derecha en el lugar del primer botón, según la
Opción 1 que eligió Cris) y Etapa F (QA final).

## Sesión: 2026-09-06 (Etapa C) — Selector de subcategorías en el pin

Continuación del plan tras cerrar la Etapa B (ver más abajo). Cris
confirmó seguir con la Etapa C sin preguntas pendientes.

**Cambios:**
- `js/categories.js`: `buildMultiCatSelector(containerId, selectedCats, selectedSubcats)`
  gana un 3er parámetro opcional; internamente arma/reconstruye una
  segunda fila de chips (`_rebuildSubcatSelector`) con la convención de
  nombres `cat-chips-X` → `subcat-chips-X`. Esa fila se filtra
  dinámicamente: unión de subcategorías ACTIVAS de todas las
  categorías principales tildadas en ese formulario. `toggleCatChip`
  ahora dispara `_rebuildSubcatSelector` en cada click — al destildar
  una categoría, sus subcategorías tildadas se caen solas (regla de la
  sección 3.2, no deja "huérfanas"); al re-tildarla, lo que seguía
  siendo válido se preserva (lee el estado actual del DOM antes de
  reconstruir, salvo en la carga inicial que usa `selectedSubcats`).
  Nuevas `toggleSubcatChip`, `getSelectedSubcats`, `_findSubcatOwner`
  (color del chip = color de la categoría padre). `patchAddForm`/
  `patchEditForm` agregan los divs `#subcat-chips-add`/`-edit` + label
  "Subcategoría (opcional)" debajo de la fila de categorías.
- `js/pin-adjust.js`: `saveNew`/`saveEdit` leen `getSelectedSubcats(...)`
  y guardan `poi.subcategories: string[]` junto con `categories`.
- `js/admin.js`: al abrir "Editar", precarga `p.subcategories` pasando
  el 3er argumento nuevo a `buildMultiCatSelector`.
- `index.html`: bump de cache-busting de `categories.js`,
  `pin-adjust.js` y `admin.js` a `?v=20260906-2100` — los 3 archivos
  tocados hoy, aplicando la regla que quedó anotada en el plan tras el
  problema de cache de la ronda anterior (ver entrada de abajo,
  "continuación 4").

**Decisiones tomadas sin volver a preguntar** (Cris ya había dicho que
no hacía falta): las subcategorías inactivas no aparecen como opción
(mismo criterio que las categorías principales — `active !== false`);
si no hay ninguna categoría principal tildada, el selector de
subcategorías muestra un texto guía en vez de quedar vacío sin
explicación; el color de cada chip de subcategoría hereda el de su
categoría padre (no tienen color propio, no estaba definido en el
modelo de datos de la Etapa A).

**No tocado a propósito (fuera de alcance de Etapa C):** la
importación masiva de pines por texto (`confirmBulkFullImport`,
`js/pin-adjust.js` ~L1428) sigue sin poder asignar subcategoría — es
un flujo aparte (`PLAN_IMPORTACION_MASIVA.md`), no formaba parte de
este plan. `pin-visibility.js` no cambió — el campo se guarda pero
todavía nada lo lee (eso es la Etapa D).

**Pruebas realizadas:** `node --check` sin errores en todo el
proyecto. Grep de todos los call-sites de `buildMultiCatSelector`
confirmando que ninguno quedó con la firma vieja de 2 argumentos
rota, y que ningún otro archivo (`owner-panel.js`, `eventos.js`) usa
este selector (eventos usa categoría fija `'evento'`, no pasa por
acá). **NO probado contra Firebase real ni navegador** — falta
confirmar: (a) crear un pin nuevo con 2 categorías + subcategorías de
ambas, guardar, recargar y que las subcategorías sigan ahí; (b) editar
un pin viejo sin `subcategories` (campo inexistente) y que no rompa
nada; (c) destildar una categoría con subcategorías tildadas y
confirmar que se destildan solas: (d) confirmar visualmente que el
color de los chips de subcategoría se ve bien (hereda de la categoría
padre, puede quedar parecido si dos categorías padre comparten tono).

**Sigue:** Etapa D (filtro real del mapa público por subcategoría) y
Etapa E (animación) — Etapa C solo deja el dato guardado, el mapa
público no cambia todavía.

## Sesión: 2026-09-06 (continuación 4) — Nombre editable visible, refuerzo de borrado/guardado y legibilidad de textos chicos + fix de cache-busting

Cris reportó 3 problemas tras probar la ronda anterior: (1) borrado de
subcategoría sin confirmación y aparente bypass del guardado manual,
(2) recargar sin guardar no revertía un borrado, (3) no podía editar
el nombre de una categoría/subcategoría, (4) textos chicos del panel
en verde muy claro, difíciles de leer.

**Hallazgo importante sobre (1) y (2):** revisando el código, el
`confirm()` y el guardado manual (sin autoguardado a Firestore) YA
estaban correctamente implementados desde la ronda anterior
(continuación 2 y 3, más arriba en este archivo). **La causa más
probable real es otra:** `index.html` cargaba `js/categories.js` con
`?v=20260906` desde la entrega inicial de la Etapa B, y esa versión
**nunca se bumpeó** en las 2 rondas de fixes siguientes (continuación
2 y 3) — la nota de continuación 2 decía explícitamente "index.html no
cambió... ya tenía el ?v=20260906 de la entrega anterior, sigue
sirviendo", asumiendo que alcanzaba con que el querystring ya existiera
ese día. Eso es un error: el cache-busting solo fuerza una descarga
nueva cuando el VALOR del querystring cambia; si dos contenidos
distintos de `categories.js` se sirven bajo el mismo `?v=20260906`, un
navegador que ya cacheó esa URL en algún momento del día puede seguir
sirviendo una versión vieja aunque el archivo en el servidor ya esté
actualizado. Esto explicaría por qué comportamientos "ya arreglados"
(confirmación de borrado, guardado manual) parecían no estar aplicados.
**Corregido ahora:** `?v=20260906-1955` en `index.html`.

**Cambios de este round (`js/categories.js`):**
- El nombre en español de cada categoría/subcategoría pasa a un campo
  de texto SIEMPRE visible en la fila (antes solo se editaba adentro
  del acordeón "🌐 Idiomas", oculto por defecto). El acordeón queda
  renombrado "🌐 Inglés / Portugués" y solo maneja esos 2 idiomas.
- Refuerzo extra (no reemplaza lo anterior, que ya estaba bien): si hay
  cambios sin guardar (`_catsDirty`) y se intenta recargar/cerrar la
  pestaña del navegador, ahora aparece el aviso nativo de "salir sin
  guardar".
- Textos chicos de la pestaña Categorías (`#tp-cats` únicamente, no el
  resto del panel admin): se sobreescribe `--text3` por un verde bien
  oscuro dentro de ese contenedor (con variante clara para el skin
  "neobrutal-night", fondo oscuro), y los tamaños de fuente chicos
  hardcodeados (9/9.5/10/11/12px) suben +2px vía selector de atributo
  por substring del `style` inline, sin reescribir cada línea de
  `index.html` una por una.

**Archivos modificados:** `js/categories.js`, `index.html` (bump de
cache-busting de `categories.js`), este archivo.

**Pruebas realizadas:** `node --check` sin errores en todo el
proyecto. Grep confirmando que no quedó ninguna referencia colgante a
`data-row-label` (reemplazado por `data-name-input`). **NO probado
contra Firebase real ni navegador** — pendiente que Cris confirme,
especialmente con recarga forzada (Ctrl+Shift+R) para descartar
cualquier resto de cache vieja servida bajo el `?v=` anterior.

## Sesión: 2026-09-06 (continuación 3) — Guardado manual (sin autoguardado) en la pestaña Categorías

Cris marcó que la pestaña Categorías guardaba cada cambio en
Firestore al toque (activar/desactivar, editar idioma, editar
ícono/color, crear/borrar categoría o subcategoría, cambiar cantidad
de campos de idioma) — sin forma de arrepentirse de un error antes de
que quede visible para cualquiera que cargue la página. Pidió
explícitamente el mismo patrón que ya existe en "Apariencia global"
(botón único al final de la pestaña que aplica/guarda de una).

**Cambio:** se sacaron las 9 llamadas a `saveCategoriesSettings()`
que estaban desperdigadas en `toggleCat`, `deleteCat`, `toggleSubcat`,
`deleteSubcat`, `addSubcat`, el alta de categoría nueva, el listener
de idiomas, el listener de ícono/color, y el candado de cantidad de
idiomas. Todas esas acciones ahora solo tocan memoria
(`CAT`/`CUSTOM_CATS`/`languageFieldsCount`) y llaman a
`_markCatsDirty()`, que prende un aviso "⚠️ Tenés cambios sin
guardar..." y cambia el texto del botón a "💾 Guardar cambios ●".
Se agregó `<button id="btn-save-cats">` al final de la pestaña
(`index.html`, debajo de "+ Agregar Categoría") — es el único punto
que ahora llama a `saveCategoriesSettings()` de verdad; si la
recargás sin tocarlo, lo no guardado se pierde (a propósito: es la
forma de "deshacer" un error).

**Archivos modificados:** `js/categories.js` (grueso: nuevo
`_catsDirty`/`_markCatsDirty`/`_clearCatsDirty`/`_wireCatsSaveButton`,
+ las 9 llamadas removidas), `index.html` (botón + aviso al final del
tab `tp-cats`).

**Pruebas realizadas:** `node --check` sin errores en todo el
proyecto; grep confirmando que no queda ningún `saveCategoriesSettings()`
fuera del botón nuevo; ids `btn-save-cats`/`cats-unsaved-warning`
cruzados entre `index.html` y `categories.js`. **NO probado contra
Firebase real ni navegador** — pendiente que Cris confirme: hacer un
cambio y ver el aviso + el botón cambiar, recargar sin guardar y
confirmar que el cambio desapareció, y hacer un cambio + guardar y
confirmar que sí persiste tras F5.

## Sesión: 2026-09-06 (continuación 2) — Fixes de UX pedidos sobre la Etapa B (idiomas/subcategorías)

Cris probó la Etapa B y pidió 3 correcciones, las 3 en `js/categories.js`:

1. **Botón "+ Agregar" gigantesco / campo de texto invisible.** Causa
   real: `.btn-outline` (css/base.css) tiene `width:100%` por defecto;
   al ponerlo adentro de una fila flex junto al input sin pisarle el
   `width` inline, el botón se quedaba con casi todo el ancho de la
   fila y el input de texto quedaba comprimido a unos pocos píxeles
   (por eso "no se ve lo que se escribe" — no era un problema de
   color, era de ancho). Fix: `width:auto;flex:0 0 auto` en el botón +
   `min-width:0` en el input.
2. **No había forma de editar ícono/color de una categoría ya creada**
   (solo se fijaban al crear). Se agregó un desplegable "✏️ Ícono y
   color" por categoría (no en subcategorías — no tienen esos campos,
   ver sección 3.1 del plan), con los mismos 2 controles del alta
   (emoji + color picker), autoguardado en `change`. El nombre (texto)
   ya se podía corregir desde el desplegable "🌐 Idiomas" de la Etapa
   B — ahora entre los dos, una categoría es tan editable como
   cualquier otra cosa del admin.
3. **Borrado sin ningún tipo de confirmación.** Cris pidió explícitamente
   NO un candado de checkboxes (como el del ID) sino 1 solo botón +
   una pregunta de confirmación. Se agregó `confirm("¿Eliminar la
   categoría/subcategoría \"X\"? Esta acción no se puede deshacer.")`
   en `deleteCat`/`deleteSubcat` — mismo patrón ya usado en el proyecto
   para borrar un evento (`js/eventos.js`).

**Archivo modificado:** solo `js/categories.js` (index.html no cambió
en esta ronda — ya tenía el `?v=20260906` de la entrega anterior, sigue
sirviendo).

**Pruebas realizadas:** `node --check` sin errores en todo el
proyecto. Grep de los nuevos hooks (`data-icon-input`,
`data-color-input`, `cats-icon-details`, `openIconEdit`) para
confirmar que quedaron cableados en los 3 puntos (render, wiring de
`<details>`, listener delegado). **NO probado contra navegador
real** — pendiente que Cris confirme los 3 puntos.

## Sesión: 2026-09-06 (continuación) — Etapa B de PLAN_CATEGORIAS_SUBCATEGORIAS.md (admin: editar idiomas + CRUD subcategorías)

**Alcance: UI de admin para lo que dejó preparado la Etapa A.** Tab
"Categorías" del admin (`index.html` + `js/categories.js`) ahora
permite, por cada categoría (builtin o custom):
- Editar sus 3 idiomas (ES/EN/PT) desde un desplegable "🌐 Idiomas"
  con un input de texto por idioma — guarda al salir del campo
  (evento `change`), actualiza en vivo el nombre de esa fila y la
  barra de filtros pública, y persiste en Firestore.
- Ver/crear/activar-desactivar/eliminar sus subcategorías desde un
  desplegable "📂 Subcategorías (N)" — cada subcategoría con su
  propio toggle (mismo patrón `.za-toggle` de siempre), su propio
  editor de idiomas, y botón eliminar. Alta con un input + botón
  "+ Agregar" dentro de cada categoría (mismo generador de id que ya
  usaba el alta de categorías, factorizado en `_genCatSlugId`).
- Fila superior nueva "Cantidad de campos de idioma": input numérico
  bloqueado + candado doble (mismo patrón exacto que
  `e-slug-lock1`/`e-slug-lock2` de `pin-adjust.js`, replicado acá como
  `cats-lang-count-lock1`/`lock2`). Mínimo duro 3. **Nota importante:**
  como hoy solo existen 3 idiomas reales en toda la app (ES/EN/PT,
  `LANG_CODES` fijo en `categories.js`), subir este número más allá de
  3 queda preparado para el futuro pero TODAVÍA NO agrega más campos
  visibles — agregar un 4to idioma real es explícitamente "fuera de
  alcance" del plan (sección 1). Avisado en el comentario del código y
  acá para que no genere confusión si Cris prueba subirlo.

**Detalle técnico no trivial:** como `renderCatsAdmin()` reconstruye
todo `#cats-admin-list` con `innerHTML` cada vez que cambia algo (activar,
eliminar, agregar), los `<details>` abiertos se perderían en cada
render. Se agregó `_catsUIState` (dos `Set` en memoria) que registra
qué categoría/subcategoría tiene su editor de idiomas o su sub-lista
abierta, y se reaplica el atributo `open` en cada render — así activar
una categoría no cierra de golpe el editor de idiomas que el admin
tenía abierto en otra. La edición de texto de idioma en sí NO dispara
un re-render completo (evitaría cerrar el `<details>` mientras se
escribe) — solo actualiza el `<span data-row-label>` puntual de esa
fila vía DOM directo.

**Persistencia:** sin cambios de esquema respecto a la Etapa A — ya
`saveCategoriesSettings()`/`loadCategoriesSettings()` (`settings-sync.js`)
guardaban/leían `subcategories` y `label` completos dentro de
`builtinData`/`customCats`, y `languageFieldsCount`. Esta etapa solo
agregó la UI que los usa; se llama a `saveCategoriesSettings()` después
de cada alta/edición/borrado (idiomas, subcategorías, cantidad de
campos).

**NO se tocó en esta entrega (etapas posteriores):**
`poi.subcategories` (no existe todavía en ningún pin — recién se
agrega en la Etapa C, junto con el selector en Nuevo/Editar);
`activeFilter`/`activeSubfilter` y el filtrado real por subcategoría
en el mapa público (Etapa D); animación de la barra de filtros (Etapa
E). Por eso las subcategorías de esta entrega no tienen contador de
pines (siempre sería 0 — no hay nada todavía que las asigne a un pin).

**Cache-busting:** se subió `?v=` a `20260906` en los 8 `.js` tocados
hoy entre las dos entregas (Etapa A + B): `settings-sync.js`,
`config.js`, `admin.js`, `content-import.js`, `categories.js`,
`pin-adjust.js`, `data-io.js`, `app.js` — para que el navegador no
sirva la versión vieja cacheada.

**Archivos modificados:** `js/categories.js` (grueso del cambio:
`getCatLabel`/`_getCatRef`/`_genCatSlugId`/`LANG_CODES`/
`_catsUIState`/`_langEditorHTML`/`renderCatsAdmin` reescrito/
`_wireCatsDetailsToggles`/`_wireCatsLangInputs`/`toggleSubcat`/
`deleteSubcat`/`addSubcat`/`_resetLangCountLock`/
`_applyLangCountLockState`/`_wireLangCountLock`), `index.html` (markup
del candado de cantidad de idiomas en el tab Categorías + bump de
cache-busting en 8 scripts), `PLAN_CATEGORIAS_SUBCATEGORIAS.md`
(registro de etapa, sección 13).

**Pruebas realizadas:** `node --check` sin errores en TODOS los `.js`
del proyecto (no solo los tocados). Grep cruzado de ids entre
`index.html` y `categories.js` (`cats-lang-count`,
`cats-lang-count-lock1/2`, `cats-lang-count-warning`,
`cats-admin-list`) — cada uno aparece exactamente 1 vez en el HTML.
Grep de nombres nuevos (`_getCatRef`, `_genCatSlugId`, `LANG_CODES`,
`LANG_NAMES`, `_catsUIState`, `toggleSubcat`, `deleteSubcat`,
`addSubcat`, `_resetLangCountLock`, `_applyLangCountLockState`) contra
el resto de los `.js` del proyecto — sin colisión de nombres. **NO
probado contra Firebase real ni navegador** — pendiente que Cris
confirme: el desplegable de idiomas de una categoría edita y guarda
bien (los 3 campos), crear/activar/desactivar/eliminar una
subcategoría funciona y persiste tras F5, el candado de "cantidad de
campos de idioma" se comporta igual que el del ID de un pin (bloqueado
→ 2 checks → editable en rojo → destildar descarta), y que nada de lo
que ya andaba (alta de categoría, activar/desactivar categoría,
importación masiva, buscador, export/import JSON) se rompió.

## Sesión: 2026-09-06 — Etapa A de PLAN_CATEGORIAS_SUBCATEGORIAS.md (modelo de datos)

**Alcance de esta entrega: SOLO modelo de datos, sin UI nueva**
(Etapa A del plan). `CAT` (`js/config.js`) pasa de `label` string
plano a `label` multi-idioma (`{es,en,pt}`) + `subcategories: {}`
anidado (vacío en las 7 categorías — el árbol real de qué categoría
pasa a subcategoría de cuál queda pendiente, es decisión de Cris
desde el admin una vez exista la UI, ver sección 11.2 del plan). Se
conservan los 7 ids tal cual para no romper `poi.categories` ya
guardado. Se agregó `languageFieldsCount` (default 3) en
`js/config.js`, para el candado doble de la Etapa B (todavía sin
UI).

**Consecuencia de cambiar el shape de `label` (no opcional, para no
romper nada ya funcionando):** se agregó `getCatLabel(cat, lang)` en
`js/categories.js` (expuesta en `window`), única forma correcta de
leer el label como string — mismo criterio de fallback completo a
español que ya usa `AppState.getContent()` (sección 10 del plan).
Se actualizaron TODOS los lugares que leían `cat.label`/`CAT[x].label`
directo como string para usar esta función en su lugar (si no, se
hubiera roto cualquier UI que mostrara una categoría):
`js/categories.js` (renderCatsAdmin, toggleCat, deleteCat,
updateFilterBar, buildMultiCatSelector, alta de categoría custom —
ahora crea el mismo shape que las builtin, con `subcategories:{}`),
`js/content-import.js`, `js/app.js` (buscador), `js/admin.js`
(listado de Lugares), `js/data-io.js` (export/import JSON),
`js/pin-adjust.js` (`saveNew`, `saveEdit`, y `_resolveBulkCategory` —
esta última además ahora matchea texto libre de categoría contra
CUALQUIER idioma cargado del label, no solo el activo).

**Persistencia (`js/settings-sync.js`):** `saveCategoriesSettings()`/
`loadCategoriesSettings()` ahora guardan/leen la categoría base
COMPLETA (`builtinData`: label + subcategories + active), no solo el
flag `active` como antes (`builtinActive`) — cambio de fondo
documentado en el propio `AI_RULES.md` (a actualizar, ver pendiente
abajo) según indica su sección 9. Se mantiene lectura del esquema
viejo `builtinActive` como fallback si `builtinData` no existe
todavía, para no perder configuración ya guardada en producción.
También persiste `languageFieldsCount`.

**NO se tocó en esta entrega (a propósito, corresponde a etapas
posteriores del plan):** `activeFilter`/`activeSubfilter` (máquina de
estados, Etapa D), animación de la barra de filtros (Etapa E),
UI de admin para editar idiomas/subcategorías (Etapa B), selector de
subcategorías en Nuevo/Editar (Etapa C), `poi.subcategories` (no se
agregó todavía a ningún pin — no hay nada que lo lea ni lo escriba
hasta la Etapa C/D).

**Pendiente para la próxima sesión de código:** actualizar
`AI_RULES.md` sección 3/7 para reflejar que `CAT[x].label` ya no es
string (mencionar `getCatLabel()`), y que `builtinData` reemplazó a
`builtinActive` en `settings/categories` — no se tocó `AI_RULES.md`
todavía en esta entrega.

**Archivos modificados:** `js/config.js`, `js/categories.js`,
`js/settings-sync.js`, `js/content-import.js`, `js/app.js`,
`js/admin.js`, `js/data-io.js`, `js/pin-adjust.js`,
`PLAN_CATEGORIAS_SUBCATEGORIAS.md` (registro de etapa, sección 13).

**Pruebas realizadas:** `node --check` sin errores en los 8 `.js`
tocados; grep de todos los usos de `.label` en `js/`/`index.html`
para confirmar que no quedó ningún lugar leyendo `cat.label` como
string sin pasar por `getCatLabel()`. **NO probado contra Firebase
real ni navegador** — pendiente que Cris confirme: la app sigue
funcionando igual que antes (categorías, filtro, alta de categoría
custom, importación masiva por texto, export/import JSON), sin
diferencia visible todavía (Etapa A es solo modelo de datos).

## Sesión: 2026-09-04 (continuación 2) — LA causa real: `setPointerCapture` en el pointerdown de la barra de filtros

**Dato clave que dio Cris:** en PC el botón de filtro se "aprieta" un
instante (efecto nativo del navegador) pero nunca queda marcado como
seleccionado — el mapa nunca cambia. Esto descartó todo lo investigado
antes (clusters, categorías, pin-visibility) y apuntó derecho al
mecanismo de click en sí.

**Causa real, confirmada contra reportes idénticos de otros
proyectos reales (Chromium/Firefox/Safari, y un caso de un
seat-picker con el mismo síntoma exacto):** `updateFilterBar()`
(categories.js) implementa "arrastrar la barra de filtros con el
mouse para hacer scroll horizontal" usando `bar.setPointerCapture(e.
pointerId)` — pero lo llamaba en el `pointerdown`, es decir, en
CUALQUIER toque, incluido un simple click sin arrastre. Es un bug
conocido de esa API: una vez capturado el puntero, el `click`
resultante puede terminar dirigido al CONTENEDOR (`bar`) en vez del
botón que el usuario realmente tocó — y como el listener de click
vive en cada botón (`.fbtn`), nunca le llega. El "apretado" que ve
Cris es el CSS nativo del navegador (no depende de este bug); lo que
falla es que el JS de click nunca se ejecuta.

Por qué solo en PC: es un problema que afecta sobre todo a mouse/
desktop (el touch de los celulares tolera mejor este caso particular
de la API, según la documentación consultada), y Cris probó en 4
navegadores de PC (todos con mouse) contra 1 solo celular (touch).

**Fix real, no un caso especial inventado — es el patrón estándar y
documentado para "arrastre que no debe romper el click de sus
hijos"**: capturar el puntero recién cuando se CONFIRMA que es un
arrastre real (se cruza el umbral de movimiento), nunca en el
`pointerdown`. Un click sin arrastre nunca llega a capturar nada, así
que el evento de click llega íntegro al botón. Se agregó también
`releasePointerCapture` explícito en el `pointerup` (buena práctica,
antes no estaba).

**Archivo modificado:** `js/categories.js` (`updateFilterBar`).
`node --check` sin errores. Esta vez el fix apunta directo al
mecanismo que Cris describió (el botón "se aprieta pero no queda
marcado"), así que hay bastante confianza de que sea la causa real —
igual pendiente de confirmación en PC.

## Sesión: 2026-09-04 (continuación) — Causa real encontrada: `_restoreHiddenByCluster()` pisaba al filtro

**Cris pidió explícitamente** que la corrección anterior (try/catch)
no fuera un parche — quería la causa real resuelta de raíz, no
código defensivo tapando el síntoma. Se siguió investigando y se
encontró la causa real (ver razonamiento completo en el comentario
del propio código, `cluster-grouping.js`):

`_restoreHiddenByCluster()` (corre al inicio de cada
`computeAndRenderClusters()`) restauraba a ciegas (`visibility=''`)
CUALQUIER pin que hubiera estado oculto por un cluster anterior — sin
preguntar si ese pin debía seguir oculto por OTRO motivo (el filtro
recién elegido). Como los pines filtrados quedan excluidos de volver
a agruparse (no son candidatos), nunca se los volvía a ocultar
después — quedaban visibles para siempre, encima del filtro.

Esto es un bug DE FONDO en el sistema de clusters, que existía desde
antes de esta sesión — pero nunca se notaba porque `applyFilter()`
nunca disparaba un recompute de clusters (el bug original de este
plan). Al conectar `applyFilter()` → `scheduleClusterRecompute()`
(parte necesaria del fix de PLAN_VISIBILIDAD_PINES_UNIFICADA.md) quedó
expuesto. En PC, con más área de mapa visible, hay más pines
agrupados en clusters de entrada → el impacto es mucho más notorio
que en el celular.

**Fix real:** `_restoreHiddenByCluster()` ya no restaura a ciegas —
delega a `applyPinVisibility()` (pin-visibility.js, la única fuente
de verdad) para que cada pin quede exactamente como corresponde. No
es una excepción/regla especial nueva: es la MISMA función central
que ya se usa en todos lados, aplicada acá también — coherente con
el objetivo de fondo del plan (1 sola lógica de "¿se ve este pin?").

**Archivo modificado:** `js/cluster-grouping.js` (además del
try/catch de la sesión anterior, que se mantiene — es buena práctica
real, aislar fallas, no un parche del síntoma reportado). `node
--check` sin errores. Pendiente: confirmación de Cris en PC.

## Sesión: 2026-09-04 — Parche de robustez tras reporte de Cris (filtros sin efecto en PC, sí en celular)

**Reportado:** después de la entrega de PLAN_VISIBILIDAD_PINES_UNIFICADA,
Cris probó en 4 navegadores de PC y ningún filtro de categoría aplicaba
nada (todos los pines quedaban siempre visibles) — en el celular sí
funcionaba bien.

**Hipótesis con más peso (no confirmada en navegador real, pendiente
de que Cris mande la consola — F12 — al clickear un filtro en PC):**
tanto `applyAllPinVisibility()` (pin-visibility.js) como el filtro de
candidatos de `computeAndRenderClusters()` (cluster-grouping.js)
recorrían TODOS los pines sin ningún try/catch — si UN SOLO pin
tirara una excepción (ej. algún dato viejo/raro puntual de ese pin),
el recorrido se cortaba ahí mismo y ningún pin posterior se llegaba a
procesar, sin ningún error visible más que en la consola. Como PC
tiene más área de mapa visible, carga más pines de una vez (viewport
loader) — más chance de tocar un pin problemático que en el celular,
que carga menos por vez. Encaja con el patrón reportado.

**Fix aplicado (independiente de si esta es la causa real o no — es
una mejora de robustez correcta de todas formas):** ambos recorridos
ahora aíslan cada pin en su propio try/catch — si uno falla, se avisa
por consola con su id (para poder investigarlo después) y se sigue
con el resto, nunca más se corta todo por 1 solo pin.

**Archivos modificados:** `js/pin-visibility.js`, `js/cluster-grouping.js`.
`node --check` sin errores. **Pendiente real:** que Cris confirme si
esto resolvió el problema, y si no, que mande captura de la consola
(F12 → pestaña Console) al clickear un filtro en PC — con el try/catch
puesto, si el problema persiste, ahora debería aparecer un
`console.warn` señalando exactamente qué pin falla y con qué error,
lo cual da la pista real para el siguiente paso.

## Sesión: 2026-09-03 (continuación) — PLAN_VISIBILIDAD_PINES_UNIFICADA.md ejecutado

**Pedido de Cris:** no solo arreglar que el cluster ignorara el filtro
público — quería resolver de raíz que "¿este pin se ve?" estuviera
respondido por separado en 7 lugares del código, para que agregar/
sacar/cambiar una categoría a futuro no obligue a tocar múltiples
archivos. Plan completo entregado antes de programar (ver
`PLAN_VISIBILIDAD_PINES_UNIFICADA.md`), confirmado por Cris.

**Implementado tal cual el plan:**
1. **Nuevo `js/pin-visibility.js`**: `isPinVisible(poi)` (decide:
   activo + al menos 1 categoría activa + pasa el filtro público
   elegido) + `applyPinVisibility(poi)` (aplica display/visibility al
   DOM) + `applyAllPinVisibility()` (recorre todos los pines). Cargado
   en `index.html` antes de `markers.js`.
2. `cluster-grouping.js` (`computeAndRenderClusters`): el filtro de
   candidatos pasó de `entry.poi.active !== false` a
   `isPinVisible(entry.poi)` — este es el fix real del bug reportado
   (clusters ya respetan el filtro público, y van a seguir
   respetando cualquier filtro que se agregue a futuro sin tocar este
   archivo de nuevo).
3. `markers.js` (`makeMarker`): el chequeo de `poi.active===false`
   hardcodeado se reemplazó por `applyPinVisibility(poi)` — de paso
   corrige que un pin recién cargado al panear (viewport loader)
   ignorara el filtro público activo.
4. `admin.js` (`togglePoi`, la versión REAL — ver punto 6): usa
   `applyPinVisibility(p)` en vez de manipular el DOM a mano.
5. `categories.js`: `toggleCat()` y `applyFilter()` delegan ambas a
   `applyAllPinVisibility()` + `scheduleClusterRecompute()`. Bug de
   paso corregido en `toggleCat()`: antes un pin con 2+ categorías
   podía quedar oculto ENTERO al apagar solo UNA de ellas (sin mirar
   si la otra seguía activa), con resultado dependiente del orden de
   los toggles — ahora pide "al menos 1 categoría activa", correcto.
6. **Hallazgo de paso**: existían DOS `window.togglePoi` (app.js y
   admin.js) — la de app.js era código muerto (admin.js la pisaba al
   cargar después). Se rescató la única línea real que tenía y no
   estaba en la de admin.js (`scheduleClusterRecompute()` tras
   activar/desactivar un pin) y se borró la duplicada de app.js.
7. `eventos.js`: las 2 funciones de auto-desactivar/reactivar pin
   temporal (`evento_temporal`) ahora llaman a `applyPinVisibility` +
   `scheduleClusterRecompute` en vez de su propia manipulación de DOM.

**Fuera de alcance, sin tocar (a propósito):** la ocultación temporal
que hace el propio `cluster-grouping.js` cuando un pin queda
"tragado" dentro de una burbuja de cluster (`parent.style.visibility`
en las líneas ~91/210 de ese archivo) — es una capa DISTINTA y
posterior a `isPinVisible()` (agrupamiento visual, no filtro), no es
parte de este problema y no se tocó.

**Archivos modificados:** `js/pin-visibility.js` (nuevo),
`js/cluster-grouping.js`, `js/markers.js`, `js/admin.js`, `js/app.js`,
`js/categories.js`, `js/eventos.js`, `index.html`. `node --check` sin
errores en los 7 archivos JS. Barrido final confirmó que no queda
ninguna manipulación directa de display/visibility de pines fuera de
`pin-visibility.js` (salvo la capa de clustering, fuera de alcance a
propósito). No se pudo probar en navegador real — pendiente de
confirmación de Cris: filtro de categoría + cluster sincronizados,
filtro "Eventos" + cluster sincronizados, pin con 2 categorías
(activar/desactivar cada una por separado), pin temporal de evento
que vence con el filtro puesto.

## Sesión: 2026-09-03 — Panel Global: sombra/glow "reseteados", y tamaño del edificio maximizado con relación inversa a "Tamaño de pins en el mapa"

**Reportado por Cris:** (1) la configuración del panel Global se ve
"desconfigurada" cada vez que entra, aunque esté bien guardada; (2)
puntualmente, el tamaño del edificio maximizado (slider dedicado) se ve
CHICO al recargar la página aunque el slider muestre el valor correcto
guardado (ej. 300px) — y se arregla solo, temporalmente, con solo
tocar "Aplicar cambios" sin cambiar nada; (3) además notó que el
slider "Tamaño de pins en el mapa" y el del edificio maximizado tienen
una relación INVERSA no deseada (subir uno baja el otro visualmente).

**Causa raíz (1)+(2), confirmada leyendo el código (no solo
hipótesis):** dos bugs reales distintos, ambos del mismo tipo
("se aplica antes de que termine de cargar lo guardado, y nadie lo
vuelve a aplicar después"):
- `js/shadow-eye.js`: `applyShadow()`/`applyEyeGlowColor()` se
  ejecutaban UNA sola vez, al parsear el script — antes de que
  `loadGlobalSettings()` (asíncrono) trajera el valor real guardado.
  Nada las volvía a llamar después.
- El tamaño del edificio maximizado tenía DOS sistemas paralelos
  compitiendo por la misma propiedad CSS del mismo pin: el viejo
  (`expandScale`, un multiplicador fijo aplicado vía hoja de estilos
  en `applyGlobalDim()`, corre al cargar la página) y el nuevo
  (`expandSize`/ahora `expandPercent`, aplicado vía estilo inline
  en `pin-adjust.js` recién al tocar un pin). Tenerlos los dos activos
  a la vez daba un resultado visual inconsistente según el momento.

**Causa raíz (3), confirmada con la fórmula:** el cálculo de escala
del pin maximizado dividía por `globalSettings.pinSize` (el VALOR
GUARDADO del slider "Tamaño de pins en el mapa"), no por el tamaño
REAL que el pin tenía en pantalla en ese momento — si se tocaba ese
slider sin guardar, los dos números (guardado vs. real en pantalla)
dejaban de coincidir, dando la relación inversa.

**Fix aplicado:**
1. `js/app.js` (`init()`): se agregó `applyShadow()`/
   `applyEyeGlowColor()` después de que `loadGlobalSettings()`
   termina, mismo patrón que `applyGlobalDim()`/`applyGlobalOutline()`.
2. **Rediseño pedido por Cris** del tamaño del edificio maximizado:
   se retiró por completo el sistema viejo `expandScale` (slider
   "Escala al expandir", su regla CSS en `applyGlobalDim()`, su
   entrada en `data-io.js` import/export) — queda 1 solo sistema.
   El nuevo campo `globalSettings.expandPercent` (rango 20%-200%,
   antes era un px fijo 80-400 que se sentía limitado) es un % de
   `PIN_FULL_IMG_PX = 1024` (la imagen en calidad completa que sube a
   Cloudinary, no el pin chico del mapa) — constante nueva en
   `js/pin-adjust.js`. Migración automática: si había un
   `expandSize` (px) guardado de la versión vieja y no hay
   `expandPercent` todavía, se convierte una sola vez
   (`Math.round(expandSize/1024*100)`) para no perder el ajuste que
   Cris ya había hecho (300px ≈ 29%).
3. **Fix de la relación inversa**: `window.expandPin` (pin-adjust.js)
   ahora mide el tamaño REAL del pin en pantalla con
   `getBoundingClientRect()` en el momento exacto del click, en vez de
   usar `globalSettings.pinSize` — queda desacoplado de verdad, sin
   importar si ese slider se tocó o guardó o no.
4. `js/admin-global.js`: `initGlobalTab()` (se ejecuta cada vez que se
   abre la pestaña Global) ahora también sincroniza sombra/glow de
   ojos/tamaño del edificio maximizado con lo realmente guardado —
   antes esos 3 controles se quedaban siempre con el default del HTML
   al abrir el panel, sin importar lo guardado.
5. **Nuevo botón "↺ Restaurar valores originales"** (`btn-reset-global`)
   en la pestaña Global — pedido explícito de Cris. Usa
   `DEFAULT_GLOBAL_SETTINGS` (nuevo objeto en `admin-global.js`, hay
   que mantenerlo a mano en sync si cambia algún default), aplica y
   GUARDA de verdad (no solo visual), mismo flujo que "Aplicar".
6. `js/data-io.js` (import/export de configuración): actualizado para
   leer/escribir `expandPercent`/`g-expand-size` en vez de las
   referencias viejas a `expandScale`/`g-expand-scale`, que habían
   quedado apuntando a un slider que ya no existe en el HTML (se
   habría roto en silencio en el próximo import).

**Archivos modificados:** `js/app.js`, `js/pin-adjust.js`,
`js/admin-global.js`, `js/data-io.js`, `index.html`. `node --check`
sin errores en los 4 archivos JS. Barrido final confirmó que no queda
ninguna referencia funcional a `expandScale`/`g-expand-scale` (solo
comentarios explicativos). No se pudo probar en navegador real —
pendiente de confirmación de Cris, sobre todo: (a) que sombra/glow ya
no se vean "reseteados" al recargar, (b) que el tamaño del edificio
maximizado con el nuevo rango 20%-200% dé resultados razonables sin
volverse gigante/diminuto en los extremos, (c) que ya no haya relación
entre ambos sliders, (d) que el botón de restaurar funcione bien.

**Nota aparte, sin relación con este bug:** existe un archivo
`indexa.html` en la raíz del proyecto — es una versión vieja e
incompleta (953 líneas vs. 1980 de `index.html`, le faltan varias
features actuales: preconnect, selector de idioma, login de usuario).
No se tocó ni se referencia desde ningún lado del código activo, pero
si Cris lo tiene abierto por error en el navegador (en vez de
`index.html`) explicaría confusión adicional al ver "cosas viejas".
Queda para que Cris decida si lo borra o lo deja.

# AI_SESSION.md — memoria de trabajo de la sesión actual

> Uso: al empezar una sesión nueva, comprobar si esta información corresponde
> realmente a esa sesión (mismo día, mismo hilo de trabajo) antes de confiar
> en ella. Si un archivo listado como "revisado" fue modificado después,
> vuelve a estar pendiente de verificación.

## Sesión: 2026-08-29 (continuación 3) — Fix puntual: permisos de checkEventosTemporalesLifecycle (hallazgo de sección 5)

**Qué era:** `_autoDesactivarPinTemporal()` (js/eventos.js) llamaba
siempre a `savePoiToFirestore()` + `regeneratePublicCache()`
(escrituras admin-only por reglas de Firestore) para CUALQUIER
visitante público con un pin `evento_temporal` vencido cargado —
mismo patrón de bug que ya se había corregido para
`regeneratePublicCache()` en la sección 2 del plan de performance.
Protegido por try/catch, no rompía nada visible, pero seguía siendo
una escritura rechazada de más en consola en cada carga.

**Fix:** mismo criterio que ya se usa en `firestore-sync.js` — la
escritura real a Firestore (`savePoiToFirestore` +
`regeneratePublicCache`) solo se intenta si hay sesión de admin
real y verificada (`_adminUser`). Para un visitante público sin
sesión, el pin se sigue ocultando en SU pantalla igual (mismo
mecanismo de togglePoi()), pero la desactivación permanente en
Firestore queda para la próxima vez que un admin cargue la página.

**Archivo modificado:** `js/eventos.js` (`_autoDesactivarPinTemporal`).
`AI_RULES.md` actualizado. Verificado: `admin-auth.js` carga antes
que `eventos.js` en `index.html`, así que `_adminUser` ya existe
cuando se necesita; `node --check` sin errores.

**Con esto queda cerrado TODO PLAN_OPTIMIZACION_PERFORMANCE_2026-08-29.md**
excepto la migración de SDK Firebase (Cris la dejó para después a
propósito) y la tarea manual de imágenes .png en Cloudinary (no es
código).

## Sesión: 2026-08-29 (continuación 2) — Paginado de pines por viewport/zoom (item 6.1 real del plan) + buscador separado

**Contexto:** después de cerrar el clustering visual (ver entrada de
arriba, misma fecha), Cris confirmó que el plan de performance
todavía tenía pendiente el punto 6.1 ORIGINAL: `db.collection('pines').get()`
sin `.limit()` en `js/firestore-sync.js` — descarga la colección
COMPLETA en cada visita pública, sin importar si hay 11 pines o
5000. Eligió resolverlo por viewport/zoom (no límite fijo, no botón
"cargar más") aunque impique más trabajo.

**Decisión de alcance, confirmada con Cris antes de programar:** el
recorte por viewport es SOLO para el mapa público. El panel Admin
(tab Lugares) sigue viendo/editando/borrando TODOS los pines sin
recorte (forzado en `openAdmin()`) — perdería el control si no. El
buscador también ve TODOS los pines (Cris lo eligió explícitamente,
opción "buscar en todo" en vez de "buscar solo lo cargado" — pensando
además en unificarlo a futuro con eventos, anotado en
`/areas/smartcity-roadmap.md`), pero mediante una consulta APARTE que
se dispara una sola vez por sesión (cacheada), no automática en cada
carga de página — así no reintroduce el problema original.

**Archivo nuevo:** `js/pins-viewport-loader.js` — consulta Firestore
acotada por rango `lat`/`lng` (bounding box del área visible del
mapa + 50% de margen), con `fetchPinsInViewport()` (solo trae datos)
separada de `drawLoadedPins()` (solo dibuja) a propósito: así
`checkEventosTemporalesLifecycle()` (ver sección 3.5 de `js/app.js`)
sigue corriendo ANTES de dibujar, igual que antes de este cambio —
evita que un pin `evento_temporal` recién vencido parpadee visible un
instante (regresión detectada y corregida en el camino, no estaba en
el plan original). `loadPinsInViewport()` = ambas juntas, usada en
pan/zoom en vivo (debounced 350ms vía `map.on('moveend zoomend', ...)`).
Los pines ya cargados nunca se sacan del mapa al alejarse — crecer en
memoria a medida que se explora es aceptado, lo que se evita es la
descarga masiva de arranque.

**Requiere un índice compuesto en Firestore (`lat`, `lng`)** — la
primera vez que corra en el entorno real de Cris, la consulta va a
fallar con un error en consola que trae un link directo para crearlo
en Firebase Console → Indexes, 1 clic. Es esperable, pasa una sola
vez.

**Archivos modificados:**
- `js/firestore-sync.js` — `loadPOISFromFirestore()` (colección
  completa) queda intacta pero ya NO se llama en cada visita
  pública; nota actualizada aclarando quién la sigue usando. Función
  nueva `loadSearchIndex()`: misma lectura completa, pero lazy
  (recién la primera vez que alguien usa el buscador) y cacheada en
  memoria para el resto de la sesión (`_searchIndexPOIS`).
- `js/app.js` — sección 3 de `init()`: `fetchPinsInViewport()` en vez
  de `loadPOISFromFirestore()`; sección 4: `drawLoadedPins()` después
  de `checkEventosTemporalesLifecycle()` (antes era un
  `POIS.forEach(makeMarker)` directo). Buscador (sección 8, "Live
  search") reescrito: usa `loadSearchIndex()` en vez de `POIS`
  directo; si el resultado elegido no tiene marcador todavía (fuera
  del área ya cargada), lo crea al vuelo y centra el mapa ahí antes
  de abrir su panel.
- `js/admin.js` — `openAdmin()` pasó a `async`: fuerza
  `loadPOISFromFirestore()` completo + dibuja cualquier pin que
  todavía no tuviera marcador, ANTES de `renderList()`. Ningún
  llamador existente esperaba el resultado (verificado con grep), no
  rompe nada por volverla async.
- `js/config.js` — nota de `let POIS = []` actualizada (ya no
  describe correctamente el flujo desde el cambio de arriba).
- `index.html` — script tag nuevo (`js/pins-viewport-loader.js`,
  entre `markers.js` y `cluster-grouping.js`).
- `AI_RULES.md` — fila nueva + orden de carga de scripts.

**Trade-offs conocidos, aceptados por Cris (documentados en el
código, no resueltos en esta entrega):** la barra de categorías y el
dropdown de zonas reflejan solo los pines YA cargados en cada
momento (no el 100% real hasta navegar todo el mapa); el
auto-desactivado de `evento_temporal` (`checkEventosTemporalesLifecycle`)
solo revisa pines que ya estén cargados — uno fuera del área visible
inicial no se revisa hasta que alguien navegue hasta ahí. Con 11
pines de prueba ninguno de los dos se nota.

**Verificación realizada:** `node --check` sin errores en los 5
archivos `.js` tocados/creados; grep de nombres nuevos sin colisión
con el resto del proyecto; confirmado que ningún llamador de
`openAdmin()` esperaba su resultado (ahora es async); balance de
`<div>` de `index.html` sin cambios respecto a antes de esta
entrega; ids de `search-input`/`search-results` confirmados en
`index.html`. **No probado contra Firebase real ni navegador** —
falta especialmente crear el índice compuesto (lat, lng) en el
proyecto real de Cris la primera vez que corra, y probar: pan/zoom
trae pines nuevos sin recargar la página, Admin sigue viendo los 11
de prueba completos, buscador encuentra algo fuera del área visible
inicial y lo centra bien al clickearlo.

**Pendiente / separado de esto:** migración de SDK Firebase
-compat → modular (Cris decidió dejarla para después); hallazgo de
permisos de `checkEventosTemporalesLifecycle()` para visitante
público — Cris confirmó resolverlo igual que se hizo con
`regeneratePublicCache()` (condicionar del lado cliente), queda
pendiente de implementar ese cambio puntual en un próximo paso.

## Sesión: 2026-08-29 (continuación) — Clustering visual de pines (item 6.1 de PLAN_OPTIMIZACION_PERFORMANCE_2026-08-29.md, redefinido)

**Contexto:** continuación de la sesión de performance del mismo día
(ver `CONTEXTO_COMPLETO_2026-08-29.md`). El punto 6.1 del plan de
performance original ("paginar la carga de pines") quedó reinterpretado
por Cris como clustering visual (agrupar pines en burbujas con
número al alejar zoom, tipo streetartcities.com) — la paginación real
de Firestore (`.get()` sin `.limit()`) sigue sin resolver, no es lo
mismo. Se confirmó primero que el clustering NO existía en el
proyecto (solo una idea en `js/roadmap.js`) antes de programar nada.
Cris pidió explícitamente UNA sola regla: nunca más de X pines/
burbujas visibles en pantalla al mismo tiempo, sin importar la
distancia real entre ellos (no un radio fijo en px, que podía fallar
con muchos pines apretados en un área chica) — y pidió mantener el
enfoque liviano, no solo seguro.

**Archivo nuevo:** `js/cluster-grouping.js` — clustering por grid
(grilla invisible en píxeles de pantalla, O(n) por pasada) que agranda
el tamaño de celda hasta que la cantidad de grupos entra dentro del
techo configurado (`maxOnScreen`, default 30, editable en Admin →
Mapa → "Agrupación de pines"). Diseño explícito para NO usar
Leaflet.markercluster (ver nota completa al inicio del archivo): esa
librería mete los marcadores a su propio layer group y el DOM de un
pin agrupado no se crea hasta desagruparse — rompía
`wirePinImageFallback`, el criterio de `poi.active===false`, el swap
a imagen full-quality al maximizar y el z-index manual al expandir,
todo eso depende de que el `<div id="pw-{id}">` de CADA pin exista
siempre. En cambio esta implementación deja `makeMarker()`/
`removeMarker()` intactos y solo oculta/muestra el DOM ya existente
(mismo mecanismo que ya usaba `togglePoi()`), agregando burbujas
nuevas encima.

**Archivos modificados:**
- `js/markers.js` — `makeMarker()`/`removeMarker()` llaman a
  `scheduleClusterRecompute()` (debounced) al final.
- `js/app.js` — `togglePoi()` también llama a
  `scheduleClusterRecompute()` (activar/desactivar un pin cambia los
  candidatos); `init()` suma `loadClusterSettings()` al mismo
  `Promise.all()` de la sección de performance de esta misma sesión.
- `index.html` — script tag nuevo (`js/cluster-grouping.js`, justo
  después de `markers.js`, antes de `poi-panel.js`); UI nueva en la
  tab admin "Mapa" (toggle activar/desactivar + input numérico del
  techo máximo).
- `AI_RULES.md` — fila nueva en la tabla de archivos + orden de carga
  de scripts.

**Verificación realizada:** `node --check` sin errores en
`js/cluster-grouping.js`, `js/markers.js`, `js/app.js`; chequeo
cruzado de que los 2 `getElementById` nuevos (`cluster-enabled-toggle`,
`cluster-max-onscreen`) tienen su `id` en `index.html`; balance de
`<div>`/`</div>` del bloque agregado verificado (el desfasaje de 1 en
todo `index.html` ya existía ANTES de esta sesión, no lo introduce
este cambio); grep de nombres nuevos (`_clusterSettings`,
`computeAndRenderClusters`, etc.) contra el resto del proyecto sin
colisiones. **No probado contra Firebase real ni en navegador** —
pendiente que Cris pruebe: activar/desactivar el toggle, cambiar el
número máximo y confirmar que el mapa nunca muestra más burbujas/pines
sueltos que ese número, que click en una burbuja hace zoom y separa
el grupo, y que el número guardado sobrevive un F5 (doc
`settings/clustering` — mismo modelo de reglas que el resto de
`settings`, no debería necesitar reglas nuevas, pero queda a confirmar
en su entorno real).

**Pendiente / separado de esto:** la paginación real de Firestore
(`.get()` sin `.limit()`, no urgente con 11 pines de prueba) y la
migración de SDK -compat a modular siguen sin resolver — ver punto 6
de `CONTEXTO_COMPLETO_2026-08-29.md` y `PLAN_OPTIMIZACION_PERFORMANCE_2026-08-29.md`.

## Sesión: 2026-08-27 — Hotfix botón de perfil + Etapa 7 (pagos) + Etapa 8 (subusuario empleado)

**Contexto:** continuación directa de la sesión de Etapa 6 (ver
entrada de abajo). Cris reportó que el ícono de perfil no respondía
para una cuenta de usuario común — se investigó a fondo por chat
(sintaxis, ids cruzados, colisiones de variables entre TODOS los
archivos, simulación con jsdom) sin encontrar bug de código; la
evidencia (log con `auth/invalid-credential` repetido) apunta a que
esa cuenta de prueba tenía la contraseña mal, no a un bug real. Se
aplicó igual un hotfix de blindaje (delegación de eventos + estilos
inline forzados al abrir el panel) por las dudas. Ver el detalle
completo de las 3 cosas (hotfix + Etapa 7 + Etapa 8) en
`PLAN_USUARIOS_EVENTOS.md`, sección "REGISTRO POR ETAPA" — no se
repite acá para no duplicar.

Cris pidió explícitamente completar TODO el plan que quedaba (Etapas
7 y 8) "de forma adecuada" y seguir con criterio propio sin parar a
preguntar, y dejar un resumen aparte en un archivo nuevo llamado
"leeme BOLUDO" (nombre pedido literal por Cris) dentro de la próxima
entrega.

**Archivos creados:** `js/usuarios-admin.js` (Etapa 7 — catálogo de
funciones premium + plan por cuenta), `js/empleados.js` (Etapa 8 —
alta de subusuario empleado vía instancia secundaria de Firebase).

**Archivos modificados:** `index.html` (tab admin "👤 Cuentas"
completa, campos `evt-destacado*`, bloque "Empleados" en la solapa
Pines, script tags nuevos), `js/eventos.js` (campos
destacado/destacado_hasta), `js/user-panel.js` y `js/user-auth.js`
(hotfix de delegación + estilos inline, ver arriba),
`js/admin.js` (registro de la tab `usuarios-admin` en `switchTab`),
`FIRESTORE_RULES_NOTES.md` (reglas nuevas de las 3 cosas — TODAS
pendientes de pegar en la consola de Firebase), `PLAN_USUARIOS_EVENTOS.md`.

**Verificación realizada:** `node --check` sin errores en los 7
`.js` tocados/nuevos; chequeo cruzado de que todo `getElementById(...)`
usado en esos archivos tiene su `id` en `index.html` (sin faltantes);
chequeo de que ningún `let`/`const`/`class` de nivel superior se
repite entre NINGÚN par de archivos del proyecto (evita el
`SyntaxError: Identifier ... has already been declared` que se da
entre `<script>` tags que comparten scope léxico global). **No
probado contra Firebase real ni en navegador** — lista completa de
qué probar en cada etapa dentro de `PLAN_USUARIOS_EVENTOS.md`. Las
reglas de Firestore de esta sesión (Etapa 7 y 8, colección
`usuarios` y `pines`) todavía no están pegadas en la consola.

## Sesión: 2026-08-26 (continuación 4) — Etapa 6: Edición de eventos + Panel de usuario unificado + Nombre único

**Contexto:** Cris trajo el proyecto completo (ZIP, hasta Etapa 5) +
`PLAN_PANEL_USUARIO_EDICION_EVENTOS_2026-08-26.md` — un plan aparte,
ya escrito y con sus 8 preguntas de diseño respondidas en una sesión
de chat anterior (sin código todavía). Pidió ejecutar ESE plan
puntual, siguiendo el ZIP entregado como base. Ver detalle completo
(qué se hizo, decisiones confirmadas, pruebas pendientes) en la
entrada de Etapa 6 dentro de `PLAN_USUARIOS_EVENTOS.md` (sección
"REGISTRO POR ETAPA") — no se repite acá para no duplicar.

**Archivos revisados en profundidad esta sesión:** `js/eventos.js`
completo, `js/owner-panel.js` completo, `js/user-auth.js` completo,
`index.html` (overlays de cuenta/dueño, tab admin "Eventos"),
`css/base.css` (bloques de esos overlays + `.evt-admin-row`),
`js/admin.js` (`startPickMode`/`stopPickMode`), `js/pin-adjust.js`
(`_autoSlugBase`, doble candado del ID de pin — patrón reusado para
la ciudad del evento), `FIRESTORE_RULES_NOTES.md` (reglas actuales de
`eventos`/`settings`).

**Archivos creados:**
- `js/user-panel.js` — panel de usuario unificado (Info/Pines/
  Eventos) + autoservicio de alta/edición de eventos.

**Archivos modificados:** `index.html`, `css/base.css`,
`js/eventos.js`, `js/owner-panel.js`, `js/user-auth.js`, `js/admin.js`,
`FIRESTORE_RULES_NOTES.md`, `PLAN_USUARIOS_EVENTOS.md` — ver el
detalle completo en la entrada de Etapa 6 dentro de
`PLAN_USUARIOS_EVENTOS.md`.

**Verificación realizada:** `node --check` sin errores en los 5 `.js`
tocados/nuevos; chequeo automático cruzado de que todo
`getElementById(...)` usado en esos archivos tiene su `id`
correspondiente en `index.html` (encontró y corrigió 1 referencia
colgante a un botón que quedó fuera del diseño final). **No probado
contra Firebase real ni en navegador** — pendiente que Cris pruebe
(lista completa de qué probar en la entrada de Etapa 6 del plan). Las
reglas de Firestore nuevas todavía no están pegadas en la consola —
sin eso, cualquier alta/edición de usuario común vía autoservicio va
a fallar por permisos.

## Sesión: 2026-08-26 — Etapa 3 de PLAN_USUARIOS_EVENTOS.md: colección `eventos` (admin-only)

**Contexto:** Cris trajo el proyecto completo (ZIP) + un plan ya
unificado (`PLAN_USUARIOS_EVENTOS.md`, fusiona lo que antes eran
`PLAN_USUARIOS.md` y el diseño de eventos suelto). Antes de programar
se confirmaron 3 puntos por chat: (1) la pantalla de creación va solo
en el panel Admin en esta etapa, OwnerPanel/UI pública quedan
preparadas sin pantalla hasta la Etapa 6; (2) el pin mínimo del
Camino B se crea YA en esta etapa (no se espera a la Etapa 4) para
que ese camino funcione de punta a punta; (3) el admin no tiene
"pines propios", así que el Camino A no restringe la búsqueda, y
`usuarioAsignadoUid` se asigna a mano (UID pegado o resuelto por mail
con click) mientras el alta siga siendo admin-only.

**Archivos revisados en profundidad esta sesión:** `AI_RULES.md` y
`AI_SESSION.md` completos (contexto de sesiones anteriores),
`PLAN_USUARIOS_EVENTOS.md` completo, `FIRESTORE_RULES_NOTES.md`
completo, `js/owner-panel.js` completo (patrón de panel acotado a
reusar), `js/admin.js` completo (`switchTab`, `startPickMode`/
`stopPickMode`), `js/pin-adjust.js` (`saveNew`, `saveEdit`,
`_resolveOwnerEmailToUid`, `_autoSlugBase`), `js/firestore-sync.js`
(`savePoiToFirestore` y los guardados parciales), `js/geocoder.js`
completo, `js/config.js`/`js/categories.js` (esquema de categorías),
`index.html` (tabs del admin, markup de la tab "Nuevo").

**Archivos creados:**
- `js/eventos.js` — módulo `Eventos` (ver detalle completo en la
  entrada de Etapa 3 dentro de `PLAN_USUARIOS_EVENTOS.md`).

**Archivos modificados:** `js/admin.js`, `index.html`, `css/base.css`,
`FIRESTORE_RULES_NOTES.md` — ver el detalle completo en la entrada de
Etapa 3 dentro de `PLAN_USUARIOS_EVENTOS.md` (sección "REGISTRO POR
ETAPA") — no se repite acá para no duplicar.

**Pruebas/verificaciones realizadas:** `node --check` sin errores en
los 35 `.js` del proyecto; verificación automática de que todos los
`id` que usa `eventos.js` existen una sola vez en `index.html` (sin
duplicados ni faltantes); balance de llaves `{}` verificado en
`css/base.css` (460/460). No se probó en navegador real ni contra
Firebase real (sin entorno con DOM/Firestore en esta sesión).

**Pendiente / próximo paso exacto:** Cris tiene que publicar en
Firestore → Rules el bloque nuevo de `eventos` en
`FIRESTORE_RULES_NOTES.md` (junto con el resto de reglas ya vigentes)
antes de poder guardar ningún evento. Después, ver "ESTADO ACTUAL" de
`PLAN_USUARIOS_EVENTOS.md` — Etapa 4 (ciclo de vida del pin
`evento_temporal`: auto-desactivación cuando vencen todos sus
eventos).

## Sesión: 2026-08-19 (continuación) — Etapa 2 de PLAN_USUARIOS_EVENTOS.md: panel del dueño de pin/negocio

**Contexto:** continuación de la sesión de Etapa 1 (mismo día, mismo
hilo). Cris confirmó en el medio que probó Etapa 1 en su entorno (los
lugares dejaron de verse tras una primera versión de reglas de
Firestore con wildcard; se corrigió con reglas explícitas por
colección — ver historial de reglas en `FIRESTORE_RULES_NOTES.md` y
en [[smartcity]] de la memoria del asistente) y habilitó el proveedor
Google en Firebase Authentication.

**Pedido:** seguir con la Etapa 2 del plan — panel del dueño de
negocio.

**Hallazgo importante de esta sesión (no pedido explícitamente, pero
necesario):** la regla vieja de `pines` (`allow write: if
request.auth != null`) dejaba de ser segura apenas existieran cuentas
públicas no-admin (Etapa 1) — se agregó la colección `admins/{uid}`
para distinguir un admin real de un dueño de negocio cualquiera. Ver
detalle completo en la entrada de Etapa 2 de `PLAN_USUARIOS_EVENTOS.md`
(sección "REGISTRO POR ETAPA") — no se repite acá para no duplicar.

**Archivos revisados en profundidad esta sesión:** `js/firestore-sync.js`
completo (patrones de guardado parcial con `merge:true` a reusar),
`js/pin-adjust.js` (`saveEdit`/`saveNew`, esquema real de campos de un
pin: `name, category, lat, lng, desc, hist, content, tags, phone,
hours, skins, banner`), `js/admin.js` (`startEdit`), `index.html`
(markup de las tabs Nuevo/Editar del admin y de los overlays de
Etapa 1).

**Archivos creados/modificados:** ver el detalle completo en la
entrada de Etapa 2 dentro de `PLAN_USUARIOS_EVENTOS.md`.

**Pruebas/verificaciones realizadas:** `node --check` sin errores en
los 4 archivos JS tocados/creados; verificación automática de IDs
nuevos sin duplicados/faltantes en `index.html`; balance de llaves en
`css/base.css`. No se probó en navegador real ni contra Firebase real.

**Pendiente / próximo paso exacto:** ver "ESTADO ACTUAL" de
`PLAN_USUARIOS_EVENTOS.md` — Etapa 3 (colección `eventos` +
moderación). **Antes de arrancarla**, Cris tiene 3 pasos manuales
obligatorios en Firebase (crear su doc en `admins`, publicar las
reglas nuevas, asignar un pin de prueba a un dueño) — ver el aviso
completo en la entrada de Etapa 2 del plan.

## Sesión: 2026-08-19 — Etapa 1 de PLAN_USUARIOS_EVENTOS.md: login/registro público con roles

**Contexto:** primera etapa de un plan nuevo (`PLAN_USUARIOS_EVENTOS.md`,
ya venía armado de un chat de diseño previo, sin código). Ver ese
archivo para el plan completo (7 etapas) — esta sesión hizo solo la
Etapa 1.

**Pedido:** habilitar en la app pública (no el admin) registro/login
con email+contraseña y con Google, para 2 tipos de cuenta:
`usuario_comun` y `dueno_negocio`.

**Archivos revisados en profundidad esta sesión:** `js/admin-auth.js`
completo (patrón a extender, no reemplazar), `js/firebase-init.js`,
`index.html` (bloque `#admin-login-overlay` y header público),
`css/base.css` (estilos de `#admin-login-overlay`/`#btn-admin` y
variables de color disponibles — se detectó que `--muted` NO existe
en este proyecto, se usó `--text3` en su lugar).

**Archivos creados/modificados:** ver el detalle completo en la
entrada de Etapa 1 dentro de `PLAN_USUARIOS_EVENTOS.md` (sección
"REGISTRO POR ETAPA") — no se repite acá para no duplicar.

**Pruebas/verificaciones realizadas:** `node --check js/user-auth.js`
sin errores; script de verificación aparte confirmando que todos los
`id` referenciados desde `user-auth.js` existen en `index.html` sin
duplicados. No se probó en navegador real ni contra Firebase real
(sin entorno con DOM/Firestore en esta sesión).

**Pendiente / próximo paso exacto:** ver "ESTADO ACTUAL" de
`PLAN_USUARIOS_EVENTOS.md` — Etapa 2 (panel del dueño de
pin/negocio). Antes de arrancarla, confirmar con Cris que probó la
Etapa 1 en su entorno y que habilitó Google como proveedor en
Firebase Console si quiere usar ese botón.

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

## Sesión: 2026-08-26 (continuación) — Etapa 4: ciclo de vida del pin `evento_temporal`

**Contexto:** Cris confirmó (en el mismo hilo, mensaje de texto libre,
no formulario) que probó el Camino A/B de la Etapa 3 con éxito
("el evento se creó exitosamente"), pidió continuar directo con la
Etapa 4. Antes de programar se preguntaron 3 puntos: (1) qué hace
vigente a un evento → confirmado "activo=SÍ (toggle) y sin fecha_fin
vencida"; (2) cuándo correr el chequeo de ciclo de vida → Cris no
entendió la pregunta, así que se optó por la combinación más robusta
sin sobrecargar Firestore (carga del mapa público + apertura de la
tab admin Eventos), dejando la función reusable para sumar más
puntos después sin duplicar lógica; (3) reactivación automática de un
pin ya auto-desactivado si se le carga un evento nuevo vigente → NO,
Cris fue explícito en que por ahora la reactiva él a mano, y que a
futuro (sistema de pagos) esa capa se suma a la cadena existente sin
que nada quede hardcodeado bloqueándolo — mismo modelo de "capas de
cebolla" que ya rige `fecha_inicio`.

**Archivos revisados en profundidad esta sesión:** `PLAN_USUARIOS_EVENTOS.md`
completo (post-Etapa 3) + el archivo suelto `PLAN_USUARIOS_EVENTOS_UNIFICADO_25-08-2026.md`
que Cris subió aparte (versión anterior a la Etapa 3, tenía contenido
que se había perdido al actualizar el plan — sección "DOS TABS EVENTOS"
y "DECISIONES PENDIENTES" — se restauraron ambas dentro de
`PLAN_USUARIOS_EVENTOS.md`, fusionadas con lo ya vigente, sin perder
nada de ninguna de las dos versiones); `js/eventos.js` completo,
`js/app.js` completo (`init()`), `js/markers.js` completo
(`makeMarker`), `js/admin.js` (`togglePoi`, `_rowOpacityFor`) y
`js/app.js` (`togglePoi` duplicado) para entender el criterio visual
exacto a reusar; grep dirigido de `.active` en todo `js/*.js` para
confirmar el modelo activo/publicado del proyecto.

**Archivos modificados esta sesión:**
- `js/eventos.js` — `checkEventosTemporalesLifecycle()`,
  `_eventoEsVigente()`, `_autoDesactivarPinTemporal()`,
  `_reactivarPinTemporal()`; integrado en `_loadEventosAdminList()`;
  fila de evento con aviso + botón reactivar cuando corresponde.
- `js/app.js` — paso 3.5 en `init()`.
- `js/markers.js` — **hallazgo no buscado, corregido de una:**
  `makeMarker()` nunca respetaba `poi.active === false` al crear el
  marcador (solo al togglear en vivo dentro de la misma sesión) — así
  que CUALQUIER pin desactivado (de eventos o no) igual se veía para
  un visitante nuevo. Corregido con el mismo criterio visual que ya
  usaba `togglePoi()`. Avisado a Cris explícitamente en el chat y en
  "ESTADO ACTUAL" de `PLAN_USUARIOS_EVENTOS.md` porque cambia un
  comportamiento que no era parte del pedido puntual de esta etapa.
- `css/base.css` — estilos de aviso/botón de reactivar.
- `PLAN_USUARIOS_EVENTOS.md` — entrada de Etapa 4, checklist, ESTADO
  ACTUAL reescrito, secciones "DOS TABS"/"DECISIONES PENDIENTES"
  restauradas.

**Pruebas/verificaciones realizadas:** `node --check` sin errores en
`js/eventos.js`, `js/app.js`, `js/markers.js`; balance de llaves `{}`
verificado en `css/base.css`. No probado contra Firebase real ni en
navegador — ver checklist de prueba manual en `PLAN_USUARIOS_EVENTOS.md`,
entrada de Etapa 4.

**Pendiente / a criterio de sesiones futuras:** las 4 "DECISIONES
PENDIENTES" restauradas en el plan (límite de ediciones, título de la
tab pública, imágenes por categoría, toggles maestros globales) siguen
sin confirmar — ninguna bloquea la Etapa 5, pero conviene resolverlas
antes de esa etapa si tocan algo que la Etapa 5 vaya a construir
encima.

## Sesión: 2026-08-26 (continuación 2) — Etapa 5: filtro de eventos + pestaña pública

**Contexto:** Cris pidió renombrar a futuro la tab pública del pin a
"Panel Eventos" (con rótulo editable — ya implementado el campo
editable, el nombre final queda a su criterio) y luego dio luz verde
a "completa"/seguir con la Etapa 5. Antes de programar se confirmaron
3 puntos (ver preguntas del chat): filtro junto a categorías, panel
público con sistema de 2 pestañas (no siempre-visible ni colapsable
por click), estilo del pin evento_temporal pendiente de imágenes
propias que Cris va a subir más adelante (no se tocó en esta etapa).

**Hallazgo durante la implementación:** al ir a agregar el filtro de
eventos a la barra de filtros del mapa, se encontró que
`applyFilter()` se llamaba desde `categories.js`, `pin-adjust.js`,
`pin-geocode.js` y `data-io.js` pero no estaba definida en NINGÚN
archivo del proyecto — los filtros de categoría del mapa público
nunca filtraron nada. Se avisó a Cris en el chat antes de tocar nada
más; confirmó que ya lo sabía y no era urgente, pero pidió
aprovechar para arreglarlo ya que esta etapa tocaba esa misma zona
del código.

**Archivos modificados esta sesión:**
- `js/config.js` — variable global `EVENTOS`.
- `js/eventos.js` — `loadEventosFromFirestore()`,
  `loadEventosConfig()`, `_saveEventosConfig()`; sincronización de
  `EVENTOS` + llamado a `applyFilter()` dentro de
  `_loadEventosAdminList()`.
- `js/categories.js` — `applyFilter()` + `_pinMatchesActiveFilter()`
  implementadas de cero (bug de fondo); chip "🎉 Eventos" agregado en
  `updateFilterBar()`.
- `js/poi-panel.js` — sistema de 2 pestañas (Info/Eventos) en el
  panel público, con reset a "Info" en cada `open()`.
- `js/app.js` — `init()` carga `EVENTOS` + config de eventos antes de
  dibujar marcadores.
- `index.html` — bloque "CONFIGURACIÓN PÚBLICA" (rótulo editable) en
  la tab admin Eventos.
- `css/base.css`, `css/poi-panel.css` — estilos nuevos.
- `PLAN_USUARIOS_EVENTOS.md` — entrada de Etapa 5, checklist
  reordenado (se fusionó con la Etapa 6 ya existente de "subusuario
  empleado" en vez de crear una Etapa 6 duplicada), ESTADO ACTUAL
  reescrito.

**Pruebas/verificaciones realizadas:** `node --check` sin errores en
`js/config.js`, `js/eventos.js`, `js/app.js`, `js/categories.js`,
`js/poi-panel.js`; balance de llaves `{}` verificado en
`css/base.css` y `css/poi-panel.css`; chequeo automático de
`getElementById` de `js/eventos.js` contra los `id` de `index.html`
(sin faltantes). No probado contra Firebase real ni en navegador —
ver checklist de prueba manual en `PLAN_USUARIOS_EVENTOS.md`, entrada
de Etapa 5.

**Pendiente:** imágenes propias del pin `evento_temporal` (a cargo de
Cris, sin fecha); las 4 "DECISIONES PENDIENTES" restauradas en el
plan siguen sin resolver del todo (la del rótulo de la tab pública ya
quedó resuelta como campo editable).

## Sesión: 2026-08-26 (continuación 3) — Fix de seguridad (acceso admin) + hallazgo edición de eventos

**Contexto:** Cris avisó dos cosas al probar la Etapa 5: (1) no hay
forma de editar un evento ya creado (ni admin ni dueño), (2) al
entrar con una cuenta de prueba de usuario común, el sistema le daba
acceso al panel admin completo.

**(2) investigado y arreglado ya mismo, sin esperar confirmación,
por tratarse de un hallazgo de seguridad:** la causa era que
`js/admin-auth.js` completaba `_adminUser` con CUALQUIER sesión de
Firebase Auth activa (no verificaba si esa cuenta era admin de
verdad) — como el login de usuario común comparte el mismo
`firebase.auth()` que el login admin, cualquier cuenta lograba ver
el panel admin completo al tocar el engranaje. Las escrituras reales
SIEMPRE estuvieron protegidas por las reglas de Firestore
(`admins/{uid}`) — el agujero era solo de interfaz, no de datos.
Arreglado: `admin-auth.js` ahora verifica `admins/{uid}` antes de
dar por válida la sesión admin, en el listener de `onAuthStateChanged`
y en `doAdminLogin()`; `admin.js` espera ese chequeo antes de abrir
el panel. **Pendiente que Cris confirme que su cuenta real de admin
ya está en `admins/{uid}` — si no, se queda afuera del panel con
este fix.**

**(1) documentado como hueco real del plan, no asignado a ninguna
etapa** — no se implementó todavía, queda a la espera de que Cris
decida cuándo. Ver entrada nueva en `PLAN_USUARIOS_EVENTOS.md`.

**Hallazgo adicional, NO tocado (fuera de alcance, se deja anotado
acá para no perderlo):** `window.isAdminActive`, que
`js/poi-panel.js` usa para decidir si mostrar el botón "Editar"
dentro del panel público de un pin, nunca se asigna en ningún
archivo del proyecto — siempre es `undefined`, así que ese botón
"Editar" inline nunca aparece, ni para el admin real. No es un
agujero de seguridad (falla "cerrado", no abierto) y no bloquea nada
porque la edición de pines ya existe por la vía normal (tab
Lugares/Editar del panel admin) — pero es una función que quedó a
medio cablear. No se tocó porque no fue lo que pidió Cris esta
sesión.

**Archivos modificados:** `js/admin-auth.js`, `js/admin.js`,
`PLAN_USUARIOS_EVENTOS.md`.

**Pruebas realizadas:** `node --check` sin errores en
`js/admin-auth.js` y `js/admin.js`. No probado contra Firebase real
— pendiente que Cris pruebe: (a) con su cuenta real de admin, que
sigue entrando normal; (b) con la cuenta de prueba común, que el
engranaje ahora la manda al login en vez de abrir el panel.

## Sesión 2026-09-08 — fix hover interrumpe animación de categorías + fix botones que desaparecen

**Pedido de Cris:** en la fila de filtros de categorías, si el mouse queda en
el camino de la animación de apertura/cierre de subcategorías (Etapa E), el
hover interrumpe la animación (el botón se frena o salta a otro lado).
Además reportó (verificado en mobile, repetible con Cultura y con
Gastronomía): al volver de la vista de subcategorías al inicio, algunas
categorías no reaparecían — quedaban invisibles aunque el resto de la fila
se veía normal.

**Bug 1 — hover interrumpe la animación. Causa real:** `_dockAnimating`
bloqueaba clicks nuevos y refrescos de fondo, pero no el `:hover` (es CSS
puro, no pasa por JS). En ciertos instantes de la coreografía — un botón de
subcategoría recién entrando (antes de sumar `.fbtn-entered`, 1 sola clase)
o un botón principal en el delay antes de sumar `.fbtn-exit-down` — la regla
`.fbtn:hover` tenía más especificidad CSS que la clase de animación de ese
instante y le ganaba, pisando el `transform`. Si el mouse estaba en el
camino, el botón se veía frenado o saltando a otro lado.

**Fix 1:** nueva función `_setDockAnimating(bar, val)` en `categories.js`
que centraliza el toggle del flag y además prende/apaga una clase
`is-animating` en `.filter-row`. En `base.css`, `.filter-row.is-animating
.fbtn { pointer-events: none; }` — corta toda interacción de mouse
(incluido el hover) en los botones mientras dura cualquiera de las dos
coreografías, sin importar el instante. Reemplazadas las 5 asignaciones
directas de `_dockAnimating = true/false` por el helper.

**Bug 2 — categorías que desaparecen al volver. Causa real:**
`pins-viewport-loader.js` llama a `updateFilterBar()` en cada
moveend/zoomend del mapa (muy frecuente en mobile). Si eso ocurre mientras
la fila de subcategorías está abierta y en reposo (ya no `_dockAnimating`,
esperando que el usuario haga algo), `updateFilterBar()` redibuja la fila
mostrando SOLO la categoría activa + sus subcategorías (comportamiento
correcto para ese instante) — pero de paso elimina del DOM a los demás
botones principales (Todo, Eventos, el resto de categorías), que hasta
entonces seguían ahí solo ocultos con `.fbtn-exit-down`. `updateFilterBar()`
nunca los vuelve a crear por ese camino. Cuando el usuario después cierra la
fila (`_animateCloseSubcatRow`), el `mainBtns` que había capturado al
arrancar la función queda incompleto — repone lo que sí sigue en el DOM,
pero no puede reponer lo que ya no está. Resultado: solo la categoría que
se estaba cerrando reaparece en su lugar; el resto queda vacío.

**Fix 2:** al final de `_animateCloseSubcatRow`, una vez terminada la
transición CSS de reposicionamiento (.4s), se llama a `updateFilterBar()`
para reconciliar la fila contra el estado real. En el caso normal (nada se
perdió) no se nota — los botones ya están en su posición final y
`updateFilterBar()` los redibuja idénticos. En el caso del bug, reconstruye
lo que faltaba, con los mismos listeners de click reales (no se duplicó esa
lógica).

**Archivos modificados:** `js/categories.js`, `css/base.css`.

**Pruebas realizadas:** `node --check` sin errores en `js/categories.js`.
No probado contra el navegador real — pendiente que Cris confirme: (a) que
pasar el mouse por el camino de la animación ya no la interrumpe; (b) que
tras abrir una categoría, mover/hacer zoom en el mapa varias veces, y volver
atrás, todas las categorías reaparecen (repetir con al menos 2-3 categorías
distintas, como reportó).

## Sesión 2026-09-08 (cont.) — el hover seguía interrumpiendo con pointer-events:none; causa real distinta

**Reporte de Cris tras probar el fix anterior:** las categorías ya no
desaparecían, pero el hover seguía interrumpiendo la animación. Pidió
investigar en internet casos similares antes de tocar nada, y aportó un
dato clave: si mueve el mouse activamente por delante del ícono mientras
anima, el botón se traba repetidas veces, "como si el mouse funcionara
como una barrera".

**Investigación:** confirmado con reportes de bugs documentados en motores
de renderizado (WebKit #158554, entre otros) que cuando un elemento se
mueve vía `transform` animado, el navegador NO re-testea el `:hover`
contra la posición visual real del elemento en cada frame — solo
recalcula el hit-test ante un movimiento real del mouse. `pointer-events:
none` no alcanzaba porque no limpia un `:hover` que ya estaba activo antes
de aplicarse (el click que abre/cierra la fila deja el mouse encima del
botón desde el instante 0). Y como Cris describió, si el mouse SÍ se
mueve por el camino, el navegador recalcula en cada uno de esos instantes
y `.fbtn:hover` (con más especificidad que la clase de animación de ese
paso puntual) pisa el transform una y otra vez — de ahí el efecto
"barrera".

**Fix real:** se reemplazó el `:hover` nativo de CSS por un estado
manejado a mano. Nueva función `_attachHoverState(btn)` en
`categories.js` (llamada desde `_buildMainBtn` y `_buildSubBtn`, únicos
2 lugares donde se crean botones) que escucha `pointerenter`/
`pointerleave` y prende/apaga una clase `js-hover` — ignorando el evento
directamente si `_dockAnimating` es true, sin depender de cuándo decida
el navegador recalcular. `_setDockAnimating` además limpia cualquier
`js-hover` que haya quedado prendido al arrancar una coreografía (por si
`pointerleave` no llegó a disparar). En `base.css`, `.fbtn:hover` pasó a
ser `.fbtn.js-hover` con los mismos valores visuales; `pointer-events:
none` durante `is-animating` se mantiene como resguardo general (bloquea
clicks) pero ya no es la defensa principal para este problema puntual.

**Archivos modificados:** `js/categories.js`, `css/base.css`.

**Pruebas realizadas:** `node --check` sin errores en `js/categories.js`.
No probado contra el navegador real — pendiente que Cris confirme que
mover el mouse activamente por el camino de la animación (como describió)
ya no la traba, en varias pasadas y con distintas categorías.

## Sesión 2026-09-17 — Tamaño de pin en mapa/maximizado distinto para mobile y desktop

Cris reportó: el tamaño de pin (mapa y maximizado) que ajustó y funciona
bien en mobile no es óptimo en desktop con la misma configuración — un
valor fijo en px/% no se adapta al espacio real de pantalla, mucho mayor
en desktop.

**Solución aplicada (rápida y aditiva, decidida así por apuro de tiempo
con el MVP — la solución de fondo queda planificada, no implementada, en
`PLAN_TAMANO_PIN_ADAPTATIVO.md`):** 2 sliders nuevos en la tab Global,
separados de sus pares mobile existentes (que no se tocaron):
- `globalSettings.pinSizeDesktop` — slider "Tamaño de pins en el mapa
  (desktop)" (`#g-pin-size-desktop`).
- `globalSettings.expandPercentDesktop` — slider "Tamaño del edificio
  maximizado (desktop)" (`#g-expand-size-desktop`).

Detección centralizada en `isDesktopViewport()` (`js/admin-global.js`,
`window.matchMedia('(min-width: 768px)')`, expuesta en
`window.isDesktopViewport` — una sola fuente de verdad, ver AI_RULES.md
sección 7), reusada en `rebuildAllMarkers()` (mismo archivo) y en
`expandPin()` (`js/pin-adjust.js`). Un listener de `matchMedia`
(`change`) dispara `rebuildAllMarkers()` de nuevo si la ventana cruza el
breakpoint en vivo (resize de ventana en desktop).

Defaults de los 2 campos nuevos = mismo valor que su par mobile
(`DEFAULT_GLOBAL_SETTINGS` y `globalSettings`/lazy-init en
`pin-adjust.js`), para no cambiar nada hasta que Cris los ajuste a mano.

**Archivos modificados:** `js/admin-global.js`, `js/pin-adjust.js`,
`index.html` (2 `<input type="range">` nuevos en la tab Global, sin
cambiar cache-busting de los `<script>` — pendiente revisar si hace
falta bump de versión al entregar).

**Roadmap:** agregada entrada `r34` en `js/roadmap.js` con la idea de
fondo (tamaño como % del espacio libre de pantalla, no breakpoint fijo)
— cita textual de Cris + evaluación de Claude. Detalle completo del plan
en `PLAN_TAMANO_PIN_ADAPTATIVO.md` (archivo nuevo en la raíz).

**Pruebas realizadas:** `node --check` sin errores en `js/admin-global.js`,
`js/pin-adjust.js` y `js/roadmap.js`. No probado contra navegador real —
pendiente que Cris confirme: (a) que el pin en mapa y el maximizado se
vean bien en desktop tras ajustar los 2 sliders nuevos; (b) que el mobile
sigue exactamente igual que antes; (c) que al agrandar/achicar la ventana
del navegador cruzando ~768px de ancho, el pin del mapa cambia de tamaño
solo, sin recargar la página.

## 2026-09-26 — Traducción global de la interfaz pública (i18n ES/EN/PT)

Arranqué la parte 4 del pedido de Cris (de 4 partes totales: campos de
info vinculados por idioma, título/párrafo multi-idioma, eventos
multi-idioma, traducción global — Cris eligió empezar por esta última,
"las 3 sub-partes juntas": motor + textos fijos, categorías, zonas).

**Archivo nuevo:** `js/i18n.js` — motor de traducción (diccionario
ES/EN/PT, `I18N.t()`/`I18N.tf()` para mensajes con datos variables,
`data-i18n*` sobre HTML estático + llamadas directas en JS para
contenido dinámico). Cargado justo después de `lang-switcher.js`.

**Archivos modificados:** `index.html` (data-i18n en todo el header,
buscador, zonas, filtro de fecha, y los overlays user-auth/user-panel
completos — desde `<div id="user-auth-overlay">` hasta el cierre de
`up-pane-eventos`, sin tocar nada de `<div id="admin">` en adelante,
que sigue 100% español a propósito), `js/categories.js` (labels
Todo/Eventos + auto-refresco en LANGUAGE_CHANGED), `js/zones.js`
(`z.label={en,pt}` nuevo con fallback a `z.name`, `getZoneLabel()`,
editor admin en acordeón, dropdown/panel público traducidos),
`js/poi-panel.js` (cascarón fijo del panel real — el que arma
`_ensureDom()` dinámicamente, NO el markup viejo `#poi-panel` de
index.html que quedó como dead code sin tocar — más la tarjeta pública
de evento), `js/user-auth.js`, `js/user-panel.js`, `js/owner-panel.js`,
`js/empleados.js`, `js/eventos-form-shared.js` (todos sus toasts/
errores/botones dinámicos más visibles, vía `I18N.t()`/`I18N.tf()`).

**Hallazgo importante que cambió el plan sobre la marcha:** las
categorías YA tenían el esquema multi-idioma completo (Etapas A-D de
`PLAN_CATEGORIAS_SUBCATEGORIAS.md`, de otra sesión) — solo le faltaba
el auto-refresco. Los "grupos" (`js/groups.js`) resultaron ser 100%
internos del admin, nunca públicos — se sacaron del alcance. Ver
`ACLARACIONES_RELEVANTES.md` de esta entrega para el detalle completo,
incluidos los gaps que quedaron sin traducir (un puñado de errores del
form de guardar evento en `user-panel.js`, y el locale de fecha fijo
en `es-AR`).

**Pruebas realizadas:** `node --check` sin errores en los 9 `.js`
tocados/nuevos. No probado contra navegador real.

## 2026-09-27 — Recorte visual de los botones del filtro (.fbtn) + estética/visibilidad del selector de fecha de eventos

Dos pedidos de Cris en el mismo chat, ambos solo CSS (sin tocar JS ni
HTML salvo el `<link>` de Google Fonts):

**1) Botones de filtro cortados + texto poco legible** (capturas de
Cris mostrando los íconos de la barra inferior con la parte de arriba
recortada). Causa raíz real: `.filter-row` tiene `overflow-x: auto`
para el scroll horizontal — por spec de CSS, eso fuerza a `overflow-y`
a computar como `auto` también aunque el CSS dijera
`overflow-y: visible`, así que siempre recortaba verticalmente (la
sombra del círculo en reposo, y de lleno el botón agrandado en
hover/click). Fix: se le dio a `.filter-row` altura de sobra
(`height: 82px → 110px`, +28px) y se corrió el `top` base de `.fbtn`
la misma cantidad (`4px → 32px`) para que el botón en reposo quede en
el mismo lugar de siempre — **estos dos valores quedan acoplados, si
se vuelve a tocar uno hay que tocar el otro la misma cantidad**. Texto
de `.fbtn-label`: pasó del `text-shadow` difuminado a un outline
sólido de 2px (8 `text-shadow` a ±2px + `-webkit-text-stroke` de
refuerzo) y `font-weight: 700 → 800` (se sumó el peso 800 de Nunito al
`<link>` de Google Fonts en `index.html`, antes tope real era 700).

**2) Selector de fecha de eventos (#eventos-fecha-bar) — Cris pidió
arreglar 2 cosas: que solo se vea con el filtro "Eventos" activo, y
que la estética se unifique con el resto de la app.** Visibilidad: la
lógica de `js/eventos-fecha-filtro.js` (`bar.hidden = true/false` según
`activeFilter === '__eventos__'`) ya estaba bien — el bug era 100% CSS:
`#eventos-fecha-bar { display: flex }` (selector por #id) le ganaba en
especificidad a la regla nativa `[hidden] { display: none }` (solo
atributo), así que `hidden` nunca ocultaba nada de verdad. Fix: se
agregó `#eventos-fecha-bar[hidden] { display: none; }` (mismo #id +
atributo, gana por especificidad). Estética: `.efb-input`/`.efb-clear`
tenían radio 999px, sombra `rgba(0,0,0,.25)` y color hardcodeado
`#1a1a1a`, sin relación con el resto de controles flotantes sobre el
mapa — se unificaron al mismo lenguaje que `#search-bar`/`#btn-zonas`
(radio 14px, `rgba(var(--surface-rgb),.96)`, sombra
`rgba(0,0,0,.13)`, `var(--text)`), y `.efb-clear` pasó a calcar
exactamente el patrón `.btn-x` que ya usa el resto de la app para
cerrar/limpiar (ver AI_RULES.md sección 7, una sola fuente de verdad
— se reusó el patrón visual existente en vez de inventar uno nuevo).

**Archivos modificados:** `css/base.css`, `index.html` (solo el
`<link>` de Google Fonts, línea agregando el peso 800 de Nunito).

**Pruebas realizadas:** ninguna contra navegador real — el diagnóstico
de ambos bugs (overflow-y forzado a auto, especificidad de `[hidden]`)
está documentado arriba pero sin verificar visualmente. Pendiente que
Cris confirme con captura: (a) que los botones del filtro ya no se ven
cortados en reposo ni en hover/click; (b) que el selector de fecha
solo aparece con "Eventos" activo; (c) que el estilo nuevo del
selector de fecha se ve consistente con el resto.

**Nota de proceso:** esta sesión arrancó sin leer `AI_RULES.md`/
`AI_SESSION.md` primero (Cris lo marcó al preguntar) — los cambios
terminaron respetando la sección 7 en la práctica (se reusaron tokens
y patrones existentes en vez de duplicar), pero el paso formal de
lectura previa se saltó. Corregido acá con esta entrada.

## 2026-09-27 (cont.) — Reforzar la nota "AI PROJECT NOTE" en todos los archivos de código

Cris pidió que el proyecto en sí mismo obligue a cualquier IA a leer
`AI_RULES.md` antes de tocar código — no depender de que la IA lo
recuerde de una sesión a otra. La nota "AI PROJECT NOTE" ya existía en
54 de los 55 archivos `.js`/`.css`/`.html` (faltaba en
`js/lang-switcher.js`, ahora agregada). Se reforzó el texto en los 55
(antes era más tibio: "consult /AI_RULES.md") a una versión explícita
de "lectura obligatoria, sin excepción, sin esperar a que el usuario
lo pida" — mismo lugar (primera línea del archivo), mismo mecanismo,
solo más directivo.

**Límite real, dicho explícitamente a Cris:** ningún comentario dentro
de un archivo puede "forzar" técnicamente a una IA a leer nada antes
de actuar — es texto, no código que se ejecute. La nota ya estaba
presente en `css/base.css` e `index.html` cuando se hicieron los 2
cambios anteriores de esta misma sesión y aun así no se leyó primero
`AI_RULES.md` — el problema no era que faltara el texto, era el flujo
de trabajo (ir directo a `grep`/edición en vez de abrir el archivo
completo primero). Reforzar el texto reduce la chance de que se
ignore, pero no la elimina.

**Fuera de alcance a propósito:** no se tocaron `pois_cordoba.json`
(JSON no admite comentarios, se rompería el parseo) ni los `PLAN_*.md`/
`CAMBIOS_*.txt`/`README.md` sueltos de la raíz (son documentos, no
código con riesgo de duplicar lógica) — se le avisó a Cris para que
decida si quiere sumarlos.

**Hallazgo colateral, sin tocar:** existe un `eventos-fecha-filtro.js`
duplicado y desactualizado en la RAÍZ del proyecto (no en `js/`, no
está en la lista de `<script>` de `index.html` — no se carga nunca).
Referencia el tab admin viejo "Mapa" en vez de "Eventos" y le faltan
los fixes de huso horario documentados en `js/eventos-fecha-filtro.js`
(sección "Filtro de fecha de eventos" de `AI_RULES.md`). Riesgo real:
una IA futura que haga `grep` sin fijarse la ruta completa podría
editar la copia equivocada. Queda marcado acá — no se borró por las
dudas de que sea un backup intencional de Cris.

**Archivos modificados:** los 55 `.js`/`.css`/`.html` del proyecto
(solo el bloque de comentario al inicio de cada uno).

**Pruebas realizadas:** `node --check` sobre todos los `.js` tocados
(sin errores de sintaxis). No se corrió el sitio en navegador — este
cambio no toca lógica ni estilos visibles, solo comentarios.

## 2026-09-27 (cont. 2) — Borrado de eventos-fecha-filtro.js duplicado en la raíz

Confirmado con Cris: se borró `/eventos-fecha-filtro.js` (raíz del
proyecto), la copia vieja y desactualizada que no se cargaba nunca
desde `index.html` (ver entrada anterior de hoy para el detalle
completo de qué le faltaba respecto a `js/eventos-fecha-filtro.js`,
que es la única versión real y sigue intacta). Sin impacto funcional
— el archivo borrado no estaba en la cadena de `<script>` de
`index.html`.

**Archivos modificados:** borrado `eventos-fecha-filtro.js` (raíz).

**Pruebas realizadas:** confirmado que `js/eventos-fecha-filtro.js`
sigue presente y sin tocar; `grep` sobre `index.html` confirma que
nunca referenció la copia de la raíz por ruta completa.

## 2026-09-27 (cont. 3) — Plan de rediseño de la sección de eventos (Etapas 11-15), sin implementar

Cris trajo capturas de Eventbrite como referencia para rediseñar
cómo se ven los eventos en la app (hoy: lista de texto plano en la
pestaña "Eventos" del panel de cada pin — "parece una hoja de
excel"). Se conversó bastante en varias idas y vueltas hasta cerrar
un plan concreto, PERO SE PIDIÓ EXPLÍCITAMENTE NO EJECUTAR NADA
TODAVÍA — solo dejarlo documentado para retomar en este chat o en
uno nuevo.

Se agregó todo el detalle a `PLAN_USUARIOS_EVENTOS.md` (que ya era el
plan maestro del sistema de eventos) en vez de crear un archivo plan
nuevo aparte, como Etapas 11 a 15 — ver ese archivo para el detalle
técnico completo de cada una. Resumen de qué cubre cada etapa:
- Etapa 11: imagen opcional por evento (Cloudinary)
- Etapa 12: tarjeta de evento unificada (con/sin foto + ícono de
  centrar en el mapa) + 4to nivel de tipografía para el título grande
  cuando no hay foto
- Etapa 13: la pestaña "Eventos" de un pin pasa a carrusel de esas
  tarjetas
- Etapa 14: calendario propio (día único o rango de 2 clicks)
  reemplazando el `<input type=date>` nativo, + extender el filtro de
  fecha para soportar rango
- Etapa 15: panel nuevo "Todos los eventos" — reusa el mismo
  `PoiPanel` de siempre, solo que arranca en `'full'` en vez de
  `'peek'` (ya soportado por `open(id, initialState)`)

**Hallazgo colateral al revisar el archivo para agregar esto:** la
sección "ESTADO ACTUAL" de `PLAN_USUARIOS_EVENTOS.md` estaba
desactualizada — decía "Etapa 8" como última hecha, pero el código
ya tenía comentarios de Etapa 9 y Etapa 10 (unificación de
`eventos-form-shared.js`, con su propio plan
`PLAN_UNIFICACION_FORMULARIO_EVENTOS.md` que no está en este ZIP,
Partes 1 y 2 hechas según `CAMBIOS_UNIFICACION_EVENTOS.txt`, Parte 3
"listas + repaso de regresión" pendiente) que nunca se volcaron acá.
Corregido y numerado a partir de Etapa 11 para no chocar. No se
investigó más a fondo la Parte 3 pendiente — queda mencionada, sin
tocar.

**Decisión pendiente de confirmación de Cris (no bloquea empezar):**
cómo alojar la imagen de un evento — Claude recomendó Cloudinary
(mismo patrón que el resto de la app, hoy admin-only igual que toda
subida de imagen del proyecto) en vez de un campo de link externo —
ver punto 5 de "DECISIONES PENDIENTES" en el plan.

**Decisión pendiente real que sí bloquea la Etapa 15 puntual:** desde
dónde se abre el botón del panel "Todos los eventos" — Cris todavía
no lo definió.

**Archivos modificados:** `PLAN_USUARIOS_EVENTOS.md` (documentación
pura, agregado de plan). Ningún archivo de código tocado esta vez —
pedido explícito de Cris de solo planificar.

**Pruebas realizadas:** ninguna — no hay código para probar.

## 2026-09-27 (cont. 4) — Corrección: dueños ya pueden crear eventos hoy + parámetros de Cloudinary para la foto

Cris preguntó si solo él podría subir la foto del evento. Al revisar
`js/eventos.js` se encontró que la entrada anterior de este mismo
día (y una línea de `PLAN_USUARIOS_EVENTOS.md`, punto 5 de
"DECISIONES PENDIENTES") decía incorrectamente que la creación de
eventos "sigue siendo admin-only" — **es falso**: el toggle
`creacionEventosHabilitada` viene habilitado por defecto
(`if (cfg.creacionEventosHabilitada === undefined)
cfg.creacionEventosHabilitada = true;`), así que un dueño/usuario ya
puede crear su propio evento hoy desde `js/user-panel.js`, usando el
mismo formulario compartido (`js/eventos-form-shared.js`) que el
admin. Corregido en el plan (punto 5 de "DECISIONES PENDIENTES" y
Etapa 11) — la Etapa 11, tal como ya estaba planeada (campo de foto
en el módulo COMPARTIDO), ya delega la subida al dueño sin trabajo
extra.

Cris también pidió parámetros concretos para la imagen (tamaño
estándar, calidad óptima, solo formatos livianos — rechazar png por
riesgo de cuota en su cuenta actual). Se documentó en la Etapa 11 la
recomendación técnica: preset de Cloudinary NUEVO y separado
(`smartcity_eventos_01`, ni el de pines ni el de banner sirven),
incoming transformation `c_fill,g_auto,w_1024,h_576,q_auto,f_auto`
(recorte a 16:9 fijo, no `c_limit` como pines — acá se necesita
proporción pareja entre tarjetas, no solo un tope de tamaño) +
`allowed_formats: jpg,jpeg,webp` (rechaza png del lado del servidor)
+ validación cliente (`accept`/`file.type`) antes de intentar subir,
mismo criterio que ya usa `validateUploadFilename` en `js/utils.js`.
Crear ese preset en la consola de Cloudinary es un paso manual de
Cris, no de código — queda anotado con los valores exactos para
cuando llegue esa etapa.

**Archivos modificados:** `PLAN_USUARIOS_EVENTOS.md` (documentación
pura). Ningún código tocado — sigue siendo solo planificación,
pedido explícito de Cris.

**Pruebas realizadas:** ninguna — no hay código para probar.

## 2026-09-27 (cont. 5) — Etapa 11 COMPLETADA: foto opcional por evento

Leídos `AI_RULES.md` y `PLAN_USUARIOS_EVENTOS.md` antes de tocar código.
Implementado el campo `imagenUrl` en el módulo compartido
`js/eventos-form-shared.js` (`wireImagenInput`, `precargarImagen`,
`resetImagen`, `resolverImagen`), conectado a `saveEvento()` (admin) y
`saveUpEvento()` (usuario). Preset nuevo `smartcity_eventos_01` en
`js/utils.js` (`subfolder: 'eventos'`). Bloque HTML en los 2 forms,
CSS `.evt-img-*`, textos i18n es/en/pt, reglas de Firestore corregidas
(lista de campos desactualizada + `imagenUrl`), `AI_RULES.md` 14.3.

Decisiones: la foto se sube al guardar (no al elegir); en Camino B se
sube antes de crear el pin; `public_id` propio (no el nombre del
archivo) para evitar choques entre usuarios; máx. 10 MB.

**Pendiente de Cris:** crear el preset en Cloudinary y republicar las
reglas de `eventos`. **Pruebas:** `node --check` OK; NO probado en
navegador ni contra Cloudinary/Firebase reales.

**Ajuste posterior (misma sesión):** tamaño del preset subido a 1024×576 (la foto se ve grande al abrir el evento) y ancho mínimo de 1024 px validado en el cliente (`IMG_MIN_ANCHO`, `eventos-form-shared.js`). Textos i18n/HTML actualizados.

## 2026-09-28 — Eventos pasa a ser una categoría más de la tab Categorías (admin)

`AI_RULES.md` y `AI_SESSION.md` consultados antes de tocar código.

Nuevo registro `SPECIAL_CATS` en `js/categories.js` (hoy solo `__eventos__`, el mismo id que ya usaba el filtro del mapa) + `getAdminCats()` (especiales primero + `getAllCats()`). `renderCatsAdmin`/`toggleCat` usan `getAdminCats()`; `_getCatRef` también resuelve las especiales, así que nombre ES/EN/PT, ícono/color y subcategorías reusan los mismos listeners. En la fila no hay tacho: muestra la etiqueta `FIJA` (`deleteCat` ya solo borraba `CUSTOM_CATS`). Ocultarla la saca de la fila del mapa (`_getMainFilterItems`) y, si era el filtro activo, vuelve a `'all'`.

A propósito NO está en `CAT` ni en `getAllCats()`: no es una categoría asignable a un pin, así que no aparece en los selectores de los formularios de lugar, búsqueda ni importación masiva. Contador `(N)` = eventos vigentes ahora.

Persistencia: `saveCategoriesSettings`/`loadCategoriesSettings` (`js/settings-sync.js`) suman el campo `specialData` en `settings/categories` (docs viejos sin ese campo → defaults, nada se rompe). Sin cambios en reglas de Firestore (mismo doc, mismo permiso).

**Limitación conocida:** las subcategorías de Eventos se pueden crear/editar en el admin, pero todavía no filtran nada en el mapa (el filtro Eventos ignora subcategorías, ver `updateFilterBar`/`_pinMatchesActiveFilter`).

**Pruebas:** `node` (chequeo de sintaxis) OK en `categories.js` y `settings-sync.js`. NO probado en navegador ni contra Firebase real.

## 2026-09-28 (cont.) — Etapas 12 y 13 COMPLETADAS: tarjeta de evento + carrusel + 4to nivel de tipografía

Leídos `AI_RULES.md` y `PLAN_USUARIOS_EVENTOS.md` antes de tocar código; corroborado que las etapas pendientes eran 12 y 13 (la 11 ya estaba hecha en el zip recibido).

**Etapa 12:** módulo nuevo `js/evento-card.js` (`EventoCard.render`/`bind`) — variante con foto / sin foto (título grande), ícono 📍 que solo llama a `panToPoiCenter`. `js/typography.js`: 4to nivel `eventoSinFoto` con `defaults`, `_fillLevelsInForm`/`_readLevelsFromForm` respetan los defaults por nivel (los 3 niveles viejos no cambian). `index.html`: bloque "NIVEL 4" en la tab Tipografía, script `evento-card.js` antes de `poi-panel.js`, cache busting. `js/i18n.js`: `evt_card_centrar`.

**Etapa 13:** `_renderEventosTab` (`js/poi-panel.js`) pinta las tarjetas en un carrusel horizontal (`scroll-snap`); `_ensureDom` llama a `EventoCard.bind`. `css/poi-panel.css`: estilos de tarjeta/carrusel, se eliminó el CSS viejo `.poi-panel__evento-*`.

Decisiones: sin foto el nombre no se repite en el cuerpo; foto rota o URL no https cae a sin foto; sin flechas en el carrusel (scroll táctil/barra fina); scroll horizontal no choca con el drag del panel (solo la manija arrastra).

**Pruebas:** `node --check` OK; jsdom sobre tarjeta y tipografía OK; NO probado en navegador ni contra Firebase.

## 2026-09-28 (cont.) — Panel de lugar: arrastre desde toda la superficie, categorías en una fila, fuera coords y "Sin datos históricos."

Leído `AI_RULES.md` antes de tocar código. Archivos: `js/poi-panel.js`, `js/cluster.js`, `css/poi-panel.css`.

**Arrastre:** el núcleo (`_beginDrag/_moveDrag/_finishDrag`) se comparte entre el handle (Pointer Events, sigue igual, también con mouse) y un nuevo arrastre táctil sobre todo el panel (`_onPanelTouch*`). Reglas: gesto horizontal se ignora (carrusel de eventos); en "full" dentro del área de scroll, hacia arriba o con texto ya scrolleado = scroll normal, hacia abajo con `scrollTop=0` = mueve el panel; en "peek" o fuera del scroll siempre mueve el panel; inputs/textarea no arrastran. Desde "full", un arrastre largo hacia abajo cierra directo (pasa la mitad del tramo peek→borde); uno corto baja a "peek". Se mide la posición real del panel al empezar (antes se asumía por estado y desfasaba `--poi-panel-full-top-gap` px).

**Pin maximizado:** `pinClick` (`js/cluster.js`) ahora cierra (colapsa pin + cierra panel) si el pin ya está maximizado (`expandedId === poiId`), aunque el panel esté oculto por haberlo arrastrado hacia abajo. Antes lo reabría.

**Contenido:** "Sin datos históricos." (relleno de `poi.hist`) se trata como vacío en el panel; los writers no se tocaron (`admin.js` compara contra ese texto). Subtítulo sin lat/lng (solo `location_code` si hay; fila oculta si vacío). Bloque "Categoría" (campo interno) reemplazado por una fila de chips con todas las categorías + subcategorías (`poi.categories`/`poi.subcategories`, idioma activo, sin repetir); si el pin no tiene categorías pero sí un campo "Categoría" en texto, se usa ese texto separado por comas.

**Pruebas:** `node --check` OK; regex probadas en node. NO probado en navegador/táctil real.

**Corrección (mismo día):** los cambios de arriba no se veían en producción porque `vercel.json` cachea `/js/*` y `/css/*` como `immutable` por 1 año y no se había cambiado el `?v=` de los archivos tocados. Se subió a `?v=20260928b` en `index.html` para `poi-panel.js`, `poi-panel.css` y `cluster.js`. **REGLA: cada vez que se edite un .js/.css hay que cambiar su `?v=` en `index.html`, si no el navegador sigue con la versión vieja.** La fila de categorías pasó a ser lo primero de la pestaña Info (justo debajo de Info/Eventos); el filtro del campo "Categoría" tolera ":" al final.

**Ajuste 2 (mismo día):** (a) panel de lugar: se quitó el respaldo con el texto del campo "Categoría" — la fila de categorías usa solo `poi.categories`/`poi.subcategories`; sin ninguna, no se muestra (la categoría sigue sin ser obligatoria al guardar). (b) Admin → Lugares → "Filtrar por estado": las 6 barritas sueltas pasaron a chips compactos con nombre (Imágenes, Info, Night, Ubicación, Revisado, Público) y marca de estado ✓/½/✗, con wrap; solo cambia la fila de filtro (`_renderBarsFilterRow`, `BAR_DEFS` suma `label`/`hints`), las barritas de cada tarjeta quedan igual. `admin.js` y `index.html` con `?v=20260928b`. Solo `node --check`; sin probar en navegador.

**Ajuste 3 (mismo día) — zona "muerta" del panel expandido:** probado en Chromium con toques simulados: con el panel en "full" y el texto arriba de todo (scrollTop=0), deslizar hacia abajo desde cualquier altura ya movía el panel; en "peek", hacia arriba/abajo también, desde cualquier punto. El caso que fallaba: texto YA scrolleado — el deslizamiento hacia abajo solo scrolleaba el texto y el panel no se movía, y ese gesto no continuaba. Fix (`js/poi-panel.js`, modo `'scrolling'` en `_onPanelTouchMove`): el mismo gesto sigue de corrido — primero el texto vuelve al tope y, sin soltar el dedo, el panel empieza a bajar. Un deslizamiento corto sigue siendo solo scroll de texto; hacia arriba, scroll normal. `poi-panel.js` → `?v=20260928c` en `index.html`. Sin probar en celular real.

## 2026-09-28 (cont.) — Panel de lugar: flick al arrastrar + fuera textos sueltos

Leído `AI_RULES.md` antes de tocar código. Archivos: `js/poi-panel.js`, `index.html` (`poi-panel.js?v=20260928d`).

**Arrastre (zona "muerta" en el panel expandido):** verificado en Chromium con toques reales (CDP) y panel en "full": el listener táctil está en TODO el panel (no solo en el estado peek/handle) y con el texto arriba de todo, deslizar hacia abajo desde cualquier altura (handle, título, banner, texto) mueve el panel. Único caso donde no se mueve: texto YA scrolleado — ahí el gesto hace scroll de texto y pasa a mover el panel al llegar al tope (a propósito, si no no se podría leer). Causa probable de la sensación de "inactivo": deslizamientos cortos (<36 px) volvían a "full" aunque fueran rápidos. Fix: `_moveDrag` mide velocidad y `_finishDrag` trata un flick (>0.4 px/ms, ≥10 px) como gesto intencional.

**Textos sueltos:** se quitó del panel el `<p data-role="category">` (poi.category sobre el título), el subtítulo `location_code` (no lo escribe nada en el admin) y `_formatSubtitle`; en la fila de categorías ya no entra texto libre legado (solo ids que existen en `getAllCats()`). Se mantienen los campos con título cargados por el admin (`content.fields`, `attrs` legado, `hours` como "Horario"). Los datos guardados en Firestore no se tocaron. CSS `.poi-panel__category` quedó sin uso (sin borrar).

**Pruebas:** `node --check` OK; Chromium móvil con toques simulados sobre harness del panel. NO probado en celular real ni con la app completa.

## 2026-09-28 (cont.) — Categorías reales como texto simple bajo el título, en una línea con slider

Leído `AI_RULES.md` antes de tocar código. Archivos: `js/poi-panel.js`, `css/poi-panel.css`, `index.html` (`?v=20260928e` en ambos).

La fila de categorías/subcategorías reales del pin (`poi.categories`/`poi.subcategories`) pasó de chips (dentro de la pestaña Info) a texto simple dentro del header, justo bajo el título (`data-role="cats-wrap"` > `cats-row`), visible en Info y en Eventos. Mismo aspecto que el viejo texto de categoría (0.75rem, negrita, mayúsculas, letter-spacing .08em, color acento), separadas por doble espacio (`&nbsp;&nbsp;`), `white-space: nowrap` (nunca más de 1 línea) y `overflow-x: auto` (slider horizontal con el dedo, sin barra visible). Indicadores ‹ › (`has-left`/`has-right`, solo visuales) según haya más texto oculto. El gesto horizontal sobre la fila no mueve el panel; el vertical sí.

**Pruebas:** `node --check` OK; Chromium móvil con toques simulados (una línea, slide horizontal, arrastre vertical sobre la fila). NO probado en celular real.

**Ajuste (mismo día):** el separador entre categorías pasó de doble espacio a " - " (espacio, guion, espacio; con `&nbsp;` para que nunca corte línea). Solo `js/poi-panel.js` y `index.html` (`poi-panel.js?v=20260928f`). `node --check` OK.


## 2026-09-28 (cont.) — Etapa 14: calendario propio (día único o rango) del filtro de fecha

Leídos `AI_RULES.md` y `PLAN_USUARIOS_EVENTOS.md` antes de tocar código; confirmado que la próxima etapa a hacer era la 14 (Etapa 15 sigue bloqueada por decisión de Cris sobre dónde va el botón).

**Componente nuevo `js/calendario-eventos.js` (`window.CalendarioEventos`):** calendario mensual con selección de día único o rango (1er click = día, 2do click en otro día sin confirmar = rango, ordenado solo), aritmética de fechas en UTC puro (sin huso) para no correr de día, textos vía `I18N`/`Intl` con el idioma activo. `mount(contenedor, opts)` → `{setValue, getValue, refresh, destroy}`. Sin dependencias de mapa/filtro/panel — pensado para que la Etapa 15 lo reuse tal cual (nota en su propia cabecera).

**Filtro de fecha del mapa (`js/eventos-fecha-filtro.js`):** el `<input type="date">` nativo se reemplazó por un botón círculo+ícono (`.efb-btn`) que abre un popover (`.efb-popover`) con el calendario montado adentro, registrado en `OverlayManager` como `'fechaCalendarioPopover'` (se cierra solo al abrir otro panel/menú, y viceversa). Un chip (`.efb-chip`) con el rango/fecha elegido (`CalendarioEventos.formatRango`) aparece al lado del botón, con el mismo `.efb-clear` de siempre. Se confirma con "Buscar" dentro del calendario (no hay filtro en vivo mientras se elige).

**Soporte de rango, extendiendo funciones existentes (no una comparación nueva en otro lado):** `js/config.js` suma `fechaFiltroEventosHasta` (global, `null` = puntual) junto al `fechaFiltroEventos` ya existente (sigue siendo el día puntual o el inicio). `_eventoOcurreEnFecha`/`pinTieneEventoEnFecha` (`js/eventos-fecha-filtro.js`) suman un 4to parámetro opcional `hastaStr` — sin él, mismo comportamiento exacto de antes (verificado por reducción algebraica: con `hastaSel === desdeSel` la superposición de rangos colapsa a la comparación de un solo día que ya existía). `js/pin-visibility.js` y `js/poi-panel.js` (2 lugares: pestaña de eventos del pin, orden/atenuado de tarjetas) pasan ahora `fechaFiltroEventosHasta` en esa 4ta posición.

**index.html:** script nuevo `js/calendario-eventos.js?v=20260928` justo antes de `eventos-fecha-filtro.js` (que lo monta); cache-busting bumpeado en `config.js`, `pin-visibility.js`, `poi-panel.js`, `i18n.js`, `eventos-fecha-filtro.js` y `css/base.css` (todos tocados) — regla de la sesión anterior: sin esto Vercel sigue sirviendo la versión vieja (`vercel.json` cachea `/js/*`/`/css/*` como `immutable`).

**i18n:** `cal_hint_vacio`, `cal_hint_dia`, `cal_hint_rango`, `cal_limpiar`, `cal_buscar`, `cal_prev`, `cal_next` en ES/EN/PT (`js/i18n.js`).

**CSS (`css/base.css`):** se sacó `.efb-input` (ya sin uso, el input nativo desapareció); nuevo `.efb-wrap`/`.efb-btn`/`.efb-chip`/`.efb-popover` + bloque `.cal-*` completo del calendario, reusando variables ya existentes (`--accent`, `--accent-rgb`, `--surface-rgb`, `--surface2`, `--border`, `--text`, `--text2`, `--r-lg`, `--shadow-panel`) — nada de color hardcodeado nuevo, funciona en tema día/noche sin CSS aparte.

**Pruebas realizadas:** `node --check` OK en `calendario-eventos.js`, `eventos-fecha-filtro.js`, `config.js`, `pin-visibility.js`, `poi-panel.js`, `i18n.js`; llaves de `css/base.css` balanceadas (525/525). **NO probado en navegador real ni contra Firebase.** Pendiente que Cris confirme: (a) elegir día puntual/rango resalta los pines correctos en el mapa; (b) el popover abre/cierra bien y respeta la exclusividad con otros paneles (pin, zonas); (c) el chip y el botón ✕ se ven bien y limpian el filtro; (d) los 3 idiomas; (e) que un evento sin `fecha_fin` sigue tratándose como 1 solo día dentro de un rango (cubierto por la reducción algebraica de arriba, pero sin probar en vivo).

**Actualizado `PLAN_USUARIOS_EVENTOS.md`:** Etapa 14 marcada completada en el checklist y en "REGISTRO POR ETAPA"; "ESTADO ACTUAL" apunta a la Etapa 15 como próxima (sigue bloqueada por la decisión pendiente de Cris).

**Actualizado `AI_RULES.md`:** nueva subsección 14.5 con el detalle de arriba.

## 2026-09-28 (cont. 2) — Ajuste: botón del calendario a la esquina de Eventos + fix de bug de selección

Cris probó la Etapa 14 recién entregada y pidió 2 cosas.

**1) Reubicar el botón.** Ya no hay barra propia (`#eventos-fecha-bar`) siempre visible arriba de la fila de categorías. Ahora el botón que abre el calendario ES el botón que aparece sobre "Eventos" al tocarlo y terminar la animación de ir a la esquina — exactamente la misma coreografía que cualquier categoría con subcategorías reales. Se generalizó el mecanismo YA EXISTENTE (`_catHasActiveSubcats`/`_animateOpenSubcatRow`/`_animateCloseSubcatRow`/`updateFilterBar`, `js/categories.js`) para tratar `'__eventos__'` como "categoría con algo para abrir en la esquina" cuando `window.isFechaFiltroHabilitado()` (nuevo, `js/eventos-fecha-filtro.js`) da `true` — en vez de subcategorías reales, sube un solo botón hecho a mano (`_buildCalendarSubBtn()`, mismo look que un `.fbtn-sub`: círculo + ícono nuevo `LUCIDE.calendar` (`js/config.js`) + etiqueta "Fecha"). `_getCatRef(catId)` reemplaza a `getAllCats()[catId]` en los 2 puntos que necesitaban resolver la categoría especial (`getAllCats()` no incluye `SPECIAL_CATS` a propósito).

El popover pasó a ser hermano de `.filter-row` dentro de `#filter-bar` (antes vivía en un wrapper propio del botón, que ya no existe), anclado con `position:absolute; bottom:100%` a `#filter-bar` mismo (`position:fixed`, sirve igual de referencia) — con `pointer-events:auto` explícito, porque `#filter-bar` tiene `pointer-events:none` a propósito y eso antes se lo daba gratis el div que se sacó. Se eliminaron del todo `#eventos-fecha-bar`/`.efb-wrap`/`.efb-btn`/`.efb-chip`/`.efb-clear` de `index.html` y `css/base.css` — sin chip aparte: el propio calendario adentro del popover ya muestra la selección actual, y "Limpiar" vive ahí mismo.

`js/eventos-fecha-filtro.js`: `_wireFechaFiltroBar()`/`_renderFechaFiltroBar()` (vía `window._onFilterBarUpdated`, que se sacó del todo) pasaron a `window._wireCalendarioFechaBtn()` — la llama `categories.js` justo después de insertar el botón nuevo en el DOM (se recrea desde cero cada vez que se abre la esquina, así que hay que re-enganchar el nodo nuevo cada vez) — y `window._cerrarPopoverFecha()`, que ahora `_animateCloseSubcatRow` llama siempre al cerrar CUALQUIER esquina (barato, no hace nada si no había nada abierto), para que el popover nunca quede huérfano sin el botón que lo controla. El listener de "click afuera cierra" se movió a engancharse UNA sola vez a nivel `document` (antes se re-enganchaba en cada wireo, acumulando listeners duplicados en cada apertura de la esquina — bug de memoria que no llegó a reportarse pero ya estaba ahí).

**2) Bug real, arreglado: "el calendario se cerraba solo al elegir un día, sin seleccionar nada".** La causa no era que no seleccionaba: `_clickDia()` (`js/calendario-eventos.js`) sí actualizaba bien la selección y llamaba a `render()`, que reemplaza el `innerHTML` del popover ANTES de que el click terminara de burbujear hasta `document`. El listener de "click afuera cierra el popover" preguntaba `pop.contains(e.target)` con `e.target` siendo el botón del día que YA HABÍA SIDO DESTRUIDO por ese mismo `render()` — un nodo desconectado del DOM da `false` en `.contains()` aunque el click haya sido bien adentro, así que se trataba como "click afuera" y cerraba el popover una fracción de segundo después de haber seleccionado bien (por eso "Buscar" nunca se veía habilitado: el popover ya estaba cerrado antes de que el usuario pudiera verlo). Fix: `e.stopPropagation()` al principio de `_onClick` (dentro de `mount()`, `js/calendario-eventos.js`) — un click que el calendario ya procesó no tiene motivo para seguir burbujeando hacia `document`. Mismo patrón de riesgo ("click adentro reconstruye su propio HTML" + "listener global que chequea `.contains()`") documentado en `AI_RULES.md` sección 14.5 por si aparece en otro lado del proyecto.

**Archivos tocados:** `js/calendario-eventos.js` (fix del bug), `js/eventos-fecha-filtro.js` (sección UI reescrita entera), `js/categories.js` (`_buildCalendarSubBtn` nueva + generalización de `updateFilterBar`/`_animateOpenSubcatRow`/`_animateCloseSubcatRow`), `js/config.js` (`LUCIDE.calendar`), `js/i18n.js` (`fbtn_fecha_label` es/en/pt), `index.html` (HTML simplificado + cache-busting de todo lo tocado), `css/base.css` (limpieza de estilos viejos + `.efb-popover` reanclado con `pointer-events:auto`), `AI_RULES.md` (sección 14.5 actualizada), `PLAN_USUARIOS_EVENTOS.md` (sub-registro del ajuste dentro de la Etapa 14).

**Pruebas realizadas:** `node --check` sin errores en los 6 `.js` tocados; llaves de `css/base.css` balanceadas (517/517); `<script>`/`</script>` (57/57) y `<div>`/`</div>` (613/613) de `index.html` balanceados. **NO probado en navegador real.** Pendiente que Cris confirme: (a) tocar "Eventos" anima igual que las demás categorías (caída en cascada, viaje a la esquina) y el botón calendario aparece circular con ícono de calendario; (b) elegir 1 día o un rango de 2 clicks ya no cierra el popover solo, y el botón "Buscar" se pone en su color habilitado (deja de estar opaco/gris) apenas hay algo elegido; (c) cerrar la esquina de Eventos (tocándola de nuevo, o tocando otra categoría después) cierra también el popover si había quedado abierto; (d) los 3 idiomas del botón nuevo y del calendario.

## 2026-09-29 — Etapa 15: panel "Todos los eventos"

Leídos `AI_RULES.md`, `PLAN_USUARIOS_EVENTOS.md` y las notas de cabecera de cada archivo tocado antes de modificar código. Pedido explícito de Cris: "ejecutá y completá Etapa 15" (el ZIP venía marcado `POR_COMENZAR_ETAPA_15`). La única decisión abierta del plan (dónde va el botón) se resolvió por criterio de implementación — ver abajo; a confirmar con Cris.

**Panel:** `PoiPanel` (`js/poi-panel.js`) suma un "modo todos": `openTodosEventos()` abre en `'full'` sin lugar puntual (`_currentPoiId = null`), con la clase `.poi-panel--todos` que oculta lo propio de un lugar. `requestTab(tab)` deja pedir la pestaña inicial del próximo lugar que se abra; `isTodosOpen()`; `afterLocate()`. `open(poiId)` sale del modo todos y restaura la pestaña visible (`_setActiveTab` después de `_render()`). Cambio de idioma y `refresh()` repintan el modo todos.

**Contenido:** archivo nuevo `js/eventos-todos.js` (`window.EventosTodos`): búsqueda de texto (sin tildes; nombre, descripción, dirección, horario, lugar, tags) + `CalendarioEventos` inline + grilla de `EventoCard.render`. Reusa `EVENTOS`, `_eventoEsVigente`, `_eventoOcurreEnFecha`; no escribe en `fechaFiltroEventos*` (filtro del mapa). Excluye eventos de pines con `active === false`. Tocar una tarjeta → `pinClick` con `requestTab('eventos')`; si el pin no está dibujado se crea al vuelo con `loadSearchIndex()`.

**Botón de acceso (decisión tomada acá):** botón "Todos" en la esquina de Eventos, junto a "Fecha" (`js/categories.js`: `_buildTodosSubBtn`, `_eventosCornerBtns`, `_buildEventosCornerBtns`; `updateFilterBar`, el click de Eventos y `_animateOpenSubcatRow` generalizados a N botones). Switch nuevo "Panel Todos los eventos" en Admin → Funciones (`FEATURES.todosEventos`, `js/features.js`). `LUCIDE.listado` (`js/config.js`). 7 claves i18n ES/EN/PT.

**Desvío del plan original:** en "Todos", vertical y panel en `'full'`, el 📍 de una tarjeta después de centrar baja el panel a `'peek'` (`EventoCard` → `PoiPanel.afterLocate()`); si no, el pin quedaba detrás del panel. En el panel de un lugar el 📍 sigue sin cambiar el tamaño.

**Archivos:** nuevo `js/eventos-todos.js`; modificados `js/poi-panel.js`, `js/evento-card.js`, `js/categories.js`, `js/features.js`, `js/config.js`, `js/i18n.js`, `css/poi-panel.css`, `index.html` (script nuevo + cache-busting `?v=20260929` en los tocados), `AI_RULES.md` (sección 14.6 + tabla + orden de carga), `PLAN_USUARIOS_EVENTOS.md` (Etapa 15 completada), `ACLARACIONES_RELEVANTES.md`.

**Pruebas:** `node --check` OK en los 7 `.js`; llaves de `css/poi-panel.css` balanceadas (92/92). Chromium con Playwright (vertical 390×844 y horizontal 1200×700), archivos reales sobre datos de prueba y mapa simulado: 30 comprobaciones del panel + 10 de la esquina, todas OK, sin errores de JS. Hallazgo de prueba: con el panel en `'full'` en vertical la barra de filtros queda tapada (igual que con cualquier lugar abierto), así que el "segundo toque cierra" solo es alcanzable en peek/horizontal. NO probado en celular real, con Firebase real ni con Leaflet real.

## Sesión: 2026-09-30 — Tarjeta de evento estilo Polaroid + vista ampliada (mockup de Gemini)

Cris pasó un HTML de Gemini (6 estilos de tarjeta; se eligió el 1, "Polaroid / Instax") y pidió anexarlo a SmartCity SIN archivos nuevos: reusar lo existente.

**Decisión de arquitectura:** el diseño NO se agregó como componente aparte — `EventoCard.render` (`js/evento-card.js`) ya es la única tarjeta de evento (AI_RULES 14.4), así que el Polaroid la reemplaza ahí y la usan sola la pestaña Eventos de un lugar y el panel "Todos". Del mockup solo se tomó el diseño; su código (Tailwind por CDN, `themes`, `getDateBadge` con `status` puesto a mano) no se copió.

**Qué se hizo**
- Tarjeta: marco blanco, foto 16:9, nombre en Caveat, descripción (2 líneas) y una fila con 2 recuadros negros mono (rango de días + `ev.horario` tal cual lo escribió el usuario) y la entrada en texto gris. Sin íconos ni las palabras "Fecha"/"Hora". Ya no muestra tags/dirección/contactos (pasaron a la vista ampliada).
- Color de los recuadros: verde fluo si `_eventoOcurreEnFecha(ev, desde, undefined, hasta)` da true, rojo si no. `desde`/`hasta` = `opts.fechaDesde`/`fechaHasta` que pasa quien llama (poi-panel: `fechaFiltroEventos*` solo si el filtro Eventos está activo; eventos-todos: su propio `_estado`); sin fecha = HOY en el huso de la ciudad (`_diaCalendarioEnHuso(new Date().toISOString())`, no la hora UTC ni un `new Date()` recortado).
- Vista ampliada: `EventoCard.openDetail/closeDetail`. Se desliza desde la derecha DENTRO de `.poi-panel` (que ya es `position:fixed; overflow:hidden`). Botón "Volver", "Ver en el mapa" (mismo centrado que el 📍, vía `_centrarEnMapa`, extraída de `bind`) y, solo en "Todos", "Ver el lugar" (`onVerLugar` → `abrirLugarDeEvento`). Reemplaza al "Reservar Ticket" del mockup (no hay reservas en el proyecto).
- `PoiPanel`: nuevas `getSnap()`/`snapTo('full'|'peek')` (nunca abren/cierran). `close()`, `open()` y `openTodosEventos()` llaman `EventoCard.closeDetail(true)`. Al abrir la vista ampliada con el panel en 'peek' sube a 'full'; "Volver" lo devuelve.
- Mes abreviado de 3 letras según el idioma activo (`Intl`), bonus: el recuadro ya no queda fijo en `es-AR`. 8 claves i18n nuevas ES/EN/PT (`evt_rango_a`, `evt_det_*`).

**Cambio de comportamiento a confirmar:** en "Todos los eventos", tocar una tarjeta antes llevaba directo al lugar; ahora abre la vista ampliada y el viaje al lugar quedó en el botón "Ver el lugar". Si preferís el comportamiento anterior, es sacar `onVerLugar` y volver a poner el click en `eventos-todos.js`.

**Archivos:** `js/evento-card.js`, `js/poi-panel.js` (CRLF respetado), `js/eventos-todos.js`, `js/i18n.js`, `css/poi-panel.css`, `index.html` (fuentes Caveat + Space Mono en el `<link>` existente, cache-busting `?v=20260930`), `AI_RULES.md` (14.7), `ACLARACIONES_RELEVANTES.md`. Archivos nuevos: ninguno.

**Pruebas:** `node --check` OK en los 4 JS tocados; llaves de `poi-panel.css` balanceadas. Probado en Chromium con una página de prueba que carga el CSS/JS reales y las funciones reales `_diaCalendarioEnHuso`/`_eventoOcurreEnFecha`: verde/rojo con hoy, con un día puntual y con un rango; card → vista ampliada → Volver; "Ver en el mapa"; el 📍 no abre la vista; EN. **NO probado** con Firebase, Leaflet real ni celular real, ni con el panel real en modo lateral (pantalla horizontal).


## 2026-09-30 — Plan Tab Temas, Paso 1: modelo de datos + tab Temas

Leídos `AI_RULES.md` (secciones 2, 4, 6, 7, 8, 9) y la nota de cabecera de cada archivo tocado antes de programar. Plan: `PLAN_TAB_TEMAS_OVERRIDE.md`.

**Qué se hizo**
- `js/themes.js`: modelo nuevo por tema (`keyword`, `active`, `showOnMap`, `showInEye`, `eyePosition`, `mapPriorityDay`, `mapPriorityNight`; `isNight` igual). `_normalizeTema(t)` es la única migración (keyword←id, showOnMap←mapDefault, showInEye←altEnabled, eyePosition←1 si panelDefault si no 'last'; `active` arranca en false en temas viejos). `validateTemaKeyword` (minúsculas, solo a-z 0-9 y "-", sin "_", no vacío). `_temaMapThumbConflict` + `toggleTemaFlag` rechazan con mensaje claro un 2º tema ACTIVO con miniatura de mapa. UI por tema: Tema activo, sufijo, Miniatura en el mapa, Aparece en el ojito + posición (1ª…10ª/Última), Prevalece de día / de noche. Selector de tema de noche ahora usa `keyword` como valor (`globalSettings.nightTheme` = keyword; en temas viejos keyword == id, así que lo ya guardado sigue valiendo). Renombrar un sufijo arrastra `nightTheme` si apuntaba a ese tema.
- `js/settings-sync.js`: `loadThemesSettings` normaliza cada tema al cargar (solo eso).
- `index.html`: texto de la tab Temas actualizado; cache-busting `?v=20260930` en `themes.js` y `settings-sync.js`.

**Decisiones de ejecución (a confirmar)**
- Los campos viejos `mapDefault`/`panelDefault`/`altEnabled` se mantienen ESPEJADOS (`_syncLegacyTemaFields`) porque `js/utils.js` todavía los lee: así el público ve exactamente lo mismo hasta el Paso 2, que los reemplaza y saca el espejo.
- Un sufijo repetido entre 2 temas se rechaza (sería ambiguo).
- D1 (solo manual) y D2 (minúsculas, comparación exacta) aplicadas según la propuesta del plan.

**Pruebas:** `node --check` OK en `themes.js` y `settings-sync.js`; `<script>` (58/58) y `<div>` (613/613) de `index.html` balanceados; 20 comprobaciones en Node con DOM simulado (migración de temas viejos sin perder campos, validación de sufijos, regla de una sola miniatura, rechazo de duplicados/"_", nightTheme al renombrar, render). NO probado en navegador real ni con Firebase.

**Pendiente de confirmar por Cris:** crear/editar/guardar/recargar mantiene los campos; temas viejos se ven bien; no deja activar 2 miniaturas.

## 2026-09-30 — Plan Tab Temas, Paso 2: motor de override

Leídos `AI_RULES.md` (secciones 2, 4, 6, 7, 8, 9) y las notas de cabecera antes de programar. Cadena rastreada: `makePinHTML` → `resolvePinImageCandidates` → `buildImageFallbackChain({forMap:true})` (miniatura) y `cyclePinExpandedImage`/`_renderEyeBadge` → `getActiveSkinList` (ojito/panel).

**Qué se hizo**
- `js/utils.js`: función nueva `getThemeOverrideForPoi(poi)` (fuente única: recorre `TEMAS` activos, coincidencia EXACTA `keyword` === clave de `poi.skins`, ignora `skin.active:false`, nunca escribe en `poi`). `getActiveSkinList` la consulta: saca la imagen del tema de donde estuviera y la inserta en su posición (1ª…N / última) con cascada; el tema con miniatura de mapa se inserta último para ganar la posición. `buildImageFallbackChain({forMap})`: miniatura del tema primero, con la regla D4 frente al tema de noche; `forPanel` pasó a usar la 1ª imagen del ojito. **Se eliminaron** `getActiveMapThemeIds`/`getActivePanelThemeIds` (AI_RULES 6 y 7: no dejar dos sistemas).
- `js/markers.js`: `resolvePinImageCandidates` deja `imgB64` legado al final (no al frente) cuando un tema activo pone miniatura, para que no tape el override.
- `js/themes.js`: `_normalizeTema` migra temas viejos con `mapDefault` como ENCENDIDOS (+ prevalece de noche) para no cambiar lo que ve el público; borra los campos viejos; se quitó el espejo `_syncLegacyTemaFields`.
- `index.html`: cache-busting `?v=20260930` en `utils.js` y `markers.js`.

**Pruebas:** `node --check` OK en los 4 `.js`. 38 comprobaciones en Node contra el código real de `utils.js`: equivalencia EXACTA con la versión anterior sin temas / temas inactivos / con y sin tema de noche (cadena y lista); miniatura de tema aunque el skin esté oculto; `halloween` NO coincide con `halloween-noche`; pin sin la variante sin cambios; posiciones 1/2/3/última/mayor que el total con cascada; mover una imagen ya visible sin duplicarla; 2 temas en la misma posición (gana el de la miniatura, sin importar el orden de `TEMAS`); noche con y sin prevalencia; `poi` no se modifica; `imgB64` legado; `forPanel`. NO probado en navegador real ni con Firebase.

**Pendiente de confirmar por Cris:** tema activo con miniatura → el pin muestra la imagen del tema aunque esté oculta; sin temas activos todo igual; posiciones del ojito; D4 (ver `ACLARACIONES_RELEVANTES.md`).

## 2026-09-30 — Plan Tab Temas, Paso 3: refresco en vivo, redibujado y coherencia al maximizar

Leídos `AI_RULES.md` y `AI_SESSION.md` (ya vistos en la sesión) y la cadena: cambio en la tab → `_refreshThemesOnMap` → `rebuildAllMarkers` (`admin-global.js`) → `makeMarker` → `makePinHTML` → `resolvePinImageCandidates`; ojito: `cyclePinExpandedImage` (`markers.js`) → `getActiveSkinList`.

**Qué se hizo**
- `js/themes.js`: `_refreshThemesOnMap()` reusa `rebuildAllMarkers` (no hay sistema paralelo), con un debounce de 60 ms para que varios clicks seguidos hagan un solo redibujado. Se llama al cambiar activo/miniatura/ojito/prioridades, posición, sufijo, al borrar un tema, al guardar temas y al guardar día/noche. Si había un pin abierto (`expandedId`), `rebuildAllMarkers` lo colapsa y cierra el panel; se lo reabre con `pinClick` para refrescar pin y ojito.
- Miniaturas de baja resolución: sin proceso propio (`toThumbCandidateUrl` ya arma la URL 150x150; Cloudinary la genera y cachea).
- **D3 resuelto: (a)** — al maximizar se ve la imagen del tema y el ojito sigue desde su posición real. `markers.js` no se tocó. **D5:** sin escucha en vivo, el visitante ve el cambio al recargar.
- `index.html`: cache-busting `themes.js?v=20260930b`.

**Pruebas:** `node --check` OK; 6 comprobaciones nuevas en Node (un solo redibujado por ráfaga de cambios; sin pin abierto no reabre nada; con pin abierto se redibuja y se reabre; con el `cyclePinExpandedImage` REAL y el tema en la 3ª posición, el ojito sigue desde esa posición (→ 4ª) y el loop vuelve a la 1ª); se repiten sin fallas las 20 del Paso 1 y las 38 del Paso 2. NO probado en navegador real ni con Firebase.

## 2026-09-30 — Plan Tab Temas, Paso 4: pruebas, roadmap y documentación

**Qué se hizo**
- `AI_RULES.md`: nueva sección 14.8 (modelo de tema, `_normalizeTema`, `getThemeOverrideForPoi` como fuente única, regla de 1 miniatura, refresco, D3/D5) y filas de `utils.js`/`themes.js` de la tabla actualizadas.
- `js/roadmap.js`: entrada `i2` (instrucciones de uso de los temas por sufijo) y `r35` (idea: activación por fechas, fuera del plan por D1). `index.html`: cache-busting `roadmap.js?v=20260930`.
- Sin cambios de lógica en este paso.

**Pruebas:** `node --check` OK en los 5 `.js` tocados en todo el plan; `<script>` 58/58 y `<div>` 613/613. Suites en Node: 20 (Paso 1), 38 (Paso 2, incluye equivalencia exacta con la versión anterior), 6 (Paso 3). Prueba en Chromium real (Playwright) con los archivos finales de `themes.js`, `utils.js`, `markers.js` y `settings-sync.js` y el HTML real de la tab: 27 comprobaciones — migración de datos viejos, alta por la UI, rechazo del 2º tema activo con miniatura (mensaje nombra al otro), posición, sufijo con "_" rechazado, sufijo normalizado a minúsculas, selector de noche por keyword, redibujado, guardado y recarga, `makePinHTML` real (miniatura del tema aunque el skin esté oculto, tema apagado = como antes, sufijo parcial no coincide, noche con y sin prevalencia), `poi` sin modificar, y 390 px sin scroll horizontal. NO probado con Firebase ni Cloudinary reales.

**Pendiente de confirmar por Cris:** crear un tema real y activarlo con una imagen real; que el público vea el cambio tras "Guardar cambios" y recargar; ojito y noche en el celular.

## 2026-09-30 — Corrección Tab Temas (PLAN_TAB_TEMAS_CORRECCION.md): interruptor maestro + imágenes ocultas + aviso de motor

Leídos `AI_RULES.md` y la cadena `getThemeOverrideForPoi` → `getActiveSkinList` / `buildImageFallbackChain` → `resolvePinImageCandidates`; revisados los demás lectores públicos de `poi.skins` (`app-state.js getEffectiveSkin` no se usa para pines).

**Qué se hizo**
- `js/utils.js`: `getThemeOverrideForPoi` devuelve `governed` (claves del pin gobernadas por un tema de la tab, menos `main` y el sufijo del tema de noche); `getActiveSkinList` las saca de la lista normal y solo reingresan vía override (tema activo + `showInEye`); `buildImageFallbackChain` las excluye del respaldo final. `THEME_ENGINE_VERSION = 3`.
- `js/markers.js`: `THEME_MARKERS_VERSION = 3` (para el aviso).
- `js/themes.js`: R1 (controles deshabilitados con tema apagado, guardas en `toggleTemaFlag`/`setTemaEyePosition`, mensaje de conflicto de miniatura sugiere apagar el otro tema), R7 (`main` prohibido como sufijo), `_themeEngineStatus` + línea de estado en la tab.
- `index.html`: texto de la tab, contenedor `temas-engine-status`, cache-busting `themes.js/utils.js/markers.js ?v=20260930c`. `AI_RULES.md` 14.8 actualizado.

**Pruebas:** `node --check` OK; `<script>` 58/58, `<div>` 614/614. Node: 20 (paso 1), 38 (paso 2, actualizada para R2), 6 (paso 3), 23 nuevas (caso de Cris: tema apagado con todos los tildes, activo + miniatura, posiciones 1/2/3/última/mayor, activo sin ojito ni miniatura, apagar de nuevo, `poi` sin modificar, skin oculta con tema activo/apagado, sin temas = como antes, `main`, noche exceptuada, pin sin la variante, solo imgB64, 2 temas). Chromium real (Playwright, HTML real de la tab + archivos finales): 27 comprobaciones — controles deshabilitados y valores conservados con el tema apagado, activar/apagar desde la UI, miniatura real con `makePinHTML`, posiciones, rechazo de la 2ª miniatura, sufijo `main` rechazado, guardado/recarga, aviso "al día" y aviso "DESACTUALIZADO" con un `utils.js` viejo, sin scroll lateral en 390 px. NO probado con Firebase ni Cloudinary reales ni con los datos reales de Cris (el reporte de miniatura/posición no se pudo reproducir con datos simulados; ver ACLARACIONES).

**Pendiente de confirmar por Cris:** subir el zip integrado completo + Ctrl+F5; ver el aviso verde en la tab Temas; tema apagado = imagen `piedra` invisible; activo = miniatura y posición correctas.


## 2026-09-30 — Imágenes con orden 50+ bloqueadas en OFF (sin toggle, sin excepción)

Cris pidió que toda imagen con número de "Orden de exhibición" entre 50 y 99 quede invisible al público SIN posibilidad de encenderla: sin toggle on/off y sin que el sistema pueda mostrarla, mientras conserve ese número. Reemplaza la versión anterior de esta misma sesión ("OFF por defecto", con toggle).

**Regla única:** `isSkinHiddenByOrder(name, skin)` + `SKIN_ORDER_HIDDEN_FROM = 50` en `js/utils.js` (orden numérico >= 50; "main" exceptuada). Se aplica en:
- `js/utils.js`: `getActiveSkinList` (ojito/panel), `buildImageFallbackChain` (miniatura del mapa, tema de noche y respaldo final) y `getThemeOverrideForPoi` (un tema activo tampoco puede mostrarla).
- `js/app-state.js`: `toggleSkinStatus` rechaza activarla y `getEffectiveSkin` la ignora.
- `js/img-slots.js` (admin): con orden >= 50 la fila "Imagen activa" se oculta (aparece un aviso), el estado se fuerza a false, al guardar siempre sale `active:false`, y aplica también al precargar pines ya guardados. Si se la mueve a un número menor (< 50), el toggle reaparece y la imagen pasa a ON (visible) — corrección pedida por Cris: antes quedaba en OFF. Se detecta con `state.wasLocked` en `_applyDefaultOff`; también aplica al intercambio por conflicto y al vaciar el slot.
- `index.html`: cache-busting `?v=20260930d` para utils.js, img-slots.js y app-state.js.

**Pruebas:** `node --check` de los 3 JS + pruebas con jsdom (admin: precarga de una guardada en ON con orden 60 → OFF y sin toggle; tipear 75 la bloquea; clic en toggle oculto no enciende; volver a 4 muestra el toggle en OFF; swap; público: ojito, mapa y panel no muestran orden 50+, ni siquiera con un tema activo con ese sufijo). NO probado con Firebase real ni navegador.

## 2026-09-30 — Temas por casilleros (2.ª versión): el tema mueve imágenes de orden, sin override

Partió del proyecto de Cris del 10:47 (que ya traía la regla "orden 50+ = siempre invisible, ni por tema" en `utils.js`/`img-slots.js`/`app-state.js`). Esa regla chocaba con el override en tiempo de dibujado de la corrección anterior (una imagen en 50+ no se mostraba aunque el tema estuviera activo); Cris pidió que el tema solo MUEVA imágenes de casillero.

**Qué se hizo**
- `js/utils.js`: se eliminó `getThemeOverrideForPoi` (y `governed`); `getActiveSkinList` volvió a la lista por orden (sin 50+, sin `active:false`); `_orderedSkinNames` pone primero una imagen no-`main` con `order===1` (`_principalSkinKey`, `getPrincipalThemeSkinKey`); `buildImageFallbackChain` ya no usa override (solo la excepción del tema de noche con `mapPriorityNight`). `THEME_ENGINE_VERSION = 4`.
- `js/markers.js`: `resolvePinImageCandidates` usa `getPrincipalThemeSkinKey`; `THEME_MARKERS_VERSION = 4`.
- `js/themes.js`: `planThemeOrders` (pura, idempotente), `applyThemesToPins` (lee `pines`, escribe `skins` por merge en tandas, actualiza POIS/caché/mapa), `_temasRetire` (sufijos renombrados/borrados), el botón Guardar aplica a los lugares; se quitó la vista previa en memoria; posiciones desde 2ª y fija en 1ª con miniatura.
- `index.html`: texto de la tab y cache-busting `?v=20260930e` (themes/utils/markers). `AI_RULES.md` 14.8 reescrito.

**Pruebas:** `node --check` OK. Node: 28 comprobaciones del planificador y la lectura (subir al 1, cascada solo con ocupantes, hueco que frena la cascada, 50 ocupado → 51, "último", 2 temas con el mismo destino y 2 "último" estables, tema borrado/renombrado, noche y `main` intactos, 1-49 llenos, `active` al cruzar el 50, idempotencia, entrada sin mutar). Chromium real (Playwright, HTML real de la tab + archivos finales + Firestore simulado): 21 comprobaciones — activar con miniatura y guardar (solo se escriben los lugares afectados; el mapa y el ojito muestran la imagen del tema), apagar y guardar (baja al 50 y todo vuelve a la normalidad), posición 2 con cascada, borrar tema activo, tema nuevo y renombrar sufijo, sin scroll lateral en 390 px. NO probado con Firebase/Cloudinary reales ni con el gestor de imágenes del admin tras un `order:1` en una imagen no principal.

**Pendiente de confirmar por Cris:** probar con el lugar real (activar con miniatura → Guardar; ver el mapa y el ojito; apagar → Guardar).


## 2026-09-30 — Tab Temas: el tema no movía imágenes cargadas desde la grilla (matching por sufijo del archivo)

Cris reportó: con un tema activo (sufijo `piedra`, miniatura/posición 1) la imagen con ese sufijo no se movía al casillero indicado.

**Causa probable (confirmar con su dato real):** `planThemeOrders` (js/themes.js) buscaba la imagen solo por la CLAVE interna del skin (`poi.skins[clave]`). Las imágenes cargadas desde la grilla del gestor se guardan con clave `altN`; solo las vinculadas por texto ("### IMG") usan el sufijo como clave. Una imagen `cabildo-cba_piedra_01.webp` con clave `alt2` nunca coincidía con el tema.

**Cambio (solo `js/themes.js` + cache-busting en `index.html` → `themes.js?v=20260930f`):**
- Nuevo `_skinSuffixFromUrl(url)`: saca el sufijo (2.º segmento separado por `_`) del nombre de archivo de la URL.
- `planThemeOrders` ahora recorre las IMÁGENES: coincide por clave (como antes) y, si no, por el sufijo de la URL. Lo demás (tema de noche exceptuado también por sufijo, `main`, cascada, 50+, idempotencia) queda igual. Devuelve además `matched` (sufijos que sí encontraron imagen).
- `applyThemesToPins` devuelve `unmatched` (temas activos sin ninguna imagen en ningún lugar) y el toast de "Guardar cambios" lo avisa con el sufijo, en vez de decir solo "no hubo nada que mover".

**Pruebas:** `node --check`; Node con las funciones reales: clave `piedra`, clave `alt2` + archivo `_piedra_`, ya en 1 (sin cambios), tema apagado (baja al 50 y `active:false`), sufijo = tema de noche (no se toca), sufijo parcial (`piedrabonita`, no coincide), URL con `?v=`. El lado público (`_principalSkinKey`/`_orderedSkinNames`) no depende de la clave, no se tocó. NO probado con Firebase/Cloudinary reales.

**Pendiente de confirmar por Cris:** tilde del tema → "Guardar cambios" de la tab Temas (es lo que mueve las imágenes) → ver el toast; recargar con Ctrl+F5.

## Sesión: 2026-10-01 — Selector de idioma con banderas cuadradas (en este proyecto; reemplaza el intento sobre el proyecto viejo)

Cris pidió reemplazar los botones de texto ES/EN/PT del header por 3 banderas cuadradas: la del idioma activo a todo color, las inactivas apagadas. Pidió expresamente la bandera de **España** para el español.

**Fuente:** `kapowaz/square-flags` (MIT), SVG 1x1 verificado desde GitHub. Alojados en el proyecto, sin CDN: `img/flags/es.svg` (2,2 KB), `gb.svg` (0,6 KB), `br.svg` (0,5 KB) ≈ 3,4 KB en total, licencia en `img/flags/LICENSE-square-flags.md`. Se descartó `lipis/flag-icons` para España: su `es.svg` pesa 82 KB por el escudo (80 KB aun optimizado con svgo). Los SVG de kapowaz usan `var(--flag-palette-*, #color)` con color de respaldo: dentro de `<img>` se usa el respaldo, funciona.

**Mapeo (cambiable):** es→España, en→Reino Unido, pt→Brasil. Cambiar una bandera = cambiar el `src` del botón en `index.html` y copiar el SVG a `img/flags/`.

**Cambios**
- `index.html`: botones `[data-lang-switch]` con `<img>` (alt vacío) + `title`/`aria-label` (Español/English/Português) + `aria-pressed`. Cache-busting `?v=20261001-flags` en `base.css` y `lang-switcher.js` (vercel.json los cachea como immutable).
- `css/base.css`: bloque `#lang-switcher button` reescrito. Inactiva: `grayscale(1) brightness(.85)` + `opacity .6`; hover más claro; activa: color completo + aro `var(--accent)` (sigue el color de acento del tema). ≤420px: banderas de 22px en vez de 26px.
- `js/lang-switcher.js`: una línea en `_applyActiveState` para sincronizar `aria-pressed`. La lógica de idioma NO cambió.

**Pruebas:** `node --check` OK. Chromium con el `base.css` y `lang-switcher.js` reales y un `AppState` de prueba, a 1100px y 360px: los 3 SVG cargan, al tocar una bandera queda a color con aro y las otras en gris, sin errores de consola. **NO probado** en el `index.html` completo (Firebase/Leaflet), con los temas/skins oscuros nuevos, ni en celular real.

## Sesión: 2026-10-01 — Botones de filtros: letra blanca legible + scroll solo horizontal

Cris pidió (1) letra blanca en los botones de filtros de abajo, conservando el borde negro externo y la sombra por debajo, y (2) que el arrastre de la fila solo se mueva izquierda-derecha, sin alterar la posición arriba-abajo.

**Causa 1:** `.fbtn-label` (css/base.css) ya era `color: white`, pero tenía `-webkit-text-stroke: 2px #000`; ese trazo se dibuja centrado sobre el borde de cada letra (1px hacia adentro) y con 10px de fuente tapaba el relleno → todo negro. **Cambio:** se quitó solo esa línea; el borde negro y la sombra siguen saliendo del `text-shadow` (8 offsets de ±2px), que se pinta debajo del texto blanco.

**Causa 2:** `.filter-row` tenía `overflow-y: visible`, pero con `overflow-x: auto` el navegador lo computa como `auto`, así que la fila podía desplazarse en vertical con el dedo. **Cambios:** `overflow-y: hidden` + `touch-action: pan-x` + `overscroll-behavior: contain` en `.filter-row`; en `_attachFilterBarDragScroll` (js/categories.js) un listener `scroll` que fuerza `scrollTop = 0` y un `pointercancel` que corta el arrastre. La lógica del drag horizontal no cambió.

**Cache-busting:** `base.css?v=20261001-filtros`, `categories.js?v=20261001a`.

**Pruebas:** `node --check js/categories.js` OK. NO probado en celular real ni con el `index.html` completo (Firebase/Leaflet). Pendiente de confirmar por Cris: Ctrl+F5, ver letras blancas con borde negro, arrastrar la fila con el dedo (solo debe moverse a los lados).

## Sesión: 2026-10-01 — Re-aplicación del Polaroid de eventos sobre el proyecto V4 (sin cambios de diseño)

Cris entregó por error un estado previo del proyecto mientras otro plan se actualizaba; el zip V4 (`botones filtro arreglados`) ya traía la DOCUMENTACIÓN y el `index.html` de la entrega del 2026-09-30 (sección 14.7 de `AI_RULES.md`, entrada de AI_SESSION, `ACLARACIONES_RELEVANTES.md`, fuentes Caveat/Space Mono, cache-busting `?v=20260930`) pero NO el código. Se re-aplicaron, idénticos a la entrega original, los 5 archivos de código: `js/evento-card.js`, `js/poi-panel.js` (CRLF respetado), `js/eventos-todos.js`, `js/i18n.js` (8 claves ES/EN/PT) y `css/poi-panel.css`. Sin archivos nuevos y sin tocar `index.html`/docs de 14.7 (ya correctos). Detalle de qué hace y decisiones a confirmar: ver la sesión 2026-09-30 y `ACLARACIONES_RELEVANTES.md`.

**Pruebas:** `node --check` OK en los 4 JS; llaves de `poi-panel.css` balanceadas; mismo arnés en Chromium (CSS/JS reales de V4 + `_diaCalendarioEnHuso`/`_eventoOcurreEnFecha` reales, idénticas a las de la versión anterior): verde/rojo con hoy, día puntual y rango; tarjeta → vista ampliada → Volver; "Ver en el mapa"; el 📍 no abre la vista; PT. NO probado con Firebase, Leaflet real ni celular real.

## Sesión: 2026-10-01 — Cruces de cierre en todas las ventanas

Cris pidió que cada tab/ventana tenga una cruz arriba a la derecha para cerrarla ("no sé cómo cerrar algo"), y que la cruz del panel de un pin minimice también el pin (mismo efecto que tocar un punto vacío del mapa), con el diseño ya existente de la página.

**Relevamiento:** ya tenían cruz zona-panel, login/registro público, panel de usuario y Admin. Faltaban: panel de lugar (+ modo "Todos"), vista ampliada del evento, dropdown de zonas, login de admin y popover del calendario. Quedaron SIN cruz a propósito: confirmación (`#modal-confirm`, ya tiene Cancelar/Aceptar), resultados del buscador (se cierran al borrar el texto/tocar fuera), calendario inline del panel "Todos" (lo abre/cierra su botón y vive dentro de un panel que ya tiene cruz).

**Qué se hizo:** clase `.btn-x` en todas (ver AI_RULES 14.9). `PoiPanel` suma `_cerrarDesdeCruz()` (`collapsePin(expandedId)` + `close()`); en "Todos" solo cierra. `.zd-header` pasa a flex con el rótulo en un `<span data-i18n>`. `CalendarioEventos.mount` acepta `onClose` opcional (la cruz solo se dibuja si viene). Se agregó `padding-right` a `.poi-panel__header`/lang-row (el ojito se corre a la izquierda de la cruz) y `padding: 0 26px` al h3 del login de admin para que la cruz no pise el título.

**Archivos:** `js/poi-panel.js` (CRLF respetado), `js/evento-card.js`, `js/zones.js`, `js/admin-auth.js`, `js/calendario-eventos.js`, `js/eventos-fecha-filtro.js`, `css/poi-panel.css`, `css/base.css`, `index.html` (markup + cache-busting `?v=20261001`), `AI_RULES.md` (14.9), `AI_SESSION.md`, `ACLARACIONES_RELEVANTES.md`. Archivos nuevos: ninguno.

**Pruebas:** `node --check` OK en los 6 JS; llaves de ambos CSS balanceadas. Chromium con los archivos reales (`base.css`, `poi-panel.css`, `i18n.js`, `calendario-eventos.js`, `evento-card.js`, `poi-panel.js`) y stubs de `AppState`/`collapsePin`: cruz del panel → `collapsePin('p1')` llamado y panel cerrado; en "Todos" cierra sin llamar a `collapsePin`; cruz de la vista ampliada cierra solo la vista (el panel sigue abierto); cruz del calendario dispara `onClose`; la cruz de zonas sobrevive a `I18N.apply`. NO probado: con Leaflet/Firebase reales (que el pin realmente se vea minimizado en el mapa), en celular real, ni con el skin `neobrutal-night`.

