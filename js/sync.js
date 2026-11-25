'use strict';
/* ============================================================
   ITO PARA SA OFFLINE SYNC (walang internet)   [sync.js]
   Ipasa ang file sa kabilang phone (Bluetooth / Quick Share / Nearby Share), tapos i-import.
   Walang madodoble na benta at utang. Si may-ari ang masusunod sa mga item at presyo.
   ============================================================ */

// Para saan: buuin ang laman ng file na ipapasa
function syncBuild(){
  const users=readJSON(K_USERS,{}),u=users[S.user]||{};
  let cashier=null;
  if(S.role==='cashier'){const c=cashData(S.user).list.find(x=>x.id===S.cid);cashier=c?c.name:null}
  return {app:'tindamo-sync',v:1,ts:Date.now(),owner:S.user,store:S.store,code:u.code||'',from:S.role,cashier,items:S.items,sales:S.sales,debts:S.debts,loc:S.myLoc||null,gcash:S.role==='cashier'?undefined:gcPub()};
}
// Para saan: ipasa ang file (share sheet ng phone), o i-download kung hindi kaya
async function syncShare(){
  const text=JSON.stringify(syncBuild());
  const name='TindaMo-'+(S.store||'tindahan').replace(/[^\w-]+/g,'_')+'-'+new Date().toISOString().slice(0,10)+'.json';
  if(NATIVE.on){try{await NATIVE.shareFile(name,text);return}catch(e){if(/cancel/i.test(String((e&&e.message)||e)))return}}   // Android app: share sheet
  const file=new File([text],name,{type:'application/json'});
  if(navigator.canShare&&navigator.canShare({files:[file]})){
    try{await navigator.share({files:[file],title:'TindaMo'});return}catch(e){if(e&&e.name==='AbortError')return}
  }
  const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=name;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500);
  toast(t('syncSaved'),{sub:name,ms:3500});
}
// Para saan: piliin ang file na tatanggapin
function syncPick(){
  const i=document.createElement('input');i.type='file';i.accept='.json,application/json';
  i.onchange=()=>{const f=i.files&&i.files[0];if(f)f.text().then(x=>{let o=null;try{o=JSON.parse(x)}catch(e){}syncIngest(o)})};
  i.click();
}
const syncValid=o=>o&&o.app==='tindamo-sync'&&o.v===1&&Array.isArray(o.items)&&Array.isArray(o.sales)&&Array.isArray(o.debts)&&o.code;
// Para saan: tanggapin ang file (may login man o wala)
function syncIngest(o){
  if(!syncValid(o)){toast(t('syncBad'),{kind:'err'});return}
  if(!S.user){syncBootstrap(o);return}
  const users=readJSON(K_USERS,{}),mine=users[S.user]||{};
  if(mine.code!==o.code){toast(t('syncWrong'),{kind:'err'});return}
  const r=S.role==='cashier'?syncAsCashier(o):syncAsOwner(o);
  save();
  S.cart=S.cart.filter(l=>byId(l.id));
  renderNav();renderView();checkDue();bellUpd();
  toast(t('syncOk',r.sales,r.debts,r.items),{sub:t('syncOkSub'),ms:3500});sfx('success');
}
// Para saan: pagsamahin ang listahan sa pamamagitan ng id (walang doble)
function syncMerge(local,incoming){
  const have=new Set(local.map(x=>x.id)),add=incoming.filter(x=>x&&x.id&&!have.has(x.id));
  return {list:local.concat(add),add};
}
// Para saan: si may-ari ang tumatanggap (galing sa cashier)
function syncAsOwner(o){
  const m=syncMerge(S.sales,o.sales);
  if(o.from==='cashier'&&o.cashier)m.add.forEach(s=>{if(!s.by)s.by={r:'c',n:String(o.cashier)}});   // lumang benta na walang tala: ilagay ang pangalan ng cashier
  m.add.forEach(s=>(s.lines||[]).forEach(l=>{const it=byId(l.id);if(it&&it.stockOn)it.stock=Math.max(0,(Number(it.stock)||0)-l.qty)}));   // bawasan ang stock sa benta ng cashier
  {const all=m.list.sort((a,b)=>b.ts-a.ts);if(all.length>500)gcFoldSales(all.slice(500));S.sales=all.slice(0,500)}
  const d=syncMerge(S.debts,o.debts);S.debts=d.list.sort((a,b)=>a.ts-b.ts);
  let items=0;const hv=new Set(S.items.map(i=>i.id));
  o.items.forEach(i=>{if(i&&i.id&&!hv.has(i.id)){if(!i.uts)i.uts=Date.now();S.items.push(i);items++}});
  if(o.cashier){
    const cd=cashData(S.user);let c=cd.list.find(x=>x.name.toLowerCase()===String(o.cashier).toLowerCase());
    if(!c){c={id:uid(),name:o.cashier,seen:0};cd.list.push(c)}
    c.seen=Date.now();if(o.loc)c.loc=o.loc;cashSave(S.user,cd);
  }
  return {sales:m.add.length,debts:d.add.length,items};
}
// Para saan: ang cashier ang tumatanggap (galing sa may-ari)
function syncAsCashier(o){
  const seen=new Set(o.sales.map(s=>s.id)),mine=S.sales.filter(s=>!seen.has(s.id));   // benta ng cashier na hindi pa alam ni may-ari
  const out={};mine.forEach(s=>(s.lines||[]).forEach(l=>{out[l.id]=(out[l.id]||0)+l.qty}));
  S.items=o.items.map(i=>i.stockOn?Object.assign({},i,{stock:Math.max(0,(Number(i.stock)||0)-(out[i.id]||0))}):i);
  const m=syncMerge(S.sales,o.sales);S.sales=m.list.sort((a,b)=>b.ts-a.ts).slice(0,500);
  const d=syncMerge(S.debts,o.debts);S.debts=d.list.sort((a,b)=>a.ts-b.ts);
  gcApplyFull(o.gcash);
  const users=readJSON(K_USERS,{});if(users[S.user]&&o.store){users[S.user].store=o.store;store.set(K_USERS,JSON.stringify(users));S.store=o.store;const l=document.querySelector('.logo small');if(l)l.innerHTML=esc(S.store)+' · '+esc(tmHeadRole())+'<span id="net"></span>'}
  return {sales:m.add.length,debts:d.add.length,items:S.items.length};
}
// Para saan: bagong phone ng cashier: kunin ang tindahan mula sa file ng may-ari
function syncBootstrap(o){
  if(o.from==='cashier'){toast(t('syncNeedOwner'),{kind:'err'});return}
  const users=readJSON(K_USERS,{}),key=o.owner;
  if(!users[key])users[key]={store:o.store,code:o.code,pw:'!',salt:'!',mirror:true};   // kopya lang: hindi puwedeng pasukan bilang may-ari
  else{users[key].code=o.code;users[key].store=o.store}
  store.set(K_USERS,JSON.stringify(users));
  const d=readJSON(K_DATA(key),{items:[],sales:[],debts:[]});
  const dm=syncMerge(d.sales||[],o.sales),db=syncMerge(d.debts||[],o.debts);
  store.set(K_DATA(key),JSON.stringify({items:o.items,sales:dm.list,debts:db.list}));
  const cd=cashData(key);cd.open=true;cashSave(key,cd);
  toast(t('syncJoined',o.store),{ms:4200});sfx('success');
  showCashJoin();
}
Object.assign(ACTIONS,{
  'sync-send':()=>{syncShare()},
  'sync-get':()=>{syncPick()}
});
