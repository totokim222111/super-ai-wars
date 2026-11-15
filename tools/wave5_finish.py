"""Finish the approved Wave 5: retain raw attempts, normalize, ingest and register art only."""
from __future__ import annotations
import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR
import copy, hashlib, io, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageOps
from art_ingest import ROOT, bbox, check, font, ingest, inspect_art, read_json, write_json

WAVE=ART_SOURCE_DIR / 'wave5'; OUT=ROOT/'tools/out/wave5'; PACK=PACK_DIR
PREFIX={'cg':'cg-','bg':'bg-','portrait':'portrait-','mech':'mech-','bust':'bust-'}
REJECT={
 'glm-unmasked':'Mech palette did not match the current cold silver/cyan design.',
 'pico-shoggoth':'Style reference leaked Gpi and tea-table content into the entity scene.',
 'pico-aligned':'Entity identity drift: shoggoth instead of the smooth final pearl core.',
 'ending-gpi-tea':'Offered cup and hands too low for the dialogue overlay.',
 'ending-gem-stroll':'Sleeve action too low and player sleeve resembled a character costume.',
 'ending-sonnet-highfive':'Tiny equipment markings and an overly specific viewer sleeve.',
 'ending-exaone-tea':'Tea tray too low for the dialogue overlay.',
 'ending-pico-farewell':'Unrequested paper/note with scribbles.'}
POINTS={
 'nano':{'muzzle':[.01,.70],'hand':[.21,.59],'head':[.47,.29],'core':[.49,.54],'shoulder':[.24,.48]},
 'pro':{'muzzle':[.02,.62],'hand':[.25,.67],'head':[.50,.35],'core':[.51,.55],'shoulder':[.30,.48]},
 'ultra':{'muzzle':[.055,.60],'hand':[.31,.64],'head':[.53,.34],'core':[.52,.50],'shoulder':[.30,.44]}}

def clean(image):
    a=np.asarray(image.convert('RGBA')).copy(); a[a[:,:,3]<=2]=0
    return Image.fromarray(a)

def selected(key,log):
    return clean(Image.open(WAVE/log['assets'][key][-1]['raw']))

def union(images):
    mask=np.maximum.reduce([np.asarray(i)[:,:,3] for i in images]); yy,xx=np.where(mask>=8)
    return int(xx.min()),int(yy.min()),int(xx.max())+1,int(yy.max())+1

def fit(image,region,size,box,bottom=None):
    tile=image.crop(region);tile.thumbnail(box,Image.Resampling.LANCZOS)
    canvas=Image.new('RGBA',size)
    canvas.paste(tile,((size[0]-tile.width)//2,(size[1]-tile.height)//2 if bottom is None else bottom-tile.height))
    return canvas

def normalize():
    jobs=read_json(WAVE/'jobs.json')['jobs'];log=read_json(WAVE/'generation-log.json')
    manifest=read_json(WAVE/'manifest.json')
    # Idempotent: preserve the approved pilot and replace only continuation records.
    manifest['assets']=[a for a in manifest['assets'] if a.get('wave5Continuation') is not True]
    manifest['generations']=[a for a in manifest['generations'] if not a.get('wave5Continuation')]
    manifest['scope']='Approved pilot plus complete remaining Wave 5; story bindings included'
    for job in jobs:
        key=job['key']; kind=job['kind']; image=selected(key,log)
        if kind=='portrait':
            ident=key.rsplit('-',1)[0]
            region=union([selected(ident+'-'+m,log)for m in ['default','hit']])
            image=fit(image,region,(768,768),(728,728))
            note='Shared default/hit union alpha crop; identical uniform fit and placement; alpha<=2 noise cleared.'
        elif kind in ['cg','bg']:
            image=ImageOps.fit(image.convert('RGB'),(1600,900),Image.Resampling.LANCZOS)
            note='Uniform Lanczos fit to 1600x900 RGB; no repaint.'
        elif kind=='mech':
            image=fit(image,union([image]),(1024,1024),(940,880),942)
            note='Uniform visible-alpha fit to 1024 square; ground at 92%; alpha<=2 noise cleared.'
        else:
            # Keep the edited bust framing/face registration; add specified head margin.
            tile=image.resize((960,1440),Image.Resampling.LANCZOS)
            image=Image.new('RGBA',(1024,1536));image.paste(tile,(32,96))
            note='Uniform 93.75% framing to 1024x1536, bottom aligned and centered; preserve generated aura alpha.'
        dest=f'{kind}/{key}.png';(WAVE/kind).mkdir(exist_ok=True);image.save(WAVE/dest)
        for i,a in enumerate(log['assets'][key]):
            a['review']='accepted' if i==len(log['assets'][key])-1 else 'rejected'
            if a['review']=='rejected':a['reason']=REJECT[key]
            a['promptSha256']=hashlib.sha256((WAVE/a['promptFile']).read_bytes()).hexdigest()
        manifest['generations'].append({'key':key,'wave5Continuation':True,'attempts':len(log['assets'][key]),'history':log['assets'][key],
            'output':dest,'normalization':note,'visualReview':{'identity':True,'style':True,'anatomy':True,'noTextOrLogos':True,'dialogueSafe':kind in ['bg','cg']}})
        if kind=='portrait' and key.endswith('-hit'):continue
        ident=key.removeprefix('talk-').removesuffix('-default')
        entry={'id':ident,'kind':kind,'source':dest,'wave5Continuation':True}
        if kind=='portrait':entry.update(cast=ident,moods={'hit':f'portrait/{ident}-hit.png'},order=['default','hit'],alignMoods=False)
        manifest['assets'].append(entry)
    write_json(WAVE/'generation-log.json',log);write_json(WAVE/'manifest.json',manifest)
    return manifest

def encode(image,path,limit):
    for quality in range(80,49,-1):
        stream=io.BytesIO();image.save(stream,'WEBP',quality=quality,alpha_quality=90,method=6,exact=True)
        data=stream.getvalue()
        if len(data)<=limit*1024:break
    assert len(data)<=limit*1024,(path,len(data),limit)
    path.write_bytes(data)
    return quality

def register(manifest):
    # Standard ingest performs all geometry checks, atlas creation and review sheets.
    ingest(WAVE,register=False,replace=True,out=OUT)
    game=read_json(PACK/'game.json');cast=read_json(PACK/'cast.json');units=read_json(PACK/'units.json');gallery=read_json(PACK/game['gallery'])
    records=[]
    for a in manifest['assets']:
        kind=a['kind'];ident=a['id'];artid=PREFIX[kind]+ident
        name=('talk-'if kind=='bg'else'')+ident
        path=ROOT/f'public/v2/art/{kind}/{name}.webp'
        image=Image.open(WAVE/a['source']);limit={'cg':400,'bg':350,'portrait':120,'mech':200,'bust':280}[kind]
        q=encode(image,path,limit);game['art']['files'][artid]='/'+path.relative_to(ROOT/'public').as_posix()
        if artid not in gallery['art']:gallery['art'].append(artid)
        outputs=[{'file':path.relative_to(ROOT).as_posix(),'bytes':path.stat().st_size,'quality':q}]
        if kind=='portrait':
            c=cast[ident];c['bust']=artid;c.pop('temporary',None)
            atlas=Image.new('RGBA',(1536,768))
            for i,m in enumerate(['default','hit']):
                src=WAVE/(a['source']if m=='default'else a['moods'][m]);atlas.paste(Image.open(src),(i*768,0))
            target=path.with_stem(path.stem+'-moods');q=encode(atlas,target,200)
            sheetid=artid+'-moods';game['art']['files'][sheetid]='/'+target.relative_to(ROOT/'public').as_posix()
            c['moodSheet']={'art':sheetid,'rect':[0,0,1,1],'cols':2,'rows':1,'order':['default','hit']}
            if sheetid not in gallery['moods']:gallery['moods'].append(sheetid)
            outputs.append({'file':target.relative_to(ROOT).as_posix(),'bytes':target.stat().st_size,'quality':q})
        records.append({'id':artid,'kind':kind,'outputs':outputs})
    # Presentation only: the stage rule/compiler still owns all combat numbers.
    for n in range(1,5):
        units[f'gem-generation-{n}']['tacticalForms']={k:{'art':'mech-gem-'+v,'faces':'left','height':335,'anchors':POINTS[v]}for k,v in zip(['나노','프로','울트라'],['nano','pro','ultra'])}
    for mode,label,color in [('axis','악의축','#f15c66'),('yandere','얀데레','#d27ee8'),('megadere','메가데레','#edc870')]:
        key='qwen-'+mode;c=copy.deepcopy(cast['qwen']);c.update(name='퀜짱 · '+label,aliases=[],color=color,bust='bust-'+key,moods={})
        c['moods']={m:'bust-'+key for m in ['default','smile','laugh','attack','serious','hit','shock','sad','angry','shy']}
        c.pop('moodSheet',None);c.pop('temporary',None);cast[key]=c
        if key not in gallery['cast']:gallery['cast'].append(key)
    for n in range(1,4):units[f'qwen-generation-{n}']['tacticalForms']={k:{'pilotCast':'qwen-'+v}for k,v in zip(['악의축','얀데레','메가데레'],['axis','yandere','megadere'])}
    for filename,data in [('game.json',game),('cast.json',cast),('units.json',units),(game['gallery'],gallery)]:write_json(PACK/filename,data)
    sheets={c['moodSheet']['art']:c['moodSheet']for c in cast.values()if c.get('moodSheet')}
    write_json(PACK/game['art']['metadata'],inspect_art({'files':game['art']['files'],'sheets':sheets}))
    write_json(OUT/'wave5-final-art.json',records)
    for rel in ['game.json','cast.json','units.json',game['gallery'],game['art']['metadata']]:
        original=subprocess.check_output(['git','show','HEAD:engine/content/packs/saw/'+rel],cwd=ROOT)
        if b'\r\n'in original:
            target=PACK/rel;target.write_bytes(target.read_bytes().replace(b'\r\n',b'\n').replace(b'\n',b'\r\n'))

def final_report(manifest):
    records=read_json(OUT/'wave5-final-art.json');byid={r['id']:r for r in records};report=[]
    for a in manifest['assets']:
        record=byid[PREFIX[a['kind']]+a['id']];a['outputs']=record['outputs']
        for output in record['outputs']:
            path=ROOT/output['file'];image=Image.open(path)
            if '-moods.webp' in path.name:
                info={'size':f'{image.width}x{image.height}'};warnings=[];limit=200
                assert image.size==(1536,768)
            else:
                info,warnings=check(image,a['kind']);limit={'cg':400,'bg':350,'portrait':120,'mech':200,'bust':280}[a['kind']]
            if path.stat().st_size>limit*1024:warnings.append('Final file exceeds capacity')
            output.update(bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest())
            report.append({'id':record['id'],'file':output['file'],**info,'kb':round(path.stat().st_size/1024,1),'quality':output['quality'],'warnings':warnings})
    write_json(OUT/'wave5-report.json',report);write_json(WAVE/'manifest.json',manifest)
    assert not [r for r in report if r['warnings']], [r for r in report if r['warnings']]

def sheet(items,dest,cols=4,cell=(600,380)):
    w,h=cell;canvas=Image.new('RGB',(cols*w,((len(items)+cols-1)//cols)*h),'#19243b');d=ImageDraw.Draw(canvas)
    for i,(label,path)in enumerate(items):
        x=i%cols*w;y=i//cols*h;d.text((x+10,y+7),label,font=font(19),fill='white')
        im=Image.open(path).convert('RGBA');im.thumbnail((w-12,h-44),Image.Resampling.LANCZOS)
        canvas.paste(im,(x+(w-im.width)//2,y+36+(h-44-im.height)//2),im)
    canvas.save(OUT/dest)

def sheets(manifest):
    cg=[(a['id'],ROOT/f'public/v2/art/cg/{a["id"]}.webp')for a in manifest['assets']if a['kind']=='cg']
    sheet(cg[:14],'cg-sheet-1.png');sheet(cg[14:],'cg-sheet-2.png')
    sheet([(a['id'],ROOT/f'public/v2/art/bg/talk-{a["id"]}.webp')for a in manifest['assets']if a['kind']=='bg'],'bg-sheet.png',3)
    sheet([(a['id']+' | default / hit',ROOT/f'public/v2/art/portrait/{a["id"]}-moods.webp')for a in manifest['assets']if a['kind']=='portrait'],'portrait-sheet.png',3,(800,440))
    sheet([('Gem original',PACK_DIR / 'art' / 'mech/gem-generation-2.webp')]+[(v,ROOT/f'public/v2/art/mech/gem-{v}.webp')for v in ['nano','pro','ultra']]+[('Qwen original',PACK_DIR / 'art' / 'bust/qwen.webp')]+[(v,ROOT/f'public/v2/art/bust/qwen-{v}.webp')for v in ['axis','yandere','megadere']],'forms-sheet.png',4,(600,800))

if __name__=='__main__':
    if (WAVE/'fix-manifest.json').exists():
        raise SystemExit('Reviewed corrections exist. Use tools/wave5_fix.py finish; do not overwrite approved art with the initial batch normalizer.')
    manifest=normalize();register(manifest);final_report(manifest);sheets(manifest)
    print(f'Wave 5 complete: {len(manifest["assets"])} primary assets; raw attempts and prompts retained.')
