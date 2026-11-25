'use strict';
/* ============================================================
   ITO PARA SA VERSION NG APP   [version.js]
   1) UPDATE CHECK: sa website, tinitingnan ang version.json ng sarili mong site (sa Android app: GitHub). Kung mababa ang version mo,
      lalabas ang "May bagong version" (I-update / Mamaya na). Ang "Mamaya na" ay pwede.
   2) CASHIER LOCK: ang cashier at ang may-ari ay dapat PAREHONG version. Kapag magkaiba,
      hindi makakapag-cashier ang cashier (may harang na screen) hanggang mag-update o magkapareho na.
   Para magpalit ng version: palitan ang APP_VER.ver sa ibaba, ang "version" sa version.json at sa package.json.
   ============================================================ */
const APP_VER={
  name:'TindaMo',
  ver:'1.0.3',                                          // <-- ITO ANG VERSION NG APP
  repo:'https://github.com/zhenjiro15/TindaMo',       // dito naka-upload ang mga app na ida-download
  api:'https://api.github.com/repos/zhenjiro15/TindaMo/releases/latest',
  raw:['https://raw.githubusercontent.com/zhenjiro15/TindaMo/main/version.json','https://raw.githubusercontent.com/zhenjiro15/TindaMo/master/version.json'],
  apk:'https://github.com/zhenjiro15/TindaMo/releases/latest/download/TindaMo.apk',   // V1.1.1: direktang download ng pinakabagong APK (laging ang bago, hal. 1.2)
  latest:'',                                          // pinakabagong version na nakita sa GitHub
  checkedAt:0,busy:false
};
const K_VERLOCK='tindamo:verlock';

/* ---------- paghahambing ng version (hal. 1.0 < 1.2.1) ---------- */
// Para saan: gawing listahan ng numero ang version ("v1.2.1" -> [1,2,1])
const verParts=v=>String(v||'').replace(/^[^0-9]*/,'').split('.').map(x=>parseInt(x,10)||0);
// Para saan: -1 kung mababa ang a, 0 kung pareho, 1 kung mataas ang a
function verCmp(a,b){
  const x=verParts(a),y=verParts(b),n=Math.max(x.length,y.length);
  for(let i=0;i<n;i++){const d=(x[i]||0)-(y[i]||0);if(d)return d<0?-1:1}
  return 0;
}
// Para saan: pareho ba ang version na ito sa version ng app na ito?
const verSame=v=>!!v&&verCmp(v,APP_VER.ver)===0;
// Para saan: may bagong version ba sa GitHub?
const verNewer=()=>!!APP_VER.latest&&verCmp(APP_VER.latest,APP_VER.ver)>0;

/* ---------- kunin ang pinakabagong version sa GitHub ---------- */
async function verGet(url){
  const c=new AbortController(),to=setTimeout(()=>c.abort(),9000);
  try{const r=await fetch(url,{cache:'no-store',signal:c.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}
  finally{clearTimeout(to)}
}
// Para saan: alamin ang pinakabagong version (una: Releases ng GitHub; ikalawa: version.json sa repo)
async function verFetchLatest(){
  try{
    const j=await verGet(APP_VER.api);
    if(j&&j.tag_name){
      // V1.1.1: kunin ang mismong APK ng release na iyon para direkta na ang download
      const a=(j.assets||[]).find(x=>/\.apk$/i.test(x.name||''));
      if(a&&a.browser_download_url)APP_VER.apk=a.browser_download_url;
      return String(j.tag_name).replace(/^[^0-9]*/,'');
    }
  }catch(e){}
  for(const u of APP_VER.raw){try{const j=await verGet(u);if(j&&j.version)return String(j.version)}catch(e){}}
  return '';
}
// Para saan: i-check kung may bagong version. force=true: ipakita agad ang resulta kahit wala (galing sa button)
async function verCheck(force){
  if(APP_VER.busy||!navigator.onLine)return force?toast(t('errNet'),{kind:'err'}):0;
  if(!force&&Date.now()-APP_VER.checkedAt<6*3600*1000)return;
  APP_VER.busy=true;
  const v=await verFetchLatest();
  APP_VER.busy=false;
  if(!v){if(force)toast(t('verFail'),{kind:'err'});return}
  APP_VER.latest=v;APP_VER.checkedAt=Date.now();
  if(verNewer()){
    const later=readJSON('tindamo:verlater',{});
    if(force||!(later.v===v&&Date.now()-later.ts<24*3600*1000))verPrompt();   // "Mamaya na" = tahimik sa loob ng 24 oras
    else verSettingsUpd();
  }else if(force)toast(t('verUpToDate',APP_VER.ver),{ms:2500});
  verSettingsUpd();
}

/* ---------- "May bagong version" (pwedeng Mamaya na) ---------- */
// Para saan: ipakita ang pop-up na may bagong version
function verPrompt(){
  if($('#verbox')||$('#verlock')||$('#verforce'))return;
  const b=document.createElement('div');b.id='verbox';b.className='verbox';b.setAttribute('role','alertdialog');
  b.innerHTML='<div class="vb-card"><div class="vb-ic">'+I.box+'</div><h2>'+esc(t('verNewT'))+'</h2>'+
    '<p>'+esc(t('verNewP',APP_VER.ver,APP_VER.latest))+'</p>'+
    '<div class="vb-b"><button class="btn btn-ghost" data-act="ver-later">'+esc(t('verLater'))+'</button><button class="btn btn-primary" data-act="ver-update">'+esc(t('verUpdate'))+'</button></div></div>';
  document.body.appendChild(b);
}
// Para saan: i-download agad ang pinakabagong APK (hindi na ang pangunahing page ng GitHub)
function verOpenBrowser(){
  const u=APP_VER.apk||APP_VER.repo;
  try{const w=window.open(u,'_blank');if(!w)location.href=u}catch(e){location.href=u}
}
const verOpen=verOpenBrowser;
// Para saan: i-update ang linya ng version sa Settings (kung bukas)
function verSettingsUpd(){
  const b=$('#ver-row');if(b)b.innerHTML=verRowHtml();
}
// Para saan: laman ng linya ng version sa Settings
function verRowHtml(){
  const nw=verNewer();
  return '<div class="ver-line"><b>'+esc(APP_VER.name)+'</b><span class="chip">v'+esc(APP_VER.ver)+'</span></div>'+
    '<div class="hint" style="margin:6px 0 10px">'+esc(nw?t('verNewP',APP_VER.ver,APP_VER.latest):t('verUpToDate',APP_VER.ver))+'</div>'+
    '<div class="row"><button class="btn btn-ghost" data-act="ver-check">'+esc(t('verCheck'))+'</button>'+
    '<button class="btn '+(nw?'btn-primary':'btn-dark')+'" data-act="ver-update">'+esc(t('verUpdate'))+'</button></div>';
}
const verSettingsHtml=()=>'<div class="set-sec"><span class="lbl">'+esc(t('verT'))+'</span><div id="ver-row">'+verRowHtml()+'</div></div>';

/* ---------- CASHIER LOCK: dapat parehong version sa may-ari ---------- */
// Para saan: naka-lock ba ang cashier ngayon dahil magkaiba ang version?
const verLocked=()=>S.role==='cashier'&&!!$('#verlock');
// Para saan: ipakita ang harang na screen (hindi maisasara). ov = version ng may-ari ('' kung luma na ang app niya at walang version)
function verLockShow(ov){
  store.set(K_VERLOCK,ov||'?');
  S.cart=[];
  const old=ov?verCmp(APP_VER.ver,ov)<0:false;                  // mas mababa ang version ng cashier
  const msg=ov?(old?t('verLockOld',APP_VER.ver,ov):t('verLockNew',APP_VER.ver,ov)):t('verLockUnk',APP_VER.ver);
  let b=$('#verlock');
  if(!b){b=document.createElement('div');b.id='verlock';b.className='verlock';b.setAttribute('role','alertdialog');document.body.appendChild(b)}
  b.innerHTML='<div class="vb-card"><div class="vb-ic warn">'+I.lock+'</div><h2>'+esc(t('verLockT'))+'</h2><p>'+esc(msg)+'</p>'+
    '<div class="vb-vs"><span>'+esc(t('verYou'))+'<b>v'+esc(APP_VER.ver)+'</b></span><span>'+esc(t('verOwner'))+'<b>'+(ov?'v'+esc(ov):'?')+'</b></span></div>'+
    '<div class="vb-b col"><button class="btn btn-primary btn-block" data-act="ver-update">'+esc(t('verUpdate'))+'</button>'+
    '<button class="btn btn-ghost btn-block" data-act="ver-recheck">'+esc(t('verRecheck'))+'</button>'+
    '<button class="btn btn-ghost btn-block" data-act="ver-logout">'+esc(t('logout'))+'</button></div></div>';
  const v=$('#verbox');if(v)v.remove();
  closeModal();
}
// Para saan: tanggalin ang harang kapag magkapareho na ang version
function verLockClear(){
  store.del(K_VERLOCK);
  const b=$('#verlock');if(b){b.remove();toast(t('verOk'),{ms:2500})}
}
// Para saan: sinusuri ng cashier ang version ng may-ari. Ibinabalik ang true kung PAREHO (tuloy ang cashier)
function verCashierCheck(ownerVer){
  if(verSame(ownerVer)){verLockClear();return true}
  verLockShow(ownerVer);return false;
}
// Para saan: pagbukas ng app (cashier): kung naka-lock noon at hindi pa nag-iiba ang version, ibalik agad ang harang
function verBootLock(){
  const ov=store.get(K_VERLOCK);
  if(!ov||S.role!=='cashier')return;
  if(ov!=='?'&&verSame(ov)){store.del(K_VERLOCK);return}
  verLockShow(ov==='?'?'':ov);
}

Object.assign(D,{
verT:[`Bersyon ng app`,`App version`,`앱 버전`,`应用版本`,`アプリのバージョン`],
verNewT:[`May bagong version!`,`New version available!`,`새 버전이 있어요!`,`有新版本！`,`新しいバージョンがあります！`],
verNewP:[`Ang version mo ay {0}. Ang pinakabago ay {1}. Mag-update para makuha ang mga bago at ayos.`,`You have {0}. The latest is {1}. Update to get the newest features and fixes.`,`현재 {0}, 최신은 {1}입니다. 업데이트하세요.`,`当前 {0}，最新 {1}。请更新以获得新功能和修复。`,`現在 {0}、最新は {1} です。更新してください。`],
verUpToDate:[`Pinakabago na ang version mo ({0}).`,`You're on the latest version ({0}).`,`최신 버전입니다 ({0}).`,`已是最新版本（{0}）。`,`最新バージョンです（{0}）。`],
verUpdate:[`I-update`,`Update`,`업데이트`,`更新`,`更新する`],
verLater:[`Mamaya na`,`Later`,`나중에`,`稍后`,`あとで`],
verCheck:[`Tingnan kung may bago`,`Check for updates`,`업데이트 확인`,`检查更新`,`更新を確認`],
verFail:[`Hindi makita ang pinakabagong version. Subukan ulit pag may internet.`,`Couldn't check for updates. Try again when online.`,`업데이트를 확인할 수 없어요. 온라인에서 다시 시도하세요.`,`无法检查更新，请联网后重试。`,`更新を確認できませんでした。オンラインで再試行してください。`],
verLockT:[`Kailangan mag-update`,`Update needed`,`업데이트가 필요해요`,`需要更新`,`更新が必要です`],
verLockOld:[`Mas luma ang version mo ({0}) kaysa sa may-ari ({1}). Mag-update para makapag-cashier.`,`Your version ({0}) is older than the owner's ({1}). Update to use the cashier.`,`내 버전({0})이 사장님 버전({1})보다 낮아요. 업데이트해야 계산할 수 있어요.`,`你的版本（{0}）低于店主版本（{1}）。请更新后再收银。`,`あなたのバージョン（{0}）はオーナー（{1}）より古いです。更新してください。`],
verLockNew:[`Magkaiba ang version mo ({0}) at ng may-ari ({1}). Dapat parehong version para makapag-cashier. Hintayin na mag-update ang may-ari, o ibalik sa parehong version.`,`Your version ({0}) differs from the owner's ({1}). Both must be the same to use the cashier. Ask the owner to update, or install the same version.`,`내 버전({0})과 사장님 버전({1})이 달라요. 같은 버전이어야 계산할 수 있어요.`,`你的版本（{0}）与店主版本（{1}）不同，必须相同才能收银。`,`あなたのバージョン（{0}）とオーナー（{1}）が異なります。同じバージョンが必要です。`],
verLockUnk:[`Hindi pa tugma ang version mo ({0}) sa may-ari. Dapat parehong version. Mag-update, o hilingin sa may-ari na mag-update.`,`Your version ({0}) doesn't match the owner's. Both must be the same. Update, or ask the owner to update.`,`내 버전({0})이 사장님 버전과 맞지 않아요. 같은 버전이어야 해요.`,`你的版本（{0}）与店主版本不匹配，必须相同。`,`あなたのバージョン（{0}）がオーナーと一致しません。同じバージョンが必要です。`],
verYou:[`Ikaw`,`You`,`나`,`你`,`あなた`],
verOwner:[`May-ari`,`Owner`,`사장님`,`店主`,`オーナー`],
verRecheck:[`Tingnan ulit`,`Check again`,`다시 확인`,`重新检查`,`再確認`],
verOk:[`Tugma na ang version. Pwede nang mag-cashier!`,`Versions match. You can use the cashier now!`,`버전이 일치해요. 이제 계산할 수 있어요!`,`版本已一致，可以收银了！`,`バージョンが一致しました。レジを使えます！`],
verCashDiff:[`Iba ang version ({0})`,`Different version ({0})`,`다른 버전 ({0})`,`版本不同（{0}）`,`異なるバージョン（{0}）`]
});
Object.assign(ACTIONS,{
  'ver-later':()=>{store.set('tindamo:verlater',JSON.stringify({v:APP_VER.latest,ts:Date.now()}));const b=$('#verbox');if(b)b.remove()},
  'ver-check':()=>{verCheck(true)},
  'ver-logout':()=>{logout()},
  'ver-recheck':()=>{if(typeof shCashierTick==='function'){SH.busyC=false;shCashierTick()}toast(t('verRecheck'),{ms:1200})}
});
