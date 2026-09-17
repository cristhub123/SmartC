# PLAN: Tamaño de pin (mapa + maximizado) adaptativo al espacio real de pantalla

Ver también: entrada de roadmap `r34` (`js/roadmap.js`), sección "Ver
también" de `AI_RULES.md`, y las secciones 6-9 de `AI_RULES.md` (una
sola fuente de verdad / no reimplementar) antes de tocar este plan.

## ESTADO ACTUAL

**[2026-09-17] Solución rápida ya implementada y aplicada al proyecto**
(no es este plan — es el fix inmediato para el MVP, éste queda documentado
acá solo por contexto):

- 2 sliders nuevos en la tab Global del admin: "Tamaño de pins en el mapa
  (desktop)" (`pinSizeDesktop`) y "Tamaño del edificio maximizado
  (desktop)" (`expandPercentDesktop`), separados de sus pares mobile
  (`pinSize`, `expandPercent`), que NO se tocaron.
- Detección desktop/mobile por `window.matchMedia('(min-width: 768px)')`,
  centralizada en `isDesktopViewport()` (`js/admin-global.js`, expuesta en
  `window.isDesktopViewport`) — única fuente de verdad, reusada en
  `rebuildAllMarkers()` (mismo archivo) y en `expandPin()`
  (`js/pin-adjust.js`).
- Si el usuario cruza el breakpoint en vivo (resize de ventana en
  desktop), un listener de `matchMedia` dispara `rebuildAllMarkers()` de
  nuevo. Esto NO cubre rotación de pin ya maximizado — ver limitación
  más abajo, es la misma que tiene hoy el sistema viejo.
- Defaults de los 2 sliders nuevos = mismo valor que su par mobile, para
  no cambiar nada hasta que Cris los ajuste a mano desde el admin.
- **Limitación conocida y aceptada para el MVP:** es un breakpoint FIJO
  (768px), no un cálculo relativo al espacio real disponible. No resuelve
  por sí solo: pantallas futuras de mayor resolución, pantallas cuadradas,
  ni el pin ya maximizado cuando el usuario gira el celular. Para eso
  está este plan.

**Este plan (la solución de fondo) — sin arrancar.**

## PLAN GENERAL

### La idea (origen: Cris, cita textual, ortografía corregida)

> "Lo único que me preocupa es que a futuro salgan celulares con más
> resolución y los pines queden chiquitos. ¿Vale la pena pasar de tamaño
> en px a % de ancho de imagen? Porque acá también puede solapar y
> generar problemas con celulares de pantalla cuadrada, y ¿qué pasa si la
> persona gira el celular poniéndolo en modo horizontal? Tal vez sería
> prudente establecer que el tamaño de la imagen maximizada debe ser un
> X% del ratio más corto que queda disponible luego de que el panel está
> estirado.
>
> Si no es complejo, hacerlo sería: una vez que se toma en cuenta el
> espacio que normalmente ocupa en su estado #1 el panel del pin, en base
> a ese % de tamaño de ancho de página en relación del aspect ratio del
> lado más corto que queda libre en mapa, o sea restándole el espacio que
> ocupa el panel con la info del lugar, de ese espacio que se ve de mapa
> en pantalla, asignarle un tanto %."

### Traducción técnica (evaluación de Claude, evaluada y confirmada
factible en la conversación del 2026-09-17)

En vez de que el tamaño del pin maximizado sea:
- un valor fijo en px (sistema viejo), o
- un % de la resolución de la imagen fuente, 1024px (sistema actual), o
- un valor fijo separado mobile/desktop (fix rápido de este mismo día),

pasa a ser un **% del lado más corto del espacio de mapa que queda libre
una vez descontado lo que ocupa el panel de info del lugar en su estado
inicial** (peek en portrait / sidebar en landscape). Esto es relativo al
espacio real de cada pantalla, así que se adapta solo a cualquier
resolución, aspect ratio o rotación, sin depender de breakpoints fijos ni
de mantener sliders separados por tipo de dispositivo.

### Piezas técnicas involucradas

- `getOpenAreaPx()` (`js/poi-panel.js`) ya calcula el espacio que ocupa
  el panel, pero hoy devuelve **un solo lado** (el que el panel afecta
  según orientación: alto libre en portrait, ancho libre en landscape).
  Hace falta una versión/extensión que devuelva **los dos lados libres**
  (ancho y alto) para poder tomar el menor de los dos.
- `expandPin()` (`js/pin-adjust.js`) es donde hoy se calcula `targetPx`
  a partir de `globalSettings.expandPercent`. Ahí cambia la fórmula:
  `targetPx = ladoMasCortoLibre * (pct/100) * poiScalePct` en vez de
  `PIN_FULL_IMG_PX * (pct/100) * poiScalePct`.
- **Esto reescribe el significado del slider "Tamaño del edificio
  maximizado".** Hoy 30% = "30% de la imagen full de 1024px". Con este
  cambio, 30% pasa a significar "30% del lado libre de mapa" — son
  números que no se comparan entre sí. Hay que recalibrar el valor
  default para reproducir aproximadamente el tamaño actual en un mobile
  típico (aproximado, no va a quedar pixel-perfecto porque es
  literalmente otra fórmula). El ajuste por-lugar (`poi.pinScale`) sigue
  funcionando igual porque es un multiplicador relativo, no depende de
  la fórmula de base.
- **Rotación de un pin ya maximizado — gap a cerrar.** Hoy, si un POI
  está expandido y el usuario gira el celular, el sistema NO recalcula
  el tamaño (solo se recalculan las variables del panel vía
  `_applyPanelSizeVars()` en el listener de resize de `poi-panel.js`,
  línea ~900-904). Con esta fórmula el tamaño target pasa a depender de
  la orientación, así que este gap se vuelve más visible. Sumar: si hay
  un pin expandido, recalcular también su transform al disparar ese
  mismo listener de resize/orientación.
- **Alcance opcional (evaluar si vale la pena en el mismo pase):**
  aplicar el mismo criterio (% del lado más corto de pantalla) al pin
  chico en reposo sobre el mapa (`pinSize`/`rebuildAllMarkers`, hoy en
  px fijo con la versión mobile/desktop del fix rápido) — ahí no hay
  panel abierto que restar, sería directamente % del lado más corto del
  viewport completo. Reemplazaría los 2 sliders desktop agregados en el
  fix rápido por un solo % universal, pero es una decisión aparte —
  Cris pidió priorizar el pin maximizado primero porque "el pin en mapa
  es menos problemático y los márgenes de error son mayores".

### Estimado

- Pin maximizado (lo central de este plan): 3-4hs.
- + Pin chico del mapa con el mismo criterio (opcional, alcance
  ampliado): +1-2hs.

## REGISTRO POR ETAPA

- **2026-09-17** — Idea planteada por Cris a partir del reporte de que
  el tamaño de pin que funciona bien en mobile no es óptimo en desktop
  con la misma configuración. Evaluada y confirmada factible por Claude
  en la misma conversación. Se decidió NO implementar esto ahora por
  apuro de tiempo con el MVP — se aplicó en su lugar la solución rápida
  de 2 sliders desktop (ver "ESTADO ACTUAL" arriba) y se registra este
  plan para retomar después del lanzamiento de noviembre.
