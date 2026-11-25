'use strict';
/* ============================================================
   ITO PARA SA MESSAGE, BOT AT ADMIN   [inbox.js]   (V23)
   - User: pumili ng "Kamusta ka? / Bibili ako ng subscription / Suggestion" at ipadala sa admin.
   - Admin/owner: makikita kung ilan ang nag-message, sasagot, at makikita ang mga user (online/offline, email).
   - Kapag hindi sumagot ang admin sa loob ng ilang segundo, sasagot muna ang TindaBot.
   - Online na bahagi ay gumagamit ng Firebase (cloud.js). Walang Firebase = naka-pila lang sa device.
   - Password: HINDI ipinapakita ninuman. Ang owner lang ang puwedeng magpadala ng reset link.
   ============================================================ */

const OWNER_EMAIL='zhenjiro15@gmail.com';
const BOT_WAIT=45000;                       // ilang ms bago sumagot ang bot kung walang sagot ang admin
const ONLINE_MS=100000;                     // online kung may "ping" sa nakaraang ~100 segundo
const K_MSG=u=>'tindamo:msgs:'+u, K_ADMC=u=>'tindamo:admin:'+u;
const MSG_TOPICS=[['hi','mTopicHi'],['vip','mTopicVip'],['sug','mTopicSug']];   // V1.1.3: VIP
I.msg='<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.4A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14h4"/></svg>';
I.shield='<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z"/><path d="m9 12 2 2 4-4"/></svg>';

// IB = kalagayan ng inbox sa memory
const IB={tab:'msg',peek:{},admin:false,threads:[],open:null,convo:[],convoTs:0,busy:false,topic:'',err:'',q:'',lim:8,ts:{},typing:false,sent:0,stick:false,liveBusy:false,lastList:0};

/* ---------- sino ako ---------- */
const ibEmail=()=>S.user?canonEmail(S.user):'';
const ibIsOwner=()=>!!S.user&&S.role!=='cashier'&&ibEmail()===canonEmail(OWNER_EMAIL);
const ibIsAdmin=()=>ibIsOwner()||(S.role!=='cashier'&&!!S.user&&IB.admin);
const ibCan=()=>clOn()&&S.role!=='cashier'&&S.user&&clRestore(S.user)&&navigator.onLine;
const jh={'Content-Type':'application/json'};
const idOf=d=>decodeURIComponent(String(d.name||'').split('/').pop());
const fv=(f,k)=>{const x=f&&f[k];return x?(x.stringValue!=null?x.stringValue:x.integerValue!=null?parseInt(x.integerValue,10):x.booleanValue!=null?x.booleanValue:''):''};
const dbName=p=>'projects/'+CLC.projectId+'/databases/(default)/documents'+p;
// Para saan: i-decode ang token para malaman kung verified ang email (para sa admin rules)
async function ibVerified(){try{const tk=await clToken(),p=JSON.parse(atob(tk.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return p.email_verified===true}catch(e){return false}}

/* ---------- lokal na usapan ng user ---------- */
const thRead=()=>S.user?readJSON(K_MSG(S.user),{msgs:[],readTs:0,bot:null}):{msgs:[],readTs:0,bot:null};
const thSave=th=>{
  th.msgs=th.msgs.sort((a,b)=>a.ts-b.ts).slice(-200);
  let k=0;for(let i=th.msgs.length-1;i>=0;i--){const m=th.msgs[i];if(m.img&&++k>8){m.img='';m.imgGone=1}}   // V1.2.1: 8 pinakabagong larawan lang ang itinatago sa phone (para hindi mapuno)
  try{store.set(K_MSG(S.user),JSON.stringify(th))}catch(e){}
};
// V1.2.1: buuin ang mensahe mula sa Firestore doc (may larawan, reply, edit, react)
const ibDocMsg=(id,f)=>({id,from:fv(f,'from'),text:fv(f,'text'),topic:fv(f,'topic'),ts:fv(f,'ts')||0,img:fv(f,'img')||'',rt:fv(f,'rt')||'',rf:fv(f,'rf')||'',ed:fv(f,'ed')||0,rU:fv(f,'rU')||'',rA:fv(f,'rA')||'',del:fv(f,'del')||0});
// Para saan: bilang ng hindi pa nababasang sagot (user) o bagong mensahe (admin)
function ibUnread(){
  if(!S.user||S.role==='cashier')return 0;
  if(ibIsAdmin())return IB.threads.reduce((a,x)=>a+(x.unread||0),0);
  const th=thRead();return th.msgs.filter(m=>m.from!=='user'&&m.ts>th.readTs).length;
}
// Para saan: pulang bilang sa menu button
function ibBadge(){
  const n=ibUnread(),b=$('#mdot');
  if(b){b.hidden=!n;b.textContent=n>99?'99+':n}
}

/* ---------- pagpapadala (user -> admin) ---------- */
// Para saan: idagdag ang mensahe sa device, ipila ang bot, at subukang ipadala
function ibSend(text,topic,extra){
  text=String(text||'').trim().slice(0,500);if((!text&&!(extra&&extra.img))||!S.user)return;
  const th=thRead(),now=Date.now();
  th.msgs.push(Object.assign({id:uid(),from:'user',text,topic:topic||'',ts:now,sent:false},extra||{}));
  th.bot={at:now+BOT_WAIT,since:now,topic:topic||'hi'};
  thSave(th);ibDraw();ibFlush();
}
// Para saan: ipadala sa Firestore ang mga naka-pila (kung may internet at online account)
async function ibFlush(){
  if(!S.user||S.role==='cashier'||IB.busy||!ibCan())return;
  const th=thRead(),q=th.msgs.filter(m=>m.from!=='admin'&&!m.sent);if(!q.length)return;
  IB.busy=true;
  try{
    const uidv=CL.uid,users=readJSON(K_USERS,{}),store_=(users[S.user]||{}).store||S.store||'';
    const writes=[];
    q.forEach(m=>{
      writes.push({update:{name:dbName('/threads/'+uidv+'/msgs/'+m.id),fields:ibMsgFields(m)}});
    });
    const last=q.filter(m=>m.from!=='bot').slice(-1)[0]||q[q.length-1],nUser=q.filter(m=>m.from==='user').length;
    const w={update:{name:dbName('/threads/'+uidv),fields:{email:fStr(ibEmail()),store:fStr(store_),last:fStr((last.text||'\ud83d\udcf7').slice(0,80)),lastTs:fInt(last.ts)}},updateMask:{fieldPaths:['email','store','last','lastTs']}};
    if(nUser)w.updateTransforms=[{fieldPath:'unreadAdmin',increment:{integerValue:String(nUser)}}];
    writes.push(w);
    await clDb(':commit',{method:'POST',headers:jh,body:JSON.stringify({writes})});
    const th2=thRead();th2.msgs.forEach(m=>{if(q.some(x=>x.id===m.id))m.sent=true});thSave(th2);
  }catch(e){}
  IB.busy=false;ibDraw();
}
// Para saan: kunin ang mga sagot ng admin para sa user
async function ibPullMine(){
  if(!ibCan())return;
  try{
    const td=await clDb('/threads/'+CL.uid).catch(()=>null);
    const l=await clDb('/threads/'+CL.uid+'/msgs?pageSize=200&orderBy=ts');
    const th=thRead();let wiped=false;
    const clr=td?(fv(td.fields||{},'clr')||0):0;
    if(clr&&clr!==(th.clr||0)){th.msgs=th.msgs.filter(m=>!m.sent);th.clr=clr;wiped=true}   // V31: nilinis ng admin ang usapan
    const have=new Set(th.msgs.map(m=>m.id)),fresh=[];let add=0;
    (l.documents||[]).forEach(d=>{
      const id=idOf(d),f=d.fields||{};
      if(have.has(id)){                                                  // V1.2.1: kunin ang edit at react ng kausap
        const lm=th.msgs.find(x=>x.id===id),dm=ibDocMsg(id,f);
        if(lm&&lm.sent&&(lm.text!==dm.text||(lm.ed||0)!==dm.ed||(lm.rA||'')!==dm.rA||(lm.rU||'')!==dm.rU||(lm.del||0)!==dm.del)){lm.text=dm.text;lm.ed=dm.ed;lm.rA=dm.rA;lm.rU=dm.rU;lm.del=dm.del;if(dm.del){lm.img='';lm.rt=''}add++}   // V1.2.3: pati ang binura
        return;
      }
      const m=Object.assign(ibDocMsg(id,f),{sent:true});m.from=m.from||'admin';
      th.msgs.push(m);add++;if(m.from!=='user')fresh.push(m);
    });
    if(add||wiped){
      const open=S.page==='message'&&!!$('#ib-body');
      if(open)th.readTs=Date.now();                                    // V26: bukas ang chat, nabasa na
      thSave(th);ibDraw();ibBadge();
      if(fresh.length&&!open)ibIncoming(fresh[fresh.length-1].text,false);
      const wm=fresh.filter(m=>m.topic==='warn'&&m.ts>Date.now()-3*864e5).pop();if(wm&&typeof warnShow==='function')warnShow(wm.text);   // V1.1.7   // V26: abiso
    }
  }catch(e){}
}
// Para saan: bot: kung walang sagot ang admin pagkatapos ng ilang segundo, sasagot ang TindaBot (isang beses)
async function ibBotTick(){
  if(!S.user||S.role==='cashier')return;
  let th=thRead();if(!th.bot||Date.now()<th.bot.at)return;
  await ibPullMine();th=thRead();const b=th.bot;if(!b)return;
  if(!th.msgs.some(m=>m.from==='admin'&&m.ts>b.since)){
    const key=b.topic==='sub'?'botSub':b.topic==='sug'?'botSug':'botHi';
    th.msgs.push({id:uid(),from:'bot',text:t(key),topic:'',ts:Date.now(),sent:false});
  }
  th.bot=null;thSave(th);ibDraw();ibBadge();ibFlush();
}

/* ---------- Message page (V24: full screen, live, may typing dots) ---------- */
const fullSheet=()=>{const sh=document.querySelector('#modal .sheet');if(sh)sh.classList.add('full')};
// Para saan: 3 tuldok na "nagta-type" (para makita ng kausap habang nagta-type ka)
const dotsMsg=()=>'<div class="ib-m th" id="ib-typing"><div class="ib-b ib-dots" aria-label="typing"><i></i><i></i><i></i></div></div>';
// Para saan: nakita bang nagbago ang "typing" na numero kamakailan? (hindi umaasa sa oras ng dalawang phone)
function ibTypingSeen(key,val){const s=IB.ts[key]||(IB.ts[key]={v:0,at:0});if(val!==s.v){s.v=val;s.at=Date.now()}return val>0&&Date.now()-s.at<4500}
// Para saan: ipaalam sa kausap na nagta-type ako (hindi hihigit sa isang beses kada 2.5 segundo)
function ibSayTyping(who,uidv,on){
  if(!ibCan())return;const now=Date.now();
  if(on&&now-IB.sent<2500)return;IB.sent=now;
  const f=who==='admin'?'tA':'tU';
  clDb('/threads/'+encodeURIComponent(uidv)+'?updateMask.fieldPaths='+f,{method:'PATCH',headers:jh,body:JSON.stringify({fields:{[f]:fInt(on?now:0)}})}).catch(()=>{});
}
document.addEventListener('input',e=>{
  const id=e.target.id;
  if(id==='ib-in'&&e.target.value.trim()&&CL.uid)ibSayTyping('user',CL.uid,true);
  else if(id==='ib-rep'&&e.target.value.trim()&&IB.open)ibSayTyping('admin',IB.open,true);
  if(id==='ib-in'||id==='ib-rep'){e.target.style.height='auto';e.target.style.height=Math.min(120,e.target.scrollHeight)+'px'}
  if(id==='ib-q'){IB.q=e.target.value;IB.lim=8;ibListDraw()}
});
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'||e.shiftKey)return;
  if(e.target.id==='ib-in'){e.preventDefault();ibSendFree()}
  else if(e.target.id==='ib-rep'){e.preventDefault();ibReply()}
});
// Para saan: buksan ang Message (user = chat sa Dev, admin = inbox)
function openMessage(){
  S.page='message';IB.open=null;IB.err='';IB.q='';IB.lim=8;IB.ts={};IB.vipMenu=false;
  openModal('<div class="ib-top"><button class="icon-btn" data-act="close-modal" aria-label="'+esc(t('close'))+'">'+I.x+'</button><h2>'+esc(ibIsAdmin()?t('mInbox'):t('mMsgT'))+'</h2>'+(ibIsAdmin()?'':'<span class="ib-tier">'+vipChips()+'</span><button class="btn btn-ghost ib-rp" data-act="rp-open">'+I.flag+' '+esc(t('rpBtn'))+'</button>')+'<span class="ib-live" id="ib-live"></span></div><div id="ib-body" class="ib-full"></div>');
  fullSheet();
  if(ibIsAdmin()){ibAdminLoad();return}
  const th=thRead();th.readTs=Date.now();thSave(th);ibBadge();
  ibDraw();ibPullMine();ibFlush();
}
// Para saan: skeleton ng chat ng user (isang beses lang; pagkatapos ay ang loob ng chat lang ang nagre-refresh)
function ibDraw(){
  const box=$('#ib-body');if(!box||S.page!=='message')return;
  if(ibIsAdmin()){ibAdminDraw();return}
  if(!$('#ib-chat')){
    box.innerHTML='<div class="ib-chat" id="ib-chat"></div>'+
      (clOn()?'':'<div class="hint" style="margin:6px 2px">'+esc(t('mNeedCloud'))+'</div>')+
      '<div class="ib-chips">'+MSG_TOPICS.filter(x=>x[0]!=='vip'||vipTier()==='guest').map(x=>'<button class="ib-chip" data-act="ib-topic" data-v="'+x[0]+'" aria-pressed="'+(IB.topic===x[0])+'">'+esc(t(x[1]))+'</button>').join('')+'</div>'+
      '<div class="ib-comp"><button class="icon-btn ib-att" data-act="ib-att" aria-label="'+esc(t('imgT'))+'">'+I.img+'</button><textarea class="inp" id="ib-in" rows="1" maxlength="500" placeholder="'+esc(t('mSendPh'))+'"></textarea><button class="btn btn-primary ib-go" data-act="ib-send" aria-label="'+esc(t('mSend'))+'">'+esc(t('mSend'))+'</button></div>';
    vipMenuDraw();
  }
  const th=thRead(),nm=m=>m.from==='bot'?t('mBot'):t('mFromAdmin');
  const c=$('#ib-chat'),near=c.scrollHeight-c.scrollTop-c.clientHeight<90;
  c.innerHTML=(th.msgs.length?th.msgs.map(m=>ibMsgHtml(m,m.from==='user','user',nm(m))).join(''):'<div class="hint" style="text-align:center;padding:30px 10px">'+esc(t('mEmpty'))+'</div>')+(IB.typing?dotsMsg():'');
  if(near||IB.stick)c.scrollTop=c.scrollHeight;IB.stick=false;
  document.querySelectorAll('.ib-chip').forEach(b=>b.setAttribute('aria-pressed',String(IB.topic===b.dataset.v)));
}
// Para saan: ipadala ang tinype ng user (reply o suggestion)
function ibSendFree(){
  const el=$('#ib-in'),v=el?el.value.trim():'';if(v.length<1)return;
  el.value='';el.style.height='auto';IB.stick=true;
  if(CL.uid)ibSayTyping('user',CL.uid,false);
  const tp=IB.topic;IB.topic='';ibSend(v,tp==='sug'?'sug':'');
}

/* ---------- admin: inbox na may search at maikli ---------- */
async function ibAdminLoad(){
  const box=$('#ib-body');if(!box)return;
  if(!ibCan()){box.innerHTML='<div class="hint" style="padding:12px 0">'+esc(t('admNeedCloud'))+'</div>';return}
  box.innerHTML='<div class="hint" style="padding:12px 0">…</div>';
  await Promise.all([ibThreads(),vipLoadAll()]);ibAdminDraw();
}
// Para saan: kunin ang listahan ng nag-message
async function ibThreads(){
  if(!ibCan())return;
  try{
    const l=await clDb('/threads?pageSize=300'),prevU=IB.threads.reduce((a,x)=>a+(x.unread||0),0),had=IB.loaded;
    IB.threads=(l.documents||[]).map(d=>{const f=d.fields||{};return{uid:idOf(d),email:fv(f,'email'),store:fv(f,'store'),last:fv(f,'last'),ts:fv(f,'lastTs')||0,unread:fv(f,'unreadAdmin')||0,warns:fv(f,'warns')||0}}).filter(x=>x.ts>0).sort((a,b)=>b.ts-a.ts);
    IB.err='';IB.loaded=true;
    const nowU=IB.threads.reduce((a,x)=>a+(x.unread||0),0);
    if(had&&nowU>prevU&&!(S.page==='message'&&$('#ib-body'))){const nt=IB.threads.filter(x=>x.unread).sort((a,b)=>b.ts-a.ts)[0];ibIncoming(nt?(nt.email||'')+': '+(nt.last||''):'',true)}   // V26: abiso sa admin
  }catch(e){IB.err=(e.status===403||e.code==='PERMISSION_DENIED')?t('admDenied'):String(e.message||e)}
  ibBadge();
}
// V26: abiso kapag may bagong mensahe (toast + tunog + abiso sa phone); hindi lalabas kung bukas na ang chat
function ibIncoming(text,admin){
  const ti=t(admin?'nMsgAdminT':'nMsgT'),tx=String(text||'').slice(0,100);
  toast(ti,{sub:tx,ms:5000,action:{label:t('nMsgOpen'),fn:()=>{closeModal();openMessage()}}});
  sfx('success');try{buzz(BUZZ_OK)}catch(e){}
  appNotify(ti,tx,'msg');ibBadge();
}
// V1.1.6: pangalan ng tindahan (kung wala, ang unang bahagi ng Gmail)
const ibName=x=>String((x&&x.store)||'').trim()||String((x&&x.email)||'').split('@')[0]||String((x&&x.uid)||'');
// V1.1.6: profile pic sa gilid (pareho ng avatar sa Profile: kulay at unang letra ng pangalan ng tindahan)
const ibAvatar=(x,sz)=>avHtml(x,sz);   // V1.2.1: may litrato kung nag-set ang user (v1.2.1.js)
// V1.1.6: tatak ng antas: Dev (owner) / Admin / VIP / Guest
function ibTierChips(email){
  const e=canonEmail(email||'');if(!e)return '';
  if(e===canonEmail(OWNER_EMAIL))return vipChips('dev');
  if(AD.admins&&AD.admins.some(a=>canonEmail(a.email||a.id)===e))return vipChips('admin');
  return vipChips(AD.vips&&AD.vips.has(e)?'vip':'guest');
}
// V1.1.7: header ng usapan (admin): Back + mga aksyon sa taas, sa baba ang card ng user (avatar, tindahan, Gmail, tatak)
function ibHeadHtml(th){
  const e=esc(th.email||''),u=esc(IB.open||'');
  return '<div class="ib-head"><div class="ib-head-top"><button class="btn btn-ghost ib-back" data-act="ib-back">‹ '+esc(t('mBack'))+'</button><div class="ib-acts">'+vipChatWrap(th.email)+
    (ibIsAdmin()?'<button class="icon-btn" data-act="ib-clear-ask" aria-label="'+esc(t('clrT'))+'" title="'+esc(t('clrT'))+'">'+I.trash+'</button>':'')+'</div></div>'+
    '<div class="ib-who">'+ibAvatar(th,'lg')+'<div class="ib-who-t"><div class="ib-who-n">'+esc(ibName(th))+'</div><div class="ib-who-e">'+e+'</div>'+
    '<div class="ib-who-c">'+ibTierChips(th.email)+(typeof modChips==='function'?modChips(th):'')+'</div></div></div></div>';
}
function ibAdminDraw(){
  const box=$('#ib-body');if(!box||S.page!=='message')return;
  if(IB.open){ibConvoDraw();return}
  const n=IB.threads.length,nu=IB.threads.filter(x=>x.unread).length;
  box.innerHTML='<div class="ib-sum"><b>'+esc(t('mCount',n,nu))+'</b><button class="btn btn-ghost" style="min-height:38px" data-act="ib-admin">'+I.shield+' '+esc(t('admT'))+'</button></div>'+
    '<input class="inp" id="ib-q" type="search" enterkeyhint="search" placeholder="'+esc(t('mSearch'))+'" value="'+esc(IB.q)+'" autocomplete="off" style="margin-bottom:10px">'+
    (IB.err?'<div class="hint" style="color:var(--danger);margin:4px 0 8px">'+esc(IB.err)+'</div>':'')+'<div id="ib-list" class="ib-list"></div>';
  ibListDraw();
}
// Para saan: iguhit ang listahan (may search, walong nauuna lang, may "Ipakita pa")
function ibListDraw(){
  const box=$('#ib-list');if(!box)return;
  const q=(IB.q||'').trim().toLowerCase();
  const all=IB.threads.filter(x=>!q||(x.email+' '+x.store+' '+x.last).toLowerCase().includes(q)),list=all.slice(0,IB.lim);
  box.innerHTML=list.length?list.map(x=>'<button class="ib-row" data-act="ib-open" data-u="'+esc(x.uid)+'">'+ibAvatar(x)+'<div style="min-width:0;flex:1"><b>'+esc(ibName(x))+'</b><span class="ib-tier">'+ibTierChips(x.email)+'</span><small>'+esc(x.email||x.uid)+'</small><div class="ib-last">'+esc(x.last)+'</div></div><div class="ib-side"><small>'+esc(x.ts?dstr(x.ts):'')+'</small>'+(x.unread?'<span class="ib-n">'+x.unread+'</span>':'')+'</div></button>').join('')+(all.length>IB.lim?'<button class="btn btn-ghost btn-block" data-act="ib-more" style="min-height:42px">'+esc(t('mMore'))+' ('+(all.length-IB.lim)+')</button>':'')
    :'<div class="hint" style="padding:18px 0;text-align:center">'+esc(t('mNoThreads'))+'</div>';
}
async function ibOpenThread(u){
  IB.open=u;IB.convo=[];IB.convoTs=0;IB.typing=false;IB.ts={};
  await vipLoadAll();
  if(typeof modLoad==='function')await modLoad(((IB.threads.find(x=>x.uid===u)||IB.peek[u]||{}).email));
  if(IB.open!==u)return;
  ibConvoDraw(true);
  await ibLoadConvo(u);
}
// Para saan: kunin ang usapan at i-mark na nabasa
async function ibLoadConvo(u){
  try{
    const l=await clDb('/threads/'+encodeURIComponent(u)+'/msgs?pageSize=200&orderBy=ts');
    IB.convo=(l.documents||[]).map(d=>ibDocMsg(idOf(d),d.fields||{}));
    IB.convoTs=IB.convo.length?IB.convo[IB.convo.length-1].ts:0;
    const th=IB.threads.find(x=>x.uid===u);
    if(th&&th.unread){await clDb('/threads/'+encodeURIComponent(u)+'?updateMask.fieldPaths=unreadAdmin',{method:'PATCH',headers:jh,body:JSON.stringify({fields:{unreadAdmin:fInt(0)}})});th.unread=0;ibBadge()}
  }catch(e){IB.err=String(e.message||e)}
  ibConvoDraw();
}
// Para saan: skeleton ng usapan ng admin (isang beses; ang chat lang ang nagre-refresh para hindi mawala ang tina-type)
function ibConvoDraw(first){
  const box=$('#ib-body');if(!box||!IB.open)return;
  const th=IB.threads.find(x=>x.uid===IB.open)||IB.peek[IB.open]||{};
  if(first||!$('#ib-chat')){
    box.innerHTML=ibHeadHtml(th)+
      '<div class="ib-chat" id="ib-chat"></div>'+
      '<div class="ib-comp"><button class="icon-btn ib-att" data-act="ib-att" aria-label="'+esc(t('imgT'))+'">'+I.img+'</button><textarea class="inp" id="ib-rep" rows="1" maxlength="500" placeholder="'+esc(t('mReplyPh'))+'"></textarea><button class="btn btn-primary ib-go" data-act="ib-reply">'+esc(t('mSend'))+'</button></div>';
  }
  const c=$('#ib-chat'),near=c.scrollHeight-c.scrollTop-c.clientHeight<90;
  c.innerHTML=IB.convo.map(m=>ibMsgHtml(m,m.from==='admin','admin',m.from==='bot'?t('mBot'):(ibName(th)||'User'))).join('')+(IB.typing?dotsMsg():'');
  if(near||first||IB.stick)c.scrollTop=c.scrollHeight;IB.stick=false;
}
// V31: Clear chat (ADMIN LANG). Binubura ang lahat ng mensahe ng usapang ito sa cloud; nililinis din ito sa phone ng user.
async function ibClearChat(u){
  if(!ibIsAdmin()||!ibCan()||!u||IB.clearing)return;
  IB.clearing=true;
  try{
    for(let g=0;g<30;g++){
      const l=await clDb('/threads/'+encodeURIComponent(u)+'/msgs?pageSize=300'),docs=l.documents||[];
      if(!docs.length)break;
      await clDb(':commit',{method:'POST',headers:jh,body:JSON.stringify({writes:docs.map(d=>({delete:d.name}))})});
    }
    const now=Date.now();
    await clDb(':commit',{method:'POST',headers:jh,body:JSON.stringify({writes:[
      {update:{name:dbName('/threads/'+u),fields:{last:fStr(''),lastTs:fInt(now),unreadAdmin:fInt(0),tA:fInt(0),clr:fInt(now)}},updateMask:{fieldPaths:['last','lastTs','unreadAdmin','tA','clr']}}
    ]})});
    IB.convo=[];IB.convoTs=now;
    const th=IB.threads.find(x=>x.uid===u);if(th){th.last='';th.ts=now;th.unread=0}
    ibConvoDraw();toast(t('clrDone'));sfx('success');
  }catch(e){toast(t('errCloud',e.message||e),{kind:'err',ms:3500})}
  IB.clearing=false;
}
async function ibReply(){
  const el=$('#ib-rep'),text=el?el.value.trim().slice(0,500):'';if(!text||!IB.open||!ibCan())return;
  const u=IB.open,id=uid(),ts=Date.now();el.value='';el.style.height='auto';
  IB.convo.push({id,from:'admin',text,ts});IB.convoTs=ts;IB.stick=true;ibConvoDraw();
  try{
    await clDb(':commit',{method:'POST',headers:jh,body:JSON.stringify({writes:[
      {update:{name:dbName('/threads/'+u+'/msgs/'+id),fields:{from:fStr('admin'),text:fStr(text),topic:fStr(''),ts:fInt(ts)}}},
      {update:{name:dbName('/threads/'+u),fields:{last:fStr('↩ '+text.slice(0,80)),lastTs:fInt(ts),unreadAdmin:fInt(0),tA:fInt(0)}},updateMask:{fieldPaths:['last','lastTs','unreadAdmin','tA']}}
    ]})});
  }catch(e){toast(t('errCloud',e.message||e),{kind:'err'})}
}
// Para saan: LIVE: tingnan ang thread kada ~2.5 segundo habang bukas ang chat (isang maliit na basa lang)
async function ibLive(){
  if(S.page!=='message'||!$('#ib-body')||!ibCan()||IB.liveBusy)return;
  IB.liveBusy=true;
  try{
    if(ibIsAdmin()){
      if(IB.open){
        const d=await clDb('/threads/'+encodeURIComponent(IB.open)).catch(()=>null);
        if(d){const f=d.fields||{},typ=ibTypingSeen('u',fv(f,'tU')||0),last=fv(f,'lastTs')||0;
          const chg=typ!==IB.typing;IB.typing=typ;
          const rv=fv(f,'rev')||0;if(last>IB.convoTs||rv!==(IB.rev||0)){IB.rev=rv;await ibLoadConvo(IB.open)}else if(chg)ibConvoDraw()}
      }else if(Date.now()-(IB.lastList||0)>9000){IB.lastList=Date.now();await ibThreads();if(!IB.open)ibListDraw()}
    }else{
      const d=await clDb('/threads/'+CL.uid).catch(()=>null);
      if(d){const f=d.fields||{},typ=ibTypingSeen('a',fv(f,'tA')||0),last=fv(f,'lastTs')||0,th=thRead();
        const known=Math.max(th.clr||0,th.msgs.reduce((a,m)=>Math.max(a,m.ts),0)),chg=typ!==IB.typing,clr=fv(f,'clr')||0;IB.typing=typ;
        const rv=fv(f,'rev')||0;if(last>known||clr!==(th.clr||0)||rv!==(IB.rev||0)){IB.rev=rv;await ibPullMine()}else if(chg)ibDraw()}
      ibFlush();
    }
    const lv=$('#ib-live');if(lv)lv.classList.add('on');
  }catch(e){}
  IB.liveBusy=false;
}
setInterval(ibLive,2500);

/* ---------- admin: dalawang tab: User (mga gumagamit, may search) at Admin (ikaw at ang mga idinagdag mo) ---------- */
// V28: state ng Admin page (tab, search, filter, at nakuhang data para hindi na ulit-ulitin ang pagkuha)
const AD={tab:'user',q:'',f:'all',users:[],admins:[],err:'',ver:true};
// Para saan: pagbukas ng Admin page. keep=true: panatilihin ang tab at search (hal. pagkatapos magdagdag ng admin)
async function openAdminPanel(keep){
  if(!ibIsAdmin())return;
  if(keep!==true){AD.tab='user';AD.q='';AD.f='all'}
  const again=keep===true&&S.page==='admin'&&$('#ad-body');
  S.page='admin';
  if(!again)openModal(pgHead(t('admT'))+'<div id="ad-body"><div class="hint" style="padding:12px 0">…</div></div>');
  if(!ibCan()){$('#ad-body').innerHTML='<div class="hint">'+esc(t('admNeedCloud'))+'</div>';return}
  let users=[],admins=[],err='';
  try{
    const l=await clDb('/presence?pageSize=300');
    users=(l.documents||[]).map(d=>{const f=d.fields||{};return{uid:idOf(d),email:fv(f,'email'),store:fv(f,'store'),via:fv(f,'via')||'',ts:fv(f,'ts')||0}});
  }catch(e){err=(e.status===403||e.code==='PERMISSION_DENIED')?t('admDenied'):String(e.message||e)}
  if(ibIsOwner()){try{const a=await clDb('/admins?pageSize=100');admins=(a.documents||[]).map(d=>({id:idOf(d),email:fv(d.fields,'email')||idOf(d)}))}catch(e){}}
  await vipLoadAll();
  const now=Date.now();users.forEach(u=>u.on=u.ts>now-ONLINE_MS);users.sort((a,b)=>(b.on-a.on)||(b.ts-a.ts));
  AD.users=users;AD.admins=admins;AD.err=err;AD.ver=await ibVerified();
  adDraw();
}
// Para saan: mga email na admin (para lagyan ng tatak ang mga user)
const adEmails=()=>new Set([canonEmail(OWNER_EMAIL)].concat(AD.admins.map(a=>canonEmail(a.email||a.id))));
// Para saan: buuin ang buong laman ng Admin page (tabs, bilang, at ang kasalukuyang tab)
function adDraw(){
  const b=$('#ad-body');if(!b||S.page!=='admin')return;
  const on=AD.users.filter(u=>u.on).length,own=ibIsOwner(),adm=adEmails();
  b.innerHTML=(AD.ver?'':'<div class="ib-warn">'+esc(t('admVerify'))+'<button class="btn btn-ghost" style="margin-top:8px;min-height:38px" data-act="ad-verify">'+esc(t('admSendVerify'))+'</button></div>')+
    (AD.err?'<div class="hint" style="color:var(--danger);margin:8px 0">'+esc(AD.err)+'</div>':'')+
    '<div class="seg" role="tablist" style="margin-bottom:12px"><button role="tab" data-act="ad-tab" data-t="user" aria-selected="'+(AD.tab==='user')+'">'+esc(t('admUserTab'))+' · '+AD.users.length+'</button><button role="tab" data-act="ad-tab" data-t="admin" aria-selected="'+(AD.tab==='admin')+'">'+esc(t('admAdminTab'))+' · '+adm.size+'</button></div>'+
    (AD.tab==='user'?
      '<div class="ad-stats"><div class="ad-st"><small>'+esc(t('admOnline'))+'</small><b class="g">'+on+'</b></div><div class="ad-st"><small>'+esc(t('admTotal'))+'</small><b>'+AD.users.length+'</b></div></div>'+
      '<input class="inp" id="ad-q" type="search" enterkeyhint="search" placeholder="'+esc(t('admSearch'))+'" value="'+esc(AD.q)+'" autocomplete="off" style="margin:10px 0 8px">'+
      '<div class="cats" role="group" style="margin-top:0">'+[['all','all',AD.users.length],['on','online',on],['off','offline',AD.users.length-on]].map(f=>'<button class="cat" data-act="ad-filter" data-f="'+f[0]+'" aria-pressed="'+(AD.f===f[0])+'">'+esc(t(f[1]))+'<i>'+f[2]+'</i></button>').join('')+'</div>'+
      '<div class="set-sec"><div id="ad-list"></div>'+(own?'<div class="hint" style="margin-top:10px">'+esc(t('admPwNote'))+'</div>':'')+'</div>'
    :
      '<div class="set-sec"><span class="lbl">'+esc(t('admAdmins'))+'</span>'+
      '<div class="pp"><div style="font-weight:600;overflow-wrap:anywhere">'+esc(OWNER_EMAIL)+'</div><span class="chip ok">'+esc(t('admOwnerTag'))+'</span></div>'+
      AD.admins.map(a=>'<div class="pp"><div style="overflow-wrap:anywhere">'+esc(a.email)+'</div>'+(own?'<button class="btn btn-ghost" style="min-height:34px;padding:0 10px;font-size:12.5px" data-act="ad-rm" data-id="'+esc(a.id)+'">'+esc(t('admRemove'))+'</button>':'<span class="chip">Admin</span>')+'</div>').join('')+
      (own?'<div class="row" style="margin-top:10px"><input class="inp" id="ad-new" type="email" inputmode="email" autocapitalize="off" placeholder="'+esc(t('admAddPh'))+'"><button class="btn btn-dark" data-act="ad-add">'+esc(t('admAdd'))+'</button></div>':'<div class="hint" style="margin-top:10px">'+esc(t('admOnlyOwner'))+'</div>')+'</div>');
  if(AD.tab==='user')adListDraw();
}
// Para saan: listahan ng user ayon sa search at filter (hiwalay para hindi mawala ang focus ng search)
function adListDraw(){
  const box=$('#ad-list');if(!box)return;
  const q=AD.q.trim().toLowerCase(),own=ibIsOwner(),adm=adEmails();
  const list=AD.users.filter(u=>(AD.f==='all'||(AD.f==='on'?u.on:!u.on))&&(!q||(u.email||'').toLowerCase().includes(q)||(u.store||'').toLowerCase().includes(q)||u.uid.toLowerCase().includes(q)));
  box.innerHTML=list.length?list.map(u=>{
    const isAd=u.email&&adm.has(canonEmail(u.email));
    return '<div class="pp"><div style="min-width:0"><div style="font-weight:600;overflow-wrap:anywhere">'+esc(u.email||u.uid)+'</div><div class="hint">'+esc(u.store)+' · '+esc(u.on?t('online'):t('admSeen',u.ts?dstr(u.ts):'—'))+'</div></div>'+
    '<div class="row" style="align-items:center;flex-wrap:wrap;justify-content:flex-end"><span class="chip '+(u.on?'ok':'')+'">'+(u.on?'● '+esc(t('online')):esc(t('offline')))+'</span>'+
    (isAd?'<span class="chip tint">Admin</span>':vipRowBtn(u.email)+(own&&u.email?'<button class="btn btn-ghost" style="min-height:34px;padding:0 10px;font-size:12.5px" data-act="ad-promote" data-e="'+esc(u.email)+'">'+esc(t('admMake'))+'</button>':''))+
    (own&&u.email?'<button class="btn btn-ghost" style="min-height:34px;padding:0 10px;font-size:12.5px" data-act="ad-reset" data-e="'+esc(u.email)+'">'+esc(t('admReset'))+'</button>':'')+
    (u.email&&canonEmail(u.email)!==canonEmail(OWNER_EMAIL)&&(own||!isAd)?'<button class="btn btn-ghost" style="min-height:34px;padding:0 10px;font-size:12.5px;color:var(--danger)" data-act="ad-deluser" data-u="'+esc(u.uid)+'" data-e="'+esc(u.email)+'">'+esc(t('modTabD'))+'</button>':'')+'</div></div>'}).join('')
  :'<div class="hint" style="padding:8px 0">'+esc(t(AD.users.length?'noItemFound':'mNoThreads'))+'</div>';
}
document.addEventListener('input',e=>{if(e.target.id==='ad-q'){AD.q=e.target.value;adListDraw()}});
// Para saan: gawing admin ang isang email (owner lang)
async function adAdd(raw){
  if(!ibIsOwner())return false;
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw)){toast(t('admAddPh'),{kind:'warn'});return false}
  const id=canonEmail(raw);
  try{await clDb('/admins/'+encodeURIComponent(id),{method:'PATCH',headers:jh,body:JSON.stringify({fields:{email:fStr(id),ts:fInt(Date.now())}})});return true}
  catch(e){toast(t('errCloud',e.message||e),{kind:'err',ms:3500});return false}
}

/* ---------- presence: para makita ng admin kung online ---------- */
async function ibPing(){
  if(!ibCan()||document.hidden)return;
  try{
    const users=readJSON(K_USERS,{}),st=(users[S.user]||{}).store||S.store||'';
    const via=(users[S.user]||{}).google?'google':(String(S.user).endsWith(PHONE_DOM)?'phone':'email');   // V1.2.7: nakikita ng admin kung paano nag-sign in
    const pp=(fl,f)=>clDb('/presence/'+CL.uid+'?'+fl.map(x=>'updateMask.fieldPaths='+x).join('&'),{method:'PATCH',headers:jh,body:JSON.stringify({fields:f})});
    const base={email:fStr(ibEmail()),store:fStr(st),ts:fInt(Date.now())};
    try{await pp(['email','store','ts','via'],Object.assign({via:fStr(via)},base))}
    catch(e){if(e.code==='NET')throw e;await pp(['email','store','ts'],base)}   // kung luma pa ang firestore.rules sa Firebase, ipadala pa rin ang dati
  }catch(e){}
}
// Para saan: alamin kung admin ako (GET admins/<email>); tandaan para gumana kahit offline
async function ibCheckAdmin(){
  if(!S.user||S.role==='cashier')return;
  IB.admin=store.get(K_ADMC(S.user))==='1';
  if(!ibCan())return;
  try{await clDb('/admins/'+encodeURIComponent(ibEmail()));IB.admin=true;store.set(K_ADMC(S.user),'1')}
  catch(e){if(e.status===404||e.code==='NOT_FOUND'||e.status===403||e.code==='PERMISSION_DENIED'){IB.admin=false;store.set(K_ADMC(S.user),'0')}}
}
// Para saan: simula pagkabukas ng app, at paulit-ulit na tingin
async function ibBoot(){
  if(!S.user||S.role==='cashier')return;
  await ibCheckAdmin();ibPing();ibFlush();
  if(ibIsAdmin()){await ibThreads()}else await ibPullMine();
  ibBadge();
}
setInterval(()=>{
  if(!S.user||S.role==='cashier')return;
  ibPing();ibBotTick();ibFlush();
  if(S.page==='message'&&$('#ib-body')){/* live na ang ginagawa ng ibLive */}
  else if(ibIsAdmin())ibThreads();else ibPullMine().then(ibBadge);
  ibBadge();
},30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.user){ibPing();ibBotTick()}});
// V26: bantayan ang bagong mensahe kada ~8 segundo (isang maliit na basa lang) para lumabas agad ang abiso kahit hindi bukas ang chat
setInterval(async()=>{
  if(!S.user||S.role==='cashier'||document.hidden||!ibCan())return;
  if(S.page==='message'&&$('#ib-body'))return;                       // ang ibLive na ang bahala kapag bukas
  try{
    if(ibIsAdmin()){if(Date.now()-(IB.lastList||0)>14000){IB.lastList=Date.now();await ibThreads()}}
    else{
      const d=await clDb('/threads/'+CL.uid).catch(()=>null);
      if(d){const last=fv(d.fields||{},'lastTs')||0,th=thRead(),known=th.msgs.reduce((a,m)=>Math.max(a,m.ts),0);if(last>known)await ibPullMine()}
    }
  }catch(e){}
},8000);
window.addEventListener('online',()=>{if(S.user){ibPing();ibFlush()}});
setTimeout(()=>{if(S.user)ibBoot()},4500);

Object.assign(ACTIONS,{
  'ib-topic':b=>{
    const v=b.dataset.v;
    if(v==='vip'){vipChatMenu();return}
    if(v==='sug'){IB.topic=IB.topic==='sug'?'':'sug';ibDraw();const i=$('#ib-in');if(i&&IB.topic==='sug')i.focus();return}
    IB.topic='';IB.stick=true;ibSend(t(v==='hi'?'mTopicHi':'mTopicSub'),v);
  },
  'ib-send':()=>{ibSendFree()},
  'ib-more':()=>{IB.lim+=8;ibListDraw()},
  'ib-open':b=>{ibOpenThread(b.dataset.u)},
  'ib-back':()=>{IB.open=null;IB.typing=false;ibAdminDraw();ibThreads().then(()=>{if(!IB.open)ibListDraw()})},
  'ib-reply':()=>{ibReply()},
  'ib-clear-ask':()=>{
    if(!ibIsAdmin()||!IB.open||$('#ib-clr'))return;
    const chat=$('#ib-chat');if(!chat)return;
    const d=document.createElement('div');d.id='ib-clr';d.className='ib-warn ib-clr';
    d.innerHTML='<b>'+esc(t('clrQ'))+'</b><div>'+esc(t('clrP'))+'</div><div class="ib-clr-b"><button class="btn btn-ghost" data-act="ib-clear-no">'+esc(t('dont'))+'</button><button class="btn btn-danger" data-act="ib-clear-yes">'+esc(t('clrYes'))+'</button></div>';
    chat.parentNode.insertBefore(d,chat);
  },
  'ib-clear-no':()=>{const d=$('#ib-clr');if(d)d.remove()},
  'ib-clear-yes':()=>{const d=$('#ib-clr');if(d)d.remove();ibClearChat(IB.open)},
  'ib-admin':()=>{openAdminPanel()},
  'ad-reset':async b=>{
    if(!ibIsOwner())return;
    try{await clAuthCall('sendOobCode',{requestType:'PASSWORD_RESET',email:b.dataset.e});toast(t('admResetSent',b.dataset.e))}
    catch(e){toast(t('errCloud',e.message||e),{kind:'err',ms:3500})}
  },
  'ad-verify':async()=>{
    try{const tk=await clToken();await clAuthCall('sendOobCode',{requestType:'VERIFY_EMAIL',idToken:tk});toast(t('admVerifySent'))}
    catch(e){toast(t('errCloud',e.message||e),{kind:'err',ms:3500})}
  },
  'ad-add':async()=>{
    const el=$('#ad-new');
    if(await adAdd(el?el.value.trim():''))openAdminPanel(true);
  },
  'ad-promote':async b=>{if(await adAdd(b.dataset.e)){toast(t('admMade',b.dataset.e));AD.tab='admin';openAdminPanel(true)}},
  'ad-tab':b=>{AD.tab=b.dataset.t;adDraw()},
  'ad-filter':b=>{AD.f=b.dataset.f;adDraw()},
  'ad-rm':async b=>{
    if(!ibIsOwner())return;
    try{await clDb('/admins/'+encodeURIComponent(b.dataset.id),{method:'DELETE'});openAdminPanel(true)}
    catch(e){toast(t('errCloud',e.message||e),{kind:'err',ms:3500})}
  }
});
