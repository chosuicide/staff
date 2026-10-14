/* STAFF motion II: tilt + glare, bar ripples, beat-waving shop name, tap shockwave, count-up / decode text, FLIP re-hang */
(()=>{
const RM=matchMedia("(prefers-reduced-motion:reduce)").matches;if(RM)return;
/* ---- tilt: pointer on desktop, phone tilt on touch ---- */
let tx=0,ty=0;
addEventListener("pointermove",e=>{if(e.pointerType!=="mouse")return;tx=(e.clientX/innerWidth-.5)*2;ty=(e.clientY/innerHeight-.5)*2});
addEventListener("deviceorientation",e=>{if(e.gamma==null)return;tx=clamp(e.gamma/25,-1,1);ty=clamp((e.beta-45)/25,-1,1)});
(function t(){requestAnimationFrame(t);const d=$("#wall").classList.contains("drag");TX+=((d?0:tx)-TX)*.08;TY+=((d?0:ty)-TY)*.08})();

/* ---- rings that live on the wall ---- */
function ring(k,cls,life){const g=G[k];if(!g)return;const el=document.createElement("i");el.className="rip "+cls;
  const s=R*1.02;Object.assign(el.style,{left:(g.sx+R/2+R*.5-s/2)+"px",top:(g.cy-s/2)+"px",width:s+"px",height:s+"px"});
  $("#world").appendChild(el);setTimeout(()=>el.remove(),life)}
/* every bar: a groove-ring ripple off the playing record + the shop name waves */
window.onDown=(k,b)=>{if(document.hidden)return;ring(k,"bar",1400);
  if(b%4===0){const rn=$("#rName");rn.classList.remove("wave");void rn.offsetWidth;rn.classList.add("wave")}};
/* drop the needle: shockwave + the whole wall takes the hit */
window.onTapDisc=k=>{ring(k,"hit",900);setTimeout(()=>ring(k,"hit h2",900),110);
  const w=$("#wall");w.classList.remove("thump");void w.offsetWidth;w.classList.add("thump");
  const col=(frame.cols||[])[k];if(col){col.classList.remove("flash");void col.offsetWidth;col.classList.add("flash")}};

/* ---- split the shop name into letters for the wave ---- */
const _fl=window.fxLayout;
window.fxLayout=function(){_fl&&_fl.apply(this,arguments);const rn=$("#rName");if(rn&&!rn.dataset.sp){const t=rn.textContent;rn.dataset.sp=t;
  rn.innerHTML=[...t].map((ch,i)=>`<span style="--i:${i}">${ch===" "?"&nbsp;":esc(ch)}</span>`).join("")}};
const _dec=window.decorate;
if(typeof decorate==="function"){decorate=function(){const rn=$("#rName");if(rn)rn.dataset.sp="";return _dec.apply(this,arguments)}}

/* ---- when a record comes to centre: numbers count up, artist name decodes ---- */
const GL="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/+";
function decode(el){const fin=el.dataset.v||(el.dataset.v=el.textContent),n=[...fin];const t0=performance.now(),D=520;
  (function f(){const p=(performance.now()-t0)/D;if(p>=1){el.textContent=fin;return}const r=Math.floor(p*n.length);
    el.textContent=n.map((c,i)=>i<r||c===" "?c:GL[(Math.random()*GL.length)|0]).join("");requestAnimationFrame(f)})()}
function count(el){const fin=el.dataset.v||(el.dataset.v=el.textContent),m=/^([+-]?)(\d+)(?:\.(\d+))?$/.exec(fin);if(!m)return;
  const v=parseFloat(fin),dp=(m[3]||"").length,t0=performance.now(),D=700;
  (function f(){const p=Math.min(1,(performance.now()-t0)/D),e=1-Math.pow(1-p,4),x=v*e;
    el.textContent=(m[1]==="+"&&x>=0?"+":"")+x.toFixed(dp);if(p<1)requestAnimationFrame(f)})()}
window.onIn=(el)=>{el.querySelectorAll(".facts b").forEach(count);const a=el.querySelector(".art");if(a)decode(a);const q=el.querySelector(".idx span:last-child");if(q)decode(q)};

/* ---- re-hang: records fly from where they were to where the new curve puts them ---- */
const keyOf=c=>c.t.artist+"|"+c.t.title;
function snap(){if(!plan)return null;const m=new Map();plan.cues.forEach((c,k)=>{const g=G[k];if(g)m.set(keyOf(c),{x:g.sx-cur,y:g.cy})});return m}
function flip(old){if(!old)return;(frame.cols=$$(".col")).forEach((el,k)=>{const c=plan.cues[k],g=G[k],o=old.get(keyOf(c));
  if(!o){el.style.setProperty("--d",(k*.07)+"s");el.classList.add("drop");return}
  const dx=o.x-(g.sx-cur),dy=o.y-g.cy;if(Math.abs(dx)+Math.abs(dy)<2)return;
  el.style.transition="none";el.style.transform=`translate(${dx}px,${dy}px)`;void el.offsetWidth;
  el.style.transition=`transform 1.1s cubic-bezier(.65,0,.15,1) ${(k*.05).toFixed(2)}s`;el.style.transform="";
  setTimeout(()=>{el.style.transition=""},1300+k*50)})}
const wb=$("#writeBtn"),_w=wb.onclick;wb.onclick=function(){const o=snap();_w.apply(this,arguments);flip(o)};
})();
