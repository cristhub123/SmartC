/* config.js — DATA & CONSTANTS — loaded first */
window.SC = window.SC || {};
SC._tabPlugins = {};
SC.registerTabPlugin = function(tabId, fn) {
  SC._tabPlugins[tabId] = SC._tabPlugins[tabId] || [];
  SC._tabPlugins[tabId].push(fn);
};

/* ═══════════════════════════════════════════
   DATA
═══════════════════════════════════════════ */
/* ── Lucide SVG icon set (white, outline, consistent) ── */
const LUCIDE = {
  food:    `<svg viewBox="0 0 24 24"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`,
  culture: `<svg viewBox="0 0 24 24"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>`,
  music:   `<svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  bar:     `<svg viewBox="0 0 24 24"><path d="M8 22H16"/><path d="M12 11V22"/><path d="M20 2H4L12 11 20 2Z"/></svg>`,
  art:     `<svg viewBox="0 0 24 24"><circle cx="13.5" cy="6.5" r=".5" fill="white"/><circle cx="17.5" cy="10.5" r=".5" fill="white"/><circle cx="8.5" cy="7.5" r=".5" fill="white"/><circle cx="6.5" cy="12.5" r=".5" fill="white"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`,
  historic:`<svg viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="1"/><path d="M2 10l10-8 10 8"/><line x1="12" y1="21" x2="12" y2="14"/><rect x="9" y="14" width="6" height="7"/></svg>`,
  shop:    `<svg viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
  all:     `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  default: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
};

const CAT = {
  food:    {label:'GASTRONOMÍA',  color:'#e0603a', lucide:'food'},
  culture: {label:'CULTURA',      color:'#5a52d8', lucide:'culture'},
  music:   {label:'MÚSICA',       color:'#c850a8', lucide:'music'},
  bar:     {label:'BARES',        color:'#c87020', lucide:'bar'},
  art:     {label:'ARTE',         color:'#0d9488', lucide:'art'},
  historic:{label:'HISTÓRICO',    color:'#7c4aed', lucide:'historic'},
  shop:    {label:'TIENDAS',      color:'#3a8c4f', lucide:'shop'},
};

let POIS = [
  {id:1,  name:'Manzana Jesuítica',      category:'historic', icon:'⛪',
   lat:-31.41394, lng:-64.18259,
   desc:'Complejo jesuítico declarado Patrimonio de la Humanidad por la UNESCO.',
   hist:'Construida en el siglo XVII, la <strong>Manzana Jesuítica</strong> es uno de los centros educativos y religiosos más importantes de América del Sur.',
   events:[{t:'Visita Nocturna Guiada',d:'SÁB 19 ABR',ty:'Tour Cultural'},{t:'Concierto de Órgano',d:'DOM 20 ABR',ty:'Música Clásica'}],
   soc:['@manzanajesuitica','Web Oficial'],
   iconCyber:'🔵', iconWinter:'🏔️', iconZombie:'💀'},

  {id:2,  name:'Mercado Norte',           category:'food',    icon:'🏪',
   lat:-31.41024, lng:-64.18987,
   desc:'El mercado más emblemático de la ciudad. Gastronomía local y cultura popular.',
   hist:'Inaugurado en <strong>1928</strong>, el Mercado Norte es el corazón gastronómico de Córdoba con más de 200 puestos.',
   events:[{t:'Feria de Productores',d:'SÁB 19 ABR',ty:'Gastronomía'},{t:'Festival Empanadas',d:'VIE 25 ABR',ty:'Competencia'}],
   soc:['@mercadonortecba','Instagram'],
   iconCyber:'🌆', iconWinter:'🏠', iconZombie:'🧟'},

  {id:3,  name:'Paseo del Buen Pastor',   category:'culture', icon:'🎨',
   lat:-31.41757, lng:-64.18717,
   desc:'Centro cultural en la ex‑cárcel femenina del siglo XX.',
   hist:'La <strong>ex Cárcel del Buen Pastor</strong> (1906) fue reconvertida en 2007 en faro cultural. Arquitectura neogótica + arte contemporáneo.',
   events:[{t:'Arte Digital ARG',d:'TODO EL MES',ty:'Exposición'},{t:'Open Air Cinema',d:'SÁB',ty:'Cine'}],
   soc:['@buenpastorcba','Web'],
   iconCyber:'💻', iconWinter:'⛄', iconZombie:'🧠'},

  {id:4,  name:'La Piojera',              category:'bar',     icon:'🍻',
   lat:-31.41654, lng:-64.19118,
   desc:'Bar legendario del centro. Tangos, fernet y charla hasta el amanecer.',
   hist:'Con <strong>más de 80 años</strong> de historia, La Piojera es un ícono nocturno. Se dice que aquí nacieron los mejores grupos literarios de la ciudad.',
   events:[{t:'Noche de Tango',d:'VIE 18 ABR',ty:'Música Live'},{t:'Open Mic Poesía',d:'LUN',ty:'Literatura'}],
   soc:['@lapiojera_cba','Facebook'],
   iconCyber:'🔮', iconWinter:'🫖', iconZombie:'🍷'},

  {id:5,  name:'Teatro del Libertador',   category:'culture', icon:'🎭',
   lat:-31.41312, lng:-64.18467,
   desc:'El teatro más importante de la región. Ópera, ballet y teatro contemporáneo.',
   hist:'Inaugurado en <strong>1891</strong>, el Teatro Libertador General San Martín es la sala más importante del interior argentino.',
   events:[{t:'Ópera: La Traviata',d:'SÁB 19 ABR',ty:'Ópera'},{t:'Ballet: Lago de los Cisnes',d:'DOM',ty:'Ballet'}],
   soc:['@teatrolibertadorcba','Web Oficial'],
   iconCyber:'🤖', iconWinter:'🎿', iconZombie:'👁️'},

  {id:6,  name:'Barrio Güemes',           category:'art',     icon:'🎪',
   lat:-31.42275, lng:-64.18843,
   desc:'El barrio más bohemio. Ferias de diseño, murales y gastronomía alternativa.',
   hist:'El <strong>Barrio Güemes</strong> se transformó en los 90s en epicentro del arte underground cordobés.',
   events:[{t:'Feria Artesanal',d:'SÁB Y DOM',ty:'Feria'},{t:'Festival de Murales',d:'ABR 26-27',ty:'Arte Urbano'}],
   soc:['@guemescba','Instagram','TikTok'],
   iconCyber:'🌐', iconWinter:'🌨️', iconZombie:'🎃'},

  {id:7,  name:'La Sala de las Guitarras', category:'music',  icon:'🎸',
   lat:-31.41892, lng:-64.18558,
   desc:'El venue más famoso del rock cordobés. Shows todas las noches.',
   hist:'Fundada en <strong>1995</strong> por músicos locales, cuna del rock cordobés.',
   events:[{t:'Rock Sinfónico',d:'VIE 18 ABR',ty:'Rock'},{t:'Flamenco Fusion',d:'SÁB 19 ABR',ty:'Música Live'}],
   soc:['@lasalaguitarras','Spotify','Instagram'],
   iconCyber:'🎧', iconWinter:'🎶', iconZombie:'🎵'},
];

let nextId       = 100;
let markers      = {};          // id → { leafletMarker, poi }
let activeFilter = 'all';
let expandedId   = null;
let currentPoi   = null;
let pickCtx      = null;        // 'add' | 'edit'
let editingId    = null;
let pendingDelId = null;
let addEmoji     = '📍';
let editEmoji    = '📍';