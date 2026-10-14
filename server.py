"""STAFF server: static web/ + live pipeline for any shop.
Qloo (place -> artists its crowd likes) -> SoundCloud full tracks -> BeatScope rhythm -> web/data/<slug>.json, written
progressively so the wall can hang each record as soon as it is analysed.
Run: QLOO_API_KEY=... python server.py [port]"""
import os,sys,json,re,threading,queue,subprocess,urllib.request,urllib.parse,time,traceback
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
import numpy as np
ROOT=os.path.dirname(os.path.abspath(__file__)); WEB=os.path.join(ROOT,"web"); os.chdir(ROOT)
QLOO="https://hackathon.api.qloo.com"; KEY=os.environ.get("QLOO_API_KEY","")
KEYFILE=os.environ.get("QLOO_KEY_FILE",""); SETKEY=os.environ.get("SETKEY_TOKEN","")
if KEYFILE and os.path.exists(KEYFILE): KEY=open(KEYFILE).read().strip() or KEY
import shutil
BS=os.environ.get("BEATSCOPE_BIN") or shutil.which("beatscope") or "/workspace/work/bs/venv/bin/beatscope"; BS_DIR=os.environ.get("BEATSCOPE_DIR",ROOT)
N_TRACKS=8; N_ARTISTS=16
# scratch dir for downloaded full tracks: must be writable by the server user
FULL=os.environ.get("FULL_DIR") or ("/data/full" if os.access("/data",os.W_OK) else os.path.join(os.path.dirname(os.path.abspath(__file__)),"full"))
JOBS={}; LOCK=threading.Lock()
# one wall at a time: BeatScope peaks ~2 GB, so parallel builds just thrash a small box
BUILD=threading.Semaphore(1); LINE=[]

def qloo(path,**q):
    r=urllib.request.Request(QLOO+path+"?"+urllib.parse.urlencode(q),headers={"X-Api-Key":KEY})
    return json.load(urllib.request.urlopen(r,timeout=30))
def fold(b):
    while b>150: b/=2
    while b<75: b*=2
    return b
def z(a): a=np.array(a,float); return (a-a.mean())/(a.std()+1e-9)
norm=lambda s:re.sub(r"\W","",(s or "").lower())
BAD=re.compile(r"(?i)(remix|bootleg|rmx|nightcore|cover|karaoke|instrumental|slowed|sped up|リミックス|歌ってみた|カバー|弾いてみた|커버|\b(mix|set|edit|live|8d|loop)\b)")

def places(q):
    rs=qloo("/search",query=q,types="urn:entity:place",take=8).get("results",[])
    out=[]
    for r in rs:
        p=r.get("properties") or {}
        out.append({"id":r["entity_id"],"name":r["name"],"address":p.get("address") or "","image":(p.get("image") or {}).get("url"),
                    "hours":p.get("hours"),"neighborhood":p.get("neighborhood"),"tags":[t["name"] for t in r.get("tags",[])][:24]})
    return out

def oembed_art(url):
    try:
        j=json.load(urllib.request.urlopen(urllib.request.Request("https://soundcloud.com/oembed?format=json&url="+urllib.parse.quote(url,safe=""),headers={"User-Agent":"Mozilla/5.0"}),timeout=15))
        u=j.get("thumbnail_url"); return None if (not u or "placeholder" in u) else u
    except Exception: return None
def save_img(u,dst):
    if not u: return None
    if not os.path.exists(dst):
        try: open(dst,"wb").write(urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"Mozilla/5.0"}),timeout=20).read())
        except Exception: return None
    return os.path.relpath(dst,WEB)

class Job:
    def __init__(s,slug,place):
        s.slug=slug; s.place=place; s.stage="qloo"; s.msg="Asking Qloo who walks in"; s.artists=[]; s.tracks=[]; s.done=False; s.error=None
        s.log=[]
    def say(s,stage,msg): s.stage=stage; s.msg=msg; s.log.append(msg); print(s.slug,msg,flush=True)
    def state(s): return {"slug":s.slug,"stage":s.stage,"msg":s.msg,"artists":s.artists,"ready":len(s.tracks),"target":N_TRACKS,"done":s.done,"error":s.error,"log":s.log[-6:]}
    def write(s):
        rows=[dict(t) for t in s.tracks]
        if len(rows)>=2:
            e=z([x["bpm"] for x in rows])*0.5+z([x["rms"] for x in rows])*0.3+z([x["dens"] for x in rows])*0.2
        else: e=[0.0]*len(rows)
        for x,v in zip(rows,e): x["energy"]=round(float(v),3)
        p=s.place; d={"id":s.slug,"name":p["name"],"area":p.get("address",""),"place_id":p["id"],"image":p.get("image_local"),"hours":p.get("hours"),"tags":p.get("tags",[]),
           "live":True,"artists":s.artists,"tracks":rows,"complete":s.done}
        tmp=f"{WEB}/data/{s.slug}.json.tmp"; json.dump(d,open(tmp,"w"),ensure_ascii=False); os.replace(tmp,f"{WEB}/data/{s.slug}.json")

    def run(s):
        with LOCK: LINE.append(s)
        while not BUILD.acquire(timeout=2):
            with LOCK: ahead=LINE.index(s)+1
            s.stage="queue"; s.msg=f"In line. {ahead} wall{'s' if ahead!=1 else ''} going up before this one."
        with LOCK: LINE.remove(s)
        s.say("qloo","Asking Qloo who walks in")
        try: s._run()
        except Exception as e:
            traceback.print_exc(); s.error=str(e)[:200]; s.say("error","Something broke: "+s.error)
        s.done=True
        BUILD.release()
        try: s.write()
        except Exception: pass
    def _run(s):
        import yt_dlp
        p=s.place; os.makedirs(f"{WEB}/art",exist_ok=True); os.makedirs(f"{FULL}/{s.slug}",exist_ok=True); os.makedirs(f"{WEB}/audio/{s.slug}",exist_ok=True)
        p["image_local"]=save_img(p.get("image"),f"{WEB}/art/place_{s.slug}.jpg")
        try:
            r0=[r for r in qloo("/search",query=p["name"],types="urn:entity:place",take=5).get("results",[]) if r["entity_id"]==p["id"]]
            if r0: p["hours"]=(r0[0].get("properties") or {}).get("hours"); p["tags"]=p.get("tags") or [t["name"] for t in r0[0].get("tags",[])][:24]
        except Exception: pass
        ents=qloo("/v2/insights",**{"filter.type":"urn:entity:artist","signal.interests.entities":p["id"],"take":N_ARTISTS})["results"]["entities"]
        if not ents: raise RuntimeError("Qloo has no taste signal for this place yet")
        for a in ents:
            pr=a.get("properties") or {}
            al=[x if isinstance(x,str) else x.get("value","") for x in (pr.get("aliases") or [])]
            ph=(pr.get("image") or {}).get("url")
            s.artists.append({"name":a["name"],"affinity":round(a["query"]["affinity"],4),"aliases":[x for x in al if x][:4],
                              "photo":save_img(ph,f"{WEB}/art/qa_{a['entity_id'][:12]}.jpg"),"status":"waiting",
                              "atags":[t["name"] for t in a.get("tags",[]) if t.get("name")][:8],"pop":round(a.get("popularity") or 0,3)})
        s.say("crate",f"Qloo found {len(ents)} artists this crowd already loves")
        s.write()
        q=queue.Queue(); stop=threading.Event()
        def fetcher():
            ydl=yt_dlp.YoutubeDL({"quiet":True,"skip_download":True,"noprogress":True,"ignoreerrors":True,"no_warnings":True})
            dl=yt_dlp.YoutubeDL({"quiet":True,"noprogress":True,"format":"bestaudio","outtmpl":f"{FULL}/{s.slug}/%(id)s.%(ext)s",
                "postprocessors":[{"key":"FFmpegExtractAudio","preferredcodec":"mp3"}]})
            for i,a in enumerate(s.artists):
                if stop.is_set(): break
                while q.qsize()>=2 and not stop.is_set(): time.sleep(1)
                a["status"]="digging"; names=[a["name"]]+a["aliases"]; got=None
                for nm in names[:2]:
                    try: res=ydl.extract_info(f"scsearch8:{nm}",download=False)["entries"]
                    except Exception as e: print("search fail",nm,e); time.sleep(3); continue
                    for e in res:
                        if not e: continue
                        d=e.get("duration") or 0; txt=(e.get("title") or "")+" "+(e.get("uploader") or "")
                        if not (110<=d<=480) or BAD.search(e.get("title","")): continue
                        if not any(norm(n) and norm(n) in norm(txt) for n in names): continue
                        got=e; break
                    if got: break
                if not got: a["status"]="not found"; continue
                fn=f"{FULL}/{s.slug}/{got['id']}.mp3"
                if not os.path.exists(fn):
                    try: dl.download([got["webpage_url"]])
                    except Exception as x: print("dl fail",x); a["status"]="not found"; time.sleep(4); continue
                if not os.path.exists(fn): a["status"]="not found"; continue
                a["status"]="fetched"; q.put((a,got,fn)); time.sleep(2)
            q.put(None)
        th=threading.Thread(target=fetcher,daemon=True); th.start()
        import librosa
        while len(s.tracks)<N_TRACKS:
            it=q.get()
            if it is None: break
            a,e,fn=it; a["status"]="listening"
            s.say("listen",f"BeatScope is listening to {a['name']}")
            rj=fn.replace(".mp3",".rhythm.json")
            if not os.path.exists(rj):
                # BeatScope on a 22 kHz mono copy: same downbeats, about half the time
                wv=fn.replace(".mp3",".22k.wav")
                try:
                    subprocess.run(["ffmpeg","-y","-loglevel","error","-i",fn,"-ac","1","-ar","22050",wv],check=True)
                    subprocess.run([BS,"analyze",os.path.abspath(wv),"-o",os.path.abspath(rj)],cwd=BS_DIR,timeout=300,check=True,capture_output=True)
                    os.remove(wv)
                except Exception as x: print("bs fail",x); a["status"]="skipped"; continue
            r=json.load(open(rj)); y,sr=librosa.load(fn,sr=22050,mono=True)
            down=[round(b["time"],3) for b in r["beats"] if b["downbeat"]]
            if len(down)<16: a["status"]="skipped"; continue
            env=np.array(r["energy"]["bands"]["all"]);fps=int(r["energy"]["fps"]) or 1
            env=[float(env[i:i+fps].mean()) for i in range(0,len(env),fps)];mx=max(env) or 1;env=[round(v/mx,3) for v in env]
            dst=f"{WEB}/audio/{s.slug}/{e['id']}.mp3"
            if not os.path.exists(dst): subprocess.run(["ffmpeg","-y","-loglevel","error","-i",fn,"-ac","2","-b:a","128k",dst],check=True)
            s.tracks.append({"id":str(e["id"]),"artist":a["name"],"qloo_name":a["name"],"affinity":a["affinity"],"atags":a.get("atags",[]),"pop":a.get("pop",0),"title":e.get("title"),
                "uploader":e.get("uploader"),"link":e.get("webpage_url"),"audio":os.path.relpath(dst,WEB),"dur":round(len(y)/sr,2),
                "bpm":round(fold(r["tempo"]["global_bpm"]),1),"rms":round(float(np.sqrt((y**2).mean())),4),"dens":round(len(r["onsets"])/(len(y)/sr),2),
                "down":down,"env":env,"art":save_img(oembed_art(e.get("webpage_url")),f"{WEB}/art/{e['id']}.jpg"),"photo":a["photo"]})
            a["status"]="on the wall"; s.write()
            s.say("hang",f"Hung {a['name']} on the wall ({len(s.tracks)}/{N_TRACKS})")
        stop.set(); s.say("done",f"The wall is hung: {len(s.tracks)} records")

def slug_of(pid): return "p_"+re.sub(r"[^a-z0-9]","",pid.lower())[:10]

FORM='<!doctype html><meta name=viewport content="width=device-width"><body style="font:18px sans-serif;padding:24px;background:#16120e;color:#eee"><form method=post><p>Qloo API key</p><input name=k type=password style="width:100%;font-size:18px;padding:8px"><p><button style="font-size:18px;padding:8px 20px">Save</button></form>'
class H(SimpleHTTPRequestHandler):
    def __init__(s,*a,**k): super().__init__(*a,directory=WEB,**k)
    def log_message(s,*a): pass
    def jsend(s,o,code=200):
        b=json.dumps(o,ensure_ascii=False).encode(); s.send_response(code); s.send_header("Content-Type","application/json"); s.send_header("Content-Length",str(len(b))); s.send_header("Cache-Control","no-store"); s.end_headers(); s.wfile.write(b)
    def end_headers(s):
        if s.path.startswith("/data/"): s.send_header("Cache-Control","no-store")
        super().end_headers()
    def html(s,t):
        b=t.encode(); s.send_response(200); s.send_header("Content-Type","text/html; charset=utf-8"); s.send_header("Content-Length",str(len(b))); s.end_headers(); s.wfile.write(b)
    def do_POST(s):
        global KEY
        if not SETKEY or s.path!="/setkey-"+SETKEY: s.send_response(404); s.end_headers(); return
        n=int(s.headers.get("Content-Length",0)); k=urllib.parse.parse_qs(s.rfile.read(n).decode()).get("k",[""])[0].strip()
        if k:
            KEY=k
            if KEYFILE: open(KEYFILE,"w").write(k)
        try: ok=bool(qloo("/search",query="coffee",types="urn:entity:place",take=1))
        except Exception as e: ok=False
        s.html("<body style='font:20px sans-serif;padding:24px'>"+("Saved. Qloo OK" if ok else "Saved, but Qloo rejected the key"))
    def do_GET(s):
        u=urllib.parse.urlparse(s.path); q={k:v[0] for k,v in urllib.parse.parse_qs(u.query).items()}
        if SETKEY and u.path=="/setkey-"+SETKEY: return s.html(FORM)
        try:
            if u.path=="/api/places": return s.jsend(places(q.get("q","")) if q.get("q","").strip() else [])
            if u.path=="/api/build":
                pid=q["id"]; slug=slug_of(pid)
                with LOCK:
                    j=JOBS.get(slug)
                    if not j:
                        if os.path.exists(f"{WEB}/data/{slug}.json") and json.load(open(f"{WEB}/data/{slug}.json")).get("complete"):
                            return s.jsend({"slug":slug,"done":True,"stage":"done","ready":-1})
                        j=Job(slug,{"id":pid,"name":q.get("name",""),"address":q.get("address",""),"image":q.get("image"),"hours":None,"tags":[x for x in q.get("tags","").split("|") if x]})
                        JOBS[slug]=j; threading.Thread(target=j.run,daemon=True).start()
                return s.jsend(j.state())
            if u.path=="/api/job":
                j=JOBS.get(q.get("slug",""))
                return s.jsend(j.state() if j else {"error":"no such job"},200 if j else 404)
            if u.path=="/api/img":
                src=q.get("u","")
                if not src.startswith("https://images.qloo.com/"): return s.jsend({"error":"bad"},400)
                b=urllib.request.urlopen(urllib.request.Request(src,headers={"User-Agent":"Mozilla/5.0"}),timeout=15).read()
                s.send_response(200); s.send_header("Content-Type","image/jpeg"); s.send_header("Cache-Control","max-age=86400"); s.send_header("Content-Length",str(len(b))); s.end_headers(); s.wfile.write(b); return
            if u.path=="/api/walls":
                out=[]
                for f in sorted(os.listdir(f"{WEB}/data")):
                    if f.endswith(".json"):
                        try: d=json.load(open(f"{WEB}/data/{f}")); out.append({"id":d["id"],"name":d["name"],"n":len(d["tracks"]),"live":d.get("live",False)})
                        except Exception: pass
                return s.jsend(out)
        except Exception as e:
            traceback.print_exc(); return s.jsend({"error":str(e)[:200]},500)
        return super().do_GET()

def persist_walls():
    """Keep walls built on the server across restarts: web/data|audio|art live on the /data volume."""
    base=os.environ.get("PERSIST_DIR") or "/data/web"
    if not (os.path.isdir(os.path.dirname(base)) and os.access(os.path.dirname(base),os.W_OK)): return
    for sub in ("data","audio","art"):
        src=os.path.join(WEB,sub); dst=os.path.join(base,sub); os.makedirs(dst,exist_ok=True)
        if os.path.islink(src): continue
        if os.path.isdir(src):
            for r,_,fs in os.walk(src):
                for f in fs:
                    a=os.path.join(r,f); b=os.path.join(dst,os.path.relpath(a,src))
                    if not os.path.exists(b): os.makedirs(os.path.dirname(b),exist_ok=True); shutil.copy2(a,b)
            shutil.rmtree(src)
        os.symlink(dst,src)
    open(os.path.join(base,".persisted"),"w").write("1"); print("walls persisted in",base,flush=True)

if __name__=="__main__":
    try: persist_walls()
    except Exception: traceback.print_exc()
    port=int(sys.argv[1]) if len(sys.argv)>1 else int(os.environ.get("PORT","8765"))
    print("STAFF on",port,flush=True); ThreadingHTTPServer(("0.0.0.0",port),H).serve_forever()
