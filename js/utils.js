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
function buildImageFallbackChain(poi) {
  const slug = getPoiSlug(poi);
  return [
    cloudinaryImageUrl(slug, {}),                    // principal ("-cordoba")
    cloudinaryImageUrl(slug, { suffix: '_noche' }),   // variante noche
    cloudinaryImageUrl(slug, { suffix: '-alt1' }),
    cloudinaryImageUrl(slug, { suffix: '-alt2' }),
    cloudinaryImageUrl(slug, { suffix: '-alt3' }),
    cloudinaryImageUrl(`fallback-${poi.category || 'generico'}`, {}), // pin genérico de la categoría
  ];
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

/* === SUBE UN ARCHIVO A CLOUDINARY Y DEVUELVE SU URL REAL ===
   Carpeta: organizada por país/ciudad (ej. ar/cordoba/) para que,
   el día que se sume otra ciudad, no haya que tocar esta lógica —
   solo pasar otro valor de "folder". Hoy toda la app es Córdoba,
   por eso queda fijo acá como valor por defecto. */
const DEFAULT_IMG_FOLDER = 'ar/cordoba';

async function uploadToCloudinary(file, folder = DEFAULT_IMG_FOLDER) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`Cloudinary respondió ${res.status}`);
  const data = await res.json();
  return data.secure_url;
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
  document.getElementById(wrapperId).classList.remove('has-img');
  onLoad(null);
}

function setupImgUploader(inputId, prevId, lblId, clearId, wrapperId, defaultLbl, onLoad) {
  const input   = document.getElementById(inputId);
  const clearBtn= document.getElementById(clearId);
  const wrapper = document.getElementById(wrapperId);
  const lbl     = document.getElementById(lblId);

  async function loadFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('⚠️ Imagen demasiado grande (máx 5 MB)'); return; }
    const originalLbl = lbl.textContent;
    lbl.textContent = '⏳ Subiendo...';
    try {
      const url = await uploadToCloudinary(file);
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
function setupUrlLoader(urlInputId, loadBtnId, prevId, lblId, wrapperId, onLoad) {
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
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ct = res.headers.get('content-type') || '';
      if (!ct.startsWith('image/')) throw new Error('No es una imagen');
      const blob = await res.blob();
      const filename = url.split('/').pop().split('?')[0] || 'imagen.jpg';
      const file = new File([blob], filename, { type: ct });
      const cloudUrl = await uploadToCloudinary(file);
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
  b64 => { window._addImgB64 = b64; }
);
setupImgUploader(
  'img-input-edit', 'img-prev-edit', 'img-lbl-edit', 'img-clear-edit', 'iu-edit',
  'Cambiar imagen',
  b64 => { window._editImgB64 = b64; }
);
setupUrlLoader('img-url-add',  'img-url-load-add',  'img-prev-add',  'img-lbl-add',  'iu-add',  b64 => { window._addImgB64  = b64; });
setupUrlLoader('img-url-edit', 'img-url-load-edit', 'img-prev-edit', 'img-lbl-edit', 'iu-edit', b64 => { window._editImgB64 = b64; });
// Alt images for add form
window._addImgAlt1 = null; window._addImgAlt2 = null; window._addImgAlt3 = null;
setupImgUploader('img-input-alt1-add','img-prev-alt1-add','img-lbl-alt1-add','img-clear-alt1-add','iu-alt1-add','Variante 2', b64=>{ window._addImgAlt1=b64; });
setupImgUploader('img-input-alt2-add','img-prev-alt2-add','img-lbl-alt2-add','img-clear-alt2-add','iu-alt2-add','Variante 3', b64=>{ window._addImgAlt2=b64; });
setupImgUploader('img-input-alt3-add','img-prev-alt3-add','img-lbl-alt3-add','img-clear-alt3-add','iu-alt3-add','Variante 4', b64=>{ window._addImgAlt3=b64; });
setupUrlLoader('img-url-alt1-add', 'img-url-load-alt1-add', 'img-prev-alt1-add', 'img-lbl-alt1-add', 'iu-alt1-add', b64 => { window._addImgAlt1 = b64; });
setupUrlLoader('img-url-alt2-add', 'img-url-load-alt2-add', 'img-prev-alt2-add', 'img-lbl-alt2-add', 'iu-alt2-add', b64 => { window._addImgAlt2 = b64; });
setupUrlLoader('img-url-alt3-add', 'img-url-load-alt3-add', 'img-prev-alt3-add', 'img-lbl-alt3-add', 'iu-alt3-add', b64 => { window._addImgAlt3 = b64; });

// Alt images for edit form
window._editImgAlt1 = undefined; window._editImgAlt2 = undefined; window._editImgAlt3 = undefined;
setupImgUploader('img-input-alt1-edit','img-prev-alt1-edit','img-lbl-alt1-edit','img-clear-alt1-edit','iu-alt1-edit','Variante 2', b64=>{ window._editImgAlt1=b64; });
setupImgUploader('img-input-alt2-edit','img-prev-alt2-edit','img-lbl-alt2-edit','img-clear-alt2-edit','iu-alt2-edit','Variante 3', b64=>{ window._editImgAlt2=b64; });
setupImgUploader('img-input-alt3-edit','img-prev-alt3-edit','img-lbl-alt3-edit','img-clear-alt3-edit','iu-alt3-edit','Variante 4', b64=>{ window._editImgAlt3=b64; });
setupUrlLoader('img-url-alt1-edit', 'img-url-load-alt1-edit', 'img-prev-alt1-edit', 'img-lbl-alt1-edit', 'iu-alt1-edit', b64 => { window._editImgAlt1 = b64; });
setupUrlLoader('img-url-alt2-edit', 'img-url-load-alt2-edit', 'img-prev-alt2-edit', 'img-lbl-alt2-edit', 'iu-alt2-edit', b64 => { window._editImgAlt2 = b64; });
setupUrlLoader('img-url-alt3-edit', 'img-url-load-alt3-edit', 'img-prev-alt3-edit', 'img-lbl-alt3-edit', 'iu-alt3-edit', b64 => { window._editImgAlt3 = b64; });

/* ── Patch startEdit: ya integrado en la definición base arriba ── */



