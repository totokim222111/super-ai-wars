# 타입 O 미남판

저장소 루트에서 다시 빌드: `node games/super-ai-wars/variants/o-handsome/build.mjs`

기존 `pack/`과 `tools/out/release/site/`는 읽기 전용이다. 승인 그림은 `files/`와 `overlay.json`에 보관한다. 기존 정적 사이트를 복제하고 같은 상대 경로의 그림5개를 덮어쓴다. 미디어 인덱스의SHA-256·바이트 수·캐시 버전과 그림 크기 메타데이터만 갱신한다. 실행JS/CSS/HTML, 대사·설정, 영상·포스터 및 `_headers`는 원본 바이트를 유지한다.

결과는 `games/super-ai-wars/tools/out/release/site-o-handsome/`이며 평범한 정적 서버에서 실행한다. JSON은 기존 `_headers`의 재검증 정책을 유지하고 미디어 URL은 새 콘텐츠 해시의 `?v=`를 사용한다. `build-report.json`에 전후 해시 보존과 파일 수·용량을 기록한다.
