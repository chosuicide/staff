/* STAFF features: same brand / different crowd split, sleeve back covers, today's record poster */
const shopCache=new Map();
const goodTags=s=>(s.tags||[]).filter(t=>!NOTAG.test(t));
const brandOf=n=>(n||"").trim().split(/\s+/)[0].toLowerCase();
const artistSet=s=>new Set((s.artists||artistsOf(s)).map(a=>a.name.toLowerCase()));
const topArtists=s=>(s.artists?s.artists.map(a=>({name:a.name,photo:a.photo,affinity:a.affinity})):artistsOf(s)).filter(a=>a.photo).slice(0,5);

/* ---------- 1. same brand, different crowd ---------- */
const _pick=pick;
pick=async function(id,autoplay){
  const prev=shop;if(prev)shopCache.set(prev.id,prev);
  await _pick(id,autoplay);shopCache.set(shop.id,shop);
  if(prev&&prev.id!==shop.id&&$("#gate").classList.contains("gone"))showSplit(prev,shop);
};
function showSplit(a,b){
  const A=artistSet(a),B=artistSet(b),shared=[...A].filter(x=>B.has(x)).length;
  const ta=goodTags(a),tb=goodTags(b),sharedTags=ta.filter(t=>tb.includes(t));
  const same=brandOf(a.name)===brandOf(b.name);
  const half=(s,side,uniq)=>`<div class="sp-half sp-${side}">
    <div class="sp-fan">${topArtists(s).map((x,i)=>`<i style="--i:${i};background-image:url('${x.photo}')"></i>`).join("")}</div>
    <p class="sp-k">${esc(s.area||"")}</p><h3>${esc(short(s.name))}</h3>
    <p class="sp-n"><b>${(s.artists||artistsOf(s)).length}</b> artists Qloo hears here</p>
    <div class="sp-tags">${uniq.slice(0,4).map(t=>`<span>${esc(t)}</span>`).join("")}</div></div>`;
  const el=$("#split");
  el.innerHTML=half(a,"l",ta.filter(t=>!tb.includes(t)))+half(b,"r",tb.filter(t=>!ta.includes(t)))+
    `<div class="sp-seam"><p>${same?"Same brand. Same coffee.":"Two rooms."}</p><b>${shared}</b><p>shared artists</p><small>${sharedTags.length?`only “${esc(sharedTags[0])}” in common`:"not one tag in common"}</small></div>`;
  el.className="split show";clearTimeout(showSplit.t);
  showSplit.t=setTimeout(()=>el.classList.add("part"),2600);
  showSplit.t2=setTimeout(()=>el.className="split",3500);
  el.onclick=()=>{clearTimeout(showSplit.t);el.classList.add("part");setTimeout(()=>el.className="split",800)};
}

/* ---------- 2. turn the sleeve over ---------- */
function barcode(t){ // one bar per downbeat, height = loudness: the song's shape you can read at a glance
  const d=t.down,env=t.env||[],n=d.length;if(!n)return"";let r="";
  for(let i=0;i<n;i++){const v=env.length?env[clamp(d[i]|0,0,env.length-1)]:.5,h=8+v*40;r+=`<rect x="${(i/n*300).toFixed(1)}" y="${(50-h).toFixed(1)}" width="${Math.max(.8,300/n*.62).toFixed(2)}" height="${h.toFixed(1)}" fill="${i%8===0?"#ff5a1f":"#16120e"}"/>`}
  return `<svg viewBox="0 0 300 50" preserveAspectRatio="none">${r}</svg>`;
}
function showBack(k){
  const c=plan.cues[k],t=c.t,nx=plan.cues[k+1],rank=rankOf(t),tot=(shop.artists||artistsOf(shop)).length;
  const sl=$$(".col")[k].querySelector(".sleeve").getBoundingClientRect();
  const cat=`STF-${(shop.id||"").replace(/^p_/,"").slice(0,4).toUpperCase()}-${pad(k+1)}`;
  const rt=goodTags(shop).slice(0,3);
  const at=(t.atags||[]).filter(x=>!/^(love|drums|guitar|bass|vocals|piano)$/i.test(x)).slice(0,4);
  const bars=t.down.length,inB=c.iIn+1,outB=nx?c.iOut+1:bars;
  const el=$("#back");
  el.innerHTML=`<div class="bk-card" id="bkCard">
    <div class="bk-front" style="background-image:url('${t.photo||t.art||""}')"></div>
    <div class="bk-rear">
      <div class="bk-h"><span>${cat}</span><span>Side ${k<plan.cues.length/2?"A":"B"} · ${pad(k+1)}</span><span>${hhmm(dayMin(c.start))}</span></div>
      <h3>${esc(cleanTitle(t))}</h3><p class="bk-a">${esc(t.artist)}</p>
      <div class="bk-why"><b>Why it's on this wall</b>
        <p>Qloo puts ${esc(t.artist)} at <em>#${rank} of ${tot}</em> for the crowd at ${esc(shop.name)}, affinity ${t.affinity.toFixed(3)}.${at.length?` Their sound: ${at.map(esc).join(", ")}.`:""}${rt.length?` The room: ${rt.map(esc).join(", ")}.`:""}</p></div>
      <div class="bk-when"><b>Why it plays at ${hhmm(dayMin(c.start))}</b>
        <p>BeatScope reads ${t.bpm} BPM and energy ${t.energy>=0?"+":""}${t.energy.toFixed(2)}, so it lands at this part of the day. Comes in on bar ${inB}${nx?`, hands over to ${esc(nx.t.artist)} on bar ${outB} with a ${OV_BARS}-bar blend`:", closes the day"}.</p></div>
      <div class="bk-code">${barcode(t)}<span>${bars} bars · orange = every 8th</span></div>
      <div class="bk-f"><button id="bkPlay">▶ Play from here</button><button id="bkX">Turn back</button></div>
    </div></div>`;
  const card=$("#bkCard"),S=Math.min(innerWidth*.9,460),L=(innerWidth-S)/2,T=Math.max(60,(innerHeight-S*1.18)/2);
  Object.assign(card.style,{left:L+"px",top:T+"px",width:S+"px",height:S*1.18+"px"});
  card.style.transform=`translate(${sl.left-L}px,${sl.top-T}px) scale(${sl.width/S})`;
  el.className="back show";void card.offsetWidth;
  requestAnimationFrame(()=>{card.style.transform="";card.classList.add("flip")});
  const close=()=>{card.classList.remove("flip");card.style.transform=`translate(${sl.left-L}px,${sl.top-T}px) scale(${sl.width/S})`;el.classList.add("out");setTimeout(()=>el.className="back",650)};
  el.onclick=e=>{if(e.target===el)close()};$("#bkX").onclick=close;
  $("#bkPlay").onclick=()=>{close();follow=true;seek(c.start+.05,true)};
}

/* ---------- 3. today's record, as a poster ---------- */
const loadImg=u=>new Promise(r=>{if(!u)return r(null);const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=u});
async function makePoster(){
  const txt=plan.cues.map(c=>c.t.artist+cleanTitle(c.t)).join("")+shop.name;
  try{await Promise.race([Promise.all(["800 74px","700 24px","400 19px"].flatMap(w=>["Archivo","Noto Sans JP","Noto Sans KR"].map(f=>document.fonts.load(`${w} "${f}"`,txt)))),new Promise(r=>setTimeout(r,2500))])}catch{}
  await document.fonts.ready;
  const Wd=1080,Ht=1350,cv=document.createElement("canvas");cv.width=Wd;cv.height=Ht;const g=cv.getContext("2d");
  const F=(w,st,sz)=>`${w} ${sz}px "Archivo","Noto Sans JP","Noto Sans KR",sans-serif`;
  g.fillStyle="#16120e";g.fillRect(0,0,Wd,Ht);
  const room=await loadImg(shop.image);
  if(room){g.save();g.globalAlpha=.18;g.filter="blur(18px)";const s=Math.max(Wd/room.width,Ht/room.height);g.drawImage(room,(Wd-room.width*s)/2,(Ht-room.height*s)/2,room.width*s,room.height*s);g.restore()}
  const cr="#efe4cf",sig="#ff5a1f",dim="rgba(239,228,207,.55)";
  const day=new Date().toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
  g.fillStyle=cr;g.font=F(800,0,30);g.fillText("STAFF",60,84);g.fillStyle=dim;g.font=F(400,0,26);g.textAlign="right";g.fillText(day,Wd-60,84);g.textAlign="left";
  g.fillStyle=cr;g.font=F(800,0,74);g.fillText(("Today at "+short(shop.name)).toUpperCase(),60,180,Wd-120);
  g.fillStyle=dim;g.font=F(400,0,26);g.fillText(`${shop.area||""}  ·  ${hhmm(dayWin().o)}–${hhmm(dayWin().c)}`,60,224);
  // the day as one record: outermost groove = opening, centre = closing; each song its own band
  const C=[Wd/2,560],R0=300,R1=104,n=plan.cues.length,tot=plan.total;
  g.fillStyle="#090706";g.beginPath();g.arc(C[0],C[1],R0+6,0,7);g.fill();
  plan.cues.forEach((c,k)=>{const nx=plan.cues[k+1],a=c.start/tot,b=(nx?nx.start:tot)/tot,ra=R0-(R0-R1)*a,rb=R0-(R0-R1)*b,env=c.t.env||[],d=c.t.down;
    const step=(ra-rb)/Math.max(1,c.iOut-c.iIn||d.length);
    for(let r=ra,bi=c.iIn;r>rb;r-=Math.max(1.6,step),bi++){const v=env.length?env[clamp((d[bi]||0)|0,0,env.length-1)]:.5,l=14+v*40;
      g.strokeStyle=`rgb(${l+4},${l},${l-4})`;g.lineWidth=Math.max(1,step*.6);g.beginPath();g.arc(C[0],C[1],r,0,7);g.stroke()}
    g.strokeStyle=sig;g.lineWidth=2;g.beginPath();g.arc(C[0],C[1],ra,0,7);g.globalAlpha=k?.8:0;g.stroke();g.globalAlpha=1});
  g.save();g.globalAlpha=.10;g.fillStyle="#fff";g.beginPath();g.moveTo(C[0],C[1]);g.arc(C[0],C[1],R0,-2.2,-1.6);g.fill();g.beginPath();g.moveTo(C[0],C[1]);g.arc(C[0],C[1],R0,.9,1.4);g.fill();g.restore();
  g.save();g.beginPath();g.arc(C[0],C[1],R1-4,0,7);g.clip();if(room){const s=(R1*2)/Math.min(room.width,room.height);g.drawImage(room,C[0]-room.width*s/2,C[1]-room.height*s/2,room.width*s,room.height*s)}else{g.fillStyle=sig;g.fill()}g.restore();
  g.fillStyle="#16120e";g.beginPath();g.arc(C[0],C[1],8,0,7);g.fill();
  g.fillStyle=dim;g.font=F(400,0,20);g.textAlign="center";g.fillText("outer groove = opening   ·   centre = closing",C[0],C[1]+R0+44);g.textAlign="left";
  // tracklist
  let y=960;const colX2=[60,560];
  plan.cues.forEach((c,k)=>{const x=colX2[k<Math.ceil(n/2)?0:1],yy=y+(k%Math.ceil(n/2))*58;
    g.fillStyle=sig;g.font=F(700,0,22);g.fillText(hhmm(dayMin(c.start)),x,yy);
    g.fillStyle=cr;g.font=F(700,0,24);g.fillText(c.t.artist,x+92,yy,370);
    g.fillStyle=dim;g.font=F(400,0,19);g.fillText(`${cleanTitle(c.t)}  ·  ${c.t.bpm} BPM`,x+92,yy+24,370)});
  g.fillStyle="rgba(239,228,207,.25)";g.fillRect(60,Ht-92,Wd-120,1);
  g.fillStyle=cr;g.font=F(700,0,24);g.fillText("Qloo picked who.  BeatScope picked when.",60,Ht-50);
  g.fillStyle=dim;g.font=F(400,0,20);g.textAlign="right";g.fillText(`${n} records · ${Math.round(tot/60)} min`,Wd-60,Ht-50);g.textAlign="left";
  return cv;
}
async function showPoster(){
  const el=$("#poster");el.className="poster show";el.innerHTML=`<div class="po-in"><p class="po-wait">Pressing today's record…</p></div>`;
  let cv;try{cv=await makePoster()}catch(e){el.innerHTML=`<div class="po-in"><p class="po-wait">Couldn't press it: ${esc(e.message)}</p></div>`;return}
  const url=cv.toDataURL("image/png"),name=`staff-${shop.id}-today.png`;
  el.innerHTML=`<div class="po-in"><img src="${url}" alt="Today's record"><div class="po-b"><button id="poShare">Share</button><a id="poDl" href="${url}" download="${name}">Save image</a><button id="poX">Close</button></div></div>`;
  el.onclick=e=>{if(e.target===el)el.className="poster"};$("#poX").onclick=()=>el.className="poster";
  $("#poShare").onclick=async()=>{try{const bl=await (await fetch(url)).blob(),f=new File([bl],name,{type:"image/png"});
    if(navigator.canShare&&navigator.canShare({files:[f]}))await navigator.share({files:[f],title:"Today at "+shop.name});else $("#poDl").click()}catch{}};
}
$("#posterBtn").onclick=()=>{if(plan)showPoster()};
