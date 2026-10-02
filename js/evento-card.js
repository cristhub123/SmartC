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

/**
 * [Etapa 12 — PLAN_USUARIOS_EVENTOS.md, 2026-09-28]
 * TARJETA DE EVENTO UNIFICADA — UNA sola función de render
 * (`EventoCard.render`) que reusan la pestaña "Eventos" de un pin
 * (Etapa 13, carrusel) y el panel "Todos los eventos"
 * (Etapa 15, js/eventos-todos.js). No duplicar este markup en otro archivo.
 *
 * 2 variantes:
 *  - CON FOTO (`ev.imagenUrl`, Etapa 11): imagen 16:9 arriba.
 *  - SIN FOTO: en el mismo espacio 16:9, el nombre del evento en
 *    letra grande. Tamaño/color/fuente salen del 4to nivel de
 *    tipografía `eventoSinFoto` (js/typography.js → variables CSS
 *    `--pines-eventoSinFoto-*`, leídas en css/poi-panel.css). Aplica
 *    igual a todos los eventos sin foto, no es por evento.
 *    También cae a esta variante si la foto no carga (link roto) o si
 *    la URL no es https.
 *
 * Ícono 📍 en una esquina (ambas variantes): SOLO centra el mapa en
 * el pin del evento con `panToPoiCenter(poi)` (js/app.js). No abre el
 * panel de ese lugar, no toca expandPin/collapsePin y no cierra ni
 * cambia de tamaño el panel abierto.
 *
 * Uso: `EventoCard.render(ev, { catalogo, dimOpacity })` devuelve HTML;
 * quien lo inserta llama UNA vez a `EventoCard.bind(contenedor)` para
 * enganchar el click del ícono y el fallback de foto rota (delegado,
 * sobrevive a los re-pintados del contenedor).
 *
 * [2026-09-30] DISEÑO POLAROID + VISTA AMPLIADA (adaptado de un mockup de
 * Gemini, opción "1. Polaroid / Instax"):
 *  - La tarjeta ahora es un marco blanco tipo Polaroid: foto, nombre en
 *    letra manuscrita, descripción corta y una fila con 2 recuadros
 *    negros (rango de días + horario) y la entrada en texto gris. Sin
 *    íconos ni rótulos "Fecha"/"Hora".
 *  - Color de los recuadros: VERDE si el evento ocurre en la fecha del
 *    filtro (o en HOY, si no hay ninguna elegida); ROJO si no. Se decide
 *    con `_eventoOcurreEnFecha` (js/eventos-fecha-filtro.js, huso de la
 *    ciudad) — NO se reimplementó la comparación acá. La fecha a usar
 *    la pasa quien llama en `opts.fechaDesde`/`opts.fechaHasta`; sin
 *    ellas se toma el día de hoy en el huso de la ciudad.
 *  - Tocar la tarjeta abre `EventoCard.openDetail()`: una vista ampliada
 *    que se desliza desde la derecha DENTRO de `.poi-panel` (mismo panel,
 *    no es un overlay nuevo — ver AI_RULES sección 14.7). Se cierra con
 *    "Volver", o sola si el panel se cierra/cambia de lugar
 *    (`PoiPanel` llama a `EventoCard.closeDetail(true)`).
 *
 * Carga después de i18n.js y ANTES de poi-panel.js.
 */
window.EventoCard = (function () {

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  const _t = (k) => (window.I18N ? I18N.t(k) : k);

  /** Solo se acepta una foto con URL https (el campo lo puede escribir
   *  un usuario, no confiar en cualquier texto como `src`). */
  function _fotoValida(url) {
    return typeof url === 'string' && /^https:\/\//i.test(url.trim());
  }

  function _sinFotoHtml(nombre) {
    return `<div class="evento-card__sinfoto"><span class="evento-card__sinfoto-titulo">${_esc(nombre)}</span></div>`;
  }

  // ── Fechas / recuadros ──────────────────────────────────────
  const _LOCALES = { es: 'es-AR', en: 'en-US', pt: 'pt-BR' };
  const _lang = () => (window.AppState && AppState.getLanguage && AppState.getLanguage()) || 'es';

  /** ISO (o 'YYYY-MM-DD') → día calendario en el huso de la ciudad. Reusa
   *  `_diaCalendarioEnHuso` (js/eventos-fecha-filtro.js), una sola fuente. */
  function _dia(iso) {
    if (!iso) return null;
    if (typeof window._diaCalendarioEnHuso === 'function') return window._diaCalendarioEnHuso(iso);
    return String(iso).slice(0, 10);
  }
  const _hoy = () => _dia(new Date().toISOString());

  /** 'YYYY-MM-DD' → { d, m:'Sep' } en el idioma activo (mes abreviado). */
  function _partes(dia) {
    const [y, m, d] = dia.split('-').map(Number);
    let mes = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(_LOCALES[_lang()] || 'es-AR', { month: 'short', timeZone: 'UTC' });
    mes = mes.replace('.', '').slice(0, 3); // siempre 3 letras ("Sep", "Ago"), como el diseño original
    return { d, m: m, y, mes: mes.charAt(0).toUpperCase() + mes.slice(1) };
  }

  /** "28 Sep" · "28 a 30 Sep" · "28 Sep a 2 Oct" (sin la palabra "Fecha"). */
  function _rangoDias(ev) {
    const a = _dia(ev.fecha_inicio);
    if (!a) return '';
    const b = _dia(ev.fecha_fin) || a;
    const pa = _partes(a), pb = _partes(b), sep = ` ${_t('evt_rango_a')} `;
    if (a === b) return `${pa.d} ${pa.mes}`;
    if (pa.m === pb.m && pa.y === pb.y) return `${pa.d}${sep}${pb.d} ${pb.mes}`;
    return `${pa.d} ${pa.mes}${sep}${pb.d} ${pb.mes}`;
  }

  /** ¿El evento ocurre en la fecha elegida (o en hoy si no hay ninguna)? */
  function _coincide(ev, opts) {
    const desde = (opts && opts.fechaDesde) || _hoy();
    const hasta = (opts && opts.fechaHasta) || undefined;
    return typeof window._eventoOcurreEnFecha === 'function'
      ? window._eventoOcurreEnFecha(ev, desde, undefined, hasta)
      : false;
  }

  function _badge(texto, coincide) {
    return `<span class="evento-card__badge evento-card__badge--${coincide ? 'on' : 'off'}">${_esc(texto)}</span>`;
  }
  // ── Horarios estructurados (PLAN_HORARIOS_ESTRUCTURADOS_EVENTOS) ──
  // `ev.horarios` = [{ desde, hasta, abre, cierra }]; los días se guardan
  // como claves fijas (lun…dom) y el texto se ARMA acá, en el idioma
  // activo, por eso se traduce solo al cambiar de idioma. Una sola
  // fuente de verdad: el formulario (js/eventos-form-shared.js), las
  // listas del admin/usuario y el buscador llaman a estas 2 funciones.
  const HORARIO_DIAS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];

  /** Una fila → "Lun a Mié · 15:00–20:00" · "Jue · 18:00–21:00" · "15:00–20:00" (sin días). */
  function horarioFilaTexto(h) {
    if (!h) return '';
    const horas = (h.abre && h.cierra) ? `${h.abre}–${h.cierra}` : (h.abre || h.cierra || '');
    if (!h.desde || HORARIO_DIAS.indexOf(h.desde) === -1) return horas;
    let dias = _t('hor_d_' + h.desde);
    if (h.hasta && h.hasta !== h.desde && HORARIO_DIAS.indexOf(h.hasta) !== -1) {
      dias += ` ${_t('evt_rango_a')} ${_t('hor_d_' + h.hasta)}`;
    }
    return horas ? `${dias} · ${horas}` : dias;
  }

  /** Líneas de horario de un evento, en el idioma activo. Si el evento
   *  es viejo (solo texto libre en `horario`) se muestra tal cual. */
  function horarioLineas(ev) {
    if (!ev) return [];
    if (Array.isArray(ev.horarios) && ev.horarios.length) {
      return ev.horarios.map(horarioFilaTexto).filter(Boolean);
    }
    return ev.horario ? [String(ev.horario)] : [];
  }

  /** Los recuadros negros: rango de días + 1 recuadro por fila de horario (mismo color todos). */
  function _badges(ev, opts) {
    const on = _coincide(ev, opts);
    const dias = _rangoDias(ev);
    return (dias ? _badge(dias, on) : '') + horarioLineas(ev).map(l => _badge(l, on)).join('');
  }
  const _entradaTxt = (ev) => ev.entradaGratis === false
    ? (ev.valorEntrada || _t('evt_entrada_paga'))
    : _t('evt_entrada_gratuita');

  // Últimos datos con que se pintó cada tarjeta (para abrir su vista ampliada).
  const _registro = {};

  /**
   * @param {Object} ev  evento (colección `eventos`)
   * @param {{catalogo?: Array, dimOpacity?: number|null, fechaDesde?: string|null,
   *          fechaHasta?: string|null, onVerLugar?: Function}} [opts]
   *   catalogo: `categoriasEvento` de la config (para pasar tags a labels).
   *   dimOpacity: si viene, la tarjeta se atenúa (filtro de fecha activo
   *   y el evento no ocurre ese día).
   *   fechaDesde/fechaHasta: fecha del filtro ('YYYY-MM-DD'); sin ellas = hoy.
   *   onVerLugar(ev): si viene, la vista ampliada suma el botón "Ver el lugar".
   * @returns {string} HTML de la tarjeta
   */
  function render(ev, opts) {
    opts = opts || {};
    const nombre = ev.nombre || _t('evt_sin_nombre');
    if (ev.id) _registro[ev.id] = { ev, opts };

    const conFoto = _fotoValida(ev.imagenUrl);
    const media = conFoto
      ? `<img class="evento-card__img" src="${_esc(ev.imagenUrl.trim())}" alt="" loading="lazy" decoding="async">`
      : _sinFotoHtml(nombre);
    const locateTitle = _esc(_t('evt_card_centrar'));
    const locate = ev.poi_id
      ? `<button type="button" class="evento-card__locate" data-evento-locate="${_esc(ev.poi_id)}" title="${locateTitle}" aria-label="${locateTitle}">📍</button>`
      : '';
    const dim = (typeof opts.dimOpacity === 'number') ? ` style="opacity:${opts.dimOpacity}"` : '';

    return `<article class="evento-card${conFoto ? '' : ' evento-card--sinfoto'}" data-evento-id="${_esc(ev.id || '')}" data-evento-nombre="${_esc(nombre)}"${dim}>
      <div class="evento-card__media">
        ${media}
        ${locate}
      </div>
      <div class="evento-card__body">
        <strong class="evento-card__nombre">${_esc(nombre)}</strong>
        ${ev.descripcion ? `<p class="evento-card__desc">${_esc(ev.descripcion)}</p>` : ''}
        <div class="evento-card__fila">
          ${_badges(ev, opts)}
          <span class="evento-card__entrada">${_esc(_entradaTxt(ev))}</span>
        </div>
      </div>
    </article>`;
  }

  // ── Vista ampliada (se desliza desde la derecha dentro de .poi-panel) ──
  let _detalleEl = null;
  let _snapPrevio = null;   // tamaño del panel antes de abrir la vista ampliada
  let _detalleTimer = null;

  function _tagsLabels(ev, catalogo) {
    return (ev.tags || []).map(id => (catalogo.find(c => c.id === id) || {}).label || id).filter(Boolean);
  }

  function _detalleHtml(ev, opts) {
    const nombre = ev.nombre || _t('evt_sin_nombre');
    const catalogo = Array.isArray(opts.catalogo) ? opts.catalogo : [];
    const tags = _tagsLabels(ev, catalogo);
    const contactos = [ev.contactoTelefono, ev.contactoEmail, ev.contactoRedSocial, ev.contactoWeb].filter(Boolean);
    const conFoto = _fotoValida(ev.imagenUrl);
    const hero = conFoto
      ? `<img class="evento-detalle__img" src="${_esc(ev.imagenUrl.trim())}" alt="">`
      : '';
    const seccion = (titulo, html) => `<section class="evento-detalle__sec"><h3>${_esc(_t(titulo))}</h3>${html}</section>`;
    const verMapa = ev.poi_id
      ? `<button type="button" class="evento-detalle__btn" data-detalle-accion="mapa">${_esc(_t('evt_det_ver_mapa'))}</button>` : '';
    const verLugar = (typeof opts.onVerLugar === 'function' && ev.poi_id)
      ? `<button type="button" class="evento-detalle__btn evento-detalle__btn--sec" data-detalle-accion="lugar">${_esc(_t('evt_det_ver_lugar'))}</button>` : '';

    return `<div class="evento-detalle__scroll">
        <div class="evento-detalle__hero${conFoto ? '' : ' evento-detalle__hero--sinfoto'}">
          ${hero}
          <button type="button" class="evento-detalle__back" data-detalle-accion="volver" aria-label="${_esc(_t('evt_det_volver'))}">‹</button>
          <button type="button" class="evento-detalle__cerrar" data-detalle-accion="volver" aria-label="${_esc(_t('cerrar'))}" title="${_esc(_t('cerrar'))}">✕</button>
          <div class="evento-detalle__hero-txt">
            ${tags.length ? `<span class="evento-detalle__tags">${tags.map(_esc).join(' · ')}</span>` : ''}
            <h2 class="evento-detalle__titulo">${_esc(nombre)}</h2>
          </div>
        </div>
        <div class="evento-detalle__cuerpo">
          <div class="evento-detalle__fila">${_badges(ev, opts)}</div>
          ${ev.descripcion ? seccion('evt_det_acerca', `<p>${_esc(ev.descripcion)}</p>`) : ''}
          ${ev.direccion ? seccion('evt_det_donde', `<p>${_esc(ev.direccion)}</p>`) : ''}
          ${contactos.length ? seccion('evt_det_contacto', contactos.map(c => `<p>${_esc(c)}</p>`).join('')) : ''}
        </div>
      </div>
      <div class="evento-detalle__barra">
        <div class="evento-detalle__precio"><small>${_esc(_t('evt_det_entrada'))}</small><strong>${_esc(_entradaTxt(ev))}</strong></div>
        <div class="evento-detalle__acciones">${verLugar}${verMapa}</div>
      </div>`;
  }

  /** Abre la vista ampliada de `ev` dentro de `host` (el `.poi-panel`). */
  function openDetail(ev, opts, host) {
    if (!ev || !host) return;
    closeDetail(true);
    opts = opts || {};
    const el = document.createElement('div');
    el.className = 'evento-detalle';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML = _detalleHtml(ev, opts);
    el.addEventListener('click', (e) => {
      const btn = e.target.closest && e.target.closest('[data-detalle-accion]');
      if (!btn) return;
      e.stopPropagation();
      const acc = btn.dataset.detalleAccion;
      if (acc === 'volver') closeDetail();
      else if (acc === 'mapa') { closeDetail(true, true); _centrarEnMapa(ev.poi_id); if (window.PoiPanel && PoiPanel.snapTo) PoiPanel.snapTo('peek'); }
      else if (acc === 'lugar' && typeof opts.onVerLugar === 'function') opts.onVerLugar(ev);
    });
    el.addEventListener('error', (e) => { // foto rota → queda el bloque de color
      if (e.target && e.target.classList && e.target.classList.contains('evento-detalle__img')) {
        e.target.remove();
        el.querySelector('.evento-detalle__hero').classList.add('evento-detalle__hero--sinfoto');
      }
    }, true);
    host.appendChild(el);
    _detalleEl = el;
    // Con el panel en 'peek' la vista ampliada quedaría enana: sube a 'full' y
    // al volver se restaura el tamaño que tenía.
    if (window.PoiPanel && PoiPanel.getSnap && PoiPanel.snapTo) {
      _snapPrevio = PoiPanel.getSnap();
      if (_snapPrevio === 'peek') PoiPanel.snapTo('full');
    }
    void el.offsetWidth; // fuerza el estado inicial (fuera de pantalla) antes de animar
    el.classList.add('is-open');
  }

  /** Cierra la vista ampliada. `inmediato` = sin animación (el panel se
   *  está cerrando o cambiando de lugar). `sinRestaurar` = no devolver el
   *  panel a su tamaño anterior (el que llama ya decide el tamaño). */
  function closeDetail(inmediato, sinRestaurar) {
    const el = _detalleEl;
    if (!el) return;
    _detalleEl = null;
    clearTimeout(_detalleTimer);
    const prev = _snapPrevio; _snapPrevio = null;
    if (!sinRestaurar && !inmediato && prev === 'peek' && window.PoiPanel && PoiPanel.snapTo) PoiPanel.snapTo('peek');
    if (inmediato) { el.remove(); return; }
    el.classList.remove('is-open');
    _detalleTimer = setTimeout(() => el.remove(), 350);
  }

  /** Busca el pin de un evento — primero AppState (fuente de verdad,
   *  ver AI_RULES sección 5), después POIS legacy. Con la carga por
   *  viewport puede que un pin lejano todavía no esté en memoria. */
  function _findPoi(poiId) {
    if (!poiId) return null;
    let poi = null;
    if (window.AppState && typeof AppState.getPoi === 'function') poi = AppState.getPoi(poiId);
    if (!poi && typeof POIS !== 'undefined') poi = POIS.find(p => p.id === poiId) || null;
    return poi;
  }

  /** Centra el mapa en el pin (mismo comportamiento que el ícono 📍). */
  function _centrarEnMapa(poiId) {
    const poi = _findPoi(poiId);
    if (poi && typeof window.panToPoiCenter === 'function') {
      window.panToPoiCenter(poi);
      // [Etapa 15] En el panel "Todos los eventos" (pantalla vertical, panel en
      // 'full') el panel tapa el mapa: PoiPanel lo baja a 'peek' para que se vea
      // el pin centrado. En el panel de un lugar no hace nada.
      if (window.PoiPanel && typeof window.PoiPanel.afterLocate === 'function') window.PoiPanel.afterLocate();
    } else {
      console.warn('[EventoCard] no se pudo centrar el mapa — pin no cargado todavía:', poiId);
    }
  }

  /** Engancha (una sola vez por contenedor) el click del ícono 📍, el click
   *  de la tarjeta (abre la vista ampliada) y el fallback de foto rota.
   *  Delegado: sigue valiendo aunque el contenedor se repinte. */
  function bind(container) {
    if (!container || container.dataset.eventoCardBound) return;
    container.dataset.eventoCardBound = '1';

    container.addEventListener('click', e => {
      const btn = e.target.closest && e.target.closest('[data-evento-locate]');
      if (btn && container.contains(btn)) {
        e.stopPropagation(); // solo mover el mapa: nada más debe reaccionar a este click
        _centrarEnMapa(btn.dataset.eventoLocate);
        return;
      }
      const card = e.target.closest && e.target.closest('.evento-card');
      if (!card || !container.contains(card)) return;
      const reg = _registro[card.dataset.eventoId];
      if (reg) openDetail(reg.ev, reg.opts, container.closest('.poi-panel'));
    });

    // `error` de <img> no burbujea → se escucha en fase de captura.
    container.addEventListener('error', e => {
      const img = e.target;
      if (!img || !img.classList || !img.classList.contains('evento-card__img')) return;
      const card = img.closest('.evento-card');
      const media = img.closest('.evento-card__media');
      if (!card || !media) return;
      card.classList.add('evento-card--sinfoto');
      img.outerHTML = _sinFotoHtml(card.dataset.eventoNombre || '');
    }, true);
  }

  return { render, bind, openDetail, closeDetail, horarioFilaTexto, horarioLineas, HORARIO_DIAS };
})();
