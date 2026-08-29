/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/**
 * [Etapa 10 — PLAN_UNIFICACION_FORMULARIO_EVENTOS.md, Parte 1]
 * MÓDULO COMPARTIDO — bloques de UI del formulario de evento que eran
 * copia exacta entre js/eventos.js (panel Admin, prefijo `evt-`) y
 * js/user-panel.js (panel de Usuario, prefijo `up-evt-`).
 * ---------------------------------------------------------------
 * Alcance de ESTA parte (Parte 1 del plan): solo UI/lógica común que
 * NO toca el guardado en Firestore — toggle Camino A/B, buscador de
 * pines existentes, selección/deselección de pin, display de
 * coordenadas del Camino B, y el tilde de "entrada gratis". Todo
 * genérico por `idPrefix` (mismo criterio que ya usaba este proyecto
 * en `_evtSyncDireccionBlock`/`_evtValidateComunes`, ver EventosShared
 * en js/eventos.js).
 *
 * El guardado real (saveEvento/saveUpEvento, con sus diferencias de
 * permisos) NO se tocó — eso es la Parte 2 del plan, todavía sin
 * empezar. Este archivo tampoco decide qué campos son obligatorios
 * ni arma el objeto que se guarda — solo la interacción del Camino
 * A/B y el buscador de pines.
 *
 * Se carga DESPUÉS de owner-panel.js (usa `_escHtml`/`_escAttr`
 * globales de ahí) y ANTES de eventos.js/user-panel.js (ambos llaman
 * a `window.EventosFormCommon` desde sus propias funciones, ya
 * envueltas con los mismos nombres de antes para no romper nada que
 * los use).
 */
window.EventosFormCommon = (function () {

  /** Prende/apaga los 2 botones y paneles de Camino A/B. Puramente
   *  visual — quien llama sigue guardando el camino elegido en su
   *  propia variable (`_evtCamino`/`_upEvtCamino`), igual que antes. */
  function applyCaminoUI(idPrefix, camino) {
    document.getElementById(idPrefix + 'camino-a-btn')?.classList.toggle('on', camino === 'a');
    document.getElementById(idPrefix + 'camino-b-btn')?.classList.toggle('on', camino === 'b');
    const paneA = document.getElementById(idPrefix + 'camino-a-pane');
    const paneB = document.getElementById(idPrefix + 'camino-b-pane');
    if (paneA) paneA.style.display = camino === 'a' ? '' : 'none';
    if (paneB) paneB.style.display = camino === 'b' ? '' : 'none';
  }

  /** Pinta los resultados del buscador de pines (Camino A). `onSelect`
   *  es el callback del panel que llama (`_evtSeleccionarPin`/
   *  `_upSeleccionarPin`), para no acoplar este módulo a cuál de los
   *  2 formularios lo está usando. */
  function renderBuscarPinResults(idPrefix, query, onSelect) {
    const wrap = document.getElementById(idPrefix + 'buscar-pin-results');
    if (!wrap) return;
    const q = (query || '').trim().toLowerCase();
    if (!q) { wrap.innerHTML = ''; wrap.classList.remove('show'); return; }
    const matches = (typeof POIS !== 'undefined' ? POIS : [])
      .filter(p => (p.name || '').toLowerCase().includes(q))
      .slice(0, 8);
    if (!matches.length) {
      wrap.innerHTML = '<div class="geocoder-result"><strong>Sin resultados</strong><span>Probá con otro nombre</span></div>';
      wrap.classList.add('show');
      return;
    }
    wrap.innerHTML = matches.map(p => `
      <div class="geocoder-result" data-pin-id="${_escAttr(p.id)}">
        <strong>${_escHtml(p.name || p.id)}</strong>
        <span>${_escHtml(p.categoryLabel || p.id)}</span>
      </div>
    `).join('');
    wrap.classList.add('show');
    wrap.querySelectorAll('[data-pin-id]').forEach(el => {
      el.addEventListener('click', () => onSelect(el.dataset.pinId));
    });
  }

  /** Cierra el dropdown de resultados si se clickea afuera — mismo
   *  criterio que ya tenía cada formulario por separado. */
  function wireBuscarPinClickOutside(idPrefix) {
    document.addEventListener('click', e => {
      const wrap = document.getElementById(idPrefix + 'buscar-pin-results');
      const input = document.getElementById(idPrefix + 'buscar-pin-input');
      if (wrap && input && !wrap.contains(e.target) && e.target !== input) wrap.classList.remove('show');
    });
  }

  /** Marca un pin como elegido (Camino A): esconde el buscador, limpia
   *  el input y muestra la "tarjetita" con el nombre del pin. Recibe
   *  `nameElClass` porque el admin usa `.evt-pin-seleccionado-name` y
   *  el panel de usuario `.up-evt-pin-seleccionado-name`. */
  function applyPinSeleccionado(idPrefix, pin, nameElClass) {
    document.getElementById(idPrefix + 'buscar-pin-results')?.classList.remove('show');
    const inputEl = document.getElementById(idPrefix + 'buscar-pin-input');
    if (inputEl) inputEl.value = '';
    const sel = document.getElementById(idPrefix + 'pin-seleccionado');
    if (sel) {
      sel.style.display = '';
      const nameEl = sel.querySelector('.' + nameElClass);
      if (nameEl) nameEl.textContent = pin.name || pin.id;
    }
  }

  /** Oculta la tarjetita de pin elegido (botón "Quitar"). */
  function ocultarPinSeleccionado(idPrefix) {
    const sel = document.getElementById(idPrefix + 'pin-seleccionado');
    if (sel) sel.style.display = 'none';
  }

  /** Texto de coordenadas del Camino B (pin mínimo por geocoder/click
   *  en el mapa) — idéntico entre los 2 formularios salvo el prefijo. */
  function syncPinCoordDisplay(idPrefix) {
    const lat = document.getElementById(idPrefix + 'pin-lat')?.value;
    const lng = document.getElementById(idPrefix + 'pin-lng')?.value;
    const d = document.getElementById(idPrefix + 'pin-coord-display');
    if (!d) return;
    if (lat && lng) {
      d.textContent = `${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}`;
      d.classList.add('set');
    } else {
      d.textContent = 'Sin coordenadas — buscá una dirección o hacé click en el mapa';
      d.classList.remove('set');
    }
  }

  /** Tilde "entrada gratuita": solo pide el valor cuando NO está
   *  tildada. Mismo criterio en los 2 formularios. */
  function wireEntradaGratisToggle(idPrefix) {
    document.getElementById(idPrefix + 'entrada-gratis')?.addEventListener('change', e => {
      const block = document.getElementById(idPrefix + 'valor-entrada-block');
      if (block) block.style.display = e.target.checked ? 'none' : '';
    });
  }

  return {
    applyCaminoUI,
    renderBuscarPinResults,
    wireBuscarPinClickOutside,
    applyPinSeleccionado,
    ocultarPinSeleccionado,
    syncPinCoordDisplay,
    wireEntradaGratisToggle,
  };
})();
