'use strict';
/* ============================================================
   ITO PARA SA SIGN IN / CREATE ACCOUNT   [auth.js]
   Login screen, paggawa ng account, at logout. Kapag existing na ang Gmail, login na lang.
   ============================================================ */

/* ---------- auth ---------- */
// Para saan: pang-pili ng wika sa login screen (para mapalitan bago pa mag-login)
function langPicker(){
  return '<div class="lang-pick"><label class="sr" for="lang-sel">'+esc(t('lang'))+'</label><select class="inp" id="lang-sel" aria-label="'+esc(t('lang'))+'">'+LANG_IDS.map(l=>'<option value="'+l+'"'+(prefs.lang===l?' selected':'')+'>'+LANG_NAMES[l]+'</option>').join('')+'</select></div>';
}
const PHONE_DOM='@phone.tindamo.app';
// Para saan: intindihin ang tinype: email o phone number. Ibinabalik ang {key,kind} o null
function normId(raw){
  raw=String(raw||'').trim();
  if(raw.indexOf('@')>=0){const e=raw.toLowerCase();return /^[^\s@:]+@[^\s@:]+\.[^\s@:]+$/.test(e)?{key:e,kind:'email'}:null}
  let d=raw.replace(/[^\d+]/g,'').replace(/^\+/,'');
  if(/^09\d{9}$/.test(d))d='63'+d.slice(1);else if(/^9\d{9}$/.test(d))d='63'+d;
  return /^\d{8,15}$/.test(d)?{key:'p'+d+PHONE_DOM,kind:'phone'}:null;
}
// Para saan: ipakita ang account nang maayos (phone: +63...)
const acctLabel=k=>String(k||'').endsWith(PHONE_DOM)?'+'+String(k).slice(1,-PHONE_DOM.length):String(k||'');
const GLOGO='<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
// V24: Back button kapag nag-Change account lang (hindi pa nagla-logout hangga't hindi nakakapasok sa iba)
const backBtn=()=>S.switchSess?'<button type="button" class="auth-back" data-act="auth-back">‹ '+esc(t('mBack'))+'</button>':'';
// Para saan: ipakita ang Sign in / Create account
function showAuth(){
  S.user=null;
  if(S.authMode==='cash')return showCashJoin();
  if(S.authMode==='store')return showStoreAsk();
  if(S.verify)return showVerify();
  const up=S.authMode==='up';
  const pre=S.authPrefill||'',note=S.authNote||'';S.authPrefill=S.authNote='';
  app.innerHTML=
  '<div class="auth"><div class="awning big"></div>'+backBtn()+
  '<img class="auth-logo" src="icons/icon-192.png" alt="TindaMo">'+
  '<h1 class="brand">Tinda<b>Mo</b></h1>'+
  '<p class="lead">'+esc(t('authLead'))+'</p>'+
  (up?'':recHtml())+
  langPicker()+
  '<div class="seg" role="tablist"><button role="tab" data-act="auth-mode" data-m="in" aria-selected="'+(!up)+'">'+esc(t('signin'))+'</button><button role="tab" data-act="auth-mode" data-m="up" aria-selected="'+up+'">'+esc(t('signup'))+'</button></div>'+
  '<form id="auth-form" class="stack" autocomplete="on" novalidate>'+
  (up?'<div class="field"><label for="a-store">'+esc(t('storeName'))+'</label><input class="inp" id="a-store" name="store" placeholder="'+esc(t('storePh'))+'" maxlength="40" autocomplete="organization"></div>':'')+
  (note?'<div class="hint" id="a-note" role="status" style="color:var(--text);font-weight:600">'+esc(note)+'</div>':'')+
  '<div class="field"><label for="a-user">'+esc(t('idLabel'))+'</label><input class="inp" id="a-user" name="email" type="text" inputmode="email" placeholder="'+esc(t(up?'idPhUp':'idPh'))+'" autocapitalize="none" autocomplete="username" maxlength="60" value="'+esc(pre)+'"></div>'+
  '<div class="field"><label for="a-pass">'+esc(t('password'))+'</label><input class="inp" id="a-pass" name="password" type="password" autocomplete="'+(up?'new-password':'current-password')+'"></div>'+
  '<div class="err" id="a-err" role="alert"></div>'+
  '<button class="btn btn-primary btn-block" type="button" data-act="auth-go" data-enter style="min-height:52px;font-size:16px">'+esc(up?t('makeAcct'):t('signin'))+'</button>'+
  '<div class="or-line"><span>'+esc(t('orWord'))+'</span></div>'+
  '<button type="button" class="btn btn-ghost btn-block g-btn" data-act="auth-google" style="min-height:50px">'+GLOGO+'<span>'+esc(t('googleBtn'))+'</span></button>'+
  '<button type="button" class="btn btn-ghost btn-block" data-act="auth-mode" data-m="cash">'+esc(t('cashierLink'))+'</button>'+
  '<p class="hint" style="margin:0">'+esc(t('authHint'))+'</p>'+
  '</form></div>';
  if(pre){const p=$('#a-pass');if(p)p.focus()}
}
// Para saan: screen para sa pangalan ng tindahan (bagong Google account / bagong device na walang data)
function showStoreAsk(){
  app.innerHTML='<div class="auth"><div class="awning big"></div>'+backBtn()+'<img class="auth-logo" src="icons/icon-192.png" alt="TindaMo"><h1 class="brand">Tinda<b>Mo</b></h1><p class="lead">'+esc(t('askStoreT'))+'</p>'+
  '<form class="stack" novalidate><div class="field"><label for="a-store">'+esc(t('storeName'))+'</label><input class="inp" id="a-store" placeholder="'+esc(t('storePh'))+'" maxlength="40"></div><div class="err" id="a-err" role="alert"></div>'+
  '<button class="btn btn-primary btn-block" type="button" data-act="store-ask-go" data-enter style="min-height:52px;font-size:16px">'+esc(t('makeAcct'))+'</button>'+
  '<button class="btn btn-ghost btn-block" type="button" data-act="auth-mode" data-m="in">'+esc(t('backSignin'))+'</button></form></div>';
}
/* ---------- V1.2.7: VERIFY NG EMAIL. Hindi makakapasok ang email na hindi totoo (kailangang pindutin ang link na pinadala sa inbox) ---------- */
// Para saan: ang phone-account (p63...@phone.tindamo.app) ay walang inbox, kaya hindi na i-verify
const needsVerify=k=>!String(k||'').endsWith(PHONE_DOM);
// Para saan: tanungin ang Firebase kung verified na ang email ng token na ito
async function clIsVerified(idToken){const j=await clAuthCall('lookup',{idToken});const u=(j.users||[])[0]||{};return u.emailVerified===true}
// Para saan: magpadala ng verification email
const clSendVerify=idToken=>clAuthCall('sendOobCode',{requestType:'VERIFY_EMAIL',idToken});
// Para saan: ipakita ang "Tingnan ang email mo" na screen. v={key,pw,sn,mode:'up'|'in'}
function showVerify(){
  const v=S.verify;if(!v)return showAuth();
  app.innerHTML='<div class="auth"><div class="awning big"></div><img class="auth-logo" src="icons/icon-192.png" alt="TindaMo"><h1 class="brand">Tinda<b>Mo</b></h1>'+
  '<p class="lead">'+esc(t('verT'))+'</p><div class="hint" style="color:var(--text);font-weight:600;overflow-wrap:anywhere;text-align:center">'+esc(acctLabel(v.key))+'</div><p class="hint" style="text-align:center">'+esc(t('verP'))+'</p>'+
  '<form class="stack" novalidate><div class="err" id="a-err" role="alert"></div>'+
  '<button class="btn btn-primary btn-block" type="button" data-act="ver-done" data-enter style="min-height:52px;font-size:16px">'+esc(t('verDone'))+'</button>'+
  '<button class="btn btn-ghost btn-block" type="button" data-act="ver-resend">'+esc(t('verResend'))+'</button>'+
  '<button class="btn btn-ghost btn-block" type="button" data-act="ver-back">'+esc(t('verWrong'))+'</button></form></div>';
}
// Para saan: ilipat sa verify screen at magpadala ng email
async function startVerify(v,idToken,send){
  S.verify=v;
  if(send!==false){try{await clSendVerify(idToken)}catch(x){S.verifyErr=x.code==='TOO_MANY_ATTEMPTS_TRY_LATER'?t('errMany'):''}}
  showVerify();
  if(S.verifyErr){const e=$('#a-err');if(e)e.textContent=S.verifyErr;S.verifyErr=''}
}
// Para saan: pindot sa "Na-verify ko na"
async function onVerifyDone(){
  const err=$('#a-err');err.textContent='';const v=S.verify;if(!v)return showAuth();
  try{
    const tk=await clToken();
    if(!(await clIsVerified(tk))){err.textContent=t('verNot');return}
    CL.exp=0;await clToken();                       // kunin ang bagong token na may email_verified
    S.verify=null;
    if(v.mode==='up'){await makeLocalAccount(v.key,v.pw,v.sn,false);enter(v.key);setTimeout(()=>clPush(),300);return}
    await afterCloudLogin(v.key,v.pw,!!readJSON(K_USERS,{})[v.key]);
  }catch(x){S.verify=S.verify||v;err.textContent=netErr(x)}
}
// Para saan: ipadala ulit ang verification email
async function onVerifyResend(){
  const err=$('#a-err');err.textContent='';
  try{const tk=await clToken();await clSendVerify(tk);toast(t('verSent'))}catch(x){err.textContent=netErr(x)}
}
// Para saan: bumalik sa Create account (maling email)
function onVerifyBack(){const v=S.verify;S.verify=null;if(v)clForget(v.key);S.authMode='up';S.authPrefill='';showAuth()}

/* Lumipat sa Sign in kapag may account na */
// Para saan: lumipat sa Sign in (may account na)
function goLogin(email,msg){S.authMode='in';S.authPrefill=acctLabel(email);S.authNote=msg;showAuth()}
const netErr=x=>x&&x.code==='NET'?t('errNet'):x&&x.brokenCloud?x.message:x&&x.code==='TOO_MANY_ATTEMPTS_TRY_LATER'?t('errMany'):t('errCloud',x&&x.message?x.message:x);
// Para saan: pindot sa Sign in / Create account
async function onAuth(){
  const err=$('#a-err');err.textContent='';
  try{await doAuth(err)}catch(x){err.textContent=netErr(x)}
}
// Para saan: gumawa ng bagong local na account at ipasok
async function makeLocalAccount(key,pw,storeName,google){
  const users=readJSON(K_USERS,{}),salt=google?'!':uid();
  users[key]={store:storeName,salt,hash:google?'!':await hashPw(pw,salt),code:newCode(users)};
  if(google)users[key].google=true;
  store.set(K_USERS,JSON.stringify(users));
  S.user=key;S.role='owner';S.store=storeName;S.items=[];S.sales=[];S.debts=[];S.ts=Date.now();
  store.set(K_DATA(key),JSON.stringify({items:[],sales:[],debts:[],ts:S.ts}));
}
// Para saan: pagkatapos mag-login sa cloud: ibalik o i-upload ang data
async function afterCloudLogin(key,pw,localOK){
  const users=readJSON(K_USERS,{}),have=!!users[key];
  // V1.2.6: ayos sa "INCOMPLETE" pag-login. Putol ang cloud copy (naputol ang nakaraang upload / sabay na nag-upload ang dalawang phone).
  // Subukan ulit ng 3 beses. Kung sira pa rin: kung may data na sa phone na ito, pumasok at i-upload ulit nang buo (kusang ayos).
  // Kung WALANG data sa phone (bagong phone), hindi ia-upload (mabubura ang cloud copy ng walang laman), kaya ipaalam ang dapat gawin.
  let doc;
  for(let i=0;;i++){
    try{doc=await clPull();break}
    catch(e){
      if(!(e&&e.code==='INCOMPLETE'))throw e;
      if(i<3){await new Promise(r=>setTimeout(r,1500));continue}
      // subukang bawiin ang buong data mula sa mga piraso (lipas lang ang meta)
      try{doc=await clPullRecover()}catch(y){doc=null}
      if(doc){setTimeout(()=>{CL.dirty=true;clPush()},1200);break}   // pagkatapos pumasok, ayusin ang cloud copy
      if(have){CL.state='ok';CL.ts=Date.now();enter(key);setTimeout(()=>{CL.n=0;CL.dirty=true;clPush()},300);return}
      {const bx=new Error(t('errBroken'));bx.brokenCloud=true;throw bx}
    }
  }
  CL.state='ok';CL.ts=Date.now();
  if(doc){
    const ld=readJSON(K_DATA(key),null),lts=(have&&ld&&ld.ts)||0;
    if(!have||doc.ts>=lts){await clApplyLocal(key,doc,pw);if(!have)setTimeout(()=>toast(t('restoredCloud'),{ms:3500}),600);enter(key);return}
    // mas bago ang nasa device: i-update ang cloud
    enter(key);setTimeout(()=>clPush(),300);return;
  }
  if(have){enter(key);setTimeout(()=>{CL.n=0;clPush()},300);return}      // may local, wala pang cloud: i-upload
  S.pendingAuth={key,pw,google:!pw};S.authMode='store';showAuth();         // wala sa dalawa: tanungin ang pangalan ng tindahan
}
// Para saan: tunay na pag-check at paggawa ng account
async function doAuth(err){
  const raw=$('#a-user').value,id=normId(raw),pw=$('#a-pass').value;
  const users=readJSON(K_USERS,{});
  const key=findUserKey(users,id?id.key:raw.trim().toLowerCase());
  if(!id&&!key){err.textContent=t('errId');return}
  const cloud=clOn();
  if(S.authMode==='up'){
    if(key){goLogin(key,t('hasAcct'));return}
    if(cloud&&id.kind==='phone'){err.textContent=t('errPhoneUp');return}   // V1.2.7: hindi ma-verify ang phone number (kailangan ng SMS), kaya email lang ang pwedeng gumawa ng account
    if(pw.length<(cloud?6:4)){err.textContent=t(cloud?'errPass6':'errPass4');return}
    const sn=$('#a-store').value.trim();
    if(!sn){err.textContent=t('errStore');return}
    if(cloud){
      let r;
      try{r=await clSignUp(id.key,pw)}catch(x){
        if(x.code==='EMAIL_EXISTS'){
          // may naiwan na hindi pa verified na account sa email na ito (hal. hindi natapos): kung tama ang password, ituloy ang verify
          try{const r2=await clSignIn(id.key,pw);if(!(await clIsVerified(r2.idToken))){clSession(id.key,r2);return await startVerify({key:id.key,pw,sn,mode:'up'},r2.idToken)}}catch(y){}
          goLogin(id.key,t('hasAcct'));return;
        }
        throw x;
      }
      clSession(id.key,r);
      return await startVerify({key:id.key,pw,sn,mode:'up'},r.idToken);   // V1.2.7: gagawin lang ang account pagkatapos ma-verify ang email
    }
    await makeLocalAccount(id.key,pw,sn,false);
    return enter(id.key);
  }
  if(pw.length<4){err.textContent=t('errPass4');return}
  const u=key&&users[key];
  const localOK=!!(u&&u.hash!=='!'&&u.hash===await hashPw(pw,u.salt));
  if(cloud){
    const k=key||id.key;
    try{
      const r=await clSignIn(k,pw);clSession(k,r);
      if(needsVerify(k)&&!(await clIsVerified(r.idToken)))return await startVerify({key:k,pw,sn:'',mode:'in'},r.idToken);   // V1.2.7: hindi pa verified ang email
      return await afterCloudLogin(k,pw,localOK);
    }catch(x){
      if(x.code==='NET'){if(localOK){enter(key);return}throw x}
      if(/^(INVALID_LOGIN_CREDENTIALS|EMAIL_NOT_FOUND|INVALID_PASSWORD)$/.test(x.code)){
        if(localOK){      // lumang local account na hindi pa nasa cloud: i-link
          try{const r=await clSignUp(k,pw);clSession(k,r);if(needsVerify(k))return await startVerify({key:k,pw,sn:'',mode:'in'},r.idToken);enter(key);setTimeout(()=>{CL.n=0;clPush()},300);return}
          catch(y){if(y.code==='NET'){enter(key);return}if(y.code!=='EMAIL_EXISTS')throw y}
        }
        err.textContent=t('errCreds');return;
      }
      throw x;
    }
  }
  if(!localOK){err.textContent=t('errCreds');return}
  enter(key);
}
// Para saan: Google sign-in
async function onGoogle(){
  const err=$('#a-err');if(err)err.textContent='';
  if(!clOn()){if(err)err.textContent=t('cloudOff');return}
  try{
    const tok=await clGoogleToken(),r=await clGoogleIn(tok);
    const em=canonEmail(r.email),users=readJSON(K_USERS,{}),key=findUserKey(users,em)||em;
    clSession(key,r);
    await afterCloudLogin(key,null,!!users[key]);
  }catch(x){
    const raw=String((x&&x.message)||x);
    if(/\[16\]|reauth/i.test(raw)){if(err)err.textContent=t('googleSha');return}   // V1.1.4: maling SHA-1 sa Google Cloud
    const m=x&&x.code==='NET'?t('errNet'):/GOOGLE_PLUGIN_MISSING|GOOGLE_CLIENT_ID_MISSING/.test(x&&x.message)?t('cloudOff'):raw;
    if(err)err.textContent=t('googleFail',m);
  }
}
// Para saan: tapusin ang account (pangalan ng tindahan) para sa bagong Google / bagong device
async function onStoreAsk(){
  const err=$('#a-err');err.textContent='';
  const sn=$('#a-store').value.trim(),pa=S.pendingAuth;
  if(!sn){err.textContent=t('errStore');return}
  if(!pa)return showAuth();
  await makeLocalAccount(pa.key,pa.pw||'',sn,pa.google);
  S.pendingAuth=null;enter(pa.key);setTimeout(()=>{CL.n=0;clPush()},300);
}
// Para saan: pumasok sa app pagkatapos mag-login
function enter(username){
  S.switchSess=null;
  store.set(K_SESSION,username);
  loadUser(username);
  showApp();
}
// Para saan: i-load ang data ng user o cashier
function loadUser(sess){
  const users=readJSON(K_USERS,{});let username=sess,cid=null;
  if(sess.startsWith('c:')){const p=sess.split(':');username=p[1];cid=p[2]}
  if(!users[username])return false;
  if(cid&&!cashData(username).list.some(x=>x.id===cid))return false;
  if(!users[username].code){users[username].code=newCode(users);store.set(K_USERS,JSON.stringify(users))}
  const d=readJSON(K_DATA(username),{items:[],sales:[],debts:[]});
  S.user=username;S.role=cid?'cashier':'owner';S.cid=cid;S.store=users[username].store;S.ts=d.ts||0;S.items=d.items||[];S.sales=d.sales||[];S.debts=d.debts||[];
  S.cart=[];S.tab='sell';S.q='';S.cat='';S.invq='';S.invcat='';
  recAdd(sess);   // V25: tandaan sa listahan ng mga account sa device
  return true;
}
// Para saan: mag-logout
function logout(){
  S.switchSess=null;S.verify=null;
  if(S.role==='cashier'&&S.user){const d=cashData(S.user),c=d.list.find(x=>x.id===S.cid);if(c){c.seen=0;cashSave(S.user,d)}}
  const lastU=S.user,wasOwner=S.role!=='cashier';
  const done=()=>{if(wasOwner&&lastU)clForget(lastU)};
  if(wasOwner&&lastU&&CL.uid&&CL.dirty){Promise.resolve(clPush()).then(done,done)}else done();
  store.del(K_SESSION);store.del('tindamo:verlock');{const vl=document.getElementById('verlock');if(vl)vl.remove()}S.user=null;S.role='owner';S.authMode='in';closeScanner();closeModal();showAuth();
}

/* Habang nagta-type ng Gmail sa Create account: kapag existing na, ilipat agad sa Sign in */
document.addEventListener('change',e=>{
  if(e.target.id!=='a-user'||S.authMode!=='up')return;
  const id=normId(e.target.value),key=id&&findUserKey(readJSON(K_USERS,{}),id.key);
  if(key)goLogin(key,t('hasAcct'));
});

Object.assign(ACTIONS,{
  'auth-mode':b=>{S.authMode=b.dataset.m;showAuth()},
  'auth-back':()=>{const s=S.switchSess;S.switchSess=null;S.authMode='in';if(s&&loadUser(s)){showApp();setTimeout(clBoot,800)}else showAuth()},
  'auth-go':()=>{onAuth()},
  'auth-google':()=>{onGoogle()},
  'store-ask-go':()=>{onStoreAsk()},
  'ver-done':()=>{onVerifyDone()},
  'ver-resend':()=>{onVerifyResend()},
  'ver-back':()=>{onVerifyBack()}
});
