/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/* ═══════════════════════════════════════════════════════════
   ui-guards.js — GUARDA ANTI-SELECCIÓN-DE-TEXTO-ARRASTRADA
   ---------------------------------------------------------------
   [NUEVO 2026-08-31] Pedido por Cris (Punto 1 de
   PLAN_FIX_CIERRE_PANELES.md): si arrastra una selección de texto
   dentro de un campo (ej. contraseña del login) y suelta el click
   afuera de ese campo (sobre el mapa, un overlay, etc.), el
   navegador igual dispara un `click` ahí afuera — y hasta ahora
   cualquier listener de "click afuera cierra esto" lo tomaba como
   un click real y cerraba el panel/login/dropdown, perdiendo lo que
   se estaba escribiendo.

   CÓMO SE USA (patrón, no reimplementar por archivo):
     Al principio de cualquier listener de "click afuera para
     cerrar", cortar temprano si esto devuelve true:
       document.addEventListener('click', e => {
         if (window.UIGuards && window.UIGuards.wasTextDragRelease(e)) return;
         ...
       });
     Para listeners de Leaflet (`map.on('click', e => {...})`), el
     evento nativo del navegador viene en `e.originalEvent`:
       map.on('click', e => {
         if (window.UIGuards && window.UIGuards.wasTextDragRelease(e.originalEvent)) return;
         ...
       });

   No toca el comportamiento normal de selección de texto (que ya
   funciona bien) — solo evita que ESE click puntual dispare un
   cierre. No reemplaza el chequeo de "target está afuera del panel"
   que cada listener ya tenía: se suma antes, como corte temprano.
   ═══════════════════════════════════════════════════════════ */

const UIGuards = (function () {
  'use strict';

  // true si el mousedown/pointerdown que arrancó el gesto actual
  // empezó dentro de un campo de texto editable.
  let _downOnEditable = false;

  function _isEditableTarget(el) {
    if (!el || !el.tagName) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el.isContentEditable;
  }

  // Capture:true para que esto se entere del mousedown/pointerdown
  // ANTES que cualquier otro listener de la app — así el estado
  // queda listo pase lo que pase con el resto de los handlers.
  document.addEventListener('mousedown', (e) => {
    _downOnEditable = _isEditableTarget(e.target);
  }, true);
  document.addEventListener('pointerdown', (e) => {
    // Táctil/stylus: mismo criterio, sin pisar un mousedown más
    // preciso que ya haya corrido en el mismo gesto.
    if (e.pointerType !== 'mouse') _downOnEditable = _isEditableTarget(e.target);
  }, true);

  /**
   * Llamar al principio de un listener de "click afuera cierra
   * esto". Devuelve true si ESTE click hay que ignorarlo porque en
   * realidad fue soltar una selección de texto arrastrada desde un
   * campo editable — no un click real de "cerrar".
   * @param {MouseEvent} e - el evento nativo del click (no el de Leaflet)
   */
  function wasTextDragRelease(e) {
    if (!_downOnEditable) return false;
    const sel = window.getSelection ? window.getSelection().toString() : '';
    if (sel && sel.length > 0) return true;
    if (e && e.target && !_isEditableTarget(e.target)) return true;
    return false;
  }

  return { wasTextDragRelease };
})();

window.UIGuards = UIGuards;
