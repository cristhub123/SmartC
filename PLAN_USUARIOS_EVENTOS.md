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

## ESTADO ACTUAL

**Última etapa completada:** Etapa 3 — Colección `eventos` (admin-only)
+ pin mínimo del Camino B (ver detalle en "REGISTRO POR ETAPA" más
abajo).

**Próxima etapa a hacer:** Etapa 4 — Pin genérico temporal: agregarle
al pin `tipo: evento_temporal` (ya creado desde la Etapa 3) el ciclo
de vida real (auto-desactivación cuando vencen todos sus eventos).

**Contexto nuevo de la Etapa 3 que hay que seguir usando (no crear de
nuevo):**
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
- [ ] Etapa 4 — Pin genérico temporal (cuando el lugar del evento no
      tiene pin todavía)
- [ ] Etapa 5 — Filtro "Eventos y actividades" en el mapa + badge
      sobre pin existente + estilo del pin temporal
- [ ] Etapa 6 — Subusuario empleado del dueño (alta directa sin
      invitación, permisos limitados)
- [ ] Etapa 7 — Campos preparados para pagos (sin cobro automático
      todavía): `plan` free/premium + funciones premium
      configurables + `destacado`/`destacado_hasta` por evento

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

### Etapa 5 — Filtro "Eventos y actividades" + badge visual
**Qué se hace:** filtro transversal en el mapa (no es una categoría
de pin más) que muestra: pines con al menos un evento activo hoy
(con un badge/indicador sobre el pin normal) + pines temporales de
Etapa 4. Estilo visual distinto para el pin temporal (ícono propio).

**Depende de:** Etapa 3 y 4.

**Estimación:** 8-12hs.

---

### Etapa 6 — Subusuario empleado
**Qué se hace:** el dueño de negocio, desde su panel (Etapa 2), da de
alta directamente una cuenta de empleado (email + contraseña,
creada por él, sin invitación por mail). Esa cuenta queda con
`ownerId` (a qué dueño pertenece) y `rol: empleado`, con permisos
limitados a definir (qué puede editar puntualmente queda pendiente
de confirmar con Cris antes de arrancar esta etapa).

**Depende de:** Etapa 1 y 2.

**Estimación:** 10-14hs.

**Nota:** Cris planteó como alternativa una sola cuenta con una
"contraseña interna" para gatillar funciones sensibles, en vez de
cuenta separada — quedó como opción más simple pero más débil
(no da registro de quién hizo qué, ni permite revocar acceso a un
empleado puntual sin cambiar la contraseña para todos). Confirmar
con Cris cuál de las dos versiones arrancar antes de esta etapa.

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

## TOTAL ESTIMADO (Etapas 1 a 7)
**62-92hs**, sin contar la integración real de cobro ni lo de
panaderías (ambos fuera de alcance de este plan por ahora).
