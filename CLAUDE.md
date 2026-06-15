# CLAUDE.md — scenewright

> **scenewright** = a Claude Code-native pipeline that turns a source text into a narrated, Remotion-rendered YouTube **explainer video** — for *any* topic. You drive it by running slash commands in a Claude Code session.

## 프로젝트 정체성

운영자가 Claude Code 세션 안에서 슬래시 커맨드(`/synopsis`, `/treatment`, `/script`, `/storyboard`, `/tts`, `/render`, `/publish-kit` 등)를 순차 실행하여 원하는 주제의 교양·explainer YouTube 영상을 자동 제작합니다. 채널의 **주제·페르소나·타겟**은 `channel.config.md`에서 설정하고, **문체**는 `VOICE.md`에서 관리합니다 — 코드 수정 없이 어떤 세그먼트로도 쓸 수 있습니다. 외부 자동화 서버나 백그라운드 잡, headless CI는 명시적으로 도입하지 않는 한 없습니다.

## 핵심 아키텍처 원칙

1. **LLM 호출은 Claude Code 세션이 직접 수행한다**
   - `@anthropic-ai/sdk` / `ANTHROPIC_API_KEY` 사용 안 함 — 모든 LLM 추론은 CC 세션의 Claude가 직접 한다
   - 슬래시 커맨드 `.claude/commands/*.md` 파일에 system prompt + user prompt 본문을 직접 작성
   - CC 세션의 Claude가 프롬프트를 실행하고 결과 JSON을 Write 툴로 저장 → zod 스키마(`src/schemas/`)로 검증
   - 결과: 영상당 LLM 비용이 CC 구독 안에 흡수되어 사실상 **$0**

2. **단계 간 인터페이스는 JSON-as-contract**
   - 각 단계는 `episodes/{slug}/<stage>.json`을 입력으로 받고 출력으로 쓴다 → 단계 재시작/부분 재생성 가능
   - zod로 모든 단계의 in/out 검증

3. **TTS는 Supertonic (로컬 ONNX) 고정**
   - 합성: `src/pipeline/tts.ts`의 `SupertonicProvider` → `python/synthesize.py` 서브프로세스
   - 기본 파라미터: `voice="M1"`, `total_steps=16`, `speed=1.4`, `lang="ko"` (`SUPERTONIC_DEFAULT`)
   - Apple Silicon CPU에서 RTF ≈ 0.43 (10분 영상 합성 ~4분). 모델 캐시는 `~/.cache/supertonic3/`(프로젝트 외부, 첫 실행 시 다운로드)
   - 프리셋 음성 10종(M1~M5/F1~F5)만 사용 — 보이스 클로닝/유료 Voice Builder 미사용. `TTSProvider` 인터페이스는 유지(향후 모델 교체 여지)

4. **영어 약어 → 한글 음차 변환은 필수 전처리**
   - Supertonic normalization이 숫자/통화/시간은 처리하지만 영어 약어(예: KPI, A/B)는 발음이 샌다
   - `src/pipeline/transliterate.ts`의 `TRANSLITERATION_MAP`이 단일 소스. `/tts`가 합성 전 모든 라인에 자동 적용
   - **새 주제의 영어 용어를 만나면 `TRANSLITERATION_MAP`에 추가하고 단위 테스트 보강** — 이게 도메인 확장 포인트다

5. **단계별 사람 승인 게이트**
   - 각 커맨드 끝에 결과 프리뷰 + "이대로 진행하려면 `/<다음단계>`" 안내 → 비싼 단계 재시도 비용 0 유지

## 워크플로우 (7단계)

```
(채널 설정: channel.config.md + VOICE.md)
        │
/new-episode → /synopsis → /treatment → /script → /script-review → /storyboard
        │
        ▼
/tts → /render → /publish-kit  →  episodes/{slug}/out/final.mp4
```

## 디렉터리 구조

```
scenewright/
├── channel.config.md      # 채널 주제·페르소나·타겟 (← 여기를 바꾸면 어떤 주제로도)
├── VOICE.md               # 대본 스타일 가이드 (톤·후크·금기) — 템플릿
├── examples/VOICE.pm.md   # 채워진 톤 가이드 예시 (PM 교육 채널)
├── .claude/commands/      # 슬래시 커맨드 (프롬프트 본문 포함)
├── src/
│   ├── remotion/          # Root, compositions, scenes, theme
│   ├── pipeline/          # tts.ts, transliterate.ts, stock.ts, reconcile.ts, captions.ts, thumbnail.ts, disclaim.ts
│   │   └── cli/           # tsx 진입점 (npm run tts 등)
│   └── schemas/           # zod 스키마 (synopsis/treatment/script/storyboard/library)
├── python/
│   ├── synthesize.py      # Supertonic 합성 브리지
│   └── requirements.txt
├── REFERENCE/             # 도메인 지식 카드 (예시: RICE.md, JTBD.md — 당신 주제 카드로 교체/추가)
├── public/                # 공유 자산 (이모지 등)
├── tests/
└── episodes/{slug}/       # 단계별 JSON, assets/(gitignored), out/(gitignored)
```

## 품질 바

- 영상 길이: 짧은 데모는 2~3분, 일반 편성은 10~15분
- 영상당 비용: **$0** (CC 구독 + 로컬 Supertonic ONNX)
- 사람 작업 시간: ≤ 1시간 (LLM 대기 + TTS 합성 ~4분 포함)
- 원하는 채널에 업로드 가능한 품질이라고 판정될 것

## 슬래시 커맨드 인덱스

| 커맨드 | 단계 | 입력 → 출력 |
|---|---|---|
| `/new-episode` | 셋업 | 슬러그 → `episodes/{slug}/` 생성 + `source.txt` |
| `/synopsis` | 1 | `source.txt` → `synopsis.json` |
| `/treatment` | 2 | `synopsis.json` → `treatment.json` |
| `/script` | 3 | `treatment.json` → `script.json` (인라인 VISUAL 디렉티브) |
| `/script-review` | 3.5 (게이트) | `script.json` 워딩 검수 — `npm run lint:script` + CC 의미 검토. **TTS/렌더 전에** 잡아 재작업 방지 |
| `/storyboard` | 4 | `script.json` → `storyboard.json` |
| `/tts` | 5 | `script.json` → `assets/audio/<id>.wav` (Supertonic, 한글 음차 자동) |
| `/render` | 6 | `storyboard.json` + `audio/` → `out/final.mp4` (Remotion) |
| `/publish-kit` | 7 | 전 단계 산출물 → 제목/설명/태그/썸네일. **AI 음성 disclaim + 자산 attribution 자동 삽입** |

## 라이선스 컴플라이언스 (산출 영상)

리포 코드는 MIT지만, **영상 산출물**엔 다운스트림 의무가 따른다 (`NOTICE` 단일 인덱스):

- **Supertonic 모델 = OpenRAIL-M**: 상업·수익화 허용되나 AI 생성임을 명시(disclaim)해야 한다. `/publish-kit`이 영상 설명·엔드 카드에 자동 삽입:
  > 이 영상의 내레이션은 AI 음성 합성(Supertonic)으로 제작되었습니다.
- **이모지 에셋 = CC BY 4.0 (attribution 의무)**: `DecisionMatrix`(Twemoji)·`ReactionBeat`(Google Noto)를 쓴 영상은 `/publish-kit`이 attribution을 설명에 자동 부착(`src/pipeline/disclaim.ts` 단일 소스, 5000자 캡에서도 트리밍 금지).
- **스톡(Pexels/Unsplash/Pixabay)**: attribution은 의무 아닌 "예의" — `/publish-kit`이 압축 크레딧으로 부착.

## 제작 가이드 — 하드원 학습 (Production gotchas)

실제 제작에서 데인 것들. 각 항목은 명시한 곳에 코드/린트로 강제돼 있다. 새 에피소드 전에 한 번 훑을 것.

- **TTS 끝-잘림 (Supertonic)** — 짧은 라인(≤~20자)이 "입니다"·짧은 구어 어미("어요/세요")로 끝나면 끝 2~3음절을 누락한다. **길게 + 견고한 어미("~살펴보겠습니다")로 리라이트 + 핵심어 앞쪽.** → `/script` 핵심원칙, `/script-review`의 `tts-truncation-risk` lint.
- **shot 길이 = 오디오 길이** — 읽을거리 많은 visual(`ProgressiveList`·`FlowDiagram`)에 짧은 내레이션을 붙이면 화면이 스쳐 못 읽는다. 내레이션을 읽을 시간만큼 길게.
- **화면 텍스트 한·영 병기, 내레이션은 한글만** — visual props의 전문 용어는 `한글 (English)` 병기, Yes/No도 화면은 영어. 내레이션(line.text)은 음차 한글(TTS가 영어 못 읽음).
- **일러스트는 기본 OFF** — Pixabay 일러스트는 AI 느낌·저퀄이 많아 권장하지 않음. 기본은 실사 영상/사진, 옵트인 + 컨택트시트 육안 검수 통과한 것만.
- **stock API 쿼터** — Unsplash 무료 50건/시간. `npm run stock` 반복 재실행이 쿼터를 태운다(403/429). 키워드 확정 후 1회만. **증분 캐시 구현됨** — 키워드 안 바뀐 재렌더는 쿼터 거의 0, 전체 재수집만 `--force`. 키 없으면 단색 배경 폴백.
- **두 개의 렌더 전 게이트** — `/render` 전에 반드시 ① `script-review.html`(워딩) ② `assets/stock/contact-sheet.html`(b-roll 육안). 둘 다 굽기 전에 본다. 렌더 시간은 길이·b-roll 종류 비례(`gl=angle` 기본): 이미지 위주 RTF~1.56, 비디오 b-roll 위주 RTF~2.0. 비디오 컷이 이미지보다 ~2배 무겁다.
- **`/render`는 4-stage 시퀀스** — 반드시 `npm run stock` → `npm run reconcile` → `npm run captions` → `npm run render` **순서대로**. `npm run render`만 돌리면 stock manifest 없음(b-roll 사라짐)·reconcile 안 됨(오디오/자막 desync)·captions 없음으로 **깨진 영상**이 난다.
- **렌더 도중 시스템 슬립 = 렌더 사망 (체크포인트 없음)** — Remotion은 중간 산출물을 저장 안 한다. macOS면 render.ts가 `caffeinate -dimsu`로 슬립을 막지만, **배터리+뚜껑 덮음(clamshell)은 OS가 강제로 재워 막을 수 없다.** 장편 렌더는 **AC 연결 + 뚜껑 열어둘 것.**

## 기여 / Git

표준 PR 흐름: `git switch -c feat-<작업명>` → 작업·커밋 → push → PR. **콘텐츠 커밋과 코드 커밋을 같은 커밋에 섞지 말 것** — 산출물(`episodes/{slug}/`)과 코드(`src/`·`tests/`)는 경로로 분리해 따로 커밋한다(`git add -A` 지양). 무거운 자산(`assets/audio/`·`assets/stock/pool/`·`out/`)은 gitignore.

## 금기 사항

- `@anthropic-ai/sdk` 의존성 추가 / `ANTHROPIC_API_KEY` 사용 (이 프로젝트의 LLM 호출은 CC 세션이 직접 한다)
- 별도 cost 추적 모듈 작성 (CC 구독에 흡수됨)
- 영어 약어를 `TRANSLITERATION_MAP` 없이 그대로 TTS에 넣기 (발음 깨짐)
- `/publish-kit`이 AI 생성 disclaim 표기를 빠뜨리고 산출 (OpenRAIL-M 위반)
- 코드 수정과 에피소드 데이터를 한 커밋에 융합 (경로로 분리)
