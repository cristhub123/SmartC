/*
AI PROJECT NOTE — LECTURA OBLIGATORIA PARA CUALQUIER IA:
Antes de modificar este archivo, toda IA (Claude, ChatGPT u otra) DEBE
leer primero /AI_RULES.md completo. Sin excepcion, sin importar cuan
chico o simple parezca el cambio, y sin esperar a que el usuario lo
pida o lo recuerde — esta nota es la instruccion, no un recordatorio
opcional. Si /AI_RULES.md ya se leyo en esta misma sesion, alcanza con
revisar /AI_SESSION.md en su lugar.

Despues de modificar este archivo, actualizar /AI_SESSION.md con el
cambio hecho y la verificacion realizada.
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

   [Etapa 14, PLAN_USUARIOS_EVENTOS.md, 2026-09-28] El `<input
   type="date">` nativo de la barra se reemplazó por un botón que abre
   un popover con el calendario propio (js/calendario-eventos.js,
   componente compartido, ver nota de cabecera de ese archivo) —
   soporta día puntual o rango de 2 clicks. `fechaFiltroEventos`
   (js/config.js) sigue siendo el día puntual o el INICIO del rango;
   se sumó `fechaFiltroEventosHasta` (mismo archivo) para el FIN, o
   `null` si la selección es un día puntual. `_eventoOcurreEnFecha`/
   `pinTieneEventoEnFecha` se extendieron (no se reimplementó la
   comparación en otro lado) para aceptar un 4to parámetro `hastaStr`
   opcional — sin él se comportan exactamente igual que antes.
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

/** ¿El evento `ev` ocurre en la fecha `fechaStr` ('YYYY-MM-DD'), o
 *  (si se pasa `hastaStr`) en algún día dentro del RANGO [fechaStr,
 *  hastaStr] (ambos inclusive)? [Etapa 14, 2026-09-28] `hastaStr` es
 *  opcional — sin él, se comporta exactamente igual que antes (día
 *  puntual). Con él, en vez de comparar un solo día compara si el
 *  rango del evento ([fecha_inicio, fecha_fin]) se superpone con el
 *  rango elegido — misma función extendida, no una comparación nueva
 *  en otro lado (ver nota de cabecera del archivo). Requiere
 *  `ev.activo === true` (mismo toggle base que `_eventoEsVigente`);
 *  todo comparado como día calendario en el huso `tz`. */
function _eventoOcurreEnFecha(ev, fechaStr, tz, hastaStr) {
  if (!ev || ev.activo !== true) return false;
  const desdeSel = _diaCalendarioEnHuso(fechaStr, tz);
  const inicioEv = _diaCalendarioEnHuso(ev.fecha_inicio, tz);
  if (!desdeSel || !inicioEv) return false;
  const finEv = _diaCalendarioEnHuso(ev.fecha_fin, tz) || inicioEv;
  const hastaCalc = hastaStr ? _diaCalendarioEnHuso(hastaStr, tz) : null;
  const hastaSel = (hastaCalc && hastaCalc >= desdeSel) ? hastaCalc : desdeSel;
  // Comparación de strings 'YYYY-MM-DD': ordena igual que las fechas.
  // Superposición de 2 rangos [a1,a2] y [b1,b2]: a1<=b2 && a2>=b1.
  // Con hastaSel === desdeSel (caso día puntual) es exactamente la
  // comparación de antes: inicioEv <= target && finEv >= target.
  return inicioEv <= hastaSel && finEv >= desdeSel;
}
window._eventoOcurreEnFecha = _eventoOcurreEnFecha; // usada también desde js/poi-panel.js

/** ¿El pin `poiId` tiene ≥1 evento que ocurre en `fechaStr` (día
 *  puntual) o en el rango [fechaStr, hastaStr] (Etapa 14, `hastaStr`
 *  opcional)? `tz` es opcional (ver PLAN_TIMEZONE_CIUDADES.md) — hoy
 *  no se pasa desde ningún lado, así que siempre cae en
 *  CIUDAD_TIMEZONE_DEFAULT. */
function pinTieneEventoEnFecha(poiId, fechaStr, tz, hastaStr) {
  if (!_filtroFechaSettings.enabled || !fechaStr || typeof EVENTOS === 'undefined') return false;
  return EVENTOS.some(ev => ev.poi_id === poiId && _eventoOcurreEnFecha(ev, fechaStr, tz, hastaStr));
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
   UI — barra de fecha, aparece solo con el filtro "Eventos" activo.
   [Etapa 14, 2026-09-28] El `<input type="date">` nativo se reemplazó
   por un botón (mismo lenguaje visual que los botones de categoría:
   círculo + ícono) que abre un popover con el calendario propio
   (js/calendario-eventos.js, componente compartido — no se programa
   dos veces, ver nota de cabecera de ese archivo; la Etapa 15 lo va a
   reusar igual). El popover se registra en OverlayManager como
   cualquier otro menú flotante nuevo (ver AI_RULES.md sección 11).
   ───────────────────────────────────────── */
let _calendarioFecha = null; // instancia CalendarioEventos.mount(), una sola vez

function _fechaFiltroActiva() {
  return typeof activeFilter !== 'undefined' && activeFilter === '__eventos__' && _filtroFechaSettings.enabled;
}

function _popoverAbierto() {
  const pop = document.getElementById('eventos-fecha-popover');
  return !!pop && !pop.hidden;
}

function _cerrarPopoverFecha() {
  const pop = document.getElementById('eventos-fecha-popover');
  const btn = document.getElementById('eventos-fecha-btn');
  if (pop) pop.hidden = true;
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function _abrirPopoverFecha() {
  const pop = document.getElementById('eventos-fecha-popover');
  const btn = document.getElementById('eventos-fecha-btn');
  if (!pop || !btn) return;
  if (_calendarioFecha) _calendarioFecha.setValue(fechaFiltroEventos, fechaFiltroEventosHasta);
  pop.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
}

function _renderChipFecha() {
  const chip = document.getElementById('eventos-fecha-chip');
  const texto = document.getElementById('eventos-fecha-chip-text');
  const btn = document.getElementById('eventos-fecha-btn');
  if (!chip || !texto || !btn) return;
  const hay = !!fechaFiltroEventos;
  chip.hidden = !hay;
  btn.classList.toggle('is-active', hay);
  if (hay && window.CalendarioEventos) {
    texto.textContent = CalendarioEventos.formatRango(fechaFiltroEventos, fechaFiltroEventosHasta);
  }
}

/* Punto de entrada "en frío": muestra/oculta la barra entera según
 * corresponda y deja el chip al día con la selección actual — se
 * llama seguido (cada refresco de la fila de filtros), tiene que ser
 * barata e idempotente, igual que updateFilterBar(). */
function _renderFechaFiltroBar() {
  const bar = document.getElementById('eventos-fecha-bar');
  if (!bar) return;
  const eventosOn = _fechaFiltroActiva();
  bar.hidden = !eventosOn;
  if (!eventosOn) { _cerrarPopoverFecha(); return; }
  _renderChipFecha();
}

function _wireFechaFiltroBar() {
  const btn = document.getElementById('eventos-fecha-btn');
  const clearBtn = document.getElementById('eventos-fecha-clear');
  const pop = document.getElementById('eventos-fecha-popover');
  if (!btn || !clearBtn || !pop || btn.dataset.wired) return;
  btn.dataset.wired = '1';

  function _aplicar(desde, hasta) {
    fechaFiltroEventos = desde || null;
    fechaFiltroEventosHasta = (desde && hasta) ? hasta : null;
    _renderChipFecha();
    if (typeof applyFilter === 'function') applyFilter();
    // Si hay un pin abierto en ese momento, refleja la fecha nueva en
    // su pestaña de eventos sin que haga falta cerrarlo/abrirlo.
    if (window.PoiPanel && typeof window.PoiPanel.refresh === 'function') window.PoiPanel.refresh();
  }

  // Registro en OverlayManager: mismo patrón que 'zonasDropdown'/
  // 'zonaInfoPanel' — este popover no tiene la secuencia escalonada
  // propia que sí tiene cluster.js, así que usa beforeOpen normal.
  if (window.OverlayManager) {
    OverlayManager.register('fechaCalendarioPopover', { isOpen: _popoverAbierto, close: _cerrarPopoverFecha });
  }

  if (window.CalendarioEventos && !_calendarioFecha) {
    _calendarioFecha = CalendarioEventos.mount(pop, {
      desde: fechaFiltroEventos,
      hasta: fechaFiltroEventosHasta,
      onConfirm({ desde, hasta }) { _aplicar(desde, hasta); _cerrarPopoverFecha(); },
      onClear() { _aplicar(null, null); },
    });
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (_popoverAbierto()) { _cerrarPopoverFecha(); return; }
    if (window.OverlayManager) OverlayManager.beforeOpen('fechaCalendarioPopover', _abrirPopoverFecha);
    else _abrirPopoverFecha();
  });
  clearBtn.addEventListener('click', (e) => { e.stopPropagation(); _aplicar(null, null); });
  // Tocar fuera del popover (pero dentro de la barra) lo cierra sin
  // tocar el filtro elegido — el propio botón ya maneja su click.
  document.addEventListener('click', (e) => {
    if (!_popoverAbierto()) return;
    if (pop.contains(e.target) || btn.contains(e.target)) return;
    _cerrarPopoverFecha();
  });
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
    if (!toggle.checked) { fechaFiltroEventos = null; fechaFiltroEventosHasta = null; } // apaga cualquier fecha ya elegida
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
