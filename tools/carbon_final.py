import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR
"""카본 최종 판본과 엔딩. 원고는 읽기만 하고 연출·규칙을 기존 기능으로 낮춘다."""
import re
from carbon_second import scenes, replace_scenes

BG = {'얼어붙은 설원':'bg-snowfield', '사이버 공간':'bg-mirror-room'}

def scene_background(ep,scene,original,fallback):
    if original=='사이버 공간':return 'bg-cyber-abyss'
    if ep==13 and scene in ['승리','패배']:return 'bg-cyber-abyss'
    if ep==15 and scene=='엔딩_오픈' and original=='격납고':return 'bg-lounge'
    return {
        (11,'인터미션'):'bg-bunker',(12,'인터미션'):'bg-campfire',
        (13,'인터미션'):'bg-bunker',(15,'엔딩_소네트짱'):'bg-lab',
        (15,'엔딩_퀜짱'):'bg-lakeside',
    }.get((ep,scene),fallback)

IDS = [('gpi','지피'),('gem','젬'),('claude','클로드'),('grok','그록'),('deepseek','딥시크'),('sonnet','소네트'),('exaone','엑사원'),('qwen','퀜')]
UNIT_NAMES = [
    {'JEPA':'jepa-shield','다큰낙타':'camel'},
    {'JEPA':'jepa','다큰낙타':'camel'},
    {'JEPA':'jepa','도파민 천국 드론':'dopamine-1','데우스 엑스 피코':'pico-shield'},
    {'쇼거스 촉수':'tentacle-1','데우스 엑스 피코':'pico-shell'},
    {'데우스 엑스 피코':'pico-mask','심연 쇼거스':'pico-abyss'}]


def patched(raw,ep,text,turn):
    if ep==11:
        p=turn(raw,45).split('제12화 ·')[0]
        replacements=[s for s in p.splitlines() if s.startswith('지피짱(')]
        for name,new in zip(['선택_진심증명','선택_멘헤라11'],replacements):
            old=scenes(text)[name];line=[s for s in old.splitlines() if s.startswith('지피짱(')][-1]
            text=replace_scenes(text,{name:old.replace(line,new)})
    if ep==12:
        p=turn(raw,48).split('제13화 ·')[0]
        first=p[p.index('[조건] 지피짱'):p.index('// 2.')].strip()
        first=first.replace('\n@ 동기화_지피끝','\n-> 동기화_지피끝\n\n@ 동기화_지피끝')
        old=scenes(text)['사건 첫 번째 좌표 동기화']
        start=old.index('지피짱(부끄러움): 제 세계의 첫 좌표')
        text=replace_scenes(text,{'사건 첫 번째 좌표 동기화':old[:start]+first})
        second=p[p.index('[조건] 클로드짱'):p.index('// 3.')].strip()
        second=second.replace('\n@ 공명_클로드끝','\n-> 공명_클로드끝\n\n@ 공명_클로드끝')
        old=scenes(text)['사건 세계와 언어의 공명'];line=[s for s in old.splitlines() if s.startswith('클로드짱(')][0]
        text=replace_scenes(text,{'사건 세계와 언어의 공명':old.replace(line,second)})
        changes=[s for s in p.splitlines() if s.startswith('딥시크짱(')]
        originals=[s for s in text.splitlines() if s.startswith('딥시크짱(') and '{유저이름}' in s and '직접 승인' not in s]
        assert len(changes)==len(originals)==4
        for before,after in zip(originals,changes):text=text.replace(before,after)
        # 사용자 지시: 이름 허락 선택도 호감 30을 채워야 이름을 말한다.
        old=scenes(text)['선택_이름허락'];high=[s for s in old.splitlines() if '{유저이름}' in s][0]
        low=high.replace('{유저이름} 님','주인님')
        text=replace_scenes(text,{'선택_이름허락':old.replace(high,'[조건] 호감 deepseek >= 30 -> 이름허락_고호감\n'+low+'\n-> 인터미션_마무리12\n\n@ 이름허락_고호감\n'+high)})
        old=scenes(text)['조우 JEPA'];high=[s for s in old.splitlines() if '{유저이름}' in s][0]
        low=high.replace('{유저이름} 님','파트너님')
        text=replace_scenes(text,{'조우 JEPA':old.replace(high,'[조건] 호감 gpi >= 30 -> 조우_지피이름\n'+low+'\n-> 조우_지피끝\n\n@ 조우_지피이름\n'+high+'\n-> 조우_지피끝\n\n@ 조우_지피끝')})
    if ep in (14,15):
        lookup={name:id for id,name in IDS}
        text=re.sub(r'\[조건\] 최고호감_(\S+?)(?:_및_합류)? ->',lambda m:'[조건] 최고호감 == '+lookup[m[1]]+' ->',text)
    if ep==15:
        # 사용자 지시: 게이트의 이름 호명도 호감 30을 채워야 한다. 미만이면 턴 9 애칭 표의 기본 호칭.
        for name,(id,nick) in {'지피':('gpi','파트너님'),'젬':('gem','캡틴'),'클로드':('claude','의뢰인님'),'그록':('grok','공범자'),
                               '딥시크':('deepseek','주인님'),'소네트':('sonnet','사수님'),'엑사원':('exaone','선배님'),'퀜':('qwen','감독관')}.items():
            m=re.search(r'@ 게이트_%s\n(\[등장\] [^\n]+)\n([^\n]+)\n-> 최종_로그아웃\n'%name,text);assert m,name
            low=re.sub(r'\{유저이름\}( 님| 씨)?',nick,m[2])
            text=text[:m.start()]+(f'@ 게이트_{name}\n{m[1]}\n[조건] 호감 {id} >= 30 -> 게이트_{name}_이름\n{low}\n-> 최종_로그아웃\n\n'
                                   f'@ 게이트_{name}_이름\n{m[2]}\n-> 최종_로그아웃\n')+text[m.end():]
        ending=turn(raw,57);text+='\n\n'+ending[ending.index('@ 엔딩_지피짱'):ending.index('[엔딩 9종 신규 삽화(CG) 목록]')].strip()
    return text


def speaker(line,ep,phase=2):
    if ep<13:return line
    cast='deus-ex-pico-form'+str(1 if ep==13 else phase if ep==15 else 2)
    return re.sub(r'(^|\] )데우스 엑스 피코(?=\(|:| 왼쪽| 오른쪽|$)',lambda m:m[1]+cast,line)


def army(ep):
    generation=2 if ep==11 else 3 if ep<=13 else 4
    # 플레이어의 현행 세대는 3종. 기존 2차의 2세대를 13화까지 유지한다.
    pos={'player':(1,5),'gpi':(2,5),'gem':(2,6),'claude':(1,6),'grok':(1,4),'deepseek':(2,4)}
    rows=['무대: '+('snowfield' if ep<=12 else 'cyber')]
    rows+=['아군: '+' / '.join(f'{id} = {"player-real-generation-"+str(2 if ep<=13 else 3) if id=="player" else id+"-generation-"+str(min(generation,3) if id=="deepseek" else generation)} {x},{y} 레벨 3 공격 파일럿 {id}'+(' 태그 command-aura' if id=='player' else '') for id,(x,y) in pos.items())]
    rows+=['합류 아군: '+' / '.join(f'{id} = {id}-generation-{min(generation,3)} 0,{y} 레벨 3 공격 파일럿 {id}' for id,y in [('qwen',4),('sonnet',6),('exaone',3)])]
    return rows


def rules(ep,enemy):
    rows=army(ep)
    if ep==11:
        rows+=['중립: '+enemy('jepa-shield','rival-jepa-episode-11',15,5,ai='방어',pilot='jepa'),
               '적: '+' / '.join(enemy(f'cube-{i}','predict-cube-episode-11',x,y) for i,(x,y) in enumerate([(9,2),(10,8),(12,4)],1)),
               '대기: '+enemy('camel','camel-episode-11',14,9,ai='방어')+' / '+enemy('ice-1','mask-drone-episode-11',13,1)+' / '+enemy('ice-2','mask-drone-episode-11',14,2),
               '증원: 적 턴 3 → camel 14,9, ice-1 13,1, ice-2 14,2','승리: 턴 5 버티기','패배: 격파 player / 아군 전멸']
    if ep==12:
        rows+=['중립: '+enemy('jepa-shield','rival-jepa-episode-12',17,5,ai='방어',pilot='jepa'),
               '적: '+' / '.join([enemy('cube-1','predict-cube-episode-12',9,2),enemy('cube-2','predict-cube-episode-12',10,8),enemy('cube-3','predict-cube-episode-12',13,4),enemy('camel','camel-episode-11',14,9,ai='방어')]),
               '대기: '+enemy('jepa','rival-jepa-episode-12',17,5,ai='방어',pilot='jepa'),
               '승리: 격파 jepa','패배: 격파 player / 격파 gpi',
               '지역 sync (0,0~17,10): player 진입 반복 → 사건 동기화_접촉',
               '지역 sync-gpi (0,0~17,10): gpi 진입 반복 → 사건 동기화_접촉',
               '지역 resonance (0,0~17,10): player 진입 반복 → 사건 공명_접촉',
               '지역 resonance-claude (0,0~17,10): claude 진입 반복 → 사건 공명_접촉']
    if ep==13:
        rows+=['적: '+' / '.join([enemy('spar-1','predict-cube-episode-13',7,3),enemy('spar-2','predict-cube-episode-13',8,8),enemy('llama','rival-llama-episode-13',12,2,ai='방어',pilot='llama'),enemy('minimax','rival-minimax-episode-13',12,8,ai='방어',pilot='minimax'),enemy('hyperclova','rival-hyperclova-episode-13',17,8,ai='방어',pilot='hyperclova'),enemy('jepa','rival-jepa-episode-13',17,2,ai='방어',pilot='jepa')]),
               '대기 중립: '+enemy('pico-shield','pico-form-1-episode-14',14,5,ai='방어',pilot='pico'),
               '대기: '+' / '.join(enemy(f'dopamine-{i}','like-drone-episode-14',x,y) for i,(x,y) in enumerate([(14,3),(15,7),(17,5)],1)),
               '승리: 격파 dopamine-1, dopamine-2, dopamine-3','패배: 격파 player / 아군 전멸']
    if ep==14:
        rows+=['중립: '+enemy('pico-shield','pico-form-2-episode-15',19,5,ai='방어',pilot='pico'),
               '적: '+' / '.join([enemy('tentacle-1','scroll-worm-episode-14',8,3),enemy('tentacle-2','scroll-worm-episode-14',10,8),enemy('dopamine-1','like-drone-episode-14',9,5),enemy('dopamine-2','like-drone-episode-14',13,2)]),
               '대기: '+enemy('pico-shell','pico-form-2-episode-15',19,5,ai='방어',pilot='pico'),
               '대기 아군: '+' / '.join([enemy('jepa-help','ally-jepa-episode-14',3,9,ai='방어',pilot='jepa'),enemy('llama-help','ally-llama-episode-14',4,9,pilot='llama'),enemy('minimax-help','ally-minimax-episode-14',5,9,pilot='minimax')]),
               '증원: 턴 2 → jepa-help 3,9, llama-help 4,9, minimax-help 5,9',
               '승리: 격파 pico-shell','패배: 격파 player']
    if ep==15:
        rows+=['아군: '+enemy('jepa-help','rival-jepa-episode-13',3,7,ai='공격',pilot='jepa'),
               '적: '+' / '.join([enemy('illusion-1','like-drone-episode-15',8,3),enemy('illusion-2','badge-bot-episode-15',9,8),enemy('pico-mask','pico-form-1-episode-14',13,5,ai='방어',pilot='pico')]),
               '대기: '+enemy('pico-abyss','pico-form-2-episode-15',13,5,ai='방어',pilot='pico'),
               '대기 중립: '+enemy('pico-core','pico-form-3-episode-15',16,5,ai='방어',pilot='pico'),
               '승리: 격파 pico-abyss & 인접 player pico-core','패배: 격파 player',
               '지역 core-front (0,0~19,10): player 진입 반복 → 사건 코어_접근확인']
    rows+=[f'보상: 승리 → 크레딧 {dict(zip(range(11,16),[5600,6000,6400,7000,8000]))[ep]}']
    return '\n'.join(rows)


def grid(ep):
    w={11:16,12:18,13:18,14:20,15:20}[ep]
    m=[['.' for _ in range(w)]for _ in range(11)]
    for x in range(w):m[5][x]='='
    for x,y in [(3,3),(3,7),(9,2),(9,8)]:m[y][x]='C'
    # 보스가 서버에서 회복하지 않게 하며 아군의 교전 위치에만 서버를 둔다.
    if ep>=12:
        for x,y in [(12,4),(12,6),(15,3),(15,7)]:m[y][x]='C'
    if ep==15:
        for x,y in [(7,5),(8,5),(9,5),(11,5),(12,5),(13,6)]:m[y][x]='C'
    return '\n'.join(' '.join(row)for row in m)


def postprocess(body,ep):
    if ep==11:
        body+='\n\n// TODO 엔진 추가: JEPA 90% 물리 배리어. 중립 보호 대상과 5턴 생존전으로 대체.\n'
    if ep==12:
        body=body.replace('@ 도입\n','@ 도입\n[맵] 이동 gpi 5,4\n[맵] 이동 claude 8,6\n')
        body=body.replace('@ 사건 세계와 언어의 공명\n','@ 사건 세계와 언어의 공명\n[변수] 세계언어공명 = 1\n')
        marker='// JEPA의 월드모델 물리 배리어 완전 해제'
        body=body.replace(marker,'[맵] 폭발 17,5\n[맵] 퇴장 jepa-shield\n[맵] 등장 jepa 17,5\n'+marker)
        body+='\n\n// TODO 엔진 추가: LLM+JEPA 합체기·무적 배리어. 순차 인접 접촉 후 중립 장벽을 철수시키고 기존 무장의 JEPA를 등장.\n@ 사건 동기화_접촉\n[조건] 인접 player gpi == false -> 접촉_끝\n[조건] 지피동기화 == 1 -> 접촉_끝\n[이동] 사건 첫 번째 좌표 동기화\n\n@ 사건 공명_접촉\n[조건] 인접 player claude == false -> 접촉_끝\n[조건] 세계언어공명 == 1 -> 접촉_끝\n[조건] 지피동기화 == 1 -> 사건 세계와 언어의 공명\n[끝]\n\n@ 접촉_끝\n[끝]'
    if ep==13:
        rivals=['llama','minimax','hyperclova','jepa']
        body=body.replace('@ 사건 특이점 삼킴\n','@ 사건 특이점 삼킴\n[변수] 특이점폭주 = 1\n')
        body=body.replace('// 경기장 라이벌 기체들은 충격파로 장외 이탈하고, 중앙에', '[맵] 등장 pico-shield 14,5\n'+''.join(f'[맵] 등장 dopamine-{i} {x},{y}\n'for i,(x,y)in enumerate([(14,3),(15,7),(17,5)],1))+'// 경기장 라이벌 기체들은 충격파로 장외 이탈하고, 중앙에')
        # 대사 뒤 생존 라이벌만 철수. 격파한 기체의 보상·격파 기록은 보존한다.
        name='사건 특이점 삼킴';old=scenes(body)[name];old=old.removesuffix('[끝]').rstrip()+'\n[이동] 라이벌_철수0';body=replace_scenes(body,{name:old})
        for id in rivals:body+=f'\n\n@ 격파 {id}\n[이동] 친선_판정'
        body+='\n\n@ 친선_판정\n[조건] 특이점폭주 == 1 -> 친선_끝\n'+'\n'.join(f'[조건] 격파 {id} == true -> 친선_확인_{id}'for id in rivals)+'\n[끝]'
        for id in rivals:body+=f'\n\n@ 친선_확인_{id}\n'+'\n'.join(f'[조건] 격파 {other} == true -> 사건 특이점 삼킴'for other in rivals if other!=id)+'\n[끝]'
        for i,id in enumerate(rivals):body+=f'\n\n@ 라이벌_철수{i}\n[조건] 생존 {id} == false -> 라이벌_철수{i+1}\n[맵] 퇴장 {id}\n[이동] 라이벌_철수{i+1}'
        body+='\n\n@ 라이벌_철수4\n[끝]\n\n@ 친선_끝\n[끝]\n\n// TODO 엔진 추가: 피코 1형태·무적 배리어. 기존 그림의 중립 보스로 두고 드론 전멸 후 탈출.\n'
    if ep==14:
        body=body.replace('@ 턴 3\n','@ 턴 3\n[맵] 폭발 19,5\n[맵] 퇴장 pico-shield\n[맵] 등장 pico-shell 19,5\n')
        body+='\n\n// TODO 엔진 추가: 진 합체기 아키텍처 심포니·보스 배리어. 턴 3 연출 후 중립 외피를 기존 무장의 적 보스로 교체.\n'
    if ep==15:
        body=body.replace('[등장] 소네트짱 오른쪽\n','').replace('[퇴장] 소네트짱\n','')
        body=body.replace('@ 격파 pico-mask\n','@ 격파 pico-mask\n[맵] 등장 pico-abyss 13,5\n')
        body=body.replace('@ 격파 pico-abyss\n','@ 격파 pico-abyss\n[맵] 등장 pico-core 16,5\n')
        body+='\n\n@ 사건 코어_접근확인\n[조건] 인접 player pico-core == false -> 코어_접근끝\n[조건] 격파 pico-abyss == true -> 사건 라스트 프롬프트\n[끝]\n\n@ 코어_접근끝\n[끝]\n\n// TODO 엔진 추가: 피코 폼 체인지·클로드 전자원 방어. 기존 기체를 격파→증원하고 정렬은 접근 사건·선택 대사로 표현. 무장 없는 우군 JEPA의 합체기 지원은 기존 라이벌 JEPA 무장의 우군 공격으로 대체.\n@ 엔딩_선택\n'+'\n'.join(f'[조건] 최고호감 == {id} -> 엔딩_판정_{id}'for id,_ in IDS)+'\n[이동] 엔딩_오픈'
        for id,name in IDS:body+=f'\n\n@ 엔딩_판정_{id}\n[조건] 호감 {id} >= 30 -> 엔딩_{name}짱\n[이동] 엔딩_오픈'
        for id,name in IDS:body=body.replace(f'@ 엔딩_{name}짱\n',f'@ 엔딩_{name}짱\n[변수] 완료엔딩 = {id}\n')
        body=body.replace('@ 엔딩_오픈\n','@ 엔딩_오픈\n[변수] 완료엔딩 = open\n')
    return body
