'use strict';
/* ============================================================
   ITO PARA SA LONG PRESS SA SELL AT STOCK NA ARROW   [stock.js]   V26
   - Sell: i-long press ang isang item -> bubukas ang Edit item (admin / may-ari lang).
   - Edit item: arrow pataas = dagdag 1 stock, arrow pababa = bawas 1.
   ============================================================ */

(function(){
  let T=0,sx=0,sy=0,fired=0;
  const clear=()=>{if(T){clearTimeout(T);T=0}};
  document.addEventListener('pointerdown',e=>{
    const tl=e.target.closest&&e.target.closest('.tile[data-act="add-quick"]');if(!tl)return;
    sx=e.clientX;sy=e.clientY;clear();
    T=setTimeout(()=>{
      T=0;fired=Date.now();
      try{navigator.vibrate&&navigator.vibrate(30)}catch(x){}
      const it=byId(tl.dataset.id);if(!it)return;
      openProductForm(it);   // V1.2.8: ang role ang nagpapasya kung pwede (tmNeedEdit sa loob ng openProductForm)
    },520);
  });
  document.addEventListener('pointermove',e=>{if(T&&Math.hypot(e.clientX-sx,e.clientY-sy)>10)clear()});
  ['pointerup','pointercancel','scroll'].forEach(ev=>document.addEventListener(ev,clear,true));
  // pagkatapos ng long press, huwag nang idagdag sa cart ang item
  document.addEventListener('click',e=>{if(fired&&Date.now()-fired<1200){fired=0;e.stopPropagation();e.preventDefault()}},true);
})();

// Para saan: dagdag / bawas ng stock sa Edit item (arrow)
function stkStep(d){
  const i=$('#pf-stock');if(!i||!form)return;
  const v=Math.max(0,(parseInt(i.value,10)||0)+d);
  i.value=v;form.stockVal=String(v);
  i.classList.remove('stk-pop');void i.offsetWidth;i.classList.add('stk-pop');
  try{navigator.vibrate&&navigator.vibrate(8)}catch(x){}
}
Object.assign(ACTIONS,{
  'stk-inc':()=>{stkStep(1)},
  'stk-dec':()=>{stkStep(-1)}
});
