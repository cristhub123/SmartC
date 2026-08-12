/* ═══════════════════════════════════════════
   DISTANCIA ENTRE 2 PUNTOS (fórmula de Haversine)
   ---------------------------------------------
   Reutilizable para "Comer cerca" y para cualquier futura función
   de "cerca mío" (geolocalización real, etc). Devuelve metros.
═══════════════════════════════════════════ */
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000; // radio de la Tierra en metros
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* ═══════════════════════════════════════════
   CADENA DE RESPALDO DE IMÁGENES
   ---------------------------------------------
   Si una imagen no existe en Cloudinary, en vez de mostrar un ícono
   de "imagen rota", se prueba la siguiente opción de la lista — así
   nunca se ve como un error, siempre parece que se está mostrando
   una alternativa a propósito. Orden: principal → noche → alt1 →
   alt2 → alt3 → pin genérico de la categoría → emoji (último recurso).
═══════════════════════════════════════════ */
/* === MODO NOCHE AUTOMÁTICO ===
   Si está configurado (panel de Temas → hora + tema de noche),
   se activa solo entre esa hora y las 6am, sin que el admin tenga
   que tocar nada. Se suma a los temas con interruptor manual. */
function isNightModeActive() {
  if (typeof globalSettings === 'undefined') return false;
  if (globalSettings.nightHour === null || globalSettings.nightHour === undefined || !globalSettings.nightTheme) return false;
  const hour = new Date().getHours();
  return hour >= globalSettings.nightHour || hour < 6;
}

/* Temas activos para decidir la imagen PRINCIPAL DEL PIN EN EL MAPA
   — combina los que el admin activó manualmente (mapDefault) + el
   de modo noche automático si corresponde. */
function getActiveMapThemeIds() {
  if (typeof TEMAS === 'undefined') return [];
  const ids = TEMAS.filter(t => t.mapDefault).map(t => t.id);
  if (isNightModeActive() && !ids.includes(globalSettings.nightTheme)) ids.push(globalSettings.nightTheme);
  return ids;
}

/* Mismo concepto, para la imagen por defecto AL ABRIR EL PANEL. */
function getActivePanelThemeIds() {
  if (typeof TEMAS === 'undefined') return [];
  const ids = TEMAS.filter(t => t.panelDefault).map(t => t.id);
  if (isNightModeActive() && !ids.includes(globalSettings.nightTheme)) ids.push(globalSettings.nightTheme);
  return ids;
}

/* === CADENA DE RESPALDO — ahora con temas globales al frente ===
   [LIMPIEZA 2026-08-12] Antes esto ARMABA urls por fórmula
   (`cloudinaryImageUrl`, carpeta vieja `ar/cordoba`, extensión
   `.png` fija, sufijos con guion `-alt1`) — no coincidía con la
   convención definitiva y podía "encontrar" imágenes en el lugar
   equivocado de Cloudinary, o directamente en un lugar donde nunca
   hubo nada. Ahora esta función NO adivina nada: solo devuelve URLs
   que ya están guardadas de verdad en `poi.skins[...].url` (las que
   dejó el propio admin, sea por el uploader de a 1 o por la
   importación masiva). Si un skin no tiene URL guardada, se lo
   saltea — nunca se arma una URL a ciegas. */
function buildImageFallbackChain(poi, { forMap = false, forPanel = false } = {}) {
  const skins = poi.skins || {};
  const chain = [];
  const seen = new Set();

  function pushSkin(id) {
    const skin = skins[id];
    if (skin && skin.url && !seen.has(skin.url)) { chain.push(skin.url); seen.add(skin.url); }
  }

  if (forMap)   getActiveMapThemeIds().forEach(pushSkin);
  if (forPanel) getActivePanelThemeIds().forEach(pushSkin);

  ['main', 'noche', 'alt1', 'alt2', 'alt3'].forEach(pushSkin);

  return chain;
}

/* Engancha un <img> a la cadena de respaldo: si falla, prueba la
   siguiente URL de la lista; si se agotan todas, muestra el emoji. */
function attachImageFallbackChain(imgEl, candidates, emojiEl) {
  let idx = 0;
  imgEl.addEventListener('error', function tryNext() {
    idx++;
    if (idx < candidates.length) {
      imgEl.src = candidates[idx];
    } else {
      imgEl.removeEventListener('error', tryNext);
      imgEl.style.display = 'none';
      if (emojiEl) emojiEl.style.display = '';
    }
  });
}


/* ═══════════════════════════════════════════
   IMAGE UPLOAD LOGIC — CONECTADO A CLOUDINARY
   ---------------------------------------------
   Nota: las variables se siguen llamando "...ImgB64" por
   compatibilidad con el resto del código (pin-adjust.js, admin.js),
   pero desde acá en adelante NO contienen base64 — contienen la
   URL real de Cloudinary. El <img src="..."> funciona igual con
   cualquiera de los dos, por eso no hizo falta tocar nada más.
═══════════════════════════════════════════ */
window._addImgB64  = null;
window._editImgB64 = null;

/* === CREDENCIALES CLOUDINARY (públicas, no sensibles — el preset
   "unsigned" está pensado para usarse así, directo desde el navegador) === */
const CLOUDINARY_CLOUD_NAME    = 's92q7vch';
const CLOUDINARY_UPLOAD_PRESET = 'smartcity_pines_01';

/* [LIMPIEZA 2026-08-12] `DEFAULT_IMG_FOLDER` ('ar/cordoba') y la
   fórmula que la usaba (`cloudinaryImageUrl` en markers.js) quedaron
   eliminadas — ya no existe ningún camino del código que arme una
   URL apuntando a esa carpeta vieja. La carpeta siempre sale de
   `CloudinaryAdmin.buildFolder()` (dinámica, según país/provincia/
   ciudad), con el default de Córdoba con GUION MEDIO (`p-cba/c-cba`)
   ya corregido ahí mismo (ver js/cloudinary-admin.js). */

/* === SUBE UN ARCHIVO A CLOUDINARY Y DEVUELVE SU URL REAL ===
   [LIMPIEZA 2026-08-12] Convención definitiva de nombres: el archivo
   que subís mantiene SU NOMBRE REAL tal cual lo tenías en tu PC/
   celular (sin extensión, como `public_id`) — el sistema YA NO lo
   reconstruye a partir de slug+skin. Esto es a propósito: vos ya le
   das el nombre correcto al archivo ANTES de subirlo (`{slug}_
   {skin}_{NN}.ext`, ver `validateUploadFilename` más abajo, que se
   corre antes de esta función y bloquea la subida si el nombre no
   tiene sentido) — así el nombre en Cloudinary es siempre idéntico
   al que existe en tu PC, cero discrepancia posible.
   La carpeta sigue siendo dinámica vía `CloudinaryAdmin.buildFolder()`
   según país/provincia/ciudad. */
async function uploadToCloudinary(file, opts = {}) {
  const { location, folder: folderOverride, publicId: publicIdOverride } = opts;

  const hasCloudinaryAdmin = typeof CloudinaryAdmin !== 'undefined';
  const folder = folderOverride
    || (hasCloudinaryAdmin ? CloudinaryAdmin.buildFolder(location) : 'smartcity/media/arg/p-cba/c-cba/images');

  // Nombre real preservado: se usa el nombre del archivo (sin
  // extensión) tal cual lo trae `file.name`, salvo que se pase un
  // publicId explícito (lo usa, por ejemplo, el pegado de imagen
  // por Ctrl+V, que no tiene nombre de archivo real).
  const publicId = publicIdOverride || (file.name || '').replace(/\.[^./\\]+$/, '');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', folder);

  if (publicId) {
    formData.append('public_id', publicId);
  } else {
    console.warn('[utils.js] uploadToCloudinary sin nombre de archivo — sube con nombre random.');
  }

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`Cloudinary respondió ${res.status}`);
  const data = await res.json();
  return data.secure_url;
}

/* === VALIDACIÓN DEL NOMBRE DE ARCHIVO ANTES DE SUBIR ===
   Convención definitiva (3 campos separados por "_", el número
   siempre de 2 dígitos al final, extensión libre):
     {id-del-lugar}_{skin}_{NN}.{ext}
   Ejemplos válidos:
     plaza-san-martin_main_01.webp
     plaza-san-martin-ros_t-retro_01.webp
     building_night_01.gif
   El prefijo (todo lo que va antes del primer "_") tiene que ser
   EXACTAMENTE igual al ID del lugar que se está editando/creando —
   así nunca hay discrepancia entre lo que vive en Cloudinary y lo
   que el admin/base de datos espera encontrar. */
function validateUploadFilename(filename, expectedSlug) {
  const base = (filename || '').replace(/\.[^./\\]+$/, '');
  const parts = base.split('_');

  if (parts.length !== 3) {
    return { valid: false, reason: `Debe tener exactamente 3 partes separadas por "_" (ej. ${expectedSlug || 'id-del-lugar'}_main_01) — encontré ${parts.length}.` };
  }
  const [prefix, variant, num] = parts;
  if (!prefix) {
    return { valid: false, reason: 'Falta el prefijo (ID del lugar) antes del primer "_".' };
  }
  if (expectedSlug && prefix !== expectedSlug) {
    return { valid: false, reason: `El prefijo "${prefix}" no coincide con el ID del lugar ("${expectedSlug}").` };
  }
  if (!variant) {
    return { valid: false, reason: 'Falta el nombre de la variante entre los dos "_".' };
  }
  if (!/^\d{2}$/.test(num)) {
    return { valid: false, reason: `Debe terminar en un número de 2 dígitos antes de la extensión (ej. _01) — encontré "${num}".` };
  }
  return { valid: true };
}

/* === CONTEXTO DE SUBIDA (slug + ubicación) SEGÚN EL FORMULARIO ===
   El upload ocurre ANTES de guardar el POI (apenas se elige el
   archivo), así que el slug/ubicación se leen en vivo del formulario
   visible en ese momento — no del documento ya guardado. */
function _slugForUpload(formPrefix) {
  if (formPrefix === 'edit') {
    // Editando un lugar existente: el id YA es el slug unificado.
    if (typeof editingId !== 'undefined' && editingId) return editingId;
  }
  // [LIMPIEZA 2026-08-12] Para "Nuevo" esto usaba solo slugify(nombre),
  // que NO coincide con el ID real que va a quedar guardado si hay
  // sufijo de ciudad o un ID tipeado a mano (ver `_computeAddSlugPreview`
  // en pin-adjust.js, la única fuente de verdad del ID final). Ahora
  // reusa esa misma función para que la validación del nombre de
  // archivo compare contra el ID REAL, no una aproximación.
  if (formPrefix === 'add' && typeof _computeAddSlugPreview === 'function') {
    const preview = _computeAddSlugPreview();
    if (preview) return preview;
  }
  const nameEl = document.getElementById(formPrefix === 'edit' ? 'e-name' : 'a-name');
  const name = nameEl ? nameEl.value.trim() : '';
  if (name && typeof slugify === 'function') return slugify(name);
  // Sin nombre todavía: slug temporal para no romper la subida: se
  // puede corregir a mano en Cloudinary si hiciera falta, pero no
  // bloquea el flujo del admin.
  return `lugar-${Date.now()}`;
}

function _locationForUpload(formPrefix) {
  const p = formPrefix === 'edit' ? 'e' : 'a';
  // Fallback con GUION MEDIO (p-cba/c-cba) — convención definitiva; antes
  // tenía guion bajo, que no coincidía con las carpetas reales ya usadas
  // en Cloudinary. Solo se usa si por algún motivo el dropdown no tiene
  // nada elegido todavía.
  return {
    country: document.getElementById(`${p}-country`)?.value || 'arg',
    state:   document.getElementById(`${p}-state`)?.value   || 'p-cba',
    city:    document.getElementById(`${p}-city`)?.value    || 'c-cba',
  };
}

function _uploadCtx(formPrefix, skin) {
  return () => ({
    slug: _slugForUpload(formPrefix),
    skin,
    location: _locationForUpload(formPrefix),
  });
}

function applyImgB64(url, prevId, lblId, wrapperId, filename, onLoad) {
  const prev    = document.getElementById(prevId);
  const lbl     = document.getElementById(lblId);
  const wrapper = document.getElementById(wrapperId);
  prev.innerHTML = `<img src="${url}" alt="preview">`;
  lbl.textContent = filename || 'Imagen cargada';
  wrapper.classList.add('has-img');
  onLoad(url);
}

function clearImg(inputId, prevId, lblId, wrapperId, defaultLbl, onLoad) {
  document.getElementById(inputId).value = '';
  document.getElementById(prevId).innerHTML = '🏙️';
  document.getElementById(lblId).textContent = defaultLbl;
  document.getElementById(wrapperId).classList.remove('has-img', 'img-uploader--name-ok', 'img-uploader--name-bad');
  onLoad(null);
}

function setupImgUploader(inputId, prevId, lblId, clearId, wrapperId, defaultLbl, onLoad, getUploadCtx) {
  const input   = document.getElementById(inputId);
  const clearBtn= document.getElementById(clearId);
  const wrapper = document.getElementById(wrapperId);
  const lbl     = document.getElementById(lblId);

  async function loadFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('⚠️ Imagen demasiado grande (máx 5 MB)'); return; }

    const ctx = typeof getUploadCtx === 'function' ? getUploadCtx() : {};

    // [NUEVO 2026-08-12] Chequeo del nombre ANTES de subir — evita que
    // se suba con un nombre que no va a coincidir con lo que el
    // sistema espera. Bloquea la subida si el nombre no tiene sentido.
    wrapper.classList.remove('img-uploader--name-ok', 'img-uploader--name-bad');
    const check = validateUploadFilename(file.name, ctx.slug);
    if (!check.valid) {
      wrapper.classList.add('img-uploader--name-bad');
      toast(`⚠️ Nombre de archivo incorrecto: ${check.reason}`);
      return;
    }
    wrapper.classList.add('img-uploader--name-ok');

    const originalLbl = lbl.textContent;
    lbl.textContent = '⏳ Subiendo...';
    try {
      const url = await uploadToCloudinary(file, ctx);
      applyImgB64(url, prevId, lblId, wrapperId, file.name, onLoad);
      toast('✅ Imagen subida');
    } catch (err) {
      lbl.textContent = originalLbl;
      toast('⚠️ Error al subir la imagen. Probá de nuevo.');
      console.error('Cloudinary upload error:', err);
    }
  }

  input.addEventListener('change', e => loadFile(e.target.files[0]));

  // Drag & drop
  wrapper.addEventListener('dragover',  e => { e.preventDefault(); wrapper.style.borderColor='var(--accent)'; });
  wrapper.addEventListener('dragleave', ()  => { wrapper.style.borderColor=''; });
  wrapper.addEventListener('drop', e => {
    e.preventDefault(); wrapper.style.borderColor='';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) loadFile(file);
    else toast('⚠️ Solo se aceptan imágenes');
  });

  // Paste (Ctrl+V / ⌘+V) anywhere on page — applies to whichever uploader is visible
  document.addEventListener('paste', e => {
    // Only if this uploader's tab is visible
    if (!wrapper.offsetParent) return;
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) { loadFile(file); toast('📋 Imagen pegada, subiendo...'); }
        return;
      }
    }
  });

  clearBtn.addEventListener('click', e => {
    e.stopPropagation(); e.preventDefault();
    clearImg(inputId, prevId, lblId, wrapperId, defaultLbl, onLoad);
  });
}

/* ── URL loader helper — también sube el resultado a Cloudinary,
   así TODAS las imágenes terminan como URL real, sin excepción ── */
function setupUrlLoader(urlInputId, loadBtnId, prevId, lblId, wrapperId, onLoad, getUploadCtx) {
  const btn = document.getElementById(loadBtnId);
  const inp = document.getElementById(urlInputId);
  if (!btn || !inp) return;

  async function loadUrl(rawUrl) {
    let url = rawUrl.trim();
    if (!url) { toast('⚠️ Pegá un URL primero'); return; }

    // === CLAVE: si el link ya es de Cloudinary, se usa TAL CUAL ===
    // No hay que descargarlo ni volver a subirlo — eso es lo que
    // generaba copias duplicadas con nombre random. Se guarda el
    // link directo y listo.
    if (url.includes('res.cloudinary.com')) {
      const filename = url.split('/').pop().split('?')[0] || 'imagen';
      const wrapperEl = document.getElementById(wrapperId);
      if (wrapperEl) wrapperEl.classList.remove('img-uploader--name-ok', 'img-uploader--name-bad');
      applyImgB64(url, prevId, lblId, wrapperId, filename, onLoad);
      inp.value = '';
      toast('✅ Imagen enlazada (ya estaba en Cloudinary, no se duplicó)');
      return;
    }

    // Dropbox: convert share link to direct download
    url = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com')
             .replace('?dl=0', '').replace('?dl=1', '');
    // Google Drive: convert share link to direct download
    const gdrive = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (gdrive) url = `https://drive.google.com/uc?export=download&id=${gdrive[1]}`;

    btn.textContent = '…'; btn.classList.add('loading');
    const wrapper = document.getElementById(wrapperId);
    if (wrapper) wrapper.classList.remove('img-uploader--name-ok', 'img-uploader--name-bad');
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ct = res.headers.get('content-type') || '';
      if (!ct.startsWith('image/')) throw new Error('No es una imagen');
      const blob = await res.blob();
      const filename = url.split('/').pop().split('?')[0] || 'imagen.jpg';
      const ctx = typeof getUploadCtx === 'function' ? getUploadCtx() : {};

      // Mismo chequeo de nombre que el uploader de archivo — un link
      // externo también tiene que traer el nombre correcto ya puesto.
      const check = validateUploadFilename(filename, ctx.slug);
      if (!check.valid) {
        if (wrapper) wrapper.classList.add('img-uploader--name-bad');
        toast(`⚠️ Nombre de archivo incorrecto: ${check.reason}`);
        btn.textContent = 'Cargar'; btn.classList.remove('loading');
        return;
      }
      if (wrapper) wrapper.classList.add('img-uploader--name-ok');

      const file = new File([blob], filename, { type: ct });
      const cloudUrl = await uploadToCloudinary(file, ctx);
      applyImgB64(cloudUrl, prevId, lblId, wrapperId, filename, onLoad);
      inp.value = '';
      toast('✅ Imagen cargada y subida');
    } catch(err) {
      toast('⚠️ No se pudo cargar. Probá descargando y subiendo el archivo.');
      console.warn('URL load error:', err);
    } finally {
      btn.textContent = 'Cargar'; btn.classList.remove('loading');
    }
  }

  btn.addEventListener('click', () => loadUrl(inp.value));
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') loadUrl(inp.value); });
}

setupImgUploader(
  'img-input-add', 'img-prev-add', 'img-lbl-add', 'img-clear-add', 'iu-add',
  'Subir imagen del edificio',
  b64 => { window._addImgB64 = b64; },
  _uploadCtx('add', 'main')
);
setupImgUploader(
  'img-input-edit', 'img-prev-edit', 'img-lbl-edit', 'img-clear-edit', 'iu-edit',
  'Cambiar imagen',
  b64 => { window._editImgB64 = b64; },
  _uploadCtx('edit', 'main')
);
setupUrlLoader('img-url-add',  'img-url-load-add',  'img-prev-add',  'img-lbl-add',  'iu-add',  b64 => { window._addImgB64  = b64; }, _uploadCtx('add', 'main'));
setupUrlLoader('img-url-edit', 'img-url-load-edit', 'img-prev-edit', 'img-lbl-edit', 'iu-edit', b64 => { window._editImgB64 = b64; }, _uploadCtx('edit', 'main'));
// Alt images for add form
window._addImgAlt1 = null; window._addImgAlt2 = null; window._addImgAlt3 = null;
setupImgUploader('img-input-alt1-add','img-prev-alt1-add','img-lbl-alt1-add','img-clear-alt1-add','iu-alt1-add','Variante 2', b64=>{ window._addImgAlt1=b64; }, _uploadCtx('add', 'alt1'));
setupImgUploader('img-input-alt2-add','img-prev-alt2-add','img-lbl-alt2-add','img-clear-alt2-add','iu-alt2-add','Variante 3', b64=>{ window._addImgAlt2=b64; }, _uploadCtx('add', 'alt2'));
setupImgUploader('img-input-alt3-add','img-prev-alt3-add','img-lbl-alt3-add','img-clear-alt3-add','iu-alt3-add','Variante 4', b64=>{ window._addImgAlt3=b64; }, _uploadCtx('add', 'alt3'));
setupUrlLoader('img-url-alt1-add', 'img-url-load-alt1-add', 'img-prev-alt1-add', 'img-lbl-alt1-add', 'iu-alt1-add', b64 => { window._addImgAlt1 = b64; }, _uploadCtx('add', 'alt1'));
setupUrlLoader('img-url-alt2-add', 'img-url-load-alt2-add', 'img-prev-alt2-add', 'img-lbl-alt2-add', 'iu-alt2-add', b64 => { window._addImgAlt2 = b64; }, _uploadCtx('add', 'alt2'));
setupUrlLoader('img-url-alt3-add', 'img-url-load-alt3-add', 'img-prev-alt3-add', 'img-lbl-alt3-add', 'iu-alt3-add', b64 => { window._addImgAlt3 = b64; }, _uploadCtx('add', 'alt3'));

// Alt images for edit form
window._editImgAlt1 = undefined; window._editImgAlt2 = undefined; window._editImgAlt3 = undefined;
setupImgUploader('img-input-alt1-edit','img-prev-alt1-edit','img-lbl-alt1-edit','img-clear-alt1-edit','iu-alt1-edit','Variante 2', b64=>{ window._editImgAlt1=b64; }, _uploadCtx('edit', 'alt1'));
setupImgUploader('img-input-alt2-edit','img-prev-alt2-edit','img-lbl-alt2-edit','img-clear-alt2-edit','iu-alt2-edit','Variante 3', b64=>{ window._editImgAlt2=b64; }, _uploadCtx('edit', 'alt2'));
setupImgUploader('img-input-alt3-edit','img-prev-alt3-edit','img-lbl-alt3-edit','img-clear-alt3-edit','iu-alt3-edit','Variante 4', b64=>{ window._editImgAlt3=b64; }, _uploadCtx('edit', 'alt3'));
setupUrlLoader('img-url-alt1-edit', 'img-url-load-alt1-edit', 'img-prev-alt1-edit', 'img-lbl-alt1-edit', 'iu-alt1-edit', b64 => { window._editImgAlt1 = b64; }, _uploadCtx('edit', 'alt1'));
setupUrlLoader('img-url-alt2-edit', 'img-url-load-alt2-edit', 'img-prev-alt2-edit', 'img-lbl-alt2-edit', 'iu-alt2-edit', b64 => { window._editImgAlt2 = b64; }, _uploadCtx('edit', 'alt2'));
setupUrlLoader('img-url-alt3-edit', 'img-url-load-alt3-edit', 'img-prev-alt3-edit', 'img-lbl-alt3-edit', 'iu-alt3-edit', b64 => { window._editImgAlt3 = b64; }, _uploadCtx('edit', 'alt3'));

/* ── Patch startEdit: ya integrado en la definición base arriba ── */



