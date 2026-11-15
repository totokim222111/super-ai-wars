import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR
"""호환 항목과 누락 연출을 명시하고, 초과 WebP만 품질 80→76 범위에서 정리한다."""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
ROOT = SAMPLE_ROOT;PACK=PACK_DIR;OUT=ROOT/'tools/out/release-cleanup'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def write(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
def configure():
    game=read(PACK/'game.json');cast=read(PACK/'cast.json');weapons=read(PACK/'weapons.json')
    game['compatibility']={'units':{id:'SAW 본편·견본에서 미사용. 이전 시험 저장 검증을 위해 규칙 id 유지.' for id in ['mech-'+c for c in 'abcdef']+['trial-a','trial-c','trial-wing','trial-guard','trial-boss','trial-combined']},'cast':{id:'옛 이식 인물 id. 현재 대본·전투·진열장 미사용, 저장 참조 호환용 유지.' for id in ['gem','rival','boss']}}
    cast['system']['voiceOnly']=True
    animations={'blade':dict(template='slash-combo',hits=3,words=['시험','절단','완료']),'rifle':dict(template='rapid-fire',shots=3),'beam':dict(template='beam',color='#73dfff'),'cannon':dict(template='heavy-shot',color='#ffcf69'),'burst':dict(template='spread-shot',count=7),'trial-map':dict(template='artillery',count=6)}
    for id,anim in animations.items():weapons[id]={'anim':anim}
    write(PACK/'game.json',game);write(PACK/'cast.json',cast);write(PACK/'weapons.json',weapons)

def compress():
    s=(ROOT/'tools/out/maps-v2-pack.json').read_text(encoding='utf-8-sig');baseline=json.loads(s[s.index('['):])[0]
    game=read(PACK/'game.json');records=[];OUT.mkdir(parents=True,exist_ok=True)
    for warning in baseline['warnings']:
        if warning['kind']!='그림 용량':continue
        id=warning['message'].split(':')[0];path=ROOT/'public'/game['art']['files'][id].lstrip('/')
        limit=int(warning['message'].split('상한 ')[1].split('KB')[0])*1024
        original=Image.open(path).convert('RGBA');a=np.asarray(original).copy();before=path.stat().st_size
        backup=OUT/'original-art'/path.relative_to(PACK_DIR/'art');backup.parent.mkdir(parents=True,exist_ok=True)
        if not backup.exists():backup.write_bytes(path.read_bytes())
        else:original=Image.open(backup).convert('RGBA');a=np.asarray(original).copy();before=backup.stat().st_size
        # 완전 투명 픽셀의 숨은 RGB와 알파 1~2의 잡티만 지운다. 구도·여백·얼굴 좌표를 유지한다.
        a[a[:,:,3]<=2]=0;clean=Image.fromarray(a)
        chosen=None
        for quality in [80,79,78,77,76]:
            candidate=OUT/f'candidate-{id}.webp';clean.save(candidate,'WEBP',quality=quality,alpha_quality=90,method=6,exact=True)
            decoded=np.asarray(Image.open(candidate).convert('RGBA'),dtype=float);ref=np.asarray(original,dtype=float);mask=ref[:,:,3]>24
            rmse=float(np.sqrt(np.mean((decoded[:,:,:3][mask]-ref[:,:,:3][mask])**2))) if np.any(mask) else 0
            chosen=dict(quality=quality,after=candidate.stat().st_size,rmse=round(rmse,3))
            if candidate.stat().st_size<=limit or quality==76:break
        # 얼굴·기체 윤곽에 큰 차이가 생기면 원본을 유지하고 경고를 보고한다.
        accepted=chosen['rmse']<=7 and chosen['after']<before
        if accepted:path.write_bytes(candidate.read_bytes())
        records.append(dict(id=id,path=str(path.relative_to(ROOT)),before=before,limit=limit,accepted=accepted,**chosen,remaining=not accepted or chosen['after']>limit))
        candidate.unlink()
    write(OUT/'compression.json',records);print(json.dumps(records,ensure_ascii=False,indent=2))
if __name__=='__main__':configure();compress()
