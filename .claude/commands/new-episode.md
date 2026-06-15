---
description: 새 에피소드 디렉터리 셋업 + source.txt 작성
argument-hint: <slug> [source-file-path]
---

# /new-episode

새 에피소드의 작업 디렉터리를 셋업하고 입력 텍스트를 저장한다. **LLM 호출 없음.**

## 인자

`$ARGUMENTS` 첫 단어 = `slug` (필수), 두 번째 단어 = `source-file-path` (선택).

- `slug`는 `/^[a-z0-9-]+$/` 형식. 예: `pmf-discovery`, `rice-fallacy`, `ep-01`
- `source-file-path`가 주어지면 그 파일 내용을 `source.txt`로 복사. 없으면 운영자가 paste할 자리만 만들고 안내

## 동작

1. `slug` 검증 — `/^[a-z0-9-]+$/` 위반하면 중단하고 사용 예시 안내
2. `episodes/<slug>/` 디렉터리가 이미 존재하면 **중단** — 운영자에게 다른 슬러그 또는 `rm -rf episodes/<slug>` 후 재시도 안내 (자동 삭제 금지)
3. `mkdir -p episodes/<slug>/assets/{audio,stock}` `episodes/<slug>/out`
4. `source-file-path`가 있으면 `cp $source episodes/<slug>/source.txt`
   - 없으면 빈 `source.txt`를 만들고 운영자에게 "이 파일에 ~3-5KB 분량의 입력 텍스트(책 한 챕터 같은)를 paste한 뒤 `/synopsis`를 실행하세요" 안내
5. 결과 보고 — 생성된 경로 트리 + 다음 단계 안내

## 다음 단계

`/synopsis <slug>` — `source.txt`를 읽어 `synopsis.json` 생성

## 비고

- 이 커맨드는 파일 시스템 셋업만 — Claude의 사고가 필요 없는 순수 시스템 작업
- 운영자가 같은 슬러그로 두 번 부르는 실수를 방지하기 위해 디렉터리 존재 시 중단 (덮어쓰기 안 함)
