'use strict';
/* ============================================================
   ITO PARA SA CASHIER   [cashier.js]
   Pagsali ng cashier gamit ang code, listahan ng cashier (online/offline), at heartbeat.
   ============================================================ */


/* ---------- 6 kahon para sa store code (hal. 5E2-HJ3): isang karakter bawat kahon, may - sa gitna ---------- */
// Para saan: iguhit ang 6 na kahon ng code
function otpHtml(){
  const box=i=>'<input class=\"otp-box\" inputmode=\"text\" maxlength=\"1\" placeholder=\" \" autocapitalize=\"characters\" autocomplete=\"off\" spellcheck=\"false\" data-i=\"'+i+'\" aria-label=\"'+(i+1)+'/6\">';
  let h='<div class=\"otp\" id=\"c-code\" role=\"group\" aria-labelledby=\"c-lbl\">';
  for(let i=0;i<6;i++){if(i===3)h+='<span class=\"otp-dash\" aria-hidden=\"true\"></span>';h+=box(i)}
  return h+'</div>';
}
// Para saan: kunin ang code mula sa mga kahon (hal. 5E2-HJ3)
function otpVal(){
  const v=[...document.querySelectorAll('#c-code .otp-box')].map(b=>b.value).join('');
  return v.length>3?v.slice(0,3)+'-'+v.slice(3):v;
}
// Para saan: ipakita ang code na naka-kahon (para sa Settings ng admin)
function codeBoxes(code){
  const c=String(code||'').replace(/[^A-Z0-9]/gi,'').toUpperCase().split('');
  return '<div class=\"otp show\" aria-label=\"'+esc(code)+'\">'+c.map((x,i)=>(i===3?'<span class=\"otp-dash\" aria-hidden=\"true\"></span>':'')+'<span class=\"otp-box\">'+esc(x)+'</span>').join('')+'</div>';
}
(function(){
  const boxes=el=>[...el.closest('.otp').querySelectorAll('.otp-box')];
  // Habang nagta-type / paste / autofill: ilagay ang bawat karakter sa sunod na kahon
  document.addEventListener('input',e=>{
    const el=e.target;if(!el.classList||!el.classList.contains('otp-box')||el.tagName!=='INPUT')return;
    const all=boxes(el),i=all.indexOf(el);
    const ch=el.value.toUpperCase().replace(/[^A-Z0-9]/g,'').split('');
    el.value=ch[0]||'';
    ch.slice(1).forEach((c,k)=>{if(all[i+1+k])all[i+1+k].value=c});
    const next=all[Math.min(i+ch.length,5)];
    if(ch.length&&next)next.focus();
    const e2=$('#a-err');if(e2)e2.textContent='';
  });
  document.addEventListener('keydown',e=>{
    const el=e.target;if(!el.classList||!el.classList.contains('otp-box')||el.tagName!=='INPUT')return;
    const all=boxes(el),i=all.indexOf(el);
    if(e.key==='Backspace'&&!el.value&&i>0){e.preventDefault();all[i-1].value='';all[i-1].focus()}
    else if(e.key==='ArrowLeft'&&i>0){e.preventDefault();all[i-1].focus()}
    else if(e.key==='ArrowRight'&&i<5){e.preventDefault();all[i+1].focus()}
  });
  document.addEventListener('focusin',e=>{const el=e.target;if(el.classList&&el.classList.contains('otp-box')&&el.tagName==='INPUT')el.select()});
})();

// Para saan: screen ng pagsali ng cashier
function showCashJoin(){
  app.innerHTML='<div class="auth"><div class="awning big"></div>'+backBtn()+'<img class="auth-logo" src="icons/icon-192.png" alt="TindaMo"><h1 class="brand">Tinda<b>Mo</b></h1><p class="lead">'+esc(t('cjLead'))+'</p>'+langPicker()+'<form class="stack" novalidate>'+
  '<button class="btn btn-primary btn-block" type="button" data-act="cash-scan" style="min-height:58px;font-size:17px">'+I.scan+' '+esc(t('cjScan'))+'</button>'+
  '<div class="or-line"><span>'+esc(t('cjOr'))+'</span></div>'+
  '<div class="field"><label id="c-lbl">'+esc(t('code'))+'</label>'+otpHtml()+'</div>'+
  '<div class="field"><label for="c-name">'+esc(t('cjNameOpt'))+'</label><input class="inp" id="c-name" maxlength="24" autocomplete="off" value="'+esc(prefs.cashName||'')+'"></div>'+
  '<div class="err" id="a-err" role="alert"></div>'+
  '<button class="btn btn-primary btn-block" type="button" data-act="cash-go" data-enter style="min-height:52px;font-size:16px">'+esc(t('join'))+'</button>'+
  '<button class="btn btn-ghost btn-block" type="button" data-act="auth-mode" data-m="in">'+esc(t('backSignin'))+'</button></form></div>';
}
// Para saan: pagsali gamit ang tinype na code: hahanapin online ang tindahan, tapos hihintayin ang Tanggapin ng may-ari (shop.js)
function onCashJoin(){shopJoinByCode()}

// Para saan: ipakita ang listahan ng cashier
function drawCash(){
  const box=$('#cash-list');if(!box)return;
  const d=cashData(S.user),now=Date.now();
  box.innerHTML=d.list.length?d.list.map(c=>{const on=c.seen&&now-c.seen<40000;
    return '<div class="pp"><div style="min-width:0"><div style="font-weight:600;overflow-wrap:anywhere">'+esc(c.name)+'</div><div class="hint">'+(c.seen?dstr(c.seen):'—')+(c.av?' · v'+esc(c.av):'')+'</div>'+(c.av&&!verSame(c.av)?'<div class="hint" style="color:var(--danger);font-weight:600">'+esc(t('verCashDiff',c.av))+'</div>':'')+lkLocHtml(c)+'</div><div class="row" style="align-items:center"><span class="chip '+(on?'ok':'')+'">'+(on?'● '+t('online'):t('offline'))+'</span><button class="chip tm-rchip" data-act="tm-role" data-id="'+c.id+'" aria-label="'+esc(t('tmRoleBtn'))+'">'+esc(tmRoleLabel(c.role))+' ▾</button><button class="icon-btn sm" data-act="cash-rm" data-id="'+c.id+'" aria-label="'+t('remove')+'">'+I.trash+'</button></div></div>'}).join('')
  :'<div class="hint" style="padding:12px 0">'+t('nocash')+'</div>';
}
// Para saan: heartbeat: para lumabas na online ang cashier
function beat(){
  if(S.role!=='cashier'||!S.user)return;
  lkPing();
  const d=cashData(S.user),c=d.list.find(x=>x.id===S.cid);
  if(c){c.seen=Date.now();cashSave(S.user,d)}else logout();
}

/* ---------- V26: i-scan ang QR ng may-ari -> request -> Tanggapin ng may-ari (shop.js) ---------- */
// Para saan: gumawa ng pangalan kung walang tinype ang cashier
const cashAutoName=()=>t('cashier')+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
Object.assign(ACTIONS,{
  'cash-scan':()=>{shopScanJoin()},
  'cash-go':()=>{onCashJoin()},
  'allow-toggle':()=>{const d=cashData(S.user);d.open=!d.open;cashSave(S.user,d);openCashierPage()},
  'cash-rm':b=>{const d=cashData(S.user);d.list=d.list.filter(x=>x.id!==b.dataset.id);cashSave(S.user,d);drawCash();if(typeof shRemoveCashier==='function')shRemoveCashier(b.dataset.id)}
});
