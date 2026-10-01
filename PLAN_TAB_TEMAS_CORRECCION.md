# PLAN: Tab Temas — corrección (interruptor maestro + imágenes ocultas)

Creado: 2026-09-30. Continúa a `PLAN_TAB_TEMAS_OVERRIDE.md` (pasos 1 a 4 ya entregados).
Origen: pruebas de Cris con el resultado de esos 4 pasos.

Este archivo está pensado para que lo pueda ejecutar cualquier IA (o persona) sin haber
visto la conversación. Leer de arriba hacia abajo.

---

## 0. REGLAS DE PROGRAMACIÓN (aplican a todas las etapas)

**Archivo maestro: `/AI_RULES.md`** (raíz del proyecto). Leerlo ANTES de tocar código.
Secciones que aplican: **2** (orden de carga de scripts), **4** (variables globales:
`let`/`const` NO cuelgan de `window`), **6** (funciones duplicadas), **7** (una sola fuente
de verdad), **8** (rastrear la cadena completa antes de tocar), **9** (documentar en
AI_RULES.md si se cambia arquitectura). La sección **14.8** describe el sistema de temas tal
como está hoy.

Al terminar cada etapa: entrada nueva en `AI_SESSION.md` (fecha, archivos tocados, pruebas,
pendiente de confirmar por Cris) y, si importa para lo que sigue, en
`ACLARACIONES_RELEVANTES.md`.

Reglas de entrega de Cris:
- Cris **no sabe programar**: explicarle todo en lenguaje simple y breve (lee solo los
  primeros 2-3 renglones de cada mensaje; lo importante va primero).
- 1 ZIP por etapa con SOLO los archivos modificados/creados + este plan actualizado.
- Estructura real de carpetas dentro del ZIP (`js/utils.js`, `index.html`; los `.md` en la raíz).
- Nombre del ZIP: `smartcityV4_0_AAAA-MM-DD_HH.MM_<2-4 palabras>.zip` con fecha y hora
  actual de Córdoba, Argentina.
- Preferir la solución real y bien evaluada antes que un parche.
- Probar con Chromium (Playwright) y decir explícitamente qué NO se pudo probar
  (Firebase real, Cloudinary real, celular real).

---

## 1. ESTADO DEL PLAN (reescribir al completar cada etapa)

- [x] **Etapa 1** — Descartar archivos desactualizados + diagnóstico de la miniatura y la posición.
- [x] **Etapa 2** — Interruptor maestro + ocultar imágenes de temas apagados.
- [x] **Etapa 3** — Pruebas del ciclo completo + zip final integrado.

**Próxima etapa a ejecutar:** ninguna — falta la confirmación de Cris con sus datos reales (ver registro).

---

## 2. LO QUE CRIS REPORTÓ (palabras de Cris, resumidas)

Captura de la tab Temas: 3 temas (`enanos`, `halloween`, `piedra`), los tres con "Tema activo"
SIN tildar. En `piedra` estaban tildados "Miniatura en el mapa", "Aparece en el ojito",
posición "Última" y "Prevalece en mapa de día/noche".

1. **Interruptor maestro.** "Tema activo" apagado, pero la imagen `piedra` aparecía en el
   ojito. Nada debería haber cambiado. Los demás tildes son solo la configuración interna
   del tema; un tema y su configuración solo se hacen efectivos cuando "Tema activo" está
   tildado, y recién ahí se habilita el resto de los tildes de la tarjeta.
2. **Miniatura del mapa.** El tilde "Miniatura en el mapa" no funciona: en el mapa sigue
   viéndose la imagen estándar del pin (la de sufijo `main_01`), no la del tema `piedra`.
3. **Posición en el ojito.** Sin importar qué posición se elija (1ª, 2ª, 3ª… Última), la
   imagen del tema sale siempre al final de la lista del ojito.
4. **Desactivar.** Al desactivar el tema desde la tab, la imagen debe dejar de verse en el
   ojito y en el mapa, y todo volver a la normalidad. Hoy queda visible de forma constante:
   el tema solo "deja de influir", pero la imagen sigue mostrándose porque en el lugar
   está marcada como visible. Lo correcto: el tema, al apagarse, desactiva la imagen.

---

## 3. REGLAS NUEVAS QUE DEBE CUMPLIR EL SISTEMA

- **R1 — Interruptor maestro.** Tema con `active:false` ⇒ no produce NINGÚN efecto, sin
  importar `showOnMap`, `showInEye`, `eyePosition` ni las prioridades. En la UI, los demás
  controles de la tarjeta quedan deshabilitados (grisados) mientras "Tema activo" esté apagado.
  Los valores tildados se conservan (no se borran) para cuando se vuelva a activar.
- **R2 — Imagen del tema solo con tema activo.** Toda imagen cuyo sufijo coincida EXACTO con
  el `keyword` de un tema existente en la tab se oculta del ojito, del panel y de la
  miniatura del mapa cuando ese tema NO está activo. Esto ignora `skin.active` del lugar.
- **R3 — Tema activo.** Con el tema activo, se aplica lo que tenga tildado:
  `showOnMap` ⇒ miniatura del mapa; `showInEye` ⇒ aparece en el ojito en `eyePosition`
  (1ª…N o última, con cascada). Si `showInEye` y `showOnMap` están ambos apagados, la imagen
  no se ve en ninguno de los dos.
- **R4 — No se modifica la configuración guardada de ningún lugar.** Todo es regla de
  tiempo de ejecución sobre `poi.skins` (nunca escribir en `poi`).
- **R5 — Reglas que siguen vigentes del plan anterior:** coincidencia exacta y completa del
  sufijo (sin "contiene"); solo 1 tema ACTIVO con "Miniatura en el mapa"; sufijo validado
  (minúsculas, `a-z 0-9 -`, sin `_`); sufijos no repetidos entre temas.
- **R6 — Excepción del tema de noche (pendiente de confirmar, ver D6).** La imagen del tema
  de noche automático (`globalSettings.nightTheme`, guarda la `keyword`) sigue gobernada por
  la lógica de día/noche y NO se oculta por R2, aunque exista un tema con ese sufijo.
- **R7 — Sufijo `main` prohibido como keyword de tema** (ocultaría la imagen principal).
  Agregar esa validación en `validateTemaKeyword`.

---

## 4. LO QUE HAY HOY EN EL CÓDIGO (verificado leyendo el proyecto del 2026-09-30)

- `js/themes.js` — tab Temas. Modelo de tema: `{ id, name, keyword, active, showOnMap,
  showInEye, eyePosition (1…N | 'last'), mapPriorityDay, mapPriorityNight, isNight }`.
  `_normalizeTema` (migración), `validateTemaKeyword`, `toggleTemaFlag` (rechaza un 2º tema
  activo con miniatura), `setTemaEyePosition`, `setTemaKeyword`, `_refreshThemesOnMap`
  (reusa `rebuildAllMarkers` de `js/admin-global.js`, con debounce; reabre el pin abierto).
  `renderTemasAdmin` dibuja las tarjetas (estilos en línea + clases `za-row`/`fi`; no hay CSS propio).
- `js/utils.js` — **motor:** `getThemeOverrideForPoi(poi)` (fuente única; solo mira temas
  `active`, coincidencia exacta, ignora `skin.active`, no escribe en `poi`).
  `getActiveSkinList(poi)` (ojito y panel): arma la lista desde `poi.skins` visibles y
  **agrega/reordena** las imágenes de temas activos. `buildImageFallbackChain(poi,{forMap})`
  (miniatura del mapa). `_orderedSkinNames` (orden canónico).
- `js/markers.js` — `resolvePinImageCandidates` (deja `imgB64` legado al final si hay
  override), `makePinHTML`, `cyclePinExpandedImage` (ojito en el pin maximizado; busca la
  posición real por URL).
- `js/poi-panel.js` — `_getActiveSkinList` y `_renderEyeBadge` leen de `getActiveSkinList`.
- `js/settings-sync.js` — `loadThemesSettings` normaliza los temas al cargar;
  `saveThemesSettings`. `js/app.js` (línea ~63) carga los temas en el `init` antes de crear marcadores.
- Nombre de archivo de imagen: `prefijo_sufijo_indice.ext`. El sufijo pasa a ser la clave de
  `poi.skins` vía `parseImageFilename` (`js/pin-adjust.js`). Las imágenes cargadas por
  importación masiva nacen con `active:true`.

**Por qué pasa lo reportado (causa confirmada para 1 y 4):** el motor actual SOLO agrega o
reordena. Nunca oculta. Una imagen `piedra` con `skin.active:true` es una imagen normal del
lugar: se ve en el ojito (al final, por orden alfabético/`order`) haya tema o no. R1 y R2 no
existían en el plan anterior (decía "al desactivar todo vuelve a como estaba").

**Causa NO confirmada para 2 y 3.** Con tema activo, la miniatura debería cambiar y la
imagen debería ir a la posición elegida. Dos hipótesis, en este orden:
- **H1 (la más probable): archivos desactualizados.** Cada zip de entrega trae SOLO los
  archivos de su paso. El motor (`js/utils.js`, `js/markers.js`) viaja únicamente en el zip
  del Paso 2. Si ese zip no se aplicó, o el navegador guarda la versión vieja en caché, el
  motor viejo no ve los campos nuevos de los temas y la imagen sale al final como cualquier
  variante: coincide exactamente con los síntomas 2, 3 y 4.
- **H2: bug real del flujo completo.** Las pruebas anteriores usaron datos simulados, no la
  app completa con Firebase. Puede haber un camino de imagen que no pasa por
  `getThemeOverrideForPoi` (p. ej. pines creados por el cargador por viewport, `imgB64`
  legado, o el orden de carga de temas vs. marcadores).

---

## 5. ETAPAS

### Etapa 1 — Descartar archivos desactualizados + diagnóstico (~15 min si es H1, ~1 h si es H2)

1. Armar **1 zip integrado** con el proyecto actualizado (todos los cambios de los pasos 1 a 4:
   `js/themes.js`, `js/settings-sync.js`, `js/utils.js`, `js/markers.js`, `js/roadmap.js`,
   `index.html`, `AI_RULES.md`, `AI_SESSION.md`, `ACLARACIONES_RELEVANTES.md` y este plan).
   Partir siempre del ÚLTIMO proyecto de Cris, no del zip viejo.
2. Agregar en la tab Temas una línea de estado, p. ej. "Motor de temas: v2 ✔" / "✘
   desactualizado — falta subir `utils.js`", que detecte si `getThemeOverrideForPoi` existe.
   Así alguien que no programa ve al instante si quedó algún archivo viejo.
3. Cris aplica el zip y recarga con Ctrl+F5 (caché). Si 2 y 3 funcionan: pasar a la Etapa 2.
4. Si siguen fallando (H2): reproducir con una simulación completa de la app (Firebase
   simulado, pin con `main` y `piedra`, tema activo), rastrear por qué la imagen no cambia
   (AI_RULES 8: cadena completa), corregir y volver a probar.

### Etapa 2 — Interruptor maestro + ocultar imágenes (~1 a 1,5 h)

1. `js/utils.js`: en `getThemeOverrideForPoi` (o en una función hermana única, nunca
   duplicar la regla) calcular el conjunto de `keyword` de TODOS los temas de la tab (menos
   el tema de noche, R6) y marcarlas como "gobernadas por tema".
2. `getActiveSkinList`: sacar de la lista toda imagen gobernada cuyo tema no esté activo
   (R2); para las de temas activos, aplicar `showInEye`/`eyePosition` (R3). Con `showInEye`
   apagado y el tema activo, la imagen tampoco aparece en el ojito.
3. `buildImageFallbackChain` y `resolvePinImageCandidates`: la cadena de respaldo de la
   miniatura NO debe incluir imágenes gobernadas de temas apagados (hoy las cuela al final
   de la cadena por `_orderedSkinNames`), ni imágenes de temas activos sin `showOnMap`.
4. `js/themes.js`: deshabilitar (grisar) los controles de la tarjeta cuando "Tema activo"
   esté apagado, sin borrar los valores (R1); validar `main` como keyword prohibida (R7).
   Revisar `toggleTemaFlag` para que no dependa de los sub-tildes cuando el tema esté apagado
   (la regla de 1 sola miniatura cuenta solo temas activos: ya es así).
5. Cuidar el caso pin sin otra imagen que la del tema: si al ocultarla no queda ninguna
   imagen, debe caer al emoji/`imgB64` como hoy, sin romper.
6. Documentar en `AI_RULES.md` 14.8 (reglas R1 a R7) y en `AI_SESSION.md`.

### Etapa 3 — Pruebas y entrega (~30 min)

1. `node --check` de todos los `.js` tocados; `<script>`/`<div>` de `index.html` balanceados.
2. Prueba en Chromium (Playwright) con el HTML real de la tab y los archivos finales, datos
   de prueba que reproduzcan el caso de Cris (pin con `main` + `piedra`, 3 temas):
   - Tema apagado ⇒ `piedra` NO está en el ojito ni en la miniatura; los tildes internos
     no cambian nada.
   - Tema activo + miniatura ⇒ el pin muestra `piedra`; ojito con `piedra` en su posición.
   - Posiciones 1ª, 2ª, 3ª y última (cascada, sin duplicar).
   - Tema activo con `showInEye` apagado ⇒ `piedra` no entra al ojito.
   - Volver a apagar ⇒ todo como al principio, `poi` sin modificar.
   - Tema de noche exceptuado (R6).
   - Controles grisados al apagar; valores conservados al volver a prender.
3. Entregar el zip de la etapa y, al terminar, ofrecer el **zip final integrado** con todo
   el recorrido (pasos 1 a 4 + esta corrección).
4. Decir explícitamente qué NO se probó: Firebase real, Cloudinary real, celular real.

---

## 6. DECISIONES PENDIENTES DE CRIS

- **D6 (aplicada como propuesta) — Tema de noche.** El "tema de noche" automático usa una imagen con sufijo (p. ej.
  `noche`). Si además existe un tema con ese sufijo en la tab, R2 escondería la imagen de
  noche del mapa. Propuesta: exceptuar al tema de noche de R2 (R6). **Pendiente de confirmar.**
- **D7 — Confirmar que R2 es lo que Cris quiere:** una imagen con sufijo de tema existente
  (p. ej. `piedra`) NO se ve en ningún lugar (mapa, ojito, panel) salvo que su tema esté
  activo, aunque en el lugar esté marcada como visible. Cris lo pidió en sus palabras
  (punto 4 de la sección 2); confirmar solo si aparece algún caso raro.
- **Preguntar a Cris al empezar:** si aplicó el zip del Paso 2 (el que trae `utils.js`). Si
  no lo recuerda, la Etapa 1 lo resuelve igual.

---

## 7. REGISTRO DE CAMBIOS DEL PLAN

- 2026-09-30 — Plan creado tras las pruebas de Cris sobre los pasos 1 a 4.
- 2026-09-30 — Etapas 1 a 3 ejecutadas en un solo zip integrado. `js/utils.js`, `js/markers.js`, `js/themes.js`, `index.html` + docs. Cambios respecto del plan: (a) el campo sufijo sigue editable con el tema apagado (define qué gobierna); (b) D6 aplicada como se propuso (tema de noche exceptuado); (c) H1/H2 no se pudieron distinguir con datos simulados: el aviso "Motor de temas al día / DESACTUALIZADO" en la tab lo resuelve a simple vista; si con todos los archivos al día y Ctrl+F5 la miniatura o la posición siguen sin funcionar, falta reproducir con el caso real (nombre del lugar y sus imágenes).
- 2026-09-30 — **2.ª versión (reemplaza las reglas R1-R3 de arriba):** Cris aclaró que la regla "orden 50+ = siempre invisible" es el mecanismo y que el tema debe MOVER imágenes de casillero (activo → casillero 1 con miniatura, o la posición del ojito, con cascada solo si está ocupado; apagado → al 50), sin toggles. Se eliminó el override en tiempo de dibujado; el movimiento lo hace `applyThemesToPins()` al "Guardar cambios". Ver `AI_RULES.md` 14.8 y `ACLARACIONES_RELEVANTES.md`.
