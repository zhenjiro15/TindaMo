'use strict';
/* ============================================================
   ITO PARA SA PROFILE AT SETTINGS   [profile.js]
   PROFILE (tindahan, backup, Clear Data, Delete Account, Change account, Log out), SETTINGS (wika, tema, abiso, tunog) at CASHIER (code, listahan, auto-link). Menu: tatlong guhit sa header.
   ============================================================ */

/* ---------- settings, cashiers, logout ---------- */
// Para saan: header ng pop-up page
const pgHead=title=>'<div class="sheet-h"><h2>'+esc(title)+'</h2><button class="icon-btn" data-act="close-modal" aria-label="'+esc(t('close'))+'">'+I.x+'</button></div>';
// Para saan: buksan ang page ayon sa pangalan (profile / settings / cashier)
function openPage(p){S.page=p;({profile:openProfile,settings:openSettings,cashier:openCashierPage,message:openMessage,admin:openAdminPanel,gcash:openGcash,sync:openSync}[p]||openSettings)()}

/* ---------- menu (tatlong guhit) ---------- */
// Para saan: buksan / isara ang menu sa tabi ng kampana
function toggleMenu(btn){
  const old=$('#menu-pop');if(old){old.remove();return}
  const r=btn.getBoundingClientRect(),m=document.createElement('div');
  m.id='menu-pop';m.className='menu-pop';m.setAttribute('role','menu');
  m.style.top=(r.bottom+8)+'px';m.style.right=Math.max(8,window.innerWidth-r.right)+'px';
  const un=typeof ibUnread==='function'?ibUnread():0,items=[['profile',I.user,t('profile')],['settings',I.gear,t('settings')],['cashier',I.users,t('cashier')]];
  if(S.role!=='cashier')items.push(['sync',I.cloud,t('syT')]);                           // V1.2.1: Sync
  if(S.role!=='cashier')items.push(['gcash',I.gcash,'GCash']);                         // V1.1.3: GCash
  if(S.role!=='cashier')items.push(['message',I.msg,t('msg'),un]);                        // V23: Message
  if(typeof ibIsAdmin==='function'&&ibIsAdmin())items.push(['admin',I.shield,t('admT')]);  // V23: Admin (users online/offline)
  m.innerHTML=items.map(x=>'<button role="menuitem" data-act="page" data-p="'+x[0]+'">'+x[1]+'<span>'+esc(x[2])+'</span>'+(x[3]?'<em class="mn">'+(x[3]>99?'99+':x[3])+'</em>':'')+'</button>').join('');
  document.body.appendChild(m);
}
const closeMenu=()=>{const m=$('#menu-pop');if(m)m.remove()};
document.addEventListener('click',e=>{if(!$('#menu-pop'))return;if(e.target.closest('#menu-pop')||e.target.closest('[data-act="menu"]'))return;closeMenu()},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});

/* ---------- PROFILE ---------- */
// Para saan: PROFILE: tindahan, backup, clear data, delete, change account, log out
function openProfile(){
  S.page='profile';
  const own=S.role!=='cashier';
  openModal(pgHead(t('profile'))+
  '<div class="row" style="align-items:center;gap:12px">'+(own?avMineHtml():'<div class="avatar" style="--h:'+hue(S.store)+'">'+esc(S.store.charAt(0).toUpperCase())+'</div>')+'<div style="min-width:0"><strong>'+esc(S.store)+'</strong><div class="hint" style="overflow-wrap:anywhere">'+(own?esc(acctLabel(S.user)):esc(t('cashier')))+'</div>'+(own?'<div class="vip-chips">'+vipChips()+'</div>':'')+'</div></div>'+
  vipProfileHtml()+
  (own?'<div class="set-sec"><span class="lbl">'+t('storeName')+'</span><div class="row"><input class="inp" id="st-name" maxlength="40" value="'+esc(S.store)+'" autocomplete="off"><button class="btn btn-dark" data-act="store-save">'+esc(t('save'))+'</button></div></div>':'')+
  (own?'<div class="set-sec"><span class="lbl">'+esc(t('bkTitle'))+'</span><div id="bk-box" class="bk-box">'+clStatusHtml()+'</div></div>':'')+
  (own?'<div class="set-sec stack"><span class="lbl">'+esc(t('danger'))+'</span><button class="btn btn-ghost btn-block" data-act="clear-ask">'+esc(t('clearData'))+'</button><button class="btn btn-ghost btn-block" data-act="clear-debt-ask">'+esc(t('clearDebt'))+'</button><button class="btn btn-danger btn-block" data-act="del-acc-ask">'+esc(t('delAccount'))+'</button></div>':'')+
  '<div class="set-sec stack"><button class="btn btn-ghost btn-block" data-act="switch-acc">'+esc(t('change'))+'</button>'+(own?'<button class="btn btn-danger btn-block" data-act="logout">'+I.out+' '+esc(t('logout'))+'</button>':'<button class="btn btn-danger btn-block" data-act="leave-ask">'+I.out+' '+esc(t('tmLeave'))+'</button>')+'</div>');   // V1.2.8: cashier = Leave (aalis sa tindahan), hindi logout
}

/* ---------- SETTINGS ---------- */
const SFX_LABELS={scan:'sfxScan',success:'sfxSuccess',error:'sfxError'};
// Para saan: SETTINGS: wika, tema, abiso, tunog (SFX)
function openSettings(){
  S.page='settings';
  const sfxRows=Object.keys(SFX_LABELS).map(k=>{const c=sfxIsCustom(k);
    return '<div class="sfx-row"><div class="sfx-nm"><b>'+esc(t(SFX_LABELS[k]))+'</b><span class="hint">'+esc(c?(prefs.sfxName&&prefs.sfxName[k])||'Custom':t('sfxDefault'))+'</span></div>'+
    '<div class="sfx-bt"><button class="icon-btn sm" data-act="sfx-test" data-k="'+k+'" aria-label="'+esc(t('sfxTest'))+'" title="'+esc(t('sfxTest'))+'">'+I.play+'</button>'+
    '<button class="btn btn-ghost" style="min-height:34px;padding:0 12px;font-size:13px" data-act="sfx-pick" data-k="'+k+'">'+esc(t('sfxPick'))+'</button>'+
    (c?'<button class="btn btn-ghost" style="min-height:34px;padding:0 12px;font-size:13px" data-act="sfx-reset" data-k="'+k+'">'+esc(t('sfxReset'))+'</button>':'')+'</div></div>'}).join('');
  openModal(pgHead(t('settings'))+
  '<div class="set-sec"><span class="lbl">'+t('lang')+'</span><select class="inp" id="lang-sel">'+LANG_IDS.map(l=>'<option value="'+l+'"'+(prefs.lang===l?' selected':'')+'>'+LANG_NAMES[l]+'</option>').join('')+'</select></div>'+
  '<div class="set-sec"><span class="lbl">'+t('theme')+'</span><div class="seg seg3">'+['auto','light','dark'].map(x=>'<button data-act="theme" data-v="'+x+'" aria-selected="'+(prefs.theme===x)+'">'+t(x)+'</button>').join('')+'</div></div>'+
  '<div class="set-sec"><span class="lbl">'+esc(t('accT'))+'</span><div class="acc-row">'+[['tinda','accTinda','#FFC400','#E5383B'],['pula','accPula','#E5383B','#FFC400'],['berde','accBerde','#16A34A','#F59E0B'],['asul','accAsul','#2563EB','#06B6D4'],['ube','accUbe','#7C3AED','#EC4899']].map(a=>'<button class="acc" data-act="accent" data-v="'+a[0]+'" aria-pressed="'+((prefs.accent||'tinda')===a[0])+'" aria-label="'+esc(t(a[1]))+'" title="'+esc(t(a[1]))+'" style="--a:'+a[2]+';--b:'+a[3]+'"><i></i></button>').join('')+
    '<button type="button" class="acc acc-custom" data-act="cp-open" aria-pressed="'+(prefs.accent==='custom')+'" aria-label="'+esc(t('accCustom'))+'" title="'+esc(t('accCustom'))+'" style="--a:'+esc(prefs.accentC||'#FFC400')+'"><i></i></button></div></div>'+
  '<div class="set-sec"><span class="lbl">'+esc(t('goalT'))+'</span><div class="row"><input class="inp" id="goal-in" type="number" inputmode="decimal" min="0" step="any" placeholder="1000" value="'+(Number(prefs.goal)||'')+'"><button class="btn btn-dark" data-act="goal-save">'+esc(t('save'))+'</button></div><div class="hint" style="margin-top:6px">'+esc(t('goalHint'))+'</div></div>'+
  '<div class="set-sec"><button type="button" class="switch" role="switch" aria-checked="'+notifOn()+'" data-act="notif-toggle"><span class="st">'+esc(t('notifOnLbl'))+'</span><span class="tgl"></span></button><div class="hint" style="margin-top:6px">'+esc(notifHint())+'</div></div>'+remField()+
  '<div class="set-sec"><button type="button" class="switch" role="switch" aria-checked="'+(prefs.sound!==false)+'" data-act="sound-toggle"><span class="st">'+esc(t('soundOn'))+'</span><span class="tgl"></span></button></div>'+
  '<div class="set-sec"><span class="lbl">'+esc(t('sfxT'))+'</span><div class="sfx-list">'+sfxRows+'</div><div class="hint" style="margin-top:8px">'+esc(t('sfxHint'))+'</div></div>'+verSettingsHtml());
}

/* ---------- CASHIER ---------- */
// Para saan: CASHIER (hiwalay sa Profile at Settings): code, pagsali, listahan, auto-link
function openCashierPage(){
  S.page='cashier';
  const own=S.role!=='cashier',users=readJSON(K_USERS,{}),code=(users[S.user]||{}).code||'',cd=cashData(S.user);
  openModal(pgHead(t('cashier'))+
  (own&&cd.list.length?'<button class="btn btn-dark btn-block" style="margin-top:4px" data-act="team-open">'+I.cart+' '+esc(t('tmOpen'))+'</button>':'')+
  (own?'<div class="set-sec cqr" style="margin-top:4px"><span class="lbl">'+esc(t('cqrT'))+'</span><div id="cash-qr" class="cash-qr"></div></div>':'')+
  (own?'<div class="set-sec"><span class="lbl">'+t('code')+'</span><div class="code-box">'+codeBoxes(code)+'</div>'+
   '<button type="button" class="switch" style="margin-top:12px" role="switch" aria-checked="'+cd.open+'" data-act="allow-toggle"><span class="st">'+t('allow')+'</span><span class="tgl"></span></button></div>':'')+
  (own?'':'<div class="set-sec"><span class="lbl">'+esc(t('shStatus'))+'</span>'+shStatusHtml()+'</div>')+
  (own?'<div class="set-sec"><span class="lbl">'+t('cashiers')+' ('+cd.list.length+')</span><div id="cash-list"></div></div>':''));
  if(own){lkJoinQR();drawCash();lkMine();const T=setInterval(()=>{if(!$('#cash-list'))clearInterval(T);else drawCash()},5000)}
}
// Para saan: tanong bago mag-logout
function askLogout(){openModal('<div class="sheet-h"><h2>'+t('sure')+'</h2></div><div class="sheet-f"><button class="btn btn-ghost" data-act="close-modal">'+esc(t('no'))+'</button><button class="btn btn-danger" style="flex:1" data-act="logout-yes">'+esc(t('yes'))+'</button></div>')}
// Para saan: i-save ang pangalan ng tindahan
function saveStoreName(){
  const v=($('#st-name').value||'').trim();
  if(v.length<2){toast(t('errStoreName'),{kind:'err'});return}
  const users=readJSON(K_USERS,{});if(!users[S.user])return;
  users[S.user].store=v;store.set(K_USERS,JSON.stringify(users));S.store=v;
  const l=document.querySelector('.logo small');if(l)l.innerHTML=esc(v)+'<span id="net"></span>';
  netUpd();save();openProfile();toast(t('storeNameSaved'));
}
// Para saan: oo/hindi na confirm
function confirmBox(title,msg,yesAct,yesLabel){
  openModal('<div class="sheet-h"><h2>'+title+'</h2></div><p class="hint" style="margin:0 0 4px">'+msg+'</p><div class="sheet-f"><button class="btn btn-ghost" data-act="close-modal">'+esc(t('dont'))+'</button><button class="btn btn-danger" style="flex:1" data-act="'+yesAct+'">'+yesLabel+'</button></div>');
}
// Para saan: burahin ang items, benta at utang
function clearData(){
  gcFoldSales(S.sales);S.items=[];S.sales=[];S.debts=[];S.cart=[];save();closeModal();renderView();toast(t('dataCleared'));
}
// Para saan: burahin ang account (pati ang online na kopya)
async function delAccount(){
  const u=S.user;
  if(clOn()&&clRestore(u)){
    try{await clDeleteAll()}catch(e){
      if(e.code==='NET'){toast(t('needNetDel'),{kind:'err',ms:3500});return}
      if(e.code==='CANCEL'){CL.dirty=true;CL.n=0;try{clPush()}catch(x){};return}   // V1.1.9: kinansela ang password; ibalik ang online na kopya
      if(/^(INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD)$/.test(e.code)){CL.dirty=true;CL.n=0;try{clPush()}catch(x){};toast(t('errCreds'),{kind:'err',ms:3500});return}
      if(e.code!=='NOSESSION'&&e.status!==404){toast(t('errCloud',e.message||e),{kind:'err',ms:3500});return}
    }
    clForget(u);
  }
  delLocalAcct(u);
  S.user=null;S.role='owner';S.authMode='in';closeScanner();closeModal();showAuth();toast(t('acctDeleted'));
}
// Para saan: burahin ang lahat ng nasa phone na kaugnay ng account (V1.1.9: hiwalay para magamit din kapag binura ng Admin)
function delLocalAcct(u){
  const users=readJSON(K_USERS,{});
  delete users[u];store.set(K_USERS,JSON.stringify(users));
  store.del(K_DATA(u));store.del(K_GC(u));store.del(K_VIP(u));store.del(K_CASH(u));store.del(K_SESSION);if(typeof recDrop==='function')recDrop(u);
  store.del(K_BAN(u));store.del(K_CLOUD(u));
}

Object.assign(ACTIONS,{
  'logout':()=>{askLogout()},
  'logout-yes':()=>{logout()},
  'switch-acc':async()=>{   // V25: hintayin muna matapos ang backup bago lumipat ng account
    S.switchSess=store.get(K_SESSION)||null;
    if(S.role!=='cashier'&&typeof CL!=='undefined'&&CL.uid&&CL.dirty)clPush();
    closeModal();
    if(typeof CL!=='undefined'&&CL.busy){try{await Promise.race([CL.busy,new Promise(r=>setTimeout(r,5000))])}catch(e){}}
    S.authMode='in';showAuth()},
  'menu':b=>{toggleMenu(b)},
  'accent':b=>{prefs.accent=b.dataset.v;savePrefs();applyAccent();openSettings()},
  'goal-save':()=>{const v=parseFloat($('#goal-in').value);prefs.goal=v>0?r2(v):0;prefs.goalDay=0;savePrefs();toast(t('goalSaved'));updateSell()},
  'page':b=>{closeMenu();openPage(b.dataset.p)},
  'settings':()=>{openSettings()},
  'store-save':()=>{saveStoreName()},
  'clear-ask':()=>{if(S.role!=='cashier')confirmBox(t('sureQ'),t('clearP'),'clear-yes',t('yesClear'))},
  'clear-yes':()=>{clearData()},
  'del-acc-ask':()=>{if(S.role!=='cashier')confirmBox(t('sureQ'),t('delAccP'),'del-acc-yes',t('yesDelAcc'))},
  'del-acc-yes':()=>{delAccount()},
  'sfx-test':b=>{sfxPlay(b.dataset.k,true)},
  'sfx-pick':b=>{sfxPick(b.dataset.k)},
  'sfx-reset':b=>{sfxReset(b.dataset.k).then(openSettings)},
  'sound-toggle':()=>{prefs.sound=prefs.sound===false;savePrefs();openSettings();if(prefs.sound!==false)sfx('scan')},
  'theme':b=>{prefs.theme=b.dataset.v;savePrefs();applyPrefs();openSettings()}
});
