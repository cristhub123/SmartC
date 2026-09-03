/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/* ═══════════════════════════════════════════
   CLUSTERING VISUAL DE PINES
   ---------------------------------------------
   [NUEVO 2026-08-29] Agrupa pines en burbujas con un número (tipo
   streetartcities.com) con UNA sola regla, pedida explícitamente por
   Cris: "en pantalla no puede haber más de X pines/burbujas
   simultáneamente, sin importar la distancia real entre ellos". Esto
   es DISTINTO de un clustering por radio fijo en píxeles (ese
   enfoque, descartado, podía dejar cientos de pines visibles a la
   vez si estaban apenas más separados que el radio — nada eficiente
   si algún día hay miles de pines apretados en un área chica). Acá
   en cambio el número máximo de pines visibles simultáneamente es
   la ÚNICA perilla editable, y el algoritmo ajusta solo qué tan
   agresivo agrupar para nunca superar ese techo.

   CÓMO — liviano a propósito (pedido explícito de Cris: seguridad
   sin perder liviandad): en vez de comparar cada pin contra todos
   los demás (O(n²), pesado si hay miles), se usa "grid clustering":
   se pone una grilla invisible sobre la pantalla (celdas de
   `cellSize` píxeles) y cada pin cae en la celda que le toca según
   su posición en pantalla — todos los pines de una misma celda
   se agrupan juntos. Armar esa grilla es O(n), una sola pasada.
   Si el resultado todavía tiene más grupos que el máximo permitido,
   se agranda el tamaño de celda (x1.6) y se vuelve a agrupar — unas
   pocas pasadas (nunca más de ~15) hasta entrar dentro del límite.
   Cada pasada es rápida (O(n)), así que el total sigue siendo
   liviano aunque haya muchos pines.

   IMPORTANTE — por qué NO se usó Leaflet.markercluster (la librería
   estándar): esa librería REEMPLAZA cómo se agregan los marcadores
   al mapa (los mete a un layer group propio en vez de `.addTo(map)`
   directo), y buena parte de la lógica ya existente de este
   proyecto (wirePinImageFallback, el criterio visual de
   poi.active===false, el swap a imagen full-quality al maximizar,
   el z-index manual al expandir un pin) depende de que el <div
   id="pw-{id}"> de CADA pin exista en el DOM apenas se llama a
   makeMarker(), sin importar si está agrupado o no. Meterlo dentro
   de esa librería rompía esas partes (el DOM de un pin agrupado no
   se crea hasta que se desagrupa). Esta implementación en cambio:
   deja `makeMarker()`/`removeMarker()` 100% intactos (cada pin se
   crea siempre igual, individual, con su DOM de siempre) y solo
   OCULTA visualmente (mismo mecanismo ya usado por togglePoi() en
   app.js: `parent.style.visibility = 'hidden'`) los pines que caen
   dentro de un grupo, mostrando en su lugar una burbuja-marcador
   nueva con el número. Nada del resto del proyecto se entera de la
   diferencia.
═══════════════════════════════════════════ */

const _clusterSettings = {
  enabled: true,
  maxOnScreen: 30, // techo duro: nunca se ven más de esta cantidad de pines/burbujas juntos, sin importar qué tan cerca o lejos estén entre sí
};

let _clusterBubbles = {};   // id de grupo → L.marker (burbuja)
let _clusterHiddenIds = []; // ids de POI ocultos por ESTA función en el último recompute (para poder restaurarlos, sin tocar los ocultos por poi.active===false)
let _clusterRecomputeTimer = null;

/* Debounce simple: colapsa muchas llamadas seguidas (ej. el forEach
   de POIS.forEach(makeMarker) en app.js, o varios zoomend/moveend
   seguidos) en un solo recálculo. */
function scheduleClusterRecompute() {
  if (_clusterRecomputeTimer) clearTimeout(_clusterRecomputeTimer);
  _clusterRecomputeTimer = setTimeout(() => {
    _clusterRecomputeTimer = null;
    computeAndRenderClusters();
  }, 60);
}
window.scheduleClusterRecompute = scheduleClusterRecompute;

function _clearClusterBubbles() {
  Object.keys(_clusterBubbles).forEach(k => {
    try { _clusterBubbles[k].remove(); } catch (e) { /* noop */ }
  });
  _clusterBubbles = {};
}

function _restoreHiddenByCluster() {
  _clusterHiddenIds.forEach(id => {
    const el = document.getElementById('pw-' + id);
    const parent = el && el.parentElement;
    if (parent) parent.style.visibility = '';
  });
  _clusterHiddenIds = [];
}

function _clusterBubbleIcon(count) {
  const size = count < 10 ? 42 : (count < 50 ? 50 : 58);
  const fontSize = count < 100 ? 14 : 12;
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;
      background:var(--accent,#3a8c4f);border:3px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;
      justify-content:center;color:#fff;font-family:'JetBrains Mono',monospace;
      font-weight:700;font-size:${fontSize}px;cursor:pointer">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/* Agrupa `pts` (cada uno con .px = posición en píxeles de pantalla)
   en una grilla de celdas de `cellSize` px — O(n), una sola pasada.
   Todos los puntos que caen en la misma celda quedan en el mismo
   grupo. Es una aproximación (no es "los N más cercanos exactos"),
   pero es el precio a pagar por mantenerlo liviano — y para el
   objetivo real (bajar la cantidad de imágenes/DOM visibles a la
   vez) es más que suficiente. */
function _gridGroups(pts, cellSize) {
  const buckets = new Map();
  pts.forEach(p => {
    const col = Math.floor(p.px.x / cellSize);
    const row = Math.floor(p.px.y / cellSize);
    const key = col + '_' + row;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(p);
  });
  return Array.from(buckets.values());
}

/* Recorre `markers` (config.js), arma la grilla, y si el número de
   grupos resultante supera `maxOnScreen` agranda la celda y
   reintenta — hasta cumplir el techo o llegar a un tamaño de celda
   absurdo (techo de seguridad `MAX_CELL`, evita loop infinito si
   por algún motivo nunca se puede cumplir el límite). Solo agrupa
   pines ACTIVOS (los inactivos ni entran como candidatos — quedan
   como estaban, ocultos por poi.active===false, sin que esta
   función los toque). */
function computeAndRenderClusters() {
  _clearClusterBubbles();
  _restoreHiddenByCluster();

  if (!_clusterSettings.enabled) return;
  if (typeof map === 'undefined' || typeof markers === 'undefined') return;

  const candidates = Object.keys(markers)
    .map(id => markers[id])
    .filter(entry => entry && entry.poi
      && entry.poi.active !== false
      && typeof entry.poi.lat === 'number'
      && typeof entry.poi.lng === 'number'
      && !Number.isNaN(entry.poi.lat)
      && !Number.isNaN(entry.poi.lng)
      // [FIX 2026-09-02] El pin actualmente agrandado (click del usuario,
      // ver markers.js/expandPin) nunca debe poder terminar agrupado
      // dentro de un cluster — si el paneo hacia ese pin (panToPoiCenter)
      // dispara este recompute y el pin cae en la misma celda que otro
      // vecino, quedaba oculto (visibility:hidden) justo después de
      // agrandarse, dando la sensación de "se metió en un cluster y no
      // abrió". Se excluye de los candidatos: se deja siempre visible,
      // aunque eso implique que momentáneamente haya 1 pin más en pantalla
      // que el techo `maxOnScreen` (caso excepcional, un solo pin, no
      // rompe el objetivo real del límite).
      && entry.poi.id !== (typeof expandedId !== 'undefined' ? expandedId : null));

  if (candidates.length < 2) return;

  // [FIX 2026-09-02] Antes se usaba map.latLngToContainerPoint(...), que
  // da la posición en píxeles RELATIVA AL VIEWPORT (pantalla). Esa grilla
  // queda anclada a la pantalla, no al mapa: al panear, todos los pines
  // se corren la misma distancia en píxeles de pantalla, pero como cada
  // celda se calcula con Math.floor(px/cellSize), ese corrimiento parejo
  // puede hacer que algunos pines crucen el borde de su celda y otros no
  // (según en qué punto del ciclo de celda estaba cada uno) — reagrupando
  // el mismo conjunto de pines sin que su posición relativa real haya
  // cambiado. map.project(latlng, zoom) da en cambio la posición en
  // píxeles de MUNDO al zoom actual: estable ante cualquier paneo, solo
  // cambia con el zoom (que es el comportamiento pedido: "acercate y se
  // separan").
  const zoom = map.getZoom();
  const pts = candidates.map(entry => ({
    entry,
    px: map.project([entry.poi.lat, entry.poi.lng], zoom),
  }));

  const maxOnScreen = _clusterSettings.maxOnScreen || 30;
  const MIN_CELL = 40;  // px — pines prácticamente pegados ya se agrupan desde acá
  const MAX_CELL = 4000; // techo de seguridad, evita loop infinito en un caso límite

  let cellSize = MIN_CELL;
  let groups = _gridGroups(pts, cellSize);
  while (groups.length > maxOnScreen && cellSize < MAX_CELL) {
    cellSize *= 1.6;
    groups = _gridGroups(pts, cellSize);
  }

  groups.forEach((group, idx) => {
    if (group.length === 1) return; // pin suelto: se deja visible tal cual, sin burbuja

    group.forEach(({ entry }) => {
      const el = document.getElementById('pw-' + entry.poi.id);
      const parent = el && el.parentElement;
      if (parent) parent.style.visibility = 'hidden';
      _clusterHiddenIds.push(entry.poi.id);
    });

    const lat = group.reduce((s, g) => s + g.entry.poi.lat, 0) / group.length;
    const lng = group.reduce((s, g) => s + g.entry.poi.lng, 0) / group.length;
    const count = group.length;

    const bubble = L.marker([lat, lng], {
      icon: _clusterBubbleIcon(count),
      zIndexOffset: 500000, // siempre por encima de cualquier pin individual
    }).addTo(map);

    bubble.on('click', () => {
      const bounds = L.latLngBounds(group.map(g => [g.entry.poi.lat, g.entry.poi.lng]));
      // [FIX 2026-09-02] Antes era map.fitBounds(...) — cuando el grupo
      // son pines muy pegados entre sí (bounds geográficos chicos),
      // Leaflet necesita saltar casi directo a maxZoom para encuadrarlos.
      // fitBounds anima ese salto con el mecanismo normal de zoom
      // (setView), que tiene un techo interno (zoomAnimationThreshold,
      // default 4 niveles): si el salto de zoom necesario lo supera,
      // Leaflet CANCELA la animación de zoom (solo anima el paneo) y
      // aplica el zoom de golpe al final — de ahí el "paneo suave, y de
      // repente pantalla mega-zoomeada". flyToBounds usa el mecanismo de
      // "vuelo" animado (Van Wijk), pensado justo para saltos grandes de
      // zoom, y siempre queda suave sin importar la distancia — mismos
      // parámetros (bounds/padding/maxZoom), sin perder nada del ajuste.
      map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 19 });
    });

    _clusterBubbles['cb-' + idx] = bubble;
  });
}
window.computeAndRenderClusters = computeAndRenderClusters;

// Recalcular al mover/hacer zoom del mapa (mismo criterio de
// "acercate y se separan" pedido explícitamente).
if (typeof map !== 'undefined') {
  map.on('zoomend moveend', scheduleClusterRecompute);
}

/* ─────────────────────────────────────────
   PERSISTENCIA (Firestore settings/clustering) — mismo patrón que
   saveMapSettings/loadMapSettings en settings-sync.js.
   ───────────────────────────────────────── */
async function saveClusterSettings() {
  try {
    await db.collection('settings').doc('clustering').set(_clusterSettings);
    return true;
  } catch (err) {
    console.error('No se pudo guardar la configuración de clustering:', err);
    toast('⚠️ No se guardó el clustering. ¿Iniciaste sesión?');
    return false;
  }
}

async function loadClusterSettings() {
  try {
    const doc = await db.collection('settings').doc('clustering').get();
    if (doc.exists) Object.assign(_clusterSettings, doc.data());
  } catch (err) {
    console.warn('No se pudo cargar la configuración de clustering guardada (se usan valores por defecto):', err);
  }
}
window.saveClusterSettings = saveClusterSettings;
window.loadClusterSettings = loadClusterSettings;

/* ─────────────────────────────────────────
   ADMIN TAB — Mapa → sección "Agrupación de pines"
   (se suma como un plugin más de la tab 'mapa', ver
   js/map-settings.js — SC.registerTabPlugin acumula, no
   reemplaza)
   ───────────────────────────────────────── */
function initClusterAdminTab() {
  const toggle = document.getElementById('cluster-enabled-toggle');
  const input  = document.getElementById('cluster-max-onscreen');
  if (!toggle || !input) return;

  toggle.checked = !!_clusterSettings.enabled;
  input.value = _clusterSettings.maxOnScreen || 30;

  if (toggle.dataset.wired) return;
  toggle.dataset.wired = '1';

  toggle.addEventListener('change', () => {
    _clusterSettings.enabled = toggle.checked;
    scheduleClusterRecompute();
    saveClusterSettings();
    toast(toggle.checked ? '🔵 Clustering activado' : '⭕ Clustering desactivado');
  });

  input.addEventListener('change', () => {
    const v = parseInt(input.value, 10);
    _clusterSettings.maxOnScreen = (Number.isFinite(v) && v > 0) ? v : 30;
    input.value = _clusterSettings.maxOnScreen;
    scheduleClusterRecompute();
    saveClusterSettings();
  });
}
SC.registerTabPlugin('mapa', initClusterAdminTab);
