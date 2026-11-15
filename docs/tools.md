# 샘플 제작 도구

엔진은 ENGINE_DIR, 팩은 PACK_DIR, 원고·수치 원본은 STORY_DIR로 선택한다. 기본값은 README를 따른다. 폴더를 옮겨도 개인 절대 경로가 필요 없다.

- port_carbon.py --check: 카본 원고와 승인 패치를 읽어 15화·엔딩·대사 감사를 대조한다. --check를 빼면 팩 대본·샘플 문서만 생성한다.
- saw_check.mjs: 원본 모델의 기체/무장 id, 허용 필드, 팩 검사와 카본 대조.
- saw_balance.mjs: 현재 팩의 실제 코어 수치로 기존 T1~T8·확장 목표를 계산한다. 옛 v1 파일 해시/번들 검사는 현재 팩 검사로 대체했다. 보고서는 tools/out/saw-balance/다.
- saw-author.mjs: 원본 수치 생성기. pack/data를 대상으로 하고 파생 model/문서는 tools/out/saw-author/로 쓴다. 기존 원고·동결 원본에는 쓰지 않는다.
- saw_weapon_anims.mjs: SAW 무장 연출 함수와 sidecar 생성기. 출력은 tools/out/weapon-anims.json이며 팩 원본을 자동 덮어쓰지 않는다. 순수 함수 회귀 검사는 tests에 유지한다.
- art_ingest.py: 엔진의 범용 importer에 SAW 팩·출력 경로만 제공하는 얇은 설정 진입점.
- finish_wave1/2, prepare_wave3/4 및 나머지 wave 도구: PACK_DIR의 현재 data·art와 설정된 ART_SOURCE_DIR을 사용한다. 제작 기록으로 보존했으며 기존 파일을 자동 재생성하지 않았다.
- pack_sim.mjs: SAW 전용 선택·전술 전략. 일반 시뮬레이션 진입점은 엔진 tools/sim.mjs다.
- npm run capture: 현재 팩의 타이틀·새 게임·대화·삽화·전투·진열장·도감을 캡처한다. ENGINE_DIR의 공용 Playwright 검수를 사용하며 BROWSER_PATH가 우선이다. 기존 *browser.mjs 이름은 이 현행 흐름의 별칭으로 통합했다. 이전 단계의 개별 장면 조작 코드는 작업실 docs/studio/production/browser-history에 보존했다. 물결별 모든 그림·표정·연결 회귀는 샘플 tests에서 계속 검사한다.

음원 제작 입력·라이선스 확인 기록은 docs/audio, 실제 배포 음원은 pack/audio다. 작업 원본 PNG·다운로드·그림 생성 기록은 작업실 docs/studio/production에 남기며 공개 팩과 함께 내보내지 않는다.
