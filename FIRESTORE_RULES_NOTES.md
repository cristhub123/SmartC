# FIRESTORE_RULES_NOTES.md — reglas de seguridad sugeridas

> Este proyecto no tiene un archivo `firestore.rules` versionado: las
> reglas se gestionan a mano en la consola de Firebase (Firestore
> Database → Rules). Este archivo es solo el texto sugerido para
> pegar ahí — ninguna IA que trabaje en este repo puede aplicarlas
> por vos.

## ⚠️ Cambio importante en la Etapa 2 — leé esto antes de publicar

Hasta la Etapa 1, la única persona que se logueaba con Firebase Auth
eras vos (admin), así que una regla como
`allow write: if request.auth != null` (cualquier logueado puede
escribir) funcionaba bien: "logueado" y "admin" eran lo mismo.

Desde la Etapa 2, cualquier visitante puede registrarse como
`usuario_comun` o `dueno_negocio` — así que "logueado" ya **no**
significa "admin". Si se dejara esa regla vieja tal cual, cualquier
dueño de negocio (o cualquier usuario común registrado) podría editar
—desde la consola del navegador— **cualquier pin de cualquier otro
negocio**, no solo el suyo.

La solución: una colección nueva **`admins`**, donde cada documento
(el ID del documento = tu UID de Firebase Auth) marca esa cuenta como
administradora de verdad. Las reglas de abajo chequean esa colección
para decidir quién tiene acceso total.

### Paso obligatorio ANTES de publicar las reglas de abajo

Si publicás las reglas sin hacer esto primero, **perdés tu propio
acceso de escritura como admin** (pines, zonas, config, todo) hasta
que lo hagas:

1. Andá a Firebase Console → **Authentication → Users**.
2. Buscá tu propia cuenta de admin (la que usás para entrar al panel
   ⚙) y copiá su columna **"User UID"**.
3. Andá a **Firestore Database → Datos** → "Iniciar colección" →
   nombre de la colección: `admins`.
4. ID del documento: pegá ahí el UID que copiaste (NO uses "ID
   automático").
5. Agregale un campo cualquiera, por ejemplo `isAdmin` (booleano) =
   `true` — el contenido no importa, lo único que revisan las reglas
   es que el documento *exista* con ese ID.
6. Guardar.
7. Si tenés más de una cuenta de admin, repetí para cada una (un
   documento por UID).

Recién ahí pegás y publicás las reglas de la sección siguiente.

## Reglas completas (Firestore Database → Rules)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Marca qué UIDs son administradores de verdad — se gestiona a
    // mano desde la consola (paso obligatorio de arriba), nunca
    // desde el cliente/la app.
    match /admins/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false;
    }

    // Colección "usuarios" (Etapa 1): cada quien lee/crea solo su
    // propio perfil, y no puede cambiarse el rol a sí mismo.
    match /usuarios/{uid} {
      // [Actualizado 2026-08-21] Se agrega que un admin también pueda
      // leer cualquier perfil (antes solo el propio dueño de la cuenta
      // podía) — necesario para que el admin pueda asignar el dueño de
      // un pin buscando por MAIL en vez de pedir el UID a mano.
      allow read: if request.auth != null &&
        (request.auth.uid == uid ||
         exists(/databases/$(database)/documents/admins/$(request.auth.uid)));
      allow create: if request.auth != null && request.auth.uid == uid
                    && request.resource.data.uid == uid;
      allow update: if request.auth != null && request.auth.uid == uid
                    && request.resource.data.rol == resource.data.rol;
      allow delete: if false;
    }

    // Pines: lectura pública siempre libre. Escritura total solo
    // para admins de verdad (colección "admins"); el conteo de
    // "clicks" se puede actualizar sin login; y el dueño de negocio
    // (Etapa 2) puede actualizar SOLO su propio pin y SOLO estos
    // campos de contenido — nunca ubicación, categoría, imágenes,
    // ID ni el propio ownerId.
    match /pines/{pinId} {
      allow read: if true;

      allow write: if request.auth != null
                   && exists(/databases/$(database)/documents/admins/$(request.auth.uid));

      allow write: if request.auth == null &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['clicks']);

      allow update: if request.auth != null
                    && resource.data.ownerId == request.auth.uid
                    && request.resource.data.diff(resource.data).affectedKeys()
                         .hasOnly(['desc', 'hist', 'phone', 'hours', 'tags', 'content']);
    }

    // Resto de colecciones del proyecto: lectura pública libre,
    // escritura solo para admins de verdad.
    match /cache/{docId} {
      allow read: if true;
      allow write: if request.auth != null
                   && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }
    match /locations/{docId} {
      allow read: if true;
      allow write: if request.auth != null
                   && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }
    match /settings/{docId} {
      allow read: if true;
      allow write: if request.auth != null
                   && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }
    match /typography-presets/{docId} {
      allow read: if true;
      allow write: if request.auth != null
                   && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }
    match /zona-presets/{docId} {
      allow read: if true;
      allow write: if request.auth != null
                   && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }
    match /zonas/{docId} {
      allow read: if true;
      allow write: if request.auth != null
                   && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }

    // [Etapa 3, PLAN_USUARIOS_EVENTOS.md] Colección "eventos": lectura
    // pública libre (a futuro el mapa la va a usar para el filtro
    // "Eventos y actividades", Etapa 5) — escritura solo para admins
    // de verdad, porque en esta etapa SOLO el admin puede crear/editar
    // eventos. Cuando la Etapa 6 habilite que dueños/usuarios carguen
    // sus propios eventos, este bloque necesita un `allow create`
    // nuevo para `request.auth.uid == request.resource.data.creadorUid`
    // (no tocar esto todavía, es a propósito de esta etapa).
    match /eventos/{eventoId} {
      allow read: if true;
      allow write: if request.auth != null
                   && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }
  }
}
```

## Pendiente a futuro (no es parte de esta etapa)

Si más adelante se agrega otra colección nueva al proyecto, necesita
su propio bloque acá — si no, queda bloqueada por default (Firestore
niega todo lo que ninguna regla contempla explícitamente).
