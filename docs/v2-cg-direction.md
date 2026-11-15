# 삽화 카드·톤 규칙

`[삽화] 그림id | 인물 이름 | 삽화 제목 | 톤 | 보관 설명` 형식이다. 마지막 두 항목은 선택이며 톤 기본값은 `강림`이다. 설명은 Cue의 `description`에 보존하지만 Director에 전달해 그리지 않는다. 카드의 두 줄은 인물 이름과 위시리스트 제목이다. 이름이 없는 `[삽화] 그림id`는 카드 없는 그림 보기다. 알 수 없는 톤은 대본 검사 오류다.

| 톤 | 연출 | 지정 그림 (cg- 접두사 생략) |
|---|---|---|
| 강림 | 기존 번쩍임·속도선·흔들림·heavy/slash와 큰 이름 카드 | gpi-entrance, claude-liberation, grok-wheelie, llama-captain, deepseek-whale, qwen-arrival, minimax-runway, kimi-scrolls, lecun-jepa, vertical-spring-combo, pico-mask-descent |
| 개그 | 0.23초 팝 줌, 작은 1.5px 흔들림, 낮은 볼륨 confirm. 속도선 없음 | gpi-flat-apology, gem-tumble, exaone-crescent, glm-unmasked |
| 섬뜩 | 먼저 어둡게 전환한 뒤 1.8초 페이드인, 작은 카드, 느린 12초 줌. 속도선·흔들림 없음. cg-cold는 외부 파일 없는 낮은 사인파 합성음 | gray-locked-logout, pico-shoggoth |
| 감성 | 1.1초 부드러운 페이드인과 작은 카드, 느린 줌. 번쩍임·속도선·흔들림·효과음 없음 | sisters-reconcile, gpi-frozen-hangar, pico-aligned, ending-* 8장, grok-timeline-run |

`tools/wave5_bindings.py`에서 총 29곳의 제목·톤을 지정하고 `port_carbon.py`가 대본을 재현한다. 강림 11·개그 4·섬뜩 2·감성 12곳이다. 모든 톤은 입력으로 닫으며, 감성·섬뜩·개그는 레터박스와 아래쪽 대화용 마스크를 사용하지 않는다.

삽화는 **화면 끝까지 자연스럽게 이어지는 완전한 장면**으로 그린다. 아래 3분의 1을 비우거나 탁자·그림자 띠로 채우라는 이전 브리프는 폐기했다. 배경용 대화 그림의 어둡고 단순한 아래쪽 규칙은 유지한다. 이전 시도의 프롬프트 txt는 이력으로 보존하며, 현재 수정 프롬프트에는 그 지시를 넣지 않는다.

8화는 같은 옥상 정원의 밤 변형 `bg-rooftop-garden-night`를 쓰며 낮 변형 `bg-rooftop-garden`도 남긴다. `LICENSE`·`THIRD_PARTY_NOTICES.md`는 원문 그대로 배포 루트에 복사하고 크레딧 마지막 항목에서 연다. 타이틀의 팬 게임·라이선스 안내는 하단 조작 안내보다 위에 둔다.
