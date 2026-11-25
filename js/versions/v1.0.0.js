'use strict';
/* ============================================================
   TINDAMO V1.0.0 (WEBSITE)   [versions/v1.0.0.js]
   Ito na ang ISANG file ng lahat ng dating patch (dating v1.0.0 hanggang v1.2.8). Nagsimula ulit ang bilang sa 1.0.0.
   Ang ayos ng mga seksyon sa ibaba ay ang dating ayos ng pag-load, kaya pareho pa rin ang takbo ng app.
   Sa DULO ng file: ang bahaging pang-WEBSITE (update = i-refresh ang page, hindi APK).
   Susunod na bagong patch: gumawa ng js/versions/v1.0.1.js, idagdag sa index.html at sa SHELL ng sw.js.
   ============================================================ */

/* ################################################################
   DATING V1.0.0  (isinama na sa v1.0.0)
   ################################################################ */
/* ============================================================
   ITO PARA SA MGA BAGO SA V27   [versions/v1.0.0.js]
   - Scroll na hindi na bumabalik sa taas kapag muling iginuhit ang Inventory / Utang
   - Ibalik (Undo) kapag naalis ang item sa cart
   - Pindutin ang bilang sa cart para i-type ang eksaktong dami
   - Paalalahanan ang may utang (i-share ang mensahe)
   - Listahan ng bibilhin (kulang na stock) na pwedeng i-share
   ============================================================ */

/* ---------- scroll: hindi babalik sa taas ---------- */
// Para saan: iguhit ulit ang isang tab pero ibalik ang scroll nito at ng mga listahan sa loob
function keepView(fn){
  const v=$('#view');
  if(!v||v.dataset.tab!==S.tab)return fn();
  const y=v.scrollTop,sn=snapScroll(v,KEEP_SC),r=fn();
  v.scrollTop=y;putScroll(v,sn);return r;
}
{ const ri=renderInv;renderInv=function(){return keepView(()=>ri.apply(this,arguments))};
  const ru=renderUtang;renderUtang=function(){return keepView(()=>ru.apply(this,arguments))}; }

/* ---------- ibalik ang naalis sa cart ---------- */
// Para saan: kopya ng cart bago alisin
const cartUndoSnap=()=>JSON.stringify(S.cart);
// Para saan: toast na may "Ibalik" (kapag may naalis na linya)
function cartUndoToast(was,id){
  const prev=JSON.parse(was);if(!prev.length)return;
  const it=id?byId(id):null;
  toast(id&&it?t('removedN',it.name):t('cartClearedT'),{kind:'warn',ms:4200,action:{label:t('undo'),fn:()=>{
    S.cart=prev.filter(l=>byId(l.id));updateSell();sfx('scan');
  }}});
}

/* ---------- i-type ang dami sa cart ---------- */
// Para saan: pop-up para sa eksaktong dami ng isang item sa cart
function openQtyEdit(id){
  const it=byId(id),l=S.cart.find(x=>x.id===id);if(!it||!l)return;
  openModal('<div class="sheet-h"><h2>'+esc(it.name)+'</h2><button class="icon-btn" data-act="close-modal" aria-label="'+esc(t('close'))+'">'+I.x+'</button></div>'+
  '<div class="field"><label for="qe-in">'+esc(t('qtyEditT'))+'</label><input class="inp" id="qe-in" type="number" inputmode="numeric" min="0" step="1" value="'+l.qty+'" data-id="'+esc(id)+'"></div>'+
  (it.stockOn?'<div class="hint">'+esc(t('qtyMax',Number(it.stock)||0))+'</div>':'')+
  '<div class="err" id="qe-err" role="alert"></div>'+
  '<div class="sheet-f"><button class="btn btn-ghost" data-act="close-modal">'+esc(t('cancel'))+'</button><button class="btn btn-primary" data-act="qty-save" data-id="'+esc(id)+'">'+esc(t('save'))+'</button></div>');
  const i=$('#qe-in');
  i.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();qtySave(id)}});
  setTimeout(()=>{i.focus();i.select()},60);
}
// Para saan: i-save ang bagong dami
function qtySave(id){
  const it=byId(id),l=S.cart.find(x=>x.id===id),i=$('#qe-in'),err=$('#qe-err');if(!it||!l||!i)return;
  const v=parseInt(i.value,10);
  if(isNaN(v)||v<0){err.textContent=t('qtyBad');return}
  if(it.stockOn&&v>(Number(it.stock)||0)){err.textContent=t('qtyMax',Number(it.stock)||0);return}
  const was=cartUndoSnap();
  if(v===0){S.cart=S.cart.filter(x=>x.id!==id);cartUndoToast(was,id)}else l.qty=v;
  closeModal();updateSell();
}

/* ---------- ibahagi ang text (paalala, listahan) ---------- */
// Para saan: share sheet ng phone; kung wala, kopyahin
async function shareText(text){
  try{
    if(NATIVE.on&&NATIVE.shareText){await NATIVE.shareText(text);return}
    if(navigator.share){await navigator.share({text});return}
  }catch(e){if(e&&(e.name==='AbortError'||/cancel/i.test(e.message||'')))return}
  try{await navigator.clipboard.writeText(text);toast(t('copiedMsg'))}
  catch(e){
    const ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();
    try{document.execCommand('copy');toast(t('copiedMsg'))}catch(x){}ta.remove();
  }
}
// Para saan: mensahe ng paalala sa may utang
function remindText(c){return t('remindMsg',c.name,fmt(c.bal),S.store||'TindaMo',c.due?t('remindDue',dueDate(c.due)):'')}

/* ---------- listahan ng bibilhin (kulang na stock) ---------- */
const restockItems=()=>{
  const sn=i=>Number(i.stock)||0;
  return S.items.filter(i=>i.stockOn&&sn(i)<=(Number(i.warn)||0)).sort((a,b)=>sn(a)-sn(b)||a.name.localeCompare(b.name));
};
const restockText=list=>[S.store||'TindaMo',t('restockTitle'),'------------------------'].concat(list.map(i=>'• '+t('restockLine',i.name,Number(i.stock)||0))).join('\n');
// Para saan: pop-up ng mga kulang na stock
function openRestock(){
  const list=restockItems();
  openModal('<div class="sheet-h"><h2>'+esc(t('restockTitle'))+'</h2><button class="icon-btn" data-act="close-modal" aria-label="'+esc(t('close'))+'">'+I.x+'</button></div>'+
  (list.length?'<div class="stack">'+list.map(it=>'<div class="hold-row"><div style="min-width:0;display:flex;align-items:center;gap:10px">'+thumb(it)+'<b style="overflow-wrap:anywhere">'+esc(it.name)+'</b></div>'+stockChip(it)+'</div>').join('')+'</div>'+
    '<div class="sheet-f"><button class="btn btn-ghost" data-act="close-modal">'+esc(t('close'))+'</button><button class="btn btn-primary" data-act="restock-share">'+esc(t('shareT'))+'</button></div>'
  :'<div class="hint" style="padding:14px 0">'+esc(t('restockEmpty'))+'</div>'));
}

Object.assign(ACTIONS,{
  'qty-edit':b=>openQtyEdit(b.dataset.id),
  'qty-save':b=>qtySave(b.dataset.id),
  'cust-remind':b=>{const c=customers().find(x=>x.key===b.dataset.k);if(c)shareText(remindText(c))},
  'restock':()=>openRestock(),
  'restock-share':()=>shareText(restockText(restockItems()))
});
// Para saan: Enter / Space sa bilang ng cart (keyboard)
document.addEventListener('keydown',e=>{
  const n=e.target&&e.target.classList&&e.target.classList.contains('qty-n');
  if(n&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openQtyEdit(e.target.dataset.id)}
});

/* ################################################################
   DATING V1.0.1  (isinama na sa v1.0.0)
   ################################################################ */
/* ============================================================
   ITO PARA SA MGA BAGO SA V31   [versions/v1.0.1.js]
   - Chat: paglabas ng keyboard, awtomatikong bumababa sa PINAKAILALIM ng usapan (user at admin)
   - Cute na tunog sa bawat pindot (gawa sa code, walang mp3; sumusunod sa Sound on/off sa Settings)
   - BAGO: End-of-day report (pindutin ang "Benta ngayon" sa Sell)
   - Mga bagong salita (5 wika)
   ============================================================ */

/* ---------- mga bagong salita ---------- */
Object.assign(D,{
clrT:[`Burahin ang usapan`,`Clear chat`,`대화 지우기`,`清空聊天`,`チャットを消去`],
clrQ:[`Burahin ang buong usapan?`,`Clear this whole chat?`,`이 대화를 모두 지울까요?`,`清空整个聊天？`,`このチャットをすべて消しますか？`],
clrP:[`Mabubura ang lahat ng mensahe ninyo, pati sa phone ng user. Hindi na ito maibabalik.`,`All your messages will be deleted, including on the user's phone. This can't be undone.`,`모든 메시지가 삭제되며 사용자 폰에서도 사라져요. 되돌릴 수 없어요.`,`你们的所有消息都会被删除，包括用户手机上的。此操作无法撤销。`,`双方のメッセージがすべて削除され、ユーザーの端末からも消えます。元に戻せません。`],
clrYes:[`Oo, burahin`,`Yes, clear`,`네, 지울게요`,`是，清空`,`はい、消去`],
clrDone:[`Nabura na ang usapan`,`Chat cleared`,`대화를 지웠어요`,`聊天已清空`,`チャットを消去しました`],
eodT:[`Ulat ngayong araw`,`End-of-day report`,`오늘의 마감 리포트`,`今日结算报告`,`本日のレポート`],
eodTotal:[`Kabuuang benta`,`Total sales`,`총 매출`,`总销售额`,`売上合計`],
eodCash:[`Cash`,`Cash`,`현금`,`现金`,`現金`],
eodDebt:[`Naging utang`,`On credit`,`외상`,`赊账`,`ツケ`],
eodTx:[`Bilang ng benta`,`Transactions`,`거래 수`,`交易笔数`,`取引数`],
eodAvg:[`Karaniwan kada benta`,`Average per sale`,`건당 평균`,`平均每笔`,`1件あたり平均`],
eodBusy:[`Pinaka-abalang oras`,`Busiest hour`,`가장 바쁜 시간`,`最忙时段`,`最も忙しい時間`],
eodTop:[`Pinakamabentang item`,`Best sellers`,`베스트 상품`,`热销商品`,`売れ筋`],
eodNone:[`Wala pang benta ngayon. Pag may nabenta na, lalabas dito ang ulat.`,`No sales yet today. The report shows up here once you sell something.`,`오늘은 아직 매출이 없어요. 판매하면 여기에 리포트가 나와요.`,`今天还没有销售。有销售后报告会显示在这里。`,`今日はまだ売上がありません。売れるとここにレポートが出ます。`],
eodShare:[`Ibahagi ang ulat`,`Share report`,`리포트 공유`,`分享报告`,`レポートを共有`]
});

/* ---------- 1. KEYBOARD SA CHAT: laging sa pinakailalim ---------- */
// Para saan: ibaba ang usapan hanggang dulo
function chatBottom(){const c=document.querySelector('#ib-chat');if(c)c.scrollTop=c.scrollHeight}
// Para saan: nakapokus ba ang user sa lalagyan ng mensahe (keyboard bukas)
const chatTyping=()=>{const a=document.activeElement;return !!a&&(a.id==='ib-in'||a.id==='ib-rep')};
// Para saan: ilang beses i-scroll habang gumagalaw ang keyboard (iba-iba ang bilis ng bawat phone)
function chatBottomSoon(){[0,60,160,320,560,900].forEach(ms=>setTimeout(()=>{if(chatTyping())chatBottom()},ms))}
// Para saan: bantayan ang laki ng usapan; kapag lumiit/lumaki (keyboard), bumaba ulit sa dulo
function chatWatch(){
  const c=document.querySelector('#ib-chat');
  if(c&&!c._ro&&'ResizeObserver' in window){c._ro=new ResizeObserver(()=>{if(chatTyping())chatBottom()});c._ro.observe(c)}
}
// Para saan: kung ang keyboard ay nakapatong lang (hindi lumiliit ang screen), paliitin ang chat para kita ang sulatan
function kbSync(){
  const vv=window.visualViewport,root=document.documentElement;
  const chat=S.page==='message'&&!!document.querySelector('#ib-body');
  const over=!!vv&&(window.innerHeight-vv.height>120);
  const on=chat&&over;
  root.classList.toggle('kb-open',on);
  if(on){root.style.setProperty('--vvh',vv.height+'px');root.style.setProperty('--vvt',vv.offsetTop+'px')}
  if(chat&&chatTyping())chatBottomSoon();
}
document.addEventListener('focusin',e=>{
  if(e.target&&(e.target.id==='ib-in'||e.target.id==='ib-rep')){chatWatch();chatBottomSoon()}
});
document.addEventListener('focusout',()=>setTimeout(kbSync,120));
window.addEventListener('resize',kbSync);
if(window.visualViewport){visualViewport.addEventListener('resize',kbSync);visualViewport.addEventListener('scroll',kbSync)}

/* ---------- 2. CUTE NA TUNOG SA PINDOT ---------- */
const TAPFX={ctx:null,at:0};
// Para saan: audio engine (isang beses; nagigising sa unang pindot)
function tapCtx(){
  if(!TAPFX.ctx){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;try{TAPFX.ctx=new C()}catch(e){return null}}
  if(TAPFX.ctx.state==='suspended')TAPFX.ctx.resume().catch(()=>{});
  return TAPFX.ctx;
}
// Para saan: isang munting "bloop" (mula freq a papunta b, sa loob ng dur segundo)
function tapNote(c,t0,a,b,dur,vol,type){
  const o=c.createOscillator(),g=c.createGain();
  o.type=type||'sine';
  o.frequency.setValueAtTime(a,t0);o.frequency.exponentialRampToValueAtTime(b,t0+dur*.8);
  g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(vol,t0+.012);g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
  o.connect(g);g.connect(c.destination);o.start(t0);o.stop(t0+dur+.03);
}
// Para saan: patunugin ang cute na tunog. kind: pop | up | down | tab | ok | no
function tapSound(kind){
  if(prefs.sound===false)return;
  const now=performance.now();if(now-TAPFX.at<45)return;TAPFX.at=now;
  const c=tapCtx();if(!c)return;
  const t0=c.currentTime+.005,v=.9+Math.random()*.2;   // konting iba-iba para hindi nakakaumay
  switch(kind){
    case 'up':tapNote(c,t0,620*v,980*v,.09,.13);tapNote(c,t0+.055,1240*v,1480*v,.08,.06,'triangle');break;
    case 'down':tapNote(c,t0,560*v,330*v,.1,.13);break;
    case 'tab':tapNote(c,t0,900*v,1050*v,.05,.07,'triangle');break;
    case 'ok':tapNote(c,t0,660*v,880*v,.08,.12);tapNote(c,t0+.075,990*v,1320*v,.13,.12);break;
    case 'no':tapNote(c,t0,330*v,210*v,.13,.12,'triangle');break;
    default:tapNote(c,t0,560*v,860*v,.07,.12);
  }
}
const TAP_UP=/^(inc|add-quick|sell-add|new-item|ad-add|sample)$/,TAP_DOWN=/^(dec|rm|clear-cart|hold)$/;
const TAP_OK=/^(pay|checkout|pf-save|md-save|dp-pay|qty-save|ib-send|ib-reply|eod-share|restock-share|ib-topic)$/;
const TAP_TAB=/^(tab|inv-cat|inv-f|sell-cat|ad-tab|ad-filter|sa-day)$/;
const TAP_NO=/(^del|-del|^ad-rm|^ib-clear|logout|delete)/;
// Para saan: piliin ang tunog ayon sa pinindot
function tapKind(el){
  const a=el.dataset&&el.dataset.act||'';
  if(TAP_NO.test(a)||el.classList.contains('btn-danger'))return 'no';
  if(TAP_OK.test(a)||el.classList.contains('btn-primary'))return 'ok';
  if(TAP_UP.test(a))return 'up';
  if(TAP_DOWN.test(a))return 'down';
  if(TAP_TAB.test(a)||el.classList.contains('cat')||el.closest('.nav,.seg'))return 'tab';
  return 'pop';
}
document.addEventListener('click',e=>{
  const el=e.target&&e.target.closest&&e.target.closest('button,[data-act],[role=button],[role=tab],.cat,.ib-chip');
  if(!el||el.disabled||el.getAttribute('aria-disabled')==='true')return;
  if(el.closest('#splash'))return;
  tapSound(tapKind(el));
},true);

/* ---------- 3. BAGO: END-OF-DAY REPORT ---------- */
// Para saan: buuin ang bilang ng benta ngayong araw
function eodData(){
  const st=dayStart(),list=S.sales.filter(s=>s.ts>=st),sp=split(list);
  const tally={},hours={};
  list.forEach(s=>{
    const h=new Date(s.ts).getHours();hours[h]=(hours[h]||0)+1;
    (s.lines||[]).forEach(l=>{const k=l.name||'?',o=tally[k]||(tally[k]={name:k,qty:0,amt:0});o.qty+=Number(l.qty)||0;o.amt+=(Number(l.qty)||0)*(Number(l.price)||0)});
  });
  const top=Object.values(tally).sort((a,b)=>b.qty-a.qty||b.amt-a.amt).slice(0,5);
  const bh=Object.keys(hours).sort((a,b)=>hours[b]-hours[a])[0];
  const yAll=split(S.sales.filter(s=>s.ts>=st-864e5&&s.ts<st)).all,got=r2(S.debts.filter(x=>x.type!=='utang'&&!x.sp&&x.ts>=st).reduce((a,x)=>a+x.amount,0));
  const gc=r2(list.filter(s=>s.method==='gcash').reduce((a,s)=>a+s.total,0));
  return {yAll,got,n:list.length,cash:r2(sp.cash-gc),gc,debt:sp.debt,all:sp.all,avg:list.length?r2(sp.all/list.length):0,top,busy:bh==null?null:+bh};
}
const eodVs=d=>d.yAll>0?(d.all>=d.yAll?'▲ ':'▼ ')+Math.abs(Math.round((d.all-d.yAll)/d.yAll*100))+'%':'';
const eodHour=h=>new Date(2000,0,1,h).toLocaleTimeString(loc(),{hour:'numeric'});
// Para saan: text na ibabahagi
function eodText(d){
  const L=[S.store||'TindaMo',t('eodT')+' · '+dFmt(Date.now(),{month:'short',day:'numeric',year:'numeric'}),'------------------------',
    t('eodTotal')+': '+fmt(d.all),t('eodCash')+': '+fmt(d.cash),t('eodDebt')+': '+fmt(d.debt),t('eodTx')+': '+d.n];
  if(d.gc>0)L.push('GCash: '+fmt(d.gc));
  if(eodVs(d))L.push(t('eodVs')+': '+eodVs(d));if(d.got>0)L.push(t('eodPaidIn')+': '+fmt(d.got));
  if(d.top.length){L.push('',t('eodTop')+':');d.top.forEach(x=>L.push('• '+x.name+' ×'+x.qty+' — '+fmt(r2(x.amt))))}
  return L.join('\n');
}
// Para saan: buksan ang report
function openEod(){
  const d=eodData();
  const row=(k,v)=>'<div class="eod-row"><span>'+esc(k)+'</span><b>'+esc(v)+'</b></div>';
  openModal('<div class="sheet-h"><h2>'+esc(t('eodT'))+'</h2><button class="icon-btn" data-act="close-modal" aria-label="'+esc(t('close'))+'">'+I.x+'</button></div>'+
  (d.n?
    '<div class="eod-big"><small>'+esc(t('eodTotal'))+'</small><b>'+fmt(d.all)+'</b></div>'+
    '<div class="ad-stats"><div class="ad-st"><small>'+esc(t('eodCash'))+'</small><b class="g">'+fmt(d.cash)+'</b></div><div class="ad-st"><small>'+esc(t('eodDebt'))+'</small><b>'+fmt(d.debt)+'</b></div></div>'+
    '<div style="margin-top:10px">'+row(t('eodTx'),String(d.n))+(d.gc>0?row('GCash',fmt(d.gc)):'')+row(t('eodAvg'),fmt(d.avg))+(d.busy!=null?row(t('eodBusy'),eodHour(d.busy)):'')+(eodVs(d)?row(t('eodVs'),eodVs(d)):'')+(d.got>0?row(t('eodPaidIn'),fmt(d.got)):'')+'</div>'+
    (d.top.length?'<div class="set-sec"><span class="lbl">'+esc(t('eodTop'))+'</span>'+d.top.map((x,i)=>'<div class="eod-row"><span style="overflow-wrap:anywhere">'+(i+1)+'. '+esc(x.name)+' ×'+x.qty+'</span><b>'+fmt(r2(x.amt))+'</b></div>').join('')+'</div>':'')+
    '<div class="sheet-f"><button class="btn btn-ghost" data-act="close-modal">'+esc(t('close'))+'</button><button class="btn btn-primary" data-act="eod-share">'+esc(t('eodShare'))+'</button></div>'
  :'<div class="hint" style="padding:14px 0">'+esc(t('eodNone'))+'</div><div class="sheet-f"><button class="btn btn-ghost" data-act="close-modal">'+esc(t('close'))+'</button></div>'));
}
Object.assign(ACTIONS,{
  'eod':()=>openEod(),
  'eod-share':()=>shareText(eodText(eodData()))
});
// Para saan: Enter / Space sa "Benta ngayon" (keyboard)
document.addEventListener('keydown',e=>{
  const b=e.target&&e.target.classList&&e.target.classList.contains('s-big');
  if(b&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openEod()}
});

/* ################################################################
   DATING V1.0.2  (isinama na sa v1.0.0)
   ################################################################ */
/* ============================================================
   ITO PARA SA MGA BAGO SA V32   [versions/v1.0.2.js]
   - Hilahin pababa ang guhit sa taas ng kahit anong pop-up para isara (sumusunod ang daliri)
   - Bagong magandang kalendaryo sa pagpili ng petsa (expiry) + mabilis na pindot (1 linggo, 1 buwan...)
   - Sticker: may ON/OFF na switch sa crop, naka-ON palagi
   - Mga bagong salita (5 wika)
   ============================================================ */

Object.assign(D,{
rcUnpaid:[`Hindi Pa Bayad`,`Not Yet Paid`,`미결제`,`未付款`,`未払い`],
rcFully:[`Fully Paid`,`Fully Paid`,`완납`,`已付清`,`支払い済み`],
rcPartial:[`Bahagyang Bayad`,`Partially Paid`,`일부 결제`,`部分已付`,`一部支払い済み`],
usePhoto:[`Gamitin ang larawan`,`Use photo`,`사진 사용`,`使用照片`,`写真を使う`],
calSel:[`Napiling petsa`,`Selected date`,`선택한 날짜`,`已选日期`,`選んだ日付`],
calNone:[`Wala pang napili`,`Nothing picked yet`,`아직 선택 안 함`,`尚未选择`,`未選択`],
calToday:[`Ngayon`,`Today`,`오늘`,`今天`,`今日`],
calW1:[`1 linggo`,`1 week`,`1주`,`1周`,`1週間`],
calM1:[`1 buwan`,`1 month`,`1개월`,`1个月`,`1か月`],
calM3:[`3 buwan`,`3 months`,`3개월`,`3个月`,`3か月`],
calM6:[`6 buwan`,`6 months`,`6개월`,`6个月`,`6か月`],
calY1:[`1 taon`,`1 year`,`1년`,`1年`,`1年`],
eodVs:[`Kumpara kahapon`,`Vs yesterday`,`어제 대비`,`较昨天`,`昨日比`],
eodPaidIn:[`Nabayaran ngayon (utang)`,`Debts collected today`,`오늘 받은 외상`,`今日收回赊账`,`本日回収したツケ`]
});

/* ---------- 1. HILAHIN PABABA ANG POP-UP PARA ISARA ---------- */
// Para saan: lagyan ng hawakan (guhit) ang bawat pop-up sheet
(function(){
  const _open=openModal;
  openModal=function(html){
    _open(html);
    const s=document.querySelector('#modal .sheet');
    if(s&&!s.classList.contains('full')&&!s.querySelector('.sheet-grab')){
      const g=document.createElement('div');g.className='sheet-grab';g.setAttribute('aria-hidden','true');g.innerHTML='<i></i>';
      s.insertBefore(g,s.firstChild);
    }
  };
})();
// Para saan: hawakan ang guhit (o ang pamagat) at hilahin pababa; bitawan sa baba = sarado, kulang = bumabalik
const SHEETDRAG={d:null};
document.addEventListener('pointerdown',e=>{
  const el=e.target&&e.target.closest?e.target:null;if(!el)return;
  const z=el.closest('.sheet-grab,.sheet-h');
  if(!z||el.closest('button,a,input,select,textarea,label'))return;
  const sh=z.closest('.sheet');if(!sh||sh.classList.contains('full'))return;
  SHEETDRAG.d={sh,z,id:e.pointerId,y0:e.clientY,dy:0,v:0,ly:e.clientY,lt:performance.now(),moved:false};
  try{z.setPointerCapture(e.pointerId)}catch(_){}
});
document.addEventListener('pointermove',e=>{
  const d=SHEETDRAG.d;if(!d||e.pointerId!==d.id)return;
  const dy=e.clientY-d.y0;
  if(!d.moved){if(Math.abs(dy)<6)return;d.moved=true;d.sh.style.animation='none';d.sh.style.transition='none';d.sh.style.willChange='transform';d.sh.classList.add('dragging')}
  d.dy=dy>0?dy:dy/6;                                   // pataas: mabigat, halos hindi gagalaw
  const now=performance.now();d.v=.7*d.v+.3*((e.clientY-d.ly)/Math.max(1,now-d.lt));d.ly=e.clientY;d.lt=now;
  d.sh.style.transform='translateY('+d.dy+'px)';
  const m=document.getElementById('modal');if(m)m.style.setProperty('--dim',String(Math.max(.25,1-Math.max(0,d.dy)/(d.sh.offsetHeight*1.1))));
  e.preventDefault();
},{passive:false});
function sheetDragEnd(e){
  const d=SHEETDRAG.d;if(!d||(e&&e.pointerId!==d.id))return;SHEETDRAG.d=null;
  try{d.z.releasePointerCapture(d.id)}catch(_){}
  if(!d.moved)return;
  const m=document.getElementById('modal'),h=d.sh.offsetHeight||300;
  if(e&&e.type!=='pointercancel'&&(d.dy>h*.25||d.v>.6)){
    d.sh.style.transition='transform .2s ease-out';d.sh.style.transform='translateY('+(h+40)+'px)';
    if(m)m.style.setProperty('--dim','0');
    buzz(8);setTimeout(()=>{if(m)m.style.removeProperty('--dim');closeModal()},190);
  }else{
    d.sh.style.transition='transform .32s cubic-bezier(.2,.9,.3,1.15)';d.sh.style.transform='translateY(0)';
    if(m)m.style.removeProperty('--dim');
    setTimeout(()=>{d.sh.style.transition='';d.sh.style.transform='';d.sh.style.willChange='';d.sh.classList.remove('dragging')},340);
  }
}
document.addEventListener('pointerup',sheetDragEnd);
document.addEventListener('pointercancel',sheetDragEnd);
// ang click na sumusunod sa paghila ay hindi dapat makapindot ng kahit ano
document.addEventListener('click',e=>{if(SHEETDRAG.last&&performance.now()-SHEETDRAG.last<250){e.stopPropagation();e.preventDefault()}},true);
document.addEventListener('pointerup',()=>{if(SHEETDRAG.d&&SHEETDRAG.d.moved)SHEETDRAG.last=performance.now()},true);

/* ---------- 2. BAGONG KALENDARYO SA PAGPILI NG PETSA ---------- */
const CAL={y:0,m:0};
const calIso=(y,m,d)=>y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
const calOk=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'');
// Para saan: dagdagan ng buwan nang hindi lumalampas (hal. Ene 31 + 1 buwan = Peb 28)
function calAddMonths(n){const d=new Date(),day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+n);const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last));return d}
const CAL_Q=[['calW1',()=>{const d=new Date();d.setDate(d.getDate()+7);return d}],['calM1',()=>calAddMonths(1)],['calM3',()=>calAddMonths(3)],['calM6',()=>calAddMonths(6)],['calY1',()=>calAddMonths(12)]];
const calChev=(p)=>'<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="'+p+'"/></svg>';
// Para saan: iguhit ang kalendaryo
function calDraw(){
  const box=document.getElementById('cal');if(!box)return;
  const L=loc(),y=CAL.y,m=CAL.m,sel=calOk(form.exp)?form.exp:'',now=new Date(),todayIso=calIso(now.getFullYear(),now.getMonth(),now.getDate());
  const first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate();
  const wd=Array.from({length:7},(_,i)=>new Date(2024,0,7+i).toLocaleDateString(L,{weekday:'short'}).slice(0,2));
  let cells='';for(let i=0;i<first;i++)cells+='<span class="cal-e"></span>';
  for(let d=1;d<=days;d++){
    const iso=calIso(y,m,d),cls=(iso===sel?' sel':'')+(iso===todayIso?' today':'')+(iso<todayIso?' past':'');
    cells+='<button type="button" class="cal-d'+cls+'" data-act="cal-day" data-iso="'+iso+'" aria-pressed="'+(iso===sel)+'">'+d+'</button>';
  }
  const selTxt=sel?new Date(sel+'T00:00:00').toLocaleDateString(L,{weekday:'short',month:'long',day:'numeric',year:'numeric'}):t('calNone');
  box.innerHTML=
    '<div class="cal-top"><small>'+esc(t('calSel'))+'</small><b'+(sel?'':' class="none"')+'>'+esc(selTxt)+'</b></div>'+
    '<div class="cal-q">'+CAL_Q.map((q,i)=>'<button type="button" data-act="cal-q" data-i="'+i+'">+ '+esc(t(q[0]))+'</button>').join('')+'<button type="button" data-act="cal-today">'+esc(t('calToday'))+'</button></div>'+
    '<div class="cal-nav"><button type="button" data-act="cal-yp" aria-label="-1">'+calChev('m11 17-5-5 5-5M18 17l-5-5 5-5')+'</button><button type="button" data-act="cal-mp" aria-label="‹">'+calChev('m15 18-6-6 6-6')+'</button>'+
    '<strong>'+esc(new Date(y,m,1).toLocaleDateString(L,{month:'long',year:'numeric'}))+'</strong>'+
    '<button type="button" data-act="cal-mn" aria-label="›">'+calChev('m9 18 6-6-6-6')+'</button><button type="button" data-act="cal-yn" aria-label="+1">'+calChev('m13 17 5-5-5-5M6 17l5-5-5-5')+'</button></div>'+
    '<div class="cal-w">'+wd.map(x=>'<span>'+esc(x)+'</span>').join('')+'</div><div class="cal-g">'+cells+'</div>';
}
// Para saan: ilipat ang buwan/taon sa kalendaryo
function calMove(dm){const d=new Date(CAL.y,CAL.m+dm,1);CAL.y=d.getFullYear();CAL.m=d.getMonth();const g=document.querySelector('#cal .cal-g');if(g){g.classList.remove('slide');void g.offsetWidth}calDraw();const g2=document.querySelector('#cal .cal-g');if(g2)g2.classList.add('slide')}
function calPick(d){form.exp=calIso(d.getFullYear(),d.getMonth(),d.getDate());CAL.y=d.getFullYear();CAL.m=d.getMonth();calDraw()}
// Para saan: expiry sa form, gamit na ang bagong kalendaryo
drawExpBox=function(){
  const on=form.expOn;
  document.querySelectorAll('[data-act="exp-on"],[data-act="exp-off"]').forEach(b=>b.setAttribute('aria-selected',String((b.dataset.act==='exp-on')===on)));
  const b=document.getElementById('pf-expbox');if(!b)return;
  if(!on){b.innerHTML='';return}
  const base=calOk(form.exp)?new Date(form.exp+'T00:00:00'):new Date();
  CAL.y=base.getFullYear();CAL.m=base.getMonth();
  b.innerHTML='<div class="cal" id="cal"></div>';calDraw();
};
Object.assign(ACTIONS,{
  'cal-day':b=>{const [y,m,d]=b.dataset.iso.split('-').map(Number);calPick(new Date(y,m-1,d))},
  'cal-q':b=>{const q=CAL_Q[+b.dataset.i];if(q)calPick(q[1]())},
  'cal-today':()=>calPick(new Date()),
  'cal-mp':()=>calMove(-1),'cal-mn':()=>calMove(1),'cal-yp':()=>calMove(-12),'cal-yn':()=>calMove(12)
});

/* ---------- 3. STICKER: ON/OFF SA CROP (naka-ON palagi) ---------- */
document.addEventListener('change',e=>{
  if(!e.target||e.target.id!=='cr-stk')return;
  const b=document.querySelector('[data-act="cr-done"]');if(b)b.textContent=e.target.checked?t('makeSticker'):t('usePhoto');
});

/* ################################################################
   DATING V1.0.3  (isinama na sa v1.0.0)
   ################################################################ */
/* ============================================================
   ITO PARA SA MGA BAGO SA V34   [versions/v1.0.3.js]
   - Clear Data Utang (sa Profile), burahin ang isang utang/bayad (sa resibo)
   - Sukli kapag sobra ang ibinayad sa utang
   - Mga bagong salita (5 wika)
   ============================================================ */
Object.assign(D,{
clearDebt:[`Clear Data Utang`,`Clear Debt Data`,`외상 데이터 삭제`,`清除赊账数据`,`ツケのデータを消去`],
clearDebtQ:[`I-clear ang lahat ng utang?`,`Clear all debts?`,`모든 외상을 삭제할까요?`,`清除所有赊账？`,`すべてのツケを消去しますか？`],
clearDebtP:[`Buburahin ang lahat ng utang at bayad ng lahat ng customer. Hindi ito mababawi. Mananatili ang mga item at benta.`,`This deletes every customer's debts and payments and cannot be undone. Your items and sales stay.`,`모든 고객의 외상과 결제가 삭제되며 되돌릴 수 없어요. 상품과 판매는 유지돼요.`,`将删除所有顾客的赊账和还款记录，无法恢复。商品和销售记录会保留。`,`全顧客のツケと支払いが削除され、元に戻せません。商品と販売は残ります。`],
clearDebtYes:[`Oo, i-clear`,`Yes, clear`,`네, 삭제`,`是，清除`,`はい、消去`],
debtsCleared:[`Na-clear ang lahat ng utang`,`All debts cleared`,`모든 외상을 삭제했어요`,`已清除所有赊账`,`すべてのツケを消去しました`],
delDebtQ:[`Burahin ang galaw na ito?`,`Delete this entry?`,`이 내역을 삭제할까요?`,`删除这条记录？`,`この記録を削除しますか？`],
delDebtP:[`Mawawala ito sa listahan ng utang ng customer at magbabago ang natitirang balanse.`,`It will be removed from the customer's debt list and the balance will update.`,`고객의 외상 목록에서 삭제되고 잔액이 바뀌어요.`,`将从顾客的赊账列表中移除，余额会更新。`,`顧客のツケ一覧から削除され、残高が更新されます。`],
delDebtYes:[`Oo, burahin`,`Yes, delete`,`네, 삭제`,`是，删除`,`はい、削除`],
debtDeleted:[`Nabura ang galaw`,`Entry deleted`,`내역을 삭제했어요`,`记录已删除`,`記録を削除しました`],
payChange:[`Sukli`,`Change`,`거스름돈`,`找零`,`お釣り`],
payRecv:[`Natanggap`,`Received`,`받은 금액`,`收到`,`受取額`],
payApplied:[`Napunta sa utang`,`Applied to debt`,`외상에 적용`,`抵扣欠款`,`ツケに充当`],
stillOwe:[`Matitira pang utang`,`Still owed`,`남는 외상`,`仍欠`,`残りのツケ`]
});
Object.assign(ACTIONS,{
  'clear-debt-ask':()=>{if(S.role==='cashier')return;confirmBox(esc(t('clearDebtQ')),esc(t('clearDebtP')),'clear-debt-yes',esc(t('clearDebtYes')))},
  'clear-debt-yes':()=>{if(S.role==='cashier')return;S.debts=[];save();if(typeof checkDue==='function')checkDue();closeModal();renderNav();renderView();toast(t('debtsCleared'))},
  'debt-del':b=>{if(S.role==='cashier')return;
    openModal('<div class="sheet-h"><h2>'+esc(t('delDebtQ'))+'</h2></div><p class="hint" style="margin:0 0 4px">'+esc(t('delDebtP'))+'</p><div class="sheet-f"><button class="btn btn-ghost" data-act="close-modal">'+esc(t('dont'))+'</button><button class="btn btn-danger" style="flex:1" data-act="debt-del-yes" data-id="'+esc(b.dataset.id)+'">'+esc(t('delDebtYes'))+'</button></div>')},
  'debt-del-yes':b=>{
    const d=S.debts.find(x=>x.id===b.dataset.id);if(!d||S.role==='cashier'){closeModal();return}
    const key=dKey(d.name);S.debts=S.debts.filter(x=>x.id!==d.id);save();if(typeof checkDue==='function')checkDue();
    toast(t('debtDeleted'));renderNav();if(S.tab==='utang')renderUtang();
    if(S.debts.some(x=>dKey(x.name)===key))openCustomer(key);else closeModal();
  }
});

/* ################################################################
   DATING V1.0.4  (isinama na sa v1.0.0)
   ################################################################ */
/* ============================================================
   ITO PARA SA MGA BAGO SA V35   [versions/v1.0.4.js]
   Bayad sa utang: LAHAT (kahit magkano), PER RESIBO, o PER ITEM.
   May sukli kapag sobra ang ibinigay.
   ============================================================ */
Object.assign(D,{
payModeAll:[`Lahat`,`Any amount`,`전체`,`全部`,`まとめて`],
payModeBill:[`Per resibo`,`Per bill`,`영수증별`,`按单据`,`伝票ごと`],
payModeItem:[`Per item`,`Per item`,`상품별`,`按商品`,`商品ごと`],
payPickBill:[`Piliin ang resibong babayaran`,`Pick the bills to pay`,`결제할 영수증을 고르세요`,`选择要还的单据`,`支払う伝票を選択`],
payPickItem:[`Piliin ang mga item na babayaran`,`Pick the items to pay`,`결제할 상품을 고르세요`,`选择要还的商品`,`支払う商品を選択`],
payPickAll:[`Piliin lahat`,`Select all`,`모두 선택`,`全选`,`すべて選択`],
paySumLbl:[`Babayaran`,`To pay`,`결제할 금액`,`应还`,`支払額`],
payRcvLbl:[`Natanggap na pera (optional)`,`Cash received (optional)`,`받은 돈 (선택)`,`收到的钱（可选）`,`受け取った金額（任意）`],
payExact:[`Eksakto`,`Exact`,`정확히`,`刚好`,`ちょうど`],
payShort:[`Kulang pa`,`Still short`,`부족`,`还差`,`不足`],
payPaidFor:[`Binayaran`,`Paid for`,`결제 항목`,`已付项目`,`支払い項目`],
payLeftOf:[`natitira sa {0}`,`left of {0}`,`{0} 중 남음`,`{0} 中剩余`,`{0} のうち残り`],
payDone:[`{0} resibo ang nabayaran`,`{0} bill(s) paid`,`{0}건 결제 완료`,`已还 {0} 笔`,`{0}件を支払い済み`]
});
Object.assign(ACTIONS,{
  'dp-mode':b=>{PAYUI.mode=b.dataset.m;PAYUI.sel=new Set();payRedraw()},
  'dp-sel':b=>{const k=b.dataset.key;if(PAYUI.sel.has(k)){PAYUI.sel.delete(k);b.setAttribute('aria-pressed','false')}else{PAYUI.sel.add(k);b.setAttribute('aria-pressed','true')}payUpd()},
  'dp-selall':()=>{const all=[...document.querySelectorAll('#dp-box .dp-pick')].map(x=>x.dataset.key),full=all.length&&all.every(k=>PAYUI.sel.has(k));PAYUI.sel=new Set(full?[]:all);document.querySelectorAll('#dp-box .dp-pick').forEach(x=>x.setAttribute('aria-pressed',String(PAYUI.sel.has(x.dataset.key))));payUpd()},
  'dp-fill':b=>{const a=document.getElementById(PAYUI.mode==='all'?'dp-amt':'dp-rcv');if(a){a.value=b.dataset.v;payUpd()}},
  // pagbura: kasama ang mga bayad na para sa utang na iyon at ang buong grupo ng bayad
  'debt-del-yes':b=>{
    const d=S.debts.find(x=>x.id===b.dataset.id);if(!d||S.role==='cashier'){closeModal();return}
    const key=dKey(d.name);
    S.debts=S.debts.filter(x=>x.id!==d.id&&x.for!==d.id&&!(d.grp&&x.grp===d.grp));
    save();if(typeof checkDue==='function')checkDue();
    toast(t('debtDeleted'));renderNav();if(S.tab==='utang')renderUtang();
    if(S.debts.some(x=>dKey(x.name)===key))openCustomer(key);else closeModal();
  }
});
document.addEventListener('input',e=>{if(e.target&&(e.target.id==='dp-amt'||e.target.id==='dp-rcv'))payUpd()});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target&&(e.target.id==='dp-amt'||e.target.id==='dp-rcv')){e.preventDefault();const ok=document.getElementById('dp-ok');if(ok&&!ok.disabled)payDebt(PAYUI.key)}});

/* ################################################################
   DATING V1.0.5  (isinama na sa v1.0.0)
   ################################################################ */
/* ============================================================
   ITO PARA SA MGA BAGO SA V36   [versions/v1.0.5.js]
   - Fully paid na ang customer: nawawala na ang dati niyang utang sa listahan niya
     (naka-archive, mababasa pa sa "Tingnan ang bayad nang history")
   - Edad ng utang sa listahan ng may utang (hal. "5 araw na")
   ============================================================ */
Object.assign(D,{
archBtn:[`Bayad nang history ({0})`,`Settled history ({0})`,`완납된 내역 ({0})`,`已结清记录（{0}）`,`完済の履歴（{0}）`],
noOpenLed:[`Walang bukas na utang. Fully paid na!`,`No open debts. Fully paid!`,`남은 외상이 없어요. 완납!`,`没有未还欠款，已付清！`,`未払いはありません。完済！`],
ageToday:[`ngayon lang inutang`,`borrowed today`,`오늘 외상`,`今天赊的`,`今日のツケ`],
ageDays:[`{0} araw nang may utang`,`owing {0} days`,`외상 {0}일째`,`欠款 {0} 天`,`{0}日間未払い`]
});
Object.assign(ACTIONS,{
  'arch-toggle':b=>{S.archClosed=S.archClosed===b.dataset.k?'':b.dataset.k;openCustomer(b.dataset.k)}
});

/* ################################################################
   DATING V1.0.6  (isinama na sa v1.0.0)
   ################################################################ */
/* ============================================================
   ITO PARA SA MGA BAGO SA V38   [versions/v1.0.6.js]
   Abiso kahit SARADO ang app:
   - 8:00 AM araw-araw: paalala sa lahat ng may utang (kahit walang takdang araw)
   - 8:00 PM araw-araw: paalala para sa ulat ng araw
   - "Subukan kahit sarado" na button, at gabay sa pag-ayos ng Android (alarm/battery)
   ============================================================ */
Object.assign(D,{
nDailyT:[`Oras nang maningil`,`Time to collect`,`수금할 시간`,`该收款了`,`集金の時間です`],
nDailyB:[`May {0} customer na may utang pa. Kabuuan: {1}`,`{0} customer(s) still owe you. Total: {1}`,`외상 고객 {0}명. 합계: {1}`,`还有 {0} 位顾客欠款，共 {1}`,`未払いのお客様 {0} 名、合計 {1}`],
nEodT:[`Ulat ng araw`,`End-of-day report`,`오늘의 보고서`,`今日报告`,`本日のレポート`],
nEodB:[`Buksan ang TindaMo para makita ang benta ngayon.`,`Open TindaMo to see today's sales.`,`TindaMo를 열어 오늘 매출을 확인하세요.`,`打开 TindaMo 查看今日销售。`,`TindaMoを開いて今日の売上を確認しましょう。`],
dailyOnLbl:[`Araw-araw na paalala (8 AM singil, 8 PM ulat)`,`Daily reminders (8 AM collect, 8 PM report)`,`매일 알림 (오전 8시 수금, 오후 8시 보고)`,`每日提醒（8点收款，20点报告）`,`毎日の通知（8時 集金、20時 レポート）`],
dailyHint:[`Lalabas kahit sarado ang app.`,`Shows even when the app is closed.`,`앱이 닫혀 있어도 표시돼요.`,`即使应用已关闭也会显示。`,`アプリを閉じていても表示されます。`],
remTestClosed:[`Subukan kahit sarado`,`Test while closed`,`종료 상태에서 테스트`,`关闭状态测试`,`終了中にテスト`],
remTestClosedP:[`Isara na ang app (i-swipe palayo). May abiso sa loob ng 1 minuto.`,`Close the app now (swipe it away). A notification comes in 1 minute.`,`지금 앱을 닫으세요(밀어서 종료). 1분 후 알림이 와요.`,`现在请关闭应用（划掉）。1分钟后会收到通知。`,`今すぐアプリを閉じてください（スワイプ）。1分後に通知が届きます。`],
remTestClosedN:[`Sa Android app lang ito gumagana`,`This works only in the Android app`,`Android 앱에서만 작동해요`,`仅在 Android 应用中可用`,`Androidアプリでのみ動作します`],
closedT:[`Kapag sarado ang app`,`When the app is closed`,`앱이 닫혀 있을 때`,`应用关闭时`,`アプリを閉じているとき`],
exactFix:[`Payagan ang eksaktong oras ng alarm`,`Allow exact alarm timing`,`정확한 알람 허용`,`允许精确闹钟`,`正確なアラームを許可`],
closedTip:[`Kung hindi lumalabas ang abiso: sa Phone Settings > Apps > TindaMo, i-on ang Notifications at Auto-start, at ilagay ang Battery sa "Walang restriction". Huwag i-force stop ang app.`,`If alerts don't show: in Phone Settings > Apps > TindaMo, turn on Notifications and Auto-start, and set Battery to "No restrictions". Don't force-stop the app.`,`알림이 안 보이면: 설정 > 앱 > TindaMo에서 알림과 자동 시작을 켜고 배터리를 '제한 없음'으로 설정하세요. 강제 종료하지 마세요.`,`若收不到提醒：在 设置 > 应用 > TindaMo 中开启通知和自启动，并将电池设为“无限制”。请勿强行停止应用。`,`通知が来ない場合：設定 > アプリ > TindaMo で通知と自動起動をオンにし、バッテリーを「制限なし」にしてください。強制終了しないでください。`]
});
Object.assign(ACTIONS,{
  'daily-toggle':()=>{prefs.daily=prefs.daily===false;savePrefs();snapDue();openSettings()},
  'exact-fix':async()=>{if(NATIVE.on)await NATIVE.askExact();snapDue();openSettings()},
  'notif-test-closed':async()=>{
    if(!NATIVE.on){toast(t('remTestClosedN'),{kind:'warn',ms:3500});return}
    if(!notifOn()){toast(notifHint(),{kind:'warn',ms:3800});return}
    const ok=await NATIVE.testLater(60,t('nSoonT'),t('nSoonB',t('remTestName'),fmt(150),t('dueTomorrow')));
    toast(ok?t('remTestClosedP'):t('errGeneric','notif'),{kind:ok?undefined:'err',ms:6000});
  }
});

/* ################################################################
   DATING V1.1.0  (isinama na sa v1.0.0)
   ################################################################ */
/* ============================================================
   ITO PARA SA MGA BAGO SA V1.1   [versions/v1.1.0.js]
   - Maraming barcode sa isang item (dagdag na barcode kapag may laman na ang dati)
   - Pagkatapos kumuha ng photo: Sticker ON / OFF (OFF = larawan lang)
   - Notification: i-swipe pataas para alisin (nasa ui.js)
   - Bago: "Kopyahin ang item" (para sa magkakaparehong produkto na iba ang lasa/laki)
   Mga salita ng V1.1 ay nandito (Filipino, English, 한국어, 中文, 日本語).
   ============================================================ */
Object.assign(D,{
addCode:[`Dagdag na barcode`,`Add another barcode`,`바코드 추가`,`添加另一个条码`,`バーコードを追加`],
moreCodePh:[`Isa pang barcode (i-type o i-scan)`,`Another barcode (type or scan)`,`다른 바코드 (입력 또는 스캔)`,`另一个条码（输入或扫描）`,`別のバーコード（入力またはスキャン）`],
codeSame:[`Nailagay mo na ang barcode na ito sa item na ito.`,`This barcode is already on this item.`,`이 바코드는 이미 이 상품에 있어요.`,`此条码已在该商品上。`,`このバーコードは既にこの商品にあります。`],
stkOnL:[`Sticker ON`,`Sticker ON`,`스티커 켬`,`贴纸 开`,`ステッカー ON`],
stkOnS:[`Aalisin ang background`,`Removes the background`,`배경 제거`,`去除背景`,`背景を消す`],
stkOffL:[`Sticker OFF`,`Sticker OFF`,`스티커 끔`,`贴纸 关`,`ステッカー OFF`],
stkOffS:[`Larawan lang`,`Photo only`,`사진만`,`仅照片`,`写真のみ`],
usePhoto:[`Gamitin ang larawan`,`Use photo`,`사진 사용`,`使用照片`,`写真を使う`],
photoDone:[`Na-save ang larawan`,`Photo saved`,`사진 저장됨`,`照片已保存`,`写真を保存しました`],
dupItem:[`Kopyahin ang item`,`Duplicate item`,`상품 복사`,`复制商品`,`商品をコピー`],
dupMade:[`Kopya ng item`,`Copy of item`,`상품 복사본`,`商品副本`,`商品のコピー`],
dupMadeSub:[`Palitan ang pangalan at presyo, tapos i-save. Walang barcode ang kopya.`,`Change the name and price, then save. The copy has no barcode.`,`이름과 가격을 바꾸고 저장하세요. 복사본에는 바코드가 없어요.`,`修改名称和价格后保存。副本没有条码。`,`名前と価格を変更して保存してください。コピーにはバーコードがありません。`]
});

/* ################################################################
   DATING V1.1.2  (isinama na sa v1.0.0)
   ################################################################ */
/* ============================================================
   ITO PARA SA MGA BAGO SA V1.1.2   [versions/v1.1.2.js]
   IN-APP UPDATE: pagpindot ng "I-update", dina-download ang bagong APK mismo sa loob ng app
   (may progress bar) at saka bubuksan ang installer ng Android. Isang "I-install" na lang ang pipindutin.
   Hindi pwedeng tahimik ang install sa Android (kailangan ang pag-confirm ng user), pero wala nang hanapan ng file.
   Kung luma ang app o wala sa Android (browser), babalik sa dating paraan: bubuksan ang download link.
   ============================================================ */
Object.assign(D,{
dlT:[`Dina-download ang update`,`Downloading update`,`업데이트 다운로드 중`,`正在下载更新`,`アップデートをダウンロード中`],
dlP:[`Huwag isara ang app habang nagda-download.`,`Please keep the app open while downloading.`,`다운로드하는 동안 앱을 닫지 마세요.`,`下载期间请勿关闭应用。`,`ダウンロード中はアプリを閉じないでください。`],
dlReadyT:[`Handa na ang update`,`Update is ready`,`업데이트 준비 완료`,`更新已就绪`,`アップデートの準備ができました`],
dlReadyP:[`Pindutin ang I-install sa lalabas na screen ng Android. Kung hindi lumabas, pindutin ang button sa baba.`,`Tap Install on the Android screen. If it doesn't show, tap the button below.`,`나타나는 Android 화면에서 설치를 누르세요. 안 나오면 아래 버튼을 누르세요.`,`请在 Android 弹出的界面点“安装”。如未出现，请点下方按钮。`,`Android の画面で「インストール」をタップしてください。表示されない場合は下のボタンを押してください。`],
dlInstall:[`I-install ngayon`,`Install now`,`지금 설치`,`立即安装`,`今すぐインストール`],
dlAllowT:[`Payagan ang pag-install`,`Allow installing`,`설치 허용`,`允许安装`,`インストールを許可`],
dlAllowP:[`Kailangan munang payagan ang TindaMo na mag-install ng update. Pindutin ang Buksan ang Settings, i-on ang "Allow from this source", tapos bumalik dito.`,`TindaMo needs permission to install updates. Tap Open settings, turn on "Allow from this source", then come back here.`,`TindaMo가 업데이트를 설치하도록 허용해야 해요. 설정을 열고 "이 출처 허용"을 켠 뒤 돌아오세요.`,`需要允许 TindaMo 安装更新。点“打开设置”，开启“允许来自此来源”，然后返回。`,`TindaMo に更新のインストールを許可する必要があります。設定を開き「このアプリを許可」をオンにして戻ってください。`],
dlOpenSet:[`Buksan ang Settings`,`Open settings`,`설정 열기`,`打开设置`,`設定を開く`],
dlFailT:[`Hindi nakapag-download`,`Download failed`,`다운로드 실패`,`下载失败`,`ダウンロードに失敗`],
dlFailP:[`Tingnan ang internet at subukan ulit.`,`Check your internet and try again.`,`인터넷을 확인하고 다시 시도하세요.`,`请检查网络后重试。`,`インターネットを確認して再試行してください。`],
dlRetry:[`Subukan ulit`,`Try again`,`다시 시도`,`重试`,`再試行`],
dlCancel:[`Kanselahin`,`Cancel`,`취소`,`取消`,`キャンセル`],
dlClose:[`Isara`,`Close`,`닫기`,`关闭`,`閉じる`],
dlBrowser:[`Buksan sa browser`,`Open in browser`,`브라우저로 열기`,`在浏览器中打开`,`ブラウザで開く`]
});

/* ---------- in-app download at install ---------- */
const DL={busy:false,state:'',h:null};
// Para saan: ang native plugin (wala kapag luma ang app o nasa browser)
const dlPlugin=()=>{try{const C=window.Capacitor;return(C&&C.isNativePlatform&&C.isNativePlatform())?C.registerPlugin('ApkInstaller'):null}catch(e){return null}};
// Para saan: iguhit ang kahon ng download. st: 'dl' | 'ready' | 'allow' | 'fail'
function dlDraw(st,pct){
  DL.state=st;
  let b=$('#verdl');
  if(!b){b=document.createElement('div');b.id='verdl';b.className='verbox verdl';b.setAttribute('role','alertdialog');document.body.appendChild(b)}
  const ver=APP_VER.latest?' v'+esc(APP_VER.latest):'';
  let ic=I.box,h='',p='',bar='',btn='';
  if(st==='dl'){
    h=t('dlT')+ver;p=t('dlP');
    bar='<div class="dl-bar"><i id="dl-i" style="width:'+(pct>=0?pct:8)+'%"'+(pct<0?' class="ind"':'')+'></i></div><div class="dl-pct" id="dl-p">'+(pct>=0?pct+'%':'…')+'</div>';
    btn='<button class="btn btn-ghost btn-block" data-act="dl-cancel">'+esc(t('dlCancel'))+'</button>';
  }else if(st==='ready'){
    ic=I.check;h=t('dlReadyT')+ver;p=t('dlReadyP');
    btn='<button class="btn btn-primary btn-block" data-act="dl-install">'+esc(t('dlInstall'))+'</button><button class="btn btn-ghost btn-block" data-act="dl-close">'+esc(t('dlClose'))+'</button>';
  }else if(st==='allow'){
    ic=I.lock;h=t('dlAllowT');p=t('dlAllowP');
    btn='<button class="btn btn-primary btn-block" data-act="dl-settings">'+esc(t('dlOpenSet'))+'</button><button class="btn btn-ghost btn-block" data-act="dl-install">'+esc(t('dlInstall'))+'</button><button class="btn btn-ghost btn-block" data-act="dl-close">'+esc(t('dlClose'))+'</button>';
  }else{
    ic=I.x;h=t('dlFailT');p=t('dlFailP');
    btn='<button class="btn btn-primary btn-block" data-act="dl-start">'+esc(t('dlRetry'))+'</button><button class="btn btn-ghost btn-block" data-act="dl-browser">'+esc(t('dlBrowser'))+'</button><button class="btn btn-ghost btn-block" data-act="dl-close">'+esc(t('dlClose'))+'</button>';
  }
  b.innerHTML='<div class="vb-card"><div class="vb-ic'+(st==='fail'||st==='allow'?' warn':'')+'">'+ic+'</div><h2>'+esc(h)+'</h2><p>'+esc(p)+'</p>'+bar+'<div class="vb-b col">'+btn+'</div></div>';
}
// Para saan: simulan ang download ng update
async function dlStart(){
  const P=dlPlugin();if(!P){verOpenBrowser();return}
  if(DL.busy)return;
  if(!navigator.onLine){toast(t('errNet'),{kind:'err'});return}
  DL.busy=true;dlDraw('dl',0);
  try{
    if(DL.h&&DL.h.remove)DL.h.remove();
    DL.h=await P.addListener('progress',e=>{
      const pct=e&&e.pct>=0?e.pct:-1,i=$('#dl-i'),p=$('#dl-p');
      if(i){i.style.width=(pct>=0?pct:8)+'%'}if(p)p.textContent=pct>=0?pct+'%':'…';
    });
    await P.download({url:APP_VER.apk});
    DL.busy=false;
    dlInstall();
  }catch(e){
    DL.busy=false;
    if(e&&e.code==='CANCELLED'){dlClose();return}
    // walang plugin (lumang APK): ibalik sa dating paraan
    if(e&&/not implemented|not available|UNIMPLEMENTED/i.test(String(e.message||e.code||''))){dlClose();verOpenBrowser();return}
    dlDraw('fail');
  }
}
// Para saan: buksan ang installer ng Android (kung walang permiso: ipaliwanag muna)
async function dlInstall(){
  const P=dlPlugin();if(!P)return;
  try{await P.install();dlDraw('ready')}
  catch(e){
    if(e&&e.code==='NEEDS_PERMISSION')dlDraw('allow');
    else if(e&&e.code==='NOFILE')dlStart();
    else dlDraw('fail');
  }
}
function dlClose(){const b=$('#verdl');if(b)b.remove();DL.state='';if(DL.h&&DL.h.remove){try{DL.h.remove()}catch(e){}DL.h=null}}
// Para saan: pagbalik mula sa Settings (permiso), subukan ulit ang install
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&DL.state==='allow')dlInstall()});

Object.assign(ACTIONS,{
  'ver-update':()=>{const v=$('#verbox');if(v)v.remove();dlPlugin()?dlStart():verOpenBrowser()},   // V1.1.2: sa Android app, in-app download; sa iba, dating link
  'dl-start':()=>{dlStart()},
  'dl-install':()=>{dlInstall()},
  'dl-settings':()=>{const P=dlPlugin();if(P)P.openSettings().catch(()=>{})},
  'dl-cancel':()=>{const P=dlPlugin();if(P)P.cancel().catch(()=>{})},
  'dl-close':()=>{dlClose()},
  'dl-browser':()=>{dlClose();verOpenBrowser()}
});

/* ################################################################
   DATING V1.1.3  (isinama na sa v1.0.0)
   ################################################################ */
/* ============================================================
   ITO PARA SA MGA BAGO SA V1.1.3   [versions/v1.1.3.js]
   1) VIP:    Guest (hanggang 85 items) / VIP (walang limit) / Admin / Dev. Ang admin at owner (Dev) ay awtomatikong VIP.
              Ang admin/owner ang nagbibigay o nag-aalis ng VIP (Admin page o sa loob ng chat). Sa chat: "Gusto kong bumili ng VIP".
   2) GCASH:  Bayad sa Sell (Cash / GCash / Utang), QR ng may-ari para i-scan ng customer, resibo na may Ref. No.
              GCash page ng may-ari: setup (number + PIN), login, balance ng wallet, Cash In / Cash Out / Load, kasaysayan.
              PAALALA: hindi ito direktang konektado sa GCash mismo. Ang balance ay sinusubaybayan ng TindaMo (benta + cash in/out/load).
   ============================================================ */

Object.assign(D,{
/* ---------- VIP ---------- */
vipAcct:[`Antas ng account`,`Account level`,`계정 등급`,`账号等级`,`アカウントの種類`],
vipUnl:[`Walang limit ang pag-gawa ng item.`,`Unlimited items.`,`상품을 무제한으로 만들 수 있어요.`,`商品数量不受限制。`,`商品を無制限に作れます。`],
vipGuestN:[`Guest: {0} sa {1} na item ang nagawa mo.`,`Guest: you've made {0} of {1} items.`,`게스트: 상품 {0}/{1}개를 만들었어요.`,`访客：已创建 {0}/{1} 个商品。`,`ゲスト：{1}個中{0}個を作成済み。`],
vipBuyBtn:[`Gusto kong bumili ng VIP`,`I want to buy VIP`,`VIP를 구매하고 싶어요`,`我想购买 VIP`,`VIPを購入したい`],
vipLimitT:[`Abot ka na sa limit ng Guest`,`You've hit the Guest limit`,`게스트 한도에 도달했어요`,`已达到访客上限`,`ゲストの上限に達しました`],
vipLimitP:[`Hanggang {0} items lang ang Guest. Kumuha ng VIP para walang limit sa pag-gawa ng item.`,`Guests can have up to {0} items. Get VIP to create unlimited items.`,`게스트는 상품을 최대 {0}개까지 만들 수 있어요. VIP로 무제한 이용하세요.`,`访客最多可创建 {0} 个商品。升级 VIP 即可无限创建。`,`ゲストは最大{0}個までです。VIPなら無制限に作れます。`],
vipLeft:[`{0} item na lang ang natitira sa Guest.`,`Only {0} item slots left on Guest.`,`게스트 남은 상품 칸: {0}개`,`访客仅剩 {0} 个商品名额。`,`ゲストの残り枠は{0}個です。`],
vipGot:[`Binigyan ka na ng VIP! 🎉`,`You've been given VIP! 🎉`,`VIP가 적용됐어요! 🎉`,`你已获得 VIP！🎉`,`VIPが付与されました！🎉`],
vipLost:[`Inalis na ang VIP mo.`,`Your VIP was removed.`,`VIP가 해제됐어요.`,`你的 VIP 已被移除。`,`VIPが解除されました。`],
vipGive:[`Bigyan ng VIP`,`Give VIP`,`VIP 부여`,`授予 VIP`,`VIPを付与`],
vipRemove:[`Alisin ang VIP`,`Remove VIP`,`VIP 해제`,`移除 VIP`,`VIPを解除`],
vipGivenN:[`Binigyan ng VIP si {0}.`,`{0} now has VIP.`,`{0}님에게 VIP를 부여했어요.`,`已授予 {0} VIP。`,`{0}にVIPを付与しました。`],
vipRemovedN:[`Inalis ang VIP ni {0}.`,`Removed VIP from {0}.`,`{0}님의 VIP를 해제했어요.`,`已移除 {0} 的 VIP。`,`{0}のVIPを解除しました。`],
mTopicVip:[`Gusto kong bumili ng VIP`,`I want to buy VIP`,`VIP를 구매하고 싶어요`,`我想购买 VIP`,`VIPを購入したい`],
vipMenuT:[`Ano ang gusto mong gawin?`,`What would you like to do?`,`무엇을 도와드릴까요?`,`您想做什么？`,`何をしますか？`],
vipWhatBtn:[`Ano ang VIP?`,`What is VIP?`,`VIP가 뭐예요?`,`什么是 VIP？`,`VIPとは？`],
vipBuyNow:[`Bibilhin ko na`,`Buy now`,`지금 구매`,`立即购买`,`今すぐ購入`],
vipBuyMsg:[`Gusto kong bumili ng VIP. Bibilhin ko na po.`,`I want to buy VIP. I'd like to buy it now.`,`VIP를 구매하고 싶어요. 지금 구매할게요.`,`我想购买 VIP，现在就买。`,`VIPを購入したいです。今すぐ購入します。`],
botVipWhat:[`Ang VIP ay para sa gustong walang limit sa pag-gawa ng item. Ang Guest ay hanggang {0} items lang; ang VIP ay kahit ilan. Kung gusto mo na, pindutin ang "Bibilhin ko na".`,`VIP is for people who want unlimited items. Guests can only create up to {0} items; VIP has no limit. If you're ready, tap "Buy now".`,`VIP는 상품을 무제한으로 만들고 싶은 분을 위한 등급이에요. 게스트는 최대 {0}개까지만, VIP는 제한이 없어요. 준비되면 "지금 구매"를 눌러 주세요.`,`VIP 适合想要无限创建商品的用户。访客最多 {0} 个商品，VIP 没有限制。准备好后请点“立即购买”。`,`VIPは商品を無制限に作りたい方向けです。ゲストは最大{0}個まで、VIPは無制限。ご希望なら「今すぐ購入」を押してください。`],
botVipBuy:[`Salamat! Naipadala na sa Admin/Owner ang hiling mo na bumili ng VIP. Hintayin mo lang silang sumagot dito sa chat. 🙏`,`Thank you! Your VIP request was sent to the Admin/Owner. Please wait for them to reply here in the chat. 🙏`,`감사합니다! VIP 구매 요청을 관리자/오너에게 보냈어요. 이 채팅에서 답장을 기다려 주세요. 🙏`,`谢谢！您的 VIP 购买请求已发送给管理员/店主，请在此聊天中等待回复。🙏`,`ありがとうございます！VIP購入のリクエストを管理者/オーナーに送りました。このチャットで返信をお待ちください。🙏`],
/* ---------- GCash: setup at login ---------- */
gcSetupT:[`I-setup ang GCash`,`Set up GCash`,`GCash 설정`,`设置 GCash`,`GCashを設定`],
gcIntro:[`I-save ang GCash number mo at gumawa ng PIN. Pagkatapos, makikita mo rito ang balance ng wallet, makakapag Cash In / Cash Out / Load, at makakabayad ang customer sa pag-scan ng QR mo.`,`Save your GCash number and create a PIN. Then you can see your wallet balance here, do Cash In / Cash Out / Load, and let customers pay by scanning your QR.`,`GCash 번호를 저장하고 PIN을 만드세요. 그러면 지갑 잔액 확인, 캐시인/캐시아웃/충전, QR 결제를 쓸 수 있어요.`,`保存你的 GCash 号码并创建 PIN。之后可在此查看钱包余额，办理充值/提现/话费，并让顾客扫码付款。`,`GCash番号を保存してPINを作成します。ウォレット残高の確認、入金/出金/ロード、QR決済が使えます。`],
gcName:[`Pangalan sa GCash`,`Name on GCash`,`GCash 이름`,`GCash 姓名`,`GCashの名前`],
gcNum:[`GCash number`,`GCash number`,`GCash 번호`,`GCash 号码`,`GCash番号`],
gcQrT:[`QR code mo (i-scan ng customer)`,`Your QR code (customers scan it)`,`내 QR 코드 (손님이 스캔)`,`你的二维码（顾客扫描）`,`あなたのQR（お客さんがスキャン）`],
gcQrScan:[`I-scan ang QR ko`,`Scan my QR`,`내 QR 스캔`,`扫描我的二维码`,`QRをスキャン`],
gcQrGal:[`Gallery`,`Gallery`,`갤러리`,`相册`,`ギャラリー`],
gcQrNone:[`Wala pang QR. Pwede mo itong laktawan at ibigay na lang ang number.`,`No QR yet. You can skip this and just give your number.`,`아직 QR이 없어요. 건너뛰고 번호만 알려줘도 돼요.`,`还没有二维码。可以跳过，直接告知号码。`,`QRはまだありません。スキップして番号を伝えることもできます。`],
gcQrHow:[`Sa GCash app, buksan ang iyong QR (Receive Money), tapos i-scan dito o i-screenshot at piliin sa Gallery.`,`In the GCash app, open your QR (Receive Money), then scan it here or take a screenshot and pick it from Gallery.`,`GCash 앱에서 내 QR(Receive Money)을 열고 여기서 스캔하거나 스크린샷을 갤러리에서 고르세요.`,`在 GCash 应用中打开你的二维码（Receive Money），在此扫描，或截图后从相册选择。`,`GCashアプリで自分のQR（Receive Money）を開き、ここでスキャンするかスクリーンショットをギャラリーから選んでください。`],
gcQrSaved:[`Na-save ang QR.`,`QR saved.`,`QR을 저장했어요.`,`二维码已保存。`,`QRを保存しました。`],
gcQrBad:[`Hindi mabasa ang QR na ito.`,`Can't read this QR.`,`이 QR을 읽을 수 없어요.`,`无法读取此二维码。`,`このQRを読み取れません。`],
gcQrScanT:[`I-scan ang GCash QR mo`,`Scan your GCash QR`,`내 GCash QR 스캔`,`扫描你的 GCash 二维码`,`GCash QRをスキャン`],
gcPin:[`PIN (4 na numero)`,`PIN (4 digits)`,`PIN (4자리)`,`PIN（4 位数字）`,`PIN（4桁）`],
gcPin2:[`Ulitin ang PIN`,`Repeat PIN`,`PIN 확인`,`重复 PIN`,`PINをもう一度`],
gcBase:[`Balance ngayon sa GCash (₱)`,`Current GCash balance (₱)`,`현재 GCash 잔액 (₱)`,`当前 GCash 余额（₱）`,`現在のGCash残高（₱）`],
gcSave:[`I-save at i-verify`,`Save and verify`,`저장하고 확인`,`保存并验证`,`保存して確認`],
gcVerified:[`Na-verify`,`Verified`,`확인됨`,`已验证`,`確認済み`],
gcVerHint:[`Na-verify sa app ang number at PIN mo. Hindi ito direktang konektado sa GCash: ang balance ay sinusubaybayan ng TindaMo base sa mga benta at Cash In / Out / Load mo. Pwede mong ayusin ang balance anumang oras.`,`Your number and PIN are verified inside the app. It is not directly connected to GCash: TindaMo tracks the balance from your sales and Cash In / Out / Load. You can adjust the balance anytime.`,`번호와 PIN은 앱 안에서 확인돼요. GCash와 직접 연결된 것은 아니며, TindaMo가 매출과 캐시인/아웃/충전으로 잔액을 계산해요. 잔액은 언제든 조정할 수 있어요.`,`号码和 PIN 在应用内验证。并未直接连接 GCash：TindaMo 根据销售和充值/提现/话费记录计算余额，你可以随时调整余额。`,`番号とPINはアプリ内で確認されます。GCashとは直接つながっておらず、TindaMoが売上と入金/出金/ロードから残高を計算します。残高はいつでも調整できます。`],
gcReady:[`Handa na ang GCash mo!`,`Your GCash is ready!`,`GCash 준비 완료!`,`GCash 已就绪！`,`GCashの準備ができました！`],
gcLogin:[`Mag-login`,`Log in`,`로그인`,`登录`,`ログイン`],
gcPinWrong:[`Maling PIN. {0} na subok na lang.`,`Wrong PIN. {0} tries left.`,`PIN이 틀렸어요. {0}번 남았어요.`,`PIN 错误，还剩 {0} 次。`,`PINが違います。残り{0}回。`],
gcLocked:[`Naka-lock muna. Subukan ulit pagkatapos ng 1 minuto.`,`Locked for now. Try again in 1 minute.`,`잠겼어요. 1분 후에 다시 시도하세요.`,`已暂时锁定，请 1 分钟后重试。`,`ロック中です。1分後に再試行してください。`],
gcForgot:[`Nakalimutan ang PIN`,`Forgot PIN`,`PIN을 잊었어요`,`忘记 PIN`,`PINを忘れた`],
gcForgotP:[`I-type ang GCash number mo at bagong PIN.`,`Enter your GCash number and a new PIN.`,`GCash 번호와 새 PIN을 입력하세요.`,`请输入你的 GCash 号码和新 PIN。`,`GCash番号と新しいPINを入力してください。`],
gcPinNew:[`Bagong PIN`,`New PIN`,`새 PIN`,`新 PIN`,`新しいPIN`],
gcPinReset:[`Napalitan ang PIN.`,`PIN changed.`,`PIN을 바꿨어요.`,`PIN 已更改。`,`PINを変更しました。`],
gcNumMismatch:[`Hindi tugma sa naka-save na number.`,`Doesn't match the saved number.`,`저장된 번호와 달라요.`,`与已保存的号码不符。`,`保存した番号と一致しません。`],
gcErrName:[`Ilagay ang pangalan sa GCash.`,`Enter the name on GCash.`,`GCash 이름을 입력하세요.`,`请输入 GCash 姓名。`,`GCashの名前を入力してください。`],
gcErrNum:[`Mali ang number. Dapat 09XXXXXXXXX.`,`Invalid number. It should be 09XXXXXXXXX.`,`번호가 올바르지 않아요. 09XXXXXXXXX 형식이어야 해요.`,`号码无效，应为 09XXXXXXXXX。`,`番号が正しくありません。09XXXXXXXXXの形式です。`],
gcErrPin:[`Dapat 4 na numero ang PIN.`,`The PIN must be 4 digits.`,`PIN은 4자리 숫자여야 해요.`,`PIN 必须是 4 位数字。`,`PINは4桁の数字です。`],
gcErrPin2:[`Hindi magkapareho ang dalawang PIN.`,`The two PINs don't match.`,`두 PIN이 달라요.`,`两次 PIN 不一致。`,`2つのPINが一致しません。`],
/* ---------- GCash: wallet ---------- */
gcBal:[`Balance sa GCash`,`GCash balance`,`GCash 잔액`,`GCash 余额`,`GCash残高`],
gcSalesToday:[`GCash benta ngayon`,`GCash sales today`,`오늘 GCash 매출`,`今日 GCash 销售`,`本日のGCash売上`],
gcFeeToday:[`Kita sa fee ngayon`,`Fees earned today`,`오늘 수수료 수익`,`今日手续费收入`,`本日の手数料収入`],
gcIn:[`Cash In`,`Cash In`,`캐시인`,`充值`,`入金`],
gcOut:[`Cash Out`,`Cash Out`,`캐시아웃`,`提现`,`出金`],
gcLoad:[`Load`,`Load`,`충전`,`话费`,`ロード`],
gcAmt:[`Halaga (₱)`,`Amount (₱)`,`금액 (₱)`,`金额（₱）`,`金額（₱）`],
gcFee:[`Fee`,`Fee`,`수수료`,`手续费`,`手数料`],
gcFeeNone:[`Walang fee`,`No fee`,`수수료 없음`,`无手续费`,`手数料なし`],
gcCust:[`Number ng customer (optional)`,`Customer number (optional)`,`손님 번호 (선택)`,`顾客号码（可选）`,`お客さんの番号（任意）`],
gcRefOpt:[`Reference No. (optional)`,`Reference No. (optional)`,`참조 번호 (선택)`,`参考编号（可选）`,`参照番号（任意）`],
gcCollect:[`Kunin na cash sa customer`,`Cash to collect`,`손님에게 받을 현금`,`向顾客收取现金`,`お客さんから受け取る現金`],
gcGive:[`Ibigay na cash sa customer`,`Cash to hand over`,`손님에게 줄 현금`,`付给顾客现金`,`お客さんに渡す現金`],
gcAfter:[`Balance pagkatapos`,`Balance after`,`처리 후 잔액`,`之后的余额`,`処理後の残高`],
gcShort:[`Kulang ang balance sa GCash wallet mo. Ayusin muna ang balance kung mali ito.`,`Your GCash wallet balance is too low. Adjust the balance first if it's wrong.`,`GCash 지갑 잔액이 부족해요. 잔액이 틀렸다면 먼저 조정하세요.`,`GCash 钱包余额不足。如有误请先调整余额。`,`GCashウォレットの残高が足りません。違う場合は先に残高を調整してください。`],
gcFinish:[`Tapusin`,`Finish`,`완료`,`完成`,`完了`],
gcDone:[`Tapos na: {0}`,`Done: {0}`,`완료: {0}`,`已完成：{0}`,`完了：{0}`],
gcDetails:[`Detalye`,`Details`,`상세`,`详情`,`詳細`],
gcCustS:[`Number ng customer`,`Customer no.`,`손님 번호`,`顾客号码`,`お客さんの番号`],
gcAcct:[`GCash ng tindahan`,`Store GCash`,`가게 GCash`,`店铺 GCash`,`お店のGCash`],
gcAdj:[`Ayusin ang balance`,`Adjust balance`,`잔액 조정`,`调整余额`,`残高を調整`],
gcAdjP:[`I-type ang eksaktong balance na nakikita mo sa GCash app.`,`Type the exact balance you see in the GCash app.`,`GCash 앱에서 보이는 정확한 잔액을 입력하세요.`,`请输入你在 GCash 应用中看到的准确余额。`,`GCashアプリに表示されている正確な残高を入力してください。`],
gcAdjOk:[`Naayos ang balance.`,`Balance adjusted.`,`잔액을 조정했어요.`,`余额已调整。`,`残高を調整しました。`],
gcHist:[`Kasaysayan ng Cash In / Out / Load`,`Cash In / Out / Load history`,`캐시인/아웃/충전 내역`,`充值/提现/话费记录`,`入金/出金/ロード履歴`],
gcNoHist:[`Wala pang Cash In / Out / Load.`,`No Cash In / Out / Load yet.`,`아직 내역이 없어요.`,`暂无记录。`,`まだ履歴がありません。`],
gcDelQ:[`Burahin ang galaw na ito?`,`Delete this entry?`,`이 내역을 삭제할까요?`,`删除这条记录？`,`この履歴を削除しますか？`],
gcDelP:[`Babalik ang balance na parang hindi ito nangyari.`,`The balance goes back as if it never happened.`,`잔액이 없던 일처럼 되돌아가요.`,`余额将恢复，如同没发生过。`,`残高は元に戻ります。`],
gcLock:[`I-lock`,`Lock`,`잠금`,`锁定`,`ロック`],
gcAccept:[`Tumanggap ng GCash sa Sell`,`Accept GCash in Sell`,`판매에서 GCash 받기`,`在销售中接受 GCash`,`販売でGCashを受け付ける`],
gcRemove:[`Tanggalin ang GCash`,`Remove GCash`,`GCash 삭제`,`移除 GCash`,`GCashを削除`],
gcRemoveP:[`Buburahin ang GCash setup, PIN at kasaysayan ng Cash In / Out / Load. Mananatili ang mga resibo ng benta.`,`This deletes the GCash setup, PIN and Cash In / Out / Load history. Sales receipts stay.`,`GCash 설정, PIN, 캐시인/아웃/충전 내역이 삭제돼요. 판매 영수증은 남아요.`,`将删除 GCash 设置、PIN 和充值/提现/话费记录。销售小票会保留。`,`GCash設定、PIN、入金/出金/ロード履歴が削除されます。販売レシートは残ります。`],
gcRemoved:[`Natanggal ang GCash.`,`GCash removed.`,`GCash를 삭제했어요.`,`GCash 已移除。`,`GCashを削除しました。`],
gcYesRemove:[`Oo, tanggalin`,`Yes, remove`,`네, 삭제`,`是，移除`,`はい、削除`],
/* ---------- GCash: bayad sa Sell at resibo ---------- */
gcNoSetup:[`Hindi pa naka-setup ang GCash.`,`GCash isn't set up yet.`,`GCash가 아직 설정되지 않았어요.`,`尚未设置 GCash。`,`GCashはまだ設定されていません。`],
gcSetupGo:[`I-setup ngayon`,`Set up now`,`지금 설정`,`立即设置`,`今すぐ設定`],
gcNoQr:[`Walang QR. Ibigay ang number sa customer.`,`No QR. Give the customer your number.`,`QR이 없어요. 손님에게 번호를 알려주세요.`,`没有二维码，请把号码告诉顾客。`,`QRがありません。お客さんに番号を伝えてください。`],
gcSendTo:[`Ipadala sa`,`Send to`,`받는 사람`,`收款人`,`送金先`],
gcBigHint:[`Pindutin ang QR para palakihin.`,`Tap the QR to enlarge it.`,`QR을 누르면 커져요.`,`点按二维码可放大。`,`QRをタップすると拡大します。`],
gcRefLbl:[`Reference No. (nasa resibo ng customer)`,`Reference No. (on the customer's receipt)`,`참조 번호 (손님 영수증)`,`参考编号（顾客的回执上）`,`参照番号（お客さんのレシート）`],
gcRefPh:[`13 digits sa GCash receipt`,`13 digits on the GCash receipt`,`GCash 영수증의 13자리`,`GCash 回执上的 13 位数字`,`GCashレシートの13桁`],
gcSaleDone:[`Bayad sa GCash: {0}`,`Paid by GCash: {0}`,`GCash 결제: {0}`,`GCash 付款：{0}`,`GCash払い：{0}`],
gcRefN:[`Ref. No. {0}`,`Ref. No. {0}`,`참조 번호 {0}`,`参考编号 {0}`,`参照番号 {0}`],
gcMethod:[`Bayad`,`Paid by`,`결제 수단`,`付款方式`,`支払い方法`],
gcRefL:[`Ref. No.`,`Ref. No.`,`참조 번호`,`参考编号`,`参照番号`]
});

/* ============================================================
   1) VIP
   ============================================================ */
const VIP_MAX=85,K_VIP=u=>'tindamo:vip:'+u;
I.vip=ic('<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>');
const VP={u:null,on:false,t:0};
const vipId=e=>encodeURIComponent(canonEmail(e));
// Para saan: i-load ang naka-save na VIP ng kasalukuyang user (para gumana kahit offline)
function vipSync(){if(VP.u!==S.user){VP.u=S.user;VP.on=!!S.user&&store.get(K_VIP(S.user))==='1'}}
// Para saan: antas ng account: dev (owner) / admin / vip / guest (cashier = walang tatak)
function vipTier(){
  if(!S.user)return 'guest';
  if(S.role==='cashier')return 'cashier';
  if(ibIsOwner())return 'dev';
  if(ibIsAdmin())return 'admin';
  vipSync();return VP.on?'vip':'guest';
}
// Para saan: walang limit ba ang pag-gawa ng item? (VIP, Admin at Dev)
const vipUnlimited=()=>vipTier()!=='guest';
// Para saan: mga tatak: Dev = VIP + Dev, Admin = Admin lang, VIP = VIP, iba = Guest
function vipChips(tier){
  tier=tier||vipTier();
  const c=(k,x)=>'<span class="chip '+k+'">'+esc(x)+'</span>';
  if(tier==='dev')return c('vip','VIP')+c('dev','Dev');
  if(tier==='admin')return c('adm','Admin');
  if(tier==='vip')return c('vip','VIP');
  if(tier==='guest')return c('guest','Guest');
  return '';
}
// Para saan: tingnan sa cloud kung may VIP ako (404 = wala)
async function vipFetch(){
  if(!S.user||S.role==='cashier'||!ibCan())return;
  const u=S.user;
  try{await clDb('/vips/'+vipId(ibEmail()));vipApply(u,true)}
  catch(e){if(e&&(e.status===404||e.code==='NOT_FOUND'))vipApply(u,false)}
}
function vipApply(u,on){
  if(S.user!==u)return;vipSync();
  const was=VP.on;VP.on=on;store.set(K_VIP(u),on?'1':'0');
  if(was===on)return;
  if(on){toast(t('vipGot'),{ms:4000});sfx('success');try{confetti()}catch(e){}}
  else toast(t('vipLost'),{kind:'warn',ms:3500});
  if(S.page==='profile'&&$('#profile-vip'))openProfile();
  // V1.2.3: agad na mag-update ang iba pang bahagi (chat, Inventory) nang walang restart
  try{
    if(S.page==='message'&&$('#ib-body')&&!ibIsAdmin()&&typeof ibDraw==='function')ibDraw();
    else if(!$('#modal').classList.contains('open')&&S.tab==='inv')renderView();
  }catch(e){}
}
// Para saan: bilang ng item at harang sa Guest
function vipLimitHit(extra){if(S.role==='cashier'||vipUnlimited())return false;return S.items.length+(extra||1)>VIP_MAX}
function vipBlockNew(){if(!vipLimitHit())return false;vipUpsell();return true}
// Para saan: pop-up kapag abot na sa limit ng Guest
function vipUpsell(){
  openModal('<div class="sheet-h"><h2>'+esc(t('vipLimitT'))+'</h2><button class="icon-btn" data-act="close-modal" aria-label="'+esc(t('close'))+'">'+I.x+'</button></div>'+
  '<div class="vip-up"><div class="vip-ic">'+I.vip+'</div><p class="hint" style="margin:0">'+esc(t('vipLimitP',VIP_MAX))+'</p></div>'+
  '<div class="sheet-f"><button class="btn btn-ghost" data-act="close-modal">'+esc(t('verLater'))+'</button><button class="btn btn-primary" data-act="vip-open-buy">'+esc(t('vipBuyBtn'))+'</button></div>');
  sfx('error');
}
// Para saan: pagkatapos mag-save ng bagong item: paalala kapag malapit na sa limit
function vipAfterSave(){
  if(vipUnlimited()||S.role==='cashier')return;
  const left=VIP_MAX-S.items.length;
  if(left>=0&&left<=5)setTimeout(()=>toast(t('vipLeft',left),{kind:'warn',sub:t('vipBuyBtn'),ms:3000}),700);
}
// Para saan: kahon ng antas ng account sa Profile
function vipProfileHtml(){
  if(S.role==='cashier')return '';
  if(Date.now()-VP.t>15000){VP.t=Date.now();setTimeout(vipFetch,50)}
  const tier=vipTier();
  const body=tier==='guest'
    ?'<div class="vip-bar"><i style="width:'+Math.min(100,Math.round(S.items.length/VIP_MAX*100))+'%"></i></div><div class="hint">'+esc(t('vipGuestN',S.items.length,VIP_MAX))+'</div><button class="btn btn-primary btn-block" data-act="vip-open-buy">'+I.vip+' '+esc(t('vipBuyBtn'))+'</button>'
    :'<div class="hint">'+esc(t('vipUnl'))+'</div>';
  return '<div class="set-sec" id="profile-vip"><span class="lbl">'+esc(t('vipAcct'))+'</span><div class="vip-card">'+body+'</div></div>';
}

/* ---------- admin / owner: magbigay o mag-alis ng VIP ---------- */
AD.vips=null;
async function vipLoadAll(){
  if(!ibCan()||!ibIsAdmin())return;
  try{const l=await clDb('/vips?pageSize=300');AD.vips=new Set((l.documents||[]).map(d=>canonEmail(fv(d.fields||{},'email')||idOf(d))))}
  catch(e){if(!AD.vips)AD.vips=new Set()}
}
async function vipSet(email,on){
  if(!ibIsAdmin()||!ibCan()||!email)return false;
  const id=canonEmail(email);
  try{
    if(on)await clDb('/vips/'+encodeURIComponent(id),{method:'PATCH',headers:jh,body:JSON.stringify({fields:{email:fStr(id),ts:fInt(Date.now()),by:fStr(ibEmail())}})});
    else await clDb('/vips/'+encodeURIComponent(id),{method:'DELETE'});
    if(!AD.vips)AD.vips=new Set();
    if(on)AD.vips.add(id);else AD.vips.delete(id);
    toast(t(on?'vipGivenN':'vipRemovedN',email),{ms:2500});sfx('success');return true;
  }catch(e){toast(t('errCloud',e.message||e),{kind:'err',ms:3500});return false}
}
const vipBtnCss='min-height:34px;padding:0 10px;font-size:12.5px';
// Para saan: VIP chip at button sa listahan ng mga user (Admin page)
function vipRowBtn(email){
  if(!email||!ibIsAdmin())return '';
  const has=!!(AD.vips&&AD.vips.has(canonEmail(email)));
  return (has?'<span class="chip vip">VIP</span>':'')+'<button class="btn btn-ghost" style="'+vipBtnCss+'" data-act="'+(has?'vip-remove':'vip-give')+'" data-e="'+esc(email)+'">'+esc(t(has?'vipRemove':'vipGive'))+'</button>';
}
// Para saan: button sa loob ng chat ng admin (nasa taas ng usapan)
function vipChatWrap(email){
  if(!email||!ibIsAdmin()||canonEmail(email)===canonEmail(OWNER_EMAIL))return '';
  const has=!!(AD.vips&&AD.vips.has(canonEmail(email)));
  return '<span id="ib-vipw">'+(has?'<span class="chip vip" style="margin-right:6px">VIP</span>':'')+'<button class="btn btn-ghost" style="'+vipBtnCss+'" data-act="vip-chat" data-e="'+esc(email)+'">'+esc(t(has?'vipRemove':'vipGive'))+'</button></span>';
}

/* ---------- chat ng user: "Gusto kong bumili ng VIP" ---------- */
// Para saan: ipakita ang dalawang pagpipilian (Ano ang VIP? / Bibilhin ko na)
function vipChatMenu(){IB.vipMenu=true;vipMenuDraw()}
function vipMenuDraw(){
  const old=$('#ib-vipm');if(old)old.remove();
  if(!IB.vipMenu)return;
  const c=$('#ib-chat');if(!c)return;
  const d=document.createElement('div');d.id='ib-vipm';d.className='ib-vipm';
  d.innerHTML='<div class="vm-t">'+esc(t('vipMenuT'))+'</div><div class="vm-b"><button type="button" class="btn btn-ghost" data-act="vip-what">'+esc(t('vipWhatBtn'))+'</button><button type="button" class="btn btn-primary" data-act="vip-buy">'+esc(t('vipBuyNow'))+'</button></div><button type="button" class="icon-btn sm vm-x" data-act="vip-menu-x" aria-label="'+esc(t('close'))+'">'+I.x+'</button>';
  c.insertAdjacentElement('afterend',d);
  c.scrollTop=c.scrollHeight;
}
// Para saan: "Ano ang VIP?" -> sasagot agad ang bot (sa phone lang, hindi na ipinapadala)
function vipWhat(){
  const th=thRead(),now=Date.now();
  th.msgs.push({id:uid(),from:'user',text:t('vipWhatBtn'),topic:'',ts:now,sent:true,loc:1});
  th.msgs.push({id:uid(),from:'bot',text:t('botVipWhat',VIP_MAX),topic:'',ts:now+1,sent:true,loc:1});
  th.readTs=now+5;thSave(th);IB.stick=true;ibDraw();
}
// Para saan: "Bibilhin ko na" -> ipadala sa Admin/Owner; sasabihin ng bot na maghintay
function vipBuy(){
  const th=thRead(),now=Date.now();
  th.msgs.push({id:uid(),from:'user',text:t('vipBuyMsg'),topic:'vip',ts:now,sent:false});
  th.msgs.push({id:uid(),from:'bot',text:t('botVipBuy'),topic:'',ts:now+1,sent:false});
  th.bot=null;th.readTs=now+5;thSave(th);
  IB.vipMenu=false;IB.stick=true;vipMenuDraw();ibDraw();ibFlush();sfx('success');
}
// Para saan: buksan ang chat at agad ipakita ang VIP na pagpipilian
function vipOpenBuy(){
  if(S.role==='cashier')return;
  closeModal();openMessage();
  setTimeout(vipChatMenu,60);
}

/* ============================================================
   2) GCASH
   ============================================================ */
const K_GC=u=>'tindamo:gcash:'+u,K_GCP=u=>'tindamo:gcashpub:'+u;
I.gcash=ic('<circle cx="12" cy="12" r="9"/><path d="M16 9.5A4.5 4.5 0 1 0 16 14.5V12h-3.5"/>');
I.gcIn=ic('<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>');
I.gcOut=ic('<path d="M12 20V8M7 13l5-5 5 5M5 4h14"/>');
I.gcLoad=ic('<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>');
const GC={until:0,fails:0,lock:0,draft:{},sv:null,delId:null};
const gcG=()=>S.user&&S.role!=='cashier'?readJSON(K_GC(S.user),null):null;
// Para saan: i-save ang GCash data (kasama sa backup at sa pag-publish sa mga cashier)
function gcSet(g){store.set(K_GC(S.user),JSON.stringify(g));save()}
const gcOpenNow=()=>Date.now()<GC.until;
const gcTouch=()=>{GC.until=Date.now()+10*60*1000};
const gcSetup=g=>!!(g&&g.num&&g.pinH);
// Para saan: gawing 09XXXXXXXXX ang number (o '' kung mali)
function gcNorm(v){let d=String(v||'').replace(/\D/g,'');if(d.startsWith('63')&&d.length===12)d='0'+d.slice(2);else if(d.length===10&&d[0]==='9')d='0'+d;return /^09\d{9}$/.test(d)?d:''}
const gcFmtNum=n=>n?n.slice(0,4)+' '+n.slice(4,7)+' '+n.slice(7):'';
const gcMask=n=>n?n.slice(0,4)+' ••• '+n.slice(8):'';
const gcDigits=v=>String(v||'').replace(/\D/g,'');

/* ---------- ang public na bahagi (number, pangalan, QR): ito ang gamit sa Sell, pati ng cashier ---------- */
function gcPub(){
  if(!S.user)return null;
  if(S.role==='cashier')return readJSON(K_GCP(S.user),null);
  const g=gcG();if(!gcSetup(g)||g.accept===false)return null;
  return {num:g.num,name:g.name||'',qr:g.qr||null};
}
// Para saan: lalabas ba ang GCash na tab sa Bayad? (may-ari: lagi, para ma-setup; cashier: kung may setup na ang may-ari)
const gcShowTab=()=>!!gcPub()||S.role!=='cashier';
// Para saan: maliit na bersyon para sa state ng tindahan (ang QR na larawan ay hiwalay)
function gcPubMeta(){
  const p=gcPub();if(!p)return null;
  const m={num:p.num,name:p.name||'',qk:'',qv:'',qh:''};
  if(p.qr){m.qk=p.qr.k;if(p.qr.k==='txt')m.qv=p.qr.v;else m.qh=ihash(p.qr.v)}
  return m;
}
async function gcPublishQR(uidv){
  const p=gcPub();if(!p||!p.qr||p.qr.k!=='img')return;
  const h=ihash(p.qr.v),key='tindamo:gqrpub:'+uidv;if(store.get(key)===h)return;
  await clDb(':commit',{method:'POST',headers:jh,body:JSON.stringify({writes:[{update:{name:dbName('/shops/'+uidv+'/img/gqr'),fields:{h:fStr(h),d:fStr(p.qr.v)}}}]})});
  store.set(key,h);
}
// Para saan: cashier: tanggapin ang GCash ng may-ari galing sa live na tindahan
async function gcApplyPub(m){
  if(!S.user||S.role!=='cashier')return;
  const key=K_GCP(S.user);
  if(!m){if(store.get(key))store.del(key);return}
  const old=readJSON(key,null),p={num:m.num,name:m.name||'',qr:null};
  if(m.qk==='txt'&&m.qv)p.qr={k:'txt',v:m.qv};
  else if(m.qk==='img'&&m.qh){
    p.qh=m.qh;
    if(old&&old.qh===m.qh&&old.qr)p.qr=old.qr;
    else{try{const d=await clDb('/shops/'+shShopUid()+'/img/gqr'),v=fv(d.fields||{},'d');if(v)p.qr={k:'img',v}}catch(e){}}
  }
  store.set(key,JSON.stringify(p));
}
// Para saan: cashier: tanggapin ang GCash mula sa file / link na ipinasa ng may-ari (kumpleto na ang QR)
function gcApplyFull(p){
  if(!S.user||S.role!=='cashier'||p===undefined)return;
  if(!p||!p.num)store.del(K_GCP(S.user));else store.set(K_GCP(S.user),JSON.stringify({num:p.num,name:p.name||'',qr:p.qr||null}));
}
// Para saan: bago burahin ang lumang benta (limit na 500) o i-clear ang data, ilipat ang GCash sa base para hindi bumaba ang balance
function gcFoldSales(list){
  const g=gcG();if(!gcSetup(g))return;
  const add=(list||[]).reduce((a,s)=>a+(s.method==='gcash'&&s.ts>=(g.since||0)?Number(s.total)||0:0),0);
  if(!add)return;
  g.base=r2((Number(g.base)||0)+add);store.set(K_GC(S.user),JSON.stringify(g));
}

/* ---------- balance ng wallet ---------- */
function gcBal(g){
  g=g||gcG();if(!g)return 0;
  let b=Number(g.base)||0;
  S.sales.forEach(s=>{if(s.method==='gcash'&&s.ts>=(g.since||0))b+=Number(s.total)||0});
  (g.tx||[]).forEach(x=>{b+=x.type==='out'?x.amt:-x.amt});
  return r2(b);
}

/* ---------- QR ---------- */
function gcQrHtml(qr){
  if(!qr)return '';
  if(qr.k==='txt'){const s=lkQR(qr.v);return s?'<div class="gc-qr">'+s+'</div>':'<div class="hint">'+esc(t('gcQrBad'))+'</div>'}
  return '<div class="gc-qr"><img alt="GCash QR" src="'+esc(qr.v)+'"></div>';
}
function gcQrBtns(){
  return '<div class="row"><button type="button" class="btn btn-dark" data-act="gc-qr-scan">'+I.scan+' '+esc(t('gcQrScan'))+'</button><label class="btn btn-ghost">'+I.img+' '+esc(t('gcQrGal'))+'<input type="file" id="gc-file" accept="image/*" hidden></label></div>';
}
// Para saan: kunin ang QR sa larawan: kung mababasa, gagawa ng malinaw na QR; kung hindi, gagamitin ang larawan mismo
async function gcQrFromFile(f){
  let code=null;try{code=await decodeFile(f)}catch(e){}
  if(code&&String(code).length>8)return {k:'txt',v:String(code)};
  return {k:'img',v:await resizeImage(f,720)};
}
function gcQrApply(qr){
  const g=gcG();
  if(gcSetup(g)){g.qr=qr;gcSet(g);toast(t('gcQrSaved'))}
  else GC.draft.qr=qr;
  gcDraw();
}

/* ---------- GCash page (may-ari) ---------- */
function openGcash(){
  if(S.role==='cashier'||!S.user)return;
  S.page='gcash';
  openModal(pgHead('GCash')+'<div id="gc-body"></div>');
  gcDraw();
}
function gcDraw(){
  const b=$('#gc-body');if(!b||S.page!=='gcash')return;
  const g=gcG();
  if(!gcSetup(g))gcSetupDraw(b);
  else if(!gcOpenNow())gcLoginDraw(b,g);
  else gcDashDraw(b,g);
}
function gcDraftRead(){
  const d=GC.draft;
  [['gc-name','name'],['gc-num','num'],['gc-pin','pin'],['gc-pin2','pin2'],['gc-base','base']].forEach(x=>{const e=$('#'+x[0]);if(e)d[x[1]]=e.value});
}
// Para saan: unang setup: pangalan, number, QR, PIN, panimulang balance
function gcSetupDraw(b){
  const d=GC.draft,v=k=>esc(d[k]==null?'':d[k]);
  b.innerHTML=
  '<p class="hint" style="margin:0 0 4px">'+esc(t('gcIntro'))+'</p>'+
  '<div class="stack" style="margin-top:12px">'+
  '<div class="field"><label for="gc-name">'+esc(t('gcName'))+'</label><input class="inp" id="gc-name" maxlength="40" autocomplete="off" value="'+v('name')+'"></div>'+
  '<div class="field"><label for="gc-num">'+esc(t('gcNum'))+'</label><input class="inp" id="gc-num" type="tel" inputmode="tel" maxlength="16" placeholder="09XX XXX XXXX" autocomplete="off" value="'+v('num')+'"></div>'+
  '<div class="field"><label>'+esc(t('gcQrT'))+'</label><div class="gc-qrbox">'+(d.qr?gcQrHtml(d.qr):'<div class="hint" style="text-align:center">'+esc(t('gcQrNone'))+'</div>')+'</div>'+gcQrBtns()+'<div class="hint">'+esc(t('gcQrHow'))+'</div></div>'+
  '<div class="row"><div class="field" style="flex:1"><label for="gc-pin">'+esc(t('gcPin'))+'</label><input class="inp" id="gc-pin" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password" value="'+v('pin')+'"></div>'+
  '<div class="field" style="flex:1"><label for="gc-pin2">'+esc(t('gcPin2'))+'</label><input class="inp" id="gc-pin2" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password" value="'+v('pin2')+'"></div></div>'+
  '<div class="field"><label for="gc-base">'+esc(t('gcBase'))+'</label><input class="inp" id="gc-base" type="number" inputmode="decimal" min="0" step="any" placeholder="0" value="'+v('base')+'"></div>'+
  '<div class="hint">'+esc(t('gcVerHint'))+'</div>'+
  '<div class="err" id="gc-err" role="alert"></div>'+
  '<div class="sheet-f"><button type="button" class="btn btn-ghost" data-act="close-modal">'+esc(t('cancel'))+'</button><button type="button" class="btn btn-primary" data-act="gc-setup-save">'+esc(t('gcSave'))+'</button></div></div>';
}
async function gcSetupSave(){
  gcDraftRead();
  const d=GC.draft,err=$('#gc-err');if(err)err.textContent='';
  const name=String(d.name||'').trim(),num=gcNorm(d.num),pin=String(d.pin||''),pin2=String(d.pin2||'');
  const fail=m=>{if(err)err.textContent=t(m);sfx('error')};
  if(name.length<2)return fail('gcErrName');
  if(!num)return fail('gcErrNum');
  if(!/^\d{4}$/.test(pin))return fail('gcErrPin');
  if(pin!==pin2)return fail('gcErrPin2');
  const salt=uid(),h=await hashPw(pin,salt),base=Math.max(0,parseFloat(d.base)||0);
  gcSet({num,name,pinS:salt,pinH:h,since:Date.now(),base:r2(base),tx:[],qr:d.qr||null,accept:true,ts:Date.now()});
  GC.draft={};gcTouch();sfx('success');toast(t('gcReady'),{ms:2500});
  try{confetti()}catch(e){}
  gcDraw();
}
// Para saan: login gamit ang PIN
function gcLoginDraw(b,g){
  b.innerHTML=
  '<div class="gc-lock"><div class="gc-logo">'+I.gcash+'</div><div class="gc-who"><b>'+esc(g.name)+'</b><span class="hint">'+esc(gcMask(g.num))+'</span><span class="chip ok">✓ '+esc(t('gcVerified'))+'</span></div></div>'+
  '<div class="field" style="margin-top:14px"><label for="gc-pin">'+esc(t('gcPin'))+'</label><input class="inp" id="gc-pin" type="password" inputmode="numeric" maxlength="4" autocomplete="off" style="text-align:center;letter-spacing:.5em;font-size:22px"></div>'+
  '<div class="err" id="gc-err" role="alert"></div>'+
  '<div class="sheet-f"><button type="button" class="btn btn-ghost" data-act="gc-forgot">'+esc(t('gcForgot'))+'</button><button type="button" class="btn btn-primary" data-act="gc-login">'+esc(t('gcLogin'))+'</button></div>';
  setTimeout(()=>{const i=$('#gc-pin');if(i)i.focus()},80);
}
async function gcLogin(){
  const g=gcG(),err=$('#gc-err');if(!g||!err)return;err.textContent='';
  if(Date.now()<GC.lock){err.textContent=t('gcLocked');return}
  const pin=($('#gc-pin')||{}).value||'';
  if(!/^\d{4}$/.test(pin)){err.textContent=t('gcErrPin');return}
  if(await hashPw(pin,g.pinS)===g.pinH){GC.fails=0;gcTouch();sfx('success');gcDraw();return}
  sfx('error');buzz(BUZZ_ERR);GC.fails++;
  const e2=$('#gc-err');
  if(GC.fails>=5){GC.fails=0;GC.lock=Date.now()+60000;if(e2)e2.textContent=t('gcLocked')}
  else if(e2)e2.textContent=t('gcPinWrong',5-GC.fails);
  const i=$('#gc-pin');if(i){i.value='';i.focus()}
}
// Para saan: mismong wallet: balance, benta ngayon, Cash In / Out / Load, QR, kasaysayan
function gcDashDraw(b,g){
  const st=dayStart(),today=S.sales.filter(s=>s.method==='gcash'&&s.ts>=st);
  const sales=r2(today.reduce((a,s)=>a+s.total,0)),fees=r2((g.tx||[]).filter(x=>x.ts>=st).reduce((a,x)=>a+x.fee,0));
  const lab={in:'gcIn',out:'gcOut',load:'gcLoad'},ico={in:I.gcIn,out:I.gcOut,load:I.gcLoad};
  const hist=(g.tx||[]).slice().sort((a,c)=>c.ts-a.ts).slice(0,30).map(x=>
    '<div class="gc-tx" data-act="gc-tx-open" data-id="'+esc(x.id)+'" role="button" tabindex="0"><span class="chip '+(x.type==='out'?'ok':'warn')+'">'+esc(t(lab[x.type]))+'</span>'+
    '<div class="gc-tx-b"><b>'+fmt(x.amt)+'</b><small>'+esc(dstr(x.ts))+(x.net?' · '+esc(x.net):'')+(x.ref?' · '+esc(x.ref):'')+'</small></div><span class="gc-fee">+'+fmt(x.fee)+'</span>'+
    '<button type="button" class="icon-btn sm" data-act="gc-tx-del" data-id="'+esc(x.id)+'" aria-label="'+esc(t('delSaleAria'))+'">'+I.trash+'</button></div>').join('');
  b.innerHTML=
  '<div class="gc-hero"><div class="gc-h1"><span>'+esc(t('gcBal'))+'</span><b>'+fmt(gcBal(g))+'</b></div><div class="gc-h2"><span class="chip gc">GCash</span><span>'+esc(g.name)+' · '+esc(gcFmtNum(g.num))+'</span><span class="chip ok">✓ '+esc(t('gcVerified'))+'</span></div></div>'+
  '<div class="gc-stats"><div class="ad-st"><small>'+esc(t('gcSalesToday'))+'</small><b>'+fmt(sales)+'</b></div><div class="ad-st"><small>'+esc(t('gcFeeToday'))+'</small><b class="g">'+fmt(fees)+'</b></div></div>'+
  '<div class="gc-acts">'+['in','out','load'].map(k=>'<button type="button" class="gc-act" data-act="gc-svc" data-k="'+k+'">'+ico[k]+'<span>'+esc(t(lab[k]))+'</span></button>').join('')+'</div>'+
  '<button type="button" class="btn btn-ghost btn-block" style="margin-top:12px" data-act="gc-adj">'+esc(t('gcAdj'))+'</button>'+
  '<div class="set-sec"><span class="lbl">'+esc(t('gcQrT'))+'</span><div class="gc-qrbox">'+(g.qr?gcQrHtml(g.qr):'<div class="hint" style="text-align:center">'+esc(t('gcQrNone'))+'</div>')+'</div>'+gcQrBtns()+'</div>'+
  '<div class="set-sec"><button type="button" class="switch" role="switch" aria-checked="'+(g.accept!==false)+'" data-act="gc-accept"><span class="st">'+esc(t('gcAccept'))+'</span><span class="tgl"></span></button></div>'+
  '<div class="set-sec"><span class="lbl">'+esc(t('gcHist'))+'</span>'+(hist||'<div class="hint">'+esc(t('gcNoHist'))+'</div>')+'</div>'+
  '<div class="set-sec stack"><button type="button" class="btn btn-ghost btn-block" data-act="gc-lock">'+I.lock+' '+esc(t('gcLock'))+'</button><button type="button" class="btn btn-danger btn-block" data-act="gc-remove-ask">'+esc(t('gcRemove'))+'</button><div class="hint">'+esc(t('gcVerHint'))+'</div></div>';
}

/* ---------- Cash In / Cash Out / Load ---------- */
const GC_LAB={in:'gcIn',out:'gcOut',load:'gcLoad'};
// V1.1.8: mga SIM / network na pwedeng piliin sa Load
const GC_NETS=['GLOBE','SMART','DITO','TNT','TM','GOMO','SUN','Iba pa'];
function gcNetField(){
  return '<div class="field"><label>'+esc(t('gcNet'))+'</label><div class="gc-chips gc-nets">'+GC_NETS.map(n=>'<button type="button" data-act="gc-net" data-v="'+esc(n)+'" aria-pressed="false">'+esc(n)+'</button>').join('')+'</div></div>';
}
function gcSvcOpen(k){
  if(!gcOpenNow()||!GC_LAB[k]){gcDraw();return}
  gcTouch();GC.sv={k,net:''};
  openModal(pgHead(t(GC_LAB[k]))+'<div class="stack">'+
  '<div class="field"><label for="gs-amt">'+esc(t('gcAmt'))+'</label><input class="inp" id="gs-amt" type="number" inputmode="decimal" min="0" step="any" placeholder="0" autocomplete="off"></div>'+
  (k==='load'?gcNetField():'')+
  '<div class="field"><label for="gs-fee">'+esc(t('gcFee'))+' (₱)</label><input class="inp" id="gs-fee" type="number" inputmode="decimal" min="0" step="any" placeholder="0" autocomplete="off">'+
    '<div class="gc-chips">'+[['0',t('gcFeeNone')],['5','₱5'],['10','₱10'],['20','₱20'],['pct','2%']].map(x=>'<button type="button" data-act="gc-fee" data-v="'+x[0]+'">'+esc(x[1])+'</button>').join('')+'</div></div>'+
  '<div class="field"><label for="gs-num">'+esc(t('gcCust'))+'</label><input class="inp" id="gs-num" type="tel" inputmode="tel" maxlength="16" placeholder="09XX XXX XXXX" autocomplete="off"></div>'+
  '<div class="field"><label for="gs-ref">'+esc(t('gcRefOpt'))+'</label><input class="inp" id="gs-ref" inputmode="numeric" maxlength="20" placeholder="'+esc(t('gcRefPh'))+'" autocomplete="off"></div>'+
  '<div id="gs-sum"></div></div>'+
  '<div class="sheet-f"><button type="button" class="btn btn-ghost" data-act="gc-back">'+esc(t('back'))+'</button><button type="button" class="btn btn-primary" id="gs-ok" data-act="gc-svc-ok" disabled>'+esc(t('gcFinish'))+'</button></div>');
  ['gs-amt','gs-fee'].forEach(id=>$('#'+id).addEventListener('input',gcSvcUpd));
  setTimeout(()=>{const a=$('#gs-amt');if(a)a.focus()},60);
}
// Para saan: live na buod habang nagta-type (magkano ang kukunin / ibibigay, at ang balance pagkatapos)
function gcSvcUpd(){
  if(!GC.sv||!$('#gs-amt'))return;
  const k=GC.sv.k,amt=parseFloat($('#gs-amt').value),fee=Math.max(0,parseFloat($('#gs-fee').value)||0),ok=!isNaN(amt)&&amt>0;
  const row=(a,b)=>'<div class="eod-row"><span>'+esc(a)+'</span><b>'+esc(b)+'</b></div>';
  let h='',bad=!ok||(k==='load'&&!GC.sv.net);   // V1.1.8: sa Load, kailangang pumili ng SIM
  if(ok){
    const bal=gcBal(gcG()),cash=k==='out'?r2(amt-fee):r2(amt+fee),after=k==='out'?r2(bal+amt):r2(bal-amt);
    const low=k!=='out'&&amt>bal+1e-9;
    bad=low||cash<0||(k==='load'&&!GC.sv.net);
    h=row(t(k==='out'?'gcGive':'gcCollect'),fmt(Math.max(0,cash)))+row(t('gcAfter'),fmt(after))+(low?'<div class="notice" style="margin-top:8px">'+esc(t('gcShort'))+'</div>':'');
  }
  $('#gs-sum').innerHTML=h;$('#gs-ok').disabled=bad;
}
function gcSvcDone(){
  const g=gcG(),k=GC.sv&&GC.sv.k;if(!gcSetup(g)||!GC_LAB[k]||!gcOpenNow())return;
  const amt=r2(parseFloat($('#gs-amt').value)),fee=r2(Math.max(0,parseFloat($('#gs-fee').value)||0));
  if(!(amt>0))return;
  if(k!=='out'&&amt>gcBal(g)+1e-9)return;
  const x={id:uid(),ts:Date.now(),type:k,amt,fee,net:k==='load'?(GC.sv.net||''):'',num:gcNorm($('#gs-num').value),ref:gcDigits($('#gs-ref').value).slice(0,20)};
  g.tx=(g.tx||[]).concat([x]).slice(-500);gcSet(g);gcTouch();
  sfx('success');toast(t('gcDone',t(GC_LAB[k])),{ms:2500});
  rcOpen(gcModelTx(x));
}
// Para saan: resibo ng Cash In / Out / Load (ang parehong papel na ginagamit ng benta)
function gcModelTx(x){
  const out=x.type==='out',cash=out?r2(x.amt-x.fee):r2(x.amt+x.fee),ex=[];
  if(x.net)ex.push([t('gcNet'),x.net]);
  if(x.num)ex.push([t('gcCustS'),gcFmtNum(x.num)]);
  if(x.ref)ex.push([t('gcRefL'),x.ref]);
  const g=gcG();if(g&&g.num)ex.push([t('gcAcct'),gcFmtNum(g.num)]);
  return {title:'GCash · '+t(GC_LAB[x.type]),who:rcWho({r:'o'}),ts:x.ts,hdr:t('gcDetails'),
    rows:[{n:t(GC_LAB[x.type]),q:1,p:x.amt,a:x.amt,plain:true},{n:t('gcFee'),q:1,p:x.fee,a:out?-x.fee:x.fee,plain:true}],
    totalLbl:t(out?'gcGive':'gcCollect'),total:Math.max(0,cash),ex,foot:t('rcptThanks'),id:x.id,status:null};
}

/* ---------- bayad sa Sell (checkout) ---------- */
// Para saan: ang kahon ng GCash sa loob ng Bayad: QR, number, at Reference No.
function gcPayPanel(){
  const p=gcPub();
  if(!p)return '<div id="pay-gcash" class="stack" hidden><div class="notice">'+esc(t('gcNoSetup'))+'</div><button type="button" class="btn btn-dark btn-block" data-act="gc-setup-go">'+I.gcash+' '+esc(t('gcSetupGo'))+'</button></div>';
  return '<div id="pay-gcash" class="stack" hidden>'+
  '<div class="gc-pay"><div class="gc-qrw" data-act="gc-qr-big" role="button" tabindex="0">'+(p.qr?gcQrHtml(p.qr):'<div class="gc-noqr">'+I.gcash+'<span>'+esc(t('gcNoQr'))+'</span></div>')+'</div>'+
  '<div class="gc-to"><small>'+esc(t('gcSendTo'))+'</small><b>'+esc(p.name)+'</b><span>'+esc(gcFmtNum(p.num))+'</span></div></div>'+
  (p.qr?'<div class="hint" style="text-align:center;margin-top:-4px">'+esc(t('gcBigHint'))+'</div>':'')+
  '<div class="field"><label for="gc-ref">'+esc(t('gcRefLbl'))+'</label><input class="inp" id="gc-ref" inputmode="numeric" maxlength="20" placeholder="'+esc(t('gcRefPh'))+'" autocomplete="off"></div></div>';
}
// Para saan: tama ba ang Reference No. (hindi bababa sa 6 na numero)
const gcRefOk=()=>{const e=$('#gc-ref');return !!gcPub()&&!!e&&gcDigits(e.value).length>=6};

/* ---------- mga event ---------- */
document.addEventListener('input',e=>{
  if(e.target.id==='gc-pin'&&S.page==='gcash'&&gcSetup(gcG())&&!gcOpenNow()&&/^\d{4}$/.test(e.target.value))gcLogin();   // awtomatikong login kapag 4 na numero na
});
document.addEventListener('change',async e=>{
  if(e.target.id!=='gc-file')return;
  const f=e.target.files&&e.target.files[0];e.target.value='';if(!f)return;
  gcDraftRead();
  try{gcQrApply(await gcQrFromFile(f))}catch(x){toast(t('gcQrBad'),{kind:'warn'})}
});

Object.assign(ACTIONS,{
  /* VIP */
  'vip-open-buy':()=>vipOpenBuy(),
  'vip-what':()=>vipWhat(),
  'vip-buy':()=>vipBuy(),
  'vip-menu-x':()=>{IB.vipMenu=false;vipMenuDraw()},
  'vip-give':async b=>{if(await vipSet(b.dataset.e,true))adListDraw()},
  'vip-remove':async b=>{if(await vipSet(b.dataset.e,false))adListDraw()},
  'vip-chat':async b=>{
    const e=b.dataset.e,has=!!(AD.vips&&AD.vips.has(canonEmail(e)));
    if(await vipSet(e,!has)){const w=$('#ib-vipw');if(w)w.outerHTML=vipChatWrap(e)}
  },
  /* GCash */
  'gc-setup-go':()=>{closeModal();openGcash()},
  'gc-setup-save':()=>{gcSetupSave()},
  'gc-login':()=>{gcLogin()},
  'gc-back':()=>{openGcash()},
  'gc-lock':()=>{GC.until=0;gcDraw()},
  'gc-svc':b=>{gcSvcOpen(b.dataset.k)},
  'gc-svc-ok':()=>{gcSvcDone()},
  'gc-net':b=>{
    if(!GC.sv)return;GC.sv.net=b.dataset.v;
    document.querySelectorAll('[data-act="gc-net"]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
    gcSvcUpd();
  },
  'gc-fee':b=>{
    const f=$('#gs-fee');if(!f)return;
    if(b.dataset.v==='pct'){const a=parseFloat($('#gs-amt').value);f.value=a>0?Math.ceil(a*0.02):''}else f.value=b.dataset.v;
    gcSvcUpd();
  },
  'gc-qr-scan':()=>{
    gcDraftRead();closeModal();
    openScanner({title:t('gcQrScanT'),qr:true,onCode:code=>{
      const c=String(code||'').trim();
      if(c.length<8){toast(t('gcQrBad'),{kind:'err'});return false}
      setTimeout(()=>{openGcash();gcQrApply({k:'txt',v:c})},120);
    }});
  },
  'gc-qr-big':b=>{b.classList.toggle('big')},
  'gc-accept':()=>{const g=gcG();if(!gcSetup(g))return;g.accept=g.accept===false;gcSet(g);gcDraw()},
  'gc-adj':()=>{
    if(!gcOpenNow()){gcDraw();return}
    openModal(pgHead(t('gcAdj'))+'<p class="hint" style="margin:0 0 10px">'+esc(t('gcAdjP'))+'</p><div class="field"><label for="gadj">'+esc(t('gcBal'))+' (₱)</label><input class="inp" id="gadj" type="number" inputmode="decimal" min="0" step="any" value="'+gcBal()+'"></div>'+
    '<div class="sheet-f"><button type="button" class="btn btn-ghost" data-act="gc-back">'+esc(t('back'))+'</button><button type="button" class="btn btn-primary" data-act="gc-adj-ok">'+esc(t('save'))+'</button></div>');
    setTimeout(()=>{const i=$('#gadj');if(i){i.focus();i.select()}},60);
  },
  'gc-adj-ok':()=>{
    const v=parseFloat(($('#gadj')||{}).value),g=gcG();if(isNaN(v)||v<0||!gcSetup(g))return;
    g.base=r2((Number(g.base)||0)+(v-gcBal(g)));gcSet(g);toast(t('gcAdjOk'));sfx('success');openGcash();
  },
  'gc-tx-open':b=>{const g=gcG(),x=g&&(g.tx||[]).find(y=>y.id===b.dataset.id);if(x)rcOpen(gcModelTx(x))},
  'gc-tx-del':b=>{GC.delId=b.dataset.id;confirmBox(esc(t('gcDelQ')),esc(t('gcDelP')),'gc-tx-del-yes',esc(t('yesDel')))},
  'gc-tx-del-yes':()=>{const g=gcG();if(g){g.tx=(g.tx||[]).filter(y=>y.id!==GC.delId);gcSet(g)}GC.delId=null;openGcash()},
  'gc-remove-ask':()=>{confirmBox(esc(t('gcRemove')),esc(t('gcRemoveP')),'gc-remove-yes',esc(t('gcYesRemove')))},
  'gc-remove-yes':()=>{store.del(K_GC(S.user));GC.until=0;GC.draft={};save();closeModal();toast(t('gcRemoved'))},
  'gc-forgot':()=>{
    openModal(pgHead(t('gcForgot'))+'<p class="hint" style="margin:0 0 10px">'+esc(t('gcForgotP'))+'</p><div class="stack">'+
    '<div class="field"><label for="gf-num">'+esc(t('gcNum'))+'</label><input class="inp" id="gf-num" type="tel" inputmode="tel" maxlength="16" placeholder="09XX XXX XXXX" autocomplete="off"></div>'+
    '<div class="field"><label for="gf-pin">'+esc(t('gcPinNew'))+'</label><input class="inp" id="gf-pin" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password"></div>'+
    '<div class="err" id="gf-err" role="alert"></div></div>'+
    '<div class="sheet-f"><button type="button" class="btn btn-ghost" data-act="gc-back">'+esc(t('back'))+'</button><button type="button" class="btn btn-primary" data-act="gc-forgot-go">'+esc(t('save'))+'</button></div>');
  },
  'gc-forgot-go':async()=>{
    const g=gcG(),err=$('#gf-err');if(!gcSetup(g)||!err)return;err.textContent='';
    if(gcNorm($('#gf-num').value)!==g.num){err.textContent=t('gcNumMismatch');sfx('error');return}
    const pin=$('#gf-pin').value;if(!/^\d{4}$/.test(pin)){err.textContent=t('gcErrPin');return}
    g.pinS=uid();g.pinH=await hashPw(pin,g.pinS);gcSet(g);GC.until=0;GC.fails=0;GC.lock=0;
    toast(t('gcPinReset'));sfx('success');openGcash();
  }
});

/* ---------- boot ng VIP ---------- */
setTimeout(vipFetch,5200);
setInterval(vipFetch,60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(vipFetch,600)});
window.addEventListener('online',()=>setTimeout(vipFetch,800));

/* ################################################################
   DATING V1.1.4  (isinama na sa v1.0.0)
   ################################################################ */
/* ============================================================
   ITO PARA SA MGA BAGO SA V1.1.4   [versions/v1.1.4.js]
   1) VIP sa chat: may bago nang pagpipiliang "Magkano?". Ang VIP ay ₱105. Tatlo na ang pagpipilian:
      Ano ang VIP? / Magkano? / Bibilhin ko na.
   2) Google sign-in: kapag error [16] (Account reauth failed), may malinaw nang paliwanag sa screen.
      Ang sanhi ay ang SHA-1 ng key na pinirmahan sa APK ay wala sa Google Cloud. Tingnan ang SETUP-CLOUD.md (npm run android:sha1).
   ============================================================ */
let VIP_PRICE=(()=>{const n=parseInt(store.get('tindamo:vipprice'),10);return n>0?n:105})();   // V1.2.1: pwedeng palitan ng Admin (cloud: /config/vip)

Object.assign(D,{
vipPriceBtn:[`Magkano?`,`How much?`,`얼마예요?`,`多少钱？`,`いくらですか？`],
botVipPrice:[`Ang VIP ay ₱{0} lang. Kung gusto mo na, pindutin ang "Bibilhin ko na" at hintayin ang sagot ng Admin/Owner para sa susunod na hakbang.`,`VIP costs only ₱{0}. If you're ready, tap "Buy now" and wait for the Admin/Owner to reply with the next steps.`,`VIP는 ₱{0}예요. 준비되면 "지금 구매"를 누르고 관리자/오너의 안내를 기다려 주세요.`,`VIP 只需 ₱{0}。准备好后请点“立即购买”，等待管理员/店主回复后续步骤。`,`VIPは₱{0}です。ご希望なら「今すぐ購入」を押し、管理者/オーナーの案内をお待ちください。`],
botVipWhat:[`Ang VIP ay para sa gustong walang limit sa pag-gawa ng item. Ang Guest ay hanggang {0} items lang; ang VIP ay kahit ilan, sa halagang ₱{1} lang. Kung gusto mo na, pindutin ang "Bibilhin ko na".`,`VIP is for people who want unlimited items. Guests can only create up to {0} items; VIP has no limit and costs only ₱{1}. If you're ready, tap "Buy now".`,`VIP는 상품을 무제한으로 만들고 싶은 분을 위한 등급이에요. 게스트는 최대 {0}개까지만, VIP는 제한 없이 ₱{1}예요. 준비되면 "지금 구매"를 눌러 주세요.`,`VIP 适合想要无限创建商品的用户。访客最多 {0} 个商品，VIP 没有限制，仅需 ₱{1}。准备好后请点“立即购买”。`,`VIPは商品を無制限に作りたい方向けです。ゲストは最大{0}個まで、VIPは無制限で₱{1}です。ご希望なら「今すぐ購入」を押してください。`],
botVipBuy:[`Salamat! Naipadala na sa Admin/Owner ang hiling mo na bumili ng VIP (₱{0}). Hintayin mo lang silang sumagot dito sa chat. 🙏`,`Thank you! Your request to buy VIP (₱{0}) was sent to the Admin/Owner. Please wait for them to reply here in the chat. 🙏`,`감사합니다! VIP(₱{0}) 구매 요청을 관리자/오너에게 보냈어요. 이 채팅에서 답장을 기다려 주세요. 🙏`,`谢谢！您购买 VIP（₱{0}）的请求已发送给管理员/店主，请在此聊天中等待回复。🙏`,`ありがとうございます！VIP（₱{0}）購入のリクエストを管理者/オーナーに送りました。このチャットで返信をお待ちください。🙏`],
googleSha:[`Hindi tinanggap ng Google ang app na ito (code 16). Ibig sabihin, ang SHA-1 ng key ng app ay wala pa sa Google Cloud. Kailangang idagdag ito ng may-ari ng app (tingnan ang SETUP-CLOUD.md). Samantala, mag-login gamit ang email/number at password.`,`Google didn't accept this app (code 16). This usually means the app's signing SHA-1 isn't registered in Google Cloud yet. The app owner needs to add it (see SETUP-CLOUD.md). Meanwhile, sign in with your email/number and password.`,`Google이 이 앱을 승인하지 않았어요 (코드 16). 앱 서명 SHA-1이 Google Cloud에 등록되지 않은 경우가 많아요. 앱 소유자가 추가해야 해요 (SETUP-CLOUD.md 참고). 그동안은 이메일/번호와 비밀번호로 로그인하세요.`,`Google 未接受此应用（代码 16）。通常是应用签名的 SHA-1 尚未在 Google Cloud 中登记，需要应用所有者添加（见 SETUP-CLOUD.md）。在此之前请用邮箱/号码和密码登录。`,`Googleがこのアプリを承認しませんでした（コード16）。アプリの署名SHA-1がGoogle Cloudに未登録の可能性があります。アプリの所有者が追加してください（SETUP-CLOUD.md参照）。それまではメール/番号とパスワードでログインしてください。`]
});

// Para saan: ang chat ng VIP na may tatlong pagpipilian (bago: Magkano?)
function vipMenuDraw(){
  const old=$('#ib-vipm');if(old)old.remove();
  if(!IB.vipMenu)return;
  const c=$('#ib-chat');if(!c)return;
  const d=document.createElement('div');d.id='ib-vipm';d.className='ib-vipm';
  d.innerHTML='<div class="vm-t">'+esc(t('vipMenuT'))+'</div><div class="vm-b"><button type="button" class="btn btn-ghost" data-act="vip-what">'+esc(t('vipWhatBtn'))+'</button><button type="button" class="btn btn-ghost" data-act="vip-price">'+esc(t('vipPriceBtn'))+'</button><button type="button" class="btn btn-primary" data-act="vip-buy">'+esc(t('vipBuyNow'))+'</button></div><button type="button" class="icon-btn sm vm-x" data-act="vip-menu-x" aria-label="'+esc(t('close'))+'">'+I.x+'</button>';
  c.insertAdjacentElement('afterend',d);
  c.scrollTop=c.scrollHeight;
}
// Para saan: ang bot ay sumasagot sa phone lang (hindi ipinapadala sa admin)
function vipBotReply(q,a){
  const th=thRead(),now=Date.now();
  th.msgs.push({id:uid(),from:'user',text:q,topic:'',ts:now,sent:true,loc:1});
  th.msgs.push({id:uid(),from:'bot',text:a,topic:'',ts:now+1,sent:true,loc:1});
  th.readTs=now+5;thSave(th);IB.stick=true;ibDraw();
}
function vipWhat(){vipBotReply(t('vipWhatBtn'),t('botVipWhat',VIP_MAX,VIP_PRICE))}
function vipPrice(){vipBotReply(t('vipPriceBtn'),t('botVipPrice',VIP_PRICE))}
// Para saan: "Bibilhin ko na": ipadala sa Admin/Owner (kasama ang presyo); sasabihin ng bot na maghintay
function vipBuy(){
  const th=thRead(),now=Date.now();
  th.msgs.push({id:uid(),from:'user',text:t('vipBuyMsg')+' (₱'+VIP_PRICE+')',topic:'vip',ts:now,sent:false});
  th.msgs.push({id:uid(),from:'bot',text:t('botVipBuy',VIP_PRICE),topic:'',ts:now+1,sent:false});
  th.bot=null;th.readTs=now+5;thSave(th);
  IB.vipMenu=false;IB.stick=true;vipMenuDraw();ibDraw();ibFlush();sfx('success');
}
Object.assign(ACTIONS,{'vip-price':()=>vipPrice()});

/* ################################################################
   DATING V1.1.5  (isinama na sa v1.0.0)
   ################################################################ */
/* ============================================================
   ITO PARA SA MGA BAGO SA V1.1.5   [versions/v1.1.5.js]
   "ANO ANG BAGO?": may button na nagpapakita ng description ng GitHub Release mo (yung isinulat mo
   sa "Describe this release"). Makikita ito sa:
     1) pop-up na "May bagong version!"  (button: Ano ang bago sa vX?)
     2) Settings > Bersyon ng app        (button: Ano ang bago sa vX?)
     3) pagkatapos mag-update: lalabas ang "Na-update na!" na may button na Ano ang bago?
   Kinukuha ang mga notes sa https://api.github.com/repos/zhenjiro15/TindaMo/releases at sine-save sa phone,
   kaya makikita pa rin kahit offline (basta nakuha na dati).
   ============================================================ */
Object.assign(D,{
relBtn:[`Ano ang bago?`,`What's new?`,`새로운 기능`,`有什么新内容？`,`新機能を見る`],
relBtnV:[`Ano ang bago sa v{0}?`,`What's new in v{0}?`,`v{0} 새로운 기능`,`v{0} 有什么新内容？`,`v{0} の新機能`],
relT:[`Ano ang bago sa v{0}`,`What's new in v{0}`,`v{0} 새로운 기능`,`v{0} 更新内容`,`v{0} の新機能`],
relLoading:[`Kinukuha ang mga bago…`,`Loading what's new…`,`불러오는 중…`,`正在加载…`,`読み込み中…`],
relNone:[`Walang isinulat na description ang release na ito sa GitHub.`,`This release has no description on GitHub.`,`이 릴리스에는 GitHub 설명이 없어요.`,`此版本在 GitHub 上没有说明。`,`このリリースにはGitHubの説明がありません。`],
relFail:[`Hindi makuha ang mga bago. Kailangan ng internet (isang beses lang), tapos maaalala na ng app.`,`Couldn't load what's new. Connect to the internet once and the app will remember it.`,`불러올 수 없어요. 인터넷에 한 번 연결하면 앱이 기억해요.`,`无法加载。联网一次后应用会记住。`,`読み込めませんでした。一度ネットに接続すると保存されます。`],
relOk:[`Okay`,`OK`,`확인`,`好`,`OK`],
relUpdT:[`Na-update na ang app!`,`App updated!`,`앱이 업데이트되었어요!`,`应用已更新！`,`アプリを更新しました！`],
relUpdP:[`Ngayon ay v{0} na ang TindaMo mo.`,`You're now on TindaMo v{0}.`,`이제 TindaMo v{0}입니다.`,`你现在使用的是 TindaMo v{0}。`,`TindaMo v{0} になりました。`]
});

/* ---------- mga release notes (galing sa GitHub, naka-save sa phone) ---------- */
const K_REL='tindamo:rel',K_LASTVER='tindamo:lastver';
const REL={busy:null};
// Para saan: gawing pare-pareho ang anyo ng version (v1.2.0 -> 1.2) para mahanap ang tamang release
const relKey=v=>{const p=verParts(v);while(p.length>1&&p[p.length-1]===0)p.pop();return p.join('.')};
// Para saan: basahin ang mga naka-save na notes
const relCache=()=>readJSON(K_REL,{rels:{}}).rels||{};
// Para saan: kunin ang notes ng isang version (galing sa naka-save). Walang laman = hindi pa nakukuha
const relGet=v=>relCache()[relKey(v)]||null;
// Para saan: kunin ang listahan ng releases sa GitHub at i-save ang description ng bawat isa
async function relLoad(){
  if(REL.busy)return REL.busy;
  REL.busy=(async()=>{
    try{
      const j=await verGet(APP_VER.api.replace(/\/latest$/,'')+'?per_page=30');
      if(!Array.isArray(j))return false;
      const rels={};
      j.forEach(r=>{if(!r||r.draft||!r.tag_name)return;
        rels[relKey(r.tag_name)]={tag:String(r.tag_name),name:String(r.name||''),body:String(r.body||''),date:String(r.published_at||r.created_at||''),url:String(r.html_url||'')}});
      store.set(K_REL,JSON.stringify({ts:Date.now(),rels}));
      return true;
    }catch(e){return false}
    finally{REL.busy=null}
  })();
  return REL.busy;
}
// Para saan: gawing maayos na text ang description ng GitHub (heading, bullet, **bold**, `code`). Ligtas: esc muna.
function relMd(src){
  const inl=s=>esc(s)
    .replace(/!\[[^\]]*\]\([^)]*\)/g,'')
    .replace(/\[([^\]]+)\]\(([^)]*)\)/g,'$1')
    .replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')
    .replace(/`([^`]+)`/g,'<code>$1</code>');
  const out=[];let ul=false;
  String(src||'').replace(/\r/g,'').replace(/<!--[\s\S]*?-->/g,'').split('\n').forEach(raw=>{
    const l=raw.trimEnd();
    const li=l.match(/^\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?(.*)$/);
    if(li){if(!ul){out.push('<ul>');ul=true}out.push('<li>'+inl(li[1])+'</li>');return}
    if(ul){out.push('</ul>');ul=false}
    const h=l.match(/^#{1,6}\s+(.*)$/);
    if(h){out.push('<h3>'+inl(h[1])+'</h3>');return}
    if(!l.trim()){return}
    if(/^\s*(?:-{3,}|\*{3,})\s*$/.test(l)){return}
    out.push('<p>'+inl(l.trim())+'</p>');
  });
  if(ul)out.push('</ul>');
  return out.join('');
}
// Para saan: ang laman ng kahon ng "Ano ang bago" para sa isang version
function relBodyHtml(ver){
  const r=relGet(ver);
  if(!r)return null;
  const body=relMd(r.body);
  return body||('<p class="hint">'+esc(t('relNone'))+'</p>');
}
// Para saan: buksan ang kahon ng "Ano ang bago" ng version na ito
async function relShow(ver){
  if(!ver)return;
  let b=$('#relbox');
  if(!b){b=document.createElement('div');b.id='relbox';b.className='verbox relbox';b.setAttribute('role','dialog');document.body.appendChild(b)}
  const draw=inner=>{b.innerHTML='<div class="vb-card rel-card"><div class="vb-ic">'+I.bolt+'</div><h2>'+esc(t('relT',ver))+'</h2><div class="rel-body">'+inner+'</div>'+
    '<div class="vb-b col"><button class="btn btn-primary btn-block" data-act="rel-close">'+esc(t('relOk'))+'</button></div></div>'};
  let h=relBodyHtml(ver);
  if(h){draw(h);if(navigator.onLine)relLoad().then(ok=>{const n=ok&&$('#relbox')&&relBodyHtml(ver);if(n&&n!==h)draw(n)});return}
  draw('<p class="hint">'+esc(t('relLoading'))+'</p>');
  const ok=navigator.onLine?await relLoad():false;
  if(!$('#relbox'))return;
  h=ok?relBodyHtml(ver):null;
  draw(h||('<p class="hint">'+esc(t(ok?'relNone':'relFail'))+'</p>'));
}
const relClose=()=>{const b=$('#relbox');if(b)b.remove()};

/* ---------- isama ang notes sa pagkuha ng pinakabagong version (para handa na pag lumabas ang pop-up) ---------- */
const _verFetchLatest12=verFetchLatest;
verFetchLatest=async function(){
  const v=await _verFetchLatest12();
  if(v&&navigator.onLine)await relLoad();
  return v;
};

/* ---------- button sa pop-up na "May bagong version!" ---------- */
const _verPrompt12=verPrompt;
verPrompt=function(){
  _verPrompt12();
  const bb=$('#verbox .vb-b');
  if(bb&&!$('#verbox .rel-link'))bb.insertAdjacentHTML('beforebegin','<button class="btn btn-ghost btn-block rel-link" style="margin:0 0 10px" data-act="rel-open" data-v="'+esc(APP_VER.latest)+'">'+I.bolt+' '+esc(t('relBtnV',APP_VER.latest))+'</button>');
};

/* ---------- button sa Settings > Bersyon ng app ---------- */
const _verRowHtml12=verRowHtml;
verRowHtml=function(){
  const v=verNewer()?APP_VER.latest:APP_VER.ver;
  return _verRowHtml12()+'<button class="btn btn-ghost btn-block rel-link" style="margin-top:10px" data-act="rel-open" data-v="'+esc(v)+'">'+I.bolt+' '+esc(t('relBtnV',v))+'</button>';
};

/* ---------- pagkatapos mag-update: "Na-update na ang app!" (isang beses lang) ---------- */
function relJustUpdated(){
  const last=store.get(K_LASTVER);
  if(last===APP_VER.ver)return true;
  // wala pang tala at may dating account sa phone = galing sa lumang version (nag-update lang)
  if(!last&&!store.get(K_USERS)){store.set(K_LASTVER,APP_VER.ver);return true}
  if($('#verbox')||$('#verlock')||$('#verdl')||$('#relbox'))return false;   // may ibang pop-up, mamaya na
  store.set(K_LASTVER,APP_VER.ver);
  const b=document.createElement('div');b.id='relbox';b.className='verbox relbox';b.setAttribute('role','dialog');
  b.innerHTML='<div class="vb-card"><div class="vb-ic">'+I.check+'</div><h2>'+esc(t('relUpdT'))+'</h2><p>'+esc(t('relUpdP',APP_VER.ver))+'</p>'+
    '<div class="vb-b col"><button class="btn btn-primary btn-block" data-act="rel-open" data-v="'+esc(APP_VER.ver)+'">'+I.bolt+' '+esc(t('relBtn'))+'</button>'+
    '<button class="btn btn-ghost btn-block" data-act="rel-close">'+esc(t('relOk'))+'</button></div></div>';
  document.body.appendChild(b);
  if(navigator.onLine)relLoad();
  return true;
}
{let n=0;const iv=setInterval(()=>{if(relJustUpdated()||++n>12)clearInterval(iv)},4000)}

Object.assign(ACTIONS,{
  'rel-open':b=>{relShow((b&&b.dataset&&b.dataset.v)||APP_VER.ver)},
  'rel-close':()=>{relClose()}
});

/* ################################################################
   DATING V1.1.6  (isinama na sa v1.0.0)
   ################################################################ */
/* ============================================================
   ITO PARA SA MGA BAGO SA V1.1.6   [versions/v1.1.6.js]
   1) UPDATE: kapag pinakabago na ang version mo (hal. nasa 1.1.5 na at 1.1.5 ang latest), HINDI na magda-download ulit.
      Ang button sa Settings ay "Pinakabago na" (naka-disable) at may paalala na hintayin ang susunod na update.
      Kapag may bago lang magagana ang I-update.
   2) MESSAGE: (ang mga pagbabago ay nasa inbox.js)
      - Admin/Owner: sa listahan at sa loob ng usapan, nasa gilid ang profile pic (avatar), sa itaas ang pangalan ng tindahan,
        sa baba ang Gmail, at may tatak na VIP / Guest (Dev para sa owner, Admin para sa admin).
      - Ibang user (hindi admin/owner): ang titulo ay "MESSAGE" lang (hindi Dev), may tatak ng VIP o Guest nila.
   3) UTANG: Guest = hanggang 75 na tao ang pwedeng may utang. VIP / Admin / Dev = walang limit. (Cashier: walang harang.)
   ============================================================ */
const UTANG_MAX=75;

Object.assign(D,{
mMsgT:[`MESSAGE`,`MESSAGE`,`메시지`,`消息`,`メッセージ`],
mFromAdmin:[`Admin`,`Admin`,`관리자`,`管理员`,`管理者`],
verNone:[`Pinakabago na`,`Up to date`,`최신 버전`,`已是最新`,`最新です`],
verWait:[`Pinakabago na ang version mo (v{0}). Wala pang bagong update, hintayin na lang ang susunod. Parating na ang bagong version.`,`You're on the latest version (v{0}). There's no new update yet, just wait for the next one. A new version is coming.`,`최신 버전(v{0})입니다. 아직 새 업데이트가 없어요. 다음 업데이트를 기다려 주세요.`,`你已是最新版本（v{0}）。暂无新更新，请等待下一次更新。`,`最新バージョン（v{0}）です。新しい更新はまだありません。次の更新をお待ちください。`],
utLimitP:[`Hanggang {0} na tao lang ang pwedeng may utang sa Guest. Kumuha ng VIP para walang limit sa utang.`,`Guests can have up to {0} people owing. Get VIP for unlimited utang.`,`게스트는 외상 고객을 최대 {0}명까지 등록할 수 있어요. VIP로 무제한 이용하세요.`,`访客最多可记录 {0} 位欠款人。升级 VIP 即可不限数量。`,`ゲストはツケのお客さんを最大{0}人までです。VIPなら無制限です。`],
utGuestN:[`Utang: {0} sa {1} na tao ang may utang.`,`Utang: {0} of {1} people owing.`,`외상: {1}명 중 {0}명`,`欠款：{1} 人中已有 {0} 人`,`ツケ：{1}人中{0}人`],
botVipWhat:[`Ang VIP ay para sa gustong walang limit. Ang Guest ay hanggang {0} items at {2} na tao na may utang lang; ang VIP ay kahit ilan, sa halagang ₱{1} lang. Kung gusto mo na, pindutin ang "Bibilhin ko na".`,`VIP is for people who want no limits. Guests can only have up to {0} items and {2} people owing; VIP has no limit and costs only ₱{1}. If you're ready, tap "Buy now".`,`VIP는 제한 없이 쓰고 싶은 분을 위한 등급이에요. 게스트는 상품 최대 {0}개, 외상 고객 {2}명까지, VIP는 제한 없이 ₱{1}예요. 준비되면 "지금 구매"를 눌러 주세요.`,`VIP 适合想要无限制的用户。访客最多 {0} 个商品和 {2} 位欠款人，VIP 没有限制，仅需 ₱{1}。准备好后请点“立即购买”。`,`VIPは制限なしで使いたい方向けです。ゲストは商品{0}個、ツケ{2}人まで、VIPは無制限で₱{1}です。ご希望なら「今すぐ購入」を押してください。`]
});

/* ---------- 1) UPDATE: bawal mag-download ulit kung pinakabago na ---------- */
// Para saan: pinakabago na ba ang app? (alam na ang latest sa GitHub at hindi ito mas mataas sa version ng app)
const verIsLatest=()=>!!APP_VER.latest&&!verNewer();
// Para saan: laman ng linya ng version sa Settings (may "Pinakabago na" na naka-disable kapag wala pang bago)
verRowHtml=function(){
  const nw=verNewer(),v=nw?APP_VER.latest:APP_VER.ver;
  return '<div class="ver-line"><b>'+esc(APP_VER.name)+'</b><span class="chip">v'+esc(APP_VER.ver)+'</span></div>'+
    '<div class="hint" style="margin:6px 0 10px">'+esc(nw?t('verNewP',APP_VER.ver,APP_VER.latest):verIsLatest()?t('verWait',APP_VER.ver):t('verUpToDate',APP_VER.ver))+'</div>'+
    '<div class="row"><button class="btn btn-ghost" data-act="ver-check">'+esc(t('verCheck'))+'</button>'+
    (nw?'<button class="btn btn-primary" data-act="ver-update">'+esc(t('verUpdate'))+'</button>'
       :'<button class="btn btn-dark" data-act="ver-update" disabled aria-disabled="true">'+esc(t('verNone'))+'</button>')+'</div>'+
    '<button class="btn btn-ghost btn-block rel-link" style="margin-top:10px" data-act="rel-open" data-v="'+esc(v)+'">'+I.bolt+' '+esc(t('relBtnV',v))+'</button>';
};
const _verUpdate13=ACTIONS['ver-update'];
ACTIONS['ver-update']=function(b){
  if(verIsLatest()){const v=$('#verbox');if(v)v.remove();toast(t('verWait',APP_VER.ver),{ms:4200});return}   // pinakabago na: walang download
  if(!APP_VER.latest){verCheck(true);return}                                                              // hindi pa alam: tingnan muna sa GitHub
  return _verUpdate13(b);
};
const _dlStart13=dlStart;
dlStart=function(){if(verIsLatest()){dlClose();toast(t('verWait',APP_VER.ver),{ms:4200});return}return _dlStart13()};

/* ---------- 3) UTANG: Guest hanggang 75 na tao ---------- */
// Para saan: ilan ang may utang ngayon (ito ang binibilang)
const utangCount=()=>owing().length;
// Para saan: ang pangalang ito ba ay bagong may utang? (wala pa sa listahan ng may utang)
const utangIsNew=name=>{const k=String(name||'').trim().toLowerCase();return !!k&&!owing().some(c=>c.key===k)};
// Para saan: harangan ang Guest na lampas na sa 75. Ibinabalik ang true kung hinarang
function utangBlockNew(name){
  if(S.role==='cashier'||vipUnlimited())return false;
  if(!utangIsNew(name)||utangCount()<UTANG_MAX)return false;
  utangUpsell();return true;
}
function utangUpsell(){
  openModal('<div class="sheet-h"><h2>'+esc(t('vipLimitT'))+'</h2><button class="icon-btn" data-act="close-modal" aria-label="'+esc(t('close'))+'">'+I.x+'</button></div>'+
  '<div class="vip-up"><div class="vip-ic">'+I.vip+'</div><p class="hint" style="margin:0">'+esc(t('utLimitP',UTANG_MAX))+'</p></div>'+
  '<div class="sheet-f"><button class="btn btn-ghost" data-act="close-modal">'+esc(t('verLater'))+'</button><button class="btn btn-primary" data-act="vip-open-buy">'+esc(t('vipBuyBtn'))+'</button></div>');
  sfx('error');
}
// Para saan: manual na dagdag ng utang
const _saveManualDebt13=saveManualDebt;
saveManualDebt=function(){
  const n=$('#md-name'),a=$('#md-amt');
  if(n&&a&&n.value.trim().length>=2&&parseFloat(a.value)>0&&utangBlockNew(n.value))return;
  return _saveManualDebt13();
};
// Para saan: benta na Utang sa Sell
const _completeSale13=completeSale;
completeSale=function(){
  if(payMode==='utang'){const n=$('#u-name');if(n&&n.value.trim().length>=2&&utangBlockNew(n.value))return}
  return _completeSale13();
};
// Para saan: sa Profile (Guest): ipakita kung ilan na ang may utang
const _vipProfileHtml13=vipProfileHtml;
vipProfileHtml=function(){
  const h=_vipProfileHtml13();
  if(S.role==='cashier'||vipTier()!=='guest')return h;
  const bar='<div class="vip-bar"><i style="width:'+Math.min(100,Math.round(utangCount()/UTANG_MAX*100))+'%"></i></div><div class="hint">'+esc(t('utGuestN',utangCount(),UTANG_MAX))+'</div>';
  return h.replace('<button class="btn btn-primary btn-block" data-act="vip-open-buy">',bar+'<button class="btn btn-primary btn-block" data-act="vip-open-buy" style="margin-top:10px">');
};
// Para saan: "Ano ang VIP?" na may kasamang limit sa utang
vipWhat=function(){vipBotReply(t('vipWhatBtn'),t('botVipWhat',VIP_MAX,VIP_PRICE,UTANG_MAX))};

/* ################################################################
   DATING V1.1.7  (isinama na sa v1.0.0)
   ################################################################ */
/* ============================================================
   ITO PARA SA MGA BAGO SA V1.1.7   [versions/v1.1.7.js]
   1) ADMIN/OWNER: sa loob ng usapan ng user may bagong button na kalasag (Aksyon):
        - BABALA: magpadala ng warning sa user (lalabas sa phone niya bilang pop-up at sa chat)
        - BAN: 1 araw / 2 araw / 7 araw / 30 araw, may dahilan. Pagkatapos ng oras, kusang bumabalik ang account.
        - BLOCK: hanggang i-unblock ng admin/owner
        - ALISIN ang ban/block anumang oras
      (ang ban/block ay naka-save sa Firebase /bans; kailangan ang BAGONG firestore.rules)
   2) USER: Message > Report. Pwedeng mag-report ng Bug, Problema sa bayad, Inirereklamong user, o Iba pa.
      Makikita ng Admin at Owner sa Inbox > tab na Reports (may bilang ng bago). (Firebase /reports)
   3) Ang pop-up na "Na-ban ka" ay hindi maisasara hanggang matapos ang ban; may "Tingnan ulit" at "Mag-logout".
   Ang header ng usapan ng admin ay inayos din (avatar, tindahan, Gmail, tatak, sa isang maayos na card).
   ============================================================ */
const L2=(fil,en)=>[fil,en,en,en,en];
Object.assign(D,{
wrnTag:L2(`Babala mula sa Admin`,`Warning from Admin`),
modT:L2(`Aksyon sa user`,`User actions`),
modFor:L2(`Aksyon kay {0}`,`Actions for {0}`),
modTabW:L2(`Babala`,`Warning`),modTabB:L2(`Ban`,`Ban`),modTabK:L2(`Block`,`Block`),
modWarnP:L2(`Magpadala ng babala. Lalabas ito sa phone ng user.`,`Send a warning. It will pop up on the user's phone.`),
modWarnPh:L2(`Isulat ang babala…`,`Write the warning…`),
modWarnGo:L2(`Ipadala ang babala`,`Send warning`),
modQ1:L2(`Maling paggamit ng app`,`Misuse of the app`),
modQ2:L2(`Spam o paulit-ulit na mensahe`,`Spam or repeated messages`),
modQ3:L2(`Bastos o pang-aabusong salita`,`Rude or abusive language`),
modQ4:L2(`Panloloko`,`Scamming`),
modBanP:L2(`I-ban ang account. Hindi niya magagamit ang app hanggang matapos ang oras.`,`Ban the account. They can't use the app until the time is up.`),
modDays:L2(`{0} araw`,`{0} day(s)`),
modReasonPh:L2(`Dahilan (optional)`,`Reason (optional)`),
modBanGo:L2(`I-ban`,`Ban`),
modBlockP:L2(`I-block ang account. Hindi niya magagamit ang app hanggang i-unblock mo.`,`Block the account. They can't use the app until you unblock them.`),
modBlockGo:L2(`I-block`,`Block`),
modLift:L2(`Alisin ang ban/block`,`Lift ban/block`),
modIsBan:L2(`Naka-ban hanggang {0}`,`Banned until {0}`),
modIsBlock:L2(`Naka-block`,`Blocked`),
modWarnsN:L2(`{0} babala`,`{0} warning(s)`),
modSent:L2(`Naipadala ang babala.`,`Warning sent.`),
modBanned:L2(`Na-ban si {0}.`,`{0} was banned.`),
modBlocked:L2(`Na-block si {0}.`,`{0} was blocked.`),
modLifted:L2(`Inalis ang ban/block ni {0}.`,`Lifted the ban/block on {0}.`),
modNoOwner:L2(`Hindi pwedeng i-ban ang Owner.`,`The Owner can't be banned.`),
modOwnerOnly:L2(`Owner lang ang pwedeng mag-ban ng Admin.`,`Only the Owner can ban an Admin.`),
modNoUser:L2(`Hindi pa nakikita ang user na ito sa app.`,`This user hasn't been seen in the app yet.`),
modWarnShort:L2(`Isulat muna ang babala.`,`Write the warning first.`),
wrnPopT:L2(`Babala mula sa Admin`,`Warning from Admin`),
wrnPopOk:L2(`Naiintindihan ko`,`I understand`),
banT:L2(`Na-ban ang account mo`,`Your account is banned`),
blockT:L2(`Na-block ang account mo`,`Your account is blocked`),
banUntilP:L2(`Hindi mo magagamit ang TindaMo hanggang {0}.`,`You can't use TindaMo until {0}.`),
blockP:L2(`Hindi mo magagamit ang TindaMo hangga't hindi ito inaalis ng Admin/Owner.`,`You can't use TindaMo until the Admin/Owner lifts this.`),
banReason:L2(`Dahilan: {0}`,`Reason: {0}`),
banHelp:L2(`Kung sa tingin mo ay mali ito, makipag-ugnayan sa Admin/Owner.`,`If you think this is a mistake, contact the Admin/Owner.`),
banRecheck:L2(`Tingnan ulit`,`Check again`),
banEnded:L2(`Tapos na ang ban mo. Pwede ka nang gumamit ulit.`,`Your ban is over. You can use the app again.`),
rpBtn:L2(`Report`,`Report`),
rpT:L2(`Mag-report`,`Send a report`),
rpHint:L2(`Makikita ng Admin at Owner ang report mo.`,`Admins and the Owner will see your report.`),
rpCatBug:L2(`Bug / may sira`,`Bug / something broken`),
rpCatPay:L2(`Problema sa bayad`,`Payment problem`),
rpCatUser:L2(`Inirereklamong user`,`Report a user`),
rpCatOth:L2(`Iba pa`,`Other`),
rpTargetPh:L2(`Gmail ng inirereklamo (kung alam)`,`Gmail of the user (if you know it)`),
rpTextPh:L2(`Ano ang nangyari? Isulat dito…`,`What happened? Write it here…`),
rpSend:L2(`Ipadala`,`Send`),
rpShort:L2(`Isulat muna ang report (kahit 5 letra).`,`Please write your report first (at least 5 characters).`),
rpWait:L2(`Sandali lang bago mag-report ulit.`,`Please wait a moment before reporting again.`),
rpDone:L2(`Naipadala na ang report mo. Salamat!`,`Your report was sent. Thank you!`),
rpQueued:L2(`Naka-pila ang report. Ipapadala kapag may internet.`,`Report saved. It will be sent when you're online.`),
rpTabMsg:L2(`Messages`,`Messages`),rpTabRep:L2(`Reports`,`Reports`),
rpNone:L2(`Wala pang report.`,`No reports yet.`),
rpAbout:L2(`Inirereklamo: {0}`,`About: {0}`),
rpDoneBtn:L2(`Tapos na`,`Done`),rpReopen:L2(`Ibalik`,`Reopen`),
rpMsgBtn:L2(`Message`,`Message`),rpActBtn:L2(`Aksyon`,`Action`),
rpNewToast:L2(`May bagong report`,`New report`),
rpDel:L2(`Burahin`,`Delete`)
});
I.flag=ic('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>');

/* =============== KALASAG: ADMIN AKSYON (warning / ban / block) =============== */
const K_BAN=u=>'tindamo:ban:'+u;
const MD={st:{},ui:null,busy:false};
const banId=e=>encodeURIComponent(canonEmail(e));
const banActive=b=>!!b&&(b.until===0||b.until>Date.now());
// Para saan: kunin sa cloud ang ban/block ng isang email (admin)
async function modLoad(email){
  if(!email||!ibCan())return;
  const k=canonEmail(email);
  try{
    const d=await clDb('/bans/'+banId(email)),f=d.fields||{};
    MD.st[k]={kind:fv(f,'kind')||'ban',until:fv(f,'until')||0,reason:fv(f,'reason')||''};
  }catch(e){if(e&&(e.status===404||e.code==='NOT_FOUND'))MD.st[k]=null}
}
const modStat=email=>{const b=MD.st[canonEmail(email||'')];return banActive(b)?b:null};
// Para saan: mga tatak sa header ng usapan (ban/block at bilang ng babala)
function modChips(th){
  const b=modStat(th.email);let h='';
  if(b)h+='<span class="chip bad">'+esc(b.kind==='block'||!b.until?t('modIsBlock'):t('modIsBan',dstr(b.until)))+'</span>';
  if(th.warns)h+='<span class="chip warn">\u26a0 '+esc(t('modWarnsN',th.warns))+'</span>';
  return h;
}
function modHeadRefresh(){
  const c=$('.ib-who-c');if(!c||!IB.open)return;
  const th=IB.threads.find(x=>x.uid===IB.open)||IB.peek[IB.open]||{};
  c.innerHTML=ibTierChips(th.email)+modChips(th);
}
// Para saan: hanapin ang uid (para sa thread) ng isang email
async function modFindUid(email){
  const e=canonEmail(email||'');if(!e)return '';
  const x=IB.threads.find(a=>canonEmail(a.email||'')===e);if(x)return x.uid;
  try{const l=await clDb('/presence?pageSize=300');const d=(l.documents||[]).find(d=>canonEmail(fv(d.fields||{},'email')||'')===e);if(d)return idOf(d)}catch(e2){}
  return '';
}
const modInput=()=>{const u=MD.ui;if(!u)return;const w=$('#mod-wt'),r=$('#mod-br');if(w)u.wt=w.value;if(r)u.br=r.value};
// Para saan: buksan ang kahon ng Aksyon (uid ng thread, email ng user)
async function modOpen(uid,email,tab0){
  if(!ibIsAdmin()||!email)return;
  const th=IB.threads.find(x=>x.uid===uid)||IB.peek[uid]||{};
  MD.ui={u:uid||'',e:email,name:ibName(Object.assign({email},th,{email})),tab:'warn',days:2,wt:'',br:'',delAsk:false};
  if(tab0)MD.ui.tab=tab0;
  let b=$('#modbox');
  if(!b){b=document.createElement('div');b.id='modbox';b.className='verbox xbox';b.setAttribute('role','dialog');document.body.appendChild(b)}
  modDraw();
  await modLoad(email);modDraw();
}
function modDraw(){
  const b=$('#modbox'),u=MD.ui;if(!b||!u)return;
  const st=modStat(u.e),tabs=[['warn','modTabW'],['ban','modTabB'],['block','modTabK']].concat(ibIsOwner()?[['del','modTabD']]:[]);   // V1.2.1: Dev lang ang may Burahin
  let body='';
  if(u.tab==='warn'){
    body='<p class="hint" style="margin:0 0 8px">'+esc(t('modWarnP'))+'</p>'+
      '<div class="cats mod-q" role="group">'+[1,2,3,4].map(i=>'<button class="cat" data-act="mod-quick" data-i="'+i+'">'+esc(t('modQ'+i))+'</button>').join('')+'</div>'+
      '<textarea class="inp" id="mod-wt" rows="3" maxlength="300" placeholder="'+esc(t('modWarnPh'))+'">'+esc(u.wt||'')+'</textarea>'+
      '<button class="btn btn-primary btn-block" style="margin-top:12px" data-act="mod-warn">'+I.flag+' '+esc(t('modWarnGo'))+'</button>';
  }else if(u.tab==='ban'){
    body='<p class="hint" style="margin:0 0 8px">'+esc(t('modBanP'))+'</p>'+
      '<div class="cats" role="group">'+[1,2,7,30].map(d=>'<button class="cat" data-act="mod-days" data-d="'+d+'" aria-pressed="'+(u.days===d)+'">'+esc(t('modDays',d))+'</button>').join('')+'</div>'+
      '<input class="inp" id="mod-br" maxlength="120" placeholder="'+esc(t('modReasonPh'))+'" value="'+esc(u.br||'')+'" autocomplete="off">'+
      '<button class="btn btn-danger btn-block" style="margin-top:12px" data-act="mod-ban">'+esc(t('modBanGo'))+' · '+esc(t('modDays',u.days))+'</button>';
  }else if(u.tab==='del'&&ibIsOwner()){
    body='<div class="ib-warn" style="margin:0 0 10px">'+esc(t('modDelP'))+'</div>'+
      '<button class="btn btn-danger btn-block" data-act="mod-del">'+I.trash+' '+esc(t(u.delAsk?'modDelSure':'modDelGo'))+'</button>'+
      (u.delAsk?'<button class="btn btn-ghost btn-block" style="margin-top:8px" data-act="mod-del-no">'+esc(t('cancel'))+'</button>':'');
  }else{
    body='<p class="hint" style="margin:0 0 8px">'+esc(t('modBlockP'))+'</p>'+
      '<input class="inp" id="mod-br" maxlength="120" placeholder="'+esc(t('modReasonPh'))+'" value="'+esc(u.br||'')+'" autocomplete="off">'+
      '<button class="btn btn-danger btn-block" style="margin-top:12px" data-act="mod-block">'+esc(t('modBlockGo'))+'</button>';
  }
  b.innerHTML='<div class="vb-card mod-card"><div class="mod-top"><div class="mod-ttl"><b>'+esc(t('modFor',u.name))+'</b><small>'+esc(u.e)+'</small></div><button class="icon-btn" data-act="mod-close" aria-label="'+esc(t('close'))+'">'+I.x+'</button></div>'+
    (st?'<div class="ib-warn mod-st"><b>'+esc(st.kind==='block'||!st.until?t('modIsBlock'):t('modIsBan',dstr(st.until)))+'</b>'+(st.reason?'<div>'+esc(t('banReason',st.reason))+'</div>':'')+'<button class="btn btn-ghost" style="margin-top:8px;min-height:38px" data-act="mod-lift">'+esc(t('modLift'))+'</button></div>':'')+
    '<div class="seg '+(tabs.length>3?'seg4':'seg3')+'" role="tablist" style="margin:4px 0 12px">'+tabs.map(x=>'<button role="tab" data-act="mod-tab" data-t="'+x[0]+'" aria-selected="'+(u.tab===x[0])+'">'+esc(t(x[1]))+'</button>').join('')+'</div>'+
    '<div class="mod-body">'+body+'</div></div>';
}
// Para saan: ipadala ang babala
async function modWarn(){
  const u=MD.ui;modInput();if(!u||MD.busy)return;
  const text=(u.wt||'').trim().slice(0,300);if(text.length<3){toast(t('modWarnShort'),{kind:'warn'});return}
  if(!ibCan())return toast(t('errNet'),{kind:'err'});
  MD.busy=true;
  try{
    const uidv=u.u||await modFindUid(u.e);
    if(!uidv){toast(t('modNoUser'),{kind:'warn'});MD.busy=false;return}
    const id=uid(),ts=Date.now(),th=IB.threads.find(x=>x.uid===uidv)||IB.peek[uidv]||{},fp=['last','lastTs','email'],ff={last:fStr('\u26a0 '+text.slice(0,80)),lastTs:fInt(ts),email:fStr(canonEmail(u.e))};
    if(th.store){fp.push('store');ff.store=fStr(th.store)}
    await clDb(':commit',{method:'POST',headers:jh,body:JSON.stringify({writes:[
      {update:{name:dbName('/threads/'+uidv+'/msgs/'+id),fields:{from:fStr('admin'),text:fStr(text),topic:fStr('warn'),ts:fInt(ts)}}},
      {update:{name:dbName('/threads/'+uidv),fields:ff},updateMask:{fieldPaths:fp},updateTransforms:[{fieldPath:'warns',increment:{integerValue:'1'}}]}
    ]})});
    const x=IB.threads.find(a=>a.uid===uidv);if(x){x.warns=(x.warns||0)+1;x.last='\u26a0 '+text.slice(0,80);x.ts=ts}
    if(IB.open===uidv){IB.convo.push({id,from:'admin',text,topic:'warn',ts});IB.convoTs=ts;IB.stick=true;ibConvoDraw();modHeadRefresh()}
    u.wt='';toast(t('modSent'),{ms:2500});sfx('success');modDraw();
  }catch(e){toast(t('errCloud',e.message||e),{kind:'err',ms:3500})}
  MD.busy=false;
}
// Para saan: i-ban (may oras) o i-block (walang hangganan)
async function modBan(kind){
  const u=MD.ui;modInput();if(!u||MD.busy)return;
  const e=canonEmail(u.e);
  if(e===canonEmail(OWNER_EMAIL))return toast(t('modNoOwner'),{kind:'warn'});
  if(!ibCan())return toast(t('errNet'),{kind:'err'});
  MD.busy=true;
  try{
    const until=kind==='ban'?Date.now()+u.days*864e5:0,reason=(u.br||'').trim().slice(0,120);
    await clDb('/bans/'+banId(e),{method:'PATCH',headers:jh,body:JSON.stringify({fields:{email:fStr(e),kind:fStr(kind),until:fInt(until),reason:fStr(reason),by:fStr(ibEmail()),ts:fInt(Date.now())}})});
    MD.st[e]={kind,until,reason};
    toast(t(kind==='ban'?'modBanned':'modBlocked',u.name),{ms:2800});sfx('success');
    modHeadRefresh();modDraw();
  }catch(x){
    // ang rules ang nagbabawal: Admin ay hindi pwedeng i-ban ng kapwa Admin (Owner lang)
    if(x&&(x.status===403||x.code==='PERMISSION_DENIED'))toast(t(ibIsOwner()?'errCloud':'modOwnerOnly',x.message||x),{kind:'warn',ms:3500});
    else toast(t('errCloud',x.message||x),{kind:'err',ms:3500});
  }
  MD.busy=false;
}
async function modLiftNow(){
  const u=MD.ui;if(!u||MD.busy||!ibCan())return;MD.busy=true;
  try{
    await clDb('/bans/'+banId(u.e),{method:'DELETE'});
    MD.st[canonEmail(u.e)]=null;toast(t('modLifted',u.name),{ms:2500});sfx('success');modHeadRefresh();modDraw();
  }catch(x){if(x&&(x.status===404||x.code==='NOT_FOUND')){MD.st[canonEmail(u.e)]=null;modHeadRefresh();modDraw()}else toast(t('errCloud',x.message||x),{kind:'err',ms:3500})}
  MD.busy=false;
}

/* =============== BABALA: pop-up sa user =============== */
function warnShow(text){
  const old=$('#warnbox');if(old)old.remove();
  const b=document.createElement('div');b.id='warnbox';b.className='verbox xbox warnbox';b.setAttribute('role','alertdialog');
  b.innerHTML='<div class="vb-card"><div class="vb-ic warn">'+I.flag+'</div><h2>'+esc(t('wrnPopT'))+'</h2><p class="warn-t">'+esc(text)+'</p>'+
    '<div class="vb-b col"><button class="btn btn-primary btn-block" data-act="warn-ok">'+esc(t('wrnPopOk'))+'</button></div></div>';
  document.body.appendChild(b);sfx('error');try{buzz(BUZZ_ERR)}catch(e){}
}

/* =============== BAN / BLOCK: harang sa user =============== */
const banWho=()=>!!S.user&&S.role!=='cashier'&&!ibIsOwner();
// Para saan: kunin sa cloud kung naka-ban ako (404 = hindi)
async function banFetch(){
  if(!banWho()||!ibCan())return;
  try{
    const d=await clDb('/bans/'+banId(ibEmail())),f=d.fields||{};
    store.set(K_BAN(S.user),JSON.stringify({kind:fv(f,'kind')||'ban',until:fv(f,'until')||0,reason:fv(f,'reason')||''}));
  }catch(e){if(e&&(e.status===404||e.code==='NOT_FOUND'))store.del(K_BAN(S.user))}
  banTick();
}
// Para saan: ipakita o alisin ang harang ayon sa naka-save (gumagana kahit offline)
function banTick(){
  const lock=$('#banlock');
  if(!banWho()){if(lock)lock.remove();return}
  const b=readJSON(K_BAN(S.user),null);
  if(banActive(b)){banLockDraw(b);return}
  if(b)store.del(K_BAN(S.user));
  if(lock){lock.remove();toast(t('banEnded'),{ms:4000});sfx('success')}
}
function banLockDraw(b){
  let el=$('#banlock');
  const perm=b.kind==='block'||!b.until;
  const html='<div class="vb-card"><div class="vb-ic warn">'+I.lock+'</div><h2>'+esc(t(perm?'blockT':'banT'))+'</h2>'+
    '<p>'+esc(perm?t('blockP'):t('banUntilP',dstr(b.until)))+'</p>'+(b.reason?'<p class="ban-r">'+esc(t('banReason',b.reason))+'</p>':'')+
    '<p class="hint">'+esc(t('banHelp'))+'</p>'+
    '<div class="vb-b col"><button class="btn btn-primary btn-block" data-act="ban-recheck">'+esc(t('banRecheck'))+'</button><button class="btn btn-ghost btn-block" data-act="ver-logout">'+esc(t('logout'))+'</button></div></div>';
  if(!el){el=document.createElement('div');el.id='banlock';el.className='verlock banlock';el.setAttribute('role','alertdialog');document.body.appendChild(el)}
  const key=(b.kind||'')+b.until+(b.reason||'');
  if(el.dataset.k!==key){el.innerHTML=html;el.dataset.k=key}
  ['#modbox','#rpbox','#relbox','#verbox'].forEach(s=>{const x=$(s);if(x)x.remove()});closeModal();
}
setTimeout(()=>{banTick();banFetch()},2500);
setInterval(banTick,15000);
setInterval(banFetch,60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)banFetch()});

/* =============== REPORTS: user -> admin/owner =============== */
const K_RP=u=>'tindamo:rpq:'+u;
const RP={ui:{cat:'bug',target:'',text:''},last:0,busy:false,list:[],newCount:0,loaded:false,at:0,busyL:false};
const RP_CATS=[['bug','rpCatBug'],['pay','rpCatPay'],['user','rpCatUser'],['oth','rpCatOth']];
function rpOpen(){
  if(S.role==='cashier'||!S.user)return;
  let b=$('#rpbox');
  if(!b){b=document.createElement('div');b.id='rpbox';b.className='verbox xbox';b.setAttribute('role','dialog');document.body.appendChild(b)}
  rpDraw();
}
function rpRead(){const c=$('#rp-text'),g=$('#rp-target');if(c)RP.ui.text=c.value;if(g)RP.ui.target=g.value}
function rpDraw(){
  const b=$('#rpbox');if(!b)return;
  b.innerHTML='<div class="vb-card mod-card"><div class="mod-top"><div class="mod-ttl"><b>'+esc(t('rpT'))+'</b><small>'+esc(t('rpHint'))+'</small></div><button class="icon-btn" data-act="rp-close" aria-label="'+esc(t('close'))+'">'+I.x+'</button></div>'+
    '<div class="cats rp-cats" role="group">'+RP_CATS.map(c=>'<button class="cat" data-act="rp-cat" data-c="'+c[0]+'" aria-pressed="'+(RP.ui.cat===c[0])+'">'+esc(t(c[1]))+'</button>').join('')+'</div>'+
    (RP.ui.cat==='user'?'<input class="inp" id="rp-target" type="email" inputmode="email" autocapitalize="off" maxlength="120" placeholder="'+esc(t('rpTargetPh'))+'" value="'+esc(RP.ui.target||'')+'" style="margin-bottom:10px" autocomplete="off">':'')+
    '<textarea class="inp" id="rp-text" rows="5" maxlength="500" placeholder="'+esc(t('rpTextPh'))+'">'+esc(RP.ui.text||'')+'</textarea>'+
    '<div class="vb-b" style="margin-top:12px"><button class="btn btn-ghost" data-act="rp-close">'+esc(t('cancel'))+'</button><button class="btn btn-primary" data-act="rp-send">'+I.flag+' '+esc(t('rpSend'))+'</button></div></div>';
}
function rpSubmit(){
  rpRead();
  const text=(RP.ui.text||'').trim().slice(0,500);
  if(text.length<5){toast(t('rpShort'),{kind:'warn'});return}
  if(Date.now()-RP.last<20000){toast(t('rpWait'),{kind:'warn'});return}
  RP.last=Date.now();
  const q=readJSON(K_RP(S.user),[]);
  if(q.length>=20)q.shift();
  const rec={id:uid(),cat:RP.ui.cat,text,ts:Date.now()};
  if(RP.ui.cat==='user'&&/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((RP.ui.target||'').trim()))rec.target=canonEmail(RP.ui.target.trim());
  q.push(rec);store.set(K_RP(S.user),JSON.stringify(q));
  RP.ui={cat:'bug',target:'',text:''};
  const b=$('#rpbox');if(b)b.remove();
  rpFlush(true);
}
// Para saan: ipadala ang mga naka-pila na report
async function rpFlush(announce){
  if(!S.user||S.role==='cashier'||RP.busy)return;
  const q=readJSON(K_RP(S.user),[]);if(!q.length)return;
  if(!ibCan()){if(announce){toast(t('rpQueued'),{ms:3000});sfx('success')}return}
  RP.busy=true;let sent=0;
  const users=readJSON(K_USERS,{}),st=(users[S.user]||{}).store||S.store||'';
  for(const r of q.slice()){
    try{
      const f={uid:fStr(CL.uid),email:fStr(ibEmail()),store:fStr(st),cat:fStr(r.cat),text:fStr(r.text),ts:fInt(r.ts),st:fStr('new'),av:fStr(APP_VER.ver)};
      if(r.target)f.target=fStr(r.target);
      await clDb('/reports/'+r.id,{method:'PATCH',headers:jh,body:JSON.stringify({fields:f})});
      const cur=readJSON(K_RP(S.user),[]).filter(x=>x.id!==r.id);store.set(K_RP(S.user),JSON.stringify(cur));sent++;
    }catch(e){break}
  }
  RP.busy=false;
  if(announce){toast(t(sent?'rpDone':'rpQueued'),{ms:3200});sfx('success')}
}
setInterval(()=>rpFlush(false),25000);

/* ---------- admin / owner: tab na Reports sa Inbox ---------- */
const rpCatName=c=>t((RP_CATS.find(x=>x[0]===c)||RP_CATS[3])[1]);
async function rpLoad(){
  if(!ibCan()||!ibIsAdmin()||RP.busyL)return;
  RP.busyL=true;
  try{
    const l=await clDb('/reports?pageSize=100'),prev=RP.newCount,had=RP.loaded;
    RP.list=(l.documents||[]).map(d=>{const f=d.fields||{};return{id:idOf(d),uid:fv(f,'uid'),email:fv(f,'email'),store:fv(f,'store'),cat:fv(f,'cat'),text:fv(f,'text'),target:fv(f,'target'),ts:fv(f,'ts')||0,st:fv(f,'st')||'new',av:fv(f,'av')}}).sort((a,b)=>b.ts-a.ts);
    RP.newCount=RP.list.filter(r=>r.st!=='done').length;RP.loaded=true;RP.at=Date.now();
    if(had&&RP.newCount>prev&&!(S.page==='message'&&IB.tab==='rep')){toast(t('rpNewToast'),{ms:3500});sfx('success');try{buzz(BUZZ_OK)}catch(e){}}
  }catch(e){}
  RP.busyL=false;ibBadge();
  if(S.page==='message'&&!IB.open&&IB.tab==='rep')rpListDraw();
  else if(S.page==='message'&&!IB.open)ibTabsRefresh();
}
const _ibUnread14=ibUnread;
ibUnread=function(){return _ibUnread14()+(S.user&&S.role!=='cashier'&&ibIsAdmin()?RP.newCount:0)};
function ibTabsHtml(){
  const nu=IB.threads.filter(x=>x.unread).length;
  return '<div class="seg ib-tabs" role="tablist"><button role="tab" data-act="ib-tab" data-t="msg" aria-selected="'+(IB.tab!=='rep')+'">'+esc(t('rpTabMsg'))+(nu?' <i class="ib-n">'+nu+'</i>':'')+'</button>'+
    '<button role="tab" data-act="ib-tab" data-t="rep" aria-selected="'+(IB.tab==='rep')+'">'+esc(t('rpTabRep'))+(RP.newCount?' <i class="ib-n">'+RP.newCount+'</i>':'')+'</button></div>';
}
function ibTabsRefresh(){const o=$('#ib-body .ib-tabs');if(o)o.outerHTML=ibTabsHtml()}
const _ibListDraw14=ibListDraw;
ibListDraw=function(){_ibListDraw14();ibTabsRefresh()};
const _ibAdminDraw14=ibAdminDraw;
ibAdminDraw=function(){
  const box=$('#ib-body');if(!box||S.page!=='message')return;
  if(IB.open||IB.tab!=='rep'){_ibAdminDraw14();if(!IB.open)box.insertAdjacentHTML('afterbegin',ibTabsHtml());return}
  box.innerHTML=ibTabsHtml()+'<div id="rp-list" class="rp-list"></div>';rpListDraw();
};
function rpListDraw(){
  const box=$('#rp-list');if(!box)return;
  ibTabsRefresh();
  if(!RP.loaded){box.innerHTML='<div class="hint" style="padding:12px 0">…</div>';return}
  box.innerHTML=RP.list.length?RP.list.map(r=>{
    const x={email:r.email,store:r.store,uid:r.uid},done=r.st==='done';
    return '<div class="rp-item'+(done?' done':'')+'"><div class="rp-h">'+ibAvatar(x)+'<div class="rp-who"><div class="rp-n"><b>'+esc(ibName(x))+'</b></div><small>'+esc(r.email)+'</small><div class="ib-tier" style="margin:4px 0 0">'+ibTierChips(r.email)+'</div></div><span class="chip '+(r.cat==='user'?'bad':'')+'">'+esc(rpCatName(r.cat))+'</span></div>'+
      (r.target?'<div class="rp-t">'+esc(t('rpAbout',r.target))+'</div>':'')+
      '<p class="rp-x">'+esc(r.text)+'</p>'+
      '<div class="rp-f"><small>'+esc(dstr(r.ts))+(done?' \u00b7 \u2713':'')+'</small><div class="rp-b">'+
        '<button class="btn btn-ghost" data-act="rp-msg" data-i="'+esc(r.id)+'">'+esc(t('rpMsgBtn'))+'</button>'+
        (r.target?'<button class="btn btn-ghost" data-act="rp-act" data-i="'+esc(r.id)+'">'+I.shield+' '+esc(t('rpActBtn'))+'</button>':'')+
        '<button class="btn '+(done?'btn-ghost':'btn-dark')+'" data-act="rp-done" data-i="'+esc(r.id)+'">'+esc(t(done?'rpReopen':'rpDoneBtn'))+'</button>'+
        '<button class="icon-btn" data-act="rp-del" data-i="'+esc(r.id)+'" aria-label="'+esc(t('rpDel'))+'">'+I.trash+'</button>'+
      '</div></div></div>'}).join('')
    :'<div class="hint" style="padding:18px 0;text-align:center">'+esc(t('rpNone'))+'</div>';
}
// Para saan: bantayan ang bagong report (admin lang)
setInterval(()=>{
  if(!S.user||S.role==='cashier'||document.hidden||!ibCan()||!ibIsAdmin())return;
  const onTab=S.page==='message'&&IB.tab==='rep'&&!IB.open;
  if(Date.now()-RP.at>(onTab?12000:50000))rpLoad();
},6000);
setTimeout(()=>{if(S.user&&S.role!=='cashier'&&ibIsAdmin())rpLoad()},7000);

/* =============== mga action =============== */
Object.assign(ACTIONS,{
  'mod-open':b=>{modOpen(b.dataset.u,b.dataset.e)},
  'mod-close':()=>{const x=$('#modbox');if(x)x.remove();MD.ui=null},
  'mod-tab':b=>{modInput();if(MD.ui){MD.ui.tab=b.dataset.t;modDraw()}},
  'mod-days':b=>{modInput();if(MD.ui){MD.ui.days=parseInt(b.dataset.d,10)||2;modDraw()}},
  'mod-quick':b=>{const w=$('#mod-wt');if(w){w.value=t('modQ'+b.dataset.i);w.focus()}},
  'mod-warn':()=>{modWarn()},
  'mod-ban':()=>{modBan('ban')},
  'mod-block':()=>{modBan('block')},
  'mod-lift':()=>{modLiftNow()},
  'warn-ok':()=>{const x=$('#warnbox');if(x)x.remove()},
  'ban-recheck':async()=>{await banFetch();if($('#banlock'))toast(t('banRecheck'),{ms:1200})},
  'rp-open':()=>{rpOpen()},
  'rp-close':()=>{rpRead();const x=$('#rpbox');if(x)x.remove()},
  'rp-cat':b=>{rpRead();RP.ui.cat=b.dataset.c;rpDraw()},
  'rp-send':()=>{rpSubmit()},
  'ib-tab':b=>{
    IB.tab=b.dataset.t==='rep'?'rep':'msg';ibAdminDraw();
    if(IB.tab==='rep'){RP.at=0;rpLoad();vipLoadAll().then(()=>{if(IB.tab==='rep'&&!IB.open)rpListDraw()})}
  },
  'rp-msg':b=>{
    const r=RP.list.find(x=>x.id===b.dataset.i);if(!r||!r.uid)return;
    IB.peek[r.uid]={uid:r.uid,email:r.email,store:r.store};ibOpenThread(r.uid);
  },
  'rp-act':async b=>{
    const r=RP.list.find(x=>x.id===b.dataset.i);if(!r||!r.target)return;
    const uidv=await modFindUid(r.target);
    if(uidv&&!IB.threads.some(x=>x.uid===uidv))IB.peek[uidv]=IB.peek[uidv]||{uid:uidv,email:r.target,store:''};
    modOpen(uidv,r.target);
  },
  'rp-done':async b=>{
    const r=RP.list.find(x=>x.id===b.dataset.i);if(!r||!ibCan())return;
    const nv=r.st==='done'?'new':'done';
    try{await clDb('/reports/'+r.id+'?updateMask.fieldPaths=st',{method:'PATCH',headers:jh,body:JSON.stringify({fields:{st:fStr(nv)}})});r.st=nv;RP.newCount=RP.list.filter(x=>x.st!=='done').length;ibBadge();rpListDraw()}
    catch(e){toast(t('errCloud',e.message||e),{kind:'err',ms:3500})}
  },
  'rp-del':async b=>{
    const r=RP.list.find(x=>x.id===b.dataset.i);if(!r||!ibCan())return;
    try{await clDb('/reports/'+r.id,{method:'DELETE'});RP.list=RP.list.filter(x=>x.id!==r.id);RP.newCount=RP.list.filter(x=>x.st!=='done').length;ibBadge();rpListDraw()}
    catch(e){toast(t('errCloud',e.message||e),{kind:'err',ms:3500})}
  }
});

/* ################################################################
   DATING V1.1.8  (isinama na sa v1.0.0)
   ################################################################ */
/* ============================================================
   ITO PARA SA MGA BAGO SA V1.1.8   [versions/v1.1.8.js]
   1) KEYBOARD: kapag pinindot ang Enter / Search sa keyboard habang naghahanap (Sell, Inventory, Utang,
      Inbox, Admin), kusang nagsasara ang keyboard dahil tapos na ang paghahanap.
   2) GCASH LOAD: sa Load, kailangang pumili muna ng SIM (GLOBE, SMART, DITO, TNT, TM, GOMO, SUN, Iba pa).
      Naka-save sa kasaysayan at nasa resibo. (ang code ay nasa v1.1.3.js: gcNetField)
   3) BENTA: hindi na lahat nakabunton. May mga button sa itaas (Buod, Top Seller, Category, Utang, Insights,
      Kasaysayan); pindutin ang gusto mong makita. (ang code ay nasa sales.js)
   ============================================================ */
const L3=(fil,en)=>[fil,en,en,en,en];
Object.assign(D,{
gcNet:L3(`SIM / Network`,`SIM / Network`),
saTabMain:L3(`Buod`,`Overview`),
saTabTop:L3(`Top Seller`,`Top Seller`),
saTabCat:L3(`Category`,`Category`),
saTabDebt:L3(`Utang`,`Debt`),
saTabIns:L3(`Insights`,`Insights`),
saTabLog:L3(`Kasaysayan`,`History`),
saNoCatYet:L3(`Wala pang category sa mga naibenta. Maglagay ng category sa item para lumabas dito.`,`No categories on the sold items yet. Add a category to an item to see it here.`)
});

/* ---------- keyboard: magsara pagkatapos mag-search ---------- */
// Para saan: Enter / Search sa keyboard = tapos na ang paghahanap, isara ang keyboard
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'||e.isComposing)return;
  const el=e.target;
  if(!el||el.tagName!=='INPUT')return;
  const isSearch=el.type==='search'||el.getAttribute('enterkeyhint')==='search';
  if(!isSearch)return;
  setTimeout(()=>{if(document.activeElement===el)el.blur()},0);   // pagkatapos ng sarili nitong handler (hal. barcode)
});
// Para saan: tiyakin na "Search" ang nakalagay sa Enter key ng lahat ng search box
document.addEventListener('focusin',e=>{
  const el=e.target;
  if(el&&el.tagName==='INPUT'&&el.type==='search'&&!el.getAttribute('enterkeyhint'))el.setAttribute('enterkeyhint','search');
});

/* ################################################################
   DATING V1.1.9  (isinama na sa v1.0.0)
   ################################################################ */
/* ============================================================
   ITO PARA SA MGA BAGO SA V1.1.9   [versions/v1.1.9.js]
   1) BENTA: ang hanay ng button (Buod, Top Seller...) ay hindi na bumabalik sa simula kapag pinindot ang nasa dulo.
      (ang code ay nasa sales.js)
   2) DELETE ACCOUNT (user): ang error na "CREDENTIAL_TOO_OLD_LOGIN_AGAIN" ay naayos. Hihingi ang app ng password
      (o Google login ulit) para makumpirma, saka mabubura ang account. (ang code ay nasa cloud.js: clDeleteAuth)
   3) ADMIN: pwede nang burahin ang account ng user. Aksyon (kalasag) > Burahin, o sa Admin page > User > Burahin.
      Binubura ang online data, usapan, VIP at ban niya; naglalagay ng tatak sa /deleted. Pagbukas ng app ng user,
      kusang mabubura ang account sa phone niya at makikita ang abiso. Kailangan ang BAGONG firestore.rules.
      PAALALA: hindi kayang burahin ng app ang login (Firebase Auth) ng ibang tao; gawin iyon sa Firebase Console > Authentication
      kung gusto mong malaya ulit ang email. Kahit hindi, mawawalan siya ng lahat ng data at magsisimula ulit.
   ============================================================ */
Object.assign(D,{
modTabD:L2(`Burahin`,`Delete`),
modDelP:L2(`Buburahin ang account ng user: lahat ng online data (items, benta, utang), usapan, VIP at ban. Pagbukas niya ng app, mabubura rin ang account sa phone niya. Hindi na ito maibabalik.`,`This deletes the user's account: all online data (items, sales, debts), chat, VIP and ban. When they open the app, the account on their phone is deleted too. This can't be undone.`),
modDelGo:L2(`Burahin ang account`,`Delete account`),
modDelSure:L2(`Oo, burahin na`,`Yes, delete now`),
modDeleted:L2(`Nabura ang account ni {0}`,`{0}'s account was deleted`),
delByAdmin:L2(`Binura ng Admin ang account mo. Pwede kang gumawa ng bago.`,`Your account was deleted by an Admin. You can create a new one.`),
reauthT:L2(`Kumpirmahin ang password`,`Confirm your password`),
reauthP:L2(`Para sa seguridad, ilagay ulit ang password mo para mabura ang account.`,`For security, enter your password again to delete the account.`),
reauthGo:L2(`Burahin ang account`,`Delete account`)
});

/* ---------- ADMIN: burahin ang account ng user ---------- */
async function modDelete(){
  const u=MD.ui;if(!u||MD.busy)return;
  const e=canonEmail(u.e);
  if(e===canonEmail(OWNER_EMAIL))return toast(t('modNoOwner'),{kind:'warn'});
  if(!ibCan())return toast(t('errNet'),{kind:'err'});
  if(!u.delAsk){u.delAsk=true;modDraw();return}        // pangalawang pindot = kumpirmado
  MD.busy=true;
  try{
    const uidv=u.u||await modFindUid(u.e);
    // 1) tatak muna (rules ang nagbabantay: Owner lang ang makakabura sa Admin)
    await clDb('/deleted/'+banId(e),{method:'PATCH',headers:jh,body:JSON.stringify({fields:{email:fStr(e),by:fStr(ibEmail()),ts:fInt(Date.now())}})});
    // 2) burahin ang data
    const nf=x=>x&&(x.status===404||x.code==='NOT_FOUND');
    const writes=[];
    if(uidv){
      const parts=await clDb('/users/'+uidv+'/parts?pageSize=300').catch(x=>{if(nf(x))return{};throw x});
      const msgs=await clDb('/threads/'+uidv+'/msgs?pageSize=300').catch(x=>{if(nf(x))return{};throw x});
      (parts.documents||[]).concat(msgs.documents||[]).forEach(d=>writes.push({delete:d.name}));
      ['/users/'+uidv,'/presence/'+uidv,'/threads/'+uidv,'/avatars/'+uidv].forEach(p=>writes.push({delete:dbName(p)}));
    }
    ['/vips/'+encodeURIComponent(e),'/bans/'+banId(e)].forEach(p=>writes.push({delete:dbName(p)}));
    for(let i=0;i<writes.length;i+=400)await clDb(':commit',{method:'POST',headers:jh,body:JSON.stringify({writes:writes.slice(i,i+400)})});
    // 3) alisin sa mga listahan
    if(uidv){IB.threads=IB.threads.filter(x=>x.uid!==uidv);if(IB.open===uidv)IB.open=null}
    AD.users=AD.users.filter(x=>canonEmail(x.email||'')!==e);
    const nm=u.name;MD.ui=null;const bx=$('#modbox');if(bx)bx.remove();
    toast(t('modDeleted',nm),{ms:3200});sfx('success');
    if(S.page==='admin')adDraw();else if(S.page==='message'){try{ibAdminDraw()}catch(x){}}
  }catch(x){
    if(x&&(x.status===403||x.code==='PERMISSION_DENIED'))toast(t(ibIsOwner()?'errCloud':'modOwnerOnly',x.message||x),{kind:'warn',ms:3500});
    else toast(t('errCloud',x.message||x),{kind:'err',ms:3500});
    if(MD.ui){MD.ui.delAsk=false;modDraw()}
  }
  MD.busy=false;
}

/* ---------- USER: binura ng Admin ang account ko ---------- */
async function delFetch(){
  if(!banWho()||!ibCan()||delFetch.busy)return;
  delFetch.busy=true;
  try{
    const path='/deleted/'+banId(ibEmail());
    try{await clDb(path)}catch(e){delFetch.busy=false;return}     // 404 = hindi binura
    const u=S.user;
    try{await clDeleteAll(true)}catch(e){}                        // siguraduhing walang naiwang data
    try{await clDb(path,{method:'DELETE'})}catch(e){}             // tapos na ang tatak
    try{const tk=await clToken();await clAuthCall('delete',{idToken:tk})}catch(e){}   // subukan; kung "too old", ayos lang
    clForget(u);delLocalAcct(u);
    ['#warnbox','#banlock','#modbox','#rpbox'].forEach(s=>{const x=$(s);if(x)x.remove()});
    S.user=null;S.role='owner';S.authMode='in';closeScanner();closeModal();showAuth();
    toast(t('delByAdmin'),{kind:'err',ms:8000});sfx('error');
  }catch(e){}
  delFetch.busy=false;
}
setTimeout(delFetch,4000);
setInterval(delFetch,60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)delFetch()});

Object.assign(ACTIONS,{
  'mod-del':()=>{modDelete()},
  'mod-del-no':()=>{if(MD.ui){MD.ui.delAsk=false;modDraw()}},
  'ad-deluser':b=>{modOpen(b.dataset.u,b.dataset.e,'del')}
});

/* ################################################################
   DATING V1.2.0  (isinama na sa v1.0.0)
   ################################################################ */
/* ============================================================
   ITO PARA SA MGA BAGO SA V1.2.0   [versions/v1.2.0.js]
   PINAKAMABABANG VERSION (minimum): kapag mas mababa ang version ng app kaysa sa "min" na nasa version.json
   (sa GitHub, main branch), hindi na magagamit ang app. May harang na screen na hindi maisasara:
   "Masyadong mababa ang version mo. Mag-update muna." Hanggang hindi nag-a-update, wala siyang magagamit.
   - Gumagana sa lahat (may-ari, cashier, kahit hindi pa naka-login).
   - Naka-save ang nakitang "min" sa phone, kaya nananatili ang harang kahit offline.
   - Para ayusin ang pinakamababa: palitan ang "min" sa version.json at i-push sa GitHub. Walang "min" = walang harang.
   ============================================================ */
Object.assign(D,{
verForceT:[`Kailangan nang mag-update`,`Update required`,`업데이트가 필요해요`,`必须更新`,`更新が必要です`],
verForceP:[`Masyadong mababa ang version ng app mo ({0}). Ang pinakamababang pwede ay {1}. Hanggang hindi ka nag-a-update, hindi mo magagamit ang app.`,`Your app version ({0}) is too old. The minimum allowed is {1}. You can't use the app until you update.`,`앱 버전({0})이 너무 낮아요. 최소 {1} 이상이어야 해요. 업데이트하기 전에는 앱을 사용할 수 없어요.`,`你的应用版本（{0}）过低，最低要求 {1}。更新之前无法使用。`,`アプリのバージョン（{0}）が古すぎます。最低 {1} が必要です。更新するまで使えません。`],
verForceMin:[`Pinakamababa`,`Minimum`,`최소`,`最低`,`最低`]
});
const K_VERMIN='tindamo:vermin';
// Para saan: ibabaw ba ang version ng app sa pinakamababa? (walang min = ayos)
const verTooLow=m=>!!m&&verCmp(APP_VER.ver,m)<0;
// Para saan: ipakita o alisin ang harang ayon sa naka-save na "min"
function verMinTick(){
  const m=store.get(K_VERMIN)||'',old=$('#verforce');
  if(!verTooLow(m)){if(old)old.remove();return}
  let b=old;
  if(!b){b=document.createElement('div');b.id='verforce';b.className='verlock';b.setAttribute('role','alertdialog');b.style.zIndex='140';document.body.appendChild(b)}
  const key=APP_VER.ver+'>'+m;
  if(b.dataset.k!==key){
    b.dataset.k=key;
    b.innerHTML='<div class="vb-card"><div class="vb-ic warn">'+I.lock+'</div><h2>'+esc(t('verForceT'))+'</h2><p>'+esc(t('verForceP',APP_VER.ver,m))+'</p>'+
      '<div class="vb-vs"><span>'+esc(t('verYou'))+'<b>v'+esc(APP_VER.ver)+'</b></span><span>'+esc(t('verForceMin'))+'<b>v'+esc(m)+'</b></span></div>'+
      '<div class="vb-b col"><button class="btn btn-primary btn-block" data-act="ver-force">'+esc(t('verUpdate'))+'</button>'+
      '<button class="btn btn-ghost btn-block" data-act="ver-leave">'+esc(t('verLeave'))+'</button></div></div>';
  }
  ['#verbox','#modbox','#rpbox','#warnbox'].forEach(s=>{const x=$(s);if(x)x.remove()});
  try{closeModal();closeScanner()}catch(e){}
}
// Para saan: kunin sa GitHub ang "min" ng version.json
async function verMinFetch(){
  if(!navigator.onLine)return false;
  for(const u of APP_VER.raw){
    try{
      const j=await verGet(u+(u.includes('?')?'&':'?')+'t='+Date.now());
      if(j&&typeof j==='object'){
        const m=j.min?String(j.min):'';
        if(m)store.set(K_VERMIN,m);else store.del(K_VERMIN);
        verMinTick();return true;
      }
    }catch(e){}
  }
  return false;
}
verMinTick();                                           // agad pagbukas (gumagana kahit offline kung may naka-save na)
setTimeout(verMinFetch,1500);
setInterval(verMinFetch,30*60*1000);
window.addEventListener('online',verMinFetch);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)verMinFetch()});
setInterval(verMinTick,10000);

Object.assign(ACTIONS,{
  'ver-force':async()=>{
    if(!APP_VER.latest){APP_VER.checkedAt=0;await verCheck(false)}
    if(!APP_VER.latest){toast(t('verFail'),{kind:'err'});return}
    ACTIONS['ver-update']();
  },
  // V1.2.1: Leave = lumabas sa app (Android: isara; sa browser: subukang isara ang tab)
  'ver-leave':()=>{
    try{const A=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.App;if(A&&A.exitApp){A.exitApp();return}}catch(e){}
    try{window.close()}catch(e){}
  }
});

/* ################################################################
   DATING V1.2.1  (isinama na sa v1.0.0)
   ################################################################ */
/* ============================================================
   ITO PARA SA MGA BAGO SA V1.2.1   [versions/v1.2.1.js]
   1) ADMIN > User: bagong ayos na listahan (profile pic sa gilid, Gmail sa tabi, pangalan ng tindahan sa baba).
      Pindutin ang user = lalabas ang Babala / Ban / Block / VIP / Mensahe. Wala na ang Aksyon sa loob ng Message.
      Ang Admin ay hindi na pwedeng mag-delete ng account o mag-reset ng password: Dev (Owner) lang.
   2) Pinakamababang version: Leave o Update lang (walang Later). (nasa v1.2.0.js)
   3) VIP: pwedeng palitan ng Admin ang presyo (Admin > User, sa taas). Naka-save sa cloud (/config/vip).
   4) SYNC: bagong page (menu > Sync). I-sync ngayon, auto-sync, at ang file sync kapag walang internet.
   5) PROFILE PHOTO: Profile > pindutin ang bilog > Kunan / Gallery / Alisin. Nakikita ng admin sa listahan at chat.
   6) MESSAGE: larawan (camera o gallery), long-press = Reply / Copy / Edit / React, swipe = Reply
      (swipe pakanan sa mensahe mo, pakaliwa sa mensahe ng kausap).
   ============================================================ */
Object.assign(D,{
imgT:L2(`Larawan`,`Photo`),
attCam:L2(`Kunan ng litrato`,`Take a photo`),
attGal:L2(`Pumili sa gallery`,`Choose from gallery`),
imgBad:L2(`Hindi mabasa ang larawan. Subukan ulit.`,`Couldn't read the photo. Try again.`),
imgGone:L2(`Larawan (na-clear na sa phone)`,`Photo (cleared from this phone)`),
imgLabel:L2(`📷 Larawan`,`📷 Photo`),
ibYou:L2(`Ikaw`,`You`),
ibThem:L2(`Customer`,`Customer`),
mpReply:L2(`Reply`,`Reply`),
mpCopy:L2(`Copy`,`Copy`),
mpEdit:L2(`Edit`,`Edit`),
mpCopied:L2(`Nakopya`,`Copied`),
mpEditing:L2(`Ine-edit ang mensahe`,`Editing message`),
mpEdited:L2(`edited`,`edited`),
avT:L2(`Profile photo`,`Profile photo`),
avDel:L2(`Alisin ang litrato`,`Remove photo`),
avSaved:L2(`Na-save ang profile photo.`,`Profile photo saved.`),
vpT:L2(`Presyo ng VIP`,`VIP price`),
vpP:L2(`Ito ang presyong makikita ng mga user sa chat (Magkano? / Bibilhin ko na).`,`This is the price users see in chat (How much? / Buy now).`),
vpSave:L2(`I-save`,`Save`),
vpOk:L2(`Na-save ang presyo: ₱{0}`,`Price saved: ₱{0}`),
vpBad:L2(`Maglagay ng presyo (1 hanggang 100000).`,`Enter a price (1 to 100000).`),
syT:L2(`Sync`,`Sync`),
syNow:L2(`I-sync ngayon`,`Sync now`),
syBusy:L2(`Nagsi-sync…`,`Syncing…`),
syLast:L2(`Huling sync: {0}`,`Last sync: {0}`),
syNever:L2(`Hindi pa nasi-sync sa phone na ito.`,`Not synced on this phone yet.`),
syAuto:L2(`Auto-sync`,`Auto-sync`),
syAutoP:L2(`Kusang kinukuha ang pinakabagong data kapag may ibang phone na gumagamit ng account mo, at kusang ina-upload ang mga bago sa phone na ito.`,`Automatically fetches the newest data when another phone uses your account, and uploads new changes from this phone.`),
syOn:L2(`Naka-on`,`On`),
syOff:L2(`Naka-off`,`Off`),
syHow:L2(`Gamitin ang parehong account sa dalawang phone. Pindutin ang I-sync ngayon para magpareho ang items, benta at utang.`,`Use the same account on two phones. Tap Sync now to make items, sales and debts match.`),
syNeed:L2(`Kailangan ng internet at cloud account para mag-sync.`,`Internet and a cloud account are needed to sync.`),
syDone:L2(`Naka-sync na. Pareho na ang data sa cloud.`,`Synced. Your data matches the cloud.`),
syGot:L2(`Nakuha ang pinakabagong data mula sa cloud.`,`Got the newest data from the cloud.`),
syUp:L2(`Na-upload ang data ng phone na ito.`,`This phone's data was uploaded.`),
syFixed:L2(`Naayos ang cloud copy. Na-upload ulit nang buo ang data ng phone na ito.`,`Cloud copy repaired. This phone's data was uploaded again in full.`),
syConfT:L2(`May mas bagong data sa cloud`,`Newer data in the cloud`),
syConfP:L2(`May mas bagong data mula sa ibang phone, pero may hindi pa na-sync sa phone na ito. Alin ang gagamitin?`,`Another phone has newer data, but this phone has changes not synced yet. Which one should be used?`),
syTake:L2(`Kunin ang cloud`,`Use the cloud`),
syKeep:L2(`Gamitin ang phone na ito`,`Use this phone`),
syOffT:L2(`Walang internet?`,`No internet?`),
syOffP:L2(`Ipasa ang file sa ibang phone (Bluetooth / Quick Share). Walang madodoble na benta at utang.`,`Send a file to another phone (Bluetooth / Quick Share). No duplicate sales or debts.`),
usMsg:L2(`Mensahe`,`Message`),
usVip:L2(`Bigyan ng VIP`,`Give VIP`),
usVipX:L2(`Alisin ang VIP`,`Remove VIP`),
usAdm:L2(`Gawing Admin`,`Make Admin`),
usReset:L2(`Reset Password`,`Reset Password`),
usDev:L2(`Dev lang`,`Dev only`),
adMoreN:L2(`Ipakita pa ({0})`,`Show more ({0})`),
verLeave:L2(`Umalis`,`Leave`)
});

/* =============== MESSAGE: larawan, reply, edit, react =============== */
// Para saan: mga field na isusulat sa Firestore (ginagamit ng ibFlush)
function ibMsgFields(m){
  const f={from:fStr(m.from),text:fStr(m.text||''),topic:fStr(m.topic||''),ts:fInt(m.ts)};
  if(m.img)f.img=fStr(m.img);
  if(m.rt){f.rt=fStr(m.rt);f.rf=fStr(m.rf||'')}
  if(m.ed)f.ed=fInt(m.ed);
  if(m.rU)f.rU=fStr(m.rU);
  if(m.del)f.del=fInt(m.del);   // V1.2.3: binura ang mensahe
  return f;
}
// Para saan: HTML ng isang mensahe. view='user'|'admin' (sino ang nakakakita), mine=akin ba, label=pangalan ng kausap
function ibMsgHtml(m,mine,view,label){
  if(m.del)return '<div class="ib-m '+(mine?'me':'th')+' is-del" data-mid="'+esc(m.id)+'">'+(!mine?'<small>'+esc(label)+'</small>':'')+'<div class="ib-b"><span class="ib-del">'+I.noMsg+' '+esc(t('msgDeleted'))+'</span></div><em>'+esc(dstr(m.ts))+'</em></div>';   // V1.2.3
  const rx=[m.rU,m.rA].filter(Boolean).join(' '),warn=m.topic==='warn';
  let q='';
  if(m.rt){
    const who=(view==='user'?m.rf==='user':m.rf==='admin')?t('ibYou'):(m.rf==='bot'?t('mBot'):(view==='user'?t('mFromAdmin'):t('ibThem')));
    q='<div class="ib-rp"><b>'+esc(who)+'</b><span>'+esc(m.rt)+'</span></div>';
  }
  const img=m.img?'<img class="ib-img" data-act="ib-img" src="'+esc(m.img)+'" alt="'+esc(t('imgT'))+'" draggable="false">':(m.imgGone?'<div class="ib-img gone">'+esc(t('imgGone'))+'</div>':'');
  const st=(view==='user'&&mine)?(m.loc?'':m.sent?' ✓':' · '+t('mQueued')):'';
  return '<div class="ib-m '+(mine?'me':'th')+(warn?' warn':'')+'" data-mid="'+esc(m.id)+'">'+
    (!mine?'<small>'+(warn?'⚠ ':'')+esc(warn?t('wrnTag'):label)+'</small>':(warn?'<small>⚠ '+esc(t('wrnTag'))+'</small>':''))+
    '<div class="ib-b">'+q+img+(m.text?'<span>'+esc(m.text)+'</span>':'')+'</div>'+
    (rx?'<div class="ib-rx">'+esc(rx)+'</div>':'')+
    '<em>'+esc(dstr(m.ts))+(m.ed?' · '+esc(t('mpEdited')):'')+esc(st)+'</em></div>';
}
const ibView=()=>(S.page==='message'&&ibIsAdmin()&&IB.open)?'admin':'user';
function ibFind(id){
  const view=ibView();
  if(view==='admin')return{view,m:IB.convo.find(x=>x.id===id)};
  return{view,m:thRead().msgs.find(x=>x.id===id)};
}
const ibInput=()=>$('#ib-in')||$('#ib-rep');
// Para saan: gumawa ng pop-up na pagpipilian (nasa baba ng screen)
function popSheet(title,items,extraHtml){
  const o=$('#popsheet');if(o)o.remove();
  const b=document.createElement('div');b.id='popsheet';b.className='popsheet';b.setAttribute('role','dialog');
  b.innerHTML='<div class="ps-card"><div class="ps-t">'+esc(title)+'</div>'+(extraHtml||'')+
    items.map(x=>'<button class="ps-b'+(x[3]?' '+x[3]:'')+'" data-act="'+x[1]+'"'+(x[4]||'')+'>'+(x[2]||'')+'<span>'+esc(x[0])+'</span></button>').join('')+
    '<button class="ps-b ps-x" data-act="ps-close"><span>'+esc(t('cancel'))+'</span></button></div>';
  b.addEventListener('click',e=>{if(e.target===b||e.target.closest('button'))setTimeout(()=>{if(b.isConnected)b.remove()},0)});
  document.body.appendChild(b);
}
const psClose=()=>{const b=$('#popsheet');if(b)b.remove()};

/* ---------- larawan: kunin at paliitin ---------- */
async function imgResize(file,max,q,square){
  let bmp;
  try{bmp=await createImageBitmap(file,{imageOrientation:'from-image'})}
  catch(e){bmp=await new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=no;im.src=URL.createObjectURL(file)})}
  const w=bmp.width,h=bmp.height,c=document.createElement('canvas'),x=c.getContext('2d');
  if(square){const s=Math.min(w,h);c.width=c.height=max;x.drawImage(bmp,(w-s)/2,(h-s)/2,s,s,0,0,max,max)}
  else{const k=Math.min(1,max/Math.max(w,h));c.width=Math.max(1,Math.round(w*k));c.height=Math.max(1,Math.round(h*k));x.drawImage(bmp,0,0,c.width,c.height)}
  let out=c.toDataURL('image/jpeg',q);
  for(let qq=q;out.length>(square?24000:380000)&&qq>0.3;qq-=0.1)out=c.toDataURL('image/jpeg',qq);
  return out;
}
function imgPick(cam,max,q,square){
  return new Promise((ok,no)=>{
    const old=$('#imgpick');if(old)old.remove();
    const i=document.createElement('input');i.type='file';i.accept='image/*';i.id='imgpick';
    if(cam)i.setAttribute('capture','environment');
    i.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';
    i.onchange=async()=>{
      const f=i.files&&i.files[0];if(!f){no(new Error('CANCEL'));return}
      try{ok(await imgResize(f,max,q,square))}catch(e){toast(t('imgBad'),{kind:'err'});no(e)}
    };
    document.body.appendChild(i);i.click();
  });
}

/* ---------- pagpapadala ---------- */
const ibReplyFields=()=>IB.reply?{rt:(IB.reply.text||t('imgLabel')).slice(0,80),rf:IB.reply.from}:{};
// Para saan: bar sa taas ng typing box (sinasagot / ine-edit)
function ibBarDraw(){
  const o=$('#ib-rpb');if(o)o.remove();
  const comp=$('.ib-comp');if(!comp)return;
  if(!IB.reply&&!IB.edit)return;
  const r=IB.edit?{h:t('mpEditing'),x:IB.edit.text}:{h:t('mpReply')+' · '+IB.reply.who,x:IB.reply.text||t('imgLabel')};
  comp.insertAdjacentHTML('beforebegin','<div id="ib-rpb" class="ib-rpb"><div><b>'+esc(r.h)+'</b><span>'+esc(String(r.x).slice(0,90))+'</span></div><button class="icon-btn" data-act="ib-bar-x" aria-label="'+esc(t('cancel'))+'">'+I.x+'</button></div>');
}
ibSendFree=function(extra){
  const el=$('#ib-in');if(!el)return;
  const v=el.value.trim();
  if(IB.edit){ibEditDone(el);return}
  const img=extra&&extra.img?extra.img:'';
  if(v.length<1&&!img)return;
  el.value='';el.style.height='auto';IB.stick=true;
  if(CL.uid)ibSayTyping('user',CL.uid,false);
  const tp=IB.topic;IB.topic='';
  const ex=Object.assign({},img?{img}:{},ibReplyFields());IB.reply=null;ibBarDraw();
  ibSend(v,tp==='sug'?'sug':'',ex);
};
ibReply=async function(extra){
  const el=$('#ib-rep');if(!el)return;
  const text=el.value.trim().slice(0,500),img=extra&&extra.img?extra.img:'';
  if(IB.edit){ibEditDone(el);return}
  if((!text&&!img)||!IB.open||!ibCan())return;
  const u=IB.open,id=uid(),ts=Date.now(),rf=ibReplyFields();
  el.value='';el.style.height='auto';IB.reply=null;ibBarDraw();
  const m=Object.assign({id,from:'admin',text,ts},img?{img}:{},rf);
  IB.convo.push(m);IB.convoTs=ts;IB.stick=true;ibConvoDraw();
  try{
    await clDb(':commit',{method:'POST',headers:jh,body:JSON.stringify({writes:[
      {update:{name:dbName('/threads/'+u+'/msgs/'+id),fields:ibMsgFields(m)}},
      {update:{name:dbName('/threads/'+u),fields:{last:fStr('↩ '+(text||'📷').slice(0,80)),lastTs:fInt(ts),unreadAdmin:fInt(0),tA:fInt(0)}},updateMask:{fieldPaths:['last','lastTs','unreadAdmin','tA']}}
    ]})});
  }catch(e){toast(t('errCloud',e.message||e),{kind:'err'})}
};
// Para saan: tapusin ang pag-edit ng mensahe
function ibEditDone(el){
  const ed=IB.edit,v=el.value.trim();
  if(!ed)return;
  if(!v){toast(t('mpEditing'),{kind:'warn',ms:1500});return}
  if(v!==ed.text)msgPatch(ed.id,{text:v.slice(0,500),ed:Date.now()});
  IB.edit=null;el.value='';el.style.height='auto';ibBarDraw();
}
// Para saan: i-update ang mensahe (edit / react) sa phone at sa cloud
async function msgPatch(id,patch){
  const{view,m}=ibFind(id);if(!m)return;
  Object.assign(m,patch);
  if(view==='user'){const th=thRead(),x=th.msgs.find(a=>a.id===id);if(x){Object.assign(x,patch);thSave(th)}ibDraw()}
  else ibConvoDraw();
  if(!ibCan())return;
  if(view==='user'&&(m.loc||!m.sent))return;                   // wala pa sa cloud: isasama sa pagpapadala
  const uidv=view==='user'?CL.uid:IB.open;if(!uidv)return;
  const fields={},mask=[];
  Object.keys(patch).forEach(k=>{fields[k]=typeof patch[k]==='number'?fInt(patch[k]):fStr(patch[k]||'');mask.push(k)});
  try{
    await clDb(':commit',{method:'POST',headers:jh,body:JSON.stringify({writes:[
      {update:{name:dbName('/threads/'+uidv+'/msgs/'+id),fields},updateMask:{fieldPaths:mask}},
      {update:{name:dbName('/threads/'+uidv),fields:{rev:fInt(Date.now())}},updateMask:{fieldPaths:['rev']}}
    ]})});
  }catch(e){toast(t('errCloud',e.message||e),{kind:'err',ms:3000})}
}
function msgReplyTo(id){
  const{view,m}=ibFind(id);if(!m)return;
  const mine=view==='user'?m.from==='user':m.from==='admin';
  IB.edit=null;IB.reply={id,from:m.from,text:m.text||'',who:mine?t('ibYou'):(m.from==='bot'?t('mBot'):(view==='user'?t('mFromAdmin'):t('ibThem')))};
  ibBarDraw();const el=ibInput();if(el)el.focus();
  try{navigator.vibrate&&navigator.vibrate(10)}catch(e){}
}
function msgCopy(text){
  const done=()=>toast(t('mpCopied'),{ms:1200});
  try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(done,()=>{});return}}catch(e){}
  const a=document.createElement('textarea');a.value=text;a.style.cssText='position:fixed;left:-999px';document.body.appendChild(a);a.select();try{document.execCommand('copy');done()}catch(e){}a.remove();
}
const MSG_EMOJI=['👍','❤️','😂','😮','😢','🙏'];
function msgSheet(id){
  const{view,m}=ibFind(id);if(!m||m.del)return;
  const mine=view==='user'?m.from==='user':m.from==='admin';
  const canEdit=mine&&!!m.text&&!m.loc&&m.topic!=='warn';
  const mineKey=view==='user'?'rU':'rA',cur=m[mineKey]||'';
  const emo='<div class="mp-emo">'+MSG_EMOJI.map(e=>'<button data-act="mp-react" data-e="'+e+'" data-i="'+esc(id)+'" aria-pressed="'+(cur===e)+'">'+e+'</button>').join('')+'</div>';
  popSheet(m.text?m.text.slice(0,60):t('imgLabel'),[
    [t('mpReply'),'mp-reply','','',' data-i="'+esc(id)+'"'],
    m.text?[t('mpCopy'),'mp-copy','','',' data-i="'+esc(id)+'"']:null,
    canEdit?[t('mpEdit'),'mp-edit','','',' data-i="'+esc(id)+'"']:null,
    (mine||view==='admin')&&m.from!=='bot'&&!m.loc?[t('mpDel'),'mp-del',I.trash,'danger',' data-i="'+esc(id)+'"']:null   // V1.2.3: Delete
  ].filter(Boolean),emo);
}
// Para saan: gestures: long-press = menu, swipe = reply
const MG={t:null,el:null,x:0,y:0,dx:0,mode:'',id:'',fired:false,swallow:false};
function mgReset(){
  clearTimeout(MG.t);
  if(MG.el){const e=MG.el;e.style.transition='transform .2s';e.style.transform='';setTimeout(()=>{e.style.transition=''},220)}
  MG.el=null;MG.mode='';
}
document.addEventListener('pointerdown',e=>{
  const m=e.target.closest&&e.target.closest('#ib-chat .ib-m[data-mid]');if(!m||(e.pointerType==='mouse'&&e.button>0))return;
  MG.el=m;MG.x=e.clientX;MG.y=e.clientY;MG.dx=0;MG.fired=false;MG.mode='';MG.id=m.dataset.mid;
  clearTimeout(MG.t);
  MG.t=setTimeout(()=>{
    if(MG.el===m&&!MG.mode){MG.fired=true;MG.swallow=true;setTimeout(()=>{MG.swallow=false},900);try{navigator.vibrate&&navigator.vibrate(14)}catch(x){}msgSheet(MG.id)}
  },450);
},{passive:true});
document.addEventListener('pointermove',e=>{
  if(!MG.el||MG.fired)return;
  const dx=e.clientX-MG.x,dy=e.clientY-MG.y;
  if(!MG.mode){
    if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){MG.mode='scroll';clearTimeout(MG.t);return}
    if(Math.abs(dx)>10){MG.mode='swipe';clearTimeout(MG.t)}
  }
  if(MG.mode==='swipe'){
    const mine=MG.el.classList.contains('me'),ok=mine?dx>0:dx<0,d=ok?Math.min(72,Math.abs(dx)):0;
    MG.dx=d;MG.el.style.transform=d?'translateX('+(mine?d:-d)+'px)':'';
    MG.el.classList.toggle('sw-hit',d>=54);
  }
},{passive:true});
function mgEnd(){
  if(MG.el){MG.el.classList.remove('sw-hit');if(MG.mode==='swipe'&&MG.dx>=54&&!MG.fired)msgReplyTo(MG.id)}
  mgReset();
}
document.addEventListener('pointerup',mgEnd);
document.addEventListener('pointercancel',()=>{if(MG.el)MG.el.classList.remove('sw-hit');mgReset()});
document.addEventListener('contextmenu',e=>{if(e.target.closest&&e.target.closest('#ib-chat .ib-m'))e.preventDefault()});
document.addEventListener('click',e=>{if(MG.swallow){MG.swallow=false;e.stopPropagation();e.preventDefault()}},true);

/* ---------- mga action ng message ---------- */
async function ibSendImage(cam){
  try{
    const img=await imgPick(cam,900,0.62,false);
    if(ibView()==='admin')ibReply({img});else ibSendFree({img});
  }catch(e){}
}
Object.assign(ACTIONS,{
  'ib-att':()=>{popSheet(t('imgT'),[[t('attCam'),'att-cam',I.cam],[t('attGal'),'att-gal',I.img]])},
  'att-cam':()=>{ibSendImage(true)},
  'att-gal':()=>{ibSendImage(false)},
  'ps-close':()=>{psClose()},
  'ib-img':b=>{
    const o=document.createElement('div');o.className='lightbox';o.innerHTML='<img alt="" src="'+esc(b.getAttribute('src'))+'"><button class="icon-btn" aria-label="'+esc(t('close'))+'">'+I.x+'</button>';
    o.addEventListener('click',()=>o.remove());document.body.appendChild(o);
  },
  'ib-bar-x':()=>{IB.reply=null;if(IB.edit){IB.edit=null;const el=ibInput();if(el){el.value='';el.style.height='auto'}}ibBarDraw()},
  'mp-reply':b=>{msgReplyTo(b.dataset.i)},
  'mp-copy':b=>{const{m}=ibFind(b.dataset.i);if(m&&m.text)msgCopy(m.text)},
  'mp-edit':b=>{
    const{m}=ibFind(b.dataset.i);if(!m)return;
    IB.reply=null;IB.edit={id:m.id,text:m.text};ibBarDraw();
    const el=ibInput();if(el){el.value=m.text;el.focus();el.style.height='auto';el.style.height=Math.min(120,el.scrollHeight)+'px'}
  },
  'mp-del':b=>{
    const id=b.dataset.i,{m}=ibFind(id);if(!m||m.del)return;
    popSheet(t('mpDelQ'),[[t('mpDel'),'mp-del-yes',I.trash,'danger',' data-i="'+esc(id)+'"']],'<p class="hint ps-p">'+esc(t('mpDelP'))+'</p>');
  },
  'mp-del-yes':b=>{
    const id=b.dataset.i,{m}=ibFind(id);if(!m||m.del)return;
    if(IB.edit&&IB.edit.id===id){IB.edit=null;ibBarDraw()}
    msgPatch(id,{text:'',img:'',rt:'',del:Date.now()});sfx('success');
  },
  'mp-react':b=>{
    const{view,m}=ibFind(b.dataset.i);if(!m)return;
    const k=view==='user'?'rU':'rA',e=b.dataset.e;
    msgPatch(m.id,{[k]:m[k]===e?'':e});
  }
});

/* =============== PROFILE PHOTO =============== */
const K_PROF=u=>'tindamo:prof:'+u,K_AVP=u=>'tindamo:avpend:'+u;
const AVC={};                                         // uid -> dataURL ('' = wala)
const avMine=()=>{try{return S.user?(readJSON(K_PROF(S.user),{}).av||''):''}catch(e){return ''}};
const avTs=()=>{try{return S.user?(readJSON(K_PROF(S.user),{}).ts||0):0}catch(e){return 0}};   // V1.2.3: kailan huling binago
// Para saan: bilog na profile pic. x={uid,email,store}. Kung may litrato, ito; kung wala, kulay at unang letra.
function avHtml(x,sz){
  const n=ibName(x),d=x&&x.uid?AVC[x.uid]:'';
  if(x&&x.uid&&AVC[x.uid]===undefined)avQueue(x.uid);
  return '<span class="avatar '+(sz||'sm')+(d?' img':'')+'" data-avuid="'+esc((x&&x.uid)||'')+'" style="--h:'+hue(n)+(d?';background-image:url('+d+')':'')+'">'+(d?'':esc((n.charAt(0)||'?').toUpperCase()))+'</span>';
}
const AVQ={list:[],run:0};
function avQueue(uid){
  if(!uid||AVC[uid]!==undefined||AVQ.list.includes(uid))return;
  AVC[uid]='';                                          // para hindi maulit habang naghihintay
  AVQ.list.push(uid);avRun();
}
async function avRun(){
  if(AVQ.run>=3||!ibCan())return;
  const uid=AVQ.list.shift();if(!uid)return;
  AVQ.run++;
  try{
    const d=await clDb('/avatars/'+encodeURIComponent(uid));
    const v=fv(d.fields||{},'d')||'';AVC[uid]=v;
    if(v)document.querySelectorAll('[data-avuid="'+uid+'"]').forEach(el=>{el.classList.add('img');el.style.backgroundImage='url('+v+')';el.textContent=''});
  }catch(e){}
  AVQ.run--;avRun();
}
// Para saan: i-upload (o burahin) ang sarili kong profile photo sa cloud
async function avPush(){
  if(!S.user||S.role==='cashier'||!ibCan()||!CL.uid)return;
  const av=avMine();
  try{
    if(av)await clDb('/avatars/'+CL.uid,{method:'PATCH',headers:jh,body:JSON.stringify({fields:{d:fStr(av),ts:fInt(avTs()||Date.now()),email:fStr(ibEmail())}})});
    else await clDb('/avatars/'+CL.uid,{method:'DELETE'}).catch(e=>{if(!(e&&(e.status===404||e.code==='NOT_FOUND')))throw e});
    store.del(K_AVP(S.user));AVC[CL.uid]=av;
  }catch(e){store.set(K_AVP(S.user),'1')}
}
// Para saan: pag-login / bagong phone: kunin ang profile photo mula sa cloud (V1.2.3: kunin din kapag mas bago ang nasa cloud)
async function avBoot(){
  if(!S.user||S.role==='cashier'||!ibCan()||!CL.uid)return;
  if(store.get(K_AVP(S.user))==='1'){await avPush();return}         // may hindi pa naa-upload na bago: ito muna
  try{
    const d=await clDb('/avatars/'+CL.uid).catch(e=>{if(e&&(e.status===404||e.code==='NOT_FOUND'))return null;throw e});
    const mine=avMine();
    if(!d){if(mine&&avTs()===0)avPush();return}                       // wala sa cloud pero meron sa phone: i-upload
    const f=d.fields||{},v=fv(f,'d')||'',cts=fv(f,'ts')||0;
    if(v&&(!mine||cts>avTs())&&v!==mine){
      store.set(K_PROF(S.user),JSON.stringify({av:v,ts:cts||Date.now()}));AVC[CL.uid]=v;
      if(S.page==='profile')openProfile();
    }
  }catch(e){}
}
setTimeout(avBoot,5000);setInterval(()=>{if(S.user&&store.get(K_AVP(S.user))==='1')avPush()},60000);
function avSet(v){
  if(!S.user)return;
  store.set(K_PROF(S.user),JSON.stringify({av:v||'',ts:Date.now()}));
  store.set(K_AVP(S.user),'1');avPush();
  if(S.page==='profile')openProfile();
  if(v)toast(t('avSaved'),{ms:1800});
}
const avMineHtml=()=>{
  const a=avMine(),n=S.store||'?';
  return '<button class="av-edit" data-act="av-edit" aria-label="'+esc(t('avT'))+'"><span class="avatar'+(a?' img':'')+'" style="--h:'+hue(S.store)+(a?';background-image:url('+a+')':'')+'">'+(a?'':esc(n.charAt(0).toUpperCase()))+'</span><i>'+I.cam+'</i></button>';
};
// V1.2.3: pumili ng larawan, i-crop nang BILOG (i-drag at i-zoom), tapos i-save (nasa v1.2.3.js ang crop)
async function avPick(cam){try{const f=await imgFilePick(cam,'user');const v=await avCrop(f);avSet(v)}catch(e){}}
Object.assign(ACTIONS,{
  'av-edit':()=>{popSheet(t('avT'),[[t('attCam'),'av-cam',I.cam],[t('attGal'),'av-gal',I.img]].concat(avMine()?[[t('avDel'),'av-del',I.trash,'danger']]:[]))},
  'av-cam':()=>{avPick(true)},
  'av-gal':()=>{avPick(false)},
  'av-del':()=>{avSet('')}
});
const _cda=clDeleteAll;
clDeleteAll=async function(skip){try{if(CL.uid)await clDb('/avatars/'+CL.uid,{method:'DELETE'})}catch(e){}return _cda(skip)};

/* =============== ADMIN > USER =============== */
AD.lim=20;
function adListDraw(){
  const box=$('#ad-list');if(!box)return;
  const q=AD.q.trim().toLowerCase();
  const list=AD.users.filter(u=>(AD.f==='all'||(AD.f==='on'?u.on:!u.on))&&(!q||(u.email||'').toLowerCase().includes(q)||(u.store||'').toLowerCase().includes(q)||u.uid.toLowerCase().includes(q)));
  const shown=list.slice(0,AD.lim);
  box.innerHTML=shown.length?shown.map(u=>
    '<button class="au-row" data-act="ad-user" data-u="'+esc(u.uid)+'" data-e="'+esc(u.email||'')+'">'+
      avHtml(u,'lg')+
      '<span class="au-t"><b>'+esc(u.email||u.uid)+'</b><small>'+esc(u.store||'—')+'</small>'+
      '<span class="au-s"><i class="au-dot'+(u.on?' on':'')+'"></i><em>'+esc(u.on?t('online'):t('admSeen',u.ts?dstr(u.ts):'—'))+'</em><span class="au-c">'+ibTierChips(u.email)+'</span></span></span></button>').join('')+
    (list.length>shown.length?'<button class="btn btn-ghost btn-block" style="margin-top:10px" data-act="ad-more">'+esc(t('adMoreN',list.length-shown.length))+'</button>':'')
  :'<div class="hint" style="padding:8px 0">'+esc(t(AD.users.length?'noItemFound':'mNoThreads'))+'</div>';
}
document.addEventListener('input',e=>{if(e.target.id==='ad-q')AD.lim=20});
// Para saan: pop-up ng isang user: Babala / Ban / Block / VIP / Mensahe (at Dev lang: Admin, Reset, Burahin)
function adUserOpen(uid,email){
  if(!ibIsAdmin())return;
  const u=AD.users.find(x=>x.uid===uid)||{uid,email,store:''},e=canonEmail(email||'');
  const isDev=e===canonEmail(OWNER_EMAIL),isAd=adEmails().has(e),dev=ibIsOwner();
  const can=email&&!isDev;
  const tiles=[];
  const tile=(k,ic,label,cls)=>tiles.push('<button class="us-t'+(cls?' '+cls:'')+'" data-act="us-do" data-k="'+k+'" data-u="'+esc(uid)+'" data-e="'+esc(email||'')+'">'+ic+'<span>'+esc(label)+'</span></button>');
  if(can&&(dev||!isAd)){tile('warn',I.flag,t('modTabW'));tile('ban',I.lock,t('modTabB'));tile('block',I.x,t('modTabK'))}
  if(can)tile('msg',I.msg,t('usMsg'));
  const has=!!(AD.vips&&AD.vips.has(e));
  if(can&&!isAd)tile('vip',I.vip,t(has?'usVipX':'usVip'));
  if(can&&dev&&!isAd)tile('promote',I.shield,t('usAdm'));
  if(can&&dev)tile('reset',I.lock,t('usReset'));
  if(can&&dev)tile('del',I.trash,t('modTabD'),'danger');
  const o=$('#usersheet');if(o)o.remove();
  const b=document.createElement('div');b.id='usersheet';b.className='popsheet';b.setAttribute('role','dialog');
  b.innerHTML='<div class="ps-card us-card"><div class="us-head">'+avHtml(u,'lg')+'<div class="us-who"><b>'+esc(email||uid)+'</b><small>'+esc(u.store||'—')+'</small><div class="us-c">'+ibTierChips(email)+'</div></div><button class="icon-btn" data-act="us-close" aria-label="'+esc(t('close'))+'">'+I.x+'</button></div>'+
    (tiles.length?'<div class="us-grid">'+tiles.join('')+'</div>':'<div class="hint" style="padding:8px 0">'+esc(isDev?t('usDev'):t('modOwnerOnly'))+'</div>')+
    (dev?'':'<div class="hint us-note">'+esc(t('usDev'))+': '+esc(t('modTabD'))+' / '+esc(t('usReset'))+'</div>')+'</div>';
  b.addEventListener('click',e2=>{if(e2.target===b)b.remove()});
  document.body.appendChild(b);
}
const usClose=()=>{const b=$('#usersheet');if(b)b.remove()};
Object.assign(ACTIONS,{
  'ad-user':b=>{adUserOpen(b.dataset.u,b.dataset.e)},
  'ad-more':()=>{AD.lim+=20;adListDraw()},
  'us-close':()=>{usClose()},
  'us-do':async b=>{
    const k=b.dataset.k,uid=b.dataset.u,email=b.dataset.e;
    if(k==='vip'){const has=!!(AD.vips&&AD.vips.has(canonEmail(email)));await vipSet(email,!has);adUserOpen(uid,email);adListDraw();return}
    usClose();
    if(k==='msg'){
      closeModal();openMessage();
      setTimeout(()=>{IB.peek[uid]=IB.peek[uid]||{uid,email,store:(AD.users.find(x=>x.uid===uid)||{}).store||''};ibOpenThread(uid)},250);return;
    }
    if(k==='promote'){ACTIONS['ad-promote']({dataset:{e:email}});return}
    if(k==='reset'){ACTIONS['ad-reset']({dataset:{e:email}});return}
    modOpen(uid,email,k);
  }
});
// Dev lang ang pwedeng magbura (nasa v14 ang tabs; dito ang harang)
const _modDelete=modDelete;
modDelete=function(){if(!ibIsOwner()){toast(t('modOwnerOnly'),{kind:'warn'});return}return _modDelete()};

/* =============== VIP: custom na presyo =============== */
async function vipPriceFetch(){
  if(!S.user||!ibCan())return;
  try{
    const d=await clDb('/config/vip'),n=parseInt(fv(d.fields||{},'price'),10);
    if(n>0&&n!==VIP_PRICE){VIP_PRICE=n;store.set('tindamo:vipprice',String(n));const c=$('#ad-vp input');if(c&&document.activeElement!==c)c.value=n}
  }catch(e){}
}
setTimeout(vipPriceFetch,4500);setInterval(vipPriceFetch,5*60*1000);
const _adDraw=adDraw;
adDraw=function(){
  _adDraw();
  const b=$('#ad-body');if(!b||AD.tab!=='user'||S.page!=='admin')return;
  b.insertAdjacentHTML('afterbegin','<div class="vp-bar" id="ad-vp"><span class="vp-l">'+I.vip+'<b>'+esc(t('vpT'))+'</b></span><span class="vp-p">₱</span><input class="inp" id="vp-in" type="number" inputmode="numeric" min="1" max="100000" value="'+VIP_PRICE+'" aria-label="'+esc(t('vpT'))+'"><button class="btn btn-dark" data-act="vp-save">'+esc(t('vpSave'))+'</button></div>');
};
Object.assign(ACTIONS,{
  'vp-save':async()=>{
    const el=$('#vp-in'),n=parseInt(el?el.value:'',10);
    if(!(n>=1&&n<=100000)){toast(t('vpBad'),{kind:'warn'});return}
    if(!ibCan()||!ibIsAdmin())return toast(t('errNet'),{kind:'err'});
    try{
      await clDb('/config/vip',{method:'PATCH',headers:jh,body:JSON.stringify({fields:{price:fInt(n),ts:fInt(Date.now()),by:fStr(ibEmail())}})});
      VIP_PRICE=n;store.set('tindamo:vipprice',String(n));toast(t('vpOk',n),{ms:2500});sfx('success');
    }catch(e){toast(t('errCloud',e.message||e),{kind:'err',ms:3500})}
  }
});

/* =============== SYNC =============== */
const K_LASTSYNC=u=>'tindamo:lastsync:'+u;
const SY={busy:false,msg:''};
const syLast=()=>S.user?(parseInt(store.get(K_LASTSYNC(S.user)),10)||0):0;
const syOk=()=>clOn()&&!!CL.uid&&S.role!=='cashier'&&!!S.user&&clRestore(S.user)&&navigator.onLine;
function syDraw(){
  if(S.page!=='sync'||!$('#sy-box'))return;
  const last=Math.max(syLast(),CL.state==='ok'&&CL.ts?CL.ts:0),auto=prefs.autoSync!==false;
  $('#sy-box').innerHTML=
    '<div class="sy-hero"><span class="sy-ic'+(SY.busy?' spin':'')+'">'+I.cloud+'</span><div><b>'+esc(SY.busy?t('syBusy'):(last?t('syLast',tFmt(last)):t('syNever')))+'</b><small>'+esc(ibEmail()||'')+'</small></div></div>'+
    (syOk()?'':'<div class="hint" style="margin:8px 0">'+esc(t('syNeed'))+'</div>')+
    '<button class="btn btn-primary btn-block" data-act="sy-now"'+(SY.busy?' disabled':'')+'>'+I.cloud+' '+esc(t('syNow'))+'</button>'+
    '<div class="sy-row"><div><b>'+esc(t('syAuto'))+'</b><div class="hint">'+esc(t('syAutoP'))+'</div></div><button class="btn '+(auto?'btn-dark':'btn-ghost')+'" data-act="sy-auto" style="min-height:38px">'+esc(t(auto?'syOn':'syOff'))+'</button></div>'+
    '<div class="hint" style="margin:10px 2px">'+esc(t('syHow'))+'</div>';
}
function openSync(){
  S.page='sync';
  openModal(pgHead(t('syT'))+'<div id="sy-box"></div>'+
    '<div class="set-sec"><span class="lbl">'+esc(t('syOffT'))+'</span><div class="hint" style="margin-bottom:8px">'+esc(t('syOffP'))+'</div><div class="stack"><button class="btn btn-ghost btn-block" data-act="sync-send">'+esc(t('syncSend'))+'</button><button class="btn btn-ghost btn-block" data-act="sync-get">'+esc(t('syncGet'))+'</button></div></div>');
  syDraw();
}
// Para saan: i-sync. manual=true: galing sa button (may tanong kung may conflict at may abiso)
async function syncNow(manual){
  if(SY.busy)return;
  if(!syOk()){if(manual)toast(t('syNeed'),{kind:'warn'});return}
  const modalOpen=$('#modal').classList.contains('open')&&S.page!=='sync';
  SY.busy=true;syDraw();
  let res='';
  try{
    if(CL.busy)await CL.busy;
    const doc=await syPull();
    if(doc==='repair'){CL.dirty=true;await clPush();if(CL.state==='err')throw new Error(CL.err);res='fix'}
    else if(!doc){CL.dirty=true;await clPush();res='up'}
    else if(doc.ts>(S.ts||0)+1000){
      const dirty=!!(CL.dirty||S.cart.length);
      if(dirty&&manual){SY.busy=false;syDraw();syConflict(doc);return}
      if(!dirty&&(manual||!modalOpen)){
        closeModal();
        await clApplyLocal(S.user,doc,null);
        loadUser(store.get(K_SESSION));showApp();CL.state='ok';CL.ts=Date.now();
        res='got';
      }
    }else if((S.ts||0)>doc.ts+1000){CL.dirty=true;await clPush();res='up'}
    else res='same';
    store.set(K_LASTSYNC(S.user),String(Date.now()));
  }catch(e){if(manual)toast(t('errCloud',e.message||e),{kind:'err',ms:3500})}
  SY.busy=false;
  if(res==='got'&&manual){openSync()}
  syDraw();
  if(manual&&res)toast(t(res==='got'?'syGot':res==='up'?'syUp':res==='fix'?'syFixed':'syDone'),{ms:2600});
}
// V1.2.2: kunin ang cloud copy. Kung "INCOMPLETE" (naputol ang nakaraang upload o sabay na nag-upload ang dalawang phone),
// subukan ulit ng 3 beses; kung hindi pa rin, ibalik "repair" para ayusin ng phone na ito (i-upload ulit nang buo).
async function syPull(){
  for(let i=0;i<4;i++){
    try{return await clPull()}
    catch(e){
      if(e&&e.code==='INCOMPLETE'){if(i<3){await new Promise(r=>setTimeout(r,1500));continue}return 'repair'}
      throw e;
    }
  }
  return 'repair';
}
function syConflict(doc){
  SY.doc=doc;
  popSheet(t('syConfT'),[[t('syTake'),'sy-take',I.cloud],[t('syKeep'),'sy-keep',I.box]],'<p class="hint ps-p">'+esc(t('syConfP'))+'</p>');
}
Object.assign(ACTIONS,{
  'sy-now':()=>{syncNow(true)},
  'sy-auto':()=>{prefs.autoSync=prefs.autoSync===false;savePrefs();syDraw()},
  'sy-take':async()=>{
    const doc=SY.doc;if(!doc)return;
    try{closeModal();await clApplyLocal(S.user,doc,null);loadUser(store.get(K_SESSION));showApp();CL.dirty=false;CL.state='ok';CL.ts=Date.now();store.set(K_LASTSYNC(S.user),String(Date.now()));openSync();toast(t('syGot'),{ms:2200})}
    catch(e){toast(t('errCloud',e.message||e),{kind:'err'})}
  },
  'sy-keep':async()=>{save();CL.dirty=true;try{await clPush();store.set(K_LASTSYNC(S.user),String(Date.now()));toast(t('syUp'),{ms:2200})}catch(e){}syDraw()}
});
setInterval(()=>{if(S.user&&S.role!=='cashier'&&prefs.autoSync!==false&&!document.hidden)syncNow(false)},90000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.user&&S.role!=='cashier'&&prefs.autoSync!==false)setTimeout(()=>syncNow(false),1500)});
setInterval(()=>{if(S.page==='sync')syDraw()},3000);

/* ################################################################
   DATING V1.2.3  (isinama na sa v1.0.0)
   ################################################################ */
/* ============================================================
   ITO PARA SA MGA BAGO SA V1.2.3   [versions/v1.2.3.js]
   1) PROFILE PHOTO: pagkatapos pumili ng larawan, may BILOG na crop (i-drag at i-zoom). Pag-login ng account sa phone,
      kusang kinukuha ang profile photo mula sa cloud (at kapag mas bago ang nasa cloud). Nasa listahan ng account din.
   2) ABISO KAHIT SARADO ANG APP: background service sa Android (scripts/bgservice.mjs) na tumitingin ng bagong mensahe
      at sync request. Settings > "Abiso kahit sarado ang app" (naka-ON). Kailangan ng bagong APK build.
   3) VIP: kapag binigyan ka ng VIP (o inalis), nag-a-update agad sa app (tingin kada ~6 segundo habang bukas), walang restart.
   4) MESSAGE: Delete ng mensahe (pindutin nang matagal). Lalabas ang "Deleted Message" sa dalawang panig.
   5) SYNC GAMIT ANG CODE: Sync page > "Ilipat sa ibang account". Isulat ang Code ng account na paglilipatan (hal. XHA-JHA).
      Sa phone niya, lalabas ang abiso at pop-up na Decline / Accept. Kapag Accept, idadagdag ang items, benta at utang (walang madodoble).
      Kailangan ang bagong firestore.rules (bagong /inbox).
   ============================================================ */
Object.assign(D,{
msgDeleted:L2(`Deleted Message`,`Deleted Message`),
mpDel:L2(`Delete`,`Delete`),
mpDelQ:L2(`I-delete ang mensahe?`,`Delete this message?`),
mpDelP:L2(`Makikita ng kausap mo ang "Deleted Message" sa halip.`,`The other person will see "Deleted Message" instead.`),
avCropT:L2(`I-crop ang litrato`,`Crop your photo`),
avCropHint:L2(`I-drag para ilipat. I-zoom para palakihin.`,`Drag to move. Zoom to resize.`),
avUse:L2(`Gamitin`,`Use photo`),
xfT:L2(`Ilipat sa ibang account`,`Send to another account`),
xfP:L2(`Isulat ang Code ng account na paglilipatan ng items, benta at utang. Sa phone niya, lalabas ang Decline / Accept.`,`Enter the Code of the account that will receive your items, sales and debts. On their phone, Decline / Accept will appear.`),
xfMine:L2(`Code ng account na ito`,`This account's code`),
xfIn:L2(`Code ng paglilipatan`,`Receiver's code`),
xfGo:L2(`Ipadala`,`Send`),
xfCopy:L2(`Kopyahin`,`Copy`),
xfBadCode:L2(`Maling code. Dapat 6 na letra/numero (hal. XHA-JHA).`,`Invalid code. It should be 6 letters/numbers (e.g. XHA-JHA).`),
xfSelf:L2(`Ito ang code ng account mo. Ilagay ang code ng ibang account.`,`That is your own code. Enter another account's code.`),
xfNone:L2(`Walang account na may code na ito.`,`No account has this code.`),
xfBig:L2(`Masyadong malaki ang data para ipadala.`,`The data is too large to send.`),
xfNeed:L2(`Kailangan ng internet at cloud account.`,`Internet and a cloud account are needed.`),
xfSending:L2(`Ipinapadala…`,`Sending…`),
xfSent:L2(`Naipadala kay {0}. Hinihintay ang sagot niya.`,`Sent to {0}. Waiting for their answer.`),
xfWait:L2(`Naghihintay ng sagot ni {0}…`,`Waiting for {0} to answer…`),
xfAccepted:L2(`Tinanggap ni {0} ang data.`,`{0} accepted your data.`),
xfDeclined:L2(`Tinanggihan ni {0} ang data.`,`{0} declined your data.`),
xfNotifT:L2(`May gustong magpadala ng data`,`Someone wants to send you data`),
xfNotifB:L2(`ay gustong ilipat ang data sa account mo. Buksan ang app.`,`wants to transfer data to your account. Open the app.`),
xfAskT:L2(`Tanggapin ang data?`,`Accept the data?`),
xfAskP:L2(`Gusto ng {0} na ilipat ang items, benta at utang niya sa account mo. Idadagdag ito sa dati mong data (walang madodoble).`,`{0} wants to transfer their items, sales and debts to your account. It will be added to your existing data (no duplicates).`),
xfAccept:L2(`Accept`,`Accept`),
xfDecline:L2(`Decline`,`Decline`),
xfGetting:L2(`Kinukuha ang data…`,`Getting the data…`),
xfDone:L2(`Natanggap: {0} item, {1} benta, {2} utang.`,`Received: {0} items, {1} sales, {2} debts.`),
xfLimit:L2(`{0} item ang hindi naidagdag (abot na sa limit ng Guest).`,`{0} items were not added (Guest limit reached).`),
xfFail:L2(`Hindi nakuha ang data. Subukan ulit.`,`Couldn't get the data. Try again.`),
bgT:L2(`Abiso kahit sarado ang app`,`Notifications even when the app is closed`),
bgP:L2(`Magpapakita ng abiso sa bagong mensahe at sync request kahit hindi nakabukas ang TindaMo. May maliit na tahimik na abiso na "nakabantay".`,`Shows a notification for new messages and sync requests even if TindaMo is closed. A small silent "watching" notification stays.`),
bgBat:L2(`Huwag hayaang patayin ng battery saver`,`Don't let battery saver stop it`),
bgRunT:L2(`TindaMo`,`TindaMo`),
bgRunB:L2(`Nakabantay sa mensahe at sync`,`Watching for messages and sync`)
});
I.noMsg=ic('<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>');

/* =============== 1) PROFILE PHOTO: bilog na crop =============== */
// Para saan: pumili ng larawan (file) mula sa camera o gallery, walang pagpapaliit pa
function imgFilePick(cam,facing){
  return new Promise((ok,no)=>{
    const old=$('#imgpick');if(old)old.remove();
    const i=document.createElement('input');i.type='file';i.accept='image/*';i.id='imgpick';
    if(cam)i.setAttribute('capture',facing||'environment');
    i.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';
    i.onchange=()=>{const f=i.files&&i.files[0];i.remove();if(!f){no(new Error('CANCEL'));return}ok(f)};
    i.addEventListener('cancel',()=>{i.remove();no(new Error('CANCEL'))});
    document.body.appendChild(i);i.click();
  });
}
// Para saan: bilog na crop. Ibinabalik ang parisukat na JPEG (data URL) na ipinapakita nang bilog.
async function avCrop(file){
  let bmp;
  try{bmp=await createImageBitmap(file,{imageOrientation:'from-image'})}
  catch(e){bmp=await new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=no;im.src=URL.createObjectURL(file)}).catch(()=>null)}
  if(!bmp){toast(t('imgBad'),{kind:'err'});throw new Error('BAD')}
  const W=bmp.width,H=bmp.height,V=300,R=128,Q=2;                       // V = laki sa screen, R = radius ng bilog, Q = linaw
  return new Promise((ok,no)=>{
    const o=document.createElement('div');o.id='avcrop';o.className='avcrop';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');
    o.innerHTML='<div class="avc-top"><strong>'+esc(t('avCropT'))+'</strong></div>'+
      '<div class="avc-stage"><canvas id="avc-cv" width="'+V*Q+'" height="'+V*Q+'" style="width:'+V+'px;height:'+V+'px;touch-action:none"></canvas></div>'+
      '<div class="avc-bot"><input type="range" id="avc-z" min="1" max="4" step="0.01" value="1" aria-label="'+esc(t('zoom'))+'"><div class="hint" style="color:#cfd3dc">'+esc(t('avCropHint'))+'</div>'+
      '<div class="row"><button type="button" class="btn btn-ghost" id="avc-no" style="flex:1">'+esc(t('cancel'))+'</button><button type="button" class="btn btn-primary" id="avc-ok" style="flex:2">'+esc(t('avUse'))+'</button></div></div>';
    document.body.appendChild(o);
    const cv=o.querySelector('#avc-cv'),cx=cv.getContext('2d'),zr=o.querySelector('#avc-z');
    const base=(2*R)/Math.min(W,H);                                     // pinakamaliit na scale: sakop ang bilog
    let z=1,mx=W/2,my=H/2;                                               // z = zoom, (mx,my) = gitna ng bilog sa larawan
    const sc=()=>base*z;
    const clamp=()=>{const h=R/sc();mx=Math.min(W-h,Math.max(h,mx));my=Math.min(H-h,Math.max(h,my))};
    const draw=()=>{
      clamp();cx.setTransform(Q,0,0,Q,0,0);cx.clearRect(0,0,V,V);cx.fillStyle='#0b0d12';cx.fillRect(0,0,V,V);
      const s=sc();cx.drawImage(bmp,mx-V/2/s,my-V/2/s,V/s,V/s,0,0,V,V);
      cx.save();cx.fillStyle='rgba(8,10,14,.62)';cx.beginPath();cx.rect(0,0,V,V);cx.arc(V/2,V/2,R,0,Math.PI*2,true);cx.fill('evenodd');cx.restore();
      cx.lineWidth=2;cx.strokeStyle='rgba(255,255,255,.9)';cx.beginPath();cx.arc(V/2,V/2,R,0,Math.PI*2);cx.stroke();
    };
    draw();
    // i-drag (isang daliri) at pinch (dalawa)
    const ptr=new Map();let pd=0;
    cv.addEventListener('pointerdown',e=>{try{cv.setPointerCapture(e.pointerId)}catch(x){}ptr.set(e.pointerId,{x:e.clientX,y:e.clientY});pd=0});
    cv.addEventListener('pointermove',e=>{
      const p=ptr.get(e.pointerId);if(!p)return;
      const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
      if(ptr.size===1){mx-=dx/sc();my-=dy/sc()}
      else if(ptr.size>=2){
        const a=[...ptr.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
        if(pd){z=Math.min(4,Math.max(1,z*d/pd));zr.value=z}pd=d;
      }
      draw();
    });
    const up=e=>{ptr.delete(e.pointerId);pd=0};
    cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
    cv.addEventListener('wheel',e=>{e.preventDefault();z=Math.min(4,Math.max(1,z*(e.deltaY<0?1.08:.92)));zr.value=z;draw()},{passive:false});
    zr.addEventListener('input',()=>{z=parseFloat(zr.value)||1;draw()});
    const done=()=>{o.remove();try{bmp.close&&bmp.close()}catch(x){}};
    o.querySelector('#avc-no').onclick=()=>{done();no(new Error('CANCEL'))};
    o.querySelector('#avc-ok').onclick=()=>{
      clamp();const s=sc(),h=R/s,out=document.createElement('canvas');out.width=out.height=176;
      const c2=out.getContext('2d');c2.fillStyle='#fff';c2.fillRect(0,0,176,176);c2.drawImage(bmp,mx-h,my-h,2*h,2*h,0,0,176,176);
      let d=out.toDataURL('image/jpeg',.8);
      for(let q=.8;d.length>30000&&q>.35;q-=.1)d=out.toDataURL('image/jpeg',q);
      done();ok(d);
    };
  });
}

/* ---------- pag-login: kunin agad ang profile photo, VIP at iba pa ---------- */
const _enterV19=enter;
enter=function(u){
  _enterV19(u);
  setTimeout(()=>{try{avBoot()}catch(e){}try{vipFetch()}catch(e){}try{xfPoll()}catch(e){}bgSync()},1500);
  setTimeout(()=>{try{avBoot()}catch(e){}},6000);
};
setInterval(()=>{if(S.user&&S.role!=='cashier'&&!document.hidden)avBoot()},120000);   // kapag nagbago ang litrato sa ibang phone

/* =============== 3) VIP: agad, walang restart =============== */
setInterval(()=>{if(!document.hidden&&S.user&&S.role!=='cashier')vipFetch()},6000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(()=>{try{vipFetch();xfPoll()}catch(e){}},300)});

/* =============== 5) SYNC GAMIT ANG CODE =============== */
const K_XFOUT=u=>'tindamo:xfout:'+u;
const XF={busy:false,ask:null,seen:{},poll:false,outPoll:false};
const xfOk=()=>clOn()&&S.role!=='cashier'&&!!S.user&&ibCan();
const xfMyCode=()=>{const u=(readJSON(K_USERS,{})[S.user])||{};return u.code||''};
const xfOut=()=>S.user?readJSON(K_XFOUT(S.user),[]):[];
const xfOutSave=l=>{if(S.user)store.set(K_XFOUT(S.user),JSON.stringify(l.slice(0,10)))};
const xfBody=(m,k)=>JSON.stringify({fields:{[k]:fStr(m)}});
const xfPatch=(path,k,v)=>clDb(path+'?updateMask.fieldPaths='+k,{method:'PATCH',headers:jh,body:xfBody(v,k)});
async function xfDeleteParts(base,n){
  try{
    const l=await clDb(base+'/parts?pageSize=300').catch(()=>({}));
    const w=(l.documents||[]).map(d=>({delete:d.name}));
    for(let i=0;i<w.length;i+=20)await clDb(':commit',{method:'POST',headers:jh,body:JSON.stringify({writes:w.slice(i,i+20)})});
  }catch(e){}
}
// Para saan: ipadala ang data ng account na ito sa account na may ibinigay na code
async function xfSend(raw){
  const err=$('#xf-err'),setErr=m=>{if(err)err.textContent=m||''};
  setErr('');
  if(XF.busy)return;
  if(!xfOk()){setErr(t('xfNeed'));return}
  const code=normCode(raw);
  if(!/^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(code)){setErr(t('xfBadCode'));sfx('error');return}
  if(code===xfMyCode()){setErr(t('xfSelf'));sfx('error');return}
  XF.busy=true;const btn=$('#xf-go');if(btn){btn.disabled=true;btn.textContent=t('xfSending')}
  try{
    let d;
    try{d=await clDb('/codes/'+encodeURIComponent(code))}
    catch(e){if(e&&(e.status===404||e.code==='NOT_FOUND')){setErr(t('xfNone'));sfx('error');return}throw e}
    const f=d.fields||{},ruid=fv(f,'uid'),rname=fv(f,'s')||code;
    if(!ruid||ruid===CL.uid){setErr(t('xfSelf'));sfx('error');return}
    if(CL.busy)await CL.busy;
    const ts=Date.now(),id=uid();
    const text=JSON.stringify({app:'tindamo-xfer',v:1,ts,store:S.store,items:S.items,sales:S.sales,debts:S.debts});
    const parts=[];for(let i=0;i<text.length;i+=CHUNK)parts.push(text.slice(i,i+CHUNK));
    if(parts.length>30){setErr(t('xfBig'));sfx('error');return}
    const base='/inbox/'+ruid+'/xfer/'+id;
    await clDb(base,{method:'PATCH',headers:jh,body:JSON.stringify({fields:{fu:fStr(CL.uid),fe:fStr(ibEmail()),fs:fStr(S.store||''),ts:fInt(ts),n:fInt(parts.length),st:fStr('u')}})});
    for(let i=0;i<parts.length;i+=4){
      const writes=parts.slice(i,i+4).map((p,k)=>({update:{name:dbName(base+'/parts/'+(i+k)),fields:{i:fInt(i+k),ts:fInt(ts),d:fStr(p)}}}));
      await clDb(':commit',{method:'POST',headers:jh,body:JSON.stringify({writes})});
    }
    await xfPatch(base,'st','p');
    xfOutSave([{id,ruid,to:rname,ts}].concat(xfOut()));
    const inp=$('#xf-in');if(inp)inp.value='';
    toast(t('xfSent',rname),{ms:3500});sfx('success');xfDraw();
  }catch(e){setErr(t('errCloud',(e&&e.message)||e));sfx('error')}
  finally{XF.busy=false;const b=$('#xf-go');if(b){b.disabled=false;b.textContent=t('xfGo')}}
}
// Para saan: tingnan kung may nagpapadala ng data sa akin (lalabas ang Decline / Accept)
async function xfPoll(){
  if(XF.poll||!xfOk()||XF.ask)return;
  XF.poll=true;
  try{
    const l=await clDb('/inbox/'+CL.uid+'/xfer?pageSize=20');
    const docs=(l.documents||[]).map(d=>{const f=d.fields||{};return{id:idOf(d),st:fv(f,'st'),fs:fv(f,'fs'),fe:fv(f,'fe'),ts:fv(f,'ts')||0,n:fv(f,'n')||0}}).filter(x=>x.st==='p').sort((a,b)=>a.ts-b.ts);
    const x=docs[0];
    if(x&&!XF.ask){
      XF.ask=x;
      if(!XF.seen[x.id]){XF.seen[x.id]=1;const who=x.fs||x.fe;try{appNotify(t('xfNotifT'),who+' '+t('xfNotifB'),'xf-'+x.id)}catch(e){}sfx('success');try{buzz(BUZZ_OK)}catch(e){}}
      xfAskDraw();
    }
  }catch(e){}
  XF.poll=false;
}
// Para saan: pop-up na Decline / Accept
function xfAskDraw(){
  const x=XF.ask;const old=document.getElementById('xfbox');if(old)old.remove();if(!x)return;
  const who=x.fs||x.fe||'?';
  const b=document.createElement('div');b.id='xfbox';b.className='verbox xbox';b.setAttribute('role','dialog');b.setAttribute('aria-modal','true');
  b.innerHTML='<div class="vb-card"><div class="vip-ic">'+I.cloud+'</div><h2>'+esc(t('xfAskT'))+'</h2><p>'+esc(t('xfAskP',who))+(x.fe?'<br><small>'+esc(x.fe)+'</small>':'')+'</p>'+
    '<div class="vb-b"><button type="button" class="btn btn-ghost" id="xf-no">'+esc(t('xfDecline'))+'</button><button type="button" class="btn btn-primary" id="xf-yes">'+esc(t('xfAccept'))+'</button></div></div>';
  document.body.appendChild(b);
  b.querySelector('#xf-no').onclick=()=>xfAnswer(false);
  b.querySelector('#xf-yes').onclick=()=>xfAnswer(true);
}
// Para saan: pagdagdag ng natanggap na data (walang madodoble, ayon sa id)
function xfApply(o){
  const r={items:0,sales:0,debts:0,skipped:0};
  const hv=new Set(S.items.map(i=>i.id));
  (o.items||[]).forEach(i=>{
    if(!i||!i.id||hv.has(i.id))return;
    if(!vipUnlimited()&&S.items.length>=VIP_MAX){r.skipped++;return}
    S.items.push(i);hv.add(i.id);r.items++;
  });
  const m=syncMerge(S.sales,o.sales||[]);r.sales=m.add.length;
  {const all=m.list.sort((a,b)=>b.ts-a.ts);if(all.length>500)gcFoldSales(all.slice(500));S.sales=all.slice(0,500)}
  const d=syncMerge(S.debts,o.debts||[]);r.debts=d.add.length;S.debts=d.list.sort((a,b)=>a.ts-b.ts);
  save();S.cart=S.cart.filter(l=>byId(l.id));
  try{renderNav();renderView();checkDue();bellUpd()}catch(e){}
  return r;
}
async function xfAnswer(yes){
  const x=XF.ask;if(!x)return;
  const b=document.getElementById('xfbox'),yb=b&&b.querySelector('#xf-yes'),nb=b&&b.querySelector('#xf-no');
  if(yb){yb.disabled=true;if(yes)yb.textContent=t('xfGetting')}if(nb)nb.disabled=true;
  const base='/inbox/'+CL.uid+'/xfer/'+x.id;
  try{
    if(yes){
      const meta=await clDb(base),f=meta.fields||{};
      const payload=await shPull(base+'/parts',fv(f,'n')||0,fv(f,'ts')||0);
      if(!payload||payload.app!=='tindamo-xfer')throw new Error('BAD');
      const r=xfApply(payload);
      await xfPatch(base,'st','a');await xfDeleteParts(base);
      toast(t('xfDone',r.items,r.sales,r.debts),{sub:r.skipped?t('xfLimit',r.skipped):'',ms:4500});sfx('success');
    }else{
      await xfPatch(base,'st','d');await xfDeleteParts(base);
    }
    XF.ask=null;if(b)b.remove();
    setTimeout(xfPoll,400);                                              // may kasunod pa ba?
  }catch(e){
    if(e&&(e.status===404||e.code==='NOT_FOUND')){XF.ask=null;if(b)b.remove();toast(t('xfFail'),{kind:'warn',ms:3000});return}   // binawi na ng nagpadala
    if(yb){yb.disabled=false;yb.textContent=t('xfAccept')}if(nb)nb.disabled=false;
    toast(t('xfFail'),{kind:'err',ms:3500});
  }
}
// Para saan: sagot sa ipinadala ko (tinanggap o tinanggihan)
async function xfOutPoll(){
  if(XF.outPoll||!xfOk())return;
  const l=xfOut();if(!l.length)return;
  XF.outPoll=true;
  try{
    let keep=[],ch=false;
    for(const x of l){
      if(Date.now()-x.ts>7*864e5){clDb('/inbox/'+x.ruid+'/xfer/'+x.id,{method:'DELETE'}).catch(()=>{});ch=true;continue}
      let d=null;
      try{d=await clDb('/inbox/'+x.ruid+'/xfer/'+x.id)}catch(e){if(e&&(e.status===404||e.code==='NOT_FOUND')){ch=true;continue}keep.push(x);continue}
      const st=fv(d.fields||{},'st');
      if(st==='a'||st==='d'){
        toast(t(st==='a'?'xfAccepted':'xfDeclined',x.to),{ms:4500,kind:st==='a'?undefined:'warn'});sfx(st==='a'?'success':'error');
        clDb('/inbox/'+x.ruid+'/xfer/'+x.id,{method:'DELETE'}).catch(()=>{});ch=true;continue;
      }
      keep.push(x);
    }
    if(ch)xfOutSave(keep);
    if(ch&&S.page==='sync')xfDraw();
  }catch(e){}
  XF.outPoll=false;
}
function xfHtml(){
  const out=xfOut();
  return '<div class="set-sec" id="xf-box"><span class="lbl">'+esc(t('xfT'))+'</span><div class="hint" style="margin-bottom:8px">'+esc(t('xfP'))+'</div>'+
    '<div class="xf-mine"><small>'+esc(t('xfMine'))+'</small><b id="xf-mine">'+esc(xfMyCode()||'—')+'</b><button type="button" class="btn btn-ghost" data-act="xf-copy" style="min-height:34px;padding:0 12px;font-size:13px">'+esc(t('xfCopy'))+'</button></div>'+
    '<div class="row" style="margin-top:10px"><input class="inp" id="xf-in" placeholder="'+esc(t('xfIn'))+'" maxlength="7" autocapitalize="characters" autocomplete="off" spellcheck="false" style="text-transform:uppercase;letter-spacing:.08em"><button type="button" class="btn btn-primary" id="xf-go" data-act="xf-send">'+esc(t('xfGo'))+'</button></div>'+
    '<div class="err" id="xf-err" role="alert"></div>'+
    out.map(x=>'<div class="hint xf-wait">⏳ '+esc(t('xfWait',x.to))+'</div>').join('')+'</div>';
}
function xfDraw(){
  if(S.page!=='sync')return;
  const box=$('#xf-box'),inp=$('#xf-in'),v=inp?inp.value:'',foc=inp&&document.activeElement===inp;
  if(box)box.outerHTML=xfHtml();
  else{const sb=$('#sy-box');if(sb)sb.insertAdjacentHTML('afterend',xfHtml())}
  const n=$('#xf-in');if(n&&v){n.value=v;if(foc)n.focus()}
}
const _openSyncV19=openSync;
openSync=function(){_openSyncV19();xfDraw();xfOutPoll()};
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='xf-in'){e.preventDefault();xfSend(e.target.value)}});
document.addEventListener('input',e=>{if(e.target.id==='xf-in'){const v=e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,'');if(v!==e.target.value)e.target.value=v}});
Object.assign(ACTIONS,{
  'xf-send':()=>{const i=$('#xf-in');xfSend(i?i.value:'')},
  'xf-copy':()=>{const c=xfMyCode();if(c)msgCopy(c)}
});
setInterval(()=>{if(!document.hidden&&S.user&&S.role!=='cashier'){xfPoll();xfOutPoll()}},7000);
setTimeout(()=>{if(S.user&&S.role!=='cashier'){xfPoll();xfOutPoll()}},6000);
window.addEventListener('online',()=>setTimeout(()=>{try{xfPoll()}catch(e){}},900));

/* =============== 2) ABISO KAHIT SARADO ANG APP =============== */
const bgWanted=()=>prefs.bgNotif!==false;
// Para saan: ipasa sa Android service ang login token (para makatingin ito kahit sarado ang app)
function bgSync(){
  if(!NATIVE.on||!NATIVE.bgConfig)return;
  if(!S.user||S.role==='cashier'||!clOn()||!clRestore(S.user)||!CL.refresh||!CL.uid||!bgWanted()){if(!S.user||S.role==='cashier'||!bgWanted())NATIVE.bgStop();return}
  NATIVE.bgConfig({apiKey:CLC.apiKey,projectId:CLC.projectId,refresh:CL.refresh,uid:CL.uid,admin:!!ibIsAdmin(),
    tMsg:t('nMsgT'),tAdmin:t('nMsgAdminT'),tXfer:t('xfNotifT'),bXfer:t('xfNotifB'),tRun:t('bgRunT'),bRun:t('bgRunB')});
}
setTimeout(bgSync,7000);setInterval(bgSync,5*60*1000);
window.addEventListener('online',()=>setTimeout(bgSync,1500));
const _showAuthV19=showAuth;
showAuth=function(){if(NATIVE.on&&NATIVE.bgStop)NATIVE.bgStop();return _showAuthV19.apply(this,arguments)};   // naka-logout: ihinto ang service
// Settings: switch para sa abiso kahit sarado ang app (Android app lang)
const _openSettingsV19=openSettings;
openSettings=function(){
  _openSettingsV19();
  if(!NATIVE.on||S.role==='cashier'||!NATIVE.bgConfig)return;
  const sw=document.querySelector('[data-act="notif-toggle"]'),host=sw&&sw.closest('.set-sec');if(!host)return;
  host.insertAdjacentHTML('afterend','<div class="set-sec" id="bg-sec"><button type="button" class="switch" role="switch" aria-checked="'+bgWanted()+'" data-act="bg-toggle"><span class="st">'+esc(t('bgT'))+'</span><span class="tgl"></span></button><div class="hint" style="margin-top:6px">'+esc(t('bgP'))+'</div><div id="bg-bat"></div></div>');
  NATIVE.bgBatteryOk().then(ok=>{const b=$('#bg-bat');if(b&&!ok&&bgWanted())b.innerHTML='<button type="button" class="btn btn-ghost btn-block" data-act="bg-bat" style="margin-top:8px">'+esc(t('bgBat'))+'</button>'});
};
Object.assign(ACTIONS,{
  'bg-toggle':()=>{prefs.bgNotif=!bgWanted();savePrefs();if(bgWanted())bgSync();else NATIVE.bgStop();openSettings()},
  'bg-bat':()=>{NATIVE.bgBatterySettings()}
});

/* ################################################################
   DATING V1.2.4  (isinama na sa v1.0.0)
   ################################################################ */
/* ============================================================
   ITO PARA SA MGA BAGO SA V1.2.4   [versions/v1.2.4.js]
   1) UTANG PER ITEM NA "KULANG": pwedeng bayaran ang bahagi lang ng isang item (hal. Piattos ₱20, ₱10 lang ang bayad = Kulang ₱10).
      Ang natitira ay nakasulat na "Kulang" sa item, sa listahan ng babayaran, at sa resibo. Pwede ring kulang sa Per Resibo.
   2) CAMERA: mabilis na bukas. Naaalala ang tamang camera (isang bukas na lang), at kapag binuksan ang form ng item
      ay pinapainit na ang camera para pagpindot ng Camera, nandoon na agad.
   3) SYNC / LIPAT NG DEVICE: bagong "Kunin ang data ng ibang device" (ilagay ang Code ng lumang phone; sa lumang phone may Decline / Accept).
      May progress na nakikita kahit lumabas ka sa page (lumulutang sa taas), at "Success! Nakuha mo na ang data ng <tindahan>".
   4) MENU: Profile / Settings / Cashier / Message / GCash lang. Ang Sync ay nasa loob na ng Profile.
   5) ADMIN: bagong button na "Admin" sa baba (katabi ng Sell, Inventory, Utang, Benta) para sa Admin / Dev.
   ============================================================ */
Object.assign(D,{
kulang:L2(`Kulang`,`Remaining`),
payPaidSoFar:L2(`Bayad na {0}`,`Paid {0}`),
payPartialHint:L2(`Pwedeng kulang ang ibabayad. Ang matitira ay mananatiling "Kulang" sa item.`,`You can pay less. The rest stays as "Remaining" on that item.`),
pfSyncP:L2(`I-sync, Auto-sync at kunin ang data sa ibang device`,`Sync, auto-sync and get data from another device`),
syGetT:L2(`Kunin ang data ng ibang device`,`Get data from another device`),
syGetP:L2(`Para sa bagong phone: ilagay ang Code ng lumang phone. Sa lumang phone, lalabas ang Decline / Accept. Pagka-Accept, ipapadala ang data at makikita mo ang progress.`,`For your new phone: enter the old phone's Code. The old phone will see Decline / Accept. Once accepted, the data is sent and you can follow the progress.`),
xfGetIn:L2(`Code ng lumang device`,`Old device's code`),
xfGetGo:L2(`Hilingin`,`Request`),
xfReqSent:L2(`Naipadala ang request kay {0}. Hinihintay ang Accept niya.`,`Request sent to {0}. Waiting for their Accept.`),
xfReqDup:L2(`May request ka nang naghihintay sa code na ito.`,`You already have a request waiting for this code.`),
xfReqT:L2(`May gustong kumuha ng data mo`,`Someone wants to get your data`),
xfReqP:L2(`Gusto ng {0} na kunin ang items, benta at utang ng device na ito. Kapag Accept, ipapadala ang data.`,`{0} wants to get this device's items, sales and debts. If you Accept, the data will be sent.`),
xfPrepT:L2(`Inihahanda ang data…`,`Preparing the data…`),
xfSendingT:L2(`Ipinapadala ang data…`,`Sending the data…`),
xfSentOkT:L2(`Naipadala na ang data`,`Data sent`),
xfGettingT:L2(`Kinukuha ang data…`,`Getting the data…`),
xfAddingT:L2(`Idinadagdag sa phone mo…`,`Adding to your phone…`),
xfWaitAns:L2(`Naghihintay ng sagot ni {0}…`,`Waiting for {0} to answer…`),
xfWaitData:L2(`Tinanggap ni {0}. Hinihintay ang data…`,`{0} accepted. Waiting for the data…`),
xfWaitSub:L2(`Pwede kang lumabas dito. Tuloy pa rin.`,`You can leave this screen. It keeps going.`),
xfReqOk:L2(`Tinanggap ni {0} ang request. Darating na ang data.`,`{0} accepted your request. The data is coming.`),
xfReqNo:L2(`Tinanggihan ni {0} ang request.`,`{0} declined your request.`),
xfTimeout:L2(`Hindi dumating ang data. Subukan ulit.`,`The data didn't arrive. Try again.`),
xfOkT:L2(`Success!`,`Success!`),
xfOkP:L2(`Nakuha mo na ang data ng {0}.`,`You now have the data of {0}.`),
xfOkBtn:L2(`OK`,`OK`),
xfFailT:L2(`Hindi natapos ang paglilipat`,`The transfer didn't finish`),
xfCancel:L2(`Kanselahin`,`Cancel`)
});

/* =============== 1) UTANG PER ITEM: KULANG =============== */
const lineTot=l=>r2(l.qty*l.price);
// Para saan: magkano na ang nabayad sa isang item ng utang (hanggang sa oras na upTo, kung may bigay)
function itemPaid(d,i,upTo){
  const L=debtLines(d),l=L&&L[i];if(!l)return 0;
  const tot=lineTot(l);let s=0;
  S.debts.forEach(x=>{
    if(x.type!=='bayad'||x.for!==d.id||(upTo!=null&&x.ts>upTo))return;
    if(x.ia&&x.ia[i]!=null)s+=Number(x.ia[i])||0;
    else if(x.items&&x.items.indexOf(i)>=0)s+=tot;            // lumang bayad (buong item)
  });
  return r2(Math.min(s,tot));
}
// Para saan: ang KULANG pa sa isang item
const itemLeft=(d,i,upTo)=>{const L=debtLines(d),l=L&&L[i];return l?r2(lineTot(l)-itemPaid(d,i,upTo)):0};
// Para saan: aling mga item ang bayad na (buo)
debtPaidIdx=function(d){const st=new Set(),L=debtLines(d);if(L)L.forEach((l,i)=>{if(itemLeft(d,i)<=0.004)st.add(i)});return st};
// Para saan: kunin ang mga napili at kabuuan nito (ang item ay ang KULANG na lang ang bibilangin)
paySel=function(c){
  const out=[];
  openDebtsOf(c).forEach(o=>{
    const d=o.d;let amt=0,idx=[];
    if(PAYUI.mode==='bill'){if(PAYUI.sel.has(d.id))amt=o.left}
    else if(PAYUI.sel.has(d.id+':*'))amt=o.left;
    else{const ls=debtLines(d);if(ls)ls.forEach((l,i)=>{if(PAYUI.sel.has(d.id+':'+i)){const lf=itemLeft(d,i);if(lf>0.004){amt=r2(amt+lf);idx.push(i)}}});amt=Math.min(amt,o.left)}
    if(amt>0.004)out.push({d,amt:r2(amt),idx});
  });
  return {list:out,total:r2(out.reduce((a,x)=>a+x.amt,0))};
};
// Para saan: ipamahagi ang ibabayad sa mga napili ayon sa pagkakasunod. Kapag kulang, ang huli ay kulang.
function payAlloc(s,money){
  let rest=money;const out=[];
  s.list.forEach(x=>{
    if(rest<=0.004)return;
    const give=r2(Math.min(rest,x.amt));if(give<=0.004)return;
    const e={d:x.d,amt:give,idx:x.idx,ia:null};
    if(x.idx.length){e.ia={};let r=give;x.idx.forEach(i=>{if(r<=0.004)return;const a=r2(Math.min(r,itemLeft(x.d,i)));if(a>0.004){e.ia[i]=a;r=r2(r-a)}})}
    out.push(e);rest=r2(rest-give);
  });
  return out;
}
// Para saan: ang buong bahagi ng pagbabayad (3 paraan), may "Kulang" sa bawat item
payBlock=function(c){
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
      const ls=debtLines(o.d);let rows='';
      if(ls)ls.forEach((l,i)=>{
        const lf=itemLeft(o.d,i);if(lf<=0.004)return;
        const pd=itemPaid(o.d,i);
        rows+=pick(o.d.id+':'+i,esc(l.name),lf,l.qty+' × '+fmt(l.price)+(pd>0.004?' · '+t('payPaidSoFar',fmt(pd))+' · '+t('kulang')+' '+fmt(lf):''));
      });
      if(!rows)rows=pick(o.d.id+':*',esc(debtDesc(o.d)),o.left,'');
      return '<div class="dp-grp"><span>'+esc(dstr(o.d.ts))+'</span><em>'+fmt(o.left)+'</em></div>'+rows}).join('');
    body='<div class="dp-top"><span class="hint">'+esc(t(m==='bill'?'payPickBill':'payPickItem'))+'</span><button type="button" class="btn btn-ghost dp-all" data-act="dp-selall">'+esc(t('payPickAll'))+'</button></div>'+
    '<div class="dp-list">'+list+'</div><div class="dp-sum" id="dp-sum"></div>'+
    '<div class="field"><label for="dp-rcv">'+esc(t('payRcvLbl'))+'</label><input class="inp" id="dp-rcv" type="number" inputmode="decimal" min="0" step="any" placeholder="'+esc(t('payExact'))+'"></div>'+
    '<div class="hint" style="margin:-4px 0 8px">'+esc(t('payPartialHint'))+'</div>'+
    '<div class="dp-info" id="dp-info" aria-live="polite"></div>'+
    '<div class="cash-quick"><button type="button" class="btn btn-ghost" data-act="dp-fill" data-v="">'+esc(t('payExact'))+'</button>'+[10,20,50,100,500].map(v=>'<button type="button" class="btn btn-ghost" data-act="dp-fill" data-v="'+v+'">'+fmt(v)+'</button>').join('')+'</div>';
  }
  return '<div class="stack"><div class="seg seg3 dp-seg">'+[['all','payModeAll'],['bill','payModeBill'],['item','payModeItem']].map(x=>'<button type="button" data-act="dp-mode" data-m="'+x[0]+'" aria-selected="'+(m===x[0])+'">'+esc(t(x[1]))+'</button>').join('')+'</div>'+body+
  '<button class="btn btn-primary btn-block" id="dp-ok" data-act="dp-pay" data-k="'+esc(c.key)+'" disabled style="min-height:50px">'+esc(t('acceptPay'))+'</button>'+
  '<button class="btn btn-ghost btn-block" data-act="cust-remind" data-k="'+esc(c.key)+'" style="min-height:46px">'+I.bell+' '+esc(t('remindBtn'))+'</button></div>';
};
// Para saan: i-update ang sukli / kulang at ang button. Pwede nang kulang ang ibayad sa Per Resibo at Per Item.
const _payUpdV19=payUpd;
payUpd=function(){
  if(PAYUI.mode==='all')return _payUpdV19();
  const c=customers().find(x=>x.key===PAYUI.key),ok=$('#dp-ok'),i=$('#dp-info');if(!c||!ok||!i)return;
  const info=(cls,lbl,val)=>{i.className='dp-info'+(cls?' '+cls:'');i.innerHTML='<span>'+esc(lbl)+'</span><b>'+fmt(val)+'</b>'};
  const s=paySel(c),sm=$('#dp-sum'),v=parseFloat(($('#dp-rcv')||{}).value),recv=v>0?v:s.total;
  if(sm)sm.innerHTML='<span>'+esc(t('paySumLbl'))+'</span><b>'+fmt(s.total)+'</b>';
  ok.textContent=t('acceptPay')+(s.total>0?' · '+fmt(r2(Math.min(recv,s.total))):'');
  ok.disabled=!(s.total>0&&recv>0);
  if(!(s.total>0)||!(v>0)){i.className='dp-info';i.innerHTML='';return}
  if(v>s.total+1e-9)info('chg',t('payChange'),r2(v-s.total));
  else if(v<s.total-1e-9)info('warn',t('payShort'),r2(s.total-v));      // KULANG PA
  else{i.className='dp-info';i.innerHTML=''}
};
// Para saan: bayad sa utang. Ang "Lahat" ay gaya ng dati; ang Per Resibo / Per Item ay pwede nang kulang.
const _payDebtV19=payDebt;
payDebt=function(key){
  if(PAYUI.mode==='all')return _payDebtV19(key);
  const c=customers().find(x=>x.key===key);if(!c||c.bal<=0.004)return;
  const done=()=>{renderNav();if(S.tab==='utang')renderUtang()};
  const s=paySel(c);if(!s.list.length)return;
  const v=parseFloat($('#dp-rcv').value),recv=v>0?r2(v):s.total;if(!(recv>0))return;
  const applied=r2(Math.min(recv,s.total)),chg=r2(recv-applied),short=r2(s.total-applied);
  const al=payAlloc(s,applied);if(!al.length)return;
  const grp=uid(),now=Date.now();
  const recs=al.map((x,n)=>{
    const r={id:uid(),ts:now+n,name:c.name,type:'bayad',amount:x.amt,for:x.d.id,grp,tendered:recv,by:curBy()};
    if(PAYUI.mode==='item'&&x.ia){
      r.ia=x.ia;
      const full=Object.keys(x.ia).map(Number).filter(i=>itemLeft(x.d,i)<=x.ia[i]+0.004);
      if(full.length)r.items=full;
    }
    if(chg>0.004)r.change=chg;
    return r;
  });
  recs.forEach(r=>S.debts.push(r));archiveSettled();save();checkDue();
  toast(t('receivedN',fmt(recv)),{sub:short>0.004?t('payShort')+': '+fmt(short):(chg>0.004?t('payChange')+': '+fmt(chg):t('payDone',al.length))});sfx('success');
  done();rcOpen(rcModelDebt(recs[0]),null,recs[0].id);
};
// Para saan: resibo ng utang: ilagay ang "Kulang" sa item na hindi pa buo ang bayad
const _rcSaleV19=rcModelSale;
rcModelSale=function(s){
  const m=_rcSaleV19(s);
  if(s.method==='utang'){
    const dd=S.debts.find(x=>x.saleId===s.id);
    if(dd)m.rows.forEach((r,i)=>{if(itemPaid(dd,i)>0.004){const lf=itemLeft(dd,i);if(lf>0.004)r.n+=' · '+t('kulang')+' '+fmt(lf)}});
  }
  return m;
};
// Para saan: resibo ng bayad: sa bawat item, magkano ang binayad at magkano ang kulang pa
const _rcDebtV19=rcModelDebt;
rcModelDebt=function(d){
  if(d.type==='utang')return _rcDebtV19(d);
  const recs=d.grp?S.debts.filter(x=>x.grp===d.grp).sort((a,b)=>a.ts-b.ts):[d];
  if(!recs.some(r=>r.ia))return _rcDebtV19(d);
  const ex=[[t('rcName'),d.name]],last=recs[recs.length-1],bal=rcBalAt(last),rows=[];
  const sum=r2(recs.reduce((a,x)=>a+x.amount,0));
  recs.forEach(r=>{
    const td=S.debts.find(x=>x.id===r.for),L=td&&debtLines(td);
    if(r.ia&&L)Object.keys(r.ia).forEach(k=>{
      const i=+k,l=L[i];if(!l)return;
      const lf=itemLeft(td,i,r.ts);
      rows.push({n:l.name+(lf>0.004?' · '+t('kulang')+' '+fmt(lf):''),q:l.qty,p:l.price,a:r2(r.ia[k]),plain:lf>0.004,ok:lf<=0.004});
    });
    else if(td)rows.push({n:debtDesc(td)+' · '+dFmt(td.ts,{month:'short',day:'numeric'}),q:1,p:r.amount,a:r.amount,plain:true,ok:true});
  });
  if(d.change>0.004)ex.push([t('payApplied'),fmt(sum)],[t('payChange'),fmt(d.change),'chg']);
  ex.push([t('rcBal'),fmt(bal),'bal']);
  return {status:rcStatus(1,bal),title:t('rcPayT'),who:rcWho(d.by),ts:d.ts,rows,hdr:rows.length?t('payPaidFor'):undefined,totalLbl:t('payRecv'),total:d.tendered||sum,ex,foot:t('rcptThanks'),id:d.id};
};

/* =============== 2) CAMERA: MABILIS =============== */
// Isang bukas na lang: kung alam na kung aling camera ang tama, diretso na ito (walang pagbasa ng listahan at walang bukas-sara).
// Pinapainit din ang camera (20 segundo lang) kapag binuksan ang form ng item, kaya pagpindot ng Camera ay andon na agad.
const CAMW={st:null,timer:0,p:null};
const CAM_OK='tindamo:camok';
const _camStreamV19=camStream;
const camSaved=()=>{try{return localStorage.getItem(CAM_KEY)}catch(e){return null}};
const camLive=st=>!!(st&&st.getTracks().length&&st.getTracks().every(x=>x.readyState==='live'));
function camTake(){
  const st=CAMW.st;CAMW.st=null;clearTimeout(CAMW.timer);
  if(camLive(st))return st;
  if(st)try{st.getTracks().forEach(x=>x.stop())}catch(e){}
  return null;
}
function camDrop(){const st=CAMW.st;CAMW.st=null;clearTimeout(CAMW.timer);if(st)try{st.getTracks().forEach(x=>x.stop())}catch(e){}}
async function camFast(W){
  const id=camSaved();if(!id)return null;
  try{return await navigator.mediaDevices.getUserMedia({video:{deviceId:{exact:id},width:{ideal:W},height:{ideal:Math.round(W*9/16)}},audio:false})}
  catch(e){if(e&&/NotAllowed|Security|NotReadable/.test(e.name))throw e;return null}
}
camStream=async function(hiRes){
  const W=hiRes?1920:1280;
  let w=camTake();if(w)return w;
  if(CAMW.p){try{await CAMW.p}catch(e){}w=camTake();if(w)return w}
  let st=await camFast(W);
  if(!st)st=await _camStreamV19(hiRes);
  try{localStorage.setItem(CAM_OK,'1')}catch(e){}
  return st;
};
// Para saan: painitin ang camera nang hindi nanghihingi ng permiso (kapag may permiso na lang)
async function camWarm(){
  if(CAMW.st||CAMW.p||cs||sc||document.hidden)return;
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)return;
  let ok=false;
  try{const q=await navigator.permissions.query({name:'camera'});ok=q.state==='granted'}
  catch(e){try{ok=localStorage.getItem(CAM_OK)==='1'}catch(x){}}
  if(!ok||CAMW.st||CAMW.p||cs||sc)return;
  CAMW.p=(async()=>{
    try{
      let st=await camFast(1280);
      if(!st)st=await _camStreamV19(false);
      if(cs||sc||CAMW.st){st.getTracks().forEach(x=>x.stop());return}
      CAMW.st=st;clearTimeout(CAMW.timer);CAMW.timer=setTimeout(camDrop,20000);
    }catch(e){}
  })();
  CAMW.p.finally(()=>{CAMW.p=null});
}
// Kapag binuksan ang form ng item (may Camera button), painitin. Kapag pinindot na ang camera / scan, painitin din agad.
const _openModalV20=openModal;
openModal=function(html){
  _openModalV20(html);
  if(typeof html==='string'&&html.indexOf('data-act="cam-open"')>=0)setTimeout(camWarm,50);
};
document.addEventListener('pointerdown',e=>{
  const b=e.target.closest&&e.target.closest('[data-act="cam-open"],[data-act="cm-again"],[data-act="scan-sell"],[data-act="inv-scan"],[data-act="scan-form"]');
  if(b)camWarm();
},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden)camDrop()});
// Kapag nag-"Ulit" sa crop screen, huwag munang ipainit; kusa nang kukuha ang openCam

/* =============== 4) MENU: LIMANG ITEM LANG =============== */
toggleMenu=function(btn){
  const old=$('#menu-pop');if(old){old.remove();return}
  const r=btn.getBoundingClientRect(),m=document.createElement('div');
  m.id='menu-pop';m.className='menu-pop';m.setAttribute('role','menu');
  m.style.top=(r.bottom+8)+'px';m.style.right=Math.max(8,window.innerWidth-r.right)+'px';
  const un=typeof ibUnread==='function'?ibUnread():0;
  const items=[['profile',I.user,t('profile')],['settings',I.gear,t('settings')],['cashier',I.users,t('cashier')]];
  if(S.role!=='cashier')items.push(['message',I.msg,t('msg'),un]);
  if(S.role!=='cashier')items.push(['gcash',I.gcash,'GCash']);                 // laging nasa baba
  m.innerHTML=items.map(x=>'<button role="menuitem" data-act="page" data-p="'+x[0]+'">'+x[1]+'<span>'+esc(x[2])+'</span>'+(x[3]?'<em class="mn">'+(x[3]>99?'99+':x[3])+'</em>':'')+'</button>').join('');
  document.body.appendChild(m);
};
// Sync: nasa loob na ng Profile (may Back papuntang Profile)
const _openProfileV20=openProfile;
openProfile=function(){
  _openProfileV20();
  if(S.role==='cashier')return;
  const sh=document.querySelector('#modal .sheet');if(!sh||sh.querySelector('#pf-sync'))return;
  const sec=document.createElement('div');sec.className='set-sec';sec.id='pf-sync';
  sec.innerHTML='<button type="button" class="btn btn-ghost btn-block pf-syncbtn" data-act="page" data-p="sync">'+I.cloud+' '+esc(t('syT'))+'</button><div class="hint" style="margin-top:6px;text-align:center">'+esc(t('pfSyncP'))+'</div>';
  const anchor=[].slice.call(sh.querySelectorAll('.set-sec')).find(x=>x.querySelector('#bk-box'));
  if(anchor)anchor.parentNode.insertBefore(sec,anchor);else sh.appendChild(sec);
};
function syBackHead(){
  const h=document.querySelector('#modal .sheet-h');if(!h||h.querySelector('.sy-back'))return;
  const h2=h.querySelector('h2'),x=h.querySelector('[data-act="close-modal"]');if(!h2)return;
  h.innerHTML='<div class="row" style="align-items:center;gap:6px;min-width:0;flex-wrap:nowrap"><button type="button" class="icon-btn sy-back" data-act="page" data-p="profile" aria-label="Back">'+I.chevL+'</button><h2>'+esc(h2.textContent)+'</h2></div>'+(x?x.outerHTML:'');
}

/* =============== 5) ADMIN: BUTTON SA BABA =============== */
renderNav=function(){
  const nv=$('#nav');if(!nv)return;
  const n=owing().length,adm=typeof ibIsAdmin==='function'&&ibIsAdmin();
  const tabs=[['sell',t('sell'),I.cart],['inv',t('inv'),I.box],['utang',t('utang'),I.book],['sales',t('sales'),I.chart]];
  nv.classList.toggle('n5',!!adm);
  nv.style.setProperty('--ni',Math.max(0,tabs.findIndex(x=>x[0]===S.tab)));
  nv.innerHTML=tabs.map(x=>'<button data-act="tab" data-t="'+x[0]+'"'+(S.tab===x[0]?' aria-current="page"':'')+'>'+x[2]+'<span>'+x[1]+'</span>'+(x[0]==='utang'&&n?'<span class="dot">'+n+'</span>':'')+'</button>').join('')+
    (adm?'<button data-act="page" data-p="admin" class="nav-adm">'+I.shield+'<span>Admin</span></button>':'');
};
// Kapag nalaman nang admin ako, iguhit ulit ang nav
const _ibCheckAdminV20=ibCheckAdmin;
ibCheckAdmin=async function(){try{await _ibCheckAdminV20()}finally{try{renderNav()}catch(e){}}};

/* =============== 3) SYNC / LIPAT NG DEVICE =============== */
// --- lumulutang na progress (nakikita kahit lumabas sa page) ---
XF.prog=0;XF.barT=0;
function xfBar(o){
  clearTimeout(XF.barT);XF.barT=0;
  let b=document.getElementById('xfprog');
  if(!o){if(b)b.remove();return}
  if(!b){b=document.createElement('div');b.id='xfprog';b.setAttribute('role','status');b.setAttribute('aria-live','polite');document.body.appendChild(b)}
  const ind=o.pct==null;
  b.className='xfprog '+o.k+(ind?' ind':'');
  b.innerHTML='<div class="xp-ic">'+(o.k==='ok'?'✓':o.k==='err'?'!':'<i class="xp-sp"></i>')+'</div><div class="xp-tx"><b>'+esc(o.title)+(ind?'':' · '+Math.round(o.pct)+'%')+'</b>'+(o.sub?'<small>'+esc(o.sub)+'</small>':'')+'<div class="xp-bar"><i style="width:'+(ind?40:Math.max(3,Math.min(100,Math.round(o.pct))))+'%"></i></div></div>'+(o.x?'<button type="button" class="xp-x" data-act="xf-cancel" aria-label="'+esc(t('xfCancel'))+'">×</button>':'');
  if(o.k==='ok'||o.k==='err')XF.barT=setTimeout(()=>{XF.barT=0;const e=document.getElementById('xfprog');if(e)e.remove();xfWaitBar()},4200);
}
// Para saan: habang may request na hinihintay ang sagot / data, may nakalutang na "Naghihintay…"
function xfWaitBar(){
  if(XF.prog||XF.barT)return;
  const w=xfOut().filter(x=>x.rq);
  if(!w.length){const b=document.getElementById('xfprog');if(b&&/wait/.test(b.className))b.remove();return}
  const x=w[0];
  xfBar({k:'wait',title:t(x.acc?'xfWaitData':'xfWaitAns',x.to),sub:t('xfWaitSub'),x:1});
}
// --- tulong ---
// Para saan: hanapin ang account na may code; ibalik ang uid at pangalan ng tindahan
async function xfTarget(raw,errSel){
  const setErr=m=>{const e=$(errSel);if(e)e.textContent=m||''};
  setErr('');
  if(!xfOk()){setErr(t('xfNeed'));return null}
  const code=normCode(raw);
  if(!/^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(code)){setErr(t('xfBadCode'));sfx('error');return null}
  if(code===xfMyCode()){setErr(t('xfSelf'));sfx('error');return null}
  let d;
  try{d=await clDb('/codes/'+encodeURIComponent(code))}
  catch(e){if(e&&(e.status===404||e.code==='NOT_FOUND')){setErr(t('xfNone'));sfx('error');return null}throw e}
  const f=d.fields||{},ruid=fv(f,'uid'),rname=fv(f,'s')||code;
  if(!ruid||ruid===CL.uid){setErr(t('xfSelf'));sfx('error');return null}
  return {ruid,rname,code};
}
const xfPayload=()=>({app:'tindamo-xfer',v:1,ts:Date.now(),store:S.store,items:S.items,sales:S.sales,debts:S.debts});
// Para saan: i-upload ang data sa inbox ng ruid (hinihiwa). onProg(tapos,lahat)
async function xfUpload(ruid,payload,onProg){
  const text=JSON.stringify(payload),parts=[];
  for(let i=0;i<text.length;i+=CHUNK)parts.push(text.slice(i,i+CHUNK));
  if(parts.length>30){const e=new Error('BIG');e.big=true;throw e}
  const ts=payload.ts,id=uid(),base='/inbox/'+ruid+'/xfer/'+id;
  await clDb(base,{method:'PATCH',headers:jh,body:JSON.stringify({fields:{fu:fStr(CL.uid),fe:fStr(ibEmail()),fs:fStr(S.store||''),ts:fInt(ts),n:fInt(parts.length),st:fStr('u')}})});
  if(onProg)onProg(0,parts.length);
  for(let i=0;i<parts.length;i+=4){
    const writes=parts.slice(i,i+4).map((p,k)=>({update:{name:dbName(base+'/parts/'+(i+k)),fields:{i:fInt(i+k),ts:fInt(ts),d:fStr(p)}}}));
    await clDb(':commit',{method:'POST',headers:jh,body:JSON.stringify({writes})});
    if(onProg)onProg(Math.min(parts.length,i+4),parts.length);
  }
  await xfPatch(base,'st','p');
  return id;
}
// Para saan: kunin ang mga piraso (may progress)
async function xfPullParts(base,n,ts,onProg){
  if(!(n>0))return null;
  const parts=[];
  for(let i=0;i<n;i+=3){
    const idx=[];for(let k=i;k<Math.min(n,i+3);k++)idx.push(k);
    const docs=await Promise.all(idx.map(k=>clDb(base+'/parts/'+k)));
    docs.forEach((d,j)=>{const f=d.fields||{};if(gInt(f.ts)!==ts){const x=new Error('INCOMPLETE');x.code='INCOMPLETE';throw x}parts[idx[j]]=(f.d||{}).stringValue||''});
    if(onProg)onProg(Math.min(n,i+3),n);
  }
  return JSON.parse(parts.join(''));
}
const xfReqFor=x=>xfOut().find(o=>o.rq&&o.ruid===x.fu&&Date.now()-o.ts<864e5);
// Para saan: pop-up na "Success! Nakuha mo na ang data ng ..."
function xfDoneBox(store,r){
  const old=document.getElementById('xfdone');if(old)old.remove();
  const b=document.createElement('div');b.id='xfdone';b.className='verbox xbox';b.setAttribute('role','dialog');b.setAttribute('aria-modal','true');
  b.innerHTML='<div class="vb-card"><div class="xfok-ic">✓</div><h2>'+esc(t('xfOkT'))+'</h2><p>'+esc(t('xfOkP',store))+'<br><small>'+esc(t('xfDone',r.items,r.sales,r.debts))+(r.skipped?'<br>'+esc(t('xfLimit',r.skipped)):'')+'</small></p>'+
    '<div class="vb-b"><button type="button" class="btn btn-primary" id="xfdone-ok">'+esc(t('xfOkBtn'))+'</button></div></div>';
  document.body.appendChild(b);
  b.querySelector('#xfdone-ok').onclick=()=>b.remove();
}
// --- IPADALA ANG DATA (ako ang pumili ng tatanggap) ---
xfSend=async function(raw){
  if(XF.busy||XF.prog)return;
  XF.busy=true;const btn=$('#xf-go');if(btn){btn.disabled=true;btn.textContent=t('xfSending')}
  const setErr=m=>{const e=$('#xf-err');if(e)e.textContent=m||''};
  try{
    const tg=await xfTarget(raw,'#xf-err');if(!tg)return;
    if(CL.busy)await CL.busy;
    XF.prog=1;xfBar({k:'send',title:t('xfPrepT'),sub:tg.rname,pct:3});
    const payload=xfPayload();
    const id=await xfUpload(tg.ruid,payload,(d,n)=>xfBar({k:'send',title:t('xfSendingT'),sub:tg.rname,pct:8+88*(n?d/n:1)}));
    xfOutSave([{id,ruid:tg.ruid,to:tg.rname,ts:payload.ts}].concat(xfOut()));
    const inp=$('#xf-in');if(inp)inp.value='';
    xfBar({k:'ok',title:t('xfSentOkT'),sub:t('xfSent',tg.rname),pct:100});
    toast(t('xfSent',tg.rname),{ms:3500});sfx('success');xfDraw();
  }catch(e){
    xfBar(null);
    if(e&&e.big){setErr(t('xfBig'));toast(t('xfBig'),{kind:'err'})}else setErr(t('errCloud',(e&&e.message)||e));
    sfx('error');
  }
  finally{XF.prog=0;XF.busy=false;const b=$('#xf-go');if(b){b.disabled=false;b.textContent=t('xfGo')}}
};
// --- HILINGIN ANG DATA NG IBANG DEVICE (para sa bagong phone) ---
async function xfRequest(raw){
  if(XF.busy||XF.prog)return;
  XF.busy=true;const btn=$('#xf-getgo');if(btn){btn.disabled=true;btn.textContent=t('xfSending')}
  const setErr=m=>{const e=$('#xf-err2');if(e)e.textContent=m||''};
  try{
    const tg=await xfTarget(raw,'#xf-err2');if(!tg)return;
    if(xfOut().some(x=>x.rq&&x.ruid===tg.ruid&&Date.now()-x.ts<864e5)){setErr(t('xfReqDup'));sfx('error');return}
    const ts=Date.now(),id=uid(),base='/inbox/'+tg.ruid+'/xfer/'+id;
    await clDb(base,{method:'PATCH',headers:jh,body:JSON.stringify({fields:{fu:fStr(CL.uid),fe:fStr(ibEmail()),fs:fStr(S.store||''),ts:fInt(ts),n:fInt(0),st:fStr('u')}})});
    await xfPatch(base,'st','p');                                  // n = 0 ay "request" (walang data)
    xfOutSave([{id,ruid:tg.ruid,to:tg.rname,ts,rq:1}].concat(xfOut()));
    const inp=$('#xf-get-in');if(inp)inp.value='';
    toast(t('xfReqSent',tg.rname),{ms:3500});sfx('success');xfDraw();xfWaitBar();
  }catch(e){setErr(t('errCloud',(e&&e.message)||e));sfx('error')}
  finally{XF.busy=false;const b=$('#xf-getgo');if(b){b.disabled=false;b.textContent=t('xfGetGo')}}
}
// --- TUMATANGGAP: may dumating (data o request) ---
xfPoll=async function(){
  if(XF.poll||!xfOk()||XF.ask)return;
  XF.poll=true;
  try{
    const l=await clDb('/inbox/'+CL.uid+'/xfer?pageSize=20');
    const docs=(l.documents||[]).map(d=>{const f=d.fields||{};return{id:idOf(d),st:fv(f,'st'),fu:fv(f,'fu'),fs:fv(f,'fs'),fe:fv(f,'fe'),ts:fv(f,'ts')||0,n:fv(f,'n')||0}}).filter(x=>x.st==='p').sort((a,b)=>a.ts-b.ts);
    const x=docs.find(d=>d.n>0&&xfReqFor(d))||docs[0];
    if(x&&!XF.ask){
      XF.ask=x;
      const mine=x.n>0?xfReqFor(x):null;
      if(mine){xfReceive(x,mine)}                                  // hiniling ko ito: kusa nang kukunin
      else{
        if(!XF.seen[x.id]){XF.seen[x.id]=1;const who=x.fs||x.fe;try{appNotify(t(x.n?'xfNotifT':'xfReqT'),who+' '+t('xfNotifB'),'xf-'+x.id)}catch(e){}sfx('success');try{buzz(BUZZ_OK)}catch(e){}}
        xfAskDraw();
      }
    }
  }catch(e){}
  XF.poll=false;
};
// Para saan: pop-up na Decline / Accept (data, o request na kunin ang data ko)
xfAskDraw=function(){
  const x=XF.ask;const old=document.getElementById('xfbox');if(old)old.remove();if(!x)return;
  const who=x.fs||x.fe||'?',rq=!x.n;
  const b=document.createElement('div');b.id='xfbox';b.className='verbox xbox';b.setAttribute('role','dialog');b.setAttribute('aria-modal','true');
  b.innerHTML='<div class="vb-card"><div class="vip-ic">'+I.cloud+'</div><h2>'+esc(t(rq?'xfReqT':'xfAskT'))+'</h2><p>'+esc(t(rq?'xfReqP':'xfAskP',who))+(x.fe?'<br><small>'+esc(x.fe)+'</small>':'')+'</p>'+
    '<div class="vb-b"><button type="button" class="btn btn-ghost" id="xf-no">'+esc(t('xfDecline'))+'</button><button type="button" class="btn btn-primary" id="xf-yes">'+esc(t('xfAccept'))+'</button></div></div>';
  document.body.appendChild(b);
  b.querySelector('#xf-no').onclick=()=>xfAnswer(false);
  b.querySelector('#xf-yes').onclick=()=>xfAnswer(true);
};
// Para saan: kunin ang dumating na data (may progress). mine = ang request ko na nauna.
async function xfReceive(x,mine){
  const base='/inbox/'+CL.uid+'/xfer/'+x.id,who=x.fs||x.fe||'?';
  const bx=document.getElementById('xfbox');if(bx)bx.remove();
  XF.prog=1;xfBar({k:'get',title:t('xfGettingT'),sub:who,pct:4});
  try{
    const meta=await clDb(base),f=meta.fields||{},n=fv(f,'n')||0,ts=fv(f,'ts')||0;
    const payload=await xfPullParts(base,n,ts,(d,tot)=>xfBar({k:'get',title:t('xfGettingT'),sub:who,pct:8+80*(tot?d/tot:1)}));
    if(!payload||payload.app!=='tindamo-xfer')throw new Error('BAD');
    xfBar({k:'get',title:t('xfAddingT'),sub:who,pct:94});
    const r=xfApply(payload);
    await xfPatch(base,'st','a');await xfDeleteParts(base);
    if(mine){clDb(base,{method:'DELETE'}).catch(()=>{});clDb('/inbox/'+mine.ruid+'/xfer/'+mine.id,{method:'DELETE'}).catch(()=>{});xfOutSave(xfOut().filter(o=>o.id!==mine.id))}
    const store=payload.store||who;
    xfBar({k:'ok',title:t('xfOkT'),sub:t('xfOkP',store),pct:100});
    xfDoneBox(store,r);toast(t('xfOkP',store),{sub:t('xfDone',r.items,r.sales,r.debts),ms:4500});sfx('success');try{buzz(BUZZ_OK)}catch(e){}
    try{appNotify(t('xfOkT'),t('xfOkP',store),'xf-ok')}catch(e){}
    if(S.page==='sync')xfDraw();
  }catch(e){
    if(e&&(e.status===404||e.code==='NOT_FOUND')){xfBar(null);toast(t('xfFail'),{kind:'warn',ms:3000})}
    else{xfBar({k:'err',title:t('xfFailT'),sub:t('xfFail')});toast(t('xfFail'),{kind:'err',ms:3500})}
    sfx('error');
  }
  finally{XF.prog=0;XF.ask=null;setTimeout(xfPoll,500)}
}
// Para saan: may nag-request ng data ko at nag-Accept ako: ipadala (may progress)
async function xfServe(x){
  const base='/inbox/'+CL.uid+'/xfer/'+x.id,who=x.fs||x.fe||'?';
  const bx=document.getElementById('xfbox');if(bx)bx.remove();
  XF.prog=1;xfBar({k:'send',title:t('xfPrepT'),sub:who,pct:3});
  try{
    if(CL.busy)await CL.busy;
    const payload=xfPayload();
    if(JSON.stringify(payload).length>CHUNK*30){await xfPatch(base,'st','d');xfBar(null);toast(t('xfBig'),{kind:'err'});sfx('error');return}
    await xfPatch(base,'st','a');                                  // para alam ng kabila na tinanggap na
    await xfUpload(x.fu,payload,(d,n)=>xfBar({k:'send',title:t('xfSendingT'),sub:who,pct:8+88*(n?d/n:1)}));
    xfBar({k:'ok',title:t('xfSentOkT'),sub:who,pct:100});
    toast(t('xfSentOkT'),{sub:who,ms:3500});sfx('success');
  }catch(e){
    xfBar({k:'err',title:t('xfFailT'),sub:String((e&&e.message)||e)});toast(t('xfFail'),{kind:'err',ms:3500});sfx('error');
  }
  finally{XF.prog=0;XF.ask=null;setTimeout(xfPoll,500)}
}
// Para saan: sagot ko sa pop-up
xfAnswer=async function(yes){
  const x=XF.ask;if(!x||XF.prog)return;
  const b=document.getElementById('xfbox');
  if(!yes){
    const base='/inbox/'+CL.uid+'/xfer/'+x.id,nb=b&&b.querySelector('#xf-no'),yb=b&&b.querySelector('#xf-yes');
    if(nb)nb.disabled=true;if(yb)yb.disabled=true;
    try{await xfPatch(base,'st','d');if(x.n>0)await xfDeleteParts(base)}catch(e){}
    XF.ask=null;if(b)b.remove();setTimeout(xfPoll,400);return;
  }
  if(!x.n)return xfServe(x);
  return xfReceive(x,null);
};
// Para saan: sagot sa ipinadala / hiniling ko
xfOutPoll=async function(){
  if(XF.outPoll||!xfOk())return;
  const l=xfOut();if(!l.length)return;
  XF.outPoll=true;
  try{
    const keep=[];let ch=false;
    for(const x of l){
      const path='/inbox/'+x.ruid+'/xfer/'+x.id;
      if(Date.now()-x.ts>(x.rq?864e5:7*864e5)){clDb(path,{method:'DELETE'}).catch(()=>{});ch=true;continue}
      let d=null;
      try{d=await clDb(path)}catch(e){if(e&&(e.status===404||e.code==='NOT_FOUND')){ch=true;continue}keep.push(x);continue}
      const st=fv(d.fields||{},'st');
      if(x.rq){
        if(st==='d'){toast(t('xfReqNo',x.to),{ms:4500,kind:'warn'});sfx('error');clDb(path,{method:'DELETE'}).catch(()=>{});ch=true;continue}
        if(st==='a'){
          if(!x.acc){x.acc=Date.now();ch=true;toast(t('xfReqOk',x.to),{ms:3500});sfx('success')}
          if(Date.now()-x.acc>10*60*1000){toast(t('xfTimeout'),{kind:'warn',ms:4000});clDb(path,{method:'DELETE'}).catch(()=>{});ch=true;continue}   // hindi dumating
        }
        keep.push(x);continue;
      }
      if(st==='a'||st==='d'){
        toast(t(st==='a'?'xfAccepted':'xfDeclined',x.to),{ms:4500,kind:st==='a'?undefined:'warn'});sfx(st==='a'?'success':'error');
        clDb(path,{method:'DELETE'}).catch(()=>{});ch=true;continue;
      }
      keep.push(x);
    }
    if(ch)xfOutSave(keep);
    if(ch&&S.page==='sync')xfDraw();
    if(ch)xfWaitBar();
  }catch(e){}
  XF.outPoll=false;
};
// --- Sync page: dalawang bahagi ---
xfHtml=function(){
  const out=xfOut();
  return '<div id="xf-box">'+
    '<div class="set-sec"><span class="lbl">'+esc(t('syGetT'))+'</span><div class="hint" style="margin-bottom:8px">'+esc(t('syGetP'))+'</div>'+
    '<div class="row"><input class="inp" id="xf-get-in" placeholder="'+esc(t('xfGetIn'))+'" maxlength="7" autocapitalize="characters" autocomplete="off" spellcheck="false" style="text-transform:uppercase;letter-spacing:.08em"><button type="button" class="btn btn-primary" id="xf-getgo" data-act="xf-get">'+esc(t('xfGetGo'))+'</button></div>'+
    '<div class="err" id="xf-err2" role="alert"></div>'+
    out.filter(x=>x.rq).map(x=>'<div class="hint xf-wait">⏳ '+esc(t(x.acc?'xfWaitData':'xfWaitAns',x.to))+'</div>').join('')+'</div>'+
    '<div class="set-sec"><span class="lbl">'+esc(t('xfT'))+'</span><div class="hint" style="margin-bottom:8px">'+esc(t('xfP'))+'</div>'+
    '<div class="xf-mine"><small>'+esc(t('xfMine'))+'</small><b id="xf-mine">'+esc(xfMyCode()||'—')+'</b><button type="button" class="btn btn-ghost" data-act="xf-copy" style="min-height:34px;padding:0 12px;font-size:13px">'+esc(t('xfCopy'))+'</button></div>'+
    '<div class="row" style="margin-top:10px"><input class="inp" id="xf-in" placeholder="'+esc(t('xfIn'))+'" maxlength="7" autocapitalize="characters" autocomplete="off" spellcheck="false" style="text-transform:uppercase;letter-spacing:.08em"><button type="button" class="btn btn-primary" id="xf-go" data-act="xf-send">'+esc(t('xfGo'))+'</button></div>'+
    '<div class="err" id="xf-err" role="alert"></div>'+
    out.filter(x=>!x.rq).map(x=>'<div class="hint xf-wait">⏳ '+esc(t('xfWait',x.to))+'</div>').join('')+'</div></div>';
};
xfDraw=function(){
  if(S.page!=='sync')return;
  const box=$('#xf-box'),a=$('#xf-in'),g=$('#xf-get-in'),av=a?a.value:'',gv=g?g.value:'',af=a&&document.activeElement===a,gf=g&&document.activeElement===g;
  if(box)box.outerHTML=xfHtml();
  else{const sb=$('#sy-box');if(sb)sb.insertAdjacentHTML('afterend',xfHtml())}
  const na=$('#xf-in'),ng=$('#xf-get-in');
  if(na&&av){na.value=av;if(af)na.focus()}
  if(ng&&gv){ng.value=gv;if(gf)ng.focus()}
};
// Para saan: pagbukas ng Sync page: may Back papuntang Profile
const _openSyncV20=openSync;
openSync=function(){_openSyncV20();syBackHead()};
Object.assign(ACTIONS,{
  'xf-get':()=>{const i=$('#xf-get-in');xfRequest(i?i.value:'')},
  'xf-cancel':()=>{
    const w=xfOut().filter(x=>x.rq);
    w.forEach(x=>clDb('/inbox/'+x.ruid+'/xfer/'+x.id,{method:'DELETE'}).catch(()=>{}));
    xfOutSave(xfOut().filter(x=>!x.rq));xfBar(null);if(S.page==='sync')xfDraw();
  }
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='xf-get-in'){e.preventDefault();xfRequest(e.target.value)}});
document.addEventListener('input',e=>{if(e.target.id==='xf-get-in'){const v=e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,'');if(v!==e.target.value)e.target.value=v}});
// Habang may hinihintay na request, mas madalas ang tingin (kada ~2.5 segundo)
setInterval(()=>{if(!document.hidden&&S.user&&S.role!=='cashier'&&xfOut().some(x=>x.rq)){xfPoll();xfOutPoll()}},2500);
setTimeout(()=>{try{if(S.user&&S.role!=='cashier')xfWaitBar()}catch(e){}},2500);

/* ################################################################
   DATING V1.2.5  (isinama na sa v1.0.0)
   ################################################################ */
/* ============================================================
   ITO PARA SA MGA BAGO SA V1.2.5   [versions/v1.2.5.js]
   1) KULANG ANG BAYAD (Sell > Bayad > Cash): hal. total ₱45, ₱30 lang ang ibinigay. May lalabas na tanong
      "Payagan o Hindi?" na gawing UTANG ang kulang na ₱15. Kapag Payagan: isulat ang pangalan (kung nasa listahan na siya,
      pindutin lang ang pangalan niya, madadagdag sa utang niya bilang "Kulang"). May UTANG RESIBO na lalabas.
   2) SYNC: inalis ang "Ilipat sa ibang account" (magpadala). Iniwan ang "Kunin ang data ng ibang device". Ang Code ng account
      ay nasa ilalim pa rin (para ibigay sa bagong phone).
   3) ADMIN: ang button ay nasa TAAS na, una bago ang notification button (hindi na sa baba). Para sa Admin / Dev lang.
   4) PINAKAMABABANG VERSION: min = 1.2.5 (version.json). Ang 1.2.4 pababa ay hindi na makakagamit ng app.
   5) TAP SFX: ang tunog ng pindot ay mp3 na sa folder na SFX/ (tap.mp3, tap-up, tap-down, tap-tab, tap-ok, tap-no).
   6) TindaMo AI: sa Message, pindutin ang "AI Tulong". Chat na may text, VOICE at LARAWAN, at pwedeng Reply.
      Kailangan ng AI server (tingnan ang ai-proxy/README.md at ilagay ang url sa config.js).
   ============================================================ */
const _ic125=(d)=>ic(d);
I.mic=_ic125('<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>');
I.send=_ic125('<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>');
I.spark=_ic125('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>');
I.stop=_ic125('<rect x="6" y="6" width="12" height="12" rx="2"/>');
I.reply=_ic125('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v3"/>');

Object.assign(D,{
/* ---- kulang ang bayad ---- */
shortT:L2(`Kulang ang bayad`,`Payment is short`),
shortGo:L2(`Kulang · Ituloy`,`Short · Continue`),
shTot:L2(`Kabuuan`,`Total`),
shPaid:L2(`Binayad`,`Paid`),
shLeft:L2(`Kulang`,`Short`),
shAsk:L2(`Gawing utang ang kulang na {0}? Itatala ito sa pangalan ng bibili at may utang resibo.`,`Turn the short {0} into a debt? It will be recorded under the buyer's name with a debt receipt.`),
shNo:L2(`Hindi`,`No`),
shYes:L2(`Payagan`,`Allow`),
shNameT:L2(`Kaninong utang?`,`Whose debt?`),
shNameP:L2(`Isulat ang pangalan. Kung nasa listahan na siya, pindutin lang ang pangalan niya.`,`Write the name. If he or she is already on the list, just tap the name.`),
shNew:L2(`Bagong utang: {0} (binayad na {1})`,`New debt: {0} ({1} already paid)`),
shHas:L2(`May utang na si {0} na {1}. Madadagdag ang kulang na {2}, magiging {3}.`,`{0} already owes {1}. The short {2} is added, making it {3}.`),
shSave:L2(`Itala ang kulang na utang`,`Record the short debt`),
shDone:L2(`Binayad {0} · Utang {1}`,`Paid {0} · Debt {1}`),
shRcPaid:L2(`Binayad na`,`Paid now`),
shRcLeft:L2(`Kulang (utang)`,`Short (debt)`),
/* ---- sync ---- */
syMineP:L2(`Para sa lumang phone: ibigay ang Code na ito sa bagong phone para makuha niya ang data.`,`For the old phone: give this Code to the new phone so it can get the data.`),
/* ---- TindaMo AI ---- */
aiT:L2(`TindaMo AI`,`TindaMo AI`),
aiBanT:L2(`AI Tulong`,`AI Help`),
aiBanP:L2(`Tanungin ang TindaMo AI: presyo, tips sa tindahan, o magkwento lang.`,`Ask TindaMo AI: prices, store tips, or just chat.`),
aiHello:L2(`Kumusta! Ako si TindaMo AI. Tanungin mo ako tungkol sa tindahan mo, o magkwento ka lang. Pwede ka ring mag-voice o magpadala ng larawan.`,`Hi! I'm TindaMo AI. Ask me about your store, or just tell me a story. You can also send a voice message or a photo.`),
aiC1:L2(`Magkano kaya ang ibenta ko sa 1 pack ng chichirya?`,`How much should I sell a pack of chips for?`),
aiC2:L2(`Paano ako mas kikita sa tindahan?`,`How can I earn more in my store?`),
aiC3:L2(`Paano mag-utang sa TindaMo?`,`How do I record a debt in TindaMo?`),
aiC4:L2(`Magkwento ka naman`,`Tell me a story`),
aiPh:L2(`Magtanong…`,`Ask anything…`),
aiRecT:L2(`Nagre-record…`,`Recording…`),
aiVoice:L2(`Voice`,`Voice`),
aiNoSrv:L2(`Hindi pa available ang TindaMo AI ngayon. Subukan ulit mamaya.`,`TindaMo AI isn't available right now. Please try again later.`),
aiOffline:L2(`Walang internet. Kailangan ng internet ang TindaMo AI.`,`No internet. TindaMo AI needs an internet connection.`),
aiAuth:L2(`Mag-login muna sa online account mo para magamit ang TindaMo AI.`,`Please sign in to your online account to use TindaMo AI.`),
aiLimit:L2(`Marami ka nang naitanong ngayong araw. Subukan ulit bukas.`,`You've asked a lot today. Please try again tomorrow.`),
aiSlow:L2(`Natagalan ang sagot. Subukan ulit.`,`The answer took too long. Please try again.`),
aiFail:L2(`Hindi nakasagot ang TindaMo AI. Subukan ulit.`,`TindaMo AI couldn't answer. Please try again.`),
aiRetry:L2(`Subukan ulit`,`Try again`),
aiNoMic:L2(`Hindi kaya ng device na ito ang voice message.`,`This device can't record voice messages.`),
aiMicDeny:L2(`Hindi pinayagan ang mikropono. I-allow ito sa Settings ng phone.`,`Microphone not allowed. Turn it on in your phone's Settings.`),
aiTooShort:L2(`Masyadong maikli. Magsalita habang nagre-record.`,`Too short. Speak while recording.`),
aiClearQ:L2(`Burahin ang usapan kay TindaMo AI?`,`Delete the chat with TindaMo AI?`),
aiClearYes:L2(`Burahin`,`Delete`),
aiClearP:L2(`Mabubura lang ito sa phone na ito.`,`This only deletes it on this phone.`),
aiPhoto:L2(`Larawan`,`Photo`)
});

/* =============== 1) KULANG ANG BAYAD =============== */
const SHORT={cash:0,total:0,left:0};
// Para saan: cash na mas mababa sa total ay pwede nang ituloy (itatanong kung gagawing utang ang kulang)
const _validatePay125=validatePay;
validatePay=function(){
  if(payMode==='cash'){
    const total=cartTotal(),v=parseFloat(($('#cash')||{}).value);
    const ok=!isNaN(v)&&v>=total-1e-9,short=!isNaN(v)&&v>0&&v<total-1e-9;
    const ch=$('#change');if(ch)ch.textContent=isNaN(v)?'—':(ok?fmt(r2(v-total)):t('shortBy',fmt(r2(total-v))));
    const b=$('#pay-ok');if(b){b.disabled=!(ok||short);b.textContent=short?t('shortGo'):t('finishSale')}
    return;
  }
  return _validatePay125();
};
const _completeSale125=completeSale;
completeSale=function(){
  if(payMode==='cash'){
    const total=cartTotal(),v=parseFloat(($('#cash')||{}).value);
    if(S.cart.length&&!isNaN(v)&&v>0&&v<total-1e-9){shortAsk(r2(v),total);return}
  }
  return _completeSale125();
};
// Hakbang 1: itanong kung papayagan na gawing utang ang kulang
function shortAsk(cash,total){
  SHORT.cash=cash;SHORT.total=total;SHORT.left=r2(total-cash);
  openModal('<div class="sheet-h"><h2>'+esc(t('shortT'))+'</h2><button class="icon-btn" data-act="close-modal" aria-label="'+esc(t('close'))+'">'+I.x+'</button></div>'+
  '<div class="sh-box"><div class="sh-r"><span>'+esc(t('shTot'))+'</span><b>'+fmt(total)+'</b></div>'+
  '<div class="sh-r"><span>'+esc(t('shPaid'))+'</span><b>'+fmt(cash)+'</b></div>'+
  '<div class="sh-r kl"><span>'+esc(t('shLeft'))+'</span><b>'+fmt(SHORT.left)+'</b></div></div>'+
  '<p class="hint sh-p">'+esc(t('shAsk',fmt(SHORT.left)))+'</p>'+
  '<div class="sheet-f"><button class="btn btn-ghost" data-act="sh-no">'+esc(t('shNo'))+'</button><button class="btn btn-primary" data-act="sh-yes">'+esc(t('shYes'))+'</button></div>');
  sfx('error');
}
// Hakbang 2: isulat ang pangalan
function shortName(){
  const names=customers().sort((a,b)=>b.last-a.last).slice(0,8);
  openModal('<div class="sheet-h"><h2>'+esc(t('shNameT'))+'</h2><button class="icon-btn" data-act="close-modal" aria-label="'+esc(t('close'))+'">'+I.x+'</button></div>'+
  '<div class="sh-box sm"><div class="sh-r"><span>'+esc(t('shPaid'))+'</span><b>'+fmt(SHORT.cash)+'</b></div><div class="sh-r kl"><span>'+esc(t('shLeft'))+'</span><b>'+fmt(SHORT.left)+'</b></div></div>'+
  '<div class="stack"><div class="hint">'+esc(t('shNameP'))+'</div>'+
  '<div class="field"><label for="sh-name">'+esc(t('debtorName'))+'</label><input class="inp" id="sh-name" maxlength="40" placeholder="'+esc(t('debtorPh'))+'" autocomplete="off"></div>'+
  (names.length?'<div class="name-chips">'+names.map(c=>'<button type="button" data-act="sh-pick" data-n="'+esc(c.name)+'">'+esc(c.name)+'</button>').join('')+'</div>':'')+
  dueField('due-short')+
  '<div class="notice" id="sh-note">'+esc(t('shNew',fmt(SHORT.left),fmt(SHORT.cash)))+'</div></div>'+
  '<div class="sheet-f"><button class="btn btn-ghost" data-act="sh-back">'+esc(t('back'))+'</button><button class="btn btn-primary" id="sh-ok" data-act="sh-save" disabled>'+esc(t('shSave'))+'</button></div>');
  const n=$('#sh-name');
  n.addEventListener('input',shortCheck);
  n.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(!$('#sh-ok').disabled)shortSave()}});
  setTimeout(()=>n.focus(),60);
}
function shortCheck(){
  const n=$('#sh-name'),ok=$('#sh-ok'),note=$('#sh-note');if(!n||!ok)return;
  const name=n.value.trim(),c=customers().find(x=>x.key===name.toLowerCase());
  if(note)note.textContent=c&&c.bal>0.004?t('shHas',c.name,fmt(c.bal),fmt(SHORT.left),fmt(r2(c.bal+SHORT.left))):t('shNew',fmt(SHORT.left),fmt(SHORT.cash));
  ok.disabled=name.length<2;
}
// Hakbang 3: itala ang benta (bayad na bahagi = cash, ang kulang = utang) at ipakita ang UTANG RESIBO
function shortSave(){
  const n=$('#sh-name');if(!n)return;
  let cust=n.value.trim();if(cust.length<2)return;
  const total=SHORT.total,paid=SHORT.cash,left=r2(total-paid);
  if(!(paid>0)||!(left>0.004)||!S.cart.length){closeModal();return}
  const ex=customers().find(x=>x.key===cust.toLowerCase());if(ex)cust=ex.name;
  if(utangBlockNew(cust))return;                                     // Guest: hanggang 75 na tao
  const dueDays=readDays('due-short');
  const lines=[];
  for(const l of S.cart){
    const it=byId(l.id);if(!it)continue;
    if(it.stockOn&&(Number(it.stock)||0)<l.qty){toast(t('stockShort',it.name),{kind:'err'});return}
    lines.push({id:it.id,name:it.name,price:it.price,qty:l.qty});
  }
  const realTotal=r2(lines.reduce((a,l)=>a+l.qty*l.price,0));
  if(Math.abs(realTotal-total)>0.004||realTotal<=paid){closeModal();return}   // nagbago ang cart: ibalik sa Bayad
  lines.forEach(l=>{const it=byId(l.id);if(it.stockOn)it.stock=Math.max(0,(Number(it.stock)||0)-l.qty)});
  const by=curBy(),ts=Date.now(),sale={id:uid(),ts,lines,total,method:'utang',customer:cust,paid,by};
  S.sales.unshift(sale);
  if(S.sales.length>500){if(S.role!=='cashier')gcFoldSales(S.sales.slice(500));S.sales.length=500}
  const dId=uid();
  S.debts.push({id:dId,ts,name:cust,type:'utang',amount:total,saleId:sale.id,by,due:dueStamp(dueDays,ts),note:lines.map(l=>l.name+' ×'+l.qty).join(', ')});
  // ang binayad na bahagi: ibawas sa mga item ayon sa pagkakasunod (kaya may "Kulang" sa item at sa resibo)
  let rest=paid;const ia={},full=[];
  lines.forEach((l,i)=>{if(rest<=0.004)return;const tot=r2(l.qty*l.price),give=r2(Math.min(rest,tot));ia[i]=give;rest=r2(rest-give);if(give>=tot-0.004)full.push(i)});
  const pay={id:uid(),ts:ts+1,name:cust,type:'bayad',amount:paid,for:dId,grp:uid(),tendered:paid,by,ia,sp:true,sid:sale.id};
  if(full.length)pay.items=full;
  S.debts.push(pay);
  S.cart=[];save();closeModal();S.lastSale=sale;
  const c=customers().find(x=>x.key===cust.toLowerCase());
  toast(t('debtRecorded',cust),{sub:t('shDone',fmt(paid),fmt(left))+(c?' · '+t('totalDebtHim',fmt(c.bal)):''),ms:4200});sfx('success');
  const low=lines.map(l=>byId(l.id)).filter(it=>it&&it.stockOn&&(Number(it.stock)||0)<=(Number(it.warn)||0));
  if(low.length)setTimeout(()=>toast(t('stockLowNow'),{kind:'warn',sub:low.slice(0,3).map(i=>i.name+' ('+i.stock+')').join(', '),ms:3200}),500);
  askNotif();lkAfterSale(sale);checkDue();renderNav();updateSell();
  rcOpen(rcModelSale(sale),null,null);                               // UTANG RESIBO
}
// Para saan: resibo ng benta na kulang ang bayad: ipakita ang Binayad at Kulang, at ang natitirang utang pagkatapos ng bayad
const _rcSaleV125=rcModelSale;
rcModelSale=function(s){
  const m=_rcSaleV125(s);
  if(s.method==='utang'&&salePaid(s)>0){
    const pay=S.debts.find(x=>x.sid===s.id&&x.type==='bayad');
    if(pay){
      const left=r2(s.total-salePaid(s)),bi=m.ex.findIndex(x=>x[2]==='bal');
      if(bi>=0)m.ex[bi]=[m.ex[bi][0],fmt(rcBalAt(pay)),'bal'];
      const at=bi>=0?bi:m.ex.length;
      m.ex.splice(at,0,[t('shRcPaid'),fmt(salePaid(s))],[t('shRcLeft'),fmt(left)]);
      const dd=S.debts.find(x=>x.saleId===s.id);
      if(dd){const st=rcDebtState(dd);m.status=rcStatus(st.paid,st.left)}
    }
  }
  return m;
};
// Para saan: sa listahan ng benta, ipakita ang bayad na bahagi
const _saleRow125=saleRow;
saleRow=function(s,del){
  const h=_saleRow125(s,del);
  if(!(s.method==='utang'&&salePaid(s)>0))return h;
  return h.replace('</div><div class="what">','<span class="chip ok">'+esc(t('payPaidSoFar',fmt(salePaid(s))))+'</span></div><div class="what">');
};
// Para saan: kapag binura ang benta, burahin din ang bayad na kasama nito
const _deleteSale125=deleteSale;
deleteSale=function(id){
  const keep=S.debts.filter(d=>d.sid!==id);
  if(keep.length!==S.debts.length)S.debts=keep;
  return _deleteSale125(id);
};
Object.assign(ACTIONS,{
  'sh-no':()=>{const c=SHORT.cash;openCheckout();const i=$('#cash');if(i){i.value=c;validatePay()}},     // Hindi: balik sa Bayad
  'sh-yes':()=>{shortName()},
  'sh-back':()=>{shortAsk(SHORT.cash,SHORT.total)},
  'sh-pick':b=>{const n=$('#sh-name');if(n){n.value=b.dataset.n;shortCheck()}},
  'sh-save':()=>{shortSave()}
});

/* =============== 2) SYNC: "KUNIN ANG DATA NG IBANG DEVICE" LANG =============== */
xfHtml=function(){
  const out=xfOut();
  return '<div id="xf-box">'+
    '<div class="set-sec"><span class="lbl">'+esc(t('syGetT'))+'</span><div class="hint" style="margin-bottom:8px">'+esc(t('syGetP'))+'</div>'+
    '<div class="row"><input class="inp" id="xf-get-in" placeholder="'+esc(t('xfGetIn'))+'" maxlength="7" autocapitalize="characters" autocomplete="off" spellcheck="false" style="text-transform:uppercase;letter-spacing:.08em"><button type="button" class="btn btn-primary" id="xf-getgo" data-act="xf-get">'+esc(t('xfGetGo'))+'</button></div>'+
    '<div class="err" id="xf-err2" role="alert"></div>'+
    out.filter(x=>x.rq).map(x=>'<div class="hint xf-wait">⏳ '+esc(t(x.acc?'xfWaitData':'xfWaitAns',x.to))+'</div>').join('')+
    '<div class="xf-mine" style="margin-top:14px"><small>'+esc(t('xfMine'))+'</small><b id="xf-mine">'+esc(xfMyCode()||'—')+'</b><button type="button" class="btn btn-ghost" data-act="xf-copy" style="min-height:34px;padding:0 12px;font-size:13px">'+esc(t('xfCopy'))+'</button></div>'+
    '<div class="hint" style="margin-top:6px">'+esc(t('syMineP'))+'</div></div></div>';
};

/* =============== 3) ADMIN: SA TAAS, UNA BAGO ANG NOTIFICATION =============== */
// Para saan: ilagay (o alisin) ang Admin button sa taas, bago ang bell. Para sa Admin / Dev lang.
function topAdm(){
  const tr=document.querySelector('.top-right');if(!tr)return;
  const adm=typeof ibIsAdmin==='function'&&ibIsAdmin(),old=document.getElementById('top-adm');
  if(!adm){if(old)old.remove();return}
  if(old)return;
  const b=document.createElement('button');
  b.id='top-adm';b.type='button';b.className='icon-btn adm';b.dataset.act='page';b.dataset.p='admin';
  b.setAttribute('aria-label','Admin');b.title='Admin';b.innerHTML=I.shield;
  const bell=tr.querySelector('.bell');tr.insertBefore(b,bell||null);
}
renderNav=function(){
  const nv=$('#nav');if(!nv)return;
  const n=owing().length;
  const tabs=[['sell',t('sell'),I.cart],['inv',t('inv'),I.box],['utang',t('utang'),I.book],['sales',t('sales'),I.chart]];
  nv.classList.remove('n5');                                                // wala na ang Admin sa baba
  nv.style.setProperty('--ni',Math.max(0,tabs.findIndex(x=>x[0]===S.tab)));
  nv.innerHTML=tabs.map(x=>'<button data-act="tab" data-t="'+x[0]+'"'+(S.tab===x[0]?' aria-current="page"':'')+'>'+x[2]+'<span>'+x[1]+'</span>'+(x[0]==='utang'&&n?'<span class="dot">'+n+'</span>':'')+'</button>').join('');
  topAdm();
};
const _showApp125=showApp;
showApp=function(){_showApp125.apply(this,arguments);topAdm()};

/* =============== 4) TAP SFX: MP3 SA SFX/ =============== */
const TAPMP3={files:{pop:'SFX/tap.mp3',up:'SFX/tap-up.mp3',down:'SFX/tap-down.mp3',tab:'SFX/tap-tab.mp3',ok:'SFX/tap-ok.mp3',no:'SFX/tap-no.mp3'},buf:{},loading:false,fail:false};
// Para saan: i-load ang mga mp3 ng tap (isang beses). Kapag hindi makuha, babalik sa dating synth na tunog.
async function tapLoad(){
  if(TAPMP3.loading||TAPMP3.fail)return;
  const c=tapCtx();if(!c)return;
  TAPMP3.loading=true;
  try{
    await Promise.all(Object.keys(TAPMP3.files).map(async k=>{
      const r=await fetch(TAPMP3.files[k]);if(!r.ok)throw new Error('HTTP '+r.status);
      const ab=await r.arrayBuffer();
      TAPMP3.buf[k]=await new Promise((ok,no)=>{const p=c.decodeAudioData(ab,ok,no);if(p&&p.catch)p.catch(no)});
    }));
  }catch(e){TAPMP3.fail=true}
  TAPMP3.loading=false;
}
const _tapSynth125=tapSound;
tapSound=function(kind){
  if(prefs.sound===false)return;
  const b=TAPMP3.buf[kind]||TAPMP3.buf.pop;
  if(!b){if(!TAPMP3.fail)tapLoad();return _tapSynth125(kind)}          // habang naglo-load (o kung hindi makuha): dating tunog
  const now=performance.now();if(now-TAPFX.at<45)return;TAPFX.at=now;
  const c=tapCtx();if(!c)return;
  try{
    const s=c.createBufferSource(),g=c.createGain();
    s.buffer=b;s.playbackRate.value=.94+Math.random()*.12;g.gain.value=.5;
    s.connect(g);g.connect(c.destination);s.start();
  }catch(e){_tapSynth125(kind)}
};
document.addEventListener('pointerdown',function f(){document.removeEventListener('pointerdown',f,true);if(prefs.sound!==false)tapLoad()},true);

/* =============== 5) TindaMo AI =============== */
const K_AI=u=>'tindamo:ai:'+u;
const AI={u:null,msgs:null,busy:false,reply:null,lastReq:null,aurl:{},from:'message'};
const AIR={rec:null,chunks:[],stream:null,t0:0,timer:0,cancel:false,mime:''};
const aiCfg=()=>window.TINDAMO_AI||{};
const aiFmt=s=>esc(String(s||'')).replace(/\*\*([^*\n]+)\*\*/g,'<b>$1</b>');
const aiDur=ms=>{const s=Math.max(1,Math.round((Number(ms)||0)/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
// Para saan: ang usapan kay TindaMo AI (naka-save sa phone, bawat account)
function aiRead(){
  if(AI.msgs&&AI.u===S.user)return AI.msgs;
  AI.u=S.user;AI.msgs=[];
  try{const a=readJSON(K_AI(S.user),[]);if(Array.isArray(a))AI.msgs=a}catch(e){}
  return AI.msgs;
}
function aiWrite(){
  const a=aiRead().filter(m=>!m.err);
  if(a.length>60)a.splice(0,a.length-60);
  a.forEach((m,i)=>{if(m.img&&i<a.length-6){m.img='';m.hadImg=1}});            // para hindi mapuno ang phone: ang huling 6 lang ang may larawan
  const keep=a.map(m=>Object.assign({},m));
  let s=JSON.stringify(keep);
  while(s.length>1800000&&keep.length>2){keep.shift();s=JSON.stringify(keep)}
  try{store.set(K_AI(S.user),s)}catch(e){}
}
// Para saan: maikling listahan ng items ng tindahan para makapagbigay ng tamang payo sa presyo
const aiItems=()=>S.items.slice(0,40).map(i=>({n:String(i.name||'').slice(0,40),p:Number(i.price)||0,s:i.stockOn?(Number(i.stock)||0):null}));
function aiMsgHtml(m){
  const mine=m.from==='user';
  const q=m.rt?'<div class="ai-q"><b>'+esc(m.rf==='user'?t('ibYou'):t('aiT'))+'</b><span>'+esc(m.rt)+'</span></div>':'';
  const img=m.img?'<img class="ib-img" data-act="ib-img" src="'+esc(m.img)+'" alt="'+esc(t('aiPhoto'))+'" draggable="false">':(m.hadImg?'<div class="ib-img gone">'+esc(t('imgGone'))+'</div>':'');
  const vo=m.voice?'<div class="ai-voice">'+(AI.aurl[m.id]?'<button type="button" class="ai-play" data-act="ai-play" data-id="'+esc(m.id)+'" aria-label="Play">'+I.play+'</button>':'<span class="ai-mic-i">'+I.mic+'</span>')+'<span>'+esc(t('aiVoice'))+' · '+aiDur(m.voice)+'</span></div>':'';
  const all=aiRead(),last=all[all.length-1]===m;
  return '<div class="ib-m '+(mine?'me':'th')+(m.err?' warn':'')+'" data-aid="'+esc(m.id)+'">'+(!mine?'<small>'+esc(t('aiT'))+'</small>':'')+
    '<div class="ib-b"'+(m.err?'':' data-act="ai-msg" data-id="'+esc(m.id)+'"')+'>'+q+img+vo+(m.text?'<span>'+aiFmt(m.text)+'</span>':'')+
    (m.err&&last?'<button type="button" class="btn btn-ghost ai-retry" data-act="ai-retry">'+esc(t('aiRetry'))+'</button>':'')+'</div>'+
    '<em>'+esc(dstr(m.ts))+'</em></div>';
}
function aiEmptyHtml(){
  return '<div class="ai-empty"><div class="ai-orb">'+I.spark+'</div><p>'+esc(t('aiHello'))+'</p><div class="ai-chips">'+
    ['aiC1','aiC2','aiC3','aiC4'].map(k=>'<button type="button" class="ib-chip" data-act="ai-chip" data-q="'+esc(t(k))+'">'+esc(t(k))+'</button>').join('')+'</div></div>';
}
function aiDraw(stick){
  const c=$('#ai-chat');if(!c)return;
  const m=aiRead(),near=c.scrollHeight-c.scrollTop-c.clientHeight<90;
  c.innerHTML=(m.length?m.map(aiMsgHtml).join(''):aiEmptyHtml())+(AI.busy?dotsMsg():'');
  if(near||stick)c.scrollTop=c.scrollHeight;
  const go=$('#ai-go');if(go)go.disabled=AI.busy;
}
function aiBarDraw(){
  const o=$('#ai-rpb');if(o)o.remove();
  const comp=$('#ai-comp');if(!comp||!AI.reply)return;
  comp.insertAdjacentHTML('beforebegin','<div id="ai-rpb" class="ib-rpb"><div><b>'+esc(t('mpReply')+' · '+(AI.reply.from==='user'?t('ibYou'):t('aiT')))+'</b><span>'+esc(String(AI.reply.text||'').slice(0,90))+'</span></div><button class="icon-btn" data-act="ai-bar-x" aria-label="'+esc(t('cancel'))+'">'+I.x+'</button></div>');
}
// Para saan: buksan ang chat kay TindaMo AI
function openAiChat(from){
  if(from)AI.from=from;
  S.page='ai';
  openModal('<div class="ib-top"><button class="icon-btn" data-act="ai-back" aria-label="'+esc(t('back'))+'">'+I.chevL+'</button><h2>'+esc(t('aiT'))+'</h2>'+
    '<button class="icon-btn sm" data-act="ai-clear" aria-label="'+esc(t('aiClearYes'))+'" title="'+esc(t('aiClearYes'))+'">'+I.trash+'</button></div>'+
    '<div id="ai-body" class="ib-full"><div class="ib-chat" id="ai-chat"></div>'+
    '<div class="ib-comp" id="ai-comp"><button class="icon-btn ib-att" data-act="ai-att" aria-label="'+esc(t('imgT'))+'">'+I.img+'</button>'+
      '<textarea class="inp" id="ai-in" rows="1" maxlength="1000" placeholder="'+esc(t('aiPh'))+'"></textarea>'+
      '<button class="icon-btn ib-att ai-mic" data-act="ai-mic" aria-label="'+esc(t('aiVoice'))+'">'+I.mic+'</button>'+
      '<button class="btn btn-primary ib-go" id="ai-go" data-act="ai-send" aria-label="'+esc(t('mSend'))+'">'+I.send+'</button></div>'+
    '<div class="ib-comp ai-rec" id="ai-rec" hidden><button class="icon-btn ib-att" data-act="ai-rec-x" aria-label="'+esc(t('cancel'))+'">'+I.x+'</button>'+
      '<div class="ai-rec-m"><i class="ai-dot"></i><b id="ai-rec-t">0:00</b><span>'+esc(t('aiRecT'))+'</span></div>'+
      '<button class="btn btn-primary ib-go" data-act="ai-rec-ok" aria-label="'+esc(t('mSend'))+'">'+I.send+'</button></div></div>');
  fullSheet();aiDraw(true);
}
// Para saan: itanong sa AI server (hinihintay ang sagot na may typing dots)
async function aiAsk(){
  const rq=AI.lastReq;if(!rq||AI.busy)return;
  AI.busy=true;aiDraw(true);
  let out=null,err='';
  try{
    const cfg=aiCfg();
    if(!cfg.url)throw Object.assign(new Error('NOURL'),{k:'aiNoSrv'});
    if(!navigator.onLine)throw Object.assign(new Error('OFFLINE'),{k:'aiOffline'});
    const all=aiRead(),ix=all.findIndex(x=>x.id===rq.id);
    const hist=all.slice(Math.max(0,ix-12),Math.max(0,ix)).filter(x=>x.text&&!x.err).map(x=>({role:x.from==='user'?'user':'assistant',text:String(x.text).slice(0,600)}));
    const body={v:1,lang:prefs.lang,store:S.store||'',items:aiItems(),hist,text:rq.text||'',img:rq.img||null,audio:rq.audio||null,reply:rq.reply||null};
    const h={'Content-Type':'application/json'};
    try{if(typeof clToken==='function'&&clOn()){const tk=await clToken();if(tk)h.Authorization='Bearer '+tk}}catch(e){}
    const c=new AbortController(),to=setTimeout(()=>c.abort(),60000);
    let r;
    try{r=await fetch(cfg.url,{method:'POST',headers:h,body:JSON.stringify(body),signal:c.signal})}
    catch(e){throw Object.assign(new Error('NET'),{k:e&&e.name==='AbortError'?'aiSlow':'aiFail'})}
    finally{clearTimeout(to)}
    if(!r.ok)throw Object.assign(new Error('HTTP '+r.status),{k:r.status===401||r.status===403?'aiAuth':r.status===429?'aiLimit':'aiFail'});
    out=await r.json();
    if(!out||typeof out.reply!=='string'||!out.reply.trim())throw Object.assign(new Error('EMPTY'),{k:'aiFail'});
  }catch(e){err=(e&&e.k)||'aiFail'}
  AI.busy=false;
  const all=aiRead(),um=all.find(x=>x.id===rq.id);
  if(out&&out.transcript&&um&&um.voice&&!um.text)um.text=String(out.transcript).slice(0,1000);
  if(err)all.push({id:uid(),from:'ai',text:t(err),ts:Date.now(),err:1});
  else{AI.lastReq=null;all.push({id:uid(),from:'ai',text:String(out.reply).slice(0,4000),ts:Date.now()});sfx('scan')}
  aiWrite();aiDraw(true);
}
// Para saan: ipadala ang tanong. o={text,img,audio:{blob,mime,b64,ms}}
function aiSend(o){
  if(AI.busy)return;
  const text=String(o.text||'').trim().slice(0,1000);
  if(!text&&!o.img&&!o.audio)return;
  const all=aiRead(),id=uid(),m={id,from:'user',text:o.audio?'':text,ts:Date.now()};
  if(o.img)m.img=o.img;
  if(o.audio){m.voice=o.audio.ms;try{AI.aurl[id]=URL.createObjectURL(o.audio.blob)}catch(e){}}
  const rp=AI.reply;AI.reply=null;aiBarDraw();
  if(rp){m.rt=String(rp.text||'').replace(/\*\*/g,'').slice(0,80);m.rf=rp.from}
  all.push(m);aiWrite();
  AI.lastReq={id,text:o.audio?'':text,img:o.img||'',audio:o.audio?{mime:o.audio.mime,b64:o.audio.b64}:null,reply:rp?{from:rp.from,text:String(rp.text||'').replace(/\*\*/g,'').slice(0,300)}:null};
  aiDraw(true);aiAsk();
}
function aiSendText(){
  const el=$('#ai-in');if(!el||AI.busy)return;
  const v=el.value.trim();if(!v)return;
  el.value='';el.style.height='auto';aiSend({text:v});
}
/* ---------- voice ---------- */
const blobB64=b=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(',')[1]||'');r.onerror=no;r.readAsDataURL(b)});
function aiRecUi(on){const a=$('#ai-comp'),b=$('#ai-rec');if(a)a.hidden=on;if(b)b.hidden=!on;const t0=$('#ai-rec-t');if(t0)t0.textContent='0:00'}
async function aiRecStart(){
  if(AIR.rec||AI.busy)return;
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder){toast(t('aiNoMic'),{kind:'err'});return}
  let st;
  try{st=await navigator.mediaDevices.getUserMedia({audio:true})}catch(e){toast(t('aiMicDeny'),{kind:'err',ms:4200});return}
  const types=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'];
  const mt=types.find(x=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(x))||'';
  let rec;
  try{rec=new MediaRecorder(st,mt?{mimeType:mt}:undefined)}catch(e){st.getTracks().forEach(x=>x.stop());toast(t('aiNoMic'),{kind:'err'});return}
  AIR.rec=rec;AIR.stream=st;AIR.chunks=[];AIR.cancel=false;AIR.t0=Date.now();AIR.mime=mt;
  rec.ondataavailable=e=>{if(e.data&&e.data.size)AIR.chunks.push(e.data)};
  rec.onstop=async()=>{
    const ms=Date.now()-AIR.t0,cancel=AIR.cancel,chunks=AIR.chunks;
    try{AIR.stream.getTracks().forEach(x=>x.stop())}catch(e){}
    clearInterval(AIR.timer);AIR.rec=null;AIR.stream=null;AIR.chunks=[];
    aiRecUi(false);
    if(cancel)return;
    if(ms<700||!chunks.length){toast(t('aiTooShort'),{kind:'warn'});return}
    const blob=new Blob(chunks,{type:(rec.mimeType||mt||'audio/webm').split(';')[0]});
    if(blob.size>6*1024*1024){toast(t('aiFail'),{kind:'err'});return}
    let b64='';try{b64=await blobB64(blob)}catch(e){}
    if(!b64){toast(t('aiFail'),{kind:'err'});return}
    aiSend({audio:{blob,mime:blob.type,b64,ms}});
  };
  try{rec.start()}catch(e){try{st.getTracks().forEach(x=>x.stop())}catch(_){}AIR.rec=null;toast(t('aiNoMic'),{kind:'err'});return}
  aiRecUi(true);buzz(40);
  AIR.timer=setInterval(()=>{
    if(!AIR.rec||!$('#ai-rec')){aiRecStop(true);return}                     // sinara ang chat habang nagre-record
    const el=Date.now()-AIR.t0,x=$('#ai-rec-t');if(x)x.textContent=aiDur(el).replace(/^0:00$/,'0:01');
    if(el>=60000)aiRecStop(false);                                           // hanggang 1 minuto
  },250);
}
function aiRecStop(cancel){
  if(!AIR.rec)return;
  AIR.cancel=!!cancel;
  try{if(AIR.rec.state!=='inactive')AIR.rec.stop();else AIR.rec.onstop()}catch(e){try{AIR.rec.onstop()}catch(_){}}
}
Object.assign(ACTIONS,{
  'ai-open':b=>{openAiChat('message')},
  'ai-back':()=>{aiRecStop(true);if(AI.from==='message'){openPage('message')}else closeModal()},
  'ai-send':()=>{aiSendText()},
  'ai-chip':b=>{aiSend({text:b.dataset.q})},
  'ai-mic':()=>{aiRecStart()},
  'ai-rec-x':()=>{aiRecStop(true)},
  'ai-rec-ok':()=>{aiRecStop(false)},
  'ai-att':()=>{popSheet(t('imgT'),[[t('attCam'),'ai-cam',I.cam],[t('attGal'),'ai-gal',I.img]])},
  'ai-cam':()=>{aiPhoto(true)},
  'ai-gal':()=>{aiPhoto(false)},
  'ai-retry':()=>{
    const all=aiRead(),i=all.findIndex(x=>x.err);if(i>=0)all.splice(i,1);
    if(AI.lastReq)aiAsk();else aiDraw(true);
  },
  'ai-bar-x':()=>{AI.reply=null;aiBarDraw()},
  'ai-msg':b=>{
    const id=b.dataset.id,m=aiRead().find(x=>x.id===id);if(!m||m.err)return;
    popSheet(t('aiT'),[[t('mpReply'),'ai-reply',I.reply,'',' data-id="'+esc(id)+'"'],[t('mpCopy'),'ai-copy',I.receipt,'',' data-id="'+esc(id)+'"']]);
  },
  'ai-reply':b=>{
    const m=aiRead().find(x=>x.id===b.dataset.id);if(!m)return;
    AI.reply={from:m.from,text:m.text||(m.img?t('imgLabel'):(m.voice?t('aiVoice'):''))};aiBarDraw();
    const el=$('#ai-in');if(el)el.focus();
  },
  'ai-copy':b=>{const m=aiRead().find(x=>x.id===b.dataset.id);if(m&&m.text)msgCopy(m.text)},
  'ai-play':b=>{
    const u=AI.aurl[b.dataset.id];if(!u)return;
    try{if(AI.audio){AI.audio.pause()}AI.audio=new Audio(u);AI.audio.play().catch(()=>{})}catch(e){}
  },
  'ai-clear':()=>{popSheet(t('aiClearQ'),[[t('aiClearYes'),'ai-clear-yes',I.trash,'danger']],'<p class="hint ps-p">'+esc(t('aiClearP'))+'</p>')},
  'ai-clear-yes':()=>{AI.msgs=[];AI.u=S.user;AI.reply=null;AI.lastReq=null;aiWrite();aiBarDraw();aiDraw(true)}
});
async function aiPhoto(cam){
  if(AI.busy)return;
  try{
    const img=await imgPick(cam,900,0.62,false),el=$('#ai-in'),v=el?el.value.trim():'';
    if(el){el.value='';el.style.height='auto'}
    aiSend({text:v,img});
  }catch(e){}
}
document.addEventListener('keydown',e=>{
  if(e.target&&e.target.id==='ai-in'&&e.key==='Enter'&&!e.shiftKey){e.preventDefault();aiSendText()}
});
document.addEventListener('input',e=>{
  if(e.target&&e.target.id==='ai-in'){e.target.style.height='auto';e.target.style.height=Math.min(120,e.target.scrollHeight)+'px'}
});
// Para saan: pindutin ang "AI Tulong" sa Message (user: nasa ibabaw ng chat; admin: nasa taas)
function aiBanner(){
  if(S.page!=='message'||!S.user||S.role==='cashier')return;
  if(ibIsAdmin()){
    const top=document.querySelector('#modal .ib-top');
    if(top&&!top.querySelector('.ai-open')){
      const b=document.createElement('button');b.type='button';b.className='btn btn-ghost ai-open';b.dataset.act='ai-open';b.innerHTML=I.spark+'<span>'+esc(t('aiBanT'))+'</span>';
      top.insertBefore(b,top.querySelector('.ib-live')||null);
    }
    return;
  }
  const box=$('#ib-body');if(!box||box.querySelector('.ai-banner')||!$('#ib-chat'))return;
  const b=document.createElement('button');b.type='button';b.className='ai-banner';b.dataset.act='ai-open';
  b.innerHTML='<span class="ai-orb sm">'+I.spark+'</span><span class="ai-bt"><b>'+esc(t('aiBanT'))+'</b><small>'+esc(t('aiBanP'))+'</small></span><span class="ai-go">'+I.chevR+'</span>';
  box.insertBefore(b,box.firstChild);
}
const _ibDraw125=ibDraw;
ibDraw=function(){_ibDraw125.apply(this,arguments);try{aiBanner()}catch(e){}};
const _openMessage125=openMessage;
openMessage=function(){_openMessage125.apply(this,arguments);try{aiBanner()}catch(e){}};

/* ################################################################
   DATING V1.2.6  (isinama na sa v1.0.0)
   ################################################################ */
/* ============================================================
   ITO PARA SA MGA BAGO SA V1.2.6   [versions/v1.2.6.js]
   1) LOGIN "INCOMPLETE": ang ayos ay nasa auth.js (afterCloudLogin): subukan ulit ng 3 beses; kung sira pa rin at may data
      sa phone, pumasok at i-upload ulit nang buo; kung bagong phone na walang data, ipaalam ang dapat gawin (errBroken sa i18n.js).
   1b) PAGBAWI: clPullRecover (cloud.js) ay naghahanap ng pinakabagong buong grupo ng piraso kapag lipas ang meta.
   2) MAS LIGTAS NA UPLOAD: ang ayos ay nasa cloud.js (clPush): isang commit (lahat o wala) para sa backup na hanggang 8 piraso.
   Walang ibang code dito; ang version ay nasa version.js, version.json at package.json.
   ============================================================ */

/* ################################################################
   DATING V1.2.7  (isinama na sa v1.0.0)
   ################################################################ */
/* ============================================================
   ITO PARA SA MGA BAGO SA V1.2.7   [versions/v1.2.7.js]
   1) CREATE ACCOUNT NA TOTOONG EMAIL: auth.js (showVerify, startVerify, onVerifyDone). Verification email ng Firebase bago magawa ang account.
      Phone number ay hindi pa pwede sa Create account (errPhoneUp sa i18n.js).
   2) ADMIN: inbox.js (ibPing) nagsusulat ng 'via' (google/email/phone) sa /presence; makikita sa Admin > User. Kailangan ang bagong firestore.rules.
   3) PAPEL NA KASAYSAYAN NG UTANG: utang.js (paperHtml) at styles.css (.u-paper, .pl-*).
   Walang ibang code dito; ang version ay nasa version.js, version.json at package.json.
   ============================================================ */

/* ################################################################
   DATING V1.2.8  (isinama na sa v1.0.0)
   ################################################################ */
/* ============================================================
   ITO PARA SA MGA BAGO SA V1.2.8   [versions/v1.2.8.js]
   1) ROLE NG CASHIER: team.js (tmRoleOf, tmCanSell, tmCanEdit). Ang may-ari ang pumipili (Menu > Cashier > Role). Hinaharang ito sa
      sell.js (addToCart, openCheckout, completeSale), inventory.js (openProductForm, deleteProduct, onInvCode) at utang.js (payDebt, openManualDebt).
   2) LEAVE: team.js (tmLeaveAsk, tmLeave). Sa Profile ng cashier, ang "Mag-logout" ay "Leave". Ang may-ari ay inaabisuhan (shop.js: left sa box).
   3) GINAGAWA NG CASHIER: team.js (tmLog, tmOpen, tmDraw). Pindutin ang cart na button sa itaas ng Cart sa Sell (may-ari), o Menu > Cashier.
      Live cart: tmCartPush (cashier) at shop.js (shOwnerTick) na bumabasa sa box.
   4) PAREHONG ACCOUNT SA IBA'T IBANG DEVICE (phone, laptop, website): cloud.js (clLiveSync, clMergeIn). Ang benta sa isang device ay lalabas sa kabila (hal. Android at website) sa loob ng ~7 segundo.
   5) firestore.rules: dagdag na pagbura ng cashier sa sariling membership (opsyonal; hindi kailangan para gumana ang 1.2.8).
   ============================================================ */

/* ################################################################
   WEBSITE V1.0.0: update at "Ano ang bago?" para sa website (https://tindamo.app)
   - Sa browser/website: ang "update" ay i-refresh lang ang page. Binabasa ang version.json ng sarili mong site
     (hindi ang GitHub Releases) at dito rin kinukuha ang "min" at ang notes ng "Ano ang bago?".
   - Sa Android app (Capacitor): walang binago; GitHub pa rin ang ginagamit.
   ################################################################ */
if(!NATIVE.on){
  APP_VER.raw=['version.json'];                           // ginagamit ng pinakamababang version (min) check
  // Para saan: kunin ang version.json ng site na ito (laging bago, hindi galing sa cache)
  const webMeta=async()=>{try{const j=await verGet('version.json');return j&&j.version?j:null}catch(e){return null}};
  // Para saan: i-save ang notes ng version para lumabas sa "Ano ang bago?" (kahit offline)
  const webNotes=j=>{
    try{
      const v=String(j.version),c=readJSON(K_REL,{rels:{}});c.rels=c.rels||{};
      c.rels[relKey(v)]={tag:v,name:'',body:String(j.notes||''),date:'',url:''};
      store.set(K_REL,JSON.stringify({ts:Date.now(),rels:c.rels}));
    }catch(e){}
  };
  verFetchLatest=async function(){const j=await webMeta();if(!j)return '';webNotes(j);return String(j.version)};
  relLoad=async function(){const j=await webMeta();if(!j)return false;webNotes(j);return true};
  // Para saan: kunin ang pinakabagong files ng site (alisin ang lumang cache ng app), tapos i-reload
  window.webRefresh=async function(){
    try{
      if('serviceWorker' in navigator){const rs=await navigator.serviceWorker.getRegistrations();await Promise.all(rs.map(r=>r.unregister()))}
      if(window.caches){const ks=await caches.keys();await Promise.all(ks.filter(k=>/^tindamo-v|^tindamo-web/.test(k)).map(k=>caches.delete(k)))}
      const urls=['index.html'].concat([].slice.call(document.querySelectorAll('script[src],link[rel="stylesheet"]')).map(n=>n.getAttribute('src')||n.getAttribute('href')).filter(u=>u&&!/^(https?:)?\/\//.test(u)));
      await Promise.allSettled(urls.map(u=>fetch(u,{cache:'reload'})));      // palitan ang lumang kopya sa browser cache
    }catch(e){}
    location.reload();
  };
  ACTIONS['ver-update']=async function(){
    const v=$('#verbox');if(v)v.remove();
    if(!APP_VER.latest){await verCheck(true);return}                         // hindi pa alam: tingnan muna
    if(!verNewer()){toast(t('verWait',APP_VER.ver),{ms:4200});return}        // pinakabago na
    toast(t('verUpdate')+'...',{ms:1500});
    await window.webRefresh();
  };
}
