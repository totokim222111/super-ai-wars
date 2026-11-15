import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR
"""물결1 등록 뒤 표시 연결과 검수 기준점을 반영한다. 규칙 수치는 읽기만 한다."""
from pathlib import Path
from art_ingest import ROOT, bbox, read_json, write_json
from PIL import Image
from prepare_wave1 import CAST_IDS

PACK=PACK_DIR


def finish():
    manifest=read_json(ART_SOURCE_DIR / 'wave1/manifest.json')
    units=read_json(PACK/'units.json');game=read_json(PACK/'game.json');cast=read_json(PACK/'cast.json')
    gallery_path=game.get('gallery') if isinstance(game.get('gallery'),str) else None
    gallery=read_json(PACK/gallery_path) if gallery_path else game['gallery']
    reviewed={}
    for a in manifest['assets']:
        if a['kind']!='mech':continue
        key=a['key'];image=Image.open(ART_SOURCE_DIR / 'wave1'/a['file']);x,y,r,b=bbox(image)
        raw={name:[round(pos[0]*1024),round(pos[1]*1024)] for name,pos in a.get('measurements',{}).get('anchors',{}).items()}
        if key=='gpi-generation-1':raw={'muzzle':[48,600],'hand':[343,620],'core':[550,625],'head':[525,490],'shoulder':[824,470]}
        # 눈으로 확인한 실제 앞쪽 끝/몸통/어깨. 원본 검수 표의 좌표를 엔진의 trim 좌표로 변환한다.
        raw.update({
          'claude-generation-1':{'muzzle':[53,601],'core':[565,587],'shoulder':[816,457]},
          'sonnet-generation-1':{'muzzle':[85,695],'core':[545,553]},
          'grok-generation-1':{'muzzle':[90,558],'hand':[305,572],'core':[477,554]},
          'deepseek-generation-1':{'muzzle':[133,796],'core':[582,568]},
          'exaone-generation-1':{'muzzle':[78,619],'core':[507,594],'shoulder':[746,500]},
          'qwen-generation-1':{'core':[547,585]},
          'player-super-generation-1':{'core':[550,590],'muzzle':[55,758]},
        }.get(key,{}))
        points={name:[round((p[0]-x)/(r-x),5),round((p[1]-y)/(b-y),5)] for name,p in raw.items()}
        target=units[a['unit']]
        if a.get('form'):target=target['forms'][a['form']]
        target['anchors']=points;target.pop('temporary',None);target.pop('icon',None)
        pilot=key.split('-generation-1')[0]
        if pilot in CAST_IDS:units[a['unit']]['pilotCast']=CAST_IDS[pilot]
        reviewed[key]={'art':target['art'],'unit':a['unit'],'form':a.get('form'),'sourcePixels':raw,'visibleBounds':[x,y,r,b],'anchors':points}
    # 일반형도 부모의 빌린 그림을 가리지 않게 새 그림에 맞춘다.
    units['gem-generation-1']['forms']['normal']={k:v for k,v in units['gem-generation-1'].items() if k not in ('forms','pilotCast')}
    units['gem-generation-1']['forms']['normal'].pop('icon',None)
    game['titleArt']['character']='bust-gpi'
    ids=list(CAST_IDS.values())
    gallery['cast']=ids
    gallery['art']=[*dict.fromkeys(['bg-talk','bg-battle','cg-gpi-entrance','map-terrain','spam-portrait',
       *[cast[id]['bust'] for id in ids],*[v['art'] for v in reviewed.values()],
       'mech-spam-bot-sd','mech-commander-sd','mech-clickbait-sd'])]
    gallery['moods']=[cast[id]['moodSheet']['art'] for id in ids]+['spam-portrait-hit']
    gpi=gallery['fighters'][0];gpi.update(art='mech-gpi-generation-1',height=335,cutin=dict(zip(['x','y','w','h'],cast['gpi']['cutin'])))
    data={name:read_json(PACK_DIR/'data'/(name+'.json'))for name in ['mechs','pilots','weapons']};mech=next(m for m in data['mechs'] if m['id']=='gem-generation-1')
    weapon=next(w for w in data['weapons'] if w['id']=='gem-generation-1-weapon-3')
    if not any(f['id']=='gem' for f in gallery['fighters']):gallery['fighters'].append({
      'id':'gem','side':'ally','name':mech['name'],'pilot':'젬짱','hp':mech['hp'],'hpMax':mech['hp'],'en':mech['en'],'enMax':mech['en'],
      'height':335,'faces':'left','art':'mech-gem-generation-1','cast':'saw-gem','cutin':dict(zip(['x','y','w','h'],cast['saw-gem']['cutin']))})
    gallery['weapons']['stella']={'name':weapon['name'],'cost':weapon.get('en',0),'anim':read_json(PACK/'weapons.json')[weapon['id']]['anim']}
    if gallery_path:write_json(PACK/gallery_path,gallery)
    write_json(PACK/'game.json',game);write_json(PACK/'units.json',units)
    write_json(ART_SOURCE_DIR / 'wave1/anchors-reviewed.json',reviewed)


if __name__=='__main__':finish()
