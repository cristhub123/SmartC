PLAN_TIMEZONE_CIUDADES.md
Creado: 2026-09-05
Estado: PENDIENTE — sin arrancar (parte 1, la de lectura, ya se
resolvió como parte del fix del filtro de fecha de eventos; ver
"QUÉ YA SE HIZO" más abajo).

═══════════════════════════════════════════════════════════
PEDIDO ORIGINAL DE CRIS (texto textual, solo corregida
ortografía/puntuación)
═══════════════════════════════════════════════════════════
"Para esto y cualquier otro cambio relacionado a fechas y horas,
¿vamos a establecer como estándar que se respete el horario de la
ciudad establecida, que de alguna forma se conecte a internet? (Como
sea que se haga en este tipo de páginas y apps), porque cuando
establezcamos otras ciudades, otros horarios, por ejemplo Chile, la
hora es diferente... No sé si es buena idea implementarlo ahora o
no. Si es conveniente y simple, hagámoslo ahora, pero primero
investigá cómo es lo óptimo."

═══════════════════════════════════════════════════════════
CONTEXTO — de dónde sale esto
═══════════════════════════════════════════════════════════
Surgió mientras se diagnosticaba un bug real del filtro de fecha de
eventos (js/eventos-fecha-filtro.js): los pines con evento activo ese
día no llegaban a opacidad completa. La causa era que el código
comparaba fechas recortando a mano los primeros 10 caracteres del
string UTC guardado (`ev.fecha_inicio`/`fecha_fin`, que se guardan
como ISO en UTC vía `new Date(v).toISOString()`), asumiendo que esos
10 caracteres ya eran el día local. Como Córdoba es UTC-3, un evento
cargado de noche (ej. 21hs en adelante) cruza la medianoche al
convertirse a UTC y el string quedaba "un día después" del real —
el match fallaba y el pin quedaba atenuado en vez de a opacidad
completa.

Cris preguntó, a raíz de esto, si conviene establecer ya un estándar
para que TODA fecha/hora del proyecto respete el huso horario de la
ciudad correspondiente (pensando en que a futuro va a haber más
ciudades con husos distintos — el ejemplo que dio fue Chile), en vez
de ir resolviendo esto caso por caso.

═══════════════════════════════════════════════════════════
INVESTIGACIÓN — cómo se resuelve esto en la industria
═══════════════════════════════════════════════════════════
- Estándar: guardar SIEMPRE la fecha/hora en UTC en la base (esto ya
  se hace acá) + guardar en cada ubicación (ciudad) un identificador
  de huso horario de la base IANA (ej. `America/Argentina/Cordoba`,
  `America/Santiago`) — no un offset fijo tipo "-3", porque eso se
  rompe con el horario de verano en los países que lo tienen (Chile
  lo tuvo históricamente, puede volver a tenerlo).
- Para saber "¿qué día es este evento en su ciudad?" o para
  mostrarle una hora a alguien, se convierte el UTC guardado usando
  el huso de LA CIUDAD DEL EVENTO — nunca el del dispositivo de quien
  mira la pantalla. Así el resultado es el mismo sin importar desde
  dónde se abra la página.
- Herramienta evaluada: la Temporal API (el reemplazo moderno de
  `Date`, pensado justo para esto) — descartada por ahora: Chrome,
  Edge y Firefox ya la soportan, pero Safari todavía no la tiene
  disponible sin flag, y la app se usa desde el celular, así que no
  es segura sin agregar un polyfill aparte.
- Herramienta elegida: `Intl.DateTimeFormat` con la opción `timeZone`
  — nativa, soportada en todos los navegadores relevantes desde hace
  años, sin dependencias nuevas, y maneja sola el horario de verano
  (no hace falta programar esas reglas a mano).

═══════════════════════════════════════════════════════════
QUÉ YA SE HIZO (esta entrega, ZIP smartcityV3.0_fix-filtro-fecha-eventos_2026-09-05_1247)
═══════════════════════════════════════════════════════════
Lado LECTURA — con qué día compara el filtro y qué día le mostramos
al usuario. Resuelto en js/eventos-fecha-filtro.js:
- Nueva función `_diaCalendarioEnHuso(str, tz)`: dado un string de
  fecha (con hora en UTC, o un 'YYYY-MM-DD' sin hora), devuelve el
  día calendario 'YYYY-MM-DD' en el huso horario `tz` usando
  `Intl.DateTimeFormat`. Un 'YYYY-MM-DD' sin hora (el que manda el
  selector de fecha del filtro) se devuelve tal cual, sin convertir
  — ya es un día elegido a propósito, no una marca de tiempo.
- `_eventoOcurreEnFecha(ev, fechaStr, tz)` y `pinTieneEventoEnFecha
  (poiId, fechaStr, tz)` ahora reciben `tz` como parámetro OPCIONAL
  — si no se pasa, usan `CIUDAD_TIMEZONE_DEFAULT` ('America/
  Argentina/Cordoba'), pero la función ya está lista para recibir el
  huso real de otra ciudad el día que haga falta, sin tener que
  tocar esta parte de nuevo.
- Nadie llama todavía a estas funciones pasando un `tz` explícito
  (ni js/pin-visibility.js ni js/poi-panel.js) — por eso hoy todo
  sigue funcionando como si solo existiera Córdoba. Eso es
  justamente lo que falta (ver abajo).

TAMBIÉN en esta entrega (bug aparte, no de huso horario): se corrigió
que la sección "Filtro de fecha de eventos" del admin no guardaba
nada — el plugin que conecta el toggle/opacidad con Firestore
(`SC.registerTabPlugin`) había quedado registrado para el tab 'mapa'
después de que el HTML se moviera al tab 'eventos-admin'. Ver
CAMBIOS_*.txt de esta entrega para el detalle completo de ambos
fixes.

═══════════════════════════════════════════════════════════
QUÉ FALTA — lado ESCRITURA + soporte real multi-ciudad
═══════════════════════════════════════════════════════════
Sin arrancar. Se decidió postergarlo porque hoy toda la carga es de
Córdoba (sin beneficio real todavía) y porque el lado lectura ya
quedó armado de forma versátil (recibe `tz`, no hardcodeado). Cuando
se sume una ciudad con huso distinto, hace falta:

1. Campo nuevo `timezone` en la colección `locations` (Firestore) —
   identificador IANA (ej. `America/Santiago`), cargado a mano por el
   admin en la tab "🌎 Ubicaciones", mismo patrón que `cityCode`/
   `citySuffix` que ya existen ahí. Sin este campo, todo el resto de
   este plan no tiene de dónde leer el huso de cada ciudad.

2. Plumbing del lado LECTURA (rápido, la función ya está lista): en
   `js/pin-visibility.js` (`applyPinVisibility`) y en
   `js/poi-panel.js` (`_eventosVigentesDelPoi`/`_renderEventosTab`),
   buscar el huso de la ciudad del pin (`poi.city`/`poi.province`/
   `poi.country` → lookup en `locations` → `timezone`) y pasarlo como
   tercer argumento a `pinTieneEventoEnFecha`/`_eventoOcurreEnFecha`
   en vez de dejar que caigan en el default. Necesita tener el mapa
   de ubicaciones→huso ya cargado en memoria en el arranque (mismo
   lugar donde hoy se cargan `_locations` en cities.js).

3. Lado ESCRITURA (la parte más delicada, sin resolver todavía): hoy
   `_dateInputToIso()` (js/eventos.js) toma el valor del input
   `datetime-local` y hace `new Date(v).toISOString()` — JS interpreta
   ese valor como si fuera la hora local del NAVEGADOR de quien está
   cargando el evento, no la hora de la ciudad del evento. Mientras
   Cris cargue siempre eventos de Córdoba estando en Córdoba, coincide
   y no se nota. El día que cargue (o edite) un evento de otra ciudad
   estando físicamente en otro huso, la hora guardada va a quedar mal.
   Fix: nueva función que, dado el valor tipeado (interpretado como
   "hora de pared" en el huso de la CIUDAD del evento, no el del
   navegador) devuelva el ISO UTC correcto. Con `Intl.DateTimeFormat`
   esto se resuelve calculando el offset real de ese huso para la
   fecha en cuestión (contempla horario de verano solo) y ajustando —
   es un cálculo un poco más fino que el de lectura, conviene armarlo
   con varios casos de prueba (eventos cerca de medianoche, con y sin
   horario de verano activo en la ciudad de destino).

4. Mostrar al público la fecha/hora del evento también en el huso de
   la ciudad del pin (hoy `_renderEventosTab` usa
   `.toLocaleDateString('es-AR', ...)` sin `timeZone`, que cae en el
   huso del navegador de quien mira el mapa — mismo tipo de bug que
   el de lectura ya resuelto, pero para el TEXTO que ve el visitante,
   no para el matching del filtro). Ajustar para que pase el `timeZone`
   de la ciudad del pin a `toLocaleDateString`.

Estimación de la parte pendiente (2-4 completos): ~1,5-2hs, entre el
campo nuevo + el cálculo de conversión de escritura + probarlo bien
contra casos de horario de verano.

═══════════════════════════════════════════════════════════
PRÓXIMO PASO EXACTO
═══════════════════════════════════════════════════════════
Ninguno todavía — este plan queda guardado para cuando Cris confirme
que se suma una ciudad con huso horario distinto a Córdoba, o pida
arrancarlo antes por otro motivo.
