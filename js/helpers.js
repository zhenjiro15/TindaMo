'use strict';
/* ============================================================
   ITO PARA SA MGA MALILIIT NA TULONG   [helpers.js]
   Pang-format ng pera, ligtas na text (esc), unique id, kulay ayon sa category, at mga icon.
   ============================================================ */

/* ---------- helpers ---------- */
const $=(s,r=document)=>r.querySelector(s);
// Para saan: gawing ligtas ang text bago ilagay sa HTML
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Para saan: gumawa ng unique id
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
// Para saan: i-round sa 2 decimal
const r2=n=>Math.round(n*100)/100;
// Para saan: gawing ₱ ang numero
const fmt=n=>'₱'+(Number.isInteger(n)?n.toLocaleString('en-PH'):n.toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2}));
// Para saan: maiksing ₱ (1.2k) para sa maliit na espasyo
const fmtK=n=>n>=1000?'₱'+(n>=10000?Math.round(n/1000):(Math.round(n/100)/10))+'k':fmt(n);
// Para saan: barcode na walang 0 sa unahan (para magkapareho ang paghahambing)
const norm=c=>String(c==null?'':c).trim().replace(/^0+/,'');
// V1.1: lahat ng barcode ng isang item (pangunahin + mga dagdag)
const itemCodes=it=>[it&&it.barcode].concat((it&&it.barcodes)||[]).map(c=>String(c==null?'':c).trim()).filter(Boolean);
// V1.1: may ganitong barcode ba ang item? (hindi alintana ang 0 sa unahan)
const hasCode=(it,code)=>{const n=norm(code);return !!n&&itemCodes(it).some(c=>norm(c)===n)};
// Para saan: kulay (hue) mula sa pangalan ng category
const hue=s=>{s=String(s||'').trim().toLowerCase();if(!s)return 215;let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))%360;return h};
const ic=d=>'<svg class="i" viewBox="0 0 24 24" aria-hidden="true">'+d+'</svg>';
const I={
  scan:ic('<path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2M8 8v8M12 8v8M16 8v8"/>'),
  cart:ic('<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h2l2.4 11h11l2-8H6.2"/>'),
  box:ic('<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>'),
  lock:ic('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  book:ic('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/>'),
  chart:ic('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  cam:ic('<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>'),
  img:ic('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-9 9"/>'),
  plus:ic('<path d="M12 5v14M5 12h14"/>'),
  minus:ic('<path d="M5 12h14"/>'),
  x:ic('<path d="M6 6l12 12M18 6 6 18"/>'),
  trash:ic('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  out:ic('<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10"/>'),
  check:ic('<path d="m5 12 5 5 9-10"/>'),
  down:ic('<path d="M6 9l6 6 6-6"/>'),
  bolt:ic('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
  vol:ic('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>'),
  mute:ic('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="m17 9 5 6M22 9l-5 6"/>'),
  hand:ic('<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-3l-2-4a1.5 1.5 0 0 1 2.4-1.7L8 14"/>'),
  swap:ic('<path d="M4 8h15l-4-4M20 16H5l4 4"/>'),
  keypad:ic('<circle cx="6" cy="5" r="1.3"/><circle cx="12" cy="5" r="1.3"/><circle cx="18" cy="5" r="1.3"/><circle cx="6" cy="11" r="1.3"/><circle cx="12" cy="11" r="1.3"/><circle cx="18" cy="11" r="1.3"/><circle cx="6" cy="17" r="1.3"/><circle cx="12" cy="17" r="1.3"/><circle cx="18" cy="17" r="1.3"/><circle cx="12" cy="22" r="1.3"/>'),
  bell:ic('<path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
  trophy:ic('<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 5H4v2a3 3 0 0 0 4 2.8M16 5h4v2a3 3 0 0 1-4 2.8M12 13v4M9 20h6M10 17h4"/>'),
  clock:ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  layers:ic('<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>'),
  cal:ic('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>'),
  bag:ic('<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
  menu:ic('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  gear:ic('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  users:ic('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3a6.5 6.5 0 0 1 3.5 5.7"/>'),
  chevL:ic('<path d="m15 5-7 7 7 7"/>'),
  chevR:ic('<path d="m9 5 7 7-7 7"/>'),
  play:ic('<path d="M7 4.5v15l12-7.5z"/>'),
  cloud:ic('<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 10a4 4 0 0 1 0 8z"/>'),
  tag:ic('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>'),
  wallet:ic('<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-1z"/><circle cx="16.5" cy="14" r="1.2"/>'),
  receipt:ic('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'),
  user:ic('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>')
};

/* ---------- V27: ingatan ang scroll kapag muling iginuhit ang isang bahagi ---------- */
// Para saan: itala ang scroll (taas at kaliwa) ng lahat ng tugma sa sels sa loob ng root
function snapScroll(root,sels){
  const out=[];if(!root)return out;
  sels.forEach(s=>root.querySelectorAll(s).forEach((e,i)=>{if(e.scrollTop||e.scrollLeft)out.push([s,i,e.scrollTop,e.scrollLeft])}));
  return out;
}
// Para saan: ibalik ang itinalang scroll (kapareho ang pwesto ng bawat listahan)
function putScroll(root,snap){
  if(!root)return;
  snap.forEach(a=>{const e=root.querySelectorAll(a[0])[a[1]];if(e){e.scrollTop=a[2];e.scrollLeft=a[3]}});
}
