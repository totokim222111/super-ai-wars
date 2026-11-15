"""Apply the approved balance contract. Originals under story/source/studio are read-only.

Order: balance data -> carbon stage rules -> battle speech. --check is write-free.
An exported sample uses the bundled application-only approved contract.
"""
from __future__ import annotations
import argparse, copy, hashlib, json, os, re
from pathlib import Path
from paths import PACK_DIR, SAMPLE_ROOT, STUDIO_ROOT
from feedback_balance import visible_text
from port_enemy_weapon_names import contract as weapon_name_contract,patch_output
from balance_adjust import adjustments,adjusted,clean_name,upgrade_adjustments,upgrade_enemies,numeric_adjustments,ranged_adjustments,apply_ranged

KEYS='schemaVersion status economyPlans roles weapons mechs episodes rules inference supply awakening newParts combos ngPlus pilotSpiritOverrides existingSpiritOverrides resourceAbilities actionBudget ai enemyStageCurves eventAdapters phaseReinforcements deploymentOverrides compiledMechAliases naming'.split()
APPROVED=SAMPLE_ROOT/'tools/balance-v2-approved.json'
def read(path):return json.loads(path.read_text(encoding='utf-8-sig'))
def contract():
    source=Path(os.environ.get('BALANCE_V2_FILE',STUDIO_ROOT/'docs/studio/balance-v2/proposal.json'))
    if os.environ.get('BALANCE_V2_FILE') and not source.is_file():raise FileNotFoundError(source)
    if source.is_file():
        full=read(source);d={k:full[k] for k in KEYS};digest=hashlib.sha256(source.read_bytes()).hexdigest()
    else:
        saved=read(APPROVED);d=saved['proposal'];digest=saved['sourceSha256']
    if d['schemaVersion']!='balance-v2-final-1' or d['status']!='final-approved':raise ValueError('Approved final proposal required')
    return d,digest
def upsert(rows,row):
    old=next((r for r in rows if r['id']==row['id']),None)
    if old is None:rows.append(row)
    else:old.update(row)
def patch_weapon(row,patch):
    row.update(copy.deepcopy(patch))
    if row.get('ammo') is None:row.pop('ammo',None)
    if row['kind']!='map':row.pop('map',None)
def mech_patch(row):return {**row['base'],'weapons':row['weapons'],'enRecovery':{'pct':row.get('regenPct',0)*100}}
def generated(pack=PACK_DIR):
    original,digest=contract();saved=read(APPROVED)if APPROVED.is_file()else{};overlay,adjust_digest=adjustments(read,saved);enemy_upgrades=upgrade_adjustments(read,saved);numeric=numeric_adjustments(read,saved);d=adjusted(original,overlay);output={};get=lambda name:read(pack/name)
    game=get('game.json');refs=get('rules.json');weapons=get(refs['weapons']);mechs=get(refs['mechs']);pilots=get(refs['pilots']);spirits=get(refs['spirits']);skills=get(refs['skills']);parts=get(refs['parts']);economy=get('economy.json');training=get('training.json');tag=get(refs['tagEffects']);art=get('weapons.json')
    wm={w['id']:w for w in weapons};mm={m['id']:m for m in mechs};pm={p['id']:p for p in pilots}
    authored_names=weapon_name_contract()['names']
    for spec in d['weapons']:
        row=wm[spec['id']];assert visible_text(clean_name(row['name']))in {visible_text(clean_name(spec['name'])),authored_names.get(spec['id'])},spec['id'];row['name']=clean_name(spec['name']);patch_weapon(row,spec['new']);row['finisher']=spec['category']=='finisher'
    for spec in d['mechs']:
        if spec['id'] in mm:mm[spec['id']].update(mech_patch(spec))
    roles=d['roles']
    for p in pilots:
        role=roles.get('player-real' if p['id']=='player' else p['id'])
        p.pop('statCurves',None)
        if role:
            p['stats'].update(melee=role['melee'],shoot=role['shoot'],skill=role['inference']);p.setdefault('growth',{})['skill']=role['growth'];p['sp']=role['sp']
            refs_sp={r['id']:r['level'] for r in p.get('spirits',[]) if r['id']!='renew'}
            refs_sp.update(d['pilotSpiritOverrides']['allRegulars']);refs_sp.update(d['pilotSpiritOverrides'].get(p['id'],{}))
            if p['id'] in d['awakening']['learn']:refs_sp[d['awakening']['id']]=d['awakening']['learn'][p['id']]
            if p['id']=='sonnet':refs_sp[d['supply']['spirit']['id']]=d['supply']['spirit']['level']
            p['spirits']=[{'id':id,'level':level} for id,level in refs_sp.items()]
        else:p['stats']['skill']=d['inference']['enemy']['base'];p.setdefault('growth',{})['skill']=d['inference']['enemy']['growth']
    dot=d['supply']['dotts'];dot_id='dots' if 'dots'in pm else dot['id'];dot_p=pm[dot_id];dot_p.update(sp=dot['baseSP'],spGrowth=dot['spGrowth'],hostProgress=True,spirits=dot['spirits'])
    device=d['supply']['device'];repair=d['supply']['repair']
    for m in mechs:
        if m['id'].startswith('gpi-generation-'):m['subPilots']=[dot_id];m['cheerHp']=.3
        if m['id'].startswith('sonnet-generation-'):
            m['devices']=[{'id':'supply','name':'보급 장치','kind':'resupply','uses':device['uses'],'postMove':device['postMove'],'morale':device['targetMorale'],'experience':device['experience']},{'id':'repair','name':'수리 장치','kind':'repair','uses':None,'en':repair['enCost'],'postMove':repair['postMove'],'amount':{'pct':repair['hpPct']},'experience':repair['experience']}]
        if m['id'].startswith('player-super-generation-'):
            r=roles['player-super'];m['pilotOverrides']={'pilotId':'player','stats':{'melee':r['melee'],'shoot':r['shoot'],'skill':r['inference']},'growth':{'skill':r['growth']},'sp':r['sp']}
    for id,over in d['existingSpiritOverrides'].items():next(s for s in spirits if s['id']==id).update(over)
    sup=d['supply']['spirit'];upsert(spirits,{'id':sup['id'],'name':sup['name'],'sp':sup['sp'],'target':'ally','duration':'instant','effects':[{'type':'resupply'}],'experience':sup['experience'],'desc':'아군 1기의 VRAM과 잔탄을 전량 회복합니다. 사거리 제한 없음.'})
    awake=d['awakening'];upsert(spirits,{'id':awake['id'],'name':awake['name'],'sp':0,'spPct':awake['fraction']*100,'target':'self','duration':'instant','effects':[{'type':'extraAction'}],'desc':'첫 행동 전에 사용하여 이번 턴 행동을 1회 추가합니다. 턴당 한 번.'})
    for id,spec in d['inference']['procs'].items():
        sid='balance-'+id
        upsert(skills,{'id':sid,'name':spec['name'],'desc':spec['formula']+'% · '+spec['effect'],'effects':[],'activation':{'hook':spec['hook'],'base':spec['baseChance'],'baseline':spec['baselineInference'],'coefficient':spec['coefficient'],'min':spec['minChance'],'max':spec['maxChance'],'level':spec['learnLevel'],'morale':spec['morale'],'effects':spec['effects']}})
        p=pm[spec['pilot']];p['skills']=[r for r in p.get('skills',[]) if r['id']!=sid]+[{'id':sid}]
    for spec in d['newParts']:
        effect=spec.get('effect');effects=[{'type':'enRegen','value':{'pct':spec['regenPct']*100}}] if 'regenPct'in spec else [{'type':'enRestore','value':{'pct':100}}] if effect=='en-full' else [{'type':'ammoRestore'}] if effect=='ammo-full' else [{'type':'statAdd','value':effect['statAdd']}] if 'statAdd'in effect else [{'type':'hitAdd','value':effect['hitAdd']}]
        upsert(parts,{'id':spec['id'],'name':spec['name'],'kind':spec['kind'],'effects':effects,'desc':(f"매 턴 VRAM을 {spec['regenPct']*100:g}% 회복합니다." if 'regenPct'in spec else '사용하면 VRAM을 전량 회복합니다. 1회 소모.' if effect=='en-full' else '사용하면 모든 무장의 잔탄을 전량 회복합니다. 1회 소모.' if effect=='ammo-full' else f"모든 무장 위력 +{effect['statAdd']['weapons']} (개조 뒤 적용)." if 'statAdd'in effect else f"명중 +{effect['hitAdd']}."),'price':spec['price']})
        economy['items'][spec['id']]={'price':spec['price'],'fromEpisode':spec['fromEpisode']}
    for ep in d['episodes']:economy['income'][ep['stage']]=ep['income']
    ti=d['inference']['training'];training['stats']['skill']={'label':'추론','step':ti['step'],'costs':ti['firstCosts'],'fromEpisode':ti['fromEpisode']}
    tag=[{**e,'en':0} if e['kind']=='aura' else e for e in tag if e['kind']!='regeneration']
    up=d['rules']['upgrade'];xp=d['supply']['supportExperience'];crit=d['inference']['crit']
    game['battleRules']={'actions':d['nativeIntegration']['actions'] if 'nativeIntegration'in d else {'stat':'skill','threshold':d['actionBudget']['threshold'],'count':2,'extraMax':awake['maxUsesPerRound']},'critical':{'stat':'skill','coefficient':crit['coefficient'],'min':crit['floor'],'max':crit['cap']},'skillActivation':{'stat':'skill','coefficient':.2,'min':5,'max':35},'morale':d['rules']['morale'],'combatMoraleCap':d['rules']['combatMoraleCap'],'enRegenPerRound':d['rules']['enRegenPerRound'],'recoveryTiming':'phase','consumablePolicy':'consume','weaponUpgrade':{'mode':'percent','rate':up['coefficientPerStep']},'upgradeStep':up['otherStep'],'upgradeCost':up['otherStepPrices'],'upgradeMax':up['otherCap'],'upgradeLimits':{'weapons':{'max':up['normalWeaponCap'],'newGamePlusMax':up['ngPlusWeaponCap'],'costs':up['ngPlusStepPrices']}},'newGamePlus':{'carry':['credits' if k=='funds' else k for k in d['ngPlus']['carry']]},'supportExperience':{'levelGapBonus':xp['levelGapBonus'],'maxPerAction':xp['maxPerActionBase'],'minMissingEnPct':xp['minMissingEnPct'],'minMissingHpPct':xp['minMissingHpPct'],'maxPerStage':xp['maxPerStage'],'firstBonus':xp['firstEligibleActionBonus'],'levelCeiling':1,'regularPilots':['player','gpi','gem','claude','grok','deepseek']},'ai':{'resources':{'ammoBonus':d['ai']['ordinaryScore']['ammoUsefulFactor'],'reserveFinisher':True,'reservePenalty':.5,'finisherMorale':125,'utility':d['ai']['ordinaryScore'],'safeResponse':True,'enemyResponse':{'mode':'counter-first','defendHp':0,'evadeHp':0},'nearOptimal':d['ai']['nearOptimalTolerance'],'burst':{'base':1,'crowded':2,'eliteCount':4,'eliteMechs':sorted(set([m['id'] for m in d['mechs'] if m.get('grade') in ['mid','boss']]+[alias for alias,original in d['compiledMechAliases'].items() if any(m['id']==original and m.get('grade') in ['mid','boss'] for m in d['mechs'])]))},'positionPlan':True,'roundRobin':True,'supportPilots':['sonnet'],'supportUnits':['jepa-help']}}}
    game.setdefault('pilotCasts',{})['dots']='saw-dots';game['rules']={'spiritAfterAction':False};game.setdefault('unitInfo',{}).setdefault('stats',{})['skill']={'name':d['inference']['displayName'],'desc':'레벨·훈련으로 성장합니다. 추론 130 이상에서 2회 행동하며, 크리티컬·방어·확률 기술에 영향을 줍니다.'}
    game['battleRules']['newGamePlus']['enemyUpgradeOffsetPerCycle']=15
    game['battleRules']['retryOnDefeat']={'keep':['exp','credits']}
    game['battleRules']['enemyUpgrades']={'armorDivisor':2,'mobilityDivisor':2,'weaponDivisor':2}
    game['stageAdjustments']='balance-stages.json'
    game['battleRules']['deploymentUpgradeMax']=15
    game['stageRewards']={f"saw-{s['rewardAfterEpisode']:02}":{} for s in d['newParts'] if 'rewardAfterEpisode'in s}
    for s in d['newParts']:
        if 'rewardAfterEpisode'in s:game['stageRewards'][f"saw-{s['rewardAfterEpisode']:02}"][s['id']]=s.get('rewardQuantity',1)
    for ep in game['episodes']:ep['minimumLevel']=next(e['expectedLevel'] for e in d['episodes'] if e['episode']==ep['id'])
    for co in d['combos']:
        id='balance-combo-'+co['id'];upsert(weapons,{'id':id,'name':co['name'],'power':0,'kind':co['kind'],'range':co['range'],'hit':co['hit'],'crit':co['crit'],'adapt':co['adapt'],'en':co['enEach'],'postMove':co['postMove'],'moraleReq':co['morale'],'finisher':False})
        art[id]={'anim':{'template':'finisher'},'cutin':True}
    stages={}
    for ep in d['episodes']:
        n=int(ep['episode'][2:]);stage=ep['stage'];curves=d['enemyStageCurves'].get(str(n),{});mp={id:mech_patch(r) for id,r in curves.items() if id in mm};wp={}
        for r in curves.values():
            for id,definition in r.get('weaponDefinitions',{}).items():wp[id]=copy.deepcopy(definition)
            for id,power in r.get('weaponPowers',{}).items():wp.setdefault(id,{})['power']=power
        # Null ammo is a declared removal. stageContent handles it without flattening another episode.
        definitions=ep['definitions'];units={}
        for u in definitions:
            id=u['id'];origin=d['compiledMechAliases'].get(u['mechId'],u['mechId']);r=curves.get(u['mechId'],curves.get(origin,{}))
            over={'level':ep['expectedLevel']}
            if u['side']=='enemy':
                value=r.get('initialInference',130 if r.get('grade')=='boss' and n>=13 or n>=9 and u['pilotId']in d['inference']['enemy']['namedPilots'] else 90+.6*(ep['expectedLevel']-1))
                over.update(upgrades={k:0 for k in ['hp','en','armor','mobility','weapons']},pilotOverrides={'stats':{'skill':value},'growth':{'skill':0},**({'clearOnJoin':True} if u['id']==u['pilotId'] and u['pilotId']in roles else {})})
            if r.get('ai'):over['ai']=r['ai']
            over.update(d['deploymentOverrides'].get(str(n),{}).get(id,{}));units[id]=over
        if n==14:units['jepa-help']['pilotOverrides']={'startMorale':d['eventAdapters']['14']['jepaSupportArrivalMorale']}
        r_units={}
        if n==12:
            adapter=d['eventAdapters']['12'];r_units['jepa']={'barrier':100,'breakBy':'horizon','barrierStates':{'active':[{'type':'pilotStatSet','value':{'skill':adapter['beforeBarrierInference']}},{'type':'damageMul','value':adapter['beforeBarrierDamageMultiplier']}],'inactive':[{'type':'pilotStatSet','value':{'skill':adapter['afterBarrierInference']}}]}}
        if n==11:r_units['jepa-shield']={'barrier':90}
        combos=[];available={u['id'] for u in definitions}
        for co in d['combos']:
            if not set(co['participants'])<=available:continue
            if 'episode'in co['unlock'] and co['unlock']['episode']!=n:continue
            local={'context-horizon':'horizon','architecture-symphony':'symphony'}.get(co['id'],co['id']);unlock=co['unlock'];flag=''
            extra={}
            if 'affinity'in unlock:flag='affection:'+co['participants'][1];extra['affection']={'id':co['participants'][1],'min':unlock['affinity']}
            elif co['id']=='context-horizon':flag='세계언어공명'
            elif co['id']=='architecture-symphony':flag='심포니해금';extra['virtualParticipants']=['jepa-help']
            else:flag='balance:joined:'+str(unlock['joined']);extra['joined']=unlock['joined']
            combos.append({'id':local,'name':co['name'],'lead':co['participants'][0],'partner':co['participants'][1],'participants':co['participants'],'weapon':'balance-combo-'+co['id'],'virtual':f'v2-combo-{stage}-{local}','line':'','flag':flag,'costs':[co['enEach']]*len(co['participants']),'morale':co['morale'],'postMove':co['postMove'],'powerMultiplier':co['powerMultiplier'],**extra})
        transitions=[]
        for i,t in enumerate(d['phaseReinforcements'].get(str(n),[])):
            spawns=copy.deepcopy(t['units'])
            for u in spawns:
                u['pilotOverrides']={'stats':{'skill':curves.get(u['mechId'],{}).get('initialInference',90+.6*(ep['expectedLevel']-1))},'growth':{'skill':0}}
            tr={'id':t['trigger'],'spawns':spawns}
            if t['trigger']=='barrier-break':tr['barrierBroken']='pico-shell'
            elif t['trigger']=='abyss-half':tr['form']={'unit':'pico','id':'abyss','hpPct':50}
            transitions.append(tr)
        upgraded=[{**u,**units[u['id']]} for u in definitions];upgrade_enemies(upgraded,n,enemy_upgrades)
        for u in upgraded:
            if u['side']=='enemy':units[u['id']]['upgrades']=u['upgrades']
        for tr in transitions:upgrade_enemies(tr['spawns'],n,enemy_upgrades)
        stages[stage]={'enemyUpgradeLevel':n,'content':{'mechs':mp,'weapons':wp},'units':units,'rules':{'combos':combos,'units':r_units,'transitions':transitions},'aliases':d['compiledMechAliases']}
        # Later approved changes are applied after proposal + adjust-1 + adjust-2.
        income=numeric['economy']['income'][stage];economy['income'][stage]={k:copy.deepcopy(v)for k,v in income.items()if k!='reason'}
        for id,patch in numeric['economy']['mechCredits'][stage].items():mp.setdefault(id,{})['credits']=patch['value']
        reference=numeric['pilotBalance']['baselines'][stage];targets=numeric['pilotBalance']['targets'][stage]
        scaling={'baseline':{k:copy.deepcopy(reference[k])for k in ['level','stats']},'units':{id:{k:row[k]for k in ['ratio','actionCap']if k in row}for id,row in targets.items()},'newGamePlusReference':'allied-mean','referencePilots':['player','gpi','gem','claude','grok','deepseek','qwen','sonnet','exaone']}
        stages[stage]['enemyPilotScaling']=scaling
        for id,rule in r_units.items():
            if id in targets and 'barrierStates'in rule:
                for state,atoms in rule['barrierStates'].items():rule['barrierStates'][state]=[a for a in atoms if a['type']!='pilotStatSet']
        def pilot_balance(id,patch):
            if id not in targets:return
            target=targets[id];stats={k:int(v*target['ratio']+.5)for k,v in reference['stats'].items()}
            patch['level']=max(1,int(reference['level']*target['ratio']+.5));old=patch.get('pilotOverrides',{});patch['pilotOverrides']={**old,'stats':stats,'growth':{k:0 for k in stats}}
        for id,patch in units.items():pilot_balance(id,patch)
        for tr in transitions:
            for spawn in tr['spawns']:pilot_balance(spawn['id'],spawn)

    for rows in [weapons,mechs,pilots,spirits,skills,parts]:
        for row in rows:
            if isinstance(row.get('name'),str):row['name']=clean_name(row['name'])
    refs['version']='saw-balance-v2-final-1'
    for name,data in [(refs['weapons'],weapons),(refs['mechs'],mechs),(refs['pilots'],pilots),(refs['spirits'],spirits),(refs['skills'],skills),(refs['parts'],parts),(refs['tagEffects'],tag),('game.json',game),('rules.json',refs),('economy.json',economy),('training.json',training),('weapons.json',art),('balance-stages.json',stages)]:output[pack/name]=data
    output[APPROVED]={'sourceSha256':digest,'proposal':original,'adjustments':overlay,'adjustmentSha256':adjust_digest,'enemyUpgrades':enemy_upgrades,'numericAdjustments':numeric}
    patch_output(output,pack)
    from feedback_overlay import patch_output as feedback
    feedback(output,pack)
    ranged=ranged_adjustments(read,saved)
    apply_ranged(output,pack,ranged)
    output[APPROVED]['rangedAdjustments']=ranged
    from hit_adjust import contract as hit_contract,patch as hit_patch
    hit=hit_contract(read,saved);hit_patch(output,pack,hit)
    output[APPROVED]['hitAdjustments']=hit
    return output

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args();output=generated();different=[]
    for path,value in output.items():
        if args.check:
            if not path.is_file() or read(path)!=value:different.append(str(path))
        else:path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    if different:raise SystemExit('balance v2 mismatch: '+', '.join(different))
    print('밸런스 v2 '+('수치 대조' if args.check else '적용')+' 완료: '+str(len(output))+' 파일')
if __name__=='__main__':main()
