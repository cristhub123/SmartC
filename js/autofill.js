/* autofill.js — Fetch place info from OpenStreetMap (Nominatim + Overpass)
   No API key required. Free, works globally.
   
   Strategy:
   1. Search Nominatim by name + address → get OSM id
   2. Query Overpass with OSM id → get tags (phone, opening_hours, description, website)
   3. Fill form fields, user can edit before saving
*/

/* ─────────────────────────────────────────
   OSM TAG → READABLE HOURS
   ───────────────────────────────────────── */
function parseOsmHours(raw) {
  if (!raw) return '';
  // Common OSM hours format: "Mo-Fr 09:00-18:00; Sa 10:00-14:00"
  // Convert to readable Spanish
  const days = {
    Mo: 'Lun', Tu: 'Mar', We: 'Mié', Th: 'Jue',
    Fr: 'Vie', Sa: 'Sáb', Su: 'Dom', PH: 'Feriados'
  };
  try {
    return raw
      .replace(/Mo/g,'Lun').replace(/Tu/g,'Mar').replace(/We/g,'Mié')
      .replace(/Th/g,'Jue').replace(/Fr/g,'Vie').replace(/Sa/g,'Sáb')
      .replace(/Su/g,'Dom').replace(/PH/g,'Feriados')
      .replace(/off/gi,'Cerrado')
      .replace(/;/g,' · ')
      .replace(/,/g,' / ');
  } catch(e) { return raw; }
}

/* ─────────────────────────────────────────
   MAIN FETCH FUNCTION
   ───────────────────────────────────────── */
async function fetchPlaceInfo(name, address) {
  const query = [name, address, 'Córdoba Argentina'].filter(Boolean).join(', ');
  
  // Step 1: Nominatim search
  const nomUrl = 'https://nominatim.openstreetmap.org/search?' +
    'q=' + encodeURIComponent(query) +
    '&format=json&limit=3&addressdetails=1&extratags=1' +
    '&viewbox=-64.35,-31.55,-63.95,-31.25&bounded=0';

  const nomRes  = await fetch(nomUrl, { headers: { 'Accept-Language': 'es' } });
  const nomData = await nomRes.json();
  
  if (!nomData || !nomData.length) {
    // Try broader search without location bias
    const broadUrl = 'https://nominatim.openstreetmap.org/search?' +
      'q=' + encodeURIComponent(name + ' Córdoba Argentina') +
      '&format=json&limit=3&extratags=1';
    const broadRes  = await fetch(broadUrl, { headers: { 'Accept-Language': 'es' } });
    const broadData = await broadRes.json();
    if (!broadData || !broadData.length) return null;
    nomData.push(...broadData);
  }

  // Pick best result — prefer ones with extratags
  const best = nomData.find(r => r.extratags && Object.keys(r.extratags).length > 0)
             || nomData[0];

  const result = {
    name:        best.display_name.split(',')[0].trim(),
    address:     best.display_name,
    lat:         parseFloat(best.lat),
    lng:         parseFloat(best.lon),
    phone:       '',
    hours:       '',
    website:     '',
    description: '',
    tags:        [],
    osmType:     best.osm_type,
    osmId:       best.osm_id,
  };

  // Extract from extratags (Nominatim may already have some)
  const et = best.extratags || {};
  result.phone   = et.phone || et['contact:phone'] || '';
  result.hours   = parseOsmHours(et.opening_hours || '');
  result.website = et.website || et['contact:website'] || et['url'] || '';
  result.description = et.description || et['description:es'] || '';
  if (et.cuisine)  result.tags.push(...et.cuisine.split(';').map(s => s.trim()));
  if (et.amenity)  result.tags.push(et.amenity.replace(/_/g,' '));
  if (et.tourism)  result.tags.push(et.tourism.replace(/_/g,' '));

  // Step 2: If we need more, query Overpass
  if (!result.phone || !result.hours) {
    try {
      const osmType = best.osm_type === 'node' ? 'node'
                    : best.osm_type === 'way'  ? 'way'
                    : 'relation';
      const overpassQuery =
        '[out:json][timeout:10];' +
        osmType + '(' + best.osm_id + ');out tags;';
      const opRes  = await fetch(
        'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(overpassQuery)
      );
      const opData = await opRes.json();
      const tags   = opData.elements && opData.elements[0] && opData.elements[0].tags;
      if (tags) {
        result.phone   = result.phone   || tags.phone || tags['contact:phone'] || tags['contact:mobile'] || '';
        result.hours   = result.hours   || parseOsmHours(tags.opening_hours || '');
        result.website = result.website || tags.website || tags['contact:website'] || '';
        result.description = result.description || tags.description || tags['description:es'] || tags.name || '';
        if (tags.cuisine) result.tags.push(...tags.cuisine.split(';').map(s=>s.trim()));
      }
    } catch(e) {
      console.warn('Overpass fallback failed:', e);
    }
  }

  // Build auto description if none found
  if (!result.description) {
    const parts = [];
    const addr  = best.address || {};
    if (addr.road)        parts.push(addr.road + (addr.house_number ? ' ' + addr.house_number : ''));
    if (addr.suburb || addr.neighbourhood) parts.push(addr.suburb || addr.neighbourhood);
    if (addr.city || addr.town) parts.push(addr.city || addr.town);
    if (parts.length) result.description = parts.join(', ');
  }

  return result;
}

/* ─────────────────────────────────────────
   WIRE BUTTONS — ADD FORM
   ───────────────────────────────────────── */
function wireAutofill(btnId, resultId, nameId, addressId, descId, phoneId, hoursId, socId, tagsId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const name    = (document.getElementById(nameId)    || {}).value || '';
    const address = (document.getElementById(addressId) || {}).value || '';

    if (!name.trim()) {
      toast('⚠️ Ingresá el nombre del lugar primero');
      return;
    }

    // Loading state
    btn.classList.add('loading');
    btn.innerHTML = '<span class="af-icon">⏳</span> Buscando en OpenStreetMap…';

    const result = document.getElementById(resultId);
    if (result) { result.classList.remove('show'); result.innerHTML = ''; }

    try {
      const data = await fetchPlaceInfo(name, address);

      if (!data) {
        toast('⚠️ No se encontró información para este lugar');
        if (result) {
          result.innerHTML = '⚠️ Sin resultados. Intentá con el nombre exacto del lugar o su dirección completa.';
          result.classList.add('show');
        }
        return;
      }

      // Fill fields — only overwrite if empty (don't lose user's manual input)
      const descEl  = document.getElementById(descId);
      const phoneEl = document.getElementById(phoneId);
      const hoursEl = document.getElementById(hoursId);
      const socEl   = document.getElementById(socId);
      const tagsEl  = document.getElementById(tagsId);

      let filled = [];

      if (descEl && !descEl.value.trim() && data.description) {
        descEl.value = data.description;
        filled.push('Descripción');
      }
      if (phoneEl && !phoneEl.value.trim() && data.phone) {
        phoneEl.value = data.phone;
        filled.push('Teléfono');
      }
      if (hoursEl && !hoursEl.value.trim() && data.hours) {
        hoursEl.value = data.hours;
        filled.push('Horarios');
      }
      if (socEl && !socEl.value.trim() && data.website) {
        socEl.value = data.website;
        filled.push('Web');
      }
      if (tagsEl && !tagsEl.value.trim() && data.tags.length) {
        tagsEl.value = data.tags.slice(0, 5).join(', ');
        filled.push('Tags');
      }

      // Show summary
      if (result) {
        const filledStr = filled.length
          ? '<strong>Completado:</strong> ' + filled.join(', ')
          : 'Se encontró el lugar pero no había info adicional disponible.';
        const addressLine = data.address
          ? '<br><span style="color:var(--text3);font-size:11px">📍 ' + data.address.split(',').slice(0,3).join(',') + '</span>'
          : '';
        result.innerHTML = filledStr + addressLine;
        result.classList.add('show');
      }

      if (filled.length) {
        toast('✅ ' + filled.join(', ') + ' completados desde OSM');
      } else {
        toast('ℹ️ Los campos ya tenían contenido — no se sobreescribieron');
      }

    } catch(err) {
      console.error('Autofill error:', err);
      toast('⚠️ Error al buscar. Verificá tu conexión.');
      if (result) {
        result.innerHTML = '⚠️ Error de conexión con OpenStreetMap. Intentá de nuevo.';
        result.classList.add('show');
      }
    } finally {
      btn.classList.remove('loading');
      btn.innerHTML = '<span class="af-icon">🌐</span> Buscar info en internet (descripción, horarios, teléfono)';
    }
  });
}

/* ─────────────────────────────────────────
   INIT — wire both forms
   ───────────────────────────────────────── */
// ADD form
wireAutofill(
  'btn-autofill-add', 'autofill-result-add',
  'a-name', 'a-address',
  'a-desc', 'a-phone', 'a-hours', 'a-soc', 'a-tags'
);

// EDIT form
wireAutofill(
  'btn-autofill-edit', 'autofill-result-edit',
  'e-name', 'e-address',
  'e-desc', 'e-phone', 'e-hours', 'e-soc', 'e-tags'
);



