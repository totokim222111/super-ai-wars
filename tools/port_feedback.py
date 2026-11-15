"""Verify the approved Gem form wording overlay without touching manuscripts."""
import argparse,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from paths import PACK_DIR
from feedback_balance import visible_text
FILES=['cast.json','gallery.json','battle-lines/combos.json','data/weapons.json','data/mechs.json','units.json']+[f'story/ep{i:02}.story'for i in range(1,16)]
CONTRACT=Path(__file__).with_name('feedback-renames.json')
def collect():
    rows=[]
    def add(file,pointer,text):
        if visible_text(text)!=text:raise ValueError(f'Unconverted Gem form: {file}:{pointer}: {text}')
        if '플래시'in text:rows.append({'file':file,'at':pointer,'before':text.replace('플래시','나노'),'after':text})
    def walk(file,value,pointer=''):
        if isinstance(value,str):add(file,pointer,value)
        elif isinstance(value,list):
            for i,v in enumerate(value):walk(file,v,pointer+'/'+str(i))
        elif isinstance(value,dict):
            for k,v in value.items():
                # New differentiated mech labels are new data, not dialogue rewrites.
                if k=='name'and isinstance(v,str)and ' · 플래시'in v:continue
                walk(file,v,pointer+'/'+k)
    for file in FILES:
        text=(PACK_DIR/file).read_text(encoding='utf-8')
        if file.endswith('.story'):
            for i,line in enumerate(text.splitlines(),1):add(file,str(i),line)
        else:walk(file,json.loads(text))
    return rows
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args();rows=collect()
    if args.check:
        if json.loads(CONTRACT.read_text(encoding='utf-8'))!=rows:raise SystemExit('Gem form wording manifest mismatch')
    else:CONTRACT.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'승인 폼 문구 대조 완료: {len(rows)} 위치 (과거 저장 원문은 변환 계약으로 보존)')
if __name__=='__main__':main()
