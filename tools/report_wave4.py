import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR
"""물결4 실제 화면 모음, 등록 용량과 남은 경고를 기록한다."""
from collections import Counter
from PIL import Image, ImageDraw
from art_ingest import ROOT, read_json, write_json, font

OUT=ROOT/'tools/out/art'


def montage(items,path,cols=3,width=640,crop=None):
    height=400 if crop else 390
    canvas=Image.new('RGB',(cols*width,((len(items)+cols-1)//cols)*height),'#080d20');d=ImageDraw.Draw(canvas)
    for i,(title,file) in enumerate(items):
        x=i%cols*width;y=i//cols*height;d.text((x+8,y+5),title,font=font(16),fill='white');im=Image.open(OUT/file)
        if crop:im=im.crop(crop)
        im.thumbnail((width-8,height-30));canvas.paste(im,(x+(width-im.width)//2,y+26))
    canvas.save(path)


def report():
    browser=read_json(OUT/'w4-browser.json');bindings=read_json(ART_SOURCE_DIR / 'wave4/bindings.json')
    main=['ep02-midjourney','ep02-sd','battle-museum','ep01-hangar','ep01-tea','battle-pico',
          'ep02-hassabis','ep01-ram','cast-saw-hassabis','cast-saw-ram','portrait-jepa','portrait-saw-pico',
          'portrait-saw-dots','mech-sonnet-generation-2','mech-sonnet-generation-3']
    montage([(s,'w4-'+s+'.png') for s in main],OUT/'w4-check.png')
    montage([(a['base'],'w4-anchor-'+a['base']+'.png') for a in browser['anchors']],OUT/'w4-anchors.png',cols=5,width=480,crop=(550,150,1280,710))
    montage([(b,'w4-background-'+b+'.png') for b in browser['backgrounds']],OUT/'w4-backgrounds.png',cols=4,width=480)
    montage([(u['id'],'w4-mech-'+u['id'].replace(' / ','-')+'.png') for u in browser['library']],OUT/'w4-mechs.png',cols=5,width=480)
    before=read_json(OUT/'w4-before-files.json');current={str(p.relative_to(ROOT)):p.stat().st_size for p in (PACK_DIR/'art').rglob('*') if p.is_file()}
    new={p:n for p,n in current.items() if p not in before};changed=[p for p,n in before.items() if current.get(p)!=n];assert not changed,changed
    def pack(name):
        text=(OUT/f'w4-{name}-pack.json').read_text(encoding='utf-8-sig');return __import__('json').loads(text[text.index('['):])[0]
    pre,post=pack('before'),pack('after')
    summary={'newFiles':new,'newCount':len(new),'newBytes':sum(new.values()),'totalCount':len(current),'totalBytes':sum(current.values()),
             'existingFilesChanged':changed,'sourceBindings':sum(map(len,bindings['units'].values()))+1,
             'unitSlots':sum(1 for uid,u in read_json(PACK_DIR / 'units.json').items() for d in [u,*u.get('forms',{}).values()] if d.get('art') in {'mech-'+id for id in bindings['units']} or uid=='sonnet-generation-3' and d is u),
             'cast':bindings['cast'],'recolor':bindings['recolor'],'beforeWarnings':dict(Counter(w['kind'] for w in pre['warnings'])),
             'afterWarnings':dict(Counter(w['kind'] for w in post['warnings'])),'remainingWarnings':post['warnings'],'errors':post['errors'],
             'browser':{'screenshots':len(browser['shots']),'errors':browser['errors'],'pink':browser['pink'],'tintDifference':browser['tintDifference']}}
    assert summary['newCount']==83 and not summary['errors'];assert summary['totalCount']<=511
    write_json(OUT/'w4-report.json',summary)
    print({k:v for k,v in summary.items() if k not in ('newFiles','remainingWarnings','cast')})


if __name__=='__main__':report()
