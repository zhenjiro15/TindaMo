'use strict';
/* ============================================================
   ITO PARA SA BENTA   [sales.js]
   Araw / Linggo / Buwan: kabuuan, chart, pinakamabenta, category, utang, kasaysayan at pagbura ng benta. Walang tubo.
   ============================================================ */

/* ---------- SALES ---------- */
// Para saan: petsa/oras ayon sa napiling wika
const dFmt=(ts,o)=>new Date(ts).toLocaleDateString(loc(),o);
const tFmt=ts=>new Date(ts).toLocaleTimeString(loc(),{hour:'numeric',minute:'2-digit'});
// Para saan: Ngayon / Kahapon / petsa
function dayLabel(ts){const d=new Date(ts);d.setHours(0,0,0,0);const n=Math.round((dayStart()-d.getTime())/864e5);return n<=0?t('today'):n===1?t('yesterday'):dFmt(d,{weekday:'short',month:'short',day:'numeric'})}
// Para saan: hatiin ang listahan ng benta: cash (benta) at naging utang, at ang kabuuan nilang dalawa
// V1.2.5: ang benta na kulang ang bayad (utang na may paunang bayad): ang bayad ay cash, ang kulang ay utang
const salePaid=s=>s&&s.method==='utang'?Math.max(0,Math.min(Number(s.total)||0,Number(s.paid)||0)):0;
function split(list){
  const cash=r2(list.filter(s=>s.method!=='utang').reduce((a,s)=>a+s.total,0)+list.reduce((a,s)=>a+salePaid(s),0));
  const debt=r2(list.filter(s=>s.method==='utang').reduce((a,s)=>a+s.total-salePaid(s),0));
  return {cash,debt,all:r2(cash+debt)};
}
// Para saan: burahin ang benta at ibalik ang stock
function deleteSale(id){
  const s=S.sales.find(x=>x.id===id);if(!s)return;
  s.lines.forEach(l=>{const it=byId(l.id);if(it&&it.stockOn)it.stock=(Number(it.stock)||0)+l.qty});
  S.sales=S.sales.filter(x=>x.id!==id);S.debts=S.debts.filter(d=>d.saleId!==id);
  save();closeModal();toast(t('saleDeleted'),{sub:t('stockRestored')});renderNav();renderSales(true);
}
// Para saan: sino ang nag-benta ngayon (para ilagay sa bawat benta/utang). Cashier: pangalan niya. May-ari: "owner".
function curBy(){
  if(S.role==='cashier'){const c=cashData(S.user).list.find(x=>x.id===S.cid);return {r:'c',n:c?c.name:''}}
  return {r:'o'};
}
// Para saan: "Cashier-Kelvin" o "May-ari" (walang ilalabas sa lumang benta na walang tala)
function byLabel(by){
  if(!by)return '';
  if(by.r==='c')return t('cashier')+(by.n?'-'+by.n:'');
  if(by.r==='o')return t('byOwner');
  return '';
}
// Para saan: dagdag na text (naka-escape) para sa listahan, may unang panlagay
const byTxt=(by,pre)=>{const l=byLabel(by);return l?(pre||'')+esc(l):''};
// Para saan: maliit na chip kung sino ang nag-benta
const byChip=by=>{const l=byLabel(by);return l?'<span class="chip by'+(by.r==='c'?' cs':'')+'">'+esc(l)+'</span>':''};
// Para saan: maliit na chip ng benta (green) at utang (red)
const saleChips=(c,d)=>'<span class="chip ok">'+fmt(c)+'</span><span class="chip bad">'+fmt(d)+'</span>';
// Para saan: isang linya ng benta sa listahan
function saleRow(s,del){
  return '<div class="sale"><div style="min-width:0"><div class="when">'+tFmt(s.ts)+(s.method==='utang'?'<span class="chip bad">'+esc(t('debtWho',s.customer||''))+'</span>':s.method==='gcash'?'<span class="chip gc">GCash</span>':'<span class="chip ok">'+esc(t('cash'))+'</span>')+byChip(s.by)+'</div><div class="what">'+s.lines.map(l=>esc(l.name)+' ×'+l.qty).join(', ')+'</div></div><div style="display:flex;align-items:center;gap:10px"><div class="amt '+(s.method==='utang'?'dbt':'cashamt')+'">'+fmt(s.total)+'</div>'+(del&&S.role!=='cashier'?'<button class="icon-btn sm" data-act="sale-del" data-id="'+s.id+'" aria-label="'+esc(t('delSaleAria'))+'">'+I.trash+'</button>':'')+'</div></div>';
}
/* ---------- bagong Benta page: Araw / Linggo / Buwan ---------- */
const SA_D=864e5;
// Para saan: simula at dulo ng napiling panahon (m: d/w/m, off: 0 = ngayon, -1 = nakaraan)
function spRange(m,off){
  const a=new Date();a.setHours(0,0,0,0);let b=new Date(a);
  if(m==='d'){a.setDate(a.getDate()+off);b=new Date(a);b.setDate(b.getDate()+1)}
  else if(m==='w'){a.setDate(a.getDate()-((a.getDay()+6)%7)+off*7);b=new Date(a);b.setDate(b.getDate()+7)}
  else{a.setDate(1);a.setMonth(a.getMonth()+off);b=new Date(a);b.setMonth(b.getMonth()+1)}
  return {s:a.getTime(),e:b.getTime()};
}
// Para saan: pangalan ng panahon (malaki) at petsa (maliit)
function spLabel(m,off,r){
  const sh={month:'short',day:'numeric'};
  if(m==='d')return [off===0?t('today'):off===-1?t('yesterday'):dFmt(r.s,sh),dFmt(r.s,{weekday:'long',year:'numeric',month:'long',day:'numeric'})];
  if(m==='w')return [off===0?t('spThisWeek'):dFmt(r.s,sh)+' – '+dFmt(r.e-1,sh),dFmt(r.s,sh)+' – '+dFmt(r.e-1,Object.assign({year:'numeric'},sh))];
  return [off===0?t('spThisMonth'):dFmt(r.s,{month:'long',year:'numeric'}),dFmt(r.s,{month:'long',year:'numeric'})];
}
const hrLbl=h=>(h%12||12)+(h<12?'a':'p');
const hrFull=h=>(h%12||12)+(h<12?' AM':' PM');
// Para saan: bar chart (cash = green, utang = red)
function saChart(m,r,list){
  let cols=[],mode=m;
  const put=(i,s)=>{const c=cols[i];if(!c)return;if(s.method==='utang'){c.debt+=s.total-salePaid(s);c.cash+=salePaid(s)}else c.cash+=s.total};
  if(m==='d'){
    let lo=7,hi=19;list.forEach(s=>{const h=new Date(s.ts).getHours();lo=Math.min(lo,h);hi=Math.max(hi,h)});
    for(let h=lo;h<=hi;h++)cols.push({k:h,l:(hi-lo>14?(h%3===0):(h%2===0))?hrLbl(h):'',n:hrFull(h),cash:0,debt:0});
    list.forEach(s=>put(new Date(s.ts).getHours()-lo,s));
  }else if(m==='w'){
    for(let i=0;i<7;i++){const d=r.s+i*SA_D;cols.push({k:d,l:dFmt(d,{weekday:'short'}),n:dFmt(d,{weekday:'long',month:'short',day:'numeric'}),cash:0,debt:0})}
    list.forEach(s=>put(Math.min(6,Math.floor((s.ts-r.s)/SA_D+0.001)),s));
  }else{
    const n=Math.round((r.e-r.s)/SA_D);
    for(let i=0;i<n;i++){const d=new Date(r.s);d.setDate(i+1);cols.push({k:d.getTime(),l:(i===0||(i+1)%5===0)?String(i+1):'',n:dFmt(d,{month:'short',day:'numeric'}),cash:0,debt:0})}
    list.forEach(s=>put(new Date(s.ts).getDate()-1,s));
  }
  cols.forEach(c=>{c.cash=r2(c.cash);c.debt=r2(c.debt);c.all=r2(c.cash+c.debt)});
  const mx=Math.max(1,...cols.map(c=>c.all)),act=cols.filter(c=>c.all>0);
  const pk=act.length?act.reduce((a,c)=>c.all>a.all?c:a,act[0]):null;
  const html=cols.map(c=>{
    const h=c.all?Math.max(5,Math.round(c.all/mx*100)):0,isPk=pk&&c===pk;
    const inner='<span class="sa-v">'+((isPk||(m==='w'&&c.all))?fmtK(c.all):'')+'</span><div class="sa-plot"><div class="sa-stack" style="height:'+h+'%">'+(c.debt?'<i class="r" style="flex:'+c.debt+'"></i>':'')+(c.cash?'<i class="g" style="flex:'+c.cash+'"></i>':'')+'</div></div><span class="sa-l"><em>'+esc(c.l)+'</em></span>';
    const cls='sa-col'+(isPk?' pk':'')+(c.all?'':' z'),ix=cols.indexOf(c);
    return m==='d'?'<div class="'+cls+'" style="--i:'+ix+'" title="'+esc(c.n+' · '+fmt(c.all))+'">'+inner+'</div>':'<button class="'+cls+'" style="--i:'+ix+'" data-act="sa-day" data-k="'+c.k+'" aria-label="'+esc(c.n+' · '+fmt(c.all))+'">'+inner+'</button>';
  }).join('');
  return {html,pk,avg:act.length?r2(act.reduce((a,c)=>a+c.all,0)/act.length):0,gap:m==='m'?'3px':'6px'};
}
// Para saan: buuin ang Benta page
function renderSales(keep){
  const v=$('#view'),top0=v?v.scrollTop:0;
  const tab0=v&&v.querySelector('.sa-tabs'),tabX=tab0?tab0.scrollLeft:0;   // V1.1.9: huwag bumalik sa simula ang hanay ng button
  const sp=S.sp,m=sp.m,off=sp.off,r=spRange(m,off),pr=spRange(m,off-1);
  const inR=(a,b)=>S.sales.filter(s=>s.ts>=a&&s.ts<b).sort((x,y)=>y.ts-x.ts);
  const list=inR(r.s,r.e),prev=inR(pr.s,pr.e),tot=split(list),ptot=split(prev);
  const oldest=S.sales.length?Math.min.apply(null,S.sales.map(s=>s.ts)):Infinity;
  const [lab,sub]=spLabel(m,off,r);
  const pcs=list.reduce((a,s)=>a+s.lines.reduce((b,l)=>b+l.qty,0),0);
  const paid=r2(S.debts.filter(d=>d.type==='bayad'&&!d.sp&&d.ts>=r.s&&d.ts<r.e).reduce((a,d)=>a+d.amount,0));
  const owingAll=r2(owing().reduce((a,c)=>a+c.bal,0));
  // itaas
  let h='<div class="page-h"><h2>'+esc(t('sales'))+'</h2><span class="live">'+esc(t('liveTag'))+'</span></div>'+
  '<div class="sa-bar"><div class="seg seg3" role="tablist">'+[['d','spDay'],['w','spWeek'],['m','spMonth']].map(x=>'<button role="tab" data-act="sa-mode" data-m="'+x[0]+'" aria-selected="'+(m===x[0])+'">'+esc(t(x[1]))+'</button>').join('')+'</div>'+
  '<div class="sa-nav"><button class="icon-btn" data-act="sa-prev" aria-label="'+esc(t('spPrev'))+'"'+(oldest>=r.s?' disabled':'')+'>'+I.chevL+'</button><div class="sa-cur"><b>'+esc(lab)+'</b><small>'+esc(sub)+'</small></div><button class="icon-btn" data-act="sa-next" aria-label="'+esc(t('spNext'))+'"'+(off>=0?' disabled':'')+'>'+I.chevR+'</button></div><!--SA-TABS--></div>';
  if(!list.length){
    h+='<div class="sa-empty"><div class="sa-empty-i">'+I.receipt+'</div><strong>'+esc(t('saEmptyT'))+'</strong><span>'+esc(t('saEmptySub',lab))+'</span></div>';
    if(owingAll>0)h+='<section class="card sa-card"><div class="sa-h"><h3>'+esc(t('saDebtT'))+'</h3></div>'+saDebtRows(0,paid,owingAll)+'</section>';
    v.innerHTML=h;v.scrollTop=keep?top0:0;return;
  }
  // V1.1.8: hinati sa mga seksyon; may button para pumunta sa bawat isa
  const P={main:'',top:'',cat:'',debt:'',ins:'',log:''};
  // hero
  const cmp={d:'cmpD',w:'cmpW',m:'cmpM'}[m];
  let dl='';
  if(ptot.all>0){const pc=Math.round(Math.abs(tot.all-ptot.all)/ptot.all*100);if(tot.all>=ptot.all)dl='<span class="sa-delta up">'+esc(t('saUp',pc,t(cmp)))+'</span>';else dl='<span class="sa-delta dn">'+esc(t('saDn',pc,t(cmp)))+'</span>'}
  else dl='<span class="sa-delta">'+esc(t('saNew'))+'</span>';
  P.main+='<section class="sa-hero"><div class="sa-hero-t"><span>'+esc(t('saTotal'))+'</span>'+dl+'</div><div class="sa-big">'+fmt(tot.all)+'</div>'+
  '<div class="sa-split"><i class="g" style="flex:'+(tot.cash||0)+'"></i><i class="r" style="flex:'+(tot.debt||0)+'"></i></div>'+
  '<div class="sa-leg"><span><i class="g"></i>'+esc(t('cash'))+' <b>'+fmt(tot.cash)+'</b></span><span><i class="r"></i>'+esc(t('becameDebt'))+' <b>'+fmt(tot.debt)+'</b></span></div>'+saGoal(m,off,tot.all)+'</section>';
  // tiles
  const tile=(ic,hh,l,val)=>'<div class="sa-tile"><span class="sa-ti" style="--h:'+hh+'">'+ic+'</span><div><small>'+esc(l)+'</small><b>'+val+'</b></div></div>';
  P.main+='<div class="sa-tiles">'+tile(I.receipt,215,t('saTx'),list.length)+tile(I.box,150,t('saPcs'),pcs)+tile(I.tag,30,t('saAvg'),fmt(r2(tot.all/list.length)))+tile(I.wallet,280,t('saPaid'),fmt(paid))+'</div>';
  // chart
  const chart=saChart(m,r,list);
  P.main+='<section class="card sa-card"><div class="sa-h"><h3>'+esc(t(m==='d'?'saTrD':m==='w'?'saTrW':'saTrM'))+'</h3></div>'+
  '<div class="sa-chart" style="--g:'+chart.gap+'">'+chart.html+'</div>'+
  '<div class="sa-foot">'+(chart.pk?'<span><i class="g"></i>'+esc(t('saPeak',chart.pk.n,fmt(chart.pk.all)))+'</span>':'')+'<span>'+esc(t('saAvgB',fmt(chart.avg)))+'</span></div></section>';
  // pinakamabenta
  const agg={},cat={};
  list.forEach(s=>s.lines.forEach(l=>{
    const k=l.id||l.name,a=agg[k]||(agg[k]={id:l.id,n:l.name,q:0,r:0});a.q+=l.qty;a.r=r2(a.r+l.qty*l.price);
    const it=byId(l.id),c=(it&&it.category)||'',ca=cat[c]||(cat[c]={n:c,r:0});ca.r=r2(ca.r+l.qty*l.price);
  }));
  const rows=Object.values(agg).sort((a,b)=>sp.top==='qty'?(b.q-a.q||b.r-a.r):(b.r-a.r||b.q-a.q));
  const allR=rows.reduce((a,x)=>a+x.r,0)||1,val=a=>sp.top==='qty'?a.q:a.r;
  const shown=sp.all?rows:rows.slice(0,6),mxv=Math.max(1e-9,val(rows[0]));
  const th=a=>{const it=byId(a.id);return it?thumb(it):'<div class="thumb" style="--h:'+hue(a.n)+'">'+esc((a.n||'?').charAt(0).toUpperCase())+'</div>'};
  const ch=shown[0];
  P.top+='<section class="card sa-card"><div class="sa-h"><h3>'+esc(t('saTop'))+'</h3><div class="sa-mini" role="tablist">'+[['amt','saByAmt'],['qty','saByQty']].map(x=>'<button data-act="sa-top" data-v="'+x[0]+'" aria-selected="'+(sp.top===x[0])+'">'+esc(t(x[1]))+'</button>').join('')+'</div></div>'+
  '<div class="sa-champ"><div class="sa-champ-i">'+th(ch)+'<span class="sa-crown">'+I.trophy+'</span></div><div class="sa-champ-t"><small>'+esc(t('saChamp'))+'</small><b>'+esc(ch.n)+'</b><span>'+(sp.top==='qty'?'×'+ch.q+' · '+fmt(ch.r):fmt(ch.r)+' · ×'+ch.q)+'</span><div class="sa-tb"><i style="width:'+Math.max(4,Math.round(val(ch)/mxv*100))+'%"></i></div><em>'+esc(t('saShareAll',Math.round(ch.r/allR*100)))+'</em></div></div>'+
  shown.slice(1).map((a,i)=>'<div class="sa-top" style="--i:'+i+'"><span class="sa-rk r'+(i<2?i+2:0)+'">'+(i+2)+'</span>'+th(a)+'<div class="sa-tn"><div class="sa-tl"><b>'+esc(a.n)+'</b><span>'+(sp.top==='qty'?'×'+a.q:fmt(a.r))+'</span></div><div class="sa-tb"><i style="width:'+Math.max(4,Math.round(val(a)/mxv*100))+'%"></i></div><small>'+esc(t('saSold',a.q,fmt(a.r)))+'</small></div></div>').join('')+
  (rows.length>6?'<button class="btn btn-ghost btn-block" style="margin-top:10px;min-height:40px" data-act="sa-topall">'+esc(t(sp.all?'saLess':'saAll'))+'</button>':'')+'</section>';
  // category (donut)
  const cats=Object.values(cat).sort((a,b)=>b.r-a.r),ctot=cats.reduce((a,c)=>a+c.r,0)||1;
  const cCol=c=>c.n?'hsl('+hue(c.n)+' 66% 52%)':'#9AA3B2';
  if(cats.some(c=>c.n)){
    let acc=0;const stops=cats.map(c=>{const a0=acc;acc+=c.r/ctot*100;return cCol(c)+' '+a0.toFixed(2)+'% '+acc.toFixed(2)+'%'}).join(',');
    P.cat+='<section class="card sa-card"><div class="sa-h"><h3>'+esc(t('saCat'))+'</h3><span class="hint">'+esc(t('saCats',cats.filter(c=>c.n).length))+'</span></div>'+
    '<div class="sa-cat-w"><div class="sa-donut" style="background:conic-gradient('+stops+')"><div><small>'+esc(t('saTotal'))+'</small><b>'+fmtK(ctot)+'</b></div></div>'+
    '<div class="sa-leg2">'+cats.slice(0,6).map((c,i)=>{const pc=Math.round(c.r/ctot*100);return '<div class="sa-lg" style="--i:'+i+'"><i style="background:'+cCol(c)+'"></i><span class="sa-lgn">'+esc(c.n||t('saNoCat'))+'</span><b>'+fmt(c.r)+'</b><em>'+pc+'%</em></div>'}).join('')+'</div></div></section>';
  }
  if(!P.cat)P.cat='<section class="card sa-card"><div class="hint">'+esc(t('saNoCatYet'))+'</div></section>';
  // utang
  const deb=owing().sort((a,b)=>b.bal-a.bal).slice(0,3);
  P.debt+='<section class="card sa-card"><div class="sa-h"><h3>'+esc(t('saDebtT'))+'</h3></div>'+saDebtRows(tot.debt,paid,owingAll)+
  (deb.length?'<div class="sa-sub">'+esc(t('saTopDebtors'))+'</div>'+deb.map(c=>'<div class="sa-db"><span class="sa-av" style="--h:'+hue(c.name)+'">'+esc(c.name.charAt(0).toUpperCase())+'</span><div><b>'+esc(c.name)+'</b><small>'+esc(t('saLastBuy',dayLabel(c.last)))+'</small></div><strong>'+fmt(c.bal)+'</strong></div>').join(''):'<div class="hint" style="margin-top:8px">'+esc(t('saNoDebts'))+'</div>')+'</section>';
  // napansin
  const ins=[];
  const saPk=chart.pk,bq=Object.values(agg).sort((a,b)=>b.q-a.q)[0];
  if(bq)ins.push([I.tag,215,t('saInBest'),bq.n,'×'+bq.q+' · '+fmt(bq.r)]);
  if(saPk)ins.push([m==='d'?I.clock:I.cal,30,t(m==='d'?'saInHour':'saInDay'),saPk.n,fmt(saPk.all)]);
  const topCat=cats.find(c=>c.n);
  if(topCat)ins.push([I.layers,150,t('saInCat'),topCat.n,t('saShareAll',Math.round(topCat.r/ctot*100))]);
  ins.push([I.bag,280,t('saInBasket'),(pcs/list.length).toFixed(1),t('saInCredit')+': '+(tot.all?Math.round(tot.debt/tot.all*100):0)+'%']);
  P.ins+='<section class="card sa-card"><div class="sa-h"><h3>'+esc(t('saIns'))+'</h3></div><div class="sa-insg">'+ins.map((x,i)=>'<div class="sa-in" style="--h:'+x[1]+';--i:'+i+'"><span class="sa-ti">'+x[0]+'</span><small>'+esc(x[2])+'</small><b>'+esc(x[3])+'</b><em>'+esc(x[4])+'</em></div>').join('')+'</div></section>';
  // kasaysayan
  const groups=[];list.slice(0,sp.lim).forEach(s=>{const k=dayLabel(s.ts),g=groups[groups.length-1];if(g&&g.k===k)g.l.push(s);else groups.push({k,l:[s]})});
  const full={};list.forEach(s=>{const k=dayLabel(s.ts);(full[k]||(full[k]=[])).push(s)});
  const log=groups.map(g=>{const y=split(full[g.k]);return '<div class="sa-day"><div class="sa-dh"><b>'+esc(g.k)+'</b><span>'+esc(tc(full[g.k].length,'tx'))+'</span><strong>'+fmt(y.all)+'</strong></div>'+g.l.map(saLogRow).join('')+'</div>'}).join('');
  P.log+='<section class="card sa-card"><div class="sa-h"><h3>'+esc(t('saLog'))+'</h3><span class="hint">'+esc(tc(list.length,'tx'))+'</span></div>'+log+(list.length>sp.lim?'<button class="btn btn-ghost btn-block" style="margin-top:10px" data-act="sa-more">'+esc(t('saMore'))+'</button>':'')+'</section>';
  const SECS=[['main','saTabMain'],['top','saTabTop'],['cat','saTabCat'],['debt','saTabDebt'],['ins','saTabIns'],['log','saTabLog']];
  const sec=P[sp.sec]!==undefined&&sp.sec?sp.sec:'main';
  h=h.replace('<!--SA-TABS-->','<div class="sa-tabs" role="tablist">'+SECS.map(x=>'<button role="tab" data-act="sa-sec" data-s="'+x[0]+'" aria-selected="'+(sec===x[0])+'">'+esc(t(x[1]))+'</button>').join('')+'</div>');
  h+=P[sec];
  v.innerHTML=h;v.scrollTop=keep?top0:0;
  {const tb=v.querySelector('.sa-tabs');if(tb){tb.scrollLeft=tabX;const a=tb.querySelector('[aria-selected="true"]');
    if(a){const l=a.offsetLeft,r=l+a.offsetWidth,vw=tb.clientWidth;if(l<tb.scrollLeft+8)tb.scrollLeft=Math.max(0,l-8);else if(r>tb.scrollLeft+vw-8)tb.scrollLeft=r-vw+8}}}   // siguraduhing kita ang napiling button
  v.classList.toggle('sa-anim',!keep);
  if(!keep){const e=v.querySelector('.sa-big');if(e)countUp(e,tot.all)}
}
// Para saan: isang benta sa bagong kasaysayan
function saLogRow(s){
  const debt=s.method==='utang',th=s.lines.slice(0,3).map(l=>{const it=byId(l.id);return it&&it.img?'<img alt="" src="'+esc(it.img)+'">':'<span style="--h:'+hue(l.name)+'">'+esc((l.name||'?').charAt(0).toUpperCase())+'</span>'}).join('');
  const more=s.lines.length>3?'<span class="mo">+'+(s.lines.length-3)+'</span>':'';
  return '<div class="sa-lr" data-act="sale-open" data-id="'+s.id+'" role="button" tabindex="0"><div class="sa-ths">'+th+more+'</div><div class="sa-lb"><div class="sa-names">'+s.lines.map(l=>esc(l.name)+' ×'+l.qty).join(', ')+'</div><div class="sa-meta"><span class="sa-tm">'+esc(tFmt(s.ts))+'</span>'+(debt?'<span class="chip bad">'+esc(t('debtWho',s.customer||''))+'</span>':s.method==='gcash'?'<span class="chip gc">GCash</span>':'<span class="chip ok">'+esc(t('cash'))+'</span>')+byChip(s.by)+'</div></div><div class="sa-la"><b class="'+(debt?'r':'g')+'">'+fmt(s.total)+'</b>'+(S.role!=='cashier'?'<button class="icon-btn sm" data-act="sale-del" data-id="'+s.id+'" aria-label="'+esc(t('delSaleAria'))+'">'+I.trash+'</button>':'')+'</div></div>';
}
// Para saan: umaakyat na bilang (pang-hero ng Benta)
function countUp(el,to){
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const t0=performance.now(),D=750;
  (function f(n){const k=Math.min(1,(n-t0)/D),e=1-Math.pow(1-k,3);el.textContent=fmt(r2(to*e));if(k<1&&el.isConnected)requestAnimationFrame(f);else if(el.isConnected)el.textContent=fmt(to)})(t0);
}
// Para saan: mga linya ng utang sa Benta page
function saDebtRows(given,paid,owingAll){
  const c=(l,v,k)=>'<div class="sa-dc '+k+'"><small>'+esc(l)+'</small><b>'+fmt(v)+'</b></div>';
  return '<div class="sa-dcs">'+c(t('saDebtGiven'),given,'r')+c(t('saPaid'),paid,'g')+c(t('saDebtOwing'),owingAll,'a')+'</div>';
}
/* ---------- V23: resibo (papel) kapag pinindot ang benta sa kasaysayan ---------- */
// Para saan: buksan ang resibo ng benta (papel; maipapasa bilang larawan, tingnan ang receipt.js)
function openReceipt(id){const s=S.sales.find(x=>x.id===id);if(s)rcOpen(rcModelSale(s),s.id)}
Object.assign(ACTIONS,{
  'sale-open':b=>openReceipt(b.dataset.id),
  'sa-mode':b=>{S.sp.m=b.dataset.m;S.sp.off=0;S.sp.lim=30;S.sp.all=false;renderSales()},
  'sa-prev':()=>{S.sp.off--;S.sp.lim=30;S.sp.all=false;renderSales()},
  'sa-next':()=>{if(S.sp.off<0){S.sp.off++;S.sp.lim=30;S.sp.all=false;renderSales()}},
  'sa-day':b=>{S.sp.m='d';S.sp.off=Math.min(0,Math.round((+b.dataset.k-dayStart())/SA_D));S.sp.lim=30;renderSales()},
  'sa-sec':b=>{S.sp.sec=b.dataset.s;S.sp.lim=30;renderSales()},
  'sa-top':b=>{S.sp.top=b.dataset.v;renderSales(true)},
  'sa-topall':()=>{S.sp.all=!S.sp.all;renderSales(true)},
  'sa-more':()=>{S.sp.lim+=30;renderSales(true)}
});

// Para saan: target ngayong araw sa hero ng Benta (Araw / Ngayon lang)
function saGoal(m,off,all){
  const g=Number(prefs.goal)||0;if(m!=='d'||off!==0||g<=0)return '';
  const pc=Math.min(100,Math.round(all/g*100));
  return '<div class="sa-goal'+(pc>=100?' done':'')+'"><div class="sa-goal-t"><span>'+esc(t('goalLbl',fmt(g)))+'</span><span>'+(pc>=100?esc(t('goalHit')):esc(t('goalLeft',fmt(r2(g-all)))))+' · '+pc+'%</span></div><div class="sa-goal-b"><i style="width:'+Math.max(2,pc)+'%"></i></div></div>';
}
