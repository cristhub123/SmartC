# PLAN_CORRECCIONES_ADMIN.md

Plan de trabajo para: (1) los bugs de guardado detectados en el informe del panel admin, y (2) sumar confirmación de seguridad a todo botón de eliminar que hoy no la tenga.

---

## ⚠️ INSTRUCCIONES PARA QUIEN EJECUTE ESTE PLAN (leer antes de tocar código)

- **Este archivo ES el plan vigente a ejecutar ahora mismo, una etapa a la vez.** No se arranca una etapa nueva sin que la anterior haya quedado marcada como completada acá abajo (salvo que Cris pida explícitamente saltar el orden).
- **Antes de empezar a trabajar, leer entera la sección "REGISTRO POR ETAPA"** al final de este archivo para saber qué está hecho y qué no. Este plan está pensado para que lo puedan ejecutar varias IAs en paralelo (en distintos chats/sesiones) sin pisarse: el registro es la única fuente de verdad de qué ya está resuelto — no asumir nada por lo que diga el resto de la conversación de un chat puntual.
- **Apenas se termina y se verifica una etapa completa** (todos sus puntos, no una parte), hay que actualizar ESTE MISMO ARCHIVO antes de dar la etapa por cerrada:
  - En la tabla "MAPA DE ETAPAS" más abajo, cambiar el estado de esa fila a `✅ Completada`.
  - En "REGISTRO POR ETAPA", reemplazar su línea `pendiente` por `✅ Completada (DD/MM/AAAA)` + 1-2 líneas resumiendo qué se hizo y cómo se verificó.
  - Si en el camino se encontró algo que obliga a ajustar una etapa siguiente (por ejemplo, un detalle nuevo en Temas/Roadmap/Grupos), anotarlo en la etapa afectada antes de que otra IA la empiece.
- **No volver a tocar una etapa ya marcada como completada** salvo que Cris pida explícitamente revisarla de nuevo (por ejemplo, porque encontró que algo no quedó bien) — si eso pasa, se reabre su estado a `🔁 Reabierta` con el motivo, no se borra el historial anterior.
- **Cuando las 7 etapas estén marcadas como `✅ Completada`:**
  1. Agregar `— COMPLETADO E IMPLEMENTADO` al título de este documento (la primera línea, el `# PLAN_CORRECCIONES_ADMIN.md`).
  2. Renombrar el archivo agregándole `_COMPLETADO` al final del nombre (ej: `PLAN_CORRECCIONES_ADMIN_COMPLETADO.md`).
  3. Esto es así para que, a simple vista (por el nombre del archivo y por la primera línea), cualquiera —Cris o cualquier IA— sepa que no queda nada pendiente de este plan y no se vuelva a intentar re-hacer algo que ya está resuelto.

---

## PRINCIPIOS QUE ORDENAN ESTE PLAN

- **Nunca se prioriza velocidad por sobre que el resultado sea correcto.** Si una etapa necesita más tiempo para quedar bien hecha, se lo toma.
- **Cada etapa es chica y autocontenida.** Se entrega, se prueba, recién ahí se sigue con la próxima — nunca "de una" se tocan varias cosas sin relación entre sí.
- **Se agrupa por tipo de arreglo, no por pestaña**, cuando varias pestañas comparten exactamente el mismo problema de fondo (ej: Temas/Roadmap/Grupos no guardan nada, los tres por la misma razón estructural) — así se resuelve el patrón una vez y se aplica a los tres, en vez de reinventar la solución tres veces en tres entregas sueltas. Aun agrupadas, cada pestaña se prueba y se lista por separado dentro de la etapa.
- **Regla de seguridad para eliminar, pedida por Cris:** todo botón de eliminar que hoy borre sin preguntar nada debe, de acá en más, mostrar antes una confirmación clara (aceptar/cancelar) — reutilizando el mismo modal prolijo que ya existe en Lugares (no el cartelito feo nativo del navegador). Y en las pestañas que juntan cambios en memoria hasta un botón único "Guardar cambios" (como ya hace Categorías), el borrado queda sujeto a lo mismo que cualquier otro cambio de esa pestaña: no es definitivo hasta que se aprieta ese botón — si se recarga sin guardar, se pierde el borrado, no el dato.

---

## MAPA DE ETAPAS

| # | Etapa | Por qué en ese orden | Estado |
|---|-------|----------------------|--------|
| 1 | Confirmación de borrado — casos de ALTO riesgo que hoy no tienen ninguna | Es lo único que hoy te puede hacer perder datos reales de un click sin querer, en pestañas que ya andan bien. Se frena el riesgo primero, antes de tocar nada más. | ✅ Completada |
| 2 | Color/ícono de categorías base (el bug que reportaste al principio) | Chico, aislado, no depende de nada de lo anterior. | ✅ Completada |
| 3 | Cuentas — arreglar el guardado de plan/funciones premium | Chico, aislado, un solo cambio puntual. | ✅ Completada |
| 4 | Persistencia real de Temas, Roadmap y Grupos | El bloque más grande — cada una se entrega por separado, pero comparten el mismo patrón técnico (conectarlas a Firestore + botón "Guardar cambios" con aviso de cambios sin guardar, igual que Categorías). | ⬜ Pendiente |
| 5 | Confirmación de borrado en Temas, Roadmap y Grupos | Depende de la etapa 4 — no tiene sentido confirmar un borrado que hoy ni se guarda. Queda sujeto a "Guardar cambios" de cada una. | ⬜ Pendiente |
| 6 | Unificar visualmente los borrados que ya preguntan, pero con el cartelito feo del navegador | Categorías, Subcategorías y Eventos ya son seguros hoy (usan `confirm()`), solo se ven distintos al resto de la app. Es estética, no seguridad — va después. | ⬜ Pendiente |
| 7 | Confirmación en los casos de bajo riesgo (dentro de formularios que recién impactan al guardar) | Ya están protegidos hoy de hecho, porque solo pegan si después guardás ese formulario puntual. Es la prioridad más baja. | ⬜ Pendiente |

*(Leyenda: ⬜ Pendiente · 🔶 En curso · ✅ Completada · 🔁 Reabierta — actualizar esta columna Y la sección "REGISTRO POR ETAPA" al cerrar cada una, ver instrucciones arriba.)*

---

## ETAPA 1 — Confirmación de borrado: alto riesgo, sin ninguna confirmación hoy

**Qué se hace:** agregar el modal de confirmación (aceptar/cancelar) antes de que estos 3 botones borren de verdad en Firestore. Los 3 casos son de pestañas que ya guardan bien — el borrado en sí queda igual (inmediato al confirmar), solo se le suma la pregunta previa.

| Dónde | Qué borra | Archivo | Estado hoy |
|---|---|---|---|
| Ubicaciones | Una ubicación (país/provincia/ciudad) completa | `js/cities.js` (`deleteLocation`) | Borra al toque, cero confirmación |
| Interfaz → Tipografía | Un preset de tipografía guardado | `js/typography.js` (`_deleteTypoPreset`) | Borra al toque, cero confirmación |
| Interfaz → Tipografía | Una fuente extra cargada (afecta a cualquier preset que la tenga elegida) | `js/typography.js` (`_removeTypoFont`) | Borra al toque, cero confirmación |

**Cómo se prueba:** en cada uno, click en 🗑 → debe aparecer el modal con el nombre de lo que se va a borrar → Cancelar no borra nada → Aceptar borra igual que hoy.

**Riesgo de este cambio:** bajo — no se toca la lógica de borrado en sí, solo se antepone la pregunta.

---

## ETAPA 2 — Color/ícono de categorías base (el bug original)

**Qué se hace:** `saveCategoriesSettings()` (`js/settings-sync.js`) hoy arma el objeto a guardar sin `color` ni `icon` para las categorías base (Gastronomía, Cultura, Música, Bares, Arte, Histórico, Tiendas) — se agregan esos dos campos ahí, y se restauran en `loadCategoriesSettings()`.

**Cómo se prueba:** cambiar el color de una categoría base → Guardar cambios → F5 → el color tiene que seguir ahí (hoy vuelve al original).

**Riesgo:** muy bajo — cambio acotado a 2 funciones de un solo archivo.

---

## ETAPA 3 — Cuentas: guardado de plan/funciones premium

**Qué se hace:** `_saveCuentaPlan()` (`js/usuarios-admin.js`) usa `.update()` sobre `usuarios/{uid}` — si esa cuenta todavía no tiene documento creado en Firestore, la escritura falla entera (error "no existe el documento"). Se cambia a `.set(..., {merge:true})`, que crea el documento si no existe y no pisa el resto de sus campos si ya existe.

**Cómo se prueba:** buscar una cuenta que nunca se haya tocado desde este panel, marcarle plan premium, guardar — tiene que guardar sin error.

**Riesgo:** muy bajo — un solo método de Firestore cambiado en una sola función.

---

## ETAPA 4 — Persistencia real de Temas, Roadmap y Grupos

Las tres comparten el mismo problema: todo lo que se hace en esas pestañas vive solo en memoria del navegador (`TEMAS`, `ROADMAP`, `GROUPS` son arrays sueltos en su JS) y se pierde al recargar. Se resuelve con el mismo patrón que ya usa Categorías: colección propia en Firestore + carga al abrir la pestaña + botón único **"💾 Guardar cambios"** al final, con aviso de "tenés cambios sin guardar" si se intenta salir sin guardar.

Se entrega en 3 partes separadas (una pestaña por vez), aunque el patrón técnico sea el mismo:

**4.1 — Temas** (`js/themes.js`)
- Conectar `TEMAS` a una colección nueva en Firestore (alta/baja/edición de tema, los 3 interruptores por tema).
- El botón actual "✓ Guardar configuración día/noche" hoy no guarda nada por sí mismo — la hora/tema de noche recién persiste si después se guarda desde Global. Se corrige para que guarde de una vez, sin depender de otra pestaña.

**4.2 — Roadmap** (`js/roadmap.js`)
- Conectar `ROADMAP` a Firestore. Ojo: hoy el array trae ya cargadas todas las ideas históricas (r1 a r34) escritas a mano en el código — al migrar hay que llevarlas todas a Firestore como carga inicial, para no perder ese historial.

**4.3 — Grupos** (`js/groups.js`)
- Conectar `GROUPS` a Firestore.
- De paso, revisar el botón "🏠 Dirección" del modo de ubicación global (misma pestaña): hoy reubica los pines por dirección en el mapa pero no guarda esas coordenadas nuevas en Firestore — se deja anotado para decidir si entra en esta etapa o si preferís tratarlo aparte, porque no es exactamente el mismo tipo de bug (no es "no guarda un dato de configuración", es "no guarda un resultado de una acción sobre datos ya existentes").

**Cómo se prueba (las 3):** crear/editar/borrar un ítem → Guardar cambios → F5 → tiene que seguir estando. Cerrar la pestaña del navegador sin guardar con cambios pendientes → tiene que aparecer el aviso nativo de "salir sin guardar".

**Riesgo:** medio — son 3 features nuevas de guardado, no un parche de una línea. Por eso van en su propia etapa, separadas del resto.

---

## ETAPA 5 — Confirmación de borrado en Temas, Roadmap y Grupos

**Depende de la Etapa 4.** Una vez que esas tres pestañas ya guardan de verdad y tienen su "Guardar cambios" propio:

| Dónde | Qué borra | Archivo |
|---|---|---|
| Temas | Un tema completo | `js/themes.js` (`deleteTema`) |
| Roadmap | Una idea del roadmap | `js/roadmap.js` (`deleteRoadmapItem`) |
| Grupos | Un grupo (los lugares que tenía asignado quedan sin grupo) | `js/groups.js` (`deleteGroup`) |

Igual que en Categorías: el borrado marca la pestaña como "con cambios sin guardar" y recién es definitivo cuando se aprieta "Guardar cambios". Si se cierra sin guardar, el ítem borrado vuelve a aparecer.

**Cómo se prueba:** borrar algo → confirmar en el modal → recargar SIN guardar → tiene que seguir estando (el borrado no llegó a Firestore) → borrar de nuevo → Guardar cambios → recargar → ahora sí desapareció.

---

## ETAPA 6 — Unificar visualmente los borrados que ya preguntan

Estos 3 ya son seguros (usan `confirm()` nativo del navegador, que sí frena el borrado), solo se ven distintos al resto de la app. Se reemplaza el cartelito nativo por el mismo modal prolijo que ya se usa en Lugares:

| Dónde | Archivo |
|---|---|
| Categorías → borrar categoría | `js/categories.js` (`deleteCat`) |
| Categorías → borrar subcategoría | `js/categories.js` (`deleteSubcat`) |
| Eventos → borrar evento | `js/eventos.js` (`_deleteEvento`) |

**Riesgo:** bajo, es un cambio de UI — la lógica de qué se borra y cuándo no cambia.

---

## ETAPA 7 — Confirmación en casos de bajo riesgo

Estos ya están protegidos hoy de hecho: viven dentro de un formulario más grande y solo pegan en Firestore si después se guarda ESE formulario puntual (el lugar, la zona, el catálogo de funciones premium). Se les suma confirmación igual, por prolijidad y porque perder el trabajo de buscar de nuevo una imagen o reescribir un campo también molesta, aunque no rompa datos ya guardados.

| Dónde | Qué quita | Archivo |
|---|---|---|
| Nuevo/Editar lugar | La imagen cargada en un slot | `js/utils.js` (`setupImgUploader` → botón "✕") |
| Nuevo/Editar lugar | Un campo dinámico de información | `js/pin-adjust.js` (`data-remove-pin-field`) |
| Editar zona | Un campo de información de la zona | `js/zones.js` (`data-remove-attr`) |
| Cuentas → catálogo premium | Una fila del catálogo (antes de guardar el catálogo) | `js/usuarios-admin.js` (botón "✕ Quitar") |

**Riesgo:** muy bajo.

---

## REGISTRO POR ETAPA

*(Fuente de verdad de qué está hecho. Al cerrar una etapa, reemplazar su línea "pendiente" por `✅ Completada (DD/MM/AAAA) — qué se hizo y cómo se verificó`, en pocas líneas. No borrar el historial de etapas ya cerradas.)*

- Etapa 1 — Confirmación de borrado (alto riesgo): ✅ Completada (26/09/2026) — se agregó un helper genérico `confirmarBorrado()` en `js/utils.js` (reutiliza el modal `#modal-confirm` de Lugares, sin tocar la lógica de `askDelete()`) y se aplicó a los 3 casos: `deleteLocation` (js/cities.js), `_deleteTypoPreset` y `_removeTypoFont` (js/typography.js). `askDelete()` ahora repone el título del modal por las dudas, ya que otras pestañas también lo usan. Verificado con `node --check` en los 6 archivos tocados (sin errores de sintaxis); falta que Cris confirme en el navegador: click en 🗑 en los 3 casos → aparece el modal con el nombre correspondiente → Cancelar no borra nada → Aceptar borra igual que antes → borrar un lugar en Lugares sigue funcionando igual que siempre.
- Etapa 2 — Color/ícono de categorías base: ✅ Completada (26/09/2026) — `saveCategoriesSettings()` y `loadCategoriesSettings()` (js/settings-sync.js) ahora guardan/restauran `color` e `icon` de cada categoría base. Verificado con `node --check`; falta que Cris confirme en el navegador: cambiar color/ícono de una categoría base → Guardar cambios → F5 → tiene que seguir ahí.
- Etapa 3 — Cuentas (guardado plan/funciones premium): ✅ Completada (26/09/2026) — `_saveCuentaPlan()` (js/usuarios-admin.js) cambiado de `.update()` a `.set(..., {merge:true})`. Verificado con `node --check`; falta que Cris confirme en el navegador: marcar plan premium en una cuenta que nunca se tocó desde el panel → guardar sin error.
- Etapa 4 — Persistencia de Temas/Roadmap/Grupos: pendiente
  - 4.1 Temas: pendiente
  - 4.2 Roadmap: pendiente
  - 4.3 Grupos: pendiente
- Etapa 5 — Confirmación de borrado en Temas/Roadmap/Grupos: pendiente
- Etapa 6 — Unificar visualmente confirmaciones existentes: pendiente
- Etapa 7 — Confirmación en casos de bajo riesgo: pendiente
