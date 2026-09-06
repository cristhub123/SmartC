# ACLARACIONES — fix categorías admin (2026-09-06)

## Archivos modificados
- `js/categories.js` (único archivo tocado)

## 1) Borrado de subcategoría con 1 click sin confirmación / bypass de "Guardar cambios"
Revisé el código a fondo (deleteCat, deleteSubcat, saveCategoriesSettings) y en el
proyecto que me pasaste **ya existía** el `confirm()` para categorías Y para
subcategorías, y ninguna de las dos escribe directo a Firestore — ambas solo
tocan la memoria (CAT/CUSTOM_CATS) y marcan `_catsDirty`. El único lugar del
código que escribe `settings/categories` en Firestore es `saveCategoriesSettings()`,
y lo único que la llama es el botón "💾 Guardar cambios". No encontré ningún
bypass real en este archivo.

Posible explicación: si probaste esto en el navegador ANTES de este envío, es
razonable que el navegador tuviera cacheada una versión previa del JS. Te
recomiendo forzar recarga sin caché (Ctrl+Shift+R / Cmd+Shift+R) antes de
volver a probar.

De todos modos, agregué una capa extra de seguridad que no existía: si hay
cambios sin guardar en la pestaña (incluido un borrado) y intentás recargar o
cerrar la pestaña del navegador, ahora aparece el aviso nativo de "salir sin
guardar los cambios" — así queda clarísimo, antes de perderlos, si lo que
hiciste ya está en Firestore o no.

## 2) No se podía editar el texto (nombre) de categorías/subcategorías
Antes el nombre en español solo se podía tocar adentro del acordeón oculto
"🌐 Idiomas" (que además era chico y difícil de ver — ver punto 3). Ahora cada
categoría y cada subcategoría tiene un campo de texto SIEMPRE visible en la
fila (mismo estilo que cualquier otro campo editable de la app) donde se edita
directamente el nombre en español. El acordeón "🌐 Inglés / Portugués" queda
solo para esos 2 idiomas secundarios.

## 3) Textos chicos difíciles de leer (verde claro) en el panel admin
Esto lo apliqué **solo a la pestaña Categorías** (`#tp-cats`), no al resto del
panel admin — cambiar el color/tamaño de los textos chicos en TODAS las
pestañas del admin (Apariencia, Eventos, Usuarios, etc.) es un trabajo bastante
más grande, y no era el foco de esta entrega. Si querés que lo extienda al
resto del panel, decime y lo armamos como una etapa aparte.

Dentro de la pestaña Categorías: el verde clarito (`--text3`) pasa a un verde
oscuro con buen contraste, y los tamaños de fuente chicos (9/9.5/10/11/12px)
suben +2px. Si en algún momento activás el skin oscuro "neobrutal-night", ese
mismo texto usa un tono claro en vez de oscuro (un verde oscuro sobre fondo
casi negro sería igual de ilegible) — ya está contemplado.

## Verificación
`node --check` sin errores en todo el proyecto (`js/*.js`). **No probado
todavía contra Firebase real ni en el navegador** — falta que lo confirmes en
tu entorno.
