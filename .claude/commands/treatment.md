---
description: synopsis.json을 영상 구조(scene 3+개)로 분해한 treatment.json 생성
argument-hint: <slug>
---

# /treatment

영상을 **씬(scene) 단위 비트 구조**로 풀어낸다. 각 씬은 영상에서 차지하는 역할(beat)·목적·예상 길이·시각 컨셉 메모를 가진다. 이 단계가 영상의 골격이 되며, `/script`가 이 골격에 대본 라인을 채운다.

## 인자

`$ARGUMENTS` = `slug` (필수). `/^[a-z0-9][a-z0-9-]{0,63}$/`.

## 입력

- `episodes/<slug>/synopsis.json` 필수.

## 출력

`episodes/<slug>/treatment.json` — `TreatmentSchema` (`src/schemas/treatment.ts`) 준수.

```ts
{
  scenes: [
    {
      id: "scene01",            // /^scene\d{2,}$/ 형식, 유일
      beat: string,             // 영상 구조 라벨. 2자 이상. 예: "Hook", "Problem", "Framework", "Example", "Limitation", "Closing"
      purpose: string,          // 이 씬이 시청자에게 만드는 변화. 5자 이상
      duration_sec: number,     // 양수. 예상 길이 (reconcile이 실제 오디오로 덮어씀)
      visual_concept: string    // 자유 형식 시각 메모. 3자 이상. script가 컴포넌트로 구체화
    },
    // ... 최소 3개
  ]
}
```

---

## 동작

1. `$ARGUMENTS` slug 검증.
2. `episodes/<slug>/synopsis.json` Read 후 `SynopsisSchema.parse`로 형상 확인.
3. `VOICE.md` Read + (선택) `REFERENCE/*.md` 중 synopsis takeaways에 관련된 카드 Read.
4. 아래 system + user prompt를 자체 추론으로 실행.
5. 결과를 `episodes/<slug>/treatment.json`에 Write.
6. `TreatmentSchema.parse`로 검증 — `id`가 `/^scene\d{2,}$/`, scenes ≥ 3, id 유일성.
7. `sum(duration_sec)`이 `synopsis.duration_min × 60` 의 ±15% 범위인지 확인. 벗어나면 재분배 또는 운영자에 보고.
8. 결과 프리뷰 출력 + `/script <slug>` 안내.

---

## System prompt

> 당신은 `@channel.config.md`에 정의된 YouTube 채널의 시니어 작가다. 채널의 주제·타겟 시청자·톤은 `@channel.config.md`와 `@VOICE.md`를 따른다.
>
> 이 단계는 **영상 구조 설계**다. 한 편의 영상을 3~7개 씬(scene)으로 나누고, 각 씬이 시청자에게 어떤 변화를 만드는지 명확히 한다. 씬은 작은 단원이 아니라 **시청자의 머릿속에서 일어나는 단계적 사고 전환**이다.
>
> **운영자 톤에서의 영상 구조 패턴** (`@VOICE.md` 후크 섹션 참고):
>
> 1. **Opening (scene01)** — **콜드 오픈**(`@VOICE.md §4`): 구체 장면·반전 한 마디로 먼저 잡고 → "안녕하세요. 이번 영상은 ~" 인사+주제 → 얻을 것 예고. `purpose`에 "콜드 오픈으로 0~3초에 시청자를 잡는다"를 명시. `visual_concept`은 **첫 shot이 정적 타이틀 카드가 아니라** 그 장면/반전을 받는 비주얼(구체 b-roll·HeroImage, 또는 GlitchTransition/StarburstReveal 반전 키워드)임을 적고 제목 카드는 인사 비트로 미룬다. duration_sec ~20~35초. 클릭베이트·과장어·운영자 이름 금지(콜드 오픈 ≠ 어그로).
> 2. **Setup / Problem** — 시청자가 공감할 만한 문제·맥락·실무 통증. 운영자 본인 경험 또는 잘 알려진 사례. duration_sec ~60~120초.
> 3. **Core (1~3 씬)** — 본론. 프레임워크/방법론의 정의·구조·구체 예시. 각 ~90~180초.
> 4. **Caveat / Limitation** (선택) — 본론에 대한 반전·한계. "근데 진짜 문제는 ~" 같은 운영자 시그니처. ~60~120초.
> 5. **Closing** — 마무리 + 학습 권유. CTA 없음. ~15~45초.
>
> **씬 합산 길이**가 `synopsis.duration_min × 60` 초 근처가 되도록 분배한다.
>
> **분량 캘리브레이션 (실측)**: 렌더 영상 길이는 treatment의 `duration_sec` 추정이 아니라 **내레이션 총 글자수**가 결정한다 — Supertonic speed 1.4에서 **약 9자/초**(실측 내부 파일럿: 9,130자 → 1,022초 = 17.0분). 15분 영상이면 `/script` 단계에서 **~8,300자**가 필요. treatment의 scene별 `duration_sec` 합은 이 목표(분×60)에 맞춰 잡고, 본론(개념·사례) 씬에 분량을 몰아준다.
>
> **구조 패턴 — 개념 먼저, 사례 나중 (프레임워크·책 리뷰에 권장)**: 프레임워크/방법론을 다루는 영상은 **앞부분에서 개념을 정의·정리**하고 **뒷부분에서 하나의 사례로 끝까지 적용**하는 2부 구성이 잘 통한다(실측 내부 파일럿). 낯선 번역 용어(결정성 등)는 개념 파트 첫 등장에서 쉬운 우리말로 풀이. 이 구성은 분량 확보(개념 설명이 길어짐)와 이해도 모두에 유리.
>
> **출력은 JSON만**. 코드 펜스 금지.

## User prompt

> 다음 synopsis를 영상 구조(treatment)로 분해하라.
>
> --- SYNOPSIS ---
> {{synopsis.json 내용}}
> --- END SYNOPSIS ---
>
> 작성 규칙:
>
> 1. **scenes 배열**: 최소 3개, 일반적으로 5~7개. 각 씬은 `id`, `beat`, `purpose`, `duration_sec`, `visual_concept`를 가진다.
>
> 2. **id**: `"scene01"`, `"scene02"`, ... 두 자리 zero-padded. 유일해야 함.
>
> 3. **beat**: 영상 구조 라벨. 다음 중에서 선택하거나 적절한 라벨 자유 작성:
>    `"Opening"`, `"Hook"` (scene01은 콜드 오픈 — 구체 장면·반전 먼저, 인사는 그 다음 비트. VOICE.md §4), `"Problem"`, `"Context"`, `"Framework"`, `"Definition"`, `"Mechanism"`, `"Example"`, `"Comparison"`, `"Limitation"`, `"Caveat"`, `"Application"`, `"Closing"`, `"Reflection"`.
>    한 영상에 같은 beat가 두 번 등장해도 좋다 (예: Example × 2).
>
> 4. **purpose**: "이 씬이 끝났을 때 시청자가 무엇을 알게 되거나 어떻게 느끼는가"를 한 문장으로. 5자 이상. 추상적 표현 금지.
>    - 좋은 예: "RICE의 네 변수가 각각 무엇인지 정의를 잡는다."
>    - 나쁜 예: "RICE를 설명한다."
>
> 5. **duration_sec**: 양수. 위 시스템 프롬프트의 권장 범위 참고. 합산은 `synopsis.duration_min × 60`의 ±15% 이내.
>
> 6. **visual_concept**: 자유 형식 메모. 한 문장~두 문장. 어떤 시각 컴포넌트가 어울릴지 힌트를 적되 props까지 채울 필요는 없음 (`/script`가 구체화).
>    - 좋은 예: "타이틀 카드 + RICE 공식 텍스트 강조"
>    - 좋은 예: "사무실 회의 broll 위에 핵심 인용 자막"
>    - 좋은 예: "BulletList로 4변수 비교, 옆에 단색 폴백 배경"
>    - **컴포넌트 다양성은 treatment 단계에서 배분하라 (실측 효과 큼)**: `/script`의 의사결정 트리는 greedy first-match라 소수 컴포넌트(HighlightedLine·StockBg)로 수렴하는 구조적 편향이 있다. 그러니 **각 씬 visual_concept에 구체 컴포넌트를 미리 지정**해 영상 전체가 카탈로그를 폭넓게 쓰도록 사전 배분한다(실측 내부 파일럿: 이 방식으로 19종 중 15종·다양성 flag 0). 예: 한 씬은 `FlowDiagram`(흐름), 다음은 `SplitVisual`(사례 이미지), 다음은 `TerminalCard`(대화/판정), 데이터는 `StatHero`/`PixelBarChart` 식으로 분산. 제약: 픽셀 데이터-비주얼 합쳐서 ≤2개, `GlitchTransition` 1~2개(반전 모먼트), `ScreenshotCallout`은 실제 UI 라이브러리 자산 있을 때만.
>
> 7. **씬 합산**: `sum(duration_sec)` ≈ `synopsis.duration_min × 60`. 첫 씬 + 마지막 씬을 제외한 본론 씬들이 대부분의 분량을 차지하도록.
>
> JSON만 출력하라.

---

## 검증

1. `TreatmentSchema.parse(...)` 통과 — `id` regex, `scenes ≥ 3`, id 유일성, 각 필드 min 길이.
2. `sum(duration_sec)`이 `synopsis.duration_min × 60`의 ±15% 범위. 벗어나면 LLM에 재요청 또는 운영자 결정.
3. 모든 `beat` 라벨이 한 단어 또는 짧은 영어 (한국어 자유 형식도 허용).
4. `id`가 `scene01`부터 시작해 연속(scene01, scene02, scene03 ...)인지 권장 (강제 아님 — schema는 유일성만 검사).

검증 통과 시 운영자에게 씬 구조 프리뷰 (id + beat + purpose 한 줄 요약) 출력.

## 다음 단계

`/script <slug>` — 각 씬을 라인 단위 대본으로 풀어내고 각 라인에 시각 컴포넌트(VisualSpec)를 매핑.

## 비고

- 운영자가 씬 구조에 동의하지 않으면 직접 `treatment.json`을 수정한 뒤 `/script`로 진행해도 좋다 — zod 스키마만 통과하면 다음 단계가 그대로 받음.
- `beat` 라벨은 자유 형식이지만 일관성 위해 위 후보군 우선 사용.
- 본 단계는 LLM 호출이 가볍다 (입력 ~1KB). 재시도 비용 거의 0.
