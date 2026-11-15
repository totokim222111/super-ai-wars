# 슈퍼 AI 대전

AI 에이전트들과 함께 싸우는 브라우저 SRPG입니다. 15화 이야기와 엔딩, 게임 데이터, 실행 설정, 이식 도구와 검사를 공개합니다. 그림·소리·영상은 [어셋 저장소](https://github.com/totokim222111/super-ai-wars-assets)에서 제공합니다.

## 실행하기

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

위 명령은 PowerShell과 일반적인 터미널에서 동일하게 실행할 수 있습니다. 개발 서버의 `http://127.0.0.1:5173/game.html`에서 플레이합니다. `v2.html`은 그림·대본·장면을 둘러보는 진열장입니다. 빌드 결과는 `dist/`에 생깁니다.

어셋의 **`pack/` 내용만** 샘플의 `pack/`에 합칩니다. `pack/audio/pack.json`은 두 저장소에서 동일합니다. 복사한 미디어와 로컬 `engine/`은 샘플의 Git 추적에서 제외됩니다. 엔진·어셋은 각각의 저장소에서 관리하세요.

엔진이 다른 위치에 있으면 `ENGINE_DIR`로 지정합니다. 예를 들어 PowerShell에서는 `$env:ENGINE_DIR='../super-ai-wars-engine'`, bash에서는 `export ENGINE_DIR=../super-ai-wars-engine`을 실행합니다.

## 검사와 배포

`npm run check`는 팩 문법·참조 검사, 승인 수치 재생성 대조, 배포 시점의 컴파일된 대본·이름·대사·어셋 해시 검사를 수행합니다. `npm run build`로 만든 `dist/`는 정적 호스팅에 올릴 수 있습니다. 이 저장소 공개에는 플레이 사이트 배포가 포함되지 않습니다.

제작 원고·스튜디오 기록·제작 원본은 포함하지 않습니다. 이식용 승인 데이터 계약과 컴파일된 게임 데이터를 포함합니다. 원고 대조 이식 도구는 원고를 따로 제공하면 사용할 수 있으며, 원고 위치는 `STORY_DIR`로 지정합니다. 전체 샘플 테스트에는 작업실 전용 원고·PNG 검사가 있어 원고와 검수 자료가 있는 작업실에서 실행합니다. 엔진 테스트는 엔진에 포함된 예제 팩만으로 실행됩니다.

## 라이선스

프로젝트 제작물은 [PLEASE License](LICENSE)입니다. 비공식 팬 게임이며 실존 인물·회사·AI 제품의 보증·후원과 무관합니다. 실존 인물·초상·상표 등 제3자 권리는 허락 대상이 아닙니다. 음악 등 개별 조건은 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)와 어셋 저장소의 `pack/audio/LICENSES.md`를 따릅니다. 시네마틱 영상은 작가 제작물이며 오리지널 그림과 같은 PLEASE License를 적용합니다.

[엔진](https://github.com/totokim222111/super-ai-wars-engine) · [게임](https://github.com/totokim222111/super-ai-wars) · [어셋](https://github.com/totokim222111/super-ai-wars-assets)

## English summary

Super AI Wars is a 15-episode browser SRPG. Clone this repository, clone the engine into `engine/`, and copy only `pack/` from the sibling assets repository into this repository. Install the engine dependencies with `npm ci`, then run `npm run check`, `npm run build`, and `npm run dev` here. Node.js 24+ and Python 3.11+ are required. Workshop manuscripts and source media are excluded; public checks use compiled-data and media digests. This unofficial fan game uses PLEASE License with separate third-party rights and audio notices. No hosted play site is deployed as part of this source release.
