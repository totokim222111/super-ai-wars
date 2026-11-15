import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR
"""맵 재료의 넣기 manifest와 생성 건물 8칸 atlas를 정규화한다. 원본은 유지한다."""
import argparse
import json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

ROOT = SAMPLE_ROOT
THEMES=['datacenter','museum','harbor','snowfield','sovereign','cyber']

def ground(source,theme):
    image=Image.open(source).convert('RGB').resize((512,512),Image.Resampling.LANCZOS)
    a=np.asarray(image,dtype=float).copy();band=24
    # 생성된 반대쪽 가장자리만 페더한다. 가운데의 원화 구도는 유지한다.
    for i in range(band):
        weight=.5*(1-i/(band-1));left=a[:,i].copy();right=a[:,-i-1].copy()
        a[:,i]=left*(1-weight)+right*weight;a[:,-i-1]=right*(1-weight)+left*weight
    for i in range(band):
        weight=.5*(1-i/(band-1));top=a[i].copy();bottom=a[-i-1].copy()
        a[i]=top*(1-weight)+bottom*weight;a[-i-1]=bottom*(1-weight)+top*weight
    dest=ART_SOURCE_DIR / 'maps-v2'/theme/'ground-v2.png';dest.parent.mkdir(parents=True,exist_ok=True);Image.fromarray(a.round().clip(0,255).astype('uint8')).save(dest);return dest

def atlas(source, theme):
    image=Image.open(source).convert('RGBA')
    # 생성기의 칸 간격은 일정하지 않다. 알파 연결 성분에서 실제 건물 8개를 분리한다.
    mask=(np.asarray(image)[:,:,3]>96).astype('uint8')
    count,labels,stats,centers=cv2.connectedComponentsWithStats(mask)
    objects=[(s,c) for s,c in zip(stats[1:],centers[1:]) if s[4]>image.width*image.height*.015]
    if len(objects)!=8: raise ValueError(f'건물은 8개여야 함: {len(objects)}; 원본을 다시 생성하세요.')
    objects=sorted(objects,key=lambda p:p[1][1]);ordered=[]
    for row in [objects[:4],objects[4:]]: ordered+=sorted(row,key=lambda p:p[1][0])
    result=Image.new('RGBA',(2048,1024))
    for i,(s,_) in enumerate(ordered):
        x,y,w,h,_=s
        # 연결되지 않은 작은 그림자도 건물 주위 여백 안에서 함께 보존한다.
        pad=3;piece=image.crop((max(0,x-pad),max(0,y-pad),min(image.width,x+w+pad),min(image.height,y+h+pad)))
        # 저장 칸은 정사각형 UV다. 실제 1×1/2×1/2×2/3×2 비율은 판에서 복원한다.
        piece=piece.resize((492,492),Image.Resampling.LANCZOS)
        result.alpha_composite(piece,((i%4)*512+(512-piece.width)//2,(i//4)*512+502-piece.height))
    dest=ART_SOURCE_DIR / 'maps-v2'/theme/'buildings.png';dest.parent.mkdir(parents=True,exist_ok=True);result.save(dest)
    return dest

def manifests():
    # 원래 생성 기록은 바꾸지 않고 tools/art_ingest.py 입력 규격으로 별도 작성한다.
    src=ART_SOURCE_DIR / 'maps';entries=[]
    for theme in THEMES:
        for path in sorted((src/theme).glob('*.png')):
            material=path.stem
            if material not in ['ground','road','water','cache',*[f'cover-{i}' for i in range(1,5)],*[f'wall-{i}' for i in range(1,4)],*[f'decal-{i}' for i in range(1,4)]]:continue
            entries.append(dict(id=theme+'-'+material,kind='map-surface' if material in ['ground','road','water'] else 'map-prop',setting=theme,material=material,source=f'{theme}/{path.name}'))
    (src/'ingest.json').write_text(json.dumps({'assets':entries},indent=2)+'\n',encoding='utf8')
    dst=ART_SOURCE_DIR / 'maps-v2';dst.mkdir(exist_ok=True);entries=[]
    for theme in THEMES:
        if (dst/theme/'buildings.png').exists():entries.append(dict(id=theme+'-buildings',kind='map-building',setting=theme,material='buildings',source=f'{theme}/buildings.png'))
        if (dst/theme/'ground-v2.png').exists():entries.append(dict(id=theme+'-ground-v2',kind='map-surface',setting=theme,material='ground-v2',source=f'{theme}/ground-v2.png'))
        path=PACK_DIR/f'maps/{theme}.json';data=json.loads(path.read_text(encoding='utf8'))
        if (dst/theme/'ground-v2.png').exists():data['ground']=f'map-{theme}-ground-v2'
        data['buildings']=dict(art=f'map-{theme}-buildings',cols=4,rows=2,sizes=[[1,1],[2,1],[2,2],[3,2]])
        data['trim']={'datacenter':'#7c919c','museum':'#aa91ad','harbor':'#b7a077','snowfield':'#d4efff','sovereign':'#b9a36a','cyber':'#525c9a'}[theme]
        data['accent']={'datacenter':'#76dfd0','museum':'#eedaa2','harbor':'#eed599','snowfield':'#8bbfe7','sovereign':'#e9d890','cyber':'#61e4ef'}[theme]
        data['tiles']['saw-plain'].update(density=.22,scale=.9)
        data['tiles']['saw-cover']['scale']=.85
        path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    for theme,ep in [('datacenter','ep01'),('museum','ep02')]:
        if (dst/ep/'approved.png').exists():
            image=Image.open(dst/ep/'approved.png');entries.append(dict(id=theme+'-'+ep,kind='map-painted',setting=theme,material=ep,source=ep+'/approved.png',grid=[image.width//80,image.height//80]))
    (dst/'manifest.json').write_text(json.dumps({'assets':entries},indent=2)+'\n',encoding='utf8')

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--atlas',type=Path);p.add_argument('--ground',type=Path);p.add_argument('--theme',choices=THEMES);a=p.parse_args()
    if a.atlas:print(atlas(a.atlas,a.theme))
    if a.ground:print(ground(a.ground,a.theme))
    manifests()
