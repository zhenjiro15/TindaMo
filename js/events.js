'use strict';
/* ============================================================
   ITO PARA SA MGA CLICK (ROUTER)   [events.js]
   Dito dumadaan ang bawat pindot. Ang mga action ng Auth, Profile, Cashier at Inventory-scan ay nasa sarili nilang file (ACTIONS).
   ============================================================ */

/* ---------- events ---------- */
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');
  if(b){act(b.dataset.act,b);return}
  if(e.target.id==='modal')closeModal();
});
// Para saan: router ng mga click action
function act(a,b){
  if(ACTIONS[a]){ACTIONS[a](b);return}
  const id=b.dataset.id;
  switch(a){
    case 'cam-open':case 'cm-again':openCam();break;
    case 'cm-snap':snap();break;
    case 'cr-done':crDone();break;
    case 'ov-close':ovClose();break;
    case 'tab':S.tab=b.dataset.t;renderView(true);break;
    case 'scan-sell':startSellScanner();break;
    case 'sell-add':sellAdd();break;
    case 'sell-cat':S.cat=b.dataset.c;renderPicker('cats');break;
    case 'inv-cat':S.invcat=b.dataset.c;renderInv();break;
    case 'inv-f':S.invf=b.dataset.f||'';document.querySelectorAll('[data-act="inv-f"]').forEach(x=>x.setAttribute('aria-pressed',String((x.dataset.f||'')===S.invf)));updateInvList();break;
    case 'add-quick':case 'inc':{const it=byId(id);if(it)addToCart(it);break}
    case 'dec':{const l=S.cart.find(x=>x.id===id);if(l){const was=cartUndoSnap();l.qty--;const di=byId(id);if(l.qty<=0){S.cart=S.cart.filter(x=>x.id!==id);cartUndoToast(was,id);tmLog('rm',{n:di?di.name:''})}else tmLog('dec',{n:di?di.name:'',q:l.qty});updateSell()}break}
    case 'rm':{const was=cartUndoSnap();const di=byId(id);S.cart=S.cart.filter(x=>x.id!==id);cartUndoToast(was,id);tmLog('rm',{n:di?di.name:''});updateSell();break}
    case 'clear-cart':{const was=cartUndoSnap();S.cart=[];cartUndoToast(was);tmLog('clr',{});updateSell();break}
    case 'to-cart':{const c=$('#cartBox');if(c)c.scrollIntoView({behavior:'smooth',block:'start'});break}
    case 'checkout':if(typeof verLocked==='function'&&verLocked())break;if(S.cart.length)openCheckout();break;
    case 'pay-mode':setPayMode(b.dataset.m);break;
    case 'cash':{const c=$('#cash');c.value=b.dataset.v;validatePay();break}
    case 'pick-name':{const n=$('#u-name');n.value=b.dataset.n;validatePay();break}
    case 'pay':completeSale();break;
    case 'new-item':openProductForm(null);break;
    case 'edit-item':{const it=byId(id);if(it)openProductForm(it);break}
    case 'sample':addSamples();break;
    case 'close-modal':closeModal();break;
    case 'fav-toggle':form.fav=!form.fav;b.setAttribute('aria-checked',String(form.fav));break;
    case 'toggle-stock':form.stockOn=!form.stockOn;drawStockBox();break;
    case 'exp-on':case 'exp-off':form.expOn=a==='exp-on';drawExpBox();break;
    case 'pick-cat':{$('#pf-cat').value=b.dataset.c;drawCatChips();break}
    case 'pf-save':saveProduct();break;
    case 'sc-close':closeScanner();break;
    case 'sc-go':{const i=$('#sc-code'),v=i.value.trim();if(v){i.value='';onDetected(v,true)}break}
    case 'del-ask':$('#pf-confirm').classList.add('open');b.style.display='none';break;
    case 'del-no':{$('#pf-confirm').classList.remove('open');const d=document.querySelector('[data-act="del-ask"]');if(d)d.style.display='';break}
    case 'del-yes':deleteProduct();break;
    case 'open-cust':openCustomer(b.dataset.k);break;
    case 'dp-fill':{const a=$('#dp-amt');a.value=b.dataset.v;if(modalUpd)modalUpd();break}
    case 'dp-pay':payDebt(b.dataset.k);break;
    case 'manual-debt':openManualDebt();break;
    case 'sale-del':if(S.role!=='cashier')openModal('<div class="sheet-h"><h2>'+esc(t('delSaleQ'))+'</h2></div><p class="hint" style="margin:0 0 4px">'+esc(t('delSaleP'))+'</p><div class="sheet-f"><button class="btn btn-ghost" data-act="close-modal">'+esc(t('dont'))+'</button><button class="btn btn-danger" style="flex:1" data-act="sale-del-yes" data-id="'+esc(id)+'">'+esc(t('yesDel'))+'</button></div>');break;
    case 'sale-del-yes':deleteSale(id);break;
    case 'pick-md':$('#md-name').value=b.dataset.n;break;
    case 'md-save':saveManualDebt();break;
  }
}
document.addEventListener('submit',e=>e.preventDefault());
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'&&e.target&&e.target.tagName==='INPUT'&&e.target.type!=='file'&&e.target.type!=='search'){
    const f=e.target.closest('form');
    const btn=f&&f.querySelector('button[data-enter]');
    if(btn){e.preventDefault();act(btn.dataset.act,btn)}
    else if(e.target.id==='md-name'||e.target.id==='md-amt'||e.target.id==='md-note'){e.preventDefault();saveManualDebt()}
  }
  if(e.key==='Escape'){
    if($('#scanner').classList.contains('open'))closeScanner();
    else if($('#modal').classList.contains('open'))closeModal();
  }
});
