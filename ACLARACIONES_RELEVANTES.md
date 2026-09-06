# Tab "Categorías" del admin — fix de acceso + aviso de persistencia

## Bug corregido
`renderCatsAdmin()` (la función que dibuja la lista de categorías existentes
con sus botones de activar/desactivar/eliminar) solo se llamaba desde:
- `toggleCat()` (después de tocar el switch)
- `deleteCat()` (después de borrar)
- el handler de "+ Agregar Categoría"

Nunca se llamaba al ABRIR el tab. Por eso `#cats-admin-list` arrancaba
vacío y la única forma de "activar" el listado era crear una categoría
nueva primero (dispara el único code path que sí renderiza).

Fix: se registró `renderCatsAdmin` con `SC.registerTabPlugin('cats', ...)`
(mecanismo ya existente en `js/config.js` / `js/admin.js`, pensado
justamente para esto — no se tocó `switchTab()` a mano). Ahora la lista se
puebla sola cada vez que se abre el tab "Categorías".

## ⚠️ Importante — nada de esto se guarda todavía
Crear una categoría, editar su color/ícono, activar/desactivar una
categoría o eliminarla: **todo vive en memoria del navegador**
(`CUSTOM_CATS` es un `let` en JS, y el flag `active` de las categorías
base se pisa directo sobre el objeto `CAT` de `config.js`). No hay ninguna
llamada a Firestore ni a localStorage en este flujo. Al recargar la
página se pierde todo y vuelve al estado original de `config.js`.

No se tocó esto en este ZIP porque es un cambio de otro alcance
(agregar persistencia real) — queda pendiente para cuando se decida
encarar eso.

## Archivo modificado
- `js/categories.js` (solo se agregó el registro del tab plugin al final
  del archivo, nada más se tocó)
