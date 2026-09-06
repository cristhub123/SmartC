# Botones de filtro inferiores — nuevo estilo "mate 3D táctil"

## Qué cambió
- `css/base.css`: reemplazado el bloque de estilos de `.fbtn` / `.fbtn-circle` / `.fbtn-label` por el sistema mate 3D de referencia (círculo gris oscuro con relieve, efecto de "hundirse" al activarse, color de acento solo en el filtro activo).
- `js/categories.js`: se quitó el `style="background:${cat.color}"` inline en los 3 lugares donde se arma el HTML de la barra de filtros (Todo / Eventos / cada categoría) — ahora el color lo controla 100% el CSS.

## Decisión tomada con Cris (importante para no revertir sin querer)
Antes, el color de cada categoría (`cat.color`) se veía en el círculo AUN en reposo (sin filtro activo) — era la forma de identificar "esto es Música", "esto es Bares", etc. a simple vista.

Con este cambio eso se pierde a propósito: ahora todos los círculos son del mismo gris mate en reposo, y el color solo aparece en el que está activo. `cat.color` sigue existiendo y se sigue usando en el resto de la app (pines del mapa, panel admin, chips de categoría al cargar/editar un pin) — el único lugar donde se dejó de usar es en esta barra de filtros.

## Color de acento
Queda centralizado en una sola variable CSS para poder cambiarlo fácil cuando se decida el color final:

```css
:root {
  --filter-accent: #e06c3e; /* naranja del HTML de referencia */
}
```

Para cambiar el color, alcanza con tocar ese valor en `css/base.css` (está justo arriba del bloque de estilos de `.fbtn`).

## Qué NO cambió
- La lógica de filtrado (`applyFilter`, `activeFilter`, drag-to-scroll, etc.) — intacta.
- Los íconos: ya eran estilo "outline" (Feather), no hizo falta reemplazarlos.
- El filtro "Eventos" sigue usando el emoji 🎉 (no es un `<svg>`), ahora dentro del mismo círculo mate.
