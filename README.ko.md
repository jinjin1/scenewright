# scenewright

[English](README.md) · **한국어**

**소스 텍스트 한 편을, 내레이션과 Remotion 렌더가 입혀진 YouTube explainer 영상으로 바꿔 주는 Claude Code 네이티브 파이프라인 — 주제 무관, 영상당 비용 ~$0.**

[Claude Code](https://claude.com/claude-code) 세션 안에서 슬래시 커맨드를 실행해 굴립니다. 각 단계는 JSON 파일을 입력으로 받고 출력으로 씁니다(`JSON-as-contract`). 그래서 어느 단계든 다시 시작하고 검수할 수 있습니다. 내레이션은 Supertonic TTS 모델로 **로컬 합성**(한국어), 화면은 [Remotion](https://remotion.dev)으로 렌더합니다. LLM 추론은 *당신의 Claude Code 세션 안에서* 일어나므로 API 키도, 영상당 모델 비용도 없습니다.

> **숏폼 양산기가 아닙니다.** scenewright는 **장편 explainer**를 지향하고, **Claude Code 안에서** 돌며, **로컬 $0 한국어 TTS**를 쓰고, Remotion으로 렌더합니다. 사람이 단계마다 승인하는 구조적 제작 파이프라인이지, 원클릭 바이럴 클립 기계가 아닙니다.

> ⚠️ 내레이션은 **한국어**입니다 (Supertonic 보이스 프리셋과 영어→한글 음차 단계가 한국어 전용). 주제·세그먼트는 자유롭게 바꿀 수 있지만 언어는 (아직) 고정입니다.

---

## 동작 방식

```
(한 번 설정: channel.config.md + VOICE.md)
        │
/new-episode → /synopsis → /treatment → /script → /script-review → /storyboard
        │                                            (워딩 게이트)
        ▼
/tts → /render → /publish-kit  →  episodes/{slug}/out/final.mp4
```

각 커맨드는 결과를 미리 보여주고 다음 단계를 안내합니다 — 비싼 단계(TTS·렌더) 전에 당신이 승인합니다.

## 왜 영상당 ~$0인가

| 비용 항목 | 어떻게 흡수되나 |
|---|---|
| LLM (대본 작성) | **당신의 Claude Code 세션 안에서** 실행 — CC 구독에 포함, API 키 불필요 |
| TTS (내레이션) | **로컬** Supertonic ONNX 모델 |
| 스톡 미디어 | 무료 티어 API(Pexels/Unsplash/Pixabay) + 본인 키 — 없으면 단색 배경 폴백 |
| 렌더 | 로컬 Remotion |

## 사전 요건

- **Claude Code** — `/synopsis … /publish-kit` 단계는 CC 세션에서 실행되는 슬래시 커맨드입니다
- **Node** ≥ 18.18 + npm
- **Python** 3.10 + [`uv`](https://github.com/astral-sh/uv) — Supertonic 브리지용
- **macOS / Apple Silicon** 권장 (Supertonic이 M 시리즈 CPU에서 RTF ~0.43)
- *선택:* `.env`에 스톡 API 키 (`.env.example` 참고). 없으면 미디어 shot이 단색 배경으로 폴백됩니다.
- **Remotion**은 npm으로 설치됩니다. 상업·팀 사용 시 Remotion 자체 라이선스를 확인하세요 (`NOTICE` 참고).

## 빠른 시작

```bash
git clone https://github.com/jinjin1/scenewright.git && cd scenewright
npm install
# 로컬 TTS용 Python 환경
cd python && uv venv && uv pip install -r requirements.txt && cd ..
cp .env.example .env   # (선택) 스톡 API 키 입력
```

그다음, 이 저장소에서 연 **Claude Code 세션**에서:

```
/new-episode my-first-topic     # episodes/my-first-topic/ + source.txt 생성
# episodes/my-first-topic/source.txt 에 소스 텍스트를 붙여넣기
/synopsis my-first-topic
/treatment my-first-topic
/script my-first-topic
/script-review my-first-topic   # 워딩 게이트 (또는: npm run lint:script)
/storyboard my-first-topic
/tts my-first-topic
/render my-first-topic          # stock → reconcile → captions → render
/publish-kit my-first-topic     # 제목/설명/태그/썸네일 + 필수 고지문
```

산출물: `episodes/my-first-topic/out/final.mp4`.

## 채널 설정 (어떤 주제든)

엔진은 **도메인 중립**입니다. 주제 관련 내용은 세 파일에 모여 있습니다:

| 파일 | 무엇을 정하나 |
|---|---|
| **`channel.config.md`** | 채널 주제(niche), 페르소나, 타겟 시청자, 핸들 |
| **`VOICE.md`** | 대본 톤, 콜드 오픈 후크, 금기 클리셰, 자연스러운 한국어 규칙 (템플릿 — `examples/VOICE.pm.md`가 채워진 예시) |
| **`REFERENCE/`** | 작가가 참조하는 "도메인 지식 카드" (RICE/JTBD는 예시) |

이 세 파일만 바꾸면 파이프라인 전체가 새 주제로 재조준됩니다 — 코드 수정 없이.

## 어떤 주제가 잘 맞나?

faceless explainer 포맷 조사(자동 생성 안전성·스톡 가용성·법적 리스크) 기반:

| | 세그먼트 |
|---|---|
| ✅ **잘 맞음** | 과학/우주 · "사물의 원리"/공학 · 역사 · 테크/AI · 비즈니스 사례 |
| ⚠️ **가드 필요** | 건강/심리(**기전 설명만 — 의료 조언 금지**) · 개인 금융(**리터러시만 — 투자 조언 금지**) · 자기계발 |
| ❌ **피하기** | 책/영화/IP 요약(저작권) · 의료·금융 **조언**(YMYL) · 속보 |

리포 기본 데모 **`episodes/why-sky-blue`**(왜 하늘은 파란가)는 퍼블릭 소스(NASA·Wikipedia)로 만든 과학 explainer입니다 — 특정 도메인에서 일부러 가장 멀리 둬, 파이프라인이 범용임을 보여줍니다.

## 저장소 구조

```
channel.config.md   VOICE.md   examples/VOICE.pm.md
.claude/commands/   # 슬래시 커맨드 (프롬프트 본문)
src/                # remotion 씬, pipeline (tts, stock, transliterate, …), zod 스키마
python/             # Supertonic 합성 브리지
REFERENCE/          # 도메인 지식 카드 (예시)
episodes/{slug}/    # 에피소드별 JSON 계약 (+ gitignore된 assets/out)
NOTICE              # 공개하는 영상에 따르는 의무
```

## 공개 전 의무 (업로드 전에 읽어보세요)

코드는 MIT지만, **당신이 생성한 영상**에는 일부 고지 의무가 따릅니다 — `/publish-kit`이 자동 처리합니다. `NOTICE` 참고:

- **AI 음성 고지** (Supertonic = OpenRAIL-M) — 설명·엔드 카드에 자동 삽입
- **이모지 attribution** (Twemoji / Google Noto, CC BY 4.0) — 해당 씬을 쓰면 자동 부착
- **Remotion 라이선스** — 상업·팀 사용 시 회사 라이선스가 필요할 수 있음

## 상태

이것은 **개인 영상 제작 워크플로의 레퍼런스 구현**으로, 출발점으로 삼으라고 오픈소스로 공개한 것입니다. 의견이 강하게 반영돼 있고, 한국어 내레이션 중심이며, 있는 그대로 제공됩니다 (MIT, 무보증). 이슈·포크 환영합니다.

## 라이선스

코드는 [MIT](./LICENSE). 생성 영상에 따르는 의무는 [`NOTICE`](./NOTICE)에 정리돼 있습니다.
