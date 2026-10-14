/* STAFF motion: velocity skew, split-text reveals, gate→wall flight, custom cursor, sheet staggers, draggable progress */
const fine=matchMedia("(pointer:fine)").matches;
const reduce=matchMedia("(prefers-reduced-motion:reduce)").matches;

/* ---------- split titles into masked words / chars ---------- */
function splitTitles(){
  $$(".txt h2").forEach(h=>{if(h.dataset.split)return;h.dataset.split=1;let i=0;
    h.innerHTML=h.textContent.split(/(\s+)/).map(w=>/^\s+$/.test(w)?" ":`<span class="w">${[...w].map(ch=>`<span class="c" style="--i:${i++}">${esc(ch)}</span>`).join("")}</span>`).join("")});
  $$(".txt").forEach(t=>[...t.children].forEach((c,j)=>c.style.setProperty("--j",j)));
}

/* ---------- per frame: inertia skew + reveal state ---------- */
let mPrev=0,mVel=0,mSk=0;
function motionFrame(){
  requestAnimationFrame(motionFrame);if(!plan||reduce)return;
  const v=cur-mPrev;mPrev=cur;mVel+=(v-mVel)*.18;
  const sk=clamp(-mVel*.32,-9,9);mSk+=(sk-mSk)*.2;
  const q=Math.round(mSk*10)/10;if(q!==motionFrame.q){motionFrame.q=q;const cols=$("#cols");if(cols)cols.style.transform=q?`skewX(${q}deg)`:""}
  const center=cur+W/2,COLS=frame.cols||[];
  for(let k=0;k<COLS.length;k++){const g=G[k],el=COLS[k];if(!g)continue;const near=Math.abs(g.mid-center)<colW*.42;
    if(near!==!!el._in){el._in=near;el.classList.toggle("in",near);if(near&&window.onIn)onIn(el,k)}}
}

/* ---------- gate disc flies onto the wall ---------- */
const _enter=enter;
enter=function(sound){
  const gd=$("#gDisc"),col=$$(".col")[0],disc=col&&col.querySelector(".disc");
  if(!gd||!disc||reduce){_enter(sound);return}
  const a=gd.getBoundingClientRect(),b=disc.getBoundingClientRect();
  const fly=gd.cloneNode(true);fly.id="";fly.classList.add("fly");
  Object.assign(fly.style,{position:"fixed",left:a.left+"px",top:a.top+"px",width:a.width+"px",height:a.height+"px",margin:0,zIndex:45});
  document.body.appendChild(fly);gd.style.visibility="hidden";
  $("#gate").classList.add("leaving");
  requestAnimationFrame(()=>{fly.style.transform=`translate(${b.left-a.left}px,${b.top-a.top}px) scale(${b.width/a.width}) rotate(540deg)`});
  setTimeout(()=>{_enter(sound);$$(".col").forEach((el,k)=>{el.classList.remove("drop");void el.offsetWidth;el.style.setProperty("--d",(k*.07)+"s");el.classList.add("drop")})},350);
  setTimeout(()=>fly.classList.add("land"),900);setTimeout(()=>fly.remove(),1300);
};
$("#enterSound").onclick=()=>enter(true);$("#enterMute").onclick=()=>enter(false);

/* ---------- custom cursor (desktop only) ---------- */
if(fine&&!reduce){
  const cu=document.createElement("div");cu.id="cursor";cu.innerHTML="<i></i><span></span>";document.body.appendChild(cu);document.body.classList.add("has-cursor");
  let mx=innerWidth/2,my=innerHeight/2,cx=mx,cy=my,lab="",mag=null;
  addEventListener("pointermove",e=>{mx=e.clientX;my=e.clientY;
    const t=e.target;let l="";
    if(SCR.on)l="Scratch";else if($("#wall").classList.contains("drag"))l="";
    else if(t.closest&&t.closest(".col.now .disc"))l=playing?"Scratch":"Play";
    else if(t.closest&&t.closest(".disc"))l="Play";
    else if(t.closest&&t.closest(".sleeve"))l="Flip";
    else if(t.closest&&t.closest("#prog,#phH"))l="Scrub";
    else if(t.closest&&t.closest("#wall"))l="Drag";
    if(l!==lab){lab=l;cu.querySelector("span").textContent=l;cu.className=l?"lab":""}
    mag=t.closest?t.closest("button,.pbtn,a"):null;cu.classList.toggle("btn",!!mag&&!l)});
  addEventListener("pointerdown",()=>cu.classList.add("down"));addEventListener("pointerup",()=>cu.classList.remove("down"));
  document.addEventListener("mouseleave",()=>cu.style.opacity=0);document.addEventListener("mouseenter",()=>cu.style.opacity=1);
  (function loop(){requestAnimationFrame(loop);cx+=(mx-cx)*.22;cy+=(my-cy)*.22;cu.style.transform=`translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`})();
  // magnetic buttons
  $$("button").forEach(b=>{if(b.closest(".sheet"))return;
    b.addEventListener("pointermove",e=>{const r=b.getBoundingClientRect();b.style.transform=`translate(${((e.clientX-r.left-r.width/2)*.25).toFixed(1)}px,${((e.clientY-r.top-r.height/2)*.35).toFixed(1)}px)`});
    b.addEventListener("pointerleave",()=>b.style.transform="")});
}

/* ---------- sheets: content falls in, one after another ---------- */
new MutationObserver(ms=>ms.forEach(m=>{const s=m.target;if(!s.classList.contains("open"))return;
  [...s.querySelectorAll(".sh-h > *, li, .dial, .curve-svg, .write, .q")].forEach((el,i)=>el.style.setProperty("--k",Math.min(i,18)))
})).observe(document.body,{subtree:true,attributes:true,attributeFilter:["class"]});

/* ---------- draggable progress: the whole day under your thumb ---------- */
(()=>{
  const deck=$(".deck"),p=document.createElement("div");p.id="prog";p.className="prog";
  p.innerHTML=`<div class="pr-track"><i id="prFill"></i><em id="prMarks"></em></div><b id="prKnob"></b><span id="prTip"></span>`;
  deck.prepend(p);
  let drag=false,dragT=0,was=false;
  const marks=()=>{if(!plan)return;$("#prMarks").innerHTML=plan.cues.map(c=>`<s style="left:${(c.start/plan.total*100).toFixed(2)}%"></s>`).join("")};
  const tAt=x=>{const r=p.getBoundingClientRect();return clamp((x-r.left)/r.width,0,1)*plan.total};
  const show=T=>{const f=T/plan.total*100,c=cueAt(T);$("#prFill").style.width=f+"%";$("#prKnob").style.left=f+"%";
    const tip=$("#prTip");tip.style.left=f+"%";tip.innerHTML=`<b>${hhmm(dayMin(T))}</b>${esc(c.t.artist)}`};
  const move=e=>{dragT=tAt(e.clientX);show(dragT);follow=false;target=clamp(xOf(dragT)-W/2,0,maxCur())};
  p.addEventListener("pointerdown",e=>{if(!plan)return;drag=true;was=playing;p.classList.add("on");p.setPointerCapture(e.pointerId);move(e);e.stopPropagation()});
  p.addEventListener("pointermove",e=>{if(drag)move(e)});
  const up=()=>{if(!drag)return;drag=false;p.classList.remove("on");follow=true;seek(dragT,was||true)};
  p.addEventListener("pointerup",up);p.addEventListener("pointercancel",up);
  // the needle on the wall can be grabbed too
  const h=document.createElement("div");h.id="phH";h.className="ph-h";$("#ph").appendChild(h);
  const tFromWorld=x=>{let k=0;while(k<plan.cues.length-1&&colX(k+1)<=x)k++;const c=plan.cues[k],last=k===plan.cues.length-1,seg=(last?c.end:c.outAt)-c.start;return clamp(c.start+clamp((x-colX(k))/colW,0,1)*seg,0,plan.total-.5)};
  let hd=false,hT=0,hw=false;
  h.addEventListener("pointerdown",e=>{if(!plan)return;hd=true;hw=playing;h.setPointerCapture(e.pointerId);e.stopPropagation();follow=false;$("#ph").classList.add("grab")});
  h.addEventListener("pointermove",e=>{if(!hd)return;hT=tFromWorld(e.clientX+cur);$("#ph").style.left=xOf(hT).toFixed(1)+"px";show(hT);
    const ex=e.clientX;if(ex<W*.12)target=clamp(target-8,0,maxCur());if(ex>W*.88)target=clamp(target+8,0,maxCur())});
  const hup=()=>{if(!hd)return;hd=false;$("#ph").classList.remove("grab");follow=true;seek(hT,hw||true)};
  h.addEventListener("pointerup",hup);h.addEventListener("pointercancel",hup);
  (function loop(){requestAnimationFrame(loop);if(!plan)return;if(!drag)show(hd?hT:now());if(marks.n!==plan){marks.n=plan;marks()}})();
  window.__holdPh=()=>hd;
})();

/* hook into layout */
const _fxLayout=fxLayout;
fxLayout=function(){_fxLayout();splitTitles();const h=$("#phH");if(h){h.style.top=(rulerY-26)+"px";h.style.bottom="auto";h.style.height="56px"}};
requestAnimationFrame(motionFrame);
