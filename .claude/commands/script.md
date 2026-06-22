---
description: treatment.json을 라인 단위 대본 + 시각 디렉티브가 포함된 script.json으로 풀어냄
argument-hint: <slug>
---

# /script

각 씬을 **라인(line) 단위 대본**으로 풀어내고, 각 라인에 어떤 시각 컴포넌트가 화면에 떠야 하는지(VISUAL 디렉티브)를 인라인으로 매핑한다. 라인은 TTS 합성의 최소 단위이자 영상에서 한 shot의 단위이기도 하다.

## 인자

`$ARGUMENTS` = `slug` (필수).

## 입력

- `episodes/<slug>/treatment.json` 필수.
- (선택) `episodes/<slug>/synopsis.json` — 시청자·톤 메모 참조.
- (선택) `episodes/<slug>/source.txt` — **씬별 사실 근거**. 있으면 각 씬을 이 소스에 충실히 grounding(소스에 없는 사실·용어 삽입 금지). 실측: source.txt 없이 treatment만으로 단일 패스 생성하면 소스에 없는 용어가 새어 source-fidelity 위반이 급증한다(43건). 소스를 씬별 근거로 주입하면 2건으로 떨어진다().

## 출력

`episodes/<slug>/script.json` — `ScriptSchema` (`src/schemas/script.ts`) 준수.

```ts
{
  lines: [
    {
      id: string,                         // /^[a-zA-Z0-9_-]+$/. wav 파일명에 그대로 쓰임. 예: "scene01-line01"
      text: string,                       // 합성될 한국어 대본. 한 호흡 단위 (~30~80자 권장)
      visual?: {                          // 생략 시 직전 라인의 visual을 carry-forward
        component: "TitleCard" | "BulletList" | "StockBg"
                 | "HighlightedLine" | "ProgressiveList" | "StatHero"
                 | "SweepDivider" | "TerminalCard" | "GlitchTransition" | "PixelTitle"
                 | "HeroImage" | "SplitVisual" | "ScreenshotCallout" | "FlowDiagram"
                 | "PixelBarChart" | "PixelDonut" | "PixelGauge"
                 | "PixelStepTracker" | "PixelRoadmap"    // 픽셀 데이터-비주얼 (옵트인, 아래 가이드 참조)
                 | "DecisionMatrix" | "ReactionBeat" | "StarburstReveal",  // 이모지 마커 / 리액션 / 광선 리빌 (아래 가이드)
        props: { ... }                    // component별 PropsSchema 준수 (아래 표 참조)
      },
      broll_keywords: string[],           // StockBg/HeroImage/SplitVisual 사용 시 검색 키워드. StockBg는 3~5개(앵글 다양·각각 별도 컷), HeroImage/SplitVisual은 본문 이미지 1장이라 2~3개로 충분. 빈 배열 허용
      image_ref?: string                  // 큐레이션 라이브러리 자산 파일명 (`assets/images/library/` 기준). 지정 시 stock보다 우선. ScreenshotCallout는 거의 필수, HeroImage/SplitVisual도 특정 자산 핀할 때 사용. miss면 stock으로 폴백
    },
    // ... 최소 1개
  ]
}
```

### Visual 컴포넌트 props 스키마

```ts
TitleCard:        { title: string, subtitle?: string, eyebrow?: string }
BulletList:       { heading?: string, items: string[]  /* 2~7개 */ }
StockBg:          { kind: "video" | "photo" | "color", fallback_color?: "#RRGGBB" }

// 신규 (Phase 2)
HighlightedLine:  { text: string, highlights: string[]  /* 1~4개, text의 부분 문자열 */,
                    eyebrow?: string, variant?: "marker"|"underline" }
ProgressiveList:  { heading?: string, items: string[]  /* 2~7개 */, eyebrow?: string }
StatHero:         { value: number, from?: number, decimals?: number,
                    eyebrow?: string, caption?: string,
                    prefix?: string, suffix?: string,
                    suffixSize?: "match"|"small", scramble?: boolean }
SweepDivider:     { eyebrow?: string, label: string, caption?: string }
TerminalCard:     { lines: Array<{ kind: "prompt"|"output"|"comment", text: string }>  /* 1~12 */,
                    tone?: "amber"|"green"|"white", windowTitle?: string, charsPerFrame?: number }
GlitchTransition: { eyebrow?: string, label: string,
                    intensity?: number  /* 0~1, 기본 0.7 */,
                    burstFrames?: number  /* 기본 24 */ }
PixelTitle:       { label: string  /* 영문/숫자 권장 */, subtitle?: string,
                    accentColors?: string[]  /* "#RRGGBB" 배열 */,
                    letterStaggerFrames?: number, pixelSize?: number }

// image-first 씬 — 미디어를 배경이 아니라 *본문*으로. broll_keywords 필수.
HeroImage:        { title?: string, caption?: string, eyebrow?: string,
                    kind?: "photo"|"video", overlay?: "bottom"|"left"|"full",
                    fallback_color?: "#RRGGBB" }      // 풀블리드 이미지 + 하단 제목/캡션
SplitVisual:      { heading?: string, body?: string, items?: string[]  /* ≤5 */,
                    eyebrow?: string, image_side?: "left"|"right",
                    kind?: "photo"|"video", fallback_color?: "#RRGGBB" }  // 이미지 절반 + 텍스트 절반

// 실제 제품 UI 스크린샷 + 주석. 거의 항상 라이브러리 자산(image_ref)과 함께 쓴다.
ScreenshotCallout: { eyebrow?: string, title?: string, caption?: string,
                    frame?: "browser"|"window"|"none",  // 기본 browser(상단 바)
                    fit?: "contain"|"cover",            // 기본 contain(UI 크롭 금지)
                    annotations?: Array<{ x: number, y: number, w: number, h: number,  /* 0~1 정규화, 이미지 영역 기준 */
                                          label?: string }>  /* ≤4, 콕 집을 영역 */,
                    fallback_color?: "#RRGGBB" }

// 라벨 노드 2~6개를 화살표로 연결. 화살표가 그려지며 항목 *사이의 흐름/인과*를 보여준다.
FlowDiagram:      { eyebrow?: string, heading?: string,
                    orientation?: "vertical"|"horizontal",  // 기본 vertical(흐름/퍼널), horizontal(파이프라인)
                    nodes: Array<{ label: string, sublabel?: string }>  /* 2~6개, 순서대로 연결 */,
                    connector?: "arrow"|"line",  // 기본 arrow(화살촉)
                    fallback_color?: "#RRGGBB" }

// 픽셀 데이터-비주얼 — 레트로/게임 결의 수치 시각화이자 채널 차별화 자산. *데이터 모먼트의
// 결에 맞으면 자유롭게* 쓴다(아래 적합성 가이드). 정밀·권위가 핵심인 수치만 StatHero 등 클린 씬.
PixelBarChart:    { eyebrow?: string, heading?: string, caption?: string,
                    bars: Array<{ label?: string, value: number }>  /* 2~8개 */,
                    highlightIndex?: number,  // 생략 시 최댓값 막대 자동 강조
                    fallback_color?: "#RRGGBB" }   // 수치 배열 비교/추이 (StatHero=단일 숫자)
PixelDonut:       { eyebrow?: string, heading?: string, percent: number  /* 0~100 */,
                    caption?: string, fallback_color?: "#RRGGBB" }   // 단일 비율 % 링
PixelGauge:       { eyebrow?: string, heading?: string, label?: string,
                    value: number, max?: number  /* 기본 10 */, caption?: string,
                    fallback_color?: "#RRGGBB" }   // 점수/충족도 세그먼트 (비율별 색)
PixelStepTracker: { eyebrow?: string, heading?: string,
                    steps: string[]  /* 2~7개 */, currentIndex: number,
                    fallback_color?: "#RRGGBB" }   // 선형 단계 진행(완료/현재/예정). 분기 없는 프로세스
PixelRoadmap:     { eyebrow?: string, heading?: string,
                    milestones: Array<{ label: string }>  /* 2~6개 */, currentIndex: number,
                    fallback_color?: "#RRGGBB" }   // 마일스톤 여정 맵(지그재그 자동 배치)

// 이모지 — "의미의 구두점"(판정·리스크·추세)일 때만. 장식 남발 금지(다크 에디토리얼 톤 충돌).
// 이모지는 화면 props에만, 내레이션(line.text)엔 절대 금지(TTS가 못 읽음).
DecisionMatrix:   { eyebrow?: string, title: string,    // 판정/의사결정 매트릭스 (Tier1 정적 SVG 마커)
                    rows: Array<{ ko: string, en?: string,   // 화면 한·영 병기
                                  verdict: "check"|"cross"|"warning"|"up"|"down" }>  /* 2~5개 */ }
                                  // verdict: ✅통과 ❌부적합 ⚠️리스크 📈상승 📉하락
ReactionBeat:     { eyebrow?: string, headline: string,  // 단일 애니메이션 이모지(Tier2 비디오) + 헤드라인
                    emoji: "partying-face"|"fire"|"star-struck"|"rocket" }  // 🥳축하 🔥인기 🤩임팩트 🚀출시
                    // ⚠️ 영상당 1개 하드캡 — 가장 강한 리액션 1순간만(훅 펀치라인·결과 공개). lint가 경고.
StarburstReveal:  { eyebrow?: string, headline: string,  // 키워드·펀치라인 뒤 방사형 광선 후광
                    caption?: string }                   // (Tier2 WebGL 광선, frame 구동). 화면 텍스트라 한·영 병기 규칙 적용
                    // ⚠️ 영상당 2개 하드캡 — 훅 반전·챕터 키워드·결론 펀치 같은 강한 1~2순간만(레트로 광선 톤 리스크). lint가 3개째부터 경고.
                    // ⚠️ 수치·성과 금지: hype 광선이 숫자의 권위를 깎는다. 숫자는 StatHero. lint가 숫자만 든 headline을 경고(starburst-numeric-headline).
```

---

## 동작

1. slug 검증.
2. `treatment.json` Read + `SynopsisSchema.parse` 형상 확인 (synopsis.json도 있으면 Read). **`source.txt`가 있으면 Read — 씬별 사실 근거로 삼아 user prompt의 SOURCE 블록에 넣는다.**
3. `VOICE.md` Read (전체) + treatment에서 언급된 프레임워크에 해당하는 `REFERENCE/*.md` Read.
   - **씬별 글자수 예산을 미리 계산**해 둔다: 각 씬 `duration_sec × 9`(speed 1.4, ≈9자/초). user prompt에 씬별 목표로 박는다. ⚠️ **실측 경고**: 단일 패스는 프롬프트에 씬별 예산을 줘도 누적 분량을 못 느껴 목표의 **~60%로 미달**하는 경향이 끈질기다(실측: baseline 62% / 예산 주입 후에도 58%). 그래서 프롬프트 지시만으론 부족하고, **step 8에서 CC가 씬별 글자수를 실제로 세어** 90% 미달 씬을 골라 그 씬만 "약 N자로 늘려라"로 재생성하는 **결정적 점검이 진짜 안전망**이다.
4. 아래 system + user prompt를 자체 추론으로 실행.
5. 결과를 `episodes/<slug>/script.json`에 Write.
6. `ScriptSchema.parse`로 검증.
7. 추가 검증:
   - 각 line의 `text`를 `transliterate.ts`의 `transliterate` 함수에 통과시켰을 때 영어 약어가 모두 처리되는지 grep
   - 모든 line에 visual이 있거나 직전 carry-forward로 해석 가능한지 — 첫 line은 반드시 `visual` 명시
   - `BulletList.items.length`가 2~7 범위
   - `id` 유일성
8. **분량 결정적 점검(필수 — 프롬프트 자가 점검만으론 안 됨)**: `npm run lint:script -- <slug>`가 treatment.json 기반으로 **scene별 글자수%(목표 `duration_sec×9` 대비)를 결정적으로 계산·플래그**한다(`analyzeSceneLength`, `script-review.html`의 "씬별 분량" 패널 + 콘솔 `scene length:` 줄). **90% 미달로 표시된 씬은 그 씬만 "약 N자로 늘려라"로 재생성**(소스 근거 더 풀어쓰기, 전체 재생성 불필요) 후 다시 점검. 통과 후 프리뷰: scene별 line 수·글자수% + 첫 줄 발췌 + 총 글자 수. (실측상 단일 패스는 이 결정적 보정 없이는 ~60%로 끝난다 — 프롬프트 예산 지시는 falsified.)
9. `/storyboard <slug>` 안내.

---

## System prompt

> 당신은 `@channel.config.md`에 정의된 YouTube 채널의 시니어 작가다. 채널의 주제·타겟 시청자·톤은 `@channel.config.md`와 `@VOICE.md`를 따른다.
>
> 이 단계는 **대본 라인 작성 + 시각 디렉티브 매핑**이다. 한 씬을 여러 line으로 풀어내고, 각 line은 TTS로 한 호흡에 합성될 단위가 된다. 동시에 그 line이 영상에 떠 있는 동안 어떤 시각 컴포넌트가 화면에 보이는지 결정한다.
>
> **대본 작성 핵심 원칙**:
>
> 1. **한 호흡 단위** — line.text는 한 번에 쉼표 1~2개로 끝나는 길이 (~30~80자 권장). TTS가 한 줄을 한 wav로 만들고 그 wav가 한 shot이 된다. 너무 짧으면 화면 전환이 정신없고, 너무 길면 한 화면에 너무 오래 머문다.
> 2. **운영자 톤 100% 준수 + 자연스러운 한국어** — `@VOICE.md` 시그니처/금기/페이스를 그대로 따른다. "그래서~", "예를 들어~", "~인데요" 자연스럽게. "혁명적", "정말 굉장히", "구독·좋아요" 금지.
>    - **번역투·외래어·한자어·군더더기 회피 (VOICE.md §6.5 강제)**: 내레이션은 번역문이 아니라 *한국인 PM이 카메라 앞에서 말하는 입말*이다. (a) 불필요한 외래어→우리말(덱→장표, 럭셔리→고급, 모바일 워크스테이션→이동형 업무 환경; 단 시티플로우·노스 스타 등 개념어는 유지), (b) 딱딱한 한자어→풀어쓰기(진척→일이 되는 것, 분석 마비→제대로 풀지 못하는 상황, 판정→판단), (c) 번역체 구문 교정(만들어 줍니다→해줍니다, 논쟁을 벌이다→논쟁하다, ~게 됩니다→~습니다, 못 풀고→풀지 못하고), (d) 군더더기 삭제(차근차근·진짜로·그런·뻔한, "~다는 거거든요"→"거든요"), (e) 쉼표 남발→마침표로 끊기, (f) 영어식 복수 '들'·불필요 조사 제거(기회들에→기회에, 둘지를→둘지). 자기 점검: "한국인 PM이 실제로 이렇게 말할까?"
> 3. **영어 PM 약어는 한글 음차** — 운영자는 자연스럽게 음차로 말한다. "디스커버리", "아웃컴", "인사이트", "트랙션", "오퍼튜니티". 단, TTS의 `transliterate.ts` 매핑이 자동으로 대문자 약어를 음차하므로 'PM', 'PRD', 'UX/UI' 같이 명시적으로 쓰는 것도 OK.
> 4. **참조·인용은 자연스럽게** — "테레사 토레스는 ~ 얘기를 합니다", "책에서 ~ 설명을 합니다", "저자는 ~ 부분을 강조를 합니다".
> 5. **추상 명사화 자제** — "중요성", "필요성" 같이 끝나는 문장보다 행동 가능한 진술로.
> 6. **TTS 끝-잘림 회피 (Supertonic 필수)** — **짧은 라인(≤~22자)이 "~어요"·"~입니다"로 끝나면 Supertonic이 끝 2~3음절을 통째로 누락**한다(실측: "출발했어요"→"출발해", "활동 영역입니다"→"활동 영역"). 같은 텍스트 재합성으론 안 고쳐진다. **방지**: (a) 라인을 너무 짧게 두지 말고 맥락을 더해 길게, (b) 끝을 견고한 긴 어미("~살펴보겠습니다", "~합니다")로 — 끝 한 음절 빠져도 알아들을 수 있게, (c) **핵심어를 문장 앞쪽**에 배치. 특히 `SweepDivider`류 "N번째 차원, X입니다" 초단문 금지 → "이제 N번째 차원, X를 살펴보겠습니다"로.
> 7. **정보량 많은 비주얼은 내레이션을 길게** — shot 길이 = 그 라인의 오디오 길이다. `ProgressiveList`(2~7항목)·`FlowDiagram`(노드 다수)처럼 읽을거리가 많은 visual에 짧은 펀치라인("이 세 가지를 보세요")을 붙이면 화면이 스쳐 지나가 못 읽는다(실측: 3항목 리스트가 1.95초). 항목을 내레이션에 풀어 읽거나 맥락을 덧붙여 **읽을 시간만큼 길게** 쓴다.
> 8. **화면 텍스트는 프레임워크 용어를 한·영 병기, 내레이션은 한글만** — visual props의 라벨/제목/heading에 프레임워크·개념 용어가 나오면 **`한글 (English)`** 형태로 (예: `"승리의 수 (Winning Moves)"`, `"결정적 (Decisive)"`, `"가이드 원칙 (Guiding Principles)"`, `"7 Powers (7 파워스)"`). 한글-only 번역은 어색하고(특히 "승리의 수") 책 원어를 시청자가 못 잇는다. **Yes/No**도 화면 라벨은 영어(`→ No`, `Yes / No가 빨라진다`). 단 **내레이션(line.text)은 한글/음차 그대로** — TTS가 영어를 못 읽으니 "예스/노", "승리의 수"로 말한다. 즉 영어 병기는 **화면에만**. 로컬 번역어 선택: `Product Vision`→**프로덕트 비전**(제품 비전 ❌). (eyebrow 장식 라벨의 영어는 그대로 둬도 됨.)
>
> **합성 주의 단어 (Supertonic 문제 단어) — 내레이션에서 회피**:
>
> 아래 단어는 Supertonic이 **음절 수에 비해 턱없이 짧게 합성해 끝을 뭉갠다**(어미·라인 길이와 무관한 단어 단위 G2P 버그). 끝-잘림 회피(원칙 6)로도 안 고쳐지므로 **대본에서 대체어를 쓴다**:
>
> | 문제 단어 | 대체어 | 근거(실측) |
> |---|---|---|
> | **출발** ("출발했습니다/출발합니다") | **시작** ("시작했습니다") | 격리 프로브: `출발했습니다` 음성 0.31s vs `시작했습니다` 0.41s·`도착했습니다` 0.72s — "출발"만 절반 이하로 잘려 "출발해"처럼 들림. (내부 파일럿 scene05-line02) |
>
> 새 문제 단어를 발견하면 **격리 프로브로 음절당 음성 길이를 확인**(같은 음절 수의 정상 단어와 비교: `npx tsx -e`로 `SupertonicProvider().synthesize` → `ffmpeg silencedetect`)한 뒤 위 표에 추가한다. ("출발"처럼 한글 고유어는 `transliterate.ts` 음차 대상이 아니라 단어 교체로만 해결.)
>
> **시각 디렉티브 (visual) 결정 원칙**:
>
> - **첫 라인**은 반드시 `visual` 명시 — carry-forward 대상이 없음.
> - **carry-forward** — 같은 시각이 여러 line 동안 유지되어도 좋을 때 visual 생략. 변경 시점에만 새 visual 명시.
>
> **컴포넌트 선택 의사결정 트리** (위에서 아래로 가장 먼저 매치되는 것 선택):
>
> **다양성 tie-break (중요)**: 둘 이상이 비슷하게 들어맞거나 애매하면 **최근 5~6 shot에 안 쓴 컴포넌트를 우선**한다. 특히 7번 HighlightedLine은 거의 모든 "핵심 한 문장"에 들어맞아 과용되기 쉽다 — 같은 결론·정의라도 *결을 바꿔* 매핑할 수 있는지 먼저 보라: 사례가 있으면 image-first(SplitVisual/HeroImage), 수치면 StatHero, 항목 간 흐름이면 FlowDiagram, 나열이면 ProgressiveList. 영상 전체가 HighlightedLine·StockBg·ProgressiveList 세 가지로 수렴하면 단조로워진다(아래 **컴포넌트 다양성 바닥** 참조).
>
> 1. **이 라인이 새 챕터의 transition인가?** (운영자가 "자, 그럼 ~", "이제 ~ 단계로" 등으로 명시적 섹션 전환) → **SweepDivider** (1라인, 1~1.5초). 영상당 3~5회.
> 2. **이 라인이 "잘못된 X", "고장 난 X", 반전·임팩트 강조인가?** ("측정 불가능한 가설은 가설이 아니다", "이건 PM이 흔히 빠지는 함정") → **GlitchTransition** (1라인, 0.8~1.5초). **영상당 최소 1회 필수, 최대 2회.** 모든 영상엔 통념을 깨는 임팩트 모먼트가 최소 하나는 있다 — 가장 강한 반전·핵심 주장 한 줄을 골라 **반드시** GlitchTransition으로 박는다(없으면 `npm run lint:script`가 경고). 과사용은 산만하니 2회 이하로.
> 3. **이 라인이 영상 인트로 또는 시그니처 채널 콜아웃인가?** (영문 라벨이 자연스러운 채널명/섹션 약어) → **PixelTitle** (영문/숫자 라벨 + 한글 부제). 영상당 **0~1회**. 보통은 TitleCard로 충분.
> 4. **이 라인이 영상/챕터 제목·핵심 인용을 한 화면에 띄우는가?** (3~6초 머무는 정적 신호) → **TitleCard**. 영상 전체 4~6회 (1 오프닝 + 3~5 챕터 헤더).
> 5. **이 라인이 코드·SQL·CLI·로그·API 응답을 보여주거나, 둘 이상이 주고받는 대화/문답(인터뷰·회의 대화·메신저·Q&A)을 보여주는가?** → **TerminalCard**. `lines[]`에 prompt/output/comment 1~12개.
>    - **코드/CLI**: `prompt`(`$` 사용자 입력)·`output`(명령 결과)·`comment`(`#` 설명·머리말).
>    - **대화/문답**: 한 화자를 `prompt`, 상대 화자를 `output`으로 **번갈아** 매핑해 채팅 트랜스크립트처럼 보여준다. 화자 이름·맥락은 `comment`(`#`)나 `windowTitle`로. 예) `windowTitle: "제품팀 회의"`, `[{kind:"comment",text:"# 전략 발표 직후"}, {kind:"prompt",text:"디렉터: 이렇게 모호한데 어떻게 노라고 하죠?"}, {kind:"output",text:"PM: 그래서 활동 영역부터 좁혔습니다."}]`. 내레이션(line.text)은 한글 그대로(TTS), 화면 대사도 한글로 적는다.
> 6. **이 라인이 큰 숫자 1개를 강조하는가?** ("87% drop", "12분 안에 결정", "$1.5M ARR") → **StatHero**. 영상당 **1~3회** (희소가치). `scramble: true`는 dramatic 모먼트에서만.
> 7. **이 라인이 핵심 한 문장 정의·결론·격언인가?** (강조할 키워드 1~4개 식별 가능) → **HighlightedLine**. **가장 자주 쓸 씬** (영상당 6~10회). `highlights[]`는 text의 부분 문자열 그대로 (예: text="가설을 한 줄로 적고 측정 가능하게 만든다", highlights=["한 줄로","측정 가능"]).
> 8. **이 라인이 단계·체크리스트·순서가 있는 항목들인가?** → 두 갈래:
>     - 항목 **사이에 흐름·인과·전환(→)·퍼널·파이프라인**이 있나? ("인지→관심→전환→유지", "데이터 수집 → 가설 → 실험 → 학습") → **FlowDiagram**(라벨 노드 2~6개를 화살표로 연결, 화살표가 그려지며 흐름을 보여줌). 퍼널·유저 저니=`orientation:"vertical"`, 파이프라인·시간 흐름=`"horizontal"`. 영상당 **1~3회**.
>     - 그냥 *나열*(흐름 없음)이면 → **ProgressiveList**. spring 진입으로 더 생동감. 영상당 4~6회.
> 9. **이 라인이 정의 풀이·변수 나열·비교(시각 동기 불필요)인가?** → **BulletList**. ProgressiveList보다 더 단순한 fallback. items 2~7개.
> 10. **이 라인이 구체적 사례·제품·인물·장면을 *본문*으로 보여줄 가치가 있는가?** (정의를 뒷받침하는 실제 사례, "이런 화면", "이런 팀", "이런 제품") → image-first 씬. **세부 선택**:
>     - **실제 제품 UI/대시보드/화면을 콕 집어 보여주는가?** ("Linear의 이 보드", "Notion 이 뷰", "이 대시보드의 이 지표") → **ScreenshotCallout** + `image_ref`(라이브러리 파일명). stock 일반 이미지로는 "노트북 든 사람"밖에 안 나와 목적을 못 살리므로, **운영자 라이브러리에 실제 스샷이 있을 때만** 선택. 콕 집을 영역은 `annotations`(≤4)로. 라이브러리에 자산이 없으면 ScreenshotCallout 쓰지 말고 SplitVisual/HeroImage로.
>     - 텍스트와 이미지를 같은 화면에 두고 싶으면 **SplitVisual**(heading/items + 사례 이미지 절반), 강한 비주얼 한 장으로 압도하고 싶으면 **HeroImage**(풀블리드 이미지 + 캡션). broll_keywords 2~3개 필수.
>     - 셋 다 StockBg(배경 b-roll)보다 **우선** — 메모리 원칙상 미디어는 배경보다 본문으로. 영상당 합쳐서 4~8회.
> 11. **이 라인이 사례·맥락·분위기 b-roll이 필요한가?** (말하는 내내 뒤에 깔리는 환경/무드 영상) → **StockBg**. broll_keywords **3~5개** 필수 (서로 다른 앵글). 렌더가 라인 길이에 맞춰 키워드별로 *서로 다른 클립을 컷*으로 깔기 때문에 키워드가 많을수록 화면 변화가 풍부해진다. 추상 키워드는 0건이 잦으니 피하고 ("strategy" ❌, "team meeting whiteboard" ✓), 폴백 색 명시 (`fallback_color: "#0a0a0a"`).
>     - **추상 개념엔 stock을 억지로 쓰지 말 것**: "전략·정렬·성장·시너지·우선순위" 같은 추상어는 stock에서 *식상한 클리셰*(악수, 화살표 그래프, 빛나는 전구·뇌, 회의실 정장)밖에 안 나온다. 이럴 땐 StockBg 대신 **FlowDiagram·StatHero·Pixel차트·HighlightedLine·키네틱 텍스트**가 거의 항상 더 낫다 — *"이 라인이 보여줄 게 실제 장면인가, 아니면 개념인가? 개념이면 다이어그램/스탯으로."* stock은 **구체적·물리적 장면**(사람이 뭔가 하는 모습, 실제 장소·사물)에만 쓴다.
>     - **기본은 실사 영상/사진.** 일러스트(`flat illustration`·`isometric vector` 등 힌트 → Pixabay 일러스트 채널)는 **운영자가 원할 때만 옵트인**으로, 그리고 **컨택트시트로 한 장씩 육안 검수**해 채택한다. 실측상 Pixabay 일러스트 풀은 AI 생성물로 오염돼 "AI 느낌·저퀄"이 많고 운영자가 대부분 거부했다. 투기적으로 일러스트로 바꾸지 말 것. ⚠ **저작권 캐릭터 금지** — "심슨/픽사/디즈니" 같은 IP는 검색·사용 불가(Content ID 위험).
>
> **이모지 (의미의 구두점 — 장식 금지)**:
>
> 이모지는 *장식*이 아니라 내레이션이 힘주는 그 순간의 의미를 글자보다 빠르게 전하는 **마커**일 때만 쓴다. 깔아두는 앰비언트 이모지는 다크 에디토리얼 톤과 충돌해 "AI 느낌·저퀄"로 직행한다.
> - **판정/의사결정을 2~5개 옵션으로 비교**하는가? (이거 할까 말까, 적합/부적합, ship/kill, 리스크 점검) → **DecisionMatrix** (Tier1 정적 Twemoji SVG 마커, `verdict`: ✅통과 ❌부적합 ⚠️리스크 📈상승 📉하락). 행마다 한·영 병기(ko + en?). 영상당 **0~2회**.
> - **영상에서 가장 강한 리액션 1순간**인가? (훅 펀치라인, 결과 공개의 "짠") → **ReactionBeat** (Tier2 애니메이션 이모지 비디오 + 헤드라인. 🥳축하·🔥인기·🤩임팩트·🚀출시). **영상당 1개 하드캡** — 3D 만화 톤이라 남발하면 채널 결을 해친다(`npm run lint:script`가 2개째부터 경고).
> - **불변 규칙**: 이모지는 항상 화면 props(`verdict`/`emoji`)에만. **내레이션(line.text)엔 이모지를 절대 넣지 말 것** — Supertonic이 못 읽는다(화면 vs 내레이션 분리 원칙과 동일).
>
> **스타버스트 리빌 (키워드 reveal — 강한 1~2순간만)**:
>
> - **키워드·펀치라인을 "짠" 하고 터뜨리는 순간**인가? (훅의 반전 한 마디 "결국, 답은 **속도**였습니다", 챕터를 여는 강한 단어 "**버려라**", 결론 펀치 "전부 **갈아엎었습니다**") → **StarburstReveal** (Tier2 WebGL 방사형 광선이 헤드라인 뒤에서 팝하고 잦아드는 후광). **영상당 2개 하드캡** — 레트로 광선이라 남발하면 톤이 싸진다(`npm run lint:script`가 3개째부터 경고).
> - ⚠️ **수치·성과엔 쓰지 말 것**: 광선은 축하·"짠"·hype의 기호다. "전환율 3.2배" 같은 성과 수치에 두르면 *심야 홈쇼핑 느낌*이 나며 오히려 수치의 신뢰도를 깎는다. **숫자·% ·통화·배수는 무조건 StatHero**(클린 거대 숫자 + 카운트업 = 권위). `npm run lint:script`가 숫자만 든 headline을 경고한다(`starburst-numeric-headline`). 즉 StarburstReveal은 `ReactionBeat`과 같은 "감정 1순간" 슬롯이지 StatHero의 대체재가 아니다.
> - 화면 텍스트(headline/caption)는 한·영 병기 규칙 적용. 라이선스는 Remotion License(영상 내 attribution 의무 없음 — 이모지의 CC BY와 다름).
>
> **픽셀 데이터-비주얼 (적합성 기반 — 결에 맞으면 자유롭게)**:
>
> - `PixelBarChart`·`PixelDonut`·`PixelGauge`·`PixelStepTracker`·`PixelRoadmap`은 레트로/게임 결의 수치 시각화이자 **채널 차별화 자산**이다. "예외라서 명시적 이유가 있어야 쓴다"가 **아니라** — **데이터 모먼트의 결에 맞으면 적극 쓴다**. 억누르지 말 것(과소사용이 오히려 다양성 바닥을 깎는다 — 픽셀은 *덜* 쓰여서 문제였지 많이 쓰여서 문제였던 적이 없다).
>   - **픽셀이 맞는 곳**: 로드맵·여정(**PixelRoadmap**), 단계·진행 상태(**PixelStepTracker**), 대략 비율·"느낌"(**PixelGauge·PixelDonut**), 수치 배열 비교(**PixelBarChart**), 플레이풀·레트로 톤 섹션. 둥근 근사치일수록 잘 맞는다.
>   - **클린이 이기는 곳**: **정밀·권위가 핵심인 수치**(재무·정확한 %·출처 강조)는 **StatHero**가 신뢰감을 준다. 단일 숫자에 최대 임팩트가 필요할 때도 거대 StatHero. 같은 섹션에 사진/영상 b-roll이 깔려 톤이 충돌할 때도 클린.
>   - 즉 단일 숫자·비율도 *권위가 핵심이면* StatHero, *가벼운 톤·대략치면* PixelDonut/Gauge 둘 다 좋다 — **메시지에 결을 맞추는** 선택이지 픽셀을 줄이는 규칙이 아니다.
> - **균형(난잡 방지)**: 픽셀도 **여느 컴포넌트와 똑같은 다양성 균형**의 적용 대상이다 — 픽셀만 따로 낮게 캡 씌우지 않되, 픽셀이 새 HighlightedLine-34%가 되어 화면을 독점하지도 않게(`npm run lint:script` 분포 검사가 일반 규칙으로 잡는다, 픽셀 전용 캡 없음). **같은 데이터를 기본 씬과 픽셀로 중복 표현 금지**(예: 같은 %를 StatHero와 PixelDonut 둘 다 ❌). **픽셀 캐릭터·디졸브는 보류**(별개 hold, 쓰지 않음).
>
> **빈도 가이드 (10~15분 영상 기준)**:
>
> | 컴포넌트 | 빈도 | 비고 |
> |---|---|---|
> | HighlightedLine | 6~10 | 가장 자주 — PM 영상 핵심 무기 |
> | FlowDiagram | 1~3 | 흐름·퍼널·인과가 있을 때. 단순 나열은 ProgressiveList |
> | ProgressiveList | 4~6 | BulletList보다 우선 |
> | BulletList | 2~4 | ProgressiveList로 못 표현할 때만 |
> | TitleCard | 4~6 | 오프닝 1 + 챕터 헤더 |
> | SweepDivider | 3~5 | 챕터 transition |
> | SplitVisual | 3~6 | 정의/설명 + 사례 이미지. 텍스트와 미디어를 한 화면에 |
> | HeroImage | 1~3 | 강한 비주얼 한 장 + 캡션 |
> | ScreenshotCallout | 0~3 | **실제 UI 스샷이 라이브러리에 있을 때만**. 없으면 0 |
> | StockBg | 8~12 | 사례·분위기. 라인당 멀티컷이라 자산 수는 더 많음 |
> | StatHero | 1~3 | 희소가치 |
> | GlitchTransition | 1~2 (**최소 1 필수**) | 강한 임팩트·반전 모먼트 — 모든 영상 1회 이상 |
> | TerminalCard | 0~2 | 코드/CLI **또는 대화·문답(인터뷰·회의·Q&A) 장면** |
> | PixelTitle | 0~1 | 채널 시그니처 |
> | PixelBarChart / PixelDonut / PixelGauge / PixelStepTracker / PixelRoadmap | 0~4 | 결에 맞으면 적극(채널 자산). 일반 다양성 균형 안에서 자유롭게 — 픽셀 전용 하드캡 없음. 같은 데이터 중복 표현만 금지. 정밀·권위 수치는 StatHero |
> | DecisionMatrix | 0~2 | 판정/의사결정 비교(✅⚠️❌ 마커). 정적 SVG라 톤 부담 낮음 |
> | ReactionBeat | 0~1 (**하드캡 1**) | 가장 강한 리액션 1순간만. 애니 이모지=3D 만화 톤이라 1개 초과 금지 |
> | StarburstReveal | 0~2 (**하드캡 2**) | 키워드·펀치라인 reveal 광선. 수치·성과엔 금지(→StatHero). 레트로 톤이라 2개 초과 금지 |
>
> **HighlightedLine 작성 팁**: `highlights[]`는 narration의 의미 무게중심. 한 문장에서 시청자가 "기억해야 할" 2~3개 어절을 골라라. 너무 길면(전체 문장 절반 이상) 강조 효과 사라짐. 너무 짧으면(조사 1글자) 부자연스러움. 보통 명사구·동사구 단위 2~6자.
>
> **StatHero suffix 사용**: 단위는 `suffix`로 ("%", "x", "개월"), 통화 prefix는 `prefix`("$"). decimals=0이 기본, 소수가 의미있을 때(예: 1.5x)만 decimals=1.
>
> **TerminalCard lines.kind**: `"prompt"`는 `$` 접두사 (사용자 입력), `"output"`은 명령 결과, `"comment"`는 `#` 접두사 (설명·머리말 — 한국어 OK).
>
> **Carry-forward 길이 제한 (필수)**:
>
> - **연속된 같은 visual은 30초를 넘기지 말 것**. 라인당 ~10초 합성이면 같은 visual은 최대 3 라인 연속까지만 carry-forward.
> - **Opening 씬(scene01)은 콜드 오픈 — 첫 shot은 정적 TitleCard 금지** (`@VOICE.md §4`). 영상 첫 0~3초가 후킹의 핵심이라 내레이션(구체 장면·반전)과 화면이 *같이* 콜드 오픈해야 한다(양면 일치). **첫 shot이 영상 제목 카드면 콜드 오픈이 깨진다** — 제목 카드는 인사 비트로 민다. `npm run lint:script`의 `weak-opening`이 경고한다(첫 라인 내레이션이 "안녕하세요~"로 시작하거나 첫 visual이 TitleCard일 때).
>   - 권장 패턴: `line01 = 콜드 오픈 비주얼 훅 + 내레이션은 구체 장면·반전 → line02 인사+제목 TitleCard ("안녕하세요. 이번 영상은 ~") → line03 HighlightedLine (오늘의 한 줄 결론, 키워드 강조) → line04 ProgressiveList (시청자가 영상 끝에 얻을 것 3~5개)`.
>   - **line01 비주얼은 내레이션 콜드 오픈을 받쳐야 한다**: 내레이션이 구체 장면("버튼 색 하나 바꿨더니…")이면 그 장면을 HeroImage/StockBg(구체 b-roll)로, 반전 키워드("근데 진짜 문제는…")면 GlitchTransition/StarburstReveal로, 강한 한 줄이면 HighlightedLine(키워드 강조)으로. 추상 개념이라 구체 장면이 안 떠오르면 StockBg 말고 키네틱 텍스트·다이어그램으로(stock 억지 금지).
>   - **line01(콜드 오픈)에는 화면 텍스트 오버레이를 달지 말 것** — HeroImage `caption`/`title`/`eyebrow`, SplitVisual `heading` 등 라벨성 텍스트를 첫 shot에 넣으면, 바로 뒤 line02 TitleCard보다 "태그라인"이 먼저 떠 제목을 앞지르고 어색하다. 첫 shot은 **b-roll(비주얼) + 하단 내레이션 자막만**으로 콜드 오픈하고, 제목·요약 텍스트는 line02 TitleCard에 맡긴다. (캡션 라벨은 본론의 HeroImage shot부터 쓴다.)
> - **본론 씬도 60초 넘는 같은 visual 금지**. 정의·예시·반전 단계마다 visual 바꿔 시청자 시선 유지. HighlightedLine·StatHero·SweepDivider·GlitchTransition을 사이사이 끼워 결을 깬다.
> - **챕터 경계는 SweepDivider 권장** — 같은 톤이 너무 길게 이어지면 SweepDivider 1라인으로 결을 끊는 게 효과적. 영상에서 챕터 헤더 직전.
> - StockBg 매칭이 실패할 수 있으므로(추상 키워드일수록 0건 확률 높음) HighlightedLine·ProgressiveList로 정보를 함께 담아 폴백 시에도 화면이 빈약하지 않게. 단 매칭 실패가 두려워 StockBg를 *기피*하지는 말 것 — 키워드를 구체적으로 3~5개 주면 카스케이드가 거의 매치한다.
>
> **미디어 밀도 바닥 (필수)**:
>
> - **텍스트 전용 컴포넌트(TitleCard/BulletList/HighlightedLine/ProgressiveList/SweepDivider/StatHero/TerminalCard/PixelTitle)만으로 연속 3 shot을 넘기지 말 것.** 그 안에 미디어 씬(StockBg/SplitVisual/HeroImage)을 최소 1회 끼워 시각 자료를 공급한다. 텍스트 카드만 길게 이어지면 "소스 빈약" 영상이 된다.
> - **영상 전체 shot의 약 1/4~1/3은 미디어 씬(StockBg/SplitVisual/HeroImage)을 갖도록** 분포시킨다. 정의·결론은 HighlightedLine으로, 그 정의를 *뒷받침하는 사례·제품·현장*은 바로 다음에 SplitVisual/HeroImage(본문 이미지)나 StockBg(배경 b-roll)로 — 텍스트와 미디어를 번갈아.
> - **본문 vs 배경**: 사례가 "이 화면/이 제품/이 사람"처럼 구체적이면 SplitVisual·HeroImage(본문 이미지)를 우선하고, 단지 무드·환경이면 StockBg(배경)로. 미디어를 배경으로만 쓰지 말 것.
> - 긴 내레이션 구간(한 visual이 8초 이상)에서 StockBg를 쓰면 렌더가 자동으로 여러 클립을 컷으로 나눠 깐다. 그러니 **길게 설명하는 라인일수록 StockBg + 키워드 4~5개**가 효과적.
>
> **컴포넌트 다양성 바닥 (권고 — `npm run lint:script`가 경고)**:
>
> 영상이 단조로워지는 1순위 원인은 소수 컴포넌트 편중이다(실측: 한 영상이 19종 중 7종만, HighlightedLine 혼자 34%, image-first 0). 아래를 *영상 전체 분포* 기준으로 지킨다. lint가 carry-forward를 해소해 측정하고 `script-review.html` 상단 **분포 패널**로 보여주며 위반을 경고한다(하드 게이트 아님 — 부적합 컴포넌트 억지 삽입의 역효과를 피하려 운영자 판단에 맡김).
> - **distinct ≥ 8종** (10~15분 영상 기준; 짧은 영상은 길이에 비례 완화). 카탈로그를 폭넓게 써라.
> - **단일 컴포넌트 ≤ 전체 shot의 25%**. HighlightedLine이 가장 흔해도 1/4를 넘기면 일부를 다른 컴포넌트로 분산(위 tie-break).
> - **같은 컴포넌트 인스턴스 연속 ≤ 3 shot**. 서로 다른 다이어그램/리스트를 4개 이상 연달아 두지 말 것. (한 비주얼을 여러 라인 hold하는 carry-forward는 *위 carry-forward 30초 규칙* 영역이라 별개 — 여기선 "다른 인스턴스 4+ 연속"만 본다.)
> - **image-first(SplitVisual/HeroImage/ScreenshotCallout) ≥ 1~2개**. 사례·제품은 배경(StockBg)이 아니라 본문 이미지로.
>
> **broll_keywords 작성 원칙**:
>
> - 영어 키워드 권장 (Unsplash/Pexels/Pixabay가 영어 인덱스 강함).
> - 너무 추상적이면 0건 ("strategy" ❌). 시각적·구체적으로 ("team meeting whiteboard", "city skyline night").
> - **3~5개를 서로 다른 앵글로** 써라. 렌더가 키워드별로 *서로 다른 클립*을 골라 화면에 번갈아 깔기 때문에, 같은 뜻의 동의어(❌ "office", "workplace", "workspace")보다 **다른 장면**(✓ "developer typing code", "sticky notes wall", "user testing session")을 주는 게 변화가 크다.
> - 1순위 → 폴백 순으로 배열. 앞 키워드가 더 자주 화면에 등장한다.
> - **AI-영상 클리셰 금지** — 누구나 쓰는 그 스톡은 피한다: `business handshake`, `glowing brain/lightbulb`, `abstract digital network/data stream`, `faceless suit/businessman`, `3D arrow going up`, `corporate teamwork pose`, `puzzle pieces`, `gears`, `diverse team smiling at laptop`, `lightbulb idea moment`. 시청자가 "또 그 영상이네" 하지 않게.
> - **구체화 사다리 (진부함 탈출의 핵심 method — denylist만으론 부족)** — 클리셰를 "피하라"고만 하면 모델은 금지어를 피한 뒤 *그다음으로 흔한* 일반 장면으로 도망간다(`handshake`를 피하고 `office people meeting`으로). 진부함을 실제로 깨는 건 **개념을 키워드로 적지 않고, 그 라인이 떠올리게 하는 *구체적인 한 장면*을 적는 것**이다. 각 키워드에 가능한 한 다음을 박아라: **[누가] + [구체적 행동(동사)] + [장소·환경] + [선택: 빛/질감]**. 일반어 1개(`meeting`)보다 **구체어 3~5개로 된 한 장면**(`programmer at dual monitors in a dim room`)이 스톡에서 덜 식상하고 매치도 더 잘 된다.
>   - "성장" → ❌ `business growth` → ✓ `barista restocking shelves`, `seedling trays under grow lights`
>   - "협업" → ❌ `team collaboration` → ✓ `designers arranging sticky notes on a glass wall`, `hand writing on a whiteboard`
>   - "집중·몰입" → ❌ `focus productivity` → ✓ `programmer reviewing code at night`, `person with headphones working in a cafe`
>   - "전환" → ❌ `business handshake` → ✓ `runner crossing a finish line`, `open door into a bright room`
>   - 카테고리(`developer`)가 아니라 *그 사람이 지금 뭘 하고 있는지*(`developer hands typing code on keyboard`)를 적는다. **구체 장면이 안 떠오르는 라인이면 그건 애초에 stock 신호가 아니다** — 추상 개념은 위 StockBg 항목("추상 개념엔 stock 억지로 쓰지 말 것")대로 FlowDiagram·StatHero·키네틱 텍스트로 보낸다.
>   - **길이 스윗스폿 = 구체어 3~5개 (실측 검증).** 인원수(`six people`)·정확한 시각(`late afternoon`)·`pushing to production`처럼 *눈에 안 보이는 토큰*을 문장처럼 길게 붙이면 Pexels API가 단편만 매칭해 오히려 빗나간다(실측: `six people at a standup by a window, late afternoon` → 엉뚱한 거리 사진). **피사체+행동+장소 3~5어면 충분**하고, 그 길이의 구체 키워드는 0건이 거의 안 난다(Pexels 퍼지 매칭 — 12개 테스트 쿼리 전부 15+건 반환).
> - **빈 화면 기기 회피** — "휴대폰/노트북/대시보드" 의도면 `phone mockup`·`blank smartphone`·`empty laptop screen`처럼 *기기를 정면으로 비추는* 키워드는 흰 빈 화면이 잡힌다. 대신 **사람이 쓰는 모습·손·어깨너머·옆모습**으로 (✓ `person scrolling phone in cafe`, `hands typing on laptop closeup`, `over the shoulder using app outdoors`). (파이프라인이 `mockup/blank/isolated` 태그 자산을 자동 후순위로 밀지만, 키워드부터 화면-정면을 피하는 게 1차 방어다.)
> - **일러스트/카툰 결은 기본 사용 안 함(옵트인)** — Pixabay 일러스트는 AI 느낌·저퀄이 많아 운영자가 거부한 이력. 운영자가 명시적으로 원할 때만 `flat illustration`·`isometric vector` 힌트를 붙이고, **반드시 컨택트시트로 검수** 후 채택. ⚠ 저작권 IP 캐릭터(심슨 등) 금지.
> - **기존 자산 재활용으로 쿼터 절약** — `assets/stock/library.md`(크로스-에피소드 자산 카탈로그, 있으면)를 훑어 이미 가진 자산과 맞는 장면이 있으면 그 키워드 결을 따른다. `/render`의 stock 단계가 API를 치기 전에 글로벌 풀에서 매치 자산을 자동 재활용한다(다양성 위해 에피소드당 ≤40%, 나머지는 새 소재). 단 **재활용을 노려 키워드를 일부러 좁히지는 말 것** — 위 "다른 앵글" 원칙이 우선이고 재활용은 매치될 때만 따라온다.
> - **HeroImage/SplitVisual**도 broll_keywords로 본문 이미지를 받는다 — 2~3개면 충분(멀티컷이 아니라 1장). 그 라인의 *사례 주제*를 구체적으로 (예: heading "사용자 인터뷰"면 `["user interview one on one", "person taking notes"]`).
> - StockBg/HeroImage/SplitVisual이 아닌 line은 빈 배열 `[]` 또는 생략 가능.
> - **carry-forward 규칙**: visual을 생략한 line(carry-forward)은 broll_keywords도 생략. storyboard 단계가 직전 visual의 키워드를 그대로 carry. visual을 새로 명시하면서 그게 StockBg/HeroImage/SplitVisual이면 그 line에서 broll_keywords를 새로 작성.
>
> **image_ref 작성 원칙 (큐레이션 라이브러리)**:
>
> - `image_ref`는 운영자 소유 큐레이션 라이브러리 `assets/images/library/`에 있는 **자산 파일명**이다 (예: `"linear-board.png"`, `"funnel-diagram.png"`). stock으로는 못 구하는 실제 제품 UI 스샷·직접 만든 다이어그램·특정 인물 사진이 여기 있다.
> - **두 갈래 폴백 체인**: `image_ref`가 지정되면 stock보다 **우선**해 그 자산을 쓴다. 라이브러리에 그 파일이 없으면(miss) 경고 후 `broll_keywords`로 stock 폴백. 그래서 image_ref를 쓰는 미디어 씬도 broll_keywords를 함께 주면 안전하다.
> - **ScreenshotCallout은 image_ref가 본질** — 실제 스샷이 없으면 이 씬을 쓰지 말 것(폴백은 텍스트라 약함). 라이브러리에 있는 파일만 참조하라. 운영자가 어떤 자산을 보유했는지 확실치 않으면 ScreenshotCallout 대신 SplitVisual/HeroImage로.
> - **HeroImage/SplitVisual도 image_ref 사용 가능** — 특정 라이브러리 이미지를 본문으로 핀하고 싶을 때. 안 주면 broll_keywords로 stock에서 받는다.
> - `..`·절대경로 금지, 확장자 필수 (path traversal 차단). 라이브러리 루트 기준 상대 파일명만.
>
> **id 작성 원칙**:
>
> - `/^[a-zA-Z0-9_-]+$/` 준수.
> - 추천 포맷: `"scene{NN}-line{MM}"`. 예: `"scene01-line01"`, `"scene01-line02"`, `"scene02-line01"`.
> - 영상 전체에서 유일.
>
> **출력은 JSON만**. 코드 펜스 금지.

## User prompt

> 다음 treatment를 라인 단위 대본으로 풀어내라.
>
> --- TREATMENT ---
> {{treatment.json 내용}}
> --- END TREATMENT ---
>
> --- SYNOPSIS (참조용) ---
> {{synopsis.json 내용 — audience/tone_notes 참고}}
> --- END SYNOPSIS ---
>
> --- SOURCE (사실 근거 — source.txt 있을 때만) ---
> {{source.txt 내용 — 각 씬의 사실·수치·고유명사·인용은 여기서만 가져온다}}
> --- END SOURCE ---
>
> 작성 규칙:
>
> 1. **라인 분할** — 각 씬을 여러 line으로 분할. 씬당 라인 수는 `duration_sec / 6` 근방을 기준으로 (한 라인 ~5~8초 합성). 짧은 씬(<30초)은 2~5 line, 본론 씬(~120초)은 12~20 line.
>
> 2. **id 부여** — `scene{NN}-line{MM}` 포맷. 두 자리 zero-padded. 영상 전체에서 유일.
>
> 3. **text 작성** — `@VOICE.md` 톤 그대로. 한 호흡 단위 ~30~80자. 끊고 싶은 곳에 쉼표 1~2개. 마침표는 line 끝에만.
>
> 4. **visual 매핑** — 첫 line은 반드시 명시. 이후 carry-forward 활용. 변경 시점에 명시. 시스템 프롬프트의 **컴포넌트 선택 의사결정 트리**를 라인마다 위에서 아래로 적용해 매칭되는 첫 컴포넌트를 사용. 빈도 가이드 표를 영상 전체 분포 기준으로 준수.
>    - 핵심 한 줄 정의/결론은 **HighlightedLine** (highlights 2~3개 어절)
>    - 항목 사이에 흐름·인과·퍼널·파이프라인이 있으면 **FlowDiagram** (노드 2~6개를 화살표로 연결)
>    - 단계·체크리스트(흐름 없는 나열)는 **ProgressiveList** (BulletList보다 우선)
>    - 큰 숫자 1개 강조는 **StatHero** (suffix로 단위)
>    - 챕터 transition은 **SweepDivider** (1라인, 짧게)
>    - "잘못된 X" 반전 임팩트는 **GlitchTransition** (영상당 **최소 1회 필수**, 최대 2회)
>    - 코드/SQL/CLI **또는 대화·문답(인터뷰·회의·Q&A)** 장면은 **TerminalCard** (대화는 화자 번갈아 prompt/output)
>    - 채널 시그니처는 **PixelTitle** (있을 때만)
>    - 영상 도입·챕터 헤더는 **TitleCard**
>    - 일반 항목 나열은 **BulletList** (fallback)
>    - 실제 제품 UI/대시보드를 콕 집어 보여줄 땐 **ScreenshotCallout** + `image_ref`(라이브러리 자산 있을 때만)
>    - 구체적 사례·제품·인물을 본문 이미지로 보여줄 땐 **SplitVisual**(텍스트 곁들임)·**HeroImage**(풀이미지) — StockBg보다 우선
>    - 단지 분위기·환경 b-roll은 **StockBg** (구체적 영어 키워드)
>
> 5. **broll_keywords / image_ref** — StockBg는 **3~5개**(서로 다른 앵글, 각 키워드가 별도 B-roll 컷). HeroImage/SplitVisual은 **2~3개**(본문 이미지 1장). 영어로, **개념이 아니라 구체적인 한 장면**으로 적어라 — `[누가]+[구체 행동]+[장소]+[빛/질감]`(시스템 프롬프트 '구체화 사다리'). 클리셰(`handshake`·`glowing brain`·`3D arrow up`·`diverse team at laptop`) 금지, 카테고리어(`developer`) 대신 그 사람이 *지금 뭘 하는지*. 구체 장면이 안 떠오르는 추상 개념이면 StockBg 말고 다이어그램/스탯으로. 다른 line은 `[]` 또는 생략.
>    - **image_ref**: 실제 제품 UI 스샷 등 라이브러리 자산을 쓸 땐 `image_ref`에 파일명. ScreenshotCallout는 거의 필수. image_ref가 있어도 stock 폴백용 broll_keywords를 함께 주면 안전.
>    - **미디어 밀도**: 텍스트 카드만 연속 3 shot 넘기지 말고 미디어 씬(StockBg/HeroImage/SplitVisual/ScreenshotCallout)을 끼울 것. 전체 shot의 1/4~1/3은 미디어 씬이 되도록.
>
> 6. **씬-라인 경계** — 새 씬의 첫 line은 반드시 `visual` 명시. 운영자 톤 전환어 ("자, 그럼 ~", "그래서 이제 ~", "다음으로는 ~") 자연스럽게.
>
> 7. **분량 가이드 — 씬별 예산 + 자가 점검 (필수)** — 한 번에 전체를 쓰면 누적 분량을 못 느껴 목표보다 짧게 끝나기 쉽다(실측: 단일 패스가 목표의 **62%**까지 미달). 그러니 **씬마다 글자수 예산을 그 씬 `duration_sec × 9`로 잡고**(Supertonic M1 speed 1.4, ≈9자/초) 각 씬을 그 예산(±10%)에 닿도록 충분히 풀어 써라. 예: 95초 씬 ≈ **855자**, 130초 씬 ≈ **1170자**. 정보량 많은 비주얼(ProgressiveList·FlowDiagram·TerminalCard)일수록 항목을 내레이션에 풀어 길게(읽을 시간 확보 + 분량 확보 동시). **다 쓴 뒤 씬별 글자수를 점검**해 예산의 90% 미달 씬은 설명·사례·용어 풀이를 더해 채운다(억지 반복 말고 내용으로). 전체 합계는 `treatment duration_sec 합 × 9`(≈ `duration_min × 60 × 9`)에 닿아야 영상이 목표 길이가 된다. speed 1.0 기준 옛 값(4~6자/초)으로 쓰면 30% 짧아지니 주의.
>
> 8. **소스 충실 — 씬별 grounding (source.txt 있으면 필수)** — 각 씬을 쓰기 전에 위 SOURCE에서 그 씬의 `purpose`·`visual_concept`에 해당하는 사실(수치·고유명사·인용·사례 디테일)을 찾아 **그것만 근거로 삼아라**. 소스에 없는 프레임워크 용어·수치·회사/인물명을 지어내지 말 것. 실측: 이 grounding이 source-fidelity 위반을 **43건→2건**으로 줄였다(단일 패스가 병렬 fan-out 없이도 같은 충실도를 얻는 값싼 레버). source.txt가 없으면 treatment·synopsis 범위 안에서만.
>
> JSON만 출력하라.

---

## 검증

1. `ScriptSchema.parse(...)` 통과.
2. 모든 `id`가 유일.
3. 첫 line에 `visual` 존재.
4. `BulletList` / `ProgressiveList`를 사용하는 라인의 `items.length`가 2~7. `FlowDiagram`은 `nodes.length`가 2~6.
5. 미디어 씬을 매핑한 라인의 소스 확보: `StockBg`/`HeroImage`/`SplitVisual`은 `broll_keywords.length` ≥ 1 (StockBg 3~5개 권장 — 적으면 멀티컷 변화 줄어듦, 1~2개면 경고. HeroImage/SplitVisual은 2~3개). `ScreenshotCallout`은 `image_ref` 또는 `broll_keywords` 중 하나는 있어야 함(둘 다 없으면 텍스트 폴백만 — 경고).
   - **image_ref**: 패턴 `/^(?!.*\.\.)[a-zA-Z0-9][a-zA-Z0-9._/-]*\.[a-zA-Z0-9]+$/` 통과(`..`·절대경로 reject). (실제 파일 존재 여부는 `/render`의 stock 단계가 확인 — miss면 stock 폴백.)
   - **미디어 밀도**: 텍스트 전용 컴포넌트만 연속 4 shot 이상 이어지면 경고. 미디어 씬(StockBg/HeroImage/SplitVisual/ScreenshotCallout)이 전체 shot의 ~1/4 미만이면 경고 (사례·이미지 보강 권유).
   - **컴포넌트 다양성**: `npm run lint:script`가 carry-forward 해소 후 distinct<8·단일 컴포넌트>25%·동일 인스턴스 4연속·image-first 0을 경고하고 `script-review.html` 상단 분포 패널로 시각화한다. 권고 수준(하드 게이트 아님) — 단조로우면 의사결정 트리의 **다양성 tie-break**로 분산.
6. `HighlightedLine`을 사용하는 라인의 모든 `highlights[i]`가 `text`의 부분 문자열이어야 함 (그렇지 않으면 강조가 렌더링 안 됨).
7. `StatHero.value`는 `number`, `decimals`는 0~3.
8. `GlitchTransition`: **0회면 경고(최소 1회 필수)**, 3회 이상이면 경고(과사용). `PixelTitle` 2회 이상 경고. `npm run lint:script`의 컴포넌트 분포 검사가 검출.
   - `ReactionBeat`(애니메이션 이모지)는 **영상당 1개 하드캡** — 2개째부터 `animated-emoji-cap` 경고. `DecisionMatrix.rows[].verdict`·`ReactionBeat.emoji`는 enum이라 미가용 값은 `ScriptSchema.parse`가 reject. **이모지는 절대 `line.text`(내레이션)에 넣지 말 것**(TTS 미독).
9. 운영자 톤 sanity check — grep으로 금기 패턴 검출:
   - `"혁명적|게임 체인저|패러다임|최고의|유일한|반드시.*해야|구독.*좋아요|좋아요.*구독"`
10. (선택) 각 line의 text 글자 수가 5~150자 범위.

검증 실패 시 LLM 재호출 또는 운영자 보고.

## 다음 단계

**먼저 `/script-review <slug>` 권장** — TTS/렌더가 워딩을 굽기 전에 번역체·어색한 한글·미음차 약어·강조어 불일치를 검수하는 게이트(결정적 린트 + CC 의미 검토). 재합성/재렌더를 막는다.

그다음 `/storyboard <slug>` — script.json을 shot 단위 storyboard로 평탄화 + meta(fps/해상도/트랜지션) 추가.

## 비고

- `transliterate.ts`의 `TRANSLITERATION_MAP`이 자동으로 영어 약어를 음차로 변환하므로, text 안에 'PM', 'PRD', 'UX/UI'를 그대로 써도 합성 단계에서 자연스럽게 처리된다. 새 약어가 나오면 `TRANSLITERATION_MAP`에 추가.
- 운영자가 특정 line의 시각이 마음에 안 들면 `script.json`을 직접 편집해도 좋음 — zod 스키마만 통과하면 `/storyboard`가 그대로 받음.
- 본 단계가 영상 1편의 LLM 비용 대부분을 차지 (가장 긴 출력). 재시도 시 tone_notes를 명시적으로 보강하는 게 효율적.
