'use strict';
/* ============================================================
   ITO PARA SA RESIBO (PAPEL AT LARAWAN)   [receipt.js]   (V24)
   Resibo ng benta, ng utang, ng bayad at statement ng utang.
   Lumalabas bilang papel sa screen at maipapasa bilang LARAWAN (PNG), hindi lang text.
   ============================================================ */
const RC={cur:null,delId:null};

/* ---------- modelo ng resibo ---------- */
const rcWho=by=>by&&by.r==='c'?t('cashier')+(by.n?' - '+by.n:''):(by&&by.r==='o'?t('byOwner'):'');
const dKey=n=>String(n||'').trim().toLowerCase();
// Para saan: itakbo ang kasaysayan ng utang ng customer ayon sa oras. Ang bayad ay para sa pinakamatandang utang; ang sobra ay SUKLI (hindi nagiging credit)
function rcSim(d,stop){
  const k=dKey(d.name),ev=S.debts.map((x,i)=>({x,i})).filter(o=>dKey(o.x.name)===k).sort((a,b)=>a.x.ts-b.x.ts||(a.x.type==='utang'?-1:1)-(b.x.type==='utang'?-1:1)||a.i-b.i).map(o=>o.x);
  const q=[];let mine=null;
  for(const x of ev){
    if(x.type==='utang'){const o={x,left:x.amount};q.push(o);if(x===d||x.id===d.id)mine=o}
    else if(x.for){const i=q.findIndex(o=>o.x.id===x.for);if(i>=0){const o=q[i];o.left=r2(o.left-x.amount);if(o.left<=0.004){o.left=0;q.splice(i,1)}}}
    else{let r=x.amount;while(r>0.004&&q.length){const o=q[0];if(o.left<=r+1e-9){r=r2(r-o.left);o.left=0;q.shift()}else{o.left=r2(o.left-r);r=0}}}
    if(stop&&(x===d||x.id===d.id))break;
  }
  return {q,mine};
}
// Para saan: natitirang utang ng customer hanggang sa mismong galaw na ito
function rcBalAt(d){return r2(rcSim(d,true).q.reduce((a,o)=>a+o.left,0))}
// Para saan: kalagayan ng isang utang: ilan na ang nabayad
function rcDebtState(d){const m=rcSim(d,false).mine;return m?{paid:r2(d.amount-m.left),left:r2(m.left)}:{paid:0,left:d.amount}}
// Para saan: selyo sa resibo: Hindi Pa Bayad / Bahagyang Bayad / Fully Paid
function rcStatus(paid,left){return left<=0.004?{k:'paid',txt:t('rcFully')}:paid>0.004?{k:'part',txt:t('rcPartial')}:{k:'unpaid',txt:t('rcUnpaid')}}
// Para saan: resibo ng isang benta (cash o utang)
function rcModelSale(s){
  const debt=s.method==='utang',ex=[];let status=null,pi=new Set();
  if(debt){
    ex.push([t('rcName'),s.customer||'']);
    const dd=S.debts.find(x=>x.saleId===s.id);
    if(dd)ex.push([t('rcBal'),fmt(rcBalAt(dd)),'bal']);
    if(dd){const st=rcDebtState(dd);status=rcStatus(st.paid,st.left);pi=debtPaidIdx(dd)}
    if(dd&&dd.due)ex.push([t('rcDueD'),dueDate(dd.due)]);
  }else if(s.method==='gcash')ex.push([t('gcMethod'),'GCash'],[t('gcRefL'),s.ref||'—']);
  else if(s.cash!=null)ex.push([t('rcptCash'),fmt(s.cash)],[t('rcptChange'),fmt(r2(s.cash-s.total))]);
  return {title:debt?t('rcDebtT'):t('rcpt'),who:rcWho(s.by),ts:s.ts,rows:s.lines.map((l,i)=>({n:l.name,q:l.qty,p:l.price,a:r2(l.qty*l.price),ok:!!(debt&&((status&&status.k==='paid')||pi.has(i)))})),totalLbl:t('rcptTotal'),total:s.total,ex,foot:t('rcptThanks'),id:s.id,status};
}
// Para saan: resibo ng isang galaw sa utang (manual na utang, o bayad)
function rcModelDebt(d){
  if(d.type==='utang'&&d.saleId){const s=S.sales.find(x=>x.id===d.saleId);if(s)return rcModelSale(s)}
  const ex=[[t('rcName'),d.name]];
  if(d.type==='utang'){
    if(d.due)ex.push([t('rcDueD'),dueDate(d.due)]);
    ex.push([t('rcBal'),fmt(rcBalAt(d)),'bal']);
    const st=rcDebtState(d);
    return {status:rcStatus(st.paid,st.left),title:t('rcDebtT'),who:rcWho(d.by),ts:d.ts,rows:[{n:d.note||t('ledDebt'),q:1,p:d.amount,a:d.amount,ok:st.left<=0.004}],totalLbl:t('rcptTotal'),total:d.amount,ex,foot:t('rcptThanks'),id:d.id};
  }
  const recs=d.grp?S.debts.filter(x=>x.grp===d.grp).sort((a,b)=>a.ts-b.ts):[d],last=recs[recs.length-1],bal=rcBalAt(last),rows=[];
  const sum=r2(recs.reduce((a,x)=>a+x.amount,0));
  recs.forEach(r=>{
    const td=S.debts.find(x=>x.id===r.for),L=td&&debtLines(td);
    if(r.items&&L)r.items.forEach(i=>{const l=L[i];if(l)rows.push({n:l.name,q:l.qty,p:l.price,a:r2(l.qty*l.price),ok:true})});
    else if(td)rows.push({n:debtDesc(td)+' · '+dFmt(td.ts,{month:'short',day:'numeric'}),q:1,p:r.amount,a:r.amount,plain:true,ok:true});
  });
  if(d.change>0.004)ex.push([t('payApplied'),fmt(sum)],[t('payChange'),fmt(d.change),'chg']);
  ex.push([t('rcBal'),fmt(bal),'bal']);
  return {status:rcStatus(1,bal),title:t('rcPayT'),who:rcWho(d.by),ts:d.ts,rows,hdr:rows.length?t('payPaidFor'):undefined,totalLbl:t('payRecv'),total:d.tendered||sum,ex,foot:t('rcptThanks'),id:d.id};
}
// Para saan: statement ng lahat ng galaw ng isang customer
function rcModelStmt(c){
  const led=S.debts.filter(d=>dKey(d.name)===c.key&&!d.arch).sort((a,b)=>a.ts-b.ts);
  return {title:t('stmtT'),who:c.name,ts:Date.now(),rows:led.map(d=>({n:dFmt(d.ts,{month:'short',day:'numeric'})+' · '+(d.type==='utang'?(d.note||t('ledDebt')):t('ledPaid')),q:1,p:0,a:(d.type==='utang'?1:-1)*d.amount,plain:true})),hdr:t('history'),status:rcStatus(c.bal>0.004?0:1,c.bal),totalLbl:t('rcBal'),total:c.bal,ex:c.due&&c.bal>0.004?[[t('rcDueD'),dueDate(c.due)]]:[],foot:t('rcptThanks'),id:'stmt'};
}
const rcMoney=a=>(a<0?'−':'')+fmt(Math.abs(a));

/* ---------- papel sa screen ---------- */
function rcPaperHtml(m){
  const rows=m.rows.map(l=>'<div class="rc-l'+(l.ok?' rc-ok':'')+'"><span class="rc-n">'+(l.ok?'<i class="rc-ck">✓</i>':'')+esc(l.n)+(l.plain?'':'<small>'+l.q+' × '+fmt(l.p)+'</small>')+'</span><b'+(l.a<0?' class="rc-neg"':'')+'>'+rcMoney(l.a)+'</b></div>').join('');
  const sk=m.status?m.status.k:'';
  return '<div class="rc-wrap"><div class="rc-paper rc34">'+
    '<div class="rc-top"><span class="rc-logo">'+esc(String(S.store||'T').charAt(0).toUpperCase())+'</span><div class="rc-store">'+esc(S.store)+'</div><span class="rc-title">'+esc(m.title)+'</span></div>'+
    (m.who?'<div class="rc-who">'+esc(m.who)+'</div>':'')+
    (m.status?'<div class="rc-stamp-w"><span class="rc-stamp '+sk+'">'+esc(m.status.txt)+'</span></div>':'')+
    '<div class="rc-dt"><span>'+esc(dFmt(m.ts,{year:'numeric',month:'short',day:'numeric'}))+'</span><span>'+esc(tFmt(m.ts))+'</span></div>'+
    (rows?'<div class="rc-sep"></div><div class="rc-h">'+esc(m.hdr||t('rcItems'))+'</div>'+rows:'')+
    '<div class="rc-sep"></div><div class="rc-totbox"><span>'+esc(m.totalLbl)+'</span><b>'+fmt(m.total)+'</b></div>'+
    m.ex.map(x=>x[2]==='bal'?'<div class="rc-hl '+sk+'"><span>'+esc(x[0])+'</span><b>'+esc(x[1])+'</b></div>':x[2]==='chg'?'<div class="rc-hl chg"><span>'+esc(x[0])+'</span><b>'+esc(x[1])+'</b></div>':'<div class="rc-l"><span>'+esc(x[0])+(x[1]!==''?':':'')+'</span><b>'+esc(x[1])+'</b></div>').join('')+
    '<div class="rc-sep"></div><div class="rc-thx">'+esc(m.foot)+'</div><div class="rc-bar" aria-hidden="true">'+rcBarcode(m.id||'x')+'</div>'+
  '</div></div>';
}
// Para saan: palamuting guhit (parang barcode) na galing sa id ng resibo
function rcBarcode(id){let h=0,o='';for(let i=0;i<String(id).length;i++)h=(h*31+String(id).charCodeAt(i))>>>0;for(let i=0;i<38;i++){h=(h*1103515245+12345)>>>0;o+='<i style="flex:'+(1+(h>>>16)%3)+'"></i>'}return o}
// Para saan: buksan ang resibo sa screen
function rcOpen(m,delId,debId){
  RC.cur=m;RC.delId=delId||null;
  openModal('<div class="sheet-h"><h2>'+esc(m.title)+'</h2><button class="icon-btn" data-act="close-modal" aria-label="'+esc(t('close'))+'">'+I.x+'</button></div>'+rcPaperHtml(m)+
  '<div class="sheet-f">'+(delId&&S.role!=='cashier'?'<button class="btn btn-ghost" data-act="sale-del" data-id="'+esc(delId)+'" aria-label="'+esc(t('delSaleAria'))+'">'+I.trash+'</button>':(debId&&S.role!=='cashier'?'<button class="btn btn-ghost" data-act="debt-del" data-id="'+esc(debId)+'" aria-label="'+esc(t('delDebtQ'))+'">'+I.trash+'</button>':'<button class="btn btn-ghost" data-act="close-modal">'+esc(t('close'))+'</button>'))+'<button class="btn btn-primary" data-act="rc-img">'+esc(t('rcImg'))+'</button></div>');
}

/* ---------- larawan (canvas -> PNG) ---------- */
function rcWrap(c,text,maxW){
  const out=[];let line='';
  String(text).split(/\s+/).forEach(w=>{
    const tst=line?line+' '+w:w;
    if(c.measureText(tst).width<=maxW||!line)line=tst;else{out.push(line);line=w}
  });
  if(line)out.push(line);
  // napakahabang salita: putulin
  return out.flatMap(l=>{if(c.measureText(l).width<=maxW)return [l];const r=[];let s='';for(const ch of l){if(c.measureText(s+ch).width>maxW){r.push(s);s=ch}else s+=ch}if(s)r.push(s);return r});
}
// Para saan: iguhit ang resibo bilang papel na larawan (V34: bagong disenyo)
function rcCanvas(m){
  const W=640,PX=32,PW=W-PX*2,IN=34,MONO='ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',DISP="'Bricolage Grotesque',system-ui,sans-serif";
  const cv=document.createElement('canvas'),c=cv.getContext('2d');
  const plan=[];let y=0;
  const add=(h,fn)=>{plan.push({y,fn});y+=h};
  const L=PX+IN,R=W-PX-IN,CX=W/2,inner=PW-IN*2;
  const SC={paid:['#E3F5EC','#0B7A5A'],unpaid:['#FDE8EA','#C5192D'],part:['#FFF0DD','#A8460A']};
  const sc=m.status?SC[m.status.k]:['#F1EEE2','#1B1B1B'];
  // ulo: logo, pangalan, pamagat
  add(88,(g,y)=>{g.fillStyle='#FFC400';g.beginPath();g.arc(CX,y+38,32,0,Math.PI*2);g.fill();g.fillStyle='#1B1B1B';g.font='800 36px '+DISP;g.textAlign='center';g.fillText(String(S.store||'T').charAt(0).toUpperCase(),CX,y+51)});
  add(50,(g,y)=>{g.font='800 34px '+DISP;g.textAlign='center';g.fillStyle='#1B1B1B';g.fillText(S.store.slice(0,28),CX,y+34)});
  add(48,(g,y)=>{g.font='800 18px '+MONO;const T=String(m.title).toUpperCase(),w=g.measureText(T).width+44;g.fillStyle='#FFF1B8';rr(g,CX-w/2,y+4,w,34,17);g.fill();g.fillStyle='#7a5a00';g.textAlign='center';g.fillText(T,CX,y+27)});
  if(m.who){c.font='700 22px '+MONO;rcWrap(c,m.who,inner).forEach(l=>add(30,(g,y)=>{g.font='700 22px '+MONO;g.textAlign='center';g.fillStyle='#1B1B1B';g.fillText(l,CX,y+22)}))}
  if(m.status){add(66,(g,y)=>{
    g.font='800 24px '+MONO;const T=m.status.txt.toUpperCase(),w=g.measureText(T).width+40;
    g.translate(CX,y+34);g.rotate(-.045);g.strokeStyle=sc[1];g.fillStyle=sc[1];g.lineWidth=3.5;
    rr(g,-w/2,-23,w,46,9);g.stroke();rr(g,-w/2+5,-18,w-10,36,6);g.lineWidth=1.2;g.stroke();g.textAlign='center';g.fillText(T,0,8)})}
  add(38,(g,y)=>{g.font='500 20px '+MONO;g.fillStyle='#555';g.textAlign='left';g.fillText(dFmt(m.ts,{year:'numeric',month:'short',day:'numeric'}),L,y+26);g.textAlign='right';g.fillText(tFmt(m.ts),R,y+26)});
  const sep=()=>add(26,(g,y)=>{g.strokeStyle='#BDB8A8';g.lineWidth=2;g.setLineDash([8,6]);g.beginPath();g.moveTo(L,y+12);g.lineTo(R,y+12);g.stroke();g.setLineDash([])});
  if(m.rows.length){
    sep();add(30,(g,y)=>{g.font='700 17px '+MONO;g.textAlign='left';g.fillStyle='#6a6658';g.fillText(String(m.hdr||t('rcItems')).toUpperCase(),L,y+20)});
    m.rows.forEach(l=>{
      c.font='600 22px '+MONO;const lines=rcWrap(c,l.n,inner-150);
      lines.forEach((ln,i)=>add(30,(g,y)=>{g.font='600 22px '+MONO;g.textAlign='left';g.fillStyle=l.ok?'#0B7A5A':'#1B1B1B';g.fillText((l.ok&&i===0?'✓ ':'')+ln,L,y+22);if(i===0){g.textAlign='right';g.fillStyle=(l.a<0||l.ok)?'#0b7a5a':'#1B1B1B';g.font='700 22px '+MONO;g.fillText(rcMoney(l.a),R,y+22)}}));
      if(!l.plain)add(24,(g,y)=>{g.font='500 18px '+MONO;g.textAlign='left';g.fillStyle='#777';g.fillText(l.q+' × '+fmt(l.p),L,y+16)});
    });
  }
  sep();
  // malaking kabuuan
  add(80,(g,y)=>{g.fillStyle='#FFF6D6';rr(g,L-16,y+4,inner+32,68,16);g.fill();g.font='800 20px '+MONO;g.fillStyle='#6a5400';g.textAlign='left';g.fillText(String(m.totalLbl).toUpperCase(),L,y+45);g.textAlign='right';g.font='800 38px '+DISP;g.fillStyle='#1B1B1B';g.fillText(fmt(m.total),R,y+50)});
  m.ex.forEach(x=>{
    if(x[2]==='bal'||x[2]==='chg'){
      const col=x[2]==='chg'?['#E3F5EC','#0B7A5A']:sc;
      add(62,(g,y)=>{g.fillStyle=col[0];rr(g,L-16,y+4,inner+32,52,14);g.fill();g.font='700 20px '+MONO;g.fillStyle=col[1];g.textAlign='left';g.fillText(String(x[0]),L,y+37);g.textAlign='right';g.font='800 30px '+DISP;g.fillText(String(x[1]),R,y+40)});
    }else add(32,(g,y)=>{g.font='500 22px '+MONO;g.textAlign='left';g.fillStyle='#333';g.fillText(x[0]+(x[1]!==''?':':''),L,y+22);g.textAlign='right';g.font='700 22px '+MONO;g.fillText(String(x[1]),R,y+22)});
  });
  sep();
  add(34,(g,y)=>{g.font='600 20px '+MONO;g.textAlign='center';g.fillStyle='#555';g.fillText(m.foot,CX,y+22)});
  add(70,(g,y)=>{let h=0,x=L+40;const id=String(m.id||'x');for(let i=0;i<id.length;i++)h=(h*31+id.charCodeAt(i))>>>0;g.fillStyle='#1B1B1B';while(x<R-40){h=(h*1103515245+12345)>>>0;const w=2+(h>>>16)%4;g.fillRect(x,y+8,w,52);x+=w+2+(h>>>20)%3}});
  const TOP=26,PADT=34,PADB=44,ph=y+PADT+PADB,H=TOP+ph+TOP;
  cv.width=W*2;cv.height=H*2;c.scale(2,2);
  const bg=c.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#FFE27A');bg.addColorStop(1,'#FFB36B');c.fillStyle=bg;c.fillRect(0,0,W,H);
  c.save();c.shadowColor='rgba(0,0,0,.28)';c.shadowBlur=26;c.shadowOffsetY=10;c.fillStyle='#FFFEFA';
  c.beginPath();c.moveTo(PX,TOP);c.lineTo(W-PX,TOP);c.lineTo(W-PX,TOP+ph-14);
  const teeth=Math.round(PW/18),tw=PW/teeth;
  for(let i=0;i<teeth;i++){const x1=W-PX-i*tw;c.lineTo(x1-tw/2,TOP+ph);c.lineTo(x1-tw,TOP+ph-14)}
  c.closePath();c.fill();c.restore();
  plan.forEach(p=>{c.save();p.fn(c,TOP+PADT+p.y);c.restore()});
  return cv;
}
// Para saan: ipasa ang resibo bilang LARAWAN (Android share sheet / browser share / download)
async function rcShareImg(m){
  let blob=null;
  try{blob=await new Promise(r=>rcCanvas(m).toBlob(r,'image/png'))}catch(e){}
  if(!blob){toast(t('rcImgFail'),{kind:'warn'});return rcShareText(m)}
  const name='TindaMo-'+String(m.title).replace(/[^\w]+/g,'_')+'-'+new Date(m.ts).toISOString().slice(0,10)+'.png';
  if(NATIVE.on&&NATIVE.shareImage){
    try{
      const b64=await new Promise((ok,no)=>{const fr=new FileReader();fr.onload=()=>ok(String(fr.result).split(',')[1]);fr.onerror=no;fr.readAsDataURL(blob)});
      await NATIVE.shareImage(name,b64);return;
    }catch(e){if(/cancel/i.test(String((e&&e.message)||e)))return}
  }
  const file=new File([blob],name,{type:'image/png'});
  if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:S.store});return}catch(e){if(e&&e.name==='AbortError')return}}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500);toast(t('syncSaved'),{sub:name,ms:3000});
}
// Para saan: pang-ligtas na text kapag hindi nagawa ang larawan
function rcShareText(m){
  const L=[S.store,m.title,m.who||'',m.status?'['+m.status.txt+']':'',dFmt(m.ts,{year:'numeric',month:'short',day:'numeric'})+' '+tFmt(m.ts),'------------------------'];
  m.rows.forEach(l=>L.push(l.n+(l.plain?'':' ×'+l.q)+'  '+rcMoney(l.a)));
  L.push('------------------------',m.totalLbl+': '+fmt(m.total));m.ex.forEach(x=>L.push(x[0]+': '+x[1]));L.push('',m.foot);
  const text=L.filter((x,i)=>x!==''||i>4).join('\n');
  try{if(navigator.share)return navigator.share({title:S.store,text})}catch(e){}
  try{navigator.clipboard.writeText(text);toast(t('rcptCopied'))}catch(e){}
}
Object.assign(ACTIONS,{
  'rc-img':()=>{if(RC.cur)rcShareImg(RC.cur)},
  'led-open':b=>{const d=S.debts.find(x=>x.id===b.dataset.id);if(d)rcOpen(rcModelDebt(d),null,d.arch?null:d.id)},
  'stmt-share':b=>{const c=customers().find(x=>x.key===b.dataset.k);if(c)rcShareImg(rcModelStmt(c))},
  'stmt-open':b=>{const c=customers().find(x=>x.key===b.dataset.k);if(c)rcOpen(rcModelStmt(c))}
});
