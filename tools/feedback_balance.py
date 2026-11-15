"""Small approved form changes, reapplied after the frozen proposal. No simulation."""
import copy,json,re
from pathlib import Path

def visible_text(text):
    if text=='나노':return '플래시'
    return text.replace('나노 바나나','플래시 바나나').replace("'나노'","'플래시'").replace('나노/프로','플래시/프로').replace('나노 블레이드','플래시 블레이드').replace('나노 모드','플래시 모드').replace('나노, 프로','플래시, 프로')

def visible_json(value):
    if isinstance(value,str):return visible_text(value)
    if isinstance(value,list):return [visible_json(v)for v in value]
    if isinstance(value,dict):return {('플래시'if k=='나노'else k):visible_json(v)for k,v in value.items()}
    return value

def patch(output,pack):
    read=lambda path:json.loads(path.read_text(encoding='utf-8-sig'))
    weapons=output[pack/'data/weapons.json'];mechs=output[pack/'data/mechs.json'];art=output[pack/'weapons.json'];units=read(pack/'units.json')
    weapons[:]=[w for w in weapons if not w['id'].startswith('feedback-')]
    mechs[:]=[m for m in mechs if not re.match(r'^(gem|qwen)-(flash|pro|ultra|axis|yandere|megadere)-generation-',m['id'])]
    wm={w['id']:w for w in weapons};mm={m['id']:m for m in mechs};derivatives={};modes={}
    for row in read(Path(__file__).with_name('feedback-critical.json')):
        if row['weapon']in wm:wm[row['weapon']]['crit']=row['base']+row['bonus']
    output[pack/'game.json']['battleRules']['meleeHitBonus']=10
    for family in ['gem','qwen']:
      for gen in range(1,5):
        base=mm.get(f'{family}-generation-{gen}')
        if not base:continue
        source=base['id'];ids=base['weapons'];normal=[wm[x]for x in ids if not wm[x].get('map')];melee=next((w for w in normal if w['kind']=='melee'),normal[0]);ranged=next((w for w in normal if w['kind']!='melee'),normal[0]);finish=wm.get(source+'-weapon-4',normal[-1]);cannon=wm.get(source+'-weapon-3',ranged)
        specs=[('flash','플래시',.8,-100,15,1,[ranged,melee]),('pro','프로',1,0,0,0,[melee,ranged,finish]),('ultra','울트라',1.25,0,-15,-1,[cannon,finish])]if family=='gem'else[('axis','악의축',1,0,15,1,[ranged]),('yandere','얀데레',1,0,0,0,[melee,finish]),('megadere','메가데레',1,0,0,0,[melee])]
        for mode,label,hp,armor,mobility,move,pool in specs:
          equipped=[]
          for i,original in enumerate(pool):
            w=copy.deepcopy(original);id=f'feedback-{family}-{gen}-{mode}-{i+1}';factor=.8 if mode in ['flash','axis']else .6 if mode=='megadere'else 1.05 if mode=='pro'and original['kind']=='melee'else 1.1 if mode in ['ultra','yandere']else 1
            w.update(id=id,power=round(original['power']*factor));w.pop('map',None)
            if mode=='flash':w.update(postMove=True,range=[1,4]if w['kind']!='melee'else[1,2]);w['en']=min(w.get('en',0),10)
            if mode=='pro':w['range']=[1,2]if w['kind']=='melee'else[2,4]
            if mode=='ultra':w.update(kind='shoot',range=[3,7],postMove=False,en=max(45,original.get('en',0)+15));w.pop('ammo',None)
            if family=='qwen'and mode in ['axis','megadere']:w.update(kind='shoot',range=[1,3],postMove=True)
            if mode=='yandere':w.update(kind='melee',range=[1,2],postMove=True,finisher=i==len(pool)-1)
            weapons.append(w);equipped.append(id);derivatives[id]={'source':original['id'],'factor':factor,'definition':copy.deepcopy(w)};art[id]={**copy.deepcopy(art.get(original['id'],{'anim':{'template':'heavy-shot'}})),'lineSource':original['id']}
            if mode=='yandere'and w.get('finisher'):art[id]['cutin']=True
          if mode=='megadere':
            id=f'feedback-qwen-{gen}-heal';w={**copy.deepcopy(ranged),'id':id,'name':'청화 치유','power':0,'kind':'shoot','en':20,'ammo':3,'range':[1,1],'postMove':True,'moraleReq':0,'finisher':False,'special':{'kind':'restore','label':'HP 회복','target':'allies','radius':1,'hpPct':10}};w.pop('map',None);weapons.append(w);wm[id]=w;equipped.append(id);art[id]={'anim':{'template':'heavy-shot'}}
          if family=='qwen'and mode=='axis':
            id=f'feedback-qwen-{gen}-axis-2';w={**copy.deepcopy(ranged),'id':id,'name':'오만한 영애의 구름걸음','power':0,'kind':'shoot','en':10,'ammo':2,'range':[1,1],'postMove':True,'moraleReq':0,'finisher':False,'special':{'kind':'status','target':'self','rounds':1,'cooldown':2,'label':'회피·이동 강화','atoms':[{'type':'evadeAdd','value':10},{'type':'moveAdd','value':1}]}};w.pop('map',None);weapons.append(w);wm[id]=w;equipped.append(id);art[id]={'anim':{'template':'heavy-shot'}}
          id=f'{family}-{mode}-generation-{gen}';m=copy.deepcopy(base);m.update(id=id,name=base['name']+' · '+label,hp=round(base['hp']*hp),armor=max(0,base['armor']+armor),mobility=base['mobility']+mobility,move=max(1,base['move']+move),weapons=equipped);m.pop('forms',None);m.pop('aiForm',None);m['allyStats']={k:copy.deepcopy(m[k])for k in ['hp','en','armor','mobility','move','weapons']};m['allyStats']['weaponPower']={w['id']:w['power']for w in weapons if w['id']in equipped};mechs.append(m);modes[id]={'source':source,'hp':hp,'armor':armor,'mobility':mobility,'move':move,'weapons':equipped}
          look=copy.deepcopy(units[source]);look.update(copy.deepcopy(look.get('tacticalForms',{}).get(label,look.get('tacticalForms',{}).get('나노',{})if mode=='flash'else{})));look.pop('forms',None);units[id]=visible_json(look)
    for stage in output[pack/'balance-stages.json'].values():
      mp=stage['content']['mechs'];wp=stage['content']['weapons']
      for id,spec in modes.items():
        base={**mm[spec['source']],**mp.get(spec['source'],{})};mp[id]={k:base[k]for k in ['hp','en','armor','mobility','move']};mp[id].update(hp=round(base['hp']*spec['hp']),armor=max(0,base['armor']+spec['armor']),mobility=base['mobility']+spec['mobility'],move=max(1,base['move']+spec['move']),weapons=spec['weapons'])
      for id,spec in derivatives.items():
        original={**wm[spec['source']],**wp.get(spec['source'],{})};wp[id]={**spec['definition'],'power':round(original['power']*spec['factor'])};wp[id].pop('id',None)
    for path,value in list(output.items()):
        if path.is_relative_to(pack):output[path]=visible_json(value)
    output[pack/'units.json']=visible_json(units)

    from port_qwen_modes import patch_weapons
    patch_weapons(output,pack)
