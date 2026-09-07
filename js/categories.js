/**
 * js/categories.js
 * Módulo de gestión y animación de Categorías y Subcategorías
 */

const CATEGORY_CONTAINER_ID = 'category-filters';
const POS_OFFSET_X = 78; // Espaciado horizontal en píxeles entre botones

let currentActiveCategoryId = null;
let currentActiveSubcategoryId = null;
let isSubcategoryView = false;

/**
 * Inicializa y renderiza las categorías principales en el contenedor
 * @param {Array} categoriesList - Lista de categorías principales [{id, name, color, iconHtml}, ...]
 */
function initCategories(categoriesList) {
  const container = document.getElementById(CATEGORY_CONTAINER_ID);
  if (!container) return;

  container.innerHTML = '';
  isSubcategoryView = false;
  currentActiveCategoryId = null;
  currentActiveSubcategoryId = null;

  categoriesList.forEach((cat, idx) => {
    const posX = idx * POS_OFFSET_X;
    const btn = document.createElement('button');

    btn.className = 'category-btn';
    btn.dataset.id = cat.id;
    btn.dataset.idx = idx;
    btn.style.setProperty('--current-x', `${posX}px`);
    btn.style.transform = `translate(${posX}px, 0px)`;

    btn.innerHTML = `
      <div class="category-icon" style="background-color: ${cat.color || '#1c1c1e'};">
        ${cat.iconHtml || cat.icon || '📍'}
      </div>
      <span class="category-label">${cat.name}</span>
    `;

    btn.addEventListener('click', () => {
      handleCategoryClick(cat, categoriesList);
    });

    container.appendChild(btn);
  });
}

/**
 * Manejador del evento click sobre una categoría principal
 */
function handleCategoryClick(category, allCategories) {
  // Si se vuelve a presionar la categoría principal activa, volvemos a la vista principal
  if (isSubcategoryView && currentActiveCategoryId === category.id) {
    resetToMainCategories();
    return;
  }

  // Si tiene subcategorías, iniciamos la secuencia de animación
  if (category.subcategories && category.subcategories.length > 0) {
    currentActiveCategoryId = category.id;
    isSubcategoryView = true;
    renderSubcategoryTransition(category.id, category.subcategories);
  } else {
    setActiveCategory(category.id);
  }
}

/**
 * Ejecuta la secuencia completa de animación hacia las subcategorías
 * @param {string} selectedCategoryId - ID de la categoría tocada
 * @param {Array} subcategories - Arreglo de subcategorías a desplegar
 */
function renderSubcategoryTransition(selectedCategoryId, subcategories) {
  const container = document.getElementById(CATEGORY_CONTAINER_ID);
  if (!container) return;

  const mainBtns = Array.from(container.querySelectorAll('.category-btn:not(.sub-item)'));
  const selectedBtn = mainBtns.find(btn => btn.dataset.id === selectedCategoryId);
  const otherBtns = mainBtns.filter(btn => btn !== selectedBtn);

  // 1. STAGGER DESCENDENTE: Salida de los otros íconos de Derecha a Izquierda
  const sortedOthers = otherBtns.sort((a, b) => parseInt(b.dataset.idx) - parseInt(a.dataset.idx));

  sortedOthers.forEach((btn, index) => {
    setTimeout(() => {
      btn.classList.add('exit-down');
    }, index * 40); // 40ms entre caídas
  });

  // 2. DESPLAZAMIENTO DEL SELECCIONADO: Trayecto S-curve hacia la posición 0 (extremo izquierdo)
  setTimeout(() => {
    if (selectedBtn) {
      selectedBtn.style.setProperty('--current-x', '0px');
      selectedBtn.style.transform = 'translate(0px, 0px)';
      selectedBtn.classList.add('selected-parent');
    }
  }, 80);

  // 3. STAGGER ASCENDENTE: Entrada de subcategorías de Izquierda a Derecha
  setTimeout(() => {
    subcategories.forEach((sub, i) => {
      const posX = (i + 1) * POS_OFFSET_X;
      const subBtn = document.createElement('button');

      subBtn.className = 'category-btn sub-item';
      subBtn.dataset.id = sub.id;
      subBtn.style.setProperty('--current-x', `${posX}px`);
      subBtn.style.transform = `translate(${posX}px, 0px)`;

      subBtn.innerHTML = `
        <div class="category-icon" style="background-color: ${sub.color || '#2b5c8f'};">
          ${sub.iconHtml || sub.icon || '🏷️'}
        </div>
        <span class="category-label">${sub.name}</span>
      `;

      // Evento de selección de subcategoría: Elevar la seleccionada unos píxeles
      subBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        container.querySelectorAll('.sub-item').forEach(el => el.classList.remove('active'));
        subBtn.classList.add('active');
        currentActiveSubcategoryId = sub.id;

        if (typeof window.filterBySubcategory === 'function') {
          window.filterBySubcategory(sub.id);
        }
      });

      container.appendChild(subBtn);

      // Garantizar que el navegador prepare el estado oculto antes de disparar la entrada
      requestAnimationFrame(() => {
        setTimeout(() => {
          subBtn.classList.add('enter-up');
        }, (i + 1) * 60);
      });
    });
  }, 500); // Se dispara justo cuando el botón principal llega a la izquierda
}

/**
 * Oculta las subcategorías y restaura la vista a las categorías principales
 */
function resetToMainCategories() {
  const container = document.getElementById(CATEGORY_CONTAINER_ID);
  if (!container) return;

  const subBtns = container.querySelectorAll('.sub-item');

  // Caída de subcategorías
  subBtns.forEach((btn, i) => {
    setTimeout(() => {
      btn.classList.remove('enter-up', 'active');
      setTimeout(() => btn.remove(), 250);
    }, i * 30);
  });

  // Restaurar posiciones y visibilidad de los botones principales
  setTimeout(() => {
    const mainBtns = container.querySelectorAll('.category-btn:not(.sub-item)');

    mainBtns.forEach((btn) => {
      const originalIdx = parseInt(btn.dataset.idx);
      const originalX = originalIdx * POS_OFFSET_X;

      btn.style.setProperty('--current-x', `${originalX}px`);
      btn.style.transform = `translate(${originalX}px, 0px)`;
      btn.classList.remove('exit-down', 'selected-parent');
    });

    isSubcategoryView = false;
    currentActiveCategoryId = null;
    currentActiveSubcategoryId = null;

    if (typeof window.resetCategoryFilter === 'function') {
      window.resetCategoryFilter();
    }
  }, 250);
}

/**
 * Resalta visualmente una categoría principal específica
 */
function setActiveCategory(categoryId) {
  const container = document.getElementById(CATEGORY_CONTAINER_ID);
  if (!container) return;

  container.querySelectorAll('.category-btn').forEach(btn => {
    if (btn.dataset.id === categoryId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  currentActiveCategoryId = categoryId;
}

// Exportación al objeto global
window.initCategories = initCategories;
window.renderSubcategoryTransition = renderSubcategoryTransition;
window.resetToMainCategories = resetToMainCategories;
window.setActiveCategory = setActiveCategory;