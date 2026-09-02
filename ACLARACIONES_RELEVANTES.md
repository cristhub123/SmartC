# Aclaraciones — entrega 2026-09-02_0347

## Lo que se hizo
1. **Botón huérfano eliminado** (`index.html`): había un `<button>✕ Cerrar</button>` + un `</div>` de cierre sin ningún `<div>` que lo abriera, al principio de `<body>`. En el test de WebPageTest con latencia real, ese botón suelto llegó a ser detectado como el elemento LCP a los ~5s. Se borró el fragmento completo.
2. **`fetchpriority="low"` en los 3 scripts de Firebase (CDN)**: le dice al navegador que baje la prioridad de red de esos archivos frente al mapa/Leaflet, sin cambiar en qué orden se EJECUTAN (siguen siendo `defer`, siguen corriendo en el mismo orden de siempre) — cero riesgo funcional.

## Lo que NO se hizo, y por qué (desvío del plan original)
El plan original hablaba de "cargar Firebase Auth solo cuando alguien haga login" para ahorrar los 236 KB (`auth-compat.js` + `firestore-compat.js` + el `iframe.js` de OAuth de 95 KB que Firebase carga solo). Investigando el código encontré que esto **no se puede hacer así sin romper una función que ya existe**:

- `js/user-auth.js` y `js/admin-auth.js` llaman `firebase.auth().onAuthStateChanged(...)` de forma incondicional, apenas cargan — es lo que hoy detecta automáticamente si ya había una sesión iniciada (usuario o admin) y actualiza el botón del header sin que la persona toque nada. Si difiero la carga de Auth hasta el click en "Ingresar", esa detección automática de sesión existente se rompe.
- El `iframe.js` de 95 KB no lo carga código del proyecto (no hay ningún `signInWithRedirect`/`getRedirectResult` en el código) — lo carga el propio SDK de Firebase Auth apenas se llama `firebase.auth()`, sea que se use popup/redirect o no. Es un comportamiento interno del SDK, no algo mal usado en el proyecto.

Por eso el ahorro real de esos 236 KB solo se puede lograr con un cambio más profundo (por ejemplo: mostrar el header en estado "sin sesión" al toque, y recién confirmar/corregir a "con sesión" una vez que Auth termine de cargar en segundo plano — un patrón de hidratación progresiva). Es un cambio de comportamiento visible (aunque sea por una fracción de segundo) y toca 2 archivos que forman parte del sistema de login real, así que no lo hice sin consultarlo primero — es justamente el tipo de cambio que Cris pidió que se consulte antes de tocar.

## Pendiente real, sin arrancar
- Autorizar el dominio `smart-c-eta.vercel.app` en Firebase Console → Authentication → Settings → Authorized domains (esto lo tiene que hacer Cris a mano, no es código)
- Evaluar si vale la pena el cambio de "hidratación progresiva" del login para ahorrar los 236 KB del camino crítico de carga (pendiente de decisión de Cris)
