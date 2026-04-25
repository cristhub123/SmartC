# SmartCity · Córdoba Urbano

Mapa interactivo de descubrimiento urbano.

## Estructura de archivos

```
index.html          — HTML estructural (~800 líneas)
css/
  base.css          — Todos los estilos (~1300 líneas)
js/
  config.js         — Datos base: CAT, POIS, nextId
  map.js            — Inicialización Leaflet, makeMarker
  markers.js        — pinClick, expandPin, collapsePin
  poi-panel.js      — openPoiPanel, buildVisPicker, ojito
  utils.js          — toast, img uploaders, setupImgUploader
  geocoder.js       — Buscador de direcciones Nominatim
  categories.js     — Círculos flotantes, filtros, grupos
  cluster.js        — Cluster menu, pois cercanos
  zones.js          — ZONAS, dropdown, panel info
  admin-core.js     — Panel admin, tabs, renderList
  admin-forms.js    — saveNew, saveEdit, loadPinAdjust
  admin-global.js   — globalSettings, outline, glow, rebuild
  roadmap.js        — ROADMAP, renderRoadmap
  map-settings.js   — Estilos de mapa, opacidad, tinte
  data-io.js        — Export/Import JSON v3.0
  app.js            — init(), orquestación final
netlify.toml        — Config de hosting
```

## Export/Import

El JSON exportado (schema v3.0) contiene:
- Todos los POIs con imágenes en base64
- Configuración visual global (outline, glow, tamaños)
- Zonas de interés con su configuración
- Categorías personalizadas

## Próximos pasos

1. Mapa minimalista (MapTiler custom style)
2. Firebase Firestore para persistencia
3. Firebase Auth para roles (admin / business / visitor)
4. Dashboard de business owner
5. Sistema de membresías con Stripe
