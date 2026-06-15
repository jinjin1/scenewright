# JTBD — Jobs To Be Done

> Clayton Christensen이 대중화한 수요 측 프레임워크.
> "사용자는 제품을 사는 게 아니라 *job(과업)*을 끝내려고 제품을 '고용(hire)'한다."

## 정의

핵심 문장 템플릿 (Bob Moesta 변형):

```
[When ___ situation], [I want to ___ motivation], [So I can ___ outcome].
```

| 슬롯 | 설명 | 예시 |
|---|---|---|
| **When** | 트리거가 되는 상황·맥락 | "주말 오후 카페에서 혼자 있을 때" |
| **I want to** | 사용자의 *기능적 + 정서적* 동기 | "조용히 생각을 정리하고 싶다" |
| **So I can** | 끝내려는 진짜 *outcome* | "다음 주 의사결정을 가볍게 시작할 수 있도록" |

## 언제 쓰나

- 페르소나(인구통계)로는 같은 부류인데 행동이 다른 사용자들이 보일 때
- "이 기능 왜 안 쓰지?"의 진짜 원인이 기능 자체가 아닐 때
- 경쟁 정의를 확장해야 할 때 (Netflix의 경쟁자는 잠, 인스타가 아니라 칠리스의 마가리타)

## 한계

- *Job statement* 작성이 어려워 팀별 해석 편차 큼
- 정량 검증(survey)으로 옮기기 까다로움 — Forces of Progress / Switch 인터뷰 같은 정성 방법론과 짝
- "WHY"가 너무 광범위해서 백로그 우선순위 결정에는 부족 → RICE 같은 점수 프레임워크와 짝

## 자주 오해되는 점

1. **JTBD = 페르소나의 다른 이름이 아님.** 페르소나는 "누가", JTBD는 "왜 지금 이 행동". 같은 페르소나도 상황별로 다른 job을 가짐.
2. **Job = Use case가 아님.** Use case는 *어떻게* 쓰는지(인터페이스 동선), Job은 *왜* 쓰는지(맥락+동기+결과).
3. **"기능적 job"만 있는 게 아님.** 정서적(emotional) + 사회적(social) job이 종종 결정적 — "퇴근 후 안주" vs "친구와 인증샷용 안주"는 같은 메뉴라도 다른 job.

## Remotion 컴포넌트 매핑

| 영상 구간 | 컴포넌트 | props 예시 |
|---|---|---|
| 도입 (인용) | `TitleCard` | `{ title: "Jobs To Be Done", subtitle: "사용자는 제품을 '고용'한다", eyebrow: "Framework #2" }` |
| 템플릿 분해 | `BulletList` | `{ heading: "When-Want-So 템플릿", items: ["When: 트리거 상황·맥락", "I want to: 기능적+정서적 동기", "So I can: 끝내려는 outcome"] }` |
| 사례 | `BulletList` | `{ heading: "예: 밀크쉐이크의 진짜 job", items: ["When: 출근길 운전 30분", "I want to: 한 손으로 천천히 흡입할 무언가", "So I can: 점심 전 허기와 지루함을 동시에 해결"] }` |
| 흔한 오해 | `BulletList` | `{ heading: "JTBD ≠ ...", items: ["페르소나 (누가 → 왜 지금)", "Use case (어떻게 → 왜)", "기능적 job만 있는 것 (정서·사회적 job도)"] }` |
| 분위기 배경 | `StockBg` | `{ kind: "photo", fallback_color: "#1a1a1a" }` (broll_keywords: `["coffee shop morning", "person thinking"]`) |

## 참고

- Clayton Christensen 원서: *Competing Against Luck* (2016)
- Bob Moesta 인터뷰 방법론: *Demand-Side Sales 101*
- 같이 보면 좋은 프레임워크: [RICE.md](./RICE.md) (JTBD가 *무엇을* 만들지 결정, RICE가 *언제* 만들지 정함)
