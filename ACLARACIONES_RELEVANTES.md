# Aclaraciones — entrega secciones 2 y 3 (PLAN_OPTIMIZACION_PERFORMANCE_2026-08-29.md)

## Archivo extra no listado en el plan: `index.html`

El plan (sección 3) proponía ajustar el `Cache-Control` de JS/CSS **junto
con** un mecanismo de cache-busting, pero no explicitaba qué archivo
implementaría ese cache-busting. Para que el `max-age` largo sea seguro
(que un cambio de código no quede "pegado" en el caché del navegador de
alguien), hacía falta versionar las URLs — eso solo se puede hacer en
`index.html`, donde están los `<script src="js/...">` y
`<link href="css/...">`. Se agregó `?v=20260829` a los 44 scripts propios
y a los 2 CSS locales (no se tocaron los links externos: Leaflet CDN,
Google Fonts).

**Para la próxima entrega de código** (cualquiera, no solo de este plan):
si se agrega o renombra un archivo `.js`/`.css`, hay que sumarle el mismo
`?v=` a su tag en `index.html`. Y si se quiere forzar que todos los
visitantes bajen el JS/CSS nuevo (no sigan sirviendo el viejo desde
caché), hay que subir ese número de versión — a mano, como dice el plan,
no hay build automático que lo haga.

## Sección 2 — implementado tal cual el plan, con un ajuste

- `init()` en `app.js`: se agrupó con `Promise.all` la carga de
  `loadGlobalSettings()`, `loadMapSettings()`, `loadFeaturesFromFirestore()`,
  `loadEventosConfig()` y `loadEventosFromFirestore()` — los 5 leen
  documentos/colecciones independientes entre sí, verificado leyendo cada
  función antes de moverla. `loadPOISFromFirestore()` quedó afuera del
  grupo (dispara el toast y es el dato más pesado) y
  `checkEventosTemporalesLifecycle()` sigue secuencial después, porque
  necesita el `EVENTOS` que carga `loadEventosFromFirestore()`.
- `regeneratePublicCache()` dentro de `loadPOISFromFirestore()` (el que
  corre en cada visita pública) ahora está condicionado a
  `_adminUser` (declarado en `js/admin-auth.js`, confirma sesión real
  contra `admins/{uid}`, no solo que haya algún login de Firebase Auth
  cualquiera).

## Hallazgo nuevo, fuera del alcance de esta entrega — para evaluar después

`checkEventosTemporalesLifecycle()` corre en **cada** carga de la app
(pública, sin sesión) y, si encuentra un pin `evento_temporal` sin ningún
evento vigente, llama a `_autoDesactivarPinTemporal()` — que hace
`savePoiToFirestore()` + `regeneratePublicCache()`, ambas escrituras que
(según el mismo modelo de permisos que causaba el bug de la sección 2)
muy probablemente fallan para un visitante sin sesión de admin. Queda
protegido con try/catch (revierte `pin.active` en memoria si falla), así
que no rompe nada visible — pero es el mismo patrón de error/latencia
para un visitante público, solo que disparado condicionalmente (únicamente
si hay algún pin de evento temporal vencido en ese momento) en vez de
siempre. No se tocó porque la solución correcta depende de una decisión
de arquitectura (¿debería esta auto-desactivación correr del lado del
cliente para cualquier visitante, o moverse a una Cloud Function
programada?) que no estaba definida en el plan actual.
