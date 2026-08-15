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

**Última etapa completada:** Etapa 1 — Modelo de datos definitivo (diseño).

**Próxima etapa a hacer:** Etapa 2 — Reescribir el panel público
(`js/poi-panel.js`) para que renderice `content[idioma].fields[]`.

**Archivos a chequear para arrancar la Etapa 2** (no hace falta nada más):
- `js/poi-panel.js` — función `_renderMeta()` (línea ~474) y el bloque
  que arma `finalCustomFields` dentro de `_render()` (línea ~308)
- `js/app-state.js` — función `getContent()` (línea ~431), para saber
  exactamente qué forma de objeto entrega hoy
- La sección "Modelo de datos definitivo" de este archivo, más abajo

**Nada del código de producción fue tocado todavía.** Esta primera
entrega es solo este archivo de plan.

---

## PLAN GENERAL (etapas)

- [x] **Etapa 1** — Definir el modelo de datos definitivo (diseño, sin código)
- [ ] **Etapa 2** — Panel público: renderizar `content[idioma].fields[]` (título+texto, cantidad libre, sin nombres fijos)
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

