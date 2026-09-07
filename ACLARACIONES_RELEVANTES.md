# ACLARACIONES — fix "se queda trabado al tocar de nuevo la categoría" (2026-09-07 13:45)

## La causa (resumen)
El click de cada botón dependía de una variable calculada una sola
vez al armar la fila (antes de abrir nada) y nunca se actualizaba,
porque abrir/cerrar con la animación no vuelve a armar la fila desde
cero. Entonces al tocar la categoría ya abierta, el código pensaba
que no había nada abierto e intentaba abrir de nuevo lo mismo — sin
cambio visible, pero corriendo la coreografía otra vez por dentro.

## El fix
El click ahora chequea el estado real de la fila en ese instante
(¿hay subcategorías visibles de esta categoría ahora mismo?), en vez
de una variable vieja.

## Archivo modificado
`js/categories.js` (único con lógica nueva), `index.html`
(cache-busting bumpeado a `?v=20260907-1345`), `AI_SESSION.md`.

## Verificación
`node --check` sin errores. No probado contra Firebase real ni
navegador — necesito que confirmes: tocar una categoría (se abre),
tocarla de nuevo (ahora debería cerrar y volver a mostrar Todo/
Eventos/las demás). Recargá con Ctrl+Shift+R.
