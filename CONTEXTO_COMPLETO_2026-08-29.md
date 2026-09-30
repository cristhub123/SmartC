# SmartCity — Contexto completo para retomar en otro chat
Generado 2026-08-29. Reemplaza cualquier resumen anterior de esta sesión.

---

## 1. Qué es este proyecto

SmartCity es una app de descubrimiento cultural y gastronómico de
Córdoba (mapa isométrico con Leaflet, pines ilustrados con IA, panel de
administración, sistema de dueños de negocio, eventos temporales,
importación masiva). Frontend vanilla JS (sin framework/build), backend
Firebase (Firestore + Auth, SDK `-compat`, no modular), imágenes en
Cloudinary. Deploy dual: Vercel y Netlify (`vercel.json` / `netlify.toml`).
URL de producción: `smart-c-eta.vercel.app`.

## 2. Cómo se llegó a esta sesión

1. Existía `PLAN_OPTIMIZACION_PERFORMANCE.md` (2026-08-24), diagnóstico
   inicial de lentitud.
2. Se generó `PLAN_OPTIMIZACION_PERFORMANCE_2026-08-29.md` (adjunto,
   reemplaza al del 24), revisado contra el zip real del proyecto +
   reglas de Firestore + una captura real de consola en producción.
   **Este documento sigue siendo la fuente de verdad del diagnóstico.**
3. En esta misma sesión (no hubo hand-off a otro chat como se planeó
   originalmente) se implementaron las secciones 2 y 3 completas del
   plan, y parte de la sección 4.

## 3. Cambios ya aplicados — YA ESTÁN EN PRODUCCIÓN si subiste los últimos
   ZIPs entregados (`smartcityV3.0_2026-08-29_2218.zip` y
   `smartcityV3.0_2026-08-29_2231.zip`)

### 3.1 — `js/app.js` — Sección 2 del plan: paralelizar `init()`

**Antes:** 7 `await` en cadena, uno atrás de otro. Nada se dibujaba en
el mapa hasta terminar el último.

**Ahora:** se agrupan con `Promise.all()` los 5 que leen documentos
independientes entre sí (`loadGlobalSettings`, `loadMapSettings`,
`loadFeaturesFromFirestore`, `loadEventosConfig`,
`loadEventosFromFirestore`). `loadPOISFromFirestore()` queda aparte
(dispara el toast "Cargando lugares..." y es el dato más pesado).
`checkEventosTemporalesLifecycle()` sigue secuencial después, porque
necesita el resultado de `loadEventosFromFirestore()`.

```diff
--- orig/js/app.js
+++ nuevo/js/app.js
@@ -15,12 +15,26 @@
    ═══════════════════════════════════════════ */

 async function init() {
-  // 0. Cargar configuraciones guardadas (apariencia global + estilo
-  //    de mapa) ANTES de aplicar nada — así se ve correcto desde el
-  //    primer instante, sin parpadeo, para cualquier persona que
-  //    abra la app, no solo para vos.
-  await loadGlobalSettings();
-  await loadMapSettings();
+  // 0. [2026-08-29 — PLAN_OPTIMIZACION_PERFORMANCE_2026-08-29.md, sección 2]
+  //    Antes esto era 7 `await` en cadena, uno atrás de otro, y nada se
+  //    dibujaba en el mapa hasta terminar el último. De esos 7, estos 5
+  //    leen documentos distintos e independientes entre sí (`settings/
+  //    appearance`, `settings/mapstyle`, `settings/features`, `settings/
+  //    eventos-config`, y la colección `eventos` completa) — no hace
+  //    falta esperarlos en fila, se piden todos juntos con Promise.all.
+  //    `loadPOISFromFirestore()` queda afuera de este grupo a propósito:
+  //    dispara el toast "Cargando lugares..." y es el dato más pesado/
+  //    visible, se mantiene aparte más abajo. `checkEventosTemporalesLifecycle()`
+  //    también queda afuera: necesita el resultado de `loadEventosFromFirestore()`
+  //    (la lista de EVENTOS) para poder correr, así que sigue secuencial,
+  //    después de este grupo.
+  await Promise.all([
+    loadGlobalSettings(),
+    loadMapSettings(),
+    typeof loadFeaturesFromFirestore === 'function' ? loadFeaturesFromFirestore() : Promise.resolve(),
+    typeof loadEventosConfig === 'function' ? loadEventosConfig() : Promise.resolve(),
+    typeof loadEventosFromFirestore === 'function' ? loadEventosFromFirestore() : Promise.resolve(),
+  ]);

   // 1. Aplicar el estilo de mapa ya cargado (o el default si es la
   //    primera vez que se usa la app y todavía no hay nada guardado)
@@ -43,25 +57,19 @@
   //    termine antes de dibujar los pines en el mapa.
   toast('⏳ Cargando lugares...');
   await loadPOISFromFirestore();
-  await loadFeaturesFromFirestore();

-  // 3.5. [Etapa 4/5 — PLAN_USUARIOS_EVENTOS.md] carga la colección
-  // `eventos` en memoria (EVENTOS, ver js/config.js), revisa el ciclo
-  // de vida de los pines `tipo: 'evento_temporal'` (auto-desactiva los
-  // que ya no tienen ningún evento vigente, sin borrarlos) y carga el
-  // título configurable de la pestaña "Eventos" del panel público.
-  // Todo esto ACÁ, antes del forEach de abajo, para que un pin recién
-  // auto-desactivado nazca ya oculto sin parpadeo — ver detalle
-  // completo en js/eventos.js.
-  if (typeof loadEventosFromFirestore === 'function') {
-    await loadEventosFromFirestore();
-  }
+  // 3.5. [Etapa 4/5 — PLAN_USUARIOS_EVENTOS.md] revisa el ciclo de vida
+  // de los pines `tipo: 'evento_temporal'` (auto-desactiva los que ya no
+  // tienen ningún evento vigente, sin borrarlos) usando el EVENTOS ya
+  // cargado en el Promise.all de arriba. Todo esto ACÁ, antes del
+  // forEach de abajo, para que un pin recién auto-desactivado nazca ya
+  // oculto sin parpadeo — ver detalle completo en js/eventos.js.
+  // [2026-08-29] `loadFeaturesFromFirestore()`, `loadEventosFromFirestore()`
+  // y `loadEventosConfig()` ya se resolvieron arriba, en paralelo — no
+  // se vuelven a llamar acá.
   if (typeof checkEventosTemporalesLifecycle === 'function') {
     await checkEventosTemporalesLifecycle(typeof EVENTOS !== 'undefined' ? EVENTOS : undefined);
   }
-  if (typeof loadEventosConfig === 'function') {
-    await loadEventosConfig();
-  }

   // 4. Build all markers
   // [2026-08-15] try/catch por-POI agregado como defensa adicional: un
```

### 3.2 — `js/firestore-sync.js` — Sección 2 del plan: `regeneratePublicCache()` solo para admin

**Antes:** `loadPOISFromFirestore()` (corre en CADA carga de la app,
incluso para un visitante público sin sesión) llamaba siempre a
`regeneratePublicCache()`, que intenta escribir en la colección `cache`
— las reglas de Firestore solo permiten esa escritura a admins. Todo
visitante público disparaba `FirebaseError: Missing or insufficient
permissions` en consola (confirmado con captura real en producción), y
esa escritura rechazada sumaba su propia ida y vuelta al servidor antes
de fallar.

**Ahora:** esa llamada queda condicionada a que haya una sesión de admin
real y verificada activa (`_adminUser`, declarado en `js/admin-auth.js`
— confirma contra la colección `admins/{uid}`, no solo que haya algún
login de Firebase Auth cualquiera).

```diff
--- orig/js/firestore-sync.js
+++ nuevo/js/firestore-sync.js
@@ -98,7 +98,19 @@
     POIS = loaded;
     syncAppStateWithPOIS(); // [NUEVO 2026-08-13] ver nota arriba
-    await regeneratePublicCache(); // autosana el caché en cada carga
+    // [2026-08-29 — PLAN_OPTIMIZACION_PERFORMANCE_2026-08-29.md, sección 2]
+    // Esta función corre en CADA carga de la app, para cualquier
+    // visitante público sin sesión — pero `regeneratePublicCache()`
+    // escribe en la colección `cache`, que las reglas de Firestore solo
+    // permiten escribir a admins. Antes esto se llamaba siempre: todo
+    // visitante público disparaba un error "Missing or insufficient
+    // permissions" en consola (confirmado con captura real en
+    // producción) y esa escritura rechazada también sumaba su propia
+    // ida y vuelta al servidor antes de fallar. Ahora solo se llama si
+    // hay una sesión de admin real y verificada activa (`_adminUser`,
+    // ver js/admin-auth.js — ya confirma contra `admins/{uid}`, no
+    // solo que haya alguna sesión de Firebase Auth cualquiera).
+    if (typeof _adminUser !== 'undefined' && _adminUser) {
+      await regeneratePublicCache(); // autosana el caché, solo con sesión de admin real
+    }
     return true;
```

### 3.3 — `vercel.json` / `netlify.toml` — Sección 3 del plan: `Cache-Control` de JS/CSS

**Antes:** `Cache-Control: no-cache, must-revalidate` en `/js/*` y
`/css/*` — cualquier visitante que vuelve revalida los ~780 KB de JS
propio + CSS en cada visita.

**Ahora:** `Cache-Control: public, max-age=31536000, immutable`. Esto
es seguro porque cada `<script>`/`<link>` en `index.html` ahora lleva
`?v=20260829` (ver punto 3.4) — un cambio de código futuro = URL
distinta = nunca sirve el archivo viejo desde caché.

`vercel.json` completo (nuevo):
```json
{
  "headers": [
    {
      "source": "/js/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/css/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ]
}
```

`netlify.toml` — el bloque `for = "/*"` con `Cache-Control = "no-cache"`
NO se tocó (fuera del alcance del plan); solo cambiaron los bloques
`/js/*` y `/css/*`:
```diff
 [[headers]]
   for = "/js/*"
   [headers.values]
-    Cache-Control = "no-cache, must-revalidate"
+    Cache-Control = "public, max-age=31536000, immutable"

 [[headers]]
   for = "/css/*"
   [headers.values]
-    Cache-Control = "no-cache, must-revalidate"
+    Cache-Control = "public, max-age=31536000, immutable"
```

### 3.4 — `index.html` — Sección 3 (cache-busting) + Sección 4 "menor" (preconnect)

**Cache-busting (necesario para que 3.3 sea seguro, no estaba en la
lista original de archivos a tocar — se avisó en su momento):** los 44
`<script src="js/...">` propios y los 2 `<link href="css/...">` locales
ahora llevan `?v=20260829`. No se tocaron los externos (Leaflet CDN,
Google Fonts, Firebase SDK de gstatic).

**Para la próxima entrega de código** (cualquiera, no solo de este
plan): si se agrega/renombra un `.js`/`.css`, hay que sumarle el mismo
`?v=` a su tag en `index.html`. Para forzar que todos los visitantes
bajen JS/CSS nuevo (no sigan sirviendo el viejo desde caché de un año),
hay que subir ese número de versión a mano — no hay build automático.

**Preconnect (sección 4, ítem "menor"):** agregado en el `<head>`:
```html
<link rel="preconnect" href="https://res.cloudinary.com">
<link rel="preconnect" href="https://firestore.googleapis.com" crossorigin>
<link rel="preconnect" href="https://identitytoolkit.googleapis.com" crossorigin>
<link rel="preconnect" href="https://tile.openstreetmap.org">
```
(Cloudinary sirve la imagen de cada pin; Firestore son las lecturas de
`app.js`; identitytoolkit es Firebase Auth, que corre en cada carga vía
`onAuthStateChanged`; tile.openstreetmap.org es el proveedor de tiles
por default — `TILE_PRESETS[0]` en `js/map-settings.js`. Si se cambia
el estilo de mapa a otro preset, este preconnect deja de aplicar a ese
dominio nuevo, sin romper nada.)

## 4. Revisado y descartado — no se tocó, no hacía falta

El plan (sección 4) decía "Falta `width`/`height` en imágenes de pines
(menor, CLS)". Se revisó el CSS real y **ya estaba resuelto sin
saberlo**:
- `.pin-img` (ícono de cada pin en el mapa): `width: 44px; height: 44px`
  ya fijo en `css/base.css`.
- `.poi-panel__hero-image` (foto grande del panel al abrir un pin): vive
  dentro de `.poi-panel__hero`, que ya tiene `height: 180px` fijo y
  `width: 100%` en `css/poi-panel.css`.
En ambos casos el contenedor ya reserva su tamaño por CSS antes de que
la imagen cargue — agregar los atributos HTML no iba a cambiar nada.

## 5. Hallazgo nuevo, NO corregido — mismo patrón de bug que 3.2, en otro lugar

`checkEventosTemporalesLifecycle()` corre en cada carga pública de la
app y, si encuentra un pin `evento_temporal` sin ningún evento vigente,
llama a `_autoDesactivarPinTemporal()` (en `js/eventos.js`) — que hace
`savePoiToFirestore()` + `regeneratePublicCache()`, ambas escrituras que
muy probablemente fallan para un visitante sin sesión de admin (mismo
modelo de permisos que causaba el bug de 3.2). Está protegido con
try/catch (revierte `pin.active` en memoria si falla), así que no rompe
nada visible, pero es el mismo patrón de error/latencia para un
visitante público — solo que condicional (únicamente si hay algún pin
de evento temporal vencido en ese momento). No se tocó: la solución
correcta depende de una decisión de arquitectura (¿esta
auto-desactivación debería correr del lado del cliente para cualquier
visitante, o moverse a una Cloud Function programada?) que no está
definida en el plan actual.

## 6. Pendiente de la sección 4 — necesita decisión/entorno de Cris antes de tocar código

### 6.1 — Paginar `pines`
`db.collection('pines').get()` trae todo de una, sin `.limit()`. No
urgente con ~11 pines de prueba, se agrava con cientos. El mapa hoy
espera tener TODOS los pines en memoria antes de dibujar nada
(clustering, filtros por categoría/zona, buscador — todo corre sobre el
array `POIS` completo). Antes de tocar esto hay que decidir la lógica:
(a) cargar por viewport/zoom del mapa, (b) botón "cargar más" manual,
o (c) un límite fijo alto (ej. 200) como piso de seguridad sin cambiar
el resto de la lógica. Cada opción toca código distinto
(`firestore-sync.js`, `cluster.js`, `zones.js`, el buscador).

### 6.2 — Migración del SDK de Firebase de `-compat` a modular
El plan pide hacerla en un **entorno paralelo**, no directo sobre el
proyecto real — cambia cómo se inicializa Firebase y la sintaxis de
cada llamada a Firestore/Auth en ~15 archivos, con riesgo real de
romper producción si se hace de una. Hace falta que Cris arme ese
entorno paralelo (un proyecto de Firebase nuevo, o al menos una copia
del actual para probar) antes de que se pueda avanzar con esto.

### 6.3 — Imágenes viejas en `.png`
Plaza San Martín, "00000", Lotería, Capitolio, Museo Industria — no
verificable ni corregible desde el código, es una tarea manual de Cris
en la consola de Cloudinary (convertirlas a WebP).

## 7. Cómo verificar que 3.1–3.4 funcionan en producción (del plan original)

- Correr PageSpeed Insights (mobile) sobre `smart-c-eta.vercel.app` y
  comparar contra el 68/100 y LCP 8,4s de base (medidos antes de estos
  fixes).
- DevTools → Network con "Disable cache" tildado, recargar: los pedidos
  a `firestore.googleapis.com` deberían aparecer superpuestos (en
  paralelo) en vez de uno atrás del otro, y no debería verse más el
  error "Missing or insufficient permissions" en consola para un
  visitante sin sesión.
- Segunda visita (F5 normal, SIN "Disable cache"): los archivos `/js/*`
  y `/css/*` no deberían re-descargarse de cero (columna "Size" de
  Network debería decir "(disk cache)" o "(memory cache)").

## 8. Instrucciones de trabajo para el próximo chat/AI

- **Archivo de diagnóstico de referencia:** `PLAN_OPTIMIZACION_PERFORMANCE_2026-08-29.md`
  (adjunto junto a este documento) — sigue siendo válido para las
  secciones 4, 5 y 6 de acá. Las secciones 2 y 3 del plan YA ESTÁN
  hechas (ver punto 3), no hay que repetirlas.
- **No asumir que hay que tocar código todavía en 6.1/6.2** — están
  bloqueados por decisiones/entorno de Cris, hay que preguntarle antes.
- **Entregas de código:** ZIP por etapa, solo con los archivos
  modificados de esa etapa (nunca el proyecto entero) + esta misma
  estructura de carpetas que tiene la app real (ej. un `.js` va dentro
  de una carpeta `js/`, aunque sea el único archivo del ZIP). Sumar
  siempre un `ACLARACIONES_RELEVANTES.md` con lo relevante para
  retomar. Nomenclatura del ZIP: `smartcityV3.0_AAAA-MM-DD_HHMM.zip`.
- **Al entregar el ZIP final de una tanda de trabajo:** solo los
  archivos, sin comentario extra — salvo que algo del plan que Cris
  pidió se haya modificado en la ejecución (como el caso de `index.html`
  en el punto 3.4), ahí sí avisar qué cambió y por qué.
