'use strict';
/* ============================================================
   ITO PARA SA LIVE NA TINDAHAN (ONLINE)   [shop.js]   V26
   1) PAGSALI NG CASHIER: i-scan ang QR (o i-type ang code) ng may-ari -> may lalabas sa may-ari na Tanggapin / Tanggihan.
   2) LIVE SYNC: kung ano ang ginawa ng may-ari o cashier (benta, stock, presyo, utang), pareho ang nakikita ng lahat.
      Gumagana kahit magkalayo; may internet lang ang dalawa. Kapag walang internet, tuloy pa rin ang benta at magsi-sync pagbalik ng internet.
   3) Abiso (notification) para sa bagong cashier request.
   Online na bahagi: Firestore (cloud.js). Kailangan ang bagong firestore.rules (tingnan ang SETUP-CLOUD.md).
   ============================================================ */

const SH={req:{},hid:{},pub:null,again:false,lastPubTs:0,init:'',ts:0,lastPush:0,beatAt:0,status:'idle',boxTs:null,seenV:{},busyO:false,busyC:false,join:null,tickAt:0};
const shSleep=ms=>new Promise(r=>setTimeout(r,ms));
const fDbl=v=>({doubleValue:Number(v)||0});
const shSess=()=>store.get(K_SESSION)||'';
// Para saan: maliit na "hash" ng larawan para malaman kung nagbago (hindi na ipapadala ang buong larawan sa bawat sync)
function ihash(s){let h=5381;for(let i=0;i<s.length;i+=7)h=((h<<5)+h+s.charCodeAt(i))|0;return s.length+'.'+(h>>>0).toString(36)}
// Para saan: puwede bang mag-online ang may-ari ngayon?
const shOwnerOk=()=>clOn()&&!!S.user&&S.role!=='cashier'&&navigator.onLine&&clRestore(S.user)&&!!CL.uid;
// Para saan: uid ng tindahan (para sa cashier) na naka-save sa kopya ng tindahan
const shShopUid=()=>((readJSON(K_USERS,{})[S.user])||{}).ouid||'';
// Para saan: puwede bang mag-online ang cashier ngayon?
const shCashOk=()=>clOn()&&!!S.user&&S.role==='cashier'&&navigator.onLine&&!!shShopUid()&&clRestore(shSess());
const shAck=()=>{const o=readJSON('tindamo:ack:'+shSess(),{s:[],d:[]});return {s:new Set(o.s||[]),d:new Set(o.d||[])}};
const shAckSave=a=>store.set('tindamo:ack:'+shSess(),JSON.stringify({s:[...a.s].slice(-2500),d:[...a.d].slice(-2500)}));

/* ---------- abiso sa phone ---------- */
// Para saan: abiso sa phone (kapag pinayagan) para sa bagong request / mensahe
async function appNotify(title,body,tag){
  if(!('Notification' in window)||Notification.permission!=='granted'||prefs.notif===false)return;
  const o={body:String(body||''),icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:tag||'tm',vibrate:[120,60,120]};
  try{const reg=navigator.serviceWorker&&await navigator.serviceWorker.getRegistration();if(reg){await reg.showNotification(title,o);return}}catch(e){}
  try{new Notification(title,o)}catch(e){}
}

/* ---------- tulong sa Firestore: hinihiwang data ---------- */
// Para saan: basahin ang hinating data (base = path ng collection)
async function shPull(base,n,ts){
  if(!(n>0))return null;
  const l=await clListAll(base);
  const parts=(l.documents||[]).map(d=>({i:gInt(d.fields.i),ts:gInt(d.fields.ts),d:(d.fields.d||{}).stringValue||''})).filter(p=>p.i<n).sort((a,b)=>a.i-b.i);
  if(parts.length!==n||parts.some(p=>p.ts!==ts)){const x=new Error('INCOMPLETE');x.code='INCOMPLETE';throw x}
  return JSON.parse(parts.map(p=>p.d).join(''));
}
// Para saan: isulat ang data na hinati sa piraso; ibinabalik ang bilang ng piraso
async function shPut(base,text,ts){
  const parts=[];for(let i=0;i<text.length;i+=CHUNK)parts.push(text.slice(i,i+CHUNK));if(!parts.length)parts.push('');
  for(let i=0;i<parts.length;i+=6){
    const writes=parts.slice(i,i+6).map((d,k)=>({update:{name:dbName(base+'/'+(i+k)),fields:{i:fInt(i+k),ts:fInt(ts),d:fStr(d)}}}));
    await clDb(':commit',{method:'POST',headers:jh,body:JSON.stringify({writes})});
  }
  return parts.length;
}
const shPatch=(path,fields)=>clDb(path+'?'+Object.keys(fields).map(k=>'updateMask.fieldPaths='+k).join('&'),{method:'PATCH',headers:jh,body:JSON.stringify({fields})});

/* ============================================================
   MAY-ARI
   ============================================================ */
// Para saan: ilagay online ang code at pangalan ng tindahan (para mahanap ng cashier at para tanggapin ang request)
async function shOwnerInit(){
  const u=(readJSON(K_USERS,{})[S.user])||{},key=S.user+'|'+S.store+'|'+(u.code||'');
  if(SH.init===key||!u.code)return;
  await shPatch('/shops/'+CL.uid,{code:fStr(u.code),store:fStr(S.store||''),av:fStr(APP_VER.ver)});
  await clDb('/codes/'+encodeURIComponent(u.code),{method:'PATCH',headers:jh,body:JSON.stringify({fields:{uid:fStr(CL.uid),w:fStr(S.user),s:fStr(S.store||''),ts:fInt(Date.now())}})});
  SH.init=key;
}
// Para saan: i-publish ang kasalukuyang tindahan (items, benta, utang) para makita ng mga cashier
async function shopPublish(force){
  if(!shOwnerOk())return;
  if(!force&&!cashData(S.user).list.length)return;
  if(SH.pub){SH.again=true;return SH.pub}
  SH.pub=(async()=>{
    try{
      await shOwnerInit();
      const uidv=CL.uid,u=(readJSON(K_USERS,{})[S.user])||{},ts=Math.max(Date.now(),SH.lastPubTs+1);
      const pm=readJSON('tindamo:imgpub:'+uidv,{}),imgs=[];
      const items=S.items.map(it=>{
        if(!it.img)return it;
        const h=ihash(it.img);if(pm[it.id]!==h)imgs.push({id:it.id,h,d:it.img});
        const c=Object.assign({},it,{ih:h});delete c.img;return c;
      });
      for(let i=0;i<imgs.length;i+=4){
        const sl=imgs.slice(i,i+4);
        await clDb(':commit',{method:'POST',headers:jh,body:JSON.stringify({writes:sl.map(m=>({update:{name:dbName('/shops/'+uidv+'/img/'+m.id),fields:{h:fStr(m.h),d:fStr(m.d)}}}))})});
        sl.forEach(m=>{pm[m.id]=m.h});
      }
      if(imgs.length)store.set('tindamo:imgpub:'+uidv,JSON.stringify(pm));
      await gcPublishQR(uidv);
      const n=await shPut('/shops/'+uidv+'/state',JSON.stringify({v:3,ts,store:S.store,items,sales:S.sales,debts:S.debts,gcash:gcPubMeta(),roles:tmRolesMap()}),ts);
      await shPatch('/shops/'+uidv,{ts:fInt(ts),n:fInt(n),store:fStr(S.store||''),code:fStr(u.code||''),av:fStr(APP_VER.ver)});
      SH.lastPubTs=ts;SH.status='ok';
    }catch(e){SH.status=e.code==='NET'?'wait':'err'}
    SH.pub=null;
    if(SH.again){SH.again=false;shopQueue()}
  })();
  return SH.pub;
}
// Para saan: ilista ang pag-publish (tinatawag ng save())
let SQ=0;
function shopQueue(){
  if(!S.user||!clOn())return;
  clearTimeout(SQ);
  SQ=setTimeout(()=>{if(S.role==='cashier')shopPushBox();else shopPublish()},1200);
}
// Para saan: tanggapin ang benta/utang na galing sa cashier
// V1.2.8: kasama na ang pagbabago sa item (kung pinapayagan ng role niya) at ang tala ng ginawa niya. Ibinabalik ang bilang ng bagong benta.
function shApplyBox(cu,p,name){
  const known=new Set(S.sales.map(s=>s.id)),sales=(p.sales||[]).filter(s=>s&&s.id),fresh=sales.filter(s=>!known.has(s.id)),sum=fresh.reduce((a,s)=>a+(Number(s.total)||0),0);
  syncAsOwner({sales,debts:p.debts||[],items:[],from:'cashier',cashier:name,loc:null});   // una ang benta (bawas stock)...
  const ch=tmApplyItems(cu,p);                                                           // ...tapos ang pagbabago sa item (ang stock na itinakda ng cashier ang masusunod)
  tmLogAdd(p.log||[]);
  save();S.cart=S.cart.filter(l=>byId(l.id));
  if(fresh.length){toast(t('lkNew',name||'Cashier'),{sub:fmt(sum),ms:3500});sfx('success')}
  if(ch)toast(t('tmItemsGot',name||'Cashier',ch),{ms:3000});
  return fresh.length+ch;
}
// Para saan: bantayan ang request ng cashier at ang mga ipinadala nila (tinatawag kada ~5 segundo)
async function shOwnerTick(){
  if(!shOwnerOk()||SH.busyO)return;
  SH.busyO=true;
  try{
    await shOwnerInit();
    const ou=CL.uid,cd=cashData(S.user);
    // 1) request na sumali
    const rq=await clDb('/shops/'+ou+'/requests?pageSize=20').catch(()=>({}));
    const cur={};
    (rq.documents||[]).forEach(d=>{const f=d.fields||{};if(fv(f,'st')!=='p')return;const id=idOf(d);cur[id]={id,name:fv(f,'name')||'Cashier',ts:fv(f,'ts')||0}});
    Object.keys(SH.req).forEach(id=>{if(!cur[id])delete SH.req[id]});
    Object.keys(SH.hid).forEach(id=>{if(!cur[id])delete SH.hid[id]});
    Object.keys(cur).forEach(id=>{
      if(SH.req[id]||SH.hid[id])return;
      if(!cd.open){shDecide(id,false,cur[id]);return}                            // sarado ang pagtanggap
      SH.req[id]=cur[id];sfx('success');try{buzz(BUZZ_OK)}catch(e){}
      appNotify(t('jrNotifT'),t('jrTitle',cur[id].name),'jr-'+id);
    });
    shShowReq();
    // 2) ipinadala ng mga cashier
    if(cd.list.length){
      if(!SH.boxTs)SH.boxTs=readJSON('tindamo:boxts:'+ou,{});
      const bx=await clDb('/shops/'+ou+'/box?pageSize=60').catch(()=>({}));
      let changed=false;
      for(const d of (bx.documents||[])){
        const cu=idOf(d),f=d.fields||{},c=cd.list.find(x=>x.id===cu);if(!c)continue;
        if(gInt(f.left)){tmCashLeft(cu,c,cd);changed=true;continue}                     // V1.2.8: nag-Leave ang cashier
        TM.carts[cu]={lines:tmParseCart(fv(f,'cart')),ts:gInt(f.cts)};               // V1.2.8: live cart ng cashier
        const sv=gInt(f.seen);                                                   // online: nagbago ang "seen" kamakailan
        const s=SH.seenV[cu]||(SH.seenV[cu]={v:0,at:0});if(sv&&sv!==s.v){s.v=sv;s.at=Date.now();c.seen=Date.now()}
        if(f.la&&f.lo&&f.la.doubleValue!=null){c.loc={la:+f.la.doubleValue,lo:+f.lo.doubleValue,ac:gInt(f.ac),ts:gInt(f.lts)||Date.now()}}
        c.av=fv(f,'av')||'';                                                       // V1.0: version ng cashier
        if(!verSame(c.av))continue;                                                 // magkaiba ang version: hindi tatanggapin ang benta hanggang magkapareho
        const ts=gInt(f.ts),n=gInt(f.n);
        if(ts>(SH.boxTs[cu]||0)){
          try{
            const p=await shPull('/shops/'+ou+'/box/'+cu+'/p',n,ts);
            if(p){shApplyBox(cu,p,c.name);changed=true;tmAckBox(cu,p)}
            SH.boxTs[cu]=ts;store.set('tindamo:boxts:'+ou,JSON.stringify(SH.boxTs));
          }catch(e){}
        }
      }
      store.set(K_CASH(S.user),JSON.stringify(cd));if($('#cash-list'))drawCash();   // presence lang: huwag nang i-backup bawat ikot
      if($('#tm-box'))tmDraw();                                                    // V1.2.8: buhay na update ng cart/kasaysayan kung bukas
      if(changed){
        shRefresh();shopPublish(true);                                            // ibalik agad ang bagong stock sa lahat
      }
    }
  }catch(e){}
  SH.busyO=false;
}
// Para saan: i-refresh ang screen pagkatapos dumating ang bagong data (hindi ginagalaw kung may bukas na form)
function shRefresh(){
  renderNav();
  if($('#modal').classList.contains('open')||$('#scanner').classList.contains('open')){bellUpd();return}
  if(S.tab==='sell'&&$('#pickBox')){renderPicker(true);updateSell()}else renderView();
  checkDue();bellUpd();
}
/* ---------- Tanggapin / Tanggihan ---------- */
// Para saan: ipakita ang request sa taas ng screen (hindi hinaharangan ang ginagawa mo)
function shShowReq(){
  const ids=Object.keys(SH.req).filter(id=>!SH.hid[id]);let box=$('#jreq');
  if(!ids.length){if(box)box.remove();return}
  const r=SH.req[ids[0]];
  if(!box){box=document.createElement('div');box.id='jreq';box.className='jreq';box.setAttribute('role','alertdialog');document.body.appendChild(box)}
  if(box.dataset.id===r.id)return;
  box.dataset.id=r.id;
  box.innerHTML='<div class="jr-h"><span class="jr-ic">'+I.users+'</span><div class="jr-t"><b>'+esc(t('jrNotifT'))+'</b><span>'+esc(t('jrTitle',r.name))+'</span></div></div>'+
    '<div class="jr-b"><button class="btn btn-ghost" data-act="jr-no" data-id="'+esc(r.id)+'">'+esc(t('jrDecline'))+'</button><button class="btn btn-primary" data-act="jr-yes" data-id="'+esc(r.id)+'">'+esc(t('jrAccept'))+'</button></div>'+(ids.length>1?'<div class="jr-more">+'+(ids.length-1)+'</div>':'');
}
// Para saan: tanggapin o tanggihan ang cashier
async function shDecide(id,yes,rec){
  const r=rec||SH.req[id]||{id,name:'Cashier'};SH.hid[id]=1;delete SH.req[id];const b=$('#jreq');if(b)b.remove();shShowReq();
  if(!shOwnerOk()){toast(t('errNet'),{kind:'err'});delete SH.hid[id];return}
  try{
    const ou=CL.uid;
    if(yes){
      await shPatch('/shops/'+ou+'/members/'+id,{name:fStr(r.name),ts:fInt(Date.now())});
      const cd=cashData(S.user);if(!cd.list.some(x=>x.id===id)){cd.list.push({id,name:r.name,seen:Date.now(),role:'cashier',at:Date.now()});cashSave(S.user,cd);tmLogAdd([{id:uid(),ts:Date.now(),k:'join',c:r.name}])}
      if($('#cash-list'))drawCash();
    }
    await shPatch('/shops/'+ou+'/requests/'+id,{st:fStr(yes?'a':'d')});
    if(yes){toast(t('jrAdded',r.name),{ms:3000});sfx('success');shopPublish(true)}
  }catch(e){delete SH.hid[id];toast(t('errCloud',e.message||e),{kind:'err'})}
}
// Para saan: inalis ng may-ari ang cashier: alisin din online
async function shRemoveCashier(id){
  if(!shOwnerOk())return;
  const ou=CL.uid;
  for(const p of ['/shops/'+ou+'/members/'+id,'/shops/'+ou+'/box/'+id,'/shops/'+ou+'/requests/'+id]){try{await clDb(p,{method:'DELETE'})}catch(e){}}
}
// Para saan: QR ng tindahan (nasa Cashier page): static, kaya puwedeng i-scan ng cashier kahit saan
function shopQR(){
  const box=$('#cash-qr');if(!box||S.role==='cashier')return;
  if(!clOn()||!CL.uid||!clRestore(S.user)){box.innerHTML='<div class="hint">'+esc(t('shQrNeed'))+'</div>';return}
  const u=(readJSON(K_USERS,{})[S.user])||{},q=lkQR(JSON.stringify({a:'tmj',u:CL.uid,w:S.user,k:u.code||'',s:S.store||''}));
  box.innerHTML=q?'<div class="lk-qr">'+q+'</div><div class="hint" style="margin-top:8px">'+esc(t('shQrHint'))+'</div>':'<div class="hint">'+esc(t('lkNoQR'))+'</div>';
  if(navigator.onLine)shOwnerInit().catch(()=>{});
}

/* ============================================================
   CASHIER
   ============================================================ */
// Para saan: gumawa / ibalik ang online na account ng cashier (hindi kailangan ng email)
async function shEnsureCj(){
  if(clRestore('cj'))return CL.uid;
  const em='c'+uid().replace(/[^a-z0-9]/gi,'').toLowerCase()+'@cashier.tindamo.app',pw=uid()+uid();
  clSession('cj',await clSignUp(em,pw));return CL.uid;
}
// Para saan: mag-request na sumali sa tindahan (galing sa QR o sa code)
async function shopRequestJoin(info,name){
  if(!clOn()){toast(t('cloudOff'),{kind:'err'});return false}
  name=(name||'').trim().slice(0,24)||cashAutoName();
  try{await shEnsureCj()}catch(e){toast(t('jrFail',e.code==='NET'?t('errNet'):(e.message||e)),{kind:'err'});return false}
  const ou=info.u,cu=CL.uid,path='/shops/'+ou+'/requests/'+cu;
  try{await clDb(path,{method:'DELETE'})}catch(e){}
  try{
    await clDb(path,{method:'PATCH',headers:jh,body:JSON.stringify({fields:{name:fStr(name),ts:fInt(Date.now()),code:fStr(info.k),st:fStr('p')}})});
  }catch(e){toast(e.code==='NET'?t('errNet'):(e.status===403?t('errNoStore'):t('jrFail',e.message||e)),{kind:'err',ms:4000});return false}
  const J=SH.join={ou,cu,info,name,stop:false,path};
  openModal('<div class="sheet-h"><h2>'+esc(t('jrWaitT'))+'</h2></div><div class="jr-wait"><div class="jr-spin" aria-hidden="true"></div><p class="hint" style="text-align:center">'+esc(t('jrWaitP',info.s||''))+'</p></div><div class="sheet-f"><button class="btn btn-ghost" style="flex:1" data-act="jr-cancel">'+esc(t('jrCancel'))+'</button></div>');
  (async()=>{
    const t0=Date.now();
    while(!J.stop&&Date.now()-t0<15*60000){
      await shSleep(2500);if(J.stop)return;
      try{
        const d=await clDb(path),st=fv(d.fields||{},'st');
        if(st==='a'){await shJoined(J);return}
        if(st==='d'){J.stop=true;SH.join=null;closeModal();toast(t('jrNo'),{kind:'err',ms:4500});sfx('error');try{await clDb(path,{method:'DELETE'})}catch(e){}return}
      }catch(e){if(e.status===404){J.stop=true;SH.join=null;closeModal();toast(t('jrNo'),{kind:'err',ms:4500});return}}
    }
    if(!J.stop){J.stop=true;SH.join=null;closeModal()}
  })();
  return true;
}
// Para saan: tinanggap ng may-ari: pumasok na sa tindahan
async function shJoined(J){
  J.stop=true;SH.join=null;
  const info=J.info,sess='c:'+info.w+':'+J.cu,users=readJSON(K_USERS,{});
  if(!users[info.w])users[info.w]={store:info.s||'',code:info.k,pw:'!',salt:'!',hash:'!',mirror:true};
  users[info.w].code=info.k;users[info.w].ouid=J.ou;if(info.s)users[info.w].store=info.s;
  store.set(K_USERS,JSON.stringify(users));
  if(!store.get(K_DATA(info.w)))store.set(K_DATA(info.w),JSON.stringify({items:[],sales:[],debts:[],ts:0}));
  const cd=cashData(info.w);if(!cd.list.some(x=>x.id===J.cu))cd.list.push({id:J.cu,name:J.name,seen:Date.now()});cd.open=true;cashSave(info.w,cd);
  store.set(K_CLOUD(sess),JSON.stringify({uid:CL.uid,refresh:CL.refresh}));CL.user=sess;store.del(K_CLOUD('cj'));
  try{await clDb(J.path,{method:'DELETE'})}catch(e){}
  prefs.cashName=J.name;savePrefs();S.switchSess=null;
  store.del('tindamo:shopts:'+sess);store.del('tindamo:ack:'+sess);SH.ts=0;
  closeModal();store.set(K_SESSION,sess);loadUser(sess);showApp();
  toast(t('cjJoined',info.s||''),{ms:3000});sfx('success');
  setTimeout(shCashierTick,400);
}
// Para saan: i-scan ang QR ng may-ari
function shopScanJoin(){
  const nm=$('#c-name')?$('#c-name').value.trim():'';
  closeModal();
  openScanner({title:t('cjScanT'),qr:true,onCode:c=>{
    let o=null;try{o=JSON.parse(c)}catch(e){}
    if(!o||o.a!=='tmj'||!o.u||!o.k||!o.w){toast(t('lkBadQR'),{kind:'err'});sfx('error');buzz(BUZZ_ERR);return false}
    setTimeout(()=>shopRequestJoin(o,nm),80);
  }});
}
// Para saan: pagsali gamit ang tinype na code (hahanapin online ang tindahan)
async function shopJoinByCode(){
  const err=$('#a-err');err.textContent='';
  const code=otpVal(),name=$('#c-name').value.trim();
  if(!/^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(code)){err.textContent=t('errCode6');return}
  if(!clOn()){err.textContent=t('cloudOff');return}
  if(!navigator.onLine){err.textContent=t('errNet');return}
  try{
    await shEnsureCj();
    const d=await clDb('/codes/'+encodeURIComponent(code)),f=d.fields||{};
    await shopRequestJoin({u:fv(f,'uid'),w:fv(f,'w'),s:fv(f,'s'),k:code},name);
  }catch(e){err.textContent=e.code==='NET'?t('errNet'):(e.status===404||e.status===403)?t('errNoStore'):t('jrFail',e.message||e)}
}
// Para saan: inalis ng may-ari ang cashier na ito
function shKicked(){
  const s=shSess();toast(t('shKicked'),{kind:'err',ms:6000});
  recSave(recList().filter(x=>x.s!==s));store.del(K_CLOUD(s));SH.status='idle';logout();
}
// Para saan: ilapat ang bagong tindahan (galing sa may-ari) sa cashier. Ang benta ng cashier na hindi pa alam ng may-ari ay hindi mawawala.
async function shApplyState(doc){
  const ack=shAck(),oS=new Set(doc.sales.map(s=>s.id)),oD=new Set(doc.debts.map(d=>d.id));
  const us=S.sales.filter(s=>!oS.has(s.id)&&!ack.s.has(s.id)),ud=S.debts.filter(d=>!oD.has(d.id)&&!ack.d.has(d.id));
  const out={};us.forEach(s=>(s.lines||[]).forEach(l=>{out[l.id]=(out[l.id]||0)+l.qty}));
  const need=[];
  S.items=doc.items.map(i=>{
    const loc=byId(i.id),c=Object.assign({},i);
    c.img=i.ih?((loc&&loc.ih===i.ih&&loc.img)?loc.img:''):'';
    if(i.ih&&!c.img)need.push(i);
    if(c.stockOn)c.stock=Math.max(0,(Number(c.stock)||0)-(out[c.id]||0));
    return c;
  });
  S.sales=us.concat(doc.sales).sort((a,b)=>b.ts-a.ts).slice(0,500);
  S.debts=doc.debts.concat(ud).sort((a,b)=>a.ts-b.ts);
  doc.sales.forEach(s=>ack.s.add(s.id));doc.debts.forEach(d=>ack.d.add(d.id));shAckSave(ack);
  const users=readJSON(K_USERS,{});
  if(users[S.user]&&doc.store&&users[S.user].store!==doc.store){users[S.user].store=doc.store;store.set(K_USERS,JSON.stringify(users));S.store=doc.store;const l=document.querySelector('.logo small');if(l)l.innerHTML=esc(S.store)+' · '+esc(tmHeadRole())+'<span id="net"></span>'}
  tmOverlay();                          // V1.2.8: huwag mawala ang item na ine-edit/ginawa ng cashier na hindi pa nakukuha ng may-ari
  tmApplyRoles(doc);                    // V1.2.8: role na itinakda ng may-ari
  const keepTs=S.ts;save();S.ts=keepTs;
  S.cart=S.cart.filter(l=>byId(l.id));
  gcApplyPub(doc.gcash||null);
  shRefresh();
  // kunin ang mga larawang wala pa sa phone
  for(const i of need.slice(0,40)){
    try{
      const d=await clDb('/shops/'+shShopUid()+'/img/'+encodeURIComponent(i.id)),it=byId(i.id);
      if(it&&it.ih===i.ih){it.img=fv(d.fields||{},'d')||'';}
    }catch(e){}
  }
  if(need.length){save();shRefresh()}
}
// Para saan: kunin ang pinakabagong tindahan (tinatawag kada ~5 segundo)
async function shCashierTick(){
  if(!shCashOk()||SH.busyC)return;
  SH.busyC=true;
  try{
    const ou=shShopUid(),m=await clDb('/shops/'+ou),f=m.fields||{},ts=gInt(f.ts),n=gInt(f.n);
    if(!verCashierCheck(fv(f,'av')||'')){SH.status='ver';SH.busyC=false;return}   // V1.0: dapat parehong version sa may-ari
    if(!SH.ts)SH.ts=+store.get('tindamo:shopts:'+shSess())||0;
    if(ts>SH.ts&&n>0){
      const doc=await shPull('/shops/'+ou+'/state',n,ts);
      if(doc){await shApplyState(doc);SH.ts=ts;store.set('tindamo:shopts:'+shSess(),String(ts))}
    }
    SH.status='ok';
    if(Date.now()-SH.beatAt>14000)shBeat();
    if(tmPending())await tmReadAck();                                          // V1.2.8: alamin kung natanggap na ng may-ari ang item/tala
    const ack=shAck();if((S.sales.some(s=>!ack.s.has(s.id))||S.debts.some(d=>!ack.d.has(d.id))||tmPending())&&Date.now()-SH.lastPush>20000)shopPushBox();
  }catch(e){
    if(e.status===403||e.code==='PERMISSION_DENIED'){SH.busyC=false;shKicked();return}
    SH.status=e.code==='NET'?'wait':'err';
  }
  SH.busyC=false;
}
// Para saan: "buhay pa ako" + lokasyon ng cashier (nakikita ng may-ari kahit malayo)
async function shBeat(){
  if(!shCashOk())return;SH.beatAt=Date.now();
  try{
    const l=await Promise.race([getLoc(),shSleep(4000).then(()=>null)]);if(l)S.myLoc=l;
    const c=cashData(S.user).list.find(x=>x.id===S.cid),f={seen:fInt(Date.now()),name:fStr(c?c.name:''),av:fStr(APP_VER.ver)};
    if(S.myLoc){f.la=fDbl(S.myLoc.la);f.lo=fDbl(S.myLoc.lo);f.ac=fInt(S.myLoc.ac||0);f.lts=fInt(S.myLoc.ts||Date.now())}
    await shPatch('/shops/'+shShopUid()+'/box/'+CL.uid,f);
  }catch(e){}
}
// Para saan: ipadala sa may-ari ang mga benta/utang na hindi pa niya alam
// V1.2.8: kasama ang item na ginawa/in-edit/binura ng cashier (kung pinapayagan ang role) at ang tala ng ginawa niya
async function shopPushBox(){
  if(S.role!=='cashier'||!shCashOk()||SH.pushing||verLocked())return;
  const ack=shAck(),us=S.sales.filter(s=>!ack.s.has(s.id)),ud=S.debts.filter(d=>!ack.d.has(d.id)),tq=tmqGet();
  const ti=Object.keys(tq.items).map(k=>tq.items[k]),td=Object.keys(tq.del).map(k=>({id:k,ts:tq.del[k]}));
  if(!us.length&&!ud.length&&!ti.length&&!td.length&&!tq.log.length)return;
  SH.pushing=true;SH.lastPush=Date.now();
  try{
    const ou=shShopUid(),ts=Math.max(Date.now(),(SH.pushTs||0)+1),c=cashData(S.user).list.find(x=>x.id===S.cid);
    const pts=Math.max(0,...ti.map(x=>x.uts||0),...td.map(x=>x.ts||0),...tq.log.map(x=>x.ts||0));
    const n=await shPut('/shops/'+ou+'/box/'+CL.uid+'/p',JSON.stringify({v:4,sales:us,debts:ud,items:ti,idel:td,log:tq.log,pts}),ts);
    await shPatch('/shops/'+ou+'/box/'+CL.uid,{ts:fInt(ts),n:fInt(n),name:fStr(c?c.name:''),seen:fInt(Date.now()),av:fStr(APP_VER.ver)});
    SH.pushTs=ts;SH.status='ok';
  }catch(e){SH.status=e.code==='NET'?'wait':'err'}
  SH.pushing=false;
}
// Para saan: status ng live link (para sa Cashier page ng cashier)
function shStatusHtml(){
  if(!clOn())return '<div class="hint">'+esc(t('cloudOff'))+'</div>';
  if(!shShopUid()||!clRestore(shSess()))return '<div class="hint">'+esc(t('shRelink'))+'</div>';
  const ok=SH.status==='ok';
  return '<div class="row" style="align-items:center"><span class="chip '+(ok?'ok':'')+'">'+(ok?'● '+esc(t('shLive')):esc(t('shWait')))+'</span></div>';
}

/* ---------- ikot ---------- */
// Para saan: isang ikot (may-ari o cashier)
function shopTick(){
  if(document.hidden||!S.user)return;
  if(S.role==='cashier')shCashierTick();else shOwnerTick();
}
setInterval(shopTick,5000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(shopTick,300)});
window.addEventListener('online',()=>setTimeout(shopTick,500));

Object.assign(ACTIONS,{
  'jr-yes':b=>{shDecide(b.dataset.id,true)},
  'jr-no':b=>{shDecide(b.dataset.id,false)},
  'jr-cancel':()=>{const J=SH.join;if(J){J.stop=true;clDb(J.path,{method:'DELETE'}).catch(()=>{})}SH.join=null;closeModal()},
  'lk-qr-new':()=>{shopQR()}
});
