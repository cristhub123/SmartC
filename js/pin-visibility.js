/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/* pin-visibility.js — [2026-09-03] ver PLAN_VISIBILIDAD_PINES_UNIFICADA.md

   Única fuente de verdad de "¿este pin se ve ahora mismo en el mapa
   público?". Antes esta pregunta se respondía por separado, con
   lógica propia, en 7 lugares distintos (markers.js, admin.js,
   app.js, categories.js x2, eventos.js x2, cluster-grouping.js) —
   cada uno con su propia copia, y casi ninguno se enteraba de los
   demás. Eso era la causa real de que, por ejemplo, el sistema de
   clusters siguiera contando pines que el filtro público tenía
   ocultos.

   A partir de ahora, CUALQUIER parte del código que necesite saber
   si un pin se ve, o mostrarlo/ocultarlo, llama a las funciones de
   acá — no vuelve a escribir su propia versión de esta lógica.
*/

/** La función que DECIDE. No toca el DOM, solo responde true/false. */
function isPinVisible(poi) {
  if (!poi) return false;

  // 1) ¿Está publicado/activo?
  if (poi.active === false) return false;

  // 2) ¿Tiene al menos 1 categoría activa?
  //    [Bug de paso, corregido acá] Antes (toggleCat, categories.js)
  //    un pin con 2+ categorías se ocultaba ENTERO apenas se apagaba
  //    UNA de ellas, sin importar si la otra seguía activa — y el
  //    resultado final dependía del ORDEN en que se tocaran los
  //    toggles. Ahora se pide que tenga AL MENOS UNA activa.
  if (typeof getAllCats === 'function') {
    const all  = getAllCats();
    const cats = (Array.isArray(poi.categories) && poi.categories.length)
      ? poi.categories : [poi.category];
    const algunaActiva = cats.some(id => {
      const cat = all[id];
      return !cat || cat.active !== false; // categoría no encontrada (dato legado) no bloquea
    });
    if (!algunaActiva) return false;
  }

  // 3) ¿Pasa el filtro público elegido ahora mismo? ("Todo" / una
  //    categoría puntual / "Eventos y actividades")
  if (typeof _pinMatchesActiveFilter === 'function' && !_pinMatchesActiveFilter(poi)) {
    return false;
  }

  return true;
}

/** La función que APLICA. Hace el trabajo mecánico real sobre el DOM,
 *  usando isPinVisible() como única fuente de la decisión. */
function applyPinVisibility(poi) {
  if (!poi) return;
  const el = document.getElementById('pw-' + poi.id);
  if (!el) return; // sin marcador dibujado todavía (ej. sin coordenadas)
  const markerEl = el.parentElement;
  const visible = isPinVisible(poi);
  el.style.display = visible ? '' : 'none';
  if (markerEl) markerEl.style.visibility = visible ? '' : 'hidden';

  // [Filtro de fecha de eventos, 2026-09-03] con el filtro "Eventos"
  // activo y una fecha elegida (js/eventos-fecha-filtro.js), atenúa
  // (no oculta) los pines visibles que no tienen ningún evento ese
  // día. Va acá — no en categories.js/applyFilter() — porque este es
  // el único punto real donde se decide/aplica cómo se ve cada pin
  // (ver nota de arriba del archivo); así la atenuación se recalcula
  // sola cada vez que se recalcula visibilidad, sin duplicar el hook
  // en cada lugar que llama a applyAllPinVisibility().
  const fechaOn = visible
    && typeof activeFilter !== 'undefined' && activeFilter === '__eventos__'
    && typeof fechaFiltroEventos !== 'undefined' && fechaFiltroEventos
    && typeof pinTieneEventoEnFecha === 'function';
  if (fechaOn && !pinTieneEventoEnFecha(poi.id, fechaFiltroEventos)) {
    el.style.opacity = String(window.getOpacidadReducidaFiltroFecha ? window.getOpacidadReducidaFiltroFecha() : 0.35);
  } else {
    el.style.opacity = ''; // pin fuera del filtro de fecha, o sin fecha elegida: opacidad normal
  }
}

/** Recorre todos los pines — usar después de cualquier cambio que
 *  afecte a varios de golpe (prender/apagar una categoría, cambiar
 *  el filtro elegido, recargar categorías). */
function applyAllPinVisibility() {
  if (typeof POIS === 'undefined') return;
  POIS.forEach(applyPinVisibility);
}

window.isPinVisible          = isPinVisible;
window.applyPinVisibility    = applyPinVisibility;
window.applyAllPinVisibility = applyAllPinVisibility;
