import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR
"""내장 image_gen용 맵 덧칠 요청 준비와 80px 칸 정렬 검사. 네트워크/API 호출 없음.

prepare --story ... --base ... --out ... : prompt.txt와 job.json 생성.
내장 image_gen으로 밑그림과 prompt.txt를 사용한 뒤
check --job .../job.json --image <생성된 PNG> : 최대 4회 검사. 실패 시 수정 지시 생성.
통과 이미지만 approved.png가 된다. 최종 시각 검수 후 art_ingest로 등록한다.
"""
import argparse
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = SAMPLE_ROOT

def read_tiles(path):
    text=Path(path).read_text(encoding='utf-8-sig');rows=[];active=False
    for line in text.splitlines():
        if line.strip().startswith('@'):
            active=line.strip()=='@ 맵';continue
        if active and line.strip() and not line.strip().startswith('//'):rows.append(line.split())
    if not rows or len({len(r) for r in rows})!=1:raise ValueError('@ 맵의 줄 길이가 다릅니다.')
    legend={t['char']:t['id'] for t in json.loads((ROOT/'content/terrain/saw.json').read_text(encoding='utf8')) if 'char' in t}
    return [[legend[c] for c in row] for row in rows]

def features(image):
    a=np.asarray(image.convert('RGB'),dtype=float)/255
    hi=a.max(2);lo=a.min(2);sat=(hi-lo)/np.maximum(hi,.001)
    # 청록/파랑 물의 보편적인 색 영역. 네온 한 줄과 넓은 수면을 면적으로 구별한다.
    water=(a[:,:,2]>a[:,:,0]*1.2)&(a[:,:,1]>a[:,:,0]*1.16)&(sat>.25)&(hi>.25)
    gray=a.mean(2)
    edge=(np.abs(np.diff(gray,axis=0)).mean()+np.abs(np.diff(gray,axis=1)).mean())/2
    station=(a[:,:,1]>a[:,:,0]*1.12)&(a[:,:,1]>a[:,:,2]*.8)&(sat>.23)
    return dict(water=float(water.mean()),station=float(station.mean()),edge=float(edge),spread=float(np.percentile(gray,90)-np.percentile(gray,10)),dark=float((gray<.23).mean()),bright=float((gray>.42).mean()),mean=a.mean((0,1)).tolist())

def check_alignment(base,paint,tiles,cell=80):
    """색·밝기·윤곽의 보수적 검사. 의미 인식은 아니므로 시각 검수를 함께 한다."""
    w=len(tiles[0])*cell;h=len(tiles)*cell
    if base.size!=(w,h) or paint.size!=(w,h):raise ValueError(f'정확히 {w}×{h}이어야 합니다.')
    result=[]
    for y,row in enumerate(tiles):
        for x,terrain in enumerate(row):
            box=(x*cell+8,y*cell+8,(x+1)*cell-8,(y+1)*cell-8)
            ref=features(base.crop(box));got=features(paint.crop(box));problems=[]
            if terrain=='saw-water':
                # 보라 안개/얼음 등은 청록 기준 대신 밑그림의 실제 색과 윤곽으로 비교한다.
                if ref['water']>.25:
                    if got['water']<max(.2,ref['water']*.55):problems.append('물 칸의 수면 색 면적 부족')
                elif np.linalg.norm(np.array(got['mean'])-ref['mean'])>.23 or got['edge']>max(.025,ref['edge']*3):problems.append('물 칸의 무대별 수면 색·윤곽 불일치')
            if terrain=='saw-wall' and (got['edge']<max(.012,ref['edge']*.4) or got['spread']<.12):problems.append('벽 칸의 지붕·벽 윤곽 부족')
            if terrain=='saw-cache' and got['station']<max(.012,ref['station']*.18):problems.append('복구 서버 칸의 녹색/청록 설비 표시 부족')
            if terrain=='saw-cover' and (got['edge']<max(.008,ref['edge']*.3) or got['spread']<.07):problems.append('엄폐물 칸의 소품 윤곽 부족')
            if terrain in ['saw-plain','saw-road']:
                if got['water']>max(.42,ref['water']+.26):problems.append('통행 칸이 넓은 수면처럼 보임')
                if got['dark']>.6 and got['edge']>.06 and got['spread']>.45 and ref['dark']<.3:problems.append('통행 칸이 어두운 건물로 막혀 보임')
            result.append(dict(x=x,y=y,terrain=terrain,ok=not problems,problems=problems,reference=ref,actual=got))
    return result

def prepare(story,base,out):
    out=Path(out);out.mkdir(parents=True,exist_ok=True);tiles=read_tiles(story)
    if (out/'job.json').exists():raise ValueError('이미 준비한 작업입니다. 기존 job.json으로 검사하거나 새 out 폴더를 쓰세요. 검사 기록을 초기화하지 않습니다.')
    image=Image.open(base);size=(len(tiles[0])*80,len(tiles)*80)
    if image.size!=size:raise ValueError(f'밑그림이 {size}와 다릅니다: {image.size}')
    image.save(out/'base.png')
    job=dict(story=str(Path(story).resolve()),tiles=tiles,attempts=[],maxAttempts=4)
    (out/'job.json').write_text(json.dumps(job,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    grid='\n'.join(' '.join({'saw-plain':'.','saw-road':'=','saw-water':'~','saw-wall':'#','saw-cache':'C','saw-cover':'^'}[c] for c in row)for row in tiles)
    prompt=f'''Use case: sketch-to-render. Edit target: base.png, a tactical RPG board. Style reference: map-terrain.webp ONLY for finish, not layout.
Output exactly {size[0]}x{size[1]}, {len(tiles[0])} columns x {len(tiles)} rows, 80px per cell. LOCK camera overhead, terrain coordinates and traversable paths. No grid, no units, no text, no UI.
Repaint into a premium detailed hand-painted anime robot strategy map matching reference finish: crisp architectural edges, layered paving, inset conduits, low planting strips, short contact shadows, deliberate district composition, strong material separation. Never leave broad blank texture. Keep unit silhouettes readable, center of every traversable cell open. Texture does not mean high obstacles. No perspective warp, no moved terrain.
Terrain glyphs: . passable dry plaza, = passable road, ~ water filling its cell, # raised buildings contained within their cells, C SMALL luminous recovery station with walkable apron, ^ low cover. Do NOT invent water or tall buildings on . or = cells. Enrich those with flat inlaid patterns, drains and curb details only. Tall buildings ONLY on #. Cache objects stay at C. All cell identities must remain unchanged.
Exact grid (top row first):
{grid}
'''
    (out/'prompt.txt').write_text(prompt,encoding='utf8');print(out/'prompt.txt')

def check(jobpath,imagepath):
    jobpath=Path(jobpath);out=jobpath.parent;job=json.loads(jobpath.read_text(encoding='utf8'))
    if len(job['attempts'])>=job['maxAttempts']:raise ValueError('4회 검사 한도입니다. 승인하지 말고 정렬 실패를 보고하세요.')
    tiles=job['tiles'];size=(len(tiles[0])*80,len(tiles)*80);source=Image.open(imagepath).convert('RGB')
    if abs(source.width/source.height-size[0]/size[1])>.035:
        attempt=len(job['attempts'])+1
        result=dict(attempt=attempt,image=str(Path(imagepath).resolve()),passed=False,failedCells=sum(map(len,tiles)),problem='가로세로 비율이 달라 칸 정렬 불가')
        job['attempts'].append(result);jobpath.write_text(json.dumps(job,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
        (out/f'report-{attempt}.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
        (out/'retry.txt').write_text(f'Regenerate at {size[0]}x{size[1]} aspect ratio. Do not crop or stretch terrain. Preserve exact grid.',encoding='utf8')
        approved=out/'approved.png'
        if approved.exists():approved.unlink()
        print(json.dumps(result,ensure_ascii=False));return False
    # 내장 도구의 해상도는 가변이므로 같은 비율에서만 80px 칸 크기로 정규화한다.
    source=source.resize(size,Image.Resampling.LANCZOS);base=Image.open(out/'base.png').convert('RGB')
    results=check_alignment(base,source,tiles);bad=[r for r in results if not r['ok']];attempt=len(job['attempts'])+1
    source.save(out/f'attempt-{attempt}.png');overlay=source.convert('RGBA');d=ImageDraw.Draw(overlay)
    for r in results:
        x,y=r['x']*80,r['y']*80;d.rectangle((x+1,y+1,x+78,y+78),outline='#ef445e' if not r['ok'] else '#63c999',width=2);d.text((x+5,y+4),f"{r['x']},{r['y']}",fill='white',stroke_width=1,stroke_fill='black')
    overlay.convert('RGB').save(out/f'alignment-{attempt}.png')
    report=dict(attempt=attempt,passed=not bad,failedCells=len(bad),results=results)
    (out/f'report-{attempt}.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    job['attempts'].append(dict(image=str(Path(imagepath).resolve()),passed=not bad,failedCells=len(bad)))
    jobpath.write_text(json.dumps(job,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    if not bad:source.save(out/'approved.png')
    else:
        approved=out/'approved.png'
        if approved.exists():approved.unlink()
        (out/'retry.txt').write_text('Preserve the whole image except fix these cell coordinates (zero-based):\n'+'\n'.join(f"{r['x']},{r['y']}: {'; '.join(r['problems'])}" for r in bad)+'\nKeep the exact original grid. Do not move boundaries.',encoding='utf8')
    print(json.dumps(dict(attempt=attempt,passed=not bad,failedCells=len(bad)),ensure_ascii=False));return not bad

def self_test():
    base=Image.new('RGB',(320,80),'#aaa8a0');d=ImageDraw.Draw(base);d.rectangle((80,0,159,79),fill='#167dba')
    d.rectangle((164,4,235,75),fill='#253442');d.rectangle((170,9,229,59),fill='#bac2c8')
    for i in range(5):d.line((170,12+i*9,230,12+i*9),fill='#243040',width=3)
    d.rectangle((246,6,313,73),fill='#e9eef0');d.ellipse((256,16,303,63),fill='#30b86a')
    tiles=[['saw-plain','saw-water','saw-wall','saw-cache']]
    assert all(r['ok'] for r in check_alignment(base,base,tiles))
    wrong=Image.new('RGB',base.size,'#aaa8a0');bad=check_alignment(base,wrong,tiles)
    assert not bad[1]['ok'] and not bad[2]['ok'] and not bad[3]['ok']
    wrong=base.copy();ImageDraw.Draw(wrong).rectangle((0,0,79,79),fill='#167dba');assert not check_alignment(base,wrong,tiles)[0]['ok']
    # 검사 실패는 승인 파일을 만들지 않으며 4회 뒤에는 추가 검사를 막는다.
    import tempfile
    from contextlib import redirect_stdout
    from io import StringIO
    with tempfile.TemporaryDirectory() as temp:
        out=Path(temp);base.save(out/'base.png');Image.new('RGB',base.size,'#aaa8a0').save(out/'wrong.png')
        job=out/'job.json';job.write_text(json.dumps(dict(tiles=tiles,attempts=[],maxAttempts=4)),encoding='utf8')
        with redirect_stdout(StringIO()):
            for _ in range(4):assert not check(job,out/'wrong.png')
        assert not (out/'approved.png').exists();assert (out/'alignment-4.png').exists()
        try:check(job,out/'wrong.png')
        except ValueError:pass
        else:raise AssertionError('4회 한도 실패')
    print('map_paint self-test PASS (물·벽·통행 칸 오배치 검출)')

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);s=p.add_subparsers(dest='command',required=True)
    a=s.add_parser('prepare');a.add_argument('--story',required=True);a.add_argument('--base',required=True);a.add_argument('--out',required=True)
    a=s.add_parser('check');a.add_argument('--job',required=True);a.add_argument('--image',required=True)
    s.add_parser('self-test');a=p.parse_args()
    if a.command=='prepare':prepare(a.story,a.base,a.out)
    elif a.command=='check':raise SystemExit(0 if check(a.job,a.image) else 1)
    else:self_test()
