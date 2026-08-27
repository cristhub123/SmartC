# PLAN_USUARIOS_EVENTOS.md — Plan de trabajo persistente
### Sistema de usuarios (común / dueño de pin-negocio / empleado) + Eventos temporales + Campos preparados para pagos

> ═══════════════════════════════════════════════════════════════
> CÓMO USAR ESTE ARCHIVO (leer esto primero, siempre)
> ═══════════════════════════════════════════════════════════════
> Este archivo NUNCA se borra ni se resetea. Cada etapa que se
> completa se AGREGA al final de "REGISTRO POR ETAPA" — el
> historial completo queda siempre.
>
> Si sos una IA retomando este trabajo en un chat nuevo:
> 1. Leé "ESTADO ACTUAL" — te dice en qué etapa estamos y qué es lo
>    próximo, con la lista exacta de archivos a tocar. No hace falta
>    releer todo el proyecto.
> 2. El resto del contexto de arquitectura general ya está en
>    AI_RULES.md / AI_SESSION.md.
> 3. Al terminar una etapa: agregá una entrada nueva en "REGISTRO POR
>    ETAPA" (nunca edites/borres entradas viejas), tildá el checklist
>    de "PLAN GENERAL", y reescribí "ESTADO ACTUAL" apuntando a la
>    etapa siguiente.
> 4. Entregá solo el/los archivo(s) que cambiaron (no el proyecto
>    completo), nombrado `smartcityV3.0_AAAA-MM-DD_HHMM.zip`, salvo
>    que Cris pida puntualmente el ZIP completo.
>
> **FUERA DE ALCANCE DE ESTE PLAN, no tocar sin que Cris lo pida
> explícitamente:**
> - Importación masiva de pines (ver PLAN_IMPORTACION_MASIVA.md,
>   es un plan aparte, ya completado — no se toca acá)
> - Panaderías / locales "recién salido del horno" — Cris va a traer
>   el detalle completo en otro chat aparte; hasta entonces no
>   existe ninguna decisión de diseño tomada sobre esto
> - Integración real de cobro (Mercado Pago Checkout Pro para
>   destacados, Preapproval para suscripción) — se dejan los campos
>   preparados (Etapa 7) pero el circuito de pago en sí es un plan
>   futuro separado

---

## ⚠️ DOS TABS "EVENTOS" — NO CONFUNDIR

Este plan tiene **dos pantallas de eventos**, en dos lugares
distintos, para dos públicos distintos. Desde el 26/08 se nombran
así en todo este documento para no mezclarlas (antes ambas se
llamaban "Eventos" a secas, lo cual generaba confusión — pedido de
Cris: usar el mismo "nick" — *panel* — que ya se usa para el panel
de info de un pin):

| | **Tab ADMIN "Eventos" (comando)** | **Panel Eventos (pública)** |
|---|---|---|
| ¿Dónde vive? | Panel admin general, junto a Lugares/Ubicaciones/Temas | Dentro del panel de UN pin puntual, como 2da pestaña |
| ¿Quién la ve? | Solo el admin (Cris) | Cualquier visitante público |
| ¿Qué muestra? | TODOS los eventos de la plataforma, filtrables por categoría/nombre/info interna | Solo los eventos vigentes de ESE pin puntual |
| ¿Cuándo aparece? | Siempre visible para el admin | Solo si ese pin tiene ≥1 evento vigente ahora mismo |
| Etapa que la define | Ya existe desde la Etapa 3 (`#tp-eventos-admin`, todavía sin filtros) | Ya existe desde la Etapa 5 (`js/poi-panel.js`) |
| Rótulo visible | Fijo: "🎉 Eventos" | Editable por el admin (default "Eventos", ver "CONFIGURACIÓN PÚBLICA" en la tab admin) |

Son conceptualmente independientes: una es una herramienta de
administración general, la otra es contenido público de un lugar
específico. No comparten componente de UI. La tab ADMIN hoy es una
lista simple (sin filtro por categoría/nombre todavía) — el "centro
de comando" con filtros que pidió Cris queda para más adelante.

## DECISIONES PENDIENTES (a confirmar con Cris antes o durante las etapas que las necesiten)

1. ~~**Límite de ediciones.**~~ **RESUELTO 26/08 (Etapa 6):** contador
   `cambiosRestantes` por evento, arranca en `cambiosDefault`
   (configurable por el admin, tab "Eventos" → "CONFIGURACIÓN GENERAL
   DE EVENTOS"), baja 1 por cada "Guardar cambios" de quien edita su
   propio evento, sin importar cuántos campos tocó. El admin edita
   sin consumirlo y puede recargárselo a mano a un evento puntual.
2. ~~Título de la tab del PIN (pública, Etapa 5).~~ **RESUELTO
   26/08:** el rótulo quedó editable desde la tab admin →
   "CONFIGURACIÓN PÚBLICA" (`settings/eventos-config`,
   `tituloPanelEventos`, default `"Eventos"`), sin decidir el texto
   final de antemano — Cris lo cambia cuando quiera sin tocar código.
3. **Imágenes por categoría de evento.** Cris las va a subir más
   adelante. Asumido por ahora: una imagen por categoría, cargada
   por el admin (no por cada organizador) — confirmar si en cambio
   cada organizador debe poder subir la suya propia por evento.
4. ~~**Toggles maestros globales de eventos**~~ **PARCIALMENTE
   RESUELTO 26/08 (Etapa 6):** 1) habilitar/deshabilitar que
   usuarios no-admin creen eventos → resuelto,
   `creacionEventosHabilitada` en "CONFIGURACIÓN GENERAL DE EVENTOS".
   2) estado por defecto de un evento nuevo → resuelto pero no
   configurable: SIEMPRE nace `activo:false` sin importar quién lo
   crea, decisión ya tomada con Cris (ver Etapa 6 en "REGISTRO POR
   ETAPA"). 3) apagar/encender de golpe TODOS los eventos existentes
   de una — sigue sin hacerse, no se pidió esta vez.

---

### ⚠️ FIX DE SEGURIDAD (fuera de etapa, 2026-08-26) — acceso al panel admin con cuenta común

**Qué encontró Cris:** al entrar con una cuenta de prueba de usuario
común, el sistema le daba acceso al panel admin completo.

**Causa real:** el botón del engranaje (`btn-admin`) abría el panel
admin con solo chequear "¿hay una sesión de Firebase Auth activa?"
(`_adminUser`, `js/admin-auth.js`) — sin verificar SI esa cuenta
puntual era realmente admin. Como el login de usuario común
(`js/user-auth.js`) y el login admin comparten el mismo
`firebase.auth()`, cualquier cuenta logueada (común o dueño de
negocio) quedaba con `_adminUser` completo y veía el panel admin
entero al tocar el engranaje.

**Importante — las escrituras reales SIEMPRE estuvieron protegidas:**
las reglas de Firestore (`admins/{uid}`, ver `FIRESTORE_RULES_NOTES.md`)
ya exigían que el UID esté en esa colección para poder escribir pines,
zonas, eventos, etc. — una cuenta común no podía guardar nada de
verdad, aunque la UI se lo mostrara. El agujero era de interfaz
(mostraba un panel que no debía), no de datos.

**Arreglado:** `js/admin-auth.js` ahora verifica `admins/{uid}` en
Firestore (la misma colección que ya usan las reglas) antes de
completar `_adminUser`, tanto al cambiar el estado de sesión como en
`doAdminLogin()` — si el login/contraseña son correctos pero esa
cuenta no está en `admins/{uid}`, se cierra la sesión al toque y se
muestra "Esta cuenta no tiene permisos de administrador". `js/admin.js`
(click del engranaje) ahora también espera a que termine ese chequeo
antes de decidir abrir el panel o el login.

**Pendiente que Cris confirme:** que su(s) cuenta(s) real(es) de admin
ya están cargadas en `admins/{uid}` en Firestore (ver instructivo en
`FIRESTORE_RULES_NOTES.md`, sección de esa colección) — si no lo
están, con este fix el propio Cris se quedaría afuera del panel.

---

### 🔎 Hallazgo — no hay forma de EDITAR un evento ya creado

**RESUELTO 26/08 (Etapa 6)** — ver detalle completo en "REGISTRO POR
ETAPA" más abajo. Se deja el hallazgo original documentado abajo por
historial.

**Qué encontró Cris:** ni el admin ni el dueño del evento tienen
ningún panel para modificar un evento ya cargado (nombre, fecha,
descripción, etc.) — solo existe crear, togglear activo/inactivo y
borrar.

**No era un bug de la Etapa 5 — era un hueco real del plan.** Revisado
el checklist completo (Etapas 1 a 7) en su momento: ninguna etapa lo
tenía asignado explícitamente. La Etapa 7 menciona un contador
`edicionesCount` (para un futuro límite de ediciones) pero asumía que
la edición en sí ya existía — nunca se planeó la pantalla que la hace
posible.

---

## ESTADO ACTUAL

**Última etapa completada:** Etapa 6 — Edición de eventos + panel de
usuario unificado (Info/Pines/Eventos) + nombre de evento único por
ciudad (ver detalle en "REGISTRO POR ETAPA" más abajo).

**Próxima etapa a hacer:** Etapa 7 — campos preparados para pagos, o
Etapa 8 — subusuario empleado del dueño (a confirmar con Cris cuál
arrancar primero; no dependen una de la otra).

**Contexto nuevo de la Etapa 5 que hay que seguir usando (no crear de
nuevo):**
- **`EVENTOS`** (`js/config.js`) — caché global en memoria de TODA la
  colección `eventos`, cargado una vez en `app.js` (init(), vía
  `loadEventosFromFirestore()` en `js/eventos.js`) y mantenido
  sincronizado a mano cada vez que el admin crea/togglea/borra un
  evento (`_loadEventosAdminList()` reasigna `EVENTOS =
  _eventosCache`). Lo usan el filtro de eventos del mapa, el ciclo de
  vida (Etapa 4) y la pestaña "Eventos" del panel público. **Cualquier
  código nuevo que necesite la lista completa de eventos en memoria
  debe leer `EVENTOS`, no disparar una query nueva a Firestore.**
- **`applyFilter()`** (`js/categories.js`) — **bug de fondo
  encontrado y corregido en esta etapa, no específico de eventos:**
  esta función se llamaba desde varios archivos (`categories.js`,
  `pin-adjust.js`, `pin-geocode.js`, `data-io.js`) pero no existía en
  ningún lado — tocar un filtro de categoría en el mapa público no
  filtraba nada. Ahora sí filtra de verdad: oculta/muestra marcadores
  según `activeFilter` (`'all'`, el id de una categoría normal, o el
  nuevo `'__eventos__'`), respetando siempre `p.active` (nunca
  reaparece un pin desactivado). **Cris: como esto ya venía roto
  desde antes y recién ahora se tocó, confirmá que los filtros de
  categoría del mapa público se comportan como esperás — es la
  primera vez que funcionan de verdad.**
- **Filtro "Eventos y actividades"** — chip nuevo en la barra de
  filtros del mapa (`updateFilterBar()`, junto a "Todo" y las
  categorías, tal como pediste), `data-f="__eventos__"`. Muestra
  cualquier pin (evento_temporal o uno normal con un evento anexado
  por el Camino A) que tenga ≥1 evento vigente ahora mismo. **No
  agrega ningún elemento visual sobre el pin** (confirmado con vos:
  sin badge/glow/borde/ícono superpuesto) — la visibilidad se
  resuelve solo con este filtro.
- **Pestaña "Eventos" del panel público del pin** (`js/poi-panel.js`)
  — llamada **"Panel Eventos"** en la documentación del proyecto de
  acá en más (ver tabla "DOS TABS" arriba) para no confundirla con la
  tab admin — sistema de 2 pestañas (Info / Eventos) que SOLO aparece
  cuando el pin tiene ≥1 evento vigente ahora; con 0 eventos vigentes
  el panel se ve exactamente igual que antes (sin pestañas). El
  rótulo visible de la 2da pestaña es editable por vos desde la tab
  admin "Eventos" → "CONFIGURACIÓN PÚBLICA" (`settings/eventos-config`,
  `tituloPanelEventos`, default `"Eventos"`) — ver "DECISIONES
  PENDIENTES" arriba, punto 2, ya resuelto: el nombre final ("Eventos"
  vs "Actividades") queda a tu criterio, editable en cualquier
  momento sin tocar código. Los eventos se muestran como tarjetas de
  texto ordenadas por cercanía de fecha (el que antes vence va
  arriba), tal cual confirmaste.
- **Pendiente, NO hecho en esta etapa** (dijiste que es trabajo
  futuro tuyo): el pin genérico `evento_temporal` sigue usando el
  emoji fijo 🎉 — cuando subas tu(s) imagen(es) propia(s) (misma
  mecánica que las miniaturas de los demás pines, posiblemente más de
  una según categoría del evento), avisá para cablearlo.

**Contexto de la Etapa 4 que sigue vigente (no crear de nuevo):**
- `checkEventosTemporalesLifecycle(eventosList?)` (`js/eventos.js`,
  expuesta en `window`) — recorre los pines `tipo: 'evento_temporal'`
  todavía activos y auto-desactiva (`active:false`, nunca borra) los
  que ya no tienen ningún evento vigente. Un evento es "vigente" si
  `activo === true` Y (sin `fecha_fin` o `fecha_fin` sin vencer aún)
  — el toggle manual manda siempre. Se llama sola desde `app.js`
  (init(), antes de dibujar los marcadores, ahora pasándole `EVENTOS`
  ya cargado) y desde `_loadEventosAdminList()` (`js/eventos.js`,
  reusa los eventos ya leídos). Cualquier etapa nueva que agregue
  otro punto donde convenga revisar el ciclo de vida (ej. al abrir la
  tab "Lugares") debe llamar a esta misma función, no reimplementar
  la lógica.
- **Reactivación: siempre manual por ahora** (confirmado con Cris —
  "hoy es solo mi toggle"; a futuro, cuando exista el sistema de
  pagos, esa capa se suma a la cadena de condiciones existente, sin
  hardcodear nada que lo bloquee). Botón "🔓 Reactivar pin" agregado
  en cada fila de la lista de eventos (`js/eventos.js`,
  `_reactivarPinTemporal`) cuando el pin del evento está
  auto-desactivado.
- **Bug encontrado y corregido en la Etapa 4 (no es solo de
  eventos):** el campo `active` (activo/publicado) de CUALQUIER pin
  nunca se aplicaba al dibujar el marcador por primera vez
  (`makeMarker`, `js/markers.js`) — solo se ocultaba si se togleaba
  en vivo durante esa misma sesión de navegación. Ya corregido con el
  mismo criterio visual que ya usaba `togglePoi()`.

**Contexto de la Etapa 3 que sigue vigente (no crear de nuevo):**
- `js/eventos.js` (Etapa 3) — módulo admin-only de eventos, tab
  "🎉 Eventos" (`#tp-eventos-admin`). Colección Firestore
  `eventos/{eventoId}` (id automático): `{ nombre, descripcion,
  categoria, fecha_inicio, fecha_fin (ISO string o null), poi_id,
  creadorUid (null mientras el alta sea admin-only),
  usuarioAsignadoUid, activo (bool, toggle manual del admin), estado
  ('aprobado' al crearlo el admin), creadoEn }`. Cualquier etapa
  futura que necesite leer/escribir eventos debe usar esta colección
  y este esquema, no crear uno paralelo.
- Pines `tipo: 'evento_temporal'` (creados desde el Camino B de
  `js/eventos.js`) — ya funcionan como cualquier pin normal (se
  guardan con `savePoiToFirestore`, entran a `POIS`/`AppState`, tienen
  marcador en el mapa). La Etapa 4 es la que tiene que agregarles el
  ciclo de vida (auto-desactivación al vencer todos sus eventos) —
  hoy ese campo `tipo` solo existe como marca de origen, sin ningún
  comportamiento automático todavía.
- `startPickMode`/`stopPickMode` (`js/admin.js`) ahora soportan un
  4to contexto, `'evento-pin'` (además de `'add'`/`'edit'`/`'zona'`),
  usado por el Camino B — escribe en `#evt-pin-lat`/`#evt-pin-lng`.
  Cualquier picker de coordenadas nuevo debe sumarse ahí siguiendo el
  mismo patrón, no crear un pick-mode paralelo (ver AI_RULES.md
  sección 7).
- Reglas de Firestore: `FIRESTORE_RULES_NOTES.md` ya tiene el bloque
  de `eventos` (lectura pública, escritura solo admin) — **todavía no
  confirmado si Cris ya lo publicó en la consola de Firebase**. Sin
  publicarlo, la colección `eventos` queda bloqueada por default
  (Firestore niega todo lo que ninguna regla contempla
  explícitamente) y el guardado de eventos va a fallar con error de
  permisos.

**Contexto que ya existe en el proyecto y hay que seguir usando (no
crear de nuevo):**
- `js/admin-auth.js` sigue siendo el login de administrador — no se
  tocó, sigue siendo su propio nivel separado.
- `js/user-auth.js` (Etapa 1) — módulo `UserAuth`, expuesto en
  `window.UserAuth` con `getCurrentUser()`, `getCurrentUserProfile()`,
  `isLoggedIn()`, `hasRole(rol)`. Cualquier etapa nueva debe leer el
  usuario logueado desde acá, no reimplementar el `onAuthStateChanged`.
- `js/owner-panel.js` (Etapa 2) — módulo `OwnerPanel`
  (`OwnerPanel.open()`), panel del dueño de negocio: lista sus pines
  (`ownerId` == su uid) y edita solo `desc/hist/phone/hours/tags/
  content.es.fields`. Se abre desde `#user-account-owner-btn` (mini
  panel de cuenta en `js/user-auth.js`).
- Colección Firestore `usuarios/{uid}` con `{ uid, email, nombre,
  rol, creadoEn }` — ya existe y se llena desde el registro público.
- Campo `ownerId` en `pines/{pinId}` (uid del dueño asignado, o
  `null`) — se asigna a mano desde el admin (campos `a-owner-uid`/
  `e-owner-uid` en `index.html`), no hay lookup automático por email.
- **Colección `admins/{uid}`** (Etapa 2) — marca qué UIDs son admins
  de verdad. Necesaria para que las reglas de Firestore puedan
  distinguir un admin real de un dueño de negocio cualquiera (desde
  la Etapa 1, "logueado" ya no es sinónimo de "admin"). Se crea a
  mano en la consola — ver `FIRESTORE_RULES_NOTES.md`.
- Reglas de seguridad de Firestore: versión completa y actualizada
  (con `admins`, `usuarios`, y el `ownerId` de `pines`) en
  `FIRESTORE_RULES_NOTES.md` — **todavía no confirmado si Cris ya las
  publicó en la consola de Firebase, ni si ya creó su propio documento
  en `admins`**. No asumir que están activas: sin el documento en
  `admins`, publicar estas reglas le rompe al propio Cris el acceso
  de escritura del panel admin.
- Falta que Cris habilite el proveedor "Google" en Firebase Console →
  Authentication → Sign-in method, si todavía no lo hizo (el botón
  "Continuar con Google" ya está en el código, pero no funciona sin
  ese proveedor habilitado del lado de Firebase).

---

## PLAN GENERAL (checklist)

- [x] Etapa 1 — Roles base: registro/login de usuario común y dueño
      de pin/negocio (email/contraseña + Google)
- [x] Etapa 2 — Panel del dueño de pin/negocio (ver y editar sus
      propios pines)
- [x] Etapa 3 — Colección `eventos` (admin-only) vinculada a un pin
      existente o a un pin mínimo nuevo
- [x] Etapa 4 — Ciclo de vida del pin `evento_temporal`
      (auto-desactivación cuando vencen todos sus eventos)
- [x] Etapa 5 — Filtro "Eventos y actividades" en el mapa (SIN badge
      sobre el pin) + tab "Eventos" del PIN (pública)
- [x] Etapa 6 — Edición de eventos + panel de usuario unificado
      (Info/Pines/Eventos, reemplaza al mini panel + OwnerPanel
      viejos) + toggle para habilitar que cualquier usuario logueado
      cree eventos desde su propio panel (autoasignación de
      `creadorUid`/`usuarioAsignadoUid`) + nombre de evento único por
      ciudad
- [ ] Etapa 7 — Campos preparados para pagos (sin cobro automático
      todavía): `plan` free/premium + funciones premium
      configurables + `destacado`/`destacado_hasta` por evento
- [ ] Etapa 8 — Subusuario empleado del dueño (alta directa sin
      invitación, permisos limitados) — renumerada desde la Etapa 6
      original, sin cambios de contenido

---

## REGISTRO POR ETAPA

### Etapa 1 — Roles base: registro/login (2026-08-19)

**Qué se hizo:** login/registro público separado del admin, con 2
tipos de cuenta (`usuario_comun`/`dueno_negocio`), email+contraseña y
Google Sign-In.

**Archivos creados:**
- `js/user-auth.js` — módulo `UserAuth` (login, registro, Google
  Sign-In con paso extra de elegir rol si la cuenta de Google es
  nueva, logout, `window.UserAuth` con API pública para otras
  etapas).
- `FIRESTORE_RULES_NOTES.md` — reglas de seguridad sugeridas para
  `usuarios/{uid}` (texto para pegar a mano en la consola de
  Firebase; este proyecto no tiene `firestore.rules` versionado).

**Archivos modificados:**
- `index.html` — botón `#btn-user-account` (👤) en el header público,
  junto a `#btn-admin`; overlay `#user-auth-overlay` con 2 tabs
  (Ingresar/Crear cuenta) + paso extra para Google Sign-In nuevo;
  script `js/user-auth.js` agregado después de `admin-auth.js`.
- `css/base.css` — estilos de `#btn-user-account` (mismo lenguaje
  visual que `#btn-admin`) y de todo el overlay/tabs/selector de rol
  (mismo patrón que `#admin-login-overlay`, con `--text3` en vez de
  una variable `--muted` que no existía en el proyecto).
- `AI_RULES.md` — nueva sección 12 (sistema de usuarios/roles),
  entrada en la tabla de archivos, orden de carga de scripts.

**Modelo de datos:** colección `usuarios/{uid}` (id = uid de Firebase
Auth): `{ uid, email, nombre, rol, creadoEn }`.

**Pendiente de confirmar por Cris (no es código, son 2 pasos manuales
en Firebase):**
1. Habilitar el proveedor "Google" en Firebase Console →
   Authentication → Sign-in method (si no está habilitado, el botón
   "Continuar con Google" va a fallar).
2. Pegar las reglas de `FIRESTORE_RULES_NOTES.md` en Firestore →
   Rules cuando quiera activar la protección de la colección
   `usuarios` (hoy, sin esas reglas pegadas, Firestore puede estar en
   modo abierto o con las reglas que ya tenía antes — no se tocó
   nada de reglas desde el código, no se puede).

**Pruebas realizadas:** `node --check js/user-auth.js` sin errores;
verificación automática de que todos los `id` que usa `user-auth.js`
existen una sola vez en `index.html` (sin duplicados ni faltantes).
No probado en navegador real ni contra Firebase real (sin entorno con
DOM/Firestore en esta sesión) — pendiente que Cris lo pruebe en su
entorno: (a) registrarse como usuario común, (b) registrarse como
dueño de negocio, (c) cerrar sesión y volver a entrar con esa cuenta,
(d) Google Sign-In con una cuenta nueva (una vez habilitado el
proveedor) y confirmar que pide el rol antes de terminar, (e) Google
Sign-In con una cuenta ya registrada y confirmar que entra directo
sin pedir rol de nuevo.

### Etapa 2 — Panel del dueño de pin/negocio (2026-08-19)

**Qué se hizo:** panel donde un usuario logueado con rol
`dueno_negocio` ve sus propios pines (`ownerId` == su uid) y edita un
subconjunto acotado de campos, sin acceso al resto del admin ni a
pines de otros dueños. Del lado del admin, se agregó la forma de
asignar el dueño a un pin.

**Archivos creados:**
- `js/owner-panel.js` — módulo `OwnerPanel`: lista de pines propios
  (query `where('ownerId','==',uid)`), edición de `desc`, `hist`,
  `phone`, `hours`, `tags` y `content.es.fields` (editor simple de
  título+texto, propio, independiente del editor del admin), guardado
  parcial con `merge:true` (no toca el resto del documento ni otros
  idiomas), y sincronización con `POIS`/`AppState` en memoria si el
  pin ya estaba cargado en la sesión pública.

**Archivos modificados:**
- `index.html` — campo "Dueño de negocio (UID)" en las tabs Nuevo
  (`a-owner-uid`) y Editar (`e-owner-uid`) del admin; mini panel de
  cuenta nuevo (`#user-account-overlay`, nombre/rol + botón "🏠 Mis
  lugares" solo si el rol es `dueno_negocio` + cerrar sesión);
  overlay del panel del dueño (`#owner-panel-overlay`); script
  `js/owner-panel.js` agregado después de `user-auth.js`.
- `js/admin.js` — `startEdit()` precarga `e-owner-uid` con
  `p.ownerId`.
- `js/pin-adjust.js` — `saveEdit()`/`saveNew()` incluyen `ownerId` al
  guardar (en `saveEdit`, si el campo no está en el DOM por algún
  motivo, se conserva el valor previo del pin en vez de borrarlo).
- `js/user-auth.js` — `onUserAccountButtonClick()` ahora abre el mini
  panel de cuenta en vez de un `confirm()` directo de logout; desde
  ahí un dueño accede a "Mis lugares" (`OwnerPanel.open()`).
- `css/base.css` — estilos de `#user-account-overlay`,
  `#owner-panel-overlay` y el editor de campos del dueño.
- `AI_RULES.md` — nueva sección 13 (panel del dueño + colección
  `admins`), entrada en la tabla de archivos, orden de scripts.
- `FIRESTORE_RULES_NOTES.md` — **reescrito**: agrega la colección
  `admins/{uid}` (necesaria porque desde la Etapa 1 "logueado" ya no
  es sinónimo de "admin") y la regla de `pines` que deja al dueño
  actualizar SOLO su propio pin y SOLO esos campos.

**Modelo de datos:** `pines/{pinId}.ownerId` (uid del dueño, o
`null`). `admins/{uid}` (documento marcador, cualquier contenido,
gestionado a mano en la consola — nunca desde el cliente).

**⚠️ Pendiente OBLIGATORIO de Cris antes de que esta etapa funcione
de forma segura (no es código, son pasos manuales en Firebase):**
1. Crear su propio documento en la colección `admins` (con su UID de
   admin como ID del documento) — ver instrucciones paso a paso en
   `FIRESTORE_RULES_NOTES.md`. **Si publica las reglas nuevas sin
   hacer esto primero, pierde su propio acceso de escritura como
   admin.**
2. Publicar las reglas actualizadas de `FIRESTORE_RULES_NOTES.md`.
3. Para probar el panel del dueño: crear (o convertir) una cuenta de
   prueba con rol `dueno_negocio` desde el registro público, copiarle
   el UID desde Firebase Console → Authentication → Users, y
   pegárselo a algún pin de prueba en el campo "Dueño de negocio
   (UID)" del admin.

**Pruebas realizadas:** `node --check` sin errores en `owner-panel.js`,
`user-auth.js`, `admin.js` y `pin-adjust.js`; verificación automática
de que todos los `id` nuevos usados desde JS existen una sola vez en
`index.html`; balance de llaves `{}` verificado en `css/base.css`. No
probado en navegador real ni contra Firebase real (sin entorno con
DOM/Firestore en esta sesión) — pendiente que Cris pruebe en su
entorno, después de los 3 pasos de arriba: (a) asignar un pin de
prueba a un dueño, (b) loguearse como ese dueño y confirmar que "Mis
lugares" muestra solo ese pin, (c) editar desc/hist/teléfono/horario/
tags/campos y confirmar que se guarda y que el resto del pin (nombre,
categoría, coordenadas, imágenes) no se toca, (d) confirmar que un
usuario `usuario_comun` (sin rol de dueño) NO ve el botón "Mis
lugares", (e) confirmar que el admin sigue pudiendo editar/crear/
borrar pines con normalidad después de publicar las reglas nuevas.

### Etapa 3 — Colección `eventos` (admin-only) (2026-08-26)

**Qué se hizo:** nueva tab del panel Admin ("🎉 Eventos") donde SOLO
el admin crea eventos por ahora (el toggle que habilita a dueños/
usuarios es la Etapa 6 — OwnerPanel y la UI pública quedan
preparadas en el código pero sin pantalla visible hasta entonces).
Cada evento queda anexado a un pin por 2 caminos: A) buscar y elegir
un pin ya existente (sin restringir a "pines propios", porque el
admin no tiene pines propios), o B) crear ahí mismo un pin mínimo
funcional (`tipo: evento_temporal`, categoría "Evento" fija) cuando
el lugar todavía no tiene pin — ya queda funcionando en el mapa como
cualquier otro pin, sin esperar a la Etapa 4.

**Archivos creados:**
- `js/eventos.js` — módulo admin-only de eventos: toggle Camino A/
  Camino B, buscador de pines existentes, geocoder + pick-en-mapa
  para el pin mínimo del Camino B, asignación manual de
  `usuarioAsignadoUid` (pegar UID o resolver por mail con click,
  reusando `_resolveOwnerEmailToUid` de `pin-adjust.js`), guardado en
  `eventos/{eventoId}`, listado con toggle activo/inactivo y borrado.

**Archivos modificados:**
- `js/admin.js` — `switchTab()`: nueva entrada `'eventos-admin':
  'tp-eventos-admin'` en el mapa de tabs (sin esto la tab no se
  llega a mostrar nunca, ver `targets[t]` en la función). `startPickMode`/
  su `map._pickHandler`: nuevo contexto `'evento-pin'` (Camino B),
  agregado siguiendo el mismo patrón que `'zona'`, sin tocar los
  contextos existentes.
- `index.html` — nueva tab `➕` "🎉 Eventos" y su `tpane`
  (`#tp-eventos-admin`) completo: form de alta (nombre, descripción,
  categoría libre, fechas opcionales, toggle Camino A/B, buscador de
  pines, geocoder del Camino B, asignación manual, checkbox activo) +
  lista de eventos cargados; script `js/eventos.js` agregado después
  de `pin-geocode.js`.
- `css/base.css` — estilos nuevos: toggle Camino A/B
  (`.evt-camino-toggle`/`.evt-camino-btn`), filas de la lista de
  eventos (`.evt-admin-row*`), switch activo/inactivo
  (`.evt-admin-toggle`), link de asignación por mail
  (`.evt-asignado-click`) — reusan las variables de color/tipografía
  ya existentes, mismo lenguaje visual que `owner-panel-item`/`atab`.
- `FIRESTORE_RULES_NOTES.md` — nuevo bloque `match /eventos/{eventoId}`
  (lectura pública, escritura solo admins de verdad — mismo criterio
  que el resto de las colecciones del proyecto en esta etapa).

**Modelo de datos:** colección `eventos/{eventoId}` (id automático de
Firestore): `{ nombre, descripcion, categoria, fecha_inicio,
fecha_fin (ISO string o null), poi_id, creadorUid (null — admin-only
en esta etapa), usuarioAsignadoUid, activo (bool), estado
('aprobado'), creadoEn (serverTimestamp) }`. Pines nuevos del Camino
B llevan además `tipo: 'evento_temporal'` (solo marca de origen, sin
comportamiento automático todavía — eso es la Etapa 4).

**Decisiones confirmadas con Cris antes de programar:**
1. La pantalla de creación va solo en el panel Admin en esta etapa
   (OwnerPanel/UI pública quedan preparadas mentalmente, sin pantalla,
   hasta la Etapa 6).
2. El pin mínimo del Camino B se crea ya en esta etapa (no se espera
   a la Etapa 4) para que ese camino funcione de punta a punta.
3. El admin no tiene "pines propios" como un dueño de negocio, así
   que el Camino A no restringe la búsqueda; `usuarioAsignadoUid` se
   asigna a mano (UID pegado o resuelto por mail con click) mientras
   la creación siga siendo admin-only — a futuro (Etapa 6), cuando el
   dueño del evento lo cree con su propio usuario, el sistema lo va a
   autoasignar solo, sin tocar el modelo de datos de esta etapa.

**⚠️ Pendiente OBLIGATORIO de Cris antes de que esta etapa funcione:**
publicar en Firestore → Rules el bloque de `eventos` agregado a
`FIRESTORE_RULES_NOTES.md` (junto con el resto de las reglas ya
vigentes) — sin esto, la colección `eventos` queda bloqueada por
default y el guardado de un evento falla con error de permisos.

**Pruebas realizadas:** `node --check` sin errores en los `.js`
tocados/creados del proyecto; verificación automática de que todos
los `id` que usa `eventos.js` existen una sola vez en `index.html`
(sin duplicados ni faltantes); balance de llaves `{}` verificado en
`css/base.css`. No probado en navegador real ni contra Firebase real
(sin entorno con DOM/Firestore en esta sesión) — pendiente que Cris
lo pruebe en su entorno, después de publicar las reglas: (a) Camino
A — crear un evento anexado a un pin ya existente y confirmar que
aparece en la lista con el nombre del pin correcto, (b) Camino B —
crear un evento con un lugar nuevo y confirmar que el pin mínimo
aparece en el mapa y en la tab "Lugares" del admin, (c) asignar un
`usuarioAsignadoUid` por mail y confirmar que el UID resuelto es
correcto, (d) togglear activo/inactivo y borrar un evento desde la
lista, (e) confirmar que un pin creado por el Camino B no genera
ningún indicador visual extra sobre el pin en el mapa (eso es la
Etapa 5, a propósito no implementado acá).

---

### Etapa 4 — Ciclo de vida del pin `evento_temporal` (2026-08-26)

**Qué se hizo:** los pines creados por el Camino B de la Etapa 3
(`tipo: 'evento_temporal'`) ahora se auto-desactivan solos (nunca se
borran) cuando ya no les queda ningún evento vigente.

**Archivos modificados:**
- `js/eventos.js` — nueva función `checkEventosTemporalesLifecycle()`
  (expuesta en `window`), `_eventoEsVigente()`,
  `_autoDesactivarPinTemporal()`, `_reactivarPinTemporal()`; llamado
  agregado dentro de `_loadEventosAdminList()`; fila de la lista de
  eventos ahora muestra aviso + botón "🔓 Reactivar pin" cuando
  corresponde.
- `js/app.js` — paso nuevo en `init()` (3.5) que llama a
  `checkEventosTemporalesLifecycle()` antes de dibujar los
  marcadores.
- `js/markers.js` — **bug de fondo corregido** (no específico de
  eventos): `makeMarker()` ahora respeta `poi.active === false` al
  crear el marcador (antes solo se aplicaba togleando en vivo, nunca
  al dibujar por primera vez — ver aviso completo en "ESTADO
  ACTUAL").
- `css/base.css` — estilos de `.evt-admin-pin-off` /
  `.evt-admin-reactivar-pin`.

**Decisiones confirmadas con Cris antes de programar:**
1. Evento vigente = `activo === true` Y (sin `fecha_fin` o
   `fecha_fin` sin vencer). El toggle manual manda siempre.
2. La pregunta sobre en qué momento correr el chequeo no se llegó a
   confirmar (Cris no la entendió) — se optó por la combinación más
   robusta sin sobrecargar Firestore: al cargar el mapa público +
   cada vez que se abre la tab admin "Eventos".
3. La reactivación del pin es siempre manual por ahora — Cris fue
   explícito en que el sistema debe quedar "versátil" y sin nada
   hardcodeado que bloquee agregar más adelante la capa del sistema
   de pagos (mismo modelo de "capas de cebolla" que ya rige
   `fecha_inicio` de un evento).

**Pruebas realizadas:** `node --check` sin errores en los `.js`
tocados; balance de llaves verificado en `css/base.css`. No probado
contra Firebase real ni en navegador (sin entorno con DOM/Firestore
en esta sesión) — pendiente que Cris pruebe en su entorno: (a) cargar
un evento con `fecha_fin` ya pasada y `activo:true` sobre un pin
`evento_temporal` sin ningún otro evento vigente → recargar el mapa y
confirmar que el pin ya no aparece; (b) confirmar en Firestore que
ese pin quedó con `active:false` (no se borró); (c) desde la tab
Eventos, click en "🔓 Reactivar pin" y confirmar que vuelve a
aparecer en el mapa; (d) confirmar que un pin normal (no
`evento_temporal`) que hayas desactivado antes desde Lugares ahora sí
se ve oculto para una visita nueva/incógnito (antes de este fix no se
ocultaba para el público real — ver aviso en "ESTADO ACTUAL").

---

### Etapa 5 — Filtro de eventos en el mapa + tab pública del pin (2026-08-26)

**Qué se hizo:** el mapa público ahora tiene un filtro "Eventos y
actividades" (junto a los de categoría, sin badge sobre el pin) y el
panel público de un pin muestra sus eventos vigentes en una pestaña
propia dentro del mismo panel.

**Archivos modificados:**
- `js/config.js` — nueva variable global `EVENTOS` (caché en memoria
  de toda la colección `eventos`).
- `js/eventos.js` — `loadEventosFromFirestore()`,
  `loadEventosConfig()`, `_saveEventosConfig()`; `_loadEventosAdminList()`
  ahora sincroniza `EVENTOS` y llama a `applyFilter()` al final.
- `js/categories.js` — **bug de fondo corregido, no específico de
  eventos:** `applyFilter()` no existía en ningún archivo del
  proyecto pese a llamarse desde 4 archivos distintos — los filtros
  de categoría del mapa público no filtraban nada. Implementada de
  cero (`applyFilter()` + `_pinMatchesActiveFilter()`), más el chip
  nuevo "🎉 Eventos" (`data-f="__eventos__"`) en `updateFilterBar()`.
- `js/poi-panel.js` — sistema de 2 pestañas (Info/Eventos) en el
  panel público: `_ensureDom()` con el markup nuevo, `_setActiveTab()`,
  `_eventosVigentesDelPoi()`, `_renderEventosTab()`, `setEventosConfig()`
  (API pública nueva); `open()` resetea `_activeTab` a `'info'` en
  cada apertura.
- `js/app.js` — `init()` ahora carga `EVENTOS` y la config de eventos
  antes de dibujar los marcadores.
- `index.html` — bloque "CONFIGURACIÓN PÚBLICA" nuevo en la tab admin
  "Eventos" (rótulo editable de la pestaña pública).
- `css/base.css`, `css/poi-panel.css` — estilos nuevos.

**Decisiones confirmadas con Cris antes de programar:**
1. El filtro de eventos va junto a los de categoría existentes, no
   separado.
2. El panel público usa un sistema de 2 pestañas (mismo patrón que
   ya usa el panel admin) que se activa solo si el pin tiene ≥1
   evento activo en ese momento.
3. El pin genérico de evento va a pasar a usar imagen propia (subida
   por Cris) en vez del emoji — pendiente, es trabajo suyo, no de
   esta etapa.
4. El bug de `applyFilter()` ya se conocía y no era urgente, pero
   como esta etapa tocaba justo esa parte del código, Cris pidió
   arreglarlo de una vez.

**Pruebas realizadas:** `node --check` sin errores en los `.js`
tocados; balance de llaves verificado en `css/base.css` y
`css/poi-panel.css`; chequeo automático de que todos los
`getElementById` de `js/eventos.js` tienen su `id` correspondiente en
`index.html`. No probado contra Firebase real ni en navegador —
pendiente que Cris pruebe: (a) tocar cada filtro de categoría del
mapa público y confirmar que ahora sí filtra (antes no hacía nada);
(b) tocar el filtro "🎉 Eventos" y confirmar que solo quedan visibles
los pines con algún evento vigente ahora; (c) abrir un pin con un
evento vigente anexado y confirmar que aparece la pestaña "Eventos"
con la tarjeta correspondiente, y que un pin sin eventos vigentes se
ve exactamente igual que siempre (sin pestañas); (d) cambiar el
rótulo en "CONFIGURACIÓN PÚBLICA" y confirmar que se refleja en la
pestaña del panel.

---

### Etapa 6 — Edición de eventos + Panel de usuario unificado + Nombre único (2026-08-26)

**Contexto:** Cris trajo el proyecto completo (ZIP, hasta Etapa 5) +
`PLAN_PANEL_USUARIO_EDICION_EVENTOS_2026-08-26.md`, un plan aparte ya
revisado y con las 8 preguntas de diseño respondidas por chat en una
sesión anterior. Cubre 3 pedidos que reemplazan a la Etapa 6 original
(subusuario empleado se corrió a Etapa 8, sin cambios de contenido):
(1) hueco real — no había forma de editar un evento ya creado; (2)
panel de usuario con 3 solapas (Info/Pines/Eventos) para cualquier
cuenta logueada, no solo dueño de negocio; (3) nombre de evento único
por ciudad, mismo criterio que el ID de pines.

**Qué se hizo:**
- **Edición de eventos (admin):** el formulario de alta ahora sirve
  también para editar — botón "✏️ Editar" por fila en la tab admin
  "Eventos". Al editar aparecen 2 bloques nuevos que no se ven en el
  alta: la ciudad del evento (con el mismo doble candado que usa el
  ID de un pin) y el contador `cambiosRestantes` (el admin lo puede
  recargar a mano).
- **Contador de cambios habilitados:** cada evento nuevo nace con
  `cambiosRestantes` = `cambiosDefault` (configurable). Cada "Guardar
  cambios" de quien edita su propio evento (no el admin) resta 1, sin
  importar cuántos campos tocó — 1 sola escritura a Firestore
  (`FieldValue.increment(-1)` en el mismo `.update()`, no una
  escritura aparte). Llega a 0 → no puede seguir editando hasta que
  el admin se lo recargue.
- **Toggle maestro de autoservicio:** `creacionEventosHabilitada`
  (tab admin "Eventos" → "CONFIGURACIÓN GENERAL DE EVENTOS") — con
  esto apagado, nadie salvo el admin puede dar de alta un evento
  nuevo; no afecta a los ya creados.
- **Nombre de evento único por ciudad:** cada evento guarda su propio
  campo `city` (copiado del pin al que queda anexado al crearse) y
  `nombreSlug` (mismo criterio que el ID de pines: `_autoSlugBase`,
  guion entre palabras, filtra stopwords). El chequeo de duplicado es
  SOLO contra otros eventos con la misma `city` — nunca global. Vive
  como preview en vivo (no bloquea el tipeo) + bloqueo real al
  guardar.
- **Panel de usuario unificado** (`js/user-panel.js`, archivo nuevo):
  reemplaza al mini panel de cuenta (Etapa 1) y absorbe al panel del
  dueño de negocio (Etapa 2, `js/owner-panel.js`) como una solapa
  más, en un solo overlay con 3 tabs:
  - **Info:** igual que antes (nombre/rol/cerrar sesión).
  - **Pines:** SOLO para rol `dueno_negocio` — reusa tal cual la
    lista/editor de `js/owner-panel.js` (mismos ids de DOM,
    relocalizados en el HTML), sin reescribir su lógica interna.
  - **Eventos:** para CUALQUIER cuenta logueada. Lista "mis eventos"
    (`creadorUid == uid` O `usuarioAsignadoUid == uid`, 2 queries
    mergeadas porque Firestore no permite OR entre campos distintos).
    Si no tiene ninguno, botón "➕ Agregar evento" (oculto si el
    toggle maestro está apagado). El alta reusa Camino A/B igual que
    el admin; TODO evento creado acá nace `activo:false` — lo activa
    el admin a mano, sin excepción. La edición NUNCA toca el lugar/
    pin (solo nombre, descripción, categoría, fechas) — el punto
    sobre si la edición debería poder mover el pin del Camino B
    quedó sin definir con Cris (no bloqueante, anotado en el plan de
    origen) y se dejó afuera a propósito por eso.
- **Reglas de Firestore** (`FIRESTORE_RULES_NOTES.md`, colección
  `eventos`): se agregaron `allow create` (autoservicio, exige
  autoasignarse como creador Y asignado, y nacer `activo:false`) y
  `allow update` (creador o asignado, solo si `cambiosRestantes > 0`,
  el contador tiene que bajar en exactamente 1, y solo puede tocar
  los 6 campos de contenido — nunca `poi_id`/`city`/`activo`). El
  `allow write` del admin sigue cubriendo todo lo demás (incluido
  borrar, que el autoservicio no puede hacer). **Pendiente que Cris
  las pegue a mano en la consola de Firebase, como siempre.**
- `js/admin.js` — `startPickMode`/`stopPickMode` ahora soportan un
  5º contexto (`'user-evento-pin'`) para el Camino B del formulario
  de eventos del panel de usuario, que oculta/reabre el panel de
  usuario en vez del admin.

**Archivos modificados:** `index.html` (panel de usuario unificado
completo, sección "CONFIGURACIÓN GENERAL DE EVENTOS", bloques de
ciudad/cambios en el form admin), `css/base.css` (estilos del panel
unificado + edición/contador), `js/eventos.js` (config extendida,
`saveEvento()` create+update, helpers de nombre único/ciudad, `_evtStartEdit`,
`window.EventosShared`), `js/owner-panel.js` (se sacó el overlay
propio, expone `loadPins`/`backToList`), `js/user-auth.js` (el botón
de cuenta abre `UserPanel` en vez del mini panel viejo), `js/admin.js`
(pick mode nuevo contexto), `js/user-panel.js` (archivo nuevo),
`FIRESTORE_RULES_NOTES.md`.

**Decisiones confirmadas con Cris antes de programar** (registradas
en detalle en `PLAN_PANEL_USUARIO_EDICION_EVENTOS_2026-08-26.md`,
sección 3 — resumen acá):
1. Autoservicio bloqueable con un toggle admin único; independiente
   de eso, todo evento nace `activo:false` sin excepción — cuando
   llegue el sistema de pagos, la creación pasa a libre total.
2. Tab Pines SOLO para `dueno_negocio`; `usuario_comun` puede crear y
   administrar sus propios eventos, pero no tiene tab Pines.
3. Puede editar un evento: el admin, quien lo creó, o a quien el
   admin le haya puesto en `usuarioAsignadoUid`.
4. Contador de cambios: 1 "Guardar cambios" = 1 uso, sin importar
   cuántos campos se tocaron en esa pasada.
5. Nombre único: mismo criterio que el ID de pines (guion entre
   palabras).
6. Ciudad editable con doble candado, admin-only por ahora.
7. Choque de nombre duplicado: se avisa explícitamente.
8. 1 escritura por guardado, sin importar cuántos campos — ya era así
   en el alta original, se mantuvo el mismo criterio en la edición.

**Pruebas realizadas:** `node --check` sin errores en los 5 `.js`
tocados/nuevos (`eventos.js`, `owner-panel.js`, `user-auth.js`,
`admin.js`, `user-panel.js`); chequeo automático de que todos los
`getElementById(...)` usados en esos 5 archivos tienen su `id`
correspondiente en `index.html` (sin faltantes, tras corregir 1
referencia a un botón que se sacó del diseño final). No probado
contra Firebase real ni en navegador — **pendiente que Cris pruebe**:
(a) editar un evento desde el admin y confirmar que guarda bien y
que el contador de cambios se comporta como se espera; (b) con una
cuenta de prueba `usuario_comun`, crear un evento por autoservicio
(Camino A y Camino B) y confirmar que aparece en el admin como
`pendiente`/`activo:false`; (c) confirmar que el toggle
"Habilitar creación de eventos" realmente bloquea el botón "Agregar
evento" cuando está apagado; (d) intentar poner el mismo nombre de
evento 2 veces en la misma ciudad y confirmar el aviso; (e) que el
mismo nombre SÍ se puede usar en 2 ciudades distintas; (f) pegar las
reglas de Firestore nuevas en la consola antes de probar cualquier
guardado de usuario común, o van a fallar por permisos.

---

## DETALLE DE CADA ETAPA

### Etapa 1 — Roles base: registro/login
**Qué se hace:** habilitar en la app pública (no en el admin) registro
e inicio de sesión con email/contraseña y con Google, para 2 tipos de
cuenta: `usuario_comun` y `dueno_negocio`. Cada cuenta se guarda en
Firestore con un campo `rol`. El panel que ve cada uno es el mismo
componente de login/registro para ambos — lo que cambia después es
qué puede hacer una vez adentro, no cómo entra.

**Por qué va primero:** todo lo demás (eventos, pines propios,
empleados, premium) depende de que exista una cuenta con rol.

**Estimación:** 10-16hs (formularios de registro/login + Google
Sign-In + doc de perfil en Firestore + reglas de seguridad básicas
por rol).

---

### Etapa 2 — Panel del dueño de pin/negocio
**Qué se hace:** pantalla donde un usuario con rol `dueno_negocio` ve
la lista de pines que le pertenecen (campo `ownerId` en el pin) y
puede editar su propia info — sin acceso al resto del admin ni a
pines de otros dueños.

**Depende de:** Etapa 1.

**Estimación:** 12-18hs (reusa mucho de lo que ya existe en
`pin-adjust.js`/`admin.js`, pero filtrado y con permisos acotados).

---

### Etapa 3 — Colección `eventos` + moderación
**Qué se hace:** nueva colección `eventos` en Firestore, cada
documento con `poi_id` (vínculo al pin), `fecha_inicio`/`fecha_fin`,
`estado: pendiente/aprobado/rechazado`, datos del evento. El dueño
carga el evento desde su panel (Etapa 2); entra en `pendiente` hasta
que se aprueba (por ahora, aprobación manual desde el admin — no se
arma un panel de moderación separado a menos que haga falta).

**Depende de:** Etapa 1 y 2.

**Estimación:** 10-14hs.

---

### Etapa 4 — Pin genérico temporal
**Qué se hace:** si al cargar un evento el lugar no tiene pin
existente, el sistema crea uno con plantilla mínima (nombre +
ubicación por geocoder/click en mapa, categoría e ícono genéricos de
"Evento"), marcado `tipo: evento_temporal`. Reusa `saveNew()` de
`pin-adjust.js` con valores por defecto en vez de armar un flujo
nuevo. Se desactiva solo (no se borra) cuando todos sus eventos
vencen — así, si el mismo lugar se vuelve a usar, el pin ya existe.

**Depende de:** Etapa 3.

**Estimación:** 8-12hs.

---

### Etapa 5 — Filtro "Eventos y actividades" + Panel Eventos (pública) ✅ COMPLETADA
**Qué se hizo realmente** (la idea original de "badge visual sobre
el pin" quedó descartada — Cris pidió que la visibilidad se resuelva
solo con el filtro, sin ningún elemento superpuesto en el pin):
filtro transversal en la barra de filtros del mapa (junto a las
categorías, no es una categoría de pin más) que muestra cualquier
pin con ≥1 evento vigente ahora — incluye tanto los pines
`evento_temporal` de la Etapa 4 como pines normales con un evento
anexado por el Camino A. En el panel público de cada pin, sistema de
2 pestañas (Info / **Panel Eventos**) que solo aparece cuando
corresponde. De paso se corrigió `applyFilter()`, que llevaba rota
toda la vida del proyecto. Ver detalle completo en "REGISTRO POR
ETAPA" más arriba.

**Depende de:** Etapa 3 y 4.

---

### Etapa 6 — Edición de eventos + Panel de usuario unificado + Nombre único
**Qué se hizo:** ver detalle completo en "REGISTRO POR ETAPA" más
arriba — reemplaza al alcance original de esta etapa (el toggle de
autoservicio quedó cubierto acá; "subusuario empleado" se corrió a
la Etapa 8, sin cambios de contenido).

**Depende de:** Etapa 1, 2, 3 y 5.

**Estimación real:** ~32-45hs (coincide con lo estimado en
`PLAN_PANEL_USUARIO_EDICION_EVENTOS_2026-08-26.md`).

---

### Etapa 7 — Campos preparados para pagos (sin cobro automático)
**Qué se hace:**
- En la cuenta del dueño: campo `plan: free/premium` (no bloquea la
  cuenta, solo habilita funciones extra).
- Lista de "funciones premium" configurable desde el admin (toggles,
  sin hardcodear en el código cuáles son) — mismo principio que ya
  se usa en el proyecto para temas por sufijo (nada fijo de
  antemano, la config vive en Firestore).
- En cada evento: `destacado: true/false` + `destacado_hasta` — un
  mismo dueño puede tener varios eventos destacados a la vez, es
  por evento, no por cuenta.
- Por ahora estos campos se prenden/apagan a mano desde el admin
  (simulan lo que después haría un webhook de pago real).

**Depende de:** Etapa 1, 2 y 3.

**Estimación:** 4-6hs.

**Explícitamente fuera de esta etapa:** la integración real de cobro
(Checkout Pro para destacado puntual, Preapproval de Mercado Pago
para la suscripción mensual) — es trabajo aparte, se arranca cuando
haya organizadores reales usando el sistema.

---

### Etapa 8 — Subusuario empleado
**Qué se hace:** el dueño de negocio, desde su panel (Etapa 2, ahora
solapa "Pines" del panel unificado de la Etapa 6), da de alta
directamente una cuenta de empleado (email + contraseña, creada por
él, sin invitación por mail). Esa cuenta queda con `ownerId` (a qué
dueño pertenece) y `rol: empleado`, con permisos limitados a definir
(qué puede editar puntualmente queda pendiente de confirmar con Cris
antes de arrancar esta etapa).

**Depende de:** Etapa 1 y 2.

**Estimación:** 10-14hs.

**Nota:** Cris planteó como alternativa una sola cuenta con una
"contraseña interna" para gatillar funciones sensibles, en vez de
cuenta separada — quedó como opción más simple pero más débil
(no da registro de quién hizo qué, ni permite revocar acceso a un
empleado puntual sin cambiar la contraseña para todos). Confirmar
con Cris cuál de las dos versiones arrancar antes de esta etapa.

---

## TOTAL ESTIMADO (Etapas 1 a 8)
**94-137hs**, sin contar la integración real de cobro ni lo de
panaderías (ambos fuera de alcance de este plan por ahora).
