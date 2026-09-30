# ACLARACIONES_RELEVANTES — entrega 2026-09-30 (tarjeta Polaroid + vista ampliada de evento)

## Decisiones que tomé yo — confirmá o cambialo
- **Tocar una tarjeta en "Todos los eventos" ya no abre el lugar:** abre la vista ampliada, y el viaje al lugar quedó en el botón "Ver el lugar" de esa vista. Si preferís lo de antes, avisame.
- **Los dos recuadros (días y horario) van del mismo color** (verde/rojo), porque el horario depende del mismo día.
- **La tarjeta ya no muestra** tags, dirección ni contactos: pasaron a la vista ampliada. En la tarjeta quedan foto, nombre, descripción corta, recuadros y entrada.
- **El horario se muestra tal cual lo escribió quien cargó el evento** (`horario` es texto libre): si escribió "15 a 22hs", sale así en el recuadro.
- **No agregué el gris/desaturado del mockup** para eventos que no coinciden: ya existe la opacidad reducida del filtro de fecha (Admin → Eventos) y, sin filtro, casi todo sería gris.
- El botón "Reservar Ticket" del mockup no existe acá (no hay reservas): lo reemplazan "Ver en el mapa" y, en "Todos", "Ver el lugar".
- El mes ahora se abrevia en el idioma activo (3 letras); antes el formato de fecha estaba fijo en es-AR.

## Sin probar en real (pendiente que confirmes)
Probado en Chromium con una página de prueba (CSS/JS reales del proyecto), NO con Firebase, Leaflet real, ni celular real: (a) verde/rojo con la fecha de hoy, con un día del filtro y con un rango; (b) la vista ampliada se desliza bien sobre el panel real en vertical y en modo lateral (horizontal); (c) "Volver" devuelve el panel al tamaño que tenía; (d) "Ver en el mapa" y "Ver el lugar"; (e) skin oscuro (`neobrutal-night`); (f) ES/EN/PT.

## Cache-busting
`?v=20260930` en `poi-panel.css`, `evento-card.js`, `poi-panel.js`, `eventos-todos.js` e `i18n.js`.

---

# (entrega anterior)

# ACLARACIONES_RELEVANTES — entrega 2026-09-29 (Etapa 15: panel "Todos los eventos")

## Para los próximos pasos
- **Dónde va el botón — lo decidí yo, confirmá o cambialo:** botón "Todos"
  en la esquina de Eventos, al lado de "Fecha". Si preferís otro lugar,
  el panel se abre siempre con `PoiPanel.openTodosEventos()`: alcanza con
  llamar eso desde el botón nuevo (y sacar `_buildTodosSubBtn` de
  `js/categories.js`).
- **Switch nuevo en Admin → Funciones 🔧:** "Panel Todos los eventos"
  (encendido por defecto). Apagado, la esquina de Eventos solo lleva
  "Fecha"; si además el filtro de fecha está apagado, tocar "Eventos"
  filtra normal sin abrir nada.
- **Desvío del plan:** dentro de "Todos", en pantalla vertical, el 📍 de
  una tarjeta centra el mapa y baja el panel a "peek" (si no, el pin
  quedaba detrás del panel). En el panel de un lugar el 📍 sigue igual.
- **Búsqueda con fecha pasada:** el panel "Todos" lista los eventos que
  ocurren ese día/rango aunque ya hayan vencido (igual que el filtro del
  mapa), pero la pestaña "Eventos" de un lugar solo muestra vigentes:
  al tocar una tarjeta vencida, el lugar abre en "Info".
- Con el panel en "full" en celular vertical, la barra de filtros queda
  tapada (pasa con cualquier lugar abierto): para cerrar "Todos" se
  arrastra hacia abajo o se toca el mapa.

## Sin probar en real (pendiente que confirmes)
Probado en Chromium con los archivos reales y datos de prueba, pero NO en
celular real, ni con Firebase, ni con Leaflet real: (a) el botón "Todos"
se ve bien en la esquina y abre el panel; (b) búsqueda y calendario con
eventos reales; (c) tocar una tarjeta lleva al lugar correcto y abre en
"Eventos"; (d) el 📍 en el celular; (e) el switch de Funciones; (f) ES/EN/PT.

## Cache-busting
`?v=20260929` en `poi-panel.js`, `evento-card.js`, `categories.js`,
`config.js`, `features.js`, `i18n.js`, `poi-panel.css` y el script nuevo
`eventos-todos.js`.

---

# (entrega anterior, 2026-09-26)

## ACLARACIONES_RELEVANTES — entrega 2026-09-26 (traducción global de la interfaz pública)

## Qué se hizo
Motor de traducción nuevo (`js/i18n.js`, diccionario ES/EN/PT) aplicado a
TODA la interfaz pública fija (lo que ve cualquier visitante o cuenta de
usuario/dueño de negocio logueada — nunca el panel Admin, que se dejó
en español a propósito, es tu herramienta):

- Header: buscador, selector de idioma, botón de cuenta, tooltip del
  botón admin.
- Zonas: dropdown público y panel de zona (nombre, botón "Ir a").
- Filtro de categorías: "Todo"/"Eventos" + auto-refresco al cambiar
  idioma (antes solo se veía el cambio si tocabas algo del filtro).
- Panel POI público completo: pestañas Info/Eventos, sección "Datos",
  botón del ojito, botón Editar/Guardar (hoy sin uso real — ver nota
  abajo), y la tarjeta de evento (fechas, entrada gratis/paga, nombre).
- Modal de login/registro completo, incluidos los mensajes de error.
- Panel de usuario completo: Info, solapa Pines (form del dueño +
  empleados), solapa Eventos (lista + alta/edición de evento).

## Decisiones de alcance (importante)
- **Grupos** (`js/groups.js`) quedaron FUERA — confirmé que es un
  concepto 100% interno del admin (agrupar pines para compartir
  campos, ej. franquicias), nunca se muestra al público. No hacía
  falta traducirlo.
- **Categorías** ya tenían el esquema multi-idioma armado de una
  sesión anterior (`PLAN_CATEGORIAS_SUBCATEGORIAS.md`, Etapas A-D) —
  acá solo le agregué el auto-refresco al cambiar idioma.
- **Zonas**: no tenían nada — les agregué `z.label = {en, pt}` (el
  español sigue viviendo en `z.name`, sin tocar nada existente) +
  editor admin en acordeón, mismo patrón visual que ya usan las
  categorías. Ver `getZoneLabel()` en `js/zones.js`.
- El botón "Editar" del panel POI público está traducido pero sigue
  sin verse nunca: `window.isAdminActive` no se asigna en ningún
  archivo (ver nota ya existente en `js/poi-panel.js`) — no es un bug
  de esta entrega, es preexistente.
- El rótulo custom de la pestaña "Eventos" que el admin puede escribir
  a mano (`tituloPanelEventos`, tab Eventos del admin) sigue siendo un
  solo idioma — si el admin no puso nada, ahora sí sale traducido
  (default "Eventos"/"Events"/"Eventos"); si el admin escribió algo,
  se respeta tal cual lo escribió, en un solo idioma. Convertir ESE
  campo a multi-idioma también es una extensión chica si la querés
  después (mismo patrón que zonas).

## Lo que quedó SIN traducir (gaps conocidos, no bloquean nada)
- Un puñado de mensajes de error más profundos del formulario de
  "guardar evento" en el panel de usuario (`js/user-panel.js`,
  función que guarda el evento): "Ya no te quedan cambios
  disponibles...", "Elegí un pin existente...", "Ingresá el nombre
  del lugar...", "Ubicá el lugar con el buscador...". Son casos de
  error puntuales, de menor tráfico que el resto — quedaron en
  español. Mismo patrón para traducirlos que el resto del archivo.
- El formato de fecha en las tarjetas de evento (`toLocaleDateString`)
  sigue fijo en locale `es-AR` (ej. "15/03") en vez de adaptarse al
  idioma activo — es un cambio aparte (locale, no solo texto) que no
  llegué a entrar. No rompe nada, solo el formato de fecha no cambia
  con el idioma.
- Los toasts/errores exclusivos del panel Admin (ej. "Ingresá el
  nombre de la zona" al guardar una zona) quedaron en español a
  propósito — el admin sos vos, siempre en español.

## Sobre las otras 3 partes del pedido original (1, 2, 3)
Quedan tal cual las dejamos: el sistema de campos de información
(pines/eventos) con variantes de idioma vinculadas, y los ajustes de
ancho/alto de título y párrafo, no se tocaron en esta entrega — la
prioridad que elegiste fue la traducción global de la interfaz
primero. Seguimos con eso cuando quieras retomar.

## Cache-busting
Bumpeado `?v=20260926` en `js/i18n.js` (script nuevo). El resto de los
`<script>` tocados no cambiaron su query de versión porque no se les
tocó el nombre — revisar si preferís bumpearlos igual al desplegar.

## Pruebas realizadas
`node --check` sin errores en los 9 archivos JS tocados/nuevos
(`i18n.js`, `zones.js`, `categories.js`, `poi-panel.js`, `user-auth.js`,
`user-panel.js`, `owner-panel.js`, `empleados.js`,
`eventos-form-shared.js`). No probado contra navegador real — pendiente
que confirmes en vivo: (a) que cambiar el idioma desde el selector del
header actualiza todo lo visible sin recargar la página; (b) que crear/
editar una zona con nombre en inglés/portugués se ve bien en el
dropdown y el panel público; (c) que el flujo de login/registro/alta de
evento se ve bien en los 3 idiomas.
