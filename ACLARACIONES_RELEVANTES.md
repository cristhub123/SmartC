# Categorías del admin — persistencia real (Firestore)

## Qué se agregó
Mismo esquema que ya usa el resto de la config de la app (apariencia
global, estilo de mapa, skin, tipografía): un solo documento en la
colección `settings`.

- **`js/settings-sync.js`**: nuevas funciones `saveCategoriesSettings()` /
  `loadCategoriesSettings()`. Guardan/leen `settings/categories`, con:
  - `customCats`: las categorías que crees desde el panel (con su
    label, ícono, color y estado activo/inactivo).
  - `builtinActive`: qué categorías BASE (las que ya vienen
    hardcodeadas en `js/config.js`) están activas o desactivadas —
    solo se guarda ese flag, no la categoría entera (esas no se
    pueden borrar ni editar desde el panel, así que no hace falta).

- **`js/categories.js`**: las 3 acciones del tab "Categorías" ahora
  llaman a `saveCategoriesSettings()` después de aplicar el cambio en
  memoria:
  - Crear categoría nueva (`btn-add-cat`)
  - Activar/desactivar (`toggleCat`)
  - Eliminar (`deleteCat`)

- **`js/app.js`**: se agregó `loadCategoriesSettings()` al mismo grupo
  de cargas en paralelo del arranque (`Promise.all` en `init()`) que ya
  usan apariencia/mapa/features/eventos — corre ANTES de dibujar los
  pines y armar la barra de filtros, para que ambos nazcan ya con el
  estado guardado.

## Qué falta / a tener en cuenta
- Editar el color o el ícono de una categoría YA EXISTENTE sigue sin
  ser posible desde el panel (nunca lo fue) — solo se puede crear,
  activar/desactivar o eliminar. Si en algún momento se agrega esa
  edición, tiene que llamar a `saveCategoriesSettings()` también.
- Igual que el resto de estos guardados (`saveGlobalSettings`,
  `saveMapSettings`, etc.), si falla el guardado (por ejemplo sin
  sesión iniciada) tira un toast de aviso — no hay reintento
  automático.
