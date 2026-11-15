import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR
"""원문 대사를 유지한 채 v2 범용 규칙으로 기존 대체 연출을 교체한다."""
import re

PICO = "형태 {id} = mask:pico-form-1-episode-14 / abyss:pico-form-2-episode-15 / core:pico-form-3-episode-15"
WISHLIST = [
    "- 2~15화 · **젬 나노/프로/울트라 전술 폼** | 젬 | 기존 세대 그림을 재사용. 같은 그림에서 공격·장갑·회피를 구분하며 전용 실루엣 요청.",
    "- 6~15화 · **퀜 비녀 3모드** | 퀜 | 기존 퀜 그림 재사용. 악의축 공격형·얀데레 반격형·메가데레 지원형 각각 비녀 상태 그림 요청."
]

def forms(id, mech, qwen=False):
    if qwen:
        return [f"형태 {id} = 악의축:{mech} / 얀데레:{mech} / 메가데레:{mech}",
                f"형태효과 {id} 악의축: 공격 600 / 장갑 -150",
                f"형태효과 {id} 얀데레: 반격 140 / 회피 10",
                f"형태효과 {id} 메가데레: 지원 1 / 공급 16 / 장갑 200"]
    return [f"형태 {id} = 나노:{mech} / 프로:{mech} / 울트라:{mech}",
            f"형태효과 {id} 나노: 회피 20 / 공격 -300",
            f"형태효과 {id} 프로: 장갑 150",
            f"형태효과 {id} 울트라: 공격 450 / 장갑 -100"]

def rules(ep, text):
    rows=text.splitlines()
    if ep==2:
        rows=[s.replace('가챠_고정성공','가챠 타일 당첨').replace('가챠_고정실패','가챠 타일 당첨') for s in rows if not s.startswith('보상: 사건 가챠_고정')]
        rows+=['가챠 luck 변수 가챠_버프당첨 = HP 30 / VRAM 50 / 크레딧 200 / 이동 -2 1 / 꽝','가챠지역 luck = gacha-good, gacha-bad']
    if ep==3: rows+=['전투 사건 claude 5 → 사건 5시간 한도 도달']
    if ep==4:
        rows=[s.replace('아군 진입 기한 5 생존 grok','아군 진입 생존 grok')for s in rows]
        rows+=['가속 saw-boost 이동 2']
    if ep==6:
        rows=[s.replace('대기: qwen-rival','대기 제3: qwen-rival').replace('10,1','13,7').replace('9,1','13,6').replace('11,1','14,7') for s in rows]
        rows=[re.sub(r'((?:qwen-rival|guard-1|guard-2) = [^/]*?) 대기 파일럿',r'\1 추적 deepseek-rival 파일럿',s)for s in rows]
        rows+=forms('qwen-rival','qwen-generation-1',True)
    if ep==6:
        rows=[s.replace('deepseek-rival = deepseek-housing-episode-6 15,8 레벨 1 대기','deepseek-rival = deepseek-housing-episode-6 19,8 레벨 1 방어') for s in rows]
    if ep==7:
        rows=[re.sub(r'muse = (.*?) 13,3',r'muse = \1 15,0',s).replace('15,0 레벨 1 공격','15,0 레벨 1 방어') for s in rows]
    if ep==9:
        rows=[s.replace('glm-episode-9 13,5','glm-episode-9 15,9').replace('kimi-episode-9 12,1','kimi-episode-9 14,1').replace('kimi 12,1','kimi 14,1').replace('15,9 레벨 1 대기','15,9 레벨 1 방어').replace('14,1 레벨 1 대기 파일럿 kimi','14,1 레벨 1 방어 파일럿 kimi')for s in rows]
    if ep==10:
        rows=[s.replace('29,2 레벨 1 방어 파일럿 minimax','29,2 레벨 1 대기 파일럿 minimax')for s in rows]
        rows+=['복사 minimax 경감 30 대사 꺄하~! 너희 공격 데이터 진짜 맛있다!']
    if ep==11:
        rows=[s.replace('중립: jepa-shield','적: jepa-shield') for s in rows]
        rows+=['배리어 jepa-shield 90']
    if ep==12:
        rows=[s.replace('중립: jepa-shield','적: jepa') for s in rows if not s.startswith('대기: jepa =')]
        rows+=['배리어 jepa 무적 합체기 horizon', '합체기 horizon = gpi + claude 무장 claude-generation-3-weapon-4 조건 변수 세계언어공명 이름 컨텍스트 호라이즌 대사 관측 회선 수신 완료!']
    if ep==13:
        rows=[s.replace('대기 중립: pico-shield','대기: pico-shield') for s in rows]
        rows+=[PICO.format(id='pico-shield'),'배리어 pico-shield 무적']
    if ep==14:
        rows=[s.replace('19,5','17,5')for s in rows]
        rows=[s.replace('jepa-help 3,9','jepa-help 10,6').replace('ally-jepa-episode-14 3,9','ally-jepa-episode-14 10,6')for s in rows]
        rows=[s.replace('중립: pico-shield','적: pico-shell') for s in rows if not s.startswith('대기: pico-shell')]
        rows+=[PICO.format(id='pico-shell'),'배리어 pico-shell 무적 합체기 symphony','합체기 symphony = gpi + jepa-help 무장 gpi-generation-4-weapon-4 조건 변수 심포니해금 이름 아키텍처 심포니 대사 ◈━━━■■■!!']
    if ep==15:
        rows=[s.replace('pico-mask','pico') for s in rows if not s.startswith(('대기: pico-abyss','대기 중립: pico-core','승리:'))]
        rows+=['승리: 형태 pico core & 인접 player pico',PICO.format(id='pico')]
    joined='\n'.join(rows)
    for id in ['gem','qwen']:
        match=re.search(r'(?<![\w-])'+id+r' = ([\w-]+)',joined)
        if match and (id=='qwen' or ep>=2): rows+=forms(id,match[1],id=='qwen')
    return '\n'.join(rows)

def grid(ep, text):
    if ep==6:return '\n'.join(s+' . . . .'for s in text.splitlines())
    if ep!=4:return text
    rows=[s.split() for s in text.splitlines()]
    for y in [4,5,6]:
        for x in range(3,len(rows[y])-2):
            if rows[y][x] in ['.','=']:rows[y][x]='>'
    return '\n'.join(' '.join(row)for row in rows)

def body(ep, text):
    # 대체 구현 설명만 제거한다. 삽화 TODO와 카본의 규칙 메모는 보존한다.
    text=re.sub(r'(?m)^// TODO 엔진 추가[^\n]*\n?', '',text)
    if ep==2:
        text=re.sub(r'\n@ 사건 가챠_고정성공\n.*?(?=\n@ |$)','',text,flags=re.S)
        text=re.sub(r'\n@ 사건 가챠_고정실패\n.*?(?=\n@ |$)','',text,flags=re.S)
    if ep==3: text=re.sub(r'\n@ 턴 6\n.*?(?=\n@ |$)','',text,flags=re.S)
    if ep==6:
        text=text.replace('@ 퀜_내기성공\n','@ 퀜_내기성공\n[조건] 격파진영 qwen-rival != player -> 퀜_격파대사\n')
        text=re.sub(r'\n@ 적 턴 3\n.*?(?=\n@ |$)','',text,flags=re.S)
        text=text.replace('@ 조우 qwen-rival\n','@ 조우 qwen-rival\n[맵] 폼 qwen-rival 메가데레\n')
        text+='\n\n@ 제3 턴 4\n[조건] 생존 qwen-rival == false -> 비녀_종료\n[맵] 폼 qwen-rival 얀데레\n[끝]\n\n@ 비녀_종료\n[끝]'
    if ep==8:
        text=text.replace('@ 도입\n','@ 도입\n[맵] 통행 7,2~7,8 막힘\n')
        text=text.replace('@ 격파 cookie-1\n','@ 격파 cookie-1\n[맵] 통행 7,2~7,8 열림\n')
    if ep==12:
        text=text.replace('[맵] 폭발 17,5\n','')
        text=text.replace('[맵] 퇴장 jepa-shield\n','').replace('[맵] 등장 jepa 17,5\n','')
        text=text.replace('// JEPA의 월드모델 물리 배리어 완전 해제','// 합체기 해금. 실제 배리어 파훼는 합체기 사용 시 적용한다.')
    if ep==13: text=text.replace('[맵] 등장 pico-shield 14,5','[맵] 등장 pico-shield 14,5\n[맵] 폼 pico-shield mask')
    if ep==14:
        text=text.replace('[맵] 폭발 19,5\n','')
        text=text.replace('[맵] 퇴장 pico-shield\n','').replace('[맵] 등장 pico-shell 19,5\n','[맵] 폼 pico-shell abyss\n[변수] 심포니해금 = true\n')
    if ep==15:
        text=text.replace('@ 격파 pico-mask','@ 격파 pico mask').replace('@ 격파 pico-abyss','@ 격파 pico abyss').replace('@ 조우 pico-mask','@ 조우 pico')
        text=text.replace('[맵] 등장 pico-abyss 13,5','[맵] 폼 pico abyss')
        text=text.replace('[맵] 등장 pico-core 16,5','[맵] 폼 pico core\n[맵] 이동 pico 16,5\n[맵] 배리어 무적 pico\n[맵] 배리어 90 claude\n[맵] 소진 claude')
        text=text.replace('인접 player pico-core','인접 player pico').replace('격파 pico-abyss','격파형태 pico abyss')
        text=text.replace('// 맵 중앙에 2형태(심연 쇼거스) 즉시 증원','// 같은 피코 유닛의 2형태(심연 쇼거스) 전환')
    return text.strip()
