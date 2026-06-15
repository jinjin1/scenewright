---
description: stock → reconcile → captions → Remotion render 순차 실행 후 final.mp4
argument-hint: <slug>
---

# /render

stock → reconcile → captions → render 파이프라인으로 `episodes/<slug>/out/final.mp4`를 생성한다. **LLM 호출 없음** — 모두 npm 스크립트.

## 입력

- `episodes/<slug>/storyboard.json` 필수
- `episodes/<slug>/script.json` (captions 단계용)
- `episodes/<slug>/assets/audio/*.wav` (`/tts` 결과)
- `.env`에 stock 3-provider 키 (없으면 stock 단계는 단색 폴백)

## 동작

> ⚠️ **`/render`는 4개 npm 스크립트의 시퀀스다 — `npm run render` 단독 실행 ❌.** 반드시 아래 1→2→3→4 순서로 전부 실행한다. `npm run render`만 돌리면 stage 4(Remotion)만 실행돼 **stock 자산 없음(b-roll 전부 LineCard 폴백) + reconcile 안 됨(오디오·자막 desync) + 자막 없음**으로 깨진 영상이 나온다(실측 내부 파일럿). stock은 증분 캐시라 재실행해도 쿼터를 거의 안 쓰니, 순서가 헷갈리면 1번부터 다시 돌리면 안전하다.

`$ARGUMENTS`로 받은 `slug`를 `assertValidSlug`로 검증한 뒤 순서대로 Bash 실행:

### 1. Stock prefetch — `npm run stock -- <slug>`

`storyboard.json`의 각 미디어 shot(`StockBg`·`HeroImage`·`SplitVisual`·`ScreenshotCallout`)에 대해 자산을 수집한다. shot에 **`image_ref`**가 있으면 운영자 큐레이션 라이브러리(`assets/images/library/`)에서 그 자산을 먼저 찾아 stock보다 **우선** 사용하고(hit이면 episode `assets/stock/`로 복사, `provider: "library"`, attribution 없음), 라이브러리에 없으면(miss) 경고 후 `broll_keywords`로 stock 폴백한다. stock 캐스케이드는 Unsplash → Pexels → Pixabay (photo) / Pexels → Pixabay (video) — 단 키워드가 **일러스트 결**(`flat illustration`·`cartoon`·`vector` 등)이면 photo 캐스케이드가 **Pixabay → Unsplash → Pexels**로 바뀌어 Pixabay illustration 채널을 부른다. **StockBg**는 shot duration에 비례해 **여러 개의 서로 다른 자산**을 수집(`duration_sec ÷ 5`, 최대 4개; 멀티컷 b-roll)하고, **HeroImage·SplitVisual·ScreenshotCallout**은 본문 이미지 1장만 수집한다. 에피소드 단위로 중복을 제거한 뒤 전부 다운로드한다.

**크로스-에피소드 재활용** (`assets/stock/index.json`이 있을 때): stock API를 치기 **전에** 글로벌 라이브러리에서 키워드 매치 자산을 먼저 재활용한다 — 매치되면 그 shot은 API 0건. 다양성을 위해 새로 fetch할 미디어 shot의 **≤40%**까지만 재활용으로 채우고(나머지는 새 소재), 과사용(≥3개 영상)·blank 자산은 제외한다. 받은/재활용한 자산은 인덱스에 누적되고 카탈로그(`library.md`/`library.html`)가 갱신된다. 인덱스 부트스트랩: `npm run library -- --backfill`(과거 에피소드 1회 스캔). 풀 파일이 없으면(클린 체크아웃) 재활용만 스킵하고 평소대로 fetch한다.

**자산 재랭킹** (`src/pipeline/stock/rank.ts`): provider가 준 태그/alt를 보고 키워드별 hits를 재정렬한다 — `blank/mockup/isolated/empty screen` 같은 빈 목업·광고 클리셰는 후순위로, 키워드와 관련도 높은 자산은 우선. 선택은 3패스(미사용+clean → 미사용+any → 재사용)라 **흰 빈 화면 폰/노트북은 깨끗한 대안이 없을 때만** 등장한다.

다운로드는 **1920w 캡**이 걸린다 — 비디오/이미지 variant 중 1920px 이내 최대 화질을 고르고(전부 초과면 최소), 캐시 키에 max-res가 포함돼 캡 변경 시 재수집된다. 4K 소스가 디코드 비용·`delayRender` 타임아웃을 유발하던 문제 방지(`src/pipeline/stock/select.ts`).

산출: `episodes/<slug>/assets/stock/manifest.json` — 각 entry에 `audio_ref`, `provider`(첫 자산; stock provider 또는 `"library"`), `local_path`(첫 자산, back-compat), `local_paths`(전체 배열), `attributions`(전체, 태그 포함) 포함. 0건 폴백은 `provider: null`, `local_paths: []`. **라이브러리 자산은 운영자 소유라 `attributions: []`** — attribution 블록·credits에 들어가지 않는다.

**⚠ 렌더 전 검수 게이트 (필수)**: stock 단계가 manifest 옆에 `contact-sheet.html`도 굽는다 — shot별 썸네일 그리드로 **빨강=미디어 누락(키워드 재검토 필요)**, **노랑=blank/목업 의심**을 표시한다. 렌더(~30분)는 비싸므로 **`/render`로 넘어가기 전에 이 시트를 열어** (1) 빈 화면·식상 클립, (2) 누락 shot을 육안 확인하라. 문제가 있으면 해당 라인의 `broll_keywords`를 고치고 `npm run stock -- <slug>`만 재실행(~1분)한 뒤 다시 본다. 콘솔도 누락 shot 수를 경고로 출력한다.

### 2. Duration reconcile — `npm run reconcile -- <slug>`

각 shot의 `duration_sec`을 실제 wav 길이로 덮어쓴 후 `storyboard.json` 재저장. 콘솔에 `before → after` 합계 출력.

### 3. Captions — `npm run captions -- <slug>`

`script.json` + 보정된 `storyboard.json` → `episodes/<slug>/captions.srt` (line-level SRT).

### 4. Render — `npm run render -- <slug>`

프로그래매틱 렌더러(`src/pipeline/cli/render.ts`)를 실행한다. 예전엔 `npx remotion render` CLI를 직접 호출하고 어댑터를 Bash one-liner로 만들었지만, 이제 render.ts가:

1. `storyboard.json` / `script.json` / `assets/stock/manifest.json`을 읽고,
2. `stockSrcByShotIndex` + `captions` 어댑터(아래)로 `inputProps`를 구성하고,
3. `@remotion/bundler` `bundle()`(publicDir=`episodes/<slug>`) → `@remotion/renderer` `renderMedia()`로 `out/final.mp4`를 렌더하고,
4. `onStart`/`onProgress`로 **render vs encode 시간·프레임 수를 분해**해 `out/render-stats.json`을 남긴다.

```
npm run render -- <slug>
```

- **concurrency** = `cores-1` 자동 설정(`os.cpus().length - 1`). 빠뜨리면 Remotion 기본값(≈코어 절반)이라 1.84x 손해(plan Finding 4A). 메모리 부족 시 render.ts에서 조정.
- **publicDir=`episodes/<slug>`** — `staticFile()`이 episode 디렉터리 기준으로 audio/stock을 해석. `renderMedia`엔 publicDir 옵션이 없어 `bundle()` 시점에 지정한다. Remotion이 `file://`을 거부하므로 직접 절대 URL을 props에 넣지 말 것.
- **audioBaseUrl=""** — Episode 컴포지션이 자동으로 `staticFile(audio_ref)`로 폴백.
- **timeout 120s** — stock 미디어 fetch/디코드가 기본 28s `delayRender`를 넘길 수 있어 여유.
- `manifest.json`이 없으면 경고 후 stock 자산 없이(LineCard 폴백) 렌더한다.

#### render-stats.json (렌더 observability)

`{ slug, frames, fps, videoDurationSec, wallClockSec, renderSec, encodeSec, bundleSec, rtf, renderFps, concurrency, flags, ts }`를 `out/render-stats.json`에 기록. **RTF = wall-clock 렌더 시간 ÷ 영상 길이**(>1 = 실시간보다 느림, 목표 <1). `renderSec`/`encodeSec`은 프레임 래스터 vs 인코딩 분해. quick-win 효과를 before/after로 증명하는 단일 소스다. fs write 실패가 렌더 성공을 무효화하지 않도록 try/catch.

#### `stockSrcByShotIndex` 어댑터

`manifest.json`은 entry 배열 — 각 entry에 `audio_ref`와 `local_paths`(자산 경로 배열)가 있다. Episode 컴포지션의 `stockSrcByShotIndex`는 `Record<string, string[]>` (shot index → episode-dir 기준 상대 경로 **목록**). Episode가 이 목록을 shot duration·minHold에 맞춰 B-roll 컷 세그먼트로 분해한다. **라이브러리 자산(`provider: "library"`)도 `local_paths`가 채워진 일반 entry라 동일 처리** — 코드 분기 불필요(`provider !== null` 조건만 통과하면 됨). HeroImage/SplitVisual/ScreenshotCallout은 그 목록의 첫 1장을 받는다.

변환 로직 (`src/pipeline/render-adapter.ts`의 `buildStockSrcByShotIndex`로 **PORT됨** — Bash one-liner·`/tmp` props 파일 없음, `tests/unit/render-adapter.test.ts`가 parity 회귀로 잠금):
```ts
const stockByShot: Record<string, string[]> = {};
for (const entry of manifest.entries) {
  if (entry.provider === null || entry.local_paths.length === 0) continue;
  const idx = storyboard.shots.findIndex((s) => s.audio_ref === entry.audio_ref);
  if (idx >= 0) {
    // local_paths는 project root 기준 ('episodes/<slug>/assets/stock/...')
    // publicDir=episodes/<slug> 사용하므로 prefix 제거
    stockByShot[String(idx)] = entry.local_paths.map((p) =>
      p.replace(`episodes/${slug}/`, ""),
    );
  }
}
```

#### `captions` 어댑터

Captions 컴포넌트는 shot index 기준으로 자막을 표시한다 (`storyboard.shots[i]` ↔ `captions[i]`). 스크립트 라인 텍스트를 `toCaption()`(콤마/생략부호 제거)으로 정제해서 매핑한다 (`render-adapter.ts`의 `buildCaptionsByShot`):

```ts
import { toCaption } from "./captions.js";
const lineById = new Map(script.lines.map((l) => [l.id, l]));
const captions: string[] = storyboard.shots.map((shot) => {
  const id = shot.audio_ref.replace(/^assets\/audio\//, "").replace(/\.wav$/, "");
  return toCaption(lineById.get(id)?.text ?? "");
});
```

⚠️ `captions` 배열을 빠뜨리면 영상에 자막이 안 나옴 (EpisodeProps에서 `captions: z.array(z.string()).default([])` — 누락 시 빈 배열로 폴백).

> 디버그용 raw CLI가 필요하면 `npm run render:cli -- Episode <out> --props=<json> --public-dir=episodes/<slug> --concurrency=$(( $(sysctl -n hw.ncpu) - 1 )) --timeout=120000`. 정규 경로는 위 `npm run render`.

### 5. 검증

- `episodes/<slug>/out/final.mp4` 존재 + `out/render-stats.json`의 RTF 확인(목표 <1)
- ffprobe 또는 운영자가 직접 재생해 길이 / 음성 / stock 미디어 / 자막 확인
- Pretendard/Noto Sans KR 폰트 로딩 정상 (첫 1초 검은 화면이면 폰트 fetch 실패 의심 → 네트워크 확인)

## 다음 단계

`/publish-kit <slug>` — 영상 설명 + 태그 + 썸네일 + **OpenRAIL-M AI 생성 disclaim** + stock attribution 블록

## 주의

- Remotion 렌더는 첫 호출 시 Chrome Headless 다운로드 (~280MB). 한 번만
- 10~15분 영상 기준 M1 Mac에서 렌더 ~5~10분 (영상 길이 × 0.5~1.0)
- concurrency는 render.ts가 `cores-1`로 자동 설정 — 튜닝 효과는 `render-stats.json` RTF로 추적
