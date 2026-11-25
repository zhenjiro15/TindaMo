'use strict';
/* ============================================================
   ITO PARA SA SIMULA NG APP   [main.js]
   Dito nag-uumpisa: tema, session check, at timers.
   ============================================================ */

/* ---------- boot ---------- */
applyPrefs();
// Bawal ang long-press na pagpili/pagkopya ng text at ang menu nito (maliban sa mga input)
const isField=n=>{const e=n&&n.nodeType===1?n:(n&&n.parentElement);return !!(e&&/^(INPUT|TEXTAREA)$/.test(e.tagName))};
document.addEventListener('contextmenu',e=>{if(!isField(e.target))e.preventDefault()});
document.addEventListener('selectstart',e=>{if(!isField(e.target))e.preventDefault()});
// Alisin ang splash animation pagkatapos ng ilang segundo
setTimeout(()=>{const s=document.getElementById('splash');if(s)s.remove()},2000);
// Bawal mag-zoom (pinch / double-tap / ctrl+wheel): nakapirmi ang frame ng app
['gesturestart','gesturechange','gestureend'].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault()));
document.addEventListener('wheel',e=>{if(e.ctrlKey)e.preventDefault()},{passive:false});
document.addEventListener('dblclick',e=>{if(!/^(INPUT|TEXTAREA)$/.test(e.target.tagName))e.preventDefault()});
document.addEventListener('change',e=>{
  if(e.target.id!=='lang-sel')return;
  prefs.lang=e.target.value;savePrefs();applyPrefs();document.title='TindaMo';
  if(S.user){showApp();openPage(S.page||'settings')}             // naka-login: palitan ang buong app (header, menu, tab)
  else{const u=$('#a-user');if(u)S.authPrefill=u.value;showAuth()}   // login / cashier screen
});
window.addEventListener('online',netUpd);window.addEventListener('offline',netUpd);
window.addEventListener('storage',()=>{if($('#cash-list'))drawCash()});
setInterval(beat,15000);
setInterval(checkDue,60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkDue()});
setInterval(()=>{if(S.user&&S.tab==='sales'&&!$('#modal').classList.contains('open')&&S.sp.off===0)renderSales(true)},20000);
const su=store.get(K_SESSION);
if(su&&loadUser(su)){showApp();setTimeout(clBoot,1200)}else showAuth();
// V1.1: cashier na naka-lock sa version ay ibabalik agad ang harang; tapos i-check ang bagong version sa GitHub
if(su&&S.role==='cashier')verBootLock();
setTimeout(()=>verCheck(false),3500);setInterval(()=>verCheck(false),30*60*1000);
// Offline support (needs http://localhost or https)
if(!NATIVE.on&&'serviceWorker' in navigator&&location.protocol!=='file:'){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}))}

// Naka-portrait lang (nakatayo). Android app: naka-lock sa manifest; browser/PWA: subukang i-lock.
try{if(screen.orientation&&screen.orientation.lock)screen.orientation.lock('portrait').catch(()=>{})}catch(e){}
