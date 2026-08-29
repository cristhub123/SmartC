/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/**
 * [Etapa 10 — PLAN_UNIFICACION_FORMULARIO_EVENTOS.md, Partes 1 y 2]
 * MÓDULO COMPARTIDO — bloques de UI y de lectura/precarga de campos
 * que eran copia exacta entre js/eventos.js (panel Admin, prefijo
 * `evt-`) y js/user-panel.js (panel de Usuario, prefijo `up-evt-`).
 * ---------------------------------------------------------------
 * Parte 1 (ya entregada): Camino A/B, buscador de pines, selección/
 * deselección de pin, coords del Camino B, tilde "entrada gratis".
 *
 * Parte 2 (esta entrega): lectura (`readCamposComunes`), precarga en
 * modo edición (`precargarCamposComunes`) y limpieza (`resetCamposComunes`)
 * de los campos de CONTENIDO del evento que son idénticos en los 2
 * formularios (nombre, descripción, fechas, horario, entrada gratis/
 * valor, dirección, contacto x4, tags). El guardado real en Firestore
 * (saveEvento/saveUpEvento) sigue siendo 2 funciones separadas — cada
 * una arma su propio objeto a partir de estos campos comunes + sus
 * propios campos exclusivos, y hace su propia escritura (admin:
 * `.set`/`.add` libre; usuario: `.update` con `increment(-1)` de
 * cambios, respetando el `hasOnly([...])` de las reglas de Firestore).
 * Tampoco se tocaron las secciones solo-admin (ciudad con doble
 * candado, asignación por mail, destacado, cambios restantes) ni el
 * Camino A/B al editar (el usuario nunca puede tocar el lugar).
 *
 * Se carga DESPUÉS de owner-panel.js (usa `_escHtml`/`_escAttr`
 * globales de ahí) y ANTES de eventos.js/user-panel.js (ambos llaman
 * a `window.EventosFormCommon` desde sus propias funciones, ya
 * envueltas con los mismos nombres de antes para no romper nada que
 * los use). Las funciones de Parte 2 llaman a `window.EventosShared`
 * (definido al final de eventos.js) en tiempo de ejecución, no al
 * cargar el archivo — por eso el orden de carga entre este módulo y
 * eventos.js no importa para esa parte.
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

  /**
   * [Etapa 10, Parte 2] Lee del DOM los campos de CONTENIDO del evento
   * que son idénticos en los 2 formularios (no incluye `direccion`
   * porque su resolución depende del Camino A/B + pin elegido — eso
   * lo sigue resolviendo cada panel con `EventosShared.resolveDireccionFinal`,
   * como ya hacía antes de esta parte). No valida nada — la validación
   * de obligatorios sigue siendo `EventosShared.validateComunes`,
   * llamada aparte por cada panel junto con `direccion`.
   */
  function readCamposComunes(idPrefix) {
    const val = suffix => (document.getElementById(idPrefix + suffix)?.value || '').trim();
    const entradaGratis = !!document.getElementById(idPrefix + 'entrada-gratis')?.checked;
    return {
      nombre: val('nombre'),
      descripcion: val('descripcion'),
      fecha_inicio: (window.EventosShared ? EventosShared.dateInputToIso(idPrefix + 'fecha-inicio') : null),
      fecha_fin: (window.EventosShared ? EventosShared.dateInputToIso(idPrefix + 'fecha-fin') : null),
      horario: val('horario'),
      entradaGratis,
      valorEntrada: entradaGratis ? '' : val('valor-entrada'),
      contactoEmail: val('contacto-email'),
      contactoRedSocial: val('contacto-social'),
      contactoTelefono: val('contacto-telefono'),
      contactoWeb: val('contacto-web'),
      tags: (window.EventosShared ? EventosShared.readTagsFromForm(idPrefix + 'tags-wrap') : []),
    };
  }

  /** [Etapa 10, Parte 2] Precarga en el DOM los mismos campos de
   *  contenido de arriba, a partir de un evento ya guardado (modo
   *  edición). `direccion` sí se precarga acá (es un input de texto
   *  simple) aunque no se lea por `readCamposComunes` — su
   *  RE-cálculo al guardar depende del pin, no de lo tipeado. */
  function precargarCamposComunes(idPrefix, ev) {
    const setVal = (suffix, value) => {
      const el = document.getElementById(idPrefix + suffix);
      if (el) el.value = value;
    };
    setVal('nombre', ev.nombre || '');
    setVal('descripcion', ev.descripcion || '');
    setVal('fecha-inicio', ev.fecha_inicio ? ev.fecha_inicio.slice(0, 16) : '');
    setVal('fecha-fin', ev.fecha_fin ? ev.fecha_fin.slice(0, 16) : '');
    setVal('horario', ev.horario || '');
    const entradaGratisEl = document.getElementById(idPrefix + 'entrada-gratis');
    if (entradaGratisEl) entradaGratisEl.checked = ev.entradaGratis !== false;
    const valorBlock = document.getElementById(idPrefix + 'valor-entrada-block');
    if (valorBlock) valorBlock.style.display = (ev.entradaGratis === false) ? '' : 'none';
    setVal('valor-entrada', ev.valorEntrada || '');
    setVal('direccion', ev.direccion || '');
    setVal('contacto-email', ev.contactoEmail || '');
    setVal('contacto-social', ev.contactoRedSocial || '');
    setVal('contacto-telefono', ev.contactoTelefono || '');
    setVal('contacto-web', ev.contactoWeb || '');
    if (window.EventosShared) EventosShared.renderTagsSelector(idPrefix + 'tags-wrap', ev.tags || []);
  }

  /** [Etapa 10, Parte 2] Limpia los mismos campos de contenido de
   *  arriba (botón "Cancelar"/vuelta a la lista, o después de crear).
   *  No toca nada de las secciones solo-admin (ciudad, asignación,
   *  destacado, cambios) — eso lo sigue limpiando cada panel aparte. */
  function resetCamposComunes(idPrefix) {
    ['nombre', 'descripcion', 'fecha-inicio', 'fecha-fin', 'horario', 'valor-entrada',
     'direccion', 'contacto-email', 'contacto-social', 'contacto-telefono', 'contacto-web'
    ].forEach(suffix => {
      const el = document.getElementById(idPrefix + suffix);
      if (el) el.value = '';
    });
    const entradaGratisEl = document.getElementById(idPrefix + 'entrada-gratis');
    if (entradaGratisEl) entradaGratisEl.checked = true;
    const valorBlock = document.getElementById(idPrefix + 'valor-entrada-block');
    if (valorBlock) valorBlock.style.display = 'none';
    if (window.EventosShared) EventosShared.renderTagsSelector(idPrefix + 'tags-wrap', []);
    const errEl = document.getElementById(idPrefix + 'form-error');
    if (errEl) errEl.textContent = '';
    const previewEl = document.getElementById(idPrefix + 'nombre-preview');
    if (previewEl) { previewEl.textContent = ''; previewEl.className = ''; }
  }

  return {
    applyCaminoUI,
    renderBuscarPinResults,
    wireBuscarPinClickOutside,
    applyPinSeleccionado,
    ocultarPinSeleccionado,
    syncPinCoordDisplay,
    wireEntradaGratisToggle,
    readCamposComunes,
    precargarCamposComunes,
    resetCamposComunes,
  };
})();
