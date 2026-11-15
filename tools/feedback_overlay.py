"""Approved presentation/feedback layer, after Carbon and balance-v2 generation.
Manuscripts and the frozen proposal are never modified.
"""
VIDEOS=['opening','combo-context-horizon','combo-omni-prompt-drive','combo-architecture-symphony','pre-finale']
VIDEO_WEAPONS={'balance-combo-context-horizon':'combo-context-horizon','balance-combo-user-gpi':'combo-omni-prompt-drive','balance-combo-architecture-symphony':'combo-architecture-symphony'}

def story_overlay(ep,text):
    if ep==15 and '[영상] pre-finale' not in text:
        text=text.replace('@ 도입\n','@ 도입\n[영상] pre-finale\n',1)
    if ep==4:
        text=text.replace('[맵] 합류 grok\n[변수] 그록합류 = 1\n','')
        text=text.replace('// 적 그록짱이 즉시 아군 소속으로 전환되며 보너스 크레딧 획득','[변수] 그록내기승리 = 1\n[맵] 합류 grok\n[변수] 그록합류 = 1\n// 적 그록짱이 즉시 아군 소속으로 전환되며 보너스 크레딧 획득',1)
        text=text.replace('@ 승리\n','@ 승리\n[합류] grok\n',1)
    from feedback_balance import visible_text
    import re
    def forms(match):
        unit,family,gen=match[1],match[2],match[3]
        modes=[('플래시','flash'),('프로','pro'),('울트라','ultra')]if family=='gem'else[('악의축','axis'),('얀데레','yandere'),('메가데레','megadere')]
        return '형태 '+unit+' = '+' / '.join(f'{label}:{family}-{mode}-generation-{gen}'for label,mode in modes)+('\n변형 이동전 '+unit if family=='gem'else'')
    text=re.sub(r'형태 (gem|qwen(?:-rival)?) = [^:\n]+:(gem|qwen)-generation-(\d+)[^\n]*',forms,text)
    text=text.replace('형태효과 gem 나노:','형태효과 gem 플래시:')
    return visible_text(text)

def patch_output(output,pack):
    game=output[pack/'game.json'];game['cinematics']={'enabled':True,'opening':{'id':'opening','when':'title'},'videos':{id:{'file':'video/'+id+'.mp4','fallback':'video-'+id,'seconds':1.5,'music':'duck'if id.startswith('combo-')else'mute'}for id in VIDEOS}}
    for weapon,video in VIDEO_WEAPONS.items():output[pack/'weapons.json'][weapon]['video']=video
    feedback_rules(output,pack)
    from feedback_balance import patch
    patch(output,pack)


def patch_cast(cast):
    from port_qwen_modes import patch_cast as qwen_cast
    qwen_cast(cast)
    import json
    from pathlib import Path
    for id,frames in json.loads(Path(__file__).with_name('portrait-frames.json').read_text(encoding='utf-8')).items():
        cast[id]['framingByArt']=frames
        if cast[id].get('bust')in frames:cast[id]['framing']=frames[cast[id]['bust']]


def feedback_rules(output,pack):
    game=output[pack/'game.json'];game['recruitment']={'saw-03':[{'unit':'claude','afterClear':True,'flag':'클로드합류'}],'saw-04':[{'unit':'grok','afterClear':True,'flag':'그록합류'}]}
    import json
    from pathlib import Path
    game['art']['focus']=json.loads(Path(__file__).with_name('cg-focus.json').read_text(encoding='utf-8'))
    for row,point in zip(game.get('loadingScreens',[]),[[.70,.23],[.65,.23],[.68,.24],[.74,.20],[.70,.28],[.70,.27],[.70,.28],[.73,.28]]):row['focus']=point
    output[pack/'training.json']['clearReward']=100
    import re
    for m in output[pack/'data/mechs.json']:
        if re.fullmatch(r'(gpi|gem|claude|grok|deepseek|qwen|sonnet|exaone)-generation-[1-4]',m['id']):
            m['allyStats']={k:m[k]for k in ['hp','en','armor','mobility','move','weapons']}
            m['allyStats']['weaponPower']={w['id']:w['power']for w in output[pack/'data/weapons.json']if w['id']in m['weapons']}
