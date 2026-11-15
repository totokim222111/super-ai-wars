import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR
"""내장 image_gen 수정본을 규격 캔버스에 비례 배치한다. 다시 그리거나 색을 칠하지 않는다."""
import hashlib
import cv2
import numpy as np
from PIL import Image, ImageDraw
from art_ingest import ROOT, bbox, check, font, read_json, write_json


def finish():
    wave=ART_SOURCE_DIR / 'wave4'; records=read_json(wave/'fixes.json')
    out=Image.new('RGB',(1100,len(records)*450),'#080d20'); draw=ImageDraw.Draw(out)
    for row,r in enumerate(records):
        ident=r['id']; raw=Image.open(r['resultPath']).convert('RGBA'); pixels=np.asarray(raw).copy()
        count,labels,stats,_=cv2.connectedComponentsWithStats((pixels[:,:,3]>=8).astype(np.uint8))
        small=[i for i in range(1,count) if stats[i,cv2.CC_STAT_AREA]<24]
        pixels[np.isin(labels,small),3]=0
        pixels[pixels[:,:,3]<8,3]=0
        image=Image.fromarray(pixels); area=bbox(image); image=image.crop(area)
        flying=ident=='deepseek-mobydick'; bottom=890 if flying else 943
        scale=min(940/image.width,(bottom-65)/image.height)
        image=image.resize((round(image.width*scale),round(image.height*scale)),Image.Resampling.LANCZOS)
        selected=Image.new('RGBA',(1024,1024)); position=((1024-image.width)//2,bottom-image.height); selected.paste(image,position)
        path=wave/'mech'/f'{ident}.png'; selected.save(path)
        metrics,warnings=check(selected,'mech',flying)
        assert not warnings,(ident,warnings)
        suffix='before-color-fix' if ident.startswith('gpi') else 'before-shape-fix'; before=wave/'mech'/f'{ident}-{suffix}.png'
        r.update(mode='built-in image_gen edit',saved=f'mech/{ident}.png',before=f'mech/{before.name}',
                 normalization={'sourceSize':list(raw.size),'alphaBounds':area,'scale':scale,'position':position,'removedSmallIslands':len(small)},
                 metrics=metrics,passed=True,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),beforeSha256=hashlib.sha256(before.read_bytes()).hexdigest())
        for col,(title,pic) in enumerate([('수정 전',Image.open(before)),('수정 후',selected)]):
            p=pic.copy();p.thumbnail((500,400));x=col*550+(550-p.width)//2;y=row*450+40
            out.paste(p,(x,y),p);draw.text((col*550+15,row*450+8),f'{ident} · {title}',fill='white',font=font(18))
    out.save(ROOT/'tools/out/art/w4-fixes.png');write_json(wave/'fixes.json',records)
    lineup=Image.new('RGB',(1500,560),'#080d20');d=ImageDraw.Draw(lineup)
    for i,key in enumerate(['grok-generation-2','grok-generation-3','grok-generation-4']):
        im=Image.open(wave/'mech'/f'{key}.png');im=im.crop(bbox(im));im.thumbnail((480,480));lineup.paste(im,(i*500+(500-im.width)//2,540-im.height),im);d.text((i*500+12,12),key,fill='white',font=font(20))
    lineup.save(ROOT/'tools/out/art/w4-grok-lineup.png')
    print('수정 6장 규격 PASS; 앞뒤 비교·그록 3세대 모음 저장')


if __name__=='__main__':finish()
