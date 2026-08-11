/* ═══════════════════════════════════════════════════════════
   cities.js (antes: locations.js) — UBICACIONES, Entrega 1 del plan multi-ciudad.
   ---------------------------------------------------------------
   Dos cosas separadas, a propósito (ver conversación del proyecto):
   1. Crear/guardar combinaciones país-provincia-ciudad — quedan en
      una lista permanente (Firestore, colección "locations"), cada
      una con su propia acción de guardado inmediata (mismo patrón
      que "+ Nueva zona" o "+ Agregar fuente" en otras pestañas).
   2. Elegir, de esa lista ya guardada, cuál es el "contexto activo"
      (más el tipo de subcarpeta: images/sounds/...) — esto sí lleva
      el botón único "💾 Guardar cambios" de la pestaña, porque es lo
      que hay que recordar entre sesiones y lo que va a usar la
      Entrega 2 para saber en qué carpeta de Cloudinary trabajar.

   NADA de esto asume ningún nombre de país/provincia/ciudad — son
   puramente datos que el admin carga, siguiendo el mismo principio
   que ya se dejó establecido para el sistema de temas/variantes.
   ═══════════════════════════════════════════════════════════ */

let _locations = [];       // todas las ubicaciones guardadas
let _subfolderTypes = ['images'];
let ACTIVE_LOCATION = { countryCode: '', provinceCode: '', cityCode: '', subfolder: 'images' };

/* ─────────────────────────────────────────────────────────────
   CREAR / GUARDAR UNA NUEVA UBICACIÓN
   ───────────────────────────────────────────────────────────── */

function _renderLocationsList() {
  const wrap = document.getElementById('locations-list');
  if (!wrap) return;
  if (!_locations.length) {
    wrap.innerHTML = `<p style="font-size:12px;color:var(--text3)">Todavía no hay ninguna ubicación guardada. Cargá la primera arriba.</p>`;
    return;
  }
  wrap.innerHTML = _locations.map(loc => `
    <div class="za-row" data-id="${loc.id}">
      <span class="za-name" style="flex:1">${loc.countryLabel} · ${loc.provinceLabel} · ${loc.cityLabel}
        <span style="color:var(--text3);font-weight:400;font-size:11px">(${loc.countryCode}/${loc.provinceCode}/${loc.cityCode})</span>
      </span>
      <button class="za-edit-btn" data-delete-location="${loc.id}" title="Borrar">🗑️</button>
    </div>`).join('');

  wrap.querySelectorAll('[data-delete-location]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.deleteLocation;
      await deleteLocation(id);
      await _reloadLocations();
      toast('🗑️ Ubicación borrada');
    });
  });
}

async function _saveNewLocation() {
  const countryCode  = document.getElementById('loc-country-code')?.value.trim();
  const countryLabel = document.getElementById('loc-country-label')?.value.trim();
  const provinceCode  = document.getElementById('loc-province-code')?.value.trim();
  const provinceLabel = document.getElementById('loc-province-label')?.value.trim();
  const cityCode  = document.getElementById('loc-city-code')?.value.trim();
  const cityLabel = document.getElementById('loc-city-label')?.value.trim();

  if (!countryCode || !countryLabel || !provinceCode || !provinceLabel || !cityCode || !cityLabel) {
    toast('⚠️ Completá los 6 campos (código y etiqueta de país, provincia y ciudad)');
    return;
  }

  const loc = { countryCode, countryLabel, provinceCode, provinceLabel, cityCode, cityLabel };
  const ok = await saveLocation(loc);
  if (!ok) return;

  ['loc-country-code','loc-country-label','loc-province-code','loc-province-label','loc-city-code','loc-city-label']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  await _reloadLocations();
  toast(`✅ Ubicación "${loc.cityLabel}" guardada`);
}

async function _reloadLocations() {
  _locations = await loadLocations();
  _renderLocationsList();
  _renderCountrySelect();
  _renderListFilterCountry();
}

/* ─────────────────────────────────────────────────────────────
   FILTRO DE UBICACIÓN EN LA TAB "LUGARES" — mismo concepto de
   cascada que el selector de contexto activo de arriba, pero
   independiente (acá "vacío" significa "todos", no una elección
   obligatoria). Cada cambio dispara renderList() de nuevo.
   ───────────────────────────────────────────────────────────── */

function _renderListFilterCountry() {
  const sel = document.getElementById('list-filter-country');
  if (!sel) return;
  const current = sel.value;
  const countries = _uniqueBy(_locations, l => l.countryCode, l => l.countryLabel);
  sel.innerHTML = `<option value="">Todos los países</option>` +
    countries.map(([code, label]) => `<option value="${code}">${label}</option>`).join('');
  sel.value = current;
  _renderListFilterProvince();
}

function _renderListFilterProvince() {
  const sel = document.getElementById('list-filter-province');
  if (!sel) return;
  const current = sel.value;
  const countryCode = document.getElementById('list-filter-country')?.value || '';
  const provinces = _uniqueBy(
    _locations.filter(l => !countryCode || l.countryCode === countryCode),
    l => l.provinceCode, l => l.provinceLabel
  );
  sel.innerHTML = `<option value="">Todas las provincias</option>` +
    provinces.map(([code, label]) => `<option value="${code}">${label}</option>`).join('');
  sel.value = current;
  _renderListFilterCity();
}

function _renderListFilterCity() {
  const sel = document.getElementById('list-filter-city');
  if (!sel) return;
  const current = sel.value;
  const countryCode = document.getElementById('list-filter-country')?.value || '';
  const provinceCode = document.getElementById('list-filter-province')?.value || '';
  const cities = _uniqueBy(
    _locations.filter(l => (!countryCode || l.countryCode === countryCode) && (!provinceCode || l.provinceCode === provinceCode)),
    l => l.cityCode, l => l.cityLabel
  );
  sel.innerHTML = `<option value="">Todas las ciudades</option>` +
    cities.map(([code, label]) => `<option value="${code}">${label}</option>`).join('');
  sel.value = current;
  if (typeof renderList === 'function') renderList();
}

/* ─────────────────────────────────────────────────────────────
   DROPDOWN EN CASCADA (país → provincia → ciudad), poblado desde
   las ubicaciones ya guardadas — nunca texto libre acá, siempre
   elegido de lo que ya existe.
   ───────────────────────────────────────────────────────────── */

function _uniqueBy(arr, keyFn, labelFn) {
  const seen = new Map();
  arr.forEach(item => { if (!seen.has(keyFn(item))) seen.set(keyFn(item), labelFn(item)); });
  return Array.from(seen.entries()); // [[code, label], ...]
}

function _renderCountrySelect() {
  const sel = document.getElementById('loc-select-country');
  if (!sel) return;
  const countries = _uniqueBy(_locations, l => l.countryCode, l => l.countryLabel);
  sel.innerHTML = `<option value="">— Elegir país —</option>` +
    countries.map(([code, label]) => `<option value="${code}">${label} (${code})</option>`).join('');
  sel.value = ACTIVE_LOCATION.countryCode || '';
  _renderProvinceSelect();
}

function _renderProvinceSelect() {
  const sel = document.getElementById('loc-select-province');
  if (!sel) return;
  const countryCode = document.getElementById('loc-select-country')?.value || '';
  const provinces = _uniqueBy(
    _locations.filter(l => l.countryCode === countryCode),
    l => l.provinceCode, l => l.provinceLabel
  );
  sel.innerHTML = `<option value="">— Elegir provincia —</option>` +
    provinces.map(([code, label]) => `<option value="${code}">${label} (${code})</option>`).join('');
  sel.value = countryCode === ACTIVE_LOCATION.countryCode ? (ACTIVE_LOCATION.provinceCode || '') : '';
  sel.disabled = !countryCode;
  _renderCitySelect();
}

function _renderCitySelect() {
  const sel = document.getElementById('loc-select-city');
  if (!sel) return;
  const countryCode = document.getElementById('loc-select-country')?.value || '';
  const provinceCode = document.getElementById('loc-select-province')?.value || '';
  const cities = _uniqueBy(
    _locations.filter(l => l.countryCode === countryCode && l.provinceCode === provinceCode),
    l => l.cityCode, l => l.cityLabel
  );
  sel.innerHTML = `<option value="">— Elegir ciudad —</option>` +
    cities.map(([code, label]) => `<option value="${code}">${label} (${code})</option>`).join('');
  sel.value = (countryCode === ACTIVE_LOCATION.countryCode && provinceCode === ACTIVE_LOCATION.provinceCode)
    ? (ACTIVE_LOCATION.cityCode || '') : '';
  sel.disabled = !provinceCode;
  _updateActiveLocationPreview();
}

/* ─────────────────────────────────────────────────────────────
   DROPDOWN DE UBICACIÓN EN LA TAB "NUEVO" — misma cascada país→
   provincia→ciudad de arriba, poblada de lo ya guardado, pero con
   su propio estado (no toca ACTIVE_LOCATION). Arranca siempre en
   la Ubicación Activa por defecto cada vez que se abre la tab, y
   el admin puede cambiarla a mano para ESE pin puntual sin afectar
   el contexto global de "Ubicaciones". saveNew() (pin-adjust.js)
   lee estos 3 selects directamente.
   ───────────────────────────────────────────────────────────── */

function _renderAddCountrySelect() {
  const sel = document.getElementById('a-country');
  if (!sel) return;
  const countries = _uniqueBy(_locations, l => l.countryCode, l => l.countryLabel);
  sel.innerHTML = `<option value="">— Elegir país —</option>` +
    countries.map(([code, label]) => `<option value="${code}">${label} (${code})</option>`).join('');
  sel.value = (window.ACTIVE_LOCATION && window.ACTIVE_LOCATION.countryCode) || '';
  _renderAddProvinceSelect();
}

function _renderAddProvinceSelect() {
  const sel = document.getElementById('a-state');
  if (!sel) return;
  const countryCode = document.getElementById('a-country')?.value || '';
  const provinces = _uniqueBy(
    _locations.filter(l => l.countryCode === countryCode),
    l => l.provinceCode, l => l.provinceLabel
  );
  sel.innerHTML = `<option value="">— Elegir provincia —</option>` +
    provinces.map(([code, label]) => `<option value="${code}">${label} (${code})</option>`).join('');
  const activeMatches = window.ACTIVE_LOCATION && countryCode === window.ACTIVE_LOCATION.countryCode;
  sel.value = activeMatches ? (window.ACTIVE_LOCATION.provinceCode || '') : '';
  sel.disabled = !countryCode;
  _renderAddCitySelect();
}

function _renderAddCitySelect() {
  const sel = document.getElementById('a-city');
  if (!sel) return;
  const countryCode = document.getElementById('a-country')?.value || '';
  const provinceCode = document.getElementById('a-state')?.value || '';
  const cities = _uniqueBy(
    _locations.filter(l => l.countryCode === countryCode && l.provinceCode === provinceCode),
    l => l.cityCode, l => l.cityLabel
  );
  sel.innerHTML = `<option value="">— Elegir ciudad —</option>` +
    cities.map(([code, label]) => `<option value="${code}">${label} (${code})</option>`).join('');
  const activeMatches = window.ACTIVE_LOCATION &&
    countryCode === window.ACTIVE_LOCATION.countryCode && provinceCode === window.ACTIVE_LOCATION.provinceCode;
  sel.value = activeMatches ? (window.ACTIVE_LOCATION.cityCode || '') : '';
  sel.disabled = !provinceCode;
}

// Se registra como tab plugin más abajo: cada vez que se abre la tab
// "Nuevo" (incluida la primera vez), estos 3 dropdowns se repintan al
// default vigente de Ubicación Activa.
function initAddLocationDropdowns() {
  _renderAddCountrySelect();
}

/* ─────────────────────────────────────────────────────────────
   TIPOS DE SUBCARPETA (images / sounds / lo que haga falta)
   ───────────────────────────────────────────────────────────── */

function _renderSubfolderSelect() {
  const sel = document.getElementById('loc-select-subfolder');
  if (!sel) return;
  sel.innerHTML = _subfolderTypes.map(t => `<option value="${t}">${t}</option>`).join('');
  sel.value = ACTIVE_LOCATION.subfolder || _subfolderTypes[0] || 'images';
}

async function _addSubfolderType() {
  const input = document.getElementById('loc-new-subfolder');
  if (!input) return;
  const name = input.value.trim().toLowerCase();
  if (!name) { toast('⚠️ Escribí el nombre del tipo de subcarpeta'); return; }
  if (_subfolderTypes.includes(name)) { toast('⚠️ Ese tipo ya existe'); return; }
  _subfolderTypes.push(name);
  input.value = '';
  await saveSubfolderTypes(_subfolderTypes);
  _renderSubfolderSelect();
  toast(`✅ Tipo de subcarpeta "${name}" agregado`);
}

/* ─────────────────────────────────────────────────────────────
   CONTEXTO ACTIVO — vista previa de la ruta + guardado
   ───────────────────────────────────────────────────────────── */

function _updateActiveLocationPreview() {
  const country  = document.getElementById('loc-select-country')?.value || '';
  const province = document.getElementById('loc-select-province')?.value || '';
  const city     = document.getElementById('loc-select-city')?.value || '';
  const subfolder = document.getElementById('loc-select-subfolder')?.value || 'images';

  const preview = document.getElementById('loc-active-preview');
  if (preview) {
    preview.textContent = (country && province && city)
      ? `smartcity/media/${country}/${province}/${city}/${subfolder}/`
      : 'Elegí país, provincia y ciudad para ver la ruta.';
  }
}

async function _saveActiveContext() {
  const countryCode  = document.getElementById('loc-select-country')?.value || '';
  const provinceCode = document.getElementById('loc-select-province')?.value || '';
  const cityCode     = document.getElementById('loc-select-city')?.value || '';
  const subfolder    = document.getElementById('loc-select-subfolder')?.value || 'images';

  if (!countryCode || !provinceCode || !cityCode) {
    toast('⚠️ Elegí país, provincia y ciudad antes de guardar');
    return;
  }

  ACTIVE_LOCATION = { countryCode, provinceCode, cityCode, subfolder };
  // BUG REAL (encontrado): esta reasignación creaba un objeto NUEVO y lo
  // guardaba en la variable local ACTIVE_LOCATION, pero window.ACTIVE_LOCATION
  // seguía apuntando al objeto viejo (el que se leyó una sola vez al cargar
  // la página, en _bootLocations). Por eso cualquier pin nuevo seguía usando
  // la ubicación vieja (Córdoba) sin importar qué se guardara acá. Se
  // sincroniza explícitamente window.ACTIVE_LOCATION para que todo lo que
  // ya lee esa variable global (saveNew, los dropdowns de la tab "Nuevo",
  // la creación masiva de pines-cascarón, el importador de texto) vea el
  // cambio de inmediato, sin esperar un F5.
  window.ACTIVE_LOCATION = ACTIVE_LOCATION;

  const btn = document.getElementById('btn-loc-save');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Guardando...'; }

  await saveActiveLocationContext(ACTIVE_LOCATION);
  await saveSubfolderTypes(_subfolderTypes);

  if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar cambios'; }
  toast('✅ Ubicación activa guardada — así queda para todos hasta que la cambies');

  // Si la tab "Nuevo" ya está pintada, refrescamos sus 3 dropdowns para
  // que el default que muestran también quede al día con este guardado.
  if (typeof _renderAddCountrySelect === 'function') _renderAddCountrySelect();
}

/* ─────────────────────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────────────────────── */

async function initLocationsTab() {
  _renderLocationsList();
  _renderCountrySelect();
  _renderSubfolderSelect();
  _updateActiveLocationPreview();
}

(async function _bootLocations() {
  _locations = await loadLocations();
  _subfolderTypes = await loadSubfolderTypes();
  const savedContext = await loadActiveLocationContext();
  if (savedContext) ACTIVE_LOCATION = savedContext;
  window.ACTIVE_LOCATION = ACTIVE_LOCATION; // accesible para la Entrega 2 y siguientes

  const saveNewBtn = document.getElementById('btn-loc-save-new');
  if (saveNewBtn) saveNewBtn.addEventListener('click', _saveNewLocation);

  const countrySel = document.getElementById('loc-select-country');
  if (countrySel) countrySel.addEventListener('change', _renderProvinceSelect);

  const provinceSel = document.getElementById('loc-select-province');
  if (provinceSel) provinceSel.addEventListener('change', _renderCitySelect);

  const citySel = document.getElementById('loc-select-city');
  if (citySel) citySel.addEventListener('change', _updateActiveLocationPreview);

  const subfolderSel = document.getElementById('loc-select-subfolder');
  if (subfolderSel) subfolderSel.addEventListener('change', _updateActiveLocationPreview);

  const addSubfolderBtn = document.getElementById('btn-loc-add-subfolder');
  if (addSubfolderBtn) addSubfolderBtn.addEventListener('click', _addSubfolderType);

  const saveBtn = document.getElementById('btn-loc-save');
  if (saveBtn) saveBtn.addEventListener('click', _saveActiveContext);

  // Filtro de ubicación en la tab "Lugares" — se puebla ya, no hace
  // falta esperar a que se abra la pestaña Ubicaciones.
  _renderListFilterCountry();

  const filterCountrySel = document.getElementById('list-filter-country');
  if (filterCountrySel) filterCountrySel.addEventListener('change', _renderListFilterProvince);

  const filterProvinceSel = document.getElementById('list-filter-province');
  if (filterProvinceSel) filterProvinceSel.addEventListener('change', _renderListFilterCity);

  const filterCitySel = document.getElementById('list-filter-city');
  if (filterCitySel) filterCitySel.addEventListener('change', () => { if (typeof renderList === 'function') renderList(); });

  // Dropdowns de ubicación en la tab "Nuevo" — se pueblan ya (por si
  // la tab estuviera abierta de entrada) y quedan listos para el
  // tab plugin, que los repinta cada vez que se abre la tab.
  _renderAddCountrySelect();

  const addCountrySel = document.getElementById('a-country');
  if (addCountrySel) addCountrySel.addEventListener('change', _renderAddProvinceSelect);

  const addStateSel = document.getElementById('a-state');
  if (addStateSel) addStateSel.addEventListener('change', _renderAddCitySelect);
})();

if (typeof SC !== 'undefined' && SC.registerTabPlugin) {
  SC.registerTabPlugin('locations', initLocationsTab);
  SC.registerTabPlugin('add', initAddLocationDropdowns);
}
