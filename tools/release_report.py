import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR, system_font
"""공개 전 경고·첫 로딩 수치·화면 모음을 묶는다."""
import json
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw,ImageFont
ROOT = SAMPLE_ROOT;OUT=ROOT/'tools/out/release-cleanup'
def read(name):
    text=(OUT/name).read_text(encoding='utf-8-sig');return json.loads(text[text.index('[') if text.lstrip().startswith('>') else 0:])
def main():
    compression=read('compression.json');remaining=[r for r in compression if r['remaining']]
    lines=['# 남은 팩 경고','', '| 파일 id | 현재 / 상한 (KiB) | 품질 | 남긴 이유 |','| --- | ---: | ---: | --- |']
    for r in remaining:lines.append(f"| {r['id']} | {r['after']/1024:.1f} / {r['limit']/1024:.0f} | {r['quality']} | 투명 잡티 정리 후에도 초과. 품질 76 하한을 지키고 표정 rect·기준점 구도를 보존함. |")
    lines+=['','용량 15건 중 10건 해소. 기존 품질보다 더 낮추거나 캔버스를 잘라 얼굴 좌표·기체 기준점을 바꾸지 않는다. 전후 모음: compression-contact.png.']
    (OUT/'remaining-warnings.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
    before=read('before.json');after=read('after.json');rows=[]
    for a in after['records']:
        b=next(b for b in before['records'] if b['entry']==a['entry']);rows.append(dict(entry=a['entry'],before=b['scriptBytes'],after=a['scriptBytes'],reduction=round(100*(1-a['scriptBytes']/b['scriptBytes']),2),base=a['base']))
    report=dict(firstScreen=rows,beforeChunks=before['chunks'],afterChunks=after['chunks'],warningsBefore=95,warningsAfter=len(remaining),remaining=remaining,artBytesSaved=sum(r['before']-r['after'] for r in compression if r['accepted']),browser=[{k:v for k,v in r.items() if k in ['entry','flow','gallery','errors']}for r in after['records']])
    (OUT/'summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    lines=['# 공개 전 로딩 측정','','빈 브라우저 문맥, 서비스 워커 차단, 압축 없는 로컬 HTTP, `/showcase/build/` 하위 경로에서 첫 화면이 그려질 때까지 받은 JS 본문 바이트 합계다. 그림·소리·JSON 본문은 JS 합계에 섞지 않는다.','', '| 첫 화면 | 이전 (B) | 이후 (B) | 감소 |','| --- | ---: | ---: | ---: |']
    for r in rows:lines.append(f"| {r['entry']} | {r['before']:,} | {r['after']:,} | {r['reduction']}% |")
    for title,key in [('이전 묶음','beforeChunks'),('이후 묶음 (나중에 읽는 코드 포함)','afterChunks')]:
        lines+=['','## '+title,'','| 파일 | 바이트 |','| --- | ---: |']
        lines += [f"| {r['file']} | {r['bytes']:,} |" for r in report[key]]
    (OUT/'loading-report.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
    font=ImageFont.truetype(system_font(),19);shots=['after-game.html','game-ep01','game-result','game-hub','game-ep02','after-v2.html','gallery-0','gallery-2','gallery-5'];canvas=Image.new('RGB',(1920,1170),'#121a2b');d=ImageDraw.Draw(canvas)
    for i,name in enumerate(shots):
        path=OUT/(name+'.png')
        if not path.exists():continue
        x=i%3*640;y=i//3*390;d.text((x+10,y+5),name,font=font,fill='white');im=ImageOps.contain(Image.open(path).convert('RGB'),(640,360));canvas.paste(im,(x+(640-im.width)//2,y+30+(360-im.height)//2))
    canvas.save(OUT/'contact.png');print(json.dumps(dict(firstScreen=rows,warnings=len(remaining),artBytesSaved=report['artBytesSaved']),ensure_ascii=False))
if __name__=='__main__':main()
