'use strict';
/* ============================================================
   ITO PARA SA TOTOONG ANDROID APP   [native.js]
   Gumagana lang kapag naka-install bilang Android app (Capacitor).
   Sa browser, walang ginagawa ito.
   - Abiso ng utang (kahit sarado ang app) gamit ang Local Notifications
   - Share ng sync file gamit ang share sheet ng Android
   - Back button ng Android (isara muna ang scanner/pop-up bago lumabas)
   ============================================================ */
const NATIVE=(()=>{
  const C=window.Capacitor;
  const on=!!(C&&typeof C.isNativePlatform==='function'&&C.isNativePlatform());
  const api={on};
  if(!on)return api;
  const P=C.Plugins||{};
  const LN=()=>P.LocalNotifications;
  let perm='default';
  const mapPerm=p=>p==='granted'?'granted':p==='denied'?'denied':'default';
  const hash=s=>{let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return Math.abs(h)%90000+1};

  // Para saan: alamin kung pinayagan ang abiso
  api.refreshPerm=async()=>{try{perm=mapPerm((await LN().checkPermissions()).display)}catch(e){}};

  // Para saan: gawing "Notification" ng browser ang abiso ng Android para gumana ang reminders.js nang walang pagbabago
  function Notif(title,o){
    o=o||{};
    try{LN().schedule({notifications:[{id:hash(String(o.tag||title)),title:String(title),body:String(o.body||''),smallIcon:'ic_stat_tindamo',channelId:'tindamo-reminders'}]})}catch(e){}
  }
  Object.defineProperty(Notif,'permission',{get:()=>perm});
  Notif.requestPermission=async()=>{try{perm=mapPerm((await LN().requestPermissions()).display)}catch(e){}return perm};
  Object.defineProperty(window,'Notification',{value:Notif,configurable:true,writable:true});

  // V38: channel na mataas ang importance (para lumabas na may tunog/vibrate kahit sarado ang app)
  const CH='tindamo-reminders';
  api.ensureChannel=async()=>{try{await LN().createChannel({id:CH,name:'Paalala ng TindaMo',description:'Utang, expiry at ulat ng araw',importance:4,visibility:1,vibration:true})}catch(e){}};
  // V38: payagan ba ang eksaktong oras ng alarm (Android 12+)? Kung hindi, maaaring maantala o hindi lumabas ang abiso kapag sarado ang app
  api.exact=true;
  api.refreshExact=async()=>{try{const r=await LN().checkExactNotificationSetting();api.exact=r.exact_alarm!=='denied'}catch(e){api.exact=true}};
  api.askExact=async()=>{try{const r=await LN().changeExactNotificationSetting();api.exact=r.exact_alarm!=='denied'}catch(e){}};
  // V38: subukan ang abiso na lalabas pagkatapos ng ilang segundo (isara ang app para makita)
  api.testLater=async(sec,title,body)=>{
    try{await api.ensureChannel();await LN().schedule({notifications:[{id:399999,title,body,channelId:CH,smallIcon:'ic_stat_tindamo',schedule:{at:new Date(Date.now()+sec*1000),allowWhileIdle:true}}]});return true}catch(e){return false}
  };

  // Para saan: i-schedule ang mga abiso (lalabas kahit sarado ang app):
  //  - utang na may takdang araw: ilang araw bago, sa mismong araw, at kapag lampas na
  //  - V38: araw-araw na 8:00 AM paalala sa lahat ng may utang (kahit walang takdang araw) at 8:00 PM paalala para sa ulat ng araw
  //  - expiry ng item: 3 araw bago at sa mismong araw
  api.scheduleDue=(list,enabled,expList,sum)=>{
    api._q=(api._q||Promise.resolve()).then(()=>api._sched(list,enabled,expList,sum)).catch(()=>{});
    return api._q;
  };
  api._sched=async(list,enabled,expList,sum)=>{
    const ln=LN();if(!ln)return;
    await api.refreshPerm();                    // V38: hintayin muna ang permiso. Dati, nabubura ang mga naka-schedule kapag hindi pa alam ang permiso
    await api.refreshExact();
    const lead=(typeof remLead==='function')?remLead():[3,1],daily=prefs.daily!==false;
    const sig=JSON.stringify([list,expList,enabled,perm,lead,new Date().toDateString(),prefs.lang,sum,daily,api.exact]);
    if(sig===api._sig)return;                   // walang nagbago
    if(!enabled){                               // pinatay ng user ang abiso: alisin lahat
      const pend=await ln.getPending();
      if(pend&&pend.notifications&&pend.notifications.length)await ln.cancel({notifications:pend.notifications.map(n=>({id:n.id}))});
      api._sig=sig;return;
    }
    if(perm!=='granted')return;                 // hindi pa pinapayagan: huwag galawin ang mga naka-schedule
    await api.ensureChannel();
    const now=Date.now(),out=[];
    const at=(ts,days,h)=>{const d=new Date(ts);d.setHours(h==null?8:h,0,0,0);d.setDate(d.getDate()+days);return d};
    const add=(id,when,title,body)=>{if(when.getTime()>now+6e4)out.push({id,title,body,channelId:CH,schedule:{at:when,allowWhileIdle:true},smallIcon:'ic_stat_tindamo'})};
    list.slice(0,150).forEach((x,i)=>{
      const base=100000+i*16;
      lead.forEach((L,k)=>add(base+k,at(x.due,-L),t('nSoonT'),t('nSoonB',x.name,fmt(x.bal),L===1?t('dueTomorrow'):t('dueInDays',L))));
      add(base+6,at(x.due,0),t('nSoonT'),t('nSoonB',x.name,fmt(x.bal),t('dueToday')));
      [1,2,3,5,7,14].forEach((n,k)=>add(base+7+k,at(x.due,n),t('nOverT'),t('nOverB',x.name,fmt(x.bal),n)));
    });
    (expList||[]).slice(0,100).forEach((x,i)=>{
      add(200000+i*2,at(x.exp,-3),t('nExpSoonT'),t('nExpSoonB',x.name,3));
      add(200001+i*2,at(x.exp,0),t('nExpSoonT'),t('nExpTodayB',x.name));
    });
    if(daily){
      for(let d=0;d<10;d++){
        if(sum&&sum.n>0)add(300000+d*2,at(now,d,8),t('nDailyT'),t('nDailyB',sum.n,fmt(sum.total)));
        add(300001+d*2,at(now,d,20),t('nEodT'),t('nEodB'));
      }
    }
    const pend=await ln.getPending();
    if(pend&&pend.notifications&&pend.notifications.length)await ln.cancel({notifications:pend.notifications.map(n=>({id:n.id}))});
    out.sort((p,q)=>p.schedule.at-q.schedule.at);
    if(out.length)await ln.schedule({notifications:out.slice(0,450)});
    api._sig=sig;
  };

  // Para saan: ipasa ang sync file sa ibang phone (Bluetooth / Quick Share / Messenger etc.)
  api.shareFile=async(name,text)=>{
    const r=await P.Filesystem.writeFile({path:name,data:text,directory:'CACHE',encoding:'utf8'});
    await P.Share.share({title:'TindaMo',files:[r.uri]});
  };

  // V27: ipasa ang text (hal. paalala sa may utang, listahan ng bibilhin)
  api.shareText=async text=>{await P.Share.share({title:'TindaMo',text})};

  // V24: ipasa ang larawan (PNG, base64) ng resibo
  api.shareImage=async(name,b64)=>{
    const r=await P.Filesystem.writeFile({path:name,data:b64,directory:'CACHE'});
    await P.Share.share({title:'TindaMo',files:[r.uri]});
  };

  // V1.2.3: background service (abiso kahit sarado ang app). Ang Java ay nasa scripts/bgservice.mjs (nilalagay ng npm run android:apk)
  let _bg=null;
  const BG=()=>{try{return _bg||(_bg=C.registerPlugin('TindaBg'))}catch(e){return null}};
  api.bgConfig=o=>{try{const b=BG();if(b)b.configure(o).catch(()=>{})}catch(e){}};
  api.bgStop=()=>{try{const b=BG();if(b)b.stop().catch(()=>{})}catch(e){}};
  api.bgFg=fg=>{try{const b=BG();if(b)b.setFg({fg:!!fg}).catch(()=>{})}catch(e){}};
  api.bgBatteryOk=async()=>{try{const b=BG();return b?!!(await b.batteryOk()).ok:true}catch(e){return true}};
  api.bgBatterySettings=()=>{try{const b=BG();if(b)b.batterySettings().catch(()=>{})}catch(e){}};
  document.addEventListener('visibilitychange',()=>api.bgFg(!document.hidden));
  setTimeout(()=>api.bgFg(!document.hidden),1500);

  // Para saan: back button ng Android
  const App=P.App;
  if(App&&App.addListener){
    App.addListener('backButton',()=>{
      const sc=document.getElementById('scanner'),md=document.getElementById('modal');
      if(sc&&sc.classList.contains('open')){closeScanner();return}
      if(md&&md.classList.contains('open')){closeModal();return}
      if(App.minimizeApp)App.minimizeApp();else if(App.exitApp)App.exitApp();
    });
    App.addListener('resume',()=>{api.refreshPerm();api.refreshExact();api.bgFg(true);if(typeof snapDue==='function')snapDue();try{if(typeof vipFetch==='function')vipFetch();if(typeof xfPoll==='function')xfPoll();if(typeof bgSync==='function')bgSync()}catch(e){}});
    App.addListener('pause',()=>api.bgFg(false));
  }
  // Para saan: sa unang bukas ng app, hingin ang permiso (camera, lokasyon, abiso) — lalabas ang "Allow / Don't allow" ng Android
  api.askAll=async()=>{
    const K='tindamo:permAsked';
    if(store.get(K))return;
    store.set(K,'1');
    try{await P.Camera.requestPermissions({permissions:['camera']})}catch(e){}
    try{await P.Geolocation.requestPermissions({permissions:['location']})}catch(e){}
    try{await LN().requestPermissions()}catch(e){}
    api.refreshPerm();
  };
  api.refreshPerm();api.refreshExact();api.ensureChannel();
  setTimeout(api.askAll,900);
  return api;
})();
