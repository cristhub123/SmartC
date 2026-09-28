/*
AI PROJECT NOTE — LECTURA OBLIGATORIA PARA CUALQUIER IA:
Antes de modificar este archivo, toda IA (Claude, ChatGPT u otra) DEBE
leer primero /AI_RULES.md completo. Sin excepcion, sin importar cuan
chico o simple parezca el cambio, y sin esperar a que el usuario lo
pida o lo recuerde — esta nota es la instruccion, no un recordatorio
opcional. Si /AI_RULES.md ya se leyo en esta misma sesion, alcanza con
revisar /AI_SESSION.md en su lugar.

Despues de modificar este archivo, actualizar /AI_SESSION.md con el
cambio hecho y la verificacion realizada.
*/

/**
 * [NUEVO 2026-09-26] Motor de traducción de la INTERFAZ PÚBLICA fija
 * (botones, placeholders, encabezados de secciones, textos de los
 * modales de cuenta/eventos, filtro "Todo"/"Eventos", etc.) — todo lo
 * que ve un visitante o un dueño de negocio logueado, NUNCA el panel
 * Admin (ese es herramienta de Cris, siempre en español, fuera de
 * alcance a propósito).
 *
 * Esto es DISTINTO del contenido por-POI (nombre/descripción/campos
 * de un lugar, ver AppState.getContent) — acá van los textos que son
 * siempre los mismos para cualquier lugar/evento, no datos cargados
 * por el admin.
 *
 * DOS FORMAS DE USARLO:
 * 1) HTML ESTÁTICO que ningún JS vuelve a pisar después: marcar el
 *    elemento con `data-i18n="clave"` (textContent),
 *    `data-i18n-placeholder="clave"`, `data-i18n-title="clave"` o
 *    `data-i18n-aria="clave"` — este motor los resuelve solo, en la
 *    carga y cada vez que cambia el idioma.
 * 2) HTML que un JS arma dinámicamente (listas, toasts, template
 *    literals con datos del usuario mezclados) — ahí NO alcanza con
 *    el data-attr (el próximo render lo pisa), hay que llamar
 *    `I18N.t('clave')` directo adentro de esa función, y esa función
 *    tiene que volver a llamarse cuando cambia el idioma (suscribirse
 *    a AppState.EVENTS.LANGUAGE_CHANGED, mismo patrón que ya usa
 *    poi-panel.js).
 *
 * No confundir con js/lang-switcher.js (ese solo maneja los 3
 * botones ES/EN/PT del header y guarda la elección en localStorage) —
 * este archivo solo APLICA la traducción una vez que el idioma ya
 * cambió.
 */
window.I18N = (function () {
  const DICT = {
    es: {
      search_placeholder: 'Buscar lugares, eventos...',
      lang_switcher_title: 'Idioma de la página',
      btn_account_title_out: 'Ingresar / Registrarme',
      btn_account_title_in: 'Mi cuenta',
      btn_admin_title: 'Administrador',
      btn_account_tap_hint: '(tocar para ver tu panel)',

      zonas_dropdown_header: 'Navegá por zona',
      zona_info_btn_title: 'Ver info',
      zona_go_to: '📍 Ir a',
      zona_no_coords: 'Sin coordenadas — buscá una dirección o hacé clic en el mapa',

      filter_all: 'Todo',
      filter_events: 'Eventos',
      eventos_fecha_aria: 'Elegir fecha para ver eventos de ese día',
      eventos_fecha_clear_title: 'Quitar filtro de fecha',

      pp_eye_title: 'Cambiar modo visual',
      pp_close_title: 'Cerrar',
      pp_sec_eventos: 'Eventos',
      pp_sec_historia: 'Historia & Trivia',
      pp_sec_redes: 'Redes & Contacto',
      pp_editar_btn: 'Editar',
      pp_datos_label: 'Datos',
      pp_eye_other_image_title: 'Ver otra imagen de este lugar',
      poi_tab_info: 'Info',
      pp_guardando: 'Guardando...',

      cerrar: 'Cerrar',
      cancelar: 'Cancelar',
      confirmar: 'Confirmar',
      guardar_cambios: 'Guardar cambios',
      buscar: 'Buscar',
      volver: '← Volver',

      ua_tab_login: 'Ingresar',
      ua_tab_register: 'Crear cuenta',
      ua_email_ph: 'Correo electrónico',
      ua_pass_ph: 'Contraseña',
      ua_login_btn: 'Ingresar',
      ua_divider_o: 'o',
      ua_google_btn: 'Continuar con Google',
      ua_nombre_ph: 'Tu nombre',
      ua_pass_register_ph: 'Contraseña (mín. 6 caracteres)',
      ua_rol_usuario: 'Usuario',
      ua_rol_usuario_desc: 'Explorar lugares y eventos',
      ua_rol_dueno: 'Dueño de negocio',
      ua_rol_dueno_desc: 'Administrar mi pin/negocio',
      ua_register_btn: 'Crear cuenta',
      ua_google_role_intro_pre: '¡Hola,',
      ua_google_role_intro_post: '! Elegí con qué tipo de cuenta querés seguir:',

      up_tab_info: 'Info',
      up_tab_pines: '📍 Pines',
      up_tab_eventos: '🎉 Eventos',
      up_logout_btn: 'Cerrar sesión',
      up_pines_disabled: 'Esta sección es para cuentas de dueño de negocio — administrá acá los pines que te asignaron.',
      op_empty: 'Todavía no tenés ningún lugar asignado. Pasale tu UID (Firebase Console → Authentication → Users, o pedíselo a quien administra la app) para que te lo asignen.',
      op_desc_label: 'Descripción corta',
      op_hist_label: 'Historia / Trivia',
      op_phone_label: 'Teléfono',
      op_hours_label: 'Horario',
      op_hours_ph: 'Ej: Lun–Vie 9–18hs, Sáb 10–14hs',
      op_tags_label: 'Tags / Subcategorías (separados por coma)',
      op_tags_ph: 'Ej: Comida árabe, Sin TACC, Delivery',
      op_fields_label: 'Campos de información (título + texto)',
      op_add_field_btn: '+ Agregar campo',

      emp_divider: 'EMPLEADOS CON ACCESO A TUS PINES',
      emp_empty: 'Todavía no diste de alta ningún empleado.',
      emp_add_btn: '+ Dar de alta un empleado',
      emp_nombre_label: 'Nombre',
      emp_email_label: 'Mail',
      emp_pass_label: 'Contraseña (mínimo 6 caracteres)',
      emp_no_invite_note: 'Se la pasás vos directamente — no se manda ningún mail de invitación.',
      emp_create_btn: 'Crear cuenta de empleado',

      up_evt_empty: 'Todavía no tenés ningún evento.',
      up_evt_add_btn: '➕ Agregar evento',
      up_evt_disabled_msg: 'La creación de eventos está deshabilitada por el momento — probá más adelante.',
      up_evt_form_title_new: 'Nuevo evento',
      up_evt_nombre_label: 'Nombre del evento *',
      up_evt_nombre_ph: 'Ej: Feria de anime de septiembre',
      up_evt_desc_label: 'Descripción',
      up_evt_foto_label: 'Foto del evento (opcional)',
      up_evt_foto_btn: '📷 Elegir foto',
      up_evt_foto_hint: 'JPG o WebP · horizontal, mín. 1024 px de ancho · se recorta a 16:9 · máx. 10 MB',
      up_evt_desc_ph: '¿De qué se trata el evento?',
      up_evt_categoria_label: 'Categoría del evento (tags) *',
      up_evt_fecha_inicio_label: 'Fecha de inicio *',
      up_evt_fecha_fin_label: 'Fecha de fin *',
      up_evt_horario_label: 'Horario *',
      up_evt_horario_ph: 'Ej: "Viernes a domingo, 16 a 22hs" o "Sábado 3 y domingo 4, de 10 a 18hs"',
      up_evt_gratis_label: 'Entrada gratuita',
      up_evt_valor_label: 'Valor de la entrada',
      up_evt_valor_ph: 'Ej: $5000, o $3000 anticipada / $4000 en puerta',
      up_evt_direccion_label: 'Dirección exacta del evento *',
      up_evt_direccion_ph: 'Ej: Av. Colón 1234, Córdoba',
      up_evt_contacto_divider: 'CONTACTO DEL EVENTO (al menos 1) *',
      up_evt_mail_label: 'Mail',
      up_evt_social_label: 'Red social',
      up_evt_telefono_label: 'Teléfono',
      up_evt_web_label: 'Página web',
      up_evt_lugar_divider: 'LUGAR DEL EVENTO',
      up_evt_camino_a_btn: 'Ya existe el pin',
      up_evt_camino_b_btn: 'Todavía no existe',
      up_evt_buscar_pin_label: 'Buscar pin existente',
      up_evt_buscar_pin_ph: 'Escribí el nombre del lugar...',
      up_evt_pin_elegido_label: 'Pin elegido',
      up_evt_pin_nombre_label: 'Nombre del lugar (nuevo pin) *',
      up_evt_pin_nombre_ph: 'Ej: Patio del Colegio San Martín',
      up_evt_buscar_dir_label: '🔍 Buscar dirección o lugar',
      up_evt_pick_map_btn: '📍 O hacer clic en el mapa',
      up_evt_crear_btn: '✓ Crear evento',
      quitar: 'Quitar',
      up_evt_form_title_edit_prefix: 'Editando:',
      up_evt_guardar_cambios_btn: '💾 Guardar cambios',
      toast_evt_creation_disabled: '⚠️ La creación de eventos está deshabilitada por ahora',
      toast_evt_nombre_required: '⚠️ Ingresá el nombre del evento',
      up_evt_cambios_restantes: (n) => `Este guardado va a consumir 1 de tus ${n} cambio${n === 1 ? '' : 's'} disponible${n === 1 ? '' : 's'}.`,
      evt_no_results: 'Sin resultados',
      evt_no_results_hint: 'Probá con otro nombre',
      evt_card_centrar: 'Centrar en el mapa',
      op_loading: 'Cargando tus lugares...',
      op_load_error: '⚠️ No se pudieron cargar tus lugares. Probá de nuevo.',
      op_field_title_ph: 'Título (ej: Dato curioso)',
      op_field_text_ph: 'Texto',
      op_fields_empty: 'Todavía no tenés ningún campo cargado.',
      op_field_remove_title: 'Quitar este campo',
      toast_cambios_guardados: '✅ Cambios guardados',
      op_save_error: '⚠️ No se pudo guardar. Probá de nuevo.',
      ua_err_campos_ambos: '⚠️ Completá los dos campos',
      ua_ingresando: 'Ingresando...',
      ua_err_credenciales: '⚠️ Correo o contraseña incorrectos',
      ua_err_too_many: '⚠️ Demasiados intentos. Probá de nuevo en unos minutos.',
      ua_err_login_generic: '⚠️ No se pudo iniciar sesión. Revisá tu conexión.',
      ua_err_campos_todos: '⚠️ Completá todos los campos',
      ua_err_pass_corta: '⚠️ La contraseña necesita al menos 6 caracteres',
      ua_err_elegir_rol: '⚠️ Elegí un tipo de cuenta',
      ua_creando_cuenta: 'Creando cuenta...',
      toast_cuenta_creada: (n) => `✅ Cuenta creada — ¡bienvenido/a, ${n}!`,
      ua_err_email_en_uso: '⚠️ Ese correo ya tiene una cuenta',
      ua_err_email_invalido: '⚠️ Correo inválido',
      ua_err_pass_debil: '⚠️ Contraseña muy débil (mínimo 6 caracteres)',
      ua_err_register_generic: '⚠️ No se pudo crear la cuenta. Revisá tu conexión.',
      ua_err_google: '⚠️ No se pudo continuar con Google',
      toast_cuenta_lista: '✅ ¡Cuenta lista!',
      cargando: 'Cargando...',
      emp_list_error: '⚠️ No se pudo cargar la lista.',
      emp_creando: 'Creando...',
      emp_sin_nombre: '(sin nombre)',
      emp_estado_activo: 'activo',
      emp_estado_desactivado: 'desactivado',
      emp_reactivar: 'Reactivar',
      emp_desactivar: 'Desactivar',
      toast_empleado_creado: (n) => `✅ Cuenta de empleado creada para ${n}`,
      evt_entrada_paga: 'Entrada paga',
      evt_entrada_gratuita: 'Entrada gratuita',
      evt_sin_nombre: '(sin nombre)',
    },
    en: {
      search_placeholder: 'Search places, events...',
      lang_switcher_title: 'Page language',
      btn_account_title_out: 'Log in / Sign up',
      btn_account_title_in: 'My account',
      btn_admin_title: 'Admin',
      btn_account_tap_hint: '(tap to see your panel)',

      zonas_dropdown_header: 'Browse by zone',
      zona_info_btn_title: 'View info',
      zona_go_to: '📍 Go to',
      zona_no_coords: 'No coordinates yet — search an address or tap the map',

      filter_all: 'All',
      filter_events: 'Events',
      eventos_fecha_aria: 'Pick a date to see events for that day',
      eventos_fecha_clear_title: 'Clear date filter',

      pp_eye_title: 'Change visual mode',
      pp_close_title: 'Close',
      pp_sec_eventos: 'Events',
      pp_sec_historia: 'History & Trivia',
      pp_sec_redes: 'Social & Contact',
      pp_editar_btn: 'Edit',
      pp_datos_label: 'Details',
      pp_eye_other_image_title: 'See another photo of this place',
      poi_tab_info: 'Info',
      pp_guardando: 'Saving...',

      cerrar: 'Close',
      cancelar: 'Cancel',
      confirmar: 'Confirm',
      guardar_cambios: 'Save changes',
      buscar: 'Search',
      volver: '← Back',

      ua_tab_login: 'Log in',
      ua_tab_register: 'Sign up',
      ua_email_ph: 'Email',
      ua_pass_ph: 'Password',
      ua_login_btn: 'Log in',
      ua_divider_o: 'or',
      ua_google_btn: 'Continue with Google',
      ua_nombre_ph: 'Your name',
      ua_pass_register_ph: 'Password (min. 6 characters)',
      ua_rol_usuario: 'User',
      ua_rol_usuario_desc: 'Explore places and events',
      ua_rol_dueno: 'Business owner',
      ua_rol_dueno_desc: 'Manage my pin/business',
      ua_register_btn: 'Sign up',
      ua_google_role_intro_pre: 'Hi,',
      ua_google_role_intro_post: '! Choose which type of account to continue with:',

      up_tab_info: 'Info',
      up_tab_pines: '📍 Places',
      up_tab_eventos: '🎉 Events',
      up_logout_btn: 'Log out',
      up_pines_disabled: 'This section is for business-owner accounts — manage the pins assigned to you here.',
      op_empty: "You don't have any place assigned yet. Share your UID (Firebase Console → Authentication → Users, or ask the app admin) so they can assign one to you.",
      op_desc_label: 'Short description',
      op_hist_label: 'History / Trivia',
      op_phone_label: 'Phone',
      op_hours_label: 'Hours',
      op_hours_ph: 'E.g.: Mon–Fri 9am–6pm, Sat 10am–2pm',
      op_tags_label: 'Tags / Subcategories (comma-separated)',
      op_tags_ph: 'E.g.: Arabic food, Gluten-free, Delivery',
      op_fields_label: 'Info fields (title + text)',
      op_add_field_btn: '+ Add field',

      emp_divider: 'STAFF WITH ACCESS TO YOUR PINS',
      emp_empty: "You haven't added any staff account yet.",
      emp_add_btn: '+ Add a staff account',
      emp_nombre_label: 'Name',
      emp_email_label: 'Email',
      emp_pass_label: 'Password (min. 6 characters)',
      emp_no_invite_note: "You hand it to them directly — no invitation email is sent.",
      emp_create_btn: 'Create staff account',

      up_evt_empty: "You don't have any event yet.",
      up_evt_add_btn: '➕ Add event',
      up_evt_disabled_msg: 'Creating events is disabled for now — check back later.',
      up_evt_form_title_new: 'New event',
      up_evt_nombre_label: 'Event name *',
      up_evt_nombre_ph: 'E.g.: September anime fair',
      up_evt_desc_label: 'Description',
      up_evt_foto_label: 'Event photo (optional)',
      up_evt_foto_btn: '📷 Choose photo',
      up_evt_foto_hint: 'JPG or WebP · landscape, min. 1024 px wide · cropped to 16:9 · max 10 MB',
      up_evt_desc_ph: 'What is the event about?',
      up_evt_categoria_label: 'Event category (tags) *',
      up_evt_fecha_inicio_label: 'Start date *',
      up_evt_fecha_fin_label: 'End date *',
      up_evt_horario_label: 'Schedule *',
      up_evt_horario_ph: 'E.g.: "Friday to Sunday, 4 to 10pm" or "Saturday 3rd and Sunday 4th, 10am to 6pm"',
      up_evt_gratis_label: 'Free entry',
      up_evt_valor_label: 'Ticket price',
      up_evt_valor_ph: 'E.g.: $5000, or $3000 in advance / $4000 at the door',
      up_evt_direccion_label: 'Exact event address *',
      up_evt_direccion_ph: 'E.g.: Av. Colón 1234, Córdoba',
      up_evt_contacto_divider: 'EVENT CONTACT (at least 1) *',
      up_evt_mail_label: 'Email',
      up_evt_social_label: 'Social media',
      up_evt_telefono_label: 'Phone',
      up_evt_web_label: 'Website',
      up_evt_lugar_divider: 'EVENT LOCATION',
      up_evt_camino_a_btn: 'The pin already exists',
      up_evt_camino_b_btn: "It doesn't exist yet",
      up_evt_buscar_pin_label: 'Search an existing pin',
      up_evt_buscar_pin_ph: 'Type the place name...',
      up_evt_pin_elegido_label: 'Chosen pin',
      up_evt_pin_nombre_label: 'Place name (new pin) *',
      up_evt_pin_nombre_ph: 'E.g.: San Martín School Courtyard',
      up_evt_buscar_dir_label: '🔍 Search an address or place',
      up_evt_pick_map_btn: '📍 Or tap the map',
      up_evt_crear_btn: '✓ Create event',
      quitar: 'Remove',
      evt_no_results: 'No results',
      evt_no_results_hint: 'Try another name',
      evt_card_centrar: 'Center on map',
      op_loading: 'Loading your places...',
      op_load_error: "⚠️ Couldn't load your places. Try again.",
      op_field_title_ph: 'Title (e.g.: Fun fact)',
      op_field_text_ph: 'Text',
      op_fields_empty: "You haven't added any field yet.",
      op_field_remove_title: 'Remove this field',
      toast_cambios_guardados: '✅ Changes saved',
      op_save_error: "⚠️ Couldn't save. Try again.",
      ua_err_campos_ambos: '⚠️ Fill in both fields',
      ua_ingresando: 'Logging in...',
      ua_err_credenciales: '⚠️ Wrong email or password',
      ua_err_too_many: '⚠️ Too many attempts. Try again in a few minutes.',
      ua_err_login_generic: "⚠️ Couldn't log in. Check your connection.",
      ua_err_campos_todos: '⚠️ Fill in all fields',
      ua_err_pass_corta: '⚠️ Password needs at least 6 characters',
      ua_err_elegir_rol: '⚠️ Choose an account type',
      ua_creando_cuenta: 'Creating account...',
      toast_cuenta_creada: (n) => `✅ Account created — welcome, ${n}!`,
      ua_err_email_en_uso: '⚠️ That email already has an account',
      ua_err_email_invalido: '⚠️ Invalid email',
      ua_err_pass_debil: '⚠️ Password too weak (min. 6 characters)',
      ua_err_register_generic: "⚠️ Couldn't create the account. Check your connection.",
      ua_err_google: "⚠️ Couldn't continue with Google",
      toast_cuenta_lista: '✅ Account ready!',
      cargando: 'Loading...',
      emp_list_error: "⚠️ Couldn't load the list.",
      emp_creando: 'Creating...',
      emp_sin_nombre: '(no name)',
      emp_estado_activo: 'active',
      emp_estado_desactivado: 'disabled',
      emp_reactivar: 'Re-enable',
      emp_desactivar: 'Disable',
      toast_empleado_creado: (n) => `✅ Staff account created for ${n}`,
      evt_entrada_paga: 'Paid entry',
      evt_entrada_gratuita: 'Free entry',
      evt_sin_nombre: '(no name)',
    },
    pt: {
      search_placeholder: 'Buscar locais, eventos...',
      lang_switcher_title: 'Idioma da página',
      btn_account_title_out: 'Entrar / Cadastrar-se',
      btn_account_title_in: 'Minha conta',
      btn_admin_title: 'Administrador',
      btn_account_tap_hint: '(toque para ver seu painel)',

      zonas_dropdown_header: 'Navegue por zona',
      zona_info_btn_title: 'Ver informações',
      zona_go_to: '📍 Ir para',
      zona_no_coords: 'Sem coordenadas — busque um endereço ou toque no mapa',

      filter_all: 'Tudo',
      filter_events: 'Eventos',
      eventos_fecha_aria: 'Escolher uma data para ver os eventos daquele dia',
      eventos_fecha_clear_title: 'Remover filtro de data',

      pp_eye_title: 'Mudar modo visual',
      pp_close_title: 'Fechar',
      pp_sec_eventos: 'Eventos',
      pp_sec_historia: 'História & Curiosidades',
      pp_sec_redes: 'Redes & Contato',
      pp_editar_btn: 'Editar',
      pp_datos_label: 'Dados',
      pp_eye_other_image_title: 'Ver outra imagem deste local',
      poi_tab_info: 'Info',
      pp_guardando: 'Salvando...',

      cerrar: 'Fechar',
      cancelar: 'Cancelar',
      confirmar: 'Confirmar',
      guardar_cambios: 'Salvar alterações',
      buscar: 'Buscar',
      volver: '← Voltar',

      ua_tab_login: 'Entrar',
      ua_tab_register: 'Criar conta',
      ua_email_ph: 'E-mail',
      ua_pass_ph: 'Senha',
      ua_login_btn: 'Entrar',
      ua_divider_o: 'ou',
      ua_google_btn: 'Continuar com o Google',
      ua_nombre_ph: 'Seu nome',
      ua_pass_register_ph: 'Senha (mín. 6 caracteres)',
      ua_rol_usuario: 'Usuário',
      ua_rol_usuario_desc: 'Explorar locais e eventos',
      ua_rol_dueno: 'Dono de negócio',
      ua_rol_dueno_desc: 'Administrar meu pin/negócio',
      ua_register_btn: 'Criar conta',
      ua_google_role_intro_pre: 'Olá,',
      ua_google_role_intro_post: '! Escolha com qual tipo de conta você quer continuar:',

      up_tab_info: 'Info',
      up_tab_pines: '📍 Pinos',
      up_tab_eventos: '🎉 Eventos',
      up_logout_btn: 'Sair',
      up_pines_disabled: 'Esta seção é para contas de dono de negócio — administre aqui os pinos que te atribuíram.',
      op_empty: 'Você ainda não tem nenhum local atribuído. Envie seu UID (Firebase Console → Authentication → Users, ou peça a quem administra o app) para que te atribuam um.',
      op_desc_label: 'Descrição curta',
      op_hist_label: 'História / Curiosidades',
      op_phone_label: 'Telefone',
      op_hours_label: 'Horário',
      op_hours_ph: 'Ex: Seg–Sex 9h–18h, Sáb 10h–14h',
      op_tags_label: 'Tags / Subcategorias (separadas por vírgula)',
      op_tags_ph: 'Ex: Comida árabe, Sem glúten, Delivery',
      op_fields_label: 'Campos de informação (título + texto)',
      op_add_field_btn: '+ Adicionar campo',

      emp_divider: 'FUNCIONÁRIOS COM ACESSO AOS SEUS PINOS',
      emp_empty: 'Você ainda não cadastrou nenhum funcionário.',
      emp_add_btn: '+ Cadastrar um funcionário',
      emp_nombre_label: 'Nome',
      emp_email_label: 'E-mail',
      emp_pass_label: 'Senha (mínimo 6 caracteres)',
      emp_no_invite_note: 'Você entrega diretamente — nenhum e-mail de convite é enviado.',
      emp_create_btn: 'Criar conta de funcionário',

      up_evt_empty: 'Você ainda não tem nenhum evento.',
      up_evt_add_btn: '➕ Adicionar evento',
      up_evt_disabled_msg: 'A criação de eventos está desabilitada no momento — tente novamente mais tarde.',
      up_evt_form_title_new: 'Novo evento',
      up_evt_nombre_label: 'Nome do evento *',
      up_evt_nombre_ph: 'Ex: Feira de anime de setembro',
      up_evt_desc_label: 'Descrição',
      up_evt_foto_label: 'Foto do evento (opcional)',
      up_evt_foto_btn: '📷 Escolher foto',
      up_evt_foto_hint: 'JPG ou WebP · horizontal, mín. 1024 px de largura · cortada em 16:9 · máx. 10 MB',
      up_evt_desc_ph: 'Do que se trata o evento?',
      up_evt_categoria_label: 'Categoria do evento (tags) *',
      up_evt_fecha_inicio_label: 'Data de início *',
      up_evt_fecha_fin_label: 'Data de término *',
      up_evt_horario_label: 'Horário *',
      up_evt_horario_ph: 'Ex: "Sexta a domingo, 16h às 22h" ou "Sábado 3 e domingo 4, das 10h às 18h"',
      up_evt_gratis_label: 'Entrada gratuita',
      up_evt_valor_label: 'Valor da entrada',
      up_evt_valor_ph: 'Ex: R$5000, ou R$3000 antecipado / R$4000 na hora',
      up_evt_direccion_label: 'Endereço exato do evento *',
      up_evt_direccion_ph: 'Ex: Av. Colón 1234, Córdoba',
      up_evt_contacto_divider: 'CONTATO DO EVENTO (pelo menos 1) *',
      up_evt_mail_label: 'E-mail',
      up_evt_social_label: 'Rede social',
      up_evt_telefono_label: 'Telefone',
      up_evt_web_label: 'Site',
      up_evt_lugar_divider: 'LOCAL DO EVENTO',
      up_evt_camino_a_btn: 'O pino já existe',
      up_evt_camino_b_btn: 'Ainda não existe',
      up_evt_buscar_pin_label: 'Buscar pino existente',
      up_evt_buscar_pin_ph: 'Digite o nome do local...',
      up_evt_pin_elegido_label: 'Pino escolhido',
      up_evt_pin_nombre_label: 'Nome do local (novo pino) *',
      up_evt_pin_nombre_ph: 'Ex: Pátio do Colégio San Martín',
      up_evt_buscar_dir_label: '🔍 Buscar endereço ou local',
      up_evt_pick_map_btn: '📍 Ou toque no mapa',
      up_evt_crear_btn: '✓ Criar evento',
      quitar: 'Remover',
      evt_no_results: 'Nenhum resultado',
      evt_no_results_hint: 'Tente outro nome',
      evt_card_centrar: 'Centralizar no mapa',
      op_loading: 'Carregando seus locais...',
      op_load_error: '⚠️ Não foi possível carregar seus locais. Tente novamente.',
      op_field_title_ph: 'Título (ex: Curiosidade)',
      op_field_text_ph: 'Texto',
      op_fields_empty: 'Você ainda não adicionou nenhum campo.',
      op_field_remove_title: 'Remover este campo',
      toast_cambios_guardados: '✅ Alterações salvas',
      op_save_error: '⚠️ Não foi possível salvar. Tente novamente.',
      ua_err_campos_ambos: '⚠️ Preencha os dois campos',
      ua_ingresando: 'Entrando...',
      ua_err_credenciales: '⚠️ E-mail ou senha incorretos',
      ua_err_too_many: '⚠️ Muitas tentativas. Tente novamente em alguns minutos.',
      ua_err_login_generic: '⚠️ Não foi possível entrar. Verifique sua conexão.',
      ua_err_campos_todos: '⚠️ Preencha todos os campos',
      ua_err_pass_corta: '⚠️ A senha precisa ter pelo menos 6 caracteres',
      ua_err_elegir_rol: '⚠️ Escolha um tipo de conta',
      ua_creando_cuenta: 'Criando conta...',
      toast_cuenta_creada: (n) => `✅ Conta criada — bem-vindo(a), ${n}!`,
      ua_err_email_en_uso: '⚠️ Esse e-mail já tem uma conta',
      ua_err_email_invalido: '⚠️ E-mail inválido',
      ua_err_pass_debil: '⚠️ Senha muito fraca (mín. 6 caracteres)',
      ua_err_register_generic: '⚠️ Não foi possível criar a conta. Verifique sua conexão.',
      ua_err_google: '⚠️ Não foi possível continuar com o Google',
      toast_cuenta_lista: '✅ Conta pronta!',
      cargando: 'Carregando...',
      emp_list_error: '⚠️ Não foi possível carregar a lista.',
      emp_creando: 'Criando...',
      emp_sin_nombre: '(sem nome)',
      emp_estado_activo: 'ativo',
      emp_estado_desactivado: 'desativado',
      emp_reactivar: 'Reativar',
      emp_desactivar: 'Desativar',
      toast_empleado_creado: (n) => `✅ Conta de funcionário criada para ${n}`,
      evt_entrada_paga: 'Entrada paga',
      evt_entrada_gratuita: 'Entrada gratuita',
      evt_sin_nombre: '(sem nome)',
    },
  };

  /** Idioma actual — mismo criterio de fallback que getCatLabel/AppState.getContent. */
  function _lang() {
    return (typeof AppState !== 'undefined' && AppState.getLanguage()) || 'es';
  }

  /** @param {string} key @returns {string} */
  function t(key) {
    const lang = _lang();
    const v = (DICT[lang] && DICT[lang][key]) || DICT.es[key] || key;
    return typeof v === 'function' ? key : v;
  }

  /** Para claves cuyo valor es una función (mensajes con datos
   *  variables, ej. "Este guardado va a consumir N cambios...") —
   *  `t()` sirve para texto fijo, `tf()` para estos. */
  function tf(key, ...args) {
    const lang = _lang();
    const v = (DICT[lang] && DICT[lang][key]) || DICT.es[key];
    return typeof v === 'function' ? v(...args) : (v || key);
  }

  /** Recorre `root` (documento completo o un contenedor puntual recién
   *  creado) y resuelve los 4 tipos de data-attr soportados. Se puede
   *  llamar tantas veces como haga falta — es barato e idempotente. */
  function applyI18n(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.setAttribute('title', t(el.dataset.i18nTitle));
    });
    scope.querySelectorAll('[data-i18n-aria]').forEach(el => {
      el.setAttribute('aria-label', t(el.dataset.i18nAria));
    });
  }

  function _init() {
    applyI18n(document);
    if (typeof AppState !== 'undefined') {
      AppState.on(AppState.EVENTS.LANGUAGE_CHANGED, () => applyI18n(document));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

  return { t, apply: applyI18n };
})();
