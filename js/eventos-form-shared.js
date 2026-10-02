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
 * [2026-10-01 — PLAN_HORARIOS_ESTRUCTURADOS_EVENTOS.txt] El horario ya
 * NO es texto libre: bloque "Horarios" por filas (día desde / día hasta
 * / hora desde / hora hasta / OK / +), implementado ACÁ una sola vez
 * para los 2 formularios (`evt-` y `up-evt-`). Se guarda como
 * `horarios: [{desde, hasta, abre, cierra}]` (claves de día fijas
 * lun…dom, nunca traducidas); el texto lo arma `EventoCard.horarioLineas`
 * en el idioma activo. Aviso de superposición en rojo, NO restrictivo.
 * Ver `wireHorarios`, `getHorarios`, `setHorarios`, `resetHorarios`.
 *
 * [Etapa 11 — PLAN_USUARIOS_EVENTOS.md, 2026-09-27] Foto opcional del
 * evento (`imagenUrl`, Cloudinary preset `smartcity_eventos_01`):
 * bloque "Foto del evento" agregado ACÁ (una sola implementación para
 * el form admin `evt-` y el de usuario `up-evt-`) — ver
 * `wireImagenInput`, `resolverImagen` y su uso en precargar/reset.
 *
 * [Etapa 10 — PLAN_UNIFICACION_FORMULARIO_EVENTOS.md, Partes 1, 2 y 3
 * — PLAN COMPLETO]
 * MÓDULO COMPARTIDO — bloques de UI, lectura/precarga de campos, y
 * resumen de listado que eran copia exacta entre js/eventos.js
 * (panel Admin, prefijo `evt-`) y js/user-panel.js (panel de
 * Usuario, prefijo `up-evt-`).
 * ---------------------------------------------------------------
 * Parte 1: Camino A/B, buscador de pines, selección/deselección de
 * pin, coords del Camino B, tilde "entrada gratis".
 *
 * Parte 2: lectura (`readCamposComunes`), precarga en modo edición
 * (`precargarCamposComunes`) y limpieza (`resetCamposComunes`) de
 * los campos de CONTENIDO del evento que son idénticos en los 2
 * formularios (nombre, descripción, fechas, horario, entrada gratis/
 * valor, dirección, contacto x4, tags). El guardado real en Firestore
 * (saveEvento/saveUpEvento) sigue siendo 2 funciones separadas — cada
 * una arma su propio objeto a partir de estos campos comunes + sus
 * propios campos exclusivos, y hace su propia escritura (admin:
 * `.set`/`.add` libre; usuario: `.update` con `increment(-1)` de
 * cambios, respetando el `hasOnly([...])` de las reglas de Firestore).
 *
 * Parte 3 (esta entrega, cierra el plan): `formatEventoResumen` —
 * el cálculo de a qué pin quedó anexado un evento, el rango de
 * fechas formateado, y el texto de entrada gratis/paga, que las 2
 * listas (tab Eventos admin y "Mis eventos" del panel usuario)
 * calculaban con el mismo código. Cada lista sigue armando su propia
 * tarjeta HTML con sus propios badges/acciones — eso NO se unificó a
 * propósito: admin ve TODOS los eventos con más acciones (editar/
 * activar/borrar/reactivar pin, badges de estado/tags/destacado/
 * cambios); usuario ve solo los propios con edición gated por
 * cambios > 0. Es la diferencia de permisos real del plan (sección 4
 * del PLAN_UNIFICACION_FORMULARIO_EVENTOS.md), a propósito NO
 * genérica.
 *
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
      wrap.innerHTML = `<div class="geocoder-result"><strong>${window.I18N ? I18N.t('evt_no_results') : 'Sin resultados'}</strong><span>${window.I18N ? I18N.t('evt_no_results_hint') : 'Probá con otro nombre'}</span></div>`;
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
    // [NUEVO 2026-08-31] Guarda anti-selección-de-texto-arrastrada —
    // ver js/ui-guards.js (Punto 1, PLAN_FIX_CIERRE_PANELES.md).
    document.addEventListener('click', e => {
      if (window.UIGuards && window.UIGuards.wasTextDragRelease(e)) return;
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
    const hor = getHorarios(idPrefix); // [2026-10-01] horarios por filas
    return {
      nombre: val('nombre'),
      descripcion: val('descripcion'),
      fecha_inicio: (window.EventosShared ? EventosShared.dateInputToIso(idPrefix + 'fecha-inicio') : null),
      fecha_fin: (window.EventosShared ? EventosShared.dateInputToIso(idPrefix + 'fecha-fin') : null),
      horarios: hor.rows,
      horariosIncompleto: hor.incompleto,
      horario: '', // el texto libre viejo ya no se carga (queda vacío al guardar con `horarios`)
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
    setHorarios(idPrefix, ev); // [2026-10-01] horarios por filas (evento viejo: avisa el texto anterior)
    const entradaGratisEl = document.getElementById(idPrefix + 'entrada-gratis');
    if (entradaGratisEl) entradaGratisEl.checked = ev.entradaGratis !== false;
    const valorBlock = document.getElementById(idPrefix + 'valor-entrada-block');
    if (valorBlock) valorBlock.style.display = (ev.entradaGratis === false) ? '' : 'none';
    setVal('valor-entrada', ev.valorEntrada || '');
    setVal('direccion', ev.direccion || '');
    precargarImagen(idPrefix, ev.imagenUrl || ''); // [Etapa 11]
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
    ['nombre', 'descripcion', 'fecha-inicio', 'fecha-fin', 'valor-entrada',
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
    resetImagen(idPrefix); // [Etapa 11]
    resetHorarios(idPrefix); // [2026-10-01]
    const errEl = document.getElementById(idPrefix + 'form-error');
    if (errEl) errEl.textContent = '';
    const previewEl = document.getElementById(idPrefix + 'nombre-preview');
    if (previewEl) { previewEl.textContent = ''; previewEl.className = ''; }
  }

  /** [Etapa 10, Parte 3] Datos de resumen de un evento que las 2
   *  listas (admin y "Mis eventos") calculan igual: a qué pin quedó
   *  anexado (o su id crudo si el pin ya no existe), el rango de
   *  fechas formateado, y el texto de entrada gratis/paga. Cada
   *  lista arma su propia tarjeta HTML con sus propios badges y
   *  acciones (admin: estado/tags/destacado/cambios/editar/activar/
   *  borrar; usuario: activo/cambios/editar-gated) — eso NO se
   *  unificó a propósito, son 2 vistas con permisos distintos. */
  function formatEventoResumen(ev) {
    const pin = (typeof POIS !== 'undefined' ? POIS : []).find(p => p.id === ev.poi_id);
    const pinLabel = pin ? (pin.name || pin.id) : (ev.poi_id || '—');
    const fechas = [ev.fecha_inicio, ev.fecha_fin].filter(Boolean)
      .map(iso => new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))
      .join(' → ');
    const entradaTxt = ev.entradaGratis === false ? `💵 ${ev.valorEntrada || 'con costo'}` : '🆓 Gratis';
    // [2026-10-01] horario armado en el idioma activo (filas nuevas, o texto viejo)
    const horarioTxt = (window.EventoCard && EventoCard.horarioLineas) ? EventoCard.horarioLineas(ev).join(' / ') : (ev.horario || '');
    return { pin, pinLabel, fechas, entradaTxt, horarioTxt };
  }

  /* ═══════════════════════════════════════════════════════════
     HORARIOS ESTRUCTURADOS (filas de días + horas)
     Estado por formulario (clave = idPrefix):
       { rows:[{desde,hasta,abre,cierra}], draft:{desde,hasta,abre,cierra},
         open:boolean (editor visible), legacy:string, err:string }
     ═══════════════════════════════════════════════════════════ */
  const HOR_DIAS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
  const _hor = {};
  const _ht = k => (window.I18N ? I18N.t(k) : k);
  const _hEsc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function _hs(p) {
    return _hor[p] || (_hor[p] = { rows: [], draft: { desde: '', hasta: '', abre: '', cierra: '' }, open: true, legacy: '', err: '' });
  }
  const _draftVacio = d => !d.desde && !d.hasta && !d.abre && !d.cierra;
  const _draftCompleto = d => !!(d.abre && d.cierra && !(d.hasta && !d.desde));

  /** Fila "limpia" lista para guardar: días como claves válidas o null. */
  function _limpiarFila(d) {
    const desde = HOR_DIAS.includes(d.desde) ? d.desde : null;
    const hasta = (desde && HOR_DIAS.includes(d.hasta) && d.hasta !== desde) ? d.hasta : null;
    return { desde, hasta, abre: d.abre, cierra: d.cierra };
  }

  /** Días que cubre una fila (índices 0-6). Sin días = los 7. Rango que
   *  "da la vuelta" (vie→lun) se recorre circularmente. */
  function _diasDeFila(h) {
    if (!h.desde) return HOR_DIAS.map((_, i) => i);
    const a = HOR_DIAS.indexOf(h.desde);
    const b = h.hasta ? HOR_DIAS.indexOf(h.hasta) : a;
    const out = [];
    for (let i = a, n = 0; n < 7; i = (i + 1) % 7, n++) { out.push(i); if (i === b) break; }
    return out;
  }
  const _min = hhmm => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  /** ¿Se pisan las horas de 2 filas? Soporta rangos que cruzan medianoche. */
  function _horasSePisan(a, b) {
    let a1 = _min(a.abre), a2 = _min(a.cierra), b1 = _min(b.abre), b2 = _min(b.cierra);
    if (a2 <= a1) a2 += 1440;
    if (b2 <= b1) b2 += 1440;
    return [-1440, 0, 1440].some(sh => a1 < b2 + sh && b1 + sh < a2);
  }

  /** Solo aviso (nunca bloquea): días compartidos entre filas, horas pisadas,
   *  o una fila sin días conviviendo con otras. */
  function analizarSolapes(rows) {
    const out = { diasCompartidos: [], horasPisadas: false, todosConOtras: false };
    if (!rows || rows.length < 2) return out;
    const compartidos = new Set();
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        if (!rows[i].desde || !rows[j].desde) { out.todosConOtras = true; continue; }
        const di = _diasDeFila(rows[i]), dj = _diasDeFila(rows[j]);
        const comun = di.filter(x => dj.includes(x));
        if (comun.length) {
          comun.forEach(x => compartidos.add(x));
          if (_horasSePisan(rows[i], rows[j])) out.horasPisadas = true;
        }
      }
    }
    out.diasCompartidos = Array.from(compartidos).sort((x, y) => x - y).map(i => HOR_DIAS[i]);
    return out;
  }

  function _warnTexto(rows) {
    const r = analizarSolapes(rows);
    const partes = [];
    if (r.diasCompartidos.length) {
      partes.push(_ht('hor_warn_dias').replace('{dias}', r.diasCompartidos.map(d => _ht('hor_d_' + d)).join(', '))
        + (r.horasPisadas ? _ht('hor_warn_horas') : ''));
    }
    if (r.todosConOtras) partes.push(_ht('hor_warn_todos'));
    return partes.length ? partes.join(' ') + ' ' + _ht('hor_warn_nota') : '';
  }

  function _optsDias(sel) {
    return '<option value=""' + (sel ? '' : ' selected') + ' data-i18n="__PH__"></option>'
      + HOR_DIAS.map(d => `<option value="${d}" data-i18n="hor_d_${d}"${sel === d ? ' selected' : ''}></option>`).join('');
  }

  function renderHorarios(p) {
    const wrap = document.getElementById(p + 'horarios-wrap');
    if (!wrap) return;
    const st = _hs(p);
    const fila = h => (window.EventoCard ? EventoCard.horarioFilaTexto(h) : `${h.desde || ''} ${h.abre}-${h.cierra}`);
    const d = st.draft;
    const chips = st.rows.map((h, i) => `
      <span class="hor-chip" data-i="${i}">
        <span class="hor-chip-txt">${_hEsc(fila(h))}</span>
        <button type="button" class="hor-chip-btn" data-act="edit" data-i18n-title="hor_edit_title" aria-label="edit">✎</button>
        <button type="button" class="hor-chip-btn" data-act="del" data-i18n-title="hor_del_title" aria-label="del">✕</button>
      </span>`).join('');
    const editor = st.open ? `
      <div class="hor-editor">
        <select class="fi hor-sel" data-f="desde" data-i18n-title="hor_desde" aria-label="hor_desde">${_optsDias(d.desde).replace('__PH__', 'hor_desde')}</select>
        <select class="fi hor-sel" data-f="hasta" data-i18n-title="hor_hasta" aria-label="hor_hasta">${_optsDias(d.hasta).replace('__PH__', 'hor_hasta')}</select>
        <input class="fi hor-time" type="time" data-f="abre" value="${_hEsc(d.abre)}" data-i18n-title="hor_hora_desde" aria-label="hor_hora_desde">
        <input class="fi hor-time" type="time" data-f="cierra" value="${_hEsc(d.cierra)}" data-i18n-title="hor_hora_hasta" aria-label="hor_hora_hasta">
        <button type="button" class="hor-ok" data-act="ok" data-i18n="hor_ok"></button>
      </div>` : '';
    const add = (!st.open && st.rows.length) ? '<button type="button" class="hor-add" data-act="add" data-i18n-title="hor_add_title" aria-label="add">+</button>' : '';
    wrap.innerHTML = `
      ${st.legacy ? `<div class="hor-legacy">${_hEsc(st.legacy)}</div>` : ''}
      <div class="hor-list">${chips}${add}</div>
      ${editor}
      <div class="hor-err">${_hEsc(st.err)}</div>
      <div class="hor-warn">${_hEsc(_warnTexto(st.rows))}</div>
      <div class="hor-hint" data-i18n="hor_hint"></div>`;
    if (window.I18N) I18N.apply(wrap);
    // aria-label legibles (los placeholders "hor_xxx" se resuelven con I18N)
    wrap.querySelectorAll('[aria-label^="hor_"]').forEach(el => el.setAttribute('aria-label', _ht(el.getAttribute('aria-label'))));
  }

  /** Engancha el bloque de horarios de un formulario (delegación de eventos). */
  function wireHorarios(idPrefix) {
    const wrap = document.getElementById(idPrefix + 'horarios-wrap');
    if (!wrap) return;
    const st = _hs(idPrefix);
    wrap.addEventListener('input', e => {
      const f = e.target && e.target.dataset && e.target.dataset.f;
      if (f) { st.draft[f] = e.target.value; st.err = ''; wrap.querySelector('.hor-err').textContent = ''; }
    });
    wrap.addEventListener('change', e => {
      const f = e.target && e.target.dataset && e.target.dataset.f;
      if (f) st.draft[f] = e.target.value;
    });
    wrap.addEventListener('click', e => {
      const btn = e.target.closest && e.target.closest('[data-act]');
      if (!btn || !wrap.contains(btn)) return;
      const act = btn.dataset.act;
      if (act === 'ok') {
        const d = st.draft;
        if (d.hasta && !d.desde) { st.err = _ht('hor_err_dias'); renderHorarios(idPrefix); return; }
        if (!d.abre || !d.cierra) { st.err = _ht('hor_err_horas'); renderHorarios(idPrefix); return; }
        st.rows.push(_limpiarFila(d));
        st.draft = { desde: '', hasta: '', abre: '', cierra: '' };
        st.open = false; st.err = '';
        renderHorarios(idPrefix);
      } else if (act === 'add') {
        st.open = true; st.err = '';
        renderHorarios(idPrefix);
      } else if (act === 'del') {
        const i = parseInt(btn.closest('.hor-chip').dataset.i, 10);
        st.rows.splice(i, 1);
        if (!st.rows.length) st.open = true;
        st.err = '';
        renderHorarios(idPrefix);
      } else if (act === 'edit') {
        const i = parseInt(btn.closest('.hor-chip').dataset.i, 10);
        const h = st.rows.splice(i, 1)[0];
        st.draft = { desde: h.desde || '', hasta: h.hasta || '', abre: h.abre || '', cierra: h.cierra || '' };
        st.open = true; st.err = '';
        renderHorarios(idPrefix);
      }
    });
    if (window.AppState && AppState.on && AppState.EVENTS) {
      AppState.on(AppState.EVENTS.LANGUAGE_CHANGED, () => renderHorarios(idPrefix));
    }
    renderHorarios(idPrefix);
  }

  /** Filas a guardar + si quedó una fila a medio completar. Una fila
   *  completa que quedó sin apretar OK se incluye sola. */
  function getHorarios(idPrefix) {
    const st = _hs(idPrefix);
    const rows = st.rows.map(_limpiarFila);
    let incompleto = false;
    if (!_draftVacio(st.draft)) {
      if (_draftCompleto(st.draft)) rows.push(_limpiarFila(st.draft));
      else incompleto = true;
    }
    return { rows, incompleto };
  }

  /** Precarga al editar: filas nuevas, o (evento viejo) solo se avisa el texto anterior. */
  function setHorarios(idPrefix, ev) {
    const st = _hs(idPrefix);
    const rows = (ev && Array.isArray(ev.horarios) ? ev.horarios : [])
      .filter(h => h && h.abre && h.cierra).map(_limpiarFila);
    st.rows = rows;
    st.draft = { desde: '', hasta: '', abre: '', cierra: '' };
    st.open = rows.length === 0;
    st.err = '';
    st.legacy = (!rows.length && ev && ev.horario) ? `${_ht('hor_legacy')} ${ev.horario}` : '';
    renderHorarios(idPrefix);
  }

  function resetHorarios(idPrefix) { setHorarios(idPrefix, null); }

  /* ═══════════════════════════════════════════════════════════
     [Etapa 11] FOTO OPCIONAL DEL EVENTO
     Estado por formulario (clave = idPrefix): { file, objUrl,
     existingUrl, removed, uploadedUrl }. La foto NO se sube al elegirla
     — recién al guardar (`resolverImagen`), así cancelar el formulario
     no deja archivos huérfanos en Cloudinary.
     ═══════════════════════════════════════════════════════════ */
  const IMG_TIPOS_OK = ['image/jpeg', 'image/webp'];
  const IMG_MAX_BYTES = 10 * 1024 * 1024; // tope del plan gratuito de Cloudinary por archivo
  const IMG_MIN_ANCHO = 1024; // px — el preset guarda 1024x576; menos que esto se agranda y se ve borroso
  const _imgState = {};
  function _st(p) { return _imgState[p] || (_imgState[p] = { file: null, objUrl: '', existingUrl: '', removed: false, uploadedUrl: '' }); }

  function _renderImagen(p) {
    const s = _st(p);
    const prev = document.getElementById(p + 'imagen-preview');
    const quitar = document.getElementById(p + 'imagen-quitar');
    const url = s.objUrl || (s.removed ? '' : s.existingUrl);
    if (prev) { if (url) { prev.src = url; prev.hidden = false; } else { prev.removeAttribute('src'); prev.hidden = true; } }
    if (quitar) quitar.hidden = !url;
  }
  function _imgError(p, msg) {
    const el = document.getElementById(p + 'imagen-error');
    if (el) el.textContent = msg || '';
  }
  function _clearPickedFile(p) {
    const s = _st(p);
    if (s.objUrl) { try { URL.revokeObjectURL(s.objUrl); } catch (e) {} }
    s.file = null; s.objUrl = ''; s.uploadedUrl = '';
    const input = document.getElementById(p + 'imagen-input');
    if (input) input.value = '';
  }

  /** Engancha el input de archivo y el botón \"Quitar\" de un formulario. */
  function wireImagenInput(idPrefix) {
    const input = document.getElementById(idPrefix + 'imagen-input');
    if (!input) return;
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      _imgError(idPrefix, '');
      // Validación rápida en el cliente ANTES de intentar subir (el
      // preset de Cloudinary también rechaza otros formatos, pero así
      // se avisa al instante y sin gastar un intento de subida).
      if (!IMG_TIPOS_OK.includes(file.type)) {
        input.value = '';
        _imgError(idPrefix, '⚠️ Formato no permitido — usá una foto JPG o WebP (PNG no se acepta).');
        return;
      }
      if (file.size > IMG_MAX_BYTES) {
        input.value = '';
        _imgError(idPrefix, '⚠️ La foto pesa más de 10 MB — elegí una más liviana.');
        return;
      }
      // Ancho mínimo: se mide la foto real antes de aceptarla.
      const probeUrl = URL.createObjectURL(file);
      const probe = new Image();
      probe.onload = () => {
        if (probe.naturalWidth < IMG_MIN_ANCHO) {
          URL.revokeObjectURL(probeUrl);
          input.value = '';
          _imgError(idPrefix, `⚠️ La foto es muy chica (${probe.naturalWidth} px de ancho) — se vería borrosa. Usá una de al menos ${IMG_MIN_ANCHO} px.`);
          return;
        }
        _clearPickedFile(idPrefix);
        const s = _st(idPrefix);
        s.file = file; s.removed = false;
        s.objUrl = probeUrl;
        _renderImagen(idPrefix);
      };
      probe.onerror = () => {
        URL.revokeObjectURL(probeUrl);
        input.value = '';
        _imgError(idPrefix, '⚠️ No se pudo leer la foto — probá con otra.');
      };
      probe.src = probeUrl;
    });
    document.getElementById(idPrefix + 'imagen-quitar')?.addEventListener('click', () => {
      _clearPickedFile(idPrefix);
      const s = _st(idPrefix);
      s.removed = true; // si había una foto ya guardada, se borra el campo al guardar
      _imgError(idPrefix, '');
      _renderImagen(idPrefix);
    });
  }

  /** Modo edición: muestra la foto ya guardada (si tiene). */
  function precargarImagen(idPrefix, url) {
    _clearPickedFile(idPrefix);
    const s = _st(idPrefix);
    s.existingUrl = url || ''; s.removed = false;
    _imgError(idPrefix, '');
    _renderImagen(idPrefix);
  }

  /** Vuelta a cero (cancelar / después de guardar). */
  function resetImagen(idPrefix) { precargarImagen(idPrefix, ''); }

  /**
   * Se llama al guardar. Devuelve `{ changed, url }`:
   *  - `changed:false` → no tocaron la foto, no hay que escribir `imagenUrl`.
   *  - `changed:true`  → hay que escribir `imagenUrl = url` ('' si la quitaron).
   * Si eligieron un archivo nuevo, lo sube ACÁ (carpeta
   * `.../{ciudad activa}/eventos/`, preset `smartcity_eventos_01`).
   * Si la subida sale bien pero el guardado posterior falla, el reintento
   * reusa la misma URL (no sube dos veces). Lanza error si la subida falla.
   */
  async function resolverImagen(idPrefix, nombre) {
    const s = _st(idPrefix);
    if (s.file) {
      if (!s.uploadedUrl) {
        if (typeof uploadToCloudinary !== 'function') throw new Error('uploadToCloudinary no disponible');
        const al = window.ACTIVE_LOCATION || {};
        const location = {};
        if (al.countryCode)  location.country = al.countryCode;
        if (al.provinceCode) location.state   = al.provinceCode;
        if (al.cityCode)     location.city    = al.cityCode;
        const base = (window.EventosShared && EventosShared.slugifyNombre ? EventosShared.slugifyNombre(nombre) : '') || 'evento';
        s.uploadedUrl = await uploadToCloudinary(s.file, {
          subfolder: 'eventos',
          location,
          publicId: `${base}_${Date.now().toString(36)}`, // nunca el nombre del celular: evita choques entre usuarios
        });
      }
      return { changed: true, url: s.uploadedUrl };
    }
    if (s.removed && s.existingUrl) return { changed: true, url: '' };
    return { changed: false, url: s.existingUrl };
  }

  return {
    wireImagenInput,
    precargarImagen,
    resetImagen,
    resolverImagen,
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
    formatEventoResumen,
    wireHorarios,
    getHorarios,
    setHorarios,
    resetHorarios,
    analizarSolapes,
  };
})();

// [Etapa 11] engancha los inputs de foto de los 2 formularios (admin y usuario).
EventosFormCommon.wireImagenInput('evt-');
EventosFormCommon.wireImagenInput('up-evt-');

// [2026-10-01] engancha el bloque de horarios por filas de los 2 formularios.
EventosFormCommon.wireHorarios('evt-');
EventosFormCommon.wireHorarios('up-evt-');
