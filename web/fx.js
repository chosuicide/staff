/* STAFF fx: photographed materials (sleeves, discs, the shop room), the hour's light, scratching. Hooks: fxLayout() after layout, fxFrame(T,c,st) per frame. */
var SCR={on:false,rot:0,last:0};
const DAY_DEFAULT={o:8*60,c:20*60};
function dayWin(){return OPEN||DAY_DEFAULT}
function dayMin(T){const d=dayWin();return d.o+(plan?clamp(T/plan.total,0,1):0)*(d.c-d.o)}

/* ---------- A: real materials. Every sleeve is the track's own cover printed on photographed paper;
   every disc is a photographed LP with the cover as its label. Composited once per track, then only moved. ---------- */
const loadI=u=>new Promise(r=>{if(!u)return r(null);const i=new Image();i.decoding="async";i.onload=()=>r(i);i.onerror=()=>r(null);i.src=u});
const MAT={};
const matReady=Promise.all(["img/vinyl.webp","img/label-paper.webp","img/sleeve-shade.jpg","img/sleeve-rub.webp"].map(loadI)).then(a=>{[MAT.vinyl,MAT.label,MAT.shade,MAT.rub]=a});
const texCache=new Map();
const LAB=.172,HOLE=.0085;
function coverDraw(g,im,x,y,s){const k=Math.min(im.width,im.height),sx=(im.width-k)/2,sy=(im.height-k)/2;g.drawImage(im,sx,sy,k,k,x,y,s,s)}
const blobURL=(c,type,q)=>new Promise(r=>c.toBlob(b=>r(b?URL.createObjectURL(b):c.toDataURL()),type,q));
function texSize(){const d=Math.min(2,devicePixelRatio||1);return R*d>420?768:512}
function sleeveTex(t){
  const u=t.art||t.photo,N=texSize(),key="s|"+u+"|"+N;if(texCache.has(key))return texCache.get(key);
  const p=Promise.all([matReady,loadI(u)]).then(([,im])=>{const c=document.createElement("canvas");c.width=c.height=N;const g=c.getContext("2d");
    if(im)coverDraw(g,im,0,0,N);else{g.fillStyle="#3a3128";g.fillRect(0,0,N,N)}
    if(MAT.shade){g.globalCompositeOperation="multiply";g.drawImage(MAT.shade,0,0,N,N)}
    if(MAT.rub){g.globalCompositeOperation="screen";g.drawImage(MAT.rub,0,0,N,N)}
    return blobURL(c,"image/jpeg",.86)});
  texCache.set(key,p);return p;
}
function discTex(t){
  const u=t.art||t.photo,N=texSize(),key="d|"+u+"|"+N;if(texCache.has(key))return texCache.get(key);
  const p=Promise.all([matReady,loadI(u)]).then(([,im])=>{const c=document.createElement("canvas");c.width=c.height=N;const g=c.getContext("2d"),C=N/2,lr=LAB*N;
    g.save();g.beginPath();g.arc(C,C,lr+1,0,7);g.clip();
    if(im)coverDraw(g,im,C-lr,C-lr,lr*2);else{g.fillStyle="#c9b48f";g.fillRect(C-lr,C-lr,lr*2,lr*2)}
    if(MAT.label){g.globalCompositeOperation="multiply";g.drawImage(MAT.label,C-lr,C-lr,lr*2,lr*2)}
    g.restore();
    if(MAT.vinyl)g.drawImage(MAT.vinyl,0,0,N,N);
    g.globalCompositeOperation="destination-out";g.beginPath();g.arc(C,C,Math.max(2,HOLE*N),0,7);g.fill();
    return blobURL(c,"image/webp",.9)});
  texCache.set(key,p);return p;
}
function fxLayout(){
  if(!plan)return;
  $$(".col").forEach((el,k)=>{const c=plan.cues[k];if(!c)return;const disc=el.querySelector(".disc"),sl=el.querySelector(".sleeve");
    discTex(c.t).then(u=>{disc.style.backgroundImage=`url('${u}')`;disc.classList.add("cut")});
    sleeveTex(c.t).then(u=>{sl.style.backgroundImage=`url('${u}')`;sl.classList.add("mat")});
    if(!el.querySelector(".sheen")){const sh=document.createElement("div");sh.className="sheen";el.appendChild(sh)}
    const sh=el.querySelector(".sheen");Object.assign(sh.style,{left:disc.style.left,top:disc.style.top,width:disc.style.width,height:disc.style.height})});
  dayLabels();
  if(fxLayout.lastShop!==shop.id){fxLayout.lastShop=shop.id;$$(".col").forEach((el,k)=>{el.classList.remove("drop");void el.offsetWidth;el.style.setProperty("--d",(k*.09)+"s");el.classList.add("drop")})}
}
function dayLabels(){
  if(!plan)return;let hh="";
  plan.cues.forEach((c,k)=>{hh+=`<b class="h" style="left:${G[k].x}px">${hhmm(dayMin(c.start))}</b>`});
  $("#hours").innerHTML=hh;
  $$(".txt .idx span:first-of-type").forEach((el,k)=>{el.innerHTML=`<i class="clock-big">${hhmm(dayMin(plan.cues[k].start))}</i>`});
}

/* ---------- B: the shop itself behind the wall, graded for the hour ---------- */
let roomSide=0,roomKey=null;
function setRoom(u,id){
  if(!u){$$(".r-img").forEach(e=>e.classList.remove("on"));roomKey=null;return}
  if(roomKey===u)return;roomKey=u;
  loadI(u).then(im=>{if(!im||roomKey!==u)return;
    const Wc=Math.min(1280,Math.max(720,im.width*2)),Hc=Math.round(Wc*im.height/im.width),c=document.createElement("canvas");c.width=Wc;c.height=Hc;const g=c.getContext("2d");
    g.imageSmoothingQuality="high";g.drawImage(im,0,0,Wc,Hc);
    // grade: warm low light, crushed but not black, like sitting at the back of the room
    g.globalCompositeOperation="multiply";g.fillStyle="rgb(178,150,120)";g.fillRect(0,0,Wc,Hc);
    g.globalCompositeOperation="source-over";g.fillStyle="rgba(14,11,8,.5)";g.fillRect(0,0,Wc,Hc);
    const v=g.createRadialGradient(Wc/2,Hc*.42,Math.min(Wc,Hc)*.2,Wc/2,Hc*.5,Math.max(Wc,Hc)*.75);v.addColorStop(0,"rgba(0,0,0,0)");v.addColorStop(1,"rgba(6,4,3,.7)");g.fillStyle=v;g.fillRect(0,0,Wc,Hc);
    blobURL(c,"image/jpeg",.84).then(url=>{if(roomKey!==u)return;roomSide^=1;const on=$(roomSide?"#rImgB":"#rImgA"),off=$(roomSide?"#rImgA":"#rImgB");
      const pre=new Image();pre.onload=()=>{on.style.backgroundImage=`url('${url}')`;requestAnimationFrame(()=>{on.classList.add("on");off.classList.remove("on")})};pre.src=url})});
}
// key colours by hour: [hour, light rgb, angle deg, intensity]. Only a faint wash over the photo.
const SKY=[[5,[255,170,110],-38,.5],[8,[255,196,128],-30,.9],[12,[236,240,255],-6,.7],[15,[255,206,140],14,.85],[18,[255,128,70],30,.8],[20,[255,90,120],36,.45],[23,[90,110,255],40,.35],[29,[255,170,110],-38,.5]];
function skyAt(min){let h=min/60;while(h<5)h+=24;while(h>=29)h-=24;let i=0;while(i<SKY.length-2&&SKY[i+1][0]<=h)i++;
  const a=SKY[i],b=SKY[i+1],f=(h-a[0])/(b[0]-a[0]),m=(x,y)=>x+(y-x)*f;
  return {rgb:a[1].map((v,j)=>Math.round(m(v,b[1][j]))),ang:m(a[2],b[2]),k:m(a[3],b[3]),night:h>=19.5||h<6}}
function applySky(min){
  const s=skyAt(min);if(Math.abs(min-(applySky.m??-999))<12)return s;applySky.m=min;
  const [r,g,b]=s.rgb;
  $("#tint").style.background=`radial-gradient(110% 80% at ${50-s.ang}% -10%,rgba(${r},${g},${b},${(.13*s.k).toFixed(3)}),transparent 70%)`;
  const sx=(-s.ang/40*18).toFixed(1);$("#cols").style.setProperty("--shx",sx+"px");
  $("#dayChip").innerHTML=`<i style="background:rgb(${r},${g},${b})"></i>${hhmm(min)}`;
  return s;
}

/* ---------- per frame ---------- */
function armAngle(rFrac){ // rotate tonearm so the stylus sits at rFrac*R from the centre
  const P=[.568,-.576],T0=[-.133,.5];let lo=-10,hi=40;
  const dist=th=>{const a=th*Math.PI/180,x=T0[0]*Math.cos(a)-T0[1]*Math.sin(a),y=T0[0]*Math.sin(a)+T0[1]*Math.cos(a);return Math.hypot(P[0]+x,P[1]+y)};
  for(let i=0;i<22;i++){const m=(lo+hi)/2;if(dist(m)>rFrac)lo=m;else hi=m}return (lo+hi)/2}
function fxFrame(T,c,st){
  applySky(dayMin(T));
  const el=(frame.cols||[])[c.k];if(!el)return;
  const d=c.t.down;let b=0;while(b<d.length-1&&d[b+1]<=st)b++;
  const pr=d.length>1?b/(d.length-1):0, rFrac=.488-pr*(.488-.19);
  const arm=el.querySelector(".arm");if(arm){const a=armAngle(rFrac).toFixed(1);if(arm._a!==a){arm._a=a;arm.style.rotate=a+"deg"}}
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
