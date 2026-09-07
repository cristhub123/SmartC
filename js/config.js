/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/* config.js — DATA & CONSTANTS — loaded first */
window.SC = window.SC || {};
SC._tabPlugins = {};
SC.registerTabPlugin = function(tabId, fn) {
  SC._tabPlugins[tabId] = SC._tabPlugins[tabId] || [];
  SC._tabPlugins[tabId].push(fn);
};

/* ═══════════════════════════════════════════
   DATA
═══════════════════════════════════════════ */
/* ── Lucide SVG icon set (white, outline, consistent) ── */
const LUCIDE = {
  food:    `<svg viewBox="0 0 24 24"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`,
  culture: `<svg viewBox="0 0 24 24"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>`,
  music:   `<svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  bar:     `<svg viewBox="0 0 24 24"><path d="M8 22H16"/><path d="M12 11V22"/><path d="M20 2H4L12 11 20 2Z"/></svg>`,
  art:     `<svg viewBox="0 0 24 24"><circle cx="13.5" cy="6.5" r=".5" fill="white"/><circle cx="17.5" cy="10.5" r=".5" fill="white"/><circle cx="8.5" cy="7.5" r=".5" fill="white"/><circle cx="6.5" cy="12.5" r=".5" fill="white"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`,
  historic:`<svg viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="1"/><path d="M2 10l10-8 10 8"/><line x1="12" y1="21" x2="12" y2="14"/><rect x="9" y="14" width="6" height="7"/></svg>`,
  shop:    `<svg viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
  all:     `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  /* [Etapa D, PLAN_CATEGORIAS_SUBCATEGORIAS.md — sección 3/5] botón
     "Volver" de la fila de subcategorías — único lugar donde se
     define este ícono, la Etapa E (animación) lo reusa tal cual. */
  back:    `<svg viewBox="0 0 24 24"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
  default: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
};

/* [Etapa A, PLAN_CATEGORIAS_SUBCATEGORIAS.md — 2026-09-06] `label`
   pasa de string plano a objeto multi-idioma (ES/EN/PT, mismos 3
   idiomas de `lang-switcher.js`) y cada categoría suma
   `subcategories` (mapa anidado, mismo shape que una categoría de
   primer nivel). Se conservan los 7 ids tal cual para no romper
   `poi.categories` ya guardado en Firestore. Las traducciones EN/PT
   son un default razonable armado acá (Etapa A no incluye UI de
   edición todavía, ver Etapa B) — el admin va a poder corregirlas a
   mano desde el panel una vez exista el editor de idiomas.
   `subcategories` arranca vacío en las 7: qué categoría pasa a ser
   subcategoría de cuál es una decisión de Cris, pendiente (ver
   PLAN_CATEGORIAS_SUBCATEGORIAS.md, sección 11, punto 2) — no se
   inventa acá ningún árbol.
   Para leer el label como string (UI), usar `getCatLabel(cat)`
   (js/categories.js) — nunca leer `cat.label` directo, ver sección
   10 del plan (mismo criterio de fallback que AppState.getContent). */
const CAT = {
  food:    {label:{es:'GASTRONOMÍA', en:'FOOD',     pt:'GASTRONOMIA'}, color:'#e0603a', lucide:'food',     subcategories:{}},
  culture: {label:{es:'CULTURA',     en:'CULTURE',  pt:'CULTURA'},     color:'#5a52d8', lucide:'culture',  subcategories:{}},
  music:   {label:{es:'MÚSICA',      en:'MUSIC',    pt:'MÚSICA'},      color:'#c850a8', lucide:'music',    subcategories:{}},
  bar:     {label:{es:'BARES',       en:'BARS',     pt:'BARES'},       color:'#c87020', lucide:'bar',      subcategories:{}},
  art:     {label:{es:'ARTE',        en:'ART',      pt:'ARTE'},        color:'#0d9488', lucide:'art',      subcategories:{}},
  historic:{label:{es:'HISTÓRICO',   en:'HISTORIC', pt:'HISTÓRICO'},   color:'#7c4aed', lucide:'historic', subcategories:{}},
  shop:    {label:{es:'TIENDAS',     en:'SHOPS',    pt:'LOJAS'},       color:'#3a8c4f', lucide:'shop',     subcategories:{}},
};

/* [Etapa A, PLAN_CATEGORIAS_SUBCATEGORIAS.md] Cantidad de campos de
   idioma por categoría/subcategoría — hoy fija en 3 (ES/EN/PT),
   mínimo duro. El candado doble (mismo patrón que el ID de un pin,
   pin-adjust.js) para subirla vive en el admin (Etapa B, no
   implementado todavía). Persiste en settings/categories, ver
   js/settings-sync.js. */
let languageFieldsCount = 3;

/* [2026-08-29] POIS se carga desde Firestore, ya no arranca con
   semilla de datos de ejemplo — empieza vacío y se llena solo.
   Para el mapa público: por área visible del mapa, no todo de una
   (js/pins-viewport-loader.js → loadPinsInViewport(), llamado desde
   js/app.js). Para el panel Admin: TODO sin recorte
   (js/firestore-sync.js → loadPOISFromFirestore(), forzado en
   openAdmin(), js/admin.js — necesita ver cualquier pin exista o no
   en pantalla). */
let POIS = [];

/* [Etapa 5, PLAN_USUARIOS_EVENTOS.md] Colección `eventos` cacheada en
   memoria — se carga una sola vez al iniciar (ver
   js/eventos.js → loadEventosFromFirestore(), llamada desde
   js/app.js) y se mantiene sincronizada a mano cada vez que el admin
   crea/togglea/borra un evento (mismo archivo). La usan: el filtro
   "Eventos y actividades" del mapa (js/categories.js), el ciclo de
   vida de pines evento_temporal (js/eventos.js) y la pestaña
   "Eventos" del panel público de un pin (js/poi-panel.js). */
let EVENTOS = [];

let markers      = {};          // id → { leafletMarker, poi }
let activeFilter = 'all';

/* [Etapa D, PLAN_CATEGORIAS_SUBCATEGORIAS.md — sección 4]
   Segundo nivel del filtro, siempre subordinado a `activeFilter`:
   null = sin subcategoría elegida (se ven todos los pines de la
   categoría activa), o el id de una subcategoría puntual. Solo tiene
   sentido cuando `activeFilter` es el id de una categoría normal — se
   resetea a null en cualquier otro caso (ver updateFilterBar() y
   _pinMatchesActiveFilter() en categories.js). Decisión de Cris
   (06/09): la flecha ← siempre vuelve a 'all', nunca a la categoría
   sin subcategoría. */
let activeSubfilter = null;

/* [Filtro de fecha de eventos, 2026-09-03] Fecha elegida por el
   usuario ('YYYY-MM-DD') para resaltar en el mapa los pines con
   eventos ese día, o `null` si no hay fecha elegida. Solo tiene
   efecto visual cuando `activeFilter === '__eventos__'`. Ver
   js/eventos-fecha-filtro.js (lógica de matching + UI + settings
   admin) y su uso en js/categories.js (opacidad en el mapa) y
   js/poi-panel.js (tab por defecto + orden de la lista de eventos
   del pin). */
let fechaFiltroEventos = null;
let expandedId   = null;
let currentPoi   = null;
let pickCtx      = null;        // 'add' | 'edit'
let editingId    = null;
let pendingDelId = null;
let addEmoji     = '📍';
let editEmoji    = '📍';


