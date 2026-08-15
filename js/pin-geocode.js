/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/* pin-geocode.js — coords vs address mode (antes: location.js) */
/* ═══════════════════════════════════════════════════════════
   MODO DE UBICACIÓN GLOBAL (Coordenadas / Dirección)
   ═══════════════════════════════════════════════════════════ */
let _locationMode = 'coords'; // 'coords' | 'address'

async function geocodeAddress(address) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ', Córdoba, Argentina')}&format=json&limit=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
    const data = await res.json();
    if (data && data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch(e) { console.warn('Geocode error:', e); }
  return null;
}

async function switchLocationMode(mode) {
  _locationMode = mode;
  const btnC = document.getElementById('loc-mode-coords');
  const btnA = document.getElementById('loc-mode-address');
  const lbl  = document.getElementById('loc-mode-label');
  if (btnC) { btnC.className = mode === 'coords'  ? 'btn-primary' : 'btn-outline'; btnC.style.marginTop = '0'; }
  if (btnA) { btnA.className = mode === 'address' ? 'btn-primary' : 'btn-outline'; btnA.style.marginTop = '0'; }
  if (lbl)  lbl.textContent = mode === 'coords' ? 'Coordenadas' : 'Dirección';

  if (mode === 'address') {
    toast('🔄 Reubicando pines por dirección…');
    let ok = 0, fail = 0;
    for (const poi of POIS) {
      if (!poi.address) { fail++; continue; }
      const coords = await geocodeAddress(poi.address);
      if (coords) {
        poi.lat = coords.lat; poi.lng = coords.lng;
        removeMarker(poi.id); makeMarker(poi); ok++;
      } else { fail++; }
    }
    toast(`✅ ${ok} reubicados · ${fail} sin dirección`);
    applyFilter();
  }
}

const btnLocCoords = document.getElementById('loc-mode-coords');
const btnLocAddr   = document.getElementById('loc-mode-address');
if (btnLocCoords) btnLocCoords.addEventListener('click', () => switchLocationMode('coords'));
if (btnLocAddr)   btnLocAddr.addEventListener('click',   () => switchLocationMode('address'));

// Autocompletar address en el geocoder al seleccionar resultado
// Patch del geocoder para guardar display_name en el campo address
// Location mode wires into geocoder after both scripts load
SC.registerTabPlugin('add', () => switchLocationMode(_locationMode));



