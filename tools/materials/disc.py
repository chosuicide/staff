import numpy as np, cv2
from scipy.ndimage import map_coordinates, gaussian_filter1d
OUT="/workspace/projects/4896cc87-49e2-4123-814f-61baadfbb3f6/deploy/staff/web/img/"
im=cv2.imread('vinyl_full.jpg')[:,:,::-1].astype(np.float32)/255
x0,x1,y0,y1=307,3682,284,3740
crop=im[y0:y1+1,x0:x1+1]
S=1024
sq=cv2.resize(crop,(S,S),interpolation=cv2.INTER_AREA)
L=sq.mean(2)
c=(S-1)/2; R=S/2
# polar
NR,NT=512,2048
rr=np.linspace(0,R,NR)[:,None]; tt=np.linspace(0,2*np.pi,NT,endpoint=False)[None,:]
X=c+rr*np.cos(tt); Y=c+rr*np.sin(tt)
P=map_coordinates(L,[Y,X],order=1,mode='nearest')
prof=np.median(P,axis=1,keepdims=True)
res=P-prof
H=gaussian_filter1d(res,40,axis=1,mode='wrap')   # slow angular change: reflections (static)
H=gaussian_filter1d(H,3,axis=0)
T=res-H                                          # fine texture: dust/scuffs (rotates with disc)
# back to cartesian
yy,xx=np.mgrid[0:S,0:S]; dx=xx-c; dy=yy-c; r=np.hypot(dx,dy); th=np.mod(np.arctan2(dy,dx),2*np.pi)
ri=r/R*(NR-1); ti=th/(2*np.pi)*NT
def back(A): return map_coordinates(np.concatenate([A,A[:,:1]],1),[ri,ti],order=1,mode='nearest')
base=back(prof.repeat(2,1)[:, :2].mean(1,keepdims=True).repeat(NT+0,1)) if False else np.interp(ri,np.arange(NR),prof[:,0])
tex=back(T)
Hc=back(H)
rf=r/S
LAB=0.172; HOLE=0.0085
g=np.clip(base+tex*0.9,0,1)
# slight warm neutral tint of black vinyl
rgb=np.stack([g*1.02,g*1.0,g*0.97],-1)
alpha=np.clip((0.497-rf)*S*0.9,0,1)               # soft outer edge
alpha*=np.clip((rf-LAB)*S*0.9,0,1)                # label is drawn from cover art
out=np.dstack([np.clip(rgb,0,1),alpha])
cv2.imwrite(OUT+'vinyl.webp',(out[:,:,[2,1,0,3]]*255).astype(np.uint8),[cv2.IMWRITE_WEBP_QUALITY,88])
# static reflections (screen)
sh=np.clip(Hc,0,None); sh=sh/ (sh.max()+1e-6)
a2=np.clip(sh*1.0,0,1)*np.clip((0.497-rf)*S*0.9,0,1)*np.clip((rf-0.175)*S*0.2,0,1)
o2=np.dstack([np.ones_like(a2)*0.96,np.ones_like(a2)*0.94,np.ones_like(a2)*0.9,a2])
o2=cv2.resize(o2,(512,512),interpolation=cv2.INTER_AREA)
cv2.imwrite(OUT+'vinyl-sheen.webp',(o2[:,:,[2,1,0,3]]*255).astype(np.uint8),[cv2.IMWRITE_WEBP_QUALITY,85])
# label paper: luminance of the real yellow label, normalised, spindle hole cut
lab=L.copy(); m=rf<LAB-0.004
v=lab[m]; lab=np.clip(lab/np.percentile(v,85),0,1.1)
lp=np.where(m,lab,1.0); lp=np.clip(lp,0,1)
la=np.where(rf<HOLE,0,1).astype(np.float32)
crop2=int(c-LAB*S),int(c+LAB*S)
lpc=lp[crop2[0]:crop2[1],crop2[0]:crop2[1]]; lac=la[crop2[0]:crop2[1],crop2[0]:crop2[1]]
o3=np.dstack([lpc,lpc,lpc,lac]); o3=cv2.resize(o3,(384,384),interpolation=cv2.INTER_AREA)
cv2.imwrite(OUT+'label-paper.webp',(o3[:,:,[2,1,0,3]]*255).astype(np.uint8),[cv2.IMWRITE_WEBP_QUALITY,85])
# preview composite on mid gray
prev=np.ones((S,S,3))*0.35
prev=prev*(1-alpha[...,None])+rgb*alpha[...,None]
s2=cv2.resize(o2,(S,S)); prev=1-(1-prev)*(1-s2[...,:3]*s2[...,3:]*0.6)
cv2.imwrite('disc_prev.jpg',(np.clip(prev,0,1)[:,:,::-1]*255).astype(np.uint8))
print('ok')
