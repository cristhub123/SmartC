# ACLARACIONES — Etapa C: selector de subcategorías en el pin (2026-09-06 21:00)

## Qué se hizo
En los formularios "Nuevo" y "Editar" de un lugar, debajo de la fila de
categorías, ahora aparece una segunda fila "Subcategoría (opcional)"
con chips — igual que la de categorías, pero SOLO muestra las
subcategorías de las categorías que ya tildaste en ese mismo pin (si
tildás 2 categorías, ves la unión de las subcategorías de ambas). Si
destildás una categoría, sus subcategorías que estuvieran tildadas se
destildan solas (no queda ninguna "huérfana"). El campo nuevo
`poi.subcategories` se guarda junto con el resto del pin.

## Qué NO se hizo todavía (a propósito, es lo que sigue)
- El filtro del mapa público todavía NO usa esto — podés asignarle
  subcategoría a un pin, se guarda, pero en el mapa no cambia nada
  todavía. Eso es la Etapa D.
- La animación de la barra de filtros — Etapa E.
- La importación masiva de pines por texto sigue sin poder asignar
  subcategoría (es un flujo aparte, no formaba parte de este plan).

## Archivos modificados
`js/categories.js`, `js/pin-adjust.js`, `js/admin.js`, `index.html`
(cache-busting de esos 3 `.js` bumpeado a `?v=20260906-2100`),
`AI_SESSION.md`, `PLAN_CATEGORIAS_SUBCATEGORIAS.md`.

## Verificación
`node --check` sin errores en todo el proyecto. **No probado contra
Firebase real ni navegador** — importante probar sobre todo: crear/
editar un pin con subcategorías y confirmar que sobreviven a un
recargado, y que un pin viejo (sin este campo) se pueda seguir
editando sin romperse. Recargá con Ctrl+Shift+R la primera vez.
