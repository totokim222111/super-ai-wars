import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR
"""물결2 그림을 에피소드별 표시 항목에 공유하고 색 바꿈 자료·검수 기준점을 기록한다."""
from art_ingest import ROOT, HEIGHTS, read_json, write_json
from prepare_wave2 import CAST_IDS, MECH_CAST

PACK=PACK_DIR
TINTS={
 'mirror':{'from':'mech-claude-generation-1','hue':220,'sat':.55,'light':.035},
 'glm-production':{'from':'mech-claude-generation-1','hue':220,'sat':.18,'light':-.12},
 'kimi-production':{'from':'mech-rival-kimi','hue':165,'sat':.28,'light':-.13},
}


def finish():
    wave=ART_SOURCE_DIR / 'wave2';raw=read_json(wave/'mech/manifest.json')
    game=read_json(PACK/'game.json');units=read_json(PACK/'units.json');cast=read_json(PACK/'cast.json')
    gallery_path=game.get('gallery') if isinstance(game.get('gallery'),str) else None
    gallery=read_json(PACK/gallery_path) if gallery_path else game['gallery']
    data={name:read_json(PACK_DIR/'data'/(name+'.json'))for name in ['mechs','pilots','weapons']};mechs={m['id']:m for m in data['mechs']};reviewed={};bindings={}
    for a in raw['assets']:
        stem=a['id'].removeprefix('rival-');art='mech-'+a['id'];assert art in game['art']['files'],art
        points=a['anchors'].copy()
        # 좌표는 이미 원본 검수자가 보이는 알파 영역 기준으로 작성했다. 최종 화면에서 보정한다.
        targets=[id for id in units if id.startswith((f'rival-{stem}-',f'ally-{stem}-'))]
        for id in targets:
            u=units[id];u.update(art=art,faces='left',height=HEIGHTS[a['size']],anchors=points,pilotCast=CAST_IDS[MECH_CAST.get(stem,stem)])
            for key in ('icon','iconCrop','temporary','recolor'):u.pop(key,None)
        bindings[a['id']]=targets
        reviewed[a['id']]={'art':art,'unit':targets[0],'units':targets,'anchors':points,'space':'visible alpha bbox'}
    tinted={}
    for id,u in units.items():
        if id.startswith(('rival-glm-','ally-glm-')):kind='mirror';source=units['claude-generation-1'];pilot='glm'
        elif id.startswith('glm-production-'):kind='glm-production';source=units['claude-generation-1'];pilot='glm'
        elif id.startswith('kimi-production-'):kind='kimi-production';source=units['rival-kimi-episode-9'];pilot='kimi'
        else:continue
        u.update(art=TINTS[kind]['from'],recolor=TINTS[kind].copy(),anchors=source['anchors'].copy(),faces='left',height=HEIGHTS[mechs[id]['size']],pilotCast=pilot)
        for key in ('icon','iconCrop','temporary'):u.pop(key,None)
        tinted[id]=kind
    gallery['cast']=list(dict.fromkeys([*gallery['cast'],*CAST_IDS.values()]))
    gallery['art']=list(dict.fromkeys([*gallery['art'],*[cast[id]['bust'] for id in CAST_IDS.values()],*[r['art'] for r in reviewed.values()]]))
    gallery['moods']=list(dict.fromkeys([*gallery['moods'],*[cast[id]['moodSheet']['art'] for id in CAST_IDS.values()]]))
    if gallery_path:write_json(PACK/gallery_path,gallery)
    write_json(PACK/'game.json',game);write_json(PACK/'units.json',units)
    write_json(wave/'anchors-reviewed.json',reviewed)
    write_json(wave/'bindings.json',{'units':bindings,'recolor':TINTS,'tintedUnits':tinted,'recolorNote':'GLM 두 변종은 같은 Claude 원본에 각각의 최종 HSL 값을 적용한다. 양산형은 같은 실루엣·기준점을 공유하면서 채도/명도를 낮춘다.'})


if __name__=='__main__':finish()
