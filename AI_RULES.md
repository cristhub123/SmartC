# AI_RULES.md — Documento maestro para IA que trabaje en SmartCity

> Este archivo es documentación y prevención de regresiones. No es una lista
> de prohibiciones: nuevas arquitecturas y refactors son bienvenidos, pero
> primero hay que entender qué depende de qué (ver sección 8).

## 1. Qué es este proyecto

App web (SPA estática, sin backend propio) de mapa de pines/lugares
(actualmente Córdoba, con soporte multi-ciudad en desarrollo). El navegador
llama directo a **Firestore** (datos) y **Cloudinary** (imágenes). Hosteada
en Vercel (`smart-c-eta.vercel.app`).

Stack: HTML/CSS/JS vanilla (sin build, sin módulos ES, sin bundler) +
Leaflet (mapa) + Firebase compat SDK (Firestore + Auth).

## 2. Orden de carga de scripts (`index.html`)

El orden importa: varios archivos asumen que algo cargado antes ya existe
en el scope global. Orden real (ver `<script>` en `index.html`):

```
leaflet.min.js
firebase-app / firebase-firestore / firebase-auth (compat, CDN)
firebase-init.js      → crea `db` (Firestore)
firestore-sync.js     → funciones de lectura/escritura Firestore
app-state.js          → módulo AppState (fuente de verdad de datos en memoria)
settings-sync.js
config.js             → constantes + variables globales legacy (markers, POIS, etc.)
overlay-manager.js    → módulo OverlayManager (exclusividad entre paneles/menús)
scroll-hints.js
map.js                → crea `map` (instancia Leaflet)
markers.js            → makeMarker, pinClick (legacy, ver nota abajo), expandPin/collapsePin (base)
poi-panel.js           → módulo PoiPanel (panel público de cada lugar)
admin.js               → panel admin: tabs, listado, filtros, toasts
admin-auth.js
user-auth.js            → módulo UserAuth (login/registro público: usuario_comun / dueno_negocio, Etapa 1 de PLAN_USUARIOS_EVENTOS.md)
owner-panel.js          → módulo OwnerPanel (panel del dueño de negocio: sus pines, edición acotada, Etapa 2 de PLAN_USUARIOS_EVENTOS.md)
cloudinary-admin.js    → módulo CloudinaryAdmin (armado de documento + upload)
utils.js               → helpers de imagen/upload, CLOUDINARY_CLOUD_NAME/PRESET
img-slots.js           → AltSlotsAdd / AltSlotsEdit (slots de imagen ilimitados)
geocoder.js
admin-global.js
themes.js
typography.js
cities.js               → ACTIVE_LOCATION, gestión de Ubicaciones
features.js
content-import.js
roadmap.js
zones.js
groups.js
categories.js
shadow-eye.js
pin-adjust.js          → OVERRIDE de startEdit/expandPin/collapsePin/saveNew (ver sección 6)
pin-geocode.js
eventos.js              → módulo Eventos (tab admin "🎉 Eventos", Etapa 3 de PLAN_USUARIOS_EVENTOS.md) — depende de geocoder.js (setupGeocoder) y de pin-adjust.js (_autoSlugBase, _resolveOwnerEmailToUid), por eso carga después de ambos
cluster.js              → pinClick real (ver nota abajo), puentes openPoiPanel/closePoiPanel
map-settings.js
autofill.js
data-io.js              → export/import JSON
app.js                  → init(), panToPoiCenter (centrado del mapa)
```

**Comentados/desconectados actualmente en `index.html`** (no se cargan):
`js/pois-loader.js` y `js/pois-bootstrap.js`. Quedaron en el repo pero
desactivados a propósito desde `smartcityV3.0_fix-mapa-pines` (ver nota al
inicio de `pois-loader.js`): antes hidrataban el mapa desde el JSON estático
`pois_cordoba.json` en vez de Firestore, y bloqueaban que los pines reales
se dibujaran. **No reactivar sin entender esa nota primero.**

## 3. Qué controla cada archivo (resumen funcional)

| Archivo | Rol |
|---|---|
| `firebase-init.js` | Config de Firebase + instancia `db` |
| `firestore-sync.js` | Todas las lecturas/escrituras a Firestore (POIs, zonas, tipografía, ubicaciones, presets); incluye guardados parciales con `merge:true` — `saveSkinsToFirestore` (solo `skins`) y `saveFieldsPartialToFirestore` (solo `content.<idioma>.fields`, Etapa 9) |
| `app-state.js` | Módulo `AppState` — **fuente de verdad en memoria** de POIs/zonas/roadmap/skins, con sistema de eventos (`on`) |
| `config.js` | Constantes (`LUCIDE`, `CAT`) + variables globales legacy: `POIS`, `markers`, `activeFilter`, `expandedId`, `currentPoi`, `pickCtx`, `editingId`, `pendingDelId`, emojis |
| `overlay-manager.js` | Módulo `OverlayManager` — registro central de paneles/menús flotantes (panel de un pin, dropdown de zonas, panel de info de zona) para que abrir uno cierre los demás ya mismo, sin esperar su animación de salida (ver sección 12) |
| `map.js` | Instancia `map` de Leaflet |
| `markers.js` | Dibuja pines en el mapa (`makeMarker`), resuelve URLs de imagen (thumb/full), `pinClick` (legacy, no se usa — ver sección 6), `expandPin`/`collapsePin` base |
| `poi-panel.js` | Módulo `PoiPanel` — panel público que se abre al tocar un pin (lee de `AppState`, no de `markers`) |
| `admin.js` | Panel admin: tabs, listado de lugares, filtros por barritas, toasts, modo "pickear en mapa" |
| `admin-auth.js` | Login/logout de Firebase Auth para el admin |
| `user-auth.js` | Módulo `UserAuth` — login/registro PÚBLICO (email+contraseña y Google) con 2 roles: `usuario_comun`/`dueno_negocio`, guardados en `usuarios/{uid}`. Separado del admin — ver Etapa 1 de `PLAN_USUARIOS_EVENTOS.md` |
| `owner-panel.js` | Módulo `OwnerPanel` — panel del dueño de negocio: lista sus pines (`ownerId` == su uid) y edita SOLO `desc/hist/phone/hours/tags/content.es`. Ver Etapa 2 de `PLAN_USUARIOS_EVENTOS.md` |
| `admin-global.js` | Configuración global (contorno de pin, dim, glow) aplicada a todos los marcadores |
| `cloudinary-admin.js` | Módulo `CloudinaryAdmin` — arma el documento Firestore de un POI y sube a Cloudinary |
| `utils.js` | Helpers de imagen (fallback chain, upload a Cloudinary), `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_UPLOAD_PRESET` |
| `img-slots.js` | Slots de imagen ilimitados (alt images) en los paneles Nuevo/Editar (`AltSlotsAdd`/`AltSlotsEdit`) |
| `geocoder.js` | Búsqueda de dirección → coordenadas (usado en Nuevo/Editar) |
| `pin-geocode.js` | Switch de modo coordenadas/dirección en los formularios |
| `eventos.js` | Módulo `Eventos` — tab admin "🎉 Eventos" (admin-only por ahora): alta de eventos anexados a un pin existente (Camino A) o a un pin mínimo nuevo `tipo: evento_temporal` (Camino B), asignación manual de `usuarioAsignadoUid`, listado con toggle activo/borrado. Colección Firestore `eventos/{eventoId}`. Ver Etapa 3 de `PLAN_USUARIOS_EVENTOS.md` |
| `cities.js` | `ACTIVE_LOCATION`, tab "Ubicaciones" (país/provincia/ciudad, carpeta activa de Cloudinary) |
| `themes.js` | Temas día/noche del mapa |
| `typography.js` | Presets de tipografía |
| `features.js` | Flags de funcionalidades activables |
| `content-import.js` | Importación de contenido/descripciones vía JSON |
| `roadmap.js` | Tab "Roadmap" interno del admin |
| `zones.js` | Zonas del mapa (`ZONAS`), panel de zona |
| `groups.js` | Grupos de lugares (`GROUPS`) |
| `categories.js` | Categorías custom (`CUSTOM_CATS`) |
| `shadow-eye.js` | Efectos visuales (sombra de pin, glow del "ojito") |
| `pin-adjust.js` | El archivo más grande: **override** de `startEdit`/`expandPin`/`collapsePin`/`saveNew` de admin.js/markers.js, `saveEdit`, `saveNew`, generación/edición de ID, carga masiva de pines por texto (`importFullPinsFromText`), vinculación de imágenes por texto (`importImageLinksFromText`) |
| `cluster.js` | Click real de un pin (`pinClick`, ver sección 6), abre/cierra `PoiPanel` |
| `map-settings.js` | Tiles del mapa, opacidad, tinte día/noche |
| `autofill.js` | Autocompletado de datos de un lugar desde OSM |
| `data-io.js` | Export/import de todos los POIs como JSON (backup manual) |
| `app.js` | `init()` (arranque general), `panToPoiCenter` (centrado del mapa al abrir un pin) |
| `pois-loader.js` / `pois-bootstrap.js` | **Desconectados** — no tocar sin leer su nota interna primero |

## 4. Variables globales — ⚠️ regla crítica

Este proyecto usa scripts clásicos (no módulos ES), cargados en orden fijo.
Eso trae una trampa real y ya confirmada en el código:

```js
let markers = {};   // declarado en config.js
```

**Esto NO equivale a `window.markers`.** En un script clásico, `let`/`const`
en el nivel superior crean bindings de scope de script, no propiedades de
`window`. Solo `var` y las **declaraciones de función** (`function foo(){}`)
en el nivel superior sí quedan colgadas de `window` automáticamente.

Consecuencia práctica: código que hace `typeof window.markers === 'object'`
(por ejemplo el guard viejo en `pois-bootstrap.js`) **siempre da `false`**
aunque `markers` esté lleno de pines, porque `markers` vive como variable de
script, no como propiedad de `window`.

**Regla:** antes de usar `window.X`, verificar que `window.X` realmente
exista (con `console.log(window.X)` o revisando si alguien hizo
`window.X = X` explícitamente). No asumir que toda variable global "de
verdad" está en `window`. No mezclar ambos sistemas al agregar código nuevo:
si algo necesita ser accesible desde otro archivo, expórtalo a `window`
explícitamente (patrón ya usado: `window.AppState = AppState`,
`window.PoiPanel = PoiPanel`, `window.ACTIVE_LOCATION = ACTIVE_LOCATION`,
etc.), no confíes en que un `let`/`const` de nivel superior alcance solo.

Variables globales legacy relevantes (viven en `config.js`, scope de
script, **no** en `window` salvo que se diga lo contrario):
`POIS`, `markers`, `activeFilter`, `expandedId`, `currentPoi`, `pickCtx`,
`editingId`, `pendingDelId`, `addEmoji`, `editEmoji`.

Módulos que sí se exponen explícitamente en `window` (una sola fuente de
verdad cada uno, patrón IIFE `(function(){...; return {...}})()`):
`window.AppState`, `window.PoiPanel`, `window.CloudinaryAdmin`,
`window.PoisLoader` (desconectado), `window.FirestoreSync`, `window.SC`
(namespace vacío/reservado en `config.js`).

## 5. `AppState` — la fuente de verdad real de los datos de POIs

`js/app-state.js` expone `window.AppState` con API pública:
`on(evento, cb)`, `loadPois`, `loadZones`, `loadRoadmap`, `getPois`,
`getPoi`, `getZones`, `getRoadmap`, `getGlobalSkin`, `getContent`,
`getEffectiveSkin`, `getImageUrl`, `updatePoi`, `toggleSkinStatus`,
`setGlobalSkin`, `addRoadmapEntry`, `setLanguage`, `getLanguage`,
`toggleClicksVisibility`.

`poi-panel.js` (el panel público que ve el usuario) lee **exclusivamente**
de `AppState`, no de `markers`/`POIS` legacy. Hoy `AppState` se hidrata con
datos reales vía `syncAppStateWithPOIS()` (`firestore-sync.js`), no desde
el JSON estático. Cualquier cambio a los datos de un POI que deba reflejarse
en el panel público tiene que pasar por `AppState`, no alcanza con actualizar
`markers`/`POIS`.

## 6. Funciones con el mismo nombre en distintos archivos (a propósito)

Ya existen casos reales de nombres duplicados en el proyecto. No son un
error a corregir a ciegas — algunos son overrides intencionales, otro es
código muerto que quedó comentado in-situ:

- **`pinClick`**: existe en `markers.js` (línea ~196, toma un `id`) y en
  `cluster.js` (línea ~18, toma un `poi`/`id`, y hace
  `window.pinClick = pinClick`). Como `cluster.js` carga *después* de
  `markers.js` y ambas son declaraciones de función en scope global, la
  de `cluster.js` es la que realmente atiende el click de un pin. La de
  `markers.js` quedó documentada in-situ como no usada en la práctica
  (ver comentario arriba de la función). **No borrarla sin confirmar que
  nada la sigue llamando indirectamente.**
- **`startEdit`, `expandPin`, `collapsePin`, `saveNew`**: definidas primero
  en `admin.js`/`markers.js` y luego **sobreescritas a propósito** en
  `pin-adjust.js` (patrón `const _startEditPrev = window.startEdit;` /
  `const _expandPinBase = expandPin;` antes de redefinir la función), para
  extender el comportamiento sin duplicar toda la lógica. Este es el patrón
  a seguir si hay que extender una función ya existente: guardar referencia
  a la versión anterior y llamarla desde adentro, no reescribir todo de
  cero.

**Regla para código nuevo:** antes de crear o modificar una función
importante, buscar (`grep -rn "function nombreFn"`) si ya existe otra con
el mismo nombre o el mismo propósito en otro archivo. Si hay que extender
una función existente, usar el patrón de `pin-adjust.js` (guardar la
referencia previa y envolver), no crear un segundo sistema paralelo para
controlar la misma interacción.

## 7. Una sola fuente de verdad (configuración)

Cuando un valor de configuración controla una funcionalidad, no duplicarlo
en varios archivos. Ejemplos ya establecidos en el proyecto a respetar:

- El slug/ID de un pin se genera **siempre** igual (`slugify(nombre)-ciudad`)
  desde un único criterio, tanto en alta manual como en carga masiva por
  prefijos e importación de JSON — no reimplementar la lógica de slug en
  un tercer lugar.
- `ACTIVE_LOCATION` (carpeta activa de Cloudinary) vive en `cities.js` y se
  expone como `window.ACTIVE_LOCATION`; cualquier parte que necesite saber
  dónde subir una imagen nueva debe leer de ahí, no mantener su propia copia.
- `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_UPLOAD_PRESET` están centralizados
  en `utils.js`.

## 8. Rastrear la cadena antes de tocar una funcionalidad existente

No asumir que una función se ejecuta solo porque está definida. Antes de
modificar algo, rastrear la cadena completa:

```
acción del usuario → evento/listener → handler → condición/guardia
→ función ejecutada → cambio de estado → resultado visual
```

Esto es especialmente importante acá porque hay guardias y capas de
compatibilidad reales (ver sección 6, y los "puentes de compatibilidad"
`window.openPoiPanel`/`window.closePoiPanel` en `cluster.js`). Cuando algo
"no funciona", diagnosticar dónde se corta la cadena antes de tocar la
función que parece la culpable obvia — puede que el problema esté en el
listener, en una condición que nunca se cumple, o en que otra declaración
de función con el mismo nombre está pisando la que se está mirando.

## 9. Este documento no es una camisa de fuerza

Estas reglas son para entender la arquitectura actual y evitar romper cosas
que ya funcionan, no para bloquear cambios de arquitectura futuros. Si una
arquitectura distinta resulta mejor (por ejemplo, la reestructuración hacia
un "app core" con estado global único + servicios especializados que ya está
planteada a futuro para este proyecto), el camino correcto es:

1. identificar la arquitectura actual,
2. identificar qué depende de ella,
3. explicar el cambio propuesto,
4. migrar de forma controlada,
5. actualizar este archivo (`AI_RULES.md`) para que refleje la nueva realidad.

## 10. Banner del panel vs. imagen del pin (⚠️ NO son la misma imagen)

**[2026-08-15]** El panel público de cada lugar (`poi-panel.js`) tiene 2
fuentes de imagen totalmente separadas — no confundirlas al tocar código:

- **Imagen del pin** (`poi.skins`/`poi.imgB64`): el ícono/edificio que se ve
  en el MAPA. Vive en `smartcity/media/{país}/{prov}/{ciudad}/images/`.
  El "ojito" del panel recorre las variantes ACTIVAS de esta lista
  (`getActiveSkinList(poi)`, función global en `utils.js`) **sobre el pin
  maximizado en el mapa** (`cyclePinExpandedImage(id)` en `markers.js`),
  saltando cualquier variante que el admin apagó con el toggle de
  `img-slots.js`.
- **Imagen banner del panel** (`poi.banner.url`): una imagen APARTE, fija
  (no hay lista, no la toca el ojito), que se ve arriba del todo al abrir
  el panel de un lugar. Vive en la carpeta HERMANA
  `smartcity/media/{país}/{prov}/{ciudad}/banner/` — nunca en `images/`.
  Se sube desde el campo "Imagen banner del panel" en las tabs Nuevo/Editar
  (`utils.js`, bloque `IMAGEN BANNER DEL PANEL`). Si no hay banner cargado,
  el hueco del panel queda en **0px de alto** (ya estaba resuelto por CSS:
  `css/poi-panel.css` → `.poi-panel__hero[hidden]`), nunca cae de vuelta a
  la imagen del pin.

`CloudinaryAdmin.buildFolder(location, subfolder)` ahora recibe un 2do
parámetro (`'images'` por defecto, `'banner'` para el banner) — cualquier
código nuevo que arme una carpeta de Cloudinary debe pasar el subfolder
correcto en vez de asumir `images`.

## 11. Exclusividad entre paneles/menús (⚠️ patrón obligatorio para overlays nuevos)

**[2026-08-18]** Cuando hay un panel/menú flotante abierto (panel de un
pin, dropdown de zonas, panel de info de una zona) y el usuario dispara
la apertura de OTRO, el primero debe cerrarse YA MISMO, sin que nadie
espere a que termine su animación de salida (0.35s/0.4s según el panel)
para que el segundo arranque. Este comportamiento vive centralizado en
`js/overlay-manager.js` (módulo `OverlayManager`) — **no reimplementar
esta lógica de "cerrar lo otro antes de abrir" a mano en un archivo
nuevo**, usar el patrón ya establecido:

1. Cada panel/menú se registra UNA vez, al cargar su script, con su
   propio id: `OverlayManager.register('miId', { isOpen, close })`.
   Ver los 3 registros ya hechos: `'poiPanel'` (`js/poi-panel.js`),
   `'zonasDropdown'` y `'zonaInfoPanel'` (ambos en `js/zones.js`).
2. Antes de abrirse a sí mismo, en vez de abrir directo, se llama a
   `OverlayManager.beforeOpen('miId', () => { <abrir de verdad> })`.
   Cierra cualquier otro overlay abierto de inmediato y, solo si había
   algo para cerrar, espera 50ms antes de disparar la apertura real
   (así el cruce se ve escalonado, no un salto brusco). Sin nada
   abierto, abre sin demora. Ver `open()` en `poi-panel.js` y
   `openZonaPanel()`/`toggleZonasDropdown()` en `zones.js`.
3. **Excepción deliberada:** `js/cluster.js` (`pinClick`) NO usa
   `beforeOpen` para toda su secuencia — llama a
   `OverlayManager.closeOthers('poiPanel')` una sola vez, al principio,
   y deja que la secuencia ya establecida (paneo del mapa → maximizar
   pin → abrir panel, con sus propios `requestAnimationFrame`
   encadenados) siga corriendo sin el delay de 50ms. Fue un pedido
   explícito de Cris: al tocar un pin con el menú de zonas abierto, el
   paneo del mapa debe arrancar de inmediato, no 50ms después. Si se
   agrega un overlay nuevo que SÍ deba respetar ese delay al abrirse
   con un pin ya abierto, usar `beforeOpen` ahí (no en `cluster.js`).

Cualquier panel/menú flotante nuevo que se agregue a futuro (otro
dropdown, otro bottom sheet, etc.) debe registrarse acá siguiendo el
mismo patrón — si no se registra, no participa de la exclusividad y
puede quedar superpuesto con otro panel abierto.

## 12. Sistema de usuarios/roles públicos (Etapa 1, PLAN_USUARIOS_EVENTOS.md)

**[2026-08-19]** Nueva colección Firestore `usuarios/{uid}` (id = uid
de Firebase Auth): `{ uid, email, nombre, rol, creadoEn }`, con
`rol` = `usuario_comun` o `dueno_negocio`. Vive en `js/user-auth.js`
(módulo `UserAuth`, expuesto en `window.UserAuth` con
`getCurrentUser()`, `getCurrentUserProfile()`, `isLoggedIn()`,
`hasRole(rol)`) — cualquier etapa futura que necesite saber quién
está logueado y con qué rol debe leer de ahí, no reimplementar el
`onAuthStateChanged` propio.

Es un login **separado** del de administrador (`admin-auth.js`): usa
el mismo proyecto de Firebase Auth, pero es una sesión y un botón de
header distintos (`#btn-user-account` vs `#btn-admin`). Loguearse
como admin no implica tener un doc en `usuarios`, y viceversa.

Las reglas de seguridad de Firestore para esta colección **no están
en el repo** (este proyecto no tiene un archivo `firestore.rules`
versionado — se gestionan a mano desde la consola de Firebase). Ver
`FIRESTORE_RULES_NOTES.md` en la raíz del proyecto para el texto
sugerido a pegar ahí; no asumir que ya están aplicadas solo porque el
código de `user-auth.js` ya funciona.

## 13. Panel del dueño de negocio + colección "admins" (Etapa 2, PLAN_USUARIOS_EVENTOS.md)

**[2026-08-19]** Cada pin puede tener un campo `ownerId` (uid de
Firebase Auth del dueño de negocio asignado, o `null` si no tiene).
Se asigna a mano desde el admin: campo "Dueño de negocio (UID)" en
las tabs Nuevo (`a-owner-uid`) y Editar (`e-owner-uid`) de
`index.html` — el admin le pide el UID al dueño (visible en Firebase
Console → Authentication → Users) y lo pega ahí. No hay lookup
automático por email: las reglas de Firestore de la colección
`usuarios` (Etapa 1) solo dejan que cada quien lea su propio
documento, así que el admin no puede buscar el uid de otra persona
por email desde el cliente.

`js/owner-panel.js` (módulo `OwnerPanel`, `OwnerPanel.open()`) es el
panel que ve el dueño logueado: lista sus pines (`where('ownerId',
'==', uid)`) y deja editar SOLO `desc`, `hist`, `phone`, `hours`,
`tags` y `content.es.fields` — nunca nombre, categoría, coordenadas,
imágenes, ID ni el propio `ownerId`. Se abre desde el mini panel de
cuenta (`#user-account-overlay` en `js/user-auth.js`, botón "🏠 Mis
lugares", solo visible si `UserAuth.hasRole('dueno_negocio')`).

**⚠️ Dependencia crítica con las reglas de Firestore:** a partir de
esta etapa, "usuario logueado" ya NO es sinónimo de "admin" (antes
solo el admin se logueaba). Se agregó la colección `admins/{uid}`
(gestionada a mano en la consola, nunca desde el cliente) para que
las reglas puedan distinguir un admin real de un dueño de negocio
cualquiera. **Si las reglas de Firestore no están actualizadas al
esquema de `FIRESTORE_RULES_NOTES.md` con la colección `admins`
creada, o bien el admin pierde acceso de escritura, o bien cualquier
dueño logueado podría editar pines ajenos** — no asumir que esto ya
está aplicado solo porque el código de esta etapa está en el repo.

## 14. Colección "eventos" + pin mínimo del Camino B (Etapa 3, PLAN_USUARIOS_EVENTOS.md)

**[2026-08-26]** Nueva colección Firestore `eventos/{eventoId}` (id
automático): `{ nombre, descripcion, categoria, fecha_inicio,
fecha_fin (ISO string o null), poi_id, creadorUid (null — admin-only
en esta etapa), usuarioAsignadoUid, activo (bool), estado
('aprobado'), creadoEn (serverTimestamp) }`. Vive en `js/eventos.js`
(módulo `Eventos`, expuesto en `window.Eventos` con `refreshList()`).

Por ahora **solo el admin** puede crear eventos — la tab "🎉 Eventos"
vive en el panel Admin, no en `OwnerPanel` ni en la UI pública (eso es
la Etapa 6 del plan). Todo evento queda anexado a un pin por 2
caminos:
- **Camino A** (el lugar ya tiene pin): buscador simple sobre `POIS`
  en memoria, sin restringir a "pines propios" — a diferencia de
  `OwnerPanel`, el admin no tiene pines propios.
- **Camino B** (el lugar no tiene pin): se crea ahí mismo, con
  `_crearPinMinimoEvento()`, un pin mínimo pero ya funcional
  (`tipo: 'evento_temporal'`, categoría fija "Evento", ícono 🎉) —
  mismo circuito de guardado que `saveNew()` de `pin-adjust.js`
  (`savePoiToFirestore` → `POIS.push` → `syncAppStateWithPOIS` →
  `regeneratePublicCache` → `makeMarker`), reducido a los campos
  imprescindibles porque no depende del DOM de la tab "Nuevo". El
  campo `tipo` hoy es solo una marca de origen — la Etapa 4 es la que
  le agrega el ciclo de vida real (auto-desactivación cuando vencen
  todos sus eventos de ese pin).

`js/admin.js` (`startPickMode`) suma un 4to contexto, `'evento-pin'`,
para el picker de coordenadas del Camino B — mismo patrón que ya
usaban `'add'`/`'edit'`/`'zona'`, escribiendo en `#evt-pin-lat`/
`#evt-pin-lng` en vez de reimplementar el pick-mode en `eventos.js`
(ver sección 7, una sola fuente de verdad).

`usuarioAsignadoUid` se completa a mano mientras el alta siga siendo
admin-only: pegar el UID directo, o resolverlo por mail con un botón
"Buscar" que reusa `_resolveOwnerEmailToUid()` de `pin-adjust.js` (la
misma función que ya usa el admin para asignar el dueño de un pin por
mail) — no se reimplementó esa búsqueda. A futuro (Etapa 6), cuando
el dueño del evento lo cree con su propio usuario, el sistema lo va a
autoasignar solo — ese cambio es de comportamiento, no de esquema.

**⚠️ Dependencia con las reglas de Firestore:** la colección
`eventos` necesita su propio bloque en `FIRESTORE_RULES_NOTES.md`
(ya agregado, lectura pública / escritura solo admin) — sin
publicarlo en la consola de Firebase, Firestore la bloquea por
default y el guardado de cualquier evento falla con error de
permisos.

## 14.1 Ciclo de vida del pin `evento_temporal` (Etapa 4, PLAN_USUARIOS_EVENTOS.md)

**[2026-08-26]** `checkEventosTemporalesLifecycle(eventosList?)`
(`js/eventos.js`, expuesta en `window`) recorre los pines `tipo:
'evento_temporal'` activos y auto-desactiva (`active:false`, NUNCA
borra) los que ya no tienen ningún evento vigente. Vigente = `activo
=== true` Y (sin `fecha_fin` o `fecha_fin` sin vencer). Se llama
desde `app.js` (`init()`, antes de dibujar marcadores) y desde
`_loadEventosAdminList()`. **Cualquier lugar nuevo que necesite
revisar el ciclo de vida debe llamar a esta función, nunca
reimplementar el criterio de "vigente" en otro archivo.**

La reactivación de un pin auto-desactivado es SIEMPRE manual por
ahora (botón "🔓 Reactivar pin" en la lista de eventos,
`_reactivarPinTemporal()`) — no hay ninguna reactivación automática
al cargar un evento nuevo. Confirmado con Cris: a futuro, cuando
exista el sistema de pagos, esa capa se suma a la cadena de
condiciones existente (mismo modelo de "capas de cebolla" que ya usa
`fecha_inicio`), sin hardcodear nada que bloquee ese cambio.

**⚠️ Bug de fondo corregido de paso (no es específico de eventos):**
`makeMarker()` (`js/markers.js`) nunca respetaba `poi.active ===
false` al crear el marcador por primera vez — solo se ocultaba si se
togleaba en vivo dentro de la misma sesión de navegación
(`togglePoi()`, `admin.js`/`app.js`). Esto significa que ANTES de
esta corrección, desactivar cualquier pin (no solo de eventos) desde
Lugares no lo ocultaba de verdad para un visitante público nuevo —
solo durante la sesión de admin que lo togleó. Ya corregido con el
mismo criterio visual que `togglePoi()`. Si algo dependía del
comportamiento viejo (poco probable, pero queda dicho), revisar acá
primero.

## 14.2 Filtro del mapa + pestaña pública de eventos (Etapa 5, PLAN_USUARIOS_EVENTOS.md)

**[2026-08-26]** `EVENTOS` (`js/config.js`) es el caché global en
memoria de toda la colección `eventos` — cargado una vez en
`app.js` (init()) y mantenido sincronizado por
`_loadEventosAdminList()` cada vez que el admin crea/togglea/borra
un evento. Cualquier código nuevo que necesite la lista completa de
eventos debe leer `EVENTOS`, no disparar una query nueva.

**⚠️ Segundo bug de fondo corregido de paso (no específico de
eventos):** `applyFilter()` (`js/categories.js`) se llamaba desde 4
archivos distintos pero no existía en ninguno — los filtros de
categoría del mapa público llevaban rota toda la vida útil del
proyecto (confirmado con Cris: ya lo sabía, no era urgente, pero
como esta etapa tocaba esa parte se aprovechó para arreglarlo). Ya
implementada; respeta siempre `p.active` y ahora también soporta el
filtro especial `activeFilter === '__eventos__'`.

`js/poi-panel.js` tiene un sistema de 2 pestañas (Info/Eventos) que
solo aparece si el pin tiene ≥1 evento vigente (mismo criterio de
"vigente" de `_eventoEsVigente`, `js/eventos.js`). El rótulo de la
pestaña de eventos es editable (`settings/eventos-config`,
`tituloPanelEventos`) desde la tab admin "Eventos" → "CONFIGURACIÓN
PÚBLICA".

## 15. Ver también

`AI_SESSION.md` — memoria de trabajo temporal de la sesión actual (qué se
revisó, qué se modificó, qué queda pendiente). Revisarlo antes de releer
archivos completos que ya se verificaron en la misma sesión.
