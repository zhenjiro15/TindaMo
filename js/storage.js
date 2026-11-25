'use strict';
/* ============================================================
   ITO PARA SA PAG-SAVE SA DEVICE   [storage.js]
   localStorage wrapper. Dito dumadaan ang lahat ng save/basa ng data.
   ============================================================ */

/* ---------- storage (falls back to memory if the browser blocks it) ---------- */
const mem={};
// Para saan: basa/save/bura sa localStorage
const store={
  get(k){try{const v=localStorage.getItem(k);if(v!=null)return v}catch(e){}return k in mem?mem[k]:null},
  set(k,v){mem[k]=v;try{localStorage.setItem(k,v)}catch(e){}},
  del(k){delete mem[k];try{localStorage.removeItem(k)}catch(e){}}
};
const K_USERS='tindamo:users', K_SESSION='tindamo:session', K_DATA=u=>'tindamo:data:'+u;
// Para saan: basahin ang naka-save na JSON
const readJSON=(k,d)=>{try{const v=store.get(k);return v?JSON.parse(v):d}catch(e){return d}};
