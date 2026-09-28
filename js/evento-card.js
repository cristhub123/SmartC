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
 * (Etapa 13, carrusel) y, más adelante, el panel "Todos los eventos"
 * (Etapa 15). No duplicar este markup en otro archivo.
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

  /**
   * @param {Object} ev  evento (colección `eventos`)
   * @param {{catalogo?: Array, dimOpacity?: number|null}} [opts]
   *   catalogo: `categoriasEvento` de la config (para pasar tags a labels).
   *   dimOpacity: si viene, la tarjeta se atenúa (filtro de fecha activo
   *   y el evento no ocurre ese día).
   * @returns {string} HTML de la tarjeta
   */
  function render(ev, opts) {
    opts = opts || {};
    const nombre = ev.nombre || _t('evt_sin_nombre');
    const fechas = [ev.fecha_inicio, ev.fecha_fin].filter(Boolean)
      .map(iso => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }); })
      .filter(Boolean).join(' → ');
    const catalogo = Array.isArray(opts.catalogo) ? opts.catalogo : [];
    const tagsLabels = (ev.tags || [])
      .map(id => (catalogo.find(c => c.id === id) || {}).label || id)
      .filter(Boolean);
    const entradaTxt = ev.entradaGratis === false
      ? `💵 ${ev.valorEntrada || _t('evt_entrada_paga')}`
      : `🆓 ${_t('evt_entrada_gratuita')}`;
    const contactos = [
      ev.contactoTelefono ? `📞 ${ev.contactoTelefono}` : '',
      ev.contactoEmail ? `✉️ ${ev.contactoEmail}` : '',
      ev.contactoRedSocial ? `📱 ${ev.contactoRedSocial}` : '',
      ev.contactoWeb ? `🌐 ${ev.contactoWeb}` : '',
    ].filter(Boolean);

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
        ${fechas ? `<span class="evento-card__fechas">🗓 ${_esc(fechas)}</span>` : ''}
        ${ev.horario ? `<span class="evento-card__fechas">🕒 ${_esc(ev.horario)}</span>` : ''}
        <span class="evento-card__fechas">${entradaTxt}</span>
        ${tagsLabels.length ? `<span class="evento-card__cat">${tagsLabels.map(_esc).join(' · ')}</span>` : ''}
        ${ev.descripcion ? `<p class="evento-card__desc">${_esc(ev.descripcion)}</p>` : ''}
        ${ev.direccion ? `<p class="evento-card__desc">📍 ${_esc(ev.direccion)}</p>` : ''}
        ${contactos.length ? `<p class="evento-card__desc">${contactos.map(_esc).join(' · ')}</p>` : ''}
      </div>
    </article>`;
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

  /** Engancha (una sola vez por contenedor) el click del ícono 📍 y el
   *  fallback de foto rota. Delegado: sigue valiendo aunque el
   *  contenedor se repinte. */
  function bind(container) {
    if (!container || container.dataset.eventoCardBound) return;
    container.dataset.eventoCardBound = '1';

    container.addEventListener('click', e => {
      const btn = e.target.closest && e.target.closest('[data-evento-locate]');
      if (!btn || !container.contains(btn)) return;
      e.stopPropagation(); // solo mover el mapa: nada más debe reaccionar a este click
      const poi = _findPoi(btn.dataset.eventoLocate);
      if (poi && typeof window.panToPoiCenter === 'function') {
        window.panToPoiCenter(poi);
      } else {
        console.warn('[EventoCard] no se pudo centrar el mapa — pin no cargado todavía:', btn.dataset.eventoLocate);
      }
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

  return { render, bind };
})();
