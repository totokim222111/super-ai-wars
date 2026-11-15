import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR
"""브라우저 검수 화면 모음과 물결3 용량·경고 차이를 기록한다."""
from collections import Counter
from PIL import Image, ImageDraw
from art_ingest import ROOT, read_json, write_json, font

OUT = ROOT/'tools/out/art'


def montage(items, path, cols=4, width=480, crop=None):
    height = 310 if crop else 295
    result = Image.new('RGB', (cols*width, ((len(items)+cols-1)//cols)*height), '#080d20')
    draw = ImageDraw.Draw(result)
    for i, (title, filename) in enumerate(items):
        x, y = i%cols*width, i//cols*height
        draw.text((x+8,y+5), title, font=font(13), fill='white')
        image = Image.open(OUT/filename)
        if crop:image=image.crop(crop)
        image.thumbnail((width-8, height-30))
        result.paste(image,(x+(width-image.width)//2,y+25))
    result.save(path)


def report():
    b=read_json(ART_SOURCE_DIR / 'wave3/bindings.json');browser=read_json(OUT/'w3-browser.json')
    main=['map-ep01','map-comment','map-ll','battle-shrimp-default','battle-shrimp-hit','battle-ll',
          'mech-derived-llama-episode-5','mech-derived-llama-episode-7',
          'portrait-comment-bot','portrait-saw-shrimp','portrait-saw-inpainting','portrait-dead-internet']
    montage([(s,'w3-'+s+'.png') for s in main], OUT/'w3-check.png', cols=3, width=640)
    montage([(base,'w3-anchor-'+base+'.png') for base in b['units']], OUT/'w3-anchors.png',cols=5,width=480,crop=(550,150,1280,710))
    montage([(id,'w3-portrait-'+id+'.png') for id in browser['portraits']], OUT/'w3-portraits.png',cols=5)
    montage([(u['id'],'w3-mech-'+u['id'].replace(' / ','-')+'.png') for u in browser['library']],OUT/'w3-mechs.png',cols=5)
    before=read_json(OUT/'w3-before-files.json')
    current={str(p.relative_to(ROOT)):p.stat().st_size for p in (PACK_DIR/'art').rglob('*') if p.is_file()}
    new={p:n for p,n in current.items() if p not in before}
    changed=[p for p,n in before.items() if current.get(p)!=n]
    assert not changed,changed
    def checked(name):
        s=(OUT/f'w3-{name}-pack.json').read_text(encoding='utf-8-sig');return __import__('json').loads(s[s.index('['):])[0]
    pre,post=checked('before'),checked('after')
    summary={'newFiles':new,'count':len(new),'totalBytes':sum(new.values()),'existingArtChanged':changed,
             'units':sum(len(ids) for ids in b['units'].values()),'cast':len(b['cast']),
             'newCast':len(b['cast'])-3,'recolor':b['recolor'],
             'beforeWarnings':dict(Counter(w['kind'] for w in pre['warnings'])),
             'afterWarnings':dict(Counter(w['kind'] for w in post['warnings'])),
             'errors':post['errors'],'sizeWarnings':[w for w in post['warnings'] if w['kind']=='그림 용량'],
             'browser':{'shots':len(browser['shots']),'errors':browser['errors'],'pink':browser['pink'],'colorDifference':browser['colors']}}
    assert summary['count']==139 and not summary['errors']
    write_json(OUT/'w3-report.json',summary)
    print({k:summary[k] for k in ('count','totalBytes','units','cast','newCast','beforeWarnings','afterWarnings','browser')})


if __name__=='__main__':report()
