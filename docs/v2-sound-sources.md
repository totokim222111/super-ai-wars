# 소리 자료 조사 (2026-11-11)

엔진의 소리 팩(`pack/audio/pack.json`, 규칙은 `pack/audio/README.md`)에 넣을 무료 BGM·효과음 출처를 조사했다. 기준은 두 가지다.

1. **게임에 넣어도 되는가**: 상업 이용 포함, 조건이 명확한가.
2. **공개 저장소에 원본 파일을 둬도 되는가**: 엔진과 게임을 소스 공개할 계획이라, "게임 안에서만 쓸 수 있고 소재 그대로 재배포 금지"인 라이선스는 저장소에 넣을 수 없다.

이미 정한 금지 사항은 그대로다: 상용 게임에서 뽑은 소리(슈퍼로봇대전 원작 포함), 애니메이션 주제가 편곡·MIDI, RPG 만들기 기본 소재, 조건을 확인할 수 없는 팬 소재.

## 결론 요약

| 등급 | 출처 | 라이선스 | 게임 | 공개 저장소 | 쓸 곳 |
|---|---|---|---|---|---|
| A | Kenney 오디오 팩 | CC0, 크레딧 불필요 | 가능 | 가능 | 메뉴음, 타격·폭발·레이저 기본 |
| A | OpenGameArt의 CC0 항목 | 항목마다 다름(CC0만 고름) | 가능 | 가능 | 전투·보스 BGM, 레트로 효과음 |
| A | Freesound의 CC0 항목 | 항목마다 다름(CC0만 고름) | 가능 | 가능 | 변형·서보·빔 같은 메카 효과음 보충 |
| B | 魔王魂(마오다마시이) | CC BY 4.0 + 자체 금지 조항 | 가능(크레딧) | 조건부 | 타이틀·맵·인터미션·이야기 분위기 곡 |
| B | Kevin MacLeod (incompetech) | CC BY 4.0, 크레딧 필수 | 가능(크레딧) | 가능 | 보조 곡 |
| C | Pixabay | 자체 라이선스 | 가능 | **불가**(소재 단독 배포 금지) | 쓰지 않음 |
| C | Sonniss GDC 번들 | 자체 라이선스 | 가능 | **불가**(단독 재배포 금지, AI 학습 금지) | 쓰지 않음 |
| C | DOVA-SYNDROME(현 OpenTracks) | 자체 라이선스 | 가능 | **불가**(음원 배포 금지) | 쓰지 않음 |
| C | soundimage.org (Eric Matyas) | 자체 라이선스(CC BY 비슷 + 추가 제한) | 가능(크레딧) | 불명확 | 쓰지 않음 |
| ? | OtoLogic | CC BY 4.0으로 알려짐 | — | — | 사이트가 막혀 원문 확인 못 함 |

**추천: A등급으로 효과음 전부와 전투·보스 곡을, B등급 魔王魂으로 나머지 곡을 채운다.** C등급은 공개 저장소와 맞지 않아 쓰지 않는다.

## 출처별 확인 내용

### Kenney (kenney.nl) — A
- 공식 지원 페이지: 에셋 페이지의 게임 에셋은 모두 CC0이고, 크레딧은 필요 없다.
- 확인한 팩: **Interface Sounds**(100개, CC0: 버튼 클릭, 확인음 등), **Sci-fi Sounds**(70개, CC0: 엔진·폭발·레이저 등 SF 효과음). UI Audio(50개), Impact Sounds(타격·충돌)는 다른 사이트의 설명으로만 확인했다. 받을 때 팩 안의 License.txt로 다시 확인한다.
- 맞는 효과음: `cursor` `confirm` `cancel` `deny` `text`(Interface/UI), `shot` `explode` `charge` `flash`(Sci-fi), `hit` `heavy`(Impact).

### OpenGameArt (opengameart.org) — A (CC0 항목만)
- 사이트 전체가 아니라 **항목마다 라이선스가 다르다.** CC0만 고른다. 페이지가 자동 조회를 막아서(403) 아래는 검색 결과의 설명으로 확인했다. 받기 전에 각 페이지에서 라이선스를 다시 본다.
- 후보:
  - **JRPG Epic Rock Battle Theme #1** — CC0, 이음매 없는 반복, 도입·반복·전체 판이 따로 있다. 일반 전투 곡 1순위.
  - **Boss Battle #2 [Symphonic Metal]** — CC0, 오케스트라 + 기타, 도입과 반복 부분이 있다(파일 이름이 뒤바뀌어 있다고 함). 보스 곡 후보.
  - **Boss Battle Music** (SubspaceAudio) — CC0, 오케스트라, 이음매 없는 반복.
  - **512 Sound Effects (8-bit style)** (SubspaceAudio) — CC0, 레트로 효과음 512개(약 21MB). 병맛 연출용 보조음.
  - **50 CC0 Sci-Fi SFX** — CC0, 레이저·폭발 소량.
- 주의: 묶음(컬렉션) 페이지의 라이선스 표시는 항목 페이지와 다를 수 있다(GPL로 표시된 예가 있었다). 항목 페이지 기준으로 판단한다.

### Freesound (freesound.org) — A (CC0 항목만)
- 라이선스가 소리마다 다르다(CC0, CC BY, CC BY-NC). **CC0 필터로만** 고른다. CC BY-NC는 쓰지 않는다.
- 메카다운 소리(변형, 서보 모터, 빔 충전, 합체 결합음)는 Kenney·OGA에 부족해서 여기서 보충한다.

### 魔王魂 (maou.audio) — B
- 공식 규약: 배포 음악은 **CC BY 4.0**. 상업 이용 무료, 이용 보고 불필요, **크레딧 필수**("音楽：魔王魂" 등).
- 게임용 암호화 허용, 개작(편곡·자르기) 허용(魔王魂 개작이라는 표시 필요).
- 자체 금지 조항: 생성형 AI 학습에 쓰는 행위, AI 작곡 시스템 편입, NFT, 스트리밍 서비스 배포, **다른 소재 사이트에 곡을 등록하는 것**, 과거 곡 단독 재배포.
- 공개 저장소: CC BY 4.0 자체는 재배포를 허용하지만, 자체 금지 조항(단독 재배포, 소재 사이트 등록)과 겹칠 수 있다. 게임 저장소 안에 크레딧과 함께 두는 것은 "게임에 사용"으로 볼 수 있으나, **엔진만 따로 공개할 때는 魔王魂 곡을 빼고 CC0 곡만 넣는 편이 안전하다.**
- 장점: 곡 수가 매우 많고 일본 게임풍(록·오케스트라·전자음)이라 로봇대전 분위기에 가장 가깝다.

### Kevin MacLeod (incompetech.com) — B
- 무료 사용은 크레디트 표기 조건(CC BY). 크레딧 형식은 곡 이름, "Kevin MacLeod (incompetech.com)", "Licensed under Creative Commons: By Attribution 4.0".
- 오케스트라·영화풍 곡이 많다. 로봇대전 분위기에는 魔王魂보다 덜 맞아 보조로만.

### 쓰지 않는 것 — C
- **Pixabay**: 이용 약관이 소재를 "단독으로"(가공 없이) 배포하는 것을 금지한다. 저장소에 원본 파일을 두면 여기에 걸린다.
- **Sonniss GDC 번들**: 로열티 프리, 크레딧 불필요지만 개별 소리를 단독 파일로 재배포하는 것이 금지되고, 최근 판은 AI 학습 금지 조항이 있다.
- **DOVA-SYNDROME(OpenTracks로 이전)**: 영리 여부와 관계없이 음원 배포 금지, 음원을 파일 그대로 꺼낼 수 있게 하는 사용 금지.
- **soundimage.org**: 크레딧 조건의 자체 라이선스에 추가 제한이 있고, 공개 저장소 재배포에 대한 명확한 문구를 찾지 못했다.

## 엔진에 필요한 소리 목록

- 효과음(합성음을 덮어쓸 이름 14개): `cursor` `confirm` `cancel` `deny` `text` `whoosh` `slash` `shot` `hit` `heavy` `explode` `charge` `flash` `gauge`. 메카 연출을 위해 더할 것: `beam`(빔 발사), `missile`, `transform`(변형·합체), `servo`(기체 움직임), `alarm`(경보), `levelup`.
- BGM(지금 팩이 부르는 이름): `title`, `map`, `battle`, `intermission`. 더 필요한 것: `boss`(보스 전투), `enemy-phase`(적 턴 맵), 이야기 분위기 곡(`tension` 긴장, `comedy` 병맛, `sad` 슬픔, `hope` 반격), 짧은 곡(`victory` 승리, `gameover` 패배).

## 받을 파일 목록 (승인 대기)

라이선스는 각 페이지에서 확인했다(OpenGameArt는 내장 브라우저로 직접, 魔王魂은 공식 규약 페이지, Kenney는 팩 페이지). 용량을 페이지에 적지 않은 것은 "받을 때 확인"으로 둔다.

### 효과음 (모두 CC0, 크레딧 불필요)

| # | 파일 | 출처 | 용량 | 엔진에서 쓸 곳 |
|---|---|---|---|---|
| S1 | Kenney Interface Sounds (100개) | https://kenney.nl/assets/interface-sounds | 받을 때 확인 | `cursor` `confirm` `cancel` `deny` `text` |
| S2 | Kenney Sci-fi Sounds (70개) | https://kenney.nl/assets/sci-fi-sounds | 받을 때 확인 | `shot` `beam` `charge` `flash` `explode` `alarm` |
| S3 | Kenney Impact Sounds (130개) | https://kenney.nl/assets/impact-sounds | 받을 때 확인 | `hit` `heavy` `slash` |
| S4 | The Essential Retro Video Game Sound Effects Collection [512 sounds].zip (SubspaceAudio) | https://opengameart.org/content/512-sound-effects-8-bit-style | 20.6MB | 병맛 연출 보조음, `levelup` `gauge` |

### 곡

| # | 용도(이름) | 곡 | 출처 | 라이선스 | 용량 |
|---|---|---|---|---|---|
| M1 | 일반 전투 `battle` | JRPG Epic Rock Battle Theme #1 (HydroGene): `jrpg_battle_intro.mp3`, `jrpg_battle_loop.mp3` | https://opengameart.org/content/jrpg-epic-rock-battle-theme-1 | CC0 | 40KB + 2.9MB |
| M2 | 보스 전투 `boss` | Boss Battle #2 [Symphonic Metal] (nene), 도입·반복 2파일(파일 이름이 서로 뒤바뀌어 있음) | https://opengameart.org/node/84428 | CC0 | ZIP 약 11MB |
| M3 | 타이틀 `title` | 魔王魂 ネオロック82「君が見ていた世界の果て」(질주감 록, 루프판 있음) | https://maou.audio/bgm_neorock82/ | CC BY 4.0 | 받을 때 확인 |
| M4 | 아군 맵 `map` | 魔王魂 サイバー43「Crossing」(기타 중심, 미래풍) | https://maou.audio/bgm_cyber43/ | CC BY 4.0 | 받을 때 확인 |
| M5 | 적 턴 맵 `enemy-phase` | 魔王魂 ネオロック75「Skull heart」(미디엄 템포, 묵직, 루프판) | https://maou.audio/bgm_neorock75/ | CC BY 4.0 | 받을 때 확인 |
| M6 | 최종 보스 `lastboss` | 魔王魂 ネオロック80「Hallucination」(격렬한 록, 루프판) | https://maou.audio/bgm_neorock80/ | CC BY 4.0 | 받을 때 확인 |
| M7 | 인터미션 `intermission` | 魔王魂 サイバー36「Consciousness is high type」(도시적, 차분) | https://maou.audio/bgm_cyber36/ | CC BY 4.0 | 받을 때 확인 |
| M8 | 병맛 `comedy` | 魔王魂 サイバー41「Space Factory」(초현실, 귀여움, 루프판) | https://maou.audio/bgm_cyber41/ | CC BY 4.0 | 받을 때 확인 |
| M9 | 긴장 `tension` | 魔王魂 ネオロック83「厳戒態勢」(긴장감 있는 슬로 록) | https://maou.audio/bgm_neorock83/ | CC BY 4.0 | 받을 때 확인 |
| M10 | 슬픔 `sad` | 魔王魂 ピアノ24(슬프지만 용기를 주는 피아노) | https://maou.audio/bgm_piano24/ | CC BY 4.0 | 받을 때 확인 |
| M11 | 반격·희망 `hope` | 魔王魂 ネオロック74「Speed Rush」(조금 격렬한 기타, 루프판) | https://maou.audio/bgm_neorock74/ | CC BY 4.0 | 받을 때 확인 |
| M12 | 승리 `victory` | 魔王魂 ジングル03(승리 징글) | https://maou.audio/game_jingle03/ | CC BY 4.0 | 받을 때 확인 |
| M13 | 패배 `gameover` | 魔王魂 ジングル08(전멸 징글) | https://maou.audio/game_jingle08/ | CC BY 4.0 | 받을 때 확인 |

- 魔王魂 곡은 ogg(루프판이 있으면 루프판)로 받는다. 크레딧 "音楽：魔王魂"을 `pack.json`의 `author`에 넣어 크레딧 화면에 나오게 한다. 이 곡들은 **게임 팩(saw)에만** 넣고, 엔진을 따로 공개할 때의 예제 팩에는 CC0(M1, M2, S1~S4)만 넣는다.
- Freesound의 메카 소리(변형·서보·합체)는 내려받으려면 계정 로그인이 필요해서 이번 목록에서 뺐다. 필요하면 사용자가 로그인한 뒤 CC0 소리만 골라 따로 받는다.
- 받는 방법: 내려받은 원본(zip 등)은 새 빈 폴더 `engine/audio-src/downloads/<출처>/`에 두고(저장소에 올리지 않음), 쓸 파일만 골라 `pack/audio/{sfx,bgm}/`로 옮기며 각 팩의 License 파일을 다시 확인한다.

## 다음 단계 (사용자 승인 필요)

1. **받을 파일 목록 확정**: 위 추천대로 고른 파일의 이름·출처·용량을 표로 보여 드리고, 승인을 받은 뒤에만 내려받는다.
2. 받은 파일은 각 페이지와 License 파일로 라이선스를 다시 확인하고, `pack.json`에 `license`·`source`·`author`를 채운다. 크레딧 화면에 자동으로 나온다.
3. 반복 구간(`loopStart`/`loopEnd`)을 맞추고, 실제 소리는 사용자가 들어 보고 확정한다(개발 환경에서는 들을 수 없다).


## 받은 결과

2026-11-11, 승인 S1~S4·M1~M13만 수신했다. 목록 밖 음원은 받지 않았다. 원본은 `audio-src/downloads/{kenney,opengameart,maou}/`에 두고 저장소에서 제외했다. ZIP은 경로 탈출·절대 경로·심볼릭 링크를 거부하고 오디오·텍스트만 추출했다. 받은 실행 파일·스크립트는 실행하지 않았고 Python 작업은 모두 `-I`로 실행했다.

| 승인 | 받은 파일(바이트) | 라이선스 재확인 | 공식 페이지 |
|---|---|---|---|
| S1 | kenney_interface-sounds.zip (834,536) | 압축 내부 License.txt: CC0 | [interface-sounds](https://kenney.nl/assets/interface-sounds) |
| S2 | kenney_sci-fi-sounds.zip (5,875,104) | 압축 내부 License.txt: CC0 | [sci-fi-sounds](https://kenney.nl/assets/sci-fi-sounds) |
| S3 | kenney_impact-sounds.zip (800,850) | 압축 내부 License.txt: CC0 | [impact-sounds](https://kenney.nl/assets/impact-sounds) |
| S4 | The Essential Retro Video Game Sound Effects Collection [512 sounds].zip (20,582,855) | 항목 페이지 License(s): CC0 | [retro](https://opengameart.org/content/512-sound-effects-8-bit-style) |
| M1 | jrpg_battle_intro.mp3 (40,287) / jrpg_battle_loop.mp3 (2,893,343) | 항목 페이지 License(s): CC0 | [battle](https://opengameart.org/content/jrpg-epic-rock-battle-theme-1) |
| M2 | boss_battle_#2_metal_pack.zip (11,010,042) | 항목 페이지 License(s): CC0 | [boss](https://opengameart.org/node/84428) |
| M3 | maou_loop_bgm_neorock82.ogg (2,537,089) | [공식 규약](https://maou.audio/rule/): CC BY 4.0 | [title](https://maou.audio/bgm_neorock82/) |
| M4 | maou_bgm_cyber43.ogg (2,658,064) | [공식 규약](https://maou.audio/rule/): CC BY 4.0 | [map](https://maou.audio/bgm_cyber43/) |
| M5 | maou_loop_bgm_neorock75.ogg (2,427,205) | [공식 규약](https://maou.audio/rule/): CC BY 4.0 | [enemy-phase](https://maou.audio/bgm_neorock75/) |
| M6 | maou_loop_bgm_neorock80.ogg (1,778,655) | [공식 규약](https://maou.audio/rule/): CC BY 4.0 | [lastboss](https://maou.audio/bgm_neorock80/) |
| M7 | maou_loop_bgm_cyber36.ogg (3,268,048) | [공식 규약](https://maou.audio/rule/): CC BY 4.0 | [intermission](https://maou.audio/bgm_cyber36/) |
| M8 | maou_loop_bgm_cyber41.ogg (3,697,389) | [공식 규약](https://maou.audio/rule/): CC BY 4.0 | [comedy](https://maou.audio/bgm_cyber41/) |
| M9 | maou_bgm_neorock83.ogg (1,905,880) | [공식 규약](https://maou.audio/rule/): CC BY 4.0 | [tension](https://maou.audio/bgm_neorock83/) |
| M10 | maou_bgm_piano24.ogg (1,869,716) | [공식 규약](https://maou.audio/rule/): CC BY 4.0 | [sad](https://maou.audio/bgm_piano24/) |
| M11 | maou_loop_bgm_neorock74.ogg (1,863,913) | [공식 규약](https://maou.audio/rule/): CC BY 4.0 | [hope](https://maou.audio/bgm_neorock74/) |
| M12 | maou_game_jingle03.ogg (164,979) | [공식 규약](https://maou.audio/rule/): CC BY 4.0 | [victory](https://maou.audio/game_jingle03/) |
| M13 | maou_game_jingle08.ogg (224,987) | [공식 규약](https://maou.audio/rule/): CC BY 4.0 | [gameover](https://maou.audio/game_jingle08/) |

Kenney의 세 License.txt를 실제로 읽었다. OpenGameArt M2도 컬렉션이 아닌 해당 항목 페이지의 CC0 표시를 확인했다. 魔王魂은 규약의 CC BY 4.0 경로를 사용하고 `author: "魔王魂"`, `credit: "音楽：魔王魂"`을 기록했다. 재인코딩 사실은 pack의 modifications와 아래 이용 기록에 남겼다. 별도 소재 모음으로 배포하지 않으며 원곡을 학습·작곡 시스템에 쓰지 않는다. 로그인·결제·약관 동의 창은 필요 없었다. 처음의 직접 요청 403은 공식 다운로드 링크/곡 페이지 Referer를 사용해 해결했다.

### 효과음 선별

청취한 결과가 아니다. 이름, 무음 제거 후 길이, 10ms 구간 RMS, 감쇠, FFT 에너지로 선별했다. 시작/끝 비는 각 구간 RMS를 최대 구간 RMS로 나눈 값이다. 저/고 대역은 각각 300Hz 미만/3kHz 초과 에너지 비율이다. 입력은 최대 1.95초로 제한하고 가장자리 페이드 후 OGG로 저장했으며, 표의 gain을 재생 때 곱한다.

| 엔진 이름 | 승인·원본 | 초 | gain | 시작/끝 RMS 비 | 중심 Hz · 저/고 비율 | 고른 이유 |
|---|---|---:|---:|---|---|---|
| `cursor` | S1 `click_001.ogg` | 0.017 | 0.5996 | 1.00/1.00 | 1718 · 28%/18% | 짧은 클릭과 빠른 감쇠 |
| `confirm` | S1 `confirmation_002.ogg` | 0.502 | 0.758 | 1.00/0.01 | 3187 · 0%/61% | 클릭보다 긴 확인음 |
| `cancel` | S1 `back_001.ogg` | 0.056 | 0.8665 | 1.00/0.58 | 2029 · 8%/21% | 짧게 되돌아가는 인터페이스음 |
| `deny` | S1 `error_002.ogg` | 0.163 | 0.7201 | 1.00/0.07 | 7104 · 2%/59% | 강한 고주파 시작으로 오류 구분 |
| `text` | S1 `tick_001.ogg` | 0.025 | 0.2376 | 1.00/0.00 | 4818 · 0%/69% | 매우 짧은 고주파 틱, 반복 피로를 줄여 작게 |
| `whoosh` | S2 `thrusterFire_000.ogg` | 0.380 | 0.7821 | 0.50/0.83 | 1366 · 91%/8% | 추진기의 넓은 잡음 대역을 짧게 자름 |
| `slash` | S1 `scratch_002.ogg` | 0.138 | 0.5445 | 0.61/0.00 | 6143 · 0%/95% | 짧고 고주파가 많은 마찰음 |
| `shot` | S2 `laserSmall_000.ogg` | 0.233 | 0.7812 | 1.00/0.07 | 249 · 80%/0% | 짧은 소형 레이저 |
| `hit` | S3 `impactMetal_light_000.ogg` | 0.180 | 1.0332 | 1.00/0.01 | 2718 · 0%/35% | 금속의 빠른 타격과 잔향 |
| `heavy` | S3 `impactPlate_heavy_000.ogg` | 0.307 | 1.1183 | 1.00/0.02 | 111 · 95%/0% | 두꺼운 판 타격, 보통 타격보다 긴 감쇠 |
| `explode` | S2 `explosionCrunch_001.ogg` | 1.353 | 0.6269 | 1.00/0.02 | 219 · 86%/1% | 넓은 잡음 대역과 긴 감쇠 |
| `charge` | S2 `forceField_002.ogg` | 0.670 | 0.4222 | 0.05/0.01 | 273 · 93%/0% | 낮은 대역의 지속 전자음 |
| `flash` | S2 `laserRetro_003.ogg` | 0.252 | 0.2468 | 1.00/0.03 | 2788 · 0%/15% | 짧고 밝은 전자음 |
| `gauge` | S4 `sfx_menu_move3.wav` | 0.073 | 0.4333 | 0.97/0.30 | 2868 · 0%/37% | 아주 짧은 레트로 피드백음 |
| `beam` | S2 `laserLarge_000.ogg` | 0.443 | 0.9194 | 1.00/0.00 | 1381 · 69%/20% | 소형 사격보다 길고 밝은 대형 레이저 |
| `missile` | S2 `thrusterFire_002.ogg` | 0.752 | 0.9031 | 0.37/0.19 | 1499 · 89%/10% | 추진 잡음의 시작 구간 |
| `transform` | S2 `doorClose_001.ogg` | 0.511 | 0.778 | 0.02/0.72 | 13404 · 0%/98% | 금속 구동부가 닫히는 짧은 기계음 |
| `servo` | S2 `doorOpen_001.ogg` | 0.512 | 0.6057 | 1.00/0.01 | 13367 · 0%/98% | 기계 구동부의 열림 |
| `alarm` | S4 `sfx_alarm_loop1.wav` | 0.803 | 0.2695 | 0.37/0.00 | 1758 · 6%/12% | 규칙적으로 반복되는 높은 경보 파형 |
| `levelup` | S4 `sfx_sounds_powerup3.wav` | 0.418 | 0.2549 | 0.93/0.15 | 1036 · 2%/6% | 파워업 계열의 구별되는 전자음 |

파형 모음은 `tools/out/audio/sfx-waveforms.png`, 수치와 자른 위치는 `audio-src/selection.json`이다. 서보·변형은 승인된 Kenney 기계음으로 채웠으며 별도 Freesound 파일은 받지 않았다.

### 곡 연결

| 엔진 이름 | 승인·곡 | 도입/반복 시작(초) | 반복 끝(초) | 재생 |
|---|---|---:|---:|---|
| `battle` | M1 JRPG Epic Rock Battle Theme #1 | 1.623946 | 115.292880 | 구간 반복 |
| `boss` | M2 Boss Battle #2 [Symphonic Metal] | 39.724150 | 66.206916 | 구간 반복 |
| `title` | M3 ネオロック82「君が見ていた世界の果て」 | 0.000000 | 102.000000 | 구간 반복 |
| `map` | M4 サイバー43「Crossing」 | 0.000000 | 107.157415 | 구간 반복 |
| `enemy-phase` | M5 ネオロック75「Skull heart」 | 0.000000 | 101.813946 | 구간 반복 |
| `lastboss` | M6 ネオロック80「Hallucination」 | 0.000000 | 70.469569 | 구간 반복 |
| `intermission` | M7 サイバー36「Consciousness is high type」 | 0.000000 | 124.787483 | 구간 반복 |
| `comedy` | M8 サイバー41「Space Factory」 | 0.000000 | 156.444467 | 구간 반복 |
| `tension` | M9 ネオロック83「厳戒態勢」 | 0.000000 | 87.187506 | 구간 반복 |
| `sad` | M10 ピアノ24 | 0.000000 | 88.812018 | 구간 반복 |
| `hope` | M11 ネオロック74「Speed Rush」 | 0.000000 | 76.133175 | 구간 반복 |
| `victory` | M12 ジングル03 | 0.000000 | 11.467755 | 1회 |
| `gameover` | M13 ジングル08 | 0.000000 | 17.449796 | 1회 |

M1은 승인된 intro(1.623945578초)+loop(113.668934240초)를 PCM으로 연결한 `battle.ogg` 한 파일이다. 별도 full MP3는 받지 않았다. M2는 공식 페이지의 파일명 반전 안내와 실측 길이를 함께 확인해 `_loop.wav`(39.724149660초)를 도입으로, `_opening.wav`(26.482766440초)를 반복으로 연결했다. 두 파일 사이에 침묵을 삽입하지 않았다. 魔王魂은 페이지에서 제공하는 ogg 루프판을 우선했고, 별도 루프판이 없는 map/tension/sad는 원곡 전체를 반복한다. 징글 두 곡은 한 번만 재생한다.

곡은 스테레오 44.1kHz OGG/Vorbis 목표 144kbps, 효과음은 모노 44.1kHz 목표 96kbps다. 공개 팩에는 선별한 **33개 음원, 17,625,942바이트(16.81MiB)**만 넣었다. ZIP/전체 묶음은 공개 audio 폴더에 넣지 않았다.

### 엔진 연결과 확인

게임 music에 13개 이름을 연결했다. 적 맵 페이즈는 enemy-phase, 적의 코어 LL 등급/보스 태그는 boss, 피코 형태는 lastboss, 결과는 victory/gameover다. 화면을 걷으면 아래 화면의 현재 곡을 복원한다. 없는 대본 음악은 팩 경고만 남기고 재생 중인 곡을 유지한다.

1화 도입 map, 2화 미술관 도입 tension, 두 인터미션 안내 intermission, 티타임 comedy 지시를 추가했다. 대사 글은 바꾸지 않았다. 소리 진열장은 효과음 20개·곡 13개와 쪽 넘김 크레딧을 표시한다.

못 받은 항목: 없음. 실제 청취는 할 수 없었다. 사용자가 각 효과음의 어울림·대사 글자음의 피로도·음악 대비 타격음 크기·M1/M2 및 루프판 경계의 이음매를 귀로 확인해야 한다.
