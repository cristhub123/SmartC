/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/* ═══════════════════════════════════════════════════════════
   overlay-manager.js — EXCLUSIVIDAD ENTRE PANELES/MENÚS FLOTANTES
   ---------------------------------------------------------------
   [NUEVO 2026-08-18] Pedido por Cris: si hay un panel o menú
   flotante abierto (panel de un pin, dropdown de zonas, panel de
   info de una zona) y el usuario dispara la apertura de OTRO, el
   primero debe empezar a cerrarse ya mismo — sin que nadie tenga
   que esperar a que termine su animación de salida (0.35s/0.4s
   según el panel, ver css/poi-panel.css y css/base.css) para que el
   segundo arranque. Antes cada panel se abría/cerraba de forma
   totalmente aislada: no había ningún punto en común que supiera
   "hay otra cosa abierta, hay que cerrarla primero".

   CÓMO SE USA (patrón, no reimplementar por archivo):
     1. Cada panel/menú se registra UNA vez con su propio id:
          OverlayManager.register('miPanel', {
            isOpen: () => <boolean>,
            close:  () => <cierra ya, sin esperar la animación>,
          });
     2. Antes de abrirse a sí mismo, en vez de abrir directo, llama:
          OverlayManager.beforeOpen('miPanel', () => { <abrir de verdad> });
        Esto cierra cualquier OTRO overlay que esté abierto ya mismo
        (sin esperar su transición CSS, que sigue corriendo sola) y:
          - si había algo para cerrar, espera STAGGER_MS (50ms) antes
            de disparar la apertura real — para que visualmente el
            cierre del anterior ya esté en marcha cuando el nuevo
            empieza a aparecer, sin superponerse desde el frame 0
            (que se ve como un "salto" en vez de un cruce prolijo);
          - si no había nada abierto, abre de inmediato, sin demora
            artificial.
     3. Si un flujo YA tiene su propia secuencia escalonada de pasos
        (ej. el click en un pin: paneo del mapa → maximizar pin →
        abrir panel, ver js/cluster.js) y esa secuencia no debe
        retrasarse por este mecanismo, no uses beforeOpen para todo
        el flujo — llamá a `OverlayManager.closeOthers(miId)` una
        sola vez, al principio, y dejá que el resto de la secuencia
        siga corriendo en el orden que ya tenía (ver cluster.js: cerrar
        zonas es inmediato, pero el paneo/maximizado/apertura del pin
        no se retrasan por esto, tal cual pidió Cris).

   Este módulo NO sabe nada de CSS ni de qué panel es cuál — solo
   orquesta timing. Cada panel sigue siendo dueño de su propia
   animación (transición CSS por atributo/clase, como ya estaba).
   ═══════════════════════════════════════════════════════════ */

const OverlayManager = (function () {
  'use strict';

  const STAGGER_MS = 50;

  // id -> { isOpen: Function, close: Function }
  const _overlays = {};

  function register(id, controller) {
    if (!id || !controller || typeof controller.isOpen !== 'function' || typeof controller.close !== 'function') {
      console.error('[OverlayManager] register() necesita id + { isOpen, close }:', id);
      return;
    }
    _overlays[id] = controller;
  }

  function unregister(id) {
    delete _overlays[id];
  }

  /**
   * Cierra ya mismo cualquier overlay registrado que esté abierto,
   * salvo `exceptId` (típicamente el que está por abrirse a sí
   * mismo, o el que ya se está manejando aparte).
   * @param {string} [exceptId]
   * @returns {boolean} true si cerró al menos uno.
   */
  function closeOthers(exceptId) {
    let closedAny = false;
    Object.keys(_overlays).forEach((id) => {
      if (id === exceptId) return;
      const ctrl = _overlays[id];
      try {
        if (ctrl.isOpen()) {
          ctrl.close();
          closedAny = true;
        }
      } catch (err) {
        console.error(`[OverlayManager] error cerrando "${id}":`, err);
      }
    });
    return closedAny;
  }

  /**
   * Punto de entrada para un overlay que está por abrirse: cierra
   * cualquier otro overlay abierto de inmediato y, solo si había
   * algo para cerrar, espera STAGGER_MS antes de ejecutar `openFn`
   * (la apertura real). Sin nada abierto, abre sin demora.
   * @param {string} id - id propio (no se cierra a sí mismo)
   * @param {Function} openFn
   */
  function beforeOpen(id, openFn) {
    const closedAny = closeOthers(id);
    if (closedAny) {
      window.setTimeout(openFn, STAGGER_MS);
    } else {
      openFn();
    }
  }

  return { register, unregister, closeOthers, beforeOpen };
})();

window.OverlayManager = OverlayManager;
