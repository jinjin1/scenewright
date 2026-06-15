// font 실제 로딩은 `src/remotion/fonts.ts`에서 boot 시점에 처리.
// 여기서는 fontFamily 문자열만 노출 — 테스트 환경에서 Remotion font fetch 회피.
// `family`는 한글 본문, `familyDisplay`는 영문/숫자 디스플레이용(Geist).
export const typography = {
  family: '"Noto Sans KR", system-ui, sans-serif',
  familyDisplay: '"Geist", "Inter", system-ui, sans-serif',
  size: {
    display: 144, // cover title, stat number
    title: 96, // 일반 title
    heading: 72, // 섹션 헤더
    subhead: 48,
    subtitle: 48, // alias — legacy key 호환
    body: 36,
    bullet: 36,
    eyebrow: 28,
    caption: 24,
  },
  weight: {
    regular: 400,
    medium: 500,
    bold: 700,
    black: 900,
  },
  lineHeight: 1.35,
  lineHeightTight: 1.12,
  letterSpacing: {
    eyebrow: "0.2em",
    display: "-0.02em",
  },
} as const;
