# ACLARACIONES — Etapa D: filtro real por subcategoría (2026-09-06 21:45)

## Qué se hizo
El mapa público ahora sí distingue subcategorías:
- Tocás una categoría con subcategorías cargadas → se abre una fila
  con "← Volver" + los chips de esas subcategorías. El mapa ya
  muestra TODOS los pines de esa categoría (como pasaba antes).
- Tocás una subcategoría → filtra más, solo esa. Tocarla de nuevo la
  deselecciona (vuelve a verse toda la categoría).
- Flecha ← → vuelve a "Todo" (confirmado por vos).
- Categoría sin ninguna subcategoría activa → filtra normal, no abre
  ninguna fila (confirmado por vos).
- Con la fila de subcategorías abierta, no se puede tocar Todo/
  Eventos/otra categoría directo — hay que volver con la flecha
  primero (confirmado por vos).

## Qué falta (a propósito, es lo que sigue)
Todavía SIN animación — la fila aparece/desaparece de golpe, no
desliza. Eso es la Etapa E (deslizamiento + curva S + la flecha
entrando desde la derecha, la Opción 1 que elegiste). Después de eso
queda la Etapa F (QA final).

## Archivos modificados
`js/config.js`, `js/categories.js`, `index.html` (cache-busting de
esos 2 bumpeado a `?v=20260906-2145`), `AI_SESSION.md`,
`PLAN_CATEGORIAS_SUBCATEGORIAS.md`.

## Verificación
`node --check` sin errores en todo el proyecto. **No probado contra
Firebase real ni navegador** — importante probar: categoría CON
subcategorías, categoría SIN subcategorías, tocar/destocar una
subcategoría, y la flecha. Recargá con Ctrl+Shift+R.
