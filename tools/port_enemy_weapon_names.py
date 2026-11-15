"""Port Carbon's exact enemy weapon names and the approved small utility loadouts.
Sources are read-only; the bundled contract supports public copies without studio records.
"""
from __future__ import annotations
import argparse,copy,hashlib,json,re
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from paths import PACK_DIR,SAMPLE_ROOT,STORY_DIR,STUDIO_ROOT
APPROVED=Path(__file__).with_name('enemy-weapons-approved.json')

def read(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def contract():
    manuscripts=[STORY_DIR/'carbon'/f'enemy-weapon-names-{i}.md' for i in [1,2]]
    index=STUDIO_ROOT/'docs/studio/carbon-requests/enemy-weapons-index.json'
    if all(p.is_file() for p in manuscripts) and index.is_file():
        names={};specials=[];sources={}
        for path in manuscripts:
            text=path.read_text(encoding='utf-8-sig');sources[path.name]=hashlib.sha256(path.read_bytes()).hexdigest()
            blocks=re.findall(r'^```[^\n]*\n(.*?)^```\s*$',text,re.M|re.S)
            for block in blocks:
                for line in block.splitlines():
                    if not line.strip():continue
                    fields=line.split(' | ')
                    if len(fields)==2:
                        id,name=fields
                        if id in names:raise ValueError('Duplicate manuscript weapon: '+id)
                        names[id]=name
                    elif len(fields)==4:
                        id,name,effect,reason=fields
                        specials.append({'sourceMech':id,'family':re.sub(r'-episode-\d+$','',id),'name':name,'effect':effect,'reason':reason})
                    else:raise ValueError('Malformed fenced source line')
        idx=read(index)
        if set(names)!=set(idx['weapons']):raise ValueError('Source/index weapon set differs')
        result={'schemaVersion':'carbon-enemy-weapons-1','sources':sources,'names':names,'specials':specials,'index':{id:{'mechIds':row['mechIds'],'definition':row['definition'],'currentName':row['currentName']} for id,row in idx['weapons'].items()}}
    else:result=read(APPROVED)
    if result['schemaVersion']!='carbon-enemy-weapons-1' or len(result['names'])!=85 or len(result['specials'])!=23 or len({s['family']for s in result['specials']})!=23:raise ValueError('Exactly 85 names and 23 distinct families required')
    return result


def special_definition(row,normal):
    effect=row['effect'];spec={'label':effect+'!','cooldown':2}
    power=max(350,min(1000,round(normal['power']*.35)));kind='beam';reach=[1,3]
    if effect in ['명중 저하','이동력 감소','온도 저하','피해 감소']:
        atom={'명중 저하':{'type':'hitAdd','value':-10},'이동력 감소':{'type':'moveAdd','value':-1},'온도 저하':{'type':'moraleOffset','value':-5},'피해 감소':{'type':'takenMul','value':.97}}[effect]
        spec.update(kind='status',target='self' if effect=='피해 감소'else'enemy',rounds=1 if effect=='피해 감소'else 2,atoms=[atom])
    elif effect=='VRAM 흡수':spec.update(kind='drain',ratio=.02,max=15,label='{en} 흡수')
    elif effect=='크리티컬 확정':spec.update(kind='critical');power=max(400,min(1400,round(normal['power']*.45)))
    elif effect=='증식(소환)':spec.update(kind='summon',limit=2,hpPct=25,label='증식!')
    elif effect=='추가 행동':spec.update(kind='extraAction',cooldown=3)
    elif effect=='사거리 증가':spec=None;power=max(400,min(1800,round(normal['power']*.7)));reach=[2,min(8,normal['range'][1]+1)]
    elif effect in ['자동 HP 회복','회복','주변 회복','보급']:
        spec.update(kind='restore',target='allies'if effect in ['주변 회복','보급']else'self',radius=1)
        if effect=='보급':spec.update(enFlat=10,ammo=1)
        else:spec['hpPct']={'자동 HP 회복':3,'회복':5,'주변 회복':3}[effect]
        power=0
    else:raise ValueError('Unknown source effect: '+effect)
    w={'id':'zako-special-'+row['family'],'name':row['name'],'kind':kind,'power':power,'range':reach,'hit':15,'crit':0,'en':10,'ammo':2,'postMove':True,'adapt':copy.deepcopy(normal['adapt']),'fixedPower':True}
    if spec:w['special']=spec
    return w


def patch_output(output,pack=PACK_DIR):
    data=contract();wp=pack/'data/weapons.json';mp=pack/'data/mechs.json';sp=pack/'balance-stages.json';ap=pack/'weapons.json'
    weapons=output[wp];mechs=output[mp];stages=output[sp];art=output[ap];wm={w['id']:w for w in weapons}
    for id,name in data['names'].items():
        if id not in wm:raise ValueError('Missing indexed weapon: '+id)
        wm[id]['name']=name
        for stage in stages.values():
            if 'name'in stage.get('content',{}).get('weapons',{}).get(id,{}):stage['content']['weapons'][id]['name']=name
    for row in data['specials']:
        source=next((m for m in mechs if m['id']==row['sourceMech']),None)
        if source is None:raise ValueError('Missing indexed family: '+row['sourceMech'])
        normal=wm[row['sourceMech']+'-normal'];w=special_definition(row,normal);id=w['id'];old=wm.get(id)
        if old is not None:old.clear();old.update(w)
        else:weapons.append(w);wm[id]=w
        family=re.compile('^'+re.escape(row['family'])+r'-episode-\d+$')
        for m in mechs:
            if not family.fullmatch(m['id']):continue
            m['weapons']=[v for v in m['weapons'] if v!=id]+[id]
            if row['effect']=='자동 HP 회복':m['hpRecovery']={'pct':1}
        for stage in stages.values():
            for mid,patch in stage.get('content',{}).get('mechs',{}).items():
                if not family.fullmatch(mid):continue
                if 'weapons'in patch:patch['weapons']=[v for v in patch['weapons'] if v!=id]+[id]
                if row['effect']=='자동 HP 회복':patch['hpRecovery']={'pct':1}
        art[id]={'anim':{'template':'heavy-shot' if w['power']==0 else 'beam','color':'#b7e882'}}
    output[APPROVED]=data
    return output


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
    paths=['data/weapons.json','data/mechs.json','balance-stages.json','weapons.json'];output={PACK_DIR/name:read(PACK_DIR/name)for name in paths};patch_output(output)
    different=[]
    for path,value in output.items():
        if args.check:
            if not path.is_file()or read(path)!=value:different.append(path.name)
        else:path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    if different:raise SystemExit('enemy weapon port mismatch: '+', '.join(different))
    print('적 무장 원문 대조 완료: 85 이름, 자코 특수 무장 23종'if args.check else'적 무장 적용 완료: 85 이름, 자코 특수 무장 23종')
if __name__=='__main__':main()
