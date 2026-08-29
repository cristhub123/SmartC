# SmartCity — Plan de optimización de performance (actualizado 2026-08-29)

Reemplaza a `PLAN_OPTIMIZACION_PERFORMANCE.md` (2026-08-24). Se revisó contra
la instancia real actual del proyecto (zip completo) + reglas de Firestore
vigentes + una captura real de consola confirmando el bug en producción.
Adjuntar este documento (no el viejo) al retomar en otro chat.

---

## 1. Ya resuelto — no requiere más trabajo

- **`defer` en todos los scripts bloqueantes**: confirmado en `index.html`
  actual — los 44 scripts propios + Leaflet + los 3 SDK de Firebase-compat
  ya tienen `defer`.
- **Bug viejo de pines fantasma** (`pois-bootstrap.js`/`pois-loader.js`
  cargando desde `pois_cordoba.json`): desconectado, scripts comentados.
- **Resize/compresión de imágenes NUEVAS**: `f_auto,q_auto` ya se aplica al
  thumb 150x150 de `markers.js`, y el preset `smartcity_pines_01` ya tiene
  el límite `c_limit,w_1024,h_1024` como incoming transformation. Las
  subidas de acá en adelante ya salen livianas solas.

---

## 2. CAUSA PRINCIPAL de la lentitud actual — confirmada por consola real

**`init()` en `js/app.js` hace 7 llamadas a Firestore en cadena, una atrás
de la otra con `await`, en vez de en paralelo:**

1. `loadGlobalSettings()`
2. `loadMapSettings()`
3. `loadPOISFromFirestore()` — trae los pines **y además intenta escribir
   en `cache`** en cada carga
4. `loadFeaturesFromFirestore()`
5. `loadEventosFromFirestore()`
6. `checkEventosTemporalesLifecycle()`
7. `loadEventosConfig()`

Nada se dibuja en el mapa hasta que termina el paso 7. Los pasos 1, 2, 4 y 7
son independientes entre sí (leen documentos distintos de `settings`) y
podrían pedirse todos juntos. Los pasos 5 y 6 se sumaron con el sistema de
eventos — no existían en la versión más liviana de la página, lo que explica
por qué se siente más lenta ahora que antes.

**Encima, el paso 3 falla siempre y ese fallo también tarda.** Captura real
de consola en producción (2026-08-29):

```
Error regenerando el caché público: FirebaseError: Missing or insufficient permissions.
  regeneratePublicCache @ firestore-sync.js:120
  loadPOISFromFirestore @ firestore-sync.js:101
  init @ app.js:45
```

`loadPOISFromFirestore()` llama siempre a `regeneratePublicCache()`
(`firestore-sync.js:112`), que intenta escribir en la colección `cache`.
Las reglas de Firestore solo permiten esa escritura a admins — así que
**todo visitante público (sin sesión) dispara ese error en cada visita**,
y esa escritura rechazada también consume su propia ida y vuelta al
servidor antes de fallar, sumándose a la cadena de espera.

### Fix propuesto (bajo riesgo)

- Agrupar con `Promise.all()` los `await` de `init()` que no dependen entre
  sí (mínimo: pasos 1, 2, 4 y 7 en paralelo; evaluar si 5 también puede
  entrar ahí).
- Condicionar la llamada a `regeneratePublicCache()` dentro de
  `loadPOISFromFirestore()` para que solo se dispare si hay sesión de
  admin activa — nunca para un visitante público. Mismo criterio aplica a
  los otros puntos del código que llaman `regeneratePublicCache()` fuera
  de una acción de guardado real (crear/editar/borrar).

---

## 3. Otro hallazgo nuevo — headers de caché del hosting

`vercel.json` y `netlify.toml` fuerzan `Cache-Control: no-cache,
must-revalidate` en `/js/*` y `/css/*`. Cualquier visitante que vuelve
**revalida los ~780 KB de JS propio (44 archivos) y el CSS en cada visita**,
en vez de servirlos directo desde el caché del navegador.

### Fix propuesto

Cambiar a un `Cache-Control` con `max-age` razonable para JS/CSS. Ojo: como
hoy no hay build con hash de archivo (los nombres de los `.js` no cambian
entre versiones), un caché muy largo puede hacer que alguien vea una versión
vieja después de un cambio de código — conviene resolver esto junto con un
mecanismo simple de cache-busting (ej. un query string `?v=` que se
actualice a mano en cada entrega), no aislado.

---

## 4. Sigue pendiente, sin cambios desde el plan original

- **Sin paginar `pines`**: `db.collection('pines').get()` trae todo de una,
  sin `.limit()`. No urgente con ~11 pines de prueba, pero se agrava con
  cientos.
- Falta `preconnect` a Firebase/Cloudinary/mapas (menor).
- Falta `width`/`height` en imágenes de pines (menor, CLS).
- SDK de Firebase sigue en `-compat`, no modular — sigue siendo la
  migración de fondo, pesada, para el entorno paralelo.
- Imágenes viejas en `.png` (Plaza San Martín, "00000", Lotería,
  Capitolio, Museo Industria): no verificable desde el código, tarea
  manual en la consola de Cloudinary.

---

## Orden sugerido para retomar

1. **Ahora, bajo riesgo, sobre el proyecto real**: paralelizar el `init()`
   con `Promise.all` + condicionar `regeneratePublicCache()` a admin
   (sección 2) — es la causa más directa de la lentitud percibida hoy.
2. **Ahora, bajo riesgo**: ajustar `Cache-Control` de JS/CSS en
   `vercel.json`/`netlify.toml` con cache-busting simple (sección 3).
3. **Cuando haya tiempo, sin apuro**: entorno paralelo con Firebase nuevo
   para migrar el SDK a modular y paginar la carga de pines (sección 4) —
   solo urgente cuando se acerquen a varios cientos de pines reales.

## Cómo seguir testeando después de cada fix

- Volver a correr PageSpeed Insights (mobile) sobre
  `smart-c-eta.vercel.app` y comparar contra el 68/100 y LCP 8,4s de base.
- Abrir DevTools → Network con "Disable cache" tildado, recargar, y mirar
  la waterfall: después del fix de la sección 2 los pedidos a
  `firestore.googleapis.com` deberían aparecer superpuestos (en paralelo)
  en vez de uno atrás del otro, y no debería verse más el error
  "Missing or insufficient permissions" en consola para un visitante sin
  sesión.
- Confirmar en una segunda visita (F5 normal, sin "Disable cache") que los
  archivos `/js/*` y `/css/*` ya no se re-descargan de cero después del fix
  de la sección 3 (columna "Size" de Network debería decir algo como
  "(disk cache)" o "(memory cache)" en vez del peso real).
