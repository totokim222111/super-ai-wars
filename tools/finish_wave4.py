import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR
"""물결4 등록 결과를 형태·에피소드·전투 배경에 연결한다."""
from PIL import Image
from art_ingest import ROOT, HEIGHTS, bbox, read_json, write_json
from prepare_wave4 import WAVE, PACK, HUMAN_IDS

TINT={'from':'mech-sonnet-generation-2','hue':120,'sat':1.05,'light':.025}


def finish():
    manifest=read_json(WAVE/'manifest.json');game=read_json(PACK/'game.json');units=read_json(PACK/'units.json');cast=read_json(PACK/'cast.json')
    bindings={};reviewed={}
    for a in manifest['assets']:
        if a['kind']!='mech':continue
        ident=a['id'];art='mech-'+ident;points=a['reviewedAnchors']
        for uid in a['units']:
            root=units[uid];root['pilotCast']=a['pilotCast'];u=root.setdefault('forms',{}).setdefault(a['form'],{}) if a.get('form') else root
            u.update(art=art,faces='left',height=HEIGHTS[a['size']],anchors=points)
            for k in ('icon','iconCrop','temporary','recolor'):u.pop(k,None)
            if a['size']=='LL':
                im=Image.open(WAVE/a['source']);x0,y0,x1,y1=bbox(im);hx,hy=points['head'];cx=(x0+hx*(x1-x0))/im.width;cy=(y0+hy*(y1-y0))/im.height
                u['iconCrop']=[round(max(0,min(.4,cx-.3)),4),round(max(0,min(.4,cy-.3)),4),.6,.6]
        bindings[ident]=[uid+(f" / {a['form']}" if a.get('form') else '') for uid in a['units']]
        reviewed[ident]={'art':art,'units':bindings[ident],'anchors':points,'source':a['anchorSource']}
    # 코어의 실제 형태 id를 유지한다. 기본 자료와 같은 모습인 형태도 명시해 옛 임시 덮어쓰기를 걷는다.
    for gen in (2,3,4):units[f'gem-generation-{gen}']['forms']['normal']={k:v for k,v in units[f'gem-generation-{gen}'].items() if k not in ('forms','pilotCast')}
    for uid,form,source in [('deepseek-generation-3','core','deepseek-generation-3'),('deepseek-generation-3','mobydick','deepseek-mobydick'),('exaone-generation-3','normal','exaone-generation-3'),('exaone-generation-3','thinq','exaone-thinq')]:
        units[uid]['forms'][form]={k:v for k,v in units[source].items() if k not in ('forms','pilotCast')}
    source=units['sonnet-generation-2'];u=units['sonnet-generation-3'];u.update({k:v for k,v in source.items() if k!='forms'});u['recolor']=TINT
    for k in ('icon','temporary'):u.pop(k,None)
    for e in game['episodes']:e['battleBackground']='bbg-museum-noise' if e['id']=='ep02' else 'bg-battle'
    humans=[HUMAN_IDS.get(a['id'],a['id']) for a in manifest['assets'] if a['kind']=='bust']
    game['gallery']['cast']=list(dict.fromkeys([*game['gallery']['cast'],*humans]))
    for k in ('art','moods'):
        values=[]
        for a in manifest['assets']:
            if k=='moods' and a['kind'] in ('portrait','bust'):values.append(cast[a['cast']]['moodSheet']['art'])
            elif k=='art':values.append(cast[a['cast']]['bust'] if a['kind'] in ('portrait','bust') else ('bbg-' if a['kind']=='battle-bg' else 'bg-' if a['kind']=='bg' else 'mech-')+a['id'])
        game['gallery'][k]=list(dict.fromkeys([*game['gallery'][k],*values]))
    write_json(PACK/'game.json',game);write_json(PACK/'units.json',units)
    write_json(WAVE/'bindings.json',{'units':bindings,'cast':{a['id']:a['cast'] for a in manifest['assets'] if a['kind'] in ('portrait','bust')},'recolor':{'sonnet-generation-3':TINT}})
    write_json(WAVE/'anchors-reviewed.json',reviewed)
    print('물결4 연결: 기체/형태',sum(map(len,bindings.values())),'+ 소네트 색 바꿈1')


if __name__=='__main__':finish()
