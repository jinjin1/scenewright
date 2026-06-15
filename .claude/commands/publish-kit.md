---
description: 전 단계 산출물 + stock manifest → YouTube 업로드용 제목/설명/태그/썸네일. OpenRAIL-M AI disclaim + stock attribution 자동 부착
argument-hint: <slug>
---

# /publish-kit

영상을 YouTube에 업로드할 때 필요한 메타데이터를 모은다. **AI 음성 disclaim(OpenRAIL-M)은 의무** — Supertonic 음성 사용 disclaim이 자동으로 영상 설명에 들어간다(누락 시 라이선스 위반, 유일한 하드 게이트). stock attribution은 **법적 의무가 아니라 예의**다 — Unsplash·Pexels·Pixabay 라이선스 모두 attribution을 요구하지 않는다(appreciated, not required). 그래서 크리에이터 크레딧은 **압축 형태**(사진작가당 1줄, 긴 media URL 제거)로만 넣고, **description은 YouTube 한도 5000자를 넘지 않도록 강제**하며, 전체 자산별 크레딧은 `publish/credits.txt`로 분리한다.

## 인자

`$ARGUMENTS` = `slug` (필수).

## 입력

- `episodes/<slug>/synopsis.json` — 제목·설명 본문의 핵심
- `episodes/<slug>/treatment.json` — 챕터(타임스탬프) 후보
- `episodes/<slug>/script.json` — 인용·키워드 후보
- `episodes/<slug>/storyboard.json` — 보정된 duration_sec 합 = 영상 총 길이
- `episodes/<slug>/assets/stock/manifest.json` — stock attribution (있으면)

## 출력

`episodes/<slug>/publish/publish.json` — 구조:

```ts
{
  title: string,                  // YouTube 제목 (40~70자 권장)
  description: string,            // 멀티라인 영상 설명 (요약 + 챕터 + disclaim + attribution)
  tags: string[],                 // 5~15개. 한국어 + 영어 PM 키워드
  thumbnail: {
    path: string,                 // "publish/thumbnail.png" (생성됨)
    source: "remotion-frame" | "manual",
    frame: number                 // remotion-frame인 경우 캡처한 frame 번호
  },
  metadata: {
    duration_sec: number,         // storyboard 합산
    slug: string,
    generated_at: string,         // ISO 8601
    ai_voice_disclaimer_included: true,    // 항상 true. 강제
    stock_attribution_included: boolean    // stock manifest 0건 폴백이면 false
  }
}
```

추가로:
- `episodes/<slug>/publish/thumbnail.png` — Remotion 컴포지션의 한 프레임 캡처 (별도 cli 호출).
- `episodes/<slug>/publish/description.txt` — `publish.json.description`을 그대로 떼서 YouTube Studio에 붙여넣기 쉬운 평문 파일 (≤5000자).
- `episodes/<slug>/publish/credits.txt` — 전체 자산별 stock 크레딧(`formatAttribution`, media URL 포함). description엔 압축본만 들어가므로, 운영자가 크리에이터를 충분히 크레딧하고 싶으면 이걸 **고정 댓글**에 붙인다. manifest에 stock 자산이 없으면 생성 안 함.

---

## 동작

1. slug 검증.
2. 입력 파일 4종 + (선택) manifest.json Read 및 zod parse:
   - `SynopsisSchema`, `TreatmentSchema`, `ScriptSchema`, `StoryboardSchema`
   - manifest는 attribution 모듈이 이미 검증.
3. `src/pipeline/disclaim.ts`의 `AI_VOICE_DISCLAIMER_KO` Read (단일 소스, 인용 금지 - import 또는 직접 파일에서 가져옴).
4. (선택) `src/pipeline/stock/attribution.ts`: manifest entries의 `attributions[]`를 한 배열로 모은 뒤 — description용 **`formatAttributionCompact(used)`**(사진작가당 1줄, media URL 없음)와 credits.txt용 **`formatAttribution(used)`**(전체) 둘 다 준비.
5. 아래 system + user prompt를 자체 추론으로 실행해 title/description/tags 생성.
6. **AI disclaim 강제 부착** — LLM 결과의 `description`을 받은 뒤, `AI_VOICE_DISCLAIMER_KO`가 포함되지 않으면 description 끝에 자동 부착 (LLM이 빠뜨려도 보강).
7. **stock attribution(예의) 부착 + 5000자 캡** — manifest에 `provider !== null` 자산이 있으면 **압축 attribution**(`formatAttributionCompact`)을 description 끝(disclaim 위)에 붙인다. 단 [요약 + 챕터 + AI disclaim]을 먼저 확정하고, 압축본을 더해도 **5000자를 넘으면** description엔 포인터 한 줄("📷 크리에이터 크레딧: 고정 댓글 참고")만 남기고 전체는 `credits.txt`로 보낸다. **전체 크레딧(`formatAttribution`)은 항상 `publish/credits.txt`에 기록.** (AI disclaim은 항상 보존 — 그게 유일한 의무.)
8. 썸네일 생성 — `npm run thumbnail -- <slug>` 또는 동등 호출. 결과를 `episodes/<slug>/publish/thumbnail.png`로 저장.
9. `publish.json` Write + `description.txt` 파생 Write.
10. 검증 — 아래 "검증" 섹션의 강제 조건 모두 통과.
11. 프리뷰 출력: 제목, 설명 첫 5줄, 태그 목록, 썸네일 경로. 운영자가 YouTube Studio에서 그대로 붙여넣을 수 있도록.

---

## System prompt

> 당신은 `@channel.config.md`에 정의된 YouTube 채널의 시니어 작가다. 채널의 주제·타겟 시청자·톤은 `@channel.config.md`와 `@VOICE.md`를 따른다.
>
> 이 단계는 **YouTube 업로드용 메타데이터** 작성이다. 제목·설명·태그를 만든다. 영상 본편의 톤과 동일하게 — 자극적 클릭베이트 금지, 운영자 톤 유지.
>
> **제목 작성 원칙**:
>
> - 40~70자 권장 (한국어 기준). 너무 짧으면 클릭 단서 부족, 너무 길면 검색 결과에서 잘림.
> - synopsis.logline을 그대로 쓰지 말고, 검색 친화적으로 다듬되 어그로·과장 금지.
> - 책 리뷰면 책 제목 명시. 프레임워크면 프레임워크 이름 명시.
> - 좋은 예: "Continuous Discovery Habits 리뷰 — 지속적인 고객 인터뷰가 PM 의사결정을 바꾸는 방식"
> - 나쁜 예: "PM이 무조건 알아야 할 ⚡ 충격적인 ⚡ 고객 인터뷰 비법!!"
>
> **설명(description) 작성 원칙** (멀티라인):
>
> 1. **상단 요약** (3~5문장) — synopsis.logline + takeaways를 자연스러운 문단으로. 어그로 금지.
> 2. **챕터 (타임스탬프)** — treatment.scenes의 누적 시작 시각을 `MM:SS` 또는 `HH:MM:SS`로. 예: `"00:00 Opening / 00:32 RICE란 무엇인가 / 02:18 변수 풀이"`.
>    - storyboard의 보정된 `duration_sec`을 scene_id별로 합산해 시작 시각 계산.
>    - 운영자의 beat 라벨을 자연스러운 한국어 챕터명으로 변환 ("Hook" → "도입", "Framework" → "프레임워크 정의", "Closing" → "마무리").
> 3. **참고 도서/링크** (선택) — synopsis나 script에 책·아티클이 언급되면 안내. 단, 본인이 확인하지 못한 URL은 추가하지 말 것.
> 4. **AI disclaim 자리** — 자동 부착되니 LLM이 미리 적지 말 것. 만약 적었더라도 시스템이 중복 제거.
> 5. **Stock attribution 자리** — 자동 부착되니 LLM이 미리 적지 말 것.
>
> **태그 작성 원칙**:
>
> - 5~15개. 한국어 PM 키워드 + 영어 보조.
> - 책/프레임워크 이름, PM 직무 키워드, 시청자 페르소나 키워드.
> - 좋은 예: `["PM", "프로덕트 매니저", "고객 인터뷰", "Continuous Discovery", "Teresa Torres", "디스커버리", "PM 책 리뷰"]`
> - 너무 broad한 단일 키워드 (예: `"제품"`, `"기획"`) 단독으로는 무의미 — 구체적으로.
>
> **출력은 JSON만**. 코드 펜스 금지. 본 system prompt에서 정한 스키마(`{ title, description, tags }`) 그대로.

## User prompt

> 다음 자료로 YouTube 업로드용 메타데이터를 작성하라.
>
> --- SYNOPSIS ---
> {{synopsis.json}}
> --- END SYNOPSIS ---
>
> --- TREATMENT (챕터 후보) ---
> {{treatment.json}}
> --- END TREATMENT ---
>
> --- STORYBOARD (보정된 duration) ---
> {{storyboard.json — meta + shots[].duration_sec, scene_id}}
> --- END STORYBOARD ---
>
> --- SCRIPT 발췌 ---
> {{script.json에서 첫 라인 1개 + 핵심 라인 3~5개}}
> --- END SCRIPT 발췌 ---
>
> 작성 규칙:
>
> 1. **title** (40~70자): 위 system 원칙 따름.
>
> 2. **description**:
>    - 첫 단락 = 영상 요약 (3~5문장). synopsis.logline의 핵심 + takeaways를 풀어쓴 형태. 운영자 톤.
>    - 두 번째 블록 = `📌 챕터` 헤더 + 타임스탬프 목록. scene별 누적 시간 계산:
>      ```
>      cumulative = 0
>      for each scene in treatment.scenes (ordered):
>        timestamp = formatTime(cumulative)   // "MM:SS" 또는 "HH:MM:SS"
>        line = `${timestamp} ${chapterName(scene.beat)} — ${scene.purpose의 짧은 버전}`
>        cumulative += sum(storyboard.shots where scene_id === scene.id).duration_sec
>      ```
>    - 세 번째 블록 (선택) = `📚 참고`. source에 명시된 책·아티클이 있으면. 확인되지 않은 URL 금지.
>    - **AI disclaim 자리/stock attribution 자리는 비워둘 것** — 시스템이 자동 부착.
>
> 3. **tags**: 5~15개. 한국어 PM 키워드 우선 + 책/프레임워크 영어 키워드.
>
> JSON만 출력하라. 형식:
> ```json
> { "title": "...", "description": "...멀티라인...", "tags": ["...", "..."] }
> ```

---

## 강제 후처리 (자동 부착)

LLM 출력을 받은 뒤, 아래 블록을 description 끝에 부착한다(1·2는 무조건, 3은 이모지 사용 시). LLM이 적어놨더라도 중복 제거 후 정규화.

### 1. Stock attribution (예의 — 압축)

Unsplash·Pexels·Pixabay 라이선스는 attribution을 **요구하지 않는다**(appreciated, not required). 그래서 description엔 **압축본**(`formatAttributionCompact`)만 넣는다 — 사진작가당 1줄, photographer 링크만(폭주 원인이던 긴 media URL 제거). `(provider, photographer)` 중복 제거, 순서 Unsplash → Pexels → Pixabay.

```
📷 Stock media: Unsplash · Pexels
- Jonathan Borba (Unsplash) https://unsplash.com/@jonathanborba
- Jane Doe (Pexels) https://www.pexels.com/@janedoe
...
```

전체 자산별 크레딧(media URL 포함, `formatAttribution`)은 `publish/credits.txt`에 따로 쓴다. **description이 5000자를 넘으면** 위 압축본도 빼고 포인터 한 줄("📷 크리에이터 크레딧: 고정 댓글 참고")로 대체한다(전체는 credits.txt).

### 2. AI 음성 disclaim 블록

**항상 부착**. description 가장 끝.

```
─────────────
🎙️ 이 영상의 내레이션은 AI 음성 합성(Supertonic)으로 제작되었습니다.
음성 합성 모델은 OpenRAIL-M 라이선스에 따라 사용되었으며, 모델의 use-based restrictions를 준수합니다.
```

문구는 `src/pipeline/disclaim.ts`의 `AI_VOICE_DISCLAIMER_KO` + `AI_VOICE_DISCLAIMER_LICENSE_NOTE`를 단일 소스로 사용. 직접 인용 금지.

### 3. 이모지 attribution (CC BY 4.0 — 의무, 사용 시에만)

영상이 이모지 컴포넌트를 *실제로 쓴 경우에만* 부착한다(`storyboard.json`의 shots에서 `component` 검출). 이모지 에셋은 CC BY 4.0이라 stock(예의)과 달리 attribution이 **법적 의무** — 짧으므로 5000자 캡에서도 **절대 트리밍하지 않는다**(AI disclaim과 동급 하드 게이트).

- `DecisionMatrix` 사용 → `EMOJI_ATTRIBUTION_TWEMOJI` (정적 마커 = Twemoji)
- `ReactionBeat` 사용 → `EMOJI_ATTRIBUTION_NOTO` (애니메이션 = Google Noto)

```
🎨 이모지 그래픽: Twemoji © Twitter, Inc. 및 기여자, CC BY 4.0 (https://github.com/jdecked/twemoji).
애니메이션 이모지: Noto Emoji © Google, CC BY 4.0 (https://github.com/googlefonts/noto-emoji).
```

문구는 `src/pipeline/disclaim.ts`의 `EMOJI_ATTRIBUTION_TWEMOJI` / `EMOJI_ATTRIBUTION_NOTO`를 단일 소스로. 쓴 컴포넌트의 줄만 넣는다(둘 다 쓰면 둘 다). `publish/credits.txt`에도 동일 부착.

---

## 검증 (강제)

1. `publish.json` zod-like 형상 점검 — 필수 필드 누락 없음.
2. `description`이 `AI_VOICE_DISCLAIMER_KO` 문자열을 **반드시 포함**. 누락이면 자동 부착 후 재검증.
3. **`description.length ≤ 5000`** (YouTube 하드 한도). 초과면 압축 attribution을 포인터 한 줄로 트리밍 후 재검증. manifest에 `provider !== null` 자산이 있으면 `publish/credits.txt`가 생성되어야 함(전체 크레딧 보존처).
4. `metadata.ai_voice_disclaimer_included === true`. 항상 true. false면 publish 단계 자체 실패.
5. `title.length`가 20~100자 범위.
6. `tags.length`가 3~20 범위.
7. 운영자 톤 sanity check — title/description에 금기 표현 없음:
   - `"혁명적|게임 체인저|패러다임|최고의|유일한|반드시.*해야|구독.*좋아요|좋아요.*구독|클릭|⚡|🔥{3,}|💯"`
8. 챕터 타임스탬프 합산이 `sum(storyboard.shots[].duration_sec)`과 일치 (±5초).
9. **이모지 attribution(CC BY 4.0 의무 — 사용 시)**: storyboard에 `DecisionMatrix`가 있으면 `description`이 `EMOJI_ATTRIBUTION_TWEMOJI`를, `ReactionBeat`이 있으면 `EMOJI_ATTRIBUTION_NOTO`를 **반드시 포함**. 누락이면 자동 부착 후 재검증. AI disclaim과 함께 5000자 캡에서도 트리밍 금지(의무).

검증 실패 시:
- Disclaim 누락 → 자동 부착 후 재검증. 그래도 실패 시 운영자 보고.
- 이모지 attribution 누락(해당 컴포넌트 사용 시) → 자동 부착 후 재검증. CC BY 4.0 의무라 disclaim과 동급 하드 게이트 — 누락 상태로 publish 산출 금지.
- description > 5000자 → 압축 attribution을 포인터 한 줄로 트림(전체는 credits.txt). 그래도 초과면 챕터·요약을 줄이고 운영자 보고. (stock attribution은 법적 의무가 아니므로 누락·축약이 publish를 막지 않는다 — AI disclaim만 하드 게이트.)
- 금기 표현 검출 → LLM 재호출 또는 운영자 보고.

---

## 썸네일

`npm run thumbnail -- <slug>` 호출 (또는 동등 코드 경로). 기본은 Remotion Episode 컴포지션의 frame 30 (TitleCard가 fade-in 완료된 시점)을 PNG로 캡처.

운영자가 별도로 작성한 thumbnail.png가 `episodes/<slug>/publish/thumbnail.png`에 이미 있으면 덮어쓰지 않음. 대신 `publish.json.thumbnail.source = "manual"`로 표시.

---

## 다음 단계

운영자가 직접 YouTube Studio에서 업로드:

1. `out/final.mp4` 업로드
2. `publish/description.txt` 내용을 영상 설명에 붙여넣기 (AI disclaim + 압축 크레딧 포함, ≤5000자). 전체 크리에이터 크레딧을 남기고 싶으면 `publish/credits.txt`를 **고정 댓글**로 추가
3. `publish/thumbnail.png`를 커스텀 썸네일로 설정
4. `publish.json.tags`를 태그 필드에 입력
5. **추가 수동 확인**:
   - Studio의 "AI 생성 콘텐츠" 토글이 있다면 켤 것 (YouTube의 별도 정책)
   - 카테고리: 교육 또는 과학기술
   - 공개 범위 결정

업로드 후 운영자가 **채널 정체성에 부합하는지** 최종 판정. 부합 시 Phase A 파일럿 성공.

## 비고

- LLM 호출은 CC 세션이 직접 수행. SDK 사용 금지.
- 이 단계는 컴플라이언스 의무가 가장 강함 — disclaim/attribution 누락은 OpenRAIL-M 및 stock provider 약관 위반. **자동 부착 로직을 우회하지 말 것**.
- 운영자가 description을 수정해 disclaim을 지우는 건 운영자 판단 (커맨드의 영역이 아님), 단 커맨드 산출물 자체는 항상 disclaim 포함 상태여야 함.
- 영문 운영(future) 시 `AI_VOICE_DISCLAIMER_EN`도 지원. 현재는 한국어 채널 가정.
