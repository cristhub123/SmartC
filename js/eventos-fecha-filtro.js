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
   (settings/filtroFechaEventos), plugin de la tab admin "Eventos" vía
   SC.registerTabPlugin.
   [FIX 2026-09-05] La sección de admin de este archivo vivía en la
   tab "Mapa" originalmente; el 04/09→05/09 el HTML se movió a la tab
   "Eventos" (index.html) pero este registro se quedó apuntando a
   'mapa' — como switchTab() solo dispara los plugins del tab que se
   abre, initFiltroFechaAdminTab() nunca corría al abrir "Eventos", así
   que el toggle y el campo de opacidad quedaban sin ningún listener
   enganchado (por eso no guardaba nada). Corregido más abajo.
   ═══════════════════════════════════════════════════════════ */

/* ── Settings editables desde Admin → Eventos ── */
let _filtroFechaSettings = {
  enabled: true,          // con esto en false, la feature se comporta como si no existiera
  opacidadReducida: 0.35, // opacidad (0 a 1) de lo que NO coincide con la fecha elegida
};

/* [FIX 2026-09-05 — bug real de huso horario, ver PLAN_TIMEZONE_CIUDADES.md]
   `ev.fecha_inicio`/`ev.fecha_fin` se guardan como ISO en UTC
   (js/eventos.js → _dateInputToIso: `new Date(v).toISOString()`).
   La versión anterior de este archivo recortaba a mano los primeros
   10 caracteres de ese string UTC asumiendo que ya eran el día local
   — Córdoba es UTC-3, así que cualquier evento cargado de noche
   (ej. 21hs en adelante) cruza la medianoche al convertirse a UTC y
   quedaba "un día después" del real. Por eso un pin con evento real
   ese día nunca matcheaba y quedaba atenuado en vez de a opacidad
   completa.
   Fix real: calcular el día calendario con el huso horario de la
   CIUDAD del evento (no el de quien mira la pantalla), usando
   Intl.DateTimeFormat (nativo, sin librerías — la Temporal API
   todavía no es viable acá, Safari no la soporta). Recibe el huso
   como parámetro, no hardcodeado: hoy todo pin es de Córdoba así que
   se usa CIUDAD_TIMEZONE_DEFAULT, pero el día que se sume otra ciudad
   (huso distinto, ej. Chile) alcanza con pasarle el huso real de ese
   pin — ver PLAN_TIMEZONE_CIUDADES.md para el plan completo de esa
   parte (todavía no implementada). */
const CIUDAD_TIMEZONE_DEFAULT = 'America/Argentina/Cordoba';

/** Cualquier fecha ('YYYY-MM-DD' sin hora, o ISO completo con hora)
 *  → día calendario 'YYYY-MM-DD' en el huso horario `tz` (default
 *  CIUDAD_TIMEZONE_DEFAULT). Un 'YYYY-MM-DD' sin hora ya representa
 *  un día elegido a propósito (ej. el del selector de fecha del
 *  filtro) — no se convierte de huso, se devuelve tal cual. */
function _diaCalendarioEnHuso(str, tz) {
  if (!str) return null;
  const s = String(str);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  // Locale 'en-CA' es un truco conocido: da directo formato YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || CIUDAD_TIMEZONE_DEFAULT,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}
window._diaCalendarioEnHuso = _diaCalendarioEnHuso;

/** ¿El evento `ev` ocurre en la fecha `fechaStr` ('YYYY-MM-DD')?
 *  Requiere `ev.activo === true` (mismo toggle base que
 *  `_eventoEsVigente`) y que `fechaStr` caiga dentro de
 *  [fecha_inicio, fecha_fin] (inclusive; sin fecha_fin = evento de 1
 *  solo día), comparado como día calendario en el huso `tz`. */
function _eventoOcurreEnFecha(ev, fechaStr, tz) {
  if (!ev || ev.activo !== true) return false;
  const target = _diaCalendarioEnHuso(fechaStr, tz);
  const inicio = _diaCalendarioEnHuso(ev.fecha_inicio, tz);
  if (!target || !inicio) return false;
  const fin = _diaCalendarioEnHuso(ev.fecha_fin, tz) || inicio;
  // Comparación de strings 'YYYY-MM-DD': ordena igual que las fechas.
  return target >= inicio && target <= fin;
}
window._eventoOcurreEnFecha = _eventoOcurreEnFecha; // usada también desde js/poi-panel.js

/** ¿El pin `poiId` tiene ≥1 evento que ocurre en `fechaStr`?
 *  `tz` es opcional (ver PLAN_TIMEZONE_CIUDADES.md) — hoy no se pasa
 *  desde ningún lado, así que siempre cae en CIUDAD_TIMEZONE_DEFAULT. */
function pinTieneEventoEnFecha(poiId, fechaStr, tz) {
  if (!_filtroFechaSettings.enabled || !fechaStr || typeof EVENTOS === 'undefined') return false;
  return EVENTOS.some(ev => ev.poi_id === poiId && _eventoOcurreEnFecha(ev, fechaStr, tz));
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
   ADMIN TAB — Eventos → sección "Filtro de fecha de eventos" (se
   suma como un plugin más de la tab 'eventos-admin' — SC.registerTabPlugin
   acumula, no reemplaza). [FIX 2026-09-05] Antes registrado en 'mapa',
   tab de la que esta sección ya no forma parte desde que se movió a
   Eventos (index.html) — ver nota al principio del archivo.
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
SC.registerTabPlugin('eventos-admin', initFiltroFechaAdminTab);
