/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/* ═══════════════════════════════════════════
   SISTEMA DE SKINS (PLAN_SISTEMA_SKINS.md)
   ---------------------------------------------
   Un skin = fondo/superficies/acento/tipografía completos (máximo 3-4
   colores, a propósito, para que se pueda mantener coherente). Cada
   skin se aplica vía [data-skin="..."] en <html> — el resto del CSS
   del sitio no se toca, ya escucha esas variables (ver css/base.css
   y css/poi-panel.css, sección "SKINS" al final de cada uno).
   ═══════════════════════════════════════════ */

const SKINS = {
  default: {
    label: 'Warm Editorial',
    preview: { bg: '#f0f4f0', accent: '#3a8c4f' },
    // Sin googleFontsUrl: Sora/Nunito ya vienen cargadas siempre en
    // el <head> (ver index.html) — este skin no necesita cargar nada
    // extra, es el estilo que el sitio ya tiene hoy.
  },
  'neobrutal-night': {
    label: 'Neo-Brutalist Night',
    preview: { bg: '#0a0a0c', accent: '#facc15' },
    // Traducido del mockup subido "SmartCity — Exploración visual
    // (Neo-Brutalist)": Space Grotesk (títulos/controles) + Plus
    // Jakarta Sans (texto), pesos 500;600;700;800 como en el mockup.
    googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap',
  },
};

const DEFAULT_SKIN_ID = 'default';

let _activeSkinId = DEFAULT_SKIN_ID;
const _skinFontsLoaded = {}; // cache de URLs de Google Fonts ya inyectadas, para no duplicar <link>

function _injectSkinFont(url) {
  if (!url || _skinFontsLoaded[url]) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
  _skinFontsLoaded[url] = true;
}

/** Aplica un skin al <html> (atributo data-skin) + carga su fuente
 *  extra si hace falta (paso 7 del plan: nunca cargar todas de entrada). */
function applySkin(skinId) {
  const id = SKINS[skinId] ? skinId : DEFAULT_SKIN_ID;
  document.documentElement.setAttribute('data-skin', id);
  _activeSkinId = id;
  const def = SKINS[id];
  if (def && def.googleFontsUrl) _injectSkinFont(def.googleFontsUrl);
}

/** Resuelve qué skin debe estar activo, con esta prioridad (paso 5 del
 *  plan, escrita desde el día uno aunque hoy solo se use la rama 2):
 *    1. Preferencia guardada del usuario logueado (a futuro).
 *    2. El skin fijado por el admin (Firestore, settings/skin).
 *    3. El skin default, si ninguna de las 2 anteriores existe. */
async function resolveActiveSkin() {
  // 1. Preferencia de usuario logueado — todavía no existe (queda para
  //    cuando se construya el panel de usuario). Placeholder a
  //    propósito: cuando exista, esta línea pasa a leerla de verdad y
  //    el resto de la función no cambia.
  const userSkinPref = null;
  if (userSkinPref && SKINS[userSkinPref]) return userSkinPref;

  // 2. Skin fijado por el admin
  const adminSkin = await loadActiveSkin();
  if (adminSkin && SKINS[adminSkin]) return adminSkin;

  // 3. Default
  return DEFAULT_SKIN_ID;
}

function getActiveSkinId() { return _activeSkinId; }

/* ─────────────────────────────────────────────────────────────
   ADMIN TAB — "Interfaz" (mismo patrón que "Preset de mapa" en
   Admin → Mapa: grilla de tarjetas con preview, click = aplicar).
   ───────────────────────────────────────────────────────────── */
function initSkinsTab() {
  const grid = document.getElementById('skin-preset-grid');
  if (!grid || grid.dataset.built) return;
  grid.dataset.built = '1';

  Object.keys(SKINS).forEach(id => {
    const def = SKINS[id];
    const card = document.createElement('div');
    card.className = 'mapa-preset-card' + (_activeSkinId === id ? ' active' : '');
    card.dataset.id = id;
    card.innerHTML =
      '<div class="mapa-preview" style="background:' + def.preview.bg + '">' +
        '<div style="position:absolute;right:6px;bottom:6px;width:16px;height:16px;border-radius:50%;background:' + def.preview.accent + ';border:1.5px solid rgba(255,255,255,.5)"></div>' +
      '</div>' +
      '<div class="mapa-card-name">' + def.label + '</div>';
    card.addEventListener('click', async () => {
      document.querySelectorAll('#skin-preset-grid .mapa-preset-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      applySkin(id);
      await saveActiveSkin(id);
      toast('🎨 Skin: ' + def.label);
    });
    grid.appendChild(card);
  });
}

(async function _bootSkins() {
  // Se resuelve y aplica SIEMPRE, para todos los visitantes — no solo
  // en el admin — mismo criterio que las fuentes de typography.js.
  const skinId = await resolveActiveSkin();
  applySkin(skinId);
})();

if (typeof SC !== 'undefined' && SC.registerTabPlugin) {
  SC.registerTabPlugin('typography', initSkinsTab);
}
