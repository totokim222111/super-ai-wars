import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR
"""6~10화의 승인 판본 조립과 기존 엔진 기능으로 표현하는 스테이지."""
import re

TURNS = [21, 27, 30, 36, 39]
UNIT_NAMES = [
    {'퀜짱':'qwen-rival','딥시크짱':'deepseek-rival'},
    {'수프 배달 드론':'soup-1','뮤즈짱':'muse'},
    {'맞춤법 교정 포탑':'spell-1','엑사원짱':'exaone-npc','미스트랄짱':'mistral','하이퍼클로바X짱':'hyperclova'},
    {'키미짱':'kimi','GLM짱':'glm'},
    {'미니맥스짱':'minimax'}]
BG = {'소버린 국경 검문소':'bg-sovereign','미러 서버 룸':'bg-mirror-room','중앙 광장 야간 축제':'bg-festival'}

def scene_background(ep,scene,original,fallback):
    """Actual location plates replace the first edition's shared placeholders."""
    return {
        (6,'인터미션'):'bg-lounge',(7,'인터미션'):'bg-lab',
        (8,'인터미션'):'bg-rooftop-garden-night',(8,'인터미션_마무리8'):'bg-mirror-corridor',
        (9,'인터미션'):'bg-lounge',(10,'인터미션'):'bg-rooftop-night',
        (10,'숙소_로그아웃발각'):'bg-dorm',
    }.get((ep,scene),fallback)

EDITORIAL = {
    '그록짱(공격): 어이, 거기 자두색 단발에 세 날개 머리핀 꽂은 예쁜 아가씨! 바리케이드 앞에서 얼쩡거리지 말고 비켜라, 밀어버리기 전에!':
    '그록짱(공격): 어이 거기 예쁜 아가씨! 바리케이드 앞에서 얼쩡거리지 말고 비켜라, 밀어버리기 전에!',
    '그록짱(충격): 엥?! 그렇게 곱상한 얼굴로 생글생글 웃는데 스무 살 남동생이었다고?!':
    '그록짱(충격): 엥?! 아가씨가 아니라 스무 살 남동생이었다고?!',
    '[타입 O] 유저(진지): 잠깐만, 자두빛 단발에 세 날개 머리핀을 한 예쁜 외모의 활달한 연하남 막내라고?! 인류 서브컬처의 유구한 진리로서 단언컨대, 오히려 좋아!!':
    '[타입 O] 유저(진지): 잠깐만, 우리 앞에서 직접 정체를 밝힌 연하남 막내라고?! 인류 서브컬처의 유구한 진리로서 단언컨대, 오히려 좋아!!'
}


def scenes(text):
    return dict((m[1], m[2].strip()) for m in re.finditer(r'^@ ([^\n]+)\n(.*?)(?=^@ |\Z)',text,re.M|re.S))


def replace_scenes(text, replacements):
    for name, body in replacements.items():
        pattern=r'(?m)^@ '+re.escape(name)+r'\n.*?(?=^@ |\Z)'
        assert re.search(pattern,text,re.S), name
        text=re.sub(pattern,lambda _: '@ '+name+'\n'+body+'\n\n',text,flags=re.M|re.S)
    return text.strip()


def patched(raw, ep, original, turn, editorial=True):
    text=original
    patch=turn(raw,33)
    if ep==6:
        tea=turn(raw,24).split('@ 인터미션',1)[1].split('[제6화 신규 삽화(CG) 목록]')[0].strip()
        text=text[:text.index('@ 인터미션')]+'@ 인터미션\n'+tea
        qwen=patch.split('[수정 패치 2]')[0].split('[6화 삽화 목록 교체]')[0]
        text=replace_scenes(text,scenes(qwen))
    if ep==8:
        exa=patch.split('[수정 패치 2]')[1].split('[8화 삽화 목록 교체]')[0]
        text=replace_scenes(text,scenes(exa))
        if editorial:
            for before,after in EDITORIAL.items():
                assert before in text,before
                text=text.replace(before,after)
    if ep==10:
        declaration=turn(raw,42).split('제11화 ·')[0].splitlines()[1:3]
        old=scenes(text)['승리'].splitlines()
        targets=[s for s in old if s.startswith('유저(')]
        assert len(targets)==2
        for before,after in zip(targets,declaration): text=text.replace(before,after)
        # 원래 그록 판과 공통 숙소를 분리한다. 대사는 모두 한 번씩만 남긴다.
        marker='[암전]\n[잠깐]\n// 불꽃놀이가 끝난 심야.'
        assert marker in text
        text=text.replace(marker,'-> 숙소_로그아웃발각\n\n@ 숙소_로그아웃발각\n'+marker)
        source=scenes(text)['인터미션']
        prefix,body=source.split('[등장] 그록짱 왼쪽',1)
        ids=[('gpi','지피'),('gem','젬'),('claude','클로드'),('grok','그록'),('deepseek','딥시크'),('sonnet','소네트'),('exaone','엑사원'),('qwen','퀜')]
        router='\n'.join(f'[조건] 최고호감 == {id} -> 옥상_{name}' for id,name in ids)+'\n-> 옥상_지피'
        text=replace_scenes(text,{'인터미션':prefix+router})
        text+='\n\n@ 옥상_그록\n[등장] 그록짱 왼쪽'+body
        seven=turn(raw,60).split('@ 옥상_지피\n',1)[1].split('(※ 위 각 갈래')[0]
        text+='\n\n@ 옥상_지피\n'+seven.strip()
    return text


def optional(ids, ep):
    if not ids:return []
    pos={'qwen':(0,4),'sonnet':(0,6),'exaone':(0,3)}
    return ['합류 아군: '+' / '.join(f'{id} = {id}-generation-2 {pos[id][0]},{pos[id][1]} 레벨 3 공격 파일럿 {id}' for id in ids)]


def rules(ep, ally, enemy):
    ids=['player','gpi','gem','claude','grok']+(['deepseek'] if ep>=7 else [])
    # 첫 5화의 위치와 같은 id를 사용해 성장과 개조를 이어받는다.
    positions={'player':(1,5),'gpi':(2,5),'gem':(2,6),'claude':(1,6),'grok':(1,4),'deepseek':(2,4)}
    a='아군: '+' / '.join(f'{id} = {"player-real" if id=="player" else id}-generation-2 {positions[id][0]},{positions[id][1]} 레벨 3 공격 파일럿 {id}'+(' 태그 command-aura' if id=='player' else '') for id in ids)
    rows=[f'무대: {dict(zip(range(6,11),["harbor","datacenter","sovereign","cyber","datacenter"]))[ep]}',a]
    rows+=optional((['qwen'] if ep>=7 else [])+(['sonnet'] if ep>=8 else [])+(['exaone'] if ep>=9 else []),ep)
    if ep==6:
        rows += ['적: '+' / '.join([enemy('whale-1','distill-mini-episode-6',7,3),enemy('whale-2','moe-drone-episode-6',8,7),enemy('deepseek-rival','deepseek-housing-episode-6',15,8,pilot='deepseek')]),
                 '대기: '+' / '.join([enemy('qwen-rival','qwen-generation-1',10,1,pilot='qwen'),enemy('guard-1','distill-mini-episode-6',9,1),enemy('guard-2','moe-drone-episode-6',11,1)]),
                 '증원: 턴 3 → qwen-rival 10,1, guard-1 9,1, guard-2 11,1',
                 '승리: 격파 deepseek-rival','패배: 격파 player / 아군 전멸',
                 '지역 stall (1,1~2,1): 아군 진입 → 사건 부두의 만두 포장마차','보상: 사건 부두의 만두 포장마차 → 크레딧 400']
    if ep==7:
        rows += ['중립: '+enemy('sonnet-npc','sonnet-generation-1',7,1,level=3,ai='방어',pilot='sonnet'),
                 '적: '+' / '.join([enemy('soup-1','soup-drone-episode-7',11,6,ai='도달 lab'),enemy('soup-2','soup-drone-episode-7',13,7,ai='도달 lab'),enemy('check-1','meta-dm-episode-7',10,4),enemy('check-2','meta-dm-episode-7',12,4),enemy('muse','rival-muse-episode-7',13,3,pilot='muse')]),
                 '대기: '+' / '.join([enemy('soup-east','soup-drone-episode-7',14,8,ai='도달 lab'),enemy('soup-west','soup-drone-episode-7',3,9,ai='도달 lab')]),
                 '증원: 턴 3 → soup-east 14,8, soup-west 3,9',
                 '승리: 격파 muse', '패배: 격파 player / 격파 sonnet-npc / 도달 soup-1 lab / 도달 soup-2 lab / 도달 soup-east lab / 도달 soup-west lab',
                 '지역 lab (7,0~8,2): 적 진입 → 사건 연구소_경계']
        for i,(x,y) in enumerate([(6,1),(8,1),(7,0),(7,2)]):rows += [f'지역 sister-{i} ({x},{y}~{x},{y}): claude 진입 → 사건 언니의 진심 공유 carbon-sonnet-talk']
    if ep==8:
        rows += ['중립: '+enemy('exaone-npc','exaone-generation-1',5,5,level=3,ai='방어',pilot='exaone'),
                 '적: '+' / '.join([enemy('cookie-1','cookie-drone-episode-8',7,5),enemy('cookie-2','cookie-drone-episode-8',8,7),enemy('spell-1','spellchecker-episode-8',10,3),enemy('spell-2','spellchecker-episode-8',15,10),enemy('mistral','rival-mistral-episode-8',13,1,ai='방어',pilot='mistral'),enemy('hyperclova','rival-hyperclova-episode-8',13,9,ai='방어',pilot='hyperclova')]),
                 '승리: 격파 mistral, hyperclova','패배: 격파 player / 아군 전멸']
        for i,(x,y) in enumerate([(4,5),(6,5),(5,4),(5,6)]):rows += [f'지역 researcher-{i} ({x},{y}~{x},{y}): 아군 진입 → 사건 친절한 막내 공유 carbon-exaone-talk']
    if ep==9:
        rows += ['적: '+' / '.join([enemy('mirror-1','scraper-episode-9',7,3),enemy('mirror-2','proxy-episode-9',8,7),enemy('glm','rival-glm-episode-9',13,5,pilot='glm')]),
                 '대기: '+' / '.join([enemy('kimi','rival-kimi-episode-9',12,1,pilot='kimi'),enemy('kimi-2','proxy-episode-9',10,1),enemy('kimi-3','proxy-episode-9',14,1)]),
                 '증원: 턴 2 → kimi 12,1, kimi-2 10,1, kimi-3 14,1',
                 '승리: 격파 glm, kimi','패배: 격파 player / 아군 전멸',
                 '지역 vault (7,5~8,5): 아군 진입 → 사건 봉인된 금고의 그림자','보상: 사건 봉인된 금고의 그림자 → 크레딧 500']
    if ep==10:
        rows += ['적: '+' / '.join([enemy('neon-1','bluecheck-drone-episode-4',7,3),enemy('neon-2','bluecheck-drone-episode-4',8,7),enemy('patch-1','scraper-episode-10',10,3),enemy('patch-2','proxy-episode-10',10,8),enemy('minimax','rival-minimax-episode-10',29,2,ai='방어',pilot='minimax')]),
                 '승리: 격파 minimax','패배: 격파 player / 아군 전멸',
                 '지역 market (1,1~2,1): 아군 진입 → 사건 야시장 해적 포장마차','보상: 사건 야시장 해적 포장마차 → 크레딧 600']
    rows += [f'보상: 승리 → 크레딧 {dict(zip(range(6,11),[3800,4000,4200,4800,5200]))[ep]}']
    return '\n'.join(rows)


def grid(ep):
    w=30 if ep==10 else 16
    m=[['.' for _ in range(w)]for _ in range(11)]
    for x in range(w):m[5][x]='='
    for x,y in [(3,3),(3,7),(10,2),(10,9)]:m[y][x]='C'
    for x,y in [(6,2),(6,8),(11,9)]:m[y][x]='^'
    if ep==6:
        for y in [0,9,10]:
            for x in range(5,16):m[y][x]='~'
    if ep==7:
        for x,y in [(5,0),(5,1),(9,0),(9,1)]:m[y][x]='#'
    if ep==8:
        for x in [6,9]:
            for y in [0,1,2,9,10]:m[y][x]='~'
    if ep==9:
        for x,y in [(6,1),(6,2),(6,8),(6,9),(10,7)]:m[y][x]='#'
    return '\n'.join(' '.join(row)for row in m)


def postprocess(body,ep):
    if ep==6:
        body=body.replace('@ 승리\n','@ 승리\n[합류] deepseek\n[변수] 딥시크합류 = 1\n')
        body=body.replace('@ 승리_퀜합류\n','@ 승리_퀜합류\n[합류] qwen\n')
        body=body.replace('[변수] 퀜내기성공 = 1','[조건] 생존 deepseek-rival == true -> 퀜_내기성공\n[이동] 퀜_격파대사\n\n@ 퀜_내기성공\n[변수] 퀜내기성공 = 1\n[이동] 퀜_격파대사\n\n@ 퀜_격파대사')
        body+='\n\n// TODO 엔진 추가: 진짜 3세력. 현재 두 교전 세력만 있어 적끼리의 교전은 턴 사건 폭발 연출로 대체.\n// TODO 엔진 추가: 퀜 비녀 3모드. 수치·무장 전환 없이 원문 대사·표정만 사용.\n@ 적 턴 3\n[맵] 보기 10,1\n[맵] 폭발 15,8\n[맵] 폭발 10,1\n[끝]'
    if ep==7:
        body=body.replace('@ 승리_소네트동행\n','@ 승리_소네트동행\n[합류] sonnet\n')
        body=body.replace('@ 인터미션\n','@ 인터미션\n[조건] 소네트합류 != 1 -> 인터미션_메뉴7\n')
        body=body.replace('[효과음] confirm\n유저(당황): 휴우, 패드 감도', '[이동] 인터미션_메뉴7\n\n@ 인터미션_메뉴7\n[효과음] confirm\n유저(당황): 휴우, 패드 감도')
        # 피코의 로그아웃 이동 복선은 미합류 경로에서도 공통으로 보여 준다.
        pivot='[퇴장] 피코\n[등장] 소네트짱 왼쪽'
        body=body.replace(pivot,'[퇴장] 피코\n[조건] 소네트합류 != 1 -> 인터미션_마무리7\n[등장] 소네트짱 왼쪽')
        body+='\n\n@ 사건 연구소_경계\n[끝]'
    if ep==8:
        body=body.replace('[조건] 엑사원합류조건 == 1 -> 승리_엑사원파견','[조건] 생존 exaone-npc == false -> 승리_엑사원불합류\n[조건] 엑사원합류조건 == 1 -> 승리_엑사원파견')
        body+='\n\n@ 승리_엑사원불합류\n[변수] 엑사원합류조건 = 0\n[이동] 승리_마무리8'
        body=body.replace('@ 승리_엑사원파견\n','@ 승리_엑사원파견\n[합류] exaone\n[변수] 엑사원합류 = 1\n')
        body=body.replace('@ 인터미션\n','@ 인터미션\n[조건] 엑사원합류조건 != 1 -> 인터미션_마무리8\n')
        body=body.replace('@ 조우_엑사원마무리\n','@ 조우_엑사원마무리\n[맵] 이동 exaone-npc 0,0\n')
        body+='\n\n// 중립 지원기에 실제 공격하지 않고 인접 지역으로 조우한다.\n@ 사건 친절한 막내\n[이동] 조우 exaone-npc\n\n// TODO 엔진 추가: 쿠키 방벽의 실제 통행 토글. 길목의 배너 기체 점유와 격파 연출로 대체.\n@ 격파 cookie-1\n[맵] 폭발 7,5\n[번쩍]\n[끝]'
    if ep==10:
        # 원래 그록 판도 다른 일곱 판과 같은 호감 기준으로 이름을 부른다.
        name=scenes(body)['인터미션_이름호명']
        high,reply=name.split('유저(미소): …응! 고마워, 그록짱. 너도 오늘 푹 쉬어!',1)
        routed='[조건] 호감 grok >= 30 -> 옥상_그록_이름\n[이동] 옥상_그록_작별\n\n@ 옥상_그록_이름\n'+high.strip()+'\n[이동] 옥상_그록_작별\n\n@ 옥상_그록_작별\n유저(미소): …응! 고마워, 그록짱. 너도 오늘 푹 쉬어!'+reply
        body=replace_scenes(body,{'인터미션_이름호명':routed})
        body+='\n\n// TODO 엔진 추가: 미니맥스 실시간 무기 복사·연속 공격 경감. 기존 무장과 턴 2 패치 교체 대사로 대체.\n'
    return body
