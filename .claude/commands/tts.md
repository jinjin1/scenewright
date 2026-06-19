---
description: script.json의 모든 라인을 Supertonic-3 M1 voice로 음성 합성
argument-hint: <slug>
---

# /tts

`script.json`의 라인을 한국어 음성으로 합성한다. **LLM 호출 없음** — 로컬 Supertonic-3 ONNX 추론.

## 입력

- `episodes/<slug>/script.json` 필수 (`/script` 단계 완료 상태)

> **권장 선행 게이트**: 합성은 결정적이라 어색한 워딩을 나중에 못 고친다(재합성 필요). 합성 전에 `/script-review <slug>`로 번역체·어색한 한글·미음차 약어를 검수해두면 재작업이 없다. 특히 영어 약어가 음차 사전에 없으면 발음이 깨지므로 여기서 먼저 잡는다.

## 동작

1. `$ARGUMENTS`로 받은 `slug` 검증 — `assertValidSlug` (`/^[a-z0-9][a-z0-9-]{0,63}$/`)
2. `episodes/<slug>/script.json` 존재 확인 — 없으면 `/script` 먼저 안내
3. `npm run tts -- <slug>` 실행
   - 내부: `src/pipeline/cli/tts.ts`가 `transliterate`를 모든 line.text에 적용 후
     Python 서브프로세스(`python/synthesize.py`)로 Supertonic 호출
   - 파라미터 락: `voice="M1"`, `total_steps=16`, `speed=1.4`, `lang="ko"` (`SUPERTONIC_DEFAULT`)
   - 모델 캐시: `~/.cache/supertonic3/` (385MB, 첫 호출 시 다운로드)
4. 합성 후 검증:
   - `episodes/<slug>/assets/audio/` 내 `.wav` 파일 수 = `script.lines` 수
   - 첫 파일을 운영자가 직접 재생해서 한국어 발음 + 음차 처리 확인 (예: 'UX/UI' → '유엑스/유아이')
5. M1 Mac CPU 기준 RTF ≈ 0.43 (10분 영상 ≈ 4분 합성). 진행 로그가 line 단위로 표시됨

## 합성 품질 이슈 시

부자연스러운 영어 약어 발음이 들리면:
1. 어떤 토큰이 문제인지 운영자에게 확인
2. `src/pipeline/transliterate.ts`의 `TRANSLITERATION_MAP`에 매핑 추가
3. 매핑 회귀 방지용 단위 테스트 1줄 추가 (`tests/unit/transliterate.test.ts`)
4. `/tts <slug>` 재실행

해당 line의 wav만 다시 만들고 싶으면 해당 `.wav` 파일을 직접 삭제 후 재실행
(현재 CLI는 기존 파일 덮어쓰지 않음 — 동작 확인 필요. 회고에서 idempotency 정리)

**끝-잘림(truncation) 이슈** — TTS가 문장 끝을 끝까지 발음하지 않으면("출발했어요"→"출발해", "...입니다" 누락): 짧은 라인이 "~어요/입니다"로 끝날 때 Supertonic이 끝 2~3음절을 누락하는 알려진 현상이다. **같은 텍스트 재합성으론 안 고쳐진다** — `script.json`의 해당 line.text를 **길게 + 견고한 어미("~살펴보겠습니다")로 리라이트**한 뒤(상세 규칙은 `/script`의 "대본 작성 핵심 원칙" 6번) 그 라인만 재합성한다. 진단: `ffmpeg -af silencedetect`로는 정상 패딩과 구분이 안 되니(둘 다 trailing 무음) **귀로 확인**해야 한다. 끝-잘림은 `/script-review`의 short-line 위험 경고로 사전에 잡는 게 1차 방어.

라인별 재합성 예: `npx tsx -e` 로 `SupertonicProvider().synthesize([{id, text}], outDir)` 를 해당 라인만 호출(전체 재합성 불필요).

## 다음 단계

`/render <slug>` — storyboard + audio + stock 미디어 → `final.mp4`
