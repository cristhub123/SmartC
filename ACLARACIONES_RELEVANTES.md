# ACLARACIONES_RELEVANTES — Plan Tab Temas, pasos 1 a 4 + corrección (2026-09-30)

## Corrección (PLAN_TAB_TEMAS_CORRECCION.md) — decisiones que tomé yo, confirmá o cambialo
- **Este zip es INTEGRADO:** trae TODOS los archivos que cambiaron desde tu proyecto del 05:12 (pasos 1 a 4 + la corrección). Subilo completo, no solo una parte: el motor está en `js/utils.js` y `js/markers.js`. La tab Temas ahora muestra arriba de la lista una línea **"✔ Motor de temas al día"** o **"✘ DESACTUALIZADO: falta subir js/…"**, así ves al instante si quedó algún archivo viejo. Después de subir, recargá con Ctrl+F5.
- **Lo que reportaste (1 y 4):** era un malentendido mío; ahora "Tema activo" es el interruptor maestro y las imágenes con sufijo de un tema solo se ven mientras ese tema esté activo. Con el tema apagado sus otros tildes quedan grisados (se conservan los valores).
- **Lo que reportaste (2 y 3), miniatura y posición:** en las pruebas con datos simulados funcionan. Mi sospecha principal es que tu prueba corrió con `utils.js`/`markers.js` viejos (cada zip traía solo sus archivos). Si con este zip y Ctrl+F5 siguen sin funcionar, avisame con el nombre del lugar y te lo rastreo con tu caso real.
- **Importante (efecto de la regla nueva):** si existe un tema con sufijo `piedra`, TODAS las imágenes `piedra` de todos los lugares dejan de verse como variantes normales mientras ese tema esté apagado. Si querés ver una de esas imágenes siempre, no crees un tema con ese sufijo.
- **Tema de noche exceptuado (D6):** la imagen del tema de noche automático NO se oculta por esta regla, aunque exista un tema con ese sufijo. Tampoco se permite un tema con sufijo `main`.
- El campo **sufijo** sigue editable con el tema apagado (define qué imágenes gobierna el tema).

---

# Pasos 2, 3 y 4 (2026-09-30)

## Decisiones que tomé yo — confirmá o cambialo
- **Migración de temas viejos (cambia lo que dije en el Paso 1):** un tema viejo con "Default en el mapa" ya se aplicaba al público sin interruptor, así que ahora migra ENCENDIDO (`active:true`, con "prevalece de noche" tildado) para que el mapa se vea igual que antes. Si migraba apagado, el Paso 2 lo habría dejado de aplicar. Los demás temas viejos migran apagados. Si tenés 2 temas viejos con "Default en el mapa", van a quedar los 2 activos con miniatura: el motor usa el primero de la lista; destildá uno en la tab.
- **D4 (día/noche), tal como lo adoptó el plan:** de noche, si el pin tiene la imagen del tema de noche, gana esa imagen, salvo que el tema activo con miniatura tenga tildado "prevalece en mapa de noche". **"Prevalece en mapa de día" hoy no cambia nada**: de día el tema de noche no pide la miniatura, así que no hay conflicto que resolver. Si querías otra cosa (por ejemplo que cada botón habilite al tema solo en ese horario), decímelo y se ajusta en una sola función (`buildImageFallbackChain`, `js/utils.js`).
- Los campos viejos `mapDefault`/`panelDefault`/`altEnabled` se migran una vez y se borran del tema (ya nadie los lee).

## Paso 3 — resuelto
- **D3 (qué se ve al maximizar): opción (a), sin salto visual.** Al maximizar se ve la imagen del tema (la misma de la miniatura) y el ojito sigue desde su posición real en la lista. No hizo falta tocar `markers.js`: ya funcionaba así y se verificó con la lista nueva.
- **D5:** los visitantes leen los temas al cargar la página; quien ya tenga la app abierta ve el cambio al recargar. Sin escucha en vivo.
- El mapa ahora se redibuja solo al tocar cualquier control de la tab Temas (vista previa del admin, en memoria), al borrar, al guardar temas y al guardar día/noche. **El público no ve nada hasta tocar "Guardar cambios".** Si hay un pin abierto, se cierra y se vuelve a abrir solo para refrescar el ojito (el mapa hace un pequeño paneo al reabrirlo).

## Paso 4 — cerrado
- Probado en un Chromium real con los archivos finales (27 comprobaciones): migración de temas viejos, alta, regla de 1 miniatura con su mensaje, posición, sufijo inválido, guardado y recarga, miniatura/ojito/noche sobre pines reales y vista en 390 px sin scroll lateral. **Sigue sin probarse con tu Firebase real ni con tus imágenes de Cloudinary: eso lo tenés que confirmar vos.**
- Se sumó al roadmap una entrada de instrucciones de uso (`i2`) y la idea de activación por fechas (`r35`, fuera del plan por D1). `AI_RULES.md` ahora tiene la sección 14.8.

---

# (entrega anterior, 2026-09-30 — tarjeta Polaroid)

## ACLARACIONES_RELEVANTES — entrega 2026-09-30 (tarjeta Polaroid + vista ampliada de evento)

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
