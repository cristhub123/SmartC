# ACLARACIONES_RELEVANTES.md — Sistema de skins (2026-08-31)

Contexto para quien retome esto en otra sesión: `PLAN_SISTEMA_SKINS.md`
(en la raíz del proyecto) quedó completamente ejecutado en esta
entrega (los 7 pasos). Este archivo es solo para lo que no estaba
100% decidido en el plan original y tuvo que resolverse al programar.

## Decisiones tomadas al ejecutar (no estaban en el plan original)

- **Alcance del blindaje de CSS = acotado**, confirmado con Cris:
  solo cromado estructural, no colores semánticos de estado
  (error/warning/éxito). Si en el futuro se decide tokenizar
  también esos, es trabajo aparte — no bloquea nada de lo ya hecho.
- **`css/poi-panel.css` mantiene su propio identidad de color por
  skin** (no se colapsó a los tokens globales de `base.css`). El
  panel del lugar ya tenía su propia paleta (teal en vez de verde)
  desde antes de este plan — unificarla con `base.css` habría sido
  un cambio visual del skin "default" (contradice "sin cambiar nada
  visualmente todavía" del plan). Cada skin nuevo define sus propios
  valores `--poi-panel-*` en su bloque `[data-skin="..."]`, en
  paralelo a los de `base.css` — dos bloques `[data-skin=...]`, uno
  por archivo, mismo id de skin.
- **`.poi-panel__action-btn` tiene una excepción de CSS puntual**
  para `neobrutal-night` (ver `css/poi-panel.css`, sección SKINS al
  final) porque el token que usa (`--poi-panel-slate-900`) cumple 2
  roles a la vez (texto Y fondo de botón) que necesitan valores
  opuestos bajo un skin oscuro. Si se agrega un tercer skin oscuro
  en el futuro, va a necesitar la misma excepción repetida (o,
  mejor, separar ese token en 2 desde el origen — quedó sin hacer
  por no tocar de más).

## Pendiente real, no bloqueante

- `.btn-export` (`base.css`) pierde su efecto de gradiente "tinta"
  bajo `neobrutal-night` (sigue legible, pero no como se ve en
  default). Ver detalle en `CAMBIOS.txt` de esta entrega.
- Nadie probó todavía en navegador real ni contra Firestore real —
  ver la lista de "Qué probar vos" en `CAMBIOS.txt`.

## Próximo paso sugerido (no arrancado)

Nada del plan original quedó sin hacer. El plan mismo ya dejaba
como explícitamente fuera de esta etapa: selección de skin por
usuario final (UI), y lógica de día/noche automático por horario —
ninguna de las dos se tocó, tal cual estaba decidido.
