'use strict';
/* ============================================================
   ITO PARA SA TAKDANG ARAW NG UTANG AT MGA ABISO   [reminders.js]
   Pumili ng 5 / 7 / 10 araw (o sariling bilang) kapag may utang.
   Kapag malapit na o lampas na, may abiso sa kasaysayan (kampana) at sa phone.
   ============================================================ */

const DAY=864e5;
const K_NOTIF=u=>'tindamo:notifs:'+u;
// Para saan: dulo ng araw (11:59 PM) matapos ang n araw
const dueFromDays=(ts,n)=>{const d=new Date(ts+n*DAY);d.setHours(23,59,59,999);return d.getTime()};
const dueDate=ts=>new Date(ts).toLocaleDateString(loc(),{month:'short',day:'numeric'});

/* ---------- pagpili ng takdang araw ---------- */
// Para saan: HTML ng "Bayaran sa loob ng: 5 / 7 / 10 / iba / walang takda"
function dueField(id){
  const cur=prefs.dueDays===undefined?7:prefs.dueDays;
  const pr=n=>'aria-pressed="'+(cur===n)+'"';
  return '<div class="field due-field" id="'+id+'" data-days="'+cur+'"><label>'+esc(t('dueIn'))+'</label><div class="due-chips">'+
    [5,7,10].map(n=>'<button type="button" data-act="due-pick" data-g="'+id+'" data-d="'+n+'" '+pr(n)+'>'+esc(t('dueDaysN',n))+'</button>').join('')+
    '<button type="button" data-act="due-pick" data-g="'+id+'" data-d="0" '+pr(0)+'>'+esc(t('dueNone'))+'</button>'+
    '<input class="inp due-custom" type="number" inputmode="numeric" min="1" max="365" step="1" placeholder="'+esc(t('dueCustom'))+'" aria-label="'+esc(t('dueCustom'))+'"'+([0,5,7,10].includes(cur)?'':' value="'+cur+'"')+'>'+
    '</div></div>';
}
// Para saan: ilang araw ang napili (0 = walang takda)
function readDays(id){const g=$('#'+id);const n=g?parseInt(g.dataset.days,10):0;return isNaN(n)?0:Math.min(365,Math.max(0,n))}
// Para saan: iuwi ang takdang araw at tandaan ang huling pinili
function dueStamp(days,ts){prefs.dueDays=days;savePrefs();return days>0?dueFromDays(ts,days):null}
document.addEventListener('input',e=>{
  const c=e.target;if(!c.classList||!c.classList.contains('due-custom'))return;
  const g=c.closest('.due-field'),n=parseInt(c.value,10);
  if(n>0){g.dataset.days=Math.min(365,n);g.querySelectorAll('[data-act="due-pick"]').forEach(b=>b.setAttribute('aria-pressed','false'))}
});

/* ---------- V27: ilang araw bago ang bayaran magpapaalala ---------- */
const REM_OPTS=[7,5,3,2,1];
// Para saan: mga "araw bago" na napili ng may-ari (default: 3 at 1 araw bago). Laging may abiso sa mismong araw at kapag lampas na.
const remLead=()=>(Array.isArray(prefs.remind)?prefs.remind.filter(n=>REM_OPTS.includes(n)):[3,1]).sort((a,b)=>b-a);
// Para saan: ilang araw (kalendaryo) bago ang takdang araw; 0 = ngayon, negatibo = lampas na
const daysTo=due=>{const d=new Date(due);d.setHours(0,0,0,0);return Math.round((d.getTime()-dayStart())/DAY)};
// Para saan: aling hakbang ng paalala (bilang ng araw bago) ang kasalukuyan; para isang beses lang bawat hakbang
function remBucket(dd){let b=0;const L=remLead().concat([1,0]).sort((a,b2)=>b2-a);for(const x of L){if(dd<=x)b=x}return b}

/* ---------- kalagayan ng takdang araw ---------- */
// Para saan: lampas na, malapit na, o malayo pa
function dueState(c){
  if(!c.due||c.bal<=0.004)return null;
  const now=Date.now();
  if(c.due<now)return{k:'over',days:Math.max(1,Math.ceil((now-c.due)/DAY))};
  const dd=daysTo(c.due);
  if(dd<=0)return{k:'soon',dd:0,when:t('dueToday')};
  if(dd===1)return{k:'soon',dd:1,when:t('dueTomorrow')};
  if(dd<=Math.max(0,...remLead()))return{k:'soon',dd,when:t('dueInDays',dd)};   // V27: malapit na (ayon sa napiling araw)
  return{k:'far',when:t('dueOn',dueDate(c.due))};
}
// Para saan: maliit na chip para sa listahan ng utang
function dueChip(c){
  const s=dueState(c);if(!s)return '';
  if(s.k==='over')return '<span class="chip bad">'+esc(t('dueOver',s.days))+'</span>';
  if(s.k==='soon')return '<span class="chip warn">'+esc(s.when)+'</span>';
  return '<span class="chip">'+esc(s.when)+'</span>';
}

/* ---------- kasaysayan ng abiso (kampana) ---------- */
const notifs=()=>S.user?readJSON(K_NOTIF(S.user),[]):[];
const notifSave=a=>store.set(K_NOTIF(S.user),JSON.stringify(a.slice(0,100)));
// Para saan: bilang ng hindi pa nabasa sa kampana
function bellUpd(){
  const n=notifs().filter(x=>!x.read).length,b=$('#bdot');
  if(b){b.hidden=!n;b.textContent=n>99?'99+':n}
}
/* ---------- V23: abiso ng item na malapit nang ma-expire ---------- */
// Para saan: ilang araw na lang bago ma-expire ang item (negatibo = expired na)
const expDays=it=>Math.round((new Date(it.exp+'T00:00:00').getTime()-dayStart())/DAY);
// Para saan: aling "hakbang" ng babala (7 / 3 / 1 araw, ngayon, expired) para isang beses lang bawat hakbang
const expBucket=d=>d<0?'x':d===0?'0':d<=1?'1':d<=3?'3':d<=7?'7':null;
// Para saan: mga item na may expiry at may stock pa (kung walang stock, wala nang mae-expire)
const expItems=()=>S.items.filter(it=>it.expOn&&it.exp&&!(it.stockOn&&(Number(it.stock)||0)<=0));
// Para saan: tingnan kung may utang na malapit na o lampas na; gumawa ng abiso
function checkDue(){
  if(!S.user)return;
  const list=notifs(),have=new Set(list.map(n=>n.id)),fresh=[];
  expItems().forEach(it=>{
    const d=expDays(it),b=expBucket(d);if(!b)return;
    const id='e|'+it.id+'|'+it.exp+'|'+b;if(have.has(id))return;
    fresh.push({id,ts:Date.now(),k:'exp',item:it.id,name:it.name,d,read:false});
  });
  owing().forEach(c=>{
    const s=dueState(c);if(!s||s.k==='far')return;
    const id=c.key+'|'+c.due+'|'+(s.k==='over'?'o'+s.days:'s'+remBucket(s.dd));
    if(have.has(id))return;
    fresh.push({id,ts:Date.now(),k:s.k,key:c.key,name:c.name,amt:c.bal,days:s.days||0,when:s.when||'',read:false});
  });
  if(fresh.length){notifSave(fresh.concat(list));fresh.forEach(sysNotify)}
  bellUpd();snapDue();
}
// Para saan: teksto ng abiso
const nTitle=n=>n.k==='exp'?t(n.d<0?'nExpOverT':'nExpSoonT'):t(n.k==='over'?'nOverT':'nSoonT');
const nBody=n=>n.k==='exp'?(n.d<0?t('nExpOverB',n.name,-n.d):n.d===0?t('nExpTodayB',n.name):t('nExpSoonB',n.name,n.d)):n.k==='over'?t('nOverB',n.name,fmt(n.amt),n.days):t('nSoonB',n.name,fmt(n.amt),n.when);
// Para saan: abiso sa phone (kapag pinayagan)
async function sysNotify(n){
  if(!('Notification' in window)||Notification.permission!=='granted'||prefs.notif===false)return;
  const o={body:nBody(n),icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:n.id,vibrate:[120,60,120]};
  try{const reg=navigator.serviceWorker&&await navigator.serviceWorker.getRegistration();if(reg){await reg.showNotification(nTitle(n),o);return}}catch(e){}
  try{new Notification(nTitle(n),o)}catch(e){}
}
// Para saan: ilista sa cache ang may takdang araw para mabasa ng service worker kahit sarado ang app
async function snapDue(){
  if(NATIVE.on)NATIVE.scheduleDue(owing().filter(x=>x.due).map(x=>({key:x.key,name:x.name,bal:x.bal,due:x.due})),prefs.notif!==false,expItems().map(it=>({id:it.id,name:it.name,exp:new Date(it.exp+'T00:00:00').getTime()})),{n:owing().length,total:r2(owing().reduce((a,c)=>a+c.bal,0))});   // Android app: i-schedule ang abiso
  try{
    if(!('caches' in window))return;
    const c=await caches.open('tindamo-due');
    const list=owing().filter(x=>x.due).map(x=>({key:x.key,name:x.name,bal:x.bal,due:x.due}));
    await c.put('due.json',new Response(JSON.stringify({on:prefs.notif!==false,lead:Math.max(1,...remLead()),list})));
  }catch(e){}
}
// Para saan: subukang magrehistro ng background check (Chrome Android, naka-install na app)
async function regPeriodic(){
  if(NATIVE.on)return;
  try{
    const reg=await navigator.serviceWorker.ready;
    if(!('periodicSync' in reg))return;
    const st=await navigator.permissions.query({name:'periodic-background-sync'});
    if(st.state==='granted')await reg.periodicSync.register('tindamo-due',{minInterval:12*3600*1000});
  }catch(e){}
}
// Para saan: hingin ang permiso ng abiso (dapat galing sa pindot ng user)
function askNotif(){
  if(prefs.notif===false||!('Notification' in window)||Notification.permission!=='default')return;
  try{Notification.requestPermission().then(p=>{if(p==='granted'){regPeriodic();checkDue()}})}catch(e){}
}
// Para saan: buksan ang listahan ng mga abiso
function openNotifs(){
  const list=notifs();
  openModal('<div class="sheet-h"><h2>'+esc(t('notifs'))+'</h2><button class="icon-btn" data-act="close-modal" aria-label="'+esc(t('close'))+'">'+I.x+'</button></div>'+
  (list.length?'<div class="nt-list">'+list.map(n=>'<button class="nt'+(n.read?'':' unread')+'" data-act="open-notif" data-k="'+esc(n.key||'')+'" data-i="'+esc(n.item||'')+'" data-n="'+esc(n.k==='exp'?n.name:'')+'"><span class="nd"></span><div style="min-width:0"><b>'+esc(nTitle(n))+'</b><div>'+esc(nBody(n))+'</div><small>'+esc(dstr(n.ts))+'</small></div></button>').join('')+'</div>'+
    '<div class="sheet-f"><button class="btn btn-ghost" data-act="notif-clear">'+esc(t('notifClear'))+'</button></div>'
  :'<div class="card empty"><p>'+esc(t('notifNone'))+'</p></div>'));
  if(list.some(n=>!n.read)){notifSave(list.map(n=>Object.assign({},n,{read:true})));bellUpd()}
}
// Para saan: mga chip ng "paalalahanan ako ... araw bago" para sa Settings
function remField(){
  const cur=remLead();
  return '<div class="set-sec"><span class="lbl">'+esc(t('remLead'))+'</span><div class="due-chips">'+
    REM_OPTS.map(n=>'<button type="button" data-act="rem-toggle" data-d="'+n+'" aria-pressed="'+cur.includes(n)+'">'+esc(t('dueDaysN',n))+'</button>').join('')+
    '</div><div class="hint" style="margin-top:6px">'+esc(t('remHint'))+'</div>'+
    '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-ghost" style="min-height:38px;padding:0 14px" data-act="notif-test">'+I.bell+' '+esc(t('remTest'))+'</button><button type="button" class="btn btn-ghost" style="min-height:38px;padding:0 14px" data-act="notif-test-closed">'+esc(t('remTestClosed'))+'</button></div></div>'+
    '<div class="set-sec"><button type="button" class="switch" role="switch" aria-checked="'+(prefs.daily!==false)+'" data-act="daily-toggle"><span class="st">'+esc(t('dailyOnLbl'))+'</span><span class="tgl"></span></button><div class="hint" style="margin-top:6px">'+esc(t('dailyHint'))+'</div></div>'+
    (NATIVE.on?'<div class="set-sec"><span class="lbl">'+esc(t('closedT'))+'</span>'+(NATIVE.exact===false?'<button type="button" class="btn btn-primary btn-block" data-act="exact-fix" style="margin-bottom:8px">'+esc(t('exactFix'))+'</button>':'')+'<div class="hint">'+esc(t('closedTip'))+'</div></div>':'');
}
// Para saan: katayuan ng abiso para sa Settings
const notifOn=()=>prefs.notif!==false&&'Notification' in window&&Notification.permission==='granted';
function notifHint(){
  if(!('Notification' in window))return t('notifNoSupport');
  if(Notification.permission==='denied')return t('notifBlocked');
  return t('notifHint');
}
Object.assign(ACTIONS,{
  'due-pick':b=>{
    const g=$('#'+b.dataset.g);if(!g)return;
    g.dataset.days=b.dataset.d;
    g.querySelectorAll('[data-act="due-pick"]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
    const c=g.querySelector('.due-custom');if(c)c.value='';
  },
  'notifs':()=>openNotifs(),
  'open-notif':b=>{if(b.dataset.i){closeModal();S.tab='inv';S.invq=b.dataset.n||'';S.invcat='';renderView();return}openCustomer(b.dataset.k)},
  'rem-toggle':b=>{
    const n=parseInt(b.dataset.d,10),cur=remLead(),has=cur.includes(n);
    prefs.remind=has?cur.filter(x=>x!==n):cur.concat([n]);savePrefs();
    snapDue();checkDue();openSettings();
  },
  'notif-test':()=>{
    if(!notifOn()){toast(notifHint(),{kind:'warn',ms:3800});return}
    sysNotify({id:'test|'+Date.now(),k:'soon',name:t('remTestName'),amt:150,when:t('dueTomorrow')});
    toast(t('remTestSent'));
  },
  'notif-clear':()=>{notifSave([]);bellUpd();openNotifs()},
  'notif-toggle':()=>{
    if(notifOn()){prefs.notif=false;savePrefs();snapDue();openSettings();return}
    prefs.notif=true;savePrefs();
    if(!('Notification' in window)||Notification.permission==='denied'){toast(t(('Notification' in window)?'notifBlocked':'notifNoSupport'),{kind:'warn',ms:3800});openSettings();return}
    if(Notification.permission==='granted'){regPeriodic();snapDue();openSettings();return}
    Notification.requestPermission().then(p=>{if(p==='granted'){regPeriodic();checkDue()}else toast(t('notifBlocked'),{kind:'warn',ms:3800});openSettings()});
  }
});
