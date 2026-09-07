# ACLARACIONES — fix de la carrera animación/refresco de fondo (2026-09-07 13:30)

## La causa (resumen)
`updateFilterBar()` se llama muy seguido en segundo plano (cada carga
de pines al mover el mapa) y reconstruye la fila de filtros entera
desde cero. La animación de abrir/cerrar subcategorías tarda medio
segundo repartido en varios pasos. Si un refresco de fondo caía en el
medio, le vaciaba el piso a la animación, y los pasos pendientes de
la animación vieja terminaban actuando sobre la fila ya reconstruida
— de ahí los duplicados y estados raros.

## El fix
Un flag (`_dockAnimating`) que, mientras la animación está en curso:
- bloquea que los refrescos de fondo toquen el DOM de la fila (pero
  igual siguen filtrando los pines nuevos que se carguen)
- bloquea que un click nuevo interrumpa la animación a mitad de
  camino

## Archivo modificado
`js/categories.js` (único archivo con lógica nueva), `index.html`
(cache-busting bumpeado a `?v=20260907-1330`), `AI_SESSION.md`.

## Verificación
`node --check` sin errores. Este es un fix a un bug que solo se
reproduce navegando en vivo (mover el mapa mientras la animación está
en curso) — no lo puedo verificar acá, necesito que lo confirmes en
tu entorno. Recargá con Ctrl+Shift+R.
