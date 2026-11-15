import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR
"""검수 원본 manifest를 art_ingest 입력으로 보강하고 물결1 인물의 표시 자료를 준비한다."""
import hashlib
import json
from pathlib import Path
from art_ingest import read_json, write_json

ROOT = SAMPLE_ROOT
WAVE = ART_SOURCE_DIR / 'wave1'
CAST_IDS = {'gpi':'gpi','gem':'saw-gem','otaku':'otaku','menhera':'menhera',
            **{key:key for key in ['claude','sonnet','exaone','deepseek','qwen','grok']}}
NAMES = {'gpi':'지피짱','gem':'젬짱','claude':'클로드짱','sonnet':'소네트짱','exaone':'엑사원짱',
         'deepseek':'딥시크짱','qwen':'퀜짱','grok':'그록짱','otaku':'유저','menhera':'유저'}
COLORS = {'gpi':'#4b8dff','gem':'#42c7c5','claude':'#c9a267','sonnet':'#d8896a','exaone':'#c96aad',
          'deepseek':'#608bdd','qwen':'#a58be5','grok':'#e5b669','otaku':'#9dba7c','menhera':'#db94bd'}


def prepare():
    manifest = read_json(WAVE/'manifest.json')
    cast = read_json(PACK_DIR / 'cast.json')
    if not any(a.get('key') == 'gpi-generation-1' for a in manifest['assets']):
        raw = str(ART_SOURCE_DIR/'wave1/reference.png')
        manifest['assets'].append({'kind':'mech','key':'gpi-generation-1','file':'mech/gpi-generation-1.png',
          'sizeClass':'M','flying':False,'mode':'built-in image_gen edit',
          'rawSource':raw,'prompt':'prompts/mech-gpi-generation-1-w1.txt',
          'references':['public/v2/art/mech-omni-luna-sd.webp','art-src/wave1/bust/gpi.png','art-src/wave1/mech/gem-generation-1.png','art-src/wave1/mech/sonnet-generation-1.png'],
          'normalization':'RGBA alpha bounds uniformly fitted to 940px width / 880px height, horizontally centered, feet y942. No repaint.',
          'measurements':{'canvas':[1024,1024],'contentBounds':[42,90,982,942],'groundRatio':942/1024,'cornerAlpha':[0,0,0,0]},
          'passed':True,'sha256':hashlib.sha256((WAVE/'mech/gpi-generation-1.png').read_bytes()).hexdigest()})
    for a in manifest['assets']:
        key=a['key'];a.update(id=key,source=a['file'])
        if a['kind']=='bust':
            m=read_json(WAVE/'moods'/key/'manifest.json')
            expressions=m.get('assets',m.get('expressions',[]))
            a['moods']={e['expression']:f"moods/{key}/{e.get('file',e['expression']+'.png')}" for e in expressions}
            a['order']=['default',*[e['expression'] for e in expressions]]
            a['cast']=CAST_IDS[key]
            c=cast.setdefault(a['cast'],{'name':NAMES[key],'aliases':[NAMES[key].removesuffix('짱')],
                 'color':COLORS[key],'height':665,'moods':{}})
            c.update(color=COLORS[key],face=[.28,.08,.44,.294],cutin=[.28,.16,.44,.16])
            if not c.get('height'):c['height']=665
            c['moodNames']={**{k:v for k,v in c.get('moodNames',{}).items() if k not in ['기본','평소','미소','웃음','공격','기합','진지','당황','피격','충격','경악','놀람','슬픔','시무룩','분노','화남','부끄러움','쑥스러움']},**{e['expression']:e.get('label',e.get('name_ko',e['expression'])) for e in expressions}}
            # 기존 전체 표정은 옛 예시 그림이다. 이번에 검수받은 묶음으로 모두 교체한다.
            c['moods']={name:art for name,art in c.get('moods',{}).items() if name not in a['order']}
        else:
            a.update(unit='gem-generation-1' if key.startswith('gem-generation-1-') else key,size=a.get('sizeClass','M'))
            if key.startswith('gem-generation-1-'):a['form']=key.removeprefix('gem-generation-1-')
    write_json(WAVE/'manifest.json',manifest)
    write_json(PACK_DIR / 'cast.json',cast)


if __name__=='__main__':prepare()
