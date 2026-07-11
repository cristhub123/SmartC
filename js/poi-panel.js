/* poi-panel.js — openPoiPanel, closePoiPanel, applyFilter */
/* ═══════════════════════════════════════════
   POI PANEL
═══════════════════════════════════════════ */
function openPoiPanel(poi) {
  currentPoi = poi;
  const cfg = CAT[poi.category] || {label:'—', color:'#6055d8'};

  // Image or emoji in panel header
  const ppIb = document.getElementById('pp-ib');
  if (poi.imgB64) {
    ppIb.innerHTML = `<img src="${poi.imgB64}" style="width:100%;height:100%;object-fit:contain;border-radius:10px;" alt="${poi.name}">`;
    ppIb.style.background = 'transparent';
    ppIb.style.padding = '0';
  } else {
    ppIb.innerHTML = `<span id="pp-ico">${poi.icon}</span>`;
    ppIb.style.background = cfg.color;
    ppIb.style.padding = '';
  }
  // pp-ico is inside pp-ib which is hidden; visual handled by eye icon
  document.getElementById('pp-cat').textContent  = poi.categoryLabel || cfg.label;
  document.getElementById('pp-cat').style.color  = cfg.color;
  document.getElementById('pp-name').textContent = poi.name;
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
  if (poi.imgB64)  variants.push({src: poi.imgB64, label:'Real', key:'base'});
  if (poi.imgAlt1) variants.push({src: poi.imgAlt1, label:'Alt 1', key:'alt1'});
  if (poi.imgAlt2) variants.push({src: poi.imgAlt2, label:'Alt 2', key:'alt2'});
  if (poi.imgAlt3) variants.push({src: poi.imgAlt3, label:'Alt 3', key:'alt3'});
  // emoji fallbacks
  if (!poi.imgB64) {
    variants.push({emoji: poi.icon,          label:'Real',    key:'base'});
    variants.push({emoji: poi.iconCyber||'🔵', label:'Cyber',  key:'cyber'});
    variants.push({emoji: poi.iconWinter||'❄️', label:'Invierno', key:'winter'});
    variants.push({emoji: poi.iconZombie||'☣️', label:'Zombie', key:'zombie'});
  }
  if (variants.length <= 1) {
    document.getElementById('pp-eye-btn').style.opacity = '.3';
    document.getElementById('pp-eye-btn').style.pointerEvents = 'none';
    return;
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


