import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR
"""검수 원본을 물결2 art_ingest 입력과 인물 표시 자료로 연결한다. 수치는 읽기만 한다."""
from art_ingest import ROOT, read_json, write_json, MOODS

KEYS=['llama','muse','mistral','hyperclova-x','doubao','glm','kimi','minimax','copilot','devin','midjourney','stable-diffusion','siri','perplexity','clippy','mythos']
CAST_IDS={key:{'midjourney':'saw-midjourney','stable-diffusion':'saw-sd'}.get(key,key) for key in KEYS}
NAMES=dict(zip(KEYS,['라마짱','뮤즈짱','미스트랄짱','하이퍼클로바X짱','더우바오짱','GLM짱','키미짱','미니맥스짱','코파일럿짱','데빈짱','미드저니짱','SD짱','시리짱','퍼플렉시티짱','클리피짱','미토스짱']))
COLORS=dict(zip(KEYS,['#d9ad6b','#526ce6','#d8793d','#4b916f','#be6d76','#9a9bdf','#b6afc1','#ef8eaf','#d9b665','#aaa276','#d998d4','#9870b9','#b3c9f2','#65a49b','#e8bd5c','#bba16e']))
MECH_CAST={'hyperclova':'hyperclova-x','sd':'stable-diffusion'}


def prepare():
    wave=ART_SOURCE_DIR / 'wave2';pack=PACK_DIR
    cast=read_json(pack/'cast.json');units=read_json(pack/'units.json');assets=[]
    for key in KEYS:
        m=read_json(wave/'moods'/key/'manifest.json');expressions=m.get('assets',m.get('expressions',[]))
        by_id={e['expression']:e for e in expressions};order=[*MOODS,*[e['expression'] for e in expressions if e['expression'] not in MOODS]]
        assert len(order)<=12,(key,order)
        paths={name:f"moods/{key}/{by_id[name].get('file',name+'.png')}" for name in order if name!='default'}
        assert all((wave/path).is_file() for path in paths.values()),key
        id=CAST_IDS[key]
        c=cast.setdefault(id,{'name':NAMES[key],'aliases':[NAMES[key].removesuffix('짱')],'color':COLORS[key],'height':665,'moods':{}})
        c.update(color=COLORS[key],height=665,face=[.28,.08,.44,.294],cutin=[.28,.16,.44,.16])
        if key=='hyperclova-x':c['aliases']=list(dict.fromkeys([*c.get('aliases',[]),'하이퍼클로바','hyperclova']))
        c['moodNames']={**c.get('moodNames',{}),**m.get('sheet_expression_mapping',{}),**{name:e.get('label',e.get('name_ko',name)) for name,e in by_id.items()}}
        c['moods']={name:art for name,art in c.get('moods',{}).items() if name not in order}
        assets.append({'kind':'bust','id':key,'cast':id,'source':f'bust/{key}.png','moods':paths,'order':order,'moodManifest':f'moods/{key}/manifest.json'})
    raw=read_json(wave/'mech/manifest.json')
    for a in raw['assets']:
        stem=a['id'].removeprefix('rival-');targets=[id for id in units if id.startswith((f'rival-{stem}-',f'ally-{stem}-'))]
        assert targets,a['id']
        assets.append({'kind':'mech','id':a['id'],'source':f"mech/{a['id']}.png",'unit':targets[0],'units':targets,
             'size':a['size'],'flying':a.get('movement')=='flying','pilotCast':CAST_IDS[MECH_CAST.get(stem,stem)]})
    write_json(wave/'manifest.json',{'wave':2,'spec':'docs/v2-asset-spec.md','copilotLogoFix':'copilot-logo-fix.json','assets':assets})
    write_json(pack/'cast.json',cast)


if __name__=='__main__':prepare()
