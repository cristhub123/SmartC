# ACLARACIONES_RELEVANTES — entrega 2026-09-17 (sliders desktop de tamaño de pin)

- **No se va a ver ningún cambio visual hasta que ajustes los sliders
  nuevos a mano.** Los defaults de "Tamaño de pins en el mapa (desktop)"
  y "Tamaño del edificio maximizado (desktop)" arrancan con el mismo
  valor que su par mobile, a propósito, para no romper nada al
  desplegar. Andá a la tab Global, movelos hasta que se vean bien en
  desktop, y tocá "Aplicar apariencia global" para que quede guardado en
  Firestore (si no tocás ese botón, el cambio se pierde al recargar).
- Cache-busting bumpeado a `?v=20260917` en los 3 `<script>` tocados
  (`admin-global.js`, `pin-adjust.js`, `roadmap.js`) para que no quede
  cacheada la versión vieja al desplegar.
- Pendiente de probar en navegador real (no se puede probar acá, solo se
  corrió `node --check` sobre los 3 `.js` para confirmar que no hay
  errores de sintaxis):
  1. Que el pin en mapa y el maximizado se vean bien en desktop tras
     ajustar los 2 sliders nuevos.
  2. Que el mobile sigue exactamente igual que antes de este cambio.
  3. Que al agrandar/achicar la ventana del navegador cruzando ~768px de
     ancho, el tamaño del pin en el mapa cambia solo, sin recargar la
     página.
- El breakpoint de 768px está hardcodeado en un solo lugar
  (`DESKTOP_BREAKPOINT_MQ` en `js/admin-global.js`) — si en algún
  momento querés ajustarlo, es ese único número el que hay que tocar.
- Quedó registrada en el Roadmap (`r34`) y en
  `PLAN_TAMANO_PIN_ADAPTATIVO.md` la idea de fondo que planteaste
  (tamaño como % del espacio libre de pantalla en vez de breakpoint
  fijo) — no se implementó ahora, es para retomar después del MVP.
