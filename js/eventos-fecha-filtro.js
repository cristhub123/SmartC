/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/* ═══════════════════════════════════════════════════════════
   eventos-fecha-filtro.js — [Nueva feature, 2026-09-03]
   ---------------------------------------------------------------
   Filtro de fecha global para el mapa de eventos: con el filtro
   "Eventos" (__eventos__, categories.js) activo, el usuario elige 1
   fecha puntual y:
     1. En el mapa quedan a 100% opacidad los pines con ≥1 evento
        que ocurre ese día; el resto de los pines visibles bajo ese
        filtro quedan atenuados (opacidad configurable), sin
        ocultarse — aplicado en js/pin-visibility.js → applyPinVisibility()
        [reenganchado ahí el 2026-09-04, tras PLAN_VISIBILIDAD_PINES_UNIFICADA.md;
        antes vivía en categories.js → applyFilter(), que ese plan dejó
        delegando todo a pin-visibility.js].
     2. Al maximizar un pin con la fecha activa, el panel abre
        directo en la pestaña "Eventos" (en vez de "Info"), con los
        eventos de ese día arriba y el resto de los eventos del pin
        (otros días) debajo, atenuados — hooks en poi-panel.js.

   Decisión de matching confirmada con Cris: un evento "está" en la
   fecha elegida si esa fecha cae en cualquier día dentro del rango
   fecha_inicio → fecha_fin del evento (inclusive). Si el evento no
   tiene fecha_fin cargada, se toma como evento de 1 solo día.
   Distinto de `_eventoEsVigente` (js/eventos.js): ese chequea
   vigencia respecto a HOY; acá se chequea respecto a la fecha
   ELEGIDA por el usuario (puede ser pasada o futura).

   Sigue el mismo patrón que js/cluster-grouping.js: archivo nuevo
   dedicado, settings propios persistidos en Firestore
   (settings/filtroFechaEventos), plugin de la tab admin "Mapa" vía
   SC.registerTabPlugin.
   ═══════════════════════════════════════════════════════════ */

/* ── Settings editables desde Admin → Mapa ── */
let _filtroFechaSettings = {
  enabled: true,          // con esto en false, la feature se comporta como si no existiera
  opacidadReducida: 0.35, // opacidad (0 a 1) de lo que NO coincide con la fecha elegida
};

/** 'YYYY-MM-DD' (o un ISO completo) → Date a medianoche LOCAL.
 *  Evita el corrimiento de huso horario de `new Date('YYYY-MM-DD')`,
 *  que el motor parsea como UTC (podía correr el día en -3). */
function _fechaSoloDiaLocal(str) {
  if (!str) return null;
  const isoDatePart = String(str).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDatePart);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

/** ¿El evento `ev` ocurre en la fecha `fechaStr` ('YYYY-MM-DD')?
 *  Requiere `ev.activo === true` (mismo toggle base que
 *  `_eventoEsVigente`) y que `fechaStr` caiga dentro de
 *  [fecha_inicio, fecha_fin] (inclusive; sin fecha_fin = evento de 1
 *  solo día). */
function _eventoOcurreEnFecha(ev, fechaStr) {
  if (!ev || ev.activo !== true) return false;
  const target = _fechaSoloDiaLocal(fechaStr);
  const inicio = _fechaSoloDiaLocal(ev.fecha_inicio);
  if (!target || !inicio) return false;
  const fin = _fechaSoloDiaLocal(ev.fecha_fin) || inicio;
  return target.getTime() >= inicio.getTime() && target.getTime() <= fin.getTime();
}
window._eventoOcurreEnFecha = _eventoOcurreEnFecha; // usada también desde js/poi-panel.js

/** ¿El pin `poiId` tiene ≥1 evento que ocurre en `fechaStr`? */
function pinTieneEventoEnFecha(poiId, fechaStr) {
  if (!_filtroFechaSettings.enabled || !fechaStr || typeof EVENTOS === 'undefined') return false;
  return EVENTOS.some(ev => ev.poi_id === poiId && _eventoOcurreEnFecha(ev, fechaStr));
}
window.pinTieneEventoEnFecha = pinTieneEventoEnFecha;

/** Opacidad configurada para lo que no coincide con la fecha
 *  elegida — usada acá (mapa) y desde js/poi-panel.js (lista de
 *  eventos dentro del pin), una sola fuente de verdad. */
window.getOpacidadReducidaFiltroFecha = function() {
  const v = _filtroFechaSettings && _filtroFechaSettings.opacidadReducida;
  return (typeof v === 'number' && v >= 0 && v <= 1) ? v : 0.35;
};

/* ─────────────────────────────────────────
   UI — barra de fecha, aparece solo con el filtro "Eventos" activo
   ───────────────────────────────────────── */
function _renderFechaFiltroBar() {
  const bar = document.getElementById('eventos-fecha-bar');
  if (!bar) return;
  const eventosOn = typeof activeFilter !== 'undefined' && activeFilter === '__eventos__' && _filtroFechaSettings.enabled;
  bar.hidden = !eventosOn;
  if (!eventosOn) return;
  const input = document.getElementById('eventos-fecha-input');
  if (input && input.value !== (fechaFiltroEventos || '')) input.value = fechaFiltroEventos || '';
}

function _wireFechaFiltroBar() {
  const input = document.getElementById('eventos-fecha-input');
  const clearBtn = document.getElementById('eventos-fecha-clear');
  if (!input || !clearBtn || input.dataset.wired) return;
  input.dataset.wired = '1';

  function _onFechaChange(nuevaFecha) {
    fechaFiltroEventos = nuevaFecha || null;
    if (typeof applyFilter === 'function') applyFilter();
    // Si hay un pin abierto en ese momento, refleja la fecha nueva
    // en su pestaña de eventos sin que haga falta cerrarlo/abrirlo.
    if (window.PoiPanel && typeof window.PoiPanel.refresh === 'function') window.PoiPanel.refresh();
  }

  input.addEventListener('change', () => _onFechaChange(input.value));
  clearBtn.addEventListener('click', () => { input.value = ''; _onFechaChange(null); });
}

// updateFilterBar() (js/categories.js) llama a este hook cada vez que
// se re-pinta la barra de filtros (carga inicial + cada click de
// filtro) — un solo punto de entrada, sin duplicar acá el criterio
// de "cuándo mostrar la barra de fecha".
window._onFilterBarUpdated = function() {
  _wireFechaFiltroBar();
  _renderFechaFiltroBar();
};

/* ─────────────────────────────────────────
   PERSISTENCIA (Firestore settings/filtroFechaEventos) — mismo
   patrón que saveClusterSettings/loadClusterSettings.
   ───────────────────────────────────────── */
async function saveFiltroFechaSettings() {
  try {
    await db.collection('settings').doc('filtroFechaEventos').set(_filtroFechaSettings);
    return true;
  } catch (err) {
    console.error('No se pudo guardar la configuración del filtro de fecha:', err);
    toast('⚠️ No se guardó. ¿Iniciaste sesión?');
    return false;
  }
}
async function loadFiltroFechaSettings() {
  try {
    const doc = await db.collection('settings').doc('filtroFechaEventos').get();
    if (doc.exists) Object.assign(_filtroFechaSettings, doc.data());
  } catch (err) {
    console.warn('No se pudo cargar la configuración del filtro de fecha (se usan valores por defecto):', err);
  }
}
window.saveFiltroFechaSettings = saveFiltroFechaSettings;
window.loadFiltroFechaSettings = loadFiltroFechaSettings;

/* ─────────────────────────────────────────
   ADMIN TAB — Mapa → sección "Filtro de fecha de eventos" (se suma
   como un plugin más de la tab 'mapa', ver js/map-settings.js —
   SC.registerTabPlugin acumula, no reemplaza).
   ───────────────────────────────────────── */
function initFiltroFechaAdminTab() {
  const toggle = document.getElementById('fecha-filtro-enabled-toggle');
  const input  = document.getElementById('fecha-filtro-opacidad');
  if (!toggle || !input) return;

  toggle.checked = !!_filtroFechaSettings.enabled;
  input.value = window.getOpacidadReducidaFiltroFecha();

  if (toggle.dataset.wired) return;
  toggle.dataset.wired = '1';

  toggle.addEventListener('change', () => {
    _filtroFechaSettings.enabled = toggle.checked;
    if (!toggle.checked) fechaFiltroEventos = null; // apaga cualquier fecha ya elegida
    if (typeof applyFilter === 'function') applyFilter();
    _renderFechaFiltroBar();
    saveFiltroFechaSettings();
    toast(toggle.checked ? '🔵 Filtro de fecha activado' : '⭕ Filtro de fecha desactivado');
  });

  input.addEventListener('change', () => {
    const v = parseFloat(input.value);
    _filtroFechaSettings.opacidadReducida = (Number.isFinite(v) && v >= 0 && v <= 1) ? v : 0.35;
    input.value = _filtroFechaSettings.opacidadReducida;
    if (typeof applyFilter === 'function') applyFilter();
    saveFiltroFechaSettings();
  });
}
SC.registerTabPlugin('mapa', initFiltroFechaAdminTab);
