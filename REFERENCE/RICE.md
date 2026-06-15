# RICE — 우선순위 점수 프레임워크

> Intercom의 Sean McBride가 정립한 백로그 우선순위 계산식.
> 네 가지 변수로 각 아이디어를 단일 점수로 환산 → 큰 점수부터 처리.

## 정의

```
RICE = (Reach × Impact × Confidence) ÷ Effort
```

| 변수 | 단위 | 일반적 범위 | 의미 |
|---|---|---|---|
| **Reach** | 분기당 영향받는 사용자 수 | 100 ~ 10,000+ | 실측 또는 보수적 추정. 한 명에 한 번이 아니라 누적 |
| **Impact** | 단위 사용자당 효과 | 0.25 / 0.5 / 1 / 2 / 3 | "최소~대형" 5단계 정성 척도 (3 = massive) |
| **Confidence** | 추정에 대한 자신감 | 50% / 80% / 100% | 데이터 빈약하면 50%, 강한 근거 있으면 100% |
| **Effort** | 사람-월 (person-months) | 0.5 ~ 12+ | 디자인+엔지니어+QA 총합 |

## 언제 쓰나

- 백로그가 수십~수백 개라 직관 비교가 어려울 때
- 팀 간 우선순위 협상에서 "왜 이게 먼저인가"를 설명해야 할 때
- "우는 아이 떡 하나 더" 식 결정을 막아야 할 때

## 한계

- Confidence가 50% 이하인 아이디어는 RICE로 비교가 무의미 (먼저 가설 검증)
- Reach 추정이 어려운 신규 시장 진입 / 플랫폼 베팅에는 부적합
- "전략적 베팅"을 점수로 표현하기 어려움 (Impact 3을 곱해도 거대 아이디어가 작은 개선에 묻힘)
- Effort 추정 자체가 또 다른 프로젝트

## Remotion 컴포넌트 매핑

이 프레임워크를 영상에서 시각화할 때 권장 매핑:

| 영상 구간 | 컴포넌트 | props 예시 |
|---|---|---|
| 도입 (정의) | `TitleCard` | `{ title: "RICE", subtitle: "우선순위 점수 프레임워크", eyebrow: "Framework #1" }` |
| 4변수 풀이 | `BulletList` | `{ heading: "RICE = (R × I × C) ÷ E", items: ["Reach: 분기당 영향 사용자 수", "Impact: 단위 효과 (0.25~3)", "Confidence: 추정 자신감 (50/80/100%)", "Effort: 사람-월"] }` |
| 예시 비교 | `BulletList` | `{ heading: "예시: 두 아이디어 비교", items: ["A안: 1000 × 2 × 80% ÷ 2 = 800", "B안: 500 × 3 × 100% ÷ 4 = 375", "→ A안 우선"] }` |
| 한계 (반전) | `BulletList` | `{ heading: "RICE의 한계", items: ["Confidence ≤ 50% 아이디어는 비교 무의미", "신규 시장 진입에 부적합", "Effort 추정 자체가 프로젝트"] }` |
| 분위기 배경 | `StockBg` | `{ kind: "video", fallback_color: "#0a0a0a" }` (broll_keywords: `["data dashboard", "team meeting"]`) |

## 참고

- 원문: https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/
- 같이 보면 좋은 프레임워크: [JTBD.md](./JTBD.md) (RICE는 *무엇을* 만들지 정하는 게 아니라 *언제* 만들지 정함 — JTBD가 "왜"를 보완)
