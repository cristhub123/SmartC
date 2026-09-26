# ACLARACIONES_RELEVANTES — entrega 2026-09-26 (traducción global de la interfaz pública)

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
