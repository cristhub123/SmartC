/*
AI PROJECT NOTE:
Before modifying this file, consult /AI_RULES.md.

If AI_RULES.md has already been reviewed during the current session,
check /AI_SESSION.md instead of unnecessarily rereading the entire rules file.

After modifying this file, update /AI_SESSION.md with the change and verification performed.
*/

/* map.js — Leaflet init */
const map = L.map('map', {
  center: [-31.4167, -64.1833],
  zoom: 15,
  zoomControl: true,
  maxZoom: 19, minZoom: 12,
  attributionControl: false,
});
// Tiles loaded by map-settings.js after DOM ready



