# FIRESTORE_RULES_NOTES.md — reglas de seguridad sugeridas

> Este proyecto no tiene un archivo `firestore.rules` versionado: las
> reglas se gestionan a mano en la consola de Firebase (Firestore
> Database → Rules). Ninguna IA que trabaje en este repo puede
> aplicarlas por vos — este archivo es solo el texto sugerido para
> que lo pegues ahí cuando quieras activarlo.

## Colección `usuarios` (Etapa 1, PLAN_USUARIOS_EVENTOS.md)

Regla mínima para que, cuando actives reglas de seguridad reales:
- cualquiera pueda **leer** su propio documento de usuario (para que
  `user-auth.js` pueda cargar el perfil al loguearse),
- solo el dueño del documento pueda **crear** su perfil (una vez, al
  registrarse),
- **nadie pueda cambiar su propio `rol`** después de creado (evita
  que un `usuario_comun` se autopromueva a `dueno_negocio` editando
  Firestore directamente desde el navegador).

```
match /usuarios/{uid} {
  allow read: if request.auth != null && request.auth.uid == uid;
  allow create: if request.auth != null && request.auth.uid == uid
                && request.resource.data.uid == uid;
  allow update: if request.auth != null && request.auth.uid == uid
                && request.resource.data.rol == resource.data.rol;
  allow delete: if false;
}
```

Si en algún momento se necesita que el rol se pueda cambiar (por
ejemplo, un usuario común que pasa a ser dueño de negocio), esa
edición del `rol` debería hacerse desde una función de administrador
(o desde el panel admin ya logueado), no habilitando el update libre
del campo desde el cliente público.

## Pendiente de revisar en algún momento (no es parte de Etapa 1)

El resto de las colecciones (`pois`, `zonas`, config global, etc.)
hoy en día no tienen reglas de seguridad estrictas documentadas acá
— quedó anotado como parte de la "auditoría de seguridad completa"
pendiente en el roadmap general del proyecto.
