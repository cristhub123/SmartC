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

**Última etapa completada:** Etapa 1 — Roles base: registro/login de
usuario común y dueño de pin/negocio (ver detalle en "REGISTRO POR
ETAPA" más abajo).

**Próxima etapa a hacer:** Etapa 2 — Panel del dueño de pin/negocio
(ver y editar sus propios pines).

**Contexto que ya existe en el proyecto y hay que seguir usando (no
crear de nuevo):**
- `js/admin-auth.js` sigue siendo el login de administrador — no se
  tocó, sigue siendo su propio nivel separado.
- `js/user-auth.js` (nuevo, Etapa 1) — módulo `UserAuth`, expuesto en
  `window.UserAuth` con `getCurrentUser()`, `getCurrentUserProfile()`,
  `isLoggedIn()`, `hasRole(rol)`. La Etapa 2 debe leer el usuario
  logueado desde acá, no reimplementar el `onAuthStateChanged`.
- Colección Firestore `usuarios/{uid}` con `{ uid, email, nombre,
  rol, creadoEn }` — ya existe y se llena desde el registro público.
- Reglas de seguridad de Firestore para `usuarios`: sugeridas en
  `FIRESTORE_RULES_NOTES.md`, **todavía no confirmado si Cris ya las
  pegó en la consola de Firebase** — no asumir que están activas.
- Falta que Cris habilite el proveedor "Google" en Firebase Console →
  Authentication → Sign-in method, si todavía no lo hizo (el botón
  "Continuar con Google" ya está en el código, pero no funciona sin
  ese proveedor habilitado del lado de Firebase).

---

## PLAN GENERAL (checklist)

- [x] Etapa 1 — Roles base: registro/login de usuario común y dueño
      de pin/negocio (email/contraseña + Google)
- [ ] Etapa 2 — Panel del dueño de pin/negocio (ver y editar sus
      propios pines)
- [ ] Etapa 3 — Colección `eventos` vinculada a un pin existente +
      moderación (pendiente/aprobado)
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
