/*
AI PROJECT NOTE — LECTURA OBLIGATORIA PARA CUALQUIER IA:
Antes de modificar este archivo, toda IA (Claude, ChatGPT u otra) DEBE
leer primero /AI_RULES.md completo. Sin excepcion, sin importar cuan
chico o simple parezca el cambio, y sin esperar a que el usuario lo
pida o lo recuerde — esta nota es la instruccion, no un recordatorio
opcional. Si /AI_RULES.md ya se leyo en esta misma sesion, alcanza con
revisar /AI_SESSION.md en su lugar.

Despues de modificar este archivo, actualizar /AI_SESSION.md con el
cambio hecho y la verificacion realizada.
*/

/**
 * [Etapa 7, 2026-08-16] Selector de idioma GLOBAL de la app pública.
 * Vive en el header (#lang-switcher, ver index.html/css/base.css) —
 * ya NO está dentro del panel de un lugar puntual (se sacó de
 * js/poi-panel.js), para que el visitante pueda elegir idioma aunque
 * todavía no haya abierto ningún pin.
 *
 * Guarda la elección en localStorage (clave "smartcity_lang") para
 * que se mantenga entre visitas, y mantiene el botón resaltado
 * sincronizado con AppState.getLanguage() sea cual sea el origen del
 * cambio — este selector, o cualquier otro que en el futuro también
 * llame a AppState.setLanguage().
 */
(function () {
  const STORAGE_KEY = 'smartcity_lang';
  const VALID_LANGS = ['es', 'en', 'pt'];

  function _applyActiveState(lang) {
    document.querySelectorAll('#lang-switcher [data-lang-switch]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.langSwitch === lang);
      btn.setAttribute('aria-pressed', btn.dataset.langSwitch === lang ? 'true' : 'false');
    });
  }

  function _init() {
    if (typeof AppState === 'undefined') return; // defensa: script mal ordenado en index.html

    // Idioma guardado de una visita anterior, si es válido — si no,
    // se queda con el default de AppState (FALLBACK_LANG = 'es').
    let saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) { /* localStorage bloqueado (modo privado, etc.) — se ignora, arranca en español */ }
    if (saved && VALID_LANGS.includes(saved)) AppState.setLanguage(saved);

    _applyActiveState(AppState.getLanguage());

    document.querySelectorAll('#lang-switcher [data-lang-switch]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lang = btn.dataset.langSwitch;
        AppState.setLanguage(lang);
        try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* idem */ }
      });
    });

    // Si el idioma cambiara desde algún otro lugar de la app, este
    // selector se mantiene sincronizado igual (no depende de ser el
    // único que dispara el cambio).
    AppState.on(AppState.EVENTS.LANGUAGE_CHANGED, ({ lang }) => _applyActiveState(lang));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
})();
