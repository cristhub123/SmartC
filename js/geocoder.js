/* geocoder.js — Nominatim address search */
/* ═══════════════════════════════════════════
   GEOCODER — Nominatim (OpenStreetMap, gratuito, sin API key)
═══════════════════════════════════════════ */
function setupGeocoder(inputId, btnId, resultsId, latId, lngId, coordDisplayId, syncFn) {
  const input   = document.getElementById(inputId);
  const btn     = document.getElementById(btnId);
  const results = document.getElementById(resultsId);

  async function search() {
    const q = input.value.trim();
    if (!q) { toast('⚠️ Escribí un nombre o dirección'); return; }
    btn.textContent = '…'; btn.classList.add('loading');
    results.classList.remove('show'); results.innerHTML = '';
    try {
      // Nominatim: bias results to Córdoba, Argentina
      const url = `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(q + ', Córdoba, Argentina')}` +
        `&format=json&limit=5&addressdetails=1` +
        `&viewbox=-64.35,-31.55,-63.95,-31.25&bounded=0`;
      const res  = await fetch(url, { headers: { 'Accept-Language': 'es' } });
      const data = await res.json();
      if (!data.length) {
        results.innerHTML = '<div class="geocoder-result"><strong>Sin resultados</strong><span>Probá con otra búsqueda</span></div>';
        results.classList.add('show'); return;
      }
      results.innerHTML = data.map((r, i) => {
        const name = r.display_name.split(',').slice(0,3).join(', ');
        const type = r.type || r.class || '';
        return `<div class="geocoder-result" data-i="${i}" data-lat="${r.lat}" data-lng="${r.lon}">
          <strong>${name}</strong>
          <span>${type} · ${parseFloat(r.lat).toFixed(5)}, ${parseFloat(r.lon).toFixed(5)}</span>
        </div>`;
      }).join('');
      results.classList.add('show');
      results.querySelectorAll('.geocoder-result').forEach(el => {
        el.addEventListener('click', () => {
          const lat = parseFloat(el.dataset.lat);
          const lng = parseFloat(el.dataset.lng);
          document.getElementById(latId).value  = lat.toFixed(6);
          document.getElementById(lngId).value  = lng.toFixed(6);
          syncFn();
          results.classList.remove('show');
          input.value = el.querySelector('strong').textContent;
          // Pan map to result
          map.setView([lat, lng], 17, {animate: true});
          // Temp marker
          if (tempMarker) { tempMarker.remove(); tempMarker = null; }
          tempMarker = L.circleMarker([lat, lng], {
            radius: 12, color: '#2563eb', weight: 3,
            fillColor: '#2563eb', fillOpacity: .35
          }).addTo(map);
          setTimeout(() => { if (tempMarker) { tempMarker.remove(); tempMarker = null; } }, 5000);
          toast(`📍 ${el.querySelector('strong').textContent}`);
        });
      });
    } catch(err) {
      results.innerHTML = '<div class="geocoder-result"><strong>Error de conexión</strong><span>Verificá tu conexión a internet</span></div>';
      results.classList.add('show');
    } finally {
      btn.textContent = 'Buscar'; btn.classList.remove('loading');
    }
  }

  btn.addEventListener('click', search);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); search(); } });
  // Close results on outside click
  document.addEventListener('click', e => {
    if (!results.contains(e.target) && e.target !== input && e.target !== btn) {
      results.classList.remove('show');
    }
  });
}

setupGeocoder('geo-input-add',  'geo-btn-add',  'geo-results-add',  'a-lat', 'a-lng', 'a-coord-display', syncAddCoordDisplay);
setupGeocoder('geo-input-edit', 'geo-btn-edit', 'geo-results-edit', 'e-lat', 'e-lng', 'e-coord-display', syncEditCoordDisplay);



