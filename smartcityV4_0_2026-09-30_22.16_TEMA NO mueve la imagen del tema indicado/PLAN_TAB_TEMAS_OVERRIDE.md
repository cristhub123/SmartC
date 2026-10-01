# PLAN: Tab Temas — override momentáneo de imágenes por sufijo

Creado: 2026-09-30. Origen: pedido de Cris (conversación del 2026-09-30).

---

## 0. ARCHIVO DE REGLAS DE PROGRAMACIÓN (ya ubicado — no volver a buscarlo)

**Archivo maestro: `/AI_RULES.md`** (raíz del proyecto). Es al que hay que
referirse SIEMPRE antes de tocar código, en cada paso de este plan.

Complementos, en este orden de uso:

1. `AI_RULES.md` — secciones que aplican a este plan: **2** (orden de carga
   de scripts), **4** (variables globales: `let`/`const` NO cuelgan de
   `window`), **6** (funciones duplicadas / patrón "guardar referencia previa
   y envolver"), **7** (una sola fuente de verdad), **8** (rastrear la
   cadena completa antes de tocar), **9** (documentar en AI_RULES.md si se
   cambia arquitectura).
2. Nota de cabecera de cada `.js` a modificar (todos dicen lo mismo: leer
   `AI_RULES.md`; si ya se leyó en la sesión, alcanza con `AI_SESSION.md`).
3. `AI_SESSION.md` — al TERMINAR cada paso, agregar una entrada con qué se
   cambió y qué verificación se hizo (formato de las entradas anteriores:
   fecha, archivos tocados, pruebas, pendiente de confirmar por Cris).
4. `ACLARACIONES_RELEVANTES.md` — si algo importa para los pasos siguientes.

Reglas de entrega de Cris (aplican a cada paso):

- Entregas medianas y manejables. 1 ZIP por entrega con SOLO los archivos
  modificados/creados (nunca el proyecto entero) + este plan actualizado.
- Los archivos dentro del ZIP respetan la estructura real de carpetas
  (`js/utils.js`, `js/themes.js`, `index.html`, etc.; los `.md` en la raíz).
- Nombre del ZIP: `smartcityV4_0_AAAA-MM-DD_HH.MM_<2-4 palabras del paso>.zip`
  con fecha y hora ACTUAL de Córdoba, Argentina (ej.
  `smartcityV4_0_2026-09-30_04.58_plan-tab-temas.zip`).
- Al entregar: solo los archivos, sin comentario extra — salvo que algo del
  plan se haya modificado en la ejecución (ahí avisar qué cambió).
- Preferir la solución real y bien evaluada antes que un parche; si hay duda,
  consultar antes de programar.

---

## 1. ESTADO DEL PLAN (reescribir esto al completar cada paso)

- [x] **Paso 0** — Plan y localización de reglas (esta entrega).
- [x] **Paso 1** — Modelo de datos + tab Temas (UI y validaciones).
- [x] **Paso 2** — Motor de override (mapa + ojito + panel).
- [x] **Paso 3** — Refresco en vivo, redibujado y coherencia al maximizar.
- [x] **Paso 4** — Pruebas y documentación final.

**Último paso completado:** Paso 4 (plan terminado).
**Próximo paso a ejecutar:** ninguno.

---

## 2. QUÉ SE QUIERE LOGRAR (resumen fiel del pedido)

Los archivos de imagen se nombran `prefijo_sufijo_indice.ext`, ej.
`cabildo-cba_dragones-de-fuego_01.webp`. Los dos `_` son los únicos
delimitadores; el sufijo (el término del medio) puede tener letras, números
y guiones medios (`halloween-noche`, `enanos-02`, `dragones5`).

En la tab Temas el admin crea temas. Cada tema tiene un **sufijo exacto** y
botones on/off. Mientras un tema está ACTIVO, para cada pin que tenga una
imagen cuyo sufijo sea EXACTAMENTE ese texto:

- Puede mostrarla como **miniatura del mapa**.
- Puede mostrarla **entre las imágenes del ojito** (maximizado/panel), en una
  **posición elegible** (1ª, 2ª, 3ª… o última).
- Hace override aunque en el pin esa imagen esté marcada como NO visible.
- **No modifica la configuración guardada de ningún pin.** Es una regla
  aplicada en tiempo de ejecución; al desactivar el tema todo vuelve a como
  estaba.
- Si entra en una posición ocupada, las demás se corren en cascada
  (la 1 pasa a 2, la 2 a 3, etc.); ninguna desaparece.
- Un pin sin imagen con ese sufijo no cambia.

Reglas confirmadas por Cris:

- **Coincidencia exacta y completa** del texto entre los `_`. Nada de
  coincidencia parcial ("contiene").
- **Miniatura en mapa: solo 1 tema activo a la vez.** Si hay 2+ temas activos,
  solo puede haber 1 con "miniatura en mapa" tildada; si no, el sistema NO deja
  activar el otro (mensaje claro). Para tener ambos activos, el admin destilda
  la miniatura en uno de los dos.
- Conflicto por la misma posición del ojito: cascada; el tema que tiene la
  miniatura del mapa tiene prevalencia en el ojito sobre el otro.
- **Día/noche:** cada tema tiene 1 botón "prevalece en mapa de día" y 1 botón
  "prevalece en mapa de noche" (ver decisión pendiente D4).

---

## 3. LO QUE HAY HOY EN EL CÓDIGO (verificado leyendo el ZIP del 2026-09-30)

- `js/themes.js`: array `TEMAS` (`let`, script global). Cada tema hoy es
  `{ id, name, altEnabled, panelDefault, mapDefault, isNight }`. `id` =
  `slugifyTema(name)`. Se guarda entero en Firestore `settings/themes`
  (`saveThemesSettings`/`loadThemesSettings`, `js/settings-sync.js`) con el
  botón "Guardar cambios" (patrón dirty igual que Categorías). Se carga en
  `app.js` (`init()`) ANTES de dibujar pines.
- Hoy el `id` del tema se usa implícitamente como nombre de variante
  (skin) — `js/utils.js`: `getActiveMapThemeIds()` y
  `getActivePanelThemeIds()` devuelven ids de temas con `mapDefault` /
  `panelDefault` y `buildImageFallbackChain` los antepone a la cadena. Es un
  acople implícito nombre→sufijo que este plan vuelve explícito (campo propio).
- Ninguno de esos flags controla hoy el ojito ni ignora `active:false`.
- Tema de noche: `globalSettings.nightHour` / `nightTheme` (id de tema),
  `isNightModeActive()` en `js/utils.js`. Funciona por hora local del
  navegador.
- Imagen del pin en el mapa: `makePinHTML` → `resolvePinImageCandidates` →
  `buildImageFallbackChain({forMap:true})` (`js/utils.js`/`js/markers.js`).
  La miniatura es `toThumbCandidateUrl` (150x150 vía transformación de URL de
  Cloudinary).
- Ojito y panel: `getActiveSkinList(poi)` (`js/utils.js`) — filtra `active
  !== false` (salvo `main`), ordena con `_orderedSkinNames` (fija `main` y
  `noche` primero; el resto por `skin.order`). Lo consumen
  `cyclePinExpandedImage` (`js/markers.js`) y `_renderEyeBadge`
  (`js/poi-panel.js`).
- Clave de variante (sufijo) de cada imagen: ya se deriva del nombre del
  archivo con el mismo criterio (`parseImageFilename`, `js/pin-adjust.js`;
  `validateUploadFilename`, `js/utils.js`). Se guarda como clave de
  `poi.skins`.

Consecuencia: NO hace falta tocar cada pin ni la carga de imágenes. Alcanza
con centralizar la decisión "qué imágenes se ven y en qué orden" en un solo
lugar, que ya existe (`utils.js`), y alimentarlo con las reglas de los temas.

---

## 4. DECISIONES PENDIENTES (contestar antes de/al empezar el paso indicado)

- **D1 (Paso 1) — ¿Activación manual o por fechas?** Este plan implementa SOLO
  interruptor manual "Tema activo". Fechas automáticas (ej. 25/10–1/11)
  quedan FUERA de este plan; se puede sumar después sin romper nada. Si Cris
  las quiere en esta tanda, hay que agregar 1 paso (~1,5 h).
- **D2 (Paso 1) — Mayúsculas.** Propuesta: el campo sufijo del tema se
  normaliza a minúsculas y se compara EXACTO contra la clave de variante tal
  como está guardada. Un archivo `..._Halloween_01` no coincidiría con
  `halloween`. Confirmar si alcanza o si se compara ignorando mayúsculas.
- **D3 (Paso 3) — Qué se ve al maximizar.** Hoy, al maximizar, el pin muestra
  en calidad full la MISMA imagen que la miniatura, y el ojito sigue desde
  ahí. Si la miniatura es del tema pero en el ojito el tema está en posición 3,
  ¿al maximizar se ve (a) la imagen del tema (sin salto visual, propuesta) o
  (b) la que esté en posición 1 del ojito?
- **D4 (Paso 1/2) — Prevalencia día/noche.** Interpretación adoptada: si un
  tema activo tiene tildado "prevalece en mapa de día" (o "de noche") y el
  tema de noche automático también quiere la miniatura en ese momento, gana el
  tema activo del admin y la imagen del tema de noche pasa a estar SOLO en el
  ojito (si el pin la tiene). Confirmar que es lo que se quiso decir.
- **D5 (Paso 3) — Cuándo lo ven los visitantes.** Los temas se leen de
  Firestore al cargar la página (no hay escucha en vivo): un visitante con la
  app ya abierta ve el cambio al recargar. Aceptable para el caso de uso;
  confirmar.

---

## 5. PASOS

### Paso 1 — Modelo de datos + tab Temas (UI y validaciones)

Antes de empezar: leer `AI_RULES.md` (secciones de la sección 0).

**Archivos:** `js/themes.js`, `index.html` (bloque `#tp-temas-admin`, con
cache-busting de los archivos tocados), posiblemente `js/settings-sync.js`
(solo si hace falta normalizar al cargar).

**Modelo nuevo por tema** (compatible hacia atrás; los campos viejos se migran
al cargar, sin borrar temas existentes):

```
{ id, name,
  keyword,           // sufijo EXACTO (lo que va entre los "_" del archivo)
  active,            // tema encendido ahora (manual)
  showOnMap,         // miniatura del mapa (antes: mapDefault)
  showInEye,         // aparece en el ojito (antes: altEnabled)
  eyePosition,       // 1, 2, 3… o 'last'   (antes: panelDefault -> 1)
  mapPriorityDay,    // prevalece en mapa de día
  mapPriorityNight,  // prevalece en mapa de noche
  isNight }          // se mantiene tal cual
```

1. Función de migración única (`_normalizeTema(t)`): completa campos que falten
   (`keyword` = `id` si no existe; `showOnMap` ← `mapDefault`; `showInEye` ←
   `altEnabled`; `eyePosition` ← 1 si `panelDefault`, si no `'last'`).
2. Campo "Sufijo de imagen" por tema, con validación: minúsculas, solo
   `a-z 0-9 -`, **prohibido `_`** (es el delimitador), no vacío.
3. UI por tema: interruptor "Tema activo", "Miniatura en el mapa", "Aparece en
   el ojito" + selector de posición (1…N / última), "Prevalece en mapa de
   día", "Prevalece en mapa de noche".
4. **Regla de una sola miniatura:** al activar un tema (o tildar "miniatura en
   mapa" estando activo), si ya hay OTRO tema activo con miniatura tildada →
   se rechaza con mensaje claro indicando cuál es y qué destildar.
5. Todo sigue el patrón "Guardar cambios" existente (dirty + Firestore
   `settings/themes`).
6. El selector de "tema de noche" pasa a resolver por `keyword`, no por `id`.

**No toca** todavía el mapa ni las imágenes (el sistema sigue igual de cara al
público hasta el Paso 2).

**Aceptación:** crear/editar/guardar/recargar mantiene los campos; temas viejos
se ven bien sin perder nada; no deja activar 2 miniaturas.

### Paso 2 — Motor de override

**Archivos:** `js/utils.js` (principal). Si hace falta, `js/markers.js`.

1. UNA función nueva de fuente única, en `utils.js`, p. ej.
   `getThemeOverrideForPoi(poi)`: recorre los temas ACTIVOS, busca en
   `poi.skins` la clave que sea exactamente igual a `keyword`, y devuelve qué
   imágenes deben (a) ser miniatura del mapa, (b) entrar al ojito y en qué
   posición. Ignora `active:false` del skin. Nunca escribe en `poi`.
2. `getActiveSkinList(poi)` la consulta: arma la lista normal, inserta las
   imágenes de los temas en su posición (cascada hacia abajo), respetando la
   prevalencia del tema con miniatura de mapa. Como ojito y panel ya leen de
   acá, un solo cambio cubre los dos.
3. `buildImageFallbackChain({forMap:true})` la consulta para la miniatura:
   el tema con `showOnMap` va primero (con la regla de prevalencia día/noche
   de D4); el resto de la cadena queda igual.
4. `getActiveMapThemeIds()`/`getActivePanelThemeIds()` se reemplazan por esta
   función (no dejar dos sistemas paralelos — `AI_RULES.md` secciones 6 y 7).
5. Si `TEMAS` no está cargado o no hay temas activos, el comportamiento es
   EXACTAMENTE el actual.

**Aceptación (datos de prueba):** tema activo con miniatura → el pin muestra la
imagen del tema aunque esté marcada oculta; sin tema activo → todo igual; pin
sin esa variante → sin cambios; posición 1/2/última → cascada correcta; sufijo
parcial (`halloween` vs `halloween-noche`) → NO coincide.

### Paso 3 — Refresco en vivo, redibujado y coherencia al maximizar

**Archivos:** `js/themes.js`, `js/admin-global.js` (reusar `rebuildAllMarkers`,
no crear otro), `js/markers.js` / `js/poi-panel.js` solo si D3 lo exige.

1. Al guardar/activar/desactivar un tema, redibujar los pines
   (`rebuildAllMarkers`). Las miniaturas de baja resolución NO requieren
   ningún proceso propio: `toThumbCandidateUrl` ya arma la URL con la
   transformación 150x150 y Cloudinary la genera y cachea sola la primera vez
   que se pide.
2. Si hay un pin maximizado/panel abierto, refrescar el ojito.
3. Resolver D3 (qué imagen se ve al maximizar) y D5.
4. Verificar que `cyclePinExpandedImage` sigue encontrando la posición real
   por URL (ya lo hace) con la lista nueva.

### Paso 4 — Pruebas y documentación final

1. `node --check` en todos los `.js` tocados; llaves de CSS balanceadas si se
   toca CSS; `<script>`/`<div>` de `index.html` balanceados.
2. Prueba en Chromium con Playwright (como en la Etapa 15): datos de prueba
   con temas activos/inactivos, imágenes ocultas, posiciones, 2 temas, noche.
3. Documentar: sección nueva en `AI_RULES.md` (y tabla de archivos, si
   cambia), entrada en `AI_SESSION.md`, `ACLARACIONES_RELEVANTES.md`, entrada
   de roadmap si corresponde.
4. Dejar explícito qué NO se probó (celular real, Firebase real).

---

## 6. ESTIMACIÓN

| Paso | Horas |
|---|---|
| 1 — Datos + tab | 1,5 – 2 |
| 2 — Motor de override | 2 – 2,5 |
| 3 — Refresco y maximizado | 1 – 1,5 |
| 4 — Pruebas y docs | 1 |
| **Total** | **5,5 – 7** |

(+1,5 h si en D1 se decide sumar activación por fechas.)

---

## 7. REGISTRO DE AVANCE (agregar una línea por paso completado)

- 2026-09-30 — Paso 0 completado: plan creado; archivo de reglas ubicado
  (`AI_RULES.md`).
- 2026-09-30 — Paso 1 completado: `js/themes.js` (modelo nuevo, `_normalizeTema`, validación de sufijo, regla de 1 miniatura, UI), `js/settings-sync.js` (normaliza al cargar), `index.html`. Cambios respecto del plan: (a) los campos viejos `mapDefault`/`panelDefault`/`altEnabled` se mantienen espejados hasta el Paso 2 porque `utils.js` los lee; (b) se rechaza un sufijo repetido entre 2 temas; (c) temas viejos migran con `active:false`; (d) D1 y D2 aplicadas según la propuesta.
- 2026-09-30 — Paso 2 completado: `js/utils.js` (`getThemeOverrideForPoi`, `getActiveSkinList` y `buildImageFallbackChain` consultándola; se eliminaron `getActiveMapThemeIds`/`getActivePanelThemeIds`), `js/markers.js` (`imgB64` legado al final si hay override), `js/themes.js` (migración), `index.html` (cache-busting). Cambios respecto del plan: (a) los temas viejos con `mapDefault` migran ENCENDIDOS con prevalencia de noche (así el público ve lo mismo; corrige lo dicho en el Paso 1, donde migraban apagados); (b) el espejo de campos viejos del Paso 1 se quitó y esos campos se borran al migrar; (c) D4 aplicada tal cual: "prevalece de día" hoy no tiene efecto (de día no hay conflicto con el tema de noche) — a confirmar.
- 2026-09-30 — Paso 3 completado: `js/themes.js` (`_refreshThemesOnMap` sobre `rebuildAllMarkers`, con debounce y reapertura del pin abierto), `index.html` (cache-busting). D3 resuelto en (a) sin tocar `markers.js` (ya se comportaba así); D5 aceptado como está. Cambio respecto del plan: el mapa también se redibuja en cada cambio de la tab (vista previa del admin, no guardada), además de al guardar/borrar; el público solo ve lo guardado.
- 2026-09-30 — Paso 4 completado: `AI_RULES.md` (sección 14.8), `js/roadmap.js` (entradas `i2` y `r35`), `index.html` (cache-busting), pruebas en Chromium real. Plan terminado; falta solo la confirmación de Cris con Firebase/Cloudinary reales.
