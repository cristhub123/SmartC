# ACLARACIONES_RELEVANTES — entrega 2026-10-06 (login único + tuerca solo admin + cambiar contraseña)

> Reemplaza a la entrega anterior del mismo día (la del link "🔑 Cambiar contraseña"). Si ya habías subido esa, estos archivos la pisan.

## Cómo queda
- **Un solo login, el del 👤**, para todas las cuentas: usuario, dueño de negocio, empleado y admin. El cuadro "Acceso de administrador" ya no existe.
- **La tuerca ⚙ no se ve** hasta que inicia sesión una cuenta admin (las que están en la colección `admins` de Firestore). Al cerrar sesión desaparece y, si el panel admin estaba abierto, se cierra.
- **"Cambiar contraseña"** es un botón más del login, igual que "Continuar con Google". Adentro: cambiarla sabiendo la actual, o pedir un mail si no la recordás.

## Decisiones que tomé yo — confirmá o cambialo
- **En el panel del 👤, un admin figura como "Administrador"** si no tiene perfil de usuario propio (doc en `usuarios`).
- **Admin que entra con Google:** no le pregunta "¿qué tipo de cuenta?", entra directo.
- **"🔓 Salir" del panel admin** cierra la sesión entera (admin y 👤 son ahora la misma sesión).
- **Cambiar la contraseña no te deja logueado:** te devuelve a "Ingresar" para que entres con la nueva.
- Cuentas de Google sin contraseña propia: usan la opción del mail.

## Para revisar en la consola de Firebase (sin tocar código)
- **Authentication → Templates → Restablecimiento de contraseña:** remitente, asunto y texto del mail.
- Al cambiar la contraseña, Firebase cierra la sesión de esa cuenta en los otros dispositivos.

## Sin probar en real (pendiente que confirmes)
Probado en Chromium con los archivos reales y Firebase simulado, NO contra Firebase real ni en celular: (a) entrar por el 👤 con tu cuenta admin y que aparezca la tuerca (puede tardar una fracción de segundo, es la consulta a `admins`); (b) con una cuenta común, que la tuerca no aparezca; (c) "Salir" del admin; (d) cambiar contraseña y que llegue el mail.

## Cache-busting
`?v=20261006-admin` en `base.css`, `i18n.js`, `admin.js`, `admin-auth.js`, `user-auth.js` — recargá con Ctrl+F5.

---

# (entrega anterior)

# ACLARACIONES_RELEVANTES — entrega 2026-10-01 (cruces de cierre en cada ventana)

## Qué ventanas tienen cruz ahora
Panel de un lugar y "Todos los eventos", vista ampliada de un evento, dropdown de zonas, login de administrador, popover del calendario del filtro. Ya la tenían (sin cambios): panel de zona, login/registro público, panel de usuario y panel Admin.

## Decisiones que tomé yo — confirmá o cambialo
- **Cruz de la vista ampliada de un evento:** cierra SOLO esa vista (vuelve a las tarjetas), igual que el "‹". No cierra el panel entero. Si preferís que cierre todo, es llamar a `PoiPanel` `_cerrarDesdeCruz` desde ahí.
- **Sin cruz a propósito:** el cuadro de confirmación (ya tiene Cancelar/Aceptar), los resultados del buscador y el calendario inline de "Todos" (vive dentro de un panel que ya tiene cruz). Si querés cruz también ahí, avisame.
- **Ojito del panel de un lugar:** se corrió un poco a la izquierda para dejar lugar a la cruz.
- **Cruz en "Todos los eventos":** solo cierra el panel (no hay pin maximizado que minimizar).

## Sin probar en real (pendiente que confirmes)
Probado en Chromium con los archivos reales y datos simulados, NO con Leaflet/Firebase reales ni en celular: (a) al tocar la cruz del panel, el pin del mapa queda realmente minimizado y desactivado, igual que con un toque en el mapa vacío; (b) la cruz no choca con el ojito/título en pantallas chicas y en modo lateral (horizontal); (c) skin oscuro; (d) la cruz del dropdown de zonas en celular.

## Cache-busting
`?v=20261001` en `poi-panel.css`, `evento-card.js`, `poi-panel.js`, `admin-auth.js`, `zones.js`, `calendario-eventos.js`, `eventos-fecha-filtro.js`; `base.css?v=20261001-cruces`.

---

# (entrega anterior)

# ACLARACIONES_RELEVANTES — Banderas en el selector de idioma (2026-10-01)

## Decisiones que tomé yo — confirmá o cambialo
- **Banderas:** español = España (como pediste), inglés = Reino Unido, portugués = Brasil. Para cambiar una: el `src` del botón en `index.html` + el SVG en `img/flags/`.
- **Set de banderas:** usé `kapowaz/square-flags` (MIT) y no `lipis/flag-icons`, porque la bandera de España de lipis pesa 82 KB (escudo detallado) contra 2,2 KB. Las 3 juntas pesan ~3,4 KB. El escudo de España queda simplificado, a 26px no se nota.
- **Inactivas** en gris con opacidad 60% (no 30%): con 30% se perdían sobre el fondo blanco. Se ajusta en `css/base.css`, regla `#lang-switcher button img`.
- **La activa** lleva además un aro del color de acento del tema, para que no dependa solo del color.
- **En pantallas angostas** (≤420px) el selector ocupa ~20px más que con las siglas: el buscador queda un poco más corto.

## Sin probar en real (pendiente que confirmes)
Probado en Chromium con el CSS/JS reales del selector y un `AppState` de prueba, NO en el `index.html` completo ni en celular real: (a) cómo se ve con los temas/skins oscuros; (b) el ancho del header en celulares chicos.

## Cache-busting
`?v=20261001-flags` en `base.css` y `lang-switcher.js`. SVG nuevos en `img/flags/`.

---

# (entrega anterior)

# ACLARACIONES_RELEVANTES — Tema que no movía la imagen (2026-09-30)

## Qué encontré
- **El tema buscaba la imagen por su nombre interno, no por el nombre del archivo.** Las imágenes que cargás desde la grilla del lugar se guardan por dentro como `alt1`, `alt2`… (aunque el archivo se llame `…_piedra_01.webp`); solo las vinculadas por texto usan `piedra` como nombre interno. Por eso el tema "no la veía". Ahora la busca por las dos cosas: nombre interno y sufijo del archivo.
- **No pude ver tus datos reales**, así que esta es la causa más probable, no confirmada. Si después de esto sigue igual, pasame el ID del lugar y el nombre exacto del archivo.

## Cómo probarlo
1. Tab Temas → tema con sufijo `piedra`, "Tema activo" + "Miniatura en el mapa" tildados → **"Guardar cambios"** (tildar solo no mueve nada; mueve al guardar).
2. Mirá el aviso: dice cuántos lugares se movieron. Si ninguna imagen coincide ahora te avisa con el sufijo, en vez de decir solo "no hubo nada que mover".
3. Ctrl+F5 y abrí el lugar.

## Decisiones que tomé yo — confirmá o cambialo
- El sufijo del archivo es el 2.º segmento entre `_` (`prefijo_SUFIJO_01.ext`), en minúsculas. Primero manda el nombre interno; el archivo es el respaldo.
- No cambié nada del lado público ni del gestor de imágenes.

---

# ACLARACIONES_RELEVANTES — Temas por casilleros (2.ª versión, 2026-09-30)

## Qué cambió y por qué
- **Se sacó el sistema anterior** (el "override" que se calculaba en cada dibujado). Competía con tu regla del 50+ y por eso nada funcionaba. Ahora el tema **mueve imágenes de casillero** y tu regla (1-49 se ve, 50-99 nunca) hace el resto. No hay toggles de por medio.
- **Se aplica al tocar "Guardar cambios"** de la tab Temas (no al tildar): ahí se recorren TODOS los lugares y se escriben los cambios en Firebase. Tildar solo prepara; hasta guardar no se mueve nada ni se ve nada.
- **Tema activo + "Miniatura en el mapa":** la imagen con el sufijo va al casillero 1 y se ve como miniatura del mapa y 1ª del ojito; `main` pasa a ser la siguiente. **Tema activo + ojito:** va a la posición elegida (2ª en adelante; las demás se corren solo si el casillero está ocupado). **Tema apagado, borrado o con otro sufijo:** la imagen baja al 50 (o al siguiente libre) y desaparece.

## Decisiones que tomé yo — confirmá o cambialo
- **`main` no se mueve de verdad:** no tiene número de orden (el 1 es "de la principal"). Para que la imagen del tema pase a ser la principal, la app trata a una imagen con orden 1 que no sea `main` como la primera. En el gestor de imágenes del lugar vas a ver la imagen del tema con el número 1.
- **`active`:** al subir una imagen de 50+ a 1-49 queda activa, y al bajarla a 50+ queda inactiva. Es lo mismo que hace el gestor del admin cuando cambiás un número; no es un toggle manual.
- **Guardar también acomoda los temas que nunca activaste:** si una imagen de un tema apagado estaba en 1-49, al guardar baja al 50.
- **Si borrás un tema o le cambiás el sufijo**, sus imágenes (con el sufijo viejo) bajan al 50 en el siguiente guardado.
- **El tema de noche automático no se toca nunca.** Tampoco `main`.
- Con "Miniatura en el mapa" tildada la posición del ojito queda fija en 1ª; sin miniatura, las posiciones empiezan en 2ª (la 1ª es de la principal).
- El historial de dónde estaba cada imagen **no se guarda**: al apagar un tema va al 50, no vuelve al número que tenía antes.

## Costo
- Cada "Guardar cambios" lee todos los lugares una vez y escribe solo los que cambian.

---

# ACLARACIONES_RELEVANTES — Orden 50+ bloqueado en OFF (2026-09-30)

## Decisiones que tomé yo — confirmá o cambialo
- **Umbral ">= 50", sin tope en 99:** el casillero no tiene máximo, así que un 100 o más también queda bloqueado (si no, sería una salida al bloqueo).
- **Las ya guardadas con orden 50+ y en ON también se bloquean:** al abrir el pin aparecen en OFF y al guardar se graba `active:false`; y en el público ya no se ven aunque el dato viejo diga ON.
- **Ni los temas la muestran:** una imagen con orden 50+ cuyo sufijo coincide con un tema activo tampoco aparece.
- **Importación masiva:** asigna órdenes 2, 3, 4…; solo un pin con 49+ imágenes llegaría a 50. "Vincular imágenes" reemplaza el skin entero y pierde su orden: queda sin número (fuera del bloqueo).
- **Si la movés a un número menor (< 50):** el toggle reaparece y la imagen pasa a ON (visible al público). Corregido según lo que pediste.
- **Subí el zip completo y recargá con Ctrl+F5:** la regla está en `js/utils.js` (público) y en `js/img-slots.js` (admin), más `js/app-state.js` e `index.html`.

---

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
