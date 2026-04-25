/* ══════════════════════════════════════════════════════
   INIT — runs everything in the correct order
══════════════════════════════════════════════════════ */
(function init() {
  // 1. Load tile map (Mapa admin system)
  applyTileUrl(_mapaSettings.tileUrl);

  // 2. Render POI markers
  POIS.forEach(makeMarker);

  // 3. Render category filter buttons
  updateFilterBar();
})();

/* ── Live search in the header search bar ── */
(function wireSearch() {
  const inp = document.getElementById('search-input');
  const res = document.getElementById('search-results');
  if (!inp || !res) return;

  inp.addEventListener('input', () => {
    const q = inp.value.trim().toLowerCase();
    if (q.length < 1) { res.classList.remove('show'); return; }
    const all = getAllCats();
    const hits = POIS.filter(p => {
      if (p.active === false) return false;
      return (p.name||'').toLowerCase().includes(q) ||
             (p.desc||'').toLowerCase().includes(q) ||
             (p.tags||[]).some(t => t.toLowerCase().includes(q));
    }).slice(0, 8);
    if (!hits.length) { res.classList.remove('show'); return; }
    res.innerHTML = hits.map(p => {
      const cats = Array.isArray(p.categories)&&p.categories.length ? p.categories : [p.category];
      const cfg  = all[cats[0]] || {color:'#6055d8', icon:'📍'};
      const thumb = p.imgB64
        ? `<img src="${p.imgB64}" style="width:100%;height:100%;object-fit:contain;">`
        : cfg.icon;
      return `<div class="sr-item" data-id="${p.id}">
        <div class="sr-ico" style="background:${cfg.color}20">${thumb}</div>
        <div>
          <div class="sr-name">${p.name}</div>
          <div class="sr-cat">${cats.map(c=>(all[c]||{}).label||c).join(', ')}</div>
        </div>
      </div>`;
    }).join('');
    res.classList.add('show');
    res.querySelectorAll('.sr-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        res.classList.remove('show');
        inp.value = '';
        inp.blur();
        pinClick(id);
      });
    });
  });

  inp.addEventListener('blur', () => setTimeout(() => res.classList.remove('show'), 200));
  inp.addEventListener('focus', () => { if (inp.value.trim()) inp.dispatchEvent(new Event('input')); });
})();