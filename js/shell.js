'use strict';
/* ============================================================
   ITO PARA SA APP SHELL   [shell.js]
   Header ng tindahan, nav tabs (Sell, Inventory, Utang, Benta) at kung aling tab ang ipapakita.
   ============================================================ */

/* ---------- app shell ---------- */
// Para saan: buuin ang header at nav
function showApp(){
  app.innerHTML=
  '<div class="shell">'+
  '<header class="top"><div class="awning"></div><div class="top-in">'+
    '<div class="brand-row"><img class="logo-img" src="icons/icon-192.png" alt="" width="48" height="48"><div class="logo">TindaMo<small>'+esc(S.store)+(S.role==='cashier'?' · '+esc(tmHeadRole()):'')+'<span id="net"></span></small></div></div>'+
    '<div class="top-right"><nav class="nav" id="nav" aria-label="'+esc(t('mainMenu'))+'"></nav>'+
    '<button class="icon-btn bell" data-act="notifs" aria-label="'+esc(t('notifs'))+'" title="'+esc(t('notifs'))+'">'+I.bell+'<span class="bdot" id="bdot" hidden></span></button>'+
    '<button class="icon-btn" data-act="menu" aria-haspopup="menu" aria-label="'+esc(t('menu'))+'" title="'+esc(t('menu'))+'">'+I.menu+'<span class="bdot" id="mdot" hidden></span></button></div>'+
  '</div></header>'+
  '<main id="view"></main></div>';
  renderView();netUpd();checkDue();
  if(typeof ibBadge==='function')ibBadge();
}
// Para saan: iguhit ang nav tabs
function renderNav(){
  const n=owing().length;
  const tabs=[['sell',t('sell'),I.cart],['inv',t('inv'),I.box],['utang',t('utang'),I.book],['sales',t('sales'),I.chart]];
  $('#nav').style.setProperty('--ni',Math.max(0,tabs.findIndex(x=>x[0]===S.tab)));
  $('#nav').innerHTML=tabs.map(t=>'<button data-act="tab" data-t="'+t[0]+'"'+(S.tab===t[0]?' aria-current="page"':'')+'>'+t[2]+'<span>'+t[1]+'</span>'+(t[0]==='utang'&&n?'<span class="dot">'+n+'</span>':'')+'</button>').join('');
}
let io=null,cartVisible=false;
// Para saan: ipakita ang kasalukuyang tab
const KEEP_SC=['.pick-grid','.cats','.strip','.cart-lines','.i-grid','.u-list','.sa-chart'];
// top=true: pumunta sa taas (hal. pinindot ulit ang kasalukuyang tab). Kung parehong tab at refresh lang, nananatili ang scroll.
function renderView(top){
  if(io){io.disconnect();io=null}
  renderNav();
  const v=$('#view'),same=v.dataset.tab===S.tab&&top!==true,y0=same?v.scrollTop:0,sn=same?snapScroll(v,KEEP_SC):[];
  v.className=(S.tab==='sell'?'v-sell ':'')+'enter';clearTimeout(renderView.T);renderView.T=setTimeout(()=>v.classList.remove('enter'),900);
  if(S.tab==='sell')renderSell();else if(S.tab==='inv')renderInv();else if(S.tab==='utang')renderUtang();else renderSales();
  v.dataset.tab=S.tab;v.scrollTop=y0;putScroll(v,sn);navH();
}
// Para saan: sukatin ang taas ng nav sa baba para hindi matakpan ang laman (kahit anong device)
function navH(){
  const n=$('#nav'),fixed=n&&getComputedStyle(n).position==='fixed';
  document.documentElement.style.setProperty('--nav-h',(fixed?n.offsetHeight+(matchMedia('(max-width:699px)').matches?24:0):0)+'px');
}
window.addEventListener('resize',navH);window.addEventListener('orientationchange',()=>setTimeout(navH,250));

// Para saan: online/offline na label
function netUpd(){const n=$('#net');if(n)n.textContent=navigator.onLine?'':' · '+t('offline')}
