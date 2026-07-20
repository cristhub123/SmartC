/* poi-panel.js — openPoiPanel, closePoiPanel, applyFilter */

/* ═══════════════════════════════════════════
   PANEL EXPANDIBLE — 2 posiciones (mitad de pantalla / casi completo)
   ---------------------------------------------
   Arrastrar la barrita (.pp-handle) hacia arriba expande el panel
   para lectura cómoda cuando hay muchos bloques de texto; un toque
   simple también alterna entre los 2 estados como atajo rápido.
   El mapa y la miniatura quedan centrados detrás tal como están —
   el panel solo sube y los cubre más.
═══════════════════════════════════════════ */
(function setupPanelExpand() {
  const panel  = document.getElementById('poi-panel');
  const handle = document.querySelector('.pp-handle');
  if (!panel || !handle) return;

  let startY = 0, startHeight = 0, dragging = false, moved = false;
  const HALF = 62, FULL = 94; // dvh

  function currentHeightVh() {
    return panel.classList.contains('expanded') ? FULL : HALF;
  }

  handle.addEventListener('pointerdown', e => {
    dragging = true; moved = false;
    startY = e.clientY;
    startHeight = currentHeightVh();
    panel.classList.add('dragging');
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dy = startY - e.clientY; // positivo = arrastre hacia arriba
    if (Math.abs(dy) > 6) moved = true;
    const vh = window.innerHeight / 100;
    let newHeight = startHeight + (dy / vh);
    newHeight = Math.max(30, Math.min(FULL, newHeight)); // no bajar de 30dvh ni pasar el máximo
    panel.style.maxHeight = newHeight + 'dvh';
  });

  handle.addEventListener('pointerup', e => {
    if (!dragging) return;
    dragging = false;
    panel.classList.remove('dragging');
    panel.style.maxHeight = ''; // vuelve a depender de la clase CSS

    if (!moved) {
      // Toque simple, sin arrastre real → alterna entre los 2 estados
      panel.classList.toggle('expanded');
      return;
    }
    // Arrastre real: decide a cuál de los 2 estados "engancha" según
    // qué tan cerca quedó de cada uno (umbral en el medio)
    const dy = startY - e.clientY;
    const vh = window.innerHeight / 100;
    const finalHeight = Math.max(30, Math.min(FULL, startHeight + dy / vh));
    const mid = (HALF + FULL) / 2;
    panel.classList.toggle('expanded', finalHeight > mid);
  });

  // Al abrir un lugar nuevo, siempre arranca en el estado "mitad"
  // (no expandido), para consistencia — se agrega en openPoiPanel.
  window._resetPanelExpand = () => panel.classList.remove('expanded');
})();

/* ═══════════════════════════════════════════
   BOTÓN "COMER CERCA" — destaca los lugares gastronómicos más
   cercanos al lugar que se está mirando. Gateado por el interruptor
   del panel admin (Funciones → 🍴 Comer cerca).
═══════════════════════════════════════════ */
function comerCercaHabilitado() {
  return typeof FEATURES !== 'undefined' && FEATURES.comerCerca && FEATURES.comerCerca.on;
}

function activarComerCerca(origen) {
  const candidatos = POIS
    .filter(p => p.id !== origen.id && p.active !== false &&
                 (p.category === 'food' || (p.categories||[]).includes('food')))
    .map(p => ({ poi: p, dist: distanceMeters(origen.lat, origen.lng, p.lat, p.lng) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 6);

  if (!candidatos.length) { toast('😅 No hay lugares gastronómicos cargados todavía'); return; }

  // Atenuar todos los pines salvo el origen y los candidatos encontrados
  const idsAMostrar = new Set([origen.id, ...candidatos.map(c => c.poi.id)]);
  Object.keys(markers).forEach(id => {
    const el = document.getElementById('pw-' + id);
    if (el) el.classList.toggle('dim', !idsAMostrar.has(id));
  });

  // Centrar el mapa para que se vean todos los resultados + el origen
  const bounds = L.latLngBounds(candidatos.map(c => [c.poi.lat, c.poi.lng]).concat([[origen.lat, origen.lng]]));
  map.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 });

  closePoiPanel();
  mostrarBannerComerCerca(candidatos.length);
}

function mostrarBannerComerCerca(cantidad) {
  let banner = document.getElementById('comer-cerca-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'comer-cerca-banner';
    banner.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:900;background:var(--surface);border-radius:999px;box-shadow:var(--shadow-md);padding:9px 16px;font-size:13px;display:flex;align-items:center;gap:10px;font-family:var(--font-b)';
    document.body.appendChild(banner);
  }
  banner.innerHTML = `<span>🍴 ${cantidad} lugar${cantidad===1?'':'es'} cerca</span>
    <button id="comer-cerca-salir" style="border:none;background:var(--accent-pale);color:var(--accent);border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700;cursor:pointer">Ver todos</button>`;
  document.getElementById('comer-cerca-salir').addEventListener('click', () => {
    banner.remove();
    applyFilter(); // restaura el estado normal (según el filtro de categoría activo)
  });
}

/* ═══════════════════════════════════════════
   POI PANEL
═══════════════════════════════════════════ */
function openPoiPanel(poi) {
  currentPoi = poi;
  if (typeof window._resetPanelExpand === 'function') window._resetPanelExpand();
  const cfg = CAT[poi.category] || {label:'—', color:'#6055d8'};

  // Image or emoji in panel header
  const ppIb = document.getElementById('pp-ib');
  if (poi.imgB64) {
    ppIb.innerHTML = `<img src="${poi.imgB64}" style="width:100%;height:100%;object-fit:contain;border-radius:10px;" alt="${poi.name}">`;
    ppIb.style.background = 'transparent';
    ppIb.style.padding = '0';
  } else {
    const candidates = buildImageFallbackChain(poi);
    ppIb.innerHTML = `<img class="pp-header-img" src="${candidates[0]}" style="width:100%;height:100%;object-fit:contain;border-radius:10px;display:block" alt="${poi.name}">
      <span id="pp-ico" style="display:none">${poi.icon || '📍'}</span>`;
    ppIb.style.background = 'transparent';
    ppIb.style.padding = '0';
    const imgEl = ppIb.querySelector('.pp-header-img');
    const emojiEl = ppIb.querySelector('#pp-ico');
    attachImageFallbackChain(imgEl, candidates, emojiEl);
    // Si termina en el emoji de respaldo, restaurar el color de fondo original
    imgEl.addEventListener('error', () => {
      if (imgEl.style.display === 'none') { ppIb.style.background = cfg.color; ppIb.style.padding = ''; }
    });
  }
  // pp-ico is inside pp-ib which is hidden; visual handled by eye icon
  document.getElementById('pp-cat').textContent  = poi.categoryLabel || cfg.label;
  document.getElementById('pp-cat').style.color  = cfg.color;
  document.getElementById('pp-name').textContent = poi.name;
  // Conteo de clicks público — solo si el admin activó el interruptor
  let clicksEl = document.getElementById('pp-clicks-public');
  if (!clicksEl) {
    clicksEl = document.createElement('div');
    clicksEl.id = 'pp-clicks-public';
    clicksEl.style.cssText = 'font-size:11px;color:var(--text3);margin-top:2px';
    document.getElementById('pp-name').insertAdjacentElement('afterend', clicksEl);
  }
  if (poi.clicksPublicVisible) {
    clicksEl.textContent = `👁 ${poi.clicks || 0} visitas`;
    clicksEl.style.display = '';
  } else {
    clicksEl.style.display = 'none';
  }
  // Tags/subcategories
  const tagsEl = document.getElementById('pp-tags');
  if (tagsEl) {
    const tags = poi.tags || [];
    tagsEl.innerHTML = tags.map(t => `<span class="poi-tag">${t}</span>`).join('');
    tagsEl.style.display = tags.length ? 'flex' : 'none';
  }
  document.getElementById('pp-desc').textContent = poi.desc || '';
  document.getElementById('pp-hist').innerHTML   = poi.hist || 'Sin datos históricos.';
  document.getElementById('pp-coords').textContent = `${poi.lat.toFixed(5)}, ${poi.lng.toFixed(5)}`;
  // Phone
  const _ppPhone = document.getElementById('pp-phone');
  if (_ppPhone) {
    _ppPhone.style.display = poi.phone ? 'flex' : 'none';
    const pv = _ppPhone.querySelector('.pp-contact-val');
    if (pv) pv.textContent = poi.phone || '';
  }
  // Hours
  const _ppHours = document.getElementById('pp-hours');
  if (_ppHours) {
    _ppHours.style.display = poi.hours ? 'flex' : 'none';
    const hv = _ppHours.querySelector('.pp-contact-val');
    if (hv) hv.textContent = poi.hours || '';
  }

  document.getElementById('poi-panel').style.filter = 'none';

  const evEl = document.getElementById('pp-evts');
  evEl.innerHTML = (poi.events && poi.events.length)
    ? poi.events.map(e => `<div class="ev-card"><div class="ev-date">${e.d}</div><div class="ev-title">${e.t}</div><div class="ev-type">${e.ty}</div></div>`).join('')
    : '<p style="color:var(--text3);font-size:13px;padding:4px 0">Sin eventos próximos.</p>';

  const sEl = document.getElementById('pp-soc');
  sEl.innerHTML = (poi.soc && poi.soc.length)
    ? poi.soc.map(s => `<a href="#" class="soc-chip">🔗 ${s}</a>`).join('')
    : '<span style="color:var(--text3);font-size:13px">Sin redes registradas.</span>';

  // Botón "Comer cerca" — solo en lugares NO gastronómicos, y solo
  // si el admin no lo desactivó desde el panel de Funciones
  let comerCercaBtn = document.getElementById('pp-comer-cerca-btn');
  const esGastronomico = poi.category === 'food' || (poi.categories||[]).includes('food');
  if (comerCercaHabilitado() && !esGastronomico) {
    if (!comerCercaBtn) {
      comerCercaBtn = document.createElement('button');
      comerCercaBtn.id = 'pp-comer-cerca-btn';
      comerCercaBtn.style.cssText = 'width:100%;margin-top:10px;border:none;background:var(--accent-pale);color:var(--accent);border-radius:12px;padding:11px;font-size:14px;font-weight:700;cursor:pointer;font-family:var(--font-b)';
      sEl.insertAdjacentElement('afterend', comerCercaBtn);
    }
    comerCercaBtn.innerHTML = '🍴 Comer cerca';
    comerCercaBtn.style.display = '';
    comerCercaBtn.onclick = () => activarComerCerca(poi);
  } else if (comerCercaBtn) {
    comerCercaBtn.style.display = 'none';
  }

  document.getElementById('poi-panel').classList.add('open');
  // Build visual picker
  buildVisPicker(poi);
}

function buildVisPicker(poi) {
  const picker = document.getElementById('pp-vis-picker');
  picker.innerHTML = '';
  picker.style.display = 'none';
  // Collect all visual variants: base + extras
  const variants = [];
  const slug = getPoiSlug(poi);
  const hasManualImgs = poi.imgB64 || poi.imgAlt1 || poi.imgAlt2 || poi.imgAlt3;

  if (hasManualImgs) {
    // Lugar cargado a mano desde el admin — se respetan los campos guardados
    if (poi.imgB64)  variants.push({src: poi.imgB64, label:'Real', key:'base'});
    if (poi.imgAlt1) variants.push({src: poi.imgAlt1, label:'Alt 1', key:'alt1'});
    if (poi.imgAlt2) variants.push({src: poi.imgAlt2, label:'Alt 2', key:'alt2'});
    if (poi.imgAlt3) variants.push({src: poi.imgAlt3, label:'Alt 3', key:'alt3'});
  } else {
    // Lugar cargado por carga masiva en Cloudinary — variantes calculadas
    // por fórmula. Las que no existan se sacan solas con onerror (abajo).
    variants.push({src: cloudinaryImageUrl(slug, {}), label:'Real', key:'base'});
    variants.push({src: cloudinaryImageUrl(slug, {suffix:'-alt1'}), label:'Alt 1', key:'alt1', mayNotExist:true});
    variants.push({src: cloudinaryImageUrl(slug, {suffix:'-alt2'}), label:'Alt 2', key:'alt2', mayNotExist:true});
    variants.push({src: cloudinaryImageUrl(slug, {suffix:'-alt3'}), label:'Alt 3', key:'alt3', mayNotExist:true});
  }
  // emoji fallbacks (si no hay ninguna imagen manual cargada como respaldo)
  if (variants.length <= 1) {
    variants.push({emoji: poi.icon,          label:'Real',    key:'base'});
    variants.push({emoji: poi.iconCyber||'🔵', label:'Cyber',  key:'cyber'});
    variants.push({emoji: poi.iconWinter||'❄️', label:'Invierno', key:'winter'});
    variants.push({emoji: poi.iconZombie||'☣️', label:'Zombie', key:'zombie'});
  }
  document.getElementById('pp-eye-btn').style.opacity = '1';
  document.getElementById('pp-eye-btn').style.pointerEvents = 'auto';
  picker._variants = variants;
  picker._current  = 0;
  variants.forEach((v, i) => {
    let el;
    if (v.src) {
      el = document.createElement('img');
      el.src = v.src; el.className = 'pp-vis-thumb';
      if (i === 0) el.classList.add('active');
      // Si la variante fue calculada por fórmula y no existe en Cloudinary
      // todavía, se saca sola de la lista sin romper nada visualmente.
      if (v.mayNotExist) {
        el.addEventListener('error', () => {
          const idx = picker._variants.indexOf(v);
          if (idx > -1) picker._variants.splice(idx, 1);
          el.remove();
        });
      }
    } else {
      el = document.createElement('div');
      el.className = 'pp-vis-thumb-emoji';
      el.textContent = v.emoji;
      if (i === 0) el.classList.add('active');
    }
    el.title = v.label;
    el.addEventListener('click', () => {
      applyVisVariant(poi, v, i);
      picker.style.display = 'none';
    });
    picker.appendChild(el);
  });
}

function applyVisVariant(poi, v, idx) {
  const picker = document.getElementById('pp-vis-picker');
  picker._current = idx;
  picker.querySelectorAll('.pp-vis-thumb,.pp-vis-thumb-emoji').forEach((el,i) => el.classList.toggle('active', i===idx));
  // Update expanded pin
  if (expandedId !== null) {
    const pinEl = document.querySelector(`#pw-${expandedId} .pin-img, #pw-${expandedId} .pin-emoji`);
    if (pinEl && v.src) { pinEl.src = v.src; }
    else if (pinEl && v.emoji) { pinEl.textContent = v.emoji; }
  }
}

// Eye button: tap → cycle, hold → open picker
let _eyeHold = null;
document.getElementById('pp-eye-btn').addEventListener('click', () => {
  const picker = document.getElementById('pp-vis-picker');
  if (!picker._variants || picker._variants.length <= 1) return;
  const next = ((picker._current || 0) + 1) % picker._variants.length;
  const v = picker._variants[next];
  applyVisVariant(currentPoi, v, next);
});
document.getElementById('pp-eye-btn').addEventListener('pointerdown', () => {
  _eyeHold = setTimeout(() => {
    const picker = document.getElementById('pp-vis-picker');
    picker.style.display = picker.style.display === 'flex' ? 'none' : 'flex';
  }, 500);
});
document.getElementById('pp-eye-btn').addEventListener('pointerup', () => clearTimeout(_eyeHold));

function closePoiPanel() {
  document.getElementById('poi-panel').classList.remove('open');
  document.getElementById('poi-panel').style.filter = 'none';
  currentPoi = null;
}

document.getElementById('pp-close').addEventListener('click', () => {
  if (expandedId !== null) collapsePin(expandedId);
  closePoiPanel();
});

// Style switcher
// Style switcher now handled by eye icon (buildVisPicker / applyVisVariant)

// Close panel on map click (only when not in pick mode)
map.on('click', e => {
  if (pickCtx) return; // pick mode handler takes over
  if (expandedId !== null) collapsePin(expandedId);
  closePoiPanel();
});

/* ═══════════════════════════════════════════
   FILTERS
═══════════════════════════════════════════ */
function applyFilter() {
  Object.values(markers).forEach(({poi}) => {
    const el = document.getElementById(`pw-${poi.id}`);
    if (!el) return;
    // Respect poi.active
    if (poi.active === false) {
      el.parentElement && (el.parentElement.style.visibility = 'hidden');
      return;
    }
    el.parentElement && (el.parentElement.style.visibility = '');
    // Multi-category support
    const cats = Array.isArray(poi.categories) && poi.categories.length ? poi.categories : [poi.category];
    const match = activeFilter === 'all' || cats.includes(activeFilter);
    el.classList.toggle('dim', !match);
    if (!match && expandedId === poi.id) {
      collapsePin(poi.id);
      closePoiPanel();
    }
  });
}


