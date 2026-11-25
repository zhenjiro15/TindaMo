'use strict';
/* ============================================================
   ITO PARA SA GLOBAL STATE (S)   [state.js]
   Nandito ang kasalukuyang user, items, benta, utang, cart. May rehistro rin ng mga click action (ACTIONS).
   ============================================================ */

/* ---------- state ---------- */
const S={user:null,store:'',items:[],sales:[],debts:[],cart:[],tab:'sell',q:'',cat:'',invq:'',invcat:'',authMode:'in',ts:0,page:'settings',sp:{m:'d',off:0,lim:30,top:'amt',all:false,sec:'main'}};
const app=$('#app');
// Para saan: hanapin ang item gamit ang id
const byId=id=>S.items.find(i=>i.id===id);
// Para saan: ilan ng item ang nasa cart
const inCart=id=>{const l=S.cart.find(x=>x.id===id);return l?l.qty:0};
// Para saan: natitirang stock (bawas ang nasa cart)
const remaining=it=>it.stockOn?Math.max(0,(Number(it.stock)||0)-inCart(it.id)):Infinity;
// Para saan: i-save ang items, benta at utang ng user
function save(){S.ts=Date.now();store.set(K_DATA(S.user),JSON.stringify({items:S.items,sales:S.sales,debts:S.debts,ts:S.ts}));if(typeof clQueue==='function')clQueue();if(typeof shopQueue==='function')shopQueue()}
// Para saan: lahat ng category
function allCats(){
  const set=new Set();S.items.forEach(i=>{if(i.category)set.add(i.category)});
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}
// Para saan: listahan ng mga customer at utang nila
function customers(){
  const m=new Map();
  S.debts.slice().sort((a,b)=>a.ts-b.ts).forEach(d=>{
    const k=d.name.trim().toLowerCase();let c=m.get(k);
    if(!c){c={key:k,name:d.name.trim(),bal:0,last:0,open:[]};m.set(k,c)}
    c.bal=r2(c.bal+(d.type==='utang'?d.amount:-d.amount));c.last=Math.max(c.last,d.ts);
    if(d.type==='utang')c.open.push({id:d.id,amt:d.amount,due:d.due||null,ts:d.ts});
    else if(d.for){const i=c.open.findIndex(o=>o.id===d.for);if(i>=0){const o=c.open[i];o.amt=r2(o.amt-d.amount);if(o.amt<=0.004)c.open.splice(i,1)}}   // V35: bayad na para sa isang resibo/item
    else{let r=d.amount;while(r>0.004&&c.open.length){const o=c.open[0];if(o.amt<=r+1e-9){r=r2(r-o.amt);c.open.shift()}else{o.amt=r2(o.amt-r);r=0}}}   // bayad: unahin ang pinakamatandang utang
  });
  m.forEach(c=>{c.bal=r2(c.open.reduce((a,o)=>a+o.amt,0));c.oldest=c.open.length?Math.min.apply(null,c.open.map(o=>o.ts)):0;const ds=c.open.filter(o=>o.due).map(o=>o.due);c.due=ds.length?Math.min.apply(null,ds):null});
  return Array.from(m.values());
}
// Para saan: mga customer na may utang pa
const owing=()=>customers().filter(c=>c.bal>0.004);
// Para saan: simula ng araw ngayon
const dayStart=()=>{const d=new Date();d.setHours(0,0,0,0);return d.getTime()};
// Para saan: petsa at oras na madaling basahin
const dstr=ts=>new Date(ts).toLocaleString('en-PH',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});

/* Bawat file (auth, profile, cashier...) ay nagrerehistro ng sarili nitong click actions dito. */
// Para saan: rehistro ng click actions
const ACTIONS={};
