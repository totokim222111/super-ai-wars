# 슈퍼 AI 대전

AI 에이전트들과 함께 싸우는 브라우저 SRPG입니다. 15화 이야기와 엔딩, 게임 데이터, 실행 설정, 이식 도구와 검사를 공개합니다. 그림·소리·영상은 [어셋 저장소](https://github.com/totokim222111/super-ai-wars-assets)에서 제공합니다.

## 일반판과 타입 O 미남판

[일반판 ZIP](https://github.com/totokim222111/super-ai-wars/releases/download/v2026.11.17/super-ai-wars-play-2026-11-17.zip) · [타입 O 미남판 ZIP (o-handsome)](https://github.com/totokim222111/super-ai-wars/releases/download/v2026.11.17/super-ai-wars-play-o-handsome-2026-11-17.zip) · [2026-11-17 공개본](https://github.com/totokim222111/super-ai-wars/releases/tag/v2026.11.17)

미리 빌드한 게임입니다. 타입 O 미남판은 타입 O의 상반신 그림 2개와 엔딩 그림 3개를 바꾼 버전입니다. 캐릭터 선택에서 타입 O로 시작하면 바뀐 그림을 볼 수 있습니다.

받은 ZIP을 풀고 AI 도우미에게 아래처럼 부탁해 주세요.

```text
이 폴더에 풀어 둔 슈퍼 AI 대전을 실행해줘.
직접 명령을 실행할 수 있으면 이 폴더를 루트로 하는 로컬 정적 웹 서버를 켜고 index.html을 열어줘. 서버를 켜 둔 채 접속 주소와 종료 방법을 알려줘.
채팅만 가능하면 내 운영체제를 확인한 뒤 실행할 명령을 차례로 알려줘.
```

소스에서 다시 만들려면 아래 설치 요청문을 사용하세요. 타입 O 미남판의 빌드 방법은 [variants/o-handsome](variants/o-handsome/README.md)에 있습니다.

## 실행하기

아래 요청문을 AI 도우미에게 그대로 붙여넣어 주세요. 컴퓨터에서 작업할 수 있는 도우미라면 설치부터 실행까지 부탁하면 됩니다. 채팅만 가능한 도우미에게는 명령을 하나씩 안내받을 수 있습니다.

```text
내 컴퓨터에서 슈퍼 AI 대전을 플레이할 수 있게 설치하고 실행해줘.
직접 명령을 실행할 수 있으면 진행해주고, 채팅만 가능하면 내 운영체제를 물어본 뒤 내가 따라 할 명령을 차례로 알려줘.

1. 기존 파일을 덮어쓰지 않는 새 작업 폴더를 정해줘. Git, Node.js 24 이상, Python 3.11 이상을 확인하고, 없는 것은 설치를 도와줘. Python 그림 검사에 필요한 Pillow와 NumPy도 확인해줘.
2. 아래 세 저장소를 받아줘.
   게임: https://github.com/totokim222111/super-ai-wars
   엔진: https://github.com/totokim222111/super-ai-wars-engine
   어셋: https://github.com/totokim222111/super-ai-wars-assets
3. 게임은 super-ai-wars/에, 엔진은 그 안의 super-ai-wars/engine/에 받아줘. 어셋은 게임 옆의 super-ai-wars-assets/에 받아줘.
4. 엔진 폴더에서 npm ci를 실행해줘.
5. 어셋 저장소의 pack/ 내용만 게임의 pack/에 합쳐줘. README나 .git 폴더는 복사하지 말아줘. 겹치는 pack/audio/pack.json은 두 파일이 같은지 확인해줘.
6. 게임 폴더에서 npm run check와 npm run build를 실행해줘. 공개 저장소에 없는 작업실 원고가 필요한 전체 샘플 테스트 대신 이 두 명령으로 확인해줘. 오류가 나면 실제 로그를 읽고 원인을 해결해줘.
7. 게임 폴더에서 npm run dev로 서버를 켜고, 출력된 주소의 /game.html을 열어줘. 서버가 켜져 있는지 확인하고 접속 주소와 종료 방법을 알려줘.
```

<details>
<summary>직접 설치하려면</summary>

Node.js 24 이상, Python 3.11 이상과 Git이 필요합니다. Python 그림 검사에는 Pillow와 NumPy가 쓰입니다.

```bash
git clone https://github.com/totokim222111/super-ai-wars.git
git clone https://github.com/totokim222111/super-ai-wars-engine.git super-ai-wars/engine
git clone https://github.com/totokim222111/super-ai-wars-assets.git
cd super-ai-wars/engine
npm ci
cd ..
node -e "require('node:fs').cpSync('../super-ai-wars-assets/pack', 'pack', {recursive: true})"
npm run check
npm run build
npm run dev
```

위 명령은 PowerShell과 일반적인 터미널에서 동일하게 실행할 수 있습니다. 개발 서버의 `http://127.0.0.1:5173/game.html`에서 플레이합니다. `v2.html`은 그림·대본·장면을 둘러보는 진열장입니다. 빌드 결과는 `dist/`에, 정적 호스팅용 사본은 `tools/out/release/site/`에 생깁니다.

어셋의 **`pack/` 내용만** 샘플의 `pack/`에 합칩니다. `pack/audio/pack.json`은 두 저장소에서 동일합니다. 복사한 미디어와 로컬 `engine/`은 샘플의 Git 추적에서 제외됩니다. 엔진·어셋은 각각의 저장소에서 관리하세요.

엔진이 다른 위치에 있으면 `ENGINE_DIR`로 지정합니다. 예를 들어 PowerShell에서는 `$env:ENGINE_DIR='../super-ai-wars-engine'`, bash에서는 `export ENGINE_DIR=../super-ai-wars-engine`을 실행합니다.

</details>

## 검사와 배포

`npm run check`는 팩 문법·참조 검사, 승인 수치 재생성 대조, 배포 시점의 컴파일된 대본·이름·대사·어셋 해시 검사를 수행합니다. `npm run build`로 만든 `tools/out/release/site/`를 정적 호스팅에 올리면 됩니다. 시작 파일은 `index.html`입니다. 이 저장소 공개에는 플레이 사이트 배포가 포함되지 않습니다.

제작 원고·스튜디오 기록·제작 원본은 포함하지 않습니다. 이식용 승인 데이터 계약과 컴파일된 게임 데이터를 포함합니다. 원고 대조 이식 도구는 원고를 따로 제공하면 사용할 수 있으며, 원고 위치는 `STORY_DIR`로 지정합니다. 전체 샘플 테스트에는 작업실 전용 원고·PNG 검사가 있어 원고와 검수 자료가 있는 작업실에서 실행합니다. 엔진 테스트는 엔진에 포함된 예제 팩만으로 실행됩니다.

## PLEASE

PLEASE는 "제발 한 번 봐주세요" 하는 장난입니다. 관심 가져주시는 것만으로도 감사합니다.

제가 만든 부분은 마음껏 쓰고, 고치고, 나누고, 판매하셔도 됩니다. 출처 표시도 의무는 아닙니다. 자세한 내용은 [LICENSE](LICENSE)에 적었습니다.

다른 분들이 만든 음악·효과음은 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)와 어셋 저장소의 `pack/audio/LICENSES.md`에 적힌 조건을 따라 주세요. 비공식 팬 게임이며, 등장하는 인물·회사·제품과 관계나 후원이 없습니다. 실존 인물의 초상·이름, 로고·상표는 각 권리자의 것입니다.

[엔진](https://github.com/totokim222111/super-ai-wars-engine) · [게임](https://github.com/totokim222111/super-ai-wars) · [어셋](https://github.com/totokim222111/super-ai-wars-assets)

## English summary

Super AI Wars is a 15-episode browser SRPG. Start by copying the setup request above to an AI helper, or use the expandable manual instructions. Clone this repository, clone the engine into `engine/`, and copy only `pack/` from the sibling assets repository into this repository. Install the engine dependencies with `npm ci`, then run `npm run check`, `npm run build`, and `npm run dev` here. Node.js 24+ and Python 3.11+ are required. Workshop manuscripts and source media are excluded; public checks use compiled-data and media digests. PLEASE is a playful name: your interest alone means a lot. Our own work is free to use, change, share, and sell without conditions; third-party works keep their own terms. This is an unofficial fan game. No hosted play site is deployed as part of this source release.
