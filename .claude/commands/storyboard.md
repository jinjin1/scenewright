---
description: script.json을 shot 단위 storyboard.json으로 평탄화 + Remotion meta(fps/해상도/트랜지션) 부착
argument-hint: <slug>
---

# /storyboard

script의 line 배열을 **Remotion이 직접 받을 수 있는 shot 배열**로 평탄화한다. 한 line = 한 shot. visual carry-forward를 해소하고, audio_ref·duration_sec·broll_keywords를 shot에 정착시킨다. meta(fps/해상도/트랜지션/BGM)는 고정값으로 채운다.

이 단계는 **LLM 추론이 가볍다** — 주로 결정적인 변환. 다만 carry-forward 해소·duration 분배·번역(없으면 default) 같은 결정이 필요해 자체 추론으로 처리한다.

## 인자

`$ARGUMENTS` = `slug` (필수).

## 입력

- `episodes/<slug>/script.json` 필수.
- (선택) `episodes/<slug>/treatment.json` — scene별 duration_sec 분배 참고용.

## 출력

`episodes/<slug>/storyboard.json` — `StoryboardSchema` (`src/schemas/storyboard.ts`) 준수.

```ts
{
  meta: {
    fps: 30,                       // 고정
    width: 1920,                   // 고정
    height: 1080,                  // 고정
    transition: "varied",          // 권장: 경계별 다양 전환. fade/wipe/none = 단일 고정
    bgm_id: null,                  // 파일럿에서는 BGM 없음
    bgm_volume: 0.15               // 기본값
  },
  shots: [
    {
      component: "TitleCard" | "BulletList" | "StockBg"
               | "HighlightedLine" | "ProgressiveList" | "StatHero"
               | "SweepDivider" | "TerminalCard" | "GlitchTransition" | "PixelTitle"
               | "HeroImage" | "SplitVisual" | "ScreenshotCallout" | "FlowDiagram"
               | "PixelBarChart" | "PixelDonut" | "PixelGauge"
               | "PixelStepTracker" | "PixelRoadmap"   // 픽셀 데이터-비주얼 (script가 선택 시 그대로 평탄화)
               | "DecisionMatrix" | "ReactionBeat",    // 이모지 (의미의 구두점 — script가 선택 시 평탄화)
      props: { ... },               // script.line의 visual.props와 동일 (carry-forward 해소됨)
      scene_id: string,             // /^scene\d{2,}$/ — script line의 id에서 추출
      audio_ref: string,            // "assets/audio/<line.id>.wav"
      duration_sec: number,         // reconcile이 실제 wav 길이로 덮어씀. 일단 추정치
      broll_keywords: string[],     // script line의 broll_keywords carry-forward. stock 단계가 키워드별로 여러 클립을 모아 컷으로 깐다
      image_ref?: string,           // script line의 image_ref carry-forward (라이브러리 자산 파일명). stock 단계가 stock보다 우선 사용
      transition_in?: "fade"|"slide"|"wipe"|"flip"|"clockWipe"|"iris"|"none"  // 이 shot이 새 그룹을 여는 경계의 전환. CC가 내용 보고 고름(아래 "전환 선택" 참조). 대부분 생략
    },
    // ... script.lines 수와 동일
  ]
}
```

---

## 동작

1. slug 검증.
2. `script.json` Read + `ScriptSchema.parse`. 필요시 `treatment.json`도 Read.
3. **결정적 변환** — 다음 알고리즘으로 shots 배열 생성 (자체 추론):
   1. `current_visual = null`, `current_broll_keywords = []`, `current_image_ref = undefined` 초기화
   2. 각 `line`에 대해:
      - `line.visual`이 있으면 `current_visual = line.visual` 갱신 **및** `current_broll_keywords = line.broll_keywords ?? []`, `current_image_ref = line.image_ref` 동시 갱신 (visual이 바뀌면 키워드·image_ref도 무조건 새것으로 교체 — 이전 값을 새 visual에 끌고 가지 않음)
      - `line.visual`이 없으면(carry-forward) `current_visual`/`current_broll_keywords`/`current_image_ref` 모두 그대로 유지. 단, line 자신이 `broll_keywords`/`image_ref`를 명시했다면 그 값으로 오버라이드 (운영자 수동 보강 케이스)
      - `current_visual === null` 이면 **에러** (첫 line에 visual 없음 — script 검증이 잡았어야 함)
      - `scene_id` = line.id에서 `scene{NN}` 추출. 정규식 `/^(scene\d{2,})-/` 매칭 실패 시 운영자에게 보고 후 중단
      - `audio_ref` = `"assets/audio/" + line.id + ".wav"`
      - `duration_sec` = (treatment 있으면 해당 scene의 duration ÷ scene의 line 수, 없으면 line.text 글자 수 × 0.11 추정 — speed 1.4 실측 기준)
      - shot 객체 조립: `{ component, props, scene_id, audio_ref, duration_sec, broll_keywords }` + `current_image_ref`가 있으면 `image_ref`도 포함 — `broll_keywords`는 `current_broll_keywords` 사용
   3. **전환 선택 (semantic)** — shots 조립 후, **비주얼이 새로 바뀌는 shot**(새 그룹을 여는 shot)마다 직전 비주얼→이 비주얼의 관계를 보고 `transition_in`을 정한다. 아래 "전환 선택" 규칙 적용. 대부분은 **생략(하드 컷)**이고, scene(섹션)이 바뀌는 곳 위주로만 부여한다.
4. `meta`는 위 고정값으로 채움 (`transition: "varied"`).
5. `StoryboardSchema.parse`로 검증.
6. 결과를 `episodes/<slug>/storyboard.json`에 Write.
7. 프리뷰: 총 shot 수, scene별 shot 분포, 추정 총 분량 (reconcile 전 추정).
8. `/tts <slug>` 안내.

---

## 처리 규칙 상세

### Carry-forward 해소

script의 `line.visual`이 생략된 line은 직전 line의 visual을 그대로 복사. **storyboard에서는 모든 shot이 명시적 component+props를 가짐** (carry-forward 개념 없음).

`broll_keywords`와 `image_ref`도 동일 규칙으로 carry-forward 한다. visual이 새로 명시되면 broll_keywords는 그 line의 값(없으면 빈 배열)으로, image_ref는 그 line의 값(없으면 undefined)으로 리셋된다. `image_ref`가 있는 미디어 shot은 stock 단계가 라이브러리 자산을 stock보다 우선 사용한다.

단 **carry-forward된 StockBg shot이라도 화면엔 같은 클립이 계속 떠 있지 않는다** — stock 단계가 각 shot마다 자산을 수집할 때 에피소드 단위로 중복을 제거하므로, 같은 키워드를 공유하는 연속 shot은 그 키워드 후보 풀에서 *서로 다른* 클립을 받는다. 렌더는 이 클립들을 shot 경계마다 컷으로 전환하고, 한 shot이 길면(8초+) 그 안에서도 여러 클립으로 나눈다. 즉 carry-forward는 "같은 무드의 b-roll 시퀀스"를 만들되 화면은 계속 바뀐다. (이 자동 컷 변화 덕분에 긴 b-roll 구간의 시청자 이탈이 줄어든다.)

### 전환 선택 (transition_in)

`meta.transition: "varied"`에서 각 경계의 전환은 **새 그룹을 여는 shot의 `transition_in`**으로 결정된다. 기계적 순환이 아니라 **CC가 두 비주얼의 내용·무드를 보고** 고른다.

**원칙 — 남발하지 않는다. 전환은 "새 섹션" 신호다:**
- **같은 scene 안의 비주얼 교체는 거의 전부 생략(하드 컷).** 컷 = 연속. 같은 챕터 안에선 툭 넘어가는 게 자연스럽다.
- **scene(섹션)이 바뀌는 경계에만** 전환을 부여하는 게 기본. 영상당 전환 ≈ 씬 수(보통 6~9회).
- `transition_in`을 **생략하면 폴백**: scene 바뀌면 `fade`, 같은 scene이면 컷. 그래서 *애매하면 그냥 생략*하면 섹션마다 차분한 fade가 깔린다 — 안전한 기본값.
- 강한 전환(`clockWipe`/`iris`/`flip`)은 **내용이 그걸 부를 때만**, 영상당 합쳐서 2~3회 이내로.

**어휘 — 두 비주얼의 관계가 이러면 이걸 쓴다:**

| transition_in | 언제 (직전 → 이 비주얼의 관계) |
|---|---|
| (생략) / `none` | 같은 섹션 연속, 같은 호흡 — **하드 컷** (대부분) |
| `fade` | 차분한 화제 전환, 부드러운 연결. 섹션 전환의 **기본** |
| `slide` | 같은 층위에서 옆으로 이동 (목록 다음 항목, 좌우 비교) |
| `wipe` | 순차/병렬 진행 (A 다음 B, 단계 넘어가기) |
| `flip` | 반전·대조 ("잘못된 방식" → "올바른 방식", 양면, before/after 대립) |
| `clockWipe` | 시간 경과·진행·주기 (로드맵, 분기, 사이클) |
| `iris` | 한 점으로 집중·줌인 (큰 그림 → 핵심 인사이트, 디테일 포커스) |

예: 인트로(TitleCard)에서 본론 첫 개념(FlowDiagram)으로 → `fade` 또는 `wipe`. "흔한 오해"(GlitchTransition)에서 "진짜 원리"로 → `flip`(반전). 개념 설명에서 로드맵(PixelRoadmap)으로 → `clockWipe`. 전체 그림에서 한 사례 클로즈업(ScreenshotCallout)으로 → `iris`.

### scene_id 추출

`line.id` 규약 `"scene{NN}-line{MM}"`를 따른다는 가정. 추출 정규식:
```ts
const m = line.id.match(/^(scene\d{2,})-/);
if (!m) throw new Error(`line.id "${line.id}" does not match expected pattern scene{NN}-...`);
const scene_id = m[1];
```

운영자가 직접 편집해 다른 id 포맷을 쓰면 이 단계가 실패하므로 운영자에게 보고하고 중단.

### duration_sec 추정

reconcile 단계가 실제 wav로 덮어쓰지만, storyboard.json 자체는 추정치라도 필요 (Remotion preview가 reconcile 전에도 동작하기 위해).

- **treatment.json 있을 때**: 같은 scene_id의 line 수를 카운트 → scene의 `duration_sec` ÷ line 수 (균등 분배).
- **없을 때**: `line.text.length × 0.11` (Supertonic M1 speed 1.4 실측값 — 내부 파일럿 파일럿 4542자 → 505s = 약 9자/초 = 0.11초/자). speed 변경 시 재캘리브레이션 필요.
- 결과는 양수여야 함 (스키마 강제). 0이 나오면 0.5 minimum 적용.

### meta 고정값

CLAUDE.md의 품질 바("영상 길이 10~15분") + Remotion 표준에 맞춰:
- fps: 30 (cinematic이 아닌 강의·설명 채널에 충분)
- width × height: 1920 × 1080 (YouTube 표준)
- transition: `"varied"` (권장) — 경계별 전환을 **shot.transition_in(CC가 내용 보고 고름, 위 "전환 선택")**으로 결정. 생략 시 폴백(scene 바뀌면 fade, 같은 scene이면 컷). 전환은 섹션 위주로 절제(영상당 ~씬 수). CSS/clipPath만이라 렌더 성능 영향 없음. `"fade"`/`"wipe"`는 모든 경계 단일 고정(구버전 동작), `"none"`은 전환 없음
- bgm_id: `null` (파일럿에서는 BGM 없이 시작 — 회고에서 결정)
- bgm_volume: 0.15 (나중에 BGM 추가 시 활용)

---

## 검증

1. `StoryboardSchema.parse(...)` 통과.
2. `shots.length === script.lines.length`.
3. 모든 shot의 `audio_ref`가 `assets/audio/<id>.wav` 형식.
4. 모든 `scene_id`가 `/^scene\d{2,}$/` 매칭.
5. 추정 총 분량 (`sum(duration_sec) / 60` 분)이 synopsis.duration_min의 ±30% (추정 단계라 느슨).

검증 실패 시 운영자에게 보고. carry-forward 미해소나 visual 부재가 원인이면 `/script` 재실행 권장.

## 다음 단계

`/tts <slug>` — script.json의 모든 line을 Supertonic-3 M1 voice로 합성 (~4분).

`/tts` 이후 `/render <slug>` — stock → reconcile → captions → Remotion render.

## 비고

- 이 단계는 자체 추론이지만 LLM 호출이 가볍다 (결정적 변환 + 단순 계산). 재실행 시 결과가 거의 같음.
- 운영자가 storyboard를 직접 편집해 component를 바꾸거나 broll_keywords를 보강해도 무방 (스키마만 통과하면).
- reconcile이 duration_sec을 덮어쓰므로, 이 단계에서의 추정치는 Remotion preview에만 의미.
- meta 변경(예: 30fps → 60fps, 1080p → 1440p)은 회고에서 결정. 현재는 고정.
