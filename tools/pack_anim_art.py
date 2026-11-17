"""Deterministic illustration atlas. Run with python -I; sources are media, never code."""
import argparse,hashlib,io,json,os,re
from pathlib import Path
from PIL import Image

SAMPLE=Path(__file__).resolve().parents[1]
EDGE=2048
PAD=3
CRITICAL={'hammer','server','whale','cage','dragon-head','worm-head'}
def sha(b):return hashlib.sha256(b).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def prepare(source,profile=0):
    manifest=read(source/'manifest.json');redraw=read(source/'redraw/manifest.json')if(source/'redraw/manifest.json').is_file()else[]
    merged={r['id']:r for r in manifest};merged.update({r['id']:r for r in redraw});redraw2=read(source/'redraw-2/manifest.json')if(source/'redraw-2/manifest.json').is_file()else[];merged.update({r['id']:r for r in redraw2});manifest=list(merged.values());rows=[];seen=set()
    for raw in manifest:
        id=raw.get('id','');kind=raw.get('kind')
        if not re.fullmatch(r'[a-z][a-z0-9-]*',id)or id in seen or kind not in ('prop','element','common'):raise ValueError('invalid/duplicate illustration id: '+id)
        seen.add(id);path=(source/raw['file']).resolve()
        if not any(path.is_relative_to((source/folder).resolve())for folder in ['cut','redraw','redraw-2'])or path.suffix.lower()!='.png':raise ValueError('source must be a cut PNG or redraw PNG')
        data=path.read_bytes()
        with Image.open(io.BytesIO(data))as original:
            if original.size!=(raw['width'],raw['height'])or max(original.size)>4096:raise ValueError('source dimensions: '+id)
            image=original.convert('RGBA')
        if kind=='element':cap=(768 if profile==0 else 640)if id.endswith('-burst')else 192 if id.endswith('-chip')else 320 if id.endswith('-trail')else 512
        elif kind=='common':cap=1024 if id=='guard-barrier'else 512
        else:cap=1024 if id=='hammer'else 768 if id in CRITICAL else (512 if raw.get('large')else (320 if profile==0 else 256))
        factor=min(1,cap/max(image.size));size=tuple(max(1,round(n*factor))for n in image.size)
        if size!=image.size:image=image.convert('RGBa').resize(size,Image.Resampling.LANCZOS).convert('RGBA')
        anchor=raw.get('anchor',[.5,.5]);grip=raw.get('grip');facing='left'if id=='whale'else raw.get('facing','none')
        for point in [anchor]+([grip]if grip is not None else[]):
            if not isinstance(point,list)or len(point)!=2 or any(not isinstance(n,(int,float))or not 0<=n<=1 for n in point):raise ValueError('invalid anchor/grip: '+id)
        if facing not in ('none','up','down','left','right'):raise ValueError('invalid facing: '+id)
        rows.append({'id':id,'kind':kind,'image':image,'sourceSize':[raw['width'],raw['height']],'anchor':anchor,'grip':grip,'facing':facing,'large':bool(raw.get('large')),'sourceSha256':sha(data)})
    expected=len(merged)
    if len(rows)!=expected:raise ValueError(f'expected {expected} illustrations')
    return rows,sha((source/'manifest.json').read_bytes()+((source/'redraw/manifest.json').read_bytes()if redraw else b'')+((source/'redraw-2/manifest.json').read_bytes()if redraw2 else b''))

def pack(rows):
    bins=[];placements={}
    for row in sorted(rows,key=lambda r:(-max(r['image'].size),-r['image'].width*r['image'].height,r['id'])):
        w,h=(n+PAD*2 for n in row['image'].size);best=None
        for page,free in enumerate(bins):
            for i,(x,y,fw,fh)in enumerate(free):
                if w<=fw and h<=fh:
                    score=(min(fw-w,fh-h),max(fw-w,fh-h),page,y,x)
                    if best is None or score<best[0]:best=(score,page,x,y)
        if best is None:bins.append([(0,0,EDGE,EDGE)]);best=((0,0),len(bins)-1,0,0)
        _,page,x,y=best;free=[]
        for fx,fy,fw,fh in bins[page]:
            if x>=fx+fw or x+w<=fx or y>=fy+fh or y+h<=fy:free.append((fx,fy,fw,fh));continue
            if x>fx:free.append((fx,fy,x-fx,fh))
            if x+w<fx+fw:free.append((x+w,fy,fx+fw-x-w,fh))
            if y>fy:free.append((fx,fy,fw,y-fy))
            if y+h<fy+fh:free.append((fx,y+h,fw,fy+fh-y-h))
        bins[page]=[r for i,r in enumerate(free)if not any(i!=j and r[0]>=q[0]and r[1]>=q[1]and r[0]+r[2]<=q[0]+q[2]and r[1]+r[3]<=q[1]+q[3]and(r!=q or i>j)for j,q in enumerate(free))]
        placements[row['id']]=(page,x+PAD,y+PAD)
    return placements,len(bins)

def build(source):
    # Mobile reading profile: bound small sprite/fragment resolution, not page count.
    profile=1
    rows,source_hash=prepare(source,profile);positions,count=pack(rows)
    canvases=[Image.new('RGBA',(EDGE,EDGE),(0,0,0,0))for _ in range(count)]
    spec={'version':1,'pages':{},'props':{},'elements':{},'common':{},'provenance':{'title':'프로젝트 자체 제작 AI 일러스트','license':'PLEASE','manifestSha256':source_hash,'profile':profile,'sources':{}}}
    for row in rows:
        page,x,y=positions[row['id']];image=row['image'];canvases[page].paste(image,(x,y));entry={'art':f'anim-atlas-{page+1:02}','rect':[x,y,*image.size],'sourceSize':row['sourceSize'],'anchor':row['anchor'],'facing':row['facing'],'large':row['large']}
        if row['grip']is not None:entry['grip']=row['grip']
        id=row['id'];spec['provenance']['sources'][id]=row['sourceSha256']
        if row['kind']=='element':element,part=id.rsplit('-',1);spec['elements'].setdefault(element,{})[part]=entry
        else:spec['props'if row['kind']=='prop'else'common'][id]=entry
    files={}
    for i,canvas in enumerate(canvases):
        out=io.BytesIO();canvas.save(out,'WEBP',quality=88,method=6,exact=True);data=out.getvalue();name=f'atlas-{i+1:02}.webp';files[name]=data
        spec['pages'][f'anim-atlas-{i+1:02}']={'width':EDGE,'height':EDGE,'sha256':sha(data),'file':'art/animation/'+name}
    if any(len(data)>25*1024*1024 for data in files.values()):raise ValueError('atlas page > 25 MiB')
    return spec,files

def verify_shipped(target):
    spec=read(target/'atlas.json')
    if spec.get('version')!=1 or not len(spec.get('pages',{}))>=1:raise ValueError('atlas schema/budget')
    for page in spec['pages'].values():
        path=target/Path(page['file']).name
        if path.stat().st_size>25*1024*1024:raise ValueError('atlas page > 25 MiB')
        if sha(path.read_bytes())!=page['sha256']:raise ValueError('atlas hash: '+path.name)
        with Image.open(path)as im:
            if im.size!=(page['width'],page['height'])or max(im.size)>2048:raise ValueError('atlas dimensions')
    return spec

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--source',type=Path,default=SAMPLE/'production/anim-props');ap.add_argument('--pack',type=Path,default=Path(os.environ.get('PACK_DIR',SAMPLE/'pack')));ap.add_argument('--check',action='store_true');args=ap.parse_args();target=args.pack/'art/animation';game_path=args.pack/'game.json';game=read(game_path)
    if not(args.source/'manifest.json').is_file():
        if not args.check:raise ValueError('raw illustrations unavailable')
        spec=verify_shipped(target);files={Path(p['file']).name:(target/Path(p['file']).name).read_bytes()for p in spec['pages'].values()};mode='public source hashes (raw PNG excluded)'
    else:
        spec,files=build(args.source);mode=f"{len(spec['provenance']['sources'])} original PNG (redraw priority) + deterministic WebP"
        if args.check:
            if read(target/'atlas.json')!=spec:raise ValueError('atlas metadata differs from originals')
            for name,data in files.items():
                if (target/name).read_bytes()!=data:raise ValueError('atlas pixels differ from originals: '+name)
        else:
            target.mkdir(parents=True,exist_ok=True)
            for name,data in files.items():(target/name).write_bytes(data)
            for old in target.glob('atlas-*.webp'):
                if re.fullmatch(r'atlas-\d\d.webp',old.name)and old.name not in files:old.unlink()
            (target/'atlas.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    art=game['art']['files'];expected={id:page['file']for id,page in spec['pages'].items()}
    credit={'title':'무장 연출 소품·효과','detail':f"프로젝트 자체 제작 AI 일러스트 {len(spec['provenance']['sources'])}종 · 아틀라스 재편집 · PLEASE License"}
    if args.check:
        if game.get('animationArt')!='art/animation/atlas.json'or any(art.get(id)!=path for id,path in expected.items())or credit not in game.get('credits',[]):raise ValueError('atlas registration/credit missing')
    else:
        for id in list(art):
            if id.startswith('anim-atlas-')and id not in expected:del art[id]
        art.update(expected);game['animationArt']='art/animation/atlas.json'
        game['credits']=[c for c in game.get('credits',[])if c.get('title')!=credit['title']]+[credit]
        game_path.write_text(json.dumps(game,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(f"animation art {'check'if args.check else'pack'}: {len(files)+1} files, {sum(map(len,files.values()))+(target/'atlas.json').stat().st_size} bytes; {mode}")
if __name__=='__main__':main()
