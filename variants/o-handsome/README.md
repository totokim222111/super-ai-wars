# 타입 O 미남판 (o-handsome)

[2026-11-17 업데이트 2 실행용 ZIP](https://github.com/totokim222111/super-ai-wars/releases/download/v2026.11.17-r2/super-ai-wars-play-o-handsome-2026-11-17.zip) · [일반판과 함께 받기](https://github.com/totokim222111/super-ai-wars/releases/tag/v2026.11.17-r2)

타입 O의 상반신 그림 2개와 엔딩 그림 3개를 바꾼 버전입니다. 게임에서 타입 O를 선택하면 바뀐 그림을 볼 수 있습니다. 대사·규칙·실행 코드·영상은 일반판과 같습니다.

## AI 도우미에게 부탁하기

```text
슈퍼 AI 대전 소스로 타입 O 미남판(o-handsome)을 만들고 실행해줘.
먼저 게임 README의 설치 요청문대로 엔진과 어셋이 준비되어 있는지 확인해줘.
게임 저장소 루트에서 npm run check와 npm run build를 실행한 다음, node variants/o-handsome/build.mjs를 실행해줘.
완성된 tools/out/release/site-o-handsome/을 루트로 로컬 정적 웹 서버를 켜고 index.html을 열어줘. 접속 주소와 종료 방법도 알려줘.
직접 명령을 실행할 수 없는 환경이면 내 운영체제를 확인하고 내가 따라 할 명령을 차례로 알려줘.
```

<details>
<summary>직접 빌드하려면</summary>

엔진과 어셋 설치를 마친 뒤 **게임 저장소 루트**에서 실행합니다.

```bash
npm run check
npm run build
node variants/o-handsome/build.mjs
python -m http.server 8000 --bind 127.0.0.1 --directory tools/out/release/site-o-handsome
```

`http://127.0.0.1:8000/`을 엽니다. 서버는 터미널에서 `Ctrl+C`로 종료합니다.

</details>

원본 그림은 `files/`, 적용할 파일과 해시는 `overlay.json`에 있습니다. 빌드 도구는 일반판 사이트를 복사하고 그림 5개와 관련 미디어 메타데이터를 갱신합니다. 결과는 `tools/out/release/site-o-handsome/`에 생기며, `build-report.json`에서 변경 목록과 일반판 보존 검사를 확인할 수 있습니다.

PLEASE는 "제발 한 번 봐주세요" 하는 장난입니다. 관심 가져주시는 것만으로도 감사합니다. 이 그림들도 루트 [LICENSE](../../LICENSE)에 적은 대로 자유롭게 쓰셔도 됩니다.
