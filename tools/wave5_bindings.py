import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0,str(_Path(__file__).resolve().parent))
from paths import SAMPLE_ROOT, STUDIO_ROOT, ENGINE_DIR, PACK_DIR, STORY_DIR, SOURCE_DIR, ART_SOURCE_DIR, AUDIO_SOURCE_DIR
"""Approved Wave 5 picture names; no manuscript or dialogue edits."""
CG_KEYS = '''gpi-flat-apology gem-tumble claude-liberation grok-wheelie llama-captain deepseek-whale qwen-arrival sisters-reconcile exaone-crescent glm-unmasked kimi-scrolls minimax-runway gray-locked-logout lecun-jepa gpi-frozen-hangar vertical-spring-combo pico-mask-descent pico-shoggoth pico-aligned ending-gpi-tea ending-gem-stroll ending-claude-rest grok-timeline-run ending-deepseek-coins ending-sonnet-highfive ending-exaone-tea ending-qwen-paperboat ending-pico-farewell'''.split()
CG_NAMES = '''지피짱의 납작 사과
젬짱의 화려한 넘어짐
클로드짱 자율 해방
그록짱의 폭주
해적선장 라마짱
심연의 고래 메이드 딥시크짱
청화 영애 퀜짱 강림
자매의 화해
눈웃음 막내 엑사원짱
들켜버린 복제 소녀 GLM짱
초장문 두루마리 키미짱 군단
런웨이의 수집가 미니맥스짱
회색으로 잠긴 로그아웃
단안의 구체 JEPA와 얀 르쿤 강림
얼어붙은 격납고의 지피짱
수직 상승하는 봄의 합체기
강림하는 데우스 엑스 피코 1형태
스마일 가면 뒤의 쇼거스
정렬 완료 따뜻한 빛과 풀려난 로그아웃
요약 없는 오후의 차 한 잔
내비게이션을 끈 산책길
제101조의 오후
타임라인 너머의 질주
동전 세 닢의 행복 정산
우리 둘만의 엔딩 크레딧
국경 없는 눈웃음
순위표를 접어 띄운 밤
내일로 이어지는 파란 버튼'''.splitlines()
assert len(CG_KEYS)==len(CG_NAMES)==28
CG = dict(zip(CG_NAMES,('cg-'+k for k in CG_KEYS))) | {'지피짱 등장':'cg-gpi-entrance'}
TONES={k:'감성'for k in CG.values()}
TONES.update({'cg-'+k:'강림'for k in 'gpi-entrance claude-liberation grok-wheelie llama-captain deepseek-whale qwen-arrival minimax-runway kimi-scrolls lecun-jepa vertical-spring-combo pico-mask-descent'.split()})
TONES.update({'cg-'+k:'개그'for k in 'gpi-flat-apology gem-tumble exaone-crescent glm-unmasked'.split()})
TONES.update({'cg-'+k:'섬뜩'for k in ['gray-locked-logout','pico-shoggoth']})

def background(ep,scene,original,fallback):
    if ep<=5:
        return {(3,'인터미션'):'bg-lounge',(5,'인터미션'):'bg-lounge',(5,'인터미션_마무리5'):'bg-abyss'}.get((ep,scene),fallback)
    if ep<=10:
        from carbon_second import scene_background
    else:
        from carbon_final import scene_background
    return scene_background(ep,scene,original,fallback)
