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
  for(let i=0;i<n;i++){const v=env.length?env[clamp(d[i]|0,0,env.length-1)]:.5,h=8+v*40;r+=`<rect x="${(i/n*300).toFixed(1)}" y="${(50-h).toFixed(1)}" width="${Math.max(.8,300/n*.62).toFixed(2)}" height="${h.toFixed(1)}" fill="${i%8===0?"#b8361c":"#1d1914"}"/>`}
  return `<svg viewBox="0 0 300 50" preserveAspectRatio="none">${r}</svg>`;
}
function showBack(k){
  if(window.__backOpen)return;
  const c=plan.cues[k],t=c.t,nx=plan.cues[k+1],rank=rankOf(t),tot=(shop.artists||artistsOf(shop)).length;
  const col=$$(".col")[k],slEl=col.querySelector(".sleeve");
  const cat=`STF-${(shop.id||"").replace(/^p_/,"").slice(0,4).toUpperCase()}-${pad(k+1)}`;
  const rt=goodTags(shop).slice(0,3);
  const at=(t.atags||[]).filter(x=>!/^(love|drums|guitar|bass|vocals|piano)$/i.test(x)).slice(0,4);
  const bars=t.down.length,inB=c.iIn+1,outB=nx?c.iOut+1:bars;
  const face=slEl.style.backgroundImage||`url('${t.art||t.photo||""}')`;
  const el=$("#back");
  el.innerHTML=`<i class="bk-scrim"></i><div class="bk-card" id="bkCard">
    <div class="bk-front" style="background-image:${face}"></div>
    <div class="bk-rear"><div class="bk-in">
      <div class="bk-h"><span>${cat}</span><span>Side ${k<plan.cues.length/2?"A":"B"} · ${pad(k+1)}</span><span>${hhmm(dayMin(c.start))}</span></div>
      <h3>${esc(cleanTitle(t))}</h3><p class="bk-a">${esc(t.artist)}</p>
      <div class="bk-why"><b>Why it's on this wall</b>
        <p>Qloo puts ${esc(t.artist)} at <em>#${rank} of ${tot}</em> for the crowd at ${esc(shop.name)}, affinity ${t.affinity.toFixed(3)}.${at.length?` Their sound: ${at.map(esc).join(", ")}.`:""}${rt.length?` The room: ${rt.map(esc).join(", ")}.`:""}</p></div>
      <div class="bk-when"><b>Why it plays at ${hhmm(dayMin(c.start))}</b>
        <p>BeatScope reads ${t.bpm} BPM and energy ${t.energy>=0?"+":""}${t.energy.toFixed(2)}, so it lands at this part of the day. Comes in on bar ${inB}${nx?`, hands over to ${esc(nx.t.artist)} on bar ${outB} with a ${OV_BARS}-bar blend`:", closes the day"}.</p></div>
      <div class="bk-code">${barcode(t)}<span>${bars} bars · red = every 8th</span></div>
      <div class="bk-f"><button id="bkPlay">▶ Play from here</button><button id="bkX">Turn back</button></div>
    </div></div></div>`;
  const card=$("#bkCard"),S=Math.min(innerWidth*.9,460),Hh=Math.min(S*(innerWidth<760?1.6:1.18),innerHeight-(innerWidth<760?150:90)),L=(innerWidth-S)/2,T=Math.max(60,(innerHeight-Hh)/2);
  Object.assign(card.style,{left:L+"px",top:T+"px",width:S+"px",height:Hh+"px"});
  // one transform from the sleeve's spot on the wall to the centre: compositor-only, no layout or paint while it runs
  const from=()=>{const r=slEl.getBoundingClientRect();return `translate3d(${r.left-L}px,${r.top-T}px,0) scale(${r.width/S},${r.height/Hh})`};
  window.__backOpen=true;
  card.style.transition="none";card.style.transform=from();
  el.className="back show";void card.offsetWidth;slEl.style.visibility="hidden";
  requestAnimationFrame(()=>{card.style.transition="";card.style.transform="translate3d(0,0,0)";card.classList.add("flip");el.classList.add("lit")});
  let closing=false;
  const close=()=>{if(closing)return;closing=true;
    card.classList.remove("flip");card.style.transform=from();el.classList.remove("lit");
    let fin=false;const done=()=>{if(fin)return;fin=true;slEl.style.visibility="";el.className="back";el.innerHTML="";window.__backOpen=false};
    card.addEventListener("transitionend",e=>{if(e.target===card&&e.propertyName==="transform")done()});
    setTimeout(done,900)};
  el.onclick=e=>{if(e.target===el||e.target.classList.contains("bk-scrim"))close()};$("#bkX").onclick=close;
  $("#bkPlay").onclick=()=>{close();follow=true;seek(c.start+.05,true)};
}

/* ---------- 3. today's record, as a poster ---------- */
const loadImg=u=>new Promise(r=>{if(!u)return r(null);const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=u});
async function makePoster(){
  const txt=plan.cues.map(c=>c.t.artist+cleanTitle(c.t)).join("")+shop.name;
  try{await Promise.race([Promise.all(["600 72px","400 22px"].flatMap(w=>["Newsreader","Schibsted Grotesk","Noto Sans JP","Noto Sans KR"].map(f=>document.fonts.load(`${w} "${f}"`,txt)))),new Promise(r=>setTimeout(r,2500))])}catch{}
  await document.fonts.ready;
  const Wd=1080,Ht=1350,cv=document.createElement("canvas");cv.width=Wd;cv.height=Ht;const g=cv.getContext("2d");
  const SERIF=(w,sz)=>`${w} ${sz}px "Newsreader","Noto Serif JP","Noto Sans JP","Noto Sans KR",serif`,SANS=(w,sz)=>`${w} ${sz}px "Schibsted Grotesk","Noto Sans JP","Noto Sans KR",sans-serif`;
  const [paper,room]=await Promise.all([loadImg("img/paper.jpg"),loadImg(shop.image)]);await matReady;
  if(paper){g.drawImage(paper,0,0,Wd,Ht)}else{g.fillStyle="#e9dfcc";g.fillRect(0,0,Wd,Ht)}
  const ink="#1d1914",red="#b8361c",dim="rgba(29,25,20,.6)";
  const day=new Date().toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
  g.fillStyle=ink;g.font=SANS(800,26);g.fillText("STAFF",60,84);g.fillStyle=dim;g.font=SANS(500,22);g.textAlign="right";g.fillText(day.toUpperCase(),Wd-60,84);g.textAlign="left";
  g.fillStyle=ink;g.fillRect(60,104,Wd-120,2);
  g.fillStyle=ink;g.font=SERIF(600,78);g.fillText("Today at "+short(shop.name),60,190,Wd-120);
  g.fillStyle=dim;g.font=SANS(500,22);g.fillText(`${(shop.area||"").toUpperCase()}  ·  ${hhmm(dayWin().o)}–${hhmm(dayWin().c)}`,60,232,Wd-120);
  // the day as one record (a photographed LP): outer edge = opening, label = closing; a red ring where each song comes in
  const C=[Wd/2,580],R0=310,n=plan.cues.length,tot=plan.total,lr=R0*2*LAB;
  g.save();g.shadowColor="rgba(0,0,0,.35)";g.shadowBlur=40;g.shadowOffsetY=18;g.beginPath();g.arc(C[0],C[1],R0*.99,0,7);g.fillStyle="#111";g.fill();g.restore();
  g.save();g.beginPath();g.arc(C[0],C[1],lr,0,7);g.clip();if(room){const s=(lr*2)/Math.min(room.width,room.height);g.drawImage(room,C[0]-room.width*s/2,C[1]-room.height*s/2,room.width*s,room.height*s)}else{g.fillStyle=red;g.fill()}
  if(MAT.label){g.globalCompositeOperation="multiply";g.drawImage(MAT.label,C[0]-lr,C[1]-lr,lr*2,lr*2)}g.restore();
  if(MAT.vinyl)g.drawImage(MAT.vinyl,C[0]-R0,C[1]-R0,R0*2,R0*2);
  const Ro=R0*.955,Ri=lr*1.18;
  plan.cues.forEach((c,k)=>{if(!k)return;const r=Ro-(Ro-Ri)*(c.start/tot);g.strokeStyle="rgba(214,72,40,.85)";g.lineWidth=2;g.beginPath();g.arc(C[0],C[1],r,0,7);g.stroke()});
  g.fillStyle="#e9dfcc";g.beginPath();g.arc(C[0],C[1],6,0,7);g.fill();
  g.fillStyle=dim;g.font=SANS(500,19);g.textAlign="center";g.fillText("OUTER EDGE = OPENING   ·   LABEL = CLOSING   ·   RED = A NEW RECORD COMES IN",C[0],C[1]+R0+46);g.textAlign="left";
  // tracklist
  let y=990;const colX2=[60,560];
  plan.cues.forEach((c,k)=>{const x=colX2[k<Math.ceil(n/2)?0:1],yy=y+(k%Math.ceil(n/2))*58;
    g.fillStyle=red;g.font=SANS(700,21);g.fillText(hhmm(dayMin(c.start)),x,yy);
    g.fillStyle=ink;g.font=SERIF(600,26);g.fillText(c.t.artist,x+90,yy,370);
    g.fillStyle=dim;g.font=SANS(400,18);g.fillText(`${cleanTitle(c.t)}  ·  ${c.t.bpm} BPM`,x+90,yy+24,370)});
  g.fillStyle=ink;g.fillRect(60,Ht-92,Wd-120,1);
  g.fillStyle=ink;g.font=SERIF(600,26);g.fillText("Qloo picked who. BeatScope picked when.",60,Ht-50);
  g.fillStyle=dim;g.font=SANS(500,20);g.textAlign="right";g.fillText(`${n} records · ${Math.round(tot/60)} min`,Wd-60,Ht-50);g.textAlign="left";
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
