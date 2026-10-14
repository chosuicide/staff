import numpy as np, cv2
OUT="/workspace/projects/4896cc87-49e2-4123-814f-61baadfbb3f6/deploy/staff/web/img/"
S=640
op=cv2.imread('oldpaper.jpg').astype(np.float32)/255
op=cv2.resize(op,(S,S),interpolation=cv2.INTER_AREA)
Lp=op.mean(2)
cr=cv2.imread('crumple.jpg',0).astype(np.float32)/255
h,w=cr.shape; cr=cr[int(h*.3):int(h*.3)+w//2, w//4:w//4+w//2]  # a calmer patch
cr=cv2.resize(cr,(S,S),interpolation=cv2.INTER_AREA)
crh=cr-cv2.GaussianBlur(cr,(0,0),18)          # crease relief only
crh=cv2.GaussianBlur(crh,(0,0),0.8)
# multiply layer: the paper's own staining/edge burn, normalised so clean paper = 1
shade=Lp/np.percentile(Lp,70)
shade=np.clip(shade,0,1)
shade=1-(1-shade)*0.85
shade=np.clip(shade*(1+np.clip(crh,-1,0)*0.8),0,1)        # crease shadows
cv2.imwrite(OUT+'sleeve-shade.jpg',(shade*255).astype(np.uint8),[cv2.IMWRITE_JPEG_QUALITY,86])
# screen layer: ring wear + edge/corner rub + crease highlights, broken up by the real paper grain
yy,xx=np.mgrid[0:S,0:S]/(S-1); c=.5
r=np.hypot(xx-c,yy-c)
grain=Lp-cv2.GaussianBlur(Lp,(0,0),2.2); grain=(grain-grain.min())/(np.ptp(grain)+1e-6)
fib=cv2.GaussianBlur(Lp,(0,0),6); fib=(fib-fib.min())/(np.ptp(fib)+1e-6)
d=r-0.455
ring=np.where(d<0,np.exp(-(d/0.03)**2),np.exp(-(d/0.012)**2))   # soft inside, crisp where the disc edge sat
ang=np.arctan2(yy-c,xx-c)
side=np.clip(0.35+0.65*np.cos(ang-2.3),0,1)**1.3
mott=cv2.GaussianBlur(Lp,(0,0),10); mott=(mott-mott.min())/(np.ptp(mott)+1e-6)
speck=np.clip((grain-0.55)*5,0,1)                                   # ink rubbed off in specks, from the paper's own fibre
ring*=side*np.clip((mott-0.3)*2.5,0,1)*speck
e=np.minimum(np.minimum(xx,1-xx),np.minimum(yy,1-yy))
edge=np.exp(-e/0.012)*np.clip(grain*2-0.5,0,1)
corner=np.exp(-np.minimum.reduce([np.hypot(xx,yy),np.hypot(1-xx,yy),np.hypot(xx,1-yy),np.hypot(1-xx,1-yy)])/0.05)
rub=np.clip(ring*0.6+edge*0.24+corner*0.4*np.clip(grain*2-.3,0,1)+np.clip(crh-0.02,0,1)*0.25,0,0.5)
o=np.dstack([np.full_like(rub,0.93),np.full_like(rub,0.91),np.full_like(rub,0.86),rub])
cv2.imwrite(OUT+'sleeve-rub.webp',(o[:,:,[2,1,0,3]]*255).astype(np.uint8),[cv2.IMWRITE_WEBP_QUALITY,82])
# preview on a cover
cov=cv2.imread('/workspace/projects/4896cc87-49e2-4123-814f-61baadfbb3f6/deploy/staff/web/art/331244363.jpg').astype(np.float32)/255
cov=cv2.resize(cov,(S,S))
p=cov*shade[...,None]
p=1-(1-p)*(1-o[...,[2,1,0]]*o[...,3:])
cv2.imwrite('sleeve_prev.jpg',(np.clip(p,0,1)*255).astype(np.uint8))
print('ok')
