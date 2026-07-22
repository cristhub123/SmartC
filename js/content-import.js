/* ═══════════════════════════════════════════
   IMPORTAR CONTENIDO — carga masiva desde JSON de texto (sin
   coordenadas), generado con el proceso externo de IA del usuario
   (nombre, categoría, gancho, propuesta, dato_curioso, imperdible,
   horario_estimado).
   ---------------------------------------------
   Mapea ese formato a los campos que YA existen en cada lugar
   (desc, hist, hours) — no depende del sistema de "bloques
   dinámicos" que todavía no está construido, para poder usarse
   HOY con contenido real.
   Los lugares se crean SIN lat/lng — quedan marcados como
   "Falta ubicación" en la lista, para completar a mano después.
═══════════════════════════════════════════ */

/* Mapeo de categorías en español libre → nuestras categorías fijas.
   Lo que no matchea cae en 'historic' por defecto, pero queda
   marcado internamente para que el admin lo revise (no se fuerza
   en silencio una categoría que puede estar mal). */
const CONTENT_CATEGORY_MAP = {
  'centro cultural':       'culture',
  'patrimonio':            'historic',
  'restaurante':           'food',
  'gastronomia':           'food',
  'gastronomía':           'food',
  'bar':                   'bar',
  'arquitectura moderna':  'historic',
  'espacio verde':         'historic',
  'museo':                 'culture',
  'musica':                'music',
  'música':                'music',
  'arte':                  'art',
  'tienda':                'shop',
  'tiendas':               'shop',
};

function mapContentCategory(rawCat) {
  const key = (rawCat || '').trim().toLowerCase();
  const mapped = CONTENT_CATEGORY_MAP[key];
  return { category: mapped || 'historic', necesitaRevisarCategoria: !mapped };
}

async function importContentJSON(jsonText) {
  const resultEl = document.getElementById('import-content-result');
  resultEl.innerHTML = '⏳ Procesando...';

  let items;
  try {
    items = JSON.parse(jsonText);
    if (!Array.isArray(items)) throw new Error('El JSON debe ser una lista [ ... ]');
  } catch (err) {
    resultEl.innerHTML = `⚠️ El texto pegado no es JSON válido: ${err.message}`;
    return;
  }

  let creados = 0, actualizados = 0, revisarCategoria = [];

  for (const item of items) {
    const nombre = (item.nombre || '').trim();
    if (!nombre) continue; // se saltea cualquier entrada sin nombre

    const slug = `${slugify(nombre)}-cordoba`;
    const { category, necesitaRevisarCategoria } = mapContentCategory(item.categoria);
    if (necesitaRevisarCategoria) revisarCategoria.push(nombre);

    const cfg = CAT[category] || { label: category.toUpperCase() };
    const existente = POIS.find(p => p.id === slug);

    // Arma la descripción combinando gancho (frase de enganche) +
    // propuesta (descripción principal) — ambos van al mismo campo
    // "desc" que ya usa el panel del lugar.
    const desc = [item.gancho, item.propuesta].filter(Boolean).join(' ');
    // El dato curioso + lo imperdible van al campo "hist" (Historia/Trivia)
    const hist = [item.dato_curioso, item.imperdible ? `💡 Imperdible: ${item.imperdible}` : null]
      .filter(Boolean).join('\n\n');

    const poi = existente ? { ...existente } : {
      id: slug, lat: null, lng: null, address: '',
      icon: '📍', imgB64: null, imgAlt1: null, imgAlt2: null, imgAlt3: null,
      pinScale: 100, pinOffsetX: 0, pinOffsetY: 0,
      soc: [], tags: [], phone: '',
      events: [], iconCyber:'🔵', iconWinter:'❄️', iconZombie:'☣️',
      active: true,
    };

    poi.name          = nombre;
    poi.category      = category;
    poi.categories    = [category];
    poi.categoryLabel = cfg.label;
    poi.desc          = desc || poi.desc || '';
    poi.hist          = hist || poi.hist || 'Sin datos históricos.';
    poi.hours         = item.horario_estimado || poi.hours || '';

    const ok = await savePoiToFirestore(poi);
    if (!ok) continue; // ya se avisó el error dentro de savePoiToFirestore

    if (existente) {
      const idx = POIS.findIndex(p => p.id === slug);
      POIS[idx] = poi;
      actualizados++;
    } else {
      POIS.push(poi);
      creados++;
    }
    // No se llama a makeMarker() — sin lat/lng no hay dónde ubicar el
    // pin todavía. Va a aparecer en la lista de "Lugares" marcado
    // como "Falta ubicación", listo para completar desde "Editar".
  }

  renderList();

  let resumen = `✅ Importación terminada: ${creados} creados, ${actualizados} actualizados.<br>`;
  resumen += `📍 Todos quedaron sin ubicación — completalos desde "Lugares" → Editar.`;
  if (revisarCategoria.length) {
    resumen += `<br>⚠️ Categoría no reconocida, se asignó "Histórico" por defecto — revisar: ${revisarCategoria.join(', ')}`;
  }
  resultEl.innerHTML = resumen;
  toast(`✅ ${creados + actualizados} lugares importados`);
}

document.getElementById('btn-import-content').addEventListener('click', () => {
  const text = document.getElementById('import-content-textarea').value.trim();
  if (!text) { toast('⚠️ Pegá el JSON primero'); return; }
  importContentJSON(text);
});
