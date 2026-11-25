'use strict';
/* ============================================================
   ITO PARA SA ONLINE DATABASE   [cloud.js]
   Firebase Auth + Firestore gamit ang REST (walang dagdag na library).
   - Login: email, phone number (+ password), Google
   - Auto-backup ng items, benta, utang, cashier list pagkatapos ng bawat save
   - Kapag na-uninstall ang app: mag-login lang, babalik ang lahat ng data
   ============================================================ */
const CLC=window.TINDAMO_CLOUD||{};
const clOn=()=>!!(CLC.apiKey&&CLC.projectId);
const K_CLOUD=u=>'tindamo:cloud:'+u;
const CL={user:null,uid:null,id:null,exp:0,refresh:null,state:clOn()?'idle':'off',ts:0,err:'',dirty:false,timer:null,busy:null,n:0};
const FS=()=>'https://firestore.googleapis.com/v1/projects/'+CLC.projectId+'/databases/(default)/documents';

// Para saan: tawag sa network; may malinaw na error code
async function clFetch(url,o){
  let r;
  try{r=await fetch(url,o)}catch(e){const x=new Error('NET');x.code='NET';throw x}
  let j=null;try{j=await r.json()}catch(e){}
  if(!r.ok){
    const m=(j&&j.error&&(j.error.message||j.error.status))||('HTTP '+r.status);
    const x=new Error(m);x.code=String(m).split(' ')[0].replace(/:$/,'');x.status=r.status;throw x;
  }
  return j||{};
}
const clAuthCall=(p,b)=>clFetch('https://identitytoolkit.googleapis.com/v1/accounts:'+p+'?key='+CLC.apiKey,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
// Para saan: Firebase email ng account (Gmail: iisa ang may tuldok / +tag)
const clEmail=k=>canonEmail(k);
const clSignUp=(e,pw)=>clAuthCall('signUp',{email:clEmail(e),password:pw,returnSecureToken:true});
const clSignIn=(e,pw)=>clAuthCall('signInWithPassword',{email:clEmail(e),password:pw,returnSecureToken:true});
const clGoogleIn=tok=>clAuthCall('signInWithIdp',{postBody:(tok.id?'id_token=':'access_token=')+encodeURIComponent(tok.id||tok.access)+'&providerId=google.com',requestUri:'http://localhost',returnSecureToken:true,returnIdpCredential:true});

// Para saan: tandaan ang session ng cloud para sa user
function clSession(userKey,r){
  CL.user=userKey;CL.uid=r.localId;CL.id=r.idToken;CL.refresh=r.refreshToken;CL.exp=Date.now()+(parseInt(r.expiresIn,10)||3600)*1000;
  store.set(K_CLOUD(userKey),JSON.stringify({uid:CL.uid,refresh:CL.refresh}));
  CL.state='idle';
}
// Para saan: ibalik ang session ng cloud kapag nag-restart ang app
function clRestore(userKey){
  if(!clOn())return false;
  if(CL.user===userKey&&CL.uid)return true;
  const s=readJSON(K_CLOUD(userKey),null);if(!s||!s.refresh)return false;
  CL.user=userKey;CL.uid=s.uid;CL.refresh=s.refresh;CL.id=null;CL.exp=0;CL.state='idle';return true;
}
function clForget(userKey){
  if(userKey)store.del(K_CLOUD(userKey));
  if(!userKey||CL.user===userKey){CL.user=CL.uid=CL.id=CL.refresh=null;CL.exp=0;CL.state=clOn()?'idle':'off'}
}
// Para saan: valid na token (nagre-refresh kapag kailangan)
async function clToken(){
  if(CL.id&&CL.exp>Date.now()+60000)return CL.id;
  if(!CL.refresh){const x=new Error('NOSESSION');x.code='NOSESSION';throw x}
  const r=await clFetch('https://securetoken.googleapis.com/v1/token?key='+CLC.apiKey,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=refresh_token&refresh_token='+encodeURIComponent(CL.refresh)});
  CL.id=r.id_token;CL.refresh=r.refresh_token||CL.refresh;CL.uid=r.user_id||CL.uid;CL.exp=Date.now()+(parseInt(r.expires_in,10)||3600)*1000;
  if(CL.user)store.set(K_CLOUD(CL.user),JSON.stringify({uid:CL.uid,refresh:CL.refresh}));
  return CL.id;
}
async function clDb(path,o){
  const tk=await clToken();
  o=o||{};o.headers=Object.assign({Authorization:'Bearer '+tk},o.headers||{});
  return clFetch(FS()+path,o);
}
const fStr=v=>({stringValue:String(v)}),fInt=v=>({integerValue:String(Math.round(v))});
const gInt=f=>f&&f.integerValue!=null?parseInt(f.integerValue,10):0;

/* ---------- basa ---------- */
// V1.2.6: basahin ang LAHAT ng dokumento sa isang collection (sinusundan ang nextPageToken; dati isang pahina lang ang kinukuha)
async function clListAll(path){
  let docs=[],tok='';
  for(let g=0;g<60;g++){
    const l=await clDb(path+(path.indexOf('?')>=0?'&':'?')+'pageSize=100'+(tok?'&pageToken='+encodeURIComponent(tok):''));
    docs=docs.concat(l.documents||[]);
    if(!l.nextPageToken)break;tok=l.nextPageToken;
  }
  return {documents:docs};
}
// V1.2.6: kunin ang mga piraso ng backup. Una ang listahan; kung kulang ang nakuha, kunin isa-isa ang bawat piraso (0..n-1) para hindi
// magkamali dahil lang sa listahan (hal. malaki ang data at hindi lahat ibinalik sa isang tawag).
async function clGetParts(uid,n){
  const conv=d=>({i:gInt(d.fields.i),ts:gInt(d.fields.ts),d:(d.fields.d||{}).stringValue||''});
  let l;try{l=await clListAll('/users/'+uid+'/parts')}catch(e){if(e&&(e.status===404||e.code==='NOT_FOUND'))l={documents:[]};else throw e}
  let parts=(l.documents||[]).map(conv).filter(p=>p.i<n);
  const okAll=a=>{const m={};a.forEach(p=>m[p.i]=p);for(let i=0;i<n;i++)if(!m[i])return false;return true};
  if(!okAll(parts)){
    const got={};parts.forEach(p=>got[p.i]=p);
    for(let i=0;i<n;i+=3){
      const idx=[];for(let k=i;k<Math.min(n,i+3);k++)if(!got[k])idx.push(k);
      const docs=await Promise.all(idx.map(k=>clDb('/users/'+uid+'/parts/'+k).catch(e=>{if(e&&(e.status===404||e.code==='NOT_FOUND'))return null;throw e})));
      docs.forEach(d=>{if(d&&d.fields){const p=conv(d);got[p.i]=p}});
    }
    parts=Object.keys(got).map(k=>got[k]).filter(p=>p.i<n);
  }
  return parts.sort((a,b)=>a.i-b.i);
}
// Para saan: kunin ang buong backup ng account (o null kung wala pa)
async function clPull(){
  let meta;
  try{meta=await clDb('/users/'+CL.uid)}catch(e){if(e.status===404||e.code==='NOT_FOUND')return null;throw e}
  const f=meta.fields||{},n=gInt(f.n),ts=gInt(f.ts);
  let parts=[];
  if(n>0){
    parts=await clGetParts(CL.uid,n);
    if(parts.length!==n||parts.some(p=>p.ts!==ts)){const x=new Error('INCOMPLETE');x.code='INCOMPLETE';throw x}
  }
  CL.n=n;
  const payload=n?JSON.parse(parts.map(p=>p.d).join('')):null;
  return {ts,store:(f.store||{}).stringValue||'',code:(f.code||{}).stringValue||'',payload};
}

// V1.2.6: PAGBAWI kapag "INCOMPLETE". Kapag naputol ang upload pagkatapos maisulat ang mga piraso pero bago ang meta, buo pa rin pala ang bagong data
// (pareho ang ts ng mga piraso, 0,1,2... at nababasa ang JSON), lipas lang ang meta. Hanapin ang pinakabagong buong grupo at gamitin iyon.
// Ibinabalik ang doc (parang clPull) o null kung talagang wala nang mababawi.
async function clPullRecover(){
  let meta={};
  try{meta=await clDb('/users/'+CL.uid)}catch(e){if(!(e&&(e.status===404||e.code==='NOT_FOUND')))throw e}
  const f=(meta&&meta.fields)||{};
  const l=await clListAll('/users/'+CL.uid+'/parts');
  const all=(l.documents||[]).map(d=>({i:gInt(d.fields.i),ts:gInt(d.fields.ts),d:(d.fields.d||{}).stringValue||''}));
  if(!all.length)return null;
  const tss=[...new Set(all.map(p=>p.ts))].sort((a,b)=>b-a);
  for(const ts of tss){
    const g=all.filter(p=>p.ts===ts).sort((a,b)=>a.i-b.i);
    if(!g.every((p,k)=>p.i===k))continue;
    let payload;try{payload=JSON.parse(g.map(p=>p.d).join(''))}catch(e){continue}
    if(!payload||typeof payload!=='object'||!Array.isArray(payload.items))continue;
    CL.n=Math.max.apply(null,all.map(p=>p.i))+1;   // para mabura ng susunod na upload ang lumang sobrang piraso
    return {ts,store:payload.store||(f.store||{}).stringValue||'',code:payload.code||(f.code||{}).stringValue||'',payload,recovered:true};
  }
  return null;
}

/* ---------- sulat ---------- */
const CHUNK=250000;
// Para saan: i-upload ang kasalukuyang data ng may-ari
async function clPush(){
  if(!clOn()||!CL.uid||S.role==='cashier'||!S.user||CL.user!==S.user)return;
  if(CL.busy){CL.again=true;return CL.busy}
  if(CL.pre)return CL.pre;
  // V1.2.8: bago mag-upload, tingnan kung may mas bago galing sa ibang device (hal. website at Android na iisang account) at pagsamahin muna,
  // para hindi mapalitan ng luma ang benta/stock ng kabila.
  {const user=S.user;CL.pre=clLiveSync().catch(()=>{}).then(()=>{CL.pre=null});await CL.pre;if(S.user!==user||CL.user!==user||S.role==='cashier')return;if(CL.busy){CL.again=true;return CL.busy}}
  const users=readJSON(K_USERS,{}),u=users[S.user]||{};
  const ts=S.ts||Date.now();
  const ackS=S.sales.map(s=>s.id),ackD=S.debts.map(d=>d.id),ackU=S.user;
  const text=JSON.stringify({v:2,ts,store:S.store,code:u.code||'',items:S.items,sales:S.sales,debts:S.debts,cash:cashData(S.user),gcash:readJSON(K_GC(S.user),null),clog:tmLogs().slice(0,300)});   // buuin agad bago ang await
  const parts=[];for(let i=0;i<text.length;i+=CHUNK)parts.push(text.slice(i,i+CHUNK));
  const uid=CL.uid,prevN=CL.n,name=p=>'projects/'+CLC.projectId+'/databases/(default)/documents'+p;
  CL.state='busy';CL.dirty=false;clUi();
  CL.busy=(async()=>{
    try{
      const jhd={'Content-Type':'application/json'};
      const partW=i=>({update:{name:name('/users/'+uid+'/parts/'+i),fields:{i:fInt(i),ts:fInt(ts),d:fStr(parts[i])}}});
      const metaW=()=>{const w=[{update:{name:name('/users/'+uid),fields:{v:fInt(2),ts:fInt(ts),n:fInt(parts.length),store:fStr(S.store||''),code:fStr(u.code||'')}}}];for(let i=parts.length;i<prevN;i++)w.push({delete:name('/users/'+uid+'/parts/'+i)});return w};
      if(parts.length<=8){
        // V1.2.6: isang commit lang (lahat o wala) para hindi na maputol ang cloud copy kapag naputol ang internet / nag-close ang app sa gitna ng upload (ito ang sanhi ng "INCOMPLETE")
        const writes=parts.map((d,i)=>partW(i)).concat(metaW());
        await clDb(':commit',{method:'POST',headers:jhd,body:JSON.stringify({writes})});
      }else{
        for(let i=0;i<parts.length;i+=6){
          const writes=parts.slice(i,i+6).map((d,k)=>partW(i+k));
          await clDb(':commit',{method:'POST',headers:jhd,body:JSON.stringify({writes})});
        }
        await clDb(':commit',{method:'POST',headers:jhd,body:JSON.stringify({writes:metaW()})});
      }
      CL.n=parts.length;CL.state='ok';CL.ts=Date.now();CL.err='';
      CL.knownFor=ackU;CL.knownTs=ts;clAckAdd(ackU,ackS,ackD);   // V1.2.8: tandaan kung ano ang nasa cloud na
    }catch(e){CL.state=e.code==='NET'?'wait':'err';CL.err=e.code==='NET'?'':String(e.message||e);CL.dirty=true}
    CL.busy=null;clUi();
    if(CL.again){CL.again=false;clQueue()}
  })();
  return CL.busy;
}
// Para saan: ipila ang backup (tinatawag ng save())
function clQueue(){
  if(!clOn()||!CL.uid||S.role==='cashier'||!S.user||CL.user!==S.user)return;
  CL.dirty=true;clearTimeout(CL.timer);CL.timer=setTimeout(()=>{clPush()},2500);
}
// Para saan: i-update ang status sa Profile kung bukas
function clUi(){const b=document.getElementById('bk-box');if(b)b.innerHTML=clStatusHtml()}
function clStatusHtml(){
  let msg,cls='';
  if(!clOn())msg=t('bkNone');
  else if(!CL.uid)msg=t('bkNoLink');
  else if(CL.state==='busy'){msg=t('bkBusy')}
  else if(CL.state==='ok'){msg=t('bkOk',tFmt(CL.ts));cls='ok'}
  else if(CL.state==='wait'){msg=t('bkWait');cls='warn'}
  else if(CL.state==='err'){msg=t('bkFail',CL.err);cls='bad'}
  else msg=t('bkWait');
  return '<span class="chip '+cls+'">'+esc(msg)+'</span>'+(clOn()&&CL.uid?'<button class="btn btn-ghost" style="min-height:38px;margin-left:8px" data-act="bk-now">'+esc(t('bkNow'))+'</button>':'');
}
// Para saan: ibalik ang data mula sa cloud papunta sa device
function clApplyLocal(userKey,doc,pw){
  return (async()=>{
    const users=readJSON(K_USERS,{}),old=users[userKey]||{};
    const rec={store:doc.store||'',code:doc.code};
    if(pw){rec.salt=uid();rec.hash=await hashPw(pw,rec.salt)}else{rec.salt=old.salt||'!';rec.hash=old.hash||'!';if(rec.hash==='!')rec.google=true}
    users[userKey]=Object.assign({},old,rec);store.set(K_USERS,JSON.stringify(users));
    const p=doc.payload||{};
    store.set(K_DATA(userKey),JSON.stringify({items:p.items||[],sales:p.sales||[],debts:p.debts||[],ts:doc.ts}));
    if(p.cash)cashSave(userKey,p.cash);
    if(p.gcash)store.set(K_GC(userKey),JSON.stringify(p.gcash));
    if(p.clog)tmMergeLogs(userKey,p.clog);
  })();
}
// Para saan: pagbukas ng app: kunin ang mas bago (cloud o device)
async function clBoot(){
  if(!clOn()||!S.user||S.role==='cashier'||!clRestore(S.user)||!navigator.onLine)return;
  try{
    const doc=await clPull();
    if(!doc){clPush();return}
    CL.knownFor=S.user;CL.knownTs=doc.ts;
    if(doc.ts>(S.ts||0)+1000&&!S.cart.length&&!$('#modal').classList.contains('open')){
      await clApplyLocal(S.user,doc,null);
      const sess=store.get(K_SESSION);loadUser(sess);showApp();CL.state='ok';CL.ts=Date.now();
    }else if((S.ts||0)>doc.ts+1000)clPush();
    else{CL.state='ok';CL.ts=Date.now()}
  }catch(e){
    if(e.code==='INCOMPLETE'){CL.dirty=true;clPush();return}   // V1.2.2: sira/putol ang cloud copy: i-upload ulit nang buo mula sa phone na ito
    CL.state=e.code==='NET'?'wait':'err';CL.err=e.code==='NET'?'':String(e.message||e)
  }
  clUi();
}
// Para saan: burahin ang lahat ng online data at ang online account
async function clDeleteAll(skipAuth){
  if(!clOn()||!CL.uid)return;
  const uid=CL.uid;
  const l=await clListAll('/users/'+uid+'/parts').catch(e=>{if(e.status===404)return{};throw e});
  const nm=p=>'projects/'+CLC.projectId+'/databases/(default)/documents'+p;
  const writes=(l.documents||[]).map(d=>({delete:d.name}));writes.push({delete:nm('/users/'+uid)});
  await clDb(':commit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({writes})});
  if(!skipAuth)await clDeleteAuth();
}
// V1.1.9: burahin ang login account. Kapag "CREDENTIAL_TOO_OLD_LOGIN_AGAIN", mag-login muna ulit (password o Google) saka burahin.
async function clDeleteAuth(){
  const tk=await clToken();
  try{await clAuthCall('delete',{idToken:tk});return}
  catch(e){
    if(e.code==='USER_NOT_FOUND')return;                       // wala na pala
    if(!/^(CREDENTIAL_TOO_OLD_LOGIN_AGAIN|TOKEN_EXPIRED|INVALID_ID_TOKEN)$/.test(e.code))throw e;
  }
  const r=await clReauth();
  CL.id=r.idToken;CL.refresh=r.refreshToken||CL.refresh;CL.exp=Date.now()+(parseInt(r.expiresIn,10)||3600)*1000;
  await clAuthCall('delete',{idToken:r.idToken});
}
// Para saan: ulitin ang login para sa bagong token. Google account = Google ulit; ibang account = itanong ang password
async function clReauth(){
  const users=readJSON(K_USERS,{}),u=users[CL.user]||{};
  if(u.google){const tok=await clGoogleToken();return clGoogleIn(tok)}
  const pw=await clAskPw();
  return clSignIn(CL.user,pw);
}
// Para saan: maliit na kahon na humihingi ng password (resolve = password, reject CANCEL = kinansela)
function clAskPw(){
  return new Promise((ok,no)=>{
    const old=document.getElementById('pwbox');if(old)old.remove();
    const b=document.createElement('div');b.id='pwbox';b.className='verbox xbox';b.setAttribute('role','dialog');
    b.innerHTML='<div class="vb-card"><h2>'+esc(t('reauthT'))+'</h2><p>'+esc(t('reauthP'))+'</p>'+
      '<input class="inp" id="rd-pw" type="password" autocomplete="current-password" placeholder="'+esc(t('password'))+'" style="margin:6px 0 12px">'+
      '<div class="vb-b"><button class="btn btn-ghost" id="rd-no">'+esc(t('cancel'))+'</button><button class="btn btn-danger" id="rd-yes">'+esc(t('reauthGo'))+'</button></div></div>';
    document.body.appendChild(b);
    const fin=(f,v)=>{b.remove();f(v)};
    b.querySelector('#rd-no').onclick=()=>{const x=new Error('CANCEL');x.code='CANCEL';fin(no,x)};
    const go=()=>{const v=b.querySelector('#rd-pw').value;if(v)fin(ok,v)};
    b.querySelector('#rd-yes').onclick=go;
    b.querySelector('#rd-pw').addEventListener('keydown',e=>{if(e.key==='Enter')go()});
    setTimeout(()=>b.querySelector('#rd-pw').focus(),60);
  });
}
// Para saan: Google token (Android plugin o web)
async function clGoogleToken(){
  const P=(window.Capacitor&&window.Capacitor.Plugins)||{};
  if(P.GoogleAuth&&P.GoogleAuth.signIn){const r=await P.GoogleAuth.signIn(),a=r&&r.authentication;if(a&&a.idToken)return {id:a.idToken};if(a&&a.accessToken)return {access:a.accessToken};throw new Error('walang token')}
  if(P.SocialLogin&&P.SocialLogin.login){
    if(!CLC.googleClientId)throw new Error('GOOGLE_CLIENT_ID_MISSING');
    if(!clGoogleToken.ready){await P.SocialLogin.initialize({google:{webClientId:CLC.googleClientId}});clGoogleToken.ready=true}   // V27.1: kailangan muna ito bago mag-login
    const r=await P.SocialLogin.login({provider:'google',options:{}}),x=r&&r.result;if(x&&x.idToken)return {id:x.idToken};if(x&&x.accessToken&&x.accessToken.token)return {access:x.accessToken.token};throw new Error('walang token')}
  if(NATIVE.on)throw new Error('GOOGLE_PLUGIN_MISSING');
  if(!CLC.googleClientId)throw new Error('GOOGLE_CLIENT_ID_MISSING');
  if(!(window.google&&google.accounts&&google.accounts.oauth2))await new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.onload=ok;s.onerror=()=>no(new Error('NET'));document.head.appendChild(s)});
  return new Promise((ok,no)=>{
    const c=google.accounts.oauth2.initTokenClient({client_id:CLC.googleClientId,scope:'openid email profile',callback:r=>r&&r.access_token?ok({access:r.access_token}):no(new Error((r&&r.error)||'cancel')),error_callback:e=>no(new Error((e&&e.type)||'cancel'))});
    c.requestAccessToken();
  });
}

/* ============================================================
   V1.2.8: LIVE SYNC NG MAY-ARI (iisang account sa phone, laptop at website)
   Kapag may benta / pagbabago sa isang device, makikita agad (mga 7 segundo) sa kabila. Pinagsasama ang benta at utang (walang mawawala,
   walang doble); ang item ay ang mas bagong edit (uts) ang masusunod. Ang stock ay inaayos ayon sa mga benta ng kabilang device.
   ============================================================ */
const K_CACK=u=>'tindamo:cack:'+u;
// Para saan: mga benta/utang na alam nating nasa cloud na (para malaman kung binura ng kabilang device o hindi pa naa-upload)
function clAckGet(u){const o=readJSON(K_CACK(u),{s:[],d:[]});return {s:new Set(o.s||[]),d:new Set(o.d||[])}}
function clAckAdd(u,sIds,dIds){const a=clAckGet(u);sIds.forEach(x=>a.s.add(x));dIds.forEach(x=>a.d.add(x));store.set(K_CACK(u),JSON.stringify({s:[...a.s].slice(-3000),d:[...a.d].slice(-3000)}))}
// Para saan: tingnan kung mas bago ang nasa cloud kaysa sa alam ng device na ito; kung oo, kunin at pagsamahin. Ibinabalik ang true kung may nabago.
async function clLiveSync(){
  if(!clOn()||!S.user||S.role==='cashier'||!navigator.onLine||!clRestore(S.user)||CL.user!==S.user)return false;
  const user=S.user;
  if(CL.knownFor!==user){CL.knownFor=user;CL.knownTs=0}
  let meta;try{meta=await clDb('/users/'+CL.uid)}catch(e){if(e&&(e.status===404||e.code==='NOT_FOUND'))return false;throw e}
  const ts=gInt((meta.fields||{}).ts);
  if(!ts||ts<=(CL.knownTs||0))return false;
  if(!CL.knownTs&&ts<=(S.ts||0)){CL.knownTs=ts;return false}      // unang tingin: tugma na sa device na ito
  const doc=await clPull();
  if(S.user!==user||!doc||!doc.payload)return false;
  clMergeIn(doc);CL.knownTs=doc.ts;return true;
}
// Para saan: pagsamahin ang galing sa cloud (doc) at ang nasa device na ito
function clMergeIn(doc){
  const p=doc.payload||{},u=S.user,ack=clAckGet(u),dI=p.items||[],dS=p.sales||[],dD=p.debts||[];
  const dSid=new Set(dS.map(s=>s.id)),dDid=new Set(dD.map(d=>d.id)),lSid=new Set(S.sales.map(s=>s.id));
  const keepS=S.sales.filter(s=>!dSid.has(s.id)&&!ack.s.has(s.id));      // gawa rito, hindi pa naa-upload
  const keepD=S.debts.filter(d=>!dDid.has(d.id)&&!ack.d.has(d.id));
  const newS=dS.filter(s=>!lSid.has(s.id)&&!ack.s.has(s.id));            // gawa sa kabilang device, bago pa rito
  const out={},inn={};
  keepS.forEach(s=>(s.lines||[]).forEach(l=>{out[l.id]=(out[l.id]||0)+l.qty}));
  newS.forEach(s=>(s.lines||[]).forEach(l=>{inn[l.id]=(inn[l.id]||0)+l.qty}));
  const lmap={};S.items.forEach(i=>{lmap[i.id]=i});
  let localNew=keepS.length>0||keepD.length>0;
  const items=[],seen=new Set();
  dI.forEach(d=>{
    seen.add(d.id);const l=lmap[d.id];
    if(l&&(l.uts||0)>(d.uts||0)){                                          // mas bago ang edit dito
      const c=Object.assign({},l);if(c.stockOn&&inn[c.id])c.stock=Math.max(0,(Number(c.stock)||0)-inn[c.id]);items.push(c);localNew=true;
    }else{
      const c=Object.assign({},d);if(c.stockOn&&out[c.id])c.stock=Math.max(0,(Number(c.stock)||0)-out[c.id]);items.push(c);
    }
  });
  S.items.forEach(l=>{if(!seen.has(l.id)&&(l.uts||0)>doc.ts){items.push(l);localNew=true}});   // bagong item dito na wala pa sa cloud
  S.items=items;
  S.sales=keepS.concat(dS).sort((a,b)=>b.ts-a.ts).slice(0,500);
  S.debts=dD.concat(keepD).sort((a,b)=>a.ts-b.ts);
  clAckAdd(u,dS.map(s=>s.id),dD.map(d=>d.id));
  const users=readJSON(K_USERS,{});let nameCh=false;
  if(users[u]){if(doc.store&&users[u].store!==doc.store){users[u].store=doc.store;S.store=doc.store;nameCh=true}if(doc.code)users[u].code=doc.code;store.set(K_USERS,JSON.stringify(users))}
  if(p.cash)tmMergeCash(u,p.cash,doc.ts);
  if(p.gcash&&!localNew&&!CL.dirty)store.set(K_GC(u),JSON.stringify(p.gcash));
  tmMergeLogs(u,p.clog||[]);
  S.ts=Math.max(S.ts||0,doc.ts);
  if(localNew)save();                                                       // may sariling pagbabago pa rito: i-upload ang pinagsama
  else{store.set(K_DATA(u),JSON.stringify({items:S.items,sales:S.sales,debts:S.debts,ts:S.ts}));if(typeof shopQueue==='function')shopQueue()}
  if(nameCh){const l=document.querySelector('.logo small');if(l)l.innerHTML=esc(S.store)+'<span id="net"></span>';netUpd()}
  S.cart=S.cart.filter(l=>byId(l.id));
  if(typeof shRefresh==='function')shRefresh();
  if($('#tm-box')&&typeof tmDraw==='function')tmDraw();
}
setInterval(()=>{
  if(document.hidden||!S.user||S.role==='cashier'||!clOn()||CL.busy||CL.pre)return;
  clLiveSync().then(ch=>{if(ch)clUi()}).catch(()=>{});
},7000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(()=>{if(S.user&&S.role!=='cashier'&&!CL.busy&&!CL.pre)clLiveSync().catch(()=>{})},400)});
window.addEventListener('online',()=>{if(CL.dirty)clPush();else clBoot()});
Object.assign(ACTIONS,{'bk-now':()=>{CL.dirty=true;clPush().then(()=>{if(CL.state==='ok')toast(t('bkDone'))})}});
