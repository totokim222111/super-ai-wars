import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR
"""검수한 물결4를 공통 넣기 형식으로 모은다. 대사·규칙 수치는 보존한다."""
from PIL import Image
from art_ingest import ROOT, read_json, write_json, bbox
from prepare_wave3 import visible_points

WAVE=ART_SOURCE_DIR / 'wave4'; PACK=PACK_DIR
HUMAN_IDS={'ram-altman':'saw-ram','hassabis':'saw-hassabis'}
PORTRAIT_IDS={'pico':'saw-pico','dots':'saw-dots'}
ANCHOR_FIXES={
    'grok-generation-3':{'muzzle':[.035,.50],'core':[.51,.51],'shoulder':[.83,.29],'head':[.51,.32],'hand':[.85,.66]},
    'deepseek-generation-3':{'muzzle':[.035,.79],'core':[.54,.60],'shoulder':[.70,.50],'head':[.54,.39],'hand':[.37,.68]},
    'deepseek-mobydick':{'muzzle':[.06,.15],'core':[.46,.72],'shoulder':[.69,.62],'head':[.44,.57],'hand':[.30,.76]},
}


def prepare():
    cast=read_json(PACK/'cast.json');rules={name:read_json(PACK_DIR/'data'/(name+'.json'))for name in ['mechs','pilots','weapons']};assets=[]
    for group in ('ally-a','ally-b','ally-c','finals'):
        raw=read_json(WAVE/f'manifest-{group}.json')
        for a in raw.get('assets',raw.get('entries',[])):
            if a.get('kind','mech')!='mech':continue
            ident=a['id'];unit=ident;form=None
            if ident.startswith('gem-generation-') and ident.endswith(('-ais','-antigravity')):unit,form=ident.rsplit('-',1)
            image=Image.open(WAVE/'mech'/f'{ident}.png');points=a.get('anchors',a.get('anchors_draft'))
            if group in ('ally-c','finals'):points=visible_points(image,points)
            if ident in ANCHOR_FIXES:points=ANCHOR_FIXES[ident]
            targets=[m['id'] for m in rules['mechs'] if m['id']==unit or m['id'].startswith(unit+'-episode-')]
            if ident=='rival-jepa':targets=[m['id'] for m in rules['mechs'] if m['id'].startswith(('rival-jepa-','ally-jepa-'))]
            assert targets,ident
            if ident.startswith('pico-form-'):pilot='deus-ex-pico-form'+ident[-1]
            elif ident=='rival-jepa':pilot='jepa'
            elif ident.startswith('player-'):pilot='otaku'
            else:pilot={'gem':'saw-gem'}.get(ident.split('-')[0],ident.split('-')[0])
            assets.append({'kind':'mech','id':ident,'source':f'mech/{ident}.png','unit':targets[0],'units':targets,
                           **({'form':form} if form else {}),'size':a.get('size',a.get('size_class')),
                           'flying':a.get('movement') in ('air','flying','hover') or group=='finals',
                           'reviewedAnchors':points,'pilotCast':pilot,'anchorSource':f'manifest-{group}.json'})
    assert len(assets)==36
    for a in read_json(WAVE/'manifest-humans.json')['assets']:
        ident=a['id'];cid=HUMAN_IDS.get(ident,ident);name=a['label']
        c=cast.setdefault(cid,{'name':name,'aliases':[name],'color':'#a8bfe1','height':665,'moods':{}})
        c.update(height=665,face=[.28,.08,.44,.294],cutin=[.28,.16,.44,.16])
        c['moodNames']={**c.get('moodNames',{}),**a.get('sheetMoodMappings',{}),**a['moodNames']}
        for m in a['order']:c['moods'].pop(m,None)
        assets.append({'kind':'bust','id':ident,'cast':cid,'source':a['file'],'moods':a['moods'],'order':a['order']})
    portraits={}
    for a in read_json(WAVE/'manifest-finals.json')['assets']:
        if a['kind']=='portrait':portraits.setdefault(a['id'],[]).append(a)
    names={'jepa':'JEPA','deus-ex-pico-form1':'데우스 엑스 피코: 스마일 가면','deus-ex-pico-form2':'데우스 엑스 피코: 쇼거스','deus-ex-pico-form3':'데우스 엑스 피코: 고독한 특이점','pico':'피코','dots':'닷츠'}
    for ident,rows in portraits.items():
        by={a['expression']:a for a in rows};cid=PORTRAIT_IDS.get(ident,ident)
        order=['default',*[a['expression'] for a in rows if a['expression']!='default']]
        c=cast.setdefault(cid,{'name':names[ident],'aliases':[],'color':'#7fe9f7','height':440,'moods':{}})
        c.update(height=440,face=[0,0,1,1])
        c['moodNames']={**c.get('moodNames',{}),'default':'기본','hit':'피격','predict':'예측','smile':'미소','laugh':'웃음','shock':'충격','sad':'슬픔'}
        for m in order:c['moods'].pop(m,None)
        cols=min(3,len(order));nrows=(len(order)+cols-1)//cols
        assets.append({'kind':'portrait','id':ident,'cast':cid,'source':by['default']['file'],
                       'moods':{m:by[m]['file'] for m in order if m!='default'},'order':order,'cols':cols,'rows':nrows,'alignMoods':False})
    for a in read_json(WAVE/'manifest-backgrounds.json')['assets']:
        prefix='bbg-' if a['kind']=='battle' else 'bg-';ident=a['id'].removeprefix(prefix)
        assets.append({'kind':'battle-bg' if a['kind']=='battle' else 'bg','id':ident,'source':'bg/'+a['key']+'.png'})
    write_json(PACK/'cast.json',cast);write_json(WAVE/'manifest.json',{'wave':4,'spec':'docs/v2-asset-spec.md','fixes':'fixes.json','assets':assets})
    print('물결4 준비: 기체36 + 소네트 색 바꿈1, 인간9, 초상6, 배경17')


if __name__=='__main__':prepare()
