"""Read-only, bounded overlay after the immutable approved proposal."""
import copy,hashlib,os,re
from pathlib import Path
from paths import STUDIO_ROOT

def clean_name(value):return re.sub(r'\s*\(가칭\)\s*$','',value)

def upgrade_adjustments(read,saved):
    path=Path(os.environ.get('ENEMY_UPGRADE_FILE',STUDIO_ROOT/'docs/studio/balance-adjust/adjust-2.json'))
    if os.environ.get('ENEMY_UPGRADE_FILE')and not path.is_file():raise FileNotFoundError(path)
    if path.is_file():value=read(path)
    else:value=saved.get('enemyUpgrades')
    if not value or value.get('schemaVersion')!='enemy-upgrades-3' or set(value)!={'schemaVersion','policy','episodes'}:raise ValueError('enemy upgrade contract missing/invalid')
    policy=value['policy']
    if set(policy)!={'weaponDivisor','armorMobilityDivisor','lateHpEnReduction'} or (policy['weaponDivisor'],policy['armorMobilityDivisor'],policy['lateHpEnReduction'])not in [(2,2,0)]:raise ValueError('unapproved enemy upgrade policy')
    rows=value['episodes']
    if sorted(r['episode'] for r in rows)!=list(range(1,16)):raise ValueError('exactly 15 episode upgrade rows required')
    for row in rows:
        n=row['episode'];hp=n-(policy['lateHpEnReduction']if n>=8 else 0)
        expected={'hp':hp,'en':hp,'armor':n//policy['armorMobilityDivisor'],'mobility':n//policy['armorMobilityDivisor'],'weapons':n//policy['weaponDivisor']}
        if set(row)!={'episode','levels'} or set(row['levels'])!=set(expected):raise ValueError('five enemy upgrade levels required')
        for key,target in expected.items():
            field=row['levels'][key]
            if set(field)!={'value','reason'}or isinstance(field['value'],bool)or field['value']!=target or not field['reason'].strip():raise ValueError('enemy upgrade level differs from approved policy')
    return value

def upgrade_enemies(units,episode,overlay):
    levels=next({k:v['value']for k,v in r['levels'].items()}for r in overlay['episodes'] if r['episode']==episode)
    for u in units:
        if u['side']=='enemy':u['upgrades']=dict(levels)

def adjustments(read,saved):
    path=Path(os.environ.get('BALANCE_ADJUST_FILE',STUDIO_ROOT/'docs/studio/balance-adjust/adjust-1.json'))
    if os.environ.get('BALANCE_ADJUST_FILE')and not path.is_file():raise FileNotFoundError(path)
    if path.is_file():return read(path),hashlib.sha256(path.read_bytes()).hexdigest()
    if 'adjustments'not in saved:raise ValueError('balance adjustment contract missing')
    return saved['adjustments'],saved['adjustmentSha256']

def adjusted(proposal,overlay):
    d=copy.deepcopy(proposal)
    if overlay.get('schemaVersion')!='balance-adjust-1' or overlay.get('round')not in [1,2]:raise ValueError('invalid adjustment schema/round')
    if set(overlay)-{'schemaVersion','round','bossHp','weapons'}:raise ValueError('unknown adjustment category')
    wm={w['id']:w for w in d['weapons']};original_wm={w['id']:w for w in proposal['weapons']};seen=set()
    for row in overlay['weapons']:
        wid=row['id'];base=wm[wid]
        if wid in seen or set(row)-{'id','power','rangeMax','moraleReq'}:raise ValueError('duplicate/forbidden weapon field')
        seen.add(wid)
        if 'power'in row and 'rangeMax'in row:raise ValueError('choose power OR range')
        for key,patch in row.items():
            if key=='id':continue
            value=patch['value']
            if not isinstance(value,int)or isinstance(value,bool)or not patch.get('reason','').strip():raise ValueError('integer and per-field reason required')
            if key=='power':
                ref=original_wm[patch['reference']]
                if ref['owner']!=base['owner']or ref['id']==wid or ref['category']in ['map','finisher']or not original_wm[wid]['new']['power']<=value<=ref['new']['power']:raise ValueError('alternative power exceeds main weapon')
                d['weapons'][d['weapons'].index(base)]['new']['power']=value
            elif key=='rangeMax':
                if value!=base['new']['range'][1]+1:raise ValueError('range must be +1')
                base['new']['range'][1]=value
            elif key=='moraleReq':
                if base['category']!='finisher'or proposal['weapons'][d['weapons'].index(base)]['new'].get('moraleReq')!=125 or not 115<=value<=125:raise ValueError('finisher heat outside approved bounds')
                base['new']['moraleReq']=value
    seen=set()
    for row in overlay['bossHp']:
        episode=str(row['episode']);mid=row['id'];value=row['hp']['value'];curves=d['enemyStageCurves'][episode];original=proposal['enemyStageCurves'][episode][mid];key=(episode,mid)
        if key in seen or set(row)!={'episode','id','hp'}or original['grade']not in ['mid','boss']or not isinstance(value,int)or isinstance(value,bool)or not original['base']['hp']<=value<=original['base']['hp']*1.5 or not row['hp'].get('reason','').strip():raise ValueError('boss HP outside approved bounds')
        seen.add(key);canonical=d['compiledMechAliases'].get(mid,mid)
        # Canonical stats feed generated armed/form aliases. Keep the override stage-local.
        for target in {mid,canonical}:
            if target not in curves:
                canonical_base=next(m for m in proposal['mechs']if m['id']==target)
                curves[target]=copy.deepcopy(canonical_base)
                # The new canonical row owns HP only; its other stats stay at the old canonical defaults.
                # Alias weapon curves were already present and must not be overwritten by this addition.
                curves[target].pop('weaponPowers',None);curves[target].pop('weaponDefinitions',None)
            curves[target]['base']['hp']=value
    return d


def numeric_adjustments(read,saved):
    """Public snapshots preserve the exact later numeric overlay without studio sources."""
    path=Path(os.environ.get('BALANCE_NUMERIC_FILE',STUDIO_ROOT/'docs/studio/balance-adjust/adjust-3.json'))
    if os.environ.get('BALANCE_NUMERIC_FILE')and not path.is_file():raise FileNotFoundError(path)
    value=read(path)if path.is_file()else saved.get('numericAdjustments')
    if not value or value.get('schemaVersion')!='balance-adjust-3':raise ValueError('numeric adjustment contract missing')
    economy=value['economy'];pilots=value['pilotBalance']
    if economy['multiplier']['value']<=0 or not economy['multiplier']['reason'].strip():raise ValueError('invalid economy multiplier')
    for sid,row in economy['income'].items():
        if not row.get('reason')or any(not isinstance(row[k],int)or row[k]<0 for k in ['clear','defeat']):raise ValueError('invalid ordinary clear income')
        if any(not isinstance(n,int)or n<0 for n in row.get('rosterClear',{}).values()):raise ValueError('invalid roster clear income')
    for rows in economy['mechCredits'].values():
        for row in rows.values():
            if not isinstance(row['value'],int)or row['value']<0 or not row['reason'].strip():raise ValueError('invalid defeat credit amount')
    for sid,base in pilots['baselines'].items():
        if not 1<=base['level']<=99 or set(base['stats'])!={'melee','shoot','hit','evade','skill','defense'}or any(n<0 for n in base['stats'].values())or not base['reason']:raise ValueError('invalid pilot reference')
        for row in pilots['targets'][sid].values():
            lo,hi={'grunt':(.7,.9),'boss':(.9,1.),'final':(1.2,1.2)}[row['category']]
            if not lo<=row['ratio']<=hi or not row['reason']or row['category']=='grunt'and row.get('actionCap')!=1:raise ValueError('pilot ratio or action policy differs')
    return value


def ranged_adjustments(read,saved):
    """Approved Titan counterattack overlay; public copies use the bundled contract."""
    path=STUDIO_ROOT/'docs/studio/balance-adjust/adjust-4.json'
    value=read(path)if path.is_file()else saved.get('rangedAdjustments')
    if not value or value.get('schemaVersion')!='balance-adjust-4' or set(value)!={'schemaVersion','weapons'}:raise ValueError('ranged adjustment contract missing/invalid')
    rows=value['weapons']
    if [r['id']for r in rows]!=[f'player-super-generation-{n}-weapon-2'for n in [1,2,3]]:raise ValueError('exactly three Titan weapons required')
    for row,power in zip(rows,[2000,2500,3100]):
        expected={'power':power,'range':[1,7],'ammo':40,'en':0,'postMove':False}
        if set(row)!={'id',*expected}:raise ValueError('unexpected ranged adjustment field')
        for key,target in expected.items():
            field=row[key]
            if set(field)!={'value','reason'} or type(field['value'])is not type(target) or field['value']!=target or not field['reason'].strip():raise ValueError('ranged adjustment differs from approved values')
    return value


def apply_ranged(output,pack,overlay):
    for patch in overlay['weapons']:
        row=next(w for w in output[pack/'data/weapons.json']if w['id']==patch['id'])
        row.update({k:copy.deepcopy(v['value'])for k,v in patch.items()if k!='id'})
        # A future stage-specific copy must not restore the old short-range values.
        for stage in output[pack/'balance-stages.json'].values():
            local=stage['content']['weapons'].get(patch['id'])
            if local is not None:local.update({k:copy.deepcopy(v['value'])for k,v in patch.items()if k!='id'})
