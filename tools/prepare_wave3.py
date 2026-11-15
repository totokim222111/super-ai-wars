import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR
"""물결3 조별 검수 manifest를 art_ingest 입력으로 모은다. 원본·규칙 수치는 보존한다."""
from PIL import Image
from art_ingest import ROOT, bbox, read_json, write_json

WAVE = ART_SOURCE_DIR / 'wave3'
PACK = PACK_DIR


def visible_points(image, points):
    left, top, right, bottom = bbox(image)
    return {name: [round((xy[0]*image.width-left)/(right-left), 6),
                   round((xy[1]*image.height-top)/(bottom-top), 6)] for name, xy in points.items()}


def prepare():
    units = read_json(PACK/'units.json'); cast = read_json(PACK/'cast.json')
    mechs = {name:read_json(PACK_DIR/'data'/(name+'.json'))for name in ['mechs','pilots','weapons']}['mechs']
    sources = {}
    for path in sorted(WAVE.glob('manifest-*.json')):
        d = read_json(path)
        if 'entries' in d:
            entries = [{**e, 'kind': 'mech', 'file': 'mech/'+e['id']+'.png', 'canvasAnchors': True,
                        'flying': e.get('flying_art', False)} for e in d['entries']]
        else:
            entries = [e for e in d['assets'] if e['kind'] == 'mech']
        for e in entries:
            ident = e['id']; image = Image.open(WAVE/'mech'/f'{ident}.png')
            points = e.get('anchors', e.get('anchors_draft'))
            canvas = e.get('canvasAnchors') or 'final normalized source canvas' in e.get('anchors_coordinate_space', '')
            sources[ident] = {'kind': 'mech', 'id': ident, 'source': f'mech/{ident}.png',
                             'size': e.get('size', e.get('size_class')),
                             'flying': e.get('flying', e.get('airborne', e.get('movement') in ('air', 'flying', 'hover'))),
                             'reviewedAnchors': visible_points(image, points) if canvas else points,
                             'anchorSource': path.name, 'anchorConvertedFromCanvas': bool(canvas), 'faces': 'left'}
    # 이미 쓰는 그림은 새 규격 경로에도 등록한다. 옛 파일은 읽기만 한다.
    legacy = read_json(PACK_DIR / 'art' / 'anchors.json')
    reused = WAVE/'reused'; reused.mkdir(exist_ok=True)
    for ident, old in [('spam-bot', 'mech-spam-bot-sd'), ('clickbait-drone', 'mech-clickbait-sd')]:
        image = Image.open(PACK_DIR/'art'/f'{old}.webp'); image.save(reused/f'{ident}.png')
        points = {k:v for k,v in legacy[old].items() if isinstance(v, list)}
        sources[ident] = {'kind':'mech', 'id':ident, 'source':f'reused/{ident}.png',
                          'size':'SS' if ident=='spam-bot' else 'S', 'flying':ident=='clickbait-drone',
                          'reviewedAnchors':points, 'faces':'right', 'anchorSource':old}
    assets = []
    for ident, e in sources.items():
        targets = [m['id'] for m in mechs if m['id'].startswith(ident+'-episode-')]
        assert targets, ident
        e.update(unit=targets[0], units=targets)
        if ident == 'deepseek-housing':
            e['pilotCast'] = 'deepseek'
        else:
            name = next(m['name'] for m in mechs if m['id'] == targets[0])
            existing = next((id for id,c in cast.items() if c['name'] == name), None)
            cid = existing or ident
            cast.setdefault(cid, {'name':name, 'aliases':[], 'color':'#ff5c8a', 'height':440, 'moods':{}})
            cast[cid].update(height=440, face=[0,0,1,1], moodNames={'default':'기본','hit':'피격'})
            for mood in ('default','hit'):cast[cid]['moods'].pop(mood, None)
            e['pilotCast'] = cid
            if ident == 'spam-bot':
                for suffix, old in [('', 'spam-portrait'), ('-hit', 'spam-portrait-hit')]:
                    Image.open(PACK_DIR/'art'/f'{old}.webp').save(reused/f'{ident}-portrait{suffix}.png')
                source = f'reused/{ident}-portrait.png'; hit = f'reused/{ident}-portrait-hit.png'
            else:
                source = f'portrait/{ident}.png'; hit = f'portrait/{ident}-hit.png'
            assert (WAVE/source).is_file() and (WAVE/hit).is_file(), ident
            assets.append({'kind':'portrait','id':ident,'cast':cid,'source':source,'moods':{'hit':hit},
                           'order':['default','hit'], 'alignMoods':False})
        assets.append(e)
    assert len(sources) == 47
    assert len([e for e in assets if e['kind']=='portrait']) == 46
    write_json(PACK/'cast.json', cast)
    write_json(WAVE/'manifest.json', {'wave':3,'spec':'docs/v2-asset-spec.md','assets':assets})
    print('물결3 준비: 기체47(새45+기존2), 초상46쌍(새45+기존1)')


if __name__ == '__main__':prepare()
