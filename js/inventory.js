'use strict';
/* ============================================================
   ITO PARA SA INVENTORY   [inventory.js]
   Listahan ng items, Add/Edit item form, scan (meron na = edit, wala pa = bagong item), stock at expiry.
   ============================================================ */

/* ---------- INVENTORY ---------- */
// Para saan: ilang araw na lang bago ma-expire (para sa filter)
const invExpSoon=it=>it.expOn&&it.exp&&Math.round((new Date(it.exp+'T00:00:00').getTime()-dayStart())/864e5)<=7;
// Para saan: buuin ang Inventory page (V24: bagong stat tiles na pwedeng pindutin bilang filter)
function renderInv(){
  const sn=i=>Number(i.stock)||0,out=S.items.filter(i=>i.stockOn&&sn(i)<=0).length,low=S.items.filter(i=>i.stockOn&&sn(i)>0&&sn(i)<=(Number(i.warn)||0)).length,val=r2(S.items.reduce((a,i)=>a+(i.stockOn?sn(i)*i.price:0),0)),exp=S.items.filter(invExpSoon).length;
  const cats=allCats();
  if(S.invcat&&S.invcat!=='__none'&&!cats.includes(S.invcat))S.invcat='';
  const F=[['','invAllF',S.items.length],['low','low',low],['out','out',out],['exp','invExp',exp]];
  $('#view').innerHTML=
  '<div class="page-h"><h2>'+esc(t('inv'))+'</h2><span style="display:flex;gap:8px;flex-wrap:wrap">'+(low+out>0?'<button class="btn btn-ghost" data-act="restock">'+I.receipt+' '+esc(t('restockBtn'))+'</button>':'')+(tmCanEdit()?'<button class="btn btn-primary" data-act="new-item">'+I.plus+' '+t('newitem')+'</button>':'')+'</span></div>'+
  (S.items.length?
    '<section class="i-hero"><div class="i-h1"><span>'+esc(t('stockval'))+'</span><b>'+fmt(val)+'</b></div><div class="i-h2"><div><b>'+S.items.length+'</b><small>'+esc(t('items'))+'</small></div><div class="'+(low?'w':'')+'"><b>'+low+'</b><small>'+esc(t('low'))+'</small></div><div class="'+(out?'r':'')+'"><b>'+out+'</b><small>'+esc(t('out'))+'</small></div></div></section>'+
    '<div class="row" style="align-items:center;margin-bottom:10px"><div class="field" style="flex:1;margin:0"><label class="sr" for="inv-q">'+esc(t('search'))+'</label><input class="inp" id="inv-q" type="search" enterkeyhint="search" placeholder="'+esc(t('searchInv'))+'" value="'+esc(S.invq)+'" autocomplete="off"></div><button class="btn btn-dark" data-act="inv-scan">'+I.scan+' '+esc(t('scanBtn'))+'</button></div>'+
    '<div class="i-filt" role="group">'+F.map(f=>'<button data-act="inv-f" data-f="'+f[0]+'" aria-pressed="'+((S.invf||'')===f[0])+'">'+esc(t(f[1]))+'<i>'+f[2]+'</i></button>').join('')+'</div>'+
    (cats.length?catChips(cats,S.invcat,'inv-cat'):'')+
    '<div class="inv i-grid" id="invList"></div>'
  :'<div class="card empty"><h3>'+esc(t('noItemsYet'))+'</h3><p>'+esc(t('invEmptyP'))+'</p><div class="btns"><button class="btn btn-primary" data-act="new-item">'+I.plus+' '+esc(t('makeItem'))+'</button><button class="btn btn-ghost" data-act="sample">'+esc(t('addSample'))+'</button></div></div>');
  if(S.items.length){updateInvList();$('#inv-q').addEventListener('input',e=>{S.invq=e.target.value;updateInvList()});
    // USB scanner / type + Enter: meron na → edit, wala pa (mukhang barcode) → bagong item
    $('#inv-q').addEventListener('keydown',e=>{
      if(e.key!=='Enter')return;e.preventDefault();
      const v=e.target.value.trim();if(!v)return;
      const nameHit=S.items.some(i=>i.name.toLowerCase().includes(v.toLowerCase()));
      if(findByCode(v)||(/\d{4,}/.test(v)&&!nameHit)){e.target.value='';S.invq='';onInvCode(v)}
    });
  }
}
// Para saan: i-refresh ang listahan ng items (V24: card na may stock bar, may filter)
function updateInvList(){
  const box=$('#invList');if(!box)return;
  const q=S.invq.trim().toLowerCase(),sn=i=>Number(i.stock)||0,f=S.invf||'';
  const pass=i=>f==='low'?(i.stockOn&&sn(i)>0&&sn(i)<=(Number(i.warn)||0)):f==='out'?(i.stockOn&&sn(i)<=0):f==='exp'?invExpSoon(i):true;
  const list=S.items.filter(i=>pass(i)&&catMatch(i,S.invcat)&&(!q||i.name.toLowerCase().includes(q)||itemCodes(i).some(c=>c.includes(q)))).sort((a,b)=>a.name.localeCompare(b.name));
  box.innerHTML=list.length?list.map((it,ix)=>{
    const pct=it.stockOn?Math.max(4,Math.min(100,Math.round(sn(it)/Math.max(4,(Number(it.warn)||0)*4)*100))):0,lv=!it.stockOn?'':sn(it)<=0?'r':sn(it)<=(Number(it.warn)||0)?'w':'g';
    return '<button class="i-card" style="--i:'+Math.min(ix,12)+'" data-act="edit-item" data-id="'+it.id+'">'+thumb(it)+
    '<div class="i-main"><div class="nm">'+esc(it.name)+'</div><div class="meta">'+(it.category?'<span class="chip tint" style="--h:'+hue(it.category)+'">'+esc(it.category)+'</span>':'')+expChip(it)+'<span class="code">'+(it.barcode?esc(it.barcode):esc(t('noBarcode')))+((it.barcodes&&it.barcodes.length)?' <b class="code-more">+'+it.barcodes.length+'</b>':'')+'</span></div>'+
    (it.stockOn?'<div class="i-bar '+lv+'"><i style="width:'+(sn(it)<=0?0:pct)+'%"></i></div>':'')+'</div>'+
    '<div class="rt"><div class="pr">'+fmt(it.price)+'</div>'+stockChip(it)+'</div></button>'}).join('')
  :'<div class="hint" style="padding:12px 0">'+esc(t('noItemFound'))+'</div>';
}

let form=null;
// Para saan: ADD / EDIT ITEM form
function openProductForm(item,prefill){
  if(!tmNeedEdit())return;   // V1.2.8: ayon sa role ng cashier (team.js)
  if(!item&&vipBlockNew())return;   // V1.1.3: Guest = hanggang 85 items lang
  prefill=prefill||{};
  // V1.1: prefill.copy = Kopya ng ibang item (walang barcode at walang stock, para hindi magkapareho)
  const cp=prefill.copy,it=item||(cp?{id:null,name:cp.name,price:cp.price,barcode:'',barcodes:[],category:cp.category||'',stockOn:!!cp.stockOn,stock:'',warn:cp.warn,img:cp.img||'',expOn:false,exp:'',fav:!!cp.fav}:
    {id:null,name:'',price:'',barcode:prefill.barcode||'',category:'',stockOn:false,stock:'',warn:2,img:'',expOn:false,exp:''});
  form={id:it.id,img:it.img||'',fav:!!it.fav,stockOn:!!it.stockOn,expOn:!!it.expOn,exp:it.exp||'',codes:itemCodes(it).length?itemCodes(it):['']};
  openModal(
  '<div class="sheet-h"><h2>'+esc(it.id?t('editItem'):t('newitem'))+'</h2><button class="icon-btn" data-act="close-modal" aria-label="'+esc(t('close'))+'">'+I.x+'</button></div>'+
  '<form id="pf" class="stack" novalidate>'+
  '<div class="photo-row"><div class="photo" id="pf-photo">'+photoInner()+'</div><div class="btns">'+
    '<button type="button" class="btn btn-ghost" style="min-height:40px" data-act="cam-open">'+I.cam+' '+esc(t('camera'))+'</button>'+
    '<label class="btn btn-ghost" style="min-height:40px">'+I.img+' '+esc(t('gallery'))+'<input type="file" id="pf-gal" accept="image/*" hidden></label></div></div>'+
  '<div class="field"><label for="pf-name">'+esc(t('prodName'))+'</label><input class="inp" id="pf-name" maxlength="60" placeholder="'+esc(t('prodNamePh'))+'" value="'+esc(it.name)+'" autocomplete="off"></div>'+
  '<div class="field"><label for="pf-cat">'+esc(t('category'))+'</label><input class="inp" id="pf-cat" maxlength="30" placeholder="'+esc(t('catPh'))+'" value="'+esc(it.category||'')+'" autocomplete="off"><div class="name-chips" id="pf-cats" style="margin-top:2px"></div></div>'+
  '<div class="field"><label for="pf-price">'+esc(t('priceLbl'))+'</label><input class="inp" id="pf-price" type="number" inputmode="decimal" min="0" step="any" placeholder="0" value="'+esc(it.price)+'"></div>'+
  '<div class="field"><label for="pf-code0">'+esc(t('scBarcode'))+'</label><div id="pf-codes" class="stack" style="gap:8px"></div></div>'+
  '<button type="button" class="switch" id="pf-sw" role="switch" aria-checked="'+form.stockOn+'" data-act="toggle-stock"><span><span class="st" id="pf-sw-t"></span><br><span class="sub" id="pf-sw-s"></span></span><span class="tgl"></span></button>'+
  '<button type="button" class="switch" role="switch" aria-checked="'+form.fav+'" data-act="fav-toggle"><span class="st">★ '+esc(t('favSw'))+'</span><span class="tgl"></span></button>'+
  '<div id="pf-stockbox" class="stack"></div>'+
  '<div class="field"><label>'+esc(t('expiration'))+'</label><div class="seg" role="group"><button type="button" data-act="exp-on" aria-selected="false">'+esc(t('trackExp'))+'</button><button type="button" data-act="exp-off" aria-selected="true">'+esc(t('dontTrack'))+'</button></div><div id="pf-expbox"></div></div>'+
  '<div class="err" id="pf-err" role="alert"></div>'+
  '<div class="sheet-f"><button type="button" class="btn btn-ghost" data-act="close-modal">'+esc(t('cancel'))+'</button><button type="button" class="btn btn-primary" data-act="pf-save" data-enter>'+esc(t('save'))+'</button></div>'+
  (it.id?'<button type="button" class="btn btn-ghost btn-block" style="margin-top:10px" data-act="dup-item" data-id="'+esc(it.id)+'">'+I.layers+' '+esc(t('dupItem'))+'</button><button type="button" class="btn btn-danger btn-block" style="margin-top:10px" data-act="del-ask">'+I.trash+' '+esc(t('delItem'))+'</button><div class="confirm-row" id="pf-confirm"><span>'+esc(t('areYouSure'))+'</span><span class="row"><button type="button" class="btn btn-ghost" style="min-height:38px" data-act="del-no">'+esc(t('dont'))+'</button><button type="button" class="btn btn-dark" style="min-height:38px" data-act="del-yes">'+esc(t('yesDel'))+'</button></span></div>':'')+
  '</form>');
  form.stockVal=it.stock;form.warnVal=it.warn;
  drawStockBox();drawCatChips();drawExpBox();drawCodes();
  $('#pf-cat').addEventListener('input',drawCatChips);
  $('#pf-gal').addEventListener('change',onPhoto);
  if(!it.id)setTimeout(()=>{const n=$('#pf-name');if(n){n.focus();if(cp)n.select()}},60);
}
// Para saan: mga category sa form
function drawCatChips(){
  const cur=($('#pf-cat').value||'').trim().toLowerCase();
  const list=Array.from(new Set(allCats().concat(defaultCats())));
  $('#pf-cats').innerHTML=list.map(c=>'<button type="button" class="chip tint" style="--h:'+hue(c)+';border:0;height:32px;padding:0 12px;'+(c.toLowerCase()===cur?'outline:2px solid var(--ink);':'')+'" data-act="pick-cat" data-c="'+esc(c)+'">'+esc(c)+'</button>').join('');
}
// Para saan: larawan sa form
function photoInner(){return form.img?'<img alt="'+esc(t('productPhoto'))+'" src="'+esc(form.img)+'">':I.cam}
// Para saan: ON/OFF at dami ng stock sa form
function drawStockBox(){
  const on=form.stockOn;
  $('#pf-sw').setAttribute('aria-checked',on);
  $('#pf-sw-t').textContent=on?t('stockOnL'):t('stockOffL');
  $('#pf-sw-s').textContent=on?t('stockOnSub'):t('stockOffSub');
  const b=$('#pf-stockbox');
  if(on){
    b.innerHTML='<div class="row"><div class="field" style="flex:1.3"><label for="pf-stock">'+esc(t('stockQty'))+'</label><div class="stk"><button type="button" class="stk-b" data-act="stk-dec" aria-label="'+esc(t('stkDec'))+'" title="'+esc(t('stkDec'))+'"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button><input class="inp" id="pf-stock" type="number" inputmode="numeric" min="0" step="1" placeholder="'+esc(t('eg5'))+'" value="'+esc(form.stockVal)+'"><button type="button" class="stk-b up" data-act="stk-inc" aria-label="'+esc(t('stkInc'))+'" title="'+esc(t('stkInc'))+'"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg></button></div></div>'+
    '<div class="field" style="flex:1"><label for="pf-warn">'+esc(t('warnWhen'))+'</label><input class="inp" id="pf-warn" type="number" inputmode="numeric" min="0" step="1" placeholder="'+esc(t('eg2'))+'" value="'+esc(form.warnVal)+'"></div></div>'+
    '<div class="hint">'+esc(t('warnHint'))+'</div>';
    $('#pf-stock').addEventListener('input',e=>{form.stockVal=e.target.value});
    $('#pf-warn').addEventListener('input',e=>{form.warnVal=e.target.value});
  }else b.innerHTML='';
}
// Para saan: pumili ng larawan mula Gallery
async function onPhoto(e){
  const f=e.target.files&&e.target.files[0];if(!f)return;
  e.target.value='';fileToCrop(f);
}
// Para saan: paliitin ang larawan
function resizeImage(file,max){
  max=max||360;
  return new Promise((res,rej)=>{
    const url=URL.createObjectURL(file),im=new Image();
    im.onload=()=>{
      const r=Math.min(1,max/Math.max(im.width,im.height));
      const c=document.createElement('canvas');c.width=Math.round(im.width*r);c.height=Math.round(im.height*r);
      c.getContext('2d').drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(url);res(c.toDataURL('image/jpeg',.78));
    };
    im.onerror=()=>{URL.revokeObjectURL(url);rej()};im.src=url;
  });
}
// Para saan: i-save ang item (bago o edit)
function saveProduct(){
  const err=$('#pf-err');err.textContent='';
  const name=$('#pf-name').value.trim();
  const price=parseFloat($('#pf-price').value);
  const codes=[];form.codes.forEach(c=>{c=String(c).trim();if(c&&!codes.some(x=>norm(x)===norm(c)))codes.push(c)});
  const barcode=codes[0]||'',barcodes=codes.slice(1);
  let category=$('#pf-cat').value.trim();
  const same=allCats().find(c=>c.toLowerCase()===category.toLowerCase());if(same)category=same;
  if(!name){err.textContent=t('errName');$('#pf-name').focus();return}
  if(isNaN(price)||price<0){err.textContent=t('errPrice');$('#pf-price').focus();return}
  for(const c of codes){
    const dup=S.items.find(i=>i.id!==form.id&&hasCode(i,c));
    if(dup){
      if(!form.id){toast(t('alreadyHave',dup.name),{img:dup.img,sub:t('justEdit')});openProductForm(dup);return}
      err.textContent=t('codeUsed',dup.name);return}
  }
  let stock=0,warn=0;
  if(form.stockOn){
    stock=parseInt(form.stockVal,10);warn=(form.warnVal===''||form.warnVal==null)?2:parseInt(form.warnVal,10);
    if(isNaN(stock)||stock<0){err.textContent=t('errStockQty');return}
    if(isNaN(warn)||warn<0){err.textContent=t('errWarnQty');return}
  }
  if(form.expOn&&!form.exp){err.textContent=t('errExpDate');return}
  if(!form.id&&vipBlockNew())return;
  const rec={id:form.id||uid(),name,price:r2(price),barcode,barcodes,category,stockOn:form.stockOn,stock,warn,img:form.img,fav:form.fav,expOn:form.expOn,exp:form.expOn?form.exp:'',uts:Date.now()};   // V1.2.8: uts = kailan huling na-edit (para sa sabayang pag-edit ng iba't ibang device/cashier)
  const wasEdit=!!form.id;
  if(wasEdit){const i=S.items.findIndex(x=>x.id===form.id);S.items[i]=Object.assign({},S.items[i],rec)}
  else S.items.push(rec);
  tmItemSaved(rec,wasEdit);   // V1.2.8: kung cashier, ipapadala sa may-ari at itatala
  save();closeModal();
  toast(wasEdit?t('updatedN',name):t('savedN',name),{img:rec.img});
  if(!wasEdit)vipAfterSave();
  if(S.tab==='inv')renderInv();else updateSell();
}
// Para saan: burahin ang item
function deleteProduct(){
  const id=form.id;
  if(!tmNeedEdit())return;
  tmItemDeleted(byId(id));   // V1.2.8
  S.items=S.items.filter(i=>i.id!==id);S.cart=S.cart.filter(l=>l.id!==id);
  save();closeModal();toast(t('itemDeleted'));
  if(S.tab==='inv')renderInv();else updateSell();
}
// Para saan: maglagay ng sample items
function addSamples(){
  if(!tmNeedEdit())return;
  const s=[
    ['Pancit Canton (Chili Mansi)',17,'4800000000017','Noodles',true,12,3],
    ['Kape 3-in-1 (sachet)',8,'4800000000024','Inumin',true,3,3],
    ['Tubig 500ml',15,'4800000000031','Inumin',false,0,0],
    ['Itlog (isa)',10,'4800000000048','Pang-ulam',true,30,6]
  ];
  if(vipLimitHit(s.length)){const room=VIP_MAX-S.items.length;if(room<=0){vipUpsell();return}s.length=room}
  s.forEach(a=>S.items.push({id:uid(),name:a[0],price:a[1],barcode:a[2],category:a[3],stockOn:a[4],stock:a[5],warn:a[6],img:'',uts:Date.now()}));
  save();renderInv();toast(t('samplesAdded'),{sub:t('samplesSub')});
}

// Para saan: chip ng expiry
function expChip(it){
  if(!it.expOn||!it.exp)return '';
  const d=Math.round((new Date(it.exp+'T00:00:00').getTime()-dayStart())/864e5);
  return d<0?'<span class="chip bad">'+esc(t('expired'))+'</span>':d===0?'<span class="chip warn">'+esc(t('expToday'))+'</span>':d<=7?'<span class="chip warn">'+esc(t('expInDays',d))+'</span>':'<span class="chip">'+esc(t('expOn',it.exp))+'</span>';
}
// Para saan: expiry date sa form
function drawExpBox(){
  const on=form.expOn;
  document.querySelectorAll('[data-act="exp-on"],[data-act="exp-off"]').forEach(b=>b.setAttribute('aria-selected',String((b.dataset.act==='exp-on')===on)));
  const b=$('#pf-expbox');if(!b)return;
  b.innerHTML=on?'<div class="field" style="margin-top:10px"><label for="pf-exp">'+esc(t('pickDate'))+'</label><input class="inp" id="pf-exp" type="date" value="'+esc(form.exp)+'"></div>':'';
  if(on)$('#pf-exp').addEventListener('input',e=>{form.exp=e.target.value});
}

/* Hanapin ang item gamit ang barcode (hindi alintana ang 0 sa unahan) */
// Para saan: hanapin ang item gamit ang barcode
function findByCode(code){const n=norm(code);return n?S.items.find(i=>hasCode(i,n))||null:null}

/* Resulta ng scan sa Inventory:
   - meron na ang item  -> buksan para i-edit
   - wala pa            -> Bagong item na naka-fill na ang barcode
   - cashier            -> tingnan lang ang presyo/stock (admin lang ang nag-eedit) */
// Para saan: SCAN SA INVENTORY: meron = edit, wala = bagong item
function onInvCode(code){
  code=String(code).trim();if(!code)return;
  const it=findByCode(code);
  if(!tmCanEdit()){
    if(it)toast(it.name,{img:it.img,sub:fmt(it.price)+(it.stockOn?' · '+t('stockN',Number(it.stock)||0):'')});
    else{sfx('error');buzz(BUZZ_ERR);toast(t('noItemBarcode',code),{kind:'err',sub:t('noperm')})}
    return;
  }
  if(it){toast(t('found',it.name),{img:it.img,sub:t('justEdit')});openProductForm(it)}
  else{toast(t('newBarcodeN',code),{sub:t('makeNewItem')});openProductForm(null,{barcode:code})}
}

/* Scan sa loob ng form: kapag meron na ang barcode, lilipat sa edit ng item na iyon */
// Para saan: scan sa loob ng form
function scanIntoForm(ix){
  ix=ix|0;
  openScanner({title:t('scInvTitle'),continuous:false,onCode:code=>{
    const ex=findByCode(code);
    if(ex&&ex.id!==form.id){toast(t('alreadyN',ex.name),{img:ex.img,sub:t('justEdit')});openProductForm(ex);return}
    if(form.codes.some((c,k)=>k!==ix&&norm(c)===norm(code))){toast(t('codeSame'),{kind:'warn'});return}
    form.codes[ix]=String(code).trim();drawCodes();toast(t('barcodeN',code),{ms:1500});
  }});
}
// V1.1: ang listahan ng barcode sa form: isa o higit pa. Kapag may laman na ang huli, may "Dagdag na barcode".
function drawCodes(){
  const b=$('#pf-codes');if(!b)return;
  const L=form.codes,last=String(L[L.length-1]||'').trim();
  b.innerHTML=L.map((c,i)=>'<div class="row code-row"><input class="inp mono" id="pf-code'+i+'" data-ci="'+i+'" placeholder="'+esc(i?t('moreCodePh'):t('typeOrScan'))+'" autocomplete="off" value="'+esc(c)+'">'+
    '<button type="button" class="btn btn-dark" data-act="scan-form" data-i="'+i+'" aria-label="'+esc(t('scanBtn'))+'">'+I.scan+'</button>'+
    (L.length>1?'<button type="button" class="btn btn-ghost code-x" data-act="code-del" data-i="'+i+'" aria-label="'+esc(t('close'))+'">'+I.x+'</button>':'')+'</div>').join('')+
    (last?'<button type="button" class="btn btn-ghost code-add" data-act="code-add">'+I.plus+' '+esc(t('addCode'))+'</button>':'');
  b.querySelectorAll('[data-ci]').forEach(inp=>inp.addEventListener('input',e=>{
    form.codes[+inp.dataset.ci]=e.target.value;
    // lumabas/mawala ang "Dagdag na barcode" habang nagta-type sa huling kahon
    const ad=b.querySelector('.code-add'),has=String(form.codes[form.codes.length-1]||'').trim();
    if(has&&!ad)drawCodesKeep(inp);else if(!has&&ad)ad.remove();
  }));
}
// Para saan: iguhit ulit ang listahan pero panatilihin ang cursor sa kahong tinatayp-an
function drawCodesKeep(inp){
  const i=inp.dataset.ci,pos=inp.selectionStart;drawCodes();
  const n=$('#pf-code'+i);if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(e){}}
}

Object.assign(ACTIONS,{
  'inv-scan':()=>{openScanner({title:t('scanItemTitle'),continuous:false,onCode:onInvCode})},
  'scan-form':b=>{scanIntoForm(b&&b.dataset?b.dataset.i:0)},
  'dup-item':b=>{const s=byId(b.dataset.id);if(!s||!tmCanEdit())return;openProductForm(null,{copy:s});toast(t('dupMade'),{sub:t('dupMadeSub'),ms:2600})},
  'code-add':()=>{if(!form)return;form.codes.push('');drawCodes();const n=$('#pf-code'+(form.codes.length-1));if(n)n.focus()},
  'code-del':b=>{if(!form)return;form.codes.splice(+b.dataset.i,1);if(!form.codes.length)form.codes=[''];drawCodes()}
});
