"""Import Carbon battle speech verbatim. Source manuscripts are always read-only."""
from __future__ import annotations
from port_enemy_weapon_names import contract as enemy_weapon_contract
import argparse
import copy
import hashlib
import json
import re
from pathlib import Path
from paths import PACK_DIR, STORY_DIR
from port_voice_fix import battle_source

FILES = [f'battle-lines-{n}-{name}.md' for n,name in [(1,'allies'),(2,'rivals'),(3,'combos-zako')]]
MOODS = dict(zip(['기본','미소','웃음','공격','진지','당황','충격','슬픔','분노','부끄러움'], ['default','smile','laugh','attack','serious','hit','shock','sad','angry','shy']))
MOODS['광기 대신 웃음']='laugh'
SITUATIONS={'공격':'attack','필살':'finisher','피격·가벼움':'hitLight','피격·심각':'hitHeavy','회피':'dodge','방어':'guard','격추당함':'defeated','적 격파':'victory','보급':'resupply','수리':'repair','응원':'cheer'}
NAME_ALIASES={'하이퍼클로바짱':'하이퍼클로바X짱'}
# Portrait variants of the same authored character, not new lines.
CAST_ALIASES={'qwen-axis':'qwen','qwen-yandere':'qwen','qwen-megadere':'qwen'}

def read_json(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def sections(folder):
    result=[]
    for filename in FILES:
        source=folder/filename
        current=None
        for number,raw in enumerate(battle_source(filename,source.read_text(encoding='utf-8')).splitlines(),1):
            if raw.startswith('### '):
                current={'name':raw[4:],'rows':[],'file':filename,'line':number}
                result.append(current)
            elif current and ': [' in raw:
                key,body=raw.split(': [',1)
                entries=[]
                for piece in re.split(r' / (?=\[)', '['+body):
                    match=re.fullmatch(r'\[([^\]]+)\] (.*)',piece)
                    if not match or match[1] not in MOODS or not match[2]:
                        raise ValueError(f'{filename}:{number}: invalid mood/speech')
                    entries.append({'text':match[2],'mood':MOODS[match[1]]})
                current['rows'].append((key,entries))
    return result

def generate(pack=PACK_DIR, story=STORY_DIR):
    cast=read_json(pack/'cast.json');players=read_json(pack/'players.json');game=read_json(pack/'game.json')
    refs=read_json(pack/'rules.json');weapons=read_json(pack/refs['weapons']);mechs=read_json(pack/refs['mechs']);units=read_json(pack/'units.json')
    source=sections(story/'carbon')
    names={}
    for id,c in cast.items():names.setdefault(c['name'],[]).append(id)
    def ids(name):
        if name.startswith('주인공 타입 '):
            type=name.removeprefix('주인공 타입 ')
            return list(dict.fromkeys(p['cast'] for p in players['presets'] if p['type']==type))
        if name=='주인공':return list(dict.fromkeys(p['cast'] for p in players['presets']))
        value=names.get(NAME_ALIASES.get(name,name),[])
        if not value:raise ValueError('Missing cast: '+name)
        return value
    # Remove generated fields, so --check detects stale banks as well as changed lines.
    for c in cast.values():c.pop('battleLines',None);c.pop('moodAliases',None)
    unbound=[];combos=[];banks={};count=0;explicit=set();fallback=None
    for section in source:
        name=section['name'];count+=sum(len(lines) for _,lines in section['rows'])
        if name.startswith('합체기: '):
            title,roster=name.removeprefix('합체기: ').split(' — ',1)
            rows=[];finish=None
            for speaker,lines in section['rows']:
                for speech in lines:
                    if speaker=='마무리':
                        who,text=speech['text'].split(' | ',1)
                        finish={'cast':ids(who)[0],'speech':{**speech,'text':text}}
                    else:
                        for id in ids(speaker):rows.append({'cast':id,'speech':speech})
            assert finish
            combo={'name':title,'participants':rows,'finish':finish}
            if title=='컨텍스트 호라이즌':combo['binding']={'ids':['horizon'],'participants':[ids(n)[0] for n in ['지피짱','클로드짱']]}
            if title=='아키텍처 심포니':combo['binding']={'ids':['symphony'],'participants':[ids(n)[0] for n in ['지피짱','클로드짱','JEPA']]}
            combos.append(combo);continue
        bank={'mode':'random'}
        for key,original in section['rows']:
            lines=copy.deepcopy(original)
            if key=='피격':bank['hitLight']=lines;bank['hitHeavy']=copy.deepcopy(lines)
            elif key.startswith('상대|'):
                bank['opponentChance']=0.35
                for target in ids(key.split('|',1)[1]):bank.setdefault('opponents',{})[target]={'attack':lines}
            elif key.startswith('공격·'):
                bank.setdefault('forms',{})[key.split('·',1)[1]]={'attack':lines}
                bank.setdefault('attack',[]).extend(copy.deepcopy(lines))
            elif key.startswith('필살|'):
                weapon_name=key.split('|',1)[1]
                # Full literal weapon names only: no punctuation, spacing or provisional-name edits.
                aliases=enemy_weapon_contract()['index']
                matches=[w['id'] for w in weapons if re.sub(r'\s*\(가칭\)\s*$','',w['name'])==re.sub(r'\s*\(가칭\)\s*$','',weapon_name) or re.sub(r'\s*\(가칭\)\s*$','',aliases.get(w['id'],{}).get('currentName',''))==re.sub(r'\s*\(가칭\)\s*$','',weapon_name)]
                if '하우징 장착형' in weapon_name or weapon_name=='모비딕 풀 버스트':
                    for line in lines:line['when']={'forms':['mobydick'],'mechs':['deepseek-mobydick','deepseek-housing-episode-6']}
                if matches:
                    for weapon in matches:bank.setdefault('weapons',{})[weapon]=copy.deepcopy(lines)
                else:
                    bank.setdefault('finisher',[]).extend(lines)
                    unbound.append({'cast':name,'weapon':weapon_name,'lines':len(lines)})
            elif key in SITUATIONS:
                bank[SITUATIONS[key]]=lines
            else:raise ValueError(f'Unknown situation: {name}: {key}')
        if name=='젬짱':
            bank['afterFormChange']=[copy.deepcopy(line) for line in bank['attack'] if '폼 체인지! 제미니 변신!' in line['text']]
            assert len(bank['afterFormChange'])==1
        if name=='자코 공통':fallback=bank
        else:
            for id in ids(name):banks[id]=copy.deepcopy(bank);explicit.add(id)
    for target,base in CAST_ALIASES.items():
        banks[target]=copy.deepcopy(banks[base]);banks[target]['attack']=banks[base]['forms'][{'qwen-axis':'악의축','qwen-yandere':'얀데레','qwen-megadere':'메가데레'}[target]]['attack']
    for id,bank in banks.items():cast[id]['battleLines']=bank
    assert fallback
    def used_moods(value):
        if isinstance(value,dict):
            return ({value['mood']} if 'mood'in value else set())|set().union(*(used_moods(v) for v in value.values()),set())
        return set().union(*(used_moods(v) for v in value),set()) if isinstance(value,list) else set()
    # Retain authored tags; aliases explicitly use existing images where no matching expression was drawn.
    alias_report={}
    for id,c in cast.items():
        available={'default',*c.get('moods',{}),*c.get('moodSheet',{}).get('order',[])}
        needed=used_moods(c.get('battleLines',{}))
        for co in combos:
            needed|=set().union(*(used_moods(row['speech']) for row in [*co['participants'],co['finish']] if row['cast']==id),set())
        if id not in banks and any(v.get('pilotCast')==id for v in units.values()):needed|=used_moods(fallback)
        aliases={m:('hit' if m in ['hit','shock','sad','angry'] and 'hit'in available else 'default') for m in sorted(needed-available)}
        if aliases:c['moodAliases']=aliases;alias_report[id]=aliases
    if game.get('stageAdjustments'):
        approved=read_json(Path(__file__).with_name('balance-v2-approved.json'))['proposal']
        for co in combos:
            spec=next((s for s in approved['combos'] if s['name']==co['name']),None)
            if spec:
                cast_ids=list(dict.fromkeys(c for pid in spec['participants'] for c in (ids('주인공') if pid=='player' else (ids('젬짱') if pid=='gem' else [pid] if pid in cast else ids('JEPA' if pid=='jepa-help' else next(p['name'] for p in read_json(pack/refs['pilots']) if p['id']==pid))))))
                co['binding']={'ids':[spec['id'],{'context-horizon':'horizon','architecture-symphony':'symphony'}.get(spec['id'],spec['id'])], 'participants':cast_ids}
    archive={'format':1,'defaults':{'enemy':fallback},'combos':combos}
    game['battleDialogue']='battle-lines/combos.json'
    report={'sourceFiles':{f:hashlib.sha256((story/'carbon'/f).read_bytes()).hexdigest() for f in FILES},'characters':sum(not s['name'].startswith('합체기: ') and s['name']!='자코 공통' for s in source),'mappedCharacters':len(explicit),'castBanks':len(banks),'sourceLines':count,'comboCount':len(combos),'unboundFinishers':unbound,'storedCombos':[c['name'] for c in combos if not c.get('binding')],'expressionFallbacks':alias_report}
    from feedback_overlay import patch_cast
    patch_cast(cast)
    return {pack/'cast.json':cast,pack/'game.json':game,pack/'battle-lines/combos.json':archive,pack/'battle-lines/import-audit.json':report}

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
    output=generate()
    for path,value in output.items():
        if args.check:
            assert path.is_file() and read_json(path)==value,f'{path}: 원문 대사/연결 자료와 다름'
        else:
            path.parent.mkdir(parents=True,exist_ok=True)
            path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    r=list(output.values())[-1]
    print(f"전투 대사 {'원문 대조' if args.check else '이식'} 완료: {r['characters']} 인물, {r['sourceLines']} 원문 대사, 합체기 {r['comboCount']}종")
    print('미연결 필살기:',json.dumps(r['unboundFinishers'],ensure_ascii=False))

if __name__=='__main__':main()
