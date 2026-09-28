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
   calendario-eventos.js — [Etapa 14, PLAN_USUARIOS_EVENTOS.md, 2026-09-28]
   ---------------------------------------------------------------
   Calendario PROPIO (reemplaza el <input type="date"> nativo del
   filtro de fecha de eventos). Es un componente que se dibuja dentro
   de cualquier contenedor y NO sabe nada de mapas, filtros ni
   paneles: solo maneja la selección y avisa por callbacks. Se
   construye UNA sola vez y se reusa en 2 lugares:
     1) el filtro de fecha sobre el mapa (js/eventos-fecha-filtro.js,
        lo monta dentro de un popover);
     2) el buscador del panel "Todos los eventos" (Etapa 15) — montar
        con CalendarioEventos.mount(contenedor, {...}), no reescribir.

   Cómo se elige (un solo calendario, nunca dos inputs):
     - 1er toque en un día  → fecha puntual.
     - 2do toque en OTRO día (sin haber confirmado) → el 1º pasa a ser
       INICIO del rango y el 2º el FIN (si el 2º es anterior al 1º se
       ordenan solos: siempre desde <= hasta).
     - Tocar de nuevo el mismo día puntual no hace nada.
     - Con un rango ya armado, el próximo toque arranca de cero (día
       puntual nuevo).
     - Se confirma con el botón "Buscar" (onConfirm). "Limpiar" borra
       la selección (onClear).

   Fechas: siempre strings 'YYYY-MM-DD' (día calendario, sin hora ni
   huso — mismo formato que ya usa fechaFiltroEventos). Toda la
   aritmética de fechas es en UTC a propósito, para que el huso del
   dispositivo nunca corra un día. El calendario NO decide qué evento
   cae en qué día: eso lo sigue haciendo _eventoOcurreEnFecha()
   (js/eventos-fecha-filtro.js) con el huso de la ciudad del evento.

   Idioma: nombres de mes/día y formato de fecha salen de Intl con el
   idioma activo (AppState.getLanguage); el resto de los textos, de
   I18N (claves cal_*). La semana arranca en lunes.

   API:
     const cal = CalendarioEventos.mount(contenedor, {
       desde: 'YYYY-MM-DD' | null,   // selección inicial
       hasta: 'YYYY-MM-DD' | null,
       tz: 'America/...',            // solo para marcar "hoy" (opcional)
       onChange({desde, hasta}),     // en cada toque (borrador)
       onConfirm({desde, hasta}),    // botón "Buscar"
       onClear(),                    // botón "Limpiar"
     });
     cal.setValue(desde, hasta)  // cambia la selección y va a ese mes
     cal.getValue()              // → { desde, hasta }  (hasta null = puntual)
     cal.refresh()               // re-dibuja (ej. al cambiar el idioma)
     cal.destroy()
     CalendarioEventos.formatRango(desde, hasta) // texto corto p/ mostrar
   ═══════════════════════════════════════════════════════════ */

window.CalendarioEventos = (function () {
  'use strict';

  const LOCALES = { es: 'es-AR', en: 'en-US', pt: 'pt-BR' };
  const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;

  function _t(key) { return window.I18N ? I18N.t(key) : key; }

  function _locale() {
    const l = (window.AppState && typeof AppState.getLanguage === 'function' && AppState.getLanguage()) || 'es';
    return LOCALES[l] || LOCALES.es;
  }

  /* ── Aritmética de días 'YYYY-MM-DD' (UTC, sin huso) ── */
  function _pad(n) { return String(n).padStart(2, '0'); }
  function _ymd(y, m0, d) { return `${y}-${_pad(m0 + 1)}-${_pad(d)}`; }
  function _parse(s) {
    const p = s.split('-').map(Number);
    return { y: p[0], m: p[1] - 1, d: p[2] };
  }
  function _utc(s) { const p = _parse(s); return new Date(Date.UTC(p.y, p.m, p.d)); }
  function _fmt(s, opts) {
    return new Intl.DateTimeFormat(_locale(), Object.assign({ timeZone: 'UTC' }, opts)).format(_utc(s));
  }
  function _okDia(s) { return typeof s === 'string' && RE_DIA.test(s); }

  /** Texto corto de un día o rango: "15 mar" / "15 mar – 20 mar". Suma
   *  el año solo si no es el actual (o si el rango cruza de año). */
  function formatRango(desde, hasta) {
    if (!_okDia(desde)) return '';
    const anioHoy = new Date().getFullYear();
    const conAnio = _parse(desde).y !== anioHoy || (_okDia(hasta) && _parse(hasta).y !== anioHoy);
    const o = conAnio ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' };
    if (!_okDia(hasta) || hasta === desde) return _fmt(desde, o);
    return `${_fmt(desde, o)} – ${_fmt(hasta, o)}`;
  }

  /** Día de hoy 'YYYY-MM-DD' en el huso `tz` (misma función que usa el
   *  filtro, una sola fuente); si no está disponible, el día local. */
  function _hoy(tz) {
    if (typeof window._diaCalendarioEnHuso === 'function') {
      const h = window._diaCalendarioEnHuso(new Date().toISOString(), tz);
      if (h) return h;
    }
    const n = new Date();
    return _ymd(n.getFullYear(), n.getMonth(), n.getDate());
  }

  function mount(container, opts) {
    opts = opts || {};
    const hoy = _hoy(opts.tz);
    let sel = { a: null, b: null };   // a = inicio / día puntual, b = fin (o null)
    let view = { y: 0, m: 0 };        // mes que se está mostrando (m: 0-11)

    function _setSel(desde, hasta) {
      let a = _okDia(desde) ? desde : null;
      let b = a && _okDia(hasta) ? hasta : null;
      if (a && b && b < a) { const t = a; a = b; b = t; }
      if (a && b === a) b = null;
      sel = { a, b };
    }
    function _goToMonthOf(dia) {
      const p = _parse(_okDia(dia) ? dia : hoy);
      view = { y: p.y, m: p.m };
    }

    _setSel(opts.desde, opts.hasta);
    _goToMonthOf(sel.a);

    function _value() { return { desde: sel.a, hasta: sel.b }; }

    function _hint() {
      if (!sel.a) return `<span class="cal-hint-sub">${_t('cal_hint_vacio')}</span>`;
      if (!sel.b) {
        return `<b class="cal-hint-main">${_fmt(sel.a, { weekday: 'long', day: 'numeric', month: 'long' })}</b>`
          + `<span class="cal-hint-sub">${_t('cal_hint_dia')}</span>`;
      }
      return `<b class="cal-hint-main">${formatRango(sel.a, sel.b)}</b>`
        + `<span class="cal-hint-sub">${_t('cal_hint_rango')}</span>`;
    }

    function render() {
      // Conserva el foco de teclado a través del re-dibujado.
      const activo = document.activeElement;
      const focoDia = (activo && container.contains(activo) && activo.dataset) ? activo.dataset.day : null;

      const primero = new Date(Date.UTC(view.y, view.m, 1));
      const offset = (primero.getUTCDay() + 6) % 7;                 // lunes = 0
      const diasMes = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();

      // Encabezado de días de la semana: 2024-01-01 fue lunes.
      let wd = '';
      for (let i = 0; i < 7; i++) {
        const nombre = new Intl.DateTimeFormat(_locale(), { weekday: 'narrow', timeZone: 'UTC' })
          .format(new Date(Date.UTC(2024, 0, 1 + i)));
        wd += `<span class="cal-wd">${nombre}</span>`;
      }

      let celdas = '';
      for (let i = 0; i < 42; i++) {           // 6 filas fijas: el alto no salta al cambiar de mes
        const d = i - offset + 1;
        if (d < 1 || d > diasMes) { celdas += '<span class="cal-day cal-day--blank"></span>'; continue; }
        const dia = _ymd(view.y, view.m, d);
        const cls = ['cal-day'];
        const esInicio = dia === sel.a;
        const esFin = !!sel.b && dia === sel.b;
        if (dia === hoy) cls.push('is-today');
        if (esInicio || esFin) cls.push('is-selected');
        if (sel.b) {
          if (esInicio) cls.push('is-start');
          else if (esFin) cls.push('is-end');
          else if (dia > sel.a && dia < sel.b) cls.push('in-range');
        }
        const etiqueta = _fmt(dia, { dateStyle: 'full' });
        celdas += `<button type="button" class="${cls.join(' ')}" data-day="${dia}" aria-label="${etiqueta}" aria-pressed="${(esInicio || esFin || cls.includes('in-range')) ? 'true' : 'false'}"><span class="cal-num">${d}</span></button>`;
      }

      const titulo = new Intl.DateTimeFormat(_locale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(primero);

      container.innerHTML =
        `<div class="cal">`
        + `<div class="cal-head">`
        +   `<button type="button" class="cal-nav" data-act="prev" aria-label="${_t('cal_prev')}">‹</button>`
        +   `<span class="cal-title" aria-live="polite">${titulo}</span>`
        +   `<button type="button" class="cal-nav" data-act="next" aria-label="${_t('cal_next')}">›</button>`
        + `</div>`
        + `<div class="cal-week">${wd}</div>`
        + `<div class="cal-grid">${celdas}</div>`
        + `<div class="cal-hint">${_hint()}</div>`
        + `<div class="cal-actions">`
        +   `<button type="button" class="cal-btn cal-btn--ghost" data-act="clear"${sel.a ? '' : ' disabled'}>${_t('cal_limpiar')}</button>`
        +   `<button type="button" class="cal-btn cal-btn--primary" data-act="ok"${sel.a ? '' : ' disabled'}>${_t('cal_buscar')}</button>`
        + `</div>`
        + `</div>`;

      if (focoDia) {
        const el = container.querySelector(`[data-day="${focoDia}"]`);
        if (el) el.focus();
      }
    }

    function _clickDia(dia) {
      if (!sel.a || sel.b) {
        sel = { a: dia, b: null };                       // toque nuevo: día puntual
      } else if (dia === sel.a) {
        return;                                          // mismo día puntual: sin cambios
      } else {
        sel = dia < sel.a ? { a: dia, b: sel.a } : { a: sel.a, b: dia };   // 2do toque: rango
      }
      render();
      if (typeof opts.onChange === 'function') opts.onChange(_value());
    }

    function _onClick(e) {
      const diaBtn = e.target.closest('[data-day]');
      if (diaBtn && container.contains(diaBtn)) { _clickDia(diaBtn.dataset.day); return; }
      const actBtn = e.target.closest('[data-act]');
      if (!actBtn || !container.contains(actBtn) || actBtn.disabled) return;
      const act = actBtn.dataset.act;
      if (act === 'prev' || act === 'next') {
        const dm = act === 'prev' ? -1 : 1;
        const f = new Date(Date.UTC(view.y, view.m + dm, 1));
        view = { y: f.getUTCFullYear(), m: f.getUTCMonth() };
        render();
      } else if (act === 'clear') {
        sel = { a: null, b: null };
        render();
        if (typeof opts.onChange === 'function') opts.onChange(_value());
        if (typeof opts.onClear === 'function') opts.onClear();
      } else if (act === 'ok') {
        if (sel.a && typeof opts.onConfirm === 'function') opts.onConfirm(_value());
      }
    }

    container.addEventListener('click', _onClick);
    render();

    return {
      setValue(desde, hasta) { _setSel(desde, hasta); _goToMonthOf(sel.a); render(); },
      getValue: _value,
      refresh: render,
      destroy() { container.removeEventListener('click', _onClick); container.innerHTML = ''; },
    };
  }

  return { mount, formatRango };
})();
