# ACLARACIONES — Etapa E: animación categoría↔subcategorías (2026-09-07)

## Tu pregunta: ¿se pisan las animaciones vieja y nueva?
Se sacó ENTERA la implementación anterior (la técnica FLIP que se
había armado en una ronda previa del mismo día, sin documentar) —
funciones JS y CSS por igual. No quedan las dos conviviendo.

La causa real de por qué se hubieran pisado, para que quede claro: la
posición de reposo de cada botón ahora NO se escribe como un estilo
`transform` directo — solo se guarda la variable CSS `--current-x`.
El `transform` final lo arma el propio CSS. Así, el `:hover`/`.on` que
ya existían en el resto de la app y la animación nueva compiten por
especificidad de CSS normal, nadie le "gana por ser inline" a nadie.
Si hubiera escrito la posición como `transform` inline directo (como
tu ejemplo, que no tenía que convivir con ningún `:hover` propio de la
app), el `:hover`/`.on` que ya existían hubiesen dejado de funcionar.

## Qué se hizo
- Animación vertical (caen/suben con fade), calcada de tu ejemplo de
  los 3 archivos.
- Sin flecha ← — tocar la categoría de nuevo (ya en el primer lugar)
  cierra la vista de subcategorías.
- Categorías/subcategorías reales de la app (no hardcodeadas como en
  tu ejemplo) — se arman desde `getAllCats()`.
- El drag-scroll horizontal de la fila se preservó (los botones ahora
  son `position:absolute`, así que se agregó un espaciador invisible
  para que el navegador siga sabiendo cuánto hay para scrollear).

## Qué NO se tocó
El color de fondo de cada círculo — ya estaba corregido de una ronda
anterior del mismo día, no formaba parte de este pedido.

## Un tema aparte que encontré (no es de esta etapa, ya existía antes)
Cada vez que se llama `updateFilterBar()` (pasa seguido — cada carga
de pines al mover el mapa) se vuelven a enganchar los listeners de
arrastre sobre el mismo elemento, sin sacar los anteriores — se van
acumulando en sesiones largas. Esto ya pasaba en el código de antes de
todo este plan, no es algo que haya introducido ahora. Lo dejo
anotado por si en algún momento querés que lo limpie aparte.

## Archivos modificados
`js/categories.js`, `js/config.js`, `css/base.css`, `index.html`
(cache-busting de los 3 bumpeado a `?v=20260907`), `AI_SESSION.md`,
`PLAN_CATEGORIAS_SUBCATEGORIAS.md`.

## Verificación
`node --check` sin errores en todo el proyecto, llaves `{}` del CSS
balanceadas. **No probado contra Firebase real ni navegador** — la
altura del "dock" (82px) y la posición del ícono (top:4px) son un
cálculo a mano, van a necesitar un ajuste fino mirándolo en vivo.
Recargá con Ctrl+Shift+R.
