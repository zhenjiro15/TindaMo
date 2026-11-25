'use strict';
/* ============================================================
   ITO PARA SA UTANG   [utang.js]
   Listahan ng may utang, bayad, at manual na utang.
   ============================================================ */

/* ---------- UTANG ---------- */
// Para saan: buuin ang Utang page (V24: bagong hero, search, cards)
function renderUtang(){
  if(archiveSettled()>0)save();
  const now=Date.now(),all=owing().sort((a,b)=>((b.due&&b.due<now)-(a.due&&a.due<now))||b.bal-a.bal);   // lampas na ang una
  const total=r2(all.reduce((a,c)=>a+c.bal,0)),over=all.filter(c=>c.due&&c.due<now),overAmt=r2(over.reduce((a,c)=>a+c.bal,0));
  $('#view').innerHTML=
  '<div class="page-h"><h2>'+esc(t('utang'))+'</h2><button class="btn btn-primary" data-act="manual-debt">'+I.plus+' '+esc(t('addDebt'))+'</button></div>'+
  '<section class="u-hero"><div class="u-h1"><span>'+esc(t('dCollect'))+'</span><b>'+fmt(total)+'</b></div>'+
    '<div class="u-bar" aria-hidden="true"><i class="o" style="flex:'+overAmt+'"></i><i style="flex:'+Math.max(0,r2(total-overAmt))+'"></i></div>'+
    '<div class="u-chips"><span class="chip">'+all.length+' · '+esc(t('owingCount'))+'</span>'+(over.length?'<span class="chip bad">'+esc(t('dOverN',over.length))+'</span>':'')+'</div></section>'+
  (all.length?'<input class="inp u-q" id="u-q" type="search" enterkeyhint="search" placeholder="'+esc(t('dSearch'))+'" value="'+esc(S.uq||'')+'" autocomplete="off"><div class="u-list" id="u-list"></div>'
  :'<div class="card empty"><h3>'+esc(t('noDebtNow'))+'</h3><p>'+esc(t('noDebtP'))+'</p><div class="btns"><button class="btn btn-ghost" data-act="manual-debt">'+esc(t('addDebt'))+'</button></div></div>');
  uListDraw();
}
// Para saan: gaano katagal na ang pinakamatandang utang
function debtAge(ts){const d=Math.floor((Date.now()-ts)/864e5);return d<=0?t('ageToday'):t('ageDays',d)}
// Para saan: listahan ng may utang (hiwalay para hindi mawala ang focus ng search)
function uListDraw(){
  const box=$('#u-list');if(!box)return;
  const q=(S.uq||'').trim().toLowerCase(),now=Date.now();
  const cs=owing().sort((a,b)=>((b.due&&b.due<now)-(a.due&&a.due<now))||b.bal-a.bal).filter(c=>!q||c.name.toLowerCase().includes(q));
  box.innerHTML=cs.length?cs.map((c,i)=>{const ov=c.due&&c.due<now;
    return '<button class="u-card'+(ov?' ov':'')+'" style="--i:'+Math.min(i,10)+'" data-act="open-cust" data-k="'+esc(c.key)+'"><span class="avatar" style="--h:'+hue(c.name)+'">'+esc(c.name.charAt(0).toUpperCase())+'</span>'+
    '<div style="min-width:0"><div class="nm">'+esc(c.name)+'</div><div class="sub">'+esc(t('lastMove',dstr(c.last)))+(c.oldest?' · '+esc(debtAge(c.oldest)):'')+'</div>'+(dueState(c)?'<div style="margin-top:4px">'+dueChip(c)+'</div>':'')+'</div><div class="u-amt">'+fmt(c.bal)+'</div></button>'}).join('')
  :'<div class="hint" style="padding:12px 0">'+esc(t('noItemFound'))+'</div>';
}
document.addEventListener('input',e=>{if(e.target.id==='u-q'){S.uq=e.target.value;uListDraw()}});
// V1.2.7: ang kasaysayan ng utang ay PAPEL na may disenyo (parang resibo/talaan), hindi simpleng text. list = bago muna; may balanse sa bawat linya
function paperHtml(name,list,dim,bal){
  const asc=list.slice().sort((a,b)=>a.ts-b.ts);let run=0;const rb={};
  asc.forEach(d=>{run=r2(run+(d.type==='utang'?d.amount:-d.amount));rb[d.id]=Math.max(0,run)});
  const rows=list.map(d=>{
    const dbt=d.type==='utang';
    const desc=dbt?(d.note?esc(d.note):esc(dim?debtDesc(d):t('ledDebt'))):esc(t('ledPaid'));
    return '<button type="button" class="pl-row'+(dim?' dim':'')+'" data-act="led-open" data-id="'+esc(d.id)+'">'+
      '<span class="pl-tag '+(dbt?'u':'b')+'">'+esc(dbt?t('ledDebt'):t('ledPaid'))+'</span>'+
      '<span class="pl-m"><span class="pl-d">'+desc+'</span><span class="pl-s">'+esc(dstr(d.ts))+byTxt(d.by,' · ')+(dbt&&d.due&&!dim?' · '+esc(t('dueOn',dueDate(d.due))):'')+'</span></span>'+
      '<span class="pl-a '+(dbt?'u':'b')+'">'+(dbt?'+':'−')+fmt(d.amount)+'<small>'+esc(t('plBal'))+' '+fmt(rb[d.id])+'</small></span></button>'}).join('');
  return '<div class="u-pw'+(dim?' dim':'')+'"><div class="u-paper"><div class="pl-ttl">'+esc(t('plTitle'))+'</div><div class="pl-who">'+esc(name)+'</div><div class="pl-sep"></div>'+rows+
    (bal!=null?'<div class="pl-sep"></div><div class="pl-tot"><span>'+esc(t('remainingDebt'))+'</span><b>'+fmt(bal)+'</b></div>':'')+'</div></div>';
}
// Para saan: detalye ng customer
function openCustomer(key){
  const c=customers().find(x=>x.key===key);if(!c){closeModal();return}
  PAYUI.key=key;PAYUI.mode='all';PAYUI.sel=new Set();
  if(archiveSettled()>0)save();
  const all=S.debts.filter(d=>d.name.trim().toLowerCase()===key).sort((a,b)=>b.ts-a.ts),led=all.filter(d=>!d.arch),old=all.filter(d=>d.arch);
  const archHtml=old.length?'<button type="button" class="btn btn-ghost btn-block arch-btn" data-act="arch-toggle" data-k="'+esc(key)+'" aria-expanded="'+(S.archClosed!==key)+'">'+esc(t('archBtn',old.length))+'</button>'+(S.archClosed!==key?'<div class="arch-list">'+paperHtml(c.name,old,true)+'</div>':''):'';
  openModal('<div class="sheet-h"><h2>'+esc(c.name)+'</h2><button class="icon-btn" data-act="close-modal" aria-label="'+esc(t('close'))+'">'+I.x+'</button></div>'+
  '<div class="u-cust"><span class="avatar big" style="--h:'+hue(c.name)+'">'+esc(c.name.charAt(0).toUpperCase())+'</span><div><div class="hint">'+esc(t('remainingDebt'))+'</div><div class="u-cbal" style="color:'+(c.bal>0.004?'var(--danger)':'var(--ok)')+'">'+fmt(c.bal)+'</div>'+(dueState(c)?'<div>'+dueChip(c)+'</div>':'')+'</div></div>'+
  (c.bal>0.004?'<div id="dp-box">'+payBlock(c)+'</div>':'<div class="chip ok">'+esc(t('paidAll'))+'</div>')+
  '<div class="u-hrow"><h3>'+esc(t('history'))+'</h3><button class="btn btn-ghost" style="min-height:36px;padding:0 12px" data-act="stmt-open" data-k="'+esc(key)+'">'+I.receipt+' '+esc(t('stmtT'))+'</button></div>'+
  '<div class="hint" style="margin-bottom:6px">'+esc(t('dTap'))+'</div>'+
  (led.length?paperHtml(c.name,led,false,c.bal):'<div class="hint" style="padding:6px 0">'+esc(t('noOpenLed'))+'</div>')+archHtml);
  modalUpd=payUpd;
}
/* ---------- V35: BAYAD SA UTANG: lahat / per resibo / per item ---------- */
const PAYUI={key:'',mode:'all',sel:new Set()};
// Para saan: mga bukas pang utang (resibo) ng customer at ang natitira sa bawat isa
function openDebtsOf(c){return S.debts.filter(d=>d.type==='utang'&&dKey(d.name)===c.key).sort((a,b)=>a.ts-b.ts).map(d=>({d,left:rcDebtState(d).left})).filter(o=>o.left>0.004)}
// Para saan: mga item ng benta na pinanggalingan ng utang
function debtLines(d){const s=d.saleId&&S.sales.find(x=>x.id===d.saleId);return s&&s.lines&&s.lines.length?s.lines:null}
// Para saan: aling mga item ng utang ang bayad na (per item na bayad)
function debtPaidIdx(d){const st=new Set();S.debts.forEach(x=>{if(x.for===d.id&&x.items)x.items.forEach(i=>st.add(i))});return st}
const debtDesc=d=>{const ls=debtLines(d);return ls?ls.map(l=>l.name+' ×'+l.qty).join(', '):(d.note||t('ledDebt'))};
const payChk='<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
// Para saan: ang buong bahagi ng pagbabayad (3 paraan)
function payBlock(c){
  const m=PAYUI.mode,pick=(k,html,amt,sub)=>'<button type="button" class="dp-pick" data-act="dp-sel" data-key="'+esc(k)+'" aria-pressed="'+PAYUI.sel.has(k)+'"><span class="dp-ck">'+payChk+'</span><span class="dp-tx"><b>'+html+'</b>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</span><span class="dp-am">'+fmt(amt)+'</span></button>';
  let body='';
  if(m==='all'){
    body='<div class="field"><label for="dp-amt">'+esc(t('amountPaid'))+'</label><input class="inp" id="dp-amt" type="number" inputmode="decimal" min="0" step="any" placeholder="0"></div>'+
    '<div class="dp-info" id="dp-info" aria-live="polite"></div>'+
    '<div class="cash-quick"><button type="button" class="btn btn-ghost" data-act="dp-fill" data-v="'+c.bal+'">'+esc(t('payAll',fmt(c.bal)))+'</button>'+[20,50,100,500,1000].map(v=>'<button type="button" class="btn btn-ghost" data-act="dp-fill" data-v="'+v+'">'+fmt(v)+'</button>').join('')+'</div>';
  }else{
    const od=openDebtsOf(c);let list='';
    if(m==='bill')list=od.map(o=>pick(o.d.id,esc(debtDesc(o.d)),o.left,dstr(o.d.ts)+(o.left<o.d.amount-0.004?' · '+t('payLeftOf',fmt(o.d.amount)):''))).join('');
    else list=od.map(o=>{
      const ls=debtLines(o.d),pi=debtPaidIdx(o.d);let rows='';
      if(ls)ls.forEach((l,i)=>{if(!pi.has(i))rows+=pick(o.d.id+':'+i,esc(l.name),r2(l.qty*l.price),l.qty+' × '+fmt(l.price))});
      if(!rows)rows=pick(o.d.id+':*',esc(debtDesc(o.d)),o.left,'');
      return '<div class="dp-grp"><span>'+esc(dstr(o.d.ts))+'</span><em>'+fmt(o.left)+'</em></div>'+rows}).join('');
    body='<div class="dp-top"><span class="hint">'+esc(t(m==='bill'?'payPickBill':'payPickItem'))+'</span><button type="button" class="btn btn-ghost dp-all" data-act="dp-selall">'+esc(t('payPickAll'))+'</button></div>'+
    '<div class="dp-list">'+list+'</div><div class="dp-sum" id="dp-sum"></div>'+
    '<div class="field"><label for="dp-rcv">'+esc(t('payRcvLbl'))+'</label><input class="inp" id="dp-rcv" type="number" inputmode="decimal" min="0" step="any" placeholder="'+esc(t('payExact'))+'"></div>'+
    '<div class="dp-info" id="dp-info" aria-live="polite"></div>'+
    '<div class="cash-quick"><button type="button" class="btn btn-ghost" data-act="dp-fill" data-v="">'+esc(t('payExact'))+'</button>'+[50,100,500,1000].map(v=>'<button type="button" class="btn btn-ghost" data-act="dp-fill" data-v="'+v+'">'+fmt(v)+'</button>').join('')+'</div>';
  }
  return '<div class="stack"><div class="seg seg3 dp-seg">'+[['all','payModeAll'],['bill','payModeBill'],['item','payModeItem']].map(x=>'<button type="button" data-act="dp-mode" data-m="'+x[0]+'" aria-selected="'+(m===x[0])+'">'+esc(t(x[1]))+'</button>').join('')+'</div>'+body+
  '<button class="btn btn-primary btn-block" id="dp-ok" data-act="dp-pay" data-k="'+esc(c.key)+'" disabled style="min-height:50px">'+esc(t('acceptPay'))+'</button>'+
  '<button class="btn btn-ghost btn-block" data-act="cust-remind" data-k="'+esc(c.key)+'" style="min-height:46px">'+I.bell+' '+esc(t('remindBtn'))+'</button></div>';
}
// Para saan: iguhit muli ang bahagi ng pagbabayad (hindi ang buong sheet)
function payRedraw(){const c=customers().find(x=>x.key===PAYUI.key),b=$('#dp-box');if(!c||!b)return;b.innerHTML=payBlock(c);payUpd()}
// Para saan: kunin ang mga napili at kabuuan nito
function paySel(c){
  const out=[];
  openDebtsOf(c).forEach(o=>{
    const d=o.d;let amt=0,idx=[];
    if(PAYUI.mode==='bill'){if(PAYUI.sel.has(d.id))amt=o.left}
    else if(PAYUI.sel.has(d.id+':*'))amt=o.left;
    else{const ls=debtLines(d);if(ls)ls.forEach((l,i)=>{if(PAYUI.sel.has(d.id+':'+i)){amt=r2(amt+l.qty*l.price);idx.push(i)}});amt=Math.min(amt,o.left)}
    if(amt>0.004)out.push({d,amt:r2(amt),idx});
  });
  return {list:out,total:r2(out.reduce((a,x)=>a+x.amt,0))};
}
// Para saan: i-update ang sukli, kulang, at ang button habang nagta-type o namimili
function payUpd(){
  const c=customers().find(x=>x.key===PAYUI.key),ok=$('#dp-ok'),i=$('#dp-info');if(!c||!ok||!i)return;
  const info=(cls,lbl,val)=>{i.className='dp-info'+(cls?' '+cls:'');i.innerHTML='<span>'+esc(lbl)+'</span><b>'+fmt(val)+'</b>'};
  if(PAYUI.mode==='all'){
    const v=parseFloat(($('#dp-amt')||{}).value);ok.disabled=!(v>0);
    if(!(v>0)){i.className='dp-info';i.innerHTML='';return}
    if(v>c.bal+1e-9)info('chg',t('payChange'),r2(v-c.bal));else info('',t('stillOwe'),r2(c.bal-v));
    return;
  }
  const s=paySel(c),sm=$('#dp-sum'),v=parseFloat(($('#dp-rcv')||{}).value),recv=v>0?v:s.total;
  if(sm)sm.innerHTML='<span>'+esc(t('paySumLbl'))+'</span><b>'+fmt(s.total)+'</b>';
  ok.textContent=t('acceptPay')+(s.total>0?' · '+fmt(s.total):'');
  ok.disabled=!(s.total>0&&recv>=s.total-1e-9);
  if(!(s.total>0)||!(v>0)){i.className='dp-info';i.innerHTML='';return}
  if(v>s.total+1e-9)info('chg',t('payChange'),r2(v-s.total));else if(v<s.total-1e-9)info('warn',t('payShort'),r2(s.total-v));else{i.className='dp-info';i.innerHTML=''}
}
let modalUpd=null;
// Para saan: kapag fully paid na ang customer, ilipat sa archive (tago) ang lahat ng dati niyang utang at bayad para bagong utang lang ang makita
function archiveSettled(){
  let n=0;
  customers().forEach(c=>{if(c.bal<=0.004)S.debts.forEach(d=>{if(!d.arch&&d.name.trim().toLowerCase()===c.key){d.arch=true;n++}})});
  return n;
}
// Para saan: bayad sa utang (lahat / per resibo / per item). Ang sobra ay SUKLI.
function payDebt(key){
  if(!tmNeedSell())return;
  const c=customers().find(x=>x.key===key);if(!c||c.bal<=0.004)return;
  const done=()=>{renderNav();if(S.tab==='utang')renderUtang()};
  if(PAYUI.mode==='all'){
    const v=parseFloat($('#dp-amt').value);if(!(v>0))return;
    const pay=Math.min(v,c.bal),chg=r2(v-pay);
    const rec={id:uid(),ts:Date.now(),name:c.name,type:'bayad',amount:r2(pay),by:curBy()};
    if(chg>0.004){rec.tendered=r2(v);rec.change=chg}
    S.debts.push(rec);archiveSettled();save();checkDue();
    const left=r2(c.bal-pay);
    toast(t('receivedN',fmt(r2(v))),{sub:chg>0.004?t('payChange')+': '+fmt(chg):(left>0.004?t('leftTo',c.name,fmt(left)):t('fullyPaidName',c.name))});sfx('success');
    done();if(chg>0.004)rcOpen(rcModelDebt(rec),null,rec.id);else openCustomer(key);
    return;
  }
  const s=paySel(c);if(!s.list.length)return;
  const v=parseFloat($('#dp-rcv').value),recv=v>0?r2(v):s.total;if(recv<s.total-1e-9)return;
  const chg=r2(recv-s.total),grp=uid(),now=Date.now();
  const recs=s.list.map((x,n)=>{const r={id:uid(),ts:now+n,name:c.name,type:'bayad',amount:x.amt,for:x.d.id,grp,tendered:recv,by:curBy()};if(PAYUI.mode==='item'&&x.idx.length)r.items=x.idx;if(chg>0.004)r.change=chg;return r});
  recs.forEach(r=>S.debts.push(r));archiveSettled();save();checkDue();
  toast(t('receivedN',fmt(recv)),{sub:chg>0.004?t('payChange')+': '+fmt(chg):t('payDone',s.list.length)});sfx('success');
  done();rcOpen(rcModelDebt(recs[0]),null,recs[0].id);
}
// Para saan: manual na dagdag utang
function openManualDebt(){
  if(!tmNeedSell())return;
  const names=customers().sort((a,b)=>b.last-a.last).slice(0,8);
  openModal('<div class="sheet-h"><h2>'+esc(t('addDebt'))+'</h2><button class="icon-btn" data-act="close-modal" aria-label="'+esc(t('close'))+'">'+I.x+'</button></div>'+
  '<div class="stack"><div class="field"><label for="md-name">'+esc(t('name'))+'</label><input class="inp" id="md-name" maxlength="40" placeholder="'+esc(t('namePhBerto'))+'" autocomplete="off"></div>'+
  (names.length?'<div class="name-chips">'+names.map(c=>'<button type="button" data-act="pick-md" data-n="'+esc(c.name)+'">'+esc(c.name)+'</button>').join('')+'</div>':'')+
  '<div class="field"><label for="md-amt">'+esc(t('amountPeso'))+'</label><input class="inp" id="md-amt" type="number" inputmode="decimal" min="0" step="any" placeholder="0"></div>'+
  dueField('due-md')+
  '<div class="field"><label for="md-note">'+esc(t('noteOpt'))+'</label><input class="inp" id="md-note" maxlength="60" placeholder="'+esc(t('notePh'))+'" autocomplete="off"></div>'+
  '<div class="err" id="md-err" role="alert"></div></div>'+
  '<div class="sheet-f"><button class="btn btn-ghost" data-act="close-modal">'+esc(t('cancel'))+'</button><button class="btn btn-primary" data-act="md-save">'+esc(t('save'))+'</button></div>');
  setTimeout(()=>{const n=$('#md-name');n&&n.focus()},60);
}
// Para saan: i-save ang manual na utang
function saveManualDebt(){
  const name=$('#md-name').value.trim(),amt=parseFloat($('#md-amt').value),note=$('#md-note').value.trim(),err=$('#md-err');
  if(name.length<2){err.textContent=t('errDebtName');return}
  if(!(amt>0)){err.textContent=t('errDebtAmt');return}
  const ex=customers().find(x=>x.key===name.toLowerCase());
  const ts=Date.now();
  S.debts.push({id:uid(),ts,name:ex?ex.name:name,type:'utang',amount:r2(amt),by:curBy(),due:dueStamp(readDays('due-md'),ts),note:note||''});
  save();askNotif();checkDue();closeModal();toast(t('debtRecorded',ex?ex.name:name),{sub:fmt(r2(amt))});
  renderNav();if(S.tab==='utang')renderUtang();
}
