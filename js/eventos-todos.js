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
   eventos-todos.js — [Etapa 15, PLAN_USUARIOS_EVENTOS.md, 2026-09-29]
   ---------------------------------------------------------------
   CONTENIDO del panel "Todos los eventos". El panel en sí NO es uno
   nuevo: es el mismo `PoiPanel` (js/poi-panel.js) en "modo todos"
   (`PoiPanel.openTodosEventos()`), que abre directo en 'full' y
   delega acá el armado de lo que va adentro:
     - barra de búsqueda: texto libre + botón de calendario (reusa
       `CalendarioEventos`, Etapa 14, sin reimplementarlo) que
       despliega el calendario inline dentro del propio panel;
     - grilla de tarjetas de `EventoCard` (Etapa 12, una sola función
       de render) con los eventos de TODOS los pines.
   Fuente de datos: `EVENTOS` (js/config.js, caché global — no se
   dispara ninguna query nueva). Criterios reusados, no duplicados:
     - "vigente": `_eventoEsVigente` (js/eventos.js);
     - "ocurre en la fecha/rango": `_eventoOcurreEnFecha`
       (js/eventos-fecha-filtro.js).
   Sin fecha elegida → eventos vigentes. Con fecha o rango elegido →
   los que ocurren ese día/rango (aunque ya no sean vigentes respecto
   de hoy), igual que el filtro de fecha del mapa.
   El filtro de acá es PROPIO del panel (texto + fecha del buscador):
   NO toca `fechaFiltroEventos`/`fechaFiltroEventosHasta` (el filtro
   global del mapa) ni el filtro de categorías.

   Tocar una tarjeta abre el panel de ESE lugar, en su pestaña
   "Eventos" (`abrirLugarDeEvento`). El ícono 📍 de la tarjeta sigue
   siendo solo "centrar el mapa" (lo maneja EventoCard).

   API: window.EventosTodos = { render(contenedor), refresh(),
        abrirLugarDeEvento(poiId) }
   ═══════════════════════════════════════════════════════════ */

window.EventosTodos = (function () {
  'use strict';

  const _t = (k) => (window.I18N ? I18N.t(k) : k);
  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  /** Minúsculas y sin tildes, para que "cafe" encuentre "Café". */
  function _norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  // Estado del buscador — se conserva entre aperturas del panel (volver
  // desde un lugar y encontrar la búsqueda como se dejó).
  const _estado = { q: '', desde: null, hasta: null };
  let _root = null;      // contenedor que entrega PoiPanel
  let _els = null;       // referencias a los nodos armados
  let _calendario = null;
  let _visibleEnPanel = [];   // eventos hoy pintados (para resolver el click de una tarjeta)
  let _debounce = null;

  // ── Datos ────────────────────────────────────────────────

  /** id → pin, de lo que hay en memoria (con la carga por viewport un
   *  pin lejano puede no estar: en ese caso el evento igual se lista). */
  function _mapaDePines() {
    const m = {};
    if (typeof POIS !== 'undefined' && Array.isArray(POIS)) POIS.forEach(p => { if (p && p.id) m[p.id] = p; });
    if (window.AppState && typeof AppState.getPois === 'function') {
      (AppState.getPois() || []).forEach(p => { if (p && p.id) m[p.id] = p; });
    }
    return m;
  }

  function _catalogo() {
    const cfg = window._eventosConfigCache;
    return (cfg && Array.isArray(cfg.categoriasEvento)) ? cfg.categoriasEvento : [];
  }

  function _fechaOrden(ev) {
    const f = ev.fecha_fin || ev.fecha_inicio;
    const d = f ? new Date(f).getTime() : NaN;
    return isNaN(d) ? Infinity : d;
  }

  function _textoBuscable(ev, poi, catalogo) {
    const tags = (ev.tags || []).map(id => (catalogo.find(c => c.id === id) || {}).label || id);
    return _norm([
      ev.nombre, ev.descripcion, ev.direccion, ev.horario,
      poi && poi.name, tags.join(' '),
    ].filter(Boolean).join(' '));
  }

  /** Eventos que corresponden al estado actual del buscador. */
  function _calcularLista() {
    const todos = (typeof EVENTOS !== 'undefined' && Array.isArray(EVENTOS)) ? EVENTOS : [];
    const pines = _mapaDePines();
    const catalogo = _catalogo();
    const q = _norm(_estado.q);
    const conFecha = !!_estado.desde;

    const lista = todos.filter(ev => {
      if (!ev) return false;
      // Un evento de un pin desactivado no debe verse (mismo criterio
      // que el filtro del mapa: nunca reaparece un pin apagado).
      const poi = pines[ev.poi_id];
      if (poi && poi.active === false) return false;
      const entra = conFecha
        ? (typeof _eventoOcurreEnFecha === 'function' && _eventoOcurreEnFecha(ev, _estado.desde, undefined, _estado.hasta))
        : (typeof _eventoEsVigente === 'function' && _eventoEsVigente(ev));
      if (!entra) return false;
      if (q && !_textoBuscable(ev, poi, catalogo).includes(q)) return false;
      return true;
    });
    // El que antes vence (o antes empieza) va arriba; sin fechas, al final.
    return lista.sort((a, b) => _fechaOrden(a) - _fechaOrden(b));
  }

  // ── UI ───────────────────────────────────────────────────

  function _armar(root) {
    root.innerHTML = `
      <div class="todos-ev">
        <div class="todos-ev__search">
          <input type="search" class="todos-ev__input" data-role="q" autocomplete="off" enterkeyhint="search">
          <button type="button" class="todos-ev__cal-btn" data-role="cal-btn" aria-expanded="false">
            <span class="todos-ev__cal-ico">${(typeof LUCIDE !== 'undefined' && LUCIDE.calendar) || '📅'}</span>
            <span class="todos-ev__cal-txt" data-role="cal-txt"></span>
          </button>
          <button type="button" class="todos-ev__cal-x" data-role="cal-x" hidden>✕</button>
        </div>
        <div class="todos-ev__cal" data-role="cal" hidden></div>
        <div class="todos-ev__grid" data-role="grid"></div>
        <p class="todos-ev__vacio" data-role="vacio" hidden></p>
      </div>`;
    _els = {
      q: root.querySelector('[data-role="q"]'),
      calBtn: root.querySelector('[data-role="cal-btn"]'),
      calTxt: root.querySelector('[data-role="cal-txt"]'),
      calX: root.querySelector('[data-role="cal-x"]'),
      cal: root.querySelector('[data-role="cal"]'),
      grid: root.querySelector('[data-role="grid"]'),
      vacio: root.querySelector('[data-role="vacio"]'),
    };

    _els.q.addEventListener('input', () => {
      _estado.q = _els.q.value;
      clearTimeout(_debounce);
      _debounce = setTimeout(_pintarLista, 150);
    });

    _els.calBtn.addEventListener('click', () => _toggleCalendario());
    _els.calX.addEventListener('click', () => _aplicarFecha(null, null, true));

    // Calendario propio de la Etapa 14, montado inline (no popover).
    if (window.CalendarioEventos) {
      _calendario = CalendarioEventos.mount(_els.cal, {
        desde: _estado.desde,
        hasta: _estado.hasta,
        onConfirm({ desde, hasta }) { _aplicarFecha(desde, hasta, false); _toggleCalendario(false); },
        onClear() { _aplicarFecha(null, null, false); },
      });
    }

    // Tarjetas: 📍 y foto rota los maneja EventoCard; el resto del click
    // sobre la tarjeta abre el panel del lugar.
    if (window.EventoCard) EventoCard.bind(_els.grid);
    _els.grid.addEventListener('click', (e) => {
      if (e.target.closest && e.target.closest('[data-evento-locate]')) return;
      const card = e.target.closest && e.target.closest('.evento-card');
      if (!card || !_els.grid.contains(card)) return;
      const ev = _visibleEnPanel.find(x => String(x.id || '') === card.dataset.eventoId);
      if (ev && ev.poi_id) abrirLugarDeEvento(ev.poi_id);
    });
  }

  function _toggleCalendario(forzar) {
    if (!_els) return;
    const abrir = (typeof forzar === 'boolean') ? forzar : _els.cal.hidden;
    _els.cal.hidden = !abrir;
    _els.calBtn.setAttribute('aria-expanded', abrir ? 'true' : 'false');
    if (abrir && _calendario) _calendario.setValue(_estado.desde, _estado.hasta);
  }

  function _aplicarFecha(desde, hasta, actualizarCalendario) {
    _estado.desde = desde || null;
    _estado.hasta = (desde && hasta) ? hasta : null;
    if (actualizarCalendario && _calendario) _calendario.setValue(_estado.desde, _estado.hasta);
    _pintarChrome();
    _pintarLista();
  }

  /** Textos que dependen del idioma y del estado (placeholder, botón de fecha). */
  function _pintarChrome() {
    if (!_els) return;
    _els.q.placeholder = _t('todos_buscar_ph');
    _els.q.setAttribute('aria-label', _t('todos_buscar_ph'));
    const hayFecha = !!_estado.desde;
    _els.calTxt.textContent = hayFecha && window.CalendarioEventos
      ? CalendarioEventos.formatRango(_estado.desde, _estado.hasta)
      : _t('fbtn_fecha_label');
    _els.calBtn.classList.toggle('has-value', hayFecha);
    _els.calBtn.setAttribute('aria-label', _t('eventos_fecha_aria'));
    _els.calX.hidden = !hayFecha;
    _els.calX.setAttribute('aria-label', _t('eventos_fecha_clear_title'));
    _els.calX.title = _t('eventos_fecha_clear_title');
  }

  function _pintarLista() {
    if (!_els) return;
    const lista = _calcularLista();
    _visibleEnPanel = lista;
    const catalogo = _catalogo();
    _els.grid.innerHTML = window.EventoCard
      ? lista.map(ev => EventoCard.render(ev, { catalogo })).join('')
      : '';
    const filtrando = !!(_estado.q.trim() || _estado.desde);
    _els.vacio.hidden = lista.length > 0;
    _els.vacio.textContent = filtrando ? _t('todos_vacio_filtro') : _t('todos_vacio');
    _els.grid.hidden = lista.length === 0;
  }

  // ── API ──────────────────────────────────────────────────

  /** Arma (la 1ª vez) o repinta el contenido dentro de `contenedor`. */
  function render(contenedor) {
    if (!contenedor) return;
    if (_root !== contenedor || !_els) {
      _root = contenedor;
      _calendario = null;
      _armar(contenedor);
    }
    _els.q.value = _estado.q;
    _pintarChrome();
    if (_calendario) _calendario.refresh();
    _pintarLista();
  }

  /** Repinta con el estado actual (ej. cambió el idioma o llegaron eventos). */
  function refresh() {
    if (!_root || !_els) return;
    _pintarChrome();
    if (_calendario) _calendario.refresh();
    _pintarLista();
  }

  /** Cierra este panel y abre el del lugar del evento, en su pestaña
   *  "Eventos". Reusa `pinClick` (js/cluster.js): mismo recorrido que un
   *  toque en el pin (centrar mapa → maximizar pin → abrir panel). Si el
   *  pin todavía no está dibujado (carga por viewport), se crea al vuelo
   *  con el índice de búsqueda — mismo criterio que el buscador
   *  (js/app.js, "Live search"). */
  async function abrirLugarDeEvento(poiId) {
    if (!poiId) return;
    if (window.PoiPanel && typeof PoiPanel.requestTab === 'function') PoiPanel.requestTab('eventos');
    try {
      if (typeof markers === 'undefined' || !markers[poiId]) {
        let poi = (typeof POIS !== 'undefined' ? POIS.find(p => p.id === poiId) : null) || null;
        if (!poi && typeof loadSearchIndex === 'function') {
          const idx = await loadSearchIndex();
          poi = (idx || []).find(p => p.id === poiId) || null;
        }
        if (!poi || typeof poi.lat !== 'number' || typeof poi.lng !== 'number') {
          console.warn('[EventosTodos] el lugar del evento no se pudo cargar:', poiId);
          if (typeof toast === 'function') toast('⚠️ ' + _t('todos_lugar_no_disponible'));
          return;
        }
        if (typeof POIS !== 'undefined' && !POIS.find(p => p.id === poiId)) POIS.push(poi);
        makeMarker(poi);
        if (typeof map !== 'undefined') map.setView([poi.lat, poi.lng], Math.max(map.getZoom(), 16));
      }
      pinClick(poiId);
    } catch (err) {
      console.error('[EventosTodos] no se pudo abrir el lugar', poiId, err);
    }
  }

  return { render, refresh, abrirLugarDeEvento };
})();
