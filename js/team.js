'use strict';
/* ============================================================
   ITO PARA SA ROLE, GINAGAWA, CART AT LEAVE NG MGA CASHIER   [team.js]   V1.2.8
   1) ROLE: itinatakda ng may-ari ang bawat cashier: cashier (benta lang), all (lahat), view (tingin lang), edit (edit item + scanner lang).
   2) KASAYSAYAN: ang ginagawa ng cashier (cart, benta, gawa/edit/bura ng item) ay napupunta sa may-ari.
   3) LIVE CART: nakikita ng may-ari ang laman ng cart ng bawat cashier (pindutin ang cart na button sa Sell).
   4) LEAVE: umaalis ang cashier sa tindahan ng may-ari (hindi lang logout).
   Online na bahagi nito ay dumadaan sa shop.js (box ng cashier).
   ============================================================ */

const TM={carts:{},lastTs:0,ct:0,pt:0,lastCart:'',flt:''};
const TM_ROLES=['cashier','all','view','edit'];

/* ---------- ROLE ---------- */
// Para saan: anong role ngayon? 'owner' kung may-ari; kung cashier: cashier / all / view / edit
function tmRoleOf(){
  if(S.role!=='cashier')return 'owner';
  const c=cashData(S.user).list.find(x=>x.id===S.cid);
  return TM_ROLES.includes(c&&c.role)?c.role:'cashier';
}
// Para saan: pwede bang mag-benta (cart, bayad, utang)?
const tmCanSell=()=>{const r=tmRoleOf();return r==='owner'||r==='cashier'||r==='all'};
// Para saan: pwede bang mag-edit / gumawa / magbura ng item (at gamitin ang scanner sa Inventory para dito)?
const tmCanEdit=()=>{const r=tmRoleOf();return r==='owner'||r==='all'||r==='edit'};
// Para saan: pangalan ng role na nababasa ng tao
const tmRoleLabel=r=>t('tmR_'+(TM_ROLES.includes(r)?r:'cashier'));
// Para saan: ilagay sa header sa tabi ng pangalan ng tindahan ("Cashier" o "Cashier · All Access")
const tmHeadRole=()=>{const r=tmRoleOf();return r==='cashier'||r==='owner'?t('cashier'):t('cashier')+' · '+tmRoleLabel(r)};
// Para saan: harang kapag hindi pwedeng mag-benta (ibinabalik ang true kung pwede)
function tmNeedSell(){
  if(tmCanSell())return true;
  sfx('error');buzz(BUZZ_ERR);toast(t('tmNoSell',tmRoleLabel(tmRoleOf())),{kind:'err'});return false;
}
// Para saan: harang kapag hindi pwedeng mag-edit ng item (ibinabalik ang true kung pwede)
function tmNeedEdit(){
  if(tmCanEdit())return true;
  sfx('error');buzz(BUZZ_ERR);toast(t('tmNoEdit',tmRoleLabel(tmRoleOf())),{kind:'err'});return false;
}
// Para saan: {id:role} ng lahat ng cashier (inilalagay ng may-ari sa online na tindahan para malaman ng cashier ang role niya)
function tmRolesMap(){const m={};cashData(S.user).list.forEach(c=>{m[c.id]=TM_ROLES.includes(c.role)?c.role:'cashier'});return m}
// Para saan: CASHIER: kunin ang role mula sa tindahan ng may-ari
function tmApplyRoles(doc){
  if(S.role!=='cashier')return;
  const d=cashData(S.user),c=d.list.find(x=>x.id===S.cid);if(!c)return;
  const nr=TM_ROLES.includes((doc.roles||{})[S.cid])?doc.roles[S.cid]:'cashier',was=TM_ROLES.includes(c.role)?c.role:'cashier';
  if(c.role===nr)return;
  c.role=nr;cashSave(S.user,d);
  const l=document.querySelector('.logo small');if(l)l.innerHTML=esc(S.store)+' · '+esc(tmHeadRole())+'<span id="net"></span>';
  if(nr!==was)toast(t('tmRoleNow',tmRoleLabel(nr)),{ms:4200});
}
// Para saan: MAY-ARI: ilagay ang role ng isang cashier
function tmRoleSet(id,r){
  if(S.role==='cashier'||!TM_ROLES.includes(r))return;
  const d=cashData(S.user),c=d.list.find(x=>x.id===id);if(!c)return;
  c.role=r;cashSave(S.user,d);
  toast(t('tmRoleSaved',c.name,tmRoleLabel(r)),{ms:2600});sfx('success');
  if(typeof shopPublish==='function')shopPublish(true);   // maipadala agad sa cashier
  openCashierPage();
}
// Para saan: MAY-ARI: pumili ng role para sa cashier
function tmRolePick(id){
  const d=cashData(S.user),c=d.list.find(x=>x.id===id);if(!c)return;
  const cur=TM_ROLES.includes(c.role)?c.role:'cashier';
  openModal(pgHead(t('tmRoleT',c.name))+'<div class="stack">'+TM_ROLES.map(r=>
    '<button type="button" class="tm-role'+(r===cur?' on':'')+'" data-act="tm-role-set" data-id="'+esc(id)+'" data-r="'+r+'" aria-pressed="'+(r===cur)+'"><b>'+esc(tmRoleLabel(r))+'</b><span>'+esc(t('tmRD_'+r))+'</span></button>').join('')+'</div>'+
    '<div class="sheet-f"><button class="btn btn-ghost" style="flex:1" data-act="page" data-p="cashier">'+esc(t('back'))+'</button></div>');
}

/* ---------- PILA NG IPADADALA NG CASHIER (item na binago + tala ng ginawa) ---------- */
// Para saan: lalagyan sa phone ng cashier ng mga hindi pa natatanggap ng may-ari
const K_TMQ=s=>'tindamo:tmq:'+s;
const tmqGet=()=>{const o=readJSON(K_TMQ(shSess()),{});return {items:o.items||{},del:o.del||{},log:o.log||[]}};
const tmqSave=q=>store.set(K_TMQ(shSess()),JSON.stringify(q));
// Para saan: may naghihintay pa bang ipadala (hindi pa tanggap ng may-ari)?
const tmPending=()=>{if(S.role!=='cashier')return false;const q=tmqGet();return Object.keys(q.items).length>0||Object.keys(q.del).length>0||q.log.length>0};
// Para saan: bagong ts na laging mas mataas sa nauna (para maayos ang pagkakasunod)
const tmNow=()=>{TM.lastTs=Math.max(Date.now(),TM.lastTs+1);return TM.lastTs};
// Para saan: CASHIER: itala ang ginawa (k = add, dec, rm, clr, sale, inew, iedit, idel)
function tmLog(k,o){
  if(S.role!=='cashier')return;
  const q=tmqGet(),c=cashData(S.user).list.find(x=>x.id===S.cid);
  q.log.push(Object.assign({id:uid(),ts:tmNow(),k,c:c?c.name:''},o||{}));
  if(q.log.length>300)q.log=q.log.slice(-300);
  tmqSave(q);tmPushSoon();
}
// Para saan: ipadala sa may-ari pagkalipas ng ilang segundo (para hindi bawat pindot ay may upload)
function tmPushSoon(){clearTimeout(TM.pt);TM.pt=setTimeout(()=>{if(typeof shopPushBox==='function')shopPushBox()},3500)}
// Para saan: CASHIER: na-save ang item (bago o edit) -> ipadala sa may-ari
function tmItemSaved(rec,wasEdit){
  if(S.role!=='cashier')return;
  const q=tmqGet(),c=Object.assign({},rec);
  if(c.img)c.ih=ihash(c.img);
  q.items[c.id]=c;delete q.del[c.id];tmqSave(q);
  tmLog(wasEdit?'iedit':'inew',{n:rec.name});
}
// Para saan: CASHIER: binura ang item
function tmItemDeleted(it){
  if(S.role!=='cashier'||!it)return;
  const q=tmqGet();delete q.items[it.id];q.del[it.id]=tmNow();tmqSave(q);
  tmLog('idel',{n:it.name});
}
// Para saan: tapos ang benta: itala (cashier) at ayusin ang stock ng item na naghihintay sa pila
function tmSaleDone(sale,lines){
  if(S.role!=='cashier')return;
  const q=tmqGet();let ch=false;
  lines.forEach(l=>{const r=q.items[l.id];if(r&&r.stockOn){r.stock=Math.max(0,(Number(r.stock)||0)-l.qty);ch=true}});
  if(ch)tmqSave(q);
  tmLog('sale',{a:sale.total,m:sale.method,n:lines.map(l=>l.name+' ×'+l.qty).join(', ').slice(0,120)});
}
// Para saan: CASHIER: basahin sa online kung hanggang saan na ang natanggap ng may-ari (lack) at alisin ang natanggap na
async function tmReadAck(){
  try{
    const d=await clDb('/shops/'+shShopUid()+'/box/'+CL.uid),la=gInt((d.fields||{}).lack);
    if(!la)return;
    const q=tmqGet();let ch=false;
    Object.keys(q.items).forEach(k=>{if((q.items[k].uts||0)<=la){delete q.items[k];ch=true}});
    Object.keys(q.del).forEach(k=>{if(q.del[k]<=la){delete q.del[k];ch=true}});
    const n=q.log.length;q.log=q.log.filter(x=>x.ts>la);if(q.log.length!==n)ch=true;
    if(ch)tmqSave(q);
  }catch(e){}
}
// Para saan: CASHIER: huwag mawala sa screen ang item na binago ng cashier pero hindi pa nababasa ng may-ari
function tmOverlay(){
  if(S.role!=='cashier')return;
  const q=tmqGet();
  Object.keys(q.items).forEach(id=>{
    const r=q.items[id],i=S.items.findIndex(x=>x.id===id);
    if(i<0)S.items.push(Object.assign({},r));
    else if((r.uts||0)>(S.items[i].uts||0))S.items[i]=Object.assign({},S.items[i],r);
  });
  Object.keys(q.del).forEach(id=>{S.items=S.items.filter(x=>x.id!==id)});
}

/* ---------- MAY-ARI: tanggapin ang galing sa cashier ---------- */
const K_CLOG=u=>'tindamo:clog:'+u;
const tmLogs=()=>S.user?readJSON(K_CLOG(S.user),[]):[];
// Para saan: pagsamahin ang listahan ng tala (walang doble ang id). Hindi nag-a-upload ng backup dahil madalas ito.
function tmMergeLogs(u,list){
  if(!list||!list.length)return 0;
  const cur=readJSON(K_CLOG(u),[]),have=new Set(cur.map(x=>x.id)),add=list.filter(x=>x&&x.id&&!have.has(x.id));
  if(!add.length)return 0;
  store.set(K_CLOG(u),JSON.stringify(add.concat(cur).sort((a,b)=>b.ts-a.ts).slice(0,600)));
  return add.length;
}
const tmLogAdd=list=>tmMergeLogs(S.user,list);
// Para saan: pagsamahin ang listahan ng cashier galing sa kabilang device ng may-ari (role, pangalan, bagong cashier). Ang online/lokasyon ay sa device na ito.
function tmMergeCash(u,inc,docTs){
  const cd=cashData(u),loc={};cd.list.forEach(x=>{loc[x.id]=x});
  const list=(inc.list||[]).map(x=>{const l=loc[x.id];return l?Object.assign({},x,{seen:l.seen,loc:l.loc,av:l.av}):x});
  cd.list.forEach(x=>{if(!list.some(y=>y.id===x.id)&&(x.at||0)>docTs)list.push(x)});   // bagong cashier dito na hindi pa umaabot sa cloud
  cd.list=list;if(typeof inc.open==='boolean')cd.open=inc.open;
  store.set(K_CASH(u),JSON.stringify(cd));   // direkta: hindi na mag-a-upload ulit
}
// Para saan: ilapat ang item na ginawa/in-edit/binura ng cashier (kung pinapayagan ng role niya). Ibinabalik ang bilang ng nabago.
function tmApplyItems(cu,p){
  const c=cashData(S.user).list.find(x=>x.id===cu),r=c&&TM_ROLES.includes(c.role)?c.role:'cashier';
  if(r!=='all'&&r!=='edit')return 0;
  let ch=0;
  (p.items||[]).forEach(x=>{
    if(!x||!x.id||!x.name)return;
    const i=S.items.findIndex(y=>y.id===x.id);
    if(i<0){if(typeof vipLimitHit==='function'&&vipLimitHit(1))return;S.items.push(x);ch++}   // kung abot na ng Guest ang limit ng item, hindi isasama
    else if((x.uts||0)>(S.items[i].uts||0)){S.items[i]=Object.assign({},S.items[i],x);ch++}
  });
  (p.idel||[]).forEach(d=>{
    const x=S.items.find(i=>i.id===d.id);
    if(x&&(d.ts||0)>(x.uts||0)){S.items=S.items.filter(i=>i.id!==d.id);S.cart=S.cart.filter(l=>l.id!==d.id);ch++}
  });
  return ch;
}
// Para saan: ipaalam sa cashier na natanggap na (lack = pinakahuling ts na natanggap)
function tmAckBox(cu,p){
  const pts=Number(p.pts)||0;if(!pts)return;
  shPatch('/shops/'+CL.uid+'/box/'+cu,{lack:fInt(pts)}).catch(()=>{});
}
// Para saan: nag-Leave ang cashier: alisin sa listahan, burahin ang online na bahagi niya at ipaalam
function tmCashLeft(cu,c,cd){
  const name=c?c.name:'Cashier';
  cd.list=cd.list.filter(x=>x.id!==cu);cashSave(S.user,cd);
  delete TM.carts[cu];
  if(typeof shRemoveCashier==='function')shRemoveCashier(cu);
  tmLogAdd([{id:uid(),ts:Date.now(),k:'leave',c:name}]);
  toast(t('tmCashLeft',name),{kind:'warn',ms:4500});sfx('success');
  appNotify(t('tmLeaveNotifT'),t('tmCashLeft',name),'left-'+cu);
  if($('#cash-list'))drawCash();
  if(typeof shopPublish==='function')shopPublish(true);
}

/* ---------- LIVE CART (cashier -> may-ari) ---------- */
// Para saan: CASHIER: ipadala ang laman ng cart pagkalipas ng sandali (kapag nagbago lang)
function tmCartSoon(){
  if(S.role!=='cashier')return;
  clearTimeout(TM.ct);TM.ct=setTimeout(tmCartPush,1200);
}
async function tmCartPush(){
  if(S.role!=='cashier'||!shCashOk())return;
  const L=cartLines().map(x=>({n:x.it.name,q:x.l.qty,p:x.it.price}));
  const js=L.length?JSON.stringify({l:L.slice(0,40),t:cartTotal()}):'';
  if(js===(TM.lastCart||''))return;
  try{await shPatch('/shops/'+shShopUid()+'/box/'+CL.uid,{cart:fStr(js),cts:fInt(Date.now()),seen:fInt(Date.now())});TM.lastCart=js}catch(e){}
}
// Para saan: MAY-ARI: basahin ang cart na galing sa cashier
function tmParseCart(s){try{const o=s?JSON.parse(s):null;return o&&Array.isArray(o.l)?{l:o.l,t:Number(o.t)||0}:null}catch(e){return null}}

/* ---------- MAY-ARI: ANG GINAGAWA NG MGA CASHIER (pindutin ang cart na button sa Sell) ---------- */
// Para saan: ang button na cart (nasa header ng Cart sa Sell) para sa may-ari lang
function tmCartBtn(){
  if(S.role==='cashier'||!cashData(S.user).list.length)return '';
  const n=cashData(S.user).list.filter(c=>{const x=TM.carts[c.id];return x&&x.lines&&x.lines.l.length&&Date.now()-x.ts<15*60000}).length;
  return '<button type="button" class="cart-team" data-act="team-open" aria-label="'+esc(t('tmOpen'))+'" title="'+esc(t('tmOpen'))+'">'+I.cart+(n?'<em>'+n+'</em>':'')+'</button>';
}
// Para saan: oras na madaling basahin ("5 min nakaraan")
function tmAgo(ts){
  const s=Math.max(0,Math.round((Date.now()-ts)/1000));
  return s<10?t('tmNow'):s<60?t('tmSecAgo',s):s<3600?t('tmMinAgo',Math.round(s/60)):dstr(ts);
}
// Para saan: isang linya ng kasaysayan
function tmEventText(e){
  const m={add:'tmE_add',dec:'tmE_dec',rm:'tmE_rm',clr:'tmE_clr',sale:'tmE_sale',inew:'tmE_inew',iedit:'tmE_iedit',idel:'tmE_idel',join:'tmE_join',leave:'tmE_leave'}[e.k];
  if(!m)return '';
  const pay=e.m==='gcash'?'GCash':e.m==='utang'?t('utang'):t('payCash');
  return t(m,e.n||'',e.q==null?'':e.q,e.a==null?'':fmt(Number(e.a)||0),pay);
}
// Para saan: buksan ang pahina ng ginagawa ng mga cashier
function tmOpen(){
  if(S.role==='cashier')return;
  openModal(pgHead(t('tmT'))+'<div id="tm-box"></div>');
  tmDraw();
}
// Para saan: iguhit ang pahina (tinatawag ulit kapag may bagong dumating)
function tmDraw(){
  const box=$('#tm-box');if(!box)return;
  const cd=cashData(S.user),now=Date.now(),logs=tmLogs();
  if(TM.flt&&!cd.list.some(c=>c.name===TM.flt))TM.flt='';
  const carts=cd.list.map(c=>{
    const on=c.seen&&now-c.seen<40000,x=TM.carts[c.id],cart=x&&x.lines&&x.lines.l.length&&now-x.ts<15*60000?x:null;
    return '<div class="tm-card"><div class="tm-h"><b>'+esc(c.name)+'</b><span class="chip '+(on?'ok':'')+'">'+(on?'● '+esc(t('online')):esc(t('offline')))+'</span><span class="chip">'+esc(tmRoleLabel(c.role))+'</span></div>'+
      (cart?'<div class="tm-lines">'+cart.lines.l.map(l=>'<div class="tm-ln"><span>'+esc(l.n)+' ×'+esc(l.q)+'</span><b>'+fmt(r2((Number(l.q)||0)*(Number(l.p)||0)))+'</b></div>').join('')+'</div><div class="tm-tot"><span>'+esc(t('total'))+'</span><b>'+fmt(cart.lines.t)+'</b></div><div class="hint">'+esc(t('tmUpd',tmAgo(cart.ts)))+'</div>'
        :'<div class="hint">'+esc(t('tmNoCart'))+'</div>')+'</div>';
  }).join('');
  const shown=logs.filter(e=>!TM.flt||e.c===TM.flt).slice(0,80);
  const chips='<div class="cats" role="group"><button class="cat" data-act="tm-flt" data-n="" aria-pressed="'+(!TM.flt)+'">'+esc(t('all'))+'</button>'+cd.list.map(c=>'<button class="cat" data-act="tm-flt" data-n="'+esc(c.name)+'" aria-pressed="'+(TM.flt===c.name)+'">'+esc(c.name)+'</button>').join('')+'</div>';
  const keep=box.querySelector('.tm-feed'),st=keep?keep.scrollTop:0;
  box.innerHTML=(cd.list.length?'<div class="set-sec"><span class="lbl">'+esc(t('tmCartNow'))+'</span>'+carts+'</div>':'<div class="hint" style="padding:12px 0">'+esc(t('nocash'))+'</div>')+
    '<div class="set-sec"><span class="lbl">'+esc(t('tmHist'))+'</span>'+(cd.list.length?chips:'')+
    '<div class="tm-feed">'+(shown.length?shown.map(e=>'<div class="tm-ev k-'+esc(e.k)+'"><div class="tm-et"><b>'+esc(e.c||'')+'</b><span>'+esc(dstr(e.ts))+'</span></div><div class="tm-etx">'+esc(tmEventText(e))+'</div></div>').join(''):'<div class="hint" style="padding:10px 0">'+esc(t('tmNoHist'))+'</div>')+'</div></div>';
  const f=box.querySelector('.tm-feed');if(f)f.scrollTop=st;
}

/* ---------- LEAVE (cashier umaalis sa tindahan ng may-ari) ---------- */
// Para saan: tanong bago mag-Leave (sinasabi kung may hindi pa naipapadala)
function tmLeaveAsk(){
  if(S.role!=='cashier')return;
  const ack=shAck(),q=tmqGet(),un=S.sales.filter(s=>!ack.s.has(s.id)).length+S.debts.filter(d=>!ack.d.has(d.id)).length+Object.keys(q.items).length+Object.keys(q.del).length;
  confirmBox(esc(t('tmLeaveQ',S.store)),esc(t('tmLeaveP'))+(un?'<br><b>'+esc(t('tmLeaveUnsent',un))+'</b>':''),'leave-yes',esc(t('tmLeave')));
}
// Para saan: umalis: ipadala muna ang natitira, ipaalam sa may-ari, burahin ang kopya ng tindahan sa phone na ito, at bumalik sa login
async function tmLeave(){
  if(S.role!=='cashier')return;
  if(!navigator.onLine||!shCashOk()){toast(t('tmLeaveNet'),{kind:'err',ms:3500});return}
  const sess=shSess(),ou=shShopUid(),cu=CL.uid,owner=S.user,cid=S.cid,storeName=S.store;
  closeModal();toast(t('tmLeaving'),{ms:2500});
  try{
    await Promise.race([shopPushBox(),shSleep(7000)]);                                   // ipadala muna ang natitirang benta / item
    await shPatch('/shops/'+ou+'/box/'+cu,{left:fInt(Date.now()),seen:fInt(0),cart:fStr('')});   // ito ang nagsasabi sa may-ari na umalis ka
    try{await clDb('/shops/'+ou+'/members/'+cu,{method:'DELETE'})}catch(e){}              // kung pinapayagan ng rules; kung hindi, ang may-ari ang magbubura
  }catch(e){toast(t('errCloud',e.message||e),{kind:'err',ms:4000});return}
  const users=readJSON(K_USERS,{});
  recSave(recList().filter(x=>x.s!==sess));
  clForget(sess);
  ['tindamo:ack:','tindamo:shopts:','tindamo:tmq:'].forEach(k=>store.del(k+sess));
  store.del(K_HOLD(owner));
  if(users[owner]&&users[owner].mirror){   // kopya lang ng tindahan ito sa phone ng cashier: burahin lahat
    delete users[owner];store.set(K_USERS,JSON.stringify(users));
    store.del(K_DATA(owner));store.del(K_CASH(owner));store.del(K_GC(owner));
  }else{const cd=cashData(owner);cd.list=cd.list.filter(x=>x.id!==cid);cashSave(owner,cd)}
  SH.status='idle';TM.lastCart='';
  logout();
  toast(t('tmLeft',storeName),{ms:4200});
}

Object.assign(ACTIONS,{
  'team-open':()=>{tmOpen()},
  'tm-flt':b=>{TM.flt=b.dataset.n||'';tmDraw()},
  'tm-role':b=>{tmRolePick(b.dataset.id)},
  'tm-role-set':b=>{tmRoleSet(b.dataset.id,b.dataset.r)},
  'leave-ask':()=>{tmLeaveAsk()},
  'leave-yes':()=>{tmLeave()}
});

/* ---------- mga salita (Filipino, English; ang iba ay English muna) ---------- */
const tmW=(f,e)=>[f,e,e,e,e];
Object.assign(D,{
tmR_cashier:tmW('Cashier (benta lang)','Cashier (sales only)'),
tmR_all:tmW('All Access','All Access'),
tmR_view:tmW('View lang','View only'),
tmR_edit:tmW('Edit at Scanner lang','Edit and Scanner only'),
tmRD_cashier:tmW('Nagbebenta lang: cart, bayad, utang. Hindi pwedeng mag-edit ng item.','Sales only: cart, pay, utang. Cannot edit items.'),
tmRD_all:tmW('Lahat: nagbebenta at pwedeng gumawa, mag-edit at magbura ng item, kasama ang scanner.','Everything: sells, and can create, edit and delete items, scanner included.'),
tmRD_view:tmW('Nagtitingin lang: nakikita ang items, utang at benta pero hindi makakabenta o makakapag-edit.','Look only: can see items, utang and sales but cannot sell or edit.'),
tmRD_edit:tmW('Pwedeng gumawa at mag-edit ng item at gamitin ang scanner sa Inventory, pero hindi makakabenta.','Can create and edit items and use the Inventory scanner, but cannot sell.'),
tmRoleT:tmW('Role ni {0}','Role of {0}'),
tmRoleBtn:tmW('Role','Role'),
tmRoleSaved:tmW('{0}: {1}','{0}: {1}'),
tmRoleNow:tmW('Binago ng may-ari ang role mo: {0}','The owner changed your role: {0}'),
tmNoSell:tmW('Hindi pwedeng mag-benta ang role mo ({0}).','Your role ({0}) cannot make sales.'),
tmNoEdit:tmW('Hindi pwedeng mag-edit ng item ang role mo ({0}). Hilingin sa may-ari.','Your role ({0}) cannot edit items. Ask the owner.'),
tmOpen:tmW('Ginagawa ng mga cashier','What the cashiers are doing'),
tmT:tmW('Ginagawa ng mga Cashier','Cashier activity'),
tmCartNow:tmW('Cart ngayon','Cart right now'),
tmNoCart:tmW('Walang laman ang cart niya.','Cart is empty.'),
tmUpd:tmW('Na-update: {0}','Updated: {0}'),
tmNow:tmW('ngayon lang','just now'),
tmSecAgo:tmW('{0} seg nakaraan','{0} sec ago'),
tmMinAgo:tmW('{0} min nakaraan','{0} min ago'),
tmHist:tmW('Kasaysayan','History'),
tmNoHist:tmW('Wala pang nagagawa ang mga cashier.','No cashier activity yet.'),
tmE_add:tmW('Nagdagdag sa cart: {0} (×{1})','Added to cart: {0} (×{1})'),
tmE_dec:tmW('Binawasan sa cart: {0} (natira ×{1})','Reduced in cart: {0} (×{1} left)'),
tmE_rm:tmW('Inalis sa cart: {0}','Removed from cart: {0}'),
tmE_clr:tmW('Inalis lahat ng nasa cart','Cleared the whole cart'),
tmE_sale:tmW('Nakabenta ng {2} ({3}): {0}','Sold {2} ({3}): {0}'),
tmE_inew:tmW('Gumawa ng bagong item: {0}','Created a new item: {0}'),
tmE_iedit:tmW('In-edit ang item: {0}','Edited item: {0}'),
tmE_idel:tmW('Binura ang item: {0}','Deleted item: {0}'),
tmE_join:tmW('Sumali sa tindahan','Joined the store'),
tmE_leave:tmW('Umalis sa tindahan (Leave)','Left the store (Leave)'),
tmItemsGot:tmW('{0}: may {1} item na binago','{0}: {1} item change(s)'),
tmCashLeft:tmW('Umalis si {0} sa tindahan (Leave).','{0} left the store (Leave).'),
tmLeaveNotifT:tmW('Umalis ang cashier','A cashier left'),
tmLeave:tmW('Leave','Leave'),
tmLeaveQ:tmW('Umalis sa {0}?','Leave {0}?'),
tmLeaveP:tmW('Aalis ka sa tindahan ng may-ari at mawawala ka sa listahan niya. Para makabalik, kailangan mo ulit mag-request at tanggapin niya.','You will leave the owner\'s store and be removed from their list. To come back you must request again and the owner must accept.'),
tmLeaveUnsent:tmW('May {0} na hindi pa naipapadala sa may-ari. Subukan munang magka-internet bago mag-Leave.','{0} item(s) have not reached the owner yet. Get internet first before you Leave.'),
tmLeaveNet:tmW('Kailangan ng internet para makapag-Leave (para malaman ng may-ari).','Internet is needed to Leave (so the owner is told).'),
tmLeaving:tmW('Umaalis sa tindahan...','Leaving the store...'),
tmLeft:tmW('Umalis ka na sa {0}.','You left {0}.')
});
