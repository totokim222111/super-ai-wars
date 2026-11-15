import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR
"""물결3의 실제 기준점·같은 기체의 모든 에피소드·자코 초상을 연결한다."""
from art_ingest import ROOT, HEIGHTS, read_json, write_json
from prepare_wave3 import WAVE, PACK

# 원본 한 장으로 포크를 구분한다. hue는 회전 각도다.
TINTS = {
    'derived-llama-episode-5': {'from':'mech-derived-llama','hue':110,'sat':.85,'light':.02},
    'derived-llama-episode-7': {'from':'mech-derived-llama','hue':250,'sat':.75,'light':-.04},
}


def finish():
    manifest = read_json(WAVE/'manifest.json')
    game = read_json(PACK/'game.json'); units = read_json(PACK/'units.json'); cast = read_json(PACK/'cast.json')
    bindings = {}; reviewed = {}
    for e in manifest['assets']:
        if e['kind'] != 'mech':continue
        ident = e['id']; art = 'mech-'+ident
        for id in e['units']:
            u = units[id]
            u.update(art=art, faces=e['faces'], height=HEIGHTS[e['size']], anchors=e['reviewedAnchors'], pilotCast=e['pilotCast'])
            for key in ('icon','iconCrop','temporary','recolor'):u.pop(key, None)
            # LL 기체의 머리와 몸통을 말로 보여 준다. 값은 전체 원본 캔버스 기준.
            if e['size']=='LL':
                hx, hy = e['reviewedAnchors']['head']
                from PIL import Image
                from art_ingest import bbox
                image = Image.open(WAVE/e['source']); x0,y0,x1,y1=bbox(image)
                cx=(x0+hx*(x1-x0))/image.width; cy=(y0+hy*(y1-y0))/image.height
                u['iconCrop']=[round(max(0,min(.42,cx-.29)),4),round(max(0,min(.42,cy-.23)),4),.58,.58]
            if id in TINTS:u['recolor']=TINTS[id]
        bindings[ident] = e['units']
        reviewed[ident] = {'unit':e['unit'],'art':art,'anchors':e['reviewedAnchors'],
                           'source':e['anchorSource'],'convertedFromCanvas':e.get('anchorConvertedFromCanvas',False)}
    # 예시 전투도 새 경로·실제 SS 크기를 쓴다. 수치 값은 건드리지 않는다.
    for f in game['gallery']['fighters']:
        if f['cast']=='spam':f.update(art='mech-spam-bot',height=HEIGHTS['SS'],faces='right')
    for key in ('art','moods'):
        values = [cast[e['cast']]['moodSheet']['art'] if key=='moods' else cast[e['cast']]['bust']
                  for e in manifest['assets'] if e['kind']=='portrait']
        if key=='art':values += [r['art'] for r in reviewed.values()]
        game['gallery'][key] = list(dict.fromkeys([*game['gallery'][key],*values]))
    write_json(PACK/'game.json', game); write_json(PACK/'units.json', units)
    write_json(WAVE/'bindings.json', {'units':bindings,'cast':{e['id']:e['cast'] for e in manifest['assets'] if e['kind']=='portrait'},'recolor':TINTS})
    write_json(WAVE/'anchors-reviewed.json', reviewed)
    print(f'물결3 연결: units {sum(len(v) for v in bindings.values())}, cast 46, 색 바꿈 {len(TINTS)}')


if __name__ == '__main__':finish()
