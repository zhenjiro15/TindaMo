'use strict';
/* ============================================================
   ITO PARA SA SARILING KULAY NG APP (COLOR PICKER)   [colorpick.js]
   Sariling picker sa loob ng app (hindi ang system dialog ng Android): kulay pad, hue slider, hex code, at mabilis na pili.
   Live ang pagbabago habang humihila; Set para i-save, Kanselahin para ibalik.
   ============================================================ */

const CP={h:45,s:1,v:1,prev:null,T:0};
const CP_PRESETS=['#FFC400','#FF7A00','#E5383B','#EC4899','#A855F7','#7C3AED','#2563EB','#06B6D4','#14B8A6','#16A34A','#84CC16','#111827'];
// Para saan: HSV -> #RRGGBB
function cpHex(h,s,v){
  const f=n=>{const k=(n+h/60)%6;return v-v*s*Math.max(0,Math.min(k,4-k,1))},x=n=>Math.round(f(n)*255).toString(16).padStart(2,'0');
  return ('#'+x(5)+x(3)+x(1)).toUpperCase();
}
// Para saan: #RRGGBB -> HSV
function cpFromHex(hex){
  const n=parseInt(hex.slice(1),16),R=(n>>16&255)/255,G=(n>>8&255)/255,B=(n&255)/255,mx=Math.max(R,G,B),mn=Math.min(R,G,B),d=mx-mn;let h=0;
  if(d){h=mx===R?((G-B)/d)%6:mx===G?(B-R)/d+2:(R-G)/d+4;h=Math.round(h*60);if(h<0)h+=360}
  return {h,s:mx?d/mx:0,v:mx};
}
// Para saan: ilapat ang kulay (live) at i-update ang itsura ng picker
function cpUpd(skipHex){
  const hex=cpHex(CP.h,CP.s,CP.v);
  prefs.accent='custom';prefs.accentC=hex;applyAccent();
  clearTimeout(CP.T);CP.T=setTimeout(savePrefs,200);
  const pad=$('#cp-pad');if(!pad)return;
  pad.style.setProperty('--ph',CP.h);
  const k=$('#cp-knob');k.style.left=(CP.s*100)+'%';k.style.top=((1-CP.v)*100)+'%';k.style.background=hex;
  const hk=$('#cp-hk');hk.style.left=(CP.h/360*100)+'%';hk.style.background='hsl('+CP.h+' 100% 50%)';
  $('#cp-dot').style.background=hex;
  if(!skipHex)$('#cp-hex').value=hex;
  document.querySelectorAll('.cp-pre').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.c===hex)));
}
// Para saan: hilahin gamit ang daliri (pointer)
function cpDrag(el,fn){
  el.addEventListener('pointerdown',e=>{
    e.preventDefault();try{el.setPointerCapture(e.pointerId)}catch(x){}
    fn(e);
    const mv=ev=>fn(ev),up=()=>{el.removeEventListener('pointermove',mv);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up)};
    el.addEventListener('pointermove',mv);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
  });
}
const cpClamp=v=>Math.max(0,Math.min(1,v));
// Para saan: buksan ang picker
function openColorPick(){
  S.page='colorpick';
  CP.prev={accent:prefs.accent,accentC:prefs.accentC};
  Object.assign(CP,cpFromHex(/^#[0-9a-f]{6}$/i.test(prefs.accentC||'')?prefs.accentC:'#FFC400'));
  openModal('<div class="sheet-h"><h2>'+esc(t('cpPick'))+'</h2><button class="icon-btn" data-act="cp-cancel" aria-label="'+esc(t('close'))+'">'+I.x+'</button></div>'+
    '<div class="cp-prev"><div class="cp-awn"></div><div class="cp-prev-in"><div class="cp-brand">Tinda<b>Mo</b></div><span class="chip ok">● '+esc(t('online'))+'</span><button type="button" class="btn btn-primary" tabindex="-1">₱ 125.00</button></div></div>'+
    '<div class="cp-pad" id="cp-pad"><i id="cp-knob"></i></div>'+
    '<div class="cp-hue" id="cp-hue"><i id="cp-hk"></i></div>'+
    '<div class="cp-row"><span class="cp-dot" id="cp-dot"></span><div class="field" style="flex:1"><label for="cp-hex">'+esc(t('cpHex'))+'</label><input class="inp mono" id="cp-hex" maxlength="7" autocapitalize="characters" autocomplete="off" spellcheck="false"></div></div>'+
    '<span class="lbl" style="display:block;margin:14px 0 8px">'+esc(t('cpQuick'))+'</span>'+
    '<div class="cp-sw">'+CP_PRESETS.map(c=>'<button type="button" class="cp-pre" data-act="cp-pre" data-c="'+c+'" style="--c:'+c+'" aria-label="'+c+'" aria-pressed="false"></button>').join('')+'</div>'+
    '<div class="sheet-f"><button class="btn btn-ghost" data-act="cp-cancel">'+esc(t('cpCancel'))+'</button><button class="btn btn-primary" data-act="cp-set">'+esc(t('cpSet'))+'</button></div>');
  cpDrag($('#cp-pad'),e=>{const r=$('#cp-pad').getBoundingClientRect();CP.s=cpClamp((e.clientX-r.left)/r.width);CP.v=1-cpClamp((e.clientY-r.top)/r.height);cpUpd()});
  cpDrag($('#cp-hue'),e=>{const r=$('#cp-hue').getBoundingClientRect();CP.h=Math.round(cpClamp((e.clientX-r.left)/r.width)*360)%360;cpUpd()});
  cpUpd();
}
document.addEventListener('input',e=>{
  if(e.target.id!=='cp-hex')return;
  let v=e.target.value.trim().toUpperCase();if(v&&v[0]!=='#')v='#'+v;
  if(/^#[0-9A-F]{6}$/.test(v)){Object.assign(CP,cpFromHex(v));cpUpd(true)}
});
Object.assign(ACTIONS,{
  'cp-open':()=>{openColorPick()},
  'cp-pre':b=>{Object.assign(CP,cpFromHex(b.dataset.c));cpUpd()},
  'cp-set':()=>{clearTimeout(CP.T);prefs.accent='custom';prefs.accentC=cpHex(CP.h,CP.s,CP.v);savePrefs();applyAccent();openSettings()},
  'cp-cancel':()=>{clearTimeout(CP.T);if(CP.prev){prefs.accent=CP.prev.accent;prefs.accentC=CP.prev.accentC;savePrefs();applyAccent()}openSettings()}
});
