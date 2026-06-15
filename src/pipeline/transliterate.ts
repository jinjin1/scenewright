/**
 * 영어 약어 / 외래어를 한글 음차로 변환 (TTS 발음 보정). 채널 주제 용어를 여기에 추가.
 *
 * Supertonic-3의 "intelligent text normalization"이 숫자/통화/시간은 잘 처리하지만
 * 영어 약어(RICE, KPI 등)는 발음이 새는 경향이 있어 사전 변환이 필요.
 */

export const TRANSLITERATION_MAP: Record<string, string> = {
  RICE: "라이스",
  KPI: "케이피아이",
  OKR: "오케이알",
  MAU: "엠에이유",
  DAU: "디에이유",
  WAU: "더블유에이유",
  ROI: "알오아이",
  MVP: "엠브이피",
  PRD: "피알디",
  SaaS: "사스",
  "A/B": "에이비",
  B2B: "비투비",
  B2C: "비투씨",
  CSAT: "씨샛",
  NPS: "엔피에스",
  ARPU: "에이알피유",
  LTV: "엘티비",
  CAC: "캐크",
  TAM: "탬",
  SAM: "샘",
  SOM: "솜",
  PMF: "피엠에프",
  CRM: "씨알엠",
  UX: "유엑스",
  UI: "유아이",
  API: "에이피아이",
  SDK: "에스디케이",
  CEO: "씨이오",
  CFO: "씨에프오",
  "CI/CD": "씨아이씨디",
  PM: "피엠",
  PR: "피알",
  IT: "아이티",
  AI: "에이아이",
  LLM: "엘엘엠",
  RAG: "랙",
  IDE: "아이디이",
};

const escapeForRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Longest keys first so multi-token patterns (e.g. "A/B") win over substrings.
const sortedKeys = Object.keys(TRANSLITERATION_MAP).sort((a, b) => b.length - a.length);

// Boundary: not preceded or followed by Latin letter or digit.
// Slash is intentionally NOT a boundary char so:
//   - "A/B" still matches as one unit (longest-first sort lets the literal "A/B" key win).
//   - "UX/UI" splits into "UX" + "/" + "UI" → "유엑스/유아이".
// "PRICE" still won't match "RICE" because 'P' is a Latin letter (boundary fails).
const pattern = new RegExp(
  `(?<![A-Za-z0-9])(${sortedKeys.map(escapeForRegex).join("|")})(?![A-Za-z0-9])`,
  "g",
);

export function transliterate(text: string): string {
  return text.replace(pattern, (match) => TRANSLITERATION_MAP[match] ?? match);
}
