# Botones de filtro inferiores — estilo mate 3D táctil

## Qué cambió (este ZIP)
1. Highlight superior del círculo aclarado (`rgba(255,255,255,.1)` → `.32` en reposo, `.45` en activo) — antes casi no se notaba.
2. Legibilidad del label debajo del ícono: se reemplazó el `text-shadow` de solo blur por un contorno duro (4 sombras a 1px sin blur alrededor de la letra) + una sombra difusa debajo. Sirve para cualquier fondo de mapa (calles claras, parques, etc.) sin agregar cajas ni tocar la tipografía/tamaño.

## Historial de esta serie de cambios
1. Estilos de `.fbtn` / `.fbtn-circle` / `.fbtn-label` en `css/base.css`, y se quitó el `style="background:${cat.color}"` inline en `js/categories.js` — el color ya no identifica la categoría en reposo, solo aparece en el filtro activo. `cat.color` se sigue usando en el resto de la app (pines, admin, chips).
2. El botón activo SUBE (translateY(-5px)) en vez de bajar como en el HTML de referencia, sin sombra negra sólida — solo un glow difuso.
3. Corregido el recorte del ícono al subir (más padding-top en `.filter-row`).
4. (Este ZIP) Highlight más claro + legibilidad del texto.

## Color de acento
Centralizado en una variable CSS — está justo arriba del bloque `.fbtn` en `css/base.css`:
```css
:root { --filter-accent: #e06c3e; }
```

## Qué NO cambió
- Lógica de filtrado (`applyFilter`, `activeFilter`, drag-to-scroll) — intacta.
- Íconos: ya eran outline (Feather), no hizo falta reemplazarlos.
