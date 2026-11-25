'use strict';
/* ============================================================
   ITO PARA SA BARCODE SCANNER   [scanner.js]
   Camera scanner, litrato ng barcode, at manual na type ng code.
   ============================================================ */

/* ---------- barcode scanner ---------- */
const FORMATS=['ean_13','ean_8','upc_a','upc_e','code_128','code_39','code_93','itf','codabar'];   // barcode lang: bawal ang QR
// Para saan: ZXing hints: barcode scanner = walang QR; QR scanner = QR lang
function zHints(){
  const B=ZXing.BarcodeFormat,H=new Map();
  H.set(ZXing.DecodeHintType.POSSIBLE_FORMATS,[B.EAN_13,B.EAN_8,B.UPC_A,B.UPC_E,B.CODE_128,B.CODE_39,B.CODE_93,B.ITF,B.CODABAR].filter(x=>x!==undefined));
  H.set(ZXing.DecodeHintType.TRY_HARDER,true);
  return H;
}
// Para saan: kunin lang ang tamang uri (QR mode = QR lang, barcode mode = hindi QR)
const okFmt=f=>isQR()?f==='qr_code':f!=='qr_code';
// Para saan: tama ba ang uri ng resulta ng ZXing (QR_CODE = 11)
const zOk=r=>{try{const f=r.getBarcodeFormat?r.getBarcodeFormat():r.format,q=f===ZXing.BarcodeFormat.QR_CODE;return isQR()?q:!q}catch(e){return true}};
const pickCode=r=>{const x=(r||[]).find(y=>okFmt(y.format));return x?x.rawValue:null};
let detector,detectorQ,zreader,zreaderQ,sc=null;
// Para saan: QR mode ba ang kasalukuyang scanner (pang-link ng cashier). Hiwalay ang reader at kahon nito sa barcode scanner ng Sell at Inventory.
const isQR=()=>!!(sc&&sc.opts&&sc.opts.qr);
// Para saan: native barcode detector (QR lang sa QR mode, para mabilis at hindi nalilito sa barcode)
function getDet(){
  if(isQR()){
    if(detectorQ!==undefined)return detectorQ;
    detectorQ=null;
    if('BarcodeDetector' in window){try{detectorQ=new BarcodeDetector({formats:['qr_code']})}catch(e){detectorQ=null}}
    return detectorQ;
  }
  if(detector!==undefined)return detector;
  detector=null;
  if('BarcodeDetector' in window){try{detector=new BarcodeDetector({formats:FORMATS})}catch(e){try{detector=new BarcodeDetector()}catch(x){detector=null}}}   // may filter pa rin sa pickCode
  return detector;
}
// Para saan: ZXing reader (QR reader sa QR mode)
function getReader(){
  if(isQR()){
    if(zreaderQ!==undefined)return zreaderQ;
    zreaderQ=null;
    if(window.ZXing){try{zreaderQ=new ZXing.BrowserQRCodeReader()}catch(e){zreaderQ=null}}
    return zreaderQ;
  }
  if(zreader!==undefined)return zreader;
  zreader=null;
  if(window.ZXing){try{zreader=new ZXing.BrowserMultiFormatReader(zHints())}catch(e){try{zreader=new ZXing.BrowserMultiFormatReader()}catch(x){zreader=null}}}
  return zreader;
}
// Para saan: basahin ang barcode sa larawan
async function decodeFile(file){
  const d=getDet();
  if(d){try{const bmp=await createImageBitmap(file);const c=pickCode(await d.detect(bmp));if(c)return c}catch(e){}}
  const z=getReader();
  if(z){
    const url=URL.createObjectURL(file);
    try{const r=await z.decodeFromImageUrl(url);if(zOk(r))return r.getText?r.getText():r.text}catch(e){}finally{URL.revokeObjectURL(url)}
  }
  return null;
}
// Para saan: basahin ang barcode sa video
async function decodeFrame(video){
  const d=getDet();
  if(d){return pickCode(await d.detect(video))}
  const z=getReader();
  if(z&&video.videoWidth){
    const c=sc.canvas||(sc.canvas=document.createElement('canvas'));
    const w=Math.min(720,video.videoWidth);c.width=w;c.height=Math.round(video.videoHeight*w/video.videoWidth);
    c.getContext('2d').drawImage(video,0,0,c.width,c.height);
    try{const r=await z.decodeFromImageUrl(c.toDataURL('image/jpeg',.7));return zOk(r)?(r.getText?r.getText():r.text):null}catch(e){return null}
  }
  return null;
}
// Para saan: HTML ng "kunan ng litrato ng barcode" (pang-backup kapag hindi mabuksan ang live camera)
const photoBtn=qr=>'<label class="btn btn-ghost sk-photo">'+I.cam+' '+esc(t(qr?'scPhotoQR':'scPhoto'))+'<input type="file" id="sc-file" accept="image/*" capture="environment" hidden></label>';
// Para saan: maliit na round button sa taas ng scanner
const skBtn=(act,id,aria,svg,hid)=>'<button class="sk-rb" '+(id?'id="'+id+'" ':'')+'data-act="'+act+'" aria-label="'+esc(aria)+'"'+(hid?' hidden':'')+'>'+svg+'</button>';
// Para saan: form para sa i-type na barcode
const skManual=hid=>'<form id="sc-manual" class="sk-manual" novalidate'+(hid?' hidden':'')+'><label class="sr" for="sc-code">'+esc(t('scBarcode'))+'</label><input class="inp mono" id="sc-code" placeholder="'+esc(t('scTypePh'))+'" autocomplete="off" inputmode="numeric"><button class="btn sk-ok" type="button" data-act="sc-go" data-enter>'+esc(t('scEnterBtn'))+'</button></form>';

// Para saan: buksan ang scanner. opts.cart=true → may listahan ng na-scan at Tapos button (Sell)
function openScanner(opts){
  closeScanner();
  const el=$('#scanner'),cartMode=!!opts.cart,qrMode=!!opts.qr&&!cartMode;
  el.className='sk'+(qrMode?' qr':'');
  el.innerHTML=
  '<div class="sk-stage" id="sc-stage">'+
    '<video id="sc-video" class="sk-video" playsinline muted autoplay disablepictureinpicture disableremoteplayback></video>'+
    '<div class="sk-view">'+(qrMode?
      '<div class="sk-win qr" id="sc-frame"><b class="sk-c tl"></b><b class="sk-c tr"></b><b class="sk-c bl"></b><b class="sk-c br"></b><i class="sk-pulse"></i></div>'
      :'<div class="sk-win" id="sc-frame"><b class="sk-n t"></b><b class="sk-n r"></b><b class="sk-n b"></b><b class="sk-n l"></b><i class="sk-laser"></i></div>')+'</div>'+
    '<div class="sk-top">'+skBtn('sc-close',null,t('scCloseAria'),I.x)+
      '<div class="sk-ttl"><strong>'+esc(cartMode?t('scTitle'):(opts.title||t('scTitle')))+'</strong><span id="sc-sub"></span></div>'+
      skBtn('sc-flash','sc-flash',t('scFlash'),I.bolt,true)+skBtn('sc-sound','sc-snd',t('scSound'),prefs.sound===false?I.mute:I.vol)+'</div>'+
    '<div class="sk-perm" id="sc-perm" hidden><div class="sk-pi">'+I.cam+'</div><p id="sc-permtxt"></p>'+
      '<div class="sk-pa"><button class="btn sk-retry" data-act="sc-retry">'+esc(t('scRetry'))+'</button>'+photoBtn(qrMode)+'</div></div>'+
    '<div class="sk-float"><div class="sk-msg" id="sc-msg"></div><div class="sk-last" id="sc-last" hidden></div></div>'+
  '</div>'+
  '<div class="sk-dock">'+(cartMode?
    '<div class="sk-opts"><button class="sk-auto" id="sc-auto" role="switch" aria-checked="false" data-act="sc-auto"><span class="sk-sw"><i></i></span><span>'+esc(t('scAutoLbl'))+'</span></button>'+
      '<button class="sk-key" data-act="sc-manual-toggle">'+I.keypad+'<span>'+esc(t('scEnterCode'))+'</span></button></div>'+
    skManual(true)+
    '<button class="sk-go" id="sc-shoot" data-act="sc-shoot">'+I.scan+'<span id="sc-shl"></span></button>'+
    '<div class="sk-sum"><button class="sk-cartbtn" data-act="sc-list" aria-label="'+esc(t('scListAria'))+'">'+I.cart+'<span class="sk-cnt" id="sc-cnt">0</span><span class="sk-tot" id="sc-tot"></span>'+I.down+'</button>'+
      '<button class="sk-fin" id="sc-done" data-act="sc-done" disabled>'+esc(t('scDone'))+' '+I.check+'</button></div>'
  :(qrMode?'<p class="sk-qrhint">'+esc(t('scQrHint'))+'</p>':skManual(false)))+'</div>'+
  (cartMode?'<div class="sk-drawer" id="sc-drawer" hidden><div class="sk-back" data-act="sc-list"></div><div class="sk-panel">'+
    '<div class="sk-ph"><h3>'+esc(t('scItems'))+'</h3>'+skBtn('sc-list',null,t('close'),I.down).replace('class="sk-rb"','class="sk-rb sm"')+'</div><div class="sk-list" id="sc-list"></div></div></div>':'');
  el.classList.add('open');
  sc={opts,cart:cartMode,mode:cartMode?(prefs.scanMode==='tap'?'tap':'cont'):'cont',armUntil:0,stream:null,timer:null,last:'',lastAt:0,alive:true,miss:Date.now(),warned:false,flashId:null,looping:false,perm:false,zoom:null,lastT:null};
  $('#sc-file').addEventListener('change',async e=>{
    const f=e.target.files&&e.target.files[0];e.target.value='';if(!f)return;
    hidePerm();setMsg(t('scReading'));
    const code=await decodeFile(f);
    if(code){setMsg('');onDetected(code,true)}else{setMsg(t('scNoRead'));sfx('error');buzz(BUZZ_ERR)}
  });
  updateScUI();
  if(cartMode)renderScCart();
  startCamera();
}
// Para saan: mensahe sa scanner (walang lalabas habang binubuksan ang camera)
function setMsg(m){const e=$('#sc-msg');if(e)e.textContent=m||''}
// Para saan: i-refresh ang itsura ng scanner ayon sa mode (Pindot / Auto)
function updateScUI(){
  if(!sc)return;
  const tap=sc.mode==='tap',armed=sc.armUntil>Date.now();
  const sub=$('#sc-sub');if(sub)sub.textContent=sc.cart?(tap?t('scAim'):t('scAutoMsg')):(sc.opts.qr?t('scAimQR'):t('scAimBox'));
  const au=$('#sc-auto');if(au)au.setAttribute('aria-checked',String(!tap));
  const go=$('#sc-shoot');
  if(go){go.classList.toggle('auto',!tap);go.classList.toggle('busy',tap&&armed);go.disabled=!tap}
  const l=$('#sc-shl');if(l)l.textContent=tap?(armed?t('scScanning'):t('scGo')):t('scAutoLive');
  const fr=$('#sc-frame');if(fr)fr.classList.toggle('live',!tap||armed);
}
// Para saan: iguhit ang listahan ng na-scan (parehong cart ng Sell)
function renderScCart(){
  if(!sc||!sc.cart)return;
  const lines=cartLines(),total=cartTotal(),count=lines.reduce((a,x)=>a+x.l.qty,0);
  const list=$('#sc-list'),ly=list?list.scrollTop:0;   // V27: huwag bumalik sa taas ang listahan
  if(list)list.innerHTML=lines.length?lines.map(({l,it})=>
    '<div class="sk-line'+(sc.flashId===it.id?' new':'')+'" data-id="'+esc(it.id)+'">'+thumb(it)+
    '<div class="sk-nm"><b>'+esc(it.name)+'</b><span>'+fmt(it.price)+' × '+l.qty+'</span></div>'+
    '<div class="sk-q"><button data-act="dec" data-id="'+esc(it.id)+'" aria-label="'+esc(t('dec'))+'">'+(l.qty===1?I.trash:I.minus)+'</button><output>'+l.qty+'</output><button data-act="inc" data-id="'+esc(it.id)+'" aria-label="'+esc(t('inc'))+'">'+I.plus+'</button></div>'+
    '<div class="sk-amt">'+fmt(r2(l.qty*it.price))+'</div></div>').join('')
  :'<div class="sk-empty"><b>'+esc(t('scNothing'))+'</b>'+esc(t('scNothingSub'))+'</div>';
  if(list)list.scrollTop=ly;
  const c=$('#sc-cnt');if(c)c.textContent=count;
  const tt=$('#sc-tot');if(tt)tt.textContent=fmt(total);
  const d=$('#sc-done');if(d)d.disabled=!lines.length;
  if(sc.flashId){
    const f=lines.find(x=>x.it.id===sc.flashId),box=$('#sc-last');
    if(f&&box){
      box.innerHTML=thumb(f.it)+'<div><b>'+esc(f.it.name)+'</b><span>'+fmt(f.it.price)+' × '+f.l.qty+' = '+fmt(r2(f.l.qty*f.it.price))+'</span></div>';
      box.hidden=false;clearTimeout(sc.lastT);const me=sc;me.lastT=setTimeout(()=>{if(sc===me&&box)box.hidden=true},2600);
    }
    if(list){const n=list.querySelector('.new');if(n&&n.scrollIntoView)n.scrollIntoView({block:'nearest'})}
    sc.flashId=null;
  }
}
// Para saan: ipakita ang paliwanag kapag hindi mabuksan ang camera (at ang paraan para ayusin)
function showPerm(key,noRetry,detail){
  if(!sc)return;
  sc.perm=true;
  const p=$('#sc-perm'),x=$('#sc-permtxt');if(!p||!x)return;
  x.textContent=t(key);p.hidden=false;
  let d=$('#sc-permdbg');if(!d){d=document.createElement('small');d.id='sc-permdbg';d.style.cssText='display:block;margin-top:8px;color:#8d97a6;font-size:12px';x.after(d)}
  d.textContent=detail||'';
  const r=p.querySelector('.sk-retry');if(r)r.hidden=!!noRetry;
  $('#scanner').classList.add('sk-off');
}
// Para saan: itago ang paliwanag
function hidePerm(){
  if(sc)sc.perm=false;
  const p=$('#sc-perm');if(p)p.hidden=true;
  $('#scanner').classList.remove('sk-off');
}
// Para saan: patayin ang camera para hindi ito maubos sa battery
function stopStream(me){
  if(!me)return;
  if(me.stream)me.stream.getTracks().forEach(x=>x.stop());
  me.stream=null;
  const v=$('#sc-video');if(v){v.classList.remove('on');try{v.srcObject=null}catch(e){}}
}
// Para saan: buksan ang camera (humihingi ng permiso, naka-1x zoom)
async function startCamera(){
  const me=sc;if(!me)return;
  hidePerm();
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||window.isSecureContext===false){
    showPerm('scCamHttps',true);return;
  }
  try{
    const stream=await camStream(!!me.opts.qr);
    if(sc!==me){stream.getTracks().forEach(x=>x.stop());return}
    if(!getDet()&&!getReader()){stream.getTracks().forEach(x=>x.stop());showPerm('scNoReader',true);return}
    me.stream=stream;
    const v=$('#sc-video');v.srcObject=stream;await v.play();
    if(sc!==me)return;
    v.classList.add('on');
    me.zoom=await lock1x(stream);
    const tr=stream.getVideoTracks()[0],cp=tr&&tr.getCapabilities?tr.getCapabilities():{};
    if(cp.torch){const fb=$('#sc-flash');if(fb)fb.hidden=false}
    if(!me.looping){me.looping=true;loop()}
  }catch(e){
    if(sc!==me)return;
    showPerm(location.protocol==='file:'&&camErrKey(e)!=='scCamDenied'?'scCamHttps':camErrKey(e),false,location.protocol+' · '+(e&&e.name||'error'));
  }
}
// Para saan: tuloy-tuloy na pagbasa (sa Pindot mode, magbabasa lang kapag pinindot ang button)
async function loop(){
  if(!sc||!sc.alive)return;
  const v=$('#sc-video'),me=sc,now=Date.now();
  const tap=me.cart&&me.mode==='tap';
  if(tap&&me.armUntil&&now>me.armUntil){me.armUntil=0;updateScUI();setMsg(t('scTapMiss'));sfx('error');buzz(BUZZ_ERR);setTimeout(()=>{if(sc===me&&!me.armUntil)setMsg('')},1800)}
  const live=!tap||me.armUntil>now;
  if(live&&v&&v.readyState>=2&&me.stream){try{const code=await decodeFrame(v);if(code&&sc===me&&me.alive)onDetected(code)}catch(e){}}
  if(sc===me&&me.alive&&!tap&&!me.warned&&me.stream&&Date.now()-me.miss>6000){me.warned=true;sfx('error');buzz(BUZZ_ERR);setMsg(t('scBlurry'))}
  if(sc===me&&me.alive)me.timer=setTimeout(loop,tap?140:220);
}
// Para saan: may nabasang code
function onDetected(code,manual){
  code=String(code).trim();if(!code||!sc)return;
  const now=Date.now(),o=sc.opts;
  const tapShot=sc.cart&&sc.mode==='tap';
  if(!manual&&!tapShot&&code===sc.last&&now-sc.lastAt<1800)return;
  sc.last=code;sc.lastAt=now;sc.miss=now;sc.warned=false;sc.armUntil=0;
  setMsg('');updateScUI();
  if(!o.continuous&&!o.cart){                                 // isang scan lang: isara, vibrate, tapos ibigay ang code
    if(!o.silent)sfx('scan');buzz(BUZZ_OK);
    closeScanner();o.onCode(code);return;
  }
  const r=o.onCode(code),bad=(r===false);                     // false = mali / walang nahanap
  if(!o.silent){sfx(bad?'error':'scan');buzz(bad?BUZZ_ERR:BUZZ_OK)}   // (ang Sell ay may sarili nang tunog at vibrate)
  flashFrame(bad);
}
// Para saan: kumislap ang kahon: green kapag tama, red kapag mali, tapos babalik sa puti
function flashFrame(bad){
  const fr=$('#sc-frame');if(!fr||!sc)return;
  fr.classList.remove('hit','bad');void fr.offsetWidth;fr.classList.add(bad?'bad':'hit');
  clearTimeout(sc.flashT);const me=sc;me.flashT=setTimeout(()=>{if(sc===me&&fr)fr.classList.remove('hit','bad')},750);
}
// Para saan: isara ang scanner
function closeScanner(){
  if(cs&&cs.stream)cs.stream.getTracks().forEach(x=>x.stop());cs=null;
  if(sc){sc.alive=false;clearTimeout(sc.timer);clearTimeout(sc.lastT);clearTimeout(sc.flashT);stopStream(sc)}
  sc=null;const el=$('#scanner');el.classList.remove('open');el.className='';el.innerHTML='';
}
// Para saan: kapag lumipat ng app / nag-lock ng phone, bitawan ang camera; ibalik pagbalik
document.addEventListener('visibilitychange',()=>{
  if(!sc||!sc.alive)return;
  if(document.hidden)stopStream(sc);
  else if(!sc.stream&&!sc.perm)startCamera();
});

Object.assign(ACTIONS,{
  'sc-auto':()=>{if(!sc||!sc.cart)return;sc.mode=sc.mode==='tap'?'cont':'tap';sc.armUntil=0;sc.miss=Date.now();sc.warned=false;prefs.scanMode=sc.mode;savePrefs();setMsg('');updateScUI()},
  'sc-shoot':()=>{if(!sc||sc.mode!=='tap')return;sc.armUntil=Date.now()+3500;setMsg('');updateScUI()},
  'sc-retry':()=>{if(sc)startCamera()},
  'sc-sound':()=>{prefs.sound=prefs.sound===false;savePrefs();const b=$('#sc-snd');if(b)b.innerHTML=prefs.sound===false?I.mute:I.vol;if(prefs.sound!==false)sfx('scan')},
  'sc-flash':b=>{
    if(!sc||!sc.stream)return;const tr=sc.stream.getVideoTracks()[0],on=b.getAttribute('aria-pressed')!=='true';
    const adv=[{torch:on}];if(sc.zoom)adv.unshift({zoom:sc.zoom});
    tr.applyConstraints({advanced:adv}).then(()=>b.setAttribute('aria-pressed',String(on))).catch(()=>{b.hidden=true});
  },
  'sc-manual-toggle':()=>{const f=$('#sc-manual');if(!f)return;f.hidden=!f.hidden;if(!f.hidden){const i=$('#sc-code');i&&i.focus()}},
  'sc-list':()=>{const d=$('#sc-drawer');if(d)d.hidden=!d.hidden},
  'sc-done':()=>{closeScanner()}
});
