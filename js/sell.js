'use strict';
/* ============================================================
   ITO PARA SA SELL   [sell.js]
   Ang pahina ng bentahan: item cards, cart, scan, at ang Bayad (Cash / Utang).
   ============================================================ */

/* ---------- item bits ---------- */
// Para saan: maliit na larawan ng item
function thumb(it){
  return '<div class="thumb" style="--h:'+hue(it.category)+'">'+(it.img?'<img alt="" src="'+esc(it.img)+'">':esc((it.name||'?').trim().charAt(0).toUpperCase()))+'</div>';
}
// Para saan: chip ng stock (Ubos / Mababa / bilang)
function stockChip(it,r,short){
  if(!it.stockOn)return '<span class="chip">∞</span>';
  r=r==null?Number(it.stock)||0:r;
  if(r<=0)return '<span class="chip bad">'+t('out')+'</span>';
  if(r<=(Number(it.warn)||0))return '<span class="chip warn">'+(short?r:t('lowLabel',r))+'</span>';
  return '<span class="chip ok">'+(short?r:t('stockMore',r))+'</span>';
}
// Para saan: mga chip ng category
function catChips(list,active,act){
  const hasFav=act==='sell-cat'&&S.items.some(i=>i.fav);
  const counts={};S.items.forEach(i=>{const c=i.category||'';counts[c]=(counts[c]||0)+1});
  const hasNone=S.items.some(i=>!i.category);
  return '<div class="cats" role="group" aria-label="'+esc(t('category'))+'">'+
    '<button class="cat" data-act="'+act+'" data-c="" aria-pressed="'+(active==='')+'">'+esc(t('all'))+'<i>'+S.items.length+'</i></button>'+
    (hasFav?'<button class="cat fav" data-act="'+act+'" data-c="__fav" aria-pressed="'+(active==='__fav')+'">★ '+esc(t('favT'))+'<i>'+S.items.filter(i=>i.fav).length+'</i></button>':'')+
    list.map(c=>'<button class="cat" data-act="'+act+'" data-c="'+esc(c)+'" aria-pressed="'+(active===c)+'">'+esc(c)+'<i>'+(counts[c]||0)+'</i></button>').join('')+
    (hasNone&&list.length?'<button class="cat" data-act="'+act+'" data-c="__none" aria-pressed="'+(active==='__none')+'">'+esc(t('noCat'))+'<i>'+(counts['']||0)+'</i></button>':'')+'</div>';
}
// Para saan: pasok ba ang item sa napiling category
const catMatch=(it,c)=>!c||(c==='__fav'?!!it.fav:c==='__none'?!it.category:it.category===c);

/* ---------- SELL ---------- */
// Para saan: buuin ang Sell page
function renderSell(){
  $('#view').innerHTML=
  '<div class="strip" id="strip"></div>'+
  '<div class="sell-grid">'+
  '<div class="a-top stack">'+
    '<div class="find"><button class="find-scan" data-act="scan-sell" aria-label="'+esc(t('scanBig'))+'" title="'+esc(t('scanBig'))+'">'+I.scan+'</button>'+
    '<label class="sr" for="quick-q">'+esc(t('search'))+'</label><input class="inp" id="quick-q" type="search" enterkeyhint="search" placeholder="'+esc(t('searchItem'))+'" value="'+esc(S.q)+'" autocomplete="off"></div>'+
    '<section class="card" id="pickBox"></section>'+
  '</div>'+
  '<section class="card cart-card a-cart" id="cartBox"></section>'+
  '</div>'+
  '<div class="pill" id="pill" data-act="to-cart" role="button" tabindex="0" hidden></div>';
  updateSell();
  if('IntersectionObserver' in window){io=new IntersectionObserver(en=>{cartVisible=!!(en[0]&&en[0].isIntersecting);updatePill()},{threshold:.2});const cb=$('#cartBox');if(cb)io.observe(cb)}
  const qi=$('#quick-q');
  qi.addEventListener('input',e=>{S.q=e.target.value;renderPicker('cats')});
  // USB scanner / i-type na barcode + Enter: kusang idadagdag sa cart
  qi.addEventListener('keydown',e=>{
    if(e.key!=='Enter')return;const v=qi.value.trim();
    if(/^\d{6,}$/.test(v)){e.preventDefault();onSellCode(v);qi.value='';S.q='';renderPicker('cats')}
  });
  if(window.matchMedia&&matchMedia('(pointer:fine)').matches)qi.focus();
}
// Para saan: i-refresh ang Sell (cart, strip, items)
function updateSell(){
  if(typeof sc!=='undefined'&&sc&&sc.cart)renderScCart();   // kasabay na nag-a-update ang cart sa loob ng scanner
  if(S.tab!=='sell'||!$('#cartBox'))return;
  const st=dayStart(),today=S.sales.filter(s=>s.ts>=st);
  // Benta ngayon = cash lang. Hiwalay ang naging utang.
  const sum=r2(today.filter(s=>s.method!=='utang').reduce((a,s)=>a+s.total,0)+today.reduce((a,s)=>a+salePaid(s),0));
  const hn=holds().length;
  const stp=$('#strip'),stl=stp.scrollLeft;
  // V31: inalis ang dagdag na chips (top item, naging utang, low stock, utang). Tap ang halaga = End-of-day report.
  stp.innerHTML='<div class="s-hero"><div class="s-big" data-act="eod" role="button" tabindex="0" aria-label="'+esc(t('eodT'))+'"><small>'+esc(t('saleToday'))+'</small><b>'+fmt(sum)+'</b></div><div class="s-chips">'+
    goalChip(split(today).all)+(hn?'<button class="chip hold" data-act="holds">'+esc(t('holdN',hn))+'</button>':'')+
    '</div></div>';
  stp.scrollLeft=stl;
  goalCheck(split(today).all);
  renderCart();renderPicker(true);S.popId=null;
  tmCartSoon();   // V1.2.8: ipakita sa may-ari ang cart ng cashier (live)
}
// Para saan: mga linya ng cart
function cartLines(){return S.cart.map(l=>({l,it:byId(l.id)})).filter(x=>x.it)}
// Para saan: iguhit ang cart at total
function renderCart(){
  const cb=$('#cartBox');if(!cb)return;
  const sn=snapScroll(cb,['.cart-lines']);   // V27: hindi na babalik sa taas ang cart kapag nag +/-
  const lines=cartLines();
  const count=lines.reduce((a,x)=>a+x.l.qty,0);
  const total=r2(lines.reduce((a,x)=>a+x.l.qty*x.it.price,0));
  cb.innerHTML=
  '<div class="cart-head sec-h"><h3>'+tmCartBtn()+esc(t('cart'))+'</h3>'+(lines.length?'<span style="display:flex;gap:6px"><button class="btn btn-ghost" style="min-height:34px;padding:0 12px" data-act="hold">'+esc(t('holdB'))+'</button><button class="btn btn-ghost" style="min-height:34px;padding:0 12px" data-act="clear-cart">'+esc(t('clearCart'))+'</button></span>':'<span class="hint">'+esc(t('cartEmpty'))+'</span>')+'</div>'+
  (lines.length?'<div class="cart-lines">'+lines.map(({l,it})=>
    '<div class="line'+(S.popId===it.id?' pop':'')+'">'+thumb(it)+
    '<div style="min-width:0"><div class="nm">'+esc(it.name)+'</div><div class="sub">'+t('eachPrice',fmt(it.price))+(it.stockOn?' · '+t('leftN',remaining(it)):'')+'</div></div>'+
    '<div class="qty"><button data-act="dec" data-id="'+it.id+'" aria-label="'+esc(l.qty===1?t('removeNamed',it.name):t('dec'))+'">'+(l.qty===1?I.trash:I.minus)+'</button><output class="qty-n" role="button" tabindex="0" data-act="qty-edit" data-id="'+it.id+'" aria-label="'+esc(t('qtyEditT'))+'">'+l.qty+'</output><button data-act="inc" data-id="'+it.id+'" aria-label="'+esc(t('inc'))+'">'+I.plus+'</button></div>'+
    '<div class="amt">'+fmt(r2(l.qty*it.price))+'</div></div>').join('')+'</div>':'')+
  '<div class="total-bar"><div><div class="tl">'+tc(count,'item')+'</div><div class="tv">'+fmt(total)+'</div></div><button class="btn btn-primary" style="min-height:40px;font-size:15px;padding:0 16px" data-act="checkout"'+(lines.length?'':' disabled')+'>'+t('pay')+' '+I.check+'</button></div>';
  { const tv=cb.querySelector('.tv');if(tv){tickNum(tv,S.lastTotal==null?total:S.lastTotal,total)} S.lastTotal=total }
  putScroll(cb,sn);
  // bagong item lang ang itinutulak sa view (kaunti lang, para makita); ang +/- ng nandoon na ay hindi gumagalaw
  if(S.newLine){const nl=S.newLine;S.newLine=null;const el=cb.querySelector('.line.pop');if(el&&el.scrollIntoView&&S.popId===nl)el.scrollIntoView({block:'nearest'})}
  updatePill(count,total);
}
// Para saan: floating pill ng cart
function updatePill(count,total){
  const p=$('#pill');if(!p)return;
  if(count==null){const lines=cartLines();count=lines.reduce((a,x)=>a+x.l.qty,0);total=r2(lines.reduce((a,x)=>a+x.l.qty*x.it.price,0))}
  p.innerHTML='<span class="pl-c">'+I.cart+'<em>'+count+'</em></span><div class="pl-t"><small>'+esc(tc(count,'item'))+'</small><b>'+fmt(total)+'</b></div><span class="pl-pay" data-act="checkout">'+esc(t('payNow'))+' '+I.check+'</span>';
  p.hidden=!(count>0&&!cartVisible);
}
// Para saan: ITEM CARDS: grid ng mga item na pipiliin
// keep: true = ingatan ang scroll ng listahan at ng category chips; 'cats' = category chips lang
function renderPicker(keep){
  const pb=$('#pickBox');if(!pb)return;
  const og=pb.querySelector('.pick-grid'),oc=pb.querySelector('.cats');
  const gTop=keep===true&&og?og.scrollTop:0,cLeft=keep&&oc?oc.scrollLeft:0;
  const cats=allCats();
  if(S.cat&&S.cat!=='__none'&&S.cat!=='__fav'&&!cats.includes(S.cat))S.cat='';
  if(S.cat==='__fav'&&!S.items.some(i=>i.fav))S.cat='';
  const q=S.q.trim().toLowerCase();
  const list=S.items.filter(i=>catMatch(i,S.cat)&&(!q||i.name.toLowerCase().includes(q)||itemCodes(i).some(c=>c.includes(q)))).sort((a,b)=>(b.fav?1:0)-(a.fav?1:0));
  let body;
  if(!S.items.length){
    body='<div class="empty" style="padding:16px 4px"><h3>'+esc(t('noItemsYet'))+'</h3><p>'+esc(t('noItemsSell'))+'</p><div class="btns"><button class="btn btn-primary" data-act="new-item">'+I.plus+' '+esc(t('makeItem'))+'</button></div></div>';
  }else{
    body=(cats.length?catChips(cats,S.cat,'sell-cat'):'')+
    '<div class="pick-grid">'+(list.length?list.map((it,ix)=>{
      const r=remaining(it),out=r<=0,n=inCart(it.id);
      return '<button class="tile" style="--h:'+hue(it.category)+';--i:'+Math.min(ix,14)+'" data-act="add-quick" data-id="'+it.id+'"'+(out?' aria-disabled="true"':'')+'>'+
        (n?'<span class="tb'+(S.popId===it.id?' pop':'')+'">'+n+'</span>':'')+(it.fav?'<span class="tf" aria-hidden="true">★</span>':'')+
        (it.stockOn?'<span class="tk">'+stockChip(it,r,true)+'</span>':'')+                       // stock: nasa taas-kaliwa ng larawan (walang lalabas kung walang bilang)
        '<div class="tile-img">'+(it.img?'<img alt="" src="'+esc(it.img)+'">':'<span>'+esc((it.name||'?').trim().charAt(0).toUpperCase())+'</span>')+'</div>'+
        '<div class="nm">'+esc(it.name)+'</div>'+
        '<div class="pr"><span class="price">'+fmt(it.price)+'</span><span class="t-add" aria-hidden="true">+</span></div></button>';
    }).join(''):'<div class="hint" style="grid-column:1/-1;padding:12px 0">'+esc(t('noItemFound'))+'</div>')+'</div>';
  }
  pb.innerHTML=body;
  if(keep){const g=pb.querySelector('.pick-grid'),c=pb.querySelector('.cats');if(g)g.scrollTop=gTop;if(c)c.scrollLeft=cLeft}
}
// Para saan: idagdag ang na-type na barcode
function sellAdd(){
  const inp=$('#sell-code');if(!inp)return;const v=inp.value.trim();
  if(v){onSellCode(v);inp.value=''}
  inp.focus();
}
// Para saan: resulta ng scan sa Sell
function onSellCode(code){
  const n=norm(code);
  const it=S.items.find(i=>hasCode(i,n));
  if(!it){
    sfx('error');buzz(BUZZ_ERR);
    toast(t('noItemBarcode',code),{kind:'err'});
    return false;
  }
  const ok=addToCart(it,true);if(ok){sfx('scan');buzz(BUZZ_OK)}return ok;
}
// Para saan: ilagay sa cart (may check sa stock at expiry)
function addToCart(it){
  if(!tmNeedSell())return false;   // V1.2.8: View lang / Edit lang ay hindi makakabenta
  if(it.stockOn&&remaining(it)<=0){
    sfx('error');buzz(BUZZ_ERR);
    toast(t('stockGone'),{kind:'err',img:it.img,sub:it.name});
    return false;
  }
  if(it.expOn&&it.exp&&new Date(it.exp+'T23:59:59')<Date.now()){sfx('error');buzz(BUZZ_ERR);toast(t('expiredN',it.name),{kind:'warn',sub:t('dateN',it.exp),ms:2600})}
  const l=S.cart.find(x=>x.id===it.id);
  if(l)l.qty++;else{S.cart.push({id:it.id,qty:1});S.newLine=it.id}
  S.popId=it.id;
  const q=inCart(it.id);
  tmLog('add',{n:it.name,q});   // V1.2.8: tala para sa may-ari
  if(typeof sc!=='undefined'&&sc&&sc.cart)sc.flashId=it.id;   // naka-bukas ang scanner: ang cart sheet na ang nagpapakita
  else toast(t('addedItem',it.name),{img:it.img,sub:t('inCartSub',q,fmt(r2(it.price*q))),key:'add:'+it.id});
  if(it.stockOn){
    const r=remaining(it);
    if(r>0&&r<=(Number(it.warn)||0))setTimeout(()=>toast(t('lowNow',r),{kind:'warn',sub:it.name,ms:2600}),350);
    else if(r<=0)setTimeout(()=>toast(t('lastOne'),{kind:'warn',sub:it.name,ms:2600}),350);
  }
  updateSell();
  return true;
}
// Para saan: buksan ang camera scanner sa Sell
function startSellScanner(){if(!tmNeedSell())return;openScanner({title:t('scanItemTitle'),cart:true,continuous:true,silent:true,onCode:code=>onSellCode(code)})}

/* ---------- CHECKOUT: Pay or Utang ---------- */
// Para saan: kabuuan ng cart
const cartTotal=()=>r2(S.cart.reduce((a,l)=>{const it=byId(l.id);return a+(it?it.price*l.qty:0)},0));
let payMode='cash';
// Para saan: BAYAD: buksan ang Pay/Utang
function openCheckout(){
  if(!tmNeedSell())return;
  const total=cartTotal();if(!S.cart.length)return;
  payMode='cash';
  const quick=Array.from(new Set([total,50,100,200,500,1000].filter(v=>v>=total))).slice(0,5);
  const names=customers().sort((a,b)=>b.last-a.last).slice(0,8);
  openModal('<div class="sheet-h"><h2>'+esc(t('pay'))+'</h2><button class="icon-btn" data-act="close-modal" aria-label="'+esc(t('close'))+'">'+I.x+'</button></div>'+
  '<div class="hint">'+esc(t('total'))+'</div><div class="pay-total">'+fmt(total)+'</div>'+
  '<div class="seg'+(gcShowTab()?' seg3':'')+'" role="tablist" style="margin-bottom:16px"><button role="tab" data-act="pay-mode" data-m="cash" aria-selected="true">'+esc(t('payCash'))+'</button>'+(gcShowTab()?'<button role="tab" data-act="pay-mode" data-m="gcash" aria-selected="false">GCash</button>':'')+'<button role="tab" data-act="pay-mode" data-m="utang" aria-selected="false">'+esc(t('utang'))+'</button></div>'+
  '<div id="pay-cash" class="stack">'+
    '<div class="field"><label for="cash">'+esc(t('cashGiven'))+'</label><input class="inp" id="cash" type="number" inputmode="decimal" min="0" step="any" placeholder="0"></div>'+
    '<div class="cash-quick">'+quick.map(v=>'<button type="button" class="btn btn-ghost" data-act="cash" data-v="'+v+'">'+(v===total?t('exact'):fmt(v))+'</button>').join('')+'</div>'+
    '<div class="change"><span>'+esc(t('changeLbl'))+'</span><b id="change">—</b></div></div>'+
  gcPayPanel()+
  '<div id="pay-utang" class="stack" hidden>'+
    '<div class="field"><label for="u-name">'+esc(t('debtorName'))+'</label><input class="inp" id="u-name" maxlength="40" placeholder="'+esc(t('debtorPh'))+'" autocomplete="off"></div>'+
    (names.length?'<div class="name-chips">'+names.map(c=>'<button type="button" data-act="pick-name" data-n="'+esc(c.name)+'">'+esc(c.name)+'</button>').join('')+'</div>':'')+
    dueField('due-pay')+
    '<div class="notice" id="u-note">'+esc(t('willAddDebt',fmt(total)))+'</div></div>'+
  '<div class="sheet-f"><button class="btn btn-ghost" data-act="close-modal">'+esc(t('back'))+'</button><button class="btn btn-primary" id="pay-ok" data-act="pay" disabled>'+esc(t('finishSale'))+'</button></div>');
  const cash=$('#cash');
  cash.addEventListener('input',validatePay);
  cash.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(!$('#pay-ok').disabled)completeSale()}});
  const gr=$('#gc-ref');
  if(gr){gr.addEventListener('input',validatePay);gr.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(!$('#pay-ok').disabled)completeSale()}})}
  const un=$('#u-name');
  un.addEventListener('input',validatePay);
  un.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(!$('#pay-ok').disabled)completeSale()}});
  setTimeout(()=>cash.focus(),50);
}
// Para saan: Cash o Utang
function setPayMode(m){
  payMode=m;
  document.querySelectorAll('[data-act="pay-mode"]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.m===m)));
  $('#pay-cash').hidden=m!=='cash';$('#pay-utang').hidden=m!=='utang';
  const gp=$('#pay-gcash');if(gp)gp.hidden=m!=='gcash';
  $('#pay-ok').textContent=m==='utang'?t('saveAsDebt'):t('finishSale');
  validatePay();
  setTimeout(()=>{const f=$(m==='cash'?'#cash':m==='gcash'?'#gc-ref':'#u-name');f&&f.focus()},30);
}
// Para saan: i-check ang bayad
function validatePay(){
  const total=cartTotal();
  if(payMode==='gcash'){$('#pay-ok').disabled=!gcRefOk();return}
  if(payMode==='cash'){
    const v=parseFloat($('#cash').value),ok=!isNaN(v)&&v>=total-1e-9;
    $('#change').textContent=isNaN(v)?'—':(ok?fmt(r2(v-total)):t('shortBy',fmt(r2(total-v))));
    $('#pay-ok').disabled=!ok;
  }else{
    const name=$('#u-name').value.trim();
    const c=customers().find(x=>x.key===name.toLowerCase());
    $('#u-note').textContent=c&&c.bal>0.004?t('alreadyOwes',name,fmt(c.bal),fmt(r2(c.bal+total))):t('willAddDebt',fmt(total));
    $('#pay-ok').disabled=name.length<2;
  }
}
// Para saan: tapusin ang benta at bawasan ang stock
function completeSale(){
  if(!tmNeedSell())return;
  const total=cartTotal();
  let cash=0,cust='',ref='';
  if(payMode==='cash'){cash=parseFloat($('#cash').value);if(isNaN(cash)||cash<total)return}
  else if(payMode==='gcash'){if(!gcRefOk())return;ref=gcDigits($('#gc-ref').value)}
  else{cust=$('#u-name').value.trim();if(cust.length<2)return;
    const ex=customers().find(x=>x.key===cust.toLowerCase());if(ex)cust=ex.name;var dueDays=readDays('due-pay')}
  const lines=[];
  for(const l of S.cart){
    const it=byId(l.id);if(!it)continue;
    if(it.stockOn&&(Number(it.stock)||0)<l.qty){toast(t('stockShort',it.name),{kind:'err'});return}
    lines.push({id:it.id,name:it.name,price:it.price,qty:l.qty});
  }
  lines.forEach(l=>{const it=byId(l.id);if(it.stockOn)it.stock=Math.max(0,(Number(it.stock)||0)-l.qty)});
  const sale={id:uid(),ts:Date.now(),lines,total,method:payMode==='cash'?'cash':payMode==='gcash'?'gcash':'utang',by:curBy()};
  if(payMode==='cash')sale.cash=cash;else if(payMode==='gcash')sale.ref=ref;else sale.customer=cust;
  S.sales.unshift(sale);
  if(S.sales.length>500){if(S.role!=='cashier')gcFoldSales(S.sales.slice(500));S.sales.length=500}
  if(payMode==='utang')S.debts.push({id:uid(),ts:sale.ts,name:cust,type:'utang',amount:total,saleId:sale.id,by:sale.by,due:dueStamp(dueDays,sale.ts),note:lines.map(l=>l.name+' ×'+l.qty).join(', ')});
  S.cart=[];tmSaleDone(sale,lines);save();closeModal();   // V1.2.8: tala ng benta ng cashier
  S.lastSale=sale;
  if(payMode==='cash'){toast(t('saleDone',fmt(total)),{sub:t('changeN',fmt(r2(cash-total))),action:{label:t('rcpt'),fn:()=>shareReceipt(sale)},ms:5200});sfx('success')}
  else if(payMode==='gcash'){toast(t('gcSaleDone',fmt(total)),{sub:t('gcRefN',ref),action:{label:t('rcpt'),fn:()=>shareReceipt(sale)},ms:5200});sfx('success')}
  else{const c=customers().find(x=>x.key===cust.toLowerCase());toast(t('debtRecorded',cust),{sub:t('totalDebtHim',fmt(c?c.bal:total)),action:{label:t('rcpt'),fn:()=>shareReceipt(sale)},ms:5200});sfx('success')}
  const low=lines.map(l=>byId(l.id)).filter(it=>it&&it.stockOn&&(Number(it.stock)||0)<=(Number(it.warn)||0));
  if(low.length)setTimeout(()=>toast(t('stockLowNow'),{kind:'warn',sub:low.slice(0,3).map(i=>i.name+' ('+i.stock+')').join(', '),ms:3200}),500);
  if(payMode==='utang')askNotif();
  lkAfterSale(sale);
  checkDue();renderNav();updateSell();
}

/* ---------- bago: target sa benta, resibo, umaakyat na total ---------- */
// Para saan: bilog na progress ng target ngayong araw (nasa strip ng Sell)
function goalChip(total){
  const g=Number(prefs.goal)||0;if(g<=0)return '';
  const pc=Math.min(100,Math.round(total/g*100)),C=2*Math.PI*8;
  return '<span class="chip goal'+(pc>=100?' done':'')+'" title="'+esc(t('goalLbl',fmt(g)))+'"><svg viewBox="0 0 20 20" width="18" height="18"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-opacity=".2" stroke-width="3"/><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="'+(C*pc/100).toFixed(1)+' '+C.toFixed(1)+'" transform="rotate(-90 10 10)"/></svg>'+esc(t('goalChip',pc))+'</span>';
}
// Para saan: kapag naabot ang target, confetti (isang beses lang kada araw)
function goalCheck(total){
  const g=Number(prefs.goal)||0,d=dayStart();
  if(g<=0||total<g||prefs.goalDay===d)return;
  prefs.goalDay=d;savePrefs();
  setTimeout(()=>{confetti();toast(t('goalHit'),{ms:3500});sfx('success')},350);
}
// Para saan: resibo na pwedeng i-share o kopyahin
function receiptText(s){
  const L=[S.store,dFmt(s.ts,{year:'numeric',month:'short',day:'numeric'})+' '+tFmt(s.ts),'------------------------'];
  s.lines.forEach(l=>L.push(l.name+' ×'+l.qty+'  '+fmt(r2(l.qty*l.price))));
  L.push('------------------------',t('rcptTotal')+': '+fmt(s.total));
  if(s.method==='utang')L.push(t('rcptDebt',s.customer||''));
  else if(s.method==='gcash')L.push(t('gcMethod')+': GCash',t('gcRefN',s.ref||''));
  else if(s.cash!=null)L.push(t('rcptCash')+': '+fmt(s.cash),t('rcptChange')+': '+fmt(r2(s.cash-s.total)));
  L.push('',t('rcptThanks'));
  return L.join('\n');
}
async function shareReceipt(s){rcShareImg(rcModelSale(s))}   // V24: larawan na, hindi text lang
// Para saan: umaakyat / bumababang bilang ng total sa cart
function tickNum(el,from,to){
  if(!el||from===to||(window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches)){if(el)el.textContent=fmt(to);return}
  const t0=performance.now(),D=380;
  (function f(n){const k=Math.min(1,(n-t0)/D),e=1-Math.pow(1-k,3);el.textContent=fmt(r2(from+(to-from)*e));if(k<1&&el.isConnected)requestAnimationFrame(f)})(t0);
}

/* ---------- V24: HOLD (ipila ang isang cart, asikasuhin muna ang iba) ---------- */
const K_HOLD=u=>'tindamo:hold:'+u;
const holds=()=>S.user?readJSON(K_HOLD(S.user),[]):[];
const holdSave=a=>store.set(K_HOLD(S.user),JSON.stringify(a.slice(0,10)));
// Para saan: i-hold ang kasalukuyang cart
function holdCurrent(){
  const lines=cartLines();if(!lines.length)return;
  const a=holds();a.unshift({id:uid(),ts:Date.now(),lines:lines.map(x=>({id:x.l.id,qty:x.l.qty}))});holdSave(a);
  S.cart=[];toast(t('holdOk'));sfx('scan');updateSell();
}
// Para saan: listahan ng mga naka-hold
function openHolds(){
  const a=holds().filter(h=>h.lines.some(l=>byId(l.id)));
  openModal('<div class="sheet-h"><h2>'+esc(t('holdTitle'))+'</h2><button class="icon-btn" data-act="close-modal" aria-label="'+esc(t('close'))+'">'+I.x+'</button></div>'+
  (a.length?a.map(h=>{const ls=h.lines.map(l=>({l,it:byId(l.id)})).filter(x=>x.it),tot=r2(ls.reduce((s2,x)=>s2+x.l.qty*x.it.price,0));
    return '<div class="hold-row"><div style="min-width:0"><b>'+fmt(tot)+'</b><div class="hint">'+esc(tFmt(h.ts))+' · '+esc(t(ls.length===1?'holdItems':'holdItems',ls.reduce((s2,x)=>s2+x.l.qty,0)))+'</div><div class="hint hold-n">'+esc(ls.map(x=>x.it.name+' ×'+x.l.qty).join(', '))+'</div></div><div class="row"><button class="btn btn-primary" style="min-height:40px" data-act="hold-resume" data-id="'+esc(h.id)+'">'+esc(t('holdResume'))+'</button><button class="icon-btn sm" data-act="hold-del" data-id="'+esc(h.id)+'" aria-label="'+esc(t('remove'))+'">'+I.trash+'</button></div></div>'}).join('')
  :'<div class="hint" style="padding:14px 0">'+esc(t('cartEmpty'))+'</div>'));
}
Object.assign(ACTIONS,{
  'hold':()=>holdCurrent(),
  'holds':()=>openHolds(),
  'hold-resume':b=>{
    const a=holds(),h=a.find(x=>x.id===b.dataset.id);if(!h)return;
    h.lines.forEach(l=>{if(!byId(l.id))return;const c=S.cart.find(x=>x.id===l.id);if(c)c.qty+=l.qty;else S.cart.push({id:l.id,qty:l.qty})});
    holdSave(a.filter(x=>x!==h));closeModal();updateSell();
  },
  'hold-del':b=>{holdSave(holds().filter(x=>x.id!==b.dataset.id));openHolds();updateSell()}
});
