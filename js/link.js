'use strict';
/* ============================================================
   ITO PARA SA AUTO-LINK AT LOCATION   [link.js]
   Cashier -> may-ari: kusang napupunta ang bawat benta (at lokasyon) kahit walang internet.
   Kailangan lang na nasa iisang WiFi o hotspot ng may-ari ang dalawang phone. Isang beses i-scan ang QR, tapos tuloy-tuloy.
   Kahit anong phone/browser na may WebRTC (Chrome, Realme, Samsung, iPhone). Walang Quick Share.
   ============================================================ */

let LKS=[],LKP=null;   // LKS = mga naka-link na phone, LKP = kasalukuyang kinukonekta
const lkLive=()=>LKS.filter(p=>p.open&&p.dc&&p.dc.readyState==='open');

/* ---------- LOCATION (GPS gumagana kahit offline) ---------- */
// Para saan: kunin ang kasalukuyang GPS ng phone
function getLoc(){
  return new Promise(res=>{
    if(!navigator.geolocation)return res(null);
    navigator.geolocation.getCurrentPosition(p=>res({la:+p.coords.latitude.toFixed(6),lo:+p.coords.longitude.toFixed(6),ac:Math.round(p.coords.accuracy),ts:Date.now()}),()=>res(null),{enableHighAccuracy:true,timeout:8000,maximumAge:20000});
  });
}
// Para saan: layo (metro) ng dalawang lokasyon
function lkDist(a,b){const R=6371000,r=x=>x*Math.PI/180,h=Math.sin(r(b.la-a.la)/2)**2+Math.cos(r(a.la))*Math.cos(r(b.la))*Math.sin(r(b.lo-a.lo)/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
// Para saan: direksyon (N = hilaga) mula a papunta b
function lkArrow(a,b){
  const r=x=>x*Math.PI/180,dl=r(b.lo-a.lo),y=Math.sin(dl)*Math.cos(r(b.la)),x=Math.cos(r(a.la))*Math.sin(r(b.la))-Math.sin(r(a.la))*Math.cos(r(b.la))*Math.cos(dl);
  const k=Math.round(((Math.atan2(y,x)*180/Math.PI+360)%360)/45)%8;
  return '↑↗→↘↓↙←↖'[k]+' '+['N','NE','E','SE','S','SW','W','NW'][k];
}
// Para saan: linya ng lokasyon ng cashier sa listahan ng cashier (layo at direksyon mula sa iyo)
function lkLocHtml(c){
  const l=c.loc;if(!l)return '<div class="hint">GPS: '+esc(t('lkNoGps'))+'</div>';
  const me=S.myLoc;let s='';
  if(me){const d=lkDist(me,l);s=(d<1000?Math.round(d)+' m':(d/1000).toFixed(1)+' km')+' '+lkArrow(me,l)+' · '}
  return '<div class="hint">GPS: '+s+'<a href="geo:'+l.la+','+l.lo+'?q='+l.la+','+l.lo+'">'+esc(t('lkMap'))+'</a> · ±'+l.ac+' m · '+dstr(l.ts)+'</div>';
}
// Para saan: i-refresh ang sarili mong lokasyon para sa layo sa listahan
function lkMine(){getLoc().then(l=>{if(l){S.myLoc=l;if($('#cash-list'))drawCash()}})}

/* ---------- PAIRING: SDP na pinaliit para magkasya sa QR ---------- */
// Para saan: gawing maliit na text ang SDP (ufrag, pwd, fingerprint, IP:port)
function lkPack(sd){
  const g=r=>(sd.match(r)||[])[1]||'';
  const c=[...sd.matchAll(/a=candidate:\S+ \d+ udp \d+ (\S+) (\d+) typ host/g)].filter(m=>m[1].indexOf(':')<0).map(m=>m[1]+':'+m[2]).slice(0,3);
  return JSON.stringify({a:'tm',u:g(/a=ice-ufrag:(\S+)/),p:g(/a=ice-pwd:(\S+)/),f:g(/a=fingerprint:sha-256 (\S+)/).replace(/:/g,''),c});
}
// Para saan: ibalik sa buong SDP
function lkUnpack(txt,type){
  const o=JSON.parse(txt);if(o.a!=='tm'||!o.u||!o.p||!o.f||!o.c)throw new Error('bad');
  const fp=o.f.match(/../g).join(':');
  const lines=['v=0','o=- 1 2 IN IP4 127.0.0.1','s=-','t=0 0','a=group:BUNDLE 0','a=msid-semantic: WMS','m=application 9 UDP/DTLS/SCTP webrtc-datachannel','c=IN IP4 0.0.0.0','a=ice-ufrag:'+o.u,'a=ice-pwd:'+o.p,'a=fingerprint:sha-256 '+fp,'a=setup:'+(type==='offer'?'actpass':'active'),'a=mid:0','a=sctp-port:5000','a=max-message-size:262144'];
  o.c.forEach((x,i)=>{const k=x.lastIndexOf(':');lines.push('a=candidate:'+(i+1)+' 1 udp '+(2113937151-i)+' '+x.slice(0,k)+' '+x.slice(k+1)+' typ host')});
  lines.push('a=end-of-candidates');
  return {type,sdp:lines.join('\r\n')+'\r\n'};
}
// Para saan: hintayin matapos ang paghahanap ng IP (walang internet kaya mabilis)
const lkGather=pc=>new Promise(r=>{
  if(pc.iceGatheringState==='complete')return r();
  const f=()=>{if(pc.iceGatheringState==='complete'){pc.removeEventListener('icegatheringstatechange',f);r()}};
  pc.addEventListener('icegatheringstatechange',f);setTimeout(r,3500);
});
// Para saan: iguhit ang QR (gamit ang ZXing na naka-load na sa app)
function lkQR(txt){try{return new ZXing.BrowserQRCodeSvgWriter().write(txt,300,300).outerHTML}catch(e){return null}}
const lkHead=title=>'<div class="sheet-h"><h2>'+esc(title)+'</h2><button class="icon-btn" data-act="lk-cancel" aria-label="'+esc(t('close'))+'">'+I.x+'</button></div>';
const lkNew=()=>({pc:new RTCPeerConnection({iceServers:[]}),dc:null,buf:{},open:false,need:false,ui:false});

// Para saan: MAY-ARI: gumawa ng QR para i-scan ng cashier
async function lkOwnerStart(){
  if(!window.RTCPeerConnection){toast(t('lkNoRtc'),{kind:'err'});return}
  const p=lkNew();p.dc=p.pc.createDataChannel('tindamo');lkWire(p);p.ui=true;LKP=p;
  openModal(lkHead(t('lkOwner'))+'<p class="hint" id="lk-msg">'+esc(t('lkWait'))+'</p><div id="lk-qr"></div>');
  try{await p.pc.setLocalDescription(await p.pc.createOffer());await lkGather(p.pc)}catch(e){toast(t('lkNoRtc'),{kind:'err'});return}
  const q=lkQR(lkPack(p.pc.localDescription.sdp));
  if(!q){toast(t('lkNoQR'),{kind:'err'});closeModal();return}
  const m=$('#lk-msg'),b=$('#lk-qr');if(!m||!b)return;
  m.textContent=t('lkShowQR');
  b.innerHTML='<div class="lk-qr">'+q+'</div><button class="btn btn-dark btn-block" style="margin-top:12px" data-act="lk-scan-ans">'+esc(t('lkScanAns'))+'</button>';
}
// Para saan: MAY-ARI: i-scan ang sagot ng cashier
function lkScanAnswer(){
  openScanner({title:t('lkScanAns'),qr:true,onCode:c=>{
    try{LKP.pc.setRemoteDescription(lkUnpack(c,'answer')).then(()=>{const m=$('#lk-msg');if(m)m.textContent=t('lkWait')},()=>toast(t('lkBadQR'),{kind:'err'}))}
    catch(e){toast(t('lkBadQR'),{kind:'err'});sfx('error');buzz(BUZZ_ERR);return false}
  }});
}
/* V26: ang QR ng tindahan ay nasa shop.js (online). Ang lumang WiFi link sa ibaba ay hindi na ginagamit sa screen. */
function lkJoinQR(){if(typeof shopQR==='function')shopQR()}
// Para saan: CASHIER: i-scan ang QR ng may-ari, tapos ipakita ang sagot na QR (V24: kung wala pang tindahan, sasali muna nang kusa)
function lkCashierStart(join){
  if(!window.RTCPeerConnection){toast(t('lkNoRtc'),{kind:'err'});return}
  closeModal();
  openScanner({title:t(join?'cjScanT':'lkCash'),qr:true,onCode:async c=>{
    let off,info=null;try{off=lkUnpack(c,'offer');info=JSON.parse(c)}catch(e){toast(t('lkBadQR'),{kind:'err'});sfx('error');buzz(BUZZ_ERR);return false}
    if(join||!S.user){
      const nm=$('#c-name')?$('#c-name').value.trim():'';
      if(!info.k||!cashJoinQR(info,nm)){toast(t('lkBadQR'),{kind:'err'});sfx('error');buzz(BUZZ_ERR);return false}
    }
    const p=lkNew();p.pc.ondatachannel=e=>{p.dc=e.channel;lkWire(p)};
    try{await p.pc.setRemoteDescription(off);await p.pc.setLocalDescription(await p.pc.createAnswer());await lkGather(p.pc)}catch(e){toast(t('lkBadQR'),{kind:'err'});return}
    const q=lkQR(lkPack(p.pc.localDescription.sdp));
    if(!q){toast(t('lkNoQR'),{kind:'err'});return}
    LKP=p;p.ui=true;
    openModal(lkHead(t('lkCash'))+'<p class="hint">'+esc(t('lkShowAns'))+'</p><div class="lk-qr">'+q+'</div>');
  }});
}

/* ---------- DATA CHANNEL: padala at tanggap ---------- */
// Para saan: ikabit ang mga event ng channel
function lkWire(p){
  const d=p.dc;
  d.onopen=()=>lkOpened(p);d.onmessage=e=>lkRecv(p,String(e.data));d.onclose=()=>lkClosed(p);
  p.pc.onconnectionstatechange=()=>{if(/failed|closed|disconnected/.test(p.pc.connectionState))lkClosed(p)};
  if(d.readyState==='open')lkOpened(p);
}
// Para saan: nag-link na
function lkOpened(p){
  if(p.open)return;
  p.open=true;LKS.push(p);if(LKP===p)LKP=null;
  if(p.ui){p.ui=false;closeModal()}
  toast(t('lkOn'),{ms:3000});sfx('success');
  if($('#cash-qr')&&S.role!=='cashier')setTimeout(lkJoinQR,500);
  if(S.user&&S.role!=='cashier')lkSend(p,Object.assign(syncBuild(),{re:1}));   // may-ari: ipadala agad ang mga item at presyo
  else p.need=true;                                                           // cashier: ipapadala ang benta kapag naka-login na
}
// Para saan: nawala ang link
function lkClosed(p){
  if(!p.open)return;
  p.open=false;LKS=LKS.filter(x=>x!==p);try{p.pc.close()}catch(e){}
  toast(t('lkLost'),{kind:'warn',ms:5000,action:S.role==='cashier'||!S.user?{label:t('lkRelink'),fn:lkCashierStart}:null});
}
// Para saan: magpadala (hinihiwa sa maliliit na piraso para kayanin ng channel)
function lkSend(p,o){
  if(!p||!p.dc||p.dc.readyState!=='open')return false;
  const s=JSON.stringify(o),id=Date.now()+''+Math.floor(Math.random()*1e3),n=Math.max(1,Math.ceil(s.length/12000));
  try{for(let i=0;i<n;i++)p.dc.send(id+'|'+i+'|'+n+'|'+s.slice(i*12000,(i+1)*12000))}catch(e){return false}
  return true;
}
// Para saan: tanggapin at buuin ang mga piraso
function lkRecv(p,m){
  const a=m.split('|'),id=a[0],i=+a[1],n=+a[2],d=a.slice(3).join('|');
  const b=p.buf[id]||(p.buf[id]={n:0,parts:[]});
  if(b.parts[i]===undefined){b.parts[i]=d;b.n++}
  if(b.n===n){delete p.buf[id];let o=null;try{o=JSON.parse(b.parts.join(''))}catch(e){}lkHandle(p,o)}
}
// Para saan: ano ang gagawin sa dumating na mensahe
function lkHandle(p,o){
  if(!o)return;
  if(o.app==='tindamo-ping'){
    if(!S.user||S.role==='cashier')return;
    const users=readJSON(K_USERS,{});if((users[S.user]||{}).code!==o.code)return;
    const cd=cashData(S.user),c=cd.list.find(x=>x.name.toLowerCase()===String(o.cashier||'').toLowerCase());
    if(c){c.seen=Date.now();if(o.loc)c.loc=o.loc;cashSave(S.user,cd);if($('#cash-list'))drawCash()}
    return;
  }
  if(!syncValid(o))return;
  if(!S.user){syncBootstrap(o);return}                       // bagong phone ng cashier: kunin ang tindahan
  const users=readJSON(K_USERS,{});if((users[S.user]||{}).code!==o.code)return;
  if(S.role==='cashier')syncAsCashier(o);
  else{
    const known=new Set(S.sales.map(s=>s.id)),fresh=o.sales.filter(s=>s&&s.id&&!known.has(s.id)),sum=fresh.reduce((a,s)=>a+(Number(s.total)||0),0);
    syncAsOwner(o);
    if(fresh.length){toast(t('lkNew',o.cashier||'Cashier'),{sub:fmt(sum),ms:3500});sfx('success')}
    lkSend(p,Object.assign(syncBuild(),{re:1}));
  }
  save();S.cart=S.cart.filter(l=>byId(l.id));renderNav();
  if(!$('#modal').classList.contains('open')&&!$('#scanner').classList.contains('open'))renderView();
  checkDue();bellUpd();
}
// Para saan: CASHIER: ipadala ang lahat ng benta sa may-ari (walang madodoble, id ang basehan)
function lkPush(){if(S.role!=='cashier'||!S.user)return;lkLive().forEach(p=>lkSend(p,syncBuild()))}
// Para saan: CASHIER: maliit na "buhay pa ako" kasama ang lokasyon (tinatawag ng beat kada 15 segundo)
function lkPing(){
  if(S.role!=='cashier'||!S.user)return;
  const L=lkLive();getLoc().then(l=>{if(l)S.myLoc=l});
  if(!L.length)return;
  const b=syncBuild(),m={app:'tindamo-ping',code:b.code,cashier:b.cashier,loc:S.myLoc||null,ts:Date.now()};
  L.forEach(p=>lkSend(p,m));
}
// Para saan: pagkatapos ng benta: lagyan ng lokasyon at ipadala. Kapag walang link, naka-save lang at ipapasa pag naka-link ulit.
function lkAfterSale(sale){
  Promise.race([getLoc(),new Promise(r=>setTimeout(()=>r(null),3500))]).then(l=>{
    if(l)S.myLoc=l;
    if(S.myLoc){sale.loc=S.myLoc;save()}
    lkPush();
  });
}
// Para saan: ipadala ang naka-pila kapag bagong login ang cashier sa naka-link na phone
setInterval(()=>{if(S.user&&S.role==='cashier')LKS.forEach(p=>{if(p.open&&p.need){p.need=false;lkSend(p,syncBuild())}})},4000);

Object.assign(ACTIONS,{
  'lk-owner':()=>{lkOwnerStart()},
  'lk-qr-new':()=>{lkJoinQR()},
  'lk-cashier':()=>{lkCashierStart()},
  'lk-scan-ans':()=>{lkScanAnswer()},
  'lk-cancel':()=>{if(LKP&&!LKP.open){try{LKP.pc.close()}catch(e){}}LKP=null;closeModal()}
});
