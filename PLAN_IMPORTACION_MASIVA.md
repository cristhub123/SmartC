# PLAN_IMPORTACION_MASIVA.md — Plan de trabajo persistente
### Importación masiva de lugares + contenido multi-idioma (ES/EN/PT)

> ═══════════════════════════════════════════════════════════════
> CÓMO USAR ESTE ARCHIVO (leer esto primero, siempre)
> ═══════════════════════════════════════════════════════════════
> Este archivo NUNCA se borra ni se resetea (a diferencia de
> CAMBIOS.txt). Cada etapa que se completa se AGREGA al final de
> "REGISTRO POR ETAPA" — el historial completo queda siempre.
>
> Si sos una IA retomando este trabajo en un chat nuevo:
> 1. Leé la sección "ESTADO ACTUAL" de abajo — te dice en qué etapa
>    estamos y qué es lo próximo a hacer, con la lista exacta de
>    archivos a revisar. NO hace falta releer todo el proyecto.
> 2. Solo si "ESTADO ACTUAL" te manda a un archivo puntual, revisalo.
>    El resto del contexto ya está en este documento y en
>    AI_RULES.md / AI_SESSION.md (arquitectura general del proyecto).
> 3. Al terminar una etapa: agregá una entrada nueva en "REGISTRO POR
>    ETAPA" (nunca edites/borres entradas viejas), actualizá el
>    checklist de "PLAN GENERAL", y reescribí "ESTADO ACTUAL" para
>    que apunte a la etapa siguiente.
> 4. Entregá el ZIP completo del proyecto con este archivo actualizado
>    adentro, nombrado `smartcityV3.0_AAAA-MM-DD_HHMM.zip`.

---

## ESTADO ACTUAL

**Última etapa completada:** Etapa 2 — Panel público (`js/poi-panel.js`)
ya renderiza los campos internos como bloques verticales "título arriba
/ texto abajo", leyendo `content[idioma].fields[]` con fallback en
cascada a `custom_fields` viejo, a `poi.attrs` legado, y a `poi.hours`.

**Próxima etapa a hacer:** Etapa 3 — Admin: el editor de campos
(`_renderPinAttrsEditor`/`_readPinAttrsFromForm` en `pin-adjust.js`)
tiene que dejar de escribir `poi.attrs` (legado, sin idioma) y escribir
directo a `content[idioma].fields[]`, con un selector de idioma dentro
del editor (o 3 editores, uno por idioma — a decidir en esa etapa).

**Archivos a chequear para arrancar la Etapa 3** (no hace falta nada más):
- `js/pin-adjust.js` — funciones `_renderPinAttrsEditor()`,
  `_readPinAttrsFromForm()` (línea ~614 en adelante), y los puntos
  donde `saveNew()`/`saveEdit()` arman el objeto `attrs` que mandan a
  Firestore
- `index.html` — markup de `a-attrs-wrap`/`e-attrs-wrap` (tabs
  Nuevo/Editar), para ver cómo está armado el HTML que hay que adaptar
- `js/poi-panel.js` — función `_resolveFields()` (agregada en la
  Etapa 2), para saber exactamente qué forma de dato espera leer del
  lado del panel
- La sección "Modelo de datos definitivo" de este archivo, más abajo

**Ver el registro completo de la Etapa 2 más abajo** para el detalle
línea por línea de qué se cambió y qué fallback quedó armado.

---

## PLAN GENERAL (etapas)

- [x] **Etapa 1** — Definir el modelo de datos definitivo (diseño, sin código)
- [x] **Etapa 2** — Panel público: renderizar `content[idioma].fields[]` (título+texto, cantidad libre, sin nombres fijos)
- [ ] **Etapa 3** — Admin: editor de campos que escribe directo a `content[idioma].fields[]`, con selector de idioma
- [ ] **Etapa 4** — Migración de datos viejos: pines con `attrs` pasan a `content.es.fields[]`
- [ ] **Etapa 5** — Importador de texto masivo: aceptar bloques ES/EN/PT con campos numerados libres
- [ ] **Etapa 6** — Validación previa a importar (reporte antes de escribir en Firestore)
- [ ] **Etapa 7** — Selector de idioma global (sacarlo del panel, notificar a toda la app)
- [ ] **Etapa 8** — Prueba real end-to-end con 3-5 lugares en los 3 idiomas, antes de la carga masiva definitiva

Este orden es el recomendado pero no es rígido: si al hacer una etapa
aparece algo que obliga a reordenar, se documenta en el registro de esa
etapa (ver regla de "desvíos" abajo) y se actualiza este checklist.

---

## MODELO DE DATOS DEFINITIVO (resultado de la Etapa 1)

```
poi = {
  // ── Identidad y ubicación (YA IMPLEMENTADO, no tocar en este plan) ──
  id, active, lat, lng, country, province, city,
  categories: [...], tags: [...],
  icon, pinScale, pinOffsetX, pinOffsetY,
  skins: {...}, banner: {...},

  // ── Contenido multi-idioma (ESTO ES LO QUE FALTA CONSTRUIR) ──
  content: {
    es: {
      name: "...",
      gancho: "...",
      description: "...",
      fields: [
        { title: "...", text: "..." },
        { title: "...", text: "..." },
        // cantidad LIBRE — puede haber 0, 1, 5 o 12. Nunca un
        // límite fijo en el código, y NUNCA un título predefinido
        // tipo "Dato curioso"/"Horario" — el título lo escribe
        // quien carga el contenido, campo por campo.
      ]
    },
    en: { name, gancho, description, fields: [...] },
    pt: { name, gancho, description, fields: [...] }
  },

  // ── Legado (fallback de compatibilidad, NO se borra) ──
  name, desc, hist, hours, attrs: [{l, v}, ...]
}
```

**Reglas fijadas para este modelo (decisión de Cris, no reabrir sin
avisar):**
1. `fields[]` es un array, no un objeto de claves fijas — cada campo es
   simplemente "el campo N de este lugar", con su propio título y texto
   libres. El sistema no conoce ni impone ningún nombre de campo.
2. No hay cantidad mínima ni máxima fija en el código. (Nota: en una
   sesión anterior se había hablado de un límite configurable de 5 con
   override por POI — Cris después aclaró explícitamente que **no**
   quiere ningún límite fijo, ni de cantidad ni de nombre. Esta versión
   reemplaza esa idea anterior.)
3. Los 3 idiomas son independientes entre sí: un lugar puede tener 4
   campos en español y solo 2 en inglés si todavía no se tradujo el
   resto — el panel debe soportar esa asimetría sin romperse (fallback
   a español si falta el idioma pedido, regla ya definida en
   `app-state.js`/`FALLBACK_LANG`, se reusa tal cual).
4. `attrs` (el sistema viejo, sin idioma) se mantiene como fallback de
   compatibilidad para pines ya cargados, nunca como fuente de verdad
   para pines nuevos.

---

## REGISTRO POR ETAPA

### Etapa 1 — Modelo de datos definitivo (2026-08-15)

**Qué se pidió:** Cris le pidió a ChatGPT un análisis completo del
sistema de carga masiva de lugares con contenido en 3 idiomas y campos
de texto internos versátiles (sin títulos ni cantidad fijos). ChatGPT
devolvió un diagnóstico de 21 puntos y un plan de 17 etapas.

**Qué se hizo:** Se auditó ese diagnóstico contra el código real del
ZIP (no contra memoria/suposiciones). Confirmado con lectura directa
de código:
- El bug central es real: `js/pin-adjust.js` escribe `poi.attrs`
  (array `{l,v}`, sin idioma), pero `js/poi-panel.js` únicamente lee
  `poi.content[idioma].custom_fields` (objeto de claves, no array) —
  son dos sistemas que nunca se conectaron.
- Nada en el proyecto escribe hoy `poi.content` en absoluto — la
  infraestructura de idioma (`AppState.setLanguage/getContent`, ES/EN/PT
  en el panel) es real y global, pero no tiene datos que mostrar.
- País/provincia/ciudad, categorías/tags, imágenes (`skins`/`banner`)
  e ID explícito con lat/lng **ya están resueltos** de sesiones
  anteriores (ver `AI_SESSION.md`/`CAMBIOS.txt`) — no forman parte de
  este plan, se dejan afuera del alcance.
- El importador que ChatGPT usó como referencia principal
  (`js/content-import.js`) es una herramienta vieja y angosta (sin
  lat/lng, sin país/provincia/ciudad, sin `attrs`) — el importador real
  y completo es `parsePinBulkText`/`importFullPinsFromText` en
  `js/pin-adjust.js`.
- Se definió el modelo de datos final (arriba) con el array `fields[]`
  libre, sin títulos ni cantidad predefinidos, según la aclaración
  explícita de Cris.

**Resultado:** Modelo de datos acordado y documentado. Ningún archivo
de código fue modificado todavía.

**Desvíos del plan original:** El plan de 17 etapas de ChatGPT se
redujo a 8, porque varias de sus etapas (país/provincia/ciudad,
categorías, Cloudinary, geolocalización) ya estaban completadas en
sesiones previas y no hace falta retrabajarlas. También se descartó la
idea de un "límite configurable de campos" que había surgido en una
charla anterior — Cris pidió explícitamente que no haya ningún límite
ni título fijo.

**Archivos tocados:** Ninguno (solo se creó este archivo de plan).

**Qué falta / próximo paso exacto:** Etapa 2 — reescribir
`_renderMeta()` en `js/poi-panel.js` para que lea
`content[idioma].fields[]` (array) en vez de `custom_fields` (objeto),
y renderice cada campo como bloque "título arriba / texto abajo" (hoy
el título se pone como `tooltip` HTML, invisible salvo hover — hay que
cambiar eso a un elemento de texto visible). Mantener el fallback a
`poi.hours` que ya existe. Archivos involucrados: `js/poi-panel.js`,
posiblemente `css/poi-panel.css` para el estilo de los bloques nuevos.

---

### Etapa 2 — Panel público renderiza campos título+texto (2026-08-15)

**Qué se pidió:** lo que quedó anotado como próximo paso en la Etapa 1
(ver arriba).

**Qué se hizo:** en `js/poi-panel.js`, nueva función `_resolveFields(poi,
rawContent)` con fallback en cascada: (1) `content[idioma].fields[]`
— el esquema definitivo, array libre de `{title, text}` — (2)
`custom_fields` (objeto, esquema intermedio ya en desuso, se sigue
leyendo por si quedó algo cargado con esa forma) — (3) `poi.attrs`
(array `{l,v}`, el que escribe HOY el editor del admin, sin idioma —
este es el nivel que efectivamente se usa mientras no se haga la Etapa
3) — (4) `poi.hours` suelto como único campo "Horario" (comportamiento
legado preexistente, se preservó tal cual). `_renderMeta()` reescrita
para crear un bloque por campo con el título como texto visible arriba
(antes era un `tooltip` HTML invisible salvo hover) y el texto abajo,
sin límite de cantidad. CSS actualizado en `css/poi-panel.css`: la fila
horizontal de chips pasó a columna vertical con separador entre
bloques, reutilizando las variables de la pestaña Tipografía que ya
existían (`--pines-section-*`/`--pines-body-*`) para que el estilo se
mantenga consistente con el resto del panel.

**Resultado:** `node --check js/poi-panel.js` sin errores. No probado
en navegador real (sin entorno con DOM en esta sesión) — Cris debería
ver el cambio apenas suba este ZIP: los pines que ya tienen `attrs`
cargado van a mostrar el título visible en vez de solo al pasar el
mouse, sin necesitar ningún cambio en el admin todavía.

**Desvíos del plan original:** ninguno — se hizo tal cual quedó
planteado en la Etapa 1.

**Archivos tocados:** `js/poi-panel.js`, `css/poi-panel.css`,
`AI_SESSION.md` (nueva entrada de sesión).

**Qué falta / próximo paso exacto:** Etapa 3 — el editor de campos del
admin (`pin-adjust.js`) sigue escribiendo `poi.attrs` (nivel 3 del
fallback), no `content[idioma].fields[]` (nivel 1, el definitivo).
Mientras no se haga la Etapa 3, el panel funciona pero sin
multi-idioma real en los campos (todos los idiomas ven el mismo
`poi.attrs`, vía fallback). Archivos a tocar: `js/pin-adjust.js`
(`_renderPinAttrsEditor`/`_readPinAttrsFromForm`/`saveNew`/`saveEdit`),
`index.html` (markup del editor en las tabs Nuevo/Editar).

