'use strict';
/* ============================================================
   ITO PARA SA MGA ACCOUNT SA DEVICE (CHANGE ACCOUNT)   [recent.js]
   Tinatandaan ang mga account na nag-login sa phone. Sa "Change account" lalabas ang listahan:
   pindutin para lumipat, o pindutin ang X para alisin sa listahan.
   ============================================================ */

const K_RECENT='tindamo:recent';
// Para saan: basahin ang listahan ng mga naka-save na account
const recList=()=>{const l=readJSON(K_RECENT,[]);return Array.isArray(l)?l:[]};
const recSave=l=>store.set(K_RECENT,JSON.stringify(l.slice(0,8)));
// Para saan: idagdag / i-refresh ang account sa listahan (tinatawag ng loadUser)
function recAdd(sess){
  try{
    if(!sess)return;
    const users=readJSON(K_USERS,{});let owner=sess,cid=null,cn='';
    if(sess.startsWith('c:')){const p=sess.split(':');owner=p[1];cid=p[2];const c=cashData(owner).list.find(x=>x.id===cid);cn=c?c.name:''}
    const u=users[owner];if(!u)return;
    const rec={s:sess,st:u.store||'',em:cid?cn:acctLabel(owner),r:cid?'c':'o',ts:Date.now()};
    recSave([rec].concat(recList().filter(x=>x.s!==sess)));
  }catch(e){}
}
// Para saan: alisin ang lahat ng entry ng isang account (kapag na-delete ang account)
function recDrop(owner){recSave(recList().filter(x=>x.s!==owner&&!x.s.startsWith('c:'+owner+':')))}
// Para saan: listahang ipapakita: unahin ang kasalukuyan, tapos ang pinakabago
function recView(){
  const cur=S.switchSess||'';
  return recList().slice().sort((a,b)=>(b.s===cur)-(a.s===cur)||b.ts-a.ts);
}
// Para saan: may naka-save pa bang session sa cloud ang account (kung oo, hindi na kailangan ng password)
const recHasToken=key=>{if(!clOn())return true;const s=readJSON(K_CLOUD(key),null);return !!(s&&s.refresh)};
// V1.2.3: bilog na profile pic ng account (kung may naka-save sa phone na ito); kung wala, kulay at unang letra
function recAv(a,nm){
  let av='';try{if(a.r!=='c'){const p=readJSON('tindamo:prof:'+a.s,{});av=(p&&p.av)||''}}catch(e){}
  return '<span class="avatar'+(av?' img':'')+'" style="--h:'+hue(nm)+(av?';background-image:url('+av+')':'')+'">'+(av?'':esc(nm.charAt(0).toUpperCase()))+'</span>';
}
// Para saan: ang HTML ng listahan sa login screen
function recHtml(){
  const l=recView();if(!l.length)return '';
  const cur=S.switchSess||'';
  return '<div class="rec-box"><span class="lbl">'+esc(t('accList'))+'</span>'+l.map((a,i)=>{
    const now=a.s===cur,nm=a.st||a.em||'?';
    return '<div class="rec"><button type="button" class="rec-main'+(now?' now':'')+'" data-act="rec-go" data-i="'+i+'">'+recAv(a,nm)+
      '<span class="rec-t"><b>'+esc(nm)+'</b><small>'+esc(a.em)+(a.r==='c'?' · '+esc(t('accCash')):'')+'</small></span>'+
      (now?'<span class="chip ok">'+esc(t('accNow'))+'</span>':'')+'</button>'+
      (now?'':'<button type="button" class="rec-x" data-act="rec-rm-ask" data-i="'+i+'" aria-label="'+esc(t('remove'))+'" title="'+esc(t('remove'))+'">'+I.x+'</button>')+'</div>'}).join('')+
    '</div><div class="or-line"><span>'+esc(t('accOther'))+'</span></div>';
}
// Para saan: lumipat sa napiling account
async function recGo(i){
  const a=recView()[i];if(!a)return;
  const users=readJSON(K_USERS,{});
  if(a.s===S.switchSess){ACTIONS['auth-back']();return}                  // ang kasalukuyan: balik lang
  if(CL&&CL.busy){try{await Promise.race([CL.busy,new Promise(r=>setTimeout(r,5000))])}catch(e){}}
  if(a.r==='c'){                                                          // cashier
    if(!loadUser(a.s)){recSave(recList().filter(x=>x.s!==a.s));toast(t('accGone'),{kind:'err'});showAuth();return}
    S.switchSess=null;store.set(K_SESSION,a.s);showApp();toast(t('accSwitched',a.st||a.em),{ms:2200});return;
  }
  if(!users[a.s]){recSave(recList().filter(x=>x.s!==a.s));toast(t('accGone'),{kind:'err'});showAuth();return}
  if(!recHasToken(a.s)){goLogin(a.s,t('accNeedPw',a.em));return}           // naka-logout na: password ulit
  if(clOn())clRestore(a.s);
  enter(a.s);setTimeout(clBoot,800);toast(t('accSwitched',a.st||a.em),{ms:2200});
}
Object.assign(ACTIONS,{
  'rec-go':b=>{recGo(+b.dataset.i)},
  'rec-rm-ask':b=>{const a=recView()[+b.dataset.i];if(!a)return;S.recRm=a.s;confirmBox(t('accRmQ'),esc(t('accRmP',a.st||a.em)),'rec-rm-yes',esc(t('accRmYes')))},
  'rec-rm-yes':()=>{
    const s=S.recRm;S.recRm=null;if(!s)return closeModal();
    recSave(recList().filter(x=>x.s!==s));
    if(!s.startsWith('c:')&&typeof clForget==='function'&&s!==S.switchSess)clForget(s);   // hindi na nakaka-login sa device na ito hangga't walang password
    closeModal();showAuth();toast(t('accRmDone'));
  }
});
