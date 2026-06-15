// Palette — Peter Yang 결의 다층 시스템.
// `accent`는 크림/본 색(#e8e3d6) — 한글 본문과 톤 매치되는 primary signal.
// 강한 시그널(stat 강조 등)은 `signal`(amber)로 분리, 비교 박스는 positive/negative.
export const colors = {
  // surfaces
  bg: "#0a0a0a",
  surface: "#141414",
  elevated: "#1a1a1a",
  rule: "#262626",

  // text
  text: "#f5f5f5",
  textMuted: "#a3a3a3",
  textDim: "#525252",

  // primary accent — cream/bone, 대부분의 eyebrow/마커에 사용
  accent: "#e8e3d6",

  // semantic signals — 빈도 낮게 사용
  signal: "#fbbf24",
  positive: "#10b981",
  negative: "#ef4444",
} as const;
