'use strict';
/* ============================================================
   ITO PARA SA ACCOUNT, STORE CODE AT CASHIER DATA   [accounts.js]
   Paghahanap ng account sa Gmail, code ng tindahan (hal. XHA-JHA), password hash, listahan ng cashier.
   ============================================================ */

const K_CASH=u=>'tindamo:cash:'+u;
// Para saan: basahin ang listahan ng cashier ng isang tindahan
const cashData=u=>readJSON(K_CASH(u),{open:true,list:[]});
// Para saan: i-save ang listahan ng cashier
const cashSave=(u,d)=>{store.set(K_CASH(u),JSON.stringify(d));if(typeof clQueue==='function'&&typeof S!=='undefined'&&S.role==='owner'&&S.user===u&&!d.__skip)clQueue()};
// Para saan: gumawa ng bagong store code (hal. XHA-JHA)
function newCode(users){const A='ABCDEFGHJKMNPQRSTUVWXYZ23456789',r=()=>A[Math.floor(Math.random()*A.length)];let c;do{c=r()+r()+r()+'-'+r()+r()+r()}while(Object.keys(users).some(u=>users[u].code===c));return c}

// Para saan: i-hash ang password
async function hashPw(pw,salt){
  try{
    const b=new TextEncoder().encode(salt+':'+pw);
    const d=await crypto.subtle.digest('SHA-256',b);
    return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,'0')).join('');
  }catch(e){return 'x'+btoa(unescape(encodeURIComponent(salt+':'+pw)))}
}

/* Gmail: ang tuldok at +tag ay hindi nagbabago ng inbox, kaya iisang account lang ang mga iyon. */
// Para saan: gawing iisa ang Gmail na may tuldok/+tag
function canonEmail(e){
  e=String(e||'').trim().toLowerCase();
  const m=e.match(/^([^@]+)@(gmail\.com|googlemail\.com)$/);
  return m?m[1].split('+')[0].replace(/\./g,'')+'@gmail.com':e;
}
/* Hanapin ang account ng email (kahit iba ang tuldok / +tag sa Gmail). Ibinabalik ang key o null. */
// Para saan: hanapin kung may account na ang email
function findUserKey(users,email){
  const e=String(email||'').trim().toLowerCase();
  if(users[e])return e;
  const c=canonEmail(e);
  return Object.keys(users).find(k=>canonEmail(k)===c)||null;
}
/* Ayusin ang code na tinype ng cashier: kahit maliit na titik, may space o walang dash. */
// Para saan: ayusin ang code na tinype ng cashier
function normCode(raw){
  const c=String(raw||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  return c.length===6?c.slice(0,3)+'-'+c.slice(3):c;
}
/* Siguraduhing may code ang bawat account (para sa mga lumang account na wala pa). */
// Para saan: bigyan ng code ang lumang account na wala pa
function ensureCodes(users){
  let ch=false;
  Object.keys(users).forEach(u=>{if(!users[u].code){users[u].code=newCode(users);ch=true}});
  if(ch)store.set(K_USERS,JSON.stringify(users));
  return users;
}
// Para saan: hanapin ang may-ari gamit ang store code
function findOwnerByCode(users,code){return Object.keys(users).find(u=>users[u].code===code)||null}
