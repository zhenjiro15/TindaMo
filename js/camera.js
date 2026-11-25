'use strict';
/* ============================================================
   ITO PARA SA CAMERA, CROP AT STICKER   [camera.js]
   Pagkuha ng larawan ng produkto at paggawa ng sticker.
   ============================================================ */

/* ---------- camera, crop, sticker ---------- */
let cs=null,cr=null;
// V1.1: tandaan kung sticker ON o OFF (naka-save sa prefs)
let stkWant=(typeof prefs!=='undefined'&&prefs.stk===false)?false:true;
// Para saan: isara ang camera overlay
function ovClose(){closeScanner()}
// Para saan: hingin ang camera. Laging ang MAIN na likod na camera (1x) ang pipiliin, hindi ang ultra-wide (0.5x / 0.6x) o macro.
// Tatlong hakbang: (1) basahin ang pangalan ng camera, (2) kung hindi malinaw, subukan ang bawat likod na camera at piliin ang may autofocus
// at pinakamababang numero (ang main camera ng Android ay halos laging pinakamababa), (3) tandaan ang napili para mabilis na sa susunod.
const CAM_BAD=/ultra|wide|tele|macro|depth|bokeh|mono|infrared|\bir\b|0\.5|0\.6|0\.7|zoom/i;
const CAM_KEY='tindamo:cam';
const camNum=l=>{const m=String(l||'').match(/(\d+)/);return m?+m[1]:99};
async function camStream(hiRes){
  const W=hiRes?1920:1280;
  const open=c=>navigator.mediaDevices.getUserMedia({video:c,audio:false});
  const hard=['NotAllowedError','SecurityError','NotFoundError','NotReadableError'];
  let st;
  try{st=await open({facingMode:{ideal:'environment'},width:{ideal:W}})}
  catch(e){if(hard.includes(e.name))throw e;st=await open(true)}
  try{
    // may permiso na, kaya mababasa na ang pangalan ng mga camera
    const curId=(st.getVideoTracks()[0].getSettings()||{}).deviceId;
    const devs=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput'&&d.deviceId);
    let back=devs.filter(d=>/back|rear|environment|likod/i.test(d.label));
    if(!back.length)back=devs.filter(d=>!/front|user|selfie|harap/i.test(d.label));
    const good=back.filter(d=>!CAM_BAD.test(d.label));
    let cand=(good.length?good:back).sort((a,b)=>camNum(a.label)-camNum(b.label)||a.label.localeCompare(b.label,undefined,{numeric:true}));
    if(!cand.length)return st;
    let pick=null,saved=null;
    try{saved=localStorage.getItem(CAM_KEY)}catch(e){}
    if(saved&&cand.some(d=>d.deviceId===saved))pick=saved;
    else if(cand.length===1)pick=cand[0].deviceId;
    else{
      // maraming likod na camera at walang malinaw na pangalan: subukan ang bawat isa (isa-isang bukas para hindi magbanggaan)
      st.getTracks().forEach(x=>x.stop());st=null;
      let best=null;
      for(const d of cand.slice(0,4)){
        try{
          const t0=await open({deviceId:{exact:d.deviceId}});
          const tr=t0.getVideoTracks()[0],cp=tr.getCapabilities?tr.getCapabilities():{};
          const af=cp.focusMode&&cp.focusMode.indexOf&&cp.focusMode.indexOf('continuous')>=0;
          const px=((cp.width&&cp.width.max)||0)*((cp.height&&cp.height.max)||0);
          t0.getTracks().forEach(x=>x.stop());
          const sc0=(af?1e9:0)+px/1e3-camNum(d.label)*1e4;   // autofocus muna, tapos pinakamababang numero
          if(!best||sc0>best.sc)best={id:d.deviceId,sc:sc0};
        }catch(e){}
      }
      pick=best?best.id:cand[0].deviceId;
    }
    if(pick&&pick!==curId){
      if(st){st.getTracks().forEach(x=>x.stop());st=null}
      try{st=await open({deviceId:{exact:pick},width:{ideal:W}})}catch(e){st=null}
    }else if(!st){try{st=await open({deviceId:{exact:pick},width:{ideal:W}})}catch(e){st=null}}
    if(st&&pick){try{localStorage.setItem(CAM_KEY,pick)}catch(e){}}
  }catch(e){}
  if(!st){try{st=await open({facingMode:{ideal:'environment'},width:{ideal:W}})}catch(e){st=await open(true)}}
  return st;
}
// Para saan: aling paliwanag ang ipapakita ayon sa error ng camera
function camErrKey(e){
  const n=e&&e.name;
  if(n==='NotAllowedError'||n==='SecurityError'||n==='PermissionDeniedError')return 'scCamDenied';
  if(n==='NotFoundError'||n==='DevicesNotFoundError')return 'scCamNone';
  if(n==='NotReadableError'||n==='TrackStartError')return 'scCamBusy';
  return 'scNoLive';
}
// Para saan: gawing 1x ang zoom ng camera at continuous ang focus (walang kusang zoom / 0.6x). Ibabalik ang zoom na ginamit.
async function lock1x(stream){
  try{
    const tr=stream.getVideoTracks()[0];if(!tr||!tr.getCapabilities)return null;
    const cp=tr.getCapabilities();let z=null;
    if(cp.zoom){
      z=Math.min(cp.zoom.max,Math.max(cp.zoom.min,1));
      try{await tr.applyConstraints({advanced:[{zoom:z}]})}catch(e){try{await tr.applyConstraints({zoom:z})}catch(x){}}
      // may phone na ibinabalik sa wide ang zoom pagkabukas: tiyakin ulit
      setTimeout(()=>{try{const cur=(tr.getSettings()||{}).zoom;if(tr.readyState==='live'&&cur&&Math.abs(cur-z)>0.01)tr.applyConstraints({advanced:[{zoom:z}]}).catch(()=>{})}catch(e){}},700);
    }
    if(cp.focusMode&&cp.focusMode.indexOf&&cp.focusMode.indexOf('continuous')>=0){try{await tr.applyConstraints({advanced:[{focusMode:'continuous'}]})}catch(e){}}
    return z;
  }catch(e){return null}
}
// Para saan: buksan ang camera
async function openCam(){
  const el=$('#scanner');
  el.innerHTML='<div class="sc-top"><strong>'+esc(t('camTitle'))+'</strong><button class="icon-btn" data-act="ov-close" aria-label="'+esc(t('close'))+'">'+I.x+'</button></div><div class="sc-stage"><video id="cm-v" class="sk-video" playsinline muted autoplay disablepictureinpicture></video><div class="sc-msg" id="cm-m" style="display:none"></div></div><div class="sc-bottom"><button class="btn btn-primary btn-block" data-act="cm-snap" style="min-height:54px">'+I.cam+' '+esc(t('takePhoto'))+'</button><label class="btn btn-ghost">'+I.img+' '+esc(t('galleryCam'))+'<input type="file" id="cm-f" accept="image/*" hidden></label></div>';
  el.className='';
  el.classList.add('open');const me=cs={};
  $('#cm-f').addEventListener('change',e=>{const f=e.target.files[0];if(f)fileToCrop(f)});
  const fail=k=>{const m=$('#cm-m');if(m){m.textContent=t(k);m.style.display=''}};
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){fail('camNoLive');return}
  try{
    const st=await camStream();
    if(cs!==me){st.getTracks().forEach(x=>x.stop());return}
    me.stream=st;const v=$('#cm-v');v.srcObject=st;await v.play();v.classList.add('on');
    lock1x(st);
  }catch(e){if(cs===me)fail(camErrKey(e)==='scCamDenied'?'scCamDenied':camErrKey(e)==='scCamBusy'?'scCamBusy':'camNoLive')}
}
// Para saan: kumuha ng litrato
function snap(){
  const v=$('#cm-v');if(!v||!v.videoWidth){toast(t('camWait'),{kind:'warn'});return}
  const c=document.createElement('canvas'),r=Math.min(1,900/Math.max(v.videoWidth,v.videoHeight));c.width=v.videoWidth*r;c.height=v.videoHeight*r;
  c.getContext('2d').drawImage(v,0,0,c.width,c.height);openCrop(c.toDataURL('image/jpeg',.9));
}
// Para saan: mula file papuntang crop
function fileToCrop(f){const fr=new FileReader();fr.onload=()=>openCrop(fr.result);fr.readAsDataURL(f)}
// Para saan: rounded rectangle
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
// Para saan: iguhit ang sticker
function paint(c,n){
  const f=n/300,R=46*f,B=8*f,s=cr.base*cr.z;c.clearRect(0,0,n,n);
  rr(c,0,0,n,n,R);c.fillStyle='#fff';c.fill();
  c.save();rr(c,B,B,n-2*B,n-2*B,R-B);c.clip();c.drawImage(cr.im,cr.x*f,cr.y*f,cr.im.width*s*f,cr.im.height*s*f);c.restore();
}
// Para saan: iguhit ang crop
function crDraw(){const s=cr.base*cr.z;cr.x=Math.min(0,Math.max(300-cr.im.width*s,cr.x));cr.y=Math.min(0,Math.max(300-cr.im.height*s,cr.y));paint($('#cr').getContext('2d'),300)}
// Para saan: crop editor
function openCrop(src){
  if(cs&&cs.stream)cs.stream.getTracks().forEach(x=>x.stop());cs=null;
  const im=new Image();
  im.onerror=()=>toast(t('imgUnreadable'),{kind:'err'});
  im.onload=()=>{
    const base=Math.max(300/im.width,300/im.height);
    cr={im,base,z:1,x:(300-im.width*base)/2,y:(300-im.height*base)/2};
    const el=$('#scanner');
    el.innerHTML='<div class="sc-top"><strong>'+esc(t('cropTitle'))+'</strong><button class="icon-btn" data-act="ov-close" aria-label="'+esc(t('close'))+'">'+I.x+'</button></div><div class="sc-stage" style="display:grid;place-items:center"><canvas id="cr" width="300" height="300" style="width:min(84vw,360px);aspect-ratio:1;border-radius:24px"></canvas></div><div class="sc-bottom"><input type="range" id="cr-z" min="1" max="4" step="0.01" value="1" aria-label="'+esc(t('zoom'))+'"><div class="hint" style="color:#aab">'+esc(t('cropHint'))+'</div><div class="cr-mode" role="group" aria-label="'+esc(t('stkOpt'))+'"><button type="button" data-act="cr-mode" data-m="1" aria-pressed="'+stkWant+'"><b>'+esc(t('stkOnL'))+'</b><small>'+esc(t('stkOnS'))+'</small></button><button type="button" data-act="cr-mode" data-m="0" aria-pressed="'+!stkWant+'"><b>'+esc(t('stkOffL'))+'</b><small>'+esc(t('stkOffS'))+'</small></button></div><div class="row"><button class="btn btn-ghost" data-act="cm-again" style="flex:1">'+esc(t('again'))+'</button><button class="btn btn-primary" data-act="cr-done" id="cr-go" style="flex:2">'+esc(t(stkWant?'makeSticker':'usePhoto'))+'</button></div></div>';
    el.classList.add('open');
    const cv=$('#cr');let drag=null;
    cv.onpointerdown=e=>{cv.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,ox:cr.x,oy:cr.y}};
    cv.onpointermove=e=>{if(!drag)return;const f=300/cv.getBoundingClientRect().width;cr.x=drag.ox+(e.clientX-drag.x)*f;cr.y=drag.oy+(e.clientY-drag.y)*f;crDraw()};
    cv.onpointerup=cv.onpointercancel=()=>{drag=null};
    $('#cr-z').addEventListener('input',e=>{const z=+e.target.value,s0=cr.base*cr.z,s1=cr.base*z,cx=(150-cr.x)/s0,cy=(150-cr.y)/s0;cr.z=z;cr.x=150-cx*s1;cr.y=150-cy*s1;crDraw()});
    crDraw();
  };
  im.src=src;
}
// Para saan: tapos na ang crop: sticker na walang background (o ang dating may frame kung hindi nagawa)
async function crDone(){
  if(!cr||!form)return;
  const wantStk=stkWant;
  let url=null;
  if(wantStk){
    const btn=document.querySelector('[data-act="cr-done"]');if(btn){btn.disabled=true;btn.classList.add('busy')}
    await new Promise(r=>setTimeout(r,30));                  // hayaang lumabas muna ang "busy"
    const c=document.createElement('canvas');c.width=c.height=512;const f=512/300,s=cr.base*cr.z,x=c.getContext('2d');
    x.fillStyle='#fff';x.fillRect(0,0,512,512);x.drawImage(cr.im,cr.x*f,cr.y*f,cr.im.width*s*f,cr.im.height*s*f);
    url=makeSticker(c);
    if(!url)toast(t('stkFail'),{kind:'warn',ms:3000});
  }
  if(!url){
    // V1.1: Sticker OFF = larawan lang (parisukat na crop, walang puting gilid, walang tanggal na background)
    const c=document.createElement('canvas');c.width=c.height=360;const f=360/300,s=cr.base*cr.z,x=c.getContext('2d');
    x.fillStyle='#fff';x.fillRect(0,0,360,360);x.drawImage(cr.im,cr.x*f,cr.y*f,cr.im.width*s*f,cr.im.height*s*f);
    url=c.toDataURL('image/jpeg',.82);
  }
  form.img=url;cr=null;closeScanner();
  const ph=$('#pf-photo');if(ph){ph.innerHTML=photoInner();ph.classList.remove('stk-in');void ph.offsetWidth;ph.classList.add('stk-in')}
  toast(t(wantStk?'stickerDone':'photoDone'),{img:form.img});
}

// V1.1: pindutin ang Sticker ON / OFF sa crop screen
ACTIONS['cr-mode']=b=>{
  stkWant=b.dataset.m==='1';prefs.stk=stkWant;savePrefs();
  document.querySelectorAll('[data-act="cr-mode"]').forEach(x=>x.setAttribute('aria-pressed',String((x.dataset.m==='1')===stkWant)));
  const g=$('#cr-go');if(g)g.textContent=t(stkWant?'makeSticker':'usePhoto');
};
