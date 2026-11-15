"""Approved deterministic hit modifiers, after all authored weapon/form overlays."""
import copy
from pathlib import Path
from paths import STUDIO_ROOT

def contract(read,saved):
    path=STUDIO_ROOT/'docs/studio/balance-adjust/adjust-5.json'
    d=read(path)if path.is_file()else saved.get('hitAdjustments')
    if not d or d.get('schemaVersion')!='balance-adjust-5':raise ValueError('hit adjustment contract missing')
    if [d['melee'][k]for k in ['free','resource','strongest']]!=[15,20,25]or [(r['maxMorale'],r['hit'])for r in d['finisher']['bands']]!=[(105,20),(115,30),(125,40),(None,50)]or d['finisher']['finalBossHit']!=50 or d['ordinaryRanged']['keep']is not True:raise ValueError('unapproved hit policy')
    return d

def modifiers(weapons,mechs,rules):
    wm={w['id']:w for w in weapons};strongest=set();final=set()
    for m in mechs:
        melee=[wm[id]for id in m['weapons']if id in wm and wm[id]['kind']=='melee'and not wm[id].get('finisher')]
        if melee:
            power=max(w['power']for w in melee);strongest.update(w['id']for w in melee if w['power']==power)
        if m['id']in rules['finisher']['finalBossMechs']:final.update(m['weapons'])
    result={}
    for w in weapons:
        if w.get('finisher'):
            result[w['id']]=rules['finisher']['finalBossHit']if w['id']in final else next(r['hit']for r in rules['finisher']['bands']if r['maxMorale']is None or (w.get('moraleReq')or 0)<=r['maxMorale'])
        elif w['kind']=='melee':result[w['id']]=rules['melee']['strongest']if w['id']in strongest else rules['melee']['resource']if w.get('en',0)>0 or w.get('ammo')is not None else rules['melee']['free']
    return result

def patch(output,pack,rules):
    weapons=output[pack/'data/weapons.json'];mechs=output[pack/'data/mechs.json'];base=modifiers(weapons,mechs,rules)
    for w in weapons:
        if w['id']in base:w['hit']=base[w['id']]
    output[pack/'game.json']['battleRules']['meleeHitBonus']=0
    for stage in output[pack/'balance-stages.json'].values():
        local=stage['content'];wp=local['weapons'];mp=local['mechs']
        ws=[{**w,**copy.deepcopy(wp.get(w['id'],{}))}for w in weapons];ms=[{**m,**copy.deepcopy(mp.get(m['id'],{}))}for m in mechs]
        for id,hit in modifiers(ws,ms,rules).items():
            if id in wp or hit!=base.get(id):wp.setdefault(id,{})['hit']=hit
