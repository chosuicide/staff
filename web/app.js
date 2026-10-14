// STAFF v0.3 — record wall. Qloo picks WHAT (who this shop's crowd loves), BeatScope decides WHEN (downbeats, joins).
const SHOPS=[{id:"tomigaya",name:"Tomigaya"},{id:"asakusa",name:"Asakusa"}];
const PHASES=["Open","Midday","Afternoon","Close"];
const OV_BARS=4, N_SONGS=8;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const fmt=t=>{t=Math.max(0,t|0);const m=(t/60)|0,s=t%60;return m+":"+String(s).padStart(2,"0")};
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const pad=(n,w=2)=>String(n).padStart(w,"0");
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
let SERVER=false,building=null,pending=null;
let shop=null, excluded=new Set(), curve=[.2,.55,.45,.9], plan=null, avail={};
/* ================= planning ================= */
function makePlan(){
  const seen=new Set(),pool=[];
  for(const t of [...shop.tracks].sort((a,b)=>b.affinity-a.affinity)){if(excluded.has(t.artist)||seen.has(t.artist))continue;seen.add(t.artist);pool.push(t)}
  const p=pool.slice(0,N_SONGS); if(p.length<2)return null;
  const byE=[...p].sort((a,b)=>a.energy-b.energy);
  const target=k=>{const x=k/(p.length-1)*(curve.length-1),i=Math.min(curve.length-2,Math.floor(x));return curve[i]+(curve[i+1]-curve[i])*(x-i)};
  const slots=[...Array(p.length).keys()].sort((a,b)=>target(a)-target(b)||a-b),order=new Array(p.length);
  slots.forEach((slot,i)=>order[slot]=byE[i]);
  let S=0;const cues=[];
  order.forEach((t,k)=>{const d=t.down,iIn=Math.max(0,d.findIndex(x=>x>=.5)),sIn=d[iIn],Lin=d[Math.min(iIn+OV_BARS,d.length-1)]-sIn;
    const rate=k?Math.min(1.08,Math.max(.92,order[k-1].bpm/t.bpm)):1;
    const S0=S,map=s=>s<sIn+Lin?S0+(s-sIn)/rate:S0+Lin/rate+(s-sIn-Lin);
    const iOut=Math.max(iIn+OV_BARS+1,d.length-1-OV_BARS-1);
    const c={t,k,start:S,sIn,Lin,rate,map,iIn,iOut,ov:k?Lin/rate:0,end:map(d.at(-1)),outAt:map(d[iOut])};
    cues.push(c);S=c.outAt});
  return {cues,total:cues.at(-1).end};
}
const inv=(c,T)=>{const u=T-c.start;return u<c.Lin/c.rate?c.sIn+u*c.rate:c.sIn+c.Lin+(u-c.Lin/c.rate)};
const cueAt=T=>plan?[...plan.cues].reverse().find(c=>c.start<=T)||plan.cues[0]:null;


/* ================= playback engine ================= */
let ac=null,master=null,analyser=null,playing=false,t0=0,pos=0,live=new Map(),bufs=new Map(),timer=null,muted=false,lastBeat="";
function ctx(){if(!ac){ac=new (window.AudioContext||window.webkitAudioContext)();master=ac.createGain();analyser=ac.createAnalyser();analyser.fftSize=1024;analyser.minDecibels=-85;analyser.maxDecibels=-5;analyser.smoothingTimeConstant=.55;master.connect(analyser);analyser.connect(ac.destination)}return ac}
const now=()=>playing?ac.currentTime-t0:pos;
function buf(c){const id=c.t.id;if(!bufs.has(id))bufs.set(id,fetch(c.t.audio).then(r=>r.arrayBuffer()).then(a=>ac.decodeAudioData(a)));return bufs.get(id)}
function startCue(c,b){
  const T=now(),src=ac.createBufferSource(),g=ac.createGain();src.buffer=b;src.connect(g);g.connect(master);
  const at=t=>t0+t,nx=plan.cues[c.k+1],whenMix=Math.max(T,c.start),songT=inv(c,whenMix);
  if(c.k&&whenMix<c.start+c.ov){src.playbackRate.setValueAtTime(c.rate,at(whenMix));src.playbackRate.setValueAtTime(1,at(c.start+c.ov))}
  const cin=new Float32Array(32).map((_,i)=>Math.sin(i/31*Math.PI/2)),cout=cin.map((_,i)=>Math.cos(i/31*Math.PI/2));
  if(c.k&&whenMix<c.start+c.ov){if(whenMix<=c.start){g.gain.setValueAtTime(0,at(whenMix));g.gain.setValueCurveAtTime(cin,at(c.start),c.ov)}else{g.gain.setValueAtTime(Math.sin((whenMix-c.start)/c.ov*Math.PI/2),at(whenMix));g.gain.linearRampToValueAtTime(1,at(c.start+c.ov))}}
  else g.gain.setValueAtTime(1,at(whenMix));
  if(nx){if(whenMix<nx.start)g.gain.setValueCurveAtTime(cout,at(nx.start),nx.ov);else{g.gain.setValueAtTime(Math.cos(Math.min(1,(whenMix-nx.start)/nx.ov)*Math.PI/2),at(whenMix));g.gain.linearRampToValueAtTime(0,at(nx.start+nx.ov))}}
  const stopAt=nx?nx.start+nx.ov+.05:c.end;
  src.start(at(whenMix),Math.max(0,songT));src.stop(at(stopAt));live.set(c.k,{src,g});
}
async function tick(){
  if(!playing||!plan)return;const T=now();
  if(T>=plan.total){stop();pos=0;place(0);return}
  for(const c of plan.cues){const nx=plan.cues[c.k+1],stopAt=nx?nx.start+nx.ov:c.end;
    if(stopAt<T-1){live.delete(c.k);if(bufs.has(c.t.id)&&!plan.cues.some(o=>o.t.id===c.t.id&&o.end>T))bufs.delete(c.t.id);continue}
    if(c.start<T+25&&!live.has(c.k)){live.set(c.k,"loading");const b=await buf(c);if(!playing||live.get(c.k)!=="loading")continue;live.delete(c.k);startCue(c,b)}}
}

function cleanTitle(t){
  const pat=n=>n.replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/[\s\-]+/g,"[\\s\\-]*");
  let x=t.title;
  for(const n of new Set([t.artist,t.qloo_name])){const p=pat(n);
    x=x.replace(new RegExp("^[^-–—/|]*?\\(\\s*"+p+"\\s*\\)\\s*[-–—/|:]\\s*","i"),"")
     .replace(new RegExp("^\\s*"+p+"\\s*(\\([^)]*\\))?\\s*[-–—/|:]\\s*","i"),"")
     .replace(new RegExp("\\s*[-–—/|]\\s*"+p+"\\s*$","i"),"")}
  x=x.replace(/\.(aac|mp3|m4a|wav)$/i,"").replace(/【[^】]*】|\[[^\]]*\]|「|」/g," ").replace(/\((?:[^)]*?(official|music video|mv|lyric|audio|video|full|hd|4k)[^)]*)\)/gi," ").replace(/\b(official\s*)?(music\s*video|lyric\s*video|mv|audio|full ver\.?|hd)\b/gi," ").replace(/\s*[-–|/]\s*$/,"").replace(/^\s*[-–|/]\s*/,"").replace(/\s{2,}/g," ").trim();
  return x||t.title}

/* ================= wall geometry ================= */
let W=0,H=0,small=false,colW=0,R=0,zoneT=0,zoneB=0,rulerY=0,G=[];
let cur=0,target=0,follow=true,lastTouch=0,SPV=0,TX=0,TY=0;
const colX=k=>W/2-colW/2+k*colW;
function xOf(T){if(!plan)return 0;const c=cueAt(T),last=c.k===plan.cues.length-1,seg=(last?c.end:c.outAt)-c.start;return colX(c.k)+clamp((T-c.start)/seg,0,1)*colW}
function layout(){
  lastK=-1;W=innerWidth;H=innerHeight;small=W<760;
  colW=small?Math.round(W*.84):Math.round(Math.min(600,Math.max(420,W*.4)));
  zoneT=small?104:80; zoneB=Math.round(H*(small?.54:.56));
  R=Math.round(Math.min(colW*(small?.5:.56),(zoneB-zoneT)*.8)); rulerY=zoneB+18;
  if(!plan){$("#cols").innerHTML="";return}
  const n=plan.cues.length,es=plan.cues.map(c=>c.t.energy),lo=Math.min(...es),hi=Math.max(...es);
  $("#world").style.width=(colX(n-1)+colW+W/2)+"px";
  G=[];let html="",ticks="";
  plan.cues.forEach((c,k)=>{
    const lvl=(c.t.energy-lo)/(hi-lo||1), cy=zoneB-R/2-lvl*(zoneB-zoneT-R), x=colX(k), sx=x+(small?0:colW*.04);
    const pic=c.t.art||c.t.photo, title=cleanTitle(c.t);
    const fs=Math.round(clamp(colW*.13,34,72)*(title.length>16?.72:1)*(title.length>28?.8:1));
    G.push({x,sx,cy,mid:x+colW/2});
    html+=`<div class="col" data-k="${k}" style="left:0;width:0">
      ${k?`<div class="join" style="left:${x}px;top:${rulerY-26}px;height:${H-rulerY}px"><span>joins on bar ${plan.cues[k-1].iOut+1} · ${OV_BARS}-bar blend${Math.abs(c.rate-1)>.004?` · ${(c.rate>1?"+":"")}${((c.rate-1)*100).toFixed(1)}%`:""}</span></div>`:""}
      <div class="disc" style="left:${sx}px;top:${cy-R/2}px;width:${R}px;height:${R}px"></div>
      <div class="sleeve" style="left:${sx}px;top:${cy-R/2}px;width:${R}px;height:${R}px;background-image:url('${pic||""}')"></div>
      <svg class="arm" viewBox="0 0 60 110" style="left:${sx+R*1.5-R*.22}px;top:${cy-R*.62}px;width:${R*.32}px;height:${R*.6}px"><circle cx="54" cy="8" r="6.5" fill="#2a2622" stroke="#8d877e" stroke-width="1.2"/><circle cx="54" cy="8" r="2" fill="#b9b2a6"/><path d="M54 8 L50 70 L30 100" stroke="#0d0b09" stroke-opacity=".55" stroke-width="4.2" fill="none" stroke-linecap="round" transform="translate(1.5 2)"/><path d="M54 8 L50 70 L30 100" stroke="#c9c2b6" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M54 8 L50 70 L30 100" stroke="#fff" stroke-opacity=".5" stroke-width=".7" fill="none" stroke-linecap="round" transform="translate(-.6 0)"/><rect x="22" y="95" width="15" height="10" rx="1.5" fill="#1d1a17" stroke="#8d877e" stroke-width=".8" transform="rotate(-30 29 100)"/></svg>
      <div class="txt" style="left:${x+12}px;width:${colW-36}px;top:${rulerY+34}px">
        <div class="idx"><b>${pad(k+1)}</b><span>${fmt(c.start)}</span><span>Qloo #${rankOf(c.t)} for this shop</span></div>
        <h2 style="font-size:${fs}px">${esc(title)}</h2>
        <div class="art">${esc(c.t.artist)}</div>
        <div class="facts"><span><b>${c.t.bpm}</b>BPM</span><span><b>${c.t.energy>=0?"+":""}${c.t.energy.toFixed(2)}</b>energy</span><span><b>${c.t.affinity.toFixed(3)}</b>Qloo affinity</span></div>
      </div></div>`;
    const d=c.t.down,seg=(k===plan.cues.length-1?c.end:c.outAt)-c.start;
    for(let b=c.iIn;b<d.length;b++){const mt=c.map(d[b]);const f=(mt-c.start)/seg;if(f>1)break;if(f<0)continue;
      ticks+=`<i class="${(b+1)%8===0?"b8":""}" style="left:${(x+f*colW).toFixed(1)}px"></i>`}
  });
  $("#cols").innerHTML=html; $("#ruler").innerHTML=ticks; $("#ruler").style.top=rulerY+"px"; $("#ruler").style.width=$("#world").style.width;
  // the day's energy as a string pinned through every record
  let p="";G.forEach((g,i)=>{const X=g.sx+R/2,Y=g.cy;if(!i)p=`M${X},${Y}`;else{const q=G[i-1],qx=q.sx+R/2,mx=(qx+X)/2;p+=` C${mx},${q.cy} ${mx},${Y} ${X},${Y}`}});
  const sv=$("#string");sv.setAttribute("width",$("#world").style.width);
  sv.innerHTML=`<path d="${p}" fill="none" stroke="rgba(233,223,204,.16)" stroke-width="1"/>`;
  decorate();if(typeof fxLayout==="function")fxLayout();
  $("#ph i").style.top=(zoneT-20)+"px";$("#ph i").style.height=(rulerY-zoneT+26)+"px";
  target=clamp(target,0,maxCur());cur=clamp(cur,0,maxCur());
}
/* ---------- the room: photo, name, Qloo tags, hours ---------- */
const NOTAG=/^(visa|mastercard|american express|discover|debit cards|jcb|rakuten pay|paypay|apple pay|place|central|city center|destination|delivery|takeout|order ahead|free wi fi|kids menu|y\d.*|\d.*)$/i;
function openAt(){const h=shop&&shop.hours;if(!h)return null;const day=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][new Date().getDay()];
  const d=(h[day]||[])[0];if(!d||d.closed)return null;const p=s=>{const m=/T?(\d\d):(\d\d)/.exec(s||"");return m?(+m[1])*60+(+m[2]):null};let o=p(d.opens),c=p(d.closes);if(o==null)return null;if(c!=null&&c<=o)c+=1440;return {o,c}}
const hhmm=m=>pad(((m/60)|0)%24)+":"+pad((m|0)%60);
function decorate(){
  if(typeof setRoom==="function")setRoom(shop.image,shop.id);
  $("#rName").textContent=(shop.name||"").replace(/\s*[-–].*$/,"");
  const tags=(shop.tags||[]).filter((t,i,a)=>!NOTAG.test(t)&&a.findIndex(x=>x.toLowerCase()===t.toLowerCase())===i).slice(0,10);
  const n=plan.cues.length;let th="";
  tags.forEach((t,i)=>{const k=Math.min(n-1,Math.floor(i*n/tags.length)),g=G[k];const up=i%2===0;
    const x=g.x+(up?colW*.62:colW*.08)+((i*37)%40), y=up?zoneT+8+(i*13)%30:zoneB-30-(i*17)%40;
    th+=`<span class="${i<2?"qt":""}" style="left:${x}px;top:${y}px;transform:rotate(${((i*7)%9)-4}deg)">${esc(t)}</span>`});
  $("#tags").innerHTML=th;
  const oa=openAt();OPEN=oa;let hh="";
  if(oa){plan.cues.forEach((c,k)=>{const m=oa.o+c.start/60;hh+=`<b class="h" style="left:${G[k].x}px">${hhmm(m)}</b>`})}
  $("#hours").innerHTML=hh;$("#hours").style.top=(rulerY+16)+"px";
  const bd=$("#band"),BH=small?64:84;bd.style.top=(rulerY-BH-4)+"px";bd.width=Math.min(1024,W);bd.height=BH;bd._gr=null;bd.style.width=W+"px";bd.style.height=BH+"px";
  $$(".txt .idx span:first-of-type").forEach((el,k)=>{if(oa)el.innerHTML=`<i class="clock-big">${hhmm(oa.o+plan.cues[k].start/60)}</i>`});
}
let OPEN=null,fbuf=null,lvS=0,lvMax=.05;
function audioFrame(){
  let lv=0;const bd=$("#band"),g=bd.getContext("2d");audioFrame.n=(audioFrame.n||0)+1;const drawBand=audioFrame.n%2===0;
  if(analyser&&playing&&!muted){if(!fbuf)fbuf=new Uint8Array(analyser.frequencyBinCount);analyser.getByteFrequencyData(fbuf);
    let s=0;for(let i=1;i<10;i++)s+=fbuf[i];lv=s/(9*255);
    if(drawBand)ledMeter(g,bd.width,bd.height,fbuf)}
  else if(drawBand&&audioFrame.lit!==0){audioFrame.lit=0;ledMeter(g,bd.width,bd.height,null)}
  lvMax=lvMax<.06?lv:lvMax+(lv-lvMax)*.03;const ln=lv?clamp((lv-lvMax*.97)/(lvMax*.25+.01),0,1):0;window._lv=[lv,lvMax];lvS+=(ln-lvS)*(ln>lvS?.5:.12);const L=clamp(lvS,0,1);const gw=$("#glow");if(gw)gw.style.opacity=(.25+.75*L).toFixed(3);
  bd.style.transform=`translate3d(${cur.toFixed(1)}px,0,0)`;
}
/* LED level meter: amber segments lit from behind, unlit ones still visible like a real VU strip */
function ledMeter(g,w,h,f){
  audioFrame.lit=f?1:0;g.clearRect(0,0,w,h);const N=small?28:48,cw=w/N,rows=small?9:12,sh=h/rows;
  for(let i=0;i<N;i++){let v=0;if(f){const bin=Math.floor(Math.pow(i/N,1.8)*300)+2;v=Math.pow(f[bin]/255,1.5)}
    const lit=Math.round(v*rows),x=i*cw+cw*.2,bw=cw*.6;
    for(let r=0;r<rows;r++){const y=h-(r+1)*sh+sh*.22,on=r<lit,hot=r>=rows-2;
      if(on){g.fillStyle=hot?"rgba(255,110,60,.22)":"rgba(255,170,70,.16)";g.fillRect(x-cw*.16,y-sh*.2,bw+cw*.32,sh*.96);
        g.fillStyle=hot?"#ff7a45":"#ffb85a";g.fillRect(x,y,bw,sh*.56)}
      else{g.fillStyle="rgba(233,223,204,.035)";g.fillRect(x,y,bw,sh*.56)}}}
}
const maxCur=()=>plan?(plan.cues.length-1)*colW:0;
function rankOf(t){const l=shop.artists||artistsOf(shop);return l.findIndex(a=>a.name===t.artist)+1}

/* ================= per-frame: scroll-driven motion ================= */
let lastK=-1;
function frame(){
  requestAnimationFrame(frame); if(!plan)return; if(window.__backOpen){audioFrame();return}
  const T=now();
  if(follow){const cc=cueAt(T);const f=cc.k&&T<cc.start+cc.ov?(T-cc.start)/cc.ov:1;const ease=f<.5?2*f*f:1-Math.pow(-2*f+2,2)/2;target=clamp((cc.k-1+ease)*colW,0,maxCur())}
  {const dg=$("#wall").classList.contains("drag");if(dg||follow){cur+=(target-cur)*(dg?.38:.1);SPV=0}else{SPV+=(target-cur)*.05;SPV*=.7;cur+=SPV}
   if(Math.abs(target-cur)<.05&&Math.abs(SPV)<.05){cur=target;SPV=0}}
  $("#world").style.transform=`translate3d(${(-cur).toFixed(2)}px,0,0)`;
  const c=cueAt(T), st=inv(c,T), center=cur+W/2;
  const COLS=frame.cols&&frame.cols.length===G.length&&frame.cols[0].isConnected?frame.cols:(frame.cols=$$(".col"));
  COLS.forEach((el,k)=>{const g=G[k];if(!g)return;
    const rel=(g.mid-center)/colW;if(Math.abs(rel)>W/colW/2+1.2&&k!==c.k){if(el._off)return;el._off=1}else el._off=0;const a=clamp(1-Math.abs(rel),0,1), e=1-Math.pow(1-a,3);
    const isNow=k===c.k, spin0=cur*.35+(isNow&&playing?st*200:0)+k*40, spin=(isNow&&SCR.on)?SCR.rot:spin0;if(isNow&&!SCR.on)SCR.last=spin0;
    const disc=el.children[k?1:0], sl=disc.nextElementSibling, txt=el.querySelector(".txt");
    disc.style.transform=`translateX(${(R*.5*e).toFixed(1)}px) rotate(${spin.toFixed(1)}deg)`;{const shn=el.lastElementChild;if(shn&&shn.classList.contains('sheen'))shn.style.transform=`translateX(${(R*.5*e).toFixed(1)}px)`}
    sl.style.transform=`perspective(900px) rotateY(${(TX*e*14+rel*-10).toFixed(2)}deg) rotateX(${(-TY*e*10).toFixed(2)}deg) scale(${(.9+.1*e).toFixed(3)}) rotate(${(rel*-4).toFixed(2)}deg)`;
    
    txt.style.opacity=(.15+.85*e).toFixed(3);txt.style.transform=`translateY(${((1-e)*24).toFixed(1)}px)`;
    if(isNow!==el.classList.contains("now"))el.classList.toggle("now",isNow)});
  if(!(window.__holdPh&&__holdPh()))$("#ph").style.left=xOf(T).toFixed(1)+"px";
  {const g=G[c.k],gw=$("#glow");if(g&&gw){const sz=R*1.9;gw.style.width=gw.style.height=sz+"px";gw.style.transform=`translate3d(${(g.sx+R/2+R*.5-sz/2).toFixed(1)}px,${(g.cy-sz/2).toFixed(1)}px,0)`}}
  audioFrame();if(typeof fxFrame==="function")fxFrame(T,c,st);
  {const dw=dayWin();$("#clock").textContent=`${hhmm(dayMin(T))} · ${OPEN?"open":"day"} ${hhmm(dw.o)}–${hhmm(dw.c)}`}
  // deck
  if(c.k!==lastK){lastK=c.k;$("#npArtist").textContent=c.t.artist;$("#npTitle").textContent=cleanTitle(c.t)}
  const d=c.t.down;let b=0;while(b<d.length-1&&d[b+1]<=st)b++;
  const len=(d[b+1]||d[b]+2)-d[b],beat=st<d[0]?0:Math.min(3,Math.floor((st-d[b])/len*4));
  const inIntro=c.k&&T<c.start+c.ov;$("#bpmNo").textContent=(c.t.bpm*(inIntro?c.rate:1)).toFixed(1);
  $("#barNo").textContent="bar "+pad(b+1,3);
  $$("#dots i").forEach((i,j)=>{i.classList.toggle("on",j<=beat);i.classList.toggle("d",j===0)});
  const key=c.k+":"+b+":"+beat;
  if(playing&&key!==lastBeat&&st>=d[0]){lastBeat=key;const ph=$("#ph");ph.className="";void ph.offsetWidth;ph.className=beat?"beat":"down";
    if(!beat){window.onDown&&onDown(c.k,b);const arm=$$(".col")[c.k]?.querySelector(".arm");if(arm){arm.classList.remove("hop");void arm.getBBox;arm.classList.add("hop");setTimeout(()=>arm.classList.remove("hop"),300)}}}
  const px=xOf(T)-cur;$("#toNow").classList.toggle("show",!follow&&plan&&(px<0||px>W||Math.abs(px-W/2)>W*.45));
}
function place(T){}

/* ================= gestures: the wall only moves when you move it ================= */
(()=>{const wall=$("#wall");let x0=null,y0,c0,lx,lt,v=0,moved=false,axis=null,downEl=null;
  wall.addEventListener("pointerdown",e=>{if(typeof scratchDown==="function"&&scratchDown(e))return;x0=e.clientX;y0=e.clientY;c0=target;lx=small?(e.clientX-e.clientY):e.clientX;lt=performance.now();v=0;moved=false;axis=null;downEl=e.target;wall.setPointerCapture(e.pointerId)});
  wall.addEventListener("pointermove",e=>{if(SCR.on){scratchMove(e);return}if(x0===null)return;const dx=e.clientX-x0,dy=e.clientY-y0;
    if(!moved&&Math.hypot(dx,dy)<6)return;if(!moved){moved=true;follow=false;wall.classList.add("drag");axis=Math.abs(dx)>=Math.abs(dy)?"x":"y"}
    const d=axis==="x"?dx:dy*1.2;target=clamp(c0-d,-80,maxCur()+80);
    const nowT=performance.now(),p=axis==="x"?e.clientX:e.clientY*1.2;v=.8*v+.2*((p-lx)/Math.max(1,nowT-lt));lx=p;lt=nowT});
  const scrEnd=()=>{if(SCR.on)scratchUp()};wall.addEventListener("pointercancel",scrEnd);
  wall.addEventListener("pointerup",e=>{if(SCR.on){scratchUp();return}if(x0===null)return;x0=null;wall.classList.remove("drag");
    if(moved){target=Math.round(clamp(target-v*300,0,maxCur())/colW)*colW}
    else{const col=downEl&&downEl.closest(".col");if(col&&downEl.closest(".sleeve")&&typeof showBack==="function"){showBack(+col.dataset.k)}else if(col&&downEl.closest(".disc")){const k=+col.dataset.k;window.onTapDisc&&onTapDisc(k);follow=true;seek(plan.cues[k].start+.05,true)}}});
  wall.addEventListener("wheel",e=>{e.preventDefault();follow=false;target=clamp(target+(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY),0,maxCur())},{passive:false});
})();
$("#toNow").onclick=()=>{follow=true};

/* ================= controls ================= */
function setPlayIcon(){$("#pIcon").setAttribute("d",playing?"M13 11 h5 v18 h-5z M22 11 h5 v18 h-5z":"M15 11 L30 20 L15 29 Z")}
async function play(){if(!plan)return;ctx();await ac.resume();t0=ac.currentTime-pos;playing=true;setPlayIcon();clearInterval(timer);timer=setInterval(tick,400);tick()}
function halt(){for(const v of live.values())if(v&&v.src){try{v.src.stop()}catch{}}live.clear()}
function stop(){if(playing)pos=now();playing=false;halt();clearInterval(timer);setPlayIcon()}
function seek(t,go){const was=playing;stop();pos=clamp(t,0,plan.total-.5);if(was||go)play()}
$("#playBtn").onclick=()=>{if(playing)stop();else{follow=true;play()}};
function setMuted(m){muted=m;ctx();master.gain.value=m?0:1;$("#sndBtn").textContent=m?"Sound off":"Sound on";$("#sndBtn").classList.toggle("off",m)}
$("#sndBtn").onclick=()=>setMuted(!muted);
const openSheet=id=>{$$(".sheet").forEach(s=>s.classList.toggle("open",s.id===id&&!s.classList.contains("open")))};
$("#crateBtn").onclick=()=>openSheet("crate");$("#curveBtn").onclick=()=>openSheet("curve");
$$("[data-close]").forEach(b=>b.onclick=()=>openSheet(null));
$("#writeBtn").onclick=()=>{stop();pos=0;plan=makePlan();layout();target=cur=0;follow=true;openSheet(null);play()};
addEventListener("resize",layout);
addEventListener("keydown",e=>{if(e.code==="Space"&&$("#gate").classList.contains("gone")){e.preventDefault();playing?stop():(follow=true,play())}});

/* shops / crate / dials */
const short=n=>n.replace(/^Fuglen\s+/,"").replace(/\s*[-–].*$/,"").slice(0,22);
function renderShops(){$("#shops").innerHTML=SHOPS.map(s=>`<button data-id="${s.id}" class="${shop&&shop.id===s.id?"on":""}" ${avail[s.id]?"":"disabled"}>${esc(short(s.name))}</button>`).join("");
  $$("#shops button").forEach(b=>b.onclick=()=>{if(b.dataset.id!==shop.id)pick(b.dataset.id,playing)})}
function artistsOf(s){const m=new Map();for(const t of s.tracks){const a=m.get(t.artist);if(!a||t.affinity>a.affinity)m.set(t.artist,{name:t.artist,affinity:t.affinity,photo:t.photo||a?.photo,alias:new Set(a?a.alias:[])});m.get(t.artist).alias.add(t.qloo_name)}return [...m.values()].sort((a,b)=>b.affinity-a.affinity)}
function renderArtists(){
  const list=shop.artists?shop.artists.map(a=>({name:a.name,affinity:a.affinity,photo:a.photo,alias:new Set(a.aliases||[]),status:a.status})):artistsOf(shop);
  $("#artists").innerHTML=list.map(a=>{const al=[...a.alias].filter(x=>x!==a.name);
    return `<li data-a="${esc(a.name)}" class="${excluded.has(a.name)?"out":""}">${a.photo?`<img src="${a.photo}" alt="">`:`<span class="ph"></span>`}<span class="nm">${esc(a.name)}${al.length?`<i>also ${esc(al.join(", "))}</i>`:""}${building===shop.id&&a.status&&a.status!=="on the wall"?`<span class="st">${esc(a.status)}</span>`:""}</span><span class="af">${a.affinity.toFixed(3)}</span></li>`}).join("");
  $$("#artists li").forEach(li=>li.onclick=()=>{const a=li.dataset.a;excluded.has(a)?excluded.delete(a):excluded.add(a);li.classList.toggle("out")});
}
function renderDials(){
  $("#dials").innerHTML=PHASES.map((p,i)=>`<div class="dial" data-i="${i}"><svg viewBox="0 0 100 100"></svg><span class="lab">${p}</span></div>`).join("");
  $$(".dial").forEach(d=>{const i=+d.dataset.i;let y0=0,v0=0;
    const move=e=>{curve[i]=clamp(v0+(y0-e.clientY)/160,0,1);drawDial(d,i);drawCurve()};
    const up=()=>{removeEventListener("pointermove",move);removeEventListener("pointerup",up)};
    d.addEventListener("pointerdown",e=>{y0=e.clientY;v0=curve[i];addEventListener("pointermove",move);addEventListener("pointerup",up);e.preventDefault()});
    drawDial(d,i)});drawCurve();
}
function drawDial(d,i){const v=curve[i],a=-135+270*v,rad=x=>(x-90)*Math.PI/180;let s="";
  for(let k=0;k<=24;k++){const t=-135+11.25*k;s+=`<circle cx="${50+44*Math.cos(rad(t))}" cy="${50+44*Math.sin(rad(t))}" r="${k%6?1.2:2}" fill="${t<=a+.1?"#b8361c":"rgba(29,25,20,.25)"}"/>`}
  d.querySelector("svg").innerHTML=`${s}<circle cx="50" cy="50" r="34" fill="url(#gr${i})"/><defs><radialGradient id="gr${i}"><stop offset="0" stop-color="#3a342d"/><stop offset="1" stop-color="#121010"/></radialGradient></defs><circle cx="50" cy="50" r="34" fill="none" stroke="rgba(0,0,0,.6)"/><line x1="${50+12*Math.cos(rad(a))}" y1="${50+12*Math.sin(rad(a))}" x2="${50+30*Math.cos(rad(a))}" y2="${50+30*Math.sin(rad(a))}" stroke="#e9dfcc" stroke-width="3" stroke-linecap="round"/>`}
function drawCurve(){const pts=curve.map((v,i)=>[i/3*400,74-v*68]);let d=`M${pts[0]}`;
  for(let i=1;i<4;i++){const [x0,y0]=pts[i-1],[x1,y1]=pts[i],cx=(x0+x1)/2;d+=` C${cx},${y0} ${cx},${y1} ${x1},${y1}`}
  $("#curveSvg").innerHTML=`<path d="${d}" fill="none" stroke="#b8361c" stroke-width="2" vector-effect="non-scaling-stroke"/>`}

async function pick(id,autoplay){
  stop();pos=0;shop=await (await fetch(`data/${id}.json`)).json();excluded=new Set();
  renderShops();renderArtists();plan=makePlan();layout();target=cur=0;follow=true;showEmpty();if(autoplay&&plan)play();
}
function showEmpty(){const e=$("#empty");e.classList.toggle("show",!plan);if(!plan){$("#eTitle").textContent=shop.name;$("#eMsg").textContent=building?"The wall is going up. First records land in a minute or two.":"Not enough records for this shop yet."}}
/* ---------- any shop, live ---------- */
let qT=null;
$("#anyBtn").onclick=()=>{openSheet("any");setTimeout(()=>$("#q").focus(),400)};
$("#q").addEventListener("input",()=>{clearTimeout(qT);const v=$("#q").value.trim();if(!v){$("#places").innerHTML="";return}
  $("#places").innerHTML=`<li class="hint">Asking Qloo…</li>`;
  qT=setTimeout(async()=>{try{const r=await (await fetch("api/places?q="+encodeURIComponent(v))).json();
    $("#places").innerHTML=r.length?r.map((p,i)=>`<li data-i="${i}">${p.image?`<img src="api/img?u=${encodeURIComponent(p.image)}" alt="" loading="lazy">`:`<span class="ph"></span>`}<div><b>${esc(p.name)}</b><span>${esc(p.address)}</span></div></li>`).join(""):`<li class="hint">Qloo doesn't know that one. Try the shop's full name.</li>`;
    $$("#places li[data-i]").forEach(li=>li.onclick=()=>startBuild(r[+li.dataset.i]))}catch{$("#places").innerHTML=`<li class="hint">Live search needs the STAFF server.</li>`}},380)});
async function startBuild(p){
  openSheet(null);const qs=new URLSearchParams({id:p.id,name:p.name,address:p.address||"",image:p.image||"",tags:(p.tags||[]).join("|")});
  const j=await (await fetch("api/build?"+qs)).json();
  if(!SHOPS.find(s=>s.id===j.slug))SHOPS.push({id:j.slug,name:p.name});avail[j.slug]=true;
  buildPrev=shop&&shop.id!==j.slug?shop.id:buildPrev;stop();pos=0;shop={id:j.slug,name:p.name,tracks:[],artists:[]};plan=null;excluded=new Set();
  building=j.done?null:j.slug;renderShops();layout();
  if(j.done){pick(j.slug,true);return}
  showEmpty();setBuild(j);poll();
}
let seenN=0,buildPrev=null;
function setBuild(j){const b=$("#build");b.classList.toggle("show",!!building||!!pending);b.classList.toggle("idle",!building);
  $("#bMsg").textContent=j?j.msg:"";$("#bN").textContent=j&&j.ready>=0?`${j.ready}/${j.target}`:"";b.classList.toggle("has",!!pending)}
async function poll(){
  if(!building)return;let j;try{j=await (await fetch("api/job?slug="+building)).json()}catch{setTimeout(poll,3000);return}
  const slug=building;
  if(shop&&shop.id===slug){
    const d=await (await fetch(`data/${slug}.json?`+Date.now())).json().catch(()=>null);
    if(d){const grew=d.tracks.length!==shop.tracks.length;shop.artists=d.artists;shop.name=d.name;
      if(grew||!plan){if(playing&&plan){pending=d}else{applyData(d)}}renderArtists()}
  }
  if(j.done){building=null;setBuild(j);if(j.error&&shop&&shop.id===slug&&!plan){$("#eMsg").textContent="Couldn't pull enough records for this crowd. Back to the last wall.";const i=SHOPS.findIndex(s=>s.id===slug);if(i>=0)SHOPS.splice(i,1);setTimeout(()=>{if(shop.id===slug&&buildPrev)pick(buildPrev,false)},2600)}if(!pending)setTimeout(()=>{if(!building&&!pending)$("#build").classList.remove("show")},4000);return}
  if(shop&&shop.id===slug&&!plan)$("#eMsg").textContent=j.stage==="queue"?j.msg:"The wall is going up. First records land in a minute or two.";
  setBuild(j);setTimeout(poll,2500);
}
function applyData(d){const before=new Set((shop.tracks||[]).map(t=>t.id));shop=d;pending=null;plan=makePlan();layout();showEmpty();setBuild(null);
  if(building)$("#build").classList.add("show");
  $$(".col").forEach(el=>{const c=plan&&plan.cues[+el.dataset.k];if(c&&!before.has(c.t.id))el.classList.add("fresh")});}
$("#bHang").onclick=()=>{if(pending){const t=now();applyData(pending);if(plan)seek(Math.min(t,plan.total-1),true)}};
async function probe(){
  try{const w=await (await fetch("api/walls")).json();if(Array.isArray(w)&&w.length){SERVER=true;w.sort((a,b)=>(a.live-b.live)||(a.id==="tomigaya"?-1:1));SHOPS.length=0;for(const x of w){if(x.n>=2){SHOPS.push({id:x.id,name:x.name});avail[x.id]=true}}return}}catch{}await Promise.all(SHOPS.map(async s=>{try{avail[s.id]=(await fetch(`data/${s.id}.json`,{method:"HEAD"})).ok}catch{avail[s.id]=false}}))}
function setPct(p){$("#gPct").textContent=p|0;if(p>=100)$("#gBtn").classList.add("show")}
function enter(sound){setMuted(!sound);$("#gate").classList.add("gone");follow=true;play()}
$("#enterSound").onclick=()=>enter(true);$("#enterMute").onclick=()=>enter(false);
(async()=>{renderDials();setPct(10);await probe();setPct(35);await pick(SHOPS.find(s=>avail[s.id]).id);setPct(70);
  requestAnimationFrame(frame);try{ctx();await buf(plan.cues[0])}catch{}setPct(100)})();
