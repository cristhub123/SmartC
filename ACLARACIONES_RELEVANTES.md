# Aclaraciones relevantes — fix real del hover (2026-09-08, segunda vuelta)

## Por qué el fix anterior (pointer-events:none) no alcanzaba
No limpiaba un `:hover` que ya estaba activo desde antes de aplicarse (el
click que abre/cierra la fila deja el mouse encima del botón). Y cuando
vos movías el mouse activamente por el camino de la animación, el
navegador SÍ recalculaba el hover en cada uno de esos instantes — ahí
`.fbtn:hover` le seguía ganando en especificidad a la clase de animación
de ese paso puntual y pisaba el `transform`. De ahí el efecto "barrera"
que describiste.

## El fix real
Se saca el `:hover` nativo de CSS de estos botones. Ahora el hover se
maneja a mano con JS (`pointerenter`/`pointerleave` + una clase propia
`js-hover`), y se ignora directamente mientras la animación está en
curso — sin depender de que el navegador decida cuándo recalcular el
hit-test contra un elemento que se está moviendo. Es la solución estándar
para este tipo de problema (confirmado en reportes de bugs documentados
de motores de renderizado, no es una app rara haciendo algo raro).

## Qué te pido que confirmes
Repetí justo lo que describiste: mientras la fila anima (abrir o cerrar
una categoría), mové el mouse activamente por delante de los íconos por
donde pasa la animación, varias veces y con distintas categorías, y
confirmá que ya no se traba ni salta.
