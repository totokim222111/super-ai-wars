import os
import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR
"""내장 image_gen의 세 엠블럼 수정만 원본에 옮긴다. 머리·알파·나머지 픽셀은 보존한다."""
from pathlib import Path
import hashlib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from art_ingest import ROOT, write_json

BASE=ART_SOURCE_DIR / 'wave2/bust/copilot-before-logo-fix.png'
GENERATED=Path(os.environ.get('COPILOT_IMAGE',str(ART_SOURCE_DIR/'wave2/copilot.png')))


def fix():
    original=Image.open(BASE).convert('RGBA');edited=Image.open(GENERATED).convert('RGBA')
    if edited.size!=original.size:edited=edited.resize(original.size,Image.Resampling.LANCZOS)
    mask=Image.new('L',original.size);d=ImageDraw.Draw(mask)
    regions=[(620,650,770,756),(0,945,158,1084),(892,935,1023,1080)]
    for x,y,r,b in regions:d.rectangle((x+8,y+8,r-8,b-8),fill=255)
    mask=mask.filter(ImageFilter.GaussianBlur(3))
    a=np.asarray(original).copy();e=np.asarray(edited);w=np.asarray(mask,dtype=np.float32)/255
    # 원본 외곽선과 투명도를 그대로 유지한다. 생성 결과의 배경은 사용하지 않는다.
    w[a[:,:,3]<230]=0
    for c in range(3):a[:,:,c]=np.rint(a[:,:,c]*(1-w)+e[:,:,c]*w).astype(np.uint8)
    target=BASE.with_name('copilot.png');Image.fromarray(a).save(target)
    head=(slice(0,645),slice(184,840));before=np.asarray(original)
    assert np.array_equal(a[head],before[head]);assert np.array_equal(a[:,:,3],before[:,:,3])
    changed=np.any(a!=before,axis=2)
    write_json(ART_SOURCE_DIR / 'wave2/copilot-logo-fix.json',{
      'tool':'built-in image_gen','before':'bust/copilot-before-logo-fix.png','after':'bust/copilot.png',
      'generated':str(GENERATED),'prompt':'prompts/copilot-logo-fix.txt','regions':regions,
      'composition':'generated RGB in three small badge regions; original alpha/outline and all other pixels retained',
      'headChangedPixels':0,'alphaChangedPixels':0,'changedPixels':int(changed.sum()),
      'beforeSha256':hashlib.sha256(BASE.read_bytes()).hexdigest(),'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
    print('copilot logo fix: head unchanged, alpha unchanged,',int(changed.sum()),'changed pixels')


if __name__=='__main__':fix()
