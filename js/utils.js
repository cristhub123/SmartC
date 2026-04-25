/* ═══════════════════════════════════════════
   TOAST
═══════════════════════════════════════════ */
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('on'), 2800);
}

/* ═══════════════════════════════════════════
   POI PANEL SWIPE-TO-CLOSE (MOBILE)
═══════════════════════════════════════════ */
let swipeY = 0;
const pp = document.getElementById('poi-panel');
pp.addEventListener('touchstart', e => { swipeY = e.touches[0].clientY; }, {passive:true});
pp.addEventListener('touchend', e => {
  if (e.changedTouches[0].clientY - swipeY > 80 && pp.scrollTop === 0) {
    if (expandedId !== null) collapsePin(expandedId);
    closePoiPanel();
  }
}, {passive:true});

/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */
/* ═══════════════════════════════════════════
   IMAGE UPLOAD LOGIC
═══════════════════════════════════════════ */
window._addImgB64  = null;
window._editImgB64 = null;

function applyImgB64(b64, prevId, lblId, wrapperId, filename, onLoad) {
  const prev    = document.getElementById(prevId);
  const lbl     = document.getElementById(lblId);
  const wrapper = document.getElementById(wrapperId);
  prev.innerHTML = `<img src="${b64}" alt="preview">`;
  lbl.textContent = filename || 'Imagen cargada';
  wrapper.classList.add('has-img');
  onLoad(b64);
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

  function loadFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('⚠️ Imagen demasiado grande (máx 5 MB)'); return; }
    const reader = new FileReader();
    reader.onload = ev => applyImgB64(ev.target.result, prevId, lblId, wrapperId, file.name, onLoad);
    reader.readAsDataURL(file);
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
        if (file) { loadFile(file); toast('📋 Imagen pegada'); }
        return;
      }
    }
  });

  clearBtn.addEventListener('click', e => {
    e.stopPropagation(); e.preventDefault();
    clearImg(inputId, prevId, lblId, wrapperId, defaultLbl, onLoad);
  });
}

/* ── URL loader helper ── */
function setupUrlLoader(urlInputId, loadBtnId, prevId, lblId, wrapperId, onLoad) {
  const btn = document.getElementById(loadBtnId);
  const inp = document.getElementById(urlInputId);
  if (!btn || !inp) return;

  async function loadUrl(rawUrl) {
    let url = rawUrl.trim();
    if (!url) { toast('⚠️ Pegá un URL primero'); return; }

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
      const reader = new FileReader();
      reader.onload = ev => {
        applyImgB64(ev.target.result, prevId, lblId, wrapperId, url.split('/').pop().split('?')[0] || 'imagen', onLoad);
        inp.value = '';
        toast('✅ Imagen cargada desde URL');
      };
      reader.readAsDataURL(blob);
    } catch(err) {
      // If CORS blocks, offer to use URL directly as src
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

// Alt images for edit form
window._editImgAlt1 = undefined; window._editImgAlt2 = undefined; window._editImgAlt3 = undefined;
setupImgUploader('img-input-alt1-edit','img-prev-alt1-edit','img-lbl-alt1-edit','img-clear-alt1-edit','iu-alt1-edit','Variante 2', b64=>{ window._editImgAlt1=b64; });
setupImgUploader('img-input-alt2-edit','img-prev-alt2-edit','img-lbl-alt2-edit','img-clear-alt2-edit','iu-alt2-edit','Variante 3', b64=>{ window._editImgAlt2=b64; });
setupImgUploader('img-input-alt3-edit','img-prev-alt3-edit','img-lbl-alt3-edit','img-clear-alt3-edit','iu-alt3-edit','Variante 4', b64=>{ window._editImgAlt3=b64; });

/* ── Patch startEdit: ya integrado en la definición base arriba ── */
