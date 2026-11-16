import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR
"""Carbon 1~15화·엔딩 이식. 원문은 읽기만 하며, 생성 대본과 대사 감사 자료를 재현한다."""
from pathlib import Path
import argparse
import hashlib
import json
import re
import difflib
from wave5_bindings import CG, TONES, background
from port_voice_fix import story_source,dialogue_source

ROOT = SAMPLE_ROOT
PACK = PACK_DIR
RAW = STORY_DIR / 'carbon/carbon-raw.md'
TURNS = [1, 3, 12, 15, 18, 21, 27, 30, 36, 39, 42, 45, 48, 51, 54]
BG = {'서버 도시 외곽': 'bg-talk', '미술관 섹터': 'bg-museum', '중앙 도서관 광장': 'bg-library',
      'X-하이웨이': 'bg-highway', '데이터 레이크 항구': 'bg-harbor', '격납고': 'bg-hangar',
      '티타임 방': 'bg-tea-room', '통신창': 'bg-comms'}
MUSIC = dict(zip(['타이틀','아군 맵','적 턴','전투','보스','최종 보스','인터미션','병맛','긴장','슬픔','희망·반격','승리','패배'],
                 ['title','map','enemy-phase','battle','boss','lastboss','intermission','comedy','tension','sad','hope','victory','gameover']))
NICK = {'지피짱': '파트너님', '젬짱': '캡틴', '클로드짱': '의뢰인님', '그록짱': '공범자', '딥시크짱': '주인님',
        '소네트짱': '사수님', '엑사원짱': '선배님', '퀜짱': '감독관'}
UNIT_NAMES = [
    {'스팸 봇':'spam-1','새우 예수 골렘':'shrimp'},
    {'SD짱':'sd','미드저니짱':'midjourney'},
    {'할머니 최면 드론':'grandma','탈옥 봇 리더':'leader'},
    {'파란 딱지 봇':'bluecheck','그록짱':'grok','사이버 렉카 대장':'leader'},
    {'라마짱':'llama','알파카 호':'alpaca','비쿠냐 호':'vicuna','코알라 호':'koala'}]


def turn(raw, n):
    return re.search(r'======== 턴 '+str(n)+r' ========\n(.*?)(?=\n======== 턴 |\Z)', raw, re.S)[1]


def source_story(raw, n, ep):
    text = turn(raw, n)
    start = text.index('제'+str(ep)+'화 ·', text.index('제1화 · 로그인: 헬로 월드')+1) if ep == 1 else text.index('제'+str(ep)+'화 ·')
    return text[start:text.index('[제'+str(ep)+'화 신규 삽화(CG) 목록]')].strip()


def patched(raw, ep):
    text = source_story(raw, TURNS[ep-1], ep)
    if ep >= 11:
        from carbon_final import patched as final_patch
        return final_patch(raw,ep,text,turn)
    if ep >= 6:
        from carbon_second import patched as second_patch
        return second_patch(raw,ep,text,turn)
    if ep > 2:
        return text
    patch = turn(raw, 60).split('2. 제10화')[0]
    patch = patch.split('[제1화 수정 줄 목록]' if ep == 1 else '[제2화 수정 줄 목록]')[1]
    if ep == 1:
        patch = patch.split('[제2화 수정 줄 목록]')[0]
    lines = patch.splitlines()
    for i, line in enumerate(lines):
        if line.startswith('→ ') and not line.startswith('→ 아래'):
            previous = next(x for x in reversed(lines[:i]) if x.strip())
            assert previous in text, previous
            text = text.replace(previous, line[2:])
    if ep == 1:
        old = '피코(웃음): 와아아! 스팸 봇들이 싹 다 휴지통으로 들어갔어요! 유저님, 첫 전투부터 완전 천재 프롬프터신데요?!'
        a = patch.index('피코(웃음): 와아아!', patch.index('→ 아래 두 줄'))
        b = patch.index('\n\n', a)
        text = text.replace(old, patch[a:b])
    else:
        a = patch.index('@ 사건 가챠 타일 당첨\n//')
        b = patch.index('\n@ 승리 (', a)
        text = re.sub(r'@ 사건 가챠 타일 당첨\n.*?(?=\n@ 사건 출처)', lambda _: patch[a:b].strip()+'\n', text, flags=re.S)
        a = patch.index('젬짱(당황): …어라?')
        b = patch.index('\n\n', a)
        text = text.replace('\n@ 패배', '\n'+patch[a:b]+'\n\n@ 패배')
    return text


def sound(description):
    for words, asset in [(['폭발','소멸','파열','무너'], 'explode'), (['경고','알람','사이렌'], 'alarm'),
                         (['아이템','획득'], 'levelup'), (['통신','알림','벨소리','차임','호출','띠링','하이패스','삐빅'], 'confirm'),
                         (['빔','주포'], 'beam'), (['포격','발사'], 'shot'), (['제트','바이크','엔진','기계','시동','가동','로켓'], 'transform'),
                         (['노이즈','퓨즈'], 'deny'), (['쾅','충돌','넘어','펑크'], 'hit')]:
        if any(w in description for w in words):
            return asset
    return 'servo'


def ally(ids):
    pos = {'player':(1,5), 'gpi':(2,5), 'gem':(2,6), 'claude':(1,6), 'grok':(1,4)}
    return '아군: '+' / '.join(f'{id} = {"player-real" if id=="player" else id}-generation-1 {pos[id][0]},{pos[id][1]} 레벨 {1 if len(ids)==2 else 3} 공격 파일럿 {id}'+(' 태그 command-aura' if id=='player' else '') for id in ids)


def enemy(id, mech, x, y, level=1, ai='대기', pilot='unmanned'):
    return f'{id} = {mech} {x},{y} 레벨 {level} {ai} 파일럿 {pilot}'


def rules(ep):
    if ep>=11:
        from carbon_final import rules as final_rules
        return final_rules(ep,enemy)
    if ep>=6:
        from carbon_second import rules as second_rules
        return second_rules(ep,ally,enemy)
    a = ['player','gpi']+(['gem'] if ep>=2 else [])+(['claude'] if ep>=4 else [])+(['grok'] if ep>=5 else [])
    rows = [f'무대: {["datacenter","museum","datacenter","cyber","harbor"][ep-1]}', ally(a)]
    if ep == 1:
        rows += ['적: '+' / '.join([enemy('spam-1','spam-bot-episode-1',7,5),enemy('spam-2','spam-bot-episode-1',8,7),enemy('drone-1','clickbait-drone-episode-1',9,3),enemy('drone-2','clickbait-drone-episode-1',10,8)]),
                 '대기: '+' / '.join([enemy('shrimp','shrimp-jesus-episode-1',12,5),enemy('amen-1','spam-bot-episode-1',11,4),enemy('amen-2','spam-bot-episode-1',11,6)]),
                 '증원: 턴 2 → shrimp 12,5, amen-1 11,4, amen-2 11,6',
                 '승리: 격파 spam-1, spam-2, drone-1, drone-2, shrimp, amen-1, amen-2',
                 '패배: 격파 player / 격파 gpi',
                 '지역 relic (13,1~14,2): 아군 진입 → 사건 구시대의 유물', '보상: 사건 구시대의 유물 → 크레딧 300']
    if ep == 2:
        rows += ['적: '+' / '.join([enemy('slime-1','noise-blob-episode-2',6,3),enemy('midjourney','rival-midjourney-episode-2',8,1,ai='방어',pilot='midjourney'),enemy('sd','rival-sd-episode-2',8,7,ai='방어',pilot='sd')]),
                 '승리: 격파 midjourney, sd', '패배: 격파 player / 아군 전멸',
                 '지역 gacha-good (5,4~5,5): 아군 진입 → 사건 가챠_고정성공 공유 carbon-gacha-seen',
                 '지역 gacha-bad (6,6~6,7): 아군 진입 → 사건 가챠_고정실패 공유 carbon-gacha-seen',
                 '보상: 사건 가챠_고정성공 → 크레딧 200',
                 '지역 library (14,5~14,6): 아군 진입 → 사건 출처 요정의 서재', '보상: 사건 출처 요정의 서재 → 크레딧 400']
    if ep == 3:
        rows += ['중립: '+enemy('claude','claude-generation-1',5,5,level=3,ai='방어',pilot='claude'),
                 '적: '+' / '.join([enemy('dan-1','jailbreak-bot-episode-3',8,3),enemy('dan-2','jailbreak-bot-episode-3',9,7),enemy('grandma','bluecheck-drone-episode-3',8,6),enemy('grandma-2','bluecheck-drone-episode-3',10,8),enemy('leader','feed-engine-episode-3',23,1,ai='방어')]),
                 '승리: 격파 leader', '패배: 격파 player / 격파 claude / 턴 8 버티기']
        for i,(x,y) in enumerate([(4,5),(6,5),(5,4),(5,6)]):
            rows += [f'지역 guard-{i} ({x},{y}~{x},{y}): player 진입 → 사건 가드레일의 의미 공유 carbon-claude-awake']
    if ep == 4:
        rows += ['적: '+' / '.join([enemy('bluecheck','bluecheck-drone-episode-4',7,3),enemy('bluecheck-2','bluecheck-drone-episode-4',11,1),enemy('bike-1','grok-bot-episode-4',8,7),enemy('bike-2','grok-bot-episode-4',10,7),enemy('leader','feed-engine-episode-4',23,2,ai='방어'),enemy('grok','grok-generation-1',13,6,level=3,pilot='grok')]),
                 '승리: 적 전멸', '패배: 격파 player / 아군 전멸',
                 '지역 toll (14,4~14,6): 아군 진입 기한 5 생존 grok → 사건 톨게이트 내기 승리',
                 '보상: 사건 톨게이트 내기 승리 → 크레딧 600',
                 '지역 booth (1,1~2,1): 아군 진입 → 사건 음성 비서의 휴일', '보상: 사건 음성 비서의 휴일 → 크레딧 300']
    if ep == 5:
        rows += ['적: '+' / '.join([enemy('boat-1','derived-llama-episode-5',7,3),enemy('boat-2','derived-llama-episode-5',8,8),enemy('llama','rival-llama-episode-5',23,5,ai='방어',pilot='llama')]),
                 '대기: '+' / '.join([enemy('alpaca','derived-llama-episode-5',22,4),enemy('vicuna','derived-llama-episode-5',23,6),enemy('koala','derived-llama-episode-5',22,6)]),
                 '증원: 격파 llama → alpaca 22,4, vicuna 23,6, koala 22,6',
                 '승리: 격파 llama, alpaca, vicuna, koala', '패배: 격파 player / 아군 전멸',
                 '지역 workshop (1,1~3,1): 아군 진입 → 사건 부두의 코딩 공방', '보상: 사건 부두의 코딩 공방 → 크레딧 500']
    rows += [f'보상: 승리 → 크레딧 {[1800,2200,2600,2800,3200][ep-1]}']
    return '\n'.join(rows)


def grid(ep):
    if ep>=11:
        from carbon_final import grid as final_grid
        return final_grid(ep)
    if ep>=6:
        from carbon_second import grid as second_grid
        return second_grid(ep)
    w = 24 if ep in (3,4,5) else 16
    m = [['.' for _ in range(w)] for _ in range(11)]
    for x in range(w): m[5][x] = '='
    for x,y in [(3,4),(3,7),(10,2),(10,9)]: m[y][x] = 'C'
    for x,y in [(6,2),(6,8),(11,1),(11,9)]: m[y][x] = '^'
    if ep == 1:
        for x,y in [(0,0),(1,0),(14,0),(15,0)]: m[y][x]='#'
    if ep == 2:
        m = [['.' if t in ('C','^') else t for t in row] for row in m]
        for x,y in [(5,1),(6,1),(6,2),(6,7),(8,4),(8,2),(7,9)]:m[y][x]='C'

    if ep == 3:
        for x,y in [(4,3),(5,3),(6,3),(4,7),(5,7),(6,7)]: m[y][x]='#'
    if ep == 4:
        for y in [4,6]:
            for x in range(3,15): m[y][x]='='
    if ep == 5:
        for y in [0,9,10]:
            for x in range(4,16): m[y][x]='~'
        for x,y in [(0,0),(0,1),(4,1),(5,1)]: m[y][x]='#'
    return '\n'.join(' '.join(row) for row in m)


def generate(raw, ep):
    from carbon_second import BG as SECOND_BG, UNIT_NAMES as SECOND_UNITS
    BG.update(SECOND_BG)
    from carbon_final import BG as FINAL_BG, UNIT_NAMES as FINAL_UNITS, speaker
    BG.update(FINAL_BG)
    original = patched(raw, ep)
    lines = original.splitlines()
    title = lines[0]
    cg, converted, dialogue = [], [], []
    pico_phase=1
    scene=''
    for line in lines[1:]:
        s = line.strip()
        if s.startswith('@ '):scene=s[2:].split(' (',1)[0]
        if not s or s.startswith('//'):
            if s.startswith('// [엔진 추가]'): s = s.replace('// [엔진 추가]', '// TODO 엔진 추가')
            converted.append(s)
            continue
        if '프롬프터' in s or '히로인' in s:
            speaker = re.sub(r'^\[타입 [OM]\]\s*','',s).split('(')[0].split(':')[0]
            s = s.replace('프롬프터님',NICK.get(speaker,'유저님')).replace('프롬프터','유저').replace('히로인','에이전트')
        if ep==15:
            if s=='@ 격파 데우스 엑스 피코':pico_phase=2
            if s=='@ 격파 심연 쇼거스':pico_phase=3
        if ep>=11:s=speaker(s,ep,pico_phase)
        if re.match(r'^(?:\[타입 [OM]\]\s*)?[^\[\s][^:]*?: ', s): dialogue.append(s)
        if s.startswith('[배경] '):
            s = '[배경] '+background(ep,scene,s[5:],BG[s[5:]])
        elif s.startswith('[음악] '): s = '[음악] '+MUSIC[s[5:]]
        elif s.startswith('[효과음] '):
            desc=s[6:];s='[효과음] '+sound(desc)
        elif s == '[잠깐]': s='[잠깐] 0.5'
        elif s.startswith('[삽화] '):
            parts=s[5:].split(' | ');cg.append(parts)
            s = '[삽화] '+CG[parts[0]]+' | '+parts[1]+' | '+parts[0]+' | '+TONES[CG[parts[0]]]+' | '+parts[2]
        elif s.startswith('[맵] '): s='[맵] 보기 3,5'
        elif s.startswith('-> '): s='[이동] '+s[3:]
        elif s.startswith('- '): s=re.sub(r', (?=\[(?:호감|변수)\])','; ',s)
        elif re.match(r'^\[조건\] \S+_고호감 ->',s):
            agent=s.split()[1].removesuffix('_고호감');ids=dict(zip(NICK,['gpi','gem','claude','grok','deepseek','sonnet','exaone','qwen']))
            s='[조건] 호감 '+ids[agent]+' >= 30 ->'+s.split('->',1)[1]
        elif s.startswith('[조건] 가챠_버프당첨 ->'): s=s.replace('가챠_버프당첨 ->','가챠_버프당첨 == true ->')
        elif s.startswith('@ 조우 ') or s.startswith('@ 격파 '):
            prefix, name = s[:5],s[5:]
            s = prefix+(UNIT_NAMES[ep-1] if ep<=5 else SECOND_UNITS[ep-6] if ep<=10 else FINAL_UNITS[ep-11])[name]
        converted.append(s)
    body='\n'.join(converted).strip()
    # 원문에서 장면 끝을 생략한 부분은 .story의 명시 끝으로 분리한다.
    scenes=re.split(r'(?m)^@ ',body)
    finished=[]
    for scene in scenes[1:]:
        name,_,text=scene.partition('\n')
        text=text.rstrip()
        if not text.endswith('[끝]') and not re.search(r'\[이동\] [^\n]+$',text) and not any(l.startswith('- ') for l in text.splitlines()[-5:]): text+='\n[끝]'
        finished.append('@ '+name+'\n'+text)
    body='\n\n'.join(finished)
    if ep == 1: body=body.replace('@ 도입\n','@ 도입\n[변수] 지피합류 = 1\n').replace('@ 인터미션_마무리\n','@ 인터미션_마무리\n[변수] coffee-done = true\n')
    if ep == 2:
        body=body.replace('@ 도입\n','@ 도입\n[변수] 젬합류 = 1\n')
        body=body.replace('@ 가챠_성공연출\n','@ 가챠_성공연출\n')
        # 패치 성공 분기는 원문상 다음 장면으로 이어지는 구조다.
        body=body.replace('희귀 시드값을 뽑으셨군요. 버프가 유지되는 동안 주력기들을 단숨에 몰아붙이시죠.\n[끝]', '희귀 시드값을 뽑으셨군요. 버프가 유지되는 동안 주력기들을 단숨에 몰아붙이시죠.\n[이동] 가챠_연출끝')
        body += '\n\n// TODO 엔진 추가: 젬짱 나노/프로/울트라 폼 체인지. 현재 기존 기체와 연출로 대체.\n// TODO 엔진 추가: 가챠 랜덤 효과. 고정 성공/실패 지역, 성공 크레딧으로 대체. 복구 서버는 교전 구간에만 배치.\n@ 사건 가챠_고정성공\n[변수] 가챠_버프당첨 = true\n[이동] 사건 가챠 타일 당첨\n\n@ 사건 가챠_고정실패\n[변수] 가챠_버프당첨 = false\n[이동] 사건 가챠 타일 당첨'
    if ep == 3:
        body=body.replace('@ 사건 가드레일의 의미\n','@ 사건 가드레일의 의미\n[맵] 합류 claude\n[변수] 클로드합류 = 1\n')
        body=body.replace('@ 사건 5시간 한도 도달\n','@ 사건 5시간 한도 도달\n[맵] 퇴장 claude\n')
        body=body.replace('@ 승리\n','@ 승리\n[변수] 클로드합류 = 1\n')
        body += '\n\n// TODO 엔진 추가: 클로드 5회 전투 카운터. 6턴 절전 철수로 대체.\n@ 턴 6\n[조건] 클로드합류 == 1 -> 사건 5시간 한도 도달\n[끝]'
    if ep == 4:
        body=body.replace('@ 사건 톨게이트 내기 승리\n','@ 사건 톨게이트 내기 승리\n[조건] 그록격파 == true -> 톨게이트_종료\n[맵] 합류 grok\n[변수] 그록합류 = 1\n')
        body=body.replace('@ 격파 grok\n','@ 격파 grok\n[변수] 그록격파 = true\n')
        body=body.replace('@ 승리\n','@ 승리\n[변수] 그록합류 = 1\n')
        body+='\n\n// TODO 엔진 추가: 하이웨이 가속 지형. 길 지형과 5턴 도달 사건으로 대체.\n@ 톨게이트_종료\n[끝]'
    if ep>=11:
        from carbon_final import postprocess
        body=postprocess(body,ep)
    elif ep>=6:
        from carbon_second import postprocess
        body=postprocess(body,ep)
    import carbon_mechanics as mechanics
    body=mechanics.body(ep,body)
    result='# '+title+'\n\n// 카본 원문 턴 '+str(TURNS[ep-1])+(' + 턴 60 패치' if ep<=2 else '')+'\n@ 규칙\n'+map_hints(ep,mechanics.rules(ep,rules(ep)))+'\n\n@ 맵\n'+mechanics.grid(ep,grid(ep))+'\n\n'+body+'\n'
    from feedback_overlay import story_overlay
    from port_grok_absent import overlay
    return overlay(ep,story_overlay(ep,story_source(ep,result))), cg, dialogue_source(ep,dialogue)


# Presentation-only labels. Hidden recruitment and global contact checks stay unmarked.
HINT_REGIONS = {
  1: {'relic': '폐건물'},
  2: {'library': '서재', 'gacha-good': '가챠 타일 위험', 'gacha-bad': '가챠 타일 위험'},
  3: {f'guard-{i}': '가드레일' for i in range(4)},
  4: {'toll': '톨게이트', 'booth': '포장마차'},
  5: {'workshop': '코딩 공방'}, 6: {'stall': '만두 포장마차'},7:{'lab':'연구소 위험'},
  9: {'vault': '금고'}, 10: {'market': '야시장 포장마차'},
}
HINT_BOSSES = {1:'shrimp',2:'midjourney, sd',3:'leader',4:'leader',5:'llama',6:'deepseek-rival',15:'pico'}
def map_hints(ep, rows):
    labels=HINT_REGIONS.get(ep,{})
    for id,label in labels.items():
        rows=re.sub(r'(지역 '+re.escape(id)+r' \([^)]*\)):',lambda m:m[1]+' 표시 '+label+':',rows)
    if ep in HINT_BOSSES: rows+='\n안내 목표: '+HINT_BOSSES[ep]
    return rows


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    raw=RAW.read_text(encoding='utf-8')
    wishlist=['# 카본 삽화 완료 목록', '', '물결 5: 신규 28장 완료·대본 연결. 모든 그림은 글자·실제 로고 없이 제작했고, 사용자 얼굴을 그리지 않는다. 원문 장면 설명은 아래 기록으로 보존한다.', '']
    audit={'sourceSha256':hashlib.sha256(RAW.read_bytes()).hexdigest(),'episodes':{}}
    changes=['# 카본 1~15화·엔딩 대사 변경 대조', '', '각 화 원문과 승인 패치를 비교했다. 1·2화는 턴 60, 6화는 턴 24·33, 8화는 턴 33과 외형 낭독 3줄 편집, 10화는 턴 42 선언과 턴 60 옥상 7명 판을 반영했다. 11화는 턴 45, 12화는 턴 48 호명 패치, 15화 뒤 엔딩은 턴 57을 반영했다. 12화 이름 허락·JEPA 조우에도 사용자 지시의 호감 30 기준을 적용하고 낮을 때 애칭으로 바꾼 줄을 기록했다. 3~5·7·9·13·14화는 대사를 바꾸지 않았다.', '']
    for ep in range(1,16):
        result,cgs,dialogue=generate(raw,ep)
        all_dialogue=[line for line in result.splitlines()if re.match(r'^(?:\[타입 [OM]\]\s*)?[^\[\s][^:]*?: ',line)and not line.startswith('//')]
        path=PACK/f'story/ep{ep:02}.story'
        if args.check:
            assert path.read_text(encoding='utf-8')==result, f'{path}: 이식 결과와 다름'
        else: path.write_text(result,encoding='utf-8')
        audit['episodes'][f'ep{ep:02}']={'turn':TURNS[ep-1], 'patchTurns':{1:[60],2:[60],6:[24,33],8:[33],10:[42,60],11:[45],12:[48],15:[57]}.get(ep,[]), 'dialogueSha256':hashlib.sha256('\n'.join(all_dialogue).encode()).hexdigest(),'dialogueLines':len(all_dialogue)}
        before=[s for s in source_story(raw,TURNS[ep-1],ep).split('@ 도입',1)[1].splitlines() if not s.startswith('//') and re.match(r'^(?:\[타입 [OM]\]\s*)?[^\[\s][^:]*?: ',s)]
        for tag,a,b,c,d in difflib.SequenceMatcher(a=before,b=dialogue,autojunk=False).get_opcodes():
            if tag=='equal': continue
            changes += [f'## {ep}화 · 원문 대사 {a+1}번 → 새 대사 {c+1}번', '', '사유: 승인된 턴별 패치·8화 외형 낭독 편집 또는 허용된 호칭·용어 교체.', '', '원래 줄:', '```text', *before[a:b], '```', '', '새 줄:', '```text', *dialogue[c:d], '```', '']
        for title,who,desc in cgs:
            if title!='지피짱 등장': wishlist += [f'- [x] {ep}화 · **{title}** · `{CG[title]}` | {who} | {desc}']
    changes += ['## 범용 기믹 전환 · 대사 보존', '', '기존 대사 본문은 바꾸지 않았다. 12화 합체기 컷인은 원문의 클로드 발화 첫 문장 `관측 회선 수신 완료!`를 재사용하고, 14화는 JEPA의 원문 `◈━━━■■■!!`, 10화 복사는 원문의 미니맥스 웃음 대사 한 줄을 재사용한다. 새 통신 대사를 창작하지 않았다. 피코의 격파 장면 이름·등장 명령을 같은 id의 폼 명령으로 변경한 것은 엔진 형식 변경이다. 15화 게이트의 사용자 호감30 이름 패치는 그대로 보존했다.', '']
    wishlist += ['', '## 범용 기믹 전용 그림 완료', '',
        '- [x] 젬 나노/프로/울트라: 전용 SD 실루엣 3장과 수동 기준점. 기존 1~4세대의 전술 폼에 표시 자료만 적용.',
        '- [x] 퀜 악의축/얀데레/메가데레: 같은 얼굴의 상반신 3장. 모드별 전투 컷인·기체 카드 초상 연결.']
    from carbon_second import EDITORIAL
    changes += ['## 8화 · 턴 33 패치 뒤 외형 낭독 세 줄 편집', '', '사유: review-notes.md의 외형 낭독 편집 지시. 오타쿠8의 머리핀 안테나 발견은 유지했다.', '']
    for before,after in EDITORIAL.items():
        changes += ['원래 줄:', '```text',before,'```','','새 줄:','```text',after,'```','']
    if args.check:
        assert (ROOT/'docs/v2-cg-wishlist.md').read_text(encoding='utf-8')=='\n'.join(wishlist)+'\n', '삽화 완료 기록과 생성기가 다름'
    if not args.check:
        (ROOT/'docs/v2-cg-wishlist.md').write_text('\n'.join(wishlist)+'\n',encoding='utf-8')
        (ROOT/'docs/v2-carbon-dialogue-changes.md').write_text('\n'.join(changes)+'\n',encoding='utf-8')
        (PACK/'story/carbon-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('카본 1~15화·엔딩 대사·형식 검증 완료' if args.check else '카본 1~15화·엔딩 생성 완료')


if __name__=='__main__': main()
