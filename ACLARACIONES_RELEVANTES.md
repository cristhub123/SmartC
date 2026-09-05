# ACLARACIONES_RELEVANTES.md — Filtro de fecha de eventos, cambio de ubicación (05/09)

El plan PLAN_FILTRO_FECHA_EVENTOS.md ya estaba 100% aplicado (confirmado
contra el ZIP subido). Único cambio hecho ahora: mover la sección
"FILTRO DE FECHA DE EVENTOS" (toggle + opacidad) de Admin → Mapa a
Admin → Eventos, al final de esa tab, después de "Categorías de evento".

Motivo: es un ajuste conceptual de Eventos, no del mapa en general.

ARCHIVOS TOCADOS:
- index.html               (bloque HTML movido de tp-mapa a tp-eventos-admin)
- js/eventos-fecha-filtro.js (SC.registerTabPlugin('mapa', ...) → ('eventos-admin', ...))

Sin cambios de lógica/funcionalidad — mismos ids de campo, mismo guardado
en Firestore settings/filtroFechaEventos. Verificado: node --check OK,
1 sola definición de cada id nuevo, sin duplicados.
