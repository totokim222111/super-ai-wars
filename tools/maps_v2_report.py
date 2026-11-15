import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR, system_font
"""실제 게임 캡처와 옛 맵 비교를 모은다. 게임용 그림은 바꾸지 않는다."""
import json
import importlib.util
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
ROOT = SAMPLE_ROOT
OUT=ROOT/'tools/out/maps-v2'
FONT=ImageFont.truetype(system_font(),22)
THEMES=['datacenter','museum','harbor','snowfield','sovereign','cyber']

def panel(path,size):
    src=Image.open(path).convert('RGB');canvas=Image.new('RGB',size,'#131b28');image=ImageOps.contain(src,size,Image.Resampling.LANCZOS);canvas.paste(image,((size[0]-image.width)//2,(size[1]-image.height)//2));return canvas

def comparison(left,right,dest,right_title):
    canvas=Image.new('RGB',(1440,525),'#131b28');d=ImageDraw.Draw(canvas);d.text((18,8),'기존 map-terrain.webp',font=FONT,fill='white');d.text((738,8),right_title,font=FONT,fill='white');canvas.paste(panel(left,(720,480)),(0,45));canvas.paste(panel(right,(720,480)),(720,45));canvas.save(dest)

def main():
    spec=importlib.util.spec_from_file_location('map_paint_check',ROOT/'tools/map_paint.py');checker=importlib.util.module_from_spec(spec);spec.loader.exec_module(checker)
    final=[]
    for theme,ep in [('datacenter','ep01'),('museum','ep02')]:
        job=json.loads((ROOT/f'art-src/maps-v2/{ep}/job.json').read_text(encoding='utf8'))
        results=checker.check_alignment(Image.open(ART_SOURCE_DIR/f'maps-v2/{ep}/base.png'),Image.open(PACK_DIR/f'art/maps/{theme}/{ep}.webp'),job['tiles'])
        bad=[r for r in results if not r['ok']];final.append(dict(episode=ep,failedCells=len(bad),results=results))
        if bad:raise ValueError(f'{ep} 등록 WebP 정렬 실패: {bad}')
    (OUT/'registered-alignment.json').write_text(json.dumps(final,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    for theme in THEMES:comparison(PACK_DIR / 'art' / 'map-terrain.webp',OUT/f'{theme}-tile.png',OUT/f'{theme}-compare.png',f'{theme} · 칸 단위 · 18×12')
    for ep in ['01','02']:comparison(PACK_DIR / 'art' / 'map-terrain.webp',ROOT/f'art-src/maps-v2/ep{ep}/approved.png',OUT/f'ep{ep}-compare.png',f'{ep}화 · 덧칠 · 18×12')
    for ep in ['ep01','ep02']:
        job=json.loads((ROOT/f'art-src/maps-v2/{ep}/job.json').read_text(encoding='utf8'));n=len(job['attempts']);Image.open(ROOT/f'art-src/maps-v2/{ep}/alignment-{n}.png').save(OUT/f'{ep}-alignment.png')
    shots=['saw-01','saw-02','sample-03',*THEMES];canvas=Image.new('RGB',(1920,1170),'#131b28');d=ImageDraw.Draw(canvas)
    for i,name in enumerate(shots):
        x=(i%3)*640;y=(i//3)*390;d.text((x+12,y+4),name+(' · 덧칠' if name.startswith('saw-') else ' · 칸 단위'),font=FONT,fill='white');canvas.paste(panel(OUT/f'{name}-game.png',(640,360)),(x,y+30))
    canvas.save(OUT/'contact.png')
    files=list((PACK_DIR/'art').rglob('*'));files=[p for p in files if p.is_file()];new=[p for p in files if '/maps/' in p.as_posix()]
    report=dict(newFiles=len(new),newBytes=sum(p.stat().st_size for p in new),totalFiles=len(files),totalBytes=sum(p.stat().st_size for p in files),limit=511,buildingSprites=48,buildingAtlases=6,originalMaterials=84,improvedGrounds=6,paintedMaps=2,alignment={ep:json.loads((ROOT/f'art-src/maps-v2/{ep}/job.json').read_text(encoding='utf8'))['attempts'] for ep in ['ep01','ep02']})
    (OUT/'assets.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8');print(json.dumps({k:v for k,v in report.items() if k!='alignment'},ensure_ascii=False))

if __name__=='__main__':main()
