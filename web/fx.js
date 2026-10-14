/* STAFF fx: data-cut grooves, the shop's day of light, scratching, dust, neon. Hooks: fxLayout() after layout, fxFrame(T,c,st) per frame. */
var SCR={on:false,rot:0,last:0};
const DAY_DEFAULT={o:8*60,c:20*60};
function dayWin(){return OPEN||DAY_DEFAULT}
function dayMin(T){const d=dayWin();return d.o+(plan?clamp(T/plan.total,0,1):0)*(d.c-d.o)}

/* ---------- A: grooves cut from BeatScope ---------- */
const grooveCache=new Map();
function grooveTex(t){
  if(grooveCache.has(t.id))return grooveCache.get(t.id);
  const S=640,cv=document.createElement("canvas");cv.width=cv.height=S;const g=cv.getContext("2d"),C=S/2;
  g.fillStyle="#090706";g.beginPath();g.arc(C,C,C,0,7);g.fill();
  const d=t.down,nb=d.length,r0=C*.975,r1=C*.375,env=t.env||[];
  const loud=s=>{if(!env.length)return .5;const i=clamp(s|0,0,env.length-1);return env[i]};
  const step=(r0-r1)/Math.max(1,nb);
  for(let b=0;b<nb;b++){
    const r=r0-b*step,tb=d[b],lv=loud(tb),phrase=b%8===0;
    const l=10+lv*34+(phrase?10:0);
    g.strokeStyle=`rgb(${l+3},${l},${l-3})`;g.lineWidth=Math.max(.6,step*.62);g.beginPath();g.arc(C,C,r,0,7);g.stroke();
    // beat notches: the four beats of this bar, the downbeat in signal orange
    const nx=d[b+1]||tb+(tb-(d[b-1]||tb-2)),len=nx-tb;
    for(let q=0;q<4;q++){const a=q*Math.PI/2-Math.PI/2+(b*0.011);
      g.fillStyle=q?`rgba(239,228,207,${.05+lv*.18})`:`rgba(255,90,31,${.25+lv*.6})`;
      g.beginPath();g.arc(C+Math.cos(a)*r,C+Math.sin(a)*r,q?step*.38:step*.55,0,7);g.fill()}
  }
  // quiet passages leave a shiny gap like a real track gap
  for(let b=1;b<nb-1;b++){if(loud(d[b])<.28&&loud(d[b-1])>=.28){const r=r0-b*step;g.strokeStyle="rgba(239,228,207,.12)";g.lineWidth=step*1.4;g.beginPath();g.arc(C,C,r,0,7);g.stroke()}}
  g.strokeStyle="#000";g.lineWidth=3;g.beginPath();g.arc(C,C,r1-2,0,7);g.stroke();
  const p=new Promise(res=>cv.toBlob(bl=>res(URL.createObjectURL(bl)),"image/png"));
  grooveCache.set(t.id,p);return p;
}
function fxLayout(){
  if(!plan)return;
  $$(".col").forEach((el,k)=>{const c=plan.cues[k];if(!c)return;const disc=el.querySelector(".disc");
    grooveTex(c.t).then(u=>{disc.style.backgroundImage=`url('${u}')`;disc.classList.add("cut")});
    if(!el.querySelector(".sheen")){const sh=document.createElement("div");sh.className="sheen";sh.innerHTML=`<svg viewBox="0 0 100 100"><circle class="trk" cx="50" cy="50" r="40"/></svg>`;el.appendChild(sh)}
    const sh=el.querySelector(".sheen");Object.assign(sh.style,{left:disc.style.left,top:disc.style.top,width:disc.style.width,height:disc.style.height})});
  dayLabels();
  if(fxLayout.lastShop!==shop.id){fxLayout.lastShop=shop.id;$$(".col").forEach((el,k)=>{el.classList.remove("drop");void el.offsetWidth;el.style.setProperty("--d",(k*.09)+"s");el.classList.add("drop")})}
  neonText();
}
function dayLabels(){
  if(!plan)return;let hh="";
  plan.cues.forEach((c,k)=>{hh+=`<b class="h" style="left:${G[k].x}px">${hhmm(dayMin(c.start))}</b>`});
  $("#hours").innerHTML=hh;
  $$(".txt .idx span:first-of-type").forEach((el,k)=>{el.innerHTML=`<i class="clock-big">${hhmm(dayMin(plan.cues[k].start))}</i>`});
}

/* ---------- B: the shop's day of light ---------- */
// key colours by hour: [hour, window light rgb, beam angle deg, intensity]
const SKY=[[5,[255,170,110],-38,.5],[8,[255,196,128],-30,.95],[12,[236,240,255],-6,.8],[15,[255,206,140],14,.85],[18,[255,128,70],30,.75],[20,[255,70,140],36,.35],[23,[90,110,255],40,.25],[29,[255,170,110],-38,.5]];
function skyAt(min){let h=min/60;while(h<5)h+=24;while(h>=29)h-=24;let i=0;while(i<SKY.length-2&&SKY[i+1][0]<=h)i++;
  const a=SKY[i],b=SKY[i+1],f=(h-a[0])/(b[0]-a[0]),m=(x,y)=>x+(y-x)*f;
  return {rgb:a[1].map((v,j)=>Math.round(m(v,b[1][j]))),ang:m(a[2],b[2]),k:m(a[3],b[3]),night:h>=19.5||h<6}}
let lastSky=-1e9,motes=null,neonOn=false;
function applySky(min){
  const s=skyAt(min);if(Math.abs(min-(applySky.m??-999))<12)return s;applySky.m=min;
  const [r,g,b]=s.rgb,w=$("#win");
  w.style.background=`repeating-linear-gradient(90deg,rgba(${r},${g},${b},${(.22*s.k).toFixed(3)}) 0 21%,transparent 21% 25%)`;
  w.style.transform=`translateX(${(-50+s.ang*.9).toFixed(1)}%) skewX(${(-s.ang).toFixed(1)}deg)`;
  $("#lamp").style.filter=`hue-rotate(0deg)`;
  $("#tint").style.background=`radial-gradient(120% 90% at ${50-s.ang}% 0%,rgba(${r},${g},${b},${(.10*s.k).toFixed(3)}),transparent 70%)`;
  const sx=(-s.ang/40*26).toFixed(1);$("#cols").style.setProperty("--shx",sx+"px");
  const n=s.night;if(n!==neonOn){neonOn=n;$("#neon").classList.toggle("lit",n)}
  $("#dayChip").innerHTML=`<i style="background:rgb(${r},${g},${b})"></i>${hhmm(min)}`;
  return s;
}
function neonText(){$("#neon").textContent=(shop.name||"").replace(/^(the\s+)/i,"").replace(/\s*[-–].*$/,"").replace(/\s+coffee\b/i,"").toLowerCase()}

/* ---------- dust in the beam ---------- */
function dust(){
  dust.n=(dust.n||0)+1;if(dust.n%(small?3:2))return;const cv=$("#dust"),g=cv.getContext("2d"),dpr=1;
  if(cv.width!==innerWidth*dpr){cv.width=innerWidth*dpr;cv.height=innerHeight*dpr}
  if(!motes)motes=Array.from({length:small?18:36},()=>({x:Math.random(),y:Math.random(),z:Math.random(),v:Math.random()*2-1}));
  g.clearRect(0,0,cv.width,cv.height);const s=skyAt(dayMin(now())),[r,gg,b]=s.rgb,L=clamp(lvS,0,1);
  for(const m of motes){m.y-=.00024*(1+m.z);m.x+=Math.sin((m.y+m.v)*9)*.0005-SCROLLV*.00004*(1+m.z);if(m.y<-.02){m.y=1.02;m.x=Math.random()}if(m.x<-.05)m.x=1.05;if(m.x>1.05)m.x=-.05;
    const a=(.12+.5*m.z)*(.55+L*.6)*s.k;g.fillStyle=`rgba(${r},${gg},${b},${a.toFixed(3)})`;g.beginPath();g.arc(m.x*cv.width,m.y*cv.height,(.6+m.z*1.8)*dpr,0,7);g.fill()}
}
let SCROLLV=0,lastCur=0;

/* ---------- per frame ---------- */
function armAngle(rFrac){ // rotate tonearm so the stylus sits at rFrac*R from the centre
  const P=[.568,-.576],T0=[-.133,.5];let lo=-10,hi=40;
  const dist=th=>{const a=th*Math.PI/180,x=T0[0]*Math.cos(a)-T0[1]*Math.sin(a),y=T0[0]*Math.sin(a)+T0[1]*Math.cos(a);return Math.hypot(P[0]+x,P[1]+y)};
  for(let i=0;i<22;i++){const m=(lo+hi)/2;if(dist(m)>rFrac)lo=m;else hi=m}return (lo+hi)/2}
function fxFrame(T,c,st){
  SCROLLV=cur-lastCur;lastCur=cur;
  applySky(dayMin(T));dust();
  const el=(frame.cols||[])[c.k];if(!el)return;
  const d=c.t.down;let b=0;while(b<d.length-1&&d[b+1]<=st)b++;
  const pr=d.length>1?b/(d.length-1):0, rFrac=.488-pr*(.488-.19);
  const arm=el.querySelector(".arm");if(arm)arm.style.rotate=armAngle(rFrac).toFixed(2)+"deg";
  const trk=el.querySelector(".sheen .trk");if(trk){trk.setAttribute("r",(rFrac*100).toFixed(2));}
}

/* ---------- C: scratch the playing record ---------- */
let sc=null,scBus=null;
function revBuf(b){if(b._rev)return b._rev;const r=ac.createBuffer(b.numberOfChannels,b.length,b.sampleRate);
  for(let ch=0;ch<b.numberOfChannels;ch++){const s=b.getChannelData(ch),o=r.getChannelData(ch),n=s.length;for(let i=0;i<n;i++)o[i]=s[n-1-i]}b._rev=r;return r}
function scratchDown(e){
  const disc=e.target.closest&&e.target.closest(".col.now .disc");if(!disc||!playing||!plan)return false;
  const T=now(),c=cueAt(T),bp=bufs.get(c.t.id);if(!bp)return false;
  const rc=disc.getBoundingClientRect(),cx=rc.left+rc.width/2,cy=rc.top+rc.height/2;
  sc={cx,cy,a:Math.atan2(e.clientY-cy,e.clientX-cx),pos:inv(c,T),t:performance.now(),buf:null,rot0:SCR.last,acc:0,lastGrain:0};
  bp.then(b=>{if(sc){sc.buf=b;sc.rev=revBuf(b)}});
  if(!scBus){scBus=ac.createGain();scBus.connect(analyser)}
  scBus.gain.value=muted?0:1;
  master.gain.cancelScheduledValues(ac.currentTime);master.gain.setTargetAtTime(0,ac.currentTime,.012);
  SCR.on=true;SCR.rot=sc.rot0;$("#wall").setPointerCapture(e.pointerId);$("#wall").classList.add("scr");
  follow=true;return true;
}
function scratchMove(e){
  if(!sc)return;let a=Math.atan2(e.clientY-sc.cy,e.clientX-sc.cx),da=a-sc.a;if(da>Math.PI)da-=2*Math.PI;if(da<-Math.PI)da+=2*Math.PI;sc.a=a;
  const tN=performance.now(),dt=Math.max(1,tN-sc.t)/1000;sc.t=tN;
  const ds=da/(2*Math.PI)*1.8; // one turn at 33⅓ = 1.8 s of music
  sc.pos=clamp(sc.pos+ds,0,(sc.buf?sc.buf.duration:999)-.1);SCR.rot+=da*180/Math.PI;
  const v=ds/dt;if(!sc.buf||Math.abs(v)<.05)return;
  const src=ac.createBufferSource(),g=ac.createGain(),fwd=v>0,rate=clamp(Math.abs(v),.15,3.2);
  src.buffer=fwd?sc.buf:sc.rev;src.playbackRate.value=rate;src.connect(g);g.connect(scBus);
  const at=ac.currentTime,len=.07,off=fwd?sc.pos-ds:sc.buf.duration-(sc.pos-ds);
  g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(.9,at+.008);g.gain.setValueAtTime(.9,at+len-.015);g.gain.linearRampToValueAtTime(0,at+len);
  src.start(at,clamp(off,0,sc.buf.duration-.1));src.stop(at+len+.01);
}
function scratchUp(){
  if(!sc)return;sc=null;SCR.on=false;$("#wall").classList.remove("scr");
  master.gain.cancelScheduledValues(ac.currentTime);master.gain.setTargetAtTime(muted?0:1,ac.currentTime,.02); // the mix never stopped: it lands back on the beat
}
