# Botones de filtro inferiores — estilo mate 3D táctil

## Qué cambió
- `css/base.css`: estilos de `.fbtn` / `.fbtn-circle` / `.fbtn-label`.
- `js/categories.js`: se quitó el `style="background:${cat.color}"` inline en los 3 lugares donde se arma el HTML de la barra de filtros (Todo / Eventos / cada categoría) — el color lo controla 100% el CSS.

## Decisión de diseño (importante para no revertir sin querer)
1. Antes, `cat.color` se veía en el círculo también en reposo (identificaba la categoría a simple vista). Ahora todos los círculos son del mismo gris mate en reposo, y el color solo aparece en el filtro activo. `cat.color` se sigue usando en el resto de la app (pines, admin, chips) — acá ya no.
2. [Ajuste 2026-09-06, segundo pedido] A diferencia del HTML de referencia (donde el botón activo se "hunde" hacia abajo con una sombra negra dura), acá el botón activo SUBE (translateY(-5px)) y no lleva esa sombra negra sólida — solo un glow difuso más marcado.

## Color de acento
Centralizado en una variable CSS para cambiarlo fácil más adelante:

```css
:root {
  --filter-accent: #e06c3e; /* naranja del HTML de referencia */
}
```
Está justo arriba del bloque de estilos de `.fbtn` en `css/base.css`.

## Qué NO cambió
- Lógica de filtrado (`applyFilter`, `activeFilter`, drag-to-scroll) — intacta.
- Íconos: ya eran outline (Feather), no hizo falta reemplazarlos.
- El filtro "Eventos" sigue con el emoji 🎉 dentro del mismo círculo mate.
