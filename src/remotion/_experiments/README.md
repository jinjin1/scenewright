# `_experiments/` — 파킹된 픽셀 씬 스캐폴딩

여기 있는 컴포넌트들은 **현재 파이프라인에서 쓰이지 않는다.** Episode 디스패치
(`src/remotion/compositions/Episode.tsx`)나 Root, 어떤 씬에서도 import 되지 않는다.
출하·배선된 픽셀 씬(`PixelTitle`/`PixelBarChart`/`PixelDonut`/`PixelGauge`/
`PixelStepTracker`/`PixelRoadmap`)은 `src/remotion/scenes/`에 따로 있다.

## 왜 삭제하지 않고 파킹했나

- **`PixelKit` / `PixelKit2` / `PixelKit3` / `PixelMap`** — dead dev 스캐폴딩.
  실험으로 만든 픽셀 키트인데, 쓸 만한 아이디어는 이미 위의 출하 씬으로 졸업했다.
- **`PixelCharacter` / `PixelDissolve`** — 보류 실험. 고해상도 픽셀 캐릭터·디졸브는
  운영자가 **명시적으로 보류**했다. 전진·재제안 금지(메모리 `project-pixel-dataviz`).
- **`_WordStagger` / `_KaraokeText`** — 미사용 텍스트 애니메이션 헬퍼. 초기 릴리스부터
  어떤 씬도 import하지 않는다(소비처 0). 픽셀과는 무관하지만 같은 "삭제 대신 파킹"
  위생으로 `scenes/`에서 옮겨 보관한다. `../theme`만 의존해 되살릴 때 경로 수정이 없다.

지우는 대신 git에 추적된 상태로 여기 보존한다(untracked로 두면 더 잃기 쉽다).
이전엔 `scenes/`에 untracked로 떠돌았다 — 이 디렉터리로 옮겨 위생을 정리했다.

## 빌드에서 제외됨

`tsconfig.json`의 `exclude`에 이 디렉터리가 들어가 있다. **파킹된 죽은 코드라
타입체크 대상이 아니다** — 향후 `theme/` 등이 바뀌어도 빌드를 깨지 않는다.
되살리려면: (1) `scenes/`로 옮기고 (2) tsconfig `exclude`에서 빼고
(3) Episode 디스패치 switch + 스키마 union에 배선한다.

> 출처: 2026-05-29 CEO 플랜 Phase 0 (`framework-viz-render-opt`), 픽셀 정리 분류 결과.
