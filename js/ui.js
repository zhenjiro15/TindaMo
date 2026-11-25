'use strict';
/* ============================================================
   ITO PARA SA TOAST, TUNOG AT MODAL   [ui.js]
   Maliit na notification, beep/vibrate, at ang pop-up na sheet.
   ============================================================ */

/* ---------- toast + sound ---------- */
// Para saan: maliit na notification
// V1.1: pwedeng i-SWIPE PATAAS para alisin (smooth, sumusunod sa daliri). Kapag may o.key at nandoon pa ang toast na iyon
// (hal. paulit-ulit na dagdag ng parehong item), ina-update na lang ito at hindi nagdadagdag ng bago.
function toast(msg,o){
  o=o||{};
  const box=$('#toasts');
  const body=(o.img?'<img alt="" src="'+esc(o.img)+'">':'')+'<div class="t-body"><div class="t-msg">'+esc(msg)+'</div>'+(o.sub?'<div class="t-sub">'+esc(o.sub)+'</div>':'')+'</div>'+(o.action?'<button type="button" class="t-act">'+esc(o.action.label)+'</button>':'');
  const ms=o.ms||(o.action?4200:2000);
  let t=o.key?Array.from(box.children).find(x=>x.dataset.key===o.key&&!x.classList.contains('gone')):null;
  if(t){
    t.className='toast '+(o.kind||'ok');t.innerHTML=body;
    t.style.animation='none';void t.offsetWidth;t.style.animation='';t.classList.add('bump');
    clearTimeout(t._tm);
  }else{
    while(box.children.length>=3)box.firstChild.remove();
    t=document.createElement('div');
    t.className='toast '+(o.kind||'ok');if(o.key)t.dataset.key=o.key;
    t.innerHTML=body;box.appendChild(t);
    toastSwipe(t);
  }
  if(o.action)$('.t-act',t).addEventListener('click',()=>{toastGone(t,0);o.action.fn()});
  t._ms=ms;t._tm=setTimeout(()=>toastGone(t,0),ms);
}
// Para saan: alisin ang toast nang maayos. dir<0 = lumipad pataas (galing sa swipe), 0 = mahinang fade
function toastGone(t,dir,from){
  if(!t||t.classList.contains('gone')||!t.parentNode)return;
  clearTimeout(t._tm);t.classList.add('gone');t.style.pointerEvents='none';
  const h=t.offsetHeight;
  t.style.animation='none';
  if(dir<0){
    t.style.transition='transform .3s cubic-bezier(.3,.7,.2,1),opacity .3s ease-out';
    t.style.transform='translateY('+(-(h+60+Math.abs(from||0)))+'px)';t.style.opacity='0';
  }else{
    t.style.transition='transform .22s ease,opacity .22s ease';t.style.transform='translateY(-8px)';t.style.opacity='0';
  }
  // pagkatapos lumipad, isara ang espasyo para dumulas pataas ang kasunod na toast (hindi tumatalon)
  setTimeout(()=>{
    if(!t.parentNode)return;
    t.style.transition='max-height .24s ease,margin .24s ease,padding .24s ease';
    t.style.maxHeight=h+'px';t.style.overflow='hidden';void t.offsetHeight;
    t.style.maxHeight='0px';t.style.marginTop='-8px';t.style.paddingTop='0';t.style.paddingBottom='0';
    setTimeout(()=>t.remove(),260);
  },dir<0?200:140);
}
// Para saan: swipe pataas para alisin. Sumusunod sa daliri, may bilis (fling) at bumabalik nang malambot kung kulang ang hila.
function toastSwipe(t){
  let d=null;
  t.addEventListener('pointerdown',e=>{
    if(t.classList.contains('gone')||(e.target.closest&&e.target.closest('.t-act')))return;
    d={id:e.pointerId,y0:e.clientY,y:0,v:0,lt:e.timeStamp,ly:e.clientY};
    try{t.setPointerCapture(e.pointerId)}catch(x){}
    clearTimeout(t._tm);                       // habang hawak, huwag munang mawala
    t.style.animation='none';t.style.transition='none';t.classList.add('drag');
  });
  t.addEventListener('pointermove',e=>{
    if(!d||e.pointerId!==d.id)return;
    let y=e.clientY-d.y0;
    const dt=e.timeStamp-d.lt;if(dt>0){d.v=.7*d.v+.3*((e.clientY-d.ly)/dt);d.lt=e.timeStamp;d.ly=e.clientY}
    d.y=y;
    const shown=y<0?y:Math.min(18,y*.25);      // pataas = sunod sa daliri; pababa = mabigat at limitado
    t.style.transform='translateY('+shown+'px)';
    t.style.opacity=String(y<0?Math.max(.25,1+y/200):1);
  });
  const end=e=>{
    if(!d||(e&&e.pointerId!==d.id))return;
    const y=d.y,v=d.v;d=null;t.classList.remove('drag');
    if(y<-34||(v<-.45&&y<-8)){toastGone(t,-1,y);return}
    // kulang ang hila: bumalik sa dating pwesto (spring) at ituloy ang oras
    t.style.transition='transform .38s cubic-bezier(.2,1.3,.4,1),opacity .2s';
    t.style.transform='';t.style.opacity='';
    t._tm=setTimeout(()=>toastGone(t,0),1600);
  };
  t.addEventListener('pointerup',end);t.addEventListener('pointercancel',end);
}
/* ---------- SFX: mga tunog (mp3 sa folder na SFX/) ---------- */
// Para saan: listahan ng tunog. Palitan lang ang mp3 sa SFX/ para magbago ang tunog.
const SFX_FILES={scan:'SFX/scan.mp3',success:'SFX/success.mp3',error:'SFX/error.mp3'};
const SFX_AUDIO={};
Object.keys(SFX_FILES).forEach(k=>{try{const a=new Audio(SFX_FILES[k]);a.preload='auto';SFX_AUDIO[k]=a}catch(e){}});
// Para saan: i-unlock ang audio sa unang pindot (kailangan ng phone para tumunog)
(function unlock(){
  const go=()=>{
    Object.keys(SFX_AUDIO).forEach(k=>{const a=SFX_AUDIO[k];a.muted=true;const p=a.play();
      const done=()=>{a.pause();a.currentTime=0;a.muted=false};
      if(p&&p.then)p.then(done,()=>{a.muted=false});else done()});
    document.removeEventListener('pointerdown',go,true);document.removeEventListener('keydown',go,true);
  };
  document.addEventListener('pointerdown',go,true);document.addEventListener('keydown',go,true);
})();
// Para saan: patunugin ang 'scan' / 'success' / 'error' (force = kahit naka-off ang tunog, para sa Subukan)
function sfxPlay(name,force){
  if(prefs.sound===false&&!force)return;
  const a=SFX_AUDIO[name];if(!a)return;
  try{
    // clone para magkapatong ang mabilis na sunod-sunod na scan
    const c=a.cloneNode();c.volume=1;
    const p=c.play();if(p&&p.catch)p.catch(()=>{});
  }catch(e){}
}
const sfx=name=>sfxPlay(name,false);

/* ---------- sariling tunog (custom MP3) ---------- */
// Para saan: IndexedDB para sa mga piniling audio (mas malaki ang kasya kaysa localStorage)
const SFXDB={
  open(){return new Promise((ok,no)=>{try{const r=indexedDB.open('tindamo-sfx',1);r.onupgradeneeded=()=>r.result.createObjectStore('f');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)}catch(e){no(e)}})},
  async run(mode,fn){const db=await this.open();return new Promise((ok,no)=>{const tx=db.transaction('f',mode),rq=fn(tx.objectStore('f'));tx.oncomplete=()=>ok(rq&&rq.result);tx.onerror=()=>no(tx.error)})},
  get(k){return this.run('readonly',o=>o.get(k))},
  set(k,v){return this.run('readwrite',o=>o.put(v,k))},
  del(k){return this.run('readwrite',o=>o.delete(k))}
};
const sfxIsCustom=k=>!!(prefs.sfxName&&prefs.sfxName[k]);
// Para saan: palitan ang pinagkukunan ng tunog (ginagamit ang parehong audio element para tuloy ang unlock)
function sfxUse(k,src){const a=SFX_AUDIO[k];if(!a)return;a.src=src;try{a.load()}catch(e){}}
// Para saan: ilagay ang mga naka-save na custom na tunog pagbukas ng app
(async function sfxLoad(){
  if(!prefs.sfxName)return;
  for(const k of Object.keys(prefs.sfxName)){
    try{const b=await SFXDB.get(k);if(b)sfxUse(k,URL.createObjectURL(b));else{delete prefs.sfxName[k];savePrefs()}}catch(e){}
  }
})();
// Para saan: kung kaya bang i-play ang file
const sfxCheck=blob=>new Promise(ok=>{
  const u=URL.createObjectURL(blob),a=new Audio();let d=false;
  const end=v=>{if(d)return;d=true;URL.revokeObjectURL(u);ok(v)};
  a.preload='metadata';a.onloadedmetadata=()=>end(isFinite(a.duration)&&a.duration>0);a.onerror=()=>end(false);setTimeout(()=>end(false),4000);a.src=u;
});
// Para saan: pumili ng MP3 para sa tunog
function sfxPick(k){
  const i=document.createElement('input');i.type='file';i.accept='audio/*,.mp3';
  i.onchange=async()=>{
    const f=i.files&&i.files[0];if(!f)return;
    if(f.size>1.5*1024*1024){toast(t('sfxBig'),{kind:'err'});return}
    if(!(await sfxCheck(f))){toast(t('sfxBad'),{kind:'err'});return}
    try{await SFXDB.set(k,f)}catch(e){toast(t('sfxBad'),{kind:'err'});return}
    sfxUse(k,URL.createObjectURL(f));
    prefs.sfxName=prefs.sfxName||{};prefs.sfxName[k]=f.name.slice(0,40);savePrefs();
    toast(t('sfxSaved'));sfxPlay(k,true);
    if($('#modal').classList.contains('open')&&S.page==='settings')openSettings();
  };
  i.click();
}
// Para saan: ibalik ang orihinal na tunog
async function sfxReset(k){
  try{await SFXDB.del(k)}catch(e){}
  if(prefs.sfxName){delete prefs.sfxName[k];savePrefs()}
  sfxUse(k,SFX_FILES[k]);
}
// Para saan: vibrate
const buzz=ms=>{try{navigator.vibrate&&navigator.vibrate(ms)}catch(e){}};
// Para saan: lakas ng vibrate. Na-scan = isang malinaw na tunog-ng-kamay; error = dalawang sunod.
const BUZZ_OK=90,BUZZ_ERR=[140,70,140];

/* ---------- modal ---------- */
let lastFocus=null;
// Para saan: buksan ang pop-up sheet
function openModal(html){
  lastFocus=document.activeElement;const m=$('#modal');
  // V27: kapag iginuguhit ulit ang parehong pop-up (hal. pagkatapos magbayad), huwag bumalik sa taas
  const old=m.classList.contains('open')?m.querySelector('.sheet'):null,oh=old&&old.querySelector('h2'),oy=old?old.scrollTop:0,ok=oh?oh.textContent:null;
  m.innerHTML='<div class="sheet">'+html+'</div>';m.classList.add('open');document.body.style.overflow='hidden';
  const nh=m.querySelector('.sheet h2');if(old&&ok&&nh&&nh.textContent===ok)m.querySelector('.sheet').scrollTop=oy;
}
// Para saan: isara ang pop-up sheet
function closeModal(){const m=$('#modal');m.classList.remove('open');m.innerHTML='';form=null;document.body.style.overflow='';if(lastFocus&&lastFocus.focus)try{lastFocus.focus()}catch(e){}}

/* ---------- bago: confetti at ripple ---------- */
// Para saan: confetti kapag naabot ang target
function confetti(){
  if(window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const box=document.createElement('div');box.className='confetti';
  const cols=['#FFC400','#E5383B','#16A34A','#2563EB','#EC4899','#FFFFFF'];
  for(let i=0;i<46;i++){
    const p=document.createElement('i');
    p.style.cssText='left:'+(Math.random()*100)+'%;background:'+cols[i%cols.length]+';--dx:'+((Math.random()-.5)*160)+'px;--r:'+(Math.random()*720-360)+'deg;animation-delay:'+(Math.random()*.35)+'s;animation-duration:'+(1.6+Math.random()*1.2)+'s;width:'+(6+Math.random()*6)+'px;height:'+(8+Math.random()*8)+'px';
    box.appendChild(p);
  }
  document.body.appendChild(box);setTimeout(()=>box.remove(),3400);
}
// Para saan: ripple effect sa mga button
document.addEventListener('pointerdown',e=>{
  const b=e.target.closest&&e.target.closest('.btn,.icon-btn:not(.bell),.cat,.nav button,.menu-pop button,.seg button');
  if(!b||b.disabled)return;
  const r=b.getBoundingClientRect(),d=Math.max(r.width,r.height)*1.6,s=document.createElement('span');
  s.className='ripple';s.style.cssText='width:'+d+'px;height:'+d+'px;left:'+(e.clientX-r.left-d/2)+'px;top:'+(e.clientY-r.top-d/2)+'px';
  b.appendChild(s);setTimeout(()=>s.remove(),600);
},{passive:true});
