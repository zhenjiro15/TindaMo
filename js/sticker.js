'use strict';
/* ============================================================
   ITO PARA SA STICKER   [sticker.js]
   Awtomatikong alisin ang background ng litrato ng item, lagyan ng
   puting gilid (tulad ng sticker) at malambot na anino.
   Walang internet / AI model: kulay at gilid ng larawan ang ginagamit.
   Pinakamaganda kapag simple o iisang kulay ang background.
   ============================================================ */

// Para saan: gawing Lab ang kulay (mas malapit sa nakikita ng mata)
function stkLab(r,g,b){
  const f=v=>{v/=255;return v>.04045?Math.pow((v+.055)/1.055,2.4):v/12.92};
  const R=f(r),G=f(g),B=f(b),h=v=>v>.008856?Math.cbrt(v):7.787*v+16/116;
  const x=h((R*.4124+G*.3576+B*.1805)/.95047),y=h(R*.2126+G*.7152+B*.0722),z=h((R*.0193+G*.1192+B*.9505)/1.08883);
  return [116*y-16,500*(x-y),200*(y-z)];
}
// Para saan: malabong pag-smooth ng mask (box blur) at threshold, para makinis ang gilid
function stkSmooth(m,N,r,passes){
  let a=Float32Array.from(m,v=>v?1:0),b=new Float32Array(N*N);
  for(let p=0;p<passes;p++){
    for(let y=0;y<N;y++){let s=0;for(let x=-r;x<=r;x++)s+=a[y*N+Math.min(N-1,Math.max(0,x))];
      for(let x=0;x<N;x++){b[y*N+x]=s/(2*r+1);s+=a[y*N+Math.min(N-1,x+r+1)]-a[y*N+Math.max(0,x-r)]}}
    for(let x=0;x<N;x++){let s=0;for(let y=-r;y<=r;y++)s+=b[Math.min(N-1,Math.max(0,y))*N+x];
      for(let y=0;y<N;y++){a[y*N+x]=s/(2*r+1);s+=b[Math.min(N-1,y+r+1)*N+x]-b[Math.max(0,y-r)*N+x]}}
  }
  return Uint8Array.from(a,v=>v>.5?1:0);
}
// Para saan: hanapin ang produkto (1) at background (0) sa maliit na kopya ng larawan
function stkMask(d,N){
  const n=N*N,L=new Float32Array(n),A=new Float32Array(n),B=new Float32Array(n);
  for(let i=0;i<n;i++){const k=stkLab(d[i*4],d[i*4+1],d[i*4+2]);L[i]=k[0];A[i]=k[1];B[i]=k[2]}
  const dist=(i,j)=>{const a=L[i]-L[j],b=A[i]-A[j],c=B[i]-B[j];return Math.sqrt(a*a+b*b+c*c)};
  const E=new Float32Array(n);
  for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++){const i=y*N+x;E[i]=Math.max(dist(i-1,i+1),dist(i-N,i+N))*.5}
  // kulay ng background: kunin sa gilid ng larawan (3 grupo)
  const ring=[];for(let x=0;x<N;x++)for(let k=0;k<2;k++){ring.push(k*N+x);ring.push((N-1-k)*N+x)}
  for(let y=2;y<N-2;y++)for(let k=0;k<2;k++){ring.push(y*N+k);ring.push(y*N+N-1-k)}
  let cen=[ring[0]].map(i=>[L[i],A[i],B[i]]);
  for(let c=1;c<3;c++){                                   // pinakamalayong kulay sa mga napili na
    let best=-1,bd=-1;
    for(const i of ring){let m=1e9;for(const q of cen){const a=L[i]-q[0],b=A[i]-q[1],e=B[i]-q[2];m=Math.min(m,a*a+b*b+e*e)}if(m>bd){bd=m;best=i}}
    cen.push([L[best],A[best],B[best]]);
  }
  let spread=[0,0,0],cnt=[0,0,0];
  for(let it=0;it<6;it++){
    const sum=[[0,0,0],[0,0,0],[0,0,0]];cnt=[0,0,0];const sd=[0,0,0];
    for(const i of ring){let bk=0,bd=1e9;for(let k=0;k<3;k++){const a=L[i]-cen[k][0],b=A[i]-cen[k][1],e=B[i]-cen[k][2],q=a*a+b*b+e*e;if(q<bd){bd=q;bk=k}}
      cnt[bk]++;sum[bk][0]+=L[i];sum[bk][1]+=A[i];sum[bk][2]+=B[i];sd[bk]+=Math.sqrt(bd)}
    for(let k=0;k<3;k++)if(cnt[k]){cen[k]=[sum[k][0]/cnt[k],sum[k][1]/cnt[k],sum[k][2]/cnt[k]];spread[k]=sd[k]/cnt[k]}
  }
  const cl=[];for(let k=0;k<3;k++)if(cnt[k]>ring.length*.06)cl.push({c:cen[k],T:Math.max(9,spread[k]*2.2+5)});
  if(!cl.length)return null;
  const ratio=new Float32Array(n);                         // <1 = kamukha ng background
  for(let i=0;i<n;i++){let m=1e9;for(const q of cl){const a=L[i]-q.c[0],b=A[i]-q.c[1],e=B[i]-q.c[2];m=Math.min(m,Math.sqrt(a*a+b*b+e*e)/q.T)}ratio[i]=m}
  // flood fill mula sa gilid: papasok hanggang sa makarating sa gilid ng produkto
  const bg=new Uint8Array(n),q=new Int32Array(n);let qh=0,qt=0;
  const EDGE=20;
  const push=i=>{if(!bg[i]){bg[i]=1;q[qt++]=i}};
  for(const i of ring)if(ratio[i]<1)push(i);
  while(qh<qt){
    const i=q[qh++],x=i%N,y=(i/N)|0;
    const nb=[x>0?i-1:-1,x<N-1?i+1:-1,y>0?i-N:-1,y<N-1?i+N:-1];
    for(const p of nb){
      if(p<0||bg[p])continue;
      if((ratio[p]<1&&E[p]<EDGE)||(ratio[p]<2.4&&E[p]<EDGE*.55&&dist(i,p)<3.4))push(p);
    }
  }
  const fg=new Uint8Array(n);for(let i=0;i<n;i++)fg[i]=bg[i]?0:1;
  // piliin ang pinakamalaki / pinakamalapit sa gitna na bahagi
  const lab=new Int32Array(n),areas=[0],hasC=[0],cxs=[0],cys=[0];let nl=0;   // V23: tandaan din ang gitna ng bawat bahagi
  const c0=Math.floor(N*.35),c1=Math.ceil(N*.65);
  for(let s=0;s<n;s++){
    if(!fg[s]||lab[s])continue;
    nl++;let a=0,c=0,sx=0,sy=0;qh=qt=0;q[qt++]=s;lab[s]=nl;
    while(qh<qt){
      const i=q[qh++];a++;const x=i%N,y=(i/N)|0;sx+=x;sy+=y;if(x>=c0&&x<=c1&&y>=c0&&y<=c1)c=1;
      for(const p of [x>0?i-1:-1,x<N-1?i+1:-1,y>0?i-N:-1,y<N-1?i+N:-1])if(p>=0&&fg[p]&&!lab[p]){lab[p]=nl;q[qt++]=p}
    }
    areas.push(a);hasC.push(c);cxs.push(sx/a);cys.push(sy/a);
  }
  // V23: ang produktong naka-focus (malaki at malapit sa gitna) ang pipiliin; ang ibang bagay sa gilid ay hindi isasama
  let best=0,bs=0;for(let k=1;k<=nl;k++){const dc=Math.hypot(cxs[k]-N/2,cys[k]-N/2)/(N/2),sc=areas[k]*(1+hasC[k])*Math.max(.15,1.25-dc);if(sc>bs){bs=sc;best=k}}
  if(!best)return null;
  let m=new Uint8Array(n);for(let i=0;i<n;i++)m[i]=lab[i]===best?1:0;
  m=stkSmooth(m,N,2,2);
  let cnt2=0;for(let i=0;i<n;i++)cnt2+=m[i];
  const frac=cnt2/n;
  return frac>.04&&frac<.9?m:null;                         // masyadong maliit/malaki = pumalpak ang pag-alis ng background
}
// Para saan: buuin ang sticker mula sa parisukat na canvas. Ibinabalik ang data URL (o null kung pumalpak)
function makeSticker(src,OUT){
  OUT=OUT||288;
  try{
    const N=176,sm=document.createElement('canvas');sm.width=sm.height=N;
    const sx=sm.getContext('2d',{willReadFrequently:true});sx.drawImage(src,0,0,N,N);
    const m=stkMask(sx.getImageData(0,0,N,N).data,N);if(!m)return null;
    const S0=Math.min(512,src.width);
    // mask na may alpha, pinalaki at pinatalas ang gilid
    const mc=document.createElement('canvas');mc.width=mc.height=N;const mx=mc.getContext('2d'),id=mx.createImageData(N,N);
    for(let i=0;i<N*N;i++)id.data[i*4+3]=m[i]?255:0;mx.putImageData(id,0,0);
    const cut=document.createElement('canvas');cut.width=cut.height=S0;const cx=cut.getContext('2d',{willReadFrequently:true});
    cx.imageSmoothingEnabled=true;cx.imageSmoothingQuality='high';cx.drawImage(mc,0,0,S0,S0);
    const cd=cx.getImageData(0,0,S0,S0),p=cd.data;let x0=S0,y0=S0,x1=0,y1=0;
    for(let y=0;y<S0;y++)for(let x=0;x<S0;x++){
      const k=(y*S0+x)*4+3,a=Math.max(0,Math.min(255,(p[k]-110)*3));p[k]=a;
      if(a>20){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
    }
    if(x1<=x0||y1<=y0)return null;
    cx.putImageData(cd,0,0);cx.globalCompositeOperation='source-in';cx.drawImage(src,0,0,S0,S0);cx.globalCompositeOperation='source-over';
    // ilagay sa gitna ng OUT x OUT na may espasyo para sa puting gilid at anino
    const ow=Math.round(OUT*.032),room=ow+Math.round(OUT*.045),bw=x1-x0+1,bh=y1-y0+1;
    const sc=(OUT-2*room)/Math.max(bw,bh),dw=bw*sc,dh=bh*sc,dx=(OUT-dw)/2,dy=(OUT-dh)/2;
    const sil=document.createElement('canvas');sil.width=sil.height=OUT;const sc2=sil.getContext('2d');
    sc2.imageSmoothingQuality='high';sc2.drawImage(cut,x0,y0,bw,bh,dx,dy,dw,dh);
    const wh=document.createElement('canvas');wh.width=wh.height=OUT;const wx=wh.getContext('2d');
    wx.drawImage(sil,0,0);wx.globalCompositeOperation='source-in';wx.fillStyle='#fff';wx.fillRect(0,0,OUT,OUT);wx.globalCompositeOperation='source-over';
    const dil=document.createElement('canvas');dil.width=dil.height=OUT;const dx2=dil.getContext('2d');
    [ow,ow*.66,ow*.33].forEach(r=>{for(let a=0;a<360;a+=15)dx2.drawImage(wh,Math.cos(a*Math.PI/180)*r,Math.sin(a*Math.PI/180)*r)});
    dx2.drawImage(wh,0,0);
    const out=document.createElement('canvas');out.width=out.height=OUT;const ox=out.getContext('2d');
    ox.shadowColor='rgba(0,0,0,.32)';ox.shadowBlur=OUT*.03;ox.shadowOffsetY=OUT*.01;ox.drawImage(dil,0,0);
    ox.shadowColor='transparent';ox.drawImage(sil,0,0);
    return out.toDataURL('image/webp',.92);
  }catch(e){return null}
}
