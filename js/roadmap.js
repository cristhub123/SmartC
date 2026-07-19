/* roadmap.js — roadmap system */
/* ═══════════════════════════════════════════════════════════
   ROADMAP SYSTEM
   Estructura portable — en versiones futuras irá a roadmap.json
   ═══════════════════════════════════════════════════════════ */
const ROADMAP = [
  { id:'r1', status:'idea',     priority:'high', title:'Mapa minimalista (sin POIs OSM)',        desc:'Usar MapTiler con estilo custom que solo muestre calles, manzanas, ríos y puentes. Sin íconos ni labels de negocios.' },
  { id:'r2', status:'idea',     priority:'high', title:'Sistema de login por negocio',            desc:'Cada dueño accede a su propio dashboard para editar la info de su pin. Requiere backend (Bubble o Node.js + DB).' },
  { id:'r3', status:'planned',  priority:'high', title:'Migrar datos a pois.json externo',        desc:'Separar el array POIS del index.html a un archivo JSON independiente. Facilita mantenimiento y actualizaciones.' },
  { id:'r4', status:'planned',  priority:'mid',  title:'Sistema de membresías y pagos',           desc:'Integración con Stripe para que cada negocio pague su membresía mensual. Activa/desactiva pins automáticamente.' },
  { id:'r5', status:'idea',     priority:'mid',  title:'Clustering de pins en zoom out',          desc:'Cuando hay muchos pins juntos, agruparlos en un círculo con número. Se separan al hacer zoom in.' },
  { id:'r6', status:'idea',     priority:'mid',  title:'Eventos con fecha real y calendario',     desc:'Sistema de eventos con fecha/hora real. Los eventos vencidos se archivan automáticamente.' },
  { id:'r7', status:'idea',     priority:'low',  title:'Filtro "abierto ahora"',                  desc:'Cada negocio carga sus horarios. El filtro muestra solo los lugares actualmente abiertos según la hora del celular.' },
  { id:'r8', status:'idea',     priority:'low',  title:'Modo nocturno del mapa',                  desc:'Switch para alternar entre mapa claro y oscuro. Especialmente útil para exploración nocturna.' },
  { id:'r9', status:'building', priority:'high', title:'Export/Import de datos (JSON)',           desc:'✅ Implementado en v4. Permite guardar y cargar todos los pins con imágenes incluidas.' },
  { id:'r10',status:'done',     priority:'high', title:'Imágenes PNG personalizadas por pin',     desc:'✅ Cada pin puede tener su propia imagen isométrica del edificio con transparencia.' },
  { id:'r10b',status:'planned', priority:'low',  title:'Splash screen con visual aleatorio (branding)',
    desc:'Pantalla de bienvenida con miniatura isométrica random al abrir la app (fondo oscuro + logo + fade out al terminar de cargar el mapa). Lista fija de imágenes disponibles (no consulta dinámica a Storage) para simplificar. Fallback a logo estático si falla la carga. Arranca solo con imágenes estáticas, sin video. FASE 1 — MVP, pero AL FINAL: es mejora de impacto visual, no bloquea ninguna función; se corta primero si falta tiempo antes de noviembre. ~3.5-4.5 hs.' },

  /* === FASE 2 — Post-lanzamiento (app ya viva y probada) === */
  { id:'r11', status:'planned', priority:'high', title:'Backend real (Firestore + Storage)',
    desc:'(Síntesis de la conversación, no cita textual — surgió de varios intercambios sobre qué tecnología usar). Migrar de memoria/JSON manual a Firestore (datos) + Storage (imágenes). Incluye reglas de seguridad por rol. Base de todo lo demás de esta fase.' },
  { id:'r12', status:'planned', priority:'high', title:'Sistema de roles completo (User-2 y User-3)',
    desc:'Cita textual del usuario (ortografía corregida): "Lo importante es que necesito que la app pueda tener sistema de 4 tipos de usuarios. User-1: El admin (yo, superusuario, con acceso a todo y puedo modificar todo). User-2: cada pin tendrá su usuario dueño, el cual podrá editar alguna de la información que tiene cada panel de dicho lugar, ya sea un negocio gastronómico, un museo, lugar de gobierno, etc. User-3: usuario especial al que el admin le otorga permisos para ingresar a determinada sección de la app y poder efectuar cambios en esa sección únicamente. Usuario-4: el usuario cliente, persona común que entra a usar la aplicación, mirar los lugares disponibles, ir a comer, etc."' },
  { id:'r13', status:'planned', priority:'high', title:'Mercado Pago — Checkout Pro',
    desc:'Cita textual del usuario (ortografía corregida): "La app hoy o a un futuro va a tener medios de pago. Yo no quiero tener que lidiar con información de clientes ni nada por el estilo, entonces necesito que sean pagos con una empresa intermediaria estilo Mercado Libre, pero que sea un sistema simple de enchufar a mi página o web app. Factor súper importante: estamos en Argentina y el sistema de pagos debe ser de Argentina, simple, fácil de enchufar. No quiero usar un sistema de pagos que dependa de gastos en dólares ni apps del exterior, tiene que ser sistema local argentino para evitar fricción al usuario y que se sienta más a gusto y con confianza, en pesos."' },
  { id:'r14', status:'idea',    priority:'mid',  title:'Login con Google para el público (User-4)',
    desc:'(Síntesis de la conversación, no cita textual — surgió como recomendación al analizar qué necesitaba login y qué no). Opcional, sin fricción. Habilita favoritos y features que dependan de "quién es" el usuario (match grupal, etc).' },
  { id:'r15', status:'idea',    priority:'mid',  title:'Rutas sugeridas sobre el mapa',
    desc:'Cita textual del usuario (ortografía corregida): "Se van a ir sumando muchas funciones, como un sistema de trazado de rutas sobre el mapa que permita crear rutas tipo sugerencias para los usuarios."' },
  { id:'r16', status:'idea',    priority:'low',  title:'Geolocalización real (confirmar visita)',
    desc:'Cita textual del usuario (ortografía corregida): "Si se pudiera agregar geolocalización del celular del usuario para tener confirmación de que visitó determinada ubicación, sería un golazo para tener datos del uso."' },
  { id:'r17', status:'idea',    priority:'mid',  title:'Multi-idioma ES/EN/PT',
    desc:'Cita textual del usuario (ortografía corregida): "Mi idea era que surgió luego: hacer posible que la app funcionara en 3 idiomas, español, inglés y portugués." Y más adelante: "Ya tengo un sistema pensado para eso, estoy haciendo con IA una investigación por cada lugar, y que la IA me meta toda la información al momento de crearla en los 3 idiomas, para luego solo cargar archivos con todo al mismo tiempo."' },
  { id:'r18', status:'idea',    priority:'low',  title:'Panel de estilos globales (colores/tipografía)',
    desc:'Cita textual del usuario (ortografía corregida): "¿Cómo se va a poder administrar colores de la app, tamaños de tipografía, etc.? ¿No puede haber un panel central para disponer de colores, tamaños, etc.? ¿O cuál sería un procedimiento profesional normal para un caso así?"' },
  { id:'r19', status:'idea',    priority:'mid',  title:'Botón "Comer cerca" en paneles no gastronómicos',
    desc:'Cita textual del usuario (ortografía corregida): "¿Se podría agregar un botón en los paneles de lugares que no tengan el tag de gastronomía —solo todos los que no tengan tag gastronómico— un botón que diga \'comer cerca\', o un iconito de tenedor, y que al tocarlo destaque los lugares de comida cercanos, de alguna manera?"' },

  /* === FASE 3 — Funciones avanzadas (negocio ya validado, con pagos activos) === */
  { id:'r20', status:'idea', priority:'mid', title:'Sistema de ruleta con filtros',
    desc:'Cita textual del usuario (ortografía corregida): "También un sistema tipo ruleta con filtros para el usuario indeciso: si el usuario decide que quiere comer en algún lugar del barrio centro pero no sabe elegir, que la app tenga un sistema tipo ruleta, el usuario selecciona parámetros de filtro y la ruleta hace una selección al azar entre los negocios que están dados de alta pagando su mensualidad a la app, así gozan del beneficio de estar en la ruleta."' },
  { id:'r21', status:'idea', priority:'low', title:'Sistema de "match" grupal',
    desc:'Cita textual del usuario (ortografía corregida): "O bien el sistema tipo match, para cuando varias personas tienen que elegir a dónde comer en grupo, que la app proporcione un sistema de match." Y más adelante, en detalle: "Supongamos que un grupo de 3 amigos quiere salir a comer, no pueden decidir a dónde, entonces uno propone usar nuestra app: la abre y con un link o algo así inicia un sistema nuestro dentro de la app de match, que a todos los que ingresaron al link se les muestran distintos restaurantes tipo match o como votaciones, y ahí cada usuario con su teléfono va eligiendo y descartando hasta que hay un lugar de comida ganador."' },
  { id:'r22', status:'idea', priority:'low', title:'Evento especial 24hs pago (dueño de negocio)',
    desc:'Cita textual del usuario (ortografía corregida): "Además, el dueño de negocio, usuario tipo 2, que pueda acceder a la sección del filtro de locales con un evento especial u oferta destacada, que el filtro gastronómico tenga la parte de evento especial, que el dueño pueda pagar por estar con actividad en esa sección por 24 horas, por ejemplo."' },
  { id:'r23', status:'idea', priority:'low', title:'Bloques de contenido tipo trivia',
    desc:'Cita textual del usuario (ortografía corregida): "En el panel, ¿ya va a poder haber, por ejemplo, un sistema de trivia con opciones si uno quisiera? Los campos pueden ser incluso con algún botón activable que permita activar otras funcionalidades?"' },
  { id:'r24', status:'idea', priority:'low', title:'Campo de links (Instagram, WhatsApp, etc)',
    desc:'Cita textual del usuario (ortografía corregida): "En el campo, conjuntamente con el address, también sería útil que se pudiera poner algún hipervínculo, para Instagram por ejemplo."' },
  { id:'r25', status:'idea', priority:'low', title:'Panel de edición para dueño de lugar (User-2) — bloques dinámicos',
    desc:'Cita textual del usuario (ortografía corregida): "Quiero que cada campo de información en el panel tenga un número y un título... y que no haya realmente un número máximo de campos, y que el usuario dueño de esa ubicación pueda agregar más campos o bloques de texto que se irán agregando hacia abajo... pero que se puedan agregar más campos a medida que, desde el panel del dueño del lugar (que tenga clave de acceso a ese lugar), pueda editar la info inicial y agregar más campos. Tal vez poner un límite, y si quiere más límite debe desbloquear más campos, puede ser con un costo mensual."' },
  { id:'r26', status:'idea', priority:'low', title:'Venta de entradas — modelo afiliado',
    desc:'La app redirige al usuario a plataformas de venta de entradas de terceros (ej. Passline, TuEntrada) y cobra comisión por la derivación. No maneja pagos propios ni factura nada — riesgo legal/impositivo bajo de nuestro lado. Requiere que la plataforma de terceros tenga sistema de links con seguimiento (afiliado). Modelo más simple de los dos, no depende de nada más del roadmap.' },
  { id:'r27', status:'idea', priority:'low', title:'Venta de entradas — venta directa (marketplace propio)',
    desc:'La app cobra la entrada directamente al usuario final. Mercado Pago tiene modo "Marketplace" que divide el pago automáticamente (comisión propia + parte del organizador) en pesos, sin dólares de por medio. Suma complejidad real: gestión de tickets/códigos de acceso, control de cupos, y temas de facturación/situación impositiva que requieren un contador (no resuelto por desarrollo). Depende de tener Mercado Pago ya integrado (r13). Evaluar recién con la app validada y funcionando.' },
  { id:'r28', status:'idea', priority:'low', title:'Temporadas temáticas masivas (reskins de edificios)',
    desc:'Cita textual del usuario (ortografía corregida): "La idea que tengo en mente es lanzar periódicamente temáticas de miniaturas masivas en todos los edificios al mismo tiempo. El pin siempre es el edificio genérico como se ve en la realidad, pero puedo aplicarle modificaciones estéticas para establecer distintas temáticas... voy a necesitar que, por la parte del admin, haya un botón que me permita, de forma automática cuando yo lo active, que se active y se mantenga así por el tiempo que yo decida, una nueva miniatura en todos los edificios que tengan esa temática entre sus miniaturas disponibles."' },
  { id:'r29', status:'idea', priority:'low', title:'Refinamiento del sistema de temas: 3 interruptores + modo día/noche',
    desc:'Cita textual del usuario (corregida en ortografía y puntuación): "Al sistema de temas se me ocurre ponerle 3 interruptores. En el panel admin vivirán todos los temas que se suban, yo podré agregar un nuevo tema de pines con el nombre, y luego de eso, si yo activo el toggle on-off de ese tema, los pines que posean esa alternativa de pin con ese tema — si yo activo alguna de las siguientes 3 posibles opciones de en dónde se deben activar esas imágenes de los pines — así será: 1) Para que esté activado en el panel como una de las imágenes alternativas de un tema X mencionado. 2) Para que la temática seleccionada esté disponible como imagen inicial por defecto al hacer click en el pin. 3) Para que la temática esté como default en el mapa. De esta forma, permitiendo hacer combinaciones de los distintos on-off. Además, quiero que se establezca sí o sí el sistema día-noche: que se actualice pasadas las X horas según yo, como admin, lo establezca en el menú de themes de pins, en una pestaña donde haya un campo de texto en el que pueda establecer con números la hora de Argentina a la cual los pines en el mapa pasarán a su estado de pin theme noche. De esa forma se consigue consistencia en lo que corresponde a la experiencia visual."' },
  { id:'r30', status:'idea', priority:'low', title:'Nomenclatura automática de imágenes al subir (no depender del nombre del archivo local)',
    desc:'Hoy Cloudinary respeta el nombre que ya trae el archivo en la PC del usuario (confirmado que funciona). Pendiente: que el código arme el nombre automáticamente a partir del slug del lugar + ciudad ingresados en el formulario del admin (en vez de depender 100% de que el archivo ya venga bien nombrado desde la compu), como capa extra de seguridad ante error humano. No es indispensable para el funcionamiento — se puede resolver más adelante sin inconvenientes. Estimado: 1-1.5 hs.' },
  { id:'i1', status:'instrucciones', priority:'mid', title:'Imágenes de respaldo por categoría (fallback) — opcional, no bloquea nada',
    desc:'Cada pin busca su imagen en este orden: principal (slug sin sufijo) → variante "_noche" → "-alt1" → "-alt2" → "-alt3" → pin genérico de la categoría → emoji (último recurso, siempre funciona). Para que el escalón "pin genérico de la categoría" se vea, subir a Cloudinary (carpeta ar/cordoba/) una imagen por cada categoría llamada "fallback-{categoria}.png" (ej: fallback-food.png, fallback-culture.png, fallback-music.png, fallback-bar.png, fallback-art.png, fallback-historic.png, fallback-shop.png). NO es obligatorio ni urgente: si no se suben, el sistema simplemente salta directo al emoji, tal como funcionaba la app antes de este cambio — nunca se rompe nada por no tenerlas.' },
  { id:'r31', status:'idea', priority:'low', title:'Soporte de GIF animado como variante de pin (además de PNG)',
    desc:'Cita textual del usuario (corregida en ortografía): "Además de pines con fondo transparente, ¿voy a poder cargar videos? Por ejemplo, si el edificio es de queso y hay ratoncitos comiéndoselo, ¿se puede cargar un video en el mismo lugar donde van a estar las miniaturas/pines PNG, y que el usuario, al apretar el ojito, vea el video del lugar? Video común, o video con fondo transparente. ¿O un GIF animado?" — Análisis: se evaluaron 3 opciones (video común, video WebM con transparencia, GIF). Se prioriza GIF como opción principal para la próxima implementación: se maneja igual que una imagen (mismo tipo de subida/link en Cloudinary, sin lógica de "reproducir" video), soporta transparencia nativa en todos los navegadores/dispositivos (a diferencia del video WebM, que falla en Safari/iPhone), y es más liviano que un video. Contra: límite de 256 colores, puede notarse en degradés suaves. El video queda como alternativa para casos puntuales que lo ameriten (más cinemáticos, con sonido). Encaja como extensión natural del carrusel "ojito" ya existente: si el archivo es GIF, se reproduce animado en el mismo lugar donde hoy se muestra una imagen quieta.' },
];

const RM_STATUS = {
  instrucciones: { label:'📖 Instrucciones de uso', bg:'#ede9fe', color:'#5b21b6' },
  idea:     { label:'💡 Idea',           bg:'#fef3c7', color:'#92400e' },
  planned:  { label:'📋 Planeado',       bg:'#dbeafe', color:'#1e40af' },
  building: { label:'🔨 En desarrollo',  bg:'#dcfce7', color:'#166534' },
  done:     { label:'✅ Hecho',          bg:'#f0fdf4', color:'#15803d' },
};
const RM_PRIORITY = {
  high: '🔴', mid: '🟡', low: '🟢'
};

function renderRoadmap() {
  const c = document.getElementById('roadmap-items');
  if (!c) return;
  const grouped = {};
  ['instrucciones','building','planned','idea','done'].forEach(s => { grouped[s] = ROADMAP.filter(r => r.status === s); });
  let html = '';
  ['instrucciones','building','planned','idea','done'].forEach(s => {
    if (!grouped[s].length) return;
    const st = RM_STATUS[s];
    html += `<div style="font-family:var(--font-m);font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text3);margin:14px 0 7px">${st.label}</div>`;
    grouped[s].forEach(r => {
      html += `<div class="rm-item">
        <button class="rm-delete" onclick="deleteRoadmapItem('${r.id}')">✕</button>
        <div class="rm-item-head">
          <span>${RM_PRIORITY[r.priority]}</span>
          <span class="rm-title">${r.title}</span>
        </div>
        ${r.desc ? `<div class="rm-desc">${r.desc}</div>` : ''}
      </div>`;
    });
  });
  c.innerHTML = html || '<div class="empty-state"><div class="big">🗺</div>Sin items en el roadmap.</div>';
}

window.deleteRoadmapItem = function(id) {
  const idx = ROADMAP.findIndex(r => r.id === id);
  if (idx !== -1) { ROADMAP.splice(idx, 1); renderRoadmap(); }
};

document.getElementById('btn-add-rm').addEventListener('click', () => {
  const title = document.getElementById('rm-title').value.trim();
  if (!title) { toast('⚠️ Ingresá un título'); return; }
  ROADMAP.unshift({
    id:       'r' + Date.now(),
    status:   document.getElementById('rm-status').value,
    priority: document.getElementById('rm-priority').value,
    title,
    desc:     document.getElementById('rm-desc').value.trim(),
  });
  document.getElementById('rm-title').value = '';
  document.getElementById('rm-desc').value  = '';
  renderRoadmap();
  toast('✅ Idea agregada al roadmap');
});

// Render roadmap when tab opens
SC.registerTabPlugin('roadmap', renderRoadmap);



