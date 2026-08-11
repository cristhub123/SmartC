/* ═══════════════════════════════════════════════════════════
   SCROLL HINTS — flechas indicadoras minimalistas y reutilizables
   ---------------------------------------------------------------
   REGLA DE DISEÑO: cualquier zona con scroll debe avisar visualmente
   que hay más contenido oculto. Este archivo hace eso automático:
   marcá cualquier contenedor con initScrollHint(el) y listo, no hay
   que repetir la lógica cada vez (pestañas del admin, paneles de
   cada pin, etc — donde sea que aparezca contenido desplazable).
   ═══════════════════════════════════════════════════════════ */

function initScrollHint(container) {
  if (!container || container.dataset.scrollHintReady) return;
  container.dataset.scrollHintReady = '1';

  // Orientación: 'vertical' (arriba/abajo) u 'horizontal' (izquierda/derecha).
  // Por defecto se detecta sola según cómo se desborda el contenido.
  // Se puede forzar con data-scroll-hint="horizontal" en el HTML.
  const forced = container.dataset.scrollHint;
  const isHorizontal = forced === 'horizontal' ||
    (forced !== 'vertical' && container.scrollWidth > container.clientWidth &&
     container.scrollHeight <= container.clientHeight + 2);

  const [classA, classB] = isHorizontal ? ['left', 'right'] : ['top', 'bottom'];
  const [iconA, iconB]   = isHorizontal ? ['‹', '›'] : ['▲', '▼'];
  const step = isHorizontal ? { left: -120 } : { top: -120 };
  const stepBack = isHorizontal ? { left: 120 } : { top: 120 };

  const arrowA = document.createElement('div');
  arrowA.className = `scroll-hint-arrow ${classA}`;
  arrowA.innerHTML = iconA;
  const arrowB = document.createElement('div');
  arrowB.className = `scroll-hint-arrow ${classB}`;
  arrowB.innerHTML = iconB;

  container.prepend(arrowA);
  container.appendChild(arrowB);

  arrowA.addEventListener('click', () => container.scrollBy({ ...step, behavior: 'smooth' }));
  arrowB.addEventListener('click', () => container.scrollBy({ ...stepBack, behavior: 'smooth' }));

  function refresh() {
    let canBack, canFwd;
    if (isHorizontal) {
      canBack = container.scrollLeft > 4;
      canFwd  = container.scrollLeft < container.scrollWidth - container.clientWidth - 4;
    } else {
      canBack = container.scrollTop > 4;
      canFwd  = container.scrollTop < container.scrollHeight - container.clientHeight - 4;
    }
    arrowA.classList.toggle('visible', canBack);
    arrowB.classList.toggle('visible', canFwd);
  }

  container.addEventListener('scroll', refresh);
  // Recalcular cuando cambie el tamaño del contenido (ej: al cargar datos)
  new ResizeObserver(refresh).observe(container);
  refresh();
}

// Aplicar automáticamente a cualquier elemento marcado con [data-scroll-hint]
function applyScrollHints() {
  document.querySelectorAll('[data-scroll-hint]').forEach(initScrollHint);
}
document.addEventListener('DOMContentLoaded', applyScrollHints);
