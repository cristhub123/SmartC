# Botones de filtro inferiores — estilo mate 3D táctil

## Qué cambió (este ZIP)
- `css/base.css`: fix de recorte — `#filter-bar` tiene `overflow:hidden` y el `.filter-row` solo tenía 6px de padding arriba. Al mover el botón activo hacia arriba (translateY(-5px)) el círculo quedaba tapado por el borde del contenedor. Se subió el padding-top de `.filter-row` de 6px a 18px (deja margen también para el hover, que suma otros -3px).

## Historial de esta serie de cambios
1. Estilos de `.fbtn` / `.fbtn-circle` / `.fbtn-label` en `css/base.css`, y se quitó el `style="background:${cat.color}"` inline en `js/categories.js` (Todo / Eventos / cada categoría) — el color ya no identifica la categoría en reposo, solo aparece en el filtro activo. `cat.color` se sigue usando en el resto de la app (pines, admin, chips).
2. El botón activo SUBE (translateY(-5px)) en vez de bajar como en el HTML de referencia, y sin la sombra negra sólida del ejemplo — solo un glow difuso.
3. (Este ZIP) Corregido el recorte del ícono al subir, dándole más aire arriba al contenedor de la barra.

## Color de acento
Centralizado en una variable CSS para cambiarlo fácil más adelante — está justo arriba del bloque `.fbtn` en `css/base.css`:
```css
:root { --filter-accent: #e06c3e; }
```

## Qué NO cambió
- Lógica de filtrado (`applyFilter`, `activeFilter`, drag-to-scroll) — intacta.
- Íconos: ya eran outline (Feather), no hizo falta reemplazarlos.
