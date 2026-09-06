# ACLARACIONES — 2da parte del fix de categorías (2026-09-06 20:05)

## Qué faltaba (tu pregunta)
Sí, quedaron 2 cosas sin actualizar en la entrega anterior:

1. **Cache-busting de `js/categories.js` en `index.html`.** Venía con
   `?v=20260906` desde la entrega inicial de la Etapa B, y ese valor
   NUNCA se bumpeó en las 2 rondas de fixes siguientes de hoy (ni en la
   mía recién). Esto es probablemente la explicación real de que el
   borrado sin confirmación / bypass del guardado te siguiera pasando:
   el código ya estaba bien desde hace 2 entregas, pero si tu
   navegador cacheó en algún momento del día esa URL exacta
   (`categories.js?v=20260906`), puede haber seguido sirviendo una
   versión vieja aunque el archivo ya estuviera corregido en el
   servidor. Ahora quedó en `?v=20260906-1955`, que fuerza descarga
   nueva sí o sí.
2. **`AI_SESSION.md`** no se había actualizado con el detalle de mi
   ronda de cambios (lo pide `AI_RULES.md` después de cada edición) —
   ya está al día, incluyendo la explicación del punto 1.

De paso dejé una nota en `PLAN_CATEGORIAS_SUBCATEGORIAS.md` para que
esto no se repita: de acá en adelante, cada vez que se toque un `.js`
que ya se sirve con `?v=`, hay que bumpear ese valor en la MISMA
entrega, sin asumir que un `?v=` de más temprano en el mismo día
alcanza.

## Qué reemplazar
Este ZIP trae `index.html`, `AI_SESSION.md` y `PLAN_CATEGORIAS_SUBCATEGORIAS.md`.
`js/categories.js` **no cambió** respecto al ZIP anterior
(`smartcityV3.0_fix-categorias-editar-nombre-textos_2026-09-06_1955.zip`)
— no hace falta volver a bajarlo, solo reemplazá estos 3 archivos.

## Importante para la próxima prueba
Cuando lo subas, probá con recarga forzada (Ctrl+Shift+R / Cmd+Shift+R)
para asegurarte de que el navegador no siga sirviendo nada cacheado del
`?v=` viejo.
