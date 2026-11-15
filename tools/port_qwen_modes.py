"""Carbon's six Qwen mode slots and three verbatim lines. Manuscripts are read-only."""
import argparse,copy,hashlib,json,re,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from paths import PACK_DIR,STORY_DIR
APPROVED=Path(__file__).with_name('qwen-modes-approved.json')
MODES={'메가데레':'megadere','얀데레':'yandere','악의축':'axis'}
def contract():
    source=STORY_DIR/'carbon/qwen-mode-weapons.md'
    if not source.is_file():return json.loads(APPROVED.read_text(encoding='utf-8'))
    text=source.read_text(encoding='utf-8-sig');blocks=re.findall(r'^```[^\n]*\n(.*?)^```',text,re.M|re.S)
    if len(blocks)!=2:raise ValueError('Expected weapon and dialogue blocks')
    weapons=[];lines={}
    for line in blocks[0].splitlines():
        if not line.strip():continue
        mode,slot,name,desc=line.split(' | ')
        if mode not in MODES or slot not in ['①','②']:raise ValueError('Unknown mode/slot')
        weapons.append({'mode':mode,'slot':slot,'name':name,'desc':desc})
    for line in blocks[1].splitlines():
        if not line.strip():continue
        m=re.fullmatch(r'(메가데레|얀데레|악의축) \| \[([^]]+)\] (.+)',line)
        if not m:raise ValueError('Invalid mode dialogue')
        lines[m[1]]={'text':m[3],'mood':{'부끄러움':'shy','당황':'hit','웃음':'laugh'}[m[2]]}
    if len(weapons)!=6 or {(w['mode'],w['slot'])for w in weapons}!={(m,s)for m in MODES for s in ['①','②']}or set(lines)!=set(MODES):raise ValueError('Exactly six slots and three lines required')
    return {'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'weapons':weapons,'lines':lines}
def slots(gen,mode):
    return [f'feedback-qwen-{gen}-heal',f'feedback-qwen-{gen}-megadere-1']if mode=='megadere'else[f'feedback-qwen-{gen}-{mode}-1',f'feedback-qwen-{gen}-{mode}-2']
def patch_weapons(output,pack):
    c=contract();weapons={w['id']:w for w in output[pack/'data/weapons.json']};mechs=output[pack/'data/mechs.json'];art=output[pack/'weapons.json']
    for gen in range(1,5):
        for label,mode in MODES.items():
            m=next((m for m in mechs if m['id']==f'qwen-{mode}-generation-{gen}'),None)
            if not m:continue
            ids=slots(gen,mode);m['weapons']=ids;m['allyStats']['weapons']=ids[:]
            for i,id in enumerate(ids):
                row=next(w for w in c['weapons']if w['mode']==label and w['slot']==['①','②'][i]);weapons[id]['name']=row['name'];art[id]['lineSource']=id
                if mode=='axis'and i==0:art[id]['anim']={'template':'rapid-fire','color':'#aacfff'}
                if mode=='megadere'and i==1:art[id]['anim']={'template':'heavy-shot','color':'#c7acff'}
                for stage in output[pack/'balance-stages.json'].values():
                    patch=stage['content']['weapons'].get(id)
                    if patch is not None:patch['name']=row['name']
            for stage in output[pack/'balance-stages.json'].values():stage['content']['mechs'][m['id']]['weapons']=ids[:]
def patch_cast(cast):
    c=contract()
    for id,actor in cast.items():
        if id not in ['qwen','qwen-axis','qwen-yandere','qwen-megadere']:continue
        bank=actor['battleLines']
        for label,mode in MODES.items():
            pool=bank.setdefault('forms',{}).setdefault(label,{}).setdefault('weapons',{})
            for gen in range(1,5):
                for weapon in slots(gen,mode):pool[weapon]=[copy.deepcopy(c['lines'][label])]
def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args();c=contract()
    if args.check:
        if json.loads(APPROVED.read_text(encoding='utf-8'))!=c:raise SystemExit('Qwen manuscript contract mismatch')
    else:APPROVED.write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    from apply_balance_v2 import generated
    from port_battle_lines import generate
    different=[]
    # Weapon-name resolution reads pack files, so finish balance output first.
    for make in [generated,lambda:generate(PACK_DIR,STORY_DIR)]:
        for path,value in make().items():
            if args.check:
                if json.loads(path.read_text(encoding='utf-8-sig'))!=value:different.append(str(path))
            else:path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    if different:raise SystemExit('Qwen mode port mismatch: '+', '.join(different))
    print('퀜 모드 원문 대조 완료: 6개 이름·3개 대사, 모드별 2칸')
if __name__=='__main__':main()
